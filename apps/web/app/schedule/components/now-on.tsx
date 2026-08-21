'use client'

/**
 * The "what's on now" module (05-AGENT-C §C6).
 *
 * Built once and exported for the schedule, the archive header and the editorial sidebar.
 * Reads Agent A's `BroadcastContext` for live state and falls back to the next scheduled
 * episode with a countdown when nothing is on air.
 *
 * Shared export — other agents may import this from
 * `apps/web/app/schedule/components/now-on`. Noted in manifest.json under exports_shared.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Data, Pill, StatusDot } from '@repo/ui'

import { useBroadcast } from '../../../components/player/context'
import type { PublicEpisode } from '../lib/api'

export interface NowOnProps {
  /** The next scheduled episode, resolved on the server so first paint is correct. */
  nextEpisode: PublicEpisode | null
  /** `rail` for a narrow sidebar, `banner` for a full-width strip above a listing. */
  variant?: 'rail' | 'banner'
}

/**
 * `HH:MM:SS`, or `3D 04:12` beyond a day out. Mirrors `formatCountdown` in
 * `apps/api/schedule/lib/time.ts`; it is duplicated because a ticking countdown has to run
 * in the browser and there is no shared package Agent C may write to (BLOCKER 4).
 */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const pad = (value: number) => String(value).padStart(2, '0')
  const days = Math.floor(totalSeconds / 86_400)
  if (days >= 1) {
    return `${days}D ${pad(Math.floor((totalSeconds % 86_400) / 3600))}:${pad(
      Math.floor((totalSeconds % 3600) / 60),
    )}`
  }
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(
    totalSeconds % 60,
  )}`
}

export function NowOn({ nextEpisode, variant = 'rail' }: NowOnProps) {
  const broadcast = useBroadcast()
  const [remaining, setRemaining] = useState<number | null>(null)

  const startsAt = nextEpisode ? Date.parse(nextEpisode.starts_at) : null

  useEffect(() => {
    if (startsAt === null || broadcast.isLive) {
      setRemaining(null)
      return
    }
    // Set immediately so the first render after hydration is already correct.
    setRemaining(startsAt - Date.now())
    const timer = window.setInterval(() => setRemaining(startsAt - Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [startsAt, broadcast.isLive])

  const isBanner = variant === 'banner'

  if (broadcast.isLive && broadcast.episode) {
    return (
      <section
        aria-label="On air now"
        className={`border-y border-rule bg-sodium-wash ${isBanner ? 'px-4 py-3' : 'p-4'}`}
      >
        <div className="flex items-center gap-2">
          <StatusDot tone="live" />
          <Pill tone="live">
            <span className="font-data text-label uppercase tracking-label">on air</span>
          </Pill>
        </div>
        <h2 className="mt-2 font-display text-display-m uppercase text-chalk">
          {broadcast.episode.title}
        </h2>
        {broadcast.episode.guest ? (
          <p className="mt-1 font-body text-body-s text-chalk-dim">{broadcast.episode.guest.name}</p>
        ) : null}
        <p className="mt-2">
          <Data>{broadcast.listeners.toString().padStart(4, '0')}</Data>
          <span className="ml-2 font-data text-label uppercase tracking-label text-chalk-mute">
            listening
          </span>
        </p>
      </section>
    )
  }

  if (!nextEpisode) {
    return (
      <section
        aria-label="What is on next"
        className={`border-y border-rule ${isBanner ? 'px-4 py-3' : 'p-4'}`}
      >
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">off air</p>
        <p className="mt-2 font-body text-body-s text-chalk-dim">
          Nothing is scheduled yet. The first broadcast will be announced here.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="What is on next"
      className={`border-y border-rule ${isBanner ? 'px-4 py-3' : 'p-4'}`}
    >
      <p className="font-data text-label uppercase tracking-label text-chalk-mute">next</p>
      <h2 className="mt-2 font-display text-display-m uppercase text-chalk">
        <Link href={`/schedule/${nextEpisode.id}`} className="hover:text-sodium focus-visible:text-sodium">
          {nextEpisode.title}
        </Link>
      </h2>
      <p className="mt-1 font-body text-body-s text-chalk-dim">
        {nextEpisode.guest?.name ?? nextEpisode.show.host?.name ?? 'Rotation'}
      </p>
      <p className="mt-2 flex flex-wrap items-baseline gap-2">
        <Data>{nextEpisode.display.local_time}</Data>
        <span className="font-data text-label uppercase tracking-label text-chalk-mute">
          {nextEpisode.display.local_offset}
        </span>
        {remaining === null ? null : (
          <>
            <span className="font-data text-label uppercase tracking-label text-chalk-mute">in</span>
            {/* aria-live is off: a per-second countdown announced by a screen reader is noise. */}
            <Data aria-live="off">{formatCountdown(remaining)}</Data>
          </>
        )}
      </p>
    </section>
  )
}
