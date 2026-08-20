import { Rule } from '@repo/ui'

/** Reserves the archive's layout so nothing moves when the entries arrive. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8" aria-busy="true">
      <header className="pb-6">
        <h1 className="font-display text-display-l uppercase text-chalk">Archive</h1>
        <p className="mt-2 font-body text-body text-chalk-dim">Loading what aired.</p>
      </header>

      <Rule />

      <div className="mt-6 flex flex-col gap-12">
        {[0, 1].map((entry) => (
          <div key={entry} className="grid gap-4 sm:grid-cols-[96px_1fr]">
            <div className="size-24 rounded border border-rule bg-hull" />
            <div>
              <div className="h-3 w-24 rounded bg-hull" />
              <div className="mt-3 h-5 w-56 rounded bg-hull" />
              <div className="mt-6 flex flex-col gap-2 border-t border-rule pt-3">
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-3 w-full rounded bg-hull" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Loading the archive.</span>
    </main>
  )
}
