/**
 * `/schedule/:episodeId` — one airing.
 *
 * Serves three states from one page: scheduled (set an alert, add to calendar), on air
 * (listen, handed to Agent A), and expired (the tracklist, and no way to hear it). The
 * expired framing is stated once, plainly, and never repeated as an apology.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { Artwork, Button, Data, Pill, Rule, SectionHead } from '@repo/ui'

import { Tracklist } from '../../archive/components/tracklist'
import { AlertButton } from '../components/alert-button'
import { ListenButton } from '../components/listen-button'
import { ScheduleError } from '../components/schedule-error'
import { fetchEpisode } from '../lib/api'
import { resolveViewerTimeZone, TIMEZONE_COOKIE } from '../lib/viewer-timezone'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ episodeId: string }>
  searchParams: Promise<{ tz?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { episodeId } = await params
  const result = await fetchEpisode(episodeId, 'Europe/Paris')
  if (!result.ok) return { title: 'Episode' }
  return {
    title: result.data.episode.title,
    description: result.data.episode.show.description ?? undefined,
  }
}

export default async function EpisodePage({ params, searchParams }: PageProps) {
  const { episodeId } = await params
  const query = await searchParams
  const cookieStore = await cookies()
  const { timeZone } = resolveViewerTimeZone(query.tz, cookieStore.get(TIMEZONE_COOKIE)?.value)

  const result = await fetchEpisode(episodeId, timeZone)

  if (!result.ok) {
    if (result.error.code === 'not_found') notFound()
    return (
      <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
        <ScheduleError message={result.error.message} />
      </main>
    )
  }

  const { episode, tracklist } = result.data
  const isExpired = episode.state === 'expired'
  const isOnAir = episode.state === 'live' || episode.state === 'repeat_live'

  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <p className="font-data text-label uppercase tracking-label text-chalk-mute">
        <Link href="/schedule" className="rounded outline-none focus-visible:ring-2 focus-visible:ring-sodium">
          schedule
        </Link>
      </p>

      <header className="mt-4 grid gap-6 sm:grid-cols-[160px_1fr]">
        <Artwork
          src={episode.show.artwork_url}
          alt={episode.show.artwork_url ? `Artwork for ${episode.show.title}` : ''}
          size={160}
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isOnAir ? (
              <Pill tone="live">
                <span className="font-data text-label uppercase tracking-label">on air</span>
              </Pill>
            ) : null}
            {isExpired ? (
              <Pill tone="quiet">
                <span className="font-data text-label uppercase tracking-label">expired</span>
              </Pill>
            ) : null}
            {episode.show.genres.map((genre) => (
              <Pill key={genre.slug} tone="quiet">
                <span className="font-data text-label uppercase tracking-label">{genre.name}</span>
              </Pill>
            ))}
          </div>

          <h1 className="mt-3 font-display text-display-l uppercase text-chalk">{episode.title}</h1>

          {episode.guest ? (
            <p className="mt-2 font-body text-body-l text-chalk-dim">
              <Link
                href={`/artists/${episode.guest.slug}`}
                className="rounded text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
              >
                {episode.guest.name}
              </Link>
              {episode.guest.relationship === 'guest' ? (
                <span className="ml-2 font-data text-label uppercase tracking-label text-chalk-mute">
                  guest
                </span>
              ) : null}
            </p>
          ) : null}

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Fact label="date">{episode.display.local_date}</Fact>
            <Fact label={`time ${episode.display.local_offset}`}>{episode.display.local_time}</Fact>
            <Fact label="duration">{episode.display.duration}</Fact>
            {isExpired ? <Fact label="peak listeners">{pad4(episode.peak_listeners)}</Fact> : null}
          </dl>

          {episode.display.local_timezone !== episode.display.station_timezone ? (
            <p className="mt-3 font-body text-body-s text-chalk-mute">
              <span className="font-data text-label uppercase tracking-label">station time </span>
              {episode.display.station_date} {episode.display.station_time}{' '}
              {episode.display.station_offset}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {isOnAir ? <ListenButton episodeId={episode.id} /> : null}
            {!isOnAir && !isExpired ? (
              <>
                <AlertButton
                  artistSlug={episode.guest?.slug ?? episode.show.host?.slug ?? null}
                  genreSlug={episode.show.genres[0]?.slug ?? null}
                  label={episode.title}
                />
                <Button variant="ghost" href={`/api/v1/schedule/ics/${episode.show.slug}`}>
                  <span className="font-data text-label uppercase tracking-label">
                    add to calendar
                  </span>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {episode.show.description ? (
        <>
          <Rule className="my-8" />
          <p className="max-w-measure font-body text-body-l text-chalk-dim">
            {episode.show.description}
          </p>
        </>
      ) : null}

      {isExpired ? (
        <>
          <Rule className="my-8" />
          <section aria-labelledby="expired">
            <p
              id="expired"
              className="font-data text-label uppercase tracking-label text-chalk-mute"
            >
              expired
            </p>
            <p className="mt-2 max-w-measure font-body text-body-l text-chalk">
              This aired on {episode.display.station_date} and was not recorded. The tracklist is
              below.
            </p>
          </section>
        </>
      ) : null}

      {tracklist.length > 0 ? (
        <>
          <Rule className="my-8" />
          <SectionHead>
            <h2 className="font-display text-display-m uppercase text-chalk">Tracklist</h2>
          </SectionHead>
          <Tracklist tracks={tracklist} />
        </>
      ) : null}

      {!isExpired && tracklist.length === 0 ? (
        <>
          <Rule className="my-8" />
          <p className="font-data text-label uppercase tracking-label text-chalk-mute">tracklist</p>
          <p className="mt-2 font-body text-body-s text-chalk-dim">
            Logged live as the show airs, and kept afterwards.
          </p>
        </>
      ) : null}
    </main>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-data text-label uppercase tracking-label text-chalk-mute">{label}</dt>
      <dd className="mt-1">
        <Data>{children}</Data>
      </dd>
    </div>
  )
}

function pad4(value: number): string {
  return String(value).padStart(4, '0')
}
