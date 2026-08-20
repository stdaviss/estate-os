'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Data, EmptyState } from '../schedule/_lib/ui';
import { useBroadcast } from '../schedule/_lib/broadcast';
import { isEmptyMode } from '../schedule/_lib/mode';
import { WHICH_MIX_PAIR } from '../../../api/games/store';

function sessionKey(): string {
  if (typeof window === 'undefined') return 'ssr';
  const existing = window.sessionStorage.getItem('station-session');
  if (existing) return existing;
  const created = `s-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem('station-session', created);
  return created;
}

export function PlayScreen({ empty }: { empty: boolean }) {
  const broadcast = useBroadcast();
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);
  const [split, setSplit] = useState({ a: 0, b: 0, total: 0 });
  const [voted, setVoted] = useState<'a' | 'b' | null>(null);
  const [status, setStatus] = useState<'ready' | 'error'>('ready');
  const [playing, setPlaying] = useState<'a' | 'b' | null>(null);

  useEffect(() => {
    if (empty) return;
    broadcast.pauseStream();
    void post('start', {});
    return () => broadcast.resumeStream();
    // pause/resume once on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only
  }, []);

  async function post(event_type: string, payload: Record<string, unknown>) {
    try {
      const res = await fetch('/api/v1/games/which-mix/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_type, session_key: sessionKey(), payload }),
      });
      if (!res.ok) throw new Error('event failed');
      const body = (await res.json()) as { data: { split: { a: number; b: number; total: number } } };
      setSplit(body.data.split);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  function play(which: 'a' | 'b') {
    const a = audioA.current;
    const b = audioB.current;
    if (!a || !b) return;
    if (which === 'a') {
      void b.pause();
      void a.play();
    } else {
      void a.pause();
      void b.play();
    }
    setPlaying(which);
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === '1') play('a');
    if (e.key === '2') play('b');
    if (e.key === 'a' || e.key === 'A') void vote('a');
    if (e.key === 'b' || e.key === 'B') void vote('b');
  }

  async function vote(choice: 'a' | 'b') {
    setVoted(choice);
    await post('vote', { choice, pair_id: WHICH_MIX_PAIR.id });
  }

  if (empty || isEmptyMode()) {
    return (
      <main className="c-page">
        <header className="c-page-head">
          <h1 className="c-display-l">Which mix</h1>
        </header>
        <EmptyState
          label="Which mix"
          action={
            <Button variant="primary" href="/submit">
              Send a mix
            </Button>
          }
        >
          No tracks to compare yet. Send us a mix and it might end up here.
        </EmptyState>
      </main>
    );
  }

  const pctA = split.total === 0 ? 0 : Math.round((split.a / split.total) * 100);
  const pctB = split.total === 0 ? 0 : 100 - pctA;

  return (
    <main className="c-page" onKeyDown={onKey}>
      <header className="c-page-head">
        <h1 className="c-display-l">Which mix</h1>
        <Data>{WHICH_MIX_PAIR.artist_name}</Data>
      </header>
      <p className="c-body-l" style={{ maxWidth: '36em' }}>
        Two cuts of {WHICH_MIX_PAIR.title}. Play A, play B, vote. The stream is paused while you are here.
      </p>
      {status === 'error' && (
        <div className="c-status">
          The vote did not record. Try again.
          <div className="c-retry">
            <Button variant="primary" onClick={() => void post('start', {})}>
              Retry
            </Button>
          </div>
        </div>
      )}
      <div className="c-mix">
        <div className="c-mix-pane">
          <div className="c-label">A · {WHICH_MIX_PAIR.a.label}</div>
          <h2 className="c-display-m" style={{ margin: '12px 0' }}>
            {WHICH_MIX_PAIR.title}
          </h2>
          <audio ref={audioA} src={WHICH_MIX_PAIR.a.audio_url} onEnded={() => setPlaying(null)} />
          <Button variant={playing === 'a' ? 'primary' : 'ghost'} onClick={() => play('a')}>
            Play A
          </Button>
          <Button onClick={() => void vote('a')}>Vote A</Button>
        </div>
        <div className="c-mix-pane">
          <div className="c-label">B · {WHICH_MIX_PAIR.b.label}</div>
          <h2 className="c-display-m" style={{ margin: '12px 0' }}>
            {WHICH_MIX_PAIR.title}
          </h2>
          <audio ref={audioB} src={WHICH_MIX_PAIR.b.audio_url} onEnded={() => setPlaying(null)} />
          <Button variant={playing === 'b' ? 'primary' : 'ghost'} onClick={() => play('b')}>
            Play B
          </Button>
          <Button onClick={() => void vote('b')}>Vote B</Button>
        </div>
      </div>
      <div className="c-split">
        <div>
          <div className="c-label">A</div>
          <div className="c-display-l">
            <Data>{String(pctA).padStart(2, '0')}%</Data>
          </div>
        </div>
        <div>
          <div className="c-label">B</div>
          <div className="c-display-l">
            <Data>{String(pctB).padStart(2, '0')}%</Data>
          </div>
        </div>
      </div>
      {voted && <p className="c-body-s">You voted {voted.toUpperCase()}.</p>}
      <p className="c-body-s">Keys: 1 play A, 2 play B, A vote A, B vote B.</p>
    </main>
  );
}
