/** In-memory game_events store. No leaderboards, streaks, or points. */

export type GameEvent = {
  id: string;
  user_id: string | null;
  session_key: string;
  game_slug: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const events: GameEvent[] = [];
let seq = 1;

export function resetGameEvents(): void {
  events.splice(0, events.length);
  seq = 1;
}

export function addGameEvent(row: Omit<GameEvent, 'id' | 'created_at'>): GameEvent {
  const stored: GameEvent = {
    ...row,
    id: `ge-${String(seq).padStart(4, '0')}`,
    created_at: new Date().toISOString(),
  };
  seq += 1;
  events.push(stored);
  return stored;
}

export function listGameEvents(gameSlug: string): GameEvent[] {
  return events.filter((e) => e.game_slug === gameSlug);
}

export type MixPair = {
  id: string;
  title: string;
  artist_name: string;
  a: { id: string; label: string; audio_url: string };
  b: { id: string; label: string; audio_url: string };
};

export const WHICH_MIX_PAIR: MixPair = {
  id: 'pair-dock-lights',
  title: 'Dock Lights',
  artist_name: 'Dock 12',
  a: {
    id: 'trk-a',
    label: 'dub cut',
    audio_url: '/play/media/mix-a.wav',
  },
  b: {
    id: 'trk-b',
    label: 'peak cut',
    audio_url: '/play/media/mix-b.wav',
  },
};

export function voteSplit(pairId: string): { a: number; b: number; total: number } {
  const votes = events.filter(
    (e) =>
      e.game_slug === 'which-mix' &&
      e.event_type === 'vote' &&
      e.payload.pair_id === pairId,
  );
  let a = 0;
  let b = 0;
  for (const v of votes) {
    if (v.payload.choice === 'a') a += 1;
    if (v.payload.choice === 'b') b += 1;
  }
  return { a, b, total: a + b };
}
