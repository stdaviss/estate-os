/**
 * Alert matching and dispatch.
 * Dedupe key is user_id + episode_id — one person never gets two notices for one episode.
 */

import { recordDelivery, recordEmail, hasDelivery, type AlertSubscription } from './store';
import { unsubscribeToken } from './token';

export type DispatchEpisode = {
  id: string;
  title: string | null;
  starts_at: string;
  state: string;
  showTitle: string;
  hostName: string | null;
  guestName: string | null;
  genre_ids: string[];
  host_id: string | null;
  guest_id: string | null;
};

export type DueNotice = {
  user_id: string;
  episode: DispatchEpisode;
  subscription_id: string;
  channel: AlertSubscription['channel'];
  unsubscribe_token: string;
};

export function episodeMatches(sub: AlertSubscription, episode: DispatchEpisode): boolean {
  if (sub.genre_id && episode.genre_ids.includes(sub.genre_id)) return true;
  if (sub.artist_id && (episode.host_id === sub.artist_id || episode.guest_id === sub.artist_id)) {
    return true;
  }
  return false;
}

export function isDue(
  sub: AlertSubscription,
  episode: DispatchEpisode,
  now: Date,
): boolean {
  if (episode.state !== 'scheduled' && episode.state !== 'repeat_scheduled') return false;
  const start = new Date(episode.starts_at).getTime();
  if (now.getTime() >= start) return false;
  const leadMs = sub.lead_time_minutes * 60 * 1000;
  const notifyAt = start - leadMs;
  return now.getTime() >= notifyAt;
}

export function collectDueNotices(
  subscriptions: AlertSubscription[],
  episodes: DispatchEpisode[],
  now: Date,
  alreadySent: (userId: string, episodeId: string) => boolean = hasDelivery,
): DueNotice[] {
  const notices: DueNotice[] = [];
  const seen = new Set<string>();

  for (const episode of episodes) {
    for (const sub of subscriptions) {
      if (!episodeMatches(sub, episode)) continue;
      if (!isDue(sub, episode, now)) continue;
      const key = `${sub.user_id}:${episode.id}`;
      if (seen.has(key) || alreadySent(sub.user_id, episode.id)) continue;
      seen.add(key);
      notices.push({
        user_id: sub.user_id,
        episode,
        subscription_id: sub.id,
        channel: sub.channel,
        unsubscribe_token: unsubscribeToken(sub.id),
      });
    }
  }
  return notices;
}

export function formatNoticeCopy(
  notice: DueNotice,
  whenLocal: string,
  listenUrl: string,
  unsubUrl: string,
): { subject: string; body: string } {
  const who = [notice.episode.hostName, notice.episode.guestName].filter(Boolean).join(' with ');
  const on = notice.episode.title ?? notice.episode.showTitle;
  const subject = on;
  const body = [
    on,
    who,
    whenLocal,
    listenUrl,
    '',
    `Unsubscribe: ${unsubUrl}`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
  return { subject, body };
}

export function dispatchNotices(
  notices: DueNotice[],
  resolveAddress: (userId: string) => string | null,
  urls: { listen: (episodeId: string) => string; unsub: (token: string) => string },
  whenLocal: (iso: string) => string,
): number {
  let sent = 0;
  for (const notice of notices) {
    const to = resolveAddress(notice.user_id);
    const { subject, body } = formatNoticeCopy(
      notice,
      whenLocal(notice.episode.starts_at),
      urls.listen(notice.episode.id),
      urls.unsub(notice.unsubscribe_token),
    );
    if (notice.channel === 'email' && to) {
      recordEmail(to, subject, body);
      sent += 1;
    } else if (notice.channel === 'web_push') {
      recordEmail(`push:${notice.user_id}`, subject, body);
      sent += 1;
    }
    recordDelivery(notice.user_id, notice.episode.id);
  }
  return sent;
}
