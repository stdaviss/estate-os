'use client'

/**
 * The error state for a failed listings fetch.
 *
 * Says what happened and what to do next, never apologises and is never vague
 * (00-FOUNDATION.md §9). The retry re-runs the server render rather than reloading the
 * page, so audio playing in the transport is not interrupted.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@repo/ui'

export function ScheduleError({ message }: { message: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [attempts, setAttempts] = useState(0)

  return (
    <div role="alert" className="border-y border-rule px-4 py-6">
      <p className="font-data text-label uppercase tracking-label text-chalk-mute">
        listings unavailable
      </p>
      <p className="mt-2 font-body text-body text-chalk">{message}</p>
      <p className="mt-1 font-body text-body-s text-chalk-dim">
        The station is still broadcasting — only the listings failed to load.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={isPending}
          onClick={() => {
            setAttempts((count) => count + 1)
            startTransition(() => router.refresh())
          }}
        >
          <span className="font-data text-label uppercase tracking-label">
            {isPending ? 'retrying…' : 'try again'}
          </span>
        </Button>
        {attempts >= 2 ? (
          <span className="font-body text-body-s text-chalk-dim">
            Still failing. It is us, not you — try again in a few minutes.
          </span>
        ) : null}
      </div>
    </div>
  )
}
