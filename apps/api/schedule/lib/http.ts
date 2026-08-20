/**
 * The `{ data, meta? }` / `{ error: { code, message, field? } }` envelope from
 * 02-CONTRACTS.md §2, plus cursor pagination parsing.
 *
 * This lives under `apps/api/schedule/lib` because that is the first path Agent C owns;
 * `alerts`, `posts` and `games` import it from here. It belongs in a shared
 * `apps/api/_lib` (or `packages/types`) and is listed as BLOCKER 4 in SUBMISSION.md —
 * the alternative was four copies of the same envelope, which drifts.
 */

export interface ResponseMeta {
  next_cursor?: string | null
  [key: string]: unknown
}

export type ErrorCode =
  | 'bad_request'
  | 'unauthorised'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorised: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
}

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 100

export function ok<T>(data: T, meta?: ResponseMeta, init?: ResponseInit): Response {
  return Response.json(meta ? { data, meta } : { data }, {
    status: 200,
    ...init,
    headers: { 'cache-control': 'no-store', ...(init?.headers ?? {}) },
  })
}

export function fail(code: ErrorCode, message: string, field?: string): Response {
  return Response.json(
    { error: field ? { code, message, field } : { code, message } },
    { status: STATUS_BY_CODE[code], headers: { 'cache-control': 'no-store' } },
  )
}

export interface Pagination {
  limit: number
  cursor: string | null
}

/** Clamps rather than rejecting, so a stale client link keeps working. */
export function readPagination(url: URL): Pagination {
  const rawLimit = url.searchParams.get('limit')
  const parsed = rawLimit === null ? DEFAULT_LIMIT : Number.parseInt(rawLimit, 10)
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_LIMIT) : DEFAULT_LIMIT
  return { limit, cursor: url.searchParams.get('cursor') }
}

/**
 * Opaque cursor over `(starts_at, id)`. Base64url of the pair rather than an offset, so
 * pagination stays stable while episodes are being scheduled underneath it.
 */
export function encodeCursor(startsAt: Date, id: string): string {
  return Buffer.from(`${startsAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): { startsAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    if (!iso || !id) return null
    const startsAt = new Date(iso)
    if (Number.isNaN(startsAt.getTime())) return null
    return { startsAt, id }
  } catch {
    return null
  }
}

/**
 * Reads the viewer's IANA timezone from `?tz=`, falling back to the station zone.
 * Rejects unknown identifiers so a typo surfaces as a 400 rather than silently
 * rendering the wrong times, which is the failure that breaks appointment listening.
 */
export function readTimeZone(url: URL, fallback: string): { timeZone: string; invalid: boolean } {
  const requested = url.searchParams.get('tz')
  if (!requested) return { timeZone: fallback, invalid: false }
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: requested })
    return { timeZone: requested, invalid: false }
  } catch {
    return { timeZone: fallback, invalid: true }
  }
}
