'use client'

/**
 * "Listen" on the live row.
 *
 * Hands off to Agent A: this starts the stream through `BroadcastContext` and never touches
 * audio itself. It is the only primary (sodium) control on the listings page, which is what
 * keeps the amber rationing intact.
 */

import { Button } from '@repo/ui'

import { useBroadcast } from '../../../components/player/context'

export function ListenButton({ episodeId }: { episodeId: string }) {
  const broadcast = useBroadcast()
  const isPlayingThis = broadcast.isPlaying && broadcast.episode?.id === episodeId

  return (
    <Button
      variant="primary"
      onClick={() => (isPlayingThis ? broadcast.pause() : broadcast.play())}
      aria-label={isPlayingThis ? 'Pause the live broadcast' : 'Listen to the live broadcast'}
    >
      <span className="font-data text-label uppercase tracking-label">
        {isPlayingThis ? 'pause' : 'listen'}
      </span>
    </Button>
  )
}
