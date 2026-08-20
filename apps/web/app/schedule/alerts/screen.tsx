'use client';

import { useMemo, useState } from 'react';
import { Button, EmptyState, Field } from '../../schedule/_lib/ui';
import { artists, genres } from '../../../../api/schedule/fixtures';

export type AlertRow = {
  id: string;
  genre_id: string | null;
  artist_id: string | null;
  channel: 'email' | 'web_push';
  lead_time_minutes: number;
};

export function AlertsScreen({
  initial,
  empty,
}: {
  initial: AlertRow[];
  empty: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [status, setStatus] = useState<'ready' | 'error'>('ready');
  const search = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const [genreId, setGenreId] = useState(search.get('genre_id') ?? genres[0]?.id ?? '');
  const [artistId, setArtistId] = useState('');
  const [channel, setChannel] = useState<'email' | 'web_push'>('email');
  const [lead, setLead] = useState(60);

  async function createAlert() {
    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'listener-dev',
        },
        body: JSON.stringify({
          genre_id: artistId ? null : genreId || null,
          artist_id: artistId || null,
          channel,
          lead_time_minutes: lead,
        }),
      });
      const body = (await res.json()) as { data?: AlertRow; error?: { message: string } };
      if (!res.ok || !body.data) throw new Error(body.error?.message ?? 'Could not set the alert.');
      setRows((prev) => [body.data as AlertRow, ...prev]);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/v1/alerts?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': 'listener-dev' },
    });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (empty && rows.length === 0) {
    return (
      <main className="c-page">
        <header className="c-page-head">
          <h1 className="c-display-l">Alerts</h1>
        </header>
        <EmptyState label="Alerts" action={<Button variant="primary" href="#choose">Choose genres</Button>}>
          Pick the genres you care about and we&apos;ll tell you when they&apos;re scheduled. That&apos;s the only thing we&apos;ll use it for.
        </EmptyState>
        <AlertForm
          genreId={genreId}
          setGenreId={setGenreId}
          artistId={artistId}
          setArtistId={setArtistId}
          channel={channel}
          setChannel={setChannel}
          lead={lead}
          setLead={setLead}
          onSubmit={createAlert}
        />
      </main>
    );
  }

  return (
    <main className="c-page">
      <header className="c-page-head">
        <h1 className="c-display-l">Alerts</h1>
      </header>
      <p className="c-body-s" style={{ marginBottom: 24 }}>
        We only use this to tell you when something you asked for is about to air. Lists stay in schedule order — nothing is rearranged for you.
      </p>
      {status === 'error' && (
        <div className="c-status">
          The alert was not saved. Check you are signed in and try again.
          <div className="c-retry">
            <Button variant="primary" onClick={createAlert}>Retry</Button>
          </div>
        </div>
      )}
      <AlertForm
        genreId={genreId}
        setGenreId={setGenreId}
        artistId={artistId}
        setArtistId={setArtistId}
        channel={channel}
        setChannel={setChannel}
        lead={lead}
        setLead={setLead}
        onSubmit={createAlert}
      />
      {rows.length === 0 ? (
        <EmptyState label="Alerts" action={<Button variant="primary" href="#choose">Choose genres</Button>}>
          Pick the genres you care about and we&apos;ll tell you when they&apos;re scheduled. That&apos;s the only thing we&apos;ll use it for.
        </EmptyState>
      ) : (
        <ul className="c-list-plain">
          {rows.map((row) => (
            <li key={row.id} className="c-ep">
              <div className="c-ep-title">
                <div className="c-display-m">
                  {labelFor(row)}
                </div>
                <div className="c-body-s">
                  {row.channel} · {row.lead_time_minutes} min before
                </div>
              </div>
              <Button onClick={() => void remove(row.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function labelFor(row: AlertRow): string {
  const g = genres.find((x) => x.id === row.genre_id);
  const a = artists.find((x) => x.id === row.artist_id);
  return g?.name ?? a?.name ?? 'Alert';
}

function AlertForm(props: {
  genreId: string;
  setGenreId: (v: string) => void;
  artistId: string;
  setArtistId: (v: string) => void;
  channel: 'email' | 'web_push';
  setChannel: (v: 'email' | 'web_push') => void;
  lead: number;
  setLead: (v: number) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      id="choose"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <Field label="Genre">
        <select value={props.genreId} onChange={(e) => props.setGenreId(e.target.value)}>
          <option value="">None</option>
          {genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Artist">
        <select value={props.artistId} onChange={(e) => props.setArtistId(e.target.value)}>
          <option value="">None</option>
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Channel">
        <select
          value={props.channel}
          onChange={(e) => props.setChannel(e.target.value === 'web_push' ? 'web_push' : 'email')}
        >
          <option value="email">Email</option>
          <option value="web_push">Web push</option>
        </select>
      </Field>
      <Field label="Lead time (minutes)">
        <select value={String(props.lead)} onChange={(e) => props.setLead(Number(e.target.value))}>
          <option value="15">15</option>
          <option value="30">30</option>
          <option value="60">60</option>
          <option value="120">120</option>
        </select>
      </Field>
      <Button variant="primary" type="submit">
        Set an alert
      </Button>
    </form>
  );
}
