/**
 * `GET /api/v1/schedule/archive` — expired episodes with metadata and tracklists.
 *
 * 02-CONTRACTS.md §2 puts this at `/api/v1/archive`, but `apps/api/archive/**` is not in
 * Agent C's ownership list in 05-AGENT-C, and 00-FOUNDATION.md §7 does not assign it to
 * anyone. Mounted here, inside an owned path, and raised as BLOCKER 2: moving it to the
 * contract path is a directory move with no code change.
 *
 * Nothing in this response can lead to playback. There is no audio url, no master key and
 * no signed manifest — the recording is gone, and the tracklist is what is left.
 */

import { decodeCursor, encodeCursor, fail, ok, readPagination } from '../lib/http'
import { getGenreIndex, getTracklist, listExpiredEpisodes } from '../lib/repository'
import { assertNoPrivateFields, serializeEpisode, serializeTracklist } from '../lib/serialize'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const { limit, cursor } = readPagination(url)

  const decoded = cursor ? decodeCursor(cursor) : null
  if (cursor && !decoded) {
    return fail('bad_request', 'That cursor is not readable. Request the first page again.', 'cursor')
  }

  const [page, genreIndex] = await Promise.all([
    listExpiredEpisodes({ limit, cursor: decoded }),
    getGenreIndex(),
  ])

  // One query per episode rather than one for the page: an archive page is at most `limit`
  // episodes and each tracklist is a separate ordered list. Batched if this becomes hot.
  const tracklists = await Promise.all(page.episodes.map((episode) => getTracklist(episode.id)))

  const payload = page.episodes.map((episode, index) => ({
    episode: serializeEpisode(episode, genreIndex),
    tracklist: serializeTracklist(tracklists[index]),
    recording_available: false,
  }))

  assertNoPrivateFields(payload)

  return ok(payload, {
    next_cursor: page.nextCursor
      ? encodeCursor(page.nextCursor.startsAt, page.nextCursor.id)
      : null,
  })
}
