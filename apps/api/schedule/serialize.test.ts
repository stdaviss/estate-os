import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFixtures, REFERENCE_NOW_ISO } from './fixtures.ts';
import { omitInternalMaster, toPublicEpisode } from './serialize.ts';

describe('public episode serialiser', () => {
  it('omits internal_master_key from the object', () => {
    const cleaned = omitInternalMaster({
      id: 'ep',
      title: 'x',
      internal_master_key: 'masters/secret.flac',
    });
    assert.equal('internal_master_key' in cleaned, false);
    assert.deepEqual(cleaned, { id: 'ep', title: 'x' });
  });

  it('never serialises the master key on public episodes', () => {
    const { episodes } = buildFixtures(REFERENCE_NOW_ISO);
    const expired = episodes.find((e) => e.state === 'expired');
    assert.ok(expired);
    assert.ok(expired.internal_master_key);
    const publicEp = toPublicEpisode(expired, { includeTracklist: true });
    assert.equal('internal_master_key' in publicEp, false);
    const json = JSON.stringify(publicEp);
    assert.equal(json.includes('internal_master'), false);
    assert.equal(json.includes('masters/'), false);
  });

  it('marks exactly one episode live at the reference instant', () => {
    const { episodes } = buildFixtures(REFERENCE_NOW_ISO);
    const live = episodes.filter((e) => e.state === 'live');
    assert.equal(live.length, 1);
    assert.equal(live[0]?.show.slug, 'harbour-frequency');
  });
});
