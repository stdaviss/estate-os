import './../schedule/_lib/c-lane.css';
import { GET } from '../../../api/schedule/archive';
import { ArchiveScreen } from './screen';
import type { PublicEpisode } from '../../../api/schedule/serialize';

export const metadata = { title: 'Archive' };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ empty?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const url = new URL('http://local/api/v1/archive?limit=40');
  if (sp.empty) url.searchParams.set('empty', sp.empty);
  const res = await GET(new Request(url.toString()));
  const body = (await res.json()) as { data: PublicEpisode[] };
  return <ArchiveScreen episodes={body.data} />;
}
