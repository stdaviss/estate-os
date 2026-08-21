/**
 * The delivery log.
 *
 * 02-CONTRACTS.md §1 has no table to record what has been sent, so there is nowhere
 * durable to put a dedupe key — BLOCKER 3 proposes `alert_deliveries`. Until that exists
 * this returns the in-memory log, which is correct within one process and forgets
 * everything on restart.
 *
 * The consequence is stated plainly rather than hidden: a redeploy or a second instance
 * during a delivery window can send one person a second notification for one episode,
 * which is exactly what §C3 forbids. It is listed in SUBMISSION.md §9 as a known defect,
 * and `PostgresDeliveryLog` below is the shape of the fix.
 */

import { InMemoryDeliveryLog, type DeliveryLog } from './delivery'

let shared: DeliveryLog | null = null

export function deliveryLog(): DeliveryLog {
  if (!shared) shared = new InMemoryDeliveryLog()
  return shared
}

/**
 * The durable implementation, once `alert_deliveries` exists. Left as documentation of the
 * intended shape rather than dead code that appears to work:
 *
 * ```ts
 * export class PostgresDeliveryLog implements DeliveryLog {
 *   async sentKeys(episodeIds: string[]): Promise<Set<string>> {
 *     const rows = await db
 *       .select({ dedupeKey: alertDeliveries.dedupeKey })
 *       .from(alertDeliveries)
 *       .where(inArray(alertDeliveries.episodeId, episodeIds))
 *     return new Set(rows.map((row) => row.dedupeKey))
 *   }
 *
 *   async record(notification: PlannedNotification): Promise<void> {
 *     // The unique index on dedupe_key is what makes this safe with two instances
 *     // running: the second insert conflicts instead of producing a second send.
 *     await db.insert(alertDeliveries).values({ ... }).onConflictDoNothing()
 *   }
 * }
 * ```
 */
export const DURABLE_LOG_BLOCKER = 3
