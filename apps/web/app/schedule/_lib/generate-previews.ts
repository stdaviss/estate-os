import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GET as scheduleGET } from '../../../../api/schedule/index.ts';
import { GET as archiveGET } from '../../../../api/schedule/archive.ts';
import { GET as postsGET } from '../../../../api/posts/index.ts';
import {
  formatDurationHm,
  formatIndex,
  formatListeners,
  formatListingDate,
  formatTimeHm,
  formatTimeZoneName,
  formatTimecode,
  STATION_TZ,
} from '../../../../api/schedule/timezone.ts';
import type { PublicEpisode } from '../../../../api/schedule/serialize.ts';
import { parseMarkdown } from '../../../../api/posts/mdx.ts';
import { artists } from '../../../../api/schedule/fixtures.ts';
import { WHICH_MIX_PAIR } from '../../../../api/games/store.ts';

const TZ = 'Europe/Paris';
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../../../../../docs/screenshots/preview');

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function art(size: number): string {
  return `<span class="c-art" style="width:${size}px;height:${size}px"><svg viewBox="0 0 96 96" aria-hidden="true"><rect width="96" height="96" fill="var(--hull)"/><rect x="8" y="8" width="80" height="80" fill="none" stroke="var(--rule)"/><path d="M16 80 L80 16" stroke="var(--rule)" fill="none"/></svg></span>`;
}

function doc(title: string, body: string, widthNote = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/apps/web/app/schedule/_lib/c-lane.css"/>
  ${widthNote}
</head>
<body>
${body}
</body>
</html>`;
}

function emptyBlock(label: string, copy: string, action?: string): string {
  return `<div class="c-empty"><div class="c-label">${esc(label)}</div><p class="c-body-l">${esc(copy)}</p>${action ?? ''}</div>`;
}

function btn(label: string, primary = false): string {
  return `<a class="c-btn ${primary ? 'c-btn-primary' : 'c-btn-ghost'}" href="#">${esc(label)}</a>`;
}

function nowBar(live: boolean, title: string, host: string, code: string, listen = false): string {
  const pill = live
    ? `<span class="c-pill c-pill-live">On air</span>`
    : `<span class="c-label">Next</span>`;
  return `<div class="c-now ${live ? 'is-live' : ''}">${pill}<div class="c-now-meta"><div class="c-display-m">${esc(title)}</div><div class="c-body-s">${esc(host)}</div></div><span class="c-data">${esc(code)}</span>${listen ? btn('Listen', true) : ''}</div>`;
}

function weekday(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: TZ }).format(new Date(iso)).toUpperCase();
}

type ScheduleData = { days: { date: string; episodes: PublicEpisode[] }[] };

function scheduleHtml(data: ScheduleData, empty: boolean): string {
  const live = data.days.flatMap((d) => d.episodes).find((e) => e.state === 'live');
  const showLinks = new Map<string, string>();
  for (const day of data.days) {
    for (const ep of day.episodes) showLinks.set(ep.show.slug, ep.show.title);
  }
  const icsLine = empty
    ? ''
    : `<p class="c-body-s" style="margin-bottom:16px">${[...showLinks.entries()]
        .map(([slug, title]) => `<a class="c-data" href="/schedule/shows/${slug}/ics" style="margin-right:16px">ICS ${esc(title)}</a>`)
        .join('')}</p>`;
  const head = `<header class="c-page-head"><h1 class="c-display-l">Schedule</h1><span class="c-data">Europe/Paris · desk ${STATION_TZ}</span></header>${icsLine}`;
  const now = live
    ? nowBar(true, live.show.title, `${live.host?.name ?? ''} · ${live.guest?.name ?? ''}`, '00:00:12  21:00 CEST')
    : nowBar(false, 'Nothing scheduled', '', '—');
  if (empty) {
    return `<main class="c-page">${head}${nowBar(false, 'Nothing scheduled', '', '—')}${emptyBlock('Schedule', 'Nothing is scheduled yet. The first broadcast is coming.', btn('Send a mix', true))}</main>`;
  }
  const days = data.days
    .map((day) => {
      const first = day.episodes[0];
      const rows = day.episodes
        .map((ep) => {
          const liveEp = ep.state === 'live' || ep.state === 'repeat_live';
          const pills = ep.genres.map((g) => `<span class="c-pill">${esc(g.name)}</span>`).join('');
          return `<li class="c-ep ${liveEp ? 'c-ep-live' : ''}">
            <div class="c-ep-time">${liveEp ? '<span class="c-dot"></span>' : ''}
              <span class="c-data">${formatTimeHm(ep.starts_at, TZ)}</span>
              <span class="c-tz c-data">${formatTimeHm(ep.starts_at, STATION_TZ)} ${formatTimeZoneName(ep.starts_at, STATION_TZ)}</span>
            </div>
            ${art(48)}
            <div class="c-ep-title">
              <div class="c-display-m">${esc(ep.title ?? ep.show.title)}</div>
              <div class="c-ep-sub"><span class="c-body-s">${esc(ep.host?.name ?? '')}${ep.guest ? ` · ${esc(ep.guest.name)}` : ''}</span>${pills}</div>
            </div>
            <div class="c-ep-actions">
              <span class="c-data">${formatDurationHm(ep.duration_ms)}</span>
              ${btn('Set an alert')}
              ${liveEp ? btn('Listen', true) : ''}
            </div>
          </li>`;
        })
        .join('');
      return `<section><div class="c-day-head"><span class="c-label">${first ? weekday(first.starts_at) : ''}</span><h2 class="c-display-m">${day.date}</h2></div><ul class="c-list-plain">${rows}</ul></section>`;
    })
    .join('');
  return `<main class="c-page">${head}${now}<div class="c-days">${days}</div></main>`;
}

function archiveHtml(episodes: PublicEpisode[], empty: boolean): string {
  const head = `<header class="c-page-head"><h1 class="c-display-l">Archive</h1></header>`;
  if (empty) {
    return `<main class="c-page">${head}${nowBar(false, 'Nothing scheduled', '', '—')}${emptyBlock('Archive', 'Nothing has aired yet. The first broadcast is scheduled.', btn('See the schedule', true))}</main>`;
  }
  const rows = episodes
    .slice(0, 12)
    .map(
      (ep) => `<li><a class="c-ep" href="#">
        <span class="c-data">${formatListingDate(ep.starts_at, TZ)}</span>
        ${art(48)}
        <div class="c-ep-title"><div class="c-display-m">${esc(ep.title ?? ep.show.title)}</div><div class="c-body-s">${esc(ep.host?.name ?? '')}${ep.guest ? ` · ${esc(ep.guest.name)}` : ''}</div></div>
        <div class="c-ep-actions"><span class="c-data">${formatListeners(ep.peak_listeners)}</span><span class="c-data">${formatDurationHm(ep.duration_ms)}</span></div>
      </a></li>`,
    )
    .join('');
  return `<main class="c-page">${head}${nowBar(true, 'Harbour Frequency', 'Palais Gris · Nour El-Kasbah', '00:00:12')}<ul class="c-list-plain">${rows}</ul></main>`;
}

function archiveEpisodeHtml(ep: PublicEpisode | null): string {
  if (!ep) {
    return `<main class="c-page">${emptyBlock('Archive', 'Nothing has aired yet. The first broadcast is scheduled.', btn('See the schedule', true))}</main>`;
  }
  const aired = formatListingDate(ep.starts_at, STATION_TZ);
  const startMs = new Date(ep.starts_at).getTime();
  const tracks = (ep.tracklist ?? [])
    .map(
      (row) => `<li class="c-track"><span class="pos">${formatIndex(row.position)}</span><span>${esc(row.raw_artist)}</span><span class="title">${esc(row.raw_title)}</span><span class="at">${formatTimecode(new Date(row.played_at).getTime() - startMs)}</span></li>`,
    )
    .join('');
  return `<main class="c-page">
    <div class="c-empty" style="border-bottom:0;padding-bottom:24px">
      <div class="c-label">Expired</div>
      <p class="c-body-l">This aired on ${aired} and was not recorded. The tracklist is below.</p>
    </div>
    <div class="c-archive-hero">
      ${art(96)}
      <div>
        <h1 class="c-display-l">${esc(ep.title ?? ep.show.title)}</h1>
        <p class="c-body-s">${esc(ep.host?.name ?? '')}${ep.guest ? ` with ${esc(ep.guest.name)}` : ''}</p>
        <p><span class="c-data">${aired}</span> · <span class="c-data">${formatListeners(ep.peak_listeners)}</span> · <span class="c-data">${formatTimecode(new Date(ep.ends_at).getTime() - startMs)}</span></p>
      </div>
    </div>
    <h2 class="c-label" style="margin-bottom:8px">Tracklist</h2>
    <ol class="c-list-plain">${tracks}</ol>
  </main>`;
}

function alertsHtml(empty: boolean): string {
  const form = `<form id="choose">
    <label class="c-field"><span>Genre</span><select><option>Techno</option><option>Dub techno</option></select></label>
    <label class="c-field"><span>Artist</span><select><option>None</option><option>Palais Gris</option></select></label>
    <label class="c-field"><span>Channel</span><select><option>Email</option><option>Web push</option></select></label>
    <label class="c-field"><span>Lead time (minutes)</span><select><option>60</option></select></label>
    ${btn('Set an alert', true)}
  </form>`;
  if (empty) {
    return `<main class="c-page"><header class="c-page-head"><h1 class="c-display-l">Alerts</h1></header>${emptyBlock('Alerts', "Pick the genres you care about and we'll tell you when they're scheduled. That's the only thing we'll use it for.", btn('Choose genres', true))}${form}</main>`;
  }
  return `<main class="c-page"><header class="c-page-head"><h1 class="c-display-l">Alerts</h1></header>
    <p class="c-body-s" style="margin-bottom:24px">We only use this to tell you when something you asked for is about to air. Lists stay in schedule order — nothing is rearranged for you.</p>
    ${form}
    <ul class="c-list-plain"><li class="c-ep"><div class="c-ep-title"><div class="c-display-m">Techno</div><div class="c-body-s">email · 60 min before</div></div>${btn('Remove')}</li></ul>
  </main>`;
}

function readListHtml(empty: boolean, posts: { slug: string; title: string; standfirst: string; tags: string[] }[]): string {
  const head = `<header class="c-page-head"><h1 class="c-display-l">Read</h1></header>`;
  if (empty) {
    return `<main class="c-page">${head}${emptyBlock('Read', 'Nothing filed yet. The first piece goes up with the first broadcast.')}</main>`;
  }
  const items = posts
    .map(
      (p) => `<li><a class="c-post" href="#"><span class="c-label">${esc(p.tags.join(' · ') || 'Note')}</span><span class="c-display-m">${esc(p.title)}</span><span class="c-body-s">${esc(p.standfirst)}</span></a></li>`,
    )
    .join('');
  return `<main class="c-page">${head}<ul class="c-list-plain">${items}</ul></main>`;
}

function readArticleHtml(empty: boolean, post: { title: string; standfirst: string; body_mdx: string; tags: string[]; related_artist_ids: string[]; author_name: string } | null): string {
  if (empty || !post) {
    return `<main class="c-page">${emptyBlock('Read', 'Nothing filed yet. The first piece goes up with the first broadcast.')}</main>`;
  }
  const blocks = parseMarkdown(post.body_mdx)
    .map((b) => {
      if (b.t === 'h2') return `<h2>${esc(b.text)}</h2>`;
      if (b.t === 'ul') return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
      return `<p>${esc(b.text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('');
  const related = artists
    .filter((a) => post.related_artist_ids.includes(a.id))
    .map((a) => `<a href="#"><span class="c-display-m" style="font-size:14px;line-height:20px">${esc(a.name)}</span><span class="c-body-s">${esc(a.city)} · ${esc(a.relationship)}</span></a>`)
    .join('');
  return `<main class="c-page"><div class="c-read-layout">
    <article class="c-measure">
      <span class="c-label">${esc(post.tags.join(' · '))}</span>
      <h1 class="c-display-l" style="margin:12px 0">${esc(post.title)}</h1>
      <p class="c-body-l" style="color:var(--chalk-dim);margin-bottom:32px">${esc(post.standfirst)}</p>
      <div class="c-mdx">${blocks}</div>
      <p class="c-body-s">${esc(post.author_name)}</p>
    </article>
    <aside>
      ${nowBar(true, 'Harbour Frequency', 'Palais Gris', '00:00:12')}
      <h2 class="c-label" style="margin:24px 0 8px">Related</h2>
      <div class="c-related">${related}</div>
    </aside>
  </div></main>`;
}

function editorHtml(): string {
  return `<main class="c-page">
    <header class="c-page-head"><h1 class="c-display-l">Editor</h1>${btn('Save', true)}</header>
    <div class="c-editor">
      <div>
        <label class="c-field"><span>Title</span><input value="Notes from a warehouse in Algiers"/></label>
        <label class="c-field"><span>Slug</span><input value="algiers-warehouses"/></label>
        <label class="c-field"><span>Standfirst</span><input value="A scene piece. Nobody here is on a roster."/></label>
        <label class="c-field"><span>Published</span><input type="checkbox" checked/></label>
        <label class="c-field"><span>MDX</span><textarea>## Salt Office and the others

Salt Office played a six-hour set in a building that used to pack citrus.</textarea></label>
      </div>
      <article class="c-measure c-mdx">
        <span class="c-label">Preview</span>
        <h1 class="c-display-l">Notes from a warehouse in Algiers</h1>
        <p class="c-body-l" style="color:var(--chalk-dim)">A scene piece. Nobody here is on a roster.</p>
        <h2>Salt Office and the others</h2>
        <p>Salt Office played a six-hour set in a building that used to pack citrus.</p>
      </article>
    </div>
  </main>`;
}

function playHtml(empty: boolean): string {
  if (empty) {
    return `<main class="c-page"><header class="c-page-head"><h1 class="c-display-l">Which mix</h1></header>${emptyBlock('Which mix', 'No tracks to compare yet. Send us a mix and it might end up here.', btn('Send a mix', true))}</main>`;
  }
  return `<main class="c-page">
    <header class="c-page-head"><h1 class="c-display-l">Which mix</h1><span class="c-data">${esc(WHICH_MIX_PAIR.artist_name)}</span></header>
    <p class="c-body-l" style="max-width:36em">Two cuts of ${esc(WHICH_MIX_PAIR.title)}. Play A, play B, vote. The stream is paused while you are here.</p>
    <div class="c-mix">
      <div class="c-mix-pane"><div class="c-label">A · ${esc(WHICH_MIX_PAIR.a.label)}</div><h2 class="c-display-m" style="margin:12px 0">${esc(WHICH_MIX_PAIR.title)}</h2>${btn('Play A')}${btn('Vote A')}</div>
      <div class="c-mix-pane"><div class="c-label">B · ${esc(WHICH_MIX_PAIR.b.label)}</div><h2 class="c-display-m" style="margin:12px 0">${esc(WHICH_MIX_PAIR.title)}</h2>${btn('Play B')}${btn('Vote B')}</div>
    </div>
    <div class="c-split">
      <div><div class="c-label">A</div><div class="c-display-l"><span class="c-data">62%</span></div></div>
      <div><div class="c-label">B</div><div class="c-display-l"><span class="c-data">38%</span></div></div>
    </div>
    <p class="c-body-s">Keys: 1 play A, 2 play B, A vote A, B vote B.</p>
  </main>`;
}

async function jsonData<T>(res: Response): Promise<T> {
  const body = (await res.json()) as { data: T };
  return body.data;
}

async function main() {
  const schedule = await jsonData<ScheduleData>(
    await scheduleGET(new Request('http://local/api/v1/schedule?from=2026-08-17T00:00:00.000Z&to=2026-08-27T23:59:59.000Z&tz=Europe/Paris')),
  );
  const archive = await jsonData<PublicEpisode[]>(await archiveGET(new Request('http://local/api/v1/archive?limit=12')));
  const posts = await jsonData<{ slug: string; title: string; standfirst: string; tags: string[]; body_mdx: string; related_artist_ids: string[]; author_name: string }[]>(
    await postsGET(new Request('http://local/api/v1/posts')),
  );
  const article = await jsonData<(typeof posts)[0]>(
    await postsGET(new Request('http://local/api/v1/posts/nour-el-kasbah-in-tunis')),
  );

  mkdirSync(outDir, { recursive: true });

  const files: Record<string, string> = {
    'schedule.html': doc('Schedule', scheduleHtml(schedule, false)),
    'schedule-empty.html': doc('Schedule', scheduleHtml(schedule, true)),
    'alerts.html': doc('Alerts', alertsHtml(false)),
    'alerts-empty.html': doc('Alerts', alertsHtml(true)),
    'archive.html': doc('Archive', archiveHtml(archive, false)),
    'archive-empty.html': doc('Archive', archiveHtml(archive, true)),
    'archive-episode.html': doc('Archive', archiveEpisodeHtml(archive[0] ?? null)),
    'archive-episode-empty.html': doc('Archive', archiveEpisodeHtml(null)),
    'read.html': doc('Read', readListHtml(false, posts)),
    'read-empty.html': doc('Read', readListHtml(true, [])),
    'read-article.html': doc('Read', readArticleHtml(false, article)),
    'read-article-empty.html': doc('Read', readArticleHtml(true, null)),
    'editor.html': doc('Editor', editorHtml()),
    'editor-empty.html': doc('Editor', editorHtml()),
    'play.html': doc('Which mix', playHtml(false)),
    'play-empty.html': doc('Which mix', playHtml(true)),
  };

  for (const [name, html] of Object.entries(files)) {
    writeFileSync(join(outDir, name), html);
  }
}

void main();
