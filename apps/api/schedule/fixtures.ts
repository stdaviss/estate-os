/** Deterministic fixture set shaped like the Agent B seed. Used when schema/db is absent. */

import { fromZonedTime, STATION_TZ } from './timezone';
import type { EpisodeState, PublicEpisode, PublicTracklistRow } from './serialize';

export const REFERENCE_NOW_ISO = '2026-08-20T19:00:00.000Z'; // 21:00 CEST, Thursday

function id(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export type FixtureShow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  artwork_url: string;
  host_id: string;
  genre_ids: string[];
};

export type FixtureArtist = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  relationship: 'guest' | 'affiliate' | 'roster' | 'alumni';
};

export type FixtureGenre = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
};

export const genres: FixtureGenre[] = [
  { id: id(101), slug: 'techno', name: 'Techno', parent_id: null },
  { id: id(102), slug: 'dub-techno', name: 'Dub techno', parent_id: id(101) },
  { id: id(103), slug: 'hard-groove', name: 'Hard groove', parent_id: id(101) },
  { id: id(104), slug: 'house', name: 'House', parent_id: null },
  { id: id(105), slug: 'deep-house', name: 'Deep house', parent_id: id(104) },
  { id: id(106), slug: 'electro', name: 'Electro', parent_id: id(104) },
  { id: id(107), slug: 'ambient', name: 'Ambient', parent_id: null },
  { id: id(108), slug: 'industrial', name: 'Industrial', parent_id: null },
  { id: id(109), slug: 'broken', name: 'Broken beat', parent_id: null },
  { id: id(110), slug: 'leftfield', name: 'Leftfield', parent_id: null },
  { id: id(111), slug: 'garage', name: 'Garage', parent_id: null },
  { id: id(112), slug: 'wave', name: 'Wave', parent_id: null },
  { id: id(113), slug: 'drone', name: 'Drone', parent_id: null },
  { id: id(114), slug: 'acid', name: 'Acid', parent_id: id(101) },
];

export const artists: FixtureArtist[] = [
  { id: id(201), slug: 'palais-gris', name: 'Palais Gris', city: 'Marseille', country: 'FR', relationship: 'affiliate' },
  { id: id(202), slug: 'dock-12', name: 'Dock 12', city: 'Marseille', country: 'FR', relationship: 'roster' },
  { id: id(203), slug: 'nour-el-kasbah', name: 'Nour El-Kasbah', city: 'Tunis', country: 'TN', relationship: 'guest' },
  { id: id(204), slug: 'lina-vado', name: 'Lina Vado', city: 'Barcelona', country: 'ES', relationship: 'guest' },
  { id: id(205), slug: 'kerkennah', name: 'Kerkennah', city: 'Sfax', country: 'TN', relationship: 'guest' },
  { id: id(206), slug: 'salt-office', name: 'Salt Office', city: 'Algiers', country: 'DZ', relationship: 'affiliate' },
  { id: id(207), slug: 'via-blanque', name: 'Via Blanque', city: 'Naples', country: 'IT', relationship: 'guest' },
  { id: id(208), slug: 'cidre-noir', name: 'Cidre Noir', city: 'Rennes', country: 'FR', relationship: 'guest' },
  { id: id(209), slug: 'rada-quay', name: 'Rada Quay', city: 'Valletta', country: 'MT', relationship: 'guest' },
  { id: id(210), slug: 'hull-sister', name: 'Hull Sister', city: 'Marseille', country: 'FR', relationship: 'guest' },
  { id: id(211), slug: 'orion-mole', name: 'Orion Mole', city: 'Athens', country: 'GR', relationship: 'guest' },
  { id: id(212), slug: 'tin-roof', name: 'Tin Roof', city: 'Beirut', country: 'LB', relationship: 'guest' },
];

export const shows: FixtureShow[] = [
  {
    id: id(301),
    slug: 'harbour-frequency',
    title: 'Harbour Frequency',
    description: 'Thursday night from the Vieux-Port. Palais Gris hosts, guests bring a crate.',
    artwork_url: '/artwork/harbour-frequency.svg',
    host_id: id(201),
    genre_ids: [id(101), id(102)],
  },
  {
    id: id(302),
    slug: 'sodium-nights',
    title: 'Sodium Nights',
    description: 'Late Friday. Harder records, still a port city.',
    artwork_url: '/artwork/sodium-nights.svg',
    host_id: id(202),
    genre_ids: [id(101), id(103)],
  },
  {
    id: id(303),
    slug: 'port-mix',
    title: 'Port Mix',
    description: 'Saturday afternoon. House, electro, records that travel.',
    artwork_url: '/artwork/port-mix.svg',
    host_id: id(206),
    genre_ids: [id(104), id(105), id(106)],
  },
  {
    id: id(304),
    slug: 'brine-hour',
    title: 'Brine Hour',
    description: 'Sunday. Ambient, drone, the quiet after the night.',
    artwork_url: '/artwork/brine-hour.svg',
    host_id: id(210),
    genre_ids: [id(107), id(113)],
  },
  {
    id: id(305),
    slug: 'after-hull',
    title: 'After Hull',
    description: 'Wednesday close. Industrial and wave.',
    artwork_url: '/artwork/after-hull.svg',
    host_id: id(208),
    genre_ids: [id(108), id(112)],
  },
  {
    id: id(306),
    slug: 'guest-slot',
    title: 'Guest Slot',
    description: 'Whoever sent a mix that week.',
    artwork_url: '/artwork/guest-slot.svg',
    host_id: id(202),
    genre_ids: [id(110), id(101)],
  },
];

type Slot = { weekday: number; hour: number; durationHours: number; showIndex: number };

const WEEKLY: Slot[] = [
  { weekday: 0, hour: 16, durationHours: 2, showIndex: 3 }, // Sun Brine Hour
  { weekday: 1, hour: 21, durationHours: 2, showIndex: 5 }, // Mon Guest Slot
  { weekday: 2, hour: 20, durationHours: 2, showIndex: 5 }, // Tue Guest Slot
  { weekday: 3, hour: 22, durationHours: 2, showIndex: 4 }, // Wed After Hull
  { weekday: 4, hour: 21, durationHours: 2, showIndex: 0 }, // Thu Harbour Frequency
  { weekday: 5, hour: 23, durationHours: 2, showIndex: 1 }, // Fri Sodium Nights
  { weekday: 6, hour: 18, durationHours: 2, showIndex: 2 }, // Sat Port Mix
  { weekday: 6, hour: 21, durationHours: 2, showIndex: 5 }, // Sat Guest Slot
];

const GUEST_ROTATION = [
  id(203), id(204), id(205), id(207), id(209), id(211), id(212), id(203),
];

const TRACK_NAMES = [
  ['Dry Dock', 'Tin Roof', 'Sodium Cut', 'Hull Plate', 'Night Slip'],
  ['Quay 4', 'Brine Dub', 'Wire Fence', 'Low Tide', 'Stairwell'],
  ['Crate 12', 'Amber Deck', 'Port Light', 'Salt Room', 'After Image'],
  ['Mole End', 'Flat Water', 'Engine Room', 'Closed Gate', 'Second Wave'],
];

function artistById(artistId: string): FixtureArtist {
  const found = artists.find((a) => a.id === artistId);
  if (!found) throw new Error(`unknown artist ${artistId}`);
  return found;
}

function showByIndex(i: number): FixtureShow {
  const show = shows[i];
  if (!show) throw new Error(`unknown show index ${i}`);
  return show;
}

function genreRefs(genreIds: string[]) {
  return genreIds.map((gid) => {
    const g = genres.find((x) => x.id === gid);
    if (!g) throw new Error(`unknown genre ${gid}`);
    return { id: g.id, slug: g.slug, name: g.name };
  });
}

function publicArtist(artistId: string | null) {
  if (!artistId) return null;
  const a = artistById(artistId);
  return { id: a.id, slug: a.slug, name: a.name };
}

function datesBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function weekdayInParis(utcMidnightish: Date): number {
  const wall = fromZonedTime(
    utcMidnightish.getUTCFullYear(),
    utcMidnightish.getUTCMonth() + 1,
    utcMidnightish.getUTCDate(),
    12,
    0,
    STATION_TZ,
  );
  // Use Paris date parts via the noon instant
  const parisNoon = wall;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: STATION_TZ, weekday: 'short' }).format(parisNoon);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[day] ?? 0;
}

function parisYmd(instant: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: STATION_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = fmt.format(instant).split('-').map(Number);
  return { y: y ?? 2026, m: m ?? 1, d: d ?? 1 };
}

function buildTracklist(episodeId: string, startsAt: Date, seed: number): PublicTracklistRow[] {
  const rows: PublicTracklistRow[] = [];
  let elapsed = 12 * 1000;
  const count = 8 + (seed % 5);
  for (let i = 0; i < count; i += 1) {
    const artist = artists[(seed + i) % artists.length];
    const titles = TRACK_NAMES[(seed + i) % TRACK_NAMES.length];
    const title = titles[(i + seed) % titles.length];
    if (!artist || !title) continue;
    rows.push({
      position: i + 1,
      track_id: i % 3 === 0 ? id(400 + seed + i) : null,
      raw_artist: artist.name,
      raw_title: title,
      played_at: new Date(startsAt.getTime() + elapsed).toISOString(),
    });
    elapsed += (6 * 60 + ((seed + i) % 4) * 60) * 1000;
  }
  void episodeId;
  return rows;
}

export type FixtureEpisode = PublicEpisode & { internal_master_key: string | null };

function stateFor(starts: Date, ends: Date, now: Date): EpisodeState {
  if (now.getTime() >= starts.getTime() && now.getTime() < ends.getTime()) return 'live';
  if (ends.getTime() <= now.getTime()) return 'expired';
  return 'scheduled';
}

export function buildFixtures(nowIso = REFERENCE_NOW_ISO): {
  now: Date;
  episodes: FixtureEpisode[];
} {
  const now = new Date(nowIso);
  const start = fromZonedTime(2026, 8, 6, 0, 0, STATION_TZ);
  const end = fromZonedTime(2026, 9, 3, 23, 0, STATION_TZ);
  const days = datesBetween(start, end);
  const episodes: FixtureEpisode[] = [];
  let n = 0;

  for (const day of days) {
    const ymd = parisYmd(day);
    const wd = weekdayInParis(day);
    const slots = WEEKLY.filter((s) => s.weekday === wd);
    for (const slot of slots) {
      n += 1;
      const show = showByIndex(slot.showIndex);
      const starts = fromZonedTime(ymd.y, ymd.m, ymd.d, slot.hour, 0, STATION_TZ);
      const ends = new Date(starts.getTime() + slot.durationHours * 3600 * 1000);
      const guestId = GUEST_ROTATION[n % GUEST_ROTATION.length] ?? null;
      const state = stateFor(starts, ends, now);
      const expired = state === 'expired';
      const epId = id(500 + n);
      const tracklist = expired ? buildTracklist(epId, starts, n) : undefined;
      const host = publicArtist(show.host_id);
      const guest = publicArtist(guestId);
      episodes.push({
        id: epId,
        show: {
          id: show.id,
          slug: show.slug,
          title: show.title,
          artwork_url: show.artwork_url,
        },
        title: guest ? `${show.title} with ${guest.name}` : show.title,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        state,
        repeat_at: null,
        host,
        guest,
        genres: genreRefs(show.genre_ids),
        duration_ms: ends.getTime() - starts.getTime(),
        peak_listeners: expired ? 180 + ((n * 17) % 800) : 0,
        expired_at: expired ? ends.toISOString() : null,
        artwork_url: show.artwork_url,
        tracklist,
        internal_master_key: expired ? `masters/${epId}.flac` : null,
      });
    }
  }

  return { now, episodes };
}

export function isEmptyMode(env: NodeJS.ProcessEnv = process.env, url?: URL): boolean {
  if (env.EMPTY === '1') return true;
  if (url?.searchParams.get('empty') === '1') return true;
  return false;
}

export function episodesInRange(
  episodes: FixtureEpisode[],
  fromIso: string,
  toIso: string,
): FixtureEpisode[] {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return episodes.filter((ep) => {
    const start = new Date(ep.starts_at).getTime();
    return start >= from && start <= to;
  });
}

export function defaultScheduleWindow(now: Date): { from: string; to: string } {
  const start = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const from = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59));
  return { from: from.toISOString(), to: to.toISOString() };
}
