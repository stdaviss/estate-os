import '../schedule/_lib/c-lane.css';
import { GET } from '../../../api/schedule/index';
import { ScheduleScreen, type ScheduleData } from './screen';
import { STATION_TZ } from '../../../api/schedule/timezone';

export const metadata = { title: 'Schedule' };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ empty?: string; tz?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const url = new URL('http://local/api/v1/schedule');
  if (sp.empty) url.searchParams.set('empty', sp.empty);
  url.searchParams.set('tz', sp.tz ?? STATION_TZ);
  const res = await GET(new Request(url.toString()));
  const body = (await res.json()) as { data: ScheduleData };
  return <ScheduleScreen initial={body.data} />;
}
