import { Rule } from '@repo/ui'

/**
 * The listings loading state.
 *
 * Reserves the same row height the real listings occupy, so nothing on the page moves when
 * the data arrives — the quality floor forbids layout shift. No pulse or shimmer: motion is
 * limited to the three animations in 01-DESIGN-SYSTEM.md §8, and a skeleton is not one.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8" aria-busy="true">
      <header className="pb-6">
        <h1 className="font-display text-display-l uppercase text-chalk">Schedule</h1>
        <p className="mt-2 font-body text-body text-chalk-dim">Loading the listings.</p>
      </header>

      <Rule />

      <div className="mt-6 flex flex-col gap-8">
        {[0, 1, 2].map((group) => (
          <section key={group}>
            <div className="h-6 w-32 border-b border-rule" />
            <ul className="list-none">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex items-start gap-4 border-b border-rule px-4 py-3">
                  <div className="size-12 rounded border border-rule bg-hull" />
                  <div className="flex-1">
                    <div className="h-4 w-40 rounded bg-hull" />
                    <div className="mt-2 h-3 w-24 rounded bg-hull" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <span className="sr-only">Loading the schedule.</span>
    </main>
  )
}
