import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GET } from './index.ts';
import { GET as archiveGET } from './archive.ts';
import { buildFixtures, REFERENCE_NOW_ISO } from './fixtures.ts';

describe('GET /schedule', () => {
  it('groups episodes by day and excludes the master key', async () => {
    const res = await GET(new Request(`http://local/api/v1/schedule?from=2026-08-17T00:00:00.000Z&to=2026-08-27T23:59:59.000Z`));
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: { timezone: string; days: { date: string; episodes: { state: string }[] }[] };
    };
    assert.equal(body.data.timezone, 'Europe/Paris');
    assert.ok(body.data.days.length > 0);
    const json = JSON.stringify(body);
    assert.equal(json.includes('internal_master'), false);
    const liveCount = body.data.days
      .flatMap((d) => d.episodes)
      .filter((e) => e.state === 'live').length;
    assert.equal(liveCount, 1);
  });

  it('returns empty days when EMPTY=1', async () => {
    const res = await GET(new Request('http://local/api/v1/schedule?empty=1'));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { days: unknown[] } };
    assert.equal(body.data.days.length, 0);
  });
});

describe('GET /archive', () => {
  it('returns expired episodes with tracklists and no playable fields', async () => {
    const res = await archiveGET(new Request('http://local/api/v1/archive?limit=5'));
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: { state: string; tracklist: unknown[]; audio_url?: string }[];
      meta: { next_cursor: string | null };
    };
    assert.ok(body.data.length > 0);
    for (const ep of body.data) {
      assert.equal(ep.state, 'expired');
      assert.ok(Array.isArray(ep.tracklist));
      assert.equal(ep.audio_url, undefined);
    }
    assert.equal(JSON.stringify(body).includes('internal_master'), false);
  });

  it('returns an empty list in empty mode', async () => {
    const res = await archiveGET(new Request('http://local/api/v1/archive?empty=1'));
    const body = (await res.json()) as { data: unknown[] };
    assert.equal(body.data.length, 0);
  });
});

describe('fixtures', () => {
  it('spans expired past and scheduled future around the live show', () => {
    const { episodes } = buildFixtures(REFERENCE_NOW_ISO);
    const expired = episodes.filter((e) => e.state === 'expired');
    const scheduled = episodes.filter((e) => e.state === 'scheduled');
    assert.ok(expired.length >= 8);
    assert.ok(scheduled.length >= 8);
    assert.ok(expired.every((e) => (e.tracklist?.length ?? 0) >= 8));
  });
});
