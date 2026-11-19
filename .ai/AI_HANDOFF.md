# AI Handoff — french-learning-for-world

Shared continuity file for every AI coding agent used on this repository.
Read it first, then continue from "Next step".

Rules for whoever edits it: target 40–80 lines, hard limit 150. No secrets, no
tokens, no credentials, no connection strings, no server IPs. Narrative sections
are written by the agent; the state block is generated — do not hand-edit it.

<!-- ai:state:start -->
- Updated: 2026-11-07 11:54 +03 (git metadata only, written by a Stop hook)
- Branch: fix/hero-film-framing
- HEAD: 3897dd7 Merge pull request #78 from shahinamani/feat/landing-hero-video
- Uncommitted: 13 file(s)
  -  M content/attribution.json
  - D  web/public/photos/eiffel-golden-hour-1280.webp
  - D  web/public/photos/eiffel-golden-hour-640.webp
  - D  web/public/video/eiffel-golden-hour.mp4
  -  M web/src/lib/i18n.ts
  -  M web/src/lib/locales/fa.ts
  -  M web/src/lib/locales/fr.ts
  -  M web/src/routes/Landing.tsx
  - … and 5 more
<!-- ai:state:end -->

## Goal

A free French study portal for Persian-speaking (and other) adults with an exam date (DELF, DALF, TCF, TEF). Redesign v2 (owner-approved 2026-11-19, Design canvas https://claude.ai/artifact/2rdofTMH7SXVKj6adSdCG6): one daily path, one heading per section, focus mode for study, full-width pages with useful detail, no fake numbers. Live on Cloudflare Pages (project `frenchmavie`, production branch `main`, root `web`, `NODE_VERSION=22`); every push to main deploys.

## Current state

Branch `redesign/portal-v2` (from `origin/main` 45cda38), pushed, PR open to `main`. It holds:
- Five security-audit fixes: error boundary inside the shell, dev review endpoint checks Origin/content-type/size/fields, FSRS card fields validated on import, SW does not cache rewritten HTML for non-navigation requests, GitHub actions pinned to SHAs.
- `SectionHead` on every list page (photo banners and duplicate titles gone); breadcrumb line and search box removed, search is an icon in the bar (Cmd-K still works); focus mode (`FOCUS` regexes in `components/Shell.tsx`) for cards, exam sit, letter desk, verb drill; sidebar: Learning group (cards, verbs, grammar, reading, writing, themes, dialogues), resources under the exam, no duplicate "Choose your exam".
- Card session in one column with Listen button (`hooks/useVoice.ts`, speeds from `lib/speech.ts`); `NextStep` at the end of a lesson (next lesson), text (next text), verb (drill).
- Today = three-step session from `lib/plan.ts` (cards due, weak point's lesson or first at exam level, first unanswered text at exam level), stored per profile per day; Session/GrammarLesson/ReaderPage call `completeStep`; readiness and "left unfinished" cards.
- `/app/exam/:target`: exam date per profile (`userKey(userId,'exam-date')`), countdown and day plan, four sections with the learner's real counts, official resources, teacher card.
- Workspace retired: `/app/workspace` redirects to `/app/cards`; Dialogues is `/app/dialogues`.
First load 149.9 / 150.0 KB. Unit tests: 514 pass; the 10 "failures" on a bare `node --test` are `.ts` resolution; the pre-push sweep and CI use `tests/register.mjs` and pass.

## Next step

After the PR merges, verify on `main` and on the live site (`curl -sI https://frenchmavie.com/` for CSP/HSTS headers). Then: owner checks the phone layout on a real phone; owner/teacher reviews the drafted Persian UI strings (`docs/review/fa-ui-drafts.md`) and card sentences; a teacher reads `content/letters.json`; update `docs/blueprint/CONTRACTS-v0.2.md` (still describes `/workspace`); `lib/card-backs.ts` has no screen consumer any more. Older open items: fix « frire » in the verb tables; frenchmavie.com custom domain on Pages and `docs/deploying.md` to match.

## Decisions

- 2026-11-19 (owner): one flashcard tool (the FSRS session); photo banners off inner pages; sidebar stays exam-centred; Today is a session; mockups are made on the Design canvas, never CSS wireframes; security review runs with every redesign round.
- 2026-11-06 (owner, site sent to ~10,000 learners): no "draft / unreviewed / not verified" notice is shown to learners; review data is kept in the files. Overrides the learner-facing part of AGENTS.md §2.
- shadcn/ui, Magic UI free parts only, everything free; no server, Cloudflare Pages free plan; guest only; four interface languages, Arabic falls back to English for lazy groups.
- Only assets that need nobody's permission; licence checked before showing (Pexels film on the landing; Unsplash photos).
- Palette: warm paper, street-sign blue #1f3a6e, Spectral/Newsreader for French, Inria Sans; Vazirmatn for Persian.

## Gotchas

- New dictionary keys go in the core `en` object of `lib/i18n.ts` after `skipToContent` (and at the same anchor in fa/fr/ar), not beside `shell*` keys: the lazy-group test otherwise accuses Arabic of a partial group. Lazy text groups: todayEn, workspaceEn, grammarEn, readerEn, writingEn, topicsEn, weaknessEn.
- `tests/no-untranslated-strings.test.js` flags Latin text between JSX tags, in aria-label/placeholder/alt/title, and `=> new Map<T>()`-style generics.
- First-load JS is at the ceiling (0.1 KB spare): nothing eager without making room; new routes are lazy.
- Headless Chrome `--window-size=390` clips the right edge; it is the headless window, not the site (CDP at a real 390 px viewport: scrollWidth 390). Full-page screenshots need `main{overflow:visible}`.
- The commit-msg hook refuses attribution trailers, even quoted; `scripts/check-commit-messages.sh` scans every ref.
- The main checkout is on the stale `content/b1-neg-5-meaning` branch; implement in a worktree from `origin/main`. Playwright's browser is not installed: e2e with `CHROMIUM=<Chrome binary>` and `BASE=http://localhost:4173/`.
- `lib/typography` fr() groups 4+ digit numbers; letters undo it locally.

## How to run and test

From a worktree root: `cd web && npm ci --ignore-scripts && npm run build && npx vite preview --port 4173`; unit tests as the sweep runs them: `node --import ./tests/register.mjs --test tests/*.test.js`; `./scripts/setup-hooks.sh` once per clone.
