/**
 * `GET /api/v1/schedule` — the listings, grouped by the viewer's local day.
 *
 * Ordering is chronological for every caller. There is no user parameter, no session
 * read and no reordering: 05-AGENT-C §C3 forbids a personalised homepage, and the absence
 * of any input other than a date range and a timezone is how that is enforced here.
 */

import { fail, ok, readTimeZone } from './lib/http'
import { getGenreIndex, listEpisodesInRange } from './lib/repository'
import {
  buildScheduleWindow,
  groupByLocalDay,
  isScheduleEmpty,
  scheduleWindowFromRange,
  type ScheduleWindow,
} from './lib/schedule'
import { assertNoPrivateFields, serializeEpisode } from './lib/serialize'
import { STATION_TIMEZONE, formatDayKeyStamp, formatWeekday } from './lib/time'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const { timeZone, invalid } = readTimeZone(url, STATION_TIMEZONE)
  if (invalid) {
    return fail('bad_request', 'Unknown timezone. Use an IANA name such as Europe/Paris.', 'tz')
  }

  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if ((from && !DAY_KEY.test(from)) || (to && !DAY_KEY.test(to))) {
    return fail('bad_request', 'Dates must be in YYYY-MM-DD form.', from && !DAY_KEY.test(from) ? 'from' : 'to')
  }
  if ((from && !to) || (to && !from)) {
    return fail('bad_request', 'Give both from and to, or neither.', from ? 'to' : 'from')
  }

  const now = new Date()
  let window: ScheduleWindow
  try {
    window = from && to ? scheduleWindowFromRange(from, to, timeZone) : buildScheduleWindow(now, timeZone)
  } catch {
    return fail('bad_request', 'The from date must not be after the to date.', 'from')
  }

  const [episodes, genreIndex] = await Promise.all([
    listEpisodesInRange(window.start, window.end),
    getGenreIndex(),
  ])

  const grouped = groupByLocalDay(episodes, timeZone, window, now)

  const payload = {
    timezone: timeZone,
    station_timezone: STATION_TIMEZONE,
    from: window.fromDayKey,
    to: window.toDayKey,
    live_episode_id: grouped.liveEpisodeId,
    is_empty: isScheduleEmpty(grouped),
    days: grouped.days.map((day) => ({
      date: day.dayKey,
      weekday: formatWeekday(day.dayKey),
      stamp: formatDayKeyStamp(day.dayKey),
      is_today: day.isToday,
      is_past: day.isPast,
      episodes: day.episodes.map((episode) => serializeEpisode(episode, genreIndex)),
    })),
  }

  assertNoPrivateFields(payload)
  return ok(payload)
}
