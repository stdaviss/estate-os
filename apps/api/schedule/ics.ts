/** ICS feed for a show. One VEVENT per upcoming scheduled episode. */

import { formatIcsUtc } from './timezone';

export type IcsEpisode = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  showTitle: string;
  hostName: string | null;
  guestName: string | null;
};

function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return chunks.join('\r\n');
}

function text(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function eventBlock(ep: IcsEpisode, calDomain: string): string {
  const summary = ep.title ?? ep.showTitle;
  const who = [ep.hostName, ep.guestName].filter(Boolean).join(' with ');
  const description = who ? `${ep.showTitle}. ${who}.` : ep.showTitle;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${ep.id}@${calDomain}`,
    `DTSTAMP:${formatIcsUtc(new Date().toISOString())}`,
    `DTSTART:${formatIcsUtc(ep.starts_at)}`,
    `DTEND:${formatIcsUtc(ep.ends_at)}`,
    `SUMMARY:${text(summary)}`,
    `DESCRIPTION:${text(description)}`,
    'END:VEVENT',
  ];
  return lines.map(fold).join('\r\n');
}

export function buildShowCalendar(opts: {
  showSlug: string;
  showTitle: string;
  episodes: IcsEpisode[];
  calDomain?: string;
}): string {
  const calDomain = opts.calDomain ?? 'station.local';
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//station//schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${text(opts.showTitle)}`),
    'X-WR-TIMEZONE:Europe/Paris',
  ];
  const events = opts.episodes.map((ep) => eventBlock(ep, calDomain));
  return `${header.join('\r\n')}\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
}
