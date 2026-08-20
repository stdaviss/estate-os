import { PlayScreen } from './screen';

export const metadata = { title: 'Which mix' };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ empty?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  return <PlayScreen empty={sp.empty === '1' || process.env.EMPTY === '1'} />;
}
