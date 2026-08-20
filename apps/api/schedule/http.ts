/** JSON envelope helpers matching 02-CONTRACTS §2. */

export type ApiErrorBody = {
  error: { code: string; message: string; field?: string };
};

export function jsonOk(data: unknown, meta?: { next_cursor: string | null }): Response {
  const body = meta ? { data, meta } : { data };
  return Response.json(body, {
    headers: { 'cache-control': 'no-store' },
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  field?: string,
): Response {
  const error: ApiErrorBody['error'] = { code, message };
  if (field) error.field = field;
  return Response.json({ error }, { status });
}

export function readCursor(url: URL): { cursor: string | null; limit: number } {
  const rawLimit = url.searchParams.get('limit');
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : 20;
  const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 20;
  return { cursor: url.searchParams.get('cursor'), limit };
}

export function paginateIds<T extends { id: string }>(
  items: T[],
  cursor: string | null,
  limit: number,
): { slice: T[]; next_cursor: string | null } {
  const start = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
  const from = start < 1 && cursor ? items.length : start;
  const slice = items.slice(from, from + limit);
  const last = slice[slice.length - 1];
  const more = from + slice.length < items.length;
  return { slice, next_cursor: more && last ? last.id : null };
}
