import Link from 'next/link'

import { Artwork, Data, ListRow, Pill, StatusDot } from '@repo/ui'

import type { PublicEpisode } from '../lib/api'
import { AlertButton } from './alert-button'
import { ListenButton } from './listen-button'

export interface EpisodeRowProps {
  episode: PublicEpisode
  /**
   * Only one row on a page may be lit. The parent decides which, from
   * `schedule.live_episode_id`, so two rows can never both claim to be on air.
   */
  isLive: boolean
  showStationTime: boolean
}

/**
 * One airing in the listings.
 *
 * Separated from its neighbours by a hairline rule rather than a card, per
 * 01-DESIGN-SYSTEM.md §4. Sodium appears only on the live row: the alert control is a ghost
 * button on every row so that a page of listings has one amber locus, not one per row.
 */
export function EpisodeRow({ episode, isLive, showStationTime }: EpisodeRowProps) {
  const billing = episode.guest?.name ?? episode.show.host?.name ?? null
  const isExpired = episode.state === 'expired'

  return (
    <ListRow
      className={`border-b border-rule transition-colors duration-hover hover:bg-deck ${
        isLive ? 'border-l-2 border-l-sodium bg-sodium-wash' : 'border-l-2 border-l-transparent'
      }`}
    >
      <div className="grid grid-cols-[auto_1fr] items-start gap-3 px-4 py-3 sm:grid-cols-[auto_auto_1fr_auto] sm:gap-4">
        <div className="row-span-2 sm:row-span-1">
          <Artwork
            src={episode.show.artwork_url}
            alt={episode.show.artwork_url ? `Artwork for ${episode.show.title}` : ''}
            size={48}
          />
        </div>

        <div className="flex flex-col gap-1 sm:w-24">
          <Data>{episode.display.local_time}</Data>
          {episode.display.local_day_shift !== 0 ? (
            <span className="font-data text-label uppercase tracking-label text-chalk-mute">
              {episode.display.local_day_shift > 0 ? '+1d' : '-1d'}
            </span>
          ) : null}
          {showStationTime ? (
            <span className="font-data text-label uppercase tracking-label text-chalk-mute">
              {episode.display.station_time} {episode.display.station_offset}
            </span>
          ) : null}
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <h3 className="font-display text-display-m uppercase text-chalk">
            <Link
              href={`/schedule/${episode.id}`}
              className="rounded outline-none focus-visible:ring-2 focus-visible:ring-sodium"
            >
              {episode.title}
            </Link>
          </h3>

          {billing ? <p className="mt-1 font-body text-body-s text-chalk-dim">{billing}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-2">
                <StatusDot tone="live" />
                <Pill tone="live">
                  <span className="font-data text-label uppercase tracking-label">on air</span>
                </Pill>
              </span>
            ) : null}
            {isExpired ? (
              <Pill tone="quiet">
                <span className="font-data text-label uppercase tracking-label">expired</span>
              </Pill>
            ) : null}
            {episode.show.genres.map((genre) => (
              <Pill key={genre.slug} tone="quiet">
                <span className="font-data text-label uppercase tracking-label">{genre.name}</span>
              </Pill>
            ))}
            <Data className="text-chalk-mute">{episode.display.duration}</Data>
          </div>
        </div>

        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
          {isLive ? <ListenButton episodeId={episode.id} /> : null}
          {isExpired ? (
            <Link
              href={`/archive#${episode.id}`}
              className="rounded font-data text-label uppercase tracking-label text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
            >
              tracklist
            </Link>
          ) : (
            <AlertButton
              artistSlug={episode.guest?.slug ?? episode.show.host?.slug ?? null}
              genreSlug={episode.show.genres[0]?.slug ?? null}
              label={episode.title}
            />
          )}
        </div>
      </div>
    </ListRow>
  )
}
