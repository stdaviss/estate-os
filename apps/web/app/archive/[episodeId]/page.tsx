import { GET } from '../../../../api/schedule/archive';
import { ArchiveEpisodeScreen } from './screen';
import type { PublicEpisode } from '../../../../api/schedule/serialize';

export const metadata = { title: 'Archive' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }> | { episodeId: string };
  searchParams?: Promise<{ empty?: string }>;
}) {
  const { episodeId } = await Promise.resolve(params);
  const sp = searchParams ? await searchParams : {};
  if (sp.empty === '1' || process.env.EMPTY === '1') {
    return <ArchiveEpisodeScreen episode={null} />;
  }
  const res = await GET(new Request(`http://local/api/v1/archive/${episodeId}`));
  if (!res.ok) return <ArchiveEpisodeScreen episode={null} />;
  const body = (await res.json()) as { data: PublicEpisode };
  return <ArchiveEpisodeScreen episode={body.data} />;
}
