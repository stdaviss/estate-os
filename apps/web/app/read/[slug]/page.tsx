/**
 * `/read/:slug` — one piece.
 *
 * Generous measure, `body-l`, and a related-artists module that links out to records
 * regardless of whether we represent the artist. The relationship is shown as a mono
 * micro-label so a guest is never mistaken for a signing (00-FOUNDATION.md §2).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { Artwork, Data, Rule, SectionHead } from '@repo/ui'

import { NowOn } from '../../schedule/components/now-on'
import { ScheduleError } from '../../schedule/components/schedule-error'
import { fetchPost, type PostDetail } from '../../schedule/lib/api'
import { resolveNextEpisode } from '../../schedule/lib/next-up'
import { resolveViewerTimeZone, TIMEZONE_COOKIE } from '../../schedule/lib/viewer-timezone'
import { PostBody } from '../lib/mdx'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await fetchPost(slug)
  if (!result.ok) return { title: 'Read' }
  return { title: result.data.title, description: result.data.standfirst ?? undefined }
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params
  const cookieStore = await cookies()
  const { timeZone } = resolveViewerTimeZone(undefined, cookieStore.get(TIMEZONE_COOKIE)?.value)

  // Fetched together: the sidebar is not worth serialising behind the article.
  const [result, nextEpisode] = await Promise.all([fetchPost(slug), resolveNextEpisode(timeZone)])

  if (!result.ok) {
    if (result.error.code === 'not_found') notFound()
    return (
      <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
        <ScheduleError message={result.error.message} />
      </main>
    )
  }

  const post = result.data

  return (
    <div className="mx-auto grid w-full max-w-content gap-8 px-4 py-8 md:px-8 lg:grid-cols-[1fr_224px]">
      <main>
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">
          <Link href="/read" className="rounded outline-none focus-visible:ring-2 focus-visible:ring-sodium">
            read
          </Link>
        </p>

        <article className="mt-4">
          <header>
            <div className="flex flex-wrap items-center gap-3">
              {post.display.date ? <Data className="text-chalk-mute">{post.display.date}</Data> : null}
              {post.author_name ? (
                <span className="font-data text-label uppercase tracking-label text-chalk-mute">
                  {post.author_name}
                </span>
              ) : null}
              {!post.is_published ? (
                <span className="font-data text-label uppercase tracking-label text-sodium">
                  draft
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 max-w-measure font-display text-display-xl uppercase text-chalk">
              {post.title}
            </h1>

            {post.standfirst ? (
              <p className="mt-4 max-w-measure font-body text-body-l text-chalk-dim">
                {post.standfirst}
              </p>
            ) : null}
          </header>

          {post.hero_url ? (
            <div className="mt-6">
              {/* Editorial hero images are described by the standfirst that follows them. */}
              <Artwork src={post.hero_url} alt="" size={0} className="w-full" />
            </div>
          ) : null}

          <Rule className="my-8" />

          <PostBody source={post.body_mdx} />
        </article>

        {post.related_artists.length > 0 ? <RelatedArtists post={post} /> : null}
      </main>

      <aside className="lg:sticky lg:top-16 lg:self-start">
        <NowOn nextEpisode={nextEpisode} />
      </aside>
    </div>
  )
}

function RelatedArtists({ post }: { post: PostDetail }) {
  return (
    <section className="mt-12" aria-labelledby="related">
      <SectionHead>
        <h2 id="related" className="font-display text-display-m uppercase text-chalk">
          Also in this piece
        </h2>
      </SectionHead>

      <ul className="list-none">
        {post.related_artists.map((artist) => (
          <li key={artist.slug} className="border-b border-rule transition-colors duration-hover hover:bg-deck">
            <Link
              href={`/artists/${artist.slug}`}
              className="flex items-center gap-4 rounded px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
            >
              <Artwork
                src={artist.image_url}
                alt={artist.image_url ? `${artist.name}` : ''}
                size={48}
              />
              <span className="min-w-0">
                <span className="block font-display text-display-m uppercase text-chalk">
                  {artist.name}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  {artist.city ? (
                    <span className="font-body text-body-s text-chalk-dim">{artist.city}</span>
                  ) : null}
                  {/* Stated plainly: covering someone is not representing them. */}
                  <span className="font-data text-label uppercase tracking-label text-chalk-mute">
                    {artist.relationship}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
