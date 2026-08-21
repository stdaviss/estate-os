'use client'

import { Button } from '@repo/ui'

/**
 * The game's error boundary.
 *
 * A broken game costs more credibility than no game (05-AGENT-C §C5), so this says so and
 * points somewhere useful rather than leaving a dead page.
 */
export default function PlaySegmentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <div role="alert">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">
          game unavailable
        </p>
        <h1 className="mt-2 font-display text-display-l uppercase text-chalk">
          This is not working
        </h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Something broke on our side. Nothing you did caused it and no vote was recorded.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            <span className="font-data text-label uppercase tracking-label">try again</span>
          </Button>
          <Button variant="ghost" href="/schedule">
            <span className="font-data text-label uppercase tracking-label">see the schedule</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
