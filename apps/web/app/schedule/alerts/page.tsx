/**
 * `/schedule/alerts` — every active alert, with individual removal (05-AGENT-C §C3).
 *
 * The natural address is `/account/alerts`, but `app/(account)/**` belongs to Agent B
 * (00-FOUNDATION.md §7). Mounted here inside an owned path and raised as BLOCKER 14; moving
 * it is a directory move with no code change.
 *
 * This page is the whole of what listening data is for. It says so, because the position is
 * a product statement and not a compliance footnote.
 */

import type { Metadata } from 'next'

import { Rule } from '@repo/ui'

import { AlertList } from './alert-list'

export const metadata: Metadata = {
  title: 'Alerts',
  description: 'What we will tell you about, and nothing else.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default function AlertsPage() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <header className="pb-6">
        <h1 className="font-display text-display-l uppercase text-chalk">Alerts</h1>
        <p className="mt-2 max-w-measure font-body text-body-l text-chalk-dim">
          Pick the genres and artists you care about and we will tell you when they are
          scheduled. That is the only thing we use this for — there is no feed, no
          recommendations, and nothing here reorders the site for you.
        </p>
      </header>

      <Rule />

      <AlertList />
    </main>
  )
}
