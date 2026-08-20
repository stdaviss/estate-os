/**
 * Timezone and formatting primitives for schedule, archive and alerts.
 *
 * Everything here is pure and dependency-free so it can be unit tested without a
 * database, and reused by both the API handlers and the React server components.
 *
 * All display formatting follows 01-DESIGN-SYSTEM.md §3: dates are `2026.08.20`,
 * clocks are 24-hour `23:30`, durations are `HH:MM:SS`. Callers render these
 * strings inside the `Data` mono wrapper.
 */

/** The station broadcasts from France (00-FOUNDATION.md §5). */
export const STATION_TIMEZONE = 'Europe/Paris'

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  partsFormatterCache.set(timeZone, formatter)
  return formatter
}

/** Throws on an unknown IANA identifier so a bad user timezone fails loudly at the edge. */
export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone })
  } catch {
    throw new RangeError(`unknown time zone: ${timeZone}`)
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    assertValidTimeZone(timeZone)
    return true
  } catch {
    return false
  }
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type)
    if (!found) throw new Error(`missing ${type} in formatted date`)
    return Number.parseInt(found.value, 10)
  }
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/**
 * Milliseconds a zone is ahead of UTC at a given instant. Positive east of Greenwich.
 * Derived from the formatted wall clock rather than a table, so DST is always correct.
 */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // Formatted parts drop sub-second precision; align before subtracting.
  return wallAsUtc - (instant.getTime() - instant.getUTCMilliseconds())
}

/**
 * Converts a wall-clock reading in `timeZone` to the instant it refers to.
 *
 * Two passes: the first uses the offset near the naive guess, the second corrects
 * it when the guess landed on the far side of a DST transition. Inside a spring-forward
 * gap the wall time does not exist and the result normalises forward, which matches
 * how calendar software resolves the same input.
 */
export function zonedTimeToInstant(parts: ZonedParts, timeZone: string): Date {
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const firstPass = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timeZone)
  const secondPass = wallAsUtc - zoneOffsetMs(new Date(firstPass), timeZone)
  return new Date(secondPass)
}

/** `2026-08-20` — the calendar day an instant falls on in a given zone. Sorts lexically. */
export function zonedDayKey(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone)
  return `${pad(p.year, 4)}-${pad(p.month, 2)}-${pad(p.day, 2)}`
}

export function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!match) throw new RangeError(`expected YYYY-MM-DD, received: ${dayKey}`)
  const [, year, month, day] = match
  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
  }
}

/** Half-open instant range `[start, end)` covering one local calendar day. */
export function zonedDayRange(dayKey: string, timeZone: string): { start: Date; end: Date } {
  const { year, month, day } = parseDayKey(dayKey)
  const start = zonedTimeToInstant({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone)
  const next = addLocalDays(dayKey, 1)
  const nextParts = parseDayKey(next)
  const end = zonedTimeToInstant(
    { year: nextParts.year, month: nextParts.month, day: nextParts.day, hour: 0, minute: 0, second: 0 },
    timeZone,
  )
  return { start, end }
}

/**
 * Calendar-day arithmetic on a day key. Operates on the civil date only, so it never
 * drifts by an hour across a DST boundary the way `+ 86400000` does.
 */
export function addLocalDays(dayKey: string, days: number): string {
  const { year, month, day } = parseDayKey(dayKey)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}-${pad(
    shifted.getUTCDate(),
    2,
  )}`
}

/** Inclusive list of day keys from `startDayKey`, length `count`. */
export function dayKeySequence(startDayKey: string, count: number): string[] {
  if (count < 0) throw new RangeError('count must not be negative')
  const keys: string[] = []
  for (let index = 0; index < count; index += 1) {
    keys.push(addLocalDays(startDayKey, index))
  }
  return keys
}

/** `23:30` — 24-hour clock, never `24:00`. */
export function formatClock(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone)
  return `${pad(p.hour, 2)}:${pad(p.minute, 2)}`
}

/** `2026.08.20` — the listing date form from 01-DESIGN-SYSTEM.md §3. */
export function formatDateStamp(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone)
  return `${pad(p.year, 4)}.${pad(p.month, 2)}.${pad(p.day, 2)}`
}

/** Same form as `formatDateStamp` but from a day key, for day headings. */
export function formatDayKeyStamp(dayKey: string): string {
  const { year, month, day } = parseDayKey(dayKey)
  return `${pad(year, 4)}.${pad(month, 2)}.${pad(day, 2)}`
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

/** `THU` — three-letter uppercase weekday for the mono day heading. */
export function formatWeekday(dayKey: string): string {
  const { year, month, day } = parseDayKey(dayKey)
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

/**
 * `UTC+02:00` — offset label shown next to a converted time.
 * Preferred over an abbreviation because many zones have none that readers recognise.
 */
export function formatOffsetLabel(instant: Date, timeZone: string): string {
  const totalMinutes = Math.round(zoneOffsetMs(instant, timeZone) / 60_000)
  const sign = totalMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(totalMinutes)
  return `UTC${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`
}

/** `CEST` where the platform provides one, otherwise the offset label. */
export function formatZoneAbbreviation(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' }).formatToParts(
    instant,
  )
  const name = parts.find((part) => part.type === 'timeZoneName')?.value
  if (!name || name.startsWith('GMT') || name.startsWith('UTC')) {
    return formatOffsetLabel(instant, timeZone)
  }
  return name.toUpperCase()
}

/**
 * True when the same instant falls on different calendar days in the two zones.
 * Drives the `+1D` marker on the schedule so a visitor in Tokyo understands why a
 * Friday show appears on their Saturday.
 */
export function localDayShift(instant: Date, timeZone: string, referenceZone: string): number {
  const local = parseDayKey(zonedDayKey(instant, timeZone))
  const reference = parseDayKey(zonedDayKey(instant, referenceZone))
  const localUtc = Date.UTC(local.year, local.month - 1, local.day)
  const referenceUtc = Date.UTC(reference.year, reference.month - 1, reference.day)
  return Math.round((localUtc - referenceUtc) / 86_400_000)
}

/** `04:17` under an hour, `01:47:22` over. Never a prose duration. */
export function formatDurationClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours === 0) return `${pad(minutes, 2)}:${pad(seconds, 2)}`
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}`
}

/**
 * `00:14:07` counting down to a start time; `3D 04:12` beyond a day out.
 * Clamps at zero rather than going negative once a show has begun.
 */
export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms)
  const totalSeconds = Math.floor(clamped / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  if (days >= 1) {
    const hours = Math.floor((totalSeconds % 86_400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${days}D ${pad(hours, 2)}:${pad(minutes, 2)}`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}`
}

/** Zero-pads a count to a fixed width, as required for every numeric display. */
export function padNumber(value: number, width: number): string {
  return pad(value, width)
}

function pad(value: number, width: number): string {
  return String(Math.abs(value)).padStart(width, '0')
}
