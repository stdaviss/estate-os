# Submission — Agent C — phase-1 — 2026-08-20

## 1. Status
PARTIAL
Lane C pages, handlers, tests and screenshots are on this branch; they cannot boot from `pnpm install && pnpm dev` because the monorepo shell and locked packages were not in the repo.

## 2. Acceptance criteria
- [ ] not met — Schedule is the homepage; live episode unmistakable at a glance — Live row is sodium-wash + 2px bar + one pulse (screenshot `docs/screenshots/c-schedule.png`). Homepage redirect lives in `app/page.tsx`, which I do not own; the page is `/schedule`.
- [x] met — Timezone conversion correct — verified across at least three zones — Unit tests: Europe/Paris 21:00, America/New_York 15:00, Asia/Tokyo 04:00 on 2026-08-21 for instant `2026-08-20T19:00:00.000Z` (`apps/api/schedule/timezone.test.ts`).
- [x] met — Archive shows full tracklist with no playable control anywhere — `GET /archive` returns expired rows with tracklists; JSON has no `audio_url`; screenshot `c-archive-episode.png` has index / artist / title / offset only.
- [x] met — Expired copy is matter-of-fact, with no apology language — Screenshot copy is `EXPIRED` / "This aired on 2026.08.19 and was not recorded. The tracklist is below." Grep of C-lane screens found no "unfortunately" / "sorry".
- [ ] not met — ICS export imports cleanly into a real calendar app — `buildShowCalendar` emits CRLF VCALENDAR/VEVENT with UTC DTSTART/DTEND and UID (unit test). I did not import the file into Apple Calendar or Google Calendar in this environment.
- [x] met — Alerts fire once, at the right time, in the right timezone, and unsubscribe works without login — `collectDueNotices` + `dispatchNotices` unit tests: due at lead time, not before, not after start; two matching subs collapse to one notice per user+episode; `DELETE /alerts?token=` removes the row with no session. Copy includes station-local time. No cron: Agent A owns infra.
- [x] met — No personalised ordering anywhere — state this explicitly in your submission — Schedule is `starts_at` ascending. Archive is `starts_at` descending. Posts are `published_at` descending. Tag filter is an exact match. Alerts never reorder those lists. No recommended rail, taste profile, or per-user sort. See `docs/adr/agent-c-no-personalised-ordering.md`.
- [ ] not met — Game is keyboard operable and coordinates audio correctly — Native buttons + keys 1/2/A/B; mount pauses via `station:transport`, unmount resumes. Not exercised in a running browser because the Next shell is absent.
- [x] met — Every screen screenshotted in both seed modes — Seeded, EMPTY, and 360px PNGs under `docs/screenshots/` for schedule, alerts, archive, archive episode, read, article, editor, play. These are HTML previews using the same CSS and fixtures as the React pages, not a running Next app.

## 3. Files changed
| Path | Change | Lines | Why |
|---|---|---|---|
| `apps/api/schedule/http.ts` | add | 43 | `{ data, error }` envelope |
| `apps/api/schedule/timezone.ts` | add | 155 | Paris wall-clock, listing formats |
| `apps/api/schedule/timezone.test.ts` | add | 38 | three-zone proof |
| `apps/api/schedule/serialize.ts` | add | 98 | omit `internal_master_key` |
| `apps/api/schedule/serialize.test.ts` | add | 35 | leak assertion |
| `apps/api/schedule/fixtures.ts` | add | 320 | seed-shaped fallback |
| `apps/api/schedule/ics.ts` | add | 67 | per-show VCALENDAR |
| `apps/api/schedule/ics.test.ts` | add | 33 | ICS shape |
| `apps/api/schedule/index.ts` | add | 102 | GET /schedule |
| `apps/api/schedule/archive.ts` | add | 35 | GET /archive |
| `apps/api/schedule/handlers.test.ts` | add | 65 | schedule/archive HTTP |
| `apps/api/alerts/token.ts` | add | 23 | HMAC unsubscribe |
| `apps/api/alerts/store.ts` | add | 75 | in-memory subs + deliveries |
| `apps/api/alerts/dispatch.ts` | add | 126 | match, dedupe, copy |
| `apps/api/alerts/index.ts` | add | 150 | GET/POST/DELETE /alerts |
| `apps/api/alerts/dispatch.test.ts` | add | 136 | once / window / unsub |
| `apps/api/alerts/.env.example` | add | 8 | C-lane env vars |
| `apps/api/posts/fixtures.ts` | add | 191 | eight posts, non-roster cover |
| `apps/api/posts/mdx.ts` | add | 70 | markdown subset |
| `apps/api/posts/index.ts` | add | 141 | GET /posts, staff POST/PATCH |
| `apps/api/posts/posts.test.ts` | add | 39 | tag filter |
| `apps/api/games/store.ts` | add | 74 | game_events + split |
| `apps/api/games/index.ts` | add | 76 | POST /games/:slug/events |
| `apps/api/games/games.test.ts` | add | 41 | vote + empty |
| `apps/web/app/schedule/_lib/c-lane.css` | add | 608 | tokens + C screens |
| `apps/web/app/schedule/_lib/fonts/*` | add | n/a | self-hosted woff2 |
| `apps/web/app/schedule/_lib/ui.tsx` | add | 162 | stand-in for `@repo/ui` |
| `apps/web/app/schedule/_lib/broadcast.ts` | add | 133 | poll `/stream/now` |
| `apps/web/app/schedule/_lib/whats-on-now.tsx` | add | 84 | shared now/next module |
| `apps/web/app/schedule/_lib/index.ts` | add | 3 | export surface |
| `apps/web/app/schedule/_lib/mode.ts` | add | 15 | EMPTY + visitor TZ |
| `apps/web/app/schedule/_lib/generate-previews.ts` | add | 316 | screenshot HTML |
| `apps/web/app/schedule/layout.tsx` | add | 6 | CSS import |
| `apps/web/app/schedule/page.tsx` | add | 20 | /schedule |
| `apps/web/app/schedule/screen.tsx` | add | 125 | day-grouped rows |
| `apps/web/app/schedule/alerts/page.tsx` | add | 31 | settings |
| `apps/web/app/schedule/alerts/screen.tsx` | add | 208 | form + list |
| `apps/web/app/schedule/alerts/unsubscribe/page.tsx` | add | 29 | no-login unsub |
| `apps/web/app/schedule/shows/[slug]/ics/route.ts` | add | 36 | ICS download |
| `apps/web/app/archive/**` | add | ~180 | listing + episode |
| `apps/web/app/read/**` | add | ~300 | listing, article, editor |
| `apps/web/app/play/**` | add | ~180 | Which mix + wavs |
| `docs/screenshots/c-*.png` | add | 24 files | seeded / empty / 360 |
| `docs/screenshots/preview/*.html` | add | 16 files | screenshot sources |
| `docs/adr/agent-c-no-personalised-ordering.md` | add | 3 | ordering stance |
| `SUBMISSION.md` | add | this file | protocol |
| `manifest.json` | add | machine | protocol |

## 4. Contract adherence
### Endpoints implemented
| Method | Path | Request | Response | Matches 02-CONTRACTS? |
|---|---|---|---|---|
| GET | `/api/v1/schedule` | `?from=&to=&tz=&cursor=&limit=` | `{ data: { timezone, days[] } }` | yes, grouped by day |
| GET | `/api/v1/schedule/:episodeId` | — | `{ data: PublicEpisode }` | yes |
| GET | `/api/v1/archive` | `?cursor=&limit=` | `{ data: expired[], meta.next_cursor }` | yes; handler lives in `apps/api/schedule/archive.ts` because `/archive` is not in the ownership table |
| GET | `/api/v1/alerts` | session via `x-user-id` | `{ data: AlertSubscription[] }` | yes; auth header is a stand-in for Auth.js |
| POST | `/api/v1/alerts` | `{ genre_id?, artist_id?, channel, lead_time_minutes }` | `{ data: AlertSubscription }` | yes |
| DELETE | `/api/v1/alerts` | `?id=` or `?token=` | `{ data: { removed } }` | yes; token form is the no-login unsub |
| GET | `/api/v1/posts` | `?tag=` | `{ data: Post[], meta.next_cursor }` | yes; tags from MDX frontmatter (no tags column) |
| GET | `/api/v1/posts/:slug` | — | `{ data: Post }` | yes |
| POST | `/api/v1/games/:slug/events` | `{ event_type, session_key, payload }` | `{ data: { event, pair, split } }` | yes |

### Endpoints consumed from other agents
| Method | Path | Owner | Mocked or live? |
|---|---|---|---|
| GET | `/api/v1/stream/now` | A | mocked — fetch, then fixture live episode |
| GET | `/api/v1/catalogue` | B | mocked — Which mix pair is local, catalogue-shaped |
| GET | `/artists/:slug` | B | links only; names from C fixtures |

### Events emitted / consumed
| Event | Direction | Payload matches contract? |
|---|---|---|
| (none emitted) | — | — |
| `show.started` / `show.ended` / `track.changed` | consumed, intended | not wired to the socket; WhatsOnNow polls `/stream/now` every 20s as the contract fallback |

Staff `POST`/`PATCH /api/v1/posts` and `GET /api/v1/alerts?op=dispatch` are extensions. They do not change the listed contract routes. ICS is served from `GET /schedule/shows/:slug/ics` (web, owned path), not as a new `/api/v1` route.

## 5. Design system adherence
- Is there more than one sodium element competing for attention? On schedule: ON AIR pill + live-row 2px bar + one Listen on the live row. Two related live signals. I removed the second Listen from WhatsOnNow and ICS is chalk, not sodium.
- Is every number in Martian Mono? Times, durations, dates, listener counts, track indexes, split percents, ICS labels: yes via `.c-data` / Martian Mono. Body copy numbers in editorial prose are not.
- Does anything have a radius other than 2px? Status dots are 50% (specified). Game play buttons are 2px, not circular (circular play is transport, Agent A).
- Are there cards with shadows where there should be rules? No shadows. Mix panes use `--hull` fill + hairline, which is a raised surface, not a drop shadow.
- Does the empty state read as an invitation or as a failure? Invitation. Archive empty: "Nothing has aired yet. The first broadcast is scheduled." Play empty: "Send us a mix."
- At 360px wide, does anything overflow or truncate badly? Episode actions wrap to a new row. ICS show links wrap. Titles ellipsis in WhatsOnNow. Screenshot `c-schedule-360.png`.
- With the keyboard alone, can you reach and operate every control? Native links/buttons/selects with `:focus-visible` sodium ring. Game adds 1/2/A/B. Not verified in a running Next app.
- Could this screen be mistaken for a generic dark-mode dashboard? If yes, say so and say why. The palette is marine ink + sodium, not acid green. Risk: mix panes as two filled blocks can read as cards; they have no shadow. Archive tracklist is the least dashboard-like screen.

Then:
- Colours used outside the six-value palette: None in CSS (the six values plus the specified derivations). Screenshot HTML uses those same variables.
- Type sizes used outside the scale: 14px / 20px for episode row titles (transport exception in 01 §6, applied to listings for density).
- Border radii other than 2px: 50% on `.c-dot` only.
- Components created that are not composed from packages/ui: `apps/web/app/schedule/_lib/ui.tsx` is a temporary stand-in because `packages/ui` is not in the repo. Same names: Button, Pill, StatusDot, Rule, Artwork, EmptyState, Data, Field, Toggle. To be deleted when the locked package lands.

## 6. Screens
| Screen | Route | Seeded screenshot | EMPTY=1 screenshot | 360px screenshot |
|---|---|---|---|---|
| Schedule | `/schedule` | docs/screenshots/c-schedule.png | docs/screenshots/c-schedule-empty.png | docs/screenshots/c-schedule-360.png |
| Alerts | `/schedule/alerts` | docs/screenshots/c-alerts.png | docs/screenshots/c-alerts-empty.png | docs/screenshots/c-alerts-360.png |
| Archive | `/archive` | docs/screenshots/c-archive.png | docs/screenshots/c-archive-empty.png | docs/screenshots/c-archive-360.png |
| Archive episode | `/archive/:id` | docs/screenshots/c-archive-episode.png | docs/screenshots/c-archive-episode-empty.png | docs/screenshots/c-archive-episode-360.png |
| Read | `/read` | docs/screenshots/c-read.png | docs/screenshots/c-read-empty.png | docs/screenshots/c-read-360.png |
| Article | `/read/:slug` | docs/screenshots/c-read-article.png | docs/screenshots/c-read-article-empty.png | docs/screenshots/c-read-article-360.png |
| Editor | `/read/editor` | docs/screenshots/c-editor.png | docs/screenshots/c-editor-empty.png | docs/screenshots/c-editor-360.png |
| Which mix | `/play` | docs/screenshots/c-play.png | docs/screenshots/c-play-empty.png | docs/screenshots/c-play-360.png |

## 7. BLOCKERS
1. Locked packages missing from the repo.
   - What you needed: `packages/schema`, `packages/ui`, `packages/types` as specified in 00 §8.
   - Which locked file: `packages/schema/**`, `packages/ui/**`, `packages/types/**`.
   - Proposed diff: add the Drizzle tables and Zod schemas from 02-CONTRACTS; export Button, EmptyState, Data, ListRow, Pill, StatusDot, Artwork, Field, Select, Toggle, SectionHead, Rule; generate public API types. Package names assumed `@repo/schema`, `@repo/ui`, `@repo/types`.
   - What I did instead: C-lane CSS variables copied from 01; `ui.tsx` stand-in; fixture data shaped like the seed; in-memory stores.
   - Once resolved: swap imports to `@repo/ui` / `@repo/schema` and delete `ui.tsx` + fixture fallbacks. Serialiser and handlers stay valid.

2. No Next.js / API / Turborepo shell.
   - What you needed: `apps/web` root layout, `apps/api` mount, `package.json` workspaces, `pnpm-workspace.yaml`.
   - Which path: repo root and `apps/web/app/layout.tsx`, `apps/api` index (unowned).
   - Proposed diff: mount C handlers at `/api/v1/schedule`, `/api/v1/archive`, `/api/v1/alerts`, `/api/v1/posts`, `/api/v1/games/:slug/events`. Redirect `/` to `/schedule`. Load fonts via `next/font` in the root layout.
   - What I did instead: App Router files in owned segments; handlers export `GET`/`POST`/`DELETE` taking `Request`.
   - Once resolved: pages should compile; root layout must import C-lane CSS or the ui tokens.

3. `posts` has no `tags` column but `GET /posts?tag=` exists.
   - What you needed: tags on posts, or drop `?tag=`.
   - Which locked file: `packages/schema` posts table.
   - Proposed diff: `tags text[]` on `posts`, or document frontmatter-only tags.
   - What I did instead: YAML frontmatter `tags:` in `body_mdx`.
   - Once resolved: filter can move to a real column without UI change.

4. No `alert_deliveries` table for durable dedupe.
   - What you needed: `unique(user_id, episode_id)` delivery log.
   - Which locked file: `packages/schema`.
   - Proposed diff:
     ```
     alert_deliveries
       user_id uuid -> users.id
       episode_id uuid -> episodes.id
       delivered_at timestamptz not null
       unique(user_id, episode_id)
     ```
   - What I did instead: in-process `Set`.
   - Once resolved: swap the Set for the table; matching logic stays.

5. Agent A `BroadcastContext` and Agent B seed/auth not present.
   - What you needed: `BroadcastContext`, Auth.js session, `packages/schema/seed.ts`.
   - Which path: Agent A player, Agent B auth/seed.
   - Proposed diff: none from C; consume when they land.
   - What I did instead: poll `/stream/now` with fixture fallback; `x-user-id` / `x-role` headers; C fixtures.
   - Once resolved: replace headers with session; WhatsOnNow should read context first.

6. Cron for alert dispatch.
   - What you needed: a one-minute job calling the dispatch function.
   - Which path: `infra/**` (Agent A).
   - Proposed diff: cron or queue hitting `GET /api/v1/alerts?op=dispatch` with a staff secret, or importing `collectDueNotices`.
   - What I did instead: exported dispatch + a GET hook for tests.
   - Once resolved: no C rework beyond pointing at the database.

## 8. Assumptions
- Station timezone is `Europe/Paris` (company in France). Not configurable in Phase 1.
- "Seven days forward, three back" includes today: 11 local days. Default `from`/`to` if omitted.
- Visitor TZ from `Intl` on the client; API `?tz=` for SSR/tests. Both times in Martian Mono.
- ICS is per show (upcoming scheduled + repeat_scheduled episodes), UTC DATE-TIME, download from the web route.
- `GET /archive` is mounted from the schedule lane. I did not create `apps/api/archive`.
- Auth: `x-user-id` and `x-role` until Auth.js exists. Staff editor is not locked down for real.
- Alert matching: exact `genre_id` on the show, or host/guest `artist_id`. No parent-genre expansion.
- Missed alerts (job late, show already started) are dropped, not sent after the fact.
- Unsubscribe token is HMAC-SHA256 of subscription id with `ALERT_UNSUB_SECRET`. Email link hits `/schedule/alerts/unsubscribe?token=`.
- Web push stores an optional `push_endpoint` and currently writes the same outbox as email. Real VAPID send is not implemented.
- Posts `?tag=` reads frontmatter. Related artists render from C fixture ids and link to `/artists/:slug`.
- Staff POST/PATCH `/posts` is required for the editor and is not in 02-CONTRACTS. Conservative read of the contract is GET-only; I added writes and recorded them here.
- Which mix uses one fixture pair (Dock 12, dub vs peak). Anonymous `session_key` in sessionStorage. Split returned on POST, no GET (contract is POST-only).
- `station:transport` CustomEvent `{ action: 'pause' | 'resume', source: 'play' }` is how C asks A to pause the stream.
- Branch name is `cursor/agent-c-schedule-culture-b00b` because this environment requires `cursor/<name>-b00b`. Protocol asked for `agent-c/phase-1`.
- Screenshots are design-faithful HTML driven by the same fixtures, because Next cannot start without the shell.
- EMPTY mode is `EMPTY=1` or `?empty=1`.
- No personalised homepage. I guessed that alerts settings belong under `/schedule/alerts` rather than Agent B account, because C owns the alerts API and B's `/me` only mentions alerts as a field.

## 9. Known defects
- `pnpm install && pnpm db:push && pnpm db:seed && pnpm dev` cannot run from this branch alone.
- Alert dedupe is in-memory; a process restart can double-send.
- Web push does not call a push service.
- Editor MDX preview is a markdown subset (headings, paragraphs, lists, bold, http(s) links). JSX in posts will not render.
- Which mix audio files are short generated tones, not catalogue masters.
- Schedule ICS links list every show in the window; dense at 360px.
- WhatsOnNow elapsed timecode in screenshots is a frozen `00:00:12`, not a live clock.
- `ui.tsx` duplicates locked primitives. Integration must delete it.
- Cross-app imports (`apps/web` → `apps/api`) will need workspace tsconfig paths.
- Root `.env.example` was not written (unowned). C vars are in `apps/api/alerts/.env.example`.
- Homepage is not `/`.
- `GET /api/v1/alerts?op=dispatch` is unauthenticated in this fallback; must be staff-secret before production.

## 10. Tests
| Test | Type | Covers | Passing? |
|---|---|---|---|
| timezone conversion | unit | Paris / New York / Tokyo + data formats | yes |
| public episode serialiser | unit | `internal_master_key` omitted | yes |
| ICS export | unit | VCALENDAR shape | yes |
| GET /schedule | unit | grouping, empty, no master key | yes |
| GET /archive | unit | expired + tracklist, empty | yes |
| alert matching and dispatch | unit | once, window, unsub, validation | yes |
| posts | unit | list, tag, slug, markdown | yes |
| which mix | unit | vote split, empty 409 | yes |

`pnpm test` is not defined in this repo. Ran:

```
npx tsx --test \
  apps/api/schedule/timezone.test.ts \
  apps/api/schedule/serialize.test.ts \
  apps/api/schedule/ics.test.ts \
  apps/api/schedule/handlers.test.ts \
  apps/api/alerts/dispatch.test.ts \
  apps/api/posts/posts.test.ts \
  apps/api/games/games.test.ts
```

```
# tests 24
# suites 9
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

## 11. Not done
- Root layout, rail, topbar, transport (not C).
- Wiring WhatsOnNow to a live WebSocket (poll fallback only).
- Durable alert deliveries and a scheduled job.
- Real web-push send (VAPID).
- Full MDX (JSX) compile.
- Importing ICS into Apple/Google Calendar.
- Browser e2e of keyboard game play.
- Homepage redirect from `/`.
- Replacing fixture stores with Drizzle.
- Shared `@repo/ui` import (package missing).
