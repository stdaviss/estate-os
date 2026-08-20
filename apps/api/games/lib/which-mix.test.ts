import { describe, expect, it } from 'vitest'

import {
  GAME_SLUG,
  isAllowedEventType,
  pairVariants,
  selectPair,
  splitVersion,
  tallyVotes,
  type CatalogueTrack,
  type GameEvent,
} from './which-mix'

function track(id: string, title: string, artistId = 'a-1'): CatalogueTrack {
  return {
    id,
    title,
    artistId,
    artistName: artistId === 'a-1' ? 'SELS' : 'LHA',
    artistSlug: artistId === 'a-1' ? 'sels' : 'lha',
    durationMs: 257_000,
    bpm: 132,
    musicalKey: 'F#m',
    audioUrl: `/audio/${id}.m4a`,
  }
}

describe('splitting a version suffix off a title', () => {
  it('recognises the common producer forms', () => {
    expect(splitVersion('Ancrage (dub mix)')).toEqual({ base: 'ancrage', version: 'dub mix' })
    expect(splitVersion('Ancrage (Original Mix)')).toEqual({ base: 'ancrage', version: 'original mix' })
    expect(splitVersion('Ancrage [VIP]')).toEqual({ base: 'ancrage', version: 'vip' })
    expect(splitVersion('Ancrage - Dub')).toEqual({ base: 'ancrage', version: 'dub' })
    expect(splitVersion('Ancrage (Instrumental)')).toEqual({ base: 'ancrage', version: 'instrumental' })
  })

  it('leaves a title with no version alone', () => {
    expect(splitVersion('Ancrage')).toEqual({ base: 'ancrage', version: null })
    // "Original Sin" is not a version of "Sin".
    expect(splitVersion('Original Sin')).toEqual({ base: 'original sin', version: null })
  })

  it('does not strip a whole title away', () => {
    expect(splitVersion('(dub mix)').version).toBeNull()
  })

  it('normalises punctuation and case so near-identical titles group', () => {
    expect(splitVersion("L'Ancrage (Dub Mix)").base).toBe(splitVersion("L’Ancrage (dub mix)").base)
  })
})

describe('pairing versions', () => {
  it('pairs two versions of one track by the same artist', () => {
    const pairs = pairVariants([
      track('t-1', 'Ancrage (original mix)'),
      track('t-2', 'Ancrage (dub mix)'),
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].baseTitle).toBe('Ancrage')
    expect(pairs[0].artistName).toBe('SELS')
    expect([pairs[0].a.id, pairs[0].b.id].sort()).toEqual(['t-1', 't-2'])
  })

  it('refuses to pair across artists', () => {
    expect(
      pairVariants([
        track('t-1', 'Ancrage (original mix)', 'a-1'),
        track('t-2', 'Ancrage (dub mix)', 'a-2'),
      ]),
    ).toEqual([])
  })

  it('refuses to pair a track that has no version suffix', () => {
    expect(pairVariants([track('t-1', 'Ancrage'), track('t-2', 'Ancrage (dub mix)')])).toEqual([])
  })

  it('leaves a lone version unpaired', () => {
    expect(pairVariants([track('t-1', 'Ancrage (dub mix)')])).toEqual([])
  })

  it('pairs adjacently rather than combinatorially, so one track cannot dominate', () => {
    const pairs = pairVariants([
      track('t-1', 'Ancrage (a mix)'),
      track('t-2', 'Ancrage (b dub)'),
      track('t-3', 'Ancrage (c version)'),
      track('t-4', 'Ancrage (d edit)'),
    ])
    expect(pairs).toHaveLength(2)
  })

  it('is deterministic regardless of input order', () => {
    const forward = pairVariants([track('t-1', 'Ancrage (original mix)'), track('t-2', 'Ancrage (dub mix)')])
    const reverse = pairVariants([track('t-2', 'Ancrage (dub mix)'), track('t-1', 'Ancrage (original mix)')])
    expect(forward[0].pairId).toBe(reverse[0].pairId)
    expect(forward[0].a.id).toBe(reverse[0].a.id)
  })

  it('returns nothing for an empty catalogue, which is the launch state', () => {
    expect(pairVariants([])).toEqual([])
  })
})

describe('tallying votes', () => {
  function vote(sessionKey: string, choice: string, minute: number, pairId = 't-1:t-2'): GameEvent {
    return {
      sessionKey,
      userId: null,
      gameSlug: GAME_SLUG,
      eventType: 'pair.voted',
      payload: { pair_id: pairId, choice },
      createdAt: new Date(Date.UTC(2026, 7, 20, 21, minute)),
    }
  }

  it('counts one vote per session', () => {
    const split = tallyVotes('t-1:t-2', [vote('s1', 'a', 1), vote('s2', 'b', 2), vote('s3', 'a', 3)])
    expect(split).toEqual({ pairId: 't-1:t-2', a: 2, b: 1, total: 3, percentA: 67, percentB: 33 })
  })

  it('ignores a second vote from the same session', () => {
    const split = tallyVotes('t-1:t-2', [vote('s1', 'a', 1), vote('s1', 'b', 2)])
    expect(split.total).toBe(1)
    expect(split.a).toBe(1)
  })

  it('always sums the two percentages to 100', () => {
    const split = tallyVotes('t-1:t-2', [vote('s1', 'a', 1), vote('s2', 'b', 2), vote('s3', 'b', 3)])
    expect(split.percentA + split.percentB).toBe(100)
  })

  it('reports zero for a pair nobody has voted on', () => {
    expect(tallyVotes('t-1:t-2', [])).toEqual({
      pairId: 't-1:t-2',
      a: 0,
      b: 0,
      total: 0,
      percentA: 0,
      percentB: 0,
    })
  })

  it('ignores votes for another pair, another game, and other event types', () => {
    const events: GameEvent[] = [
      vote('s1', 'a', 1, 'other:pair'),
      { ...vote('s2', 'a', 2), gameSlug: 'something-else' },
      { ...vote('s3', 'a', 3), eventType: 'pair.served' },
      vote('s4', 'c', 4),
    ]
    expect(tallyVotes('t-1:t-2', events).total).toBe(0)
  })
})

describe('pair selection', () => {
  const pairs = pairVariants([
    track('t-1', 'Ancrage (original mix)'),
    track('t-2', 'Ancrage (dub mix)'),
    track('t-3', 'Mistral (original mix)'),
    track('t-4', 'Mistral (dub mix)'),
  ])

  it('is stable for one session key, so a reload does not change the question', () => {
    expect(selectPair(pairs, 'session-abc')?.pairId).toBe(selectPair(pairs, 'session-abc')?.pairId)
  })

  it('returns null when there is nothing to play', () => {
    expect(selectPair([], 'session-abc')).toBeNull()
  })

  it('always returns a pair from the supplied list', () => {
    for (const key of ['a', 'b', 'c', 'session-1', 'session-2', '']) {
      const selected = selectPair(pairs, key)
      expect(pairs.map((pair) => pair.pairId)).toContain(selected?.pairId)
    }
  })
})

describe('event types', () => {
  it('accepts only the four the game emits', () => {
    expect(isAllowedEventType('pair.voted')).toBe(true)
    expect(isAllowedEventType('pair.served')).toBe(true)
    expect(isAllowedEventType('leaderboard.viewed')).toBe(false)
    expect(isAllowedEventType('')).toBe(false)
  })
})
