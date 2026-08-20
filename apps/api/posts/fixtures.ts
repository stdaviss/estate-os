/** Editorial fixtures. Tags live in MDX frontmatter because posts has no tags column. */

export type PostRecord = {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  body_mdx: string;
  author_name: string;
  hero_url: string | null;
  published_at: string | null;
  related_artist_ids: string[];
  tags: string[];
};

const AID = {
  palais: '00000000-0000-4000-8000-000000000201',
  nour: '00000000-0000-4000-8000-000000000203',
  salt: '00000000-0000-4000-8000-000000000206',
  orion: '00000000-0000-4000-8000-000000000211',
  tin: '00000000-0000-4000-8000-000000000212',
};

function wrap(tags: string[], body: string): string {
  return `---\ntags: [${tags.join(', ')}]\n---\n\n${body}`;
}

export const posts: PostRecord[] = [
  {
    id: 'post-01',
    slug: 'nour-el-kasbah-in-tunis',
    title: 'Nour El-Kasbah, between two ports',
    standfirst: 'A guest mix that arrived from Tunis, and the room it was recorded in.',
    body_mdx: wrap(
      ['interview', 'tunis'],
      `## The room

Nour records in a third-floor flat above a pharmacy. The windows face the lake. She does not call it a studio.

We do not represent her. She sent a mix. We played it. That is the whole relationship so far, and it is enough to write this down.

**On tempo:** "I sit at 128 because that is walking speed in August."

The mix is filed under guest. If she wants more than that, she knows where the form is.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-08-12T09:00:00.000Z',
    related_artist_ids: [AID.nour],
    tags: ['interview', 'tunis'],
  },
  {
    id: 'post-02',
    slug: 'harbour-frequency-week-four',
    title: 'Harbour Frequency, week four',
    standfirst: 'What actually happened on a Thursday that looked quiet from the street.',
    body_mdx: wrap(
      ['show', 'marseille'],
      `## The log

Palais Gris opened with three dub plates that do not exist online. Peak listeners: 0341. The chat was mostly track IDs, which is as it should be.

The recording is gone. The tracklist is in the archive.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-08-14T10:00:00.000Z',
    related_artist_ids: [AID.palais],
    tags: ['show', 'marseille'],
  },
  {
    id: 'post-03',
    slug: 'algiers-warehouses',
    title: 'Notes from a warehouse in Algiers',
    standfirst: 'A scene piece. Nobody here is on a roster. That is the point of writing it.',
    body_mdx: wrap(
      ['scene', 'algiers'],
      `## Salt Office and the others

Salt Office played a six-hour set in a building that used to pack citrus. We were not the promoters. We were listening.

Covering rooms we do not run is how this publication stays a publication.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-08-08T11:00:00.000Z',
    related_artist_ids: [AID.salt],
    tags: ['scene', 'algiers'],
  },
  {
    id: 'post-04',
    slug: 'orion-mole-athens',
    title: 'Orion Mole does not want a bio',
    standfirst: 'Athens, a hardware live set, a refusal to be summarised.',
    body_mdx: wrap(
      ['interview', 'athens'],
      `## One paragraph

Orion Mole asked us not to write a biography. So this is a tracklist with a date attached, and a link if you want the next one.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-08-05T09:00:00.000Z',
    related_artist_ids: [AID.orion],
    tags: ['interview', 'athens'],
  },
  {
    id: 'post-05',
    slug: 'tin-roof-beirut',
    title: 'Tin Roof, still sending tapes',
    standfirst: 'Beirut to Marseille by post. The cassette arrived on a Tuesday.',
    body_mdx: wrap(
      ['interview', 'beirut'],
      `## The package

No note. A cassette. A city name. We digitised it, played thirty minutes, filed the rest.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-07-28T09:00:00.000Z',
    related_artist_ids: [AID.tin],
    tags: ['interview', 'beirut'],
  },
  {
    id: 'post-06',
    slug: 'how-we-log-a-night',
    title: 'How we log a night',
    standfirst: 'Tracklists are the rights record. They are also the only public trace.',
    body_mdx: wrap(
      ['station'],
      `## What survives

Title, host, guest, date, duration, artwork, peak listeners, every track with a timestamp. The audio does not. That is deliberate.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-07-20T09:00:00.000Z',
    related_artist_ids: [],
    tags: ['station'],
  },
  {
    id: 'post-07',
    slug: 'listening-from-elsewhere',
    title: 'Listening from elsewhere',
    standfirst: 'Internet radio is appointment listening for people who do not share a clock.',
    body_mdx: wrap(
      ['station'],
      `## Timezones

We print your local time and the station clock next to it. If those two disagree, the station clock is in Paris.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-07-12T09:00:00.000Z',
    related_artist_ids: [],
    tags: ['station'],
  },
  {
    id: 'post-08',
    slug: 'send-a-mix',
    title: 'Send a mix',
    standfirst: 'There is no roster worth listing yet. The inbox is the roster.',
    body_mdx: wrap(
      ['station'],
      `## What to send

A mix you made. Rights you can grant. A city. That is the form.`,
    ),
    author_name: 'Staff',
    hero_url: null,
    published_at: '2026-07-01T09:00:00.000Z',
    related_artist_ids: [AID.palais],
    tags: ['station'],
  },
];

export function parseFrontmatter(body: string): { tags: string[]; body: string } {
  const match = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { tags: [], body };
  const raw = match[1] ?? '';
  const tagLine = raw.split('\n').find((l) => l.startsWith('tags:'));
  const tags = tagLine
    ? tagLine
        .replace('tags:', '')
        .replace(/[\[\]]/g, '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  return { tags, body: body.slice(match[0].length) };
}
