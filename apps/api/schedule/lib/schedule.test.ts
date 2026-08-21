import { describe, expect, it } from 'vitest'

import {
  buildScheduleWindow,
  groupByLocalDay,
  isScheduleEmpty,
  msUntilStart,
  nextUp,
  resolveLiveEpisodeId,
  scheduleWindowFromRange,
  sortChronologically,
} from './schedule'
import { STATION_TIMEZONE } from './time'
import type { EpisodeState, ScheduleEpisode, ShowRef } from './view-models'

const show: ShowRef = {
  id: 'show-1',
  slug: 'nuit-blanche',
  title: 'Nuit Blanche',
  description: null,
  artworkUrl: null,
  host: null,
  genres: [],
}

function episode(
  id: string,
  startsAtIso: string,
  state: EpisodeState = 'scheduled',
  durationMinutes = 120,
): ScheduleEpisode {
  const startsAt = new Date(startsAtIso)
  return {
    id,
    show,
    title: null,
    guest: null,
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
    state,
    repeatAt: null,
    peakListeners: 0,
    expiredAt: null,
  }
}

describe('the schedule window', () => {
  it('covers three days back and seven forward in the viewer timezone', () => {
    const now = new Date('2026-08-20T21:30:00.000Z')
    const window = buildScheduleWindow(now, STATION_TIMEZONE)
    expect(window.fromDayKey).toBe('2026-08-17')
    expect(window.toDayKey).toBe('2026-08-27')
    expect(window.dayKeys).toHaveLength(11)
  })

  it('anchors on the viewer local day, not the station day', () => {
    const now = new Date('2026-08-20T21:30:00.000Z')
    // Already 2026-08-21 in Tokyo, so their window starts a day later than Paris's.
    expect(buildScheduleWindow(now, 'Asia/Tokyo').fromDayKey).toBe('2026-08-18')
    expect(buildScheduleWindow(now, STATION_TIMEZONE).fromDayKey).toBe('2026-08-17')
  })

  it('bounds an explicit range so a hostile query cannot spin', () => {
    const window = scheduleWindowFromRange('2026-01-01', '2026-12-31', STATION_TIMEZONE)
    expect(window.dayKeys).toHaveLength(92)
  })

  it('rejects an inverted range', () => {
    expect(() => scheduleWindowFromRange('2026-08-20', '2026-08-10', STATION_TIMEZONE)).toThrow()
  })
})

describe('day grouping', () => {
  const now = new Date('2026-08-20T21:30:00.000Z')
  const episodes = [
    episode('e-late', '2026-08-20T21:30:00.000Z', 'live'),
    episode('e-early', '2026-08-20T16:00:00.000Z'),
    episode('e-next', '2026-08-21T18:00:00.000Z'),
  ]

  it('keeps days with nothing on, so an empty week reads as deliberate', () => {
    const window = buildScheduleWindow(now, STATION_TIMEZONE)
    const grouped = groupByLocalDay(episodes, STATION_TIMEZONE, window, now)
    expect(grouped.days).toHaveLength(11)
    expect(grouped.days.filter((day) => day.episodes.length === 0)).toHaveLength(9)
  })

  it('orders episodes within a day chronologically', () => {
    const window = buildScheduleWindow(now, STATION_TIMEZONE)
    const grouped = groupByLocalDay(episodes, STATION_TIMEZONE, window, now)
    const today = grouped.days.find((day) => day.dayKey === '2026-08-20')
    expect(today?.episodes.map((e) => e.id)).toEqual(['e-early', 'e-late'])
  })

  it('files a late station show under the next day for a viewer east of it', () => {
    const window = buildScheduleWindow(now, 'Asia/Tokyo')
    const grouped = groupByLocalDay(episodes, 'Asia/Tokyo', window, now)
    const ids = (dayKey: string) =>
      grouped.days.find((day) => day.dayKey === dayKey)?.episodes.map((e) => e.id) ?? []
    // 23:30 Paris on the 20th is 06:30 Tokyo on the 21st.
    expect(ids('2026-08-21')).toContain('e-late')
    expect(ids('2026-08-21')).toContain('e-early')
    expect(ids('2026-08-20')).toEqual([])
  })

  it('marks today and the past correctly per viewer', () => {
    const window = buildScheduleWindow(now, STATION_TIMEZONE)
    const grouped = groupByLocalDay(episodes, STATION_TIMEZONE, window, now)
    expect(grouped.days.filter((day) => day.isToday).map((d) => d.dayKey)).toEqual(['2026-08-20'])
    expect(grouped.days.filter((day) => day.isPast)).toHaveLength(3)
  })

  it('reports an empty schedule, which is the launch-day state', () => {
    const window = buildScheduleWindow(now, STATION_TIMEZONE)
    expect(isScheduleEmpty(groupByLocalDay([], STATION_TIMEZONE, window, now))).toBe(true)
    expect(isScheduleEmpty(groupByLocalDay(episodes, STATION_TIMEZONE, window, now))).toBe(false)
  })
})

describe('exactly one live row', () => {
  const now = new Date('2026-08-20T22:00:00.000Z')

  it('returns null when nothing is on air', () => {
    expect(resolveLiveEpisodeId([episode('a', '2026-08-21T18:00:00.000Z')], now)).toBeNull()
  })

  it('picks the one on-air episode', () => {
    const episodes = [
      episode('a', '2026-08-20T21:30:00.000Z', 'live'),
      episode('b', '2026-08-21T18:00:00.000Z'),
    ]
    expect(resolveLiveEpisodeId(episodes, now)).toBe('a')
  })

  it('treats a repeat broadcast as on air', () => {
    const episodes = [episode('r', '2026-08-20T21:30:00.000Z', 'repeat_live')]
    expect(resolveLiveEpisodeId(episodes, now)).toBe('r')
  })

  it('picks one and only one when the data reports two on air', () => {
    const episodes = [
      episode('older', '2026-08-20T20:00:00.000Z', 'live', 180),
      episode('newer', '2026-08-20T21:30:00.000Z', 'live', 120),
    ]
    expect(resolveLiveEpisodeId(episodes, now)).toBe('newer')
  })

  it('falls back to a stale on-air row rather than lighting nothing', () => {
    // Marked live but its window has passed: still the only candidate.
    const episodes = [episode('stale', '2026-08-20T10:00:00.000Z', 'live', 60)]
    expect(resolveLiveEpisodeId(episodes, now)).toBe('stale')
  })
})

describe('ordering is identical for everyone', () => {
  // 05-AGENT-C §C3 forbids personalised ordering. These assert the shape of the API
  // makes it impossible: ordering is a pure function of start time and id.
  it('is stable regardless of input order', () => {
    const a = episode('a', '2026-08-20T16:00:00.000Z')
    const b = episode('b', '2026-08-20T18:00:00.000Z')
    const c = episode('c', '2026-08-20T20:00:00.000Z')
    expect(sortChronologically([c, a, b]).map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(sortChronologically([b, c, a]).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties on id rather than on insertion order', () => {
    const first = episode('zzz', '2026-08-20T16:00:00.000Z')
    const second = episode('aaa', '2026-08-20T16:00:00.000Z')
    expect(sortChronologically([first, second]).map((e) => e.id)).toEqual(['aaa', 'zzz'])
    expect(sortChronologically([second, first]).map((e) => e.id)).toEqual(['aaa', 'zzz'])
  })

  it('does not mutate its input', () => {
    const input = [episode('b', '2026-08-20T18:00:00.000Z'), episode('a', '2026-08-20T16:00:00.000Z')]
    sortChronologically(input)
    expect(input.map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('next up', () => {
  const now = new Date('2026-08-20T22:00:00.000Z')

  it('returns the soonest future episode', () => {
    const episodes = [
      episode('later', '2026-08-22T18:00:00.000Z'),
      episode('sooner', '2026-08-21T18:00:00.000Z'),
      episode('past', '2026-08-19T18:00:00.000Z', 'expired'),
    ]
    expect(nextUp(episodes, now)?.id).toBe('sooner')
  })

  it('ignores expired episodes and returns null when nothing is ahead', () => {
    expect(nextUp([episode('past', '2026-08-19T18:00:00.000Z', 'expired')], now)).toBeNull()
    expect(nextUp([], now)).toBeNull()
  })

  it('counts down to the start and clamps once under way', () => {
    const upcoming = episode('x', '2026-08-20T22:15:00.000Z')
    expect(msUntilStart(upcoming, now)).toBe(15 * 60_000)
    expect(msUntilStart(episode('y', '2026-08-20T21:00:00.000Z', 'live'), now)).toBe(0)
  })
})
