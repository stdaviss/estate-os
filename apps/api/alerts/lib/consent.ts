/**
 * Reading the alerts consent flag.
 *
 * Consent lives on `users` and the account surface is Agent B's lane, so this is a
 * one-function read rather than anything that writes. Alerts are opt-in
 * (00-FOUNDATION.md §5): a subscription is refused unless this returns true.
 */

import { eq } from 'drizzle-orm'

import { db } from '@repo/schema/client'
import { users } from '@repo/schema'

export async function readAlertsConsent(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ consentAlerts: users.consentAlerts, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row || row.deletedAt !== null) return false
  return row.consentAlerts
}
