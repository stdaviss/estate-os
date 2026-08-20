import { describe, expect, it } from 'vitest'

import type { GenreRef, ScheduleEpisode, ShowRef } from '../../schedule/lib/view-models'
import { buildNotificationCopy } from './copy'
import { InMemoryDeliveryLog, runDelivery, type AlertTransport } from './delivery'
import {
  buildMatchContext,
  dedupeKey,
  expandGenreIds,
  filterConsented,
  planNotifications,
  selectDue,
  subscriptionMatches,
  triggerAt,
  type AlertRecipient,
  type AlertSubscription,
} from './matching'
import { resolveRecipientTimeZone } from './recipient-timezone'
import { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from './token'

const techno: GenreRef = { id: 'g-techno', slug: 'techno', name: 'Techno', parentId: null }
const dubTechno: GenreRef = {
  id: 'g-dub-techno',
  slug: 'dub-techno',
  name: 'Dub techno',
  parentId: 'g-techno',
}
const house: GenreRef = { id: 'g-house', slug: 'house', name: 'House', parentId: null }

const host = { id: 'a-host', slug: 'lha', name: 'LHA', relationship: 'affiliate' as const }
const guest = { id: 'a-guest', slug: 'sels', name: 'SELS', relationship: 'guest' as const }

const show: ShowRef = {
  id: 'show-1',
  slug: 'nuit-blanche',
  title: 'Nuit Blanche',
  description: null,
  artworkUrl: null,
  host,
  genres: [dubTechno],
}

const episode: ScheduleEpisode = {
  id: 'ep-1',
  show,
  title: null,
  guest,
  startsAt: new Date('2026-08-20T21:00:00.000Z'),
  endsAt: new Date('2026-08-20T23:00:00.000Z'),
  state: 'scheduled',
  repeatAt: null,
  peakListeners: 0,
  expiredAt: null,
}

const context = buildMatchContext(episode)

function sub(overrides: Partial<AlertSubscription> & { id: string }): AlertSubscription {
  return {
    userId: 'u-1',
    genreId: null,
    artistId: null,
    channel: 'email',
    leadTimeMinutes: 60,
    ...overrides,
  }
}

const SECRET = 'a'.repeat(48)

describe('matching', () => {
  it('matches a subscription to the exact genre of the show', () => {
    expect(subscriptionMatches(sub({ id: 's1', genreId: dubTechno.id }), context)).toBe(true)
  })

  it('matches a parent-genre subscription to a child-genre show', () => {
    // Subscribing to techno must catch a dub techno show, or the feature reads as broken.
    expect(subscriptionMatches(sub({ id: 's2', genreId: techno.id }), context)).toBe(true)
  })

  it('does not match an unrelated genre', () => {
    expect(subscriptionMatches(sub({ id: 's3', genreId: house.id }), context)).toBe(false)
  })

  it('does not match a child-genre subscription to a parent-genre show', () => {
    // The specific subscriber asked for dub techno; a general techno show is not that.
    const parentOnly = buildMatchContext({ ...episode, show: { ...show, genres: [techno] } })
    expect(subscriptionMatches(sub({ id: 's4', genreId: dubTechno.id }), parentOnly)).toBe(false)
  })

  it('matches on the host and on the guest', () => {
    expect(subscriptionMatches(sub({ id: 's5', artistId: host.id }), context)).toBe(true)
    expect(subscriptionMatches(sub({ id: 's6', artistId: guest.id }), context)).toBe(true)
    expect(subscriptionMatches(sub({ id: 's7', artistId: 'a-other' }), context)).toBe(false)
  })

  it('includes the guest artist genres in the match context', () => {
    const withGuestGenres = buildMatchContext(episode, [house])
    expect(subscriptionMatches(sub({ id: 's8', genreId: house.id }), withGuestGenres)).toBe(true)
  })

  it('expands a genre set to include parents exactly once', () => {
    expect([...expandGenreIds([dubTechno, dubTechno])].sort()).toEqual(
      ['g-dub-techno', 'g-techno'].sort(),
    )
  })
})

describe('lead times', () => {
  it('fires at lead_time_minutes before the start', () => {
    expect(triggerAt(episode, 60).toISOString()).toBe('2026-08-20T20:00:00.000Z')
    expect(triggerAt(episode, 1440).toISOString()).toBe('2026-08-19T21:00:00.000Z')
  })

  it('treats zero and a negative lead as at the start time', () => {
    expect(triggerAt(episode, 0).toISOString()).toBe('2026-08-20T21:00:00.000Z')
    expect(triggerAt(episode, -30).toISOString()).toBe('2026-08-20T21:00:00.000Z')
  })
})

describe('one notification per person per episode', () => {
  it('collapses two matching subscriptions into one notification', () => {
    const planned = planNotifications(context, [
      sub({ id: 's-genre', genreId: techno.id, leadTimeMinutes: 60 }),
      sub({ id: 's-artist', artistId: guest.id, leadTimeMinutes: 30 }),
    ])
    expect(planned).toHaveLength(1)
    expect(planned[0].dedupeKey).toBe(dedupeKey('u-1', 'ep-1'))
  })

  it('keeps the earliest send time, so the most warning the user asked for wins', () => {
    const planned = planNotifications(context, [
      sub({ id: 's-late', genreId: techno.id, leadTimeMinutes: 15 }),
      sub({ id: 's-early', artistId: guest.id, leadTimeMinutes: 180 }),
    ])
    expect(planned[0].subscriptionId).toBe('s-early')
    expect(planned[0].sendAt.toISOString()).toBe('2026-08-20T18:00:00.000Z')
  })

  it('collapses across channels too, on the conservative reading of the brief', () => {
    const planned = planNotifications(context, [
      sub({ id: 's-mail', genreId: techno.id, channel: 'email' }),
      sub({ id: 's-push', genreId: techno.id, channel: 'web_push' }),
    ])
    expect(planned).toHaveLength(1)
  })

  it('is deterministic when two subscriptions tie exactly', () => {
    const first = planNotifications(context, [
      sub({ id: 's-b', genreId: techno.id }),
      sub({ id: 's-a', artistId: guest.id }),
    ])
    const second = planNotifications(context, [
      sub({ id: 's-a', artistId: guest.id }),
      sub({ id: 's-b', genreId: techno.id }),
    ])
    expect(first[0].subscriptionId).toBe(second[0].subscriptionId)
  })

  it('still notifies two different people', () => {
    const planned = planNotifications(context, [
      sub({ id: 's-1', userId: 'u-1', genreId: techno.id }),
      sub({ id: 's-2', userId: 'u-2', genreId: techno.id }),
    ])
    expect(planned.map((p) => p.userId).sort()).toEqual(['u-1', 'u-2'])
  })

  it('plans nothing when no subscription matches', () => {
    expect(planNotifications(context, [sub({ id: 's-x', genreId: house.id })])).toEqual([])
  })
})

describe('due selection', () => {
  const planned = planNotifications(context, [sub({ id: 's1', genreId: techno.id, leadTimeMinutes: 60 })])
  const empty = new Set<string>()

  it('does not send before the trigger time', () => {
    expect(selectDue(planned, { now: new Date('2026-08-20T19:59:00.000Z') }, empty)).toHaveLength(0)
  })

  it('sends at the trigger time', () => {
    expect(selectDue(planned, { now: new Date('2026-08-20T20:00:00.000Z') }, empty)).toHaveLength(1)
  })

  it('drops a notification the job missed by more than the grace window', () => {
    // Better nothing than "starts in 60 minutes" arriving after the show ended.
    expect(selectDue(planned, { now: new Date('2026-08-20T22:00:00.000Z') }, empty)).toHaveLength(0)
  })

  it('suppresses anything already delivered', () => {
    const sent = new Set([dedupeKey('u-1', 'ep-1')])
    expect(selectDue(planned, { now: new Date('2026-08-20T20:00:00.000Z') }, sent)).toHaveLength(0)
  })
})

describe('consent', () => {
  it('drops a user who has not opted in', () => {
    const planned = planNotifications(context, [sub({ id: 's1', genreId: techno.id })])
    const withoutConsent = new Map<string, AlertRecipient>([
      ['u-1', { userId: 'u-1', email: 'a@b.test', displayName: null, consentAlerts: false }],
    ])
    expect(filterConsented(planned, withoutConsent)).toHaveLength(0)
  })
})

describe('recipient timezone', () => {
  it('uses a stated zone when there is one', () => {
    expect(
      resolveRecipientTimeZone({
        userId: 'u',
        email: 'a@b.test',
        displayName: null,
        consentAlerts: true,
        timeZone: 'Asia/Tokyo',
      }),
    ).toEqual({ timeZone: 'Asia/Tokyo', confidence: 'stated' })
  })

  it('infers from a single-zone country', () => {
    expect(
      resolveRecipientTimeZone({
        userId: 'u',
        email: 'a@b.test',
        displayName: null,
        consentAlerts: true,
        country: 'jp',
      }),
    ).toEqual({ timeZone: 'Asia/Tokyo', confidence: 'inferred_from_country' })
  })

  it('refuses to guess a multi-zone country and falls back to the station', () => {
    const resolved = resolveRecipientTimeZone({
      userId: 'u',
      email: 'a@b.test',
      displayName: null,
      consentAlerts: true,
      country: 'US',
    })
    expect(resolved).toEqual({ timeZone: 'Europe/Paris', confidence: 'station_default' })
  })

  it('ignores a malformed stated zone rather than throwing', () => {
    const resolved = resolveRecipientTimeZone({
      userId: 'u',
      email: 'a@b.test',
      displayName: null,
      consentAlerts: true,
      timeZone: 'Europe/Marseille',
    })
    expect(resolved.confidence).toBe('station_default')
  })
})

describe('notification copy', () => {
  const notification = planNotifications(context, [sub({ id: 's1', genreId: techno.id })])[0]

  it('states the time in the reader zone and the station zone', () => {
    const copy = buildNotificationCopy({
      episode,
      notification,
      zone: { timeZone: 'Asia/Tokyo', confidence: 'stated' },
      siteUrl: 'https://example.test',
      unsubscribeUrl: 'https://example.test/u',
    })
    // 21:00 UTC on the 20th is 06:00 on the 21st in Tokyo.
    expect(copy.subject).toBe('Nuit Blanche — 06:00 UTC+09:00')
    expect(copy.body).toContain('2026.08.21 at 06:00 UTC+09:00')
    expect(copy.body).toContain('in Marseille')
    expect(copy.body).toContain('https://example.test/schedule/ep-1')
  })

  it('omits the station line when the reader is already in the station zone', () => {
    const copy = buildNotificationCopy({
      episode,
      notification,
      zone: { timeZone: 'Europe/Paris', confidence: 'stated' },
      siteUrl: 'https://example.test',
      unsubscribeUrl: 'https://example.test/u',
    })
    expect(copy.body).not.toContain('in Marseille')
  })

  it('labels a guessed time as station time rather than implying a conversion', () => {
    const copy = buildNotificationCopy({
      episode,
      notification,
      zone: { timeZone: 'Europe/Paris', confidence: 'station_default' },
      siteUrl: 'https://example.test',
      unsubscribeUrl: 'https://example.test/u',
    })
    expect(copy.subject).toContain('(station time)')
  })

  it('holds the voice: no exclamation marks and no marketing words', () => {
    const copy = buildNotificationCopy({
      episode,
      notification,
      zone: { timeZone: 'Asia/Tokyo', confidence: 'stated' },
      siteUrl: 'https://example.test',
      unsubscribeUrl: 'https://example.test/u',
    })
    const text = `${copy.subject} ${copy.body} ${copy.pushTitle} ${copy.pushBody}`
    expect(text).not.toContain('!')
    for (const banned of ['seamless', 'curated', 'journey', 'unlock', 'empower', 'elevate']) {
      expect(text.toLowerCase()).not.toContain(banned)
    }
  })

  it('carries exactly one unsubscribe link', () => {
    const copy = buildNotificationCopy({
      episode,
      notification,
      zone: { timeZone: 'Asia/Tokyo', confidence: 'stated' },
      siteUrl: 'https://example.test',
      unsubscribeUrl: 'https://example.test/u?token=abc',
    })
    expect(copy.body.match(/https:\/\/example\.test\/u/g)).toHaveLength(1)
  })
})

describe('unsubscribe tokens', () => {
  const claims = { subscriptionId: 'sub-1', userId: 'u-1' }

  it('round-trips', () => {
    const token = signUnsubscribeToken(claims, SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({ valid: true, claims })
  })

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken(claims, SECRET)
    const forged = signUnsubscribeToken({ subscriptionId: 'sub-2', userId: 'u-2' }, SECRET)
    const spliced = `${forged.split('.')[0]}.${token.split('.')[1]}`
    expect(verifyUnsubscribeToken(spliced, SECRET).valid).toBe(false)
  })

  it('rejects a token signed with another secret', () => {
    const token = signUnsubscribeToken(claims, 'b'.repeat(48))
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({ valid: false, reason: 'bad_signature' })
  })

  it('rejects malformed input rather than throwing', () => {
    expect(verifyUnsubscribeToken('', SECRET).valid).toBe(false)
    expect(verifyUnsubscribeToken('nodot', SECRET).valid).toBe(false)
    expect(verifyUnsubscribeToken('....', SECRET).valid).toBe(false)
  })

  it('refuses to sign with a weak secret', () => {
    expect(() => signUnsubscribeToken(claims, 'short')).toThrow(/at least 32/)
  })

  it('builds an absolute url that needs no session', () => {
    const url = unsubscribeUrl('https://example.test/', claims, SECRET)
    expect(url.startsWith('https://example.test/api/v1/alerts/unsubscribe?token=')).toBe(true)
  })
})

describe('a delivery run', () => {
  function recipient(overrides: Partial<AlertRecipient> = {}): AlertRecipient {
    return {
      userId: 'u-1',
      email: 'listener@example.test',
      displayName: null,
      consentAlerts: true,
      timeZone: 'Asia/Tokyo',
      ...overrides,
    }
  }

  function recordingTransport(): AlertTransport & { sentTo: string[] } {
    const sentTo: string[] = []
    return {
      channel: 'email',
      sentTo,
      async send(to) {
        sentTo.push(to.email)
      },
    }
  }

  const base = {
    now: new Date('2026-08-20T20:00:00.000Z'),
    episodes: [episode],
    subscriptions: [sub({ id: 's1', genreId: techno.id, leadTimeMinutes: 60 })],
    siteUrl: 'https://example.test',
    unsubscribeSecret: SECRET,
  }

  it('sends once when due', async () => {
    const transport = recordingTransport()
    const result = await runDelivery({
      ...base,
      recipients: [recipient()],
      transports: [transport],
      log: new InMemoryDeliveryLog(),
    })
    expect(result.sent).toHaveLength(1)
    expect(transport.sentTo).toEqual(['listener@example.test'])
  })

  it('does not send twice across two runs', async () => {
    const transport = recordingTransport()
    const log = new InMemoryDeliveryLog()
    const input = { ...base, recipients: [recipient()], transports: [transport], log }
    await runDelivery(input)
    const second = await runDelivery(input)
    expect(second.sent).toHaveLength(0)
    expect(second.skipped.map((s) => s.reason)).toContain('already_sent')
    expect(transport.sentTo).toHaveLength(1)
  })

  it('does not record a failed send, so it can be retried', async () => {
    const failing: AlertTransport = {
      channel: 'email',
      async send() {
        throw new Error('smtp refused')
      },
    }
    const log = new InMemoryDeliveryLog()
    const first = await runDelivery({
      ...base,
      recipients: [recipient()],
      transports: [failing],
      log,
    })
    expect(first.failed).toHaveLength(1)

    const transport = recordingTransport()
    const retry = await runDelivery({ ...base, recipients: [recipient()], transports: [transport], log })
    expect(retry.sent).toHaveLength(1)
  })

  it('skips a user without consent', async () => {
    const transport = recordingTransport()
    const result = await runDelivery({
      ...base,
      recipients: [recipient({ consentAlerts: false })],
      transports: [transport],
      log: new InMemoryDeliveryLog(),
    })
    expect(result.sent).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toContain('no_consent')
    expect(transport.sentTo).toEqual([])
  })

  it('reports a missing transport instead of dropping the notification silently', async () => {
    const result = await runDelivery({
      ...base,
      subscriptions: [sub({ id: 's1', genreId: techno.id, channel: 'web_push' })],
      recipients: [recipient()],
      transports: [recordingTransport()],
      log: new InMemoryDeliveryLog(),
    })
    expect(result.skipped.map((s) => s.reason)).toContain('no_transport')
  })

  it('sends nothing when nothing is due yet', async () => {
    const result = await runDelivery({
      ...base,
      now: new Date('2026-08-20T12:00:00.000Z'),
      recipients: [recipient()],
      transports: [recordingTransport()],
      log: new InMemoryDeliveryLog(),
    })
    expect(result.sent).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toContain('not_due')
  })
})
