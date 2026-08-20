/** HMAC unsubscribe tokens. No extra column on alert_subscriptions. */

import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  return process.env.ALERT_UNSUB_SECRET ?? 'dev-unsub-secret-change-me';
}

export function unsubscribeToken(subscriptionId: string): string {
  return createHmac('sha256', secret()).update(subscriptionId).digest('hex');
}

export function tokenMatches(subscriptionId: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(subscriptionId), 'hex');
  let provided: Buffer;
  try {
    provided = Buffer.from(token, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
