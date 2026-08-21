/**
 * `GET /api/v1/posts` — the editorial listing.
 * `POST /api/v1/posts` — staff write, for the minimal editor in §C4.
 *
 * The POST is not in 02-CONTRACTS.md §2, which lists only the two reads. §C4 requires an
 * editor with a publish toggle, and an editor cannot save without a write endpoint, so it
 * is implemented here and raised as BLOCKER 11 with the contract lines to add.
 *
 * Drafts are visible to staff only, and that is checked from the session on the server.
 */

import { decodeCursor, encodeCursor, fail, ok, readPagination } from '../schedule/lib/http'
import { formatDateStamp, STATION_TIMEZONE } from '../schedule/lib/time'
import { currentUser, isStaff } from '../alerts/lib/session'
import {
  listPosts,
  resolveArtistIdBySlug,
  resolveArtistIdsBySlug,
  upsertPost,
  type PostSummary,
} from './lib/repository'

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/
const MAX_BODY_CHARS = 120_000

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const { limit, cursor } = readPagination(url)

  const decoded = cursor ? decodeCursor(cursor) : null
  if (cursor && !decoded) {
    return fail('bad_request', 'That cursor is not readable. Request the first page again.', 'cursor')
  }

  // `?tag=` is read as an artist slug: 05-AGENT-C §C4 ties tagging to `related_artist_ids`,
  // and there is no tag table in the contract. Recorded in SUBMISSION.md §8.
  const tag = url.searchParams.get('tag')
  if (tag && !SLUG.test(tag)) {
    return fail('bad_request', 'A tag is an artist name in slug form.', 'tag')
  }
  const artistId = tag ? await resolveArtistIdBySlug(tag) : null
  if (tag && !artistId) {
    return fail('not_found', 'Nothing tagged with that artist.', 'tag')
  }

  const user = await currentUser()
  const includeUnpublished = isStaff(user)

  const page = await listPosts({
    limit,
    cursor: decoded ? { publishedAt: decoded.startsAt, slug: decoded.id } : null,
    artistId,
    includeUnpublished,
  })

  return ok(page.posts.map(serializePost), {
    next_cursor: page.nextCursor
      ? encodeCursor(page.nextCursor.publishedAt, page.nextCursor.slug)
      : null,
  })
}

interface WriteBody {
  slug?: unknown
  title?: unknown
  standfirst?: unknown
  body_mdx?: unknown
  author_name?: unknown
  hero_url?: unknown
  related_artists?: unknown
  publish?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser()
  if (!user) return fail('unauthorised', 'Sign in to write.')
  if (!isStaff(user)) return fail('forbidden', 'Writing is for staff accounts.')

  let body: WriteBody
  try {
    body = (await request.json()) as WriteBody
  } catch {
    return fail('bad_request', 'Send a JSON body.')
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!SLUG.test(slug)) {
    return fail('bad_request', 'A slug is lower case letters, numbers and hyphens.', 'slug')
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length === 0) return fail('bad_request', 'Give the piece a title.', 'title')

  const bodyMdx = typeof body.body_mdx === 'string' ? body.body_mdx : ''
  if (bodyMdx.trim().length === 0) return fail('bad_request', 'The body is empty.', 'body_mdx')
  if (bodyMdx.length > MAX_BODY_CHARS) {
    return fail('bad_request', 'That body is too long to store.', 'body_mdx')
  }

  const relatedSlugs = Array.isArray(body.related_artists)
    ? body.related_artists.filter((value): value is string => typeof value === 'string')
    : []
  if (relatedSlugs.some((value) => !SLUG.test(value))) {
    return fail('bad_request', 'Related artists are slugs.', 'related_artists')
  }

  const saved = await upsertPost({
    slug,
    title,
    standfirst: typeof body.standfirst === 'string' ? body.standfirst.trim() || null : null,
    bodyMdx,
    authorName: typeof body.author_name === 'string' ? body.author_name.trim() || null : null,
    heroUrl: typeof body.hero_url === 'string' ? body.hero_url.trim() || null : null,
    relatedArtistIds: await resolveArtistIdsBySlug(relatedSlugs),
    publish: body.publish === true,
  })

  return ok(serializePost(saved))
}

export function serializePost(post: PostSummary): Record<string, unknown> {
  return {
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    author_name: post.authorName,
    hero_url: post.heroUrl,
    published_at: post.publishedAt?.toISOString() ?? null,
    is_published: post.publishedAt !== null,
    display: {
      date: post.publishedAt ? formatDateStamp(post.publishedAt, STATION_TIMEZONE) : null,
    },
  }
}
