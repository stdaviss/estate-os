/**
 * `GET /api/v1/games/:slug?session_key=…` — the pair to play.
 *
 * Not in 02-CONTRACTS.md §2, which lists only the events POST. The game needs something to
 * play and the catalogue read is Agent B's; this serves the pairing derived from it, and is
 * recorded as BLOCKER 12.
 *
 * An empty catalogue returns an empty pair rather than an error, so the page can render its
 * empty state instead of a broken game (§C5).
 */

import { fail, ok } from '../../schedule/lib/http'
import { formatDurationClock } from '../../schedule/lib/time'
import { listPairEvents, listPairableTracks } from '../lib/repository'
import { GAME_SLUG, pairVariants, selectPair, tallyVotes } from '../lib/which-mix'

const SESSION_KEY = /^[A-Za-z0-9_-]{16,128}$/

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params
  if (slug !== GAME_SLUG) return fail('not_found', 'There is one game. It is at /play.')

  const sessionKey = new URL(request.url).searchParams.get('session_key') ?? ''
  if (!SESSION_KEY.test(sessionKey)) {
    return fail('bad_request', 'A session key is 16 to 128 url-safe characters.', 'session_key')
  }

  const pairs = pairVariants(await listPairableTracks())
  const pair = selectPair(pairs, sessionKey)

  if (!pair) {
    return ok({ pair: null, pair_count: 0 })
  }

  const split = tallyVotes(pair.pairId, await listPairEvents())

  return ok({
    pair: {
      pair_id: pair.pairId,
      base_title: pair.baseTitle,
      artist_name: pair.artistName,
      artist_slug: pair.artistSlug,
      a: side(pair.a),
      b: side(pair.b),
    },
    pair_count: pairs.length,
    // Served so the page can decide whether to reveal; the client does not decide alone.
    votes_cast: split.total,
  })
}

function side(track: {
  id: string
  versionLabel: string
  audioUrl: string
  durationMs: number
  bpm: number | null
  musicalKey: string | null
}): Record<string, unknown> {
  return {
    track_id: track.id,
    version_label: track.versionLabel,
    audio_url: track.audioUrl,
    duration_ms: track.durationMs,
    bpm: track.bpm,
    musical_key: track.musicalKey,
    display: { duration: formatDurationClock(track.durationMs) },
  }
}
