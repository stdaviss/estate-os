/**
 * "Which mix?" — pairing and tallying.
 *
 * The game plays two versions of the same track and asks which one works. That needs
 * pairs, and `tracks` has no notion of a version or a variant (02-CONTRACTS.md §1) — see
 * BLOCKER 6, which proposes a column. Until then pairs are inferred from the version
 * suffix producers already put in track titles: "Ancrage (dub mix)" and
 * "Ancrage (original mix)" are two versions of "Ancrage" by the same artist.
 *
 * Inference is conservative: two tracks pair only if they share an artist and a base
 * title and both carry a version suffix. It will miss pairs rather than invent them,
 * because a wrong pair makes the game look broken and the vote data worthless.
 */

export const GAME_SLUG = 'which-mix'

export interface CatalogueTrack {
  id: string
  title: string
  artistId: string
  artistName: string
  artistSlug: string
  durationMs: number
  bpm: number | null
  musicalKey: string | null
  audioUrl: string
}

export interface MixPair {
  /** Stable id for the pairing, so votes aggregate across sessions. */
  pairId: string
  baseTitle: string
  artistName: string
  artistSlug: string
  a: CatalogueTrack & { versionLabel: string }
  b: CatalogueTrack & { versionLabel: string }
}

/**
 * Trailing version markers, e.g. `(dub mix)`, `[original]`, `- vip`.
 * Matched at the end of the title only; a track called "Original Sin" is not a version.
 */
const VERSION_SUFFIX =
  /[\s]*[([-]\s*((?:[a-z0-9'’.&\s]*?)(?:mix|dub|version|edit|vip|rework|remix|instrumental|dubplate|cut|take))\s*[)\]]?\s*$/i

interface SplitTitle {
  base: string
  version: string | null
}

export function splitVersion(title: string): SplitTitle {
  const match = VERSION_SUFFIX.exec(title)
  if (!match) return { base: normaliseTitle(title), version: null }
  const base = title.slice(0, match.index)
  const version = match[1].trim().toLowerCase()
  if (normaliseTitle(base).length === 0) return { base: normaliseTitle(title), version: null }
  return { base: normaliseTitle(base), version }
}

function normaliseTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Every pairable combination in the catalogue, ordered deterministically.
 *
 * Where an artist has three or more versions of one track, adjacent pairs are produced
 * rather than every combination, so one prolific track cannot dominate the game.
 */
export function pairVariants(tracks: CatalogueTrack[]): MixPair[] {
  const groups = new Map<string, (CatalogueTrack & { versionLabel: string })[]>()

  for (const track of tracks) {
    const { base, version } = splitVersion(track.title)
    if (!version || base.length === 0) continue
    const key = `${track.artistId}::${base}`
    const group = groups.get(key) ?? []
    group.push({ ...track, versionLabel: version })
    groups.set(key, group)
  }

  const pairs: MixPair[] = []
  for (const [, group] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (group.length < 2) continue
    const ordered = [...group].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (let index = 0; index + 1 < ordered.length; index += 2) {
      const a = ordered[index]
      const b = ordered[index + 1]
      pairs.push({
        pairId: `${a.id}:${b.id}`,
        baseTitle: displayBase(a.title),
        artistName: a.artistName,
        artistSlug: a.artistSlug,
        a,
        b,
      })
    }
  }
  return pairs
}

/** The base title with its original casing, for display. */
function displayBase(title: string): string {
  const match = VERSION_SUFFIX.exec(title)
  const base = match ? title.slice(0, match.index) : title
  return base.replace(/[\s([-]+$/, '').trim()
}

export type WhichMixEventType = 'pair.served' | 'pair.played' | 'pair.voted' | 'pair.skipped'

/** Mirrors a `game_events` row as this module needs it. */
export interface GameEvent {
  sessionKey: string
  userId: string | null
  gameSlug: string
  eventType: string
  payload: Record<string, unknown>
  createdAt: Date
}

export interface VoteSplit {
  pairId: string
  a: number
  b: number
  total: number
  /** Whole percent for A; B is `100 - percentA` so the two always sum to 100. */
  percentA: number
  percentB: number
}

/**
 * Tallies votes for one pair.
 *
 * One vote per session per pair: the first vote counts and later ones are ignored, so a
 * refresh does not stuff the ballot. This is A&R feedback, not a poll to win.
 */
export function tallyVotes(pairId: string, events: GameEvent[]): VoteSplit {
  const firstVoteBySession = new Map<string, 'a' | 'b'>()

  for (const event of [...events].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    if (event.gameSlug !== GAME_SLUG) continue
    if (event.eventType !== 'pair.voted') continue
    if (event.payload.pair_id !== pairId) continue
    const choice = event.payload.choice
    if (choice !== 'a' && choice !== 'b') continue
    if (firstVoteBySession.has(event.sessionKey)) continue
    firstVoteBySession.set(event.sessionKey, choice)
  }

  let a = 0
  let b = 0
  for (const choice of firstVoteBySession.values()) {
    if (choice === 'a') a += 1
    else b += 1
  }

  const total = a + b
  if (total === 0) return { pairId, a: 0, b: 0, total: 0, percentA: 0, percentB: 0 }
  const percentA = Math.round((a / total) * 100)
  return { pairId, a, b, total, percentA, percentB: 100 - percentA }
}

/**
 * Deterministic pair selection from a session key, so a listener gets the same pair if
 * they reload mid-vote and a different one on a new visit. Not personalisation: the
 * mapping is a hash of an opaque session key with no reference to who the listener is,
 * what they have heard, or what they like.
 */
export function selectPair(pairs: MixPair[], sessionKey: string): MixPair | null {
  if (pairs.length === 0) return null
  let hash = 2166136261
  for (let index = 0; index < sessionKey.length; index += 1) {
    hash ^= sessionKey.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return pairs[hash % pairs.length]
}

export const ALLOWED_EVENT_TYPES: readonly WhichMixEventType[] = [
  'pair.served',
  'pair.played',
  'pair.voted',
  'pair.skipped',
]

export function isAllowedEventType(value: string): value is WhichMixEventType {
  return (ALLOWED_EVENT_TYPES as readonly string[]).includes(value)
}
