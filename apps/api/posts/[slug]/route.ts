/**
 * `GET /api/v1/posts/:slug` — one piece, with its related artists.
 *
 * The MDX body is returned as source. Rendering happens in the web app, so the editor's
 * preview and the published page go through exactly one renderer and cannot disagree.
 */

import { currentUser, isStaff } from '../../alerts/lib/session'
import { fail, ok } from '../../schedule/lib/http'
import { formatDateStamp, STATION_TIMEZONE } from '../../schedule/lib/time'
import { getPostBySlug, getRelatedArtists } from '../lib/repository'

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params
  if (!SLUG.test(slug)) return fail('bad_request', 'That is not a post address.', 'slug')

  const user = await currentUser()
  const post = await getPostBySlug(slug, { includeUnpublished: isStaff(user) })
  if (!post) return fail('not_found', 'No piece at that address. The reading list has the rest.')

  const related = await getRelatedArtists(post.relatedArtistIds)

  return ok({
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    author_name: post.authorName,
    hero_url: post.heroUrl,
    body_mdx: post.bodyMdx,
    published_at: post.publishedAt?.toISOString() ?? null,
    is_published: post.publishedAt !== null,
    display: {
      date: post.publishedAt ? formatDateStamp(post.publishedAt, STATION_TIMEZONE) : null,
    },
    // Artists we do not represent appear here too: that is the point of covering them.
    related_artists: related.map((artist) => ({
      slug: artist.slug,
      name: artist.name,
      city: artist.city,
      image_url: artist.imageUrl,
      relationship: artist.relationship,
    })),
  })
}
