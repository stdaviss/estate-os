import { describe, expect, it } from 'vitest'

import {
  addLocalDays,
  dayKeySequence,
  formatClock,
  formatCountdown,
  formatDateStamp,
  formatDurationClock,
  formatOffsetLabel,
  formatWeekday,
  isValidTimeZone,
  localDayShift,
  padNumber,
  STATION_TIMEZONE,
  zonedDayKey,
  zonedDayRange,
  zonedTimeToInstant,
  zoneOffsetMs,
} from './time'

/** 21:30 UTC on a summer evening: 23:30 in Paris, 06:30 the next day in Tokyo. */
const SUMMER_EVENING = new Date('2026-08-20T21:30:00.000Z')
/** A winter slot, to catch a hard-coded summer offset. */
const WINTER_EVENING = new Date('2026-01-15T21:30:00.000Z')

describe('zone offsets', () => {
  it('reads the correct offset in summer and winter for the station zone', () => {
    expect(zoneOffsetMs(SUMMER_EVENING, STATION_TIMEZONE)).toBe(2 * 3_600_000)
    expect(zoneOffsetMs(WINTER_EVENING, STATION_TIMEZONE)).toBe(1 * 3_600_000)
  })

  it('handles zones west of Greenwich and non-whole-hour offsets', () => {
    expect(zoneOffsetMs(SUMMER_EVENING, 'America/New_York')).toBe(-4 * 3_600_000)
    expect(zoneOffsetMs(SUMMER_EVENING, 'Asia/Kolkata')).toBe(5.5 * 3_600_000)
    expect(formatOffsetLabel(SUMMER_EVENING, 'Asia/Kolkata')).toBe('UTC+05:30')
    expect(formatOffsetLabel(SUMMER_EVENING, 'America/New_York')).toBe('UTC-04:00')
  })

  it('rejects an unknown identifier', () => {
    expect(isValidTimeZone('Europe/Marseille')).toBe(false)
    expect(isValidTimeZone('Europe/Paris')).toBe(true)
  })
})

describe('rendering one instant across several zones', () => {
  // The acceptance criterion in 05-AGENT-C asks for verification across at least three
  // zones. These are four, spanning both sides of UTC and a date-line crossing.
  const cases: [string, string, string][] = [
    ['Europe/Paris', '23:30', '2026.08.20'],
    ['America/New_York', '17:30', '2026.08.20'],
    ['Asia/Tokyo', '06:30', '2026.08.21'],
    ['Pacific/Auckland', '09:30', '2026.08.21'],
  ]

  it.each(cases)('%s renders %s on %s', (timeZone, clock, stamp) => {
    expect(formatClock(SUMMER_EVENING, timeZone)).toBe(clock)
    expect(formatDateStamp(SUMMER_EVENING, timeZone)).toBe(stamp)
  })

  it('reports the day shift relative to the station, so listings can mark +1D', () => {
    expect(localDayShift(SUMMER_EVENING, 'Asia/Tokyo', STATION_TIMEZONE)).toBe(1)
    expect(localDayShift(SUMMER_EVENING, 'America/New_York', STATION_TIMEZONE)).toBe(0)
    expect(localDayShift(SUMMER_EVENING, 'Europe/Paris', STATION_TIMEZONE)).toBe(0)
  })

  it('puts a late-night station show on the following local day where that is true', () => {
    expect(zonedDayKey(SUMMER_EVENING, STATION_TIMEZONE)).toBe('2026-08-20')
    expect(zonedDayKey(SUMMER_EVENING, 'Asia/Tokyo')).toBe('2026-08-21')
    expect(zonedDayKey(SUMMER_EVENING, 'Pacific/Honolulu')).toBe('2026-08-20')
  })
})

describe('local day boundaries', () => {
  it('spans exactly 24 hours on an ordinary day', () => {
    const { start, end } = zonedDayRange('2026-08-20', STATION_TIMEZONE)
    expect(start.toISOString()).toBe('2026-08-19T22:00:00.000Z')
    expect(end.toISOString()).toBe('2026-08-20T22:00:00.000Z')
  })

  it('spans 23 hours on the spring-forward day', () => {
    // Paris loses an hour at 02:00 local on 2026-03-29.
    const { start, end } = zonedDayRange('2026-03-29', STATION_TIMEZONE)
    expect(end.getTime() - start.getTime()).toBe(23 * 3_600_000)
  })

  it('spans 25 hours on the fall-back day', () => {
    const { start, end } = zonedDayRange('2026-10-25', STATION_TIMEZONE)
    expect(end.getTime() - start.getTime()).toBe(25 * 3_600_000)
  })

  it('converts a wall clock reading back to the instant it names', () => {
    const instant = zonedTimeToInstant(
      { year: 2026, month: 8, day: 20, hour: 23, minute: 30, second: 0 },
      STATION_TIMEZONE,
    )
    expect(instant.toISOString()).toBe('2026-08-20T21:30:00.000Z')
  })

  it('round-trips a wall clock immediately after a fall-back transition', () => {
    // 02:30 occurs twice on 2026-10-25 in Paris; the earlier instant is the one meant.
    const instant = zonedTimeToInstant(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0 },
      STATION_TIMEZONE,
    )
    expect(formatClock(instant, STATION_TIMEZONE)).toBe('02:30')
  })
})

describe('calendar arithmetic', () => {
  it('adds days without drifting across a DST boundary', () => {
    expect(addLocalDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addLocalDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addLocalDays('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('crosses month and year ends', () => {
    expect(addLocalDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addLocalDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addLocalDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('produces a contiguous sequence of day keys', () => {
    expect(dayKeySequence('2026-08-20', 3)).toEqual(['2026-08-20', '2026-08-21', '2026-08-22'])
    expect(dayKeySequence('2026-08-20', 0)).toEqual([])
  })

  it('names the weekday', () => {
    expect(formatWeekday('2026-08-20')).toBe('THU')
    expect(formatWeekday('2026-08-23')).toBe('SUN')
  })
})

describe('numeric formatting', () => {
  it('formats a track duration as mm:ss and a show as hh:mm:ss', () => {
    expect(formatDurationClock(257_000)).toBe('04:17')
    expect(formatDurationClock(2 * 3_600_000)).toBe('02:00:00')
    expect(formatDurationClock(6_442_000)).toBe('01:47:22')
    expect(formatDurationClock(0)).toBe('00:00')
    expect(formatDurationClock(-5000)).toBe('00:00')
  })

  it('formats a countdown, clamping at zero and switching to days', () => {
    expect(formatCountdown(847_000)).toBe('00:14:07')
    expect(formatCountdown(-1000)).toBe('00:00:00')
    expect(formatCountdown(3 * 86_400_000 + 4 * 3_600_000 + 12 * 60_000)).toBe('3D 04:12')
  })

  it('zero-pads counts to a fixed width', () => {
    expect(padNumber(341, 4)).toBe('0341')
    expect(padNumber(0, 4)).toBe('0000')
    expect(padNumber(12345, 4)).toBe('12345')
  })
})
