/**
 * The alert delivery job.
 *
 * Composed of the pure pieces in this directory so the whole run is testable with a fake
 * clock and fake transports: plan → drop anything already sent → drop anything without
 * consent → render copy → send → record.
 *
 * The delivery log is an interface rather than a table because `02-CONTRACTS.md` has no
 * `alert_deliveries` table (BLOCKER 3). `InMemoryDeliveryLog` is correct within one
 * process and *not* durable across restarts; that is the known defect, recorded in
 * SUBMISSION.md §9 rather than hidden behind an abstraction that looks finished.
 */

import type { GenreRef, ScheduleEpisode } from '../../schedule/lib/view-models'
import { buildNotificationCopy, type NotificationCopy } from './copy'
import {
  buildMatchContext,
  filterConsented,
  planNotifications,
  selectDue,
  type AlertRecipient,
  type AlertSubscription,
  type PlannedNotification,
} from './matching'
import { resolveRecipientTimeZone } from './recipient-timezone'
import { unsubscribeUrl } from './token'

export interface DeliveryLog {
  /** Dedupe keys already delivered, for the episodes under consideration. */
  sentKeys(episodeIds: string[]): Promise<Set<string>>
  record(notification: PlannedNotification): Promise<void>
}

export class InMemoryDeliveryLog implements DeliveryLog {
  private readonly keys = new Set<string>()

  async sentKeys(): Promise<Set<string>> {
    return new Set(this.keys)
  }

  async record(notification: PlannedNotification): Promise<void> {
    this.keys.add(notification.dedupeKey)
  }
}

export interface AlertTransport {
  channel: 'email' | 'web_push'
  send(recipient: AlertRecipient, copy: NotificationCopy): Promise<void>
}

export interface DeliveryRunInput {
  now: Date
  /** Upcoming episodes within the widest lead time the job supports. */
  episodes: ScheduleEpisode[]
  subscriptions: AlertSubscription[]
  recipients: AlertRecipient[]
  /** Guest-artist genres per episode id, merged into matching. */
  guestGenresByEpisodeId?: Record<string, GenreRef[]>
  transports: AlertTransport[]
  log: DeliveryLog
  siteUrl: string
  unsubscribeSecret: string
  graceMs?: number
}

export interface DeliveryRunResult {
  sent: PlannedNotification[]
  /** Planned but not sent, with the reason, so a run can be explained after the fact. */
  skipped: { notification: PlannedNotification; reason: SkipReason }[]
  failed: { notification: PlannedNotification; error: string }[]
}

export type SkipReason =
  | 'already_sent'
  | 'no_consent'
  | 'no_recipient'
  | 'no_transport'
  | 'not_due'

export async function runDelivery(input: DeliveryRunInput): Promise<DeliveryRunResult> {
  const recipientsByUserId = new Map(input.recipients.map((r) => [r.userId, r]))
  const episodesById = new Map(input.episodes.map((e) => [e.id, e]))
  const transportsByChannel = new Map(input.transports.map((t) => [t.channel, t]))

  const result: DeliveryRunResult = { sent: [], skipped: [], failed: [] }

  const allPlanned: PlannedNotification[] = []
  for (const episode of input.episodes) {
    const context = buildMatchContext(episode, input.guestGenresByEpisodeId?.[episode.id] ?? [])
    allPlanned.push(...planNotifications(context, input.subscriptions))
  }

  const alreadySent = await input.log.sentKeys(input.episodes.map((episode) => episode.id))
  const due = selectDue(allPlanned, { now: input.now, graceMs: input.graceMs }, alreadySent)

  for (const notification of allPlanned) {
    if (alreadySent.has(notification.dedupeKey)) {
      result.skipped.push({ notification, reason: 'already_sent' })
    } else if (!due.includes(notification)) {
      result.skipped.push({ notification, reason: 'not_due' })
    }
  }

  const consented = filterConsented(due, recipientsByUserId)
  for (const notification of due) {
    if (!consented.includes(notification)) {
      const reason: SkipReason = recipientsByUserId.has(notification.userId)
        ? 'no_consent'
        : 'no_recipient'
      result.skipped.push({ notification, reason })
    }
  }

  for (const notification of consented) {
    const recipient = recipientsByUserId.get(notification.userId)
    const episode = episodesById.get(notification.episodeId)
    const transport = transportsByChannel.get(notification.channel)
    if (!recipient || !episode) {
      result.skipped.push({ notification, reason: 'no_recipient' })
      continue
    }
    if (!transport) {
      result.skipped.push({ notification, reason: 'no_transport' })
      continue
    }

    const copy = buildNotificationCopy({
      episode,
      notification,
      zone: resolveRecipientTimeZone(recipient),
      siteUrl: input.siteUrl,
      unsubscribeUrl: unsubscribeUrl(
        input.siteUrl,
        { subscriptionId: notification.subscriptionId, userId: notification.userId },
        input.unsubscribeSecret,
      ),
    })

    try {
      await transport.send(recipient, copy)
      // Recorded after a successful send: a transport failure must be retryable, and a
      // key written before sending would suppress the retry.
      await input.log.record(notification)
      result.sent.push(notification)
    } catch (error) {
      result.failed.push({
        notification,
        error: error instanceof Error ? error.message : 'unknown transport error',
      })
    }
  }

  return result
}
