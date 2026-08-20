/**
 * `POST /api/v1/games/:slug/events` — log a game event and return the split after a vote.
 *
 * Anonymous play is allowed, so identity is an opaque session key rather than a user
 * (05-AGENT-C §C5). Only the four event types the game emits are accepted, and only
 * `game_events` is written: no leaderboard, no streak, no points, and nothing derived
 * about the player is stored or returned.
 */

import { fail, ok } from '../../../schedule/lib/http'
import { currentUser } from '../../../alerts/lib/session'
import { insertGameEvent, listPairEvents, listPairableTracks } from '../../lib/repository'
import { GAME_SLUG, isAllowedEventType, pairVariants, tallyVotes } from '../../lib/which-mix'

const SESSION_KEY = /^[A-Za-z0-9_-]{16,128}$/
const PAIR_ID = /^[0-9a-f-]{1,80}:[0-9a-f-]{1,80}$/i

interface EventBody {
  session_key?: unknown
  event_type?: unknown
  pair_id?: unknown
  choice?: unknown
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params
  if (slug !== GAME_SLUG) {
    return fail('not_found', 'There is one game. It is at /play.')
  }

  let body: EventBody
  try {
    body = (await request.json()) as EventBody
  } catch {
    return fail('bad_request', 'Send a JSON body.')
  }

  const sessionKey = typeof body.session_key === 'string' ? body.session_key : ''
  if (!SESSION_KEY.test(sessionKey)) {
    return fail('bad_request', 'A session key is 16 to 128 url-safe characters.', 'session_key')
  }

  const eventType = typeof body.event_type === 'string' ? body.event_type : ''
  if (!isAllowedEventType(eventType)) {
    return fail('bad_request', 'That is not an event this game sends.', 'event_type')
  }

  const pairId = typeof body.pair_id === 'string' ? body.pair_id : ''
  if (!PAIR_ID.test(pairId)) {
    return fail('bad_request', 'Name the pair being played.', 'pair_id')
  }

  // Only checked so a signed-in player's votes are attributable for A&R; play does not
  // require it and no route reads it back.
  const user = await currentUser()

  if (eventType === 'pair.voted') {
    const choice = body.choice
    if (choice !== 'a' && choice !== 'b') {
      return fail('bad_request', 'Vote a or b.', 'choice')
    }

    // The pair must exist in the catalogue, otherwise a caller could stuff arbitrary
    // pair ids into the event log and corrupt the feedback the artists see.
    const pairs = pairVariants(await listPairableTracks())
    if (!pairs.some((pair) => pair.pairId === pairId)) {
      return fail('not_found', 'That pair is not in the catalogue.', 'pair_id')
    }

    await insertGameEvent({
      sessionKey,
      userId: user?.id ?? null,
      eventType,
      payload: { pair_id: pairId, choice },
    })

    const split = tallyVotes(pairId, await listPairEvents())
    return ok({
      pair_id: split.pairId,
      a: split.a,
      b: split.b,
      total: split.total,
      percent_a: split.percentA,
      percent_b: split.percentB,
    })
  }

  await insertGameEvent({
    sessionKey,
    userId: user?.id ?? null,
    eventType,
    payload: { pair_id: pairId },
  })

  return ok({ logged: true })
}
