'use client';

import { Artwork, Data, EmptyState } from '../../schedule/_lib/ui';
import {
  formatIndex,
  formatListingDate,
  formatListeners,
  formatTimecode,
  STATION_TZ,
} from '../../../../api/schedule/timezone';
import type { PublicEpisode } from '../../../../api/schedule/serialize';

export function ArchiveEpisodeScreen({ episode }: { episode: PublicEpisode | null }) {
  if (!episode) {
    return (
      <main className="c-page">
        <EmptyState label="Archive">Nothing has aired yet. The first broadcast is scheduled.</EmptyState>
      </main>
    );
  }

  const aired = formatListingDate(episode.starts_at, STATION_TZ);
  const startMs = new Date(episode.starts_at).getTime();

  return (
    <main className="c-page">
      <div className="c-empty" style={{ borderBottom: 0, paddingBottom: 24 }}>
        <div className="c-label">Expired</div>
        <p className="c-body-l">This aired on {aired} and was not recorded. The tracklist is below.</p>
      </div>
      <div className="c-archive-hero">
        <Artwork src={episode.artwork_url} alt={episode.show.title} size={96} />
        <div>
          <h1 className="c-display-l">{episode.title ?? episode.show.title}</h1>
          <p className="c-body-s">
            {episode.host?.name}
            {episode.guest ? ` with ${episode.guest.name}` : ''}
          </p>
          <p>
            <Data>{aired}</Data>
            {' · '}
            <Data>{formatListeners(episode.peak_listeners)}</Data>
            {' · '}
            <Data>
              {formatTimecode(new Date(episode.ends_at).getTime() - startMs)}
            </Data>
          </p>
        </div>
      </div>
      <h2 className="c-label" style={{ marginBottom: 8 }}>
        Tracklist
      </h2>
      <ol className="c-list-plain">
        {(episode.tracklist ?? []).map((row) => (
          <li key={row.position} className="c-track">
            <span className="pos">{formatIndex(row.position)}</span>
            <span>{row.raw_artist}</span>
            <span className="title">{row.raw_title}</span>
            <span className="at">{formatTimecode(new Date(row.played_at).getTime() - startMs)}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
