/**
 * `GET /api/v1/schedule/ics/:showSlug` — a subscribable calendar for one show.
 *
 * Served as `text/calendar` so a browser offers to open it in the system calendar, and as
 * a stable URL so the same link can be subscribed to with `webcal://` and re-polled.
 * Not in 02-CONTRACTS.md §2; 05-AGENT-C §C2 requires it, and it is recorded as BLOCKER 7.
 */

import { buildShowCalendar, calendarFilename } from '../../lib/ics'
import { fail } from '../../lib/http'
import { getShowBySlug, listEpisodesForShow } from '../../lib/repository'

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/

export async function GET(
  request: Request,
  context: { params: Promise<{ showSlug: string }> },
): Promise<Response> {
  const { showSlug } = await context.params
  if (!SLUG.test(showSlug)) {
    return fail('bad_request', 'That is not a show slug.', 'showSlug')
  }

  const show = await getShowBySlug(showSlug)
  if (!show) {
    return fail('not_found', 'No show with that name. Check the schedule for what is running.')
  }

  const episodes = await listEpisodesForShow(show.id)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  const calendar = buildShowCalendar(show, episodes, {
    siteUrl,
    calendarName: show.title,
    calendarDescription: show.description ?? undefined,
  })

  return new Response(calendar, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${calendarFilename(show.slug)}"`,
      // Short cache: a subscriber re-polls hourly and the schedule changes by the day.
      'cache-control': 'public, max-age=900',
    },
  })
}
