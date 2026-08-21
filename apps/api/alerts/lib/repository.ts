/**
 * Alert subscription queries.
 *
 * The only file in the alerts lane that touches the database. Same caveat as the schedule
 * repository: `packages/schema` was absent when this was written (BLOCKER 1), so the
 * imports do not resolve yet.
 */

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@repo/schema/client'
import { alertSubscriptions, artists, genres, users } from '@repo/schema'

import type { AlertChannel, AlertRecipient, AlertSubscription } from './matching'

export interface AlertSubscriptionDetail extends AlertSubscription {
  /** Denormalised for the settings list, so removing an alert does not need a second call. */
  genreSlug: string | null
  genreName: string | null
  artistSlug: string | null
  artistName: string | null
}

export async function listSubscriptionsForUser(userId: string): Promise<AlertSubscriptionDetail[]> {
  const rows = await db
    .select({
      id: alertSubscriptions.id,
      userId: alertSubscriptions.userId,
      genreId: alertSubscriptions.genreId,
      artistId: alertSubscriptions.artistId,
      channel: alertSubscriptions.channel,
      leadTimeMinutes: alertSubscriptions.leadTimeMinutes,
      genreSlug: genres.slug,
      genreName: genres.name,
      artistSlug: artists.slug,
      artistName: artists.name,
    })
    .from(alertSubscriptions)
    .leftJoin(genres, eq(alertSubscriptions.genreId, genres.id))
    .leftJoin(artists, eq(alertSubscriptions.artistId, artists.id))
    .where(eq(alertSubscriptions.userId, userId))

  return rows.map((row) => ({
    ...row,
    genreSlug: row.genreSlug ?? null,
    genreName: row.genreName ?? null,
    artistSlug: row.artistSlug ?? null,
    artistName: row.artistName ?? null,
  }))
}

export interface CreateSubscriptionInput {
  userId: string
  genreId: string | null
  artistId: string | null
  channel: AlertChannel
  leadTimeMinutes: number
}

/**
 * Creates a subscription, or returns the existing one for the same target and channel.
 *
 * Idempotent by design: a second tap on "set an alert" must not produce a duplicate row,
 * because duplicates are what make one episode arrive as two notifications.
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<{ subscription: AlertSubscriptionDetail; created: boolean }> {
  const existing = await db
    .select({ id: alertSubscriptions.id })
    .from(alertSubscriptions)
    .where(
      and(
        eq(alertSubscriptions.userId, input.userId),
        eq(alertSubscriptions.channel, input.channel),
        input.genreId
          ? eq(alertSubscriptions.genreId, input.genreId)
          : isNull(alertSubscriptions.genreId),
        input.artistId
          ? eq(alertSubscriptions.artistId, input.artistId)
          : isNull(alertSubscriptions.artistId),
      ),
    )
    .limit(1)

  if (existing[0]) {
    const detail = await getSubscription(existing[0].id)
    if (detail) return { subscription: detail, created: false }
  }

  const [inserted] = await db.insert(alertSubscriptions).values(input).returning({
    id: alertSubscriptions.id,
  })

  const detail = await getSubscription(inserted.id)
  if (!detail) throw new Error('subscription disappeared immediately after insert')
  return { subscription: detail, created: true }
}

export async function getSubscription(id: string): Promise<AlertSubscriptionDetail | null> {
  const rows = await db
    .select({
      id: alertSubscriptions.id,
      userId: alertSubscriptions.userId,
      genreId: alertSubscriptions.genreId,
      artistId: alertSubscriptions.artistId,
      channel: alertSubscriptions.channel,
      leadTimeMinutes: alertSubscriptions.leadTimeMinutes,
      genreSlug: genres.slug,
      genreName: genres.name,
      artistSlug: artists.slug,
      artistName: artists.name,
    })
    .from(alertSubscriptions)
    .leftJoin(genres, eq(alertSubscriptions.genreId, genres.id))
    .leftJoin(artists, eq(alertSubscriptions.artistId, artists.id))
    .where(eq(alertSubscriptions.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    genreSlug: row.genreSlug ?? null,
    genreName: row.genreName ?? null,
    artistSlug: row.artistSlug ?? null,
    artistName: row.artistName ?? null,
  }
}

/** Deletes only if the subscription belongs to the caller. Returns whether a row went. */
export async function deleteSubscription(id: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(alertSubscriptions)
    .where(and(eq(alertSubscriptions.id, id), eq(alertSubscriptions.userId, userId)))
    .returning({ id: alertSubscriptions.id })
  return deleted.length > 0
}

/**
 * Deletes on the authority of a signed token rather than a session, for the one-click
 * unsubscribe in a notification. The token's user id must match the row's owner, so a
 * valid token for one subscription cannot remove another.
 */
export async function deleteSubscriptionByToken(
  subscriptionId: string,
  userId: string,
): Promise<boolean> {
  return deleteSubscription(subscriptionId, userId)
}

export async function resolveGenreId(slug: string): Promise<string | null> {
  const [row] = await db.select({ id: genres.id }).from(genres).where(eq(genres.slug, slug)).limit(1)
  return row?.id ?? null
}

export async function resolveArtistId(slug: string): Promise<string | null> {
  const [row] = await db.select({ id: artists.id }).from(artists).where(eq(artists.slug, slug)).limit(1)
  return row?.id ?? null
}

/** Every subscription, for the delivery job. */
export async function listAllSubscriptions(): Promise<AlertSubscription[]> {
  return db
    .select({
      id: alertSubscriptions.id,
      userId: alertSubscriptions.userId,
      genreId: alertSubscriptions.genreId,
      artistId: alertSubscriptions.artistId,
      channel: alertSubscriptions.channel,
      leadTimeMinutes: alertSubscriptions.leadTimeMinutes,
    })
    .from(alertSubscriptions)
}

/**
 * Recipients for the delivery job. Soft-deleted users are excluded here as well as by
 * consent, so a deletion request stops mail immediately rather than at the purge job.
 */
export async function listRecipients(userIds: string[]): Promise<AlertRecipient[]> {
  if (userIds.length === 0) return []
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      country: users.country,
      consentAlerts: users.consentAlerts,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(inArray(users.id, userIds))

  return rows
    .filter((row) => row.deletedAt === null)
    .map((row) => ({
      userId: row.userId,
      email: row.email,
      displayName: row.displayName,
      country: row.country,
      consentAlerts: row.consentAlerts,
    }))
}
