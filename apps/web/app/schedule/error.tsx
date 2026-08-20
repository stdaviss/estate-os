'use client'

/**
 * The schedule segment's error boundary.
 *
 * Scoped to the segment rather than the app, so the shell and the transport stay mounted and
 * audio keeps playing while the listings are broken. `reset` re-renders the segment without
 * a page load, which is what keeps that true.
 */

import { Button } from '@repo/ui'

export default function ScheduleSegmentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <div role="alert">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">
          listings failed
        </p>
        <h1 className="mt-2 font-display text-display-l uppercase text-chalk">
          The schedule did not load
        </h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Something broke on our side. The station is still broadcasting — if you were
          listening, you still are.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            <span className="font-data text-label uppercase tracking-label">try again</span>
          </Button>
          <Button variant="ghost" href="/read">
            <span className="font-data text-label uppercase tracking-label">read instead</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
