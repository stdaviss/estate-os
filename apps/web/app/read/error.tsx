'use client'

import { Button } from '@repo/ui'

/** The editorial segment's error boundary. */
export default function ReadSegmentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <div role="alert">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">
          reading failed
        </p>
        <h1 className="mt-2 font-display text-display-l uppercase text-chalk">
          This did not load
        </h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Something broke on our side. The rest of the reading list should still work.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={reset}>
            <span className="font-data text-label uppercase tracking-label">try again</span>
          </Button>
          <Button variant="ghost" href="/read">
            <span className="font-data text-label uppercase tracking-label">reading list</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
