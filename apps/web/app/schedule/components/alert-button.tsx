'use client'

/**
 * "Set an alert" on a schedule row.
 *
 * A ghost button rather than a primary one: a listings page has one amber locus — the live
 * row — and a sodium button on every row would break the rationing in
 * 01-DESIGN-SYSTEM.md §2.
 *
 * The alert is attached to the episode's artist where there is one, otherwise its first
 * genre, because `alert_subscriptions` subscribes to a genre or an artist and not to a
 * single airing. That is a deliberate reading of the contract and is recorded in
 * SUBMISSION.md §8: it means the listener is told about the next one of these too, which is
 * the behaviour appointment listening wants.
 */

import { useState } from 'react'

import { Button, Data } from '@repo/ui'

import { postAlert } from '../lib/api'

export interface AlertButtonProps {
  artistSlug: string | null
  genreSlug: string | null
  /** The episode title, for the screen-reader label only. */
  label: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'set' }
  | { kind: 'error'; message: string; retryable: boolean }

const LEAD_TIME_MINUTES = 60

export function AlertButton({ artistSlug, genreSlug, label }: AlertButtonProps) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  if (!artistSlug && !genreSlug) return null

  async function submit() {
    setState({ kind: 'saving' })
    const result = await postAlert({
      ...(artistSlug ? { artist: artistSlug } : { genre: genreSlug ?? undefined }),
      channel: 'email',
      lead_time_minutes: LEAD_TIME_MINUTES,
    })

    if (result.ok) {
      setState({ kind: 'set' })
      return
    }

    // Says what happened and what to do next, per the quality floor. No apology.
    if (result.error.code === 'unauthorised') {
      setState({ kind: 'error', message: 'Sign in to set alerts.', retryable: false })
      return
    }
    if (result.error.code === 'forbidden') {
      setState({ kind: 'error', message: 'Turn alerts on in your privacy settings.', retryable: false })
      return
    }
    setState({ kind: 'error', message: result.error.message, retryable: true })
  }

  if (state.kind === 'set') {
    return (
      <span className="inline-flex items-center gap-2">
        <Data className="text-chalk-mute">{formatLead(LEAD_TIME_MINUTES)}</Data>
        <span className="font-data text-label uppercase tracking-label text-chalk-dim">
          alert set
        </span>
      </span>
    )
  }

  if (state.kind === 'error') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="font-body text-body-s text-chalk-dim">{state.message}</span>
        {state.retryable ? (
          <Button variant="ghost" onClick={submit}>
            <span className="font-data text-label uppercase tracking-label">try again</span>
          </Button>
        ) : (
          <a
            href="/account/privacy"
            className="rounded font-data text-label uppercase tracking-label text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
          >
            settings
          </a>
        )}
      </span>
    )
  }

  return (
    <Button
      variant="ghost"
      onClick={submit}
      disabled={state.kind === 'saving'}
      aria-label={`Set an alert for ${label}`}
    >
      <span className="font-data text-label uppercase tracking-label">
        {state.kind === 'saving' ? 'setting…' : 'set an alert'}
      </span>
    </Button>
  )
}

function formatLead(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
