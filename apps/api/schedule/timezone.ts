/** Station timezone and display/ICS time helpers. France, no DST guesswork. */

export const STATION_TZ = 'Europe/Paris';

type DateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - instant.getTime();
}

/** Convert a wall-clock time in `timeZone` to an absolute instant. */
export function fromZonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const guess = new Date(utcGuess);
  const offset = tzOffsetMs(guess, timeZone);
  const instant = new Date(utcGuess - offset);
  const secondOffset = tzOffsetMs(instant, timeZone);
  if (secondOffset !== offset) {
    return new Date(utcGuess - secondOffset);
  }
  return instant;
}

export function formatParts(instant: Date, timeZone: string): DateParts {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second ?? '00',
  };
}

/** Listing date: 2026.08.20 */
export function formatListingDate(iso: string, timeZone: string): string {
  const p = formatParts(new Date(iso), timeZone);
  return `${p.year}.${p.month}.${p.day}`;
}

/** Hours and minutes: 21:00 */
export function formatTimeHm(iso: string, timeZone: string): string {
  const p = formatParts(new Date(iso), timeZone);
  return `${p.hour}:${p.minute}`;
}

export function formatTimeZoneName(iso: string, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'short',
    hour: '2-digit',
  });
  const part = dtf.formatToParts(new Date(iso)).find((p) => p.type === 'timeZoneName');
  return part?.value ?? timeZone;
}

/** Episode duration as HH:MM. */
export function formatDurationHm(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Track duration as MM:SS. */
export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

/** Elapsed / countdown / played-at offset: HH:MM:SS. */
export function formatTimecode(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function formatListeners(n: number): string {
  const clamped = Math.max(0, Math.min(9999, Math.round(n)));
  return String(clamped).padStart(4, '0');
}

export function formatIndex(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

/** ICS UTC timestamp: 20260820T190000Z */
export function formatIcsUtc(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const da = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${y}${mo}${da}T${h}${mi}${s}Z`;
}
