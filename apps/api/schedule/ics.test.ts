import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShowCalendar } from './ics.ts';

describe('ICS export', () => {
  it('emits a VCALENDAR that a calendar app can import', () => {
    const ics = buildShowCalendar({
      showSlug: 'harbour-frequency',
      showTitle: 'Harbour Frequency',
      episodes: [
        {
          id: 'ep-1',
          title: 'Harbour Frequency with Nour El-Kasbah',
          starts_at: '2026-08-20T19:00:00.000Z',
          ends_at: '2026-08-20T21:00:00.000Z',
          showTitle: 'Harbour Frequency',
          hostName: 'Palais Gris',
          guestName: 'Nour El-Kasbah',
        },
      ],
      calDomain: 'station.local',
    });
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /VERSION:2.0\r\n/);
    assert.match(ics, /BEGIN:VEVENT\r\n/);
    assert.match(ics, /DTSTART:20260820T190000Z\r\n/);
    assert.match(ics, /DTEND:20260820T210000Z\r\n/);
    assert.match(ics, /UID:ep-1@station.local\r\n/);
    assert.match(ics, /SUMMARY:Harbour Frequency with Nour El-Kasbah/);
    assert.match(ics, /END:VCALENDAR\r\n$/);
    assert.equal(ics.includes('\n') && !ics.includes('\r\n') ? 'lf' : 'crlf', 'crlf');
  });
});
