/**
 * `GET|POST /api/v1/alerts/unsubscribe?token=…` — stop alerts with no login.
 *
 * Two methods on purpose:
 *
 * - POST is the RFC 8058 one-click path, which a mail client calls from its own
 *   "unsubscribe" button without opening a browser.
 * - GET is the link in the message body. It unsubscribes immediately, because
 *   05-AGENT-C §C3 asks for one click and a confirmation page would make it two.
 *
 * A GET with side effects is normally wrong, and link prefetchers can trigger it. The
 * trade is deliberate: the worst case is that alerts stop for someone who did not ask,
 * which is recoverable in the settings page and preferable to a confirmation step people
 * abandon. Both readings are recorded in SUBMISSION.md §8.
 */

import { fail } from '../../schedule/lib/http'
import { deleteSubscriptionByToken } from '../lib/repository'
import { verifyUnsubscribeToken } from '../lib/token'

export async function GET(request: Request): Promise<Response> {
  const outcome = await unsubscribe(request)
  if (outcome.kind === 'error') {
    return htmlResponse(outcome.status, outcome.heading, outcome.message)
  }
  return htmlResponse(
    200,
    'ALERTS OFF',
    outcome.alreadyGone
      ? 'That alert was already removed. You will not hear from us about it.'
      : 'That alert is removed. You can set new ones from your account page.',
  )
}

export async function POST(request: Request): Promise<Response> {
  const outcome = await unsubscribe(request)
  if (outcome.kind === 'error') {
    return fail(outcome.code, outcome.message)
  }
  return Response.json({ data: { removed: true } }, { status: 200 })
}

type Outcome =
  | { kind: 'ok'; alreadyGone: boolean }
  | {
      kind: 'error'
      code: 'bad_request' | 'forbidden'
      status: number
      heading: string
      message: string
    }

async function unsubscribe(request: Request): Promise<Outcome> {
  const secret = process.env.ALERTS_UNSUBSCRIBE_SECRET
  if (!secret) {
    return {
      kind: 'error',
      code: 'bad_request',
      status: 500,
      heading: 'NOT CONFIGURED',
      message: 'Unsubscribe links are not working right now. Mail hello@ and we will remove you.',
    }
  }

  const token = new URL(request.url).searchParams.get('token')
  if (!token) {
    return {
      kind: 'error',
      code: 'bad_request',
      status: 400,
      heading: 'NO TOKEN',
      message: 'This link is incomplete. Use the link in the message, or turn alerts off in your account.',
    }
  }

  const verified = verifyUnsubscribeToken(token, secret)
  if (!verified.valid) {
    return {
      kind: 'error',
      code: 'forbidden',
      status: 403,
      heading: 'LINK NOT VALID',
      message: 'This link has been altered or is not ours. Turn alerts off in your account instead.',
    }
  }

  const removed = await deleteSubscriptionByToken(
    verified.claims.subscriptionId,
    verified.claims.userId,
  )
  return { kind: 'ok', alreadyGone: !removed }
}

/**
 * A self-contained page, because this is opened from a mail client with no session and
 * must not depend on the app shell or on the audio player being mounted.
 *
 * Colours and type sizes are the tokens from 01-DESIGN-SYSTEM.md §2–3. They are inline
 * here rather than imported from `packages/ui` because this response is served by the API
 * app, outside React — the values are copied, not redefined, and this is the only such
 * place in the lane. Recorded in SUBMISSION.md §5.
 */
function htmlResponse(status: number, heading: string, message: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading.toLowerCase())}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #0A0E12; color: #E8E4DA; padding: 32px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  main { max-width: 448px; }
  h1 {
    margin: 0 0 16px; font-size: 10px; line-height: 12px; letter-spacing: 0.12em;
    text-transform: uppercase; font-weight: 400; color: rgba(232,228,218,0.62);
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
  p { margin: 0; font-size: 15px; line-height: 24px; }
  a { color: #4FB0A5; text-decoration: underline; text-underline-offset: 2px; }
  hr { border: 0; border-top: 1px solid rgba(232,228,218,0.10); margin: 24px 0; }
</style>
</head>
<body>
  <main>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    <hr>
    <p><a href="/schedule">See what is on</a></p>
  </main>
</body>
</html>
`
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
