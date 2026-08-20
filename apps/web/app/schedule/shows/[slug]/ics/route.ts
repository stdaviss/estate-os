import { buildShowCalendar } from '../../../../../api/schedule/ics';
import { buildFixtures, isEmptyMode } from '../../../../../api/schedule/fixtures';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  const params = await Promise.resolve(context.params);
  const url = new URL(request.url);
  const { episodes } = isEmptyMode(process.env, url) ? { episodes: [] } : buildFixtures();
  const upcoming = episodes.filter(
    (ep) =>
      ep.show.slug === params.slug &&
      (ep.state === 'scheduled' || ep.state === 'repeat_scheduled'),
  );
  const showTitle = upcoming[0]?.show.title ?? params.slug;
  const body = buildShowCalendar({
    showSlug: params.slug,
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
      'content-disposition': `attachment; filename="${params.slug}.ics"`,
    },
  });
}
