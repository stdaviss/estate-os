/**
 * `GET /api/v1/schedule/:episodeId` — one airing, with its tracklist once it has aired.
 *
 * The tracklist is served for expired episodes because it is the artefact that survives
 * them (00-FOUNDATION.md §4). No audio url appears in this response in any state.
 */

import { fail, ok } from '../lib/http'
import { getEpisodeById, getGenreIndex, getTracklist } from '../lib/repository'
import { assertNoPrivateFields, serializeEpisode, serializeTracklist } from '../lib/serialize'
import { isExpired, isOnAir } from '../lib/view-models'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ episodeId: string }> },
): Promise<Response> {
  const { episodeId } = await context.params
  if (!UUID.test(episodeId)) {
    return fail('bad_request', 'That is not an episode id.', 'episodeId')
  }

  const episode = await getEpisodeById(episodeId)
  if (!episode) {
    return fail('not_found', 'No episode with that id. It may never have been scheduled.')
  }

  const [genreIndex, tracklist] = await Promise.all([
    getGenreIndex(),
    // A scheduled episode has no tracklist yet; a live one is still accumulating.
    isExpired(episode) || isOnAir(episode) ? getTracklist(episode.id) : Promise.resolve([]),
  ])

  const payload = {
    episode: serializeEpisode(episode, genreIndex),
    tracklist: serializeTracklist(tracklist),
    /** Stated explicitly so a client never has to infer it from a missing field. */
    recording_available: false,
  }

  assertNoPrivateFields(payload)
  return ok(payload)
}
