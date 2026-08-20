/**
 * View models for the schedule, archive and alert logic.
 *
 * These are deliberately *not* re-declarations of the Drizzle row types in
 * `packages/schema`. They are the narrow structural inputs the pure functions in this
 * directory need, so that grouping, timezone conversion, ICS generation and alert
 * matching can be tested without a database or an ORM. The route handlers own the
 * mapping from schema rows to these shapes, and that mapping is the only place that
 * needs to change if a column is renamed.
 */

/** Mirrors the `episodes.state` enum in 02-CONTRACTS.md §1. */
export type EpisodeState =
  | 'scheduled'
  | 'live'
  | 'repeat_scheduled'
  | 'repeat_live'
  | 'expired'

/** States in which a broadcast is on air right now. */
export const ON_AIR_STATES: readonly EpisodeState[] = ['live', 'repeat_live']

/** States whose recording is permanently gone (00-FOUNDATION.md §4). */
export const EXPIRED_STATES: readonly EpisodeState[] = ['expired']

export interface GenreRef {
  id: string
  slug: string
  name: string
  /** Null for a top-level genre. Nesting is one level deep, per the contract. */
  parentId: string | null
}

export interface ArtistRef {
  id: string
  slug: string
  name: string
  /** Shown as a micro-label so a guest is never mistaken for a signing. */
  relationship: 'guest' | 'affiliate' | 'roster' | 'alumni'
}

export interface ShowRef {
  id: string
  slug: string
  title: string
  description: string | null
  artworkUrl: string | null
  host: ArtistRef | null
  genres: GenreRef[]
}

/** A single airing, as the schedule and archive need it. */
export interface ScheduleEpisode {
  id: string
  show: ShowRef
  /** Overrides the show title when present. */
  title: string | null
  guest: ArtistRef | null
  startsAt: Date
  endsAt: Date
  state: EpisodeState
  repeatAt: Date | null
  peakListeners: number
  expiredAt: Date | null
}

/** One logged track, the only surviving trace of an expired show. */
export interface TracklistEntry {
  position: number
  /** Null when the track is not one of ours; `rawArtist`/`rawTitle` are always populated. */
  trackId: string | null
  rawArtist: string
  rawTitle: string
  playedAt: Date
  durationMs: number | null
  bpm: number | null
  musicalKey: string | null
}

/** The display title of an episode: its own override, else the show title. */
export function episodeTitle(episode: ScheduleEpisode): string {
  return episode.title ?? episode.show.title
}

export function episodeDurationMs(episode: ScheduleEpisode): number {
  return Math.max(0, episode.endsAt.getTime() - episode.startsAt.getTime())
}

export function isOnAir(episode: ScheduleEpisode): boolean {
  return ON_AIR_STATES.includes(episode.state)
}

export function isExpired(episode: ScheduleEpisode): boolean {
  return EXPIRED_STATES.includes(episode.state)
}

/**
 * Every genre attached to an episode: the show's genres plus the guest's, deduplicated.
 * Used for display pills and for alert matching, so both agree by construction.
 */
export function episodeGenres(episode: ScheduleEpisode, guestGenres: GenreRef[] = []): GenreRef[] {
  const seen = new Map<string, GenreRef>()
  for (const genre of [...episode.show.genres, ...guestGenres]) {
    if (!seen.has(genre.id)) seen.set(genre.id, genre)
  }
  return [...seen.values()]
}
