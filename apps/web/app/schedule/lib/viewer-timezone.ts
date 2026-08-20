/**
 * Deciding which timezone to render listings in.
 *
 * International listeners are the point of internet radio (05-AGENT-C §C1), so the times a
 * visitor sees must be their own. The browser knows its zone; a server render does not, so
 * the resolution order is: an explicit `?tz=` in the URL, then a cookie the client sets on
 * first load, then the station zone. Getting this wrong makes appointment listening
 * impossible, so the station fallback is always labelled as such in the interface.
 */

export const STATION_TIMEZONE = 'Europe/Paris'
export const TIMEZONE_COOKIE = 'tz'

/** Reads the browser zone. Client-side only. */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone })
    return true
  } catch {
    return false
  }
}

export interface ResolvedViewerTimeZone {
  timeZone: string
  /** True when this is the station fallback rather than the visitor's own zone. */
  isFallback: boolean
}

export function resolveViewerTimeZone(
  fromQuery: string | undefined,
  fromCookie: string | undefined,
): ResolvedViewerTimeZone {
  for (const candidate of [fromQuery, fromCookie]) {
    if (candidate && isValidTimeZone(candidate)) {
      return { timeZone: candidate, isFallback: false }
    }
  }
  return { timeZone: STATION_TIMEZONE, isFallback: true }
}
