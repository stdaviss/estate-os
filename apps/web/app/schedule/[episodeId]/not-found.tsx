import { Button } from '@repo/ui'

/**
 * No episode at that id.
 *
 * Distinct from an expired episode on purpose: an expired one has a page, a tracklist and a
 * plain statement that the recording is gone. This is for a link to something that never
 * existed, and it says which of the two happened.
 */
export default function EpisodeNotFound() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <p className="font-data text-label uppercase tracking-label text-chalk-mute">no such show</p>
      <h1 className="mt-2 font-display text-display-l uppercase text-chalk">
        Nothing was scheduled here
      </h1>
      <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
        This is not an expired broadcast — there is no episode with this address at all. The
        link may be mistyped.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="primary" href="/schedule">
          <span className="font-data text-label uppercase tracking-label">see the schedule</span>
        </Button>
        <Button variant="ghost" href="/archive">
          <span className="font-data text-label uppercase tracking-label">what has aired</span>
        </Button>
      </div>
    </main>
  )
}
