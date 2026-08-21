'use client'

/**
 * The alert list, with per-row removal.
 *
 * Removal is optimistic and puts the row back if the request fails, so the list never
 * claims something is gone that is not. Each row states its own lead time in mono, because
 * "we will tell you an hour before" is the substance of the feature.
 */

import { useCallback, useEffect, useState } from 'react'

import { Button, Data, EmptyState, Rule } from '@repo/ui'

import { deleteAlert, fetchAlerts } from '../lib/api'

interface Alert {
  id: string
  channel: 'email' | 'web_push'
  lead_time_minutes: number
  target: { kind: 'artist' | 'genre'; slug: string | null; name: string | null }
}

type State =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; alerts: Alert[] }

export function AlertList() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [removing, setRemoving] = useState<string | null>(null)
  const [removalError, setRemovalError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    const result = await fetchAlerts()
    if (!result.ok) {
      setState(
        result.error.code === 'unauthorised'
          ? { kind: 'signed_out' }
          : { kind: 'error', message: result.error.message },
      )
      return
    }
    setState({ kind: 'ready', alerts: result.data.alerts })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(alert: Alert) {
    if (state.kind !== 'ready') return
    const previous = state.alerts
    setRemoving(alert.id)
    setRemovalError(null)
    setState({ kind: 'ready', alerts: previous.filter((entry) => entry.id !== alert.id) })

    const result = await deleteAlert(alert.id)
    setRemoving(null)
    if (!result.ok && result.error.code !== 'not_found') {
      setState({ kind: 'ready', alerts: previous })
      setRemovalError(`${alert.target.name ?? 'That alert'} is still set. ${result.error.message}`)
    }
  }

  if (state.kind === 'loading') {
    return (
      <p aria-busy="true" className="px-4 py-6 font-body text-body-s text-chalk-dim">
        Loading your alerts.
      </p>
    )
  }

  if (state.kind === 'signed_out') {
    return (
      <EmptyState label="ALERTS">
        <p className="font-body text-body text-chalk-dim">
          Sign in to see the alerts you have set.
        </p>
        <div className="mt-4">
          <Button variant="primary" href="/signin">
            <span className="font-data text-label uppercase tracking-label">sign in</span>
          </Button>
        </div>
      </EmptyState>
    )
  }

  if (state.kind === 'error') {
    return (
      <div role="alert" className="px-4 py-6">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">not loaded</p>
        <p className="mt-2 font-body text-body text-chalk">{state.message}</p>
        <div className="mt-4">
          <Button variant="primary" onClick={() => void load()}>
            <span className="font-data text-label uppercase tracking-label">try again</span>
          </Button>
        </div>
      </div>
    )
  }

  if (state.alerts.length === 0) {
    return (
      <EmptyState label="ALERTS">
        <p className="font-body text-body text-chalk-dim">
          Pick the genres you care about and we&rsquo;ll tell you when they&rsquo;re scheduled.
          That&rsquo;s the only thing we&rsquo;ll use it for.
        </p>
        <div className="mt-4">
          <Button variant="primary" href="/schedule">
            <span className="font-data text-label uppercase tracking-label">choose genres</span>
          </Button>
        </div>
      </EmptyState>
    )
  }

  return (
    <>
      {removalError ? (
        <p role="alert" className="px-4 pt-4 font-body text-body-s text-chalk">
          {removalError}
        </p>
      ) : null}

      <ul className="mt-2 list-none">
        {state.alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 transition-colors duration-hover hover:bg-deck"
          >
            <div className="min-w-0">
              <p className="font-display text-display-m uppercase text-chalk">
                {alert.target.name ?? alert.target.slug ?? 'Unknown'}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-data text-label uppercase tracking-label text-chalk-mute">
                  {alert.target.kind}
                </span>
                <span className="font-data text-label uppercase tracking-label text-chalk-mute">
                  {alert.channel === 'email' ? 'email' : 'web push'}
                </span>
                <Data className="text-chalk-dim">{formatLead(alert.lead_time_minutes)}</Data>
                <span className="font-data text-label uppercase tracking-label text-chalk-mute">
                  before
                </span>
              </p>
            </div>

            <Button
              variant="danger"
              onClick={() => void remove(alert)}
              disabled={removing === alert.id}
              aria-label={`Remove the alert for ${alert.target.name ?? alert.target.slug ?? 'this'}`}
            >
              <span className="font-data text-label uppercase tracking-label">
                {removing === alert.id ? 'removing…' : 'remove'}
              </span>
            </Button>
          </li>
        ))}
      </ul>

      <Rule className="my-8" />

      <p className="max-w-measure px-4 font-body text-body-s text-chalk-mute">
        Every notification carries a link that stops that alert in one click, without signing
        in.
      </p>
    </>
  )
}

/** `01:00` — an hour of lead time reads as a duration, not as prose. */
function formatLead(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
