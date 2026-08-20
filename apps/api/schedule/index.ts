/** GET /api/v1/schedule and GET /api/v1/schedule/:episodeId */

import { buildFixtures, defaultScheduleWindow, episodesInRange, isEmptyMode } from './fixtures';
import { jsonError, jsonOk } from './http';
import { buildShowCalendar } from './ics';
import { toPublicEpisode, type PublicEpisode } from './serialize';
import { formatListingDate, STATION_TZ } from './timezone';

function groupByDay(episodes: PublicEpisode[], visitorTz: string) {
  const days: { date: string; label: string; episodes: PublicEpisode[] }[] = [];
  const index = new Map<string, number>();
  for (const ep of episodes) {
    const date = formatListingDate(ep.starts_at, visitorTz);
    const existing = index.get(date);
    if (existing === undefined) {
      index.set(date, days.length);
      days.push({ date, label: date, episodes: [ep] });
    } else {
      days[existing]?.episodes.push(ep);
    }
  }
  return days;
}

function visitorTzFrom(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get('tz') || STATION_TZ;
}

export async function GET(
  request: Request,
  context?: { params?: Promise<{ episodeId?: string }> | { episodeId?: string } },
): Promise<Response> {
  const url = new URL(request.url);
  const params = context?.params ? await Promise.resolve(context.params) : undefined;
  const pathParts = url.pathname.split('/').filter(Boolean);
  const last = pathParts[pathParts.length - 1] ?? '';
  const episodeId = params?.episodeId || (last && last !== 'schedule' ? last : '');

  if (url.pathname.endsWith('.ics') || url.searchParams.get('format') === 'ics') {
    return icsResponse(url);
  }

  const empty = isEmptyMode(process.env, url);
  const { now, episodes } = empty
    ? { now: new Date(), episodes: [] }
    : buildFixtures();

  if (episodeId && episodeId !== 'schedule') {
    const row = episodes.find((ep) => ep.id === episodeId);
    if (!row) {
      return jsonError(404, 'not_found', 'No episode with that id.');
    }
    const includeTracklist = row.state === 'expired';
    return jsonOk(toPublicEpisode(row, { includeTracklist }));
  }

  const window = defaultScheduleWindow(now);
  const from = url.searchParams.get('from') ?? window.from;
  const to = url.searchParams.get('to') ?? window.to;
  const ranged = episodesInRange(episodes, from, to).sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  const publicEpisodes = ranged.map((row) => toPublicEpisode(row, { includeTracklist: false }));
  const tz = visitorTzFrom(request);

  return jsonOk({
    timezone: STATION_TZ,
    from,
    to,
    days: groupByDay(publicEpisodes, tz),
  });
}

function icsResponse(url: URL): Response {
  const slug = url.searchParams.get('show') ?? url.pathname.split('/').filter(Boolean).at(-2) ?? '';
  const { episodes } = isEmptyMode(process.env, url) ? { episodes: [] } : buildFixtures();
  const upcoming = episodes.filter(
    (ep) => ep.show.slug === slug && (ep.state === 'scheduled' || ep.state === 'repeat_scheduled'),
  );
  const showTitle = upcoming[0]?.show.title ?? slug;
  const body = buildShowCalendar({
    showSlug: slug,
    showTitle,
    episodes: upcoming.map((ep) => ({
      id: ep.id,
      title: ep.title,
      starts_at: ep.starts_at,
      ends_at: ep.ends_at,
      showTitle: ep.show.title,
      hostName: ep.host?.name ?? null,
      guestName: ep.guest?.name ?? null,
    })),
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}.ics"`,
      'cache-control': 'no-store',
    },
  });
}
