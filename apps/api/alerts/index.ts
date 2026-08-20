/** GET/POST/DELETE /api/v1/alerts and unauthenticated unsubscribe. */

import { jsonError, jsonOk } from '../schedule/http';
import { artists, buildFixtures, genres, isEmptyMode } from '../schedule/fixtures';
import {
  addAlert,
  allAlerts,
  listAlerts,
  removeAlert,
  type AlertChannel,
} from './store';
import { collectDueNotices, dispatchNotices } from './dispatch';
import { tokenMatches } from './token';
import { formatListingDate, formatTimeHm, formatTimeZoneName, STATION_TZ } from '../schedule/timezone';

function roleFrom(request: Request): { userId: string | null; role: string } {
  const userId = request.headers.get('x-user-id') ?? request.headers.get('x-session-user');
  const role = request.headers.get('x-role') ?? (userId ? 'listener' : 'anon');
  return { userId, role };
}

function parseChannel(raw: unknown): AlertChannel | null {
  if (raw === 'email' || raw === 'web_push') return raw;
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.endsWith('/unsubscribe') || url.searchParams.has('token') && url.searchParams.get('op') === 'unsub') {
    return unsubscribe(url.searchParams.get('token'));
  }

  if (url.pathname.endsWith('/dispatch') || url.searchParams.get('op') === 'dispatch') {
    return runDispatch(url);
  }

  const { userId } = roleFrom(request);
  if (!userId) {
    return jsonError(401, 'unauthorized', 'Sign in to see your alerts.');
  }
  if (isEmptyMode(process.env, url) && url.searchParams.get('empty') === '1') {
    return jsonOk([]);
  }
  return jsonOk(listAlerts(userId));
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = roleFrom(request);
  if (!userId) {
    return jsonError(401, 'unauthorized', 'Sign in to set an alert.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json', 'Body must be JSON.');
  }
  if (typeof body !== 'object' || body === null) {
    return jsonError(400, 'invalid_json', 'Body must be an object.');
  }
  const rec = body as Record<string, unknown>;
  const genre_id = typeof rec.genre_id === 'string' ? rec.genre_id : null;
  const artist_id = typeof rec.artist_id === 'string' ? rec.artist_id : null;
  if (!genre_id && !artist_id) {
    return jsonError(400, 'invalid', 'Pick a genre or an artist.', 'genre_id');
  }
  if (genre_id && !genres.some((g) => g.id === genre_id)) {
    return jsonError(400, 'invalid', 'Unknown genre.', 'genre_id');
  }
  if (artist_id && !artists.some((a) => a.id === artist_id)) {
    return jsonError(400, 'invalid', 'Unknown artist.', 'artist_id');
  }
  const channel = parseChannel(rec.channel);
  if (!channel) {
    return jsonError(400, 'invalid', 'channel must be email or web_push.', 'channel');
  }
  const leadRaw = rec.lead_time_minutes;
  const lead_time_minutes = typeof leadRaw === 'number' && Number.isFinite(leadRaw) ? leadRaw : 60;
  if (lead_time_minutes < 5 || lead_time_minutes > 24 * 60) {
    return jsonError(400, 'invalid', 'lead_time_minutes must be between 5 and 1440.', 'lead_time_minutes');
  }
  const push_endpoint = typeof rec.push_endpoint === 'string' ? rec.push_endpoint : null;

  const row = addAlert({
    user_id: userId,
    genre_id,
    artist_id,
    channel,
    lead_time_minutes,
    push_endpoint,
  });
  return jsonOk(row);
}

export async function DELETE(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token) return unsubscribe(token);

  const { userId } = roleFrom(request);
  if (!userId) {
    return jsonError(401, 'unauthorized', 'Sign in to remove an alert.');
  }
  const id = url.searchParams.get('id');
  if (!id) return jsonError(400, 'invalid', 'Pass id as a query parameter.', 'id');
  const removed = removeAlert(id, userId);
  if (!removed) return jsonError(404, 'not_found', 'No alert with that id.');
  return jsonOk({ removed: true, id });
}

function unsubscribe(token: string | null): Response {
  if (!token) return jsonError(400, 'invalid', 'Missing token.', 'token');
  const match = allAlerts().find((row) => tokenMatches(row.id, token));
  if (!match) {
    return jsonError(404, 'not_found', 'This unsubscribe link is not valid.');
  }
  removeAlert(match.id);
  return jsonOk({ removed: true, id: match.id });
}

async function runDispatch(url: URL): Promise<Response> {
  const nowIso = url.searchParams.get('now') ?? new Date().toISOString();
  const now = new Date(nowIso);
  const { episodes } = isEmptyMode(process.env, url) ? { episodes: [] } : buildFixtures(nowIso);
  const dispatchEps = episodes.map((ep) => ({
    id: ep.id,
    title: ep.title,
    starts_at: ep.starts_at,
    state: ep.state,
    showTitle: ep.show.title,
    hostName: ep.host?.name ?? null,
    guestName: ep.guest?.name ?? null,
    genre_ids: ep.genres.map((g) => g.id),
    host_id: ep.host?.id ?? null,
    guest_id: ep.guest?.id ?? null,
  }));
  const notices = collectDueNotices(allAlerts(), dispatchEps, now);
  const sent = dispatchNotices(
    notices,
    (userId) => `${userId}@listeners.local`,
    {
      listen: (episodeId) => `/schedule#${episodeId}`,
      unsub: (token) => `/schedule/alerts/unsubscribe?token=${token}`,
    },
    (iso) =>
      `${formatTimeHm(iso, STATION_TZ)} ${formatTimeZoneName(iso, STATION_TZ)} on ${formatListingDate(iso, STATION_TZ)}`,
  );
  return jsonOk({ sent, count: notices.length });
}
