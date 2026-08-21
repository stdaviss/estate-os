import { describe, expect, it } from 'vitest'

import { buildShowCalendar, calendarFilename, escapeText, foldLine, formatUtcStamp } from './ics'
import type { ScheduleEpisode, ShowRef } from './view-models'

const show: ShowRef = {
  id: 'show-1',
  slug: 'nuit-blanche',
  title: 'Nuit Blanche',
  description: 'Late transmissions from the port.',
  artworkUrl: null,
  host: { id: 'a-1', slug: 'lha', name: 'LHA', relationship: 'affiliate' },
  genres: [{ id: 'g-1', slug: 'dub-techno', name: 'Dub techno', parentId: null }],
}

const episodes: ScheduleEpisode[] = [
  {
    id: 'ep-1',
    show,
    title: null,
    guest: { id: 'a-2', slug: 'sels', name: 'SELS', relationship: 'guest' },
    startsAt: new Date('2026-08-20T21:00:00.000Z'),
    endsAt: new Date('2026-08-20T23:00:00.000Z'),
    state: 'scheduled',
    repeatAt: new Date('2026-08-23T13:00:00.000Z'),
    peakListeners: 0,
    expiredAt: null,
  },
  {
    id: 'ep-0',
    show,
    title: 'Nuit Blanche 011',
    guest: null,
    startsAt: new Date('2026-08-13T21:00:00.000Z'),
    endsAt: new Date('2026-08-13T23:00:00.000Z'),
    state: 'expired',
    repeatAt: null,
    peakListeners: 341,
    expiredAt: new Date('2026-08-14T21:00:00.000Z'),
  },
]

const options = {
  siteUrl: 'https://example.test',
  calendarName: 'Nuit Blanche',
  now: new Date('2026-08-19T09:00:00.000Z'),
}

/** Reverses RFC 5545 folding: a CRLF followed by one space or tab is a continuation. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n').filter((line) => line.length > 0)
}

describe('calendar structure', () => {
  const ics = buildShowCalendar(show, episodes, options)
  const lines = unfold(ics)

  it('opens and closes the calendar and declares version and prodid', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines.some((line) => line.startsWith('PRODID:'))).toBe(true)
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR')
  })

  it('uses CRLF line endings throughout and ends with one', () => {
    expect(ics.endsWith('\r\n')).toBe(true)
    // No bare LF anywhere: a lone newline is the most common reason a client rejects a file.
    expect(/[^\r]\n/.test(ics)).toBe(false)
  })

  it('balances every VEVENT', () => {
    const begins = lines.filter((line) => line === 'BEGIN:VEVENT').length
    const ends = lines.filter((line) => line === 'END:VEVENT').length
    expect(begins).toBe(ends)
    // Two episodes plus the single permitted rebroadcast.
    expect(begins).toBe(3)
  })

  it('emits every required event property', () => {
    for (const property of ['UID:', 'DTSTAMP:', 'DTSTART:', 'DTEND:', 'SUMMARY:']) {
      expect(lines.filter((line) => line.startsWith(property)).length).toBe(3)
    }
  })

  it('emits UTC timestamps so clients convert to the subscriber zone', () => {
    expect(lines).toContain('DTSTART:20260820T210000Z')
    expect(lines).toContain('DTEND:20260820T230000Z')
    expect(lines).toContain('DTSTAMP:20260819T090000Z')
  })

  it('gives every event a unique stable uid', () => {
    const uids = lines.filter((line) => line.startsWith('UID:'))
    expect(new Set(uids).size).toBe(uids.length)
    expect(uids).toContain('UID:episode-ep-1@example.test')
    expect(uids).toContain('UID:episode-ep-1-repeat@example.test')
  })

  it('orders events chronologically regardless of input order', () => {
    const starts = lines.filter((line) => line.startsWith('DTSTART:'))
    expect(starts[0]).toBe('DTSTART:20260813T210000Z')
  })

  it('includes past episodes, which aired even though the recording is gone', () => {
    expect(lines).toContain('SUMMARY:Nuit Blanche 011')
  })

  it('bills the guest in the summary', () => {
    expect(lines).toContain('SUMMARY:Nuit Blanche — SELS')
  })

  it('gives the repeat its own event, offset and labelled', () => {
    expect(lines).toContain('DTSTART:20260823T130000Z')
    expect(lines).toContain('DTEND:20260823T150000Z')
    expect(lines).toContain('SUMMARY:Nuit Blanche — SELS (repeat)')
  })

  it('sets a refresh interval so subscriptions stay current', () => {
    expect(lines).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H')
    expect(lines).toContain('X-PUBLISHED-TTL:PT1H')
  })

  it('never emits a property with an empty value', () => {
    const bare = lines.filter((line) => /^[A-Z-]+(;[^:]*)?:$/.test(line))
    expect(bare).toEqual([])
  })
})

describe('text escaping', () => {
  it('escapes the four characters that break a content line', () => {
    expect(escapeText('a,b')).toBe('a\\,b')
    expect(escapeText('a;b')).toBe('a\\;b')
    expect(escapeText('a\\b')).toBe('a\\\\b')
    expect(escapeText('a\nb')).toBe('a\\nb')
    expect(escapeText('a\r\nb')).toBe('a\\nb')
  })

  it('escapes the backslash before anything else, so it is not double-counted', () => {
    expect(escapeText('50%\\,')).toBe('50%\\\\\\,')
  })

  it('carries a comma in a title through to the file without ending the value', () => {
    const commaShow = { ...show, title: 'Salt, Iron' }
    const ics = buildShowCalendar(
      commaShow,
      [{ ...episodes[0], show: { ...show, title: 'Salt, Iron' } }],
      { ...options, calendarName: 'Salt, Iron' },
    )
    expect(unfold(ics)).toContain('SUMMARY:Salt\\, Iron — SELS')
    expect(unfold(ics)).toContain('X-WR-CALNAME:Salt\\, Iron')
  })
})

describe('line folding', () => {
  it('leaves a short line alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds at 75 octets with a single leading space on continuations', () => {
    const folded = foldLine(`SUMMARY:${'a'.repeat(200)}`)
    const segments = folded.split('\r\n')
    expect(segments.length).toBeGreaterThan(1)
    expect(Buffer.from(segments[0], 'utf8').length).toBe(75)
    for (const segment of segments.slice(1)) {
      expect(segment.startsWith(' ')).toBe(true)
      expect(Buffer.from(segment, 'utf8').length).toBeLessThanOrEqual(75)
    }
  })

  it('unfolds back to the original', () => {
    const original = `DESCRIPTION:${'x'.repeat(300)}`
    expect(foldLine(original).replace(/\r\n /g, '')).toBe(original)
  })

  it('counts octets not characters, and never splits a multi-byte character', () => {
    // Accented and CJK characters are multi-byte; a naive 75-character fold corrupts them.
    const original = `SUMMARY:${'é'.repeat(60)}${'東'.repeat(20)}`
    const folded = foldLine(original)
    for (const segment of folded.split('\r\n')) {
      expect(Buffer.from(segment, 'utf8').length).toBeLessThanOrEqual(75)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(original)
    expect(folded).not.toContain('\uFFFD')
  })

  it('folds long lines inside a generated calendar', () => {
    const longShow = { ...show, description: 'A very long description. '.repeat(12) }
    const ics = buildShowCalendar(longShow, [{ ...episodes[0], show: longShow }], options)
    expect(ics).toContain('\r\n ')
    for (const line of ics.split('\r\n')) {
      expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75)
    }
  })
})

describe('helpers', () => {
  it('formats a UTC stamp with no separators', () => {
    expect(formatUtcStamp(new Date('2026-08-20T21:00:00.000Z'))).toBe('20260820T210000Z')
  })

  it('builds a safe filename', () => {
    expect(calendarFilename('nuit-blanche')).toBe('nuit-blanche.ics')
    expect(calendarFilename('../../etc/passwd')).toBe('------etc-passwd.ics')
    expect(calendarFilename('')).toBe('schedule.ics')
  })

  it('produces a valid empty calendar when a show has no episodes', () => {
    const ics = buildShowCalendar(show, [], options)
    expect(unfold(ics)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//radio//schedule//EN',
      'CALSCALE:GREGORIAN',
      'NAME:Nuit Blanche',
      'X-WR-CALNAME:Nuit Blanche',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      'X-WR-CALDESC:Late transmissions from the port.',
      'END:VCALENDAR',
    ])
  })
})
