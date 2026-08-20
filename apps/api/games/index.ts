/** POST /api/v1/games/:slug/events */

import { jsonError, jsonOk } from '../schedule/http';
import { isEmptyMode } from '../schedule/fixtures';
import { addGameEvent, voteSplit, WHICH_MIX_PAIR } from './store';

function slugFrom(request: Request, params?: { slug?: string }): string {
  if (params?.slug) return params.slug;
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  const gamesIdx = parts.indexOf('games');
  if (gamesIdx >= 0 && parts[gamesIdx + 1]) return parts[gamesIdx + 1];
  return '';
}

export async function POST(
  request: Request,
  context?: { params?: Promise<{ slug?: string }> | { slug?: string } },
): Promise<Response> {
  const url = new URL(request.url);
  const params = context?.params ? await Promise.resolve(context.params) : undefined;
  const slug = slugFrom(request, params);
  if (!slug) return jsonError(400, 'invalid', 'Missing game slug.');
  if (slug !== 'which-mix') {
    return jsonError(404, 'not_found', 'Unknown game.');
  }
  if (isEmptyMode(process.env, url)) {
    return jsonError(409, 'empty', 'No tracks to compare yet.');
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
  const event_type = typeof rec.event_type === 'string' ? rec.event_type : '';
  const session_key = typeof rec.session_key === 'string' ? rec.session_key : '';
  if (!event_type || !session_key) {
    return jsonError(400, 'invalid', 'event_type and session_key are required.');
  }
  if (event_type !== 'start' && event_type !== 'vote' && event_type !== 'exit') {
    return jsonError(400, 'invalid', 'event_type must be start, vote or exit.', 'event_type');
  }
  const payload =
    typeof rec.payload === 'object' && rec.payload !== null
      ? (rec.payload as Record<string, unknown>)
      : {};

  if (event_type === 'vote') {
    const choice = payload.choice;
    if (choice !== 'a' && choice !== 'b') {
      return jsonError(400, 'invalid', 'Vote choice must be a or b.', 'payload.choice');
    }
    payload.pair_id = typeof payload.pair_id === 'string' ? payload.pair_id : WHICH_MIX_PAIR.id;
  }

  const user_id = request.headers.get('x-user-id');
  const stored = addGameEvent({
    user_id: user_id || null,
    session_key,
    game_slug: slug,
    event_type,
    payload,
  });

  const split = voteSplit(WHICH_MIX_PAIR.id);
  return jsonOk({
    event: { id: stored.id, event_type: stored.event_type },
    pair: WHICH_MIX_PAIR,
    split,
  });
}
