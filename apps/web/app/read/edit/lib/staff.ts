/**
 * Staff check for the editor page.
 *
 * Auth is Agent B's lane, so this is an adapter around their Auth.js helper and the one
 * line to correct once it lands — the module path is a guess, recorded as BLOCKER 8.
 */

import { auth } from '@repo/auth'

export interface StaffUser {
  id: string
  displayName: string | null
}

export async function currentStaffUser(): Promise<StaffUser | null> {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return null
  if (user.role !== 'staff' && user.role !== 'admin') return null
  return { id: user.id, displayName: user.name ?? null }
}
