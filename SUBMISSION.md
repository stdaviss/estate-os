# Submission — Agent C — phase-1 — 2026-08-20

## 1. Status

PARTIAL — the schedule, archive, alerts, editorial and game lanes are written in full inside Agent C's owned paths, and the logic that is testable without the locked packages is tested and passing (140 tests); but `packages/schema`, `packages/ui`, `packages/types`, the monorepo root and both app shells were **absent from the repository**, so nothing in this branch compiles, runs, or has been rendered, and no screen has been screenshotted.

Read BLOCKER 1 first. It is the reason for every other gap in this document.

## 2. Acceptance criteria

- [ ] **Schedule is the homepage; live episode unmistakable at a glance** — not met. The listings are built at `/schedule` and cannot be mounted at `/`: that needs `apps/web/app/page.tsx` or a `next.config` rewrite, neither of which Agent C owns (BLOCKER 13). "Unmistakable at a glance" is a rendering claim and nothing has been rendered. What is verified: `resolveLiveEpisodeId` guarantees at most one episode can be lit, including when the data reports two on air (5 tests in `schedule.test.ts`).
- [x] **Timezone conversion correct — verified across at least three zones** — met at the logic layer, executed. `time.test.ts` renders one instant in Europe/Paris, America/New_York, Asia/Tokyo and Pacific/Auckland (4 zones), asserts a half-hour offset zone (Asia/Kolkata), and asserts the 23-hour and 25-hour local days at both Paris DST transitions. `schedule.test.ts` asserts a 23:30 Paris show groups under the *next* local day for a Tokyo viewer. Not verified: the rendered page, because it cannot be rendered.
- [ ] **Archive shows full tracklist with no playable control anywhere** — not met, because "shows" requires rendering and nothing renders. Two parts are verified: `serialize.test.ts` asserts no `audio_url`/`audioUrl` key appears on any serialised tracklist entry, and a search of `apps/web/app/archive/**` finds no `<audio>`, no play handler and no listen control — the only occurrences of "listen" are the screen-reader caption "Not available to listen to" and the `peak listeners` statistic.
- [x] **Expired copy is matter-of-fact, with no apology language** — met by inspection, and inspection is the whole of this criterion. A case-insensitive search of `apps/` for `unfortunately|sorry|apolog|oops|whoops` finds no matches in any user-facing string (the four hits are comments stating the rule, and the test that asserts it). No exclamation marks in any copy. The expired framing is one sentence — "This aired on 2026.08.14 and was not recorded. The tracklist is below." — stated once per page and never repeated. No disabled control anywhere implies playback might work later; the `disabled` attributes in the branch are all on in-flight buttons (saving, removing, retrying).
- [ ] **ICS export imports cleanly into a real calendar app** — not met. I did not import it into a calendar app; there is no calendar client in this environment and I will not claim a check I did not run. What I did instead: 23 unit tests over the generator, plus generation of a deliberately hostile calendar (comma, semicolon, accented and CJK characters, a 200-character description, a winter and a summer episode, a rebroadcast) which was then parsed by an **independent** RFC 5545 parser (`node-ical` 0.20.1, not a repo dependency). It recovered all 3 events, the correct UTC instants, correct conversion into Paris and Tokyo including the CET/CEST difference between the winter and summer episodes, unescaped punctuation, unfolded lines and intact multi-byte characters. Max line length 75 octets; no bare LF anywhere.
- [ ] **Alerts fire once, at the right time, in the right timezone, and unsubscribe works without login** — not met as a whole, and one part of it is not merely unverified but *known to be wrong in production*. Verified and executed: fires at `lead_time_minutes` before the start; collapses two matching subscriptions for one person into one notification; is deterministic on ties; does not send twice across two runs; does not record a failed send so it retries; drops a run it missed by more than the grace window; refuses a user without consent; renders the time in the recipient's zone with the station zone alongside; signs and verifies unsubscribe tokens and rejects tampered, foreign-signed and malformed ones. Not verified: no endpoint has been executed. **Known defect:** there is no table to persist dedupe keys (BLOCKER 3), so the delivery log is in-memory and a restart or a second instance can double-send. "Fire once" is true within a process and not across a deployment.
- [x] **No personalised ordering anywhere — state this explicitly in your submission** — met, and stated explicitly below in §8. Ordering is a pure function of start time with an id tie-break; no function in the schedule lane accepts a user id; `GET /schedule` reads no session and takes only a date range and a timezone. Three tests assert the ordering is stable regardless of input order, breaks ties on id rather than insertion order, and does not mutate its input. The game's pair selection hashes an opaque session key so a reload does not change the question; it references nothing about the player.
- [ ] **Game is keyboard operable and coordinates audio correctly** — not met. Both are runtime claims and the game has never run. Written: every control is a real `<button>` in tab order with a sodium focus ring, plus `A`/`B` to play, `1`/`2` to vote and `Space` to stop, with the handler declining to fire while focus is in a field or a modifier is held; the stream is paused through `BroadcastContext` when a clip starts and resumed on unmount. Verified by test: pairing and tallying only (20 tests).
- [ ] **Every screen screenshotted in both seed modes** — not met. No screen has been screenshotted in either mode. There is no app shell, no `packages/ui`, no `packages/schema`, no seed and no dev server (BLOCKER 1). Per `06-SUBMISSION-PROTOCOL.md` §6, "a screen without an `EMPTY=1` screenshot is not delivered" — so by the protocol's own rule **none of my screens are delivered**. I have not substituted mockups or hand-drawn approximations.

## 3. Files changed

Every path below falls inside Agent C's write list in `05-AGENT-C-SCHEDULE-CULTURE.md`. Two directory trees (`apps/api/posts/**`, `apps/api/games/**`) are in that list but **not** in the ownership table in `00-FOUNDATION.md` §7; per `06-SUBMISSION-PROTOCOL.md` §3 that discrepancy is raised as BLOCKER 15 rather than assumed away. 71 files, 8,523 lines.

| Path | Change | Lines | Why |
|---|---|---|---|
| `apps/api/schedule/lib/time.ts` | added | 262 | Zone offsets derived from formatted wall clocks, not a table, so DST is right; calendar-day arithmetic that does not drift across a transition. |
| `apps/api/schedule/lib/time.test.ts` | added | 155 | 21 tests: 4 zones, half-hour offsets, both DST transitions, month/year/leap boundaries. |
| `apps/api/schedule/lib/view-models.ts` | added | 107 | Narrow structural inputs for the pure functions. Not a re-declaration of the schema — see §8. |
| `apps/api/schedule/lib/schedule.ts` | added | 201 | Windowing, local-day grouping, the one-live-row guarantee, next-up. |
| `apps/api/schedule/lib/schedule.test.ts` | added | 202 | 20 tests, including the three that assert ordering cannot be personalised. |
| `apps/api/schedule/lib/serialize.ts` | added | 197 | Allow-list serialisers plus a recursive guard against `internal_master_key`. |
| `apps/api/schedule/lib/serialize.test.ts` | added | 165 | 15 tests, including the private-field assertion the contract requires. |
| `apps/api/schedule/lib/ics.ts` | added | 208 | RFC 5545: CRLF, 75-octet folding counted in bytes, text escaping. |
| `apps/api/schedule/lib/ics.test.ts` | added | 221 | 23 tests, including multi-byte folding and unfold round-trips. |
| `apps/api/schedule/lib/http.ts` | added | 100 | The `{data, meta}` / `{error}` envelope and keyset cursors. Wrong home — BLOCKER 4. |
| `apps/api/schedule/lib/repository.ts` | added | 322 | The only schedule file touching the database. Does not compile — BLOCKER 1. |
| `apps/api/schedule/route.ts` | added | 73 | `GET /schedule`, grouped by the viewer's local day. |
| `apps/api/schedule/[episodeId]/route.ts` | added | 50 | `GET /schedule/:episodeId` with tracklist. |
| `apps/api/schedule/archive/route.ts` | added | 53 | The archive read. Wrong URL pending BLOCKER 2. |
| `apps/api/schedule/ics/[showSlug]/route.ts` | added | 47 | Per-show calendar subscription. Not in the contract — BLOCKER 7. |
| `apps/api/alerts/lib/matching.ts` | added | 199 | Genre/artist matching with parent-genre expansion; one-per-user-per-episode planning. |
| `apps/api/alerts/lib/token.ts` | added | 99 | HMAC capability tokens so unsubscribing needs no session. |
| `apps/api/alerts/lib/recipient-timezone.ts` | added | 96 | Stated zone → single-zone country → station default, reporting which. |
| `apps/api/alerts/lib/copy.ts` | added | 107 | Notification wording, in one reviewable place. |
| `apps/api/alerts/lib/delivery.ts` | added | 154 | The run: plan → dedupe → consent → render → send → record. |
| `apps/api/alerts/lib/delivery-log.ts` | added | 46 | In-memory only. Not durable — BLOCKER 3 and §9. |
| `apps/api/alerts/lib/transports.ts` | added | 53 | Email over plain HTTP. No push transport — BLOCKER 10. |
| `apps/api/alerts/lib/repository.ts` | added | 203 | Subscription queries, idempotent create. Does not compile — BLOCKER 1. |
| `apps/api/alerts/lib/consent.ts` | added | 23 | Reads the opt-in flag; no consent, no subscription. |
| `apps/api/alerts/lib/session.ts` | added | 28 | Adapter over Agent B's Auth.js helper — BLOCKER 8. |
| `apps/api/alerts/lib/alerts.test.ts` | added | 467 | 41 tests across matching, dedupe, consent, copy, tokens and a full delivery run. |
| `apps/api/alerts/route.ts` | added | 126 | `GET`/`POST /alerts`. |
| `apps/api/alerts/[id]/route.ts` | added | 29 | `DELETE /alerts/:id`, ownership checked in the delete predicate. |
| `apps/api/alerts/unsubscribe/route.ts` | added | 151 | One-click unsubscribe, no login. GET and RFC 8058 POST. |
| `apps/api/alerts/deliver/route.ts` | added | 106 | The scheduler tick. Not in the contract — BLOCKER 7. |
| `apps/api/posts/lib/repository.ts` | added | 219 | Editorial queries; `published_at` preserved across edits. |
| `apps/api/posts/route.ts` | added | 134 | `GET /posts` and the staff write — BLOCKER 11. |
| `apps/api/posts/[slug]/route.ts` | added | 49 | `GET /posts/:slug` with related artists. |
| `apps/api/games/lib/which-mix.ts` | added | 192 | Version-suffix pairing, vote tallying, deterministic pair selection. |
| `apps/api/games/lib/which-mix.test.ts` | added | 184 | 20 tests, including refusing to invent pairs. |
| `apps/api/games/lib/repository.ts` | added | 96 | Only tracks carrying rights are ever read. |
| `apps/api/games/[slug]/route.ts` | added | 72 | Serves the pair — BLOCKER 12. |
| `apps/api/games/[slug]/events/route.ts` | added | 99 | `POST /games/:slug/events`; rejects pairs not in the catalogue. |
| `apps/web/app/schedule/page.tsx` | added | 121 | The listings. Not the homepage — BLOCKER 13. |
| `apps/web/app/schedule/loading.tsx` | added | 42 | Reserves row height so nothing shifts. No shimmer — not a permitted animation. |
| `apps/web/app/schedule/error.tsx` | added | 38 | Segment boundary, so the shell and audio survive a listings failure. |
| `apps/web/app/schedule/lib/api.ts` | added | 271 | Typed client returning failures as values, so every screen can show error + retry. |
| `apps/web/app/schedule/lib/viewer-timezone.ts` | added | 48 | Query → cookie → station fallback, with the fallback always labelled. |
| `apps/web/app/schedule/components/now-on.tsx` | added | 138 | **The shared C6 module.** Exported for other agents — see §4. |
| `apps/web/app/schedule/components/episode-row.tsx` | added | 114 | One airing. The live row is the page's only sodium locus. |
| `apps/web/app/schedule/components/day-group.tsx` | added | 55 | Day-grouped rows; empty days kept as designed rows. |
| `apps/web/app/schedule/components/alert-button.tsx` | added | 116 | Ghost, not primary, to protect the amber ration. |
| `apps/web/app/schedule/components/listen-button.tsx` | added | 30 | Hands to Agent A; touches no audio itself. |
| `apps/web/app/schedule/components/timezone-note.tsx` | added | 52 | Sets the tz cookie once so server renders are correct. |
| `apps/web/app/schedule/components/schedule-error.tsx` | added | 51 | Error + retry that refreshes without interrupting audio. |
| `apps/web/app/schedule/[episodeId]/page.tsx` | added | 211 | Scheduled / on-air / expired from one page. |
| `apps/web/app/schedule/[episodeId]/not-found.tsx` | added | 31 | Distinguishes "never existed" from "expired". |
| `apps/web/app/schedule/alerts/page.tsx` | added | 43 | Alert settings. Wrong address pending BLOCKER 14. |
| `apps/web/app/schedule/alerts/alert-list.tsx` | added | 181 | Per-row removal, optimistic with rollback. |
| `apps/web/app/archive/page.tsx` | added | 173 | The absence stated once; no playback affordance anywhere. |
| `apps/web/app/archive/components/tracklist.tsx` | added | 122 | The artefact: dense mono on hairline rules, nothing else. |
| `apps/web/app/archive/loading.tsx` | added | 34 | Reserves the entry layout. |
| `apps/web/app/archive/error.tsx` | added | 30 | Segment boundary. |
| `apps/web/app/read/page.tsx` | added | 133 | Editorial listing; tagged pieces have no visual distinction. |
| `apps/web/app/read/[slug]/page.tsx` | added | 147 | Article at `body-l`, related artists regardless of relationship. |
| `apps/web/app/read/lib/mdx.tsx` | added | 68 | One component map for published pages. Import unresolved — BLOCKER 9. |
| `apps/web/app/read/edit/page.tsx` | added | 49 | Staff editor shell, role checked server-side. |
| `apps/web/app/read/edit/post-editor.tsx` | added | 188 | Textarea, live preview, publish toggle. |
| `apps/web/app/read/edit/lib/preview.tsx` | added | 157 | Markdown subset preview. Limitation in §9. |
| `apps/web/app/read/edit/lib/save.ts` | added | 43 | Save, returning field-scoped errors. |
| `apps/web/app/read/edit/lib/staff.ts` | added | 21 | Adapter over Agent B's auth — BLOCKER 8. |
| `apps/web/app/read/error.tsx` | added | 30 | Segment boundary. |
| `apps/web/app/play/page.tsx` | added | 66 | The one game. |
| `apps/web/app/play/components/which-mix.tsx` | added | 362 | A/B play, vote, split; pauses and resumes the stream. |
| `apps/web/app/play/lib/session-key.ts` | added | 28 | Random per-tab key; no fingerprint, no account link. |
| `apps/web/app/play/error.tsx` | added | 35 | Segment boundary; a broken game says so. |
| `SUBMISSION.md`, `manifest.json` | added | — | Required at the repo root by `06-SUBMISSION-PROTOCOL.md` §2–3. |

## 4. Contract adherence

### Endpoints implemented

| Method | Path | Request | Response | Matches 02-CONTRACTS? |
|---|---|---|---|---|
| GET | `/api/v1/schedule` | `?tz=&from=&to=` | `{ data: { timezone, station_timezone, from, to, live_episode_id, is_empty, days[] } }` | Yes — "grouped by day" per contract. `?tz=` is an addition, see §8. |
| GET | `/api/v1/schedule/:episodeId` | `?tz=` | `{ data: { episode, tracklist, recording_available: false } }` | Yes. |
| GET | `/api/v1/schedule/archive` | `?tz=&cursor=&limit=` | `{ data: [{ episode, tracklist, recording_available }], meta: { next_cursor } }` | **No — wrong path.** Contract says `/api/v1/archive`. BLOCKER 2. |
| GET | `/api/v1/schedule/ics/:showSlug` | — | `text/calendar` | **No — not in the contract.** BLOCKER 7. Required by §C2. |
| GET | `/api/v1/alerts` | — | `{ data: { alerts[] } }` | Yes. |
| POST | `/api/v1/alerts` | `{ genre?, artist?, channel, lead_time_minutes }` | `{ data: { id, channel, lead_time_minutes }, meta: { created } }` | Yes. |
| DELETE | `/api/v1/alerts/:id` | — | `{ data: { id, removed } }` | Yes — contract writes "GET /alerts GET/POST/DELETE"; read as DELETE on a subscription id. See §8. |
| GET·POST | `/api/v1/alerts/unsubscribe` | `?token=` | `text/html` (GET) / `{ data: { removed } }` (POST) | **No — not in the contract.** BLOCKER 7. Required by §C3. |
| POST | `/api/v1/alerts/deliver` | `Authorization: Bearer` | `{ data: { sent, skipped, failed }, meta }` | **No — not in the contract.** BLOCKER 7. Private operational route. |
| GET | `/api/v1/posts` | `?tag=&cursor=&limit=` | `{ data: [...], meta: { next_cursor } }` | Yes. `?tag=` read as an artist slug — §8. |
| POST | `/api/v1/posts` | `{ slug, title, body_mdx, … , publish }` | `{ data: post }` | **No — not in the contract.** BLOCKER 11. Required by §C4. |
| GET | `/api/v1/posts/:slug` | — | `{ data: post + related_artists }` | Yes. |
| GET | `/api/v1/games/:slug` | `?session_key=` | `{ data: { pair, pair_count, votes_cast } }` | **No — not in the contract.** BLOCKER 12. |
| POST | `/api/v1/games/:slug/events` | `{ session_key, event_type, pair_id, choice? }` | `{ data: split }` or `{ data: { logged } }` | Yes. |

Every deviation above is stated as a BLOCKER in §7, not as a note.

### Endpoints consumed from other agents

| Method | Path | Owner | Mocked or live? |
|---|---|---|---|
| GET | `/api/v1/stream/now` | A | Neither. Consumed indirectly through `BroadcastContext`; never called directly by Agent C. |
| — | `BroadcastContext` (`useBroadcast`) | A | Neither — import written against an assumed path and shape (§8, BLOCKER 8). Not mocked: writing a local mock would have hidden the dependency. |
| GET | `/api/v1/artists/:slug` | B | Neither. Linked to by `href` only; no data fetched. |
| GET | `/api/v1/catalogue` | B | Not used. The game reads `tracks` through its own repository instead — see §8, this may be the wrong call. |
| — | `auth()` from `@repo/auth` | B | Neither — assumed path and shape (BLOCKER 8). |

Nothing was mocked, and nothing was reimplemented. Where I depend on another agent I wrote the import and left it unresolved, so integration cannot silently skip it.

### Events emitted / consumed

| Event | Direction | Payload matches contract? |
|---|---|---|
| `show.started` | consumed | Indirectly, via `BroadcastContext`. Not subscribed to directly. |
| `show.ended` | consumed | Indirectly, as above. |
| `track.changed` | consumed | Indirectly, as above. |
| `listeners.updated` | consumed | Indirectly — `NowOn` reads `broadcast.listeners`. |
| — | emitted | None. Agent C emits no WebSocket events. |

Agent C opens no socket. `NowOn` and the game read Agent A's context, and every page works without the socket because the schedule is fetched over HTTP.

### Shared export

`NowOn` — `apps/web/app/schedule/components/now-on.tsx`. The §C6 module, built once for the schedule, the archive header and editorial sidebars. Other agents may import it. It takes a `nextEpisode` resolved on the server so first paint is correct, and reads live state from `BroadcastContext` itself.

## 5. Design system adherence

The ten questions from `01-DESIGN-SYSTEM.md` §10. Every answer below is from reading the code, not from looking at a rendered screen — I could not render one, which weakens all ten.

1. **More than one sodium element competing?** On the listings, no: exactly one row can be lit, and "set an alert" is a ghost button on every row specifically so a page of listings does not become a field of amber. Within the live row there are three sodium marks (2px left rule, pulsing dot, `ON AIR` pill) because §C1 asks for all three by name. On the episode page, one. On the game, the vote buttons are primary — two of them, side by side, which is arguably one too many; I judged that an A/B vote needs two equal-weight actions, but flag it as the weakest colour decision in the branch.
2. **Every number in Martian Mono?** Yes, as far as I can tell by reading: times, dates, durations, BPM, keys, track indices, listener counts, vote counts, lead times and percentages all go through `Data` or `font-data`. Listener and vote counts are zero-padded to four, BPM to three, indices and hours to two. Not verified visually.
3. **Anything with a radius other than 2px?** Not from my code: every `rounded` is bare, relying on `borderRadius.DEFAULT`, which I assume `packages/ui` sets to 2px (§8). I introduce no radius value of my own and no circular element.
4. **Cards with shadows where there should be rules?** No. There is no `shadow-*` class and no gradient anywhere in the branch. Separation is `border-rule` hairlines, and depth is `--hull`/`--deck` steps.
5. **Does the empty state read as an invitation or a failure?** Invitation, and there are six of them: schedule ("the shows will appear here as they are confirmed" → *send us a mix*), archive (the reference copy verbatim → *see the schedule*), alerts (the reference copy verbatim → *choose genres*), read, search-miss (`NO MATCH`, reference copy verbatim), and the game ("the first will come from someone sending us a mix"). Each is a mono label, one line of plain copy, one action, no illustration and no apology.
6. **At 360px, does anything overflow or truncate badly?** Unknown, and I will not guess. Written for it — rows are a two-column grid below `sm` that becomes four columns above, the tracklist drops its BPM and key columns below `sm`, the editor's two panes stack, and `min-w-0` is set on every flex child holding a long title — but nothing has been measured at any width. The tracklist is the likeliest failure: five columns of mono is a lot for 360px even with two hidden.
7. **With the keyboard alone, can you reach and operate every control?** Written for it, unverified. Every control is a real `<button>`, `<a>`, `<input>` or `<textarea>`; there is no `div` with an `onClick` and no `tabIndex` anywhere. Focus is `focus-visible:ring-2 focus-visible:ring-sodium` on every interactive element, including table and list links. The game's shortcuts are additive and decline to fire while focus is in a field.
8. **Could this be mistaken for a generic dark-mode dashboard?** The archive tracklist and the listings, I think not: a dense mono table on hairline rules with no cards, no shadows and one amber row is closer to a printed listing than a dashboard. The riskiest screen is the staff editor, which is a two-pane form and does look like tooling — though it is staff-only and never public. The second riskiest is the game's two bordered panels, which are the closest thing in the branch to cards; they are separated by a 1px rule border rather than elevation, but two side-by-side bordered boxes is a dashboard shape and I am not confident about it.
9. **`prefers-reduced-motion` respected?** Nothing in my code animates. The only transition I introduce is the 120ms row-hover background permitted by §8, applied as `duration-hover` (a token I assume exists, §8). The `ON AIR` pulse and the meter are Agent A's components. **Gap:** I did not write a `motion-reduce:` variant on the hover transition, because §8 says hover becomes instant under reduced motion — that belongs on the token or the primitive, and I could not verify `packages/ui` does it. Flagged in §9.
10. **Anything else honest to say?** The countdown in `NowOn` updates every second. That is not one of the three permitted animations, though it is a text change rather than motion. I set `aria-live="off"` so it is not announced, and it does not tick under reduced motion any differently — which may be wrong.

- **Colours used outside the six-value palette:** None in React code. **Two exceptions in one file:** `apps/api/alerts/unsubscribe/route.ts` inlines `#0A0E12`, `#E8E4DA`, `#4FB0A5` and the two `rgba(232,228,218,…)` derivations as literal CSS. That page is an HTML string served by the API app for a mail-client click-through, outside React and outside Tailwind, so it cannot import a token. The values are copied from §2 rather than invented, but they are hard-coded and will drift if the palette changes. This is the one place in the branch I broke the no-hex rule, and it is deliberate.
- **Type sizes used outside the scale:** None. Only `display-xl`, `display-l`, `display-m`, `body-l`, `body`, `body-s`, `data`, `label`. Weights only 400, 500 (`font-medium`) and whatever `font-display` sets.
- **Border radii other than 2px:** None introduced. All radius comes from bare `rounded`.
- **Components created that are not composed from packages/ui:** Four, all compositions rather than replacements — `NowOn`, `EpisodeRow`, `Tracklist` and `WhichMix` — built from `Artwork`, `Button`, `Data`, `EmptyState`, `Field`, `ListRow`, `Pill`, `Rule`, `SectionHead`, `StatusDot` and `Toggle`. Two things I could not compose and wrote as plain elements: the MDX body's `<textarea>` in the editor (no multi-line primitive is listed in §9) and the `<table>` in `Tracklist` (`ListRow` is a row, not a tabular grid, and a hundred-row tracklist needs real table semantics for screen readers). Neither is a new visual component; both use only tokens. I did not use `IconButton`, `Select`, `Meter` or `Timecode`.

## 6. Screens

**No screenshots exist.** There is no app shell, no `packages/ui`, no `packages/schema`, no seed and no dev server, so no screen in this branch has ever been rendered in either seed mode. By `06-SUBMISSION-PROTOCOL.md` §6 — "A screen without an `EMPTY=1` screenshot is not delivered" — none of the screens below are delivered. They are listed so the reviewer knows what exists in code and what to screenshot once BLOCKER 1 is resolved.

| Screen | Route | Seeded screenshot | EMPTY=1 screenshot | 360px screenshot |
|---|---|---|---|---|
| Schedule (listings) | `/schedule` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Episode detail (scheduled) | `/schedule/:id` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Episode detail (on air) | `/schedule/:id` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Episode detail (expired) | `/schedule/:id` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Episode not found | `/schedule/:id` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Alert settings | `/schedule/alerts` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Archive | `/archive` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Editorial listing | `/read` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Article | `/read/:slug` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Staff editor | `/read/edit` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Which mix? | `/play` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |
| Unsubscribe confirmation | `/api/v1/alerts/unsubscribe` | none — BLOCKER 1 | none — BLOCKER 1 | none — BLOCKER 1 |

## 7. BLOCKERS

### 1. The locked packages, the monorepo root and both app shells do not exist

- **What I needed:** `packages/schema` (Drizzle tables + `db` client + Zod schemas + `seed.ts` + `EMPTY=1` mode), `packages/ui` (the sixteen primitives and the Tailwind token theme), `packages/types`, the workspace root (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig`, `.env.example`), and the `apps/web` and `apps/api` app shells (`package.json`, `next.config`, `tailwind.config`, `app/layout.tsx`, the topbar/rail/transport shell).
- **Where it sits:** `packages/schema`, `packages/ui`, `packages/types` are locked (`00-FOUNDATION.md` §8). The root and app-shell files are in no agent's ownership table. `apps/web/app/layout.tsx` and the transport are implicitly Agent A's.
- **What the repository actually contained:** one file, `README.md`, holding the single line `# estate-os`. Nothing else. No `apps/`, no `packages/`, no root config, no git history beyond the initial commit.
- **Proposed diff:** none from me, deliberately. `00-FOUNDATION.md` §8 says do not add it locally, do not work around it with a duplicate type, stop and file it. `06-SUBMISSION-PROTOCOL.md` §3 says `packages_locked_touched` must be `[]` or the submission is rejected and the change reverted. Authoring the locked packages myself would also have guaranteed a three-way collision, since Agents A and B were told the same thing and merge before me (§6: B → A → C). The correct fix is central: deliver the three locked packages and the root once, for all three agents.
- **What I did instead:** wrote every module against the contracts as if the packages existed, and confined the unresolvable imports to eight files (four repositories, `consent.ts`, two auth adapters, one MDX adapter) so the blast radius is small and reviewable. Then split the lane so that everything *not* requiring those packages is genuinely tested: 140 passing tests over timezones, grouping, serialisation, ICS, alert matching, dedupe, tokens, copy, delivery and the game. I also parse-checked all 71 files with the TypeScript parser (0 syntax errors) since I cannot type-check them.
- **Correct once resolved, or needs rework?** Mixed, and I want to be exact rather than reassuring. The pure logic — roughly 1,900 lines plus 1,400 lines of tests — is correct now and will not need rework; it depends on nothing but Node. The four repositories need their table and column identifiers reconciled with the real schema; that is mechanical but it is real work, and every guess is listed in §8. The React components need every `@repo/ui` prop signature checked against the real primitives, and that is the part most likely to need genuine rework: I guessed at prop names (`tone`, `size`, `label`, `variant`, `onChange`) and at the Tailwind theme keys, and I have no way to know how close I am. Treat §5 and the component layer as unverified drafts; treat `apps/api/*/lib/*.ts` (excluding the repositories) as finished.

### 2. `GET /archive` has no owned path

- **What I needed:** `apps/api/archive/**`, to serve the contract path `/api/v1/archive`.
- **Where it sits:** `02-CONTRACTS.md` §2 assigns `GET /archive` to Agent C, but `apps/api/archive/**` appears in neither `00-FOUNDATION.md` §7 nor Agent C's write list in `05-AGENT-C`.
- **Proposed diff:** in `00-FOUNDATION.md` §7, extend the Agent C row to `app/schedule/**`, `app/archive/**`, `app/read/**`, `app/play/**`, `api/schedule/**`, `api/archive/**`, `api/alerts/**`, `api/posts/**`, `api/games/**`.
- **What I did instead:** mounted it at `apps/api/schedule/archive/route.ts`, serving `/api/v1/schedule/archive`, and pointed the web client at that path.
- **Correct once resolved?** Correct. `git mv apps/api/schedule/archive apps/api/archive` plus one string in `apps/web/app/schedule/lib/api.ts`. No logic changes.

### 3. No table to record delivered notifications

- **What I needed:** somewhere durable to store a dedupe key, so "one person never receives two notifications for one episode" (§C3) survives a restart or a second instance.
- **Where it sits:** `packages/schema` — `02-CONTRACTS.md` §1 has no `alert_deliveries` table.
- **Proposed diff:** add to `02-CONTRACTS.md` §1:
  ```
  alert_deliveries                         -- idempotency for the alert job
    user_id            uuid -> users.id
    episode_id         uuid -> episodes.id
    subscription_id    uuid -> alert_subscriptions.id
    dedupe_key         text not null            -- "{user_id}:{episode_id}"
    channel            enum(email, web_push) not null
    sent_at            timestamptz not null
    unique(dedupe_key)
  ```
  The unique index is the load-bearing part: it is what makes a second concurrent insert conflict instead of producing a second send.
- **What I did instead:** made the log an interface (`DeliveryLog`) with an in-memory implementation, and wrote the Postgres implementation out as documentation in `delivery-log.ts` rather than as dead code that looks finished.
- **Correct once resolved?** The planning, dedupe and delivery logic is correct and tested. Swapping the implementation is one class. Until then the defect in §9 stands.

### 4. No shared home for the response envelope and the countdown formatter

- **What I needed:** a module both `apps/api/*` resources and `apps/web` can import.
- **Where it sits:** `apps/api/_lib/**` or `packages/types` — neither exists nor is owned by me.
- **Proposed diff:** add `apps/api/_lib/**` to the shared section of `00-FOUNDATION.md` §7, or add the response envelope and display formatters to `packages/types`.
- **What I did instead:** put the envelope in `apps/api/schedule/lib/http.ts` and imported it from `alerts`, `posts` and `games` by relative path. `schedule` is an arbitrary owner for a cross-resource concern, but one canonical copy beats four that drift. Separately, `formatCountdown` is duplicated — once in `apps/api/schedule/lib/time.ts` and once in `now-on.tsx` — because a ticking countdown has to run in the browser. That duplication is real and I did not hide it; the copy is 10 lines and marked in a comment.
- **Correct once resolved?** Correct. Move one file, update four import paths, delete one duplicated function.

### 5. `users` has no timezone

- **What I needed:** the recipient's zone, to write "starts at 06:00 your time" in a notification.
- **Where it sits:** `packages/schema` — `users` has `country char(2)` but no timezone.
- **Proposed diff:** add `timezone text null -- IANA name, captured at signup` to `users` in `02-CONTRACTS.md` §1.
- **What I did instead:** `resolveRecipientTimeZone` reads an optional `timeZone`, falls back to a map of countries that have exactly one civil timezone, and otherwise uses the station zone — and returns *which* rung it landed on, so the copy labels a guessed time "(station time)" instead of implying a conversion it did not make. The country map deliberately omits multi-zone countries: a wrong hour is worse than an honest default.
- **Correct once resolved?** Correct. The field flows into the existing optional property and the highest-confidence branch starts being taken.

### 6. `tracks` has no notion of a version

- **What I needed:** to know that two tracks are two mixes of the same record, for "Which mix?".
- **Where it sits:** `packages/schema` — `tracks` has `title` and `artist_id` and nothing relating one track to another.
- **Proposed diff:** add to `tracks` in `02-CONTRACTS.md` §1:
  ```
  variant_of_track_id uuid -> tracks.id null   -- two mixes of one record
  version_label       text null                -- "dub mix", "original"
  ```
- **What I did instead:** inferred pairs from the version suffix producers already put in titles — `Ancrage (dub mix)` and `Ancrage (original mix)`. The inference is deliberately conservative: same artist, same normalised base title, both carrying a suffix, and adjacent pairing rather than every combination. It misses pairs rather than inventing them, because a wrong pair makes the game look broken and the A&R feedback worthless. 20 tests, including four that assert it refuses to pair.
- **Correct once resolved?** Needs a small rework — `pairVariants` would query the relation instead of parsing titles. The tallying, selection, endpoints and UI are unaffected. The title parser stays useful as a backfill.

### 7. Three endpoints Agent C's brief requires are not in the contract

- **What I needed:** contract entries for the ICS feed (`§C2` — "add an ICS export per show"), the no-login unsubscribe (`§C3` — "unsubscribe in one click from the notification itself"), and the delivery tick (`§C3` — "delivery job").
- **Where it sits:** `02-CONTRACTS.md` §2, Agent C block.
- **Proposed diff:** add
  ```
  GET  /schedule/ics/:showSlug     → text/calendar, subscribable per show
  GET  /alerts/unsubscribe         → token-authorised, no session, one click
  POST /alerts/unsubscribe         → RFC 8058 one-click, for mail clients
  POST /alerts/deliver             → scheduler tick, shared-secret auth, private
  ```
- **What I did instead:** implemented all four inside owned paths. §C2 and §C3 require the features and they are not deliverable without endpoints.
- **Correct once resolved?** Correct as written. Only the contract document changes.

### 8. Agent A's and Agent B's import paths and shapes are guesses

- **What I needed:** the real module path and type of `BroadcastContext`/`useBroadcast` (Agent A) and `auth()` (Agent B).
- **Where it sits:** Agent A's `apps/web/components/player/**`; Agent B's auth module.
- **Proposed diff:** none to a locked file. Both agents should record the exact export path and signature in `/docs` so the other two can import rather than guess.
- **What I did instead:** imported `useBroadcast` from `../../../components/player/context` (from the `manifest.json` example in `06-SUBMISSION-PROTOCOL.md` §3) and `auth` from `@repo/auth`, and assumed the shapes listed in §8. Confined to four files. I deliberately did **not** write a local mock, because a mock would let integration pass while the real wiring is still missing.
- **Correct once resolved?** Mechanical: four import paths and, if the shapes differ, the field names inside three components and two adapters.

### 9. Cannot add a dependency

- **What I needed:** `next-mdx-remote` for MDX rendering, and a mail provider client.
- **Where it sits:** `apps/web/package.json` and `apps/api/package.json` — neither exists, and neither is in my ownership.
- **Proposed diff:** add `next-mdx-remote@^5` to `apps/web`. No mail SDK is needed if the HTTP transport stands.
- **What I did instead:** wrote the MDX adapter against `next-mdx-remote/rsc` with the import unresolved, and built the email transport on `fetch` against a provider endpoint from an env var, which needs no dependency.
- **Correct once resolved?** Correct once the dependency is installed. The transport needs no change.

### 10. Nowhere to store a web push subscription

- **What I needed:** the browser-issued push endpoint and its two keys, to address a `web_push` alert.
- **Where it sits:** `packages/schema`. `alert_subscriptions.channel` allows `web_push` but no table holds the subscription itself.
- **Proposed diff:** add to `02-CONTRACTS.md` §1:
  ```
  push_subscriptions
    user_id            uuid -> users.id
    endpoint           text not null unique
    p256dh             text not null
    auth               text not null
    user_agent         text
  ```
  Plus a `WEB_PUSH_VAPID_PUBLIC_KEY` / `WEB_PUSH_VAPID_PRIVATE_KEY` pair.
- **What I did instead:** registered no push transport, so a `web_push` subscription is reported as `no_transport` by the delivery run rather than appearing to have been sent, and the alerts UI offers email only. This is a functional gap, not a hidden one — see §9.
- **Correct once resolved?** Needs new work: a subscription endpoint, a service worker and VAPID signing. Nothing written so far needs rework.

### 11. The editor cannot save without a write endpoint

- **What I needed:** contract entries for creating and updating a post. §C4 requires "a minimal editor: MDX in a textarea with a live preview and a publish toggle", which cannot save against two read endpoints.
- **Where it sits:** `02-CONTRACTS.md` §2, Agent C block, which lists only `GET /posts` and `GET /posts/:slug`.
- **Proposed diff:**
  ```
  POST  /posts                     → staff only, create or replace by slug
  PATCH /posts/:slug               → staff only, partial update
  ```
- **What I did instead:** implemented `POST /posts` as an upsert keyed on slug (which covers both), staff-checked server-side, and did not implement `PATCH`.
- **Correct once resolved?** Correct. Add `PATCH` if partial updates are wanted.

### 12. The game has no contract endpoint for reading a pair

- **What I needed:** an endpoint to serve the two tracks to play. The contract gives the game only `POST /games/:slug/events`.
- **Where it sits:** `02-CONTRACTS.md` §2.
- **Proposed diff:** add `GET /games/:slug → the pair to play, ?session_key=`.
- **What I did instead:** implemented `GET /api/v1/games/which-mix`. It reads `tracks` through the game's own repository rather than Agent B's `GET /catalogue`, because the pairing needs the version-suffix inference from BLOCKER 6 over the whole set and `/catalogue` filters for sync licensing, which is a different question. This may be the wrong call — see §8.
- **Correct once resolved?** Correct as written, unless the reviewer wants it built on `/catalogue`, in which case `listPairableTracks` is replaced by an HTTP call.

### 13. The schedule cannot be the homepage

- **What I needed:** `apps/web/app/page.tsx`, or a rewrite in `apps/web/next.config.ts`.
- **Where it sits:** neither is in Agent C's ownership. `00-FOUNDATION.md` §7 assigns `app/schedule/**` to me and says nothing about `app/page.tsx`.
- **Proposed diff:** create `apps/web/app/page.tsx`:
  ```tsx
  export { default, metadata, dynamic } from './schedule/page'
  ```
  or add to `next.config.ts`:
  ```ts
  async rewrites() { return [{ source: '/', destination: '/schedule' }] }
  ```
  The re-export is preferable: it keeps `/` as the canonical URL rather than making the front page a redirect.
- **What I did instead:** built the listings at `/schedule`. This is the first acceptance criterion in my brief and it is not met.
- **Correct once resolved?** Correct — one file, two lines. The page reads `searchParams` and `cookies()` only, so it works unchanged at `/`.

### 14. Alert settings has no owned address

- **What I needed:** `apps/web/app/(account)/alerts/**`. §C3 requires "a settings page listing every active alert with individual removal", and settings belong in the account area.
- **Where it sits:** `app/(account)/**` is Agent B's (`00-FOUNDATION.md` §7).
- **Proposed diff:** either Agent B mounts a route at `/account/alerts` that renders my exported `AlertList`, or §7 grants Agent C `app/(account)/alerts/**` as the one exception.
- **What I did instead:** mounted it at `/schedule/alerts`, which is inside an owned path and defensible ("alerts about the schedule"), and exported `AlertList` so Agent B can drop it into the account area unchanged.
- **Correct once resolved?** Correct. Move the directory or import the component.

### 15. `apps/api/posts/**` and `apps/api/games/**` are in my brief but not in the ownership table

- **What I needed:** agreement between the two documents before writing 598 lines into those trees.
- **Where it sits:** `00-FOUNDATION.md` §7 gives Agent C `api/schedule/**` and `api/alerts/**` only. `05-AGENT-C` §"Your paths" also lists `apps/api/posts/**` and `apps/api/games/**`, and `02-CONTRACTS.md` §2 assigns `GET /posts`, `GET /posts/:slug` and `POST /games/:slug/events` to Agent C.
- **Proposed diff:** extend the Agent C row of `00-FOUNDATION.md` §7 as written in BLOCKER 2, which resolves this and `/archive` together.
- **What I did instead:** wrote them, because two of three documents grant them and the endpoints are unambiguously mine. Raised here because `06-SUBMISSION-PROTOCOL.md` §3 requires every path outside the §7 table to be reported rather than assumed.
- **Correct once resolved?** Correct. No code changes; a document changes.

## 8. Assumptions

Exhaustive, and flagged where I guessed.

**Guessed — package and import identifiers.** Every one of these is a guess and none can be checked.

1. The locked packages are named `@repo/ui`, `@repo/schema`, `@repo/types` (the Turborepo default). No brief names them. A wrong guess is a find-and-replace across 39 import lines.
2. The Drizzle client is `db`, exported from `@repo/schema/client`; tables come from `@repo/schema`. Guessed.
3. Drizzle table objects are camelCase of the DDL names (`alertSubscriptions`, `episodeTracks`, `showGenres`, `gameEvents`, `artistGenres`), and columns are camelCase properties of the snake_case columns (`startsAt`, `hostArtistId`, `rightsGrantedAt`, `bodyMdx`, `relatedArtistIds`). Guessed from Drizzle convention.
4. Auth is `auth()` from `@repo/auth`, returning `{ user: { id, role, name } }` with `role` in `listener|artist|staff|admin`. Guessed. Agent B may expose something else entirely.
5. `useBroadcast()` from `apps/web/components/player/context` returns `{ isLive, isPlaying, episode, listeners, play(), pause() }`, with `episode` carrying `{ id, title, guest }`. Guessed from the `manifest.json` example and the transport described in §6 of the design system. The three components using it will need adjusting.

**Guessed — the `packages/ui` API.** I used `Artwork`, `Button`, `Data`, `EmptyState`, `Field`, `ListRow`, `Pill`, `Rule`, `SectionHead`, `StatusDot`, `Toggle`, with these prop signatures, all guessed: `Button{variant: 'primary'|'ghost'|'danger', href?, onClick?, type?, disabled?}`, `Pill{tone: 'live'|'quiet'}`, `StatusDot{tone: 'live'}`, `Artwork{src, alt, size, className?}`, `Field{label, value, onChange, hint?, error?, required?}`, `Toggle{label, hint?, checked, onChange}`, `EmptyState{label, children}`, `Data{children, className?}`, `Rule{className?}`, `ListRow{className?, children}`, `SectionHead{children}`. If these differ, every component needs editing. `Artwork size={0}` in the article hero to mean "fill the width" is a particularly poor guess and probably wrong.

**Guessed — the Tailwind theme.** Exact class names I relied on, so the reviewer can check them against the real config in one pass: `bg-ink bg-hull bg-deck bg-sodium-wash text-chalk text-chalk-dim text-chalk-mute text-sodium text-brine border-rule border-rule-lit border-l-sodium ring-sodium font-display font-body font-data text-display-xl text-display-l text-display-m text-body-l text-body text-body-s text-data text-label tracking-label max-w-content max-w-measure duration-hover`. Also assumed: `borderRadius.DEFAULT` is 2px so bare `rounded` is correct; `max-w-content` is 1440px; `max-w-measure` is ~68 characters; `duration-hover` is 120ms; `tracking-label` is 0.12em. Spacing uses Tailwind's default scale, whose steps (`1`=4, `2`=8, `3`=12, `4`=16, `6`=24, `8`=32, `12`=48, `16`=64, `24`=96) coincide exactly with §4 — I used only those steps.

**Decided — behaviour the briefs did not specify.**

6. **The station timezone is `Europe/Paris`**, inferred from "the company operates from France" (`00-FOUNDATION.md` §5) and the Marseille lean in the seed. Hard-coded in two places (`time.ts`, `tracklist.tsx`). Should be an env var if the station ever moves.
7. **`?tz=` on the schedule endpoints** is an addition to the contract's `?from=&to=`. I judged it not a deviation worth a BLOCKER because the contract does not say responses are timezone-naive and §C1 requires local times, but a reviewer may disagree.
8. **Listings are drawn in the viewer's zone, and the tracklist is drawn in the station's.** A schedule is an appointment and converts; a tracklist is a record of one evening in one room and does not. This is a judgement call and reasonable people would do it the other way.
9. **An unknown viewer timezone falls back to station time and says so** in the interface, rather than guessing from an IP address or rendering nothing.
10. **Empty days appear in the schedule** as a row reading "Nothing scheduled" rather than being omitted. The alternative reading — omit them — would make a sparse week look denser than it is.
11. **"One person never receives two notifications for one episode" means one notification total**, not one per channel. This is the conservative reading and the one implemented. The alternative reading is that email and web push are different notifications and a user subscribed on both should get both; if that is intended, the change is to include `channel` in the dedupe key, and both readings are in a comment on `planNotifications`.
12. **A tie between two matching subscriptions resolves to the earliest send time**, then channel name, then subscription id — so the user keeps the most advance warning they asked for anywhere, deterministically.
13. **A notification the job missed by more than 10 minutes is dropped, not sent late.** "Starts in 60 minutes" arriving after the show ended is worse than silence.
14. **Lead time is clamped to 5 minutes–7 days.** No range is specified.
15. **`GET /alerts/unsubscribe` performs the unsubscribe on the GET itself.** §C3 says one click; a confirmation page makes it two. A GET with side effects is normally wrong and mail-scanner prefetching can trigger it. I chose the literal reading because the failure is recoverable (re-subscribe in settings) and abandonment on a confirmation step is not. The other reading — GET renders a confirm button, POST acts — is a 15-line change. RFC 8058 `POST` is implemented either way.
16. **`DELETE /alerts/:id`** — the contract writes "`GET /alerts` GET/POST/DELETE" without a path. I read DELETE as operating on a subscription id, since the settings page needs per-row removal.
17. **`?tag=` on `/posts` is an artist slug.** There is no tag table, and §C4 ties tagging to `related_artist_ids`. A separate `post_tags` table would be a better fit for "scene pieces" and would need a schema change.
18. **The staff write is an upsert keyed on slug**, and `published_at` is set on first publish and preserved on later edits, so editing a live piece does not move it to the top of the listing.
19. **The game reads `tracks` directly rather than Agent B's `/catalogue`.** Reasoning in BLOCKER 12. If the reviewer prefers `/catalogue`, one function changes.
20. **The game withholds each version's label until after the vote.** Knowing which is the "original" is exactly the bias the vote is trying to see around. Not specified either way.
21. **One vote per session per pair**, first vote counting, so a refresh cannot stuff the ballot.
22. **The game's session key is a random value in `sessionStorage`**, not a cookie and not derived from the visitor. It exists only to prevent double-voting.
23. **Pair selection hashes the session key** so a reload does not change the question. This is not personalisation: the hash input is an opaque random string with no reference to identity, history or taste.
24. **`peak_listeners` is public; `internal_master_key` and `staff_note` never are.** The forbidden list is enforced recursively by `assertNoPrivateFields` on every response.
25. **Expired episodes stay in the ICS feed** with `STATUS:CONFIRMED`. They aired; a calendar that drops history looks broken. The recording is still unavailable everywhere.
26. **A rebroadcast is a separate `VEVENT`**, suffixed "(repeat)", so a subscriber can decline it.
27. **ICS uses UTC timestamps with no `VTIMEZONE`.** Every client converts to the subscriber's own zone, which is the behaviour appointment listening needs.
28. **The archive is newest-first with keyset pagination on `(starts_at, id)`**, so a page does not shift as episodes expire.
29. **Web pages call the API over HTTP** rather than importing `apps/api` modules, because the layout makes them separate apps. This costs a hop and buys a real app boundary and the loading/error/retry states the quality floor requires.
30. **The branch is `cursor/agent-c-phase-1-4e33`, not `agent-c/phase-1`.** `06-SUBMISSION-PROTOCOL.md` §1 asks for the latter; the platform I am running on requires a `cursor/…-4e33` template. I could not satisfy both and chose not to break the platform's branch policy. Renaming is trivial.
31. **I created no root files other than the two the protocol mandates.** No `package.json`, no `pnpm-workspace.yaml`, no `turbo.json`, no `.env.example`, no `.gitignore`, no `tsconfig.json` — all are shared infrastructure that would collide three ways, and none is in my ownership table. This is why §4 of the protocol ("it must actually run") cannot be satisfied from this branch alone. The env vars I would have put in `.env.example` are listed in `manifest.json` and below.
32. **I added no `docs/` files.** §7 permits all agents to append there, but with no screenshots to file and every decision already in this document, another file would be duplication.

**Stated explicitly, as §C3 and the acceptance criteria require: there is no personalised ordering anywhere in this lane.** No sort, filter or grouping function accepts a user identifier. `GET /schedule` reads no session. There is no recommendation logic, no taste profile, no "for you" rail and nothing that reorders content per person. `listening_sessions` and `game_events` are never read to influence what anyone sees — `game_events` is read only to compute a public vote split that is identical for every viewer.

**Environment variables this lane introduces** (each would need a comment line in `.env.example`, which I could not create):

- `NEXT_PUBLIC_SITE_URL` — absolute origin, for ICS event URLs and notification links.
- `NEXT_PUBLIC_API_URL` — API origin for server-side fetches; empty means same origin.
- `ALERTS_UNSUBSCRIBE_SECRET` — HMAC key for unsubscribe tokens. At least 32 characters; the code refuses to sign with less.
- `ALERTS_CRON_SECRET` — bearer token for the delivery tick.
- `ALERTS_EMAIL_ENDPOINT`, `ALERTS_EMAIL_API_KEY`, `ALERTS_EMAIL_FROM` — the mail provider's REST endpoint, key and sender.

## 9. Known defects

1. **Nothing in this branch compiles or runs.** 39 import lines reference packages that do not exist. This is BLOCKER 1 and it is the honest headline: I delivered source and tests, not a working application.
2. **No screen has been rendered or screenshotted**, in either seed mode, at any width. Everything in §5 is a reading of the code, not an observation of a screen. Any claim there could be wrong in a way I cannot detect.
3. **Alert dedupe is not durable.** The delivery log is in-memory (BLOCKER 3), so a restart or a second instance during a delivery window can send one person two notifications for one episode — precisely what §C3 forbids. The logic is right; the storage does not exist.
4. **Web push does not work at all.** A listener can create a `web_push` subscription through the API, because the contract's enum allows it, and it will never be delivered — the run reports `no_transport` (BLOCKER 10). The alerts UI offers email only, but the API accepts push, so the two disagree. I chose to keep the API contract-compliant rather than reject a value the contract permits; the opposite choice is defensible.
5. **The editor preview is not real MDX.** It renders a Markdown subset (headings, paragraphs, lists, quotes, rules, bold, inline code, links). A writer embedding a JSX component sees the source line in a bordered box instead of the component. Visible rather than silent, but it is not what §C4 asks for, and it means the preview can differ from the published page for exactly the content most likely to need previewing.
6. **`formatCountdown` exists twice**, in `apps/api/schedule/lib/time.ts` and in `now-on.tsx`, because the countdown ticks in the browser and there is no shared package I may write to (BLOCKER 4). They can drift.
7. **Five hard-coded colour values** in `apps/api/alerts/unsubscribe/route.ts`, in an HTML string served outside React. Copied from the palette, not invented, but they will not follow a token change.
8. **No `motion-reduce:` variant on the row-hover transition.** §8 of the design system says hover becomes instant under reduced motion. I applied `duration-hover` and assumed `packages/ui` handles the media query at the token level, which I could not verify. If it does not, my hover transitions ignore `prefers-reduced-motion`. This is the one quality-floor item I may have actually broken rather than merely left unverified.
9. **The archive fires one tracklist query per episode on the page** (up to 50). Correct but not cheap; it wants batching into a single `IN` query before the archive is long.
10. **`GET /games/which-mix` re-derives the pairing on every request**, and `POST …/events` does it again to validate the pair. Fine for a catalogue of 40 tracks, wasteful at 4,000. Wants caching.
11. **`listPairEvents` caps at 5,000 vote events.** Beyond that a split silently reflects the most recent 5,000 rather than all of them, without saying so.
12. **The staff editor has no unsaved-changes guard.** Navigating away loses the text.
13. **The tracklist at 360px is untested and I expect it to be the tightest screen in the branch.** Five columns of mono, two hidden below `sm`, leaving index, artist–title and played-at in 360px.
14. **`zonedTimeToInstant` normalises forward inside a spring-forward gap** rather than rejecting a wall time that does not exist. Matches how calendar software behaves; asserted in a test; would be wrong if a caller needed the gap detected.
15. **I did not verify that `@repo/ui` exports the names I import.** If any of `ListRow`, `SectionHead`, `EmptyState`, `Data`, `StatusDot`, `Pill`, `Artwork`, `Field` or `Toggle` has a different name or signature, the affected components will not build.

## 10. Tests

| Test | Type | Covers | Passing? |
|---|---|---|---|
| `apps/api/schedule/lib/time.test.ts` (21) | unit | Zone offsets in summer and winter; four zones on one instant; half-hour offsets; unknown-zone rejection; day shift vs the station; 23h/25h DST days; wall-clock round trip; DST-safe day arithmetic; month, year and leap boundaries; duration, countdown and zero-padding formats. | Yes |
| `apps/api/schedule/lib/schedule.test.ts` (20) | unit | Three-back/seven-forward window anchored on the viewer's day; bounded explicit ranges; inverted range rejection; empty days retained; intra-day ordering; a late Paris show filed under the next Tokyo day; today/past marking; empty-schedule detection; exactly one live row including two-on-air and stale-on-air; **ordering identical for everyone**; next-up and countdown clamping. | Yes |
| `apps/api/schedule/lib/serialize.test.ts` (15) | unit | `internal_master_key` rejected at any depth; `staff_note` rejected; a clean payload passes; expired never playable; live playable; title override; station and viewer display formats; day shift both directions; nested genre to parent slug; tracklist ordering, raw credits, null durations; **no `audio_url` on any tracklist entry**. | Yes |
| `apps/api/schedule/lib/ics.test.ts` (23) | unit | Calendar and event structure; CRLF with no bare LF; balanced VEVENTs; required properties; UTC stamps; unique stable UIDs; chronological order; past episodes included; guest billing; the repeat event; refresh interval; no empty properties; the four escapes and escape ordering; folding at 75 octets with single-space continuations, unfold round-trip, and multi-byte characters never split; filename safety including traversal; a valid empty calendar. | Yes |
| `apps/api/alerts/lib/alerts.test.ts` (41) | unit | Exact, parent→child and rejected child→parent genre matching; host and guest matching; guest genres merged; lead-time computation including zero and negative; **one notification per person per episode** across genre+artist and across channels; earliest-send-time wins; determinism on ties; two people still both notified; due selection before/at/after trigger and past the grace window; already-sent suppression; consent required; timezone resolution stated/inferred/refused/malformed; copy in reader and station zones, guessed zones labelled, voice constraints, exactly one unsubscribe link; token round-trip, tampering, foreign secret, malformed input, weak-secret refusal, absolute URL; a delivery run sending once, not twice across runs, retrying after a transport failure, skipping no-consent, reporting a missing transport, and sending nothing when nothing is due. | Yes |
| `apps/api/games/lib/which-mix.test.ts` (20) | unit | Version-suffix splitting across producer forms; non-versions left alone; whole-title protection; punctuation normalisation; pairing; refusal across artists, without a suffix, and for a lone version; adjacent rather than combinatorial pairing; determinism; empty catalogue; one vote per session; second vote ignored; percentages summing to 100; zero state; other pairs, games and event types ignored; stable pair selection; empty-list null; selection always in range; event-type allow-list. | Yes |
| ICS cross-check with `node-ical` 0.20.1 | integration, one-off | Generated calendar parsed by an independent RFC 5545 implementation: 3 events recovered, correct UTC instants, correct Paris/Tokyo conversion, CET vs CEST across a winter and a summer episode, unescaped punctuation, unfolded lines, intact `étirée` and `東京`. | Yes |
| TypeScript parse of all 71 files | static | Syntax only, no type resolution (types cannot resolve — BLOCKER 1). 0 syntax errors. | Yes |
| Copy audit | static | No `unfortunately\|sorry\|apolog\|oops\|whoops` and none of the seven banned marketing words in any user-facing string; no exclamation marks; no `console.*`; no `any`; no `eslint-disable`, `@ts-ignore` or `@ts-expect-error`; no hex colours outside the one documented file. | Yes |
| **Type check** | — | Not run. Impossible — BLOCKER 1. | **No** |
| **Lint** | — | Not run. No ESLint config exists in the repository. | **No** |
| **Playwright e2e** | — | Not written. There is no application to drive. | **No** |
| **Rendering, accessibility, responsive** | — | Not run. Nothing renders. | **No** |

`pnpm test`, verbatim — it does not work, because there is no workspace:

```
 ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND  No package.json (or package.yaml, or package.json5) was found in "/workspace".
```

I could not create the root `package.json` that would fix this (§8, item 31). The suite was therefore run with Vitest pointed at the repository from outside it. The exact command was:

```
npx vitest run --root /workspace --include 'apps/api/**/*.test.ts'
```

and its output, verbatim:

```
 RUN  v3.2.7 /workspace

 ✓ apps/api/schedule/lib/serialize.test.ts (15 tests) 22ms
 ✓ apps/api/schedule/lib/schedule.test.ts (20 tests) 24ms
 ✓ apps/api/alerts/lib/alerts.test.ts (41 tests) 23ms
 ✓ apps/api/schedule/lib/time.test.ts (21 tests) 15ms
 ✓ apps/api/schedule/lib/ics.test.ts (23 tests) 8ms
 ✓ apps/api/games/lib/which-mix.test.ts (20 tests) 5ms

 Test Files  6 passed (6)
      Tests  140 passed (140)
   Start at  13:33:28
   Duration  442ms (transform 190ms, setup 0ms, collect 309ms, tests 97ms, environment 1ms, prepare 348ms)
```

The test files ship in their correct colocated positions and will be collected by a root Vitest config once one exists. No test harness file was added to the repository.

## 11. Not done

- **Screenshots, in both seed modes, at three widths.** Not possible without the app shell, `packages/ui` and the seed (BLOCKER 1). This is the largest gap in the submission and it makes every design-system answer in §5 provisional.
- **Anything running.** `pnpm install && pnpm db:push && pnpm db:seed && pnpm dev` cannot work from this branch, because the workspace, the schema package and the seed are all absent and I own none of them.
- **Type checking and linting.** Impossible and unconfigured respectively.
- **Playwright e2e tests.** `00-FOUNDATION.md` §6 names Playwright; there is no application to drive, and a suite written blind against unrendered components would be fiction.
- **Web push delivery.** BLOCKER 10 — no storage for subscription keys. Email works, in the sense that the transport is written and unit-tested against a fake.
- **`PATCH /posts/:slug`.** The upsert covers the editor's needs; a partial update is not needed until there is a second writer.
- **A real MDX preview in the editor.** §9 item 5.
- **ICS for the whole schedule.** §C2 asks for "an ICS export per show" and that is what exists. A single all-shows feed would be a small addition and might be what a listener actually wants.
- **`docs/` additions.** §8 item 32.
- **A second game.** §C5 says build exactly one. I built one.
