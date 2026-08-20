'use client';

import { Button, Data, Pill, StatusDot } from './ui';
import { useBroadcast } from './broadcast';
import {
  formatTimecode,
  formatTimeHm,
  formatTimeZoneName,
  STATION_TZ,
} from '../../../../api/schedule/timezone';

export function WhatsOnNow({ compact = false, showDot = true, showListen = true }: { compact?: boolean; showDot?: boolean; showListen?: boolean }) {
  const { now, status, retry } = useBroadcast();

  if (status === 'loading') {
    return (
      <div className="c-now">
        <span className="c-label">Now</span>
        <span className="c-body-s">Checking the desk.</span>
      </div>
    );
  }
  if (status === 'error' || !now) {
    return (
      <div className="c-now">
        <span className="c-label">Now</span>
        <span className="c-body-s">Could not read the live state.</span>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }

  const episode = now.episode;
  if (!episode) {
    return (
      <div className="c-now">
        <span className="c-label">Now</span>
        <span className="c-body-s">Nothing is scheduled.</span>
      </div>
    );
  }

  const live = now.is_live || episode.state === 'live' || episode.state === 'repeat_live';
  const elapsed = now.started_at
    ? Date.now() - new Date(now.started_at).getTime()
    : Date.now() - new Date(episode.starts_at).getTime();
  const until = new Date(episode.starts_at).getTime() - Date.now();

  return (
    <div className={live ? 'c-now is-live' : 'c-now'}>
      {live ? (
        <Pill live>
          {showDot ? <StatusDot /> : null}
          On air
        </Pill>
      ) : (
        <span className="c-label">Next</span>
      )}
      <div className="c-now-meta">
        <div className="c-display-m">{episode.show_title ?? episode.title}</div>
        {!compact && (
          <div className="c-body-s">
            {episode.host_name}
            {episode.guest_name ? ` · ${episode.guest_name}` : ''}
          </div>
        )}
      </div>
      <Data>
        {live
          ? formatTimecode(elapsed)
          : formatTimecode(Math.max(0, until))}
        <span className="c-tz">
          {' '}
          {formatTimeHm(episode.starts_at, STATION_TZ)} {formatTimeZoneName(episode.starts_at, STATION_TZ)}
        </span>
      </Data>
      {live && showListen && (
        <Button variant="primary" href="/live">
          Listen
        </Button>
      )}
    </div>
  );
}
