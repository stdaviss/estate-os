'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildFixtures, REFERENCE_NOW_ISO } from '../../../../api/schedule/fixtures';

export type BroadcastNow = {
  episode: {
    id: string;
    title: string | null;
    show_title: string;
    starts_at: string;
    ends_at: string;
    state: string;
    host_name: string | null;
    guest_name: string | null;
  } | null;
  track: { artist: string; title: string } | null;
  listeners: number;
  is_live: boolean;
  started_at: string | null;
};

function fromFixtures(): BroadcastNow {
  const { episodes } = buildFixtures(REFERENCE_NOW_ISO);
  const live = episodes.find((e) => e.state === 'live') ?? null;
  const next = episodes.find((e) => e.state === 'scheduled') ?? null;
  const ep = live ?? next;
  if (!ep) {
    return { episode: null, track: null, listeners: 0, is_live: false, started_at: null };
  }
  return {
    episode: {
      id: ep.id,
      title: ep.title,
      show_title: ep.show.title,
      starts_at: ep.starts_at,
      ends_at: ep.ends_at,
      state: ep.state,
      host_name: ep.host?.name ?? null,
      guest_name: ep.guest?.name ?? null,
    },
    track: null,
    listeners: live ? 341 : 0,
    is_live: Boolean(live),
    started_at: live ? ep.starts_at : null,
  };
}

function parseNow(data: unknown): BroadcastNow | null {
  if (typeof data !== 'object' || data === null) return null;
  const rec = data as Record<string, unknown>;
  const episodeRaw = rec.episode;
  let episode: BroadcastNow['episode'] = null;
  if (typeof episodeRaw === 'object' && episodeRaw !== null) {
    const ep = episodeRaw as Record<string, unknown>;
    episode = {
      id: String(ep.id ?? ''),
      title: typeof ep.title === 'string' ? ep.title : null,
      show_title: String(ep.show_title ?? ep.title ?? ''),
      starts_at: String(ep.starts_at ?? ''),
      ends_at: String(ep.ends_at ?? ''),
      state: String(ep.state ?? ''),
      host_name: typeof ep.host_name === 'string' ? ep.host_name : null,
      guest_name: typeof ep.guest_name === 'string' ? ep.guest_name : null,
    };
  }
  return {
    episode,
    track: null,
    listeners: typeof rec.listeners === 'number' ? rec.listeners : 0,
    is_live: rec.is_live === true,
    started_at: typeof rec.started_at === 'string' ? rec.started_at : null,
  };
}

/**
 * Consumes Agent A's BroadcastContext when present.
 * Otherwise polls GET /api/v1/stream/now every 20s, then falls back to schedule fixtures.
 * pauseStream / resumeStream dispatch station:transport for the player to handle.
 */
export function useBroadcast(): {
  now: BroadcastNow | null;
  status: 'loading' | 'error' | 'ready';
  retry: () => void;
  pauseStream: () => void;
  resumeStream: () => void;
} {
  const [now, setNow] = useState<BroadcastNow | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/v1/stream/now', { headers: { accept: 'application/json' } });
      if (res.ok) {
        const body: unknown = await res.json();
        const payload =
          typeof body === 'object' && body !== null && 'data' in body
            ? parseNow((body as { data: unknown }).data)
            : parseNow(body);
        if (payload) {
          setNow(payload);
          setStatus('ready');
          return;
        }
      }
      setNow(fromFixtures());
      setStatus('ready');
    } catch {
      setNow(fromFixtures());
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const pauseStream = useCallback(() => {
    window.dispatchEvent(new CustomEvent('station:transport', { detail: { action: 'pause', source: 'play' } }));
  }, []);
  const resumeStream = useCallback(() => {
    window.dispatchEvent(new CustomEvent('station:transport', { detail: { action: 'resume', source: 'play' } }));
  }, []);

  return { now, status, retry: () => void load(), pauseStream, resumeStream };
}

export function emptyBroadcast(): BroadcastNow {
  return { episode: null, track: null, listeners: 0, is_live: false, started_at: null };
}
