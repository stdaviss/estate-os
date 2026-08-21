/**
 * Editorial queries.
 *
 * Posts link out to artists we do not represent (05-AGENT-C §C4), so `related_artist_ids`
 * is resolved to published artist records for the related-artists module and nothing
 * filters on `relationship`.
 *
 * Same caveat as the other repositories: `packages/schema` was absent when this was
 * written (BLOCKER 1) and these imports do not resolve yet.
 */

import { and, arrayContains, desc, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'

import { db } from '@repo/schema/client'
import { artists, posts } from '@repo/schema'

export interface PostSummary {
  slug: string
  title: string
  standfirst: string | null
  authorName: string | null
  heroUrl: string | null
  publishedAt: Date | null
  relatedArtistIds: string[]
}

export interface PostDetail extends PostSummary {
  bodyMdx: string
}

export interface RelatedArtist {
  slug: string
  name: string
  city: string | null
  imageUrl: string | null
  relationship: 'guest' | 'affiliate' | 'roster' | 'alumni'
}

const SUMMARY_COLUMNS = {
  slug: posts.slug,
  title: posts.title,
  standfirst: posts.standfirst,
  authorName: posts.authorName,
  heroUrl: posts.heroUrl,
  publishedAt: posts.publishedAt,
  relatedArtistIds: posts.relatedArtistIds,
}

export interface ListPostsOptions {
  limit: number
  cursor: { publishedAt: Date; slug: string } | null
  /** An artist slug to filter by. `?tag=` in the contract is read as an artist tag. */
  artistId?: string | null
  /** Staff only: include drafts. */
  includeUnpublished?: boolean
}

export interface PostsPage {
  posts: PostSummary[]
  nextCursor: { publishedAt: Date; slug: string } | null
}

export async function listPosts(options: ListPostsOptions): Promise<PostsPage> {
  const conditions = []
  if (!options.includeUnpublished) conditions.push(isNotNull(posts.publishedAt))
  if (options.artistId) conditions.push(arrayContains(posts.relatedArtistIds, [options.artistId]))
  if (options.cursor) {
    conditions.push(
      or(
        lt(posts.publishedAt, options.cursor.publishedAt),
        and(eq(posts.publishedAt, options.cursor.publishedAt), lt(posts.slug, options.cursor.slug)),
      ),
    )
  }

  const rows = await db
    .select(SUMMARY_COLUMNS)
    .from(posts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(posts.publishedAt), desc(posts.slug))
    .limit(options.limit + 1)

  const page = rows.slice(0, options.limit)
  const last = page[page.length - 1]
  return {
    posts: page.map(mapSummary),
    nextCursor:
      rows.length > options.limit && last?.publishedAt
        ? { publishedAt: last.publishedAt, slug: last.slug }
        : null,
  }
}

export async function getPostBySlug(
  slug: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<PostDetail | null> {
  const [row] = await db
    .select({ ...SUMMARY_COLUMNS, bodyMdx: posts.bodyMdx })
    .from(posts)
    .where(eq(posts.slug, slug))
    .limit(1)

  if (!row) return null
  if (!options.includeUnpublished && row.publishedAt === null) return null
  return { ...mapSummary(row), bodyMdx: row.bodyMdx }
}

/** Published artists referenced by a post, in the order the post lists them. */
export async function getRelatedArtists(artistIds: string[]): Promise<RelatedArtist[]> {
  if (artistIds.length === 0) return []
  const rows = await db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      city: artists.city,
      imageUrl: artists.imageUrl,
      relationship: artists.relationship,
    })
    .from(artists)
    .where(and(inArray(artists.id, artistIds), eq(artists.isPublished, true)))

  const byId = new Map(rows.map((row) => [row.id, row]))
  return artistIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      city: row.city,
      imageUrl: row.imageUrl,
      relationship: row.relationship,
    }))
}

export interface UpsertPostInput {
  slug: string
  title: string
  standfirst: string | null
  bodyMdx: string
  authorName: string | null
  heroUrl: string | null
  relatedArtistIds: string[]
  publish: boolean
}

/**
 * Creates or replaces a post from the staff editor.
 *
 * `published_at` is set on first publish and preserved afterwards, so editing a live post
 * does not move it to the top of the listing. Unpublishing clears it.
 */
export async function upsertPost(input: UpsertPostInput): Promise<PostDetail> {
  const existing = await db
    .select({ publishedAt: posts.publishedAt })
    .from(posts)
    .where(eq(posts.slug, input.slug))
    .limit(1)

  const previous = existing[0]?.publishedAt ?? null
  const publishedAt = input.publish ? (previous ?? new Date()) : null

  const values = {
    slug: input.slug,
    title: input.title,
    standfirst: input.standfirst,
    bodyMdx: input.bodyMdx,
    authorName: input.authorName,
    heroUrl: input.heroUrl,
    relatedArtistIds: input.relatedArtistIds,
    publishedAt,
    updatedAt: new Date(),
  }

  await db.insert(posts).values(values).onConflictDoUpdate({
    target: posts.slug,
    set: { ...values, createdAt: sql`${posts.createdAt}` },
  })

  const saved = await getPostBySlug(input.slug, { includeUnpublished: true })
  if (!saved) throw new Error('post disappeared immediately after write')
  return saved
}

export async function resolveArtistIdsBySlug(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return []
  const rows = await db
    .select({ id: artists.id, slug: artists.slug })
    .from(artists)
    .where(inArray(artists.slug, slugs))
  const bySlug = new Map(rows.map((row) => [row.slug, row.id]))
  return slugs.map((slug) => bySlug.get(slug)).filter((id): id is string => id !== undefined)
}

export async function resolveArtistIdBySlug(slug: string): Promise<string | null> {
  const [row] = await db.select({ id: artists.id }).from(artists).where(eq(artists.slug, slug)).limit(1)
  return row?.id ?? null
}

function mapSummary(row: {
  slug: string
  title: string
  standfirst: string | null
  authorName: string | null
  heroUrl: string | null
  publishedAt: Date | null
  relatedArtistIds: string[] | null
}): PostSummary {
  return {
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    authorName: row.authorName,
    heroUrl: row.heroUrl,
    publishedAt: row.publishedAt,
    relatedArtistIds: row.relatedArtistIds ?? [],
  }
}
