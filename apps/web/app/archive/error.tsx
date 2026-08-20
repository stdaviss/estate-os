'use client'

import { Button } from '@repo/ui'

/** The archive segment's error boundary. Keeps the shell and the transport mounted. */
export default function ArchiveSegmentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <div role="alert">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">
          archive failed
        </p>
        <h1 className="mt-2 font-display text-display-l uppercase text-chalk">
          The archive did not load
        </h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Something broke on our side. Nothing has been lost that was not already gone.
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
