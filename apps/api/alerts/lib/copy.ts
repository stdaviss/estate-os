/**
 * Notification copy.
 *
 * "What is on, who, when in their timezone, one link" (05-AGENT-C §C3), in the voice from
 * 00-FOUNDATION.md §10: plain, lower-case-friendly, no marketing language, no exclamation
 * marks. Rendered as text here so the wording is reviewable and testable in one place
 * rather than embedded in a mail template.
 */

import {
  formatClock,
  formatDateStamp,
  formatOffsetLabel,
  STATION_TIMEZONE,
} from '../../schedule/lib/time'
import { episodeTitle, type ScheduleEpisode } from '../../schedule/lib/view-models'
import type { PlannedNotification } from './matching'
import type { ResolvedTimeZone } from './recipient-timezone'

export interface NotificationCopy {
  subject: string
  /** Plain-text body. One link, at the end, plus the unsubscribe line. */
  body: string
  /** Shown as the web-push title; the body is the push body. */
  pushTitle: string
  pushBody: string
  episodeUrl: string
  unsubscribeUrl: string
}

export interface CopyInput {
  episode: ScheduleEpisode
  notification: PlannedNotification
  zone: ResolvedTimeZone
  siteUrl: string
  unsubscribeUrl: string
}

export function buildNotificationCopy(input: CopyInput): NotificationCopy {
  const { episode, zone, siteUrl } = input
  const title = episodeTitle(episode)
  const who = billing(episode)
  const localTime = formatClock(episode.startsAt, zone.timeZone)
  const localDate = formatDateStamp(episode.startsAt, zone.timeZone)
  const zoneLabel = zoneLabelFor(episode, zone)
  const episodeUrl = `${siteUrl.replace(/\/+$/, '')}/schedule/${episode.id}`

  const when = `${localDate} at ${localTime} ${zoneLabel}`

  const lines: string[] = [
    `${title}${who ? ` with ${who}` : ''} starts at ${localTime}.`,
    '',
    when,
    stationLine(episode, zone),
    '',
    episodeUrl,
  ].filter((line): line is string => line !== null)

  return {
    subject: `${title} — ${localTime} ${zoneLabel}`,
    body: `${lines.join('\n')}\n\nStop these alerts: ${input.unsubscribeUrl}\n`,
    pushTitle: `${title} — ${localTime}`,
    pushBody: who ? `with ${who}. ${localDate} ${zoneLabel}.` : `${localDate} ${zoneLabel}.`,
    episodeUrl,
    unsubscribeUrl: input.unsubscribeUrl,
  }
}

/** Who is on: guest first, since that is what a listener recognises, then host. */
function billing(episode: ScheduleEpisode): string | null {
  if (episode.guest) return episode.guest.name
  if (episode.show.host) return episode.show.host.name
  return null
}

/**
 * A guessed zone is never presented as if it were the reader's own. When confidence is
 * only the station default the label says so, so nobody misses a show because we implied
 * a conversion we had not made.
 */
function zoneLabelFor(episode: ScheduleEpisode, zone: ResolvedTimeZone): string {
  const offset = formatOffsetLabel(episode.startsAt, zone.timeZone)
  if (zone.confidence === 'station_default') return `${offset} (station time)`
  return offset
}

/** Station time alongside, unless the reader is already in it. */
function stationLine(episode: ScheduleEpisode, zone: ResolvedTimeZone): string | null {
  if (zone.timeZone === STATION_TIMEZONE) return null
  const stationTime = formatClock(episode.startsAt, STATION_TIMEZONE)
  const stationDate = formatDateStamp(episode.startsAt, STATION_TIMEZONE)
  return `${stationDate} at ${stationTime} ${formatOffsetLabel(
    episode.startsAt,
    STATION_TIMEZONE,
  )} in Marseille`
}

/**
 * RFC 8058 headers so a mail client can offer its own unsubscribe button and a
 * one-click POST is honoured without opening a browser.
 */
export function unsubscribeHeaders(unsubscribeLink: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeLink}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
