/**
 * Alert matching and delivery planning.
 *
 * Two guarantees this module exists to make, both from 05-AGENT-C §C3:
 *   1. an alert fires at `lead_time_minutes` before the episode starts;
 *   2. one person never receives two notifications for one episode.
 *
 * Both are pure functions over plain data so they are testable without a scheduler,
 * a mail transport or a database. `matching.test.ts` covers the parent/child genre case
 * and the double-subscription case, which are the two ways this quietly goes wrong.
 */

import type { GenreRef, ScheduleEpisode } from '../../schedule/lib/view-models'

export type AlertChannel = 'email' | 'web_push'

/** Mirrors `alert_subscriptions` in 02-CONTRACTS.md §1 as this module needs it. */
export interface AlertSubscription {
  id: string
  userId: string
  /** Exactly one of `genreId` / `artistId` is set, per the table's check constraint. */
  genreId: string | null
  artistId: string | null
  channel: AlertChannel
  leadTimeMinutes: number
}

export interface AlertRecipient {
  userId: string
  email: string
  displayName: string | null
  /**
   * IANA zone for rendering times in the notification. Optional because `users` has no
   * timezone column — see BLOCKER 5. Falls back to the country map, then the station zone.
   */
  timeZone?: string | null
  country?: string | null
  consentAlerts: boolean
}

/** Everything needed to decide whether an episode matches a subscription. */
export interface EpisodeMatchContext {
  episode: ScheduleEpisode
  /** Show genres plus guest-artist genres, already merged by the caller. */
  genres: GenreRef[]
  /** Host and guest artist ids attached to this airing. */
  artistIds: string[]
}

export function buildMatchContext(
  episode: ScheduleEpisode,
  guestGenres: GenreRef[] = [],
): EpisodeMatchContext {
  const genres = new Map<string, GenreRef>()
  for (const genre of [...episode.show.genres, ...guestGenres]) genres.set(genre.id, genre)

  const artistIds = new Set<string>()
  if (episode.show.host) artistIds.add(episode.show.host.id)
  if (episode.guest) artistIds.add(episode.guest.id)

  return { episode, genres: [...genres.values()], artistIds: [...artistIds] }
}

/**
 * Genre ids an episode should match on: its own genres plus their parents.
 *
 * Subscribing to `techno` must catch a `dub techno` show, otherwise the feature reads as
 * broken. Nesting is one level deep by contract, so a single parent hop is sufficient.
 */
export function expandGenreIds(genres: GenreRef[]): Set<string> {
  const ids = new Set<string>()
  for (const genre of genres) {
    ids.add(genre.id)
    if (genre.parentId) ids.add(genre.parentId)
  }
  return ids
}

export function subscriptionMatches(
  subscription: AlertSubscription,
  context: EpisodeMatchContext,
): boolean {
  if (subscription.artistId && context.artistIds.includes(subscription.artistId)) return true
  if (subscription.genreId && expandGenreIds(context.genres).has(subscription.genreId)) return true
  return false
}

/** When a subscription's notification for this episode should be sent. */
export function triggerAt(episode: ScheduleEpisode, leadTimeMinutes: number): Date {
  const lead = Number.isFinite(leadTimeMinutes) ? Math.max(0, leadTimeMinutes) : 0
  return new Date(episode.startsAt.getTime() - lead * 60_000)
}

export interface PlannedNotification {
  /** Idempotency key. One notification per user per episode, by construction. */
  dedupeKey: string
  userId: string
  episodeId: string
  /** The subscription that won the dedupe, kept for the unsubscribe link. */
  subscriptionId: string
  channel: AlertChannel
  leadTimeMinutes: number
  sendAt: Date
}

export function dedupeKey(userId: string, episodeId: string): string {
  return `${userId}:${episodeId}`
}

/**
 * Collapses every matching subscription for one user and one episode into a single
 * planned notification.
 *
 * The brief says "one person never receives two notifications for one episode" without
 * saying whether two channels count as two notifications. The conservative reading — one
 * notification total — is the one implemented; the alternative reading (one per channel)
 * is recorded in SUBMISSION.md §8. The winner is the earliest send time, so the user
 * keeps the most advance warning they asked for anywhere; ties break on channel then id
 * so the same input always produces the same plan.
 */
export function planNotifications(
  context: EpisodeMatchContext,
  subscriptions: AlertSubscription[],
): PlannedNotification[] {
  const winners = new Map<string, PlannedNotification>()

  for (const subscription of subscriptions) {
    if (!subscriptionMatches(subscription, context)) continue

    const key = dedupeKey(subscription.userId, context.episode.id)
    const candidate: PlannedNotification = {
      dedupeKey: key,
      userId: subscription.userId,
      episodeId: context.episode.id,
      subscriptionId: subscription.id,
      channel: subscription.channel,
      leadTimeMinutes: subscription.leadTimeMinutes,
      sendAt: triggerAt(context.episode, subscription.leadTimeMinutes),
    }

    const incumbent = winners.get(key)
    if (!incumbent || beats(candidate, incumbent)) winners.set(key, candidate)
  }

  return [...winners.values()].sort((a, b) => {
    const bySendAt = a.sendAt.getTime() - b.sendAt.getTime()
    if (bySendAt !== 0) return bySendAt
    return a.dedupeKey < b.dedupeKey ? -1 : a.dedupeKey > b.dedupeKey ? 1 : 0
  })
}

function beats(candidate: PlannedNotification, incumbent: PlannedNotification): boolean {
  const bySendAt = candidate.sendAt.getTime() - incumbent.sendAt.getTime()
  if (bySendAt !== 0) return bySendAt < 0
  if (candidate.channel !== incumbent.channel) return candidate.channel < incumbent.channel
  return candidate.subscriptionId < incumbent.subscriptionId
}

export interface DeliveryWindow {
  /** Notifications due at or before this instant are sent on this run. */
  now: Date
  /**
   * How far back the job will look. A notification whose send time passed by more than
   * this is dropped rather than sent late — a "starts in 60 minutes" alert delivered
   * after the show has ended is worse than none.
   */
  graceMs?: number
}

export const DEFAULT_GRACE_MS = 10 * 60_000

/**
 * Filters a plan down to what is due now, excluding anything already delivered.
 *
 * `alreadySent` is supplied by the caller. There is no table to persist it in — see
 * BLOCKER 3 — so across process restarts dedupe currently depends on whatever the
 * caller passes, and the in-memory implementation in `delivery.ts` is not durable.
 */
export function selectDue(
  planned: PlannedNotification[],
  window: DeliveryWindow,
  alreadySent: ReadonlySet<string>,
): PlannedNotification[] {
  const grace = window.graceMs ?? DEFAULT_GRACE_MS
  const nowMs = window.now.getTime()
  return planned.filter((notification) => {
    if (alreadySent.has(notification.dedupeKey)) return false
    const sendMs = notification.sendAt.getTime()
    return sendMs <= nowMs && nowMs - sendMs <= grace
  })
}

/** Alerts are opt-in (00-FOUNDATION.md §5); no consent, no send, regardless of subscriptions. */
export function filterConsented(
  planned: PlannedNotification[],
  recipients: ReadonlyMap<string, AlertRecipient>,
): PlannedNotification[] {
  return planned.filter((notification) => recipients.get(notification.userId)?.consentAlerts === true)
}
