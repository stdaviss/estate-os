/**
 * `/read/edit` — the staff editor.
 *
 * Minimal on purpose (05-AGENT-C §C4): MDX in a textarea, a live preview, a publish toggle,
 * and no CMS. The preview is rendered from the same MDX component map as the published
 * page, so what a writer sees is what readers get.
 */

import type { Metadata } from 'next'

import { EmptyState } from '@repo/ui'

import { currentStaffUser } from './lib/staff'
import { PostEditor } from './post-editor'

export const metadata: Metadata = { title: 'Editor', robots: { index: false } }

export const dynamic = 'force-dynamic'

export default async function EditorPage() {
  // Checked on the server. The editor is never rendered for a non-staff account, and the
  // write endpoint checks the role again regardless of what reaches it.
  const user = await currentStaffUser()

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
        <EmptyState label="STAFF ONLY">
          <p className="font-body text-body text-chalk-dim">
            The editor is for staff accounts. Sign in with one, or read what is published.
          </p>
        </EmptyState>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 md:px-8">
      <header className="pb-6">
        <h1 className="font-display text-display-l uppercase text-chalk">Editor</h1>
        <p className="mt-2 font-body text-body text-chalk-dim">
          MDX on the left, what readers see on the right. Saving a draft does not publish it.
        </p>
      </header>

      <PostEditor authorName={user.displayName} />
    </main>
  )
}
