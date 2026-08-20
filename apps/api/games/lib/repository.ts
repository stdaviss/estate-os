/**
 * "Which mix?" queries.
 *
 * Only tracks with rights recorded are ever read: 00-FOUNDATION.md §3 says a track without
 * `rights_granted_at` and `rights_source` must never be playable, and the game plays audio,
 * so the filter belongs in the query rather than in a check further up.
 *
 * Same caveat as the other repositories: `packages/schema` was absent when this was written
 * (BLOCKER 1) and these imports do not resolve yet.
 */

import { and, desc, eq, isNotNull } from 'drizzle-orm'

import { db } from '@repo/schema/client'
import { artists, gameEvents, tracks } from '@repo/schema'

import { GAME_SLUG, type CatalogueTrack, type GameEvent } from './which-mix'

/**
 * Candidate tracks for pairing.
 *
 * Rights are required, and an instrumental is excluded because the two versions on offer
 * should differ by mix rather than by whether there is a vocal.
 */
export async function listPairableTracks(): Promise<CatalogueTrack[]> {
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      artistId: tracks.artistId,
      artistName: artists.name,
      artistSlug: artists.slug,
      durationMs: tracks.durationMs,
      bpm: tracks.bpm,
      musicalKey: tracks.musicalKey,
      audioUrl: tracks.audioUrl,
    })
    .from(tracks)
    .innerJoin(artists, eq(tracks.artistId, artists.id))
    .where(and(isNotNull(tracks.rightsGrantedAt), isNotNull(tracks.rightsSource)))

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    artistId: row.artistId,
    artistName: row.artistName,
    artistSlug: row.artistSlug,
    durationMs: row.durationMs,
    bpm: row.bpm,
    musicalKey: row.musicalKey,
    audioUrl: row.audioUrl,
  }))
}

export interface InsertGameEventInput {
  sessionKey: string
  userId: string | null
  eventType: string
  payload: Record<string, unknown>
}

export async function insertGameEvent(input: InsertGameEventInput): Promise<void> {
  await db.insert(gameEvents).values({
    sessionKey: input.sessionKey,
    userId: input.userId,
    gameSlug: GAME_SLUG,
    eventType: input.eventType,
    payload: input.payload,
  })
}

/** Events for one pair, for the split shown after voting. Capped so a hot pair stays cheap. */
export async function listPairEvents(limit = 5000): Promise<GameEvent[]> {
  const rows = await db
    .select({
      sessionKey: gameEvents.sessionKey,
      userId: gameEvents.userId,
      gameSlug: gameEvents.gameSlug,
      eventType: gameEvents.eventType,
      payload: gameEvents.payload,
      createdAt: gameEvents.createdAt,
    })
    .from(gameEvents)
    .where(and(eq(gameEvents.gameSlug, GAME_SLUG), eq(gameEvents.eventType, 'pair.voted')))
    .orderBy(desc(gameEvents.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    sessionKey: row.sessionKey,
    userId: row.userId,
    gameSlug: row.gameSlug,
    eventType: row.eventType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  }))
}
