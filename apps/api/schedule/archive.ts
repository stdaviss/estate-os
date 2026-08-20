/** GET /api/v1/archive — expired episodes plus tracklists. Never includes internal_master_key. */

import { buildFixtures, isEmptyMode } from '../schedule/fixtures';
import { jsonError, jsonOk, paginateIds, readCursor } from '../schedule/http';
import { toPublicEpisode } from '../schedule/serialize';

export async function GET(
  request: Request,
  context?: { params?: Promise<{ episodeId?: string }> | { episodeId?: string } },
): Promise<Response> {
  const url = new URL(request.url);
  const params = context?.params ? await Promise.resolve(context.params) : undefined;
  const pathParts = url.pathname.split('/').filter(Boolean);
  const last = pathParts[pathParts.length - 1] ?? '';
  const episodeId = params?.episodeId || (last && last !== 'archive' ? last : '');

  const empty = isEmptyMode(process.env, url);
  const { episodes } = empty ? { episodes: [] } : buildFixtures();
  const expired = episodes
    .filter((ep) => ep.state === 'expired')
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  if (episodeId && episodeId !== 'archive') {
    const row = expired.find((ep) => ep.id === episodeId);
    if (!row) {
      return jsonError(404, 'not_found', 'That episode is not in the archive.');
    }
    return jsonOk(toPublicEpisode(row, { includeTracklist: true }));
  }

  const { cursor, limit } = readCursor(url);
  const { slice, next_cursor } = paginateIds(expired, cursor, limit);
  const data = slice.map((row) => toPublicEpisode(row, { includeTracklist: true }));
  return jsonOk(data, { next_cursor });
}
