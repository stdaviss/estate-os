/**
 * `/read` — the editorial listing.
 *
 * Dense rows on hairline rules, in publication order. Pieces about artists we do not
 * represent sit alongside the rest with no visual distinction, because that is what makes
 * this a publication rather than a brochure (05-AGENT-C §C4).
 */

import type { Metadata } from 'next'
import Link from 'next/link'

import { Button, Data, EmptyState, Pill, Rule } from '@repo/ui'

import { ScheduleError } from '../schedule/components/schedule-error'
import { fetchPosts, type PostSummary } from '../schedule/lib/api'

export const metadata: Metadata = {
  title: 'Read',
  description: 'Interviews, show write-ups and scene pieces.',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tag?: string }>
}

export default async function ReadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const result = await fetchPosts(params.tag)

  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <header className="pb-6">
        <h1 className="font-display text-display-l uppercase text-chalk">Read</h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Interviews, show write-ups and pieces about the scene. Mostly about people we do not
          represent.
        </p>
      </header>

      {params.tag ? (
        <p className="flex items-center gap-2 pb-4">
          <span className="font-data text-label uppercase tracking-label text-chalk-mute">
            tagged
          </span>
          <Pill tone="quiet">
            <span className="font-data text-label uppercase tracking-label">{params.tag}</span>
          </Pill>
          <Link
            href="/read"
            className="rounded font-data text-label uppercase tracking-label text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
          >
            clear
          </Link>
        </p>
      ) : null}

      <Rule />

      {!result.ok ? (
        result.error.code === 'not_found' ? (
          <EmptyState label="NO MATCH">
            <p className="font-body text-body text-chalk-dim">
              Nothing here for that. Try a genre, a city, or an artist name.
            </p>
            <div className="mt-4">
              <Button variant="ghost" href="/read">
                <span className="font-data text-label uppercase tracking-label">
                  everything else
                </span>
              </Button>
            </div>
          </EmptyState>
        ) : (
          <ScheduleError message={result.error.message} />
        )
      ) : result.data.length === 0 ? (
        <EmptyState label="READ">
          <p className="font-body text-body text-chalk-dim">
            Nothing published yet. The first pieces are being written — interviews with people
            sending us mixes, mostly.
          </p>
          <div className="mt-4">
            <Button variant="primary" href="/submit">
              <span className="font-data text-label uppercase tracking-label">send us a mix</span>
            </Button>
          </div>
        </EmptyState>
      ) : (
        <ul className="list-none">
          {result.data.map((post) => (
            <li key={post.slug}>
              <PostRow post={post} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function PostRow({ post }: { post: PostSummary }) {
  return (
    <article className="border-b border-rule transition-colors duration-hover hover:bg-deck">
      <Link
        href={`/read/${post.slug}`}
        className="block rounded px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
      >
        <div className="flex flex-wrap items-center gap-3">
          {post.display.date ? (
            <Data className="text-chalk-mute">{post.display.date}</Data>
          ) : (
            <Pill tone="quiet">
              <span className="font-data text-label uppercase tracking-label">draft</span>
            </Pill>
          )}
          {post.author_name ? (
            <span className="font-data text-label uppercase tracking-label text-chalk-mute">
              {post.author_name}
            </span>
          ) : null}
        </div>

        <h2 className="mt-2 font-display text-display-m uppercase text-chalk">{post.title}</h2>

        {post.standfirst ? (
          <p className="mt-2 max-w-measure font-body text-body text-chalk-dim">{post.standfirst}</p>
        ) : null}
      </Link>
    </article>
  )
}
