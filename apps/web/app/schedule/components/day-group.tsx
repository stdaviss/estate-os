import { Data, SectionHead } from '@repo/ui'

import type { ScheduleDay } from '../lib/api'
import { EpisodeRow } from './episode-row'

export interface DayGroupProps {
  day: ScheduleDay
  liveEpisodeId: string | null
  showStationTime: boolean
}

/**
 * One day of listings.
 *
 * Day-grouped rows rather than day columns (05-AGENT-C §C1 permits either): rows hold their
 * density down to 360px, where seven columns cannot.
 *
 * A day with nothing on still renders. Dropping it would make the week read as busier than
 * it is, and an empty day is a designed state rather than a gap — 00-FOUNDATION.md §2.
 */
export function DayGroup({ day, liveEpisodeId, showStationTime }: DayGroupProps) {
  return (
    <section aria-labelledby={`day-${day.date}`} className={day.is_past ? 'opacity-70' : undefined}>
      <SectionHead>
        <h2 id={`day-${day.date}`} className="flex items-baseline gap-3">
          <span className="font-data text-label uppercase tracking-label text-chalk-dim">
            {day.weekday}
          </span>
          <Data>{day.stamp}</Data>
          {day.is_today ? (
            <span className="font-data text-label uppercase tracking-label text-sodium">today</span>
          ) : null}
        </h2>
      </SectionHead>

      {day.episodes.length === 0 ? (
        <p className="border-b border-rule px-4 py-3 font-body text-body-s text-chalk-mute">
          Nothing scheduled.
        </p>
      ) : (
        <ul className="list-none">
          {day.episodes.map((episode) => (
            <li key={episode.id}>
              <EpisodeRow
                episode={episode}
                isLive={episode.id === liveEpisodeId}
                showStationTime={showStationTime}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
