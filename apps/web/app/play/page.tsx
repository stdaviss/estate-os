/**
 * `/play` — one game, done properly (05-AGENT-C §C5).
 *
 * "Which mix?": two versions of the same track, play both, vote, see the split. It produces
 * real A&R feedback and works with a tiny catalogue, which is the state the catalogue is
 * actually in. There is exactly one game and there will not be a second.
 *
 * No leaderboard, no streak, no points. Votes are logged to `game_events` against an
 * opaque session key and nothing is ever read back about a player.
 */

import type { Metadata } from 'next'

import { Button, EmptyState, Rule } from '@repo/ui'

import { ScheduleError } from '../schedule/components/schedule-error'
import { WhichMix } from './components/which-mix'

export const metadata: Metadata = {
  title: 'Which mix?',
  description: 'Two versions of one track. Say which one works.',
}

export const dynamic = 'force-dynamic'

export default function PlayPage() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <header className="pb-6">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">play</p>
        <h1 className="mt-2 font-display text-display-l uppercase text-chalk">Which mix?</h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Two versions of the same track. Listen to both, say which one works. The artist sees
          the split — that is the whole point of it.
        </p>
      </header>

      <Rule />

      {/* The client component fetches the pair, so a listener with no catalogue still gets a
          designed page rather than an error. */}
      <WhichMix />
    </main>
  )
}

/** Exported for the empty and failed states, so both read in the same voice. */
export function PlayEmpty() {
  return (
    <EmptyState label="NOTHING TO PLAY">
      <p className="font-body text-body text-chalk-dim">
        There are no pairs in the catalogue yet. This needs two versions of one track, and the
        first will arrive from someone sending us a mix.
      </p>
      <div className="mt-4">
        <Button variant="primary" href="/submit">
          <span className="font-data text-label uppercase tracking-label">send us a mix</span>
        </Button>
      </div>
    </EmptyState>
  )
}

export function PlayError({ message }: { message: string }) {
  return <ScheduleError message={message} />
}
