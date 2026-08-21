import { Data } from '@repo/ui'

import type { PublicTrack } from '../../schedule/lib/api'

export interface TracklistProps {
  tracks: PublicTrack[]
  /** The time each track played, as a wall clock. Off for a compact listing. */
  showPlayedAt?: boolean
}

/**
 * The tracklist.
 *
 * This is the artefact: the only surviving trace of an expired show, and the thing people
 * screenshot. Built as dense mono on hairline rules with nothing else — no artwork, no
 * badges, no hover affordance suggesting playback, and no control of any kind. There is
 * deliberately nothing here to click except an artist name.
 *
 * A table rather than a list because it is tabular data, which also gives screen readers
 * row and column context for a hundred-row tracklist.
 */
export function Tracklist({ tracks, showPlayedAt = true }: TracklistProps) {
  if (tracks.length === 0) {
    return (
      <p className="px-4 py-3 font-body text-body-s text-chalk-mute">
        No tracklist was logged for this show.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">
        Tracklist, {tracks.length} tracks. Not available to listen to.
      </caption>
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className="w-10 px-4 py-2 font-data text-label uppercase tracking-label text-chalk-mute">
            #
          </th>
          <th scope="col" className="px-4 py-2 font-data text-label uppercase tracking-label text-chalk-mute">
            artist — title
          </th>
          <th scope="col" className="hidden px-4 py-2 text-right font-data text-label uppercase tracking-label text-chalk-mute sm:table-cell">
            bpm
          </th>
          <th scope="col" className="hidden px-4 py-2 text-right font-data text-label uppercase tracking-label text-chalk-mute sm:table-cell">
            key
          </th>
          {showPlayedAt ? (
            <th scope="col" className="px-4 py-2 text-right font-data text-label uppercase tracking-label text-chalk-mute">
              played
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {tracks.map((track) => (
          <tr key={`${track.position}-${track.title}`} className="border-b border-rule align-baseline">
            <td className="px-4 py-2">
              <Data className="text-chalk-mute">{pad2(track.position)}</Data>
            </td>
            <td className="px-4 py-2">
              <span className="font-body text-body-s text-chalk">
                <span className="text-chalk-dim">{track.artist}</span>
                <span className="text-chalk-mute"> — </span>
                {track.title}
              </span>
              {track.duration ? (
                <span className="ml-2 font-data text-label tracking-label text-chalk-mute">
                  {track.duration}
                </span>
              ) : null}
            </td>
            <td className="hidden px-4 py-2 text-right sm:table-cell">
              {track.bpm === null ? (
                <span className="font-data text-data text-chalk-mute">—</span>
              ) : (
                <Data className="text-chalk-dim">{pad3(track.bpm)}</Data>
              )}
            </td>
            <td className="hidden px-4 py-2 text-right sm:table-cell">
              {track.musical_key === null ? (
                <span className="font-data text-data text-chalk-mute">—</span>
              ) : (
                <Data className="text-chalk-dim">{track.musical_key}</Data>
              )}
            </td>
            {showPlayedAt ? (
              <td className="px-4 py-2 text-right">
                <Data className="text-chalk-mute">{clock(track.played_at)}</Data>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * The wall clock a track played, in the station's zone.
 *
 * A tracklist is a record of one evening in one room, so it reads in the time of that room
 * rather than converted into the reader's. Scheduling is the opposite and converts.
 */
function clock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function pad3(value: number): string {
  return String(value).padStart(3, '0')
}
