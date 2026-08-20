'use client';

import { Artwork, Button, Data, EmptyState, LoadState, Pill, StatusDot } from './_lib/ui';
import { WhatsOnNow } from './_lib/whats-on-now';
import { isEmptyMode, visitorTimeZone } from './_lib/mode';
import {
  formatDurationHm,
  formatTimeHm,
  formatTimeZoneName,
  STATION_TZ,
} from '../../../api/schedule/timezone';
import type { PublicEpisode } from '../../../api/schedule/serialize';

export type ScheduleData = {
  timezone: string;
  from: string;
  to: string;
  days: { date: string; label: string; episodes: PublicEpisode[] }[];
};

export function ScheduleScreen({ initial }: { initial: ScheduleData }) {
  const empty = isEmptyMode() || initial.days.length === 0;
  const tz = visitorTimeZone();
  const shows = new Map<string, string>();
  for (const day of initial.days) {
    for (const ep of day.episodes) {
      shows.set(ep.show.slug, ep.show.title);
    }
  }

  return (
    <main className="c-page">
      <header className="c-page-head">
        <h1 className="c-display-l">Schedule</h1>
        <Data>
          {tz} · desk {STATION_TZ}
        </Data>
      </header>
      <p className="c-body-s" style={{ marginBottom: 16 }}>
        {[...shows.entries()].map(([slug, title]) => (
          <a key={slug} className="c-data" href={`/schedule/shows/${slug}/ics`} style={{ marginRight: 16 }}>
            ICS {title}
          </a>
        ))}
      </p>
      <WhatsOnNow showDot={false} showListen={false} />
      {empty ? (
        <EmptyState
          label="Schedule"
          action={
            <Button variant="primary" href="/submit">
              Send a mix
            </Button>
          }
        >
          Nothing is scheduled yet. The first broadcast is coming.
        </EmptyState>
      ) : (
        <LoadState status="ready" onRetry={() => undefined}>
          <div className="c-days">
            {initial.days.map((day) => (
              <section key={day.date}>
                <div className="c-day-head">
                  <span className="c-label">{weekdayLabel(day.episodes[0]?.starts_at, tz)}</span>
                  <h2 className="c-display-m">{day.date}</h2>
                </div>
                <ul className="c-list-plain">
                  {day.episodes.map((ep) => (
                    <EpisodeRow key={ep.id} episode={ep} tz={tz} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </LoadState>
      )}
    </main>
  );
}

function weekdayLabel(iso: string | undefined, tz: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: tz }).format(new Date(iso)).toUpperCase();
}

function EpisodeRow({ episode, tz }: { episode: PublicEpisode; tz: string }) {
  const live = episode.state === 'live' || episode.state === 'repeat_live';
  const alertHref = episode.genres[0]
    ? `/schedule/alerts?genre_id=${episode.genres[0].id}&episode_id=${episode.id}`
    : `/schedule/alerts?episode_id=${episode.id}`;

  return (
    <li className={live ? 'c-ep c-ep-live' : 'c-ep'} id={episode.id}>
      <div className="c-ep-time">
        {live && <StatusDot />}
        <Data>{formatTimeHm(episode.starts_at, tz)}</Data>
        <span className="c-tz c-data">
          {formatTimeHm(episode.starts_at, STATION_TZ)} {formatTimeZoneName(episode.starts_at, STATION_TZ)}
        </span>
      </div>
      <Artwork src={episode.artwork_url} alt="" size={48} />
      <div className="c-ep-title">
        <div className="c-display-m">{episode.title ?? episode.show.title}</div>
        <div className="c-ep-sub">
          <span className="c-body-s">
            {episode.host?.name}
            {episode.guest ? ` · ${episode.guest.name}` : ''}
          </span>
          {episode.genres.map((g) => (
            <Pill key={g.id}>{g.name}</Pill>
          ))}
        </div>
      </div>
      <div className="c-ep-actions">
        <Data>{formatDurationHm(episode.duration_ms)}</Data>
        <Button href={alertHref}>Set an alert</Button>
        {live && (
          <Button variant="primary" href="/live">
            Listen
          </Button>
        )}
      </div>
    </li>
  );
}
