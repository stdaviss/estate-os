'use client'

/**
 * "Which mix?" — the game.
 *
 * Audio coordination: the live stream is paused through `BroadcastContext` when a clip
 * starts and resumed when the page is left or the game ends, so two things are never playing
 * at once and the transport is never fought over. Only one clip plays at a time here too.
 *
 * Keyboard: `A` and `B` play each side, `1` and `2` vote, `Space` stops. Every control is a
 * real button in tab order with a visible sodium focus ring, so nothing depends on the
 * shortcuts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { Button, Data, EmptyState, Rule } from '@repo/ui'

import { useBroadcast } from '../../../components/player/context'
import {
  fetchMixPair,
  postGameEvent,
  type MixPairPayload,
  type MixSide,
  type VoteSplit,
} from '../../schedule/lib/api'
import { getSessionKey } from '../lib/session-key'

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'playing'; pair: NonNullable<MixPairPayload['pair']> }
  | { kind: 'voted'; pair: NonNullable<MixPairPayload['pair']>; split: VoteSplit; choice: 'a' | 'b' }

export function WhichMix() {
  const broadcast = useBroadcast()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [nowPlaying, setNowPlaying] = useState<'a' | 'b' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionKeyRef = useRef<string | null>(null)
  /** Whether the stream was playing when the game took over, so it can be put back. */
  const resumeStreamRef = useRef(false)

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' })
    const sessionKey = sessionKeyRef.current ?? getSessionKey()
    sessionKeyRef.current = sessionKey

    const result = await fetchMixPair(sessionKey)
    if (!result.ok) {
      setPhase({ kind: 'error', message: result.error.message })
      return
    }
    if (!result.data.pair) {
      setPhase({ kind: 'empty' })
      return
    }
    setPhase({ kind: 'playing', pair: result.data.pair })
    void postGameEvent({
      session_key: sessionKey,
      event_type: 'pair.served',
      pair_id: result.data.pair.pair_id,
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stopClip = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setNowPlaying(null)
  }, [])

  // Put the stream back on the way out, whether the listener voted or just left.
  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (audio) audio.pause()
      if (resumeStreamRef.current) broadcast.play()
    }
  }, [broadcast])

  const playSide = useCallback(
    async (side: 'a' | 'b', pair: NonNullable<MixPairPayload['pair']>) => {
      if (broadcast.isPlaying) {
        resumeStreamRef.current = true
        broadcast.pause()
      }

      const audio = audioRef.current
      if (!audio) return

      const source = side === 'a' ? pair.a.audio_url : pair.b.audio_url
      if (audio.src !== source) audio.src = source
      audio.currentTime = 0

      try {
        await audio.play()
        setNowPlaying(side)
        void postGameEvent({
          session_key: sessionKeyRef.current ?? getSessionKey(),
          event_type: 'pair.played',
          pair_id: pair.pair_id,
        })
      } catch {
        // Autoplay refusal or a missing file: the buttons stay usable and nothing throws.
        setNowPlaying(null)
      }
    },
    [broadcast],
  )

  const vote = useCallback(
    async (choice: 'a' | 'b', pair: NonNullable<MixPairPayload['pair']>) => {
      stopClip()
      const result = await postGameEvent({
        session_key: sessionKeyRef.current ?? getSessionKey(),
        event_type: 'pair.voted',
        pair_id: pair.pair_id,
        choice,
      })

      if (!result.ok) {
        setPhase({ kind: 'error', message: result.error.message })
        return
      }
      if ('total' in result.data) {
        setPhase({ kind: 'voted', pair, split: result.data, choice })
      }
    },
    [stopClip],
  )

  useEffect(() => {
    if (phase.kind !== 'playing') return
    const pair = phase.pair

    function onKeyDown(event: KeyboardEvent) {
      // Never hijack a key a listener is typing into a field.
      const target = event.target
      if (target instanceof HTMLElement && /input|textarea|select/i.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      switch (event.key.toLowerCase()) {
        case 'a':
          event.preventDefault()
          void playSide('a', pair)
          break
        case 'b':
          event.preventDefault()
          void playSide('b', pair)
          break
        case '1':
          event.preventDefault()
          void vote('a', pair)
          break
        case '2':
          event.preventDefault()
          void vote('b', pair)
          break
        case ' ':
          event.preventDefault()
          stopClip()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, playSide, vote, stopClip])

  if (phase.kind === 'loading') {
    return (
      <p aria-busy="true" className="px-4 py-8 font-body text-body-s text-chalk-dim">
        Finding a pair.
      </p>
    )
  }

  if (phase.kind === 'error') {
    return (
      <div role="alert" className="px-4 py-8">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">not loaded</p>
        <p className="mt-2 font-body text-body text-chalk">{phase.message}</p>
        <div className="mt-4">
          <Button variant="primary" onClick={() => void load()}>
            <span className="font-data text-label uppercase tracking-label">try again</span>
          </Button>
        </div>
      </div>
    )
  }

  if (phase.kind === 'empty') {
    return (
      <EmptyState label="NOTHING TO PLAY">
        <p className="font-body text-body text-chalk-dim">
          There are no pairs in the catalogue yet. This needs two versions of one track, and the
          first will come from someone sending us a mix.
        </p>
        <div className="mt-4">
          <Button variant="primary" href="/submit">
            <span className="font-data text-label uppercase tracking-label">send us a mix</span>
          </Button>
        </div>
      </EmptyState>
    )
  }

  const pair = phase.pair
  const voted = phase.kind === 'voted' ? phase : null

  return (
    <div className="py-6">
      {/* Not user-visible: the buttons below are the controls. */}
      <audio ref={audioRef} preload="none" onEnded={() => setNowPlaying(null)} />

      <header>
        <h2 className="font-display text-display-m uppercase text-chalk">{pair.base_title}</h2>
        <p className="mt-1 font-body text-body-s text-chalk-dim">
          <Link
            href={`/artists/${pair.artist_slug}`}
            className="rounded text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
          >
            {pair.artist_name}
          </Link>
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Side
          letter="A"
          side={pair.a}
          isPlaying={nowPlaying === 'a'}
          isChosen={voted?.choice === 'a'}
          percent={voted?.split.percent_a ?? null}
          onPlay={() => void playSide('a', pair)}
          onStop={stopClip}
          onVote={voted ? null : () => void vote('a', pair)}
        />
        <Side
          letter="B"
          side={pair.b}
          isPlaying={nowPlaying === 'b'}
          isChosen={voted?.choice === 'b'}
          percent={voted?.split.percent_b ?? null}
          onPlay={() => void playSide('b', pair)}
          onStop={stopClip}
          onVote={voted ? null : () => void vote('b', pair)}
        />
      </div>

      <Rule className="my-8" />

      {voted ? (
        <div>
          <p className="font-data text-label uppercase tracking-label text-chalk-mute">the split</p>
          <p className="mt-2 font-body text-body text-chalk">
            <Data>{String(voted.split.percent_a).padStart(2, '0')}</Data>
            <span className="text-chalk-dim"> per cent for A, </span>
            <Data>{String(voted.split.percent_b).padStart(2, '0')}</Data>
            <span className="text-chalk-dim"> for B, from </span>
            <Data>{String(voted.split.total).padStart(4, '0')}</Data>
            <span className="text-chalk-dim"> votes.</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void load()}>
              <span className="font-data text-label uppercase tracking-label">another pair</span>
            </Button>
            <Button variant="ghost" href="/schedule">
              <span className="font-data text-label uppercase tracking-label">back to the schedule</span>
            </Button>
          </div>
        </div>
      ) : (
        <p className="font-body text-body-s text-chalk-mute">
          Keyboard: <kbd className="font-data text-data">A</kbd> and{' '}
          <kbd className="font-data text-data">B</kbd> play, <kbd className="font-data text-data">1</kbd>{' '}
          and <kbd className="font-data text-data">2</kbd> vote,{' '}
          <kbd className="font-data text-data">Space</kbd> stops.
        </p>
      )}
    </div>
  )
}

interface SideProps {
  letter: 'A' | 'B'
  side: MixSide
  isPlaying: boolean
  isChosen: boolean
  percent: number | null
  onPlay: () => void
  onStop: () => void
  onVote: (() => void) | null
}

function Side({ letter, side, isPlaying, isChosen, percent, onPlay, onStop, onVote }: SideProps) {
  return (
    <section
      aria-label={`Version ${letter}`}
      className={`rounded border p-4 ${isChosen ? 'border-sodium' : 'border-rule'}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-display text-display-m uppercase text-chalk">{letter}</span>
        <Data className="text-chalk-mute">{side.display.duration}</Data>
      </div>

      {/* The version label is withheld until after the vote: knowing which one is the
          "original" is exactly the bias this is trying to measure around. */}
      <p className="mt-2 font-body text-body-s text-chalk-dim">
        {percent === null ? 'Unlabelled until you vote.' : side.version_label}
      </p>

      <dl className="mt-3 flex gap-6">
        <div>
          <dt className="font-data text-label uppercase tracking-label text-chalk-mute">bpm</dt>
          <dd className="mt-1">
            <Data>{side.bpm === null ? '—' : String(side.bpm).padStart(3, '0')}</Data>
          </dd>
        </div>
        <div>
          <dt className="font-data text-label uppercase tracking-label text-chalk-mute">key</dt>
          <dd className="mt-1">
            <Data>{side.musical_key ?? '—'}</Data>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          onClick={isPlaying ? onStop : onPlay}
          aria-label={isPlaying ? `Stop version ${letter}` : `Play version ${letter}`}
        >
          <span className="font-data text-label uppercase tracking-label">
            {isPlaying ? 'stop' : 'play'}
          </span>
        </Button>

        {onVote ? (
          <Button variant="primary" onClick={onVote} aria-label={`Vote for version ${letter}`}>
            <span className="font-data text-label uppercase tracking-label">this one</span>
          </Button>
        ) : percent !== null ? (
          <span className="font-data text-label uppercase tracking-label text-chalk-dim">
            {String(percent).padStart(2, '0')} per cent
          </span>
        ) : null}
      </div>
    </section>
  )
}
