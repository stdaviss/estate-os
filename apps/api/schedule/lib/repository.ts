/**
 * Schedule and archive queries.
 *
 * This is the only file in the schedule lane that touches the database, and the only
 * place that knows the shape of a `packages/schema` row. Everything above it works on the
 * view models in `view-models.ts`, so a column rename is a change here and nowhere else.
 *
 * `packages/schema` was not present in the repository when this was written (BLOCKER 1),
 * so the imports below do not resolve and this file does not currently typecheck. The
 * table and column identifiers follow 02-CONTRACTS.md §1 with Drizzle's usual camelCase
 * property naming; if the delivered package differs, the corrections are confined to the
 * `map*` functions at the bottom.
 */

import { and, asc, desc, eq, gte, inArray, lt, lte, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db } from '@repo/schema/client'
import {
  artistGenres,
  artists,
  episodeTracks,
  episodes,
  genres,
  showGenres,
  shows,
  tracks,
} from '@repo/schema'

import type {
  ArtistRef,
  EpisodeState,
  GenreRef,
  ScheduleEpisode,
  ShowRef,
  TracklistEntry,
} from './view-models'

/** Shape returned by the joined episode query, before mapping. */
interface EpisodeRow {
  id: string
  title: string | null
  startsAt: Date
  endsAt: Date
  state: EpisodeState
  repeatAt: Date | null
  peakListeners: number
  expiredAt: Date | null
  showId: string
  showSlug: string
  showTitle: string
  showDescription: string | null
  showArtworkUrl: string | null
  hostId: string | null
  hostSlug: string | null
  hostName: string | null
  hostRelationship: ArtistRef['relationship'] | null
  guestId: string | null
  guestSlug: string | null
  guestName: string | null
  guestRelationship: ArtistRef['relationship'] | null
}

// `artists` is joined twice — once as the show's host, once as the episode's guest — so
// each join needs its own alias.
const hostArtist = alias(artists, 'host_artist')
const guestArtist = alias(artists, 'guest_artist')

/**
 * Episodes overlapping an instant range.
 *
 * Overlap rather than containment: a show that started before the window and is still
 * running belongs on the first day of it, and containment would hide the live row from
 * anyone loading the page mid-broadcast.
 */
export async function listEpisodesInRange(start: Date, end: Date): Promise<ScheduleEpisode[]> {
  const rows = await selectEpisodes()
    .where(and(lt(episodes.startsAt, end), gte(episodes.endsAt, start)))
    .orderBy(asc(episodes.startsAt), asc(episodes.id))

  return attachGenres(rows)
}

export async function getEpisodeById(episodeId: string): Promise<ScheduleEpisode | null> {
  const rows = await selectEpisodes().where(eq(episodes.id, episodeId)).limit(1)
  const withGenres = await attachGenres(rows)
  return withGenres[0] ?? null
}

export interface ArchivePage {
  episodes: ScheduleEpisode[]
  nextCursor: { startsAt: Date; id: string } | null
}

/**
 * Expired episodes, newest first.
 *
 * Keyset pagination on `(starts_at, id)` rather than an offset, so a page does not shift
 * under the reader as episodes expire.
 */
export async function listExpiredEpisodes(options: {
  limit: number
  cursor: { startsAt: Date; id: string } | null
}): Promise<ArchivePage> {
  const cursorClause = options.cursor
    ? or(
        lt(episodes.startsAt, options.cursor.startsAt),
        and(eq(episodes.startsAt, options.cursor.startsAt), lt(episodes.id, options.cursor.id)),
      )
    : undefined

  const rows = await selectEpisodes()
    .where(cursorClause ? and(eq(episodes.state, 'expired'), cursorClause) : eq(episodes.state, 'expired'))
    .orderBy(desc(episodes.startsAt), desc(episodes.id))
    .limit(options.limit + 1)

  const page = rows.slice(0, options.limit)
  const last = page[page.length - 1]
  return {
    episodes: await attachGenres(page),
    nextCursor: rows.length > options.limit && last ? { startsAt: last.startsAt, id: last.id } : null,
  }
}

/**
 * The logged tracklist for an episode — the only surviving trace of an expired show.
 *
 * `raw_artist` / `raw_title` are always populated for rights reporting, so they are the
 * display source; the joined track is used only for the numbers and the link.
 */
export async function getTracklist(episodeId: string): Promise<TracklistEntry[]> {
  const rows = await db
    .select({
      position: episodeTracks.position,
      trackId: episodeTracks.trackId,
      rawArtist: episodeTracks.rawArtist,
      rawTitle: episodeTracks.rawTitle,
      playedAt: episodeTracks.playedAt,
      durationMs: tracks.durationMs,
      bpm: tracks.bpm,
      musicalKey: tracks.musicalKey,
    })
    .from(episodeTracks)
    .leftJoin(tracks, eq(episodeTracks.trackId, tracks.id))
    .where(eq(episodeTracks.episodeId, episodeId))
    .orderBy(asc(episodeTracks.position))

  return rows.map((row) => ({
    position: row.position,
    trackId: row.trackId,
    rawArtist: row.rawArtist,
    rawTitle: row.rawTitle,
    playedAt: row.playedAt,
    durationMs: row.durationMs ?? null,
    bpm: row.bpm ?? null,
    musicalKey: row.musicalKey ?? null,
  }))
}

export async function getShowBySlug(
  slug: string,
): Promise<{ id: string; slug: string; title: string; description: string | null } | null> {
  const [row] = await db
    .select({
      id: shows.id,
      slug: shows.slug,
      title: shows.title,
      description: shows.description,
    })
    .from(shows)
    .where(eq(shows.slug, slug))
    .limit(1)
  return row ?? null
}

/** Every airing of one show, for the calendar feed. Includes expired airings. */
export async function listEpisodesForShow(showId: string): Promise<ScheduleEpisode[]> {
  const rows = await selectEpisodes()
    .where(eq(episodes.showId, showId))
    .orderBy(asc(episodes.startsAt), asc(episodes.id))
  return attachGenres(rows)
}

/** Upcoming episodes within a lead-time horizon, for the alert delivery job. */
export async function listUpcomingEpisodes(from: Date, to: Date): Promise<ScheduleEpisode[]> {
  const rows = await selectEpisodes()
    .where(
      and(
        gte(episodes.startsAt, from),
        lte(episodes.startsAt, to),
        inArray(episodes.state, ['scheduled', 'repeat_scheduled']),
      ),
    )
    .orderBy(asc(episodes.startsAt), asc(episodes.id))
  return attachGenres(rows)
}

/** All genres, for resolving a nested genre to its parent slug in responses. */
export async function getGenreIndex(): Promise<Map<string, GenreRef>> {
  const rows = await db
    .select({ id: genres.id, slug: genres.slug, name: genres.name, parentId: genres.parentId })
    .from(genres)
  return new Map(rows.map((row) => [row.id, row]))
}

/** Genres attached to an artist, merged into alert matching for guest appearances. */
export async function getArtistGenres(artistIds: string[]): Promise<Map<string, GenreRef[]>> {
  if (artistIds.length === 0) return new Map()
  const rows = await db
    .select({
      artistId: artistGenres.artistId,
      id: genres.id,
      slug: genres.slug,
      name: genres.name,
      parentId: genres.parentId,
    })
    .from(artistGenres)
    .innerJoin(genres, eq(artistGenres.genreId, genres.id))
    .where(inArray(artistGenres.artistId, artistIds))

  const byArtist = new Map<string, GenreRef[]>()
  for (const row of rows) {
    const list = byArtist.get(row.artistId) ?? []
    list.push({ id: row.id, slug: row.slug, name: row.name, parentId: row.parentId })
    byArtist.set(row.artistId, list)
  }
  return byArtist
}

function selectEpisodes() {
  return db
    .select({
      id: episodes.id,
      title: episodes.title,
      startsAt: episodes.startsAt,
      endsAt: episodes.endsAt,
      state: episodes.state,
      repeatAt: episodes.repeatAt,
      peakListeners: episodes.peakListeners,
      expiredAt: episodes.expiredAt,
      showId: shows.id,
      showSlug: shows.slug,
      showTitle: shows.title,
      showDescription: shows.description,
      showArtworkUrl: shows.artworkUrl,
      hostId: hostArtist.id,
      hostSlug: hostArtist.slug,
      hostName: hostArtist.name,
      hostRelationship: hostArtist.relationship,
      guestId: guestArtist.id,
      guestSlug: guestArtist.slug,
      guestName: guestArtist.name,
      guestRelationship: guestArtist.relationship,
    })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .leftJoin(hostArtist, eq(shows.hostArtistId, hostArtist.id))
    .leftJoin(guestArtist, eq(episodes.guestArtistId, guestArtist.id))
}

/** Show genres, fetched in one query for the whole page rather than per row. */
async function attachGenres(rows: EpisodeRow[]): Promise<ScheduleEpisode[]> {
  if (rows.length === 0) return []

  const showIds = [...new Set(rows.map((row) => row.showId))]
  const genreRows = await db
    .select({
      showId: showGenres.showId,
      id: genres.id,
      slug: genres.slug,
      name: genres.name,
      parentId: genres.parentId,
    })
    .from(showGenres)
    .innerJoin(genres, eq(showGenres.genreId, genres.id))
    .where(inArray(showGenres.showId, showIds))
    .orderBy(asc(genres.name))

  const byShow = new Map<string, GenreRef[]>()
  for (const row of genreRows) {
    const list = byShow.get(row.showId) ?? []
    list.push({ id: row.id, slug: row.slug, name: row.name, parentId: row.parentId })
    byShow.set(row.showId, list)
  }

  return rows.map((row) => mapEpisode(row, byShow.get(row.showId) ?? []))
}

function mapEpisode(row: EpisodeRow, showGenreRefs: GenreRef[]): ScheduleEpisode {
  const show: ShowRef = {
    id: row.showId,
    slug: row.showSlug,
    title: row.showTitle,
    description: row.showDescription,
    artworkUrl: row.showArtworkUrl,
    host: mapArtist(row.hostId, row.hostSlug, row.hostName, row.hostRelationship),
    genres: showGenreRefs,
  }

  return {
    id: row.id,
    show,
    title: row.title,
    guest: mapArtist(row.guestId, row.guestSlug, row.guestName, row.guestRelationship),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    state: row.state,
    repeatAt: row.repeatAt,
    peakListeners: row.peakListeners,
    expiredAt: row.expiredAt,
  }
}

function mapArtist(
  id: string | null,
  slug: string | null,
  name: string | null,
  relationship: ArtistRef['relationship'] | null,
): ArtistRef | null {
  if (!id || !slug || !name) return null
  return { id, slug, name, relationship: relationship ?? 'guest' }
}
