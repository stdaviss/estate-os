/**
 * iCalendar (RFC 5545) generation for per-show calendar subscriptions.
 *
 * Written by hand rather than with a library because the output is small, the spec
 * requirements that actually break calendar clients are few and specific, and the three
 * that break them silently are line folding, CRLF endings and text escaping.
 *
 * Timestamps are emitted as UTC (`...Z`) form, which needs no VTIMEZONE component and is
 * converted by every client to the subscriber's own zone — the behaviour appointment
 * listening depends on.
 */

import { episodeTitle, type ScheduleEpisode } from './view-models'

const CRLF = '\r\n'
/** RFC 5545 §3.1: content lines are folded at 75 octets, excluding the line break. */
const MAX_OCTETS = 75

export interface CalendarOptions {
  /** Absolute origin, e.g. `https://example.com`, used for UIDs and event URLs. */
  siteUrl: string
  /** Shown as the calendar name in the client's sidebar. */
  calendarName: string
  calendarDescription?: string
  /** Fixed clock injection keeps output deterministic under test. */
  now?: Date
  /** Domain used for the UID right-hand side. Defaults to the site host. */
  uidDomain?: string
}

/**
 * A subscribable calendar for one show.
 *
 * Past (expired) episodes are included: they aired, and a calendar that silently drops
 * history looks broken to a subscriber. Their recording is still not available anywhere.
 */
export function buildShowCalendar(
  show: { slug: string; title: string; description: string | null },
  episodes: ScheduleEpisode[],
  options: CalendarOptions,
): string {
  const now = options.now ?? new Date()
  const host = options.uidDomain ?? safeHost(options.siteUrl)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//radio//schedule//EN',
    'CALSCALE:GREGORIAN',
    `NAME:${escapeText(options.calendarName)}`,
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
    // Tells subscribing clients how often to re-poll; without it some refresh daily.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  const description = options.calendarDescription ?? show.description
  if (description) {
    lines.push(`X-WR-CALDESC:${escapeText(description)}`)
  }

  for (const episode of [...episodes].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  )) {
    lines.push(...buildEvent(episode, show.slug, host, options.siteUrl, now))
    if (episode.repeatAt) {
      lines.push(...buildRepeatEvent(episode, show.slug, host, options.siteUrl, now))
    }
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join(CRLF) + CRLF
}

function buildEvent(
  episode: ScheduleEpisode,
  showSlug: string,
  host: string,
  siteUrl: string,
  now: Date,
): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:episode-${episode.id}@${host}`,
    `DTSTAMP:${formatUtcStamp(now)}`,
    `DTSTART:${formatUtcStamp(episode.startsAt)}`,
    `DTEND:${formatUtcStamp(episode.endsAt)}`,
    `SUMMARY:${escapeText(summaryFor(episode))}`,
    `URL:${escapeText(`${trimSlash(siteUrl)}/schedule/${episode.id}`)}`,
    `CATEGORIES:${episode.show.genres.map((genre) => escapeText(genre.name)).join(',')}`,
    // Expired episodes stay CONFIRMED: they aired. Only the recording is gone.
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'SEQUENCE:0',
  ]

  const descriptionParts: string[] = []
  if (episode.show.description) descriptionParts.push(episode.show.description)
  if (episode.guest) descriptionParts.push(`Guest: ${episode.guest.name}`)
  if (episode.show.host) descriptionParts.push(`Host: ${episode.show.host.name}`)
  descriptionParts.push(`${trimSlash(siteUrl)}/schedule/${episode.id}`)
  lines.push(`DESCRIPTION:${escapeText(descriptionParts.join('\n'))}`)

  // Empty CATEGORIES is legal but noisy; drop it rather than emit a bare property.
  const filtered = lines.filter((line) => line !== 'CATEGORIES:')
  filtered.push(`X-SHOW-SLUG:${escapeText(showSlug)}`)
  filtered.push('END:VEVENT')
  return filtered
}

/** The single permitted rebroadcast, as its own event so it can be added separately. */
function buildRepeatEvent(
  episode: ScheduleEpisode,
  showSlug: string,
  host: string,
  siteUrl: string,
  now: Date,
): string[] {
  const repeatAt = episode.repeatAt
  if (!repeatAt) return []
  const durationMs = episode.endsAt.getTime() - episode.startsAt.getTime()
  return [
    'BEGIN:VEVENT',
    `UID:episode-${episode.id}-repeat@${host}`,
    `DTSTAMP:${formatUtcStamp(now)}`,
    `DTSTART:${formatUtcStamp(repeatAt)}`,
    `DTEND:${formatUtcStamp(new Date(repeatAt.getTime() + durationMs))}`,
    `SUMMARY:${escapeText(`${summaryFor(episode)} (repeat)`)}`,
    `URL:${escapeText(`${trimSlash(siteUrl)}/schedule/${episode.id}`)}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'SEQUENCE:0',
    `X-SHOW-SLUG:${escapeText(showSlug)}`,
    'END:VEVENT',
  ]
}

function summaryFor(episode: ScheduleEpisode): string {
  const title = episodeTitle(episode)
  return episode.guest ? `${title} — ${episode.guest.name}` : title
}

/** RFC 5545 §3.3.5 UTC form: `20260820T213000Z`. */
export function formatUtcStamp(instant: Date): string {
  const iso = instant.toISOString()
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(
    14,
    16,
  )}${iso.slice(17, 19)}Z`
}

/**
 * RFC 5545 §3.3.11: backslash, semicolon and comma are escaped, newlines become `\n`.
 * Carriage returns are dropped so a CRLF in user text cannot terminate the content line.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/**
 * Folds a content line to 75 octets, counting UTF-8 bytes rather than characters and
 * never splitting a multi-byte sequence. Continuation lines begin with a single space.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= MAX_OCTETS) return line

  const segments: string[] = []
  let cursor = 0
  let budget = MAX_OCTETS
  while (cursor < bytes.length) {
    let take = Math.min(budget, bytes.length - cursor)
    // Walk back off a continuation byte so the segment stays valid UTF-8.
    while (take > 0 && cursor + take < bytes.length && (bytes[cursor + take] & 0xc0) === 0x80) {
      take -= 1
    }
    if (take <= 0) take = Math.min(budget, bytes.length - cursor)
    segments.push(bytes.subarray(cursor, cursor + take).toString('utf8'))
    cursor += take
    // Continuation lines spend one octet on the leading space.
    budget = MAX_OCTETS - 1
  }
  return segments.join(`${CRLF} `)
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function safeHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host
  } catch {
    return 'localhost'
  }
}

/** Filename offered to the browser, e.g. `dub-club.ics`. */
export function calendarFilename(showSlug: string): string {
  const safe = showSlug.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `${safe || 'schedule'}.ics`
}
