'use client';

import { Artwork, Button, Data, EmptyState } from '../schedule/_lib/ui';
import { WhatsOnNow } from '../schedule/_lib/whats-on-now';
import {
  formatDurationHm,
  formatListingDate,
  formatListeners,
  STATION_TZ,
} from '../../../api/schedule/timezone';
import type { PublicEpisode } from '../../../api/schedule/serialize';
import { visitorTimeZone } from '../schedule/_lib/mode';

export function ArchiveScreen({ episodes }: { episodes: PublicEpisode[] }) {
  const tz = visitorTimeZone();
  if (episodes.length === 0) {
    return (
      <main className="c-page">
        <header className="c-page-head">
          <h1 className="c-display-l">Archive</h1>
        </header>
        <WhatsOnNow compact />
        <EmptyState
          label="Archive"
          action={
            <Button variant="primary" href="/schedule">
              See the schedule
            </Button>
          }
        >
          Nothing has aired yet. The first broadcast is scheduled.
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="c-page">
      <header className="c-page-head">
        <h1 className="c-display-l">Archive</h1>
      </header>
      <WhatsOnNow compact />
      <ul className="c-list-plain">
        {episodes.map((ep) => (
          <li key={ep.id}>
            <a className="c-ep" href={`/archive/${ep.id}`}>
              <Data>{formatListingDate(ep.starts_at, tz)}</Data>
              <Artwork src={ep.artwork_url} alt="" size={48} />
              <div className="c-ep-title">
                <div className="c-display-m">{ep.title ?? ep.show.title}</div>
                <div className="c-body-s">
                  {ep.host?.name}
                  {ep.guest ? ` · ${ep.guest.name}` : ''}
                </div>
              </div>
              <div className="c-ep-actions">
                <Data>{formatListeners(ep.peak_listeners)}</Data>
                <Data>{formatDurationHm(ep.duration_ms)}</Data>
                <span className="c-tz">{STATION_TZ}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
