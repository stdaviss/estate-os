import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { POST } from './index.ts';
import { resetGameEvents, voteSplit, WHICH_MIX_PAIR } from './store.ts';

describe('which mix', () => {
  beforeEach(() => resetGameEvents());

  it('records a vote against session_key and returns the split', async () => {
    const res = await POST(
      new Request('http://local/api/v1/games/which-mix/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'vote',
          session_key: 'anon-1',
          payload: { choice: 'a', pair_id: WHICH_MIX_PAIR.id },
        }),
      }),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: { split: { a: number; b: number; total: number }; pair: { title: string } };
    };
    assert.equal(body.data.pair.title, 'Dock Lights');
    assert.equal(body.data.split.a, 1);
    assert.equal(body.data.split.b, 0);
    assert.equal(voteSplit(WHICH_MIX_PAIR.id).total, 1);
  });

  it('refuses empty-mode play', async () => {
    const res = await POST(
      new Request('http://local/api/v1/games/which-mix/events?empty=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event_type: 'start', session_key: 'anon-1' }),
      }),
    );
    assert.equal(res.status, 409);
  });
});
