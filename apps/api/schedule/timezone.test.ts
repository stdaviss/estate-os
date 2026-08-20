import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatDurationHm,
  formatIcsUtc,
  formatIndex,
  formatListeners,
  formatListingDate,
  formatTimeHm,
  formatTimecode,
  fromZonedTime,
  STATION_TZ,
} from './timezone.ts';

describe('timezone conversion', () => {
  it('maps 21:00 Paris summer time to 19:00 UTC', () => {
    const instant = fromZonedTime(2026, 8, 20, 21, 0, STATION_TZ);
    assert.equal(instant.toISOString(), '2026-08-20T19:00:00.000Z');
  });

  it('renders the same instant in Paris, New York and Tokyo', () => {
    const iso = '2026-08-20T19:00:00.000Z';
    assert.equal(formatTimeHm(iso, 'Europe/Paris'), '21:00');
    assert.equal(formatListingDate(iso, 'Europe/Paris'), '2026.08.20');
    assert.equal(formatTimeHm(iso, 'America/New_York'), '15:00');
    assert.equal(formatListingDate(iso, 'America/New_York'), '2026.08.20');
    assert.equal(formatTimeHm(iso, 'Asia/Tokyo'), '04:00');
    assert.equal(formatListingDate(iso, 'Asia/Tokyo'), '2026.08.21');
  });

  it('formats data in the specified mono shapes', () => {
    assert.equal(formatListeners(341), '0341');
    assert.equal(formatIndex(7), '07');
    assert.equal(formatDurationHm(2 * 3600 * 1000), '02:00');
    assert.equal(formatTimecode(1 * 3600000 + 47 * 60000 + 22 * 1000), '01:47:22');
    assert.equal(formatIcsUtc('2026-08-20T19:00:00.000Z'), '20260820T190000Z');
  });
});
