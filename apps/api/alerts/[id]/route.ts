/**
 * `DELETE /api/v1/alerts/:id` — remove one alert from the settings page.
 *
 * Ownership is checked in the delete predicate rather than by fetching first, so there is
 * no window between the check and the write, and a request for somebody else's
 * subscription is indistinguishable from one for a row that does not exist.
 */

import { fail, ok } from '../../schedule/lib/http'
import { deleteSubscription } from '../lib/repository'
import { currentUser } from '../lib/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await currentUser()
  if (!user) return fail('unauthorised', 'Sign in to change your alerts.')

  const { id } = await context.params
  if (!UUID.test(id)) return fail('bad_request', 'That is not an alert id.', 'id')

  const removed = await deleteSubscription(id, user.id)
  if (!removed) return fail('not_found', 'That alert is already gone.')

  return ok({ id, removed: true })
}
