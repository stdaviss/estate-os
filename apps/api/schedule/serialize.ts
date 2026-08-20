/** Public episode serialiser. internal_master_key is never copied onto the result. */

export type EpisodeState =
  | 'scheduled'
  | 'live'
  | 'repeat_scheduled'
  | 'repeat_live'
  | 'expired';

export type PublicArtistRef = {
  id: string;
  slug: string;
  name: string;
};

export type PublicGenreRef = {
  id: string;
  slug: string;
  name: string;
};

export type PublicTracklistRow = {
  position: number;
  track_id: string | null;
  raw_artist: string;
  raw_title: string;
  played_at: string;
};

export type PublicEpisode = {
  id: string;
  show: {
    id: string;
    slug: string;
    title: string;
    artwork_url: string | null;
  };
  title: string | null;
  starts_at: string;
  ends_at: string;
  state: EpisodeState;
  repeat_at: string | null;
  host: PublicArtistRef | null;
  guest: PublicArtistRef | null;
  genres: PublicGenreRef[];
  duration_ms: number;
  peak_listeners: number;
  expired_at: string | null;
  artwork_url: string | null;
  tracklist?: PublicTracklistRow[];
};

type MasterKeyHolder = { internal_master_key?: unknown };

/** Drop the staff-only master recording key from any row-shaped object. */
export function omitInternalMaster<T extends MasterKeyHolder>(
  row: T,
): Omit<T, 'internal_master_key'> {
  const { internal_master_key: _omitted, ...rest } = row;
  void _omitted;
  return rest;
}

export function assertNoMasterKey(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (json.includes('internal_master')) {
    throw new Error('internal_master_key leaked into a public payload');
  }
}

export function toPublicEpisode(
  row: PublicEpisode & MasterKeyHolder,
  opts: { includeTracklist: boolean },
): PublicEpisode {
  const clean = omitInternalMaster(row);
  const duration_ms = new Date(clean.ends_at).getTime() - new Date(clean.starts_at).getTime();
  const episode: PublicEpisode = {
    id: clean.id,
    show: clean.show,
    title: clean.title,
    starts_at: clean.starts_at,
    ends_at: clean.ends_at,
    state: clean.state,
    repeat_at: clean.repeat_at,
    host: clean.host,
    guest: clean.guest,
    genres: clean.genres,
    duration_ms,
    peak_listeners: clean.peak_listeners,
    expired_at: clean.expired_at,
    artwork_url: clean.artwork_url ?? clean.show.artwork_url,
  };
  if (opts.includeTracklist && clean.tracklist) {
    episode.tracklist = clean.tracklist;
  }
  assertNoMasterKey(episode);
  return episode;
}
