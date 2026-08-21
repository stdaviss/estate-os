/**
 * Resolving the next scheduled episode for the shared `NowOn` module.
 *
 * Kept separate from the page so the archive header and the editorial sidebar can use it
 * too, and so a failed schedule fetch degrades to "nothing scheduled" rather than taking
 * the surrounding page down with it — a sidebar is not worth an error boundary.
 */

import { fetchSchedule, type PublicEpisode, type SchedulePayload } from './api'
import { STATION_TIMEZONE } from './viewer-timezone'

/**
 * The soonest episode still ahead, excluding whatever is on air.
 *
 * Days arrive chronologically from the API, so the first match is the next one up. Used by
 * the schedule page, which already holds the payload, and by `resolveNextEpisode` for pages
 * that do not — one implementation, so the countdown cannot disagree with the listings.
 */
export function selectNextEpisode(schedule: SchedulePayload, now: number = Date.now()): PublicEpisode | null {
  return (
    schedule.days
      .flatMap((day) => day.episodes)
      .find(
        (episode) =>
          episode.id !== schedule.live_episode_id &&
          episode.state !== 'expired' &&
          Date.parse(episode.starts_at) > now,
      ) ?? null
  )
}

export async function resolveNextEpisode(
  timeZone: string = STATION_TIMEZONE,
): Promise<PublicEpisode | null> {
  const result = await fetchSchedule(timeZone)
  if (!result.ok) return null
  return selectNextEpisode(result.data)
}
