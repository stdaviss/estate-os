/**
 * The typed client for Agent C's API routes, and the response types the screens render.
 *
 * `apps/web` and `apps/api` are separate apps in the repository layout, so the pages talk
 * to the API over HTTP rather than importing its modules. Every call goes through
 * `request`, which turns a failure into a value rather than throwing, so each screen can
 * render the loading, error and retry states the quality floor requires
 * (00-FOUNDATION.md §9) instead of falling through to a framework error page.
 */

export interface ApiError {
  code: string
  message: string
  field?: string
}

export type ApiResult<T> = { ok: true; data: T; meta?: Record<string, unknown> } | { ok: false; error: ApiError }

export interface PublicGenre {
  slug: string
  name: string
  parent_slug: string | null
}

export interface PublicArtist {
  slug: string
  name: string
  relationship: 'guest' | 'affiliate' | 'roster' | 'alumni'
}

export interface PublicShow {
  slug: string
  title: string
  description: string | null
  artwork_url: string | null
  host: PublicArtist | null
  genres: PublicGenre[]
}

export interface EpisodeDisplay {
  local_time: string
  local_date: string
  local_offset: string
  local_timezone: string
  local_day_shift: number
  station_time: string
  station_date: string
  station_offset: string
  station_timezone: string
  duration: string
}

export interface PublicEpisode {
  id: string
  title: string
  show: PublicShow
  guest: PublicArtist | null
  starts_at: string
  ends_at: string
  state: 'scheduled' | 'live' | 'repeat_scheduled' | 'repeat_live' | 'expired'
  repeat_at: string | null
  duration_ms: number
  peak_listeners: number
  expired_at: string | null
  is_playable: boolean
  display: EpisodeDisplay
}

export interface ScheduleDay {
  date: string
  weekday: string
  stamp: string
  is_today: boolean
  is_past: boolean
  episodes: PublicEpisode[]
}

export interface SchedulePayload {
  timezone: string
  station_timezone: string
  from: string
  to: string
  live_episode_id: string | null
  is_empty: boolean
  days: ScheduleDay[]
}

export interface PublicTrack {
  position: number
  artist: string
  title: string
  played_at: string
  duration: string | null
  bpm: number | null
  musical_key: string | null
  track_id: string | null
}

export interface EpisodeDetail {
  episode: PublicEpisode
  tracklist: PublicTrack[]
  recording_available: false
}

export interface PostSummary {
  slug: string
  title: string
  standfirst: string | null
  author_name: string | null
  hero_url: string | null
  published_at: string | null
  is_published: boolean
  display: { date: string | null }
}

export interface PostDetail extends PostSummary {
  body_mdx: string
  related_artists: {
    slug: string
    name: string
    city: string | null
    image_url: string | null
    relationship: PublicArtist['relationship']
  }[]
}

export interface MixSide {
  track_id: string
  version_label: string
  audio_url: string
  duration_ms: number
  bpm: number | null
  musical_key: string | null
  display: { duration: string }
}

export interface MixPairPayload {
  pair: {
    pair_id: string
    base_title: string
    artist_name: string
    artist_slug: string
    a: MixSide
    b: MixSide
  } | null
  pair_count: number
  votes_cast?: number
}

export interface VoteSplit {
  pair_id: string
  a: number
  b: number
  total: number
  percent_a: number
  percent_b: number
}

function baseUrl(): string {
  // Server-rendered requests need an absolute URL; browser requests are same-origin.
  return process.env.NEXT_PUBLIC_API_URL ?? ''
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${baseUrl()}/api/v1${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
      // The schedule changes by the minute and the live row must be current.
      cache: 'no-store',
    })

    const payload: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      const error =
        payload && typeof payload === 'object' && 'error' in payload
          ? ((payload as { error: ApiError }).error)
          : { code: 'internal', message: 'The listings did not load.' }
      return { ok: false, error }
    }

    if (!payload || typeof payload !== 'object' || !('data' in payload)) {
      return { ok: false, error: { code: 'internal', message: 'The listings came back empty.' } }
    }

    const envelope = payload as { data: T; meta?: Record<string, unknown> }
    return { ok: true, data: envelope.data, meta: envelope.meta }
  } catch {
    // Network-level failure: the screen shows this with a retry rather than a stack trace.
    return {
      ok: false,
      error: { code: 'unreachable', message: 'Could not reach the station. Check your connection.' },
    }
  }
}

export function fetchSchedule(timeZone: string, range?: { from: string; to: string }) {
  const params = new URLSearchParams({ tz: timeZone })
  if (range) {
    params.set('from', range.from)
    params.set('to', range.to)
  }
  return request<SchedulePayload>(`/schedule?${params.toString()}`)
}

export function fetchEpisode(episodeId: string, timeZone: string) {
  return request<EpisodeDetail>(`/schedule/${episodeId}?tz=${encodeURIComponent(timeZone)}`)
}

export function fetchArchive(timeZone: string, cursor?: string | null) {
  const params = new URLSearchParams({ tz: timeZone })
  if (cursor) params.set('cursor', cursor)
  return request<EpisodeDetail[]>(`/schedule/archive?${params.toString()}`)
}

export function fetchPosts(tag?: string | null) {
  const params = new URLSearchParams()
  if (tag) params.set('tag', tag)
  const query = params.toString()
  return request<PostSummary[]>(`/posts${query ? `?${query}` : ''}`)
}

export function fetchPost(slug: string) {
  return request<PostDetail>(`/posts/${slug}`)
}

export function fetchMixPair(sessionKey: string) {
  return request<MixPairPayload>(`/games/which-mix?session_key=${encodeURIComponent(sessionKey)}`)
}

export function postGameEvent(body: {
  session_key: string
  event_type: string
  pair_id: string
  choice?: 'a' | 'b'
}) {
  return request<VoteSplit | { logged: true }>('/games/which-mix/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function postAlert(body: {
  genre?: string
  artist?: string
  channel: 'email' | 'web_push'
  lead_time_minutes: number
}) {
  return request<{ id: string }>('/alerts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteAlert(id: string) {
  return request<{ id: string; removed: boolean }>(`/alerts/${id}`, { method: 'DELETE' })
}

export function fetchAlerts() {
  return request<{
    alerts: {
      id: string
      channel: 'email' | 'web_push'
      lead_time_minutes: number
      target: { kind: 'artist' | 'genre'; slug: string | null; name: string | null }
    }[]
  }>('/alerts')
}
