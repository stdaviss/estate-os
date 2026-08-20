import { GET } from '../../../../api/alerts/index';
import { AlertsScreen, type AlertRow } from './screen';

export const metadata = { title: 'Alerts' };

function isAlertRow(value: unknown): value is AlertRow {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.id === 'string' && typeof rec.channel === 'string';
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ empty?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const url = new URL('http://local/api/v1/alerts');
  if (sp.empty) url.searchParams.set('empty', sp.empty);
  const res = await GET(
    new Request(url.toString(), { headers: { 'x-user-id': 'listener-dev' } }),
  );
  const body = (await res.json()) as { data?: unknown };
  const rows = Array.isArray(body.data) ? body.data.filter(isAlertRow) : [];
  return (
    <AlertsScreen
      initial={rows}
      empty={sp.empty === '1' || process.env.EMPTY === '1'}
    />
  );
}
