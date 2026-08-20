import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { collectDueNotices, dispatchNotices, formatNoticeCopy, isDue } from './dispatch.ts';
import { addAlert, emailOutbox, hasDelivery, resetAlertStore, type AlertSubscription } from './store.ts';
import { DELETE, POST } from './index.ts';
import { unsubscribeToken } from './token.ts';

const episode = {
  id: 'ep-live-soon',
  title: 'Harbour Frequency',
  starts_at: '2026-08-20T19:00:00.000Z',
  state: 'scheduled',
  showTitle: 'Harbour Frequency',
  hostName: 'Palais Gris',
  guestName: 'Nour El-Kasbah',
  genre_ids: ['g-techno'],
  host_id: 'a-palais',
  guest_id: 'a-nour',
};

function sub(over: Partial<AlertSubscription> = {}): AlertSubscription {
  return {
    id: 'alert-0001',
    user_id: 'user-1',
    genre_id: 'g-techno',
    artist_id: null,
    channel: 'email',
    lead_time_minutes: 60,
    created_at: '2026-08-20T00:00:00.000Z',
    push_endpoint: null,
    ...over,
  };
}

describe('alert matching and dispatch', () => {
  beforeEach(() => resetAlertStore());

  it('fires once at lead time and not twice for two matching subscriptions', () => {
    const now = new Date('2026-08-20T18:00:00.000Z'); // 60 minutes before
    const notices = collectDueNotices(
      [sub(), sub({ id: 'alert-0002', artist_id: 'a-palais', genre_id: null })],
      [episode],
      now,
      () => false,
    );
    assert.equal(notices.length, 1);
    assert.equal(notices[0]?.user_id, 'user-1');
  });

  it('does not fire before the lead window or after the show has started', () => {
    const tooEarly = new Date('2026-08-20T17:59:00.000Z');
    const tooLate = new Date('2026-08-20T19:00:00.000Z');
    assert.equal(isDue(sub(), episode, tooEarly), false);
    assert.equal(isDue(sub(), episode, tooLate), false);
    assert.equal(isDue(sub(), episode, new Date('2026-08-20T18:00:00.000Z')), true);
  });

  it('dedupes against deliveries already recorded', () => {
    addAlert({
      user_id: 'user-1',
      genre_id: 'g-techno',
      artist_id: null,
      channel: 'email',
      lead_time_minutes: 60,
      push_endpoint: null,
    });
    const first = collectDueNotices(
      [sub()],
      [episode],
      new Date('2026-08-20T18:00:00.000Z'),
    );
    dispatchNotices(
      first,
      () => 'listener@example.com',
      {
        listen: () => 'https://station.local/schedule',
        unsub: (token) => `https://station.local/schedule/alerts/unsubscribe?token=${token}`,
      },
      () => '21:00 CEST on 2026.08.20',
    );
    assert.equal(emailOutbox.length, 1);
    assert.equal(hasDelivery('user-1', 'ep-live-soon'), true);
    const second = collectDueNotices(
      [sub()],
      [episode],
      new Date('2026-08-20T18:05:00.000Z'),
    );
    assert.equal(second.length, 0);
  });

  it('uses plain copy with a timezone and an unsubscribe URL', () => {
    const { subject, body } = formatNoticeCopy(
      {
        user_id: 'user-1',
        episode,
        subscription_id: 'alert-0001',
        channel: 'email',
        unsubscribe_token: 'abc',
      },
      '21:00 CEST on 2026.08.20',
      'https://station.local/schedule',
      'https://station.local/unsub?token=abc',
    );
    assert.equal(subject, 'Harbour Frequency');
    assert.equal(body.includes('!'), false);
    assert.match(body, /21:00 CEST on 2026\.08\.20/);
    assert.match(body, /Unsubscribe:/);
  });

  it('unsubscribes with the token and no session', async () => {
    const created = addAlert({
      user_id: 'user-1',
      genre_id: 'g-techno',
      artist_id: null,
      channel: 'email',
      lead_time_minutes: 60,
      push_endpoint: null,
    });
    const token = unsubscribeToken(created.id);
    const res = await DELETE(new Request(`http://local/api/v1/alerts?token=${token}`, { method: 'DELETE' }));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { removed: boolean } };
    assert.equal(body.data.removed, true);
  });

  it('rejects an alert with neither genre nor artist', async () => {
    const res = await POST(
      new Request('http://local/api/v1/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': 'user-1' },
        body: JSON.stringify({ channel: 'email' }),
      }),
    );
    assert.equal(res.status, 400);
  });
});
