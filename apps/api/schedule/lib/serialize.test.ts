import { describe, expect, it } from 'vitest'

import {
  assertNoPrivateFields,
  PUBLIC_EPISODE_FORBIDDEN_FIELDS,
  serializeEpisode,
  serializeTracklist,
} from './serialize'
import type { ScheduleEpisode, ShowRef, TracklistEntry } from './view-models'

const show: ShowRef = {
  id: 'show-1',
  slug: 'nuit-blanche',
  title: 'Nuit Blanche',
  description: 'Late transmissions from the port.',
  artworkUrl: '/artwork/nuit-blanche.jpg',
  host: { id: 'a-1', slug: 'lha', name: 'LHA', relationship: 'affiliate' },
  genres: [{ id: 'g-2', slug: 'dub-techno', name: 'Dub techno', parentId: 'g-1' }],
}

const expired: ScheduleEpisode = {
  id: 'ep-1',
  show,
  title: null,
  guest: { id: 'a-2', slug: 'sels', name: 'SELS', relationship: 'guest' },
  startsAt: new Date('2026-08-14T21:00:00.000Z'),
  endsAt: new Date('2026-08-14T23:00:00.000Z'),
  state: 'expired',
  repeatAt: null,
  peakListeners: 341,
  expiredAt: new Date('2026-08-15T21:00:00.000Z'),
}

describe('the private master never reaches a public payload', () => {
  it('omits internal_master_key even when the row carries one', () => {
    // The serialiser takes a view model, but assert against a row-shaped object too:
    // this is the leak that 02-CONTRACTS.md §1 singles out.
    const withPrivate = {
      ...serializeEpisode(expired),
      internal_master_key: 's3://masters/ep-1.flac',
    }
    expect(() => assertNoPrivateFields(withPrivate)).toThrow(/internal_master_key/)
  })

  it('passes a correctly serialised episode', () => {
    const payload = serializeEpisode(expired)
    expect(() => assertNoPrivateFields(payload)).not.toThrow()
    expect(Object.keys(payload)).not.toContain('internal_master_key')
    expect(Object.keys(payload)).not.toContain('internalMasterKey')
  })

  it('catches a private field nested at any depth', () => {
    expect(() =>
      assertNoPrivateFields({ data: { episodes: [{ show: { internalMasterKey: 'x' } }] } }),
    ).toThrow(/internalMasterKey/)
  })

  it('catches a staff note, which is also not public', () => {
    expect(PUBLIC_EPISODE_FORBIDDEN_FIELDS).toContain('staff_note')
    expect(() => assertNoPrivateFields({ submission: { staff_note: 'maybe' } })).toThrow()
  })
})

describe('episode serialisation', () => {
  it('never marks an expired episode playable', () => {
    expect(serializeEpisode(expired).is_playable).toBe(false)
  })

  it('marks a live episode playable and a scheduled one not', () => {
    expect(serializeEpisode({ ...expired, state: 'live' }).is_playable).toBe(true)
    expect(serializeEpisode({ ...expired, state: 'scheduled' }).is_playable).toBe(false)
    expect(serializeEpisode({ ...expired, state: 'repeat_scheduled' }).is_playable).toBe(false)
  })

  it('falls back to the show title and honours an override', () => {
    expect(serializeEpisode(expired).title).toBe('Nuit Blanche')
    expect(serializeEpisode({ ...expired, title: 'Nuit Blanche 012' }).title).toBe('Nuit Blanche 012')
  })

  it('renders station-local display values in the design system formats', () => {
    const payload = serializeEpisode(expired)
    expect(payload.display.station_time).toBe('23:00')
    expect(payload.display.station_date).toBe('2026.08.14')
    expect(payload.display.duration).toBe('02:00:00')
    expect(payload.display.station_timezone).toBe('Europe/Paris')
  })

  it('renders the viewer zone alongside the station zone', () => {
    const payload = serializeEpisode(expired, new Map(), 'Asia/Tokyo')
    expect(payload.display.local_time).toBe('06:00')
    expect(payload.display.local_date).toBe('2026.08.15')
    expect(payload.display.local_offset).toBe('UTC+09:00')
    expect(payload.display.local_day_shift).toBe(1)
    // The station values are unchanged, so a listing can show both.
    expect(payload.display.station_time).toBe('23:00')
    expect(payload.display.station_offset).toBe('UTC+02:00')
  })

  it('defaults the viewer zone to the station zone with no day shift', () => {
    const payload = serializeEpisode(expired)
    expect(payload.display.local_time).toBe(payload.display.station_time)
    expect(payload.display.local_day_shift).toBe(0)
  })

  it('reports a negative shift for a viewer west of the date boundary', () => {
    const payload = serializeEpisode(
      { ...expired, startsAt: new Date('2026-08-14T00:30:00.000Z') },
      new Map(),
      'America/Los_Angeles',
    )
    expect(payload.display.local_day_shift).toBe(-1)
  })

  it('resolves a nested genre to its parent slug', () => {
    const index = new Map([['g-1', { id: 'g-1', slug: 'techno', name: 'Techno', parentId: null }]])
    expect(serializeEpisode(expired, index).show.genres[0].parent_slug).toBe('techno')
    expect(serializeEpisode(expired).show.genres[0].parent_slug).toBeNull()
  })
})

describe('tracklist serialisation', () => {
  const entries: TracklistEntry[] = [
    {
      position: 2,
      trackId: null,
      rawArtist: 'Unknown',
      rawTitle: 'Untitled B2',
      playedAt: new Date('2026-08-14T21:34:00.000Z'),
      durationMs: null,
      bpm: null,
      musicalKey: null,
    },
    {
      position: 1,
      trackId: 't-1',
      rawArtist: 'SELS',
      rawTitle: 'Ancrage',
      playedAt: new Date('2026-08-14T21:02:00.000Z'),
      durationMs: 257_000,
      bpm: 132,
      musicalKey: 'F#m',
    },
  ]

  it('orders by position and keeps raw credits for rights reporting', () => {
    const serialized = serializeTracklist(entries)
    expect(serialized.map((entry) => entry.position)).toEqual([1, 2])
    expect(serialized[1].artist).toBe('Unknown')
    expect(serialized[1].track_id).toBeNull()
  })

  it('formats durations as mono clocks and leaves unknowns null', () => {
    const serialized = serializeTracklist(entries)
    expect(serialized[0].duration).toBe('04:17')
    expect(serialized[1].duration).toBeNull()
  })

  it('exposes no audio url anywhere in a tracklist entry', () => {
    // The archive must have no route to playback: 00-FOUNDATION.md §4.
    for (const entry of serializeTracklist(entries)) {
      expect(Object.keys(entry)).not.toContain('audio_url')
      expect(Object.keys(entry)).not.toContain('audioUrl')
    }
  })
})
