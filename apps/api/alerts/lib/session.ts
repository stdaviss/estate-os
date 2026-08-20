/**
 * Session access for the alert routes.
 *
 * Auth is Agent B's lane (00-FOUNDATION.md §7). This adapter exists so the alert handlers
 * depend on a two-field shape rather than on Auth.js directly, which means the import
 * below is the single line to correct once Agent B's helper lands — see BLOCKER 8, where
 * the guessed module path is recorded.
 *
 * Roles are checked server-side in every handler that needs one, never on the client.
 */

import { auth } from '@repo/auth'

export interface SessionUser {
  id: string
  role: 'listener' | 'artist' | 'staff' | 'admin'
}

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return null
  return { id: user.id, role: user.role ?? 'listener' }
}

export function isStaff(user: SessionUser | null): boolean {
  return user?.role === 'staff' || user?.role === 'admin'
}
