/**
 * Schedule assembly: windowing, day grouping, live-row selection and next-up.
 *
 * Ordering here is strictly chronological and identical for every visitor. Nothing in
 * this module accepts a user id, and no function reorders, filters or weights content
 * per person — that is the stated product position in 00-FOUNDATION.md §5 and
 * 05-AGENT-C §C3, and `schedule.test.ts` asserts it.
 */

import {
  addLocalDays,
  dayKeySequence,
  formatDayKeyStamp,
  formatWeekday,
  zonedDayKey,
  zonedDayRange,
} from './time'
import { isOnAir, type ScheduleEpisode } from './view-models'

/** Three days back, seven forward, per 05-AGENT-C §C1. */
export const DEFAULT_DAYS_BACK = 3
export const DEFAULT_DAYS_FORWARD = 7

export interface ScheduleWindow {
  /** First day shown, as a day key in the viewer's timezone. */
  fromDayKey: string
  /** Last day shown, inclusive. */
  toDayKey: string
  /** Instant range covering the whole window, for the database query. */
  start: Date
  end: Date
  dayKeys: string[]
}

export interface ScheduleDay {
  dayKey: string
  /** `THU` */
  weekday: string
  /** `2026.08.20` */
  stamp: string
  isToday: boolean
  isPast: boolean
  episodes: ScheduleEpisode[]
}

export interface GroupedSchedule {
  window: ScheduleWindow
  timeZone: string
  days: ScheduleDay[]
  /** At most one id. Everything else renders as an ordinary row. */
  liveEpisodeId: string | null
}

export interface ScheduleWindowOptions {
  daysBack?: number
  daysForward?: number
}

/**
 * The instant range to query, derived from local calendar days in the viewer's zone
 * so that "today" means their today rather than the station's.
 */
export function buildScheduleWindow(
  now: Date,
  timeZone: string,
  options: ScheduleWindowOptions = {},
): ScheduleWindow {
  const daysBack = options.daysBack ?? DEFAULT_DAYS_BACK
  const daysForward = options.daysForward ?? DEFAULT_DAYS_FORWARD
  if (daysBack < 0 || daysForward < 0) throw new RangeError('window must not be negative')

  const todayKey = zonedDayKey(now, timeZone)
  const fromDayKey = addLocalDays(todayKey, -daysBack)
  const toDayKey = addLocalDays(todayKey, daysForward)
  const dayKeys = dayKeySequence(fromDayKey, daysBack + daysForward + 1)

  return {
    fromDayKey,
    toDayKey,
    start: zonedDayRange(fromDayKey, timeZone).start,
    end: zonedDayRange(toDayKey, timeZone).end,
    dayKeys,
  }
}

/** An explicit `?from=&to=` window, for deep links and calendar navigation. */
export function scheduleWindowFromRange(
  fromDayKey: string,
  toDayKey: string,
  timeZone: string,
): ScheduleWindow {
  if (fromDayKey > toDayKey) throw new RangeError('from must not be after to')
  const dayKeys: string[] = []
  let cursor = fromDayKey
  // Bounded so a hostile `?from=1900-01-01&to=2999-12-31` cannot spin.
  while (cursor <= toDayKey && dayKeys.length < 92) {
    dayKeys.push(cursor)
    cursor = addLocalDays(cursor, 1)
  }
  return {
    fromDayKey,
    toDayKey: dayKeys[dayKeys.length - 1] ?? fromDayKey,
    start: zonedDayRange(fromDayKey, timeZone).start,
    end: zonedDayRange(dayKeys[dayKeys.length - 1] ?? fromDayKey, timeZone).end,
    dayKeys,
  }
}

/**
 * Exactly one episode may render as live.
 *
 * If the data reports several on-air episodes — an operational fault rather than a
 * normal state — the most recently started one that has not yet ended wins, and the
 * rest render as ordinary rows. The design system requires one lit row; this is where
 * that guarantee is made rather than in the component.
 */
export function resolveLiveEpisodeId(episodes: ScheduleEpisode[], now: Date): string | null {
  const onAir = episodes.filter(isOnAir)
  if (onAir.length === 0) return null

  const current = onAir.filter(
    (episode) => episode.startsAt.getTime() <= now.getTime() && episode.endsAt.getTime() > now.getTime(),
  )
  const candidates = current.length > 0 ? current : onAir
  const best = [...candidates].sort((a, b) => {
    const byStart = b.startsAt.getTime() - a.startsAt.getTime()
    if (byStart !== 0) return byStart
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]
  return best.id
}

/** Chronological, with a stable id tie-break so equal start times never reshuffle. */
export function sortChronologically(episodes: ScheduleEpisode[]): ScheduleEpisode[] {
  return [...episodes].sort((a, b) => {
    const byStart = a.startsAt.getTime() - b.startsAt.getTime()
    if (byStart !== 0) return byStart
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * Groups episodes into the viewer's local calendar days.
 *
 * Days with nothing on are kept in the result. An empty day is a designed row
 * ("nothing scheduled"), not a gap — 00-FOUNDATION.md §2 treats empty states as a
 * deliverable, and silently dropping days would also make the week read as denser
 * than it is.
 */
export function groupByLocalDay(
  episodes: ScheduleEpisode[],
  timeZone: string,
  window: ScheduleWindow,
  now: Date,
): GroupedSchedule {
  const buckets = new Map<string, ScheduleEpisode[]>()
  for (const dayKey of window.dayKeys) buckets.set(dayKey, [])

  for (const episode of sortChronologically(episodes)) {
    const dayKey = zonedDayKey(episode.startsAt, timeZone)
    const bucket = buckets.get(dayKey)
    // An episode outside the requested window is dropped rather than forced into an
    // adjacent day, which would misreport when it airs.
    if (bucket) bucket.push(episode)
  }

  const todayKey = zonedDayKey(now, timeZone)
  const days: ScheduleDay[] = window.dayKeys.map((dayKey) => ({
    dayKey,
    weekday: formatWeekday(dayKey),
    stamp: formatDayKeyStamp(dayKey),
    isToday: dayKey === todayKey,
    isPast: dayKey < todayKey,
    episodes: buckets.get(dayKey) ?? [],
  }))

  return {
    window,
    timeZone,
    days,
    liveEpisodeId: resolveLiveEpisodeId(episodes, now),
  }
}

/** The next episode due to start after `now`, or null when nothing is scheduled. */
export function nextUp(episodes: ScheduleEpisode[], now: Date): ScheduleEpisode | null {
  const upcoming = sortChronologically(episodes).filter(
    (episode) => episode.startsAt.getTime() > now.getTime() && episode.state !== 'expired',
  )
  return upcoming[0] ?? null
}

/** Milliseconds until an episode starts. Zero once it has begun. */
export function msUntilStart(episode: ScheduleEpisode, now: Date): number {
  return Math.max(0, episode.startsAt.getTime() - now.getTime())
}

/** True when the whole window has nothing in it, which is launch-day normal. */
export function isScheduleEmpty(grouped: GroupedSchedule): boolean {
  return grouped.days.every((day) => day.episodes.length === 0)
}
