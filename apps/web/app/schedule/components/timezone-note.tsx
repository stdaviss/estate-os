'use client'

/**
 * The timezone line above the listings, and the cookie that makes a server render correct.
 *
 * Listings are drawn in the visitor's zone with the station zone alongside
 * (05-AGENT-C §C1). A server render cannot know the browser zone on a first visit, so this
 * writes it to a cookie and reloads once; every later render, including the first paint, is
 * already right. When the zone is still unknown the line says the times are station time
 * rather than implying a conversion that has not happened.
 */

import { useEffect } from 'react'

import { Data } from '@repo/ui'

import { browserTimeZone, TIMEZONE_COOKIE } from '../lib/viewer-timezone'

export interface TimezoneNoteProps {
  timeZone: string
  stationTimeZone: string
  isFallback: boolean
}

export function TimezoneNote({ timeZone, stationTimeZone, isFallback }: TimezoneNoteProps) {
  useEffect(() => {
    const detected = browserTimeZone()
    if (!detected || detected === timeZone) return

    // Lax rather than Strict so the cookie survives arriving from an external link, and
    // one year because a visitor's zone rarely changes. No personal data: an IANA name.
    document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(detected)}; path=/; max-age=31536000; samesite=lax`
    window.location.reload()
  }, [timeZone])

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3 font-body text-body-s text-chalk-dim">
      <span className="font-data text-label uppercase tracking-label text-chalk-mute">times in</span>
      <Data>{timeZone.replace(/_/g, ' ')}</Data>
      {isFallback ? (
        <span>— we do not know your zone yet, so these are station times.</span>
      ) : (
        <>
          <span className="font-data text-label uppercase tracking-label text-chalk-mute">
            station
          </span>
          <Data className="text-chalk-mute">{stationTimeZone.replace(/_/g, ' ')}</Data>
        </>
      )}
    </p>
  )
}
