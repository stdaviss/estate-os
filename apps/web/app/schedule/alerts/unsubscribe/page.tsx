import { DELETE } from '../../../../../api/alerts/index';
import { Button } from '../../../schedule/_lib/ui';

export const metadata = { title: 'Unsubscribe' };

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const token = sp.token ?? '';
  const url = new URL('http://local/api/v1/alerts');
  url.searchParams.set('token', token);
  const res = await DELETE(new Request(url.toString(), { method: 'DELETE' }));
  const ok = res.ok;

  return (
    <main className="c-page">
      <header className="c-page-head">
        <h1 className="c-display-l">Alerts</h1>
      </header>
      <p className="c-body-l">
        {ok ? 'This alert is off. You will not get another notice for it.' : 'This unsubscribe link is not valid. The alert was not changed.'}
      </p>
      <Button href="/schedule/alerts">Alert settings</Button>
    </main>
  );
}
