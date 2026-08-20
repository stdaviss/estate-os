/**
 * `/schedule` — the listings.
 *
 * 05-AGENT-C §C1 says the schedule is the homepage. It cannot be mounted at `/` from here:
 * that needs `apps/web/app/page.tsx` or a rewrite in `next.config`, and neither is in Agent
 * C's ownership (00-FOUNDATION.md §7). Raised as BLOCKER 13 with the two-line diff.
 *
 * Nothing on this page is ordered per visitor. The only inputs are a date range and a
 * timezone; no session is read and no request carries a user id.
 */

import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { Button, EmptyState, Rule } from '@repo/ui'

import { DayGroup } from './components/day-group'
import { NowOn } from './components/now-on'
import { ScheduleError } from './components/schedule-error'
import { TimezoneNote } from './components/timezone-note'
import { fetchSchedule } from './lib/api'
import { resolveViewerTimeZone, STATION_TIMEZONE, TIMEZONE_COOKIE } from './lib/viewer-timezone'

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'What is on now and what is on next.',
}

/** Listings go stale by the minute and the live row must be current. */
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tz?: string; from?: string; to?: string }>
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const { timeZone, isFallback } = resolveViewerTimeZone(
    params.tz,
    cookieStore.get(TIMEZONE_COOKIE)?.value,
  )

  const range = params.from && params.to ? { from: params.from, to: params.to } : undefined
  const result = await fetchSchedule(timeZone, range)

  if (!result.ok) {
    return (
      <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
        <PageTitle />
        <ScheduleError message={result.error.message} />
      </main>
    )
  }

  const schedule = result.data
  const nextEpisode =
    schedule.days
      .flatMap((day) => day.episodes)
      .find(
        (episode) =>
          episode.id !== schedule.live_episode_id &&
          Date.parse(episode.starts_at) > Date.now() &&
          episode.state !== 'expired',
      ) ?? null

  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <PageTitle />

      <NowOn nextEpisode={nextEpisode} variant="banner" />

      <TimezoneNote
        timeZone={schedule.timezone}
        stationTimeZone={schedule.station_timezone}
        isFallback={isFallback}
      />

      <Rule />

      {schedule.is_empty ? (
        <EmptyState label="SCHEDULE">
          <p className="font-body text-body text-chalk-dim">
            Nothing is scheduled yet. The first broadcasts are being booked now — the shows will
            appear here as they are confirmed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="primary" href="/submit">
              <span className="font-data text-label uppercase tracking-label">send us a mix</span>
            </Button>
            <Button variant="ghost" href="/read">
              <span className="font-data text-label uppercase tracking-label">read</span>
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {schedule.days.map((day) => (
            <DayGroup
              key={day.date}
              day={day}
              liveEpisodeId={schedule.live_episode_id}
              showStationTime={!isFallback && schedule.timezone !== STATION_TIMEZONE}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function PageTitle() {
  return (
    <header className="pb-6">
      <h1 className="font-display text-display-l uppercase text-chalk">Schedule</h1>
      <p className="mt-2 font-body text-body text-chalk-dim">
        Three days back, seven forward. Times are yours, not ours.
      </p>
    </header>
  )
}
