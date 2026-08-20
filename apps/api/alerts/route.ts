/**
 * `GET|POST /api/v1/alerts` — the listener's own alert subscriptions.
 *
 * The only place user data drives anything (00-FOUNDATION.md §5). Alerts are opt-in, and a
 * POST from a user who has not consented is refused rather than silently stored, so the
 * consent record and the subscription table cannot disagree.
 */

import { fail, ok } from '../schedule/lib/http'
import { readAlertsConsent } from './lib/consent'
import {
  createSubscription,
  listSubscriptionsForUser,
  resolveArtistId,
  resolveGenreId,
} from './lib/repository'
import { currentUser } from './lib/session'

const CHANNELS = ['email', 'web_push'] as const
/** 5 minutes to a week: shorter cannot be delivered reliably, longer is not an alert. */
const MIN_LEAD_MINUTES = 5
const MAX_LEAD_MINUTES = 7 * 24 * 60
const DEFAULT_LEAD_MINUTES = 60

export async function GET(): Promise<Response> {
  const user = await currentUser()
  if (!user) return fail('unauthorised', 'Sign in to see your alerts.')

  const subscriptions = await listSubscriptionsForUser(user.id)

  return ok({
    alerts: subscriptions.map((subscription) => ({
      id: subscription.id,
      channel: subscription.channel,
      lead_time_minutes: subscription.leadTimeMinutes,
      target:
        subscription.artistId && subscription.artistSlug
          ? { kind: 'artist' as const, slug: subscription.artistSlug, name: subscription.artistName }
          : { kind: 'genre' as const, slug: subscription.genreSlug, name: subscription.genreName },
    })),
  })
}

interface CreateBody {
  genre?: unknown
  artist?: unknown
  channel?: unknown
  lead_time_minutes?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const user = await currentUser()
  if (!user) return fail('unauthorised', 'Sign in to set an alert.')

  if (!(await readAlertsConsent(user.id))) {
    return fail(
      'forbidden',
      'Turn on alerts in your privacy settings first. We only use this to tell you when something is scheduled.',
      'consent_alerts',
    )
  }

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return fail('bad_request', 'Send a JSON body.')
  }

  const genreSlug = typeof body.genre === 'string' ? body.genre : null
  const artistSlug = typeof body.artist === 'string' ? body.artist : null

  if (!genreSlug && !artistSlug) {
    return fail('bad_request', 'Name a genre or an artist to be alerted about.', 'genre')
  }
  if (genreSlug && artistSlug) {
    // The table's check constraint allows either; one row per target keeps removal simple.
    return fail('bad_request', 'Set one alert per genre or artist, not both at once.', 'artist')
  }

  const channel = typeof body.channel === 'string' ? body.channel : 'email'
  if (!(CHANNELS as readonly string[]).includes(channel)) {
    return fail('bad_request', 'Choose email or web_push.', 'channel')
  }

  const leadRaw = body.lead_time_minutes
  const leadTimeMinutes =
    leadRaw === undefined || leadRaw === null ? DEFAULT_LEAD_MINUTES : Number(leadRaw)
  if (
    !Number.isInteger(leadTimeMinutes) ||
    leadTimeMinutes < MIN_LEAD_MINUTES ||
    leadTimeMinutes > MAX_LEAD_MINUTES
  ) {
    return fail(
      'bad_request',
      `Lead time is between ${MIN_LEAD_MINUTES} minutes and ${MAX_LEAD_MINUTES / 60} hours.`,
      'lead_time_minutes',
    )
  }

  const genreId = genreSlug ? await resolveGenreId(genreSlug) : null
  if (genreSlug && !genreId) {
    return fail('not_found', 'No genre by that name.', 'genre')
  }
  const artistId = artistSlug ? await resolveArtistId(artistSlug) : null
  if (artistSlug && !artistId) {
    return fail('not_found', 'No artist by that name.', 'artist')
  }

  const { subscription, created } = await createSubscription({
    userId: user.id,
    genreId,
    artistId,
    channel: channel as 'email' | 'web_push',
    leadTimeMinutes,
  })

  return ok(
    {
      id: subscription.id,
      channel: subscription.channel,
      lead_time_minutes: subscription.leadTimeMinutes,
    },
    { created },
  )
}
