/** In-memory alert store used when packages/schema is not available. */

export type AlertChannel = 'email' | 'web_push';

export type AlertSubscription = {
  id: string;
  user_id: string;
  genre_id: string | null;
  artist_id: string | null;
  channel: AlertChannel;
  lead_time_minutes: number;
  created_at: string;
  push_endpoint: string | null;
};

export type DeliveryKey = `${string}:${string}`; // userId:episodeId

const subscriptions: AlertSubscription[] = [];
const deliveries = new Set<string>();
export const emailOutbox: { to: string; subject: string; body: string; at: string }[] = [];

let seq = 1;

export function resetAlertStore(): void {
  subscriptions.splice(0, subscriptions.length);
  deliveries.clear();
  emailOutbox.splice(0, emailOutbox.length);
  seq = 1;
}

export function listAlerts(userId: string): AlertSubscription[] {
  return subscriptions.filter((s) => s.user_id === userId);
}

export function addAlert(
  input: Omit<AlertSubscription, 'id' | 'created_at'> ,
): AlertSubscription {
  const row: AlertSubscription = {
    ...input,
    id: `alert-${String(seq).padStart(4, '0')}`,
    created_at: new Date().toISOString(),
  };
  seq += 1;
  subscriptions.push(row);
  return row;
}

export function removeAlert(id: string, userId?: string): AlertSubscription | null {
  const idx = subscriptions.findIndex(
    (s) => s.id === id && (userId === undefined || s.user_id === userId),
  );
  if (idx < 0) return null;
  const [removed] = subscriptions.splice(idx, 1);
  return removed ?? null;
}

export function findAlert(id: string): AlertSubscription | undefined {
  return subscriptions.find((s) => s.id === id);
}

export function allAlerts(): AlertSubscription[] {
  return [...subscriptions];
}

export function hasDelivery(userId: string, episodeId: string): boolean {
  return deliveries.has(`${userId}:${episodeId}`);
}

export function recordDelivery(userId: string, episodeId: string): void {
  deliveries.add(`${userId}:${episodeId}`);
}

export function recordEmail(to: string, subject: string, body: string): void {
  emailOutbox.push({ to, subject, body, at: new Date().toISOString() });
}
