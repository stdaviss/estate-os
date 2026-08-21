/**
 * Signed unsubscribe tokens.
 *
 * 05-AGENT-C §C3 requires unsubscribing in one click from the notification itself with no
 * login. That means the link has to carry its own authority, so it is an HMAC over the
 * subscription id — capability, not session. Nothing in the token is secret; the point is
 * that it cannot be forged or edited to unsubscribe somebody else.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const VERSION = 'v1'
/** Scope string, so a token minted for unsubscribing is useless for anything else. */
const PURPOSE = 'alerts:unsubscribe'

export interface UnsubscribeClaims {
  subscriptionId: string
  userId: string
}

export function signUnsubscribeToken(claims: UnsubscribeClaims, secret: string): string {
  assertSecret(secret)
  const payload = encodePayload(claims)
  return `${payload}.${sign(payload, secret)}`
}

export type TokenVerification =
  | { valid: true; claims: UnsubscribeClaims }
  | { valid: false; reason: 'malformed' | 'bad_signature' }

export function verifyUnsubscribeToken(token: string, secret: string): TokenVerification {
  assertSecret(secret)
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return { valid: false, reason: 'malformed' }

  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)

  if (!constantTimeEquals(signature, sign(payload, secret))) {
    return { valid: false, reason: 'bad_signature' }
  }

  const claims = decodePayload(payload)
  if (!claims) return { valid: false, reason: 'malformed' }
  return { valid: true, claims }
}

/**
 * The link placed in every notification. Absolute, because it is opened from a mail
 * client with no notion of the site origin.
 */
export function unsubscribeUrl(
  siteUrl: string,
  claims: UnsubscribeClaims,
  secret: string,
): string {
  const token = signUnsubscribeToken(claims, secret)
  return `${siteUrl.replace(/\/+$/, '')}/api/v1/alerts/unsubscribe?token=${encodeURIComponent(token)}`
}

function encodePayload(claims: UnsubscribeClaims): string {
  return Buffer.from(
    JSON.stringify({ v: VERSION, p: PURPOSE, s: claims.subscriptionId, u: claims.userId }),
    'utf8',
  ).toString('base64url')
}

function decodePayload(payload: string): UnsubscribeClaims | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    if (record.v !== VERSION || record.p !== PURPOSE) return null
    if (typeof record.s !== 'string' || typeof record.u !== 'string') return null
    if (record.s.length === 0 || record.u.length === 0) return null
    return { subscriptionId: record.s, userId: record.u }
  } catch {
    return null
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${VERSION}.${PURPOSE}.${payload}`).digest('base64url')
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function assertSecret(secret: string): void {
  // A short or absent secret makes the token forgeable, so fail at the call site rather
  // than issuing links that look signed and are not.
  if (!secret || secret.length < 32) {
    throw new Error('ALERTS_UNSUBSCRIBE_SECRET must be set and at least 32 characters')
  }
}
