/**
 * `POST /api/v1/alerts/deliver` — the delivery tick.
 *
 * Called by a scheduler (cron, or the platform's scheduled-function trigger) roughly every
 * minute. Authenticated with a shared secret rather than a session because there is no
 * user behind it; a missing or wrong secret is a 401, never a no-op, so a misconfigured
 * scheduler is loud instead of silently never sending anything.
 *
 * The endpoint is not in 02-CONTRACTS.md §2 — recorded as BLOCKER 7 alongside the ICS
 * route. It is a private operational route and appears in no public navigation.
 */

import { timingSafeEqual } from 'node:crypto'

import { fail } from '../../schedule/lib/http'
import { getArtistGenres, listUpcomingEpisodes } from '../../schedule/lib/repository'
import type { GenreRef } from '../../schedule/lib/view-models'
import { runDelivery, type DeliveryLog } from '../lib/delivery'
import { deliveryLog } from '../lib/delivery-log'
import { listAllSubscriptions, listRecipients } from '../lib/repository'
import { availableTransports } from '../lib/transports'

/** The widest lead time a subscription may use, so the query window is bounded. */
const HORIZON_MS = 7 * 24 * 60 * 60_000

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.ALERTS_CRON_SECRET
  if (!expected) {
    return fail('internal', 'ALERTS_CRON_SECRET is not set, so alerts cannot be delivered.')
  }
  if (!authorised(request, expected)) {
    return fail('unauthorised', 'This endpoint is called by the scheduler.')
  }

  const now = new Date()
  const episodes = await listUpcomingEpisodes(now, new Date(now.getTime() + HORIZON_MS))
  if (episodes.length === 0) {
    return Response.json({ data: { sent: 0, skipped: 0, failed: 0 } }, { status: 200 })
  }

  const subscriptions = await listAllSubscriptions()
  const recipients = await listRecipients([...new Set(subscriptions.map((s) => s.userId))])

  const guestArtistIds = episodes
    .map((episode) => episode.guest?.id)
    .filter((id): id is string => typeof id === 'string')
  const genresByArtist = await getArtistGenres(guestArtistIds)

  const guestGenresByEpisodeId: Record<string, GenreRef[]> = {}
  for (const episode of episodes) {
    if (episode.guest) {
      guestGenresByEpisodeId[episode.id] = genresByArtist.get(episode.guest.id) ?? []
    }
  }

  const log: DeliveryLog = deliveryLog()

  const result = await runDelivery({
    now,
    episodes,
    subscriptions,
    recipients,
    guestGenresByEpisodeId,
    transports: availableTransports(),
    log,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin,
    unsubscribeSecret: requireUnsubscribeSecret(),
  })

  return Response.json(
    {
      data: {
        sent: result.sent.length,
        skipped: result.skipped.length,
        failed: result.failed.length,
      },
      // Reasons rather than message bodies: enough to explain a run, nothing about who.
      meta: { skipped_reasons: countReasons(result.skipped.map((entry) => entry.reason)) },
    },
    { status: 200 },
  )
}

function authorised(request: Request, expected: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function requireUnsubscribeSecret(): string {
  const secret = process.env.ALERTS_UNSUBSCRIBE_SECRET
  if (!secret) {
    // Sending a notification whose unsubscribe link cannot work is worse than not sending.
    throw new Error('ALERTS_UNSUBSCRIBE_SECRET is not set')
  }
  return secret
}

function countReasons(reasons: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const reason of reasons) counts[reason] = (counts[reason] ?? 0) + 1
  return counts
}
