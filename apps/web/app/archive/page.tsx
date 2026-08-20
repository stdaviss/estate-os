/**
 * `/archive` — expired episodes, in full detail, unplayable.
 *
 * The absence is the feature (00-FOUNDATION.md §4). Stated once, matter-of-fact, and then
 * the page gets on with showing what aired. There is no play control anywhere on it — not
 * disabled, not greyed out, not hidden behind a tooltip. A disabled control implies it might
 * work later; nothing here ever will.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'

import { Artwork, Button, Data, EmptyState, Pill, Rule } from '@repo/ui'

import { ScheduleError } from '../schedule/components/schedule-error'
import { fetchArchive, type EpisodeDetail } from '../schedule/lib/api'
import { resolveViewerTimeZone, TIMEZONE_COOKIE } from '../schedule/lib/viewer-timezone'
import { Tracklist } from './components/tracklist'

export const metadata: Metadata = {
  title: 'Archive',
  description: 'What aired, in detail. The recordings are gone; the tracklists are not.',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ cursor?: string }>
}

export default async function ArchivePage({ searchParams }: PageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const { timeZone } = resolveViewerTimeZone(undefined, cookieStore.get(TIMEZONE_COOKIE)?.value)

  const result = await fetchArchive(timeZone, params.cursor)

  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <header className="pb-6">
        <h1 className="font-display text-display-l uppercase text-chalk">Archive</h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Shows are not kept. What survives is the record of them: who played, what they
          played, and when. That is on purpose.
        </p>
      </header>

      <Rule />

      {!result.ok ? (
        <ScheduleError message={result.error.message} />
      ) : result.data.length === 0 ? (
        <EmptyState label="ARCHIVE">
          <p className="font-body text-body text-chalk-dim">
            Nothing has aired yet. The first broadcast is scheduled.
          </p>
          <div className="mt-4">
            <Button variant="primary" href="/schedule">
              <span className="font-data text-label uppercase tracking-label">
                see the schedule
              </span>
            </Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <ol className="mt-6 flex list-none flex-col gap-12">
            {result.data.map((entry) => (
              <li key={entry.episode.id}>
                <ArchiveEntry entry={entry} />
              </li>
            ))}
          </ol>

          {typeof result.meta?.next_cursor === 'string' ? (
            <div className="mt-12">
              <Button variant="ghost" href={`/archive?cursor=${encodeURIComponent(result.meta.next_cursor)}`}>
                <span className="font-data text-label uppercase tracking-label">older shows</span>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  )
}

function ArchiveEntry({ entry }: { entry: EpisodeDetail }) {
  const { episode, tracklist } = entry

  return (
    <article id={episode.id} aria-labelledby={`title-${episode.id}`}>
      <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
        <Artwork
          src={episode.show.artwork_url}
          alt={episode.show.artwork_url ? `Artwork for ${episode.show.title}` : ''}
          size={96}
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Data className="text-chalk-dim">{episode.display.station_date}</Data>
            <Pill tone="quiet">
              <span className="font-data text-label uppercase tracking-label">expired</span>
            </Pill>
            {episode.show.genres.map((genre) => (
              <Pill key={genre.slug} tone="quiet">
                <span className="font-data text-label uppercase tracking-label">{genre.name}</span>
              </Pill>
            ))}
          </div>

          <h2
            id={`title-${episode.id}`}
            className="mt-2 font-display text-display-m uppercase text-chalk"
          >
            <Link
              href={`/schedule/${episode.id}`}
              className="rounded outline-none focus-visible:ring-2 focus-visible:ring-sodium"
            >
              {episode.title}
            </Link>
          </h2>

          {episode.guest ?? episode.show.host ? (
            <p className="mt-1 font-body text-body-s text-chalk-dim">
              {episode.guest ? (
                <Link
                  href={`/artists/${episode.guest.slug}`}
                  className="rounded text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
                >
                  {episode.guest.name}
                </Link>
              ) : (
                episode.show.host?.name
              )}
              {episode.guest && episode.show.host ? (
                <span className="text-chalk-mute"> · hosted by {episode.show.host.name}</span>
              ) : null}
            </p>
          ) : null}

          <p className="mt-3 max-w-measure font-body text-body text-chalk">
            This aired on {episode.display.station_date} and was not recorded. The tracklist is
            below.
          </p>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="duration">{episode.display.duration}</Stat>
            <Stat label="peak listeners">{String(episode.peak_listeners).padStart(4, '0')}</Stat>
            <Stat label="tracks">{String(tracklist.length).padStart(2, '0')}</Stat>
          </dl>
        </div>
      </div>

      <div className="mt-6 border-t border-rule">
        <Tracklist tracks={tracklist} />
      </div>
    </article>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-data text-label uppercase tracking-label text-chalk-mute">{label}</dt>
      <dd className="mt-1">
        <Data>{children}</Data>
      </dd>
    </div>
  )
}
