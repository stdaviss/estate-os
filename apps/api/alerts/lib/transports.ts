/**
 * Alert transports.
 *
 * Email only. `alert_subscriptions.channel` allows `web_push`, but a push subscription is
 * a browser-issued endpoint plus two keys, and 02-CONTRACTS.md §1 has no table to store
 * them in — see BLOCKER 10. Rather than ship a push transport that cannot address anybody,
 * none is registered: a `web_push` subscription is reported as `no_transport` by the
 * delivery run instead of appearing to have been sent. The alerts form offers email only
 * and says so.
 *
 * The transport speaks plain HTTP to a provider endpoint given by env var. No provider is
 * named in the briefs, and adding an SDK means editing `apps/api/package.json`, which
 * Agent C does not own (BLOCKER 9); most providers' REST APIs fit this shape. With the
 * variables unset it throws, so a run reports a failure rather than discarding mail.
 */

import { unsubscribeHeaders } from './copy'
import type { AlertTransport } from './delivery'

export function emailTransport(): AlertTransport {
  return {
    channel: 'email',
    async send(recipient, copy) {
      const endpoint = process.env.ALERTS_EMAIL_ENDPOINT
      const apiKey = process.env.ALERTS_EMAIL_API_KEY
      const from = process.env.ALERTS_EMAIL_FROM
      if (!endpoint || !apiKey || !from) {
        throw new Error('email transport is not configured')
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from,
          to: recipient.email,
          subject: copy.subject,
          text: copy.body,
          headers: unsubscribeHeaders(copy.unsubscribeUrl),
        }),
      })

      if (!response.ok) {
        throw new Error(`email provider returned ${response.status}`)
      }
    },
  }
}

/** Channels a delivery run can actually address. */
export function availableTransports(): AlertTransport[] {
  return [emailTransport()]
}
