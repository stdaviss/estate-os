/**
 * Public serialisers for episodes, shows and tracklists.
 *
 * These are allow-lists, not omit-lists: a field reaches a public response only by being
 * named here. `episodes.internal_master_key` is the field that must never leak
 * (02-CONTRACTS.md §1), and `PUBLIC_EPISODE_FORBIDDEN_FIELDS` plus `assertNoPrivateFields`
 * make that enforceable rather than a matter of review attention.
 */

import {
  formatClock,
  formatDateStamp,
  formatDurationClock,
  formatOffsetLabel,
  localDayShift,
  STATION_TIMEZONE,
} from './time'
import {
  episodeDurationMs,
  episodeTitle,
  isExpired,
  isOnAir,
  type ArtistRef,
  type GenreRef,
  type ScheduleEpisode,
  type ShowRef,
  type TracklistEntry,
} from './view-models'

/**
 * Keys that must not appear anywhere in a public payload, at any depth.
 * `internal_master_key` is the private master recording retained for company use only
 * (00-FOUNDATION.md §4). The camelCase spelling is included because the ORM may map it.
 */
export const PUBLIC_EPISODE_FORBIDDEN_FIELDS: readonly string[] = [
  'internal_master_key',
  'internalMasterKey',
  'staff_note',
  'staffNote',
]

export interface PublicGenre {
  slug: string
  name: string
  parent_slug: string | null
}

export interface PublicArtist {
  slug: string
  name: string
  relationship: ArtistRef['relationship']
}

export interface PublicShow {
  slug: string
  title: string
  description: string | null
  artwork_url: string | null
  host: PublicArtist | null
  genres: PublicGenre[]
}

export interface PublicEpisode {
  id: string
  title: string
  show: PublicShow
  guest: PublicArtist | null
  starts_at: string
  ends_at: string
  state: ScheduleEpisode['state']
  repeat_at: string | null
  duration_ms: number
  peak_listeners: number
  expired_at: string | null
  /** Always false for an expired episode. There is no public recording, ever. */
  is_playable: boolean
  /**
   * Pre-rendered strings in both the viewer's zone and the station's.
   *
   * Formatting happens here rather than in the browser so there is one implementation of
   * the design system's time and date forms, and so a server-rendered page shows the right
   * times on first paint instead of correcting itself after hydration.
   */
  display: {
    local_time: string
    local_date: string
    local_offset: string
    local_timezone: string
    /** `1` when this airs on the following day for the viewer, `-1` the previous. */
    local_day_shift: number
    station_time: string
    station_date: string
    station_offset: string
    station_timezone: string
    duration: string
  }
}

export interface PublicTracklistEntry {
  position: number
  artist: string
  title: string
  played_at: string
  duration: string | null
  bpm: number | null
  musical_key: string | null
  /** Present only when the track is ours, so the client can link to the artist. */
  track_id: string | null
}

function serializeGenre(genre: GenreRef, byId: Map<string, GenreRef>): PublicGenre {
  const parent = genre.parentId ? byId.get(genre.parentId) : undefined
  return { slug: genre.slug, name: genre.name, parent_slug: parent?.slug ?? null }
}

function serializeArtist(artist: ArtistRef | null): PublicArtist | null {
  if (!artist) return null
  return { slug: artist.slug, name: artist.name, relationship: artist.relationship }
}

function serializeShow(show: ShowRef, genreIndex: Map<string, GenreRef>): PublicShow {
  return {
    slug: show.slug,
    title: show.title,
    description: show.description,
    artwork_url: show.artworkUrl,
    host: serializeArtist(show.host),
    genres: show.genres.map((genre) => serializeGenre(genre, genreIndex)),
  }
}

export function serializeEpisode(
  episode: ScheduleEpisode,
  genreIndex: Map<string, GenreRef> = new Map(),
  viewerTimeZone: string = STATION_TIMEZONE,
): PublicEpisode {
  return {
    id: episode.id,
    title: episodeTitle(episode),
    show: serializeShow(episode.show, genreIndex),
    guest: serializeArtist(episode.guest),
    starts_at: episode.startsAt.toISOString(),
    ends_at: episode.endsAt.toISOString(),
    state: episode.state,
    repeat_at: episode.repeatAt?.toISOString() ?? null,
    duration_ms: episodeDurationMs(episode),
    peak_listeners: episode.peakListeners,
    expired_at: episode.expiredAt?.toISOString() ?? null,
    is_playable: isOnAir(episode) && !isExpired(episode),
    display: {
      local_time: formatClock(episode.startsAt, viewerTimeZone),
      local_date: formatDateStamp(episode.startsAt, viewerTimeZone),
      local_offset: formatOffsetLabel(episode.startsAt, viewerTimeZone),
      local_timezone: viewerTimeZone,
      local_day_shift: localDayShift(episode.startsAt, viewerTimeZone, STATION_TIMEZONE),
      station_time: formatClock(episode.startsAt, STATION_TIMEZONE),
      station_date: formatDateStamp(episode.startsAt, STATION_TIMEZONE),
      station_offset: formatOffsetLabel(episode.startsAt, STATION_TIMEZONE),
      station_timezone: STATION_TIMEZONE,
      duration: formatDurationClock(episodeDurationMs(episode)),
    },
  }
}

export function serializeTracklist(entries: TracklistEntry[]): PublicTracklistEntry[] {
  return [...entries]
    .sort((a, b) => a.position - b.position)
    .map((entry) => ({
      position: entry.position,
      artist: entry.rawArtist,
      title: entry.rawTitle,
      played_at: entry.playedAt.toISOString(),
      duration: entry.durationMs === null ? null : formatDurationClock(entry.durationMs),
      bpm: entry.bpm,
      musical_key: entry.musicalKey,
      track_id: entry.trackId,
    }))
}

/**
 * Walks a serialised payload and throws if a forbidden key is present at any depth.
 * Called by the route handlers before responding, so a future change to a serialiser
 * fails at the boundary instead of leaking.
 */
export function assertNoPrivateFields(payload: unknown, path = '$'): void {
  if (payload === null || typeof payload !== 'object') return
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertNoPrivateFields(item, `${path}[${index}]`))
    return
  }
  for (const [key, value] of Object.entries(payload)) {
    if (PUBLIC_EPISODE_FORBIDDEN_FIELDS.includes(key)) {
      throw new Error(`private field "${key}" would have been exposed at ${path}`)
    }
    assertNoPrivateFields(value, `${path}.${key}`)
  }
}
