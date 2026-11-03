# AI Handoff — french-learning-for-world

Shared continuity file for every AI coding agent used on this repository.
Read it first, then continue from "Next step".

Rules for whoever edits it: target 40–80 lines, hard limit 150. No secrets, no
tokens, no credentials, no connection strings, no server IPs. Narrative sections
are written by the agent; the state block is generated — do not hand-edit it.

<!-- ai:state:start -->
- Updated: 2026-11-03 14:07 +03 (git metadata only, written by a Stop hook)
- Branch: redesign/v1
- HEAD: 7be958b Turn the card back and forth, move between cards, a timer panel
- Uncommitted: 18 file(s)
  -  M .ai/AI_HANDOFF.md
  -  M web/scripts-sync.sh
  -  M web/scripts/sw.mjs
  -  M web/src/features/flashcards/Session.tsx
  -  M web/src/lib/i18n.ts
  -  M web/src/lib/locales/fa.ts
  -  M web/src/lib/locales/fr.ts
  -  M web/src/lib/types.ts
  - … and 10 more
<!-- ai:state:end -->

## Goal

Redesign v1: rebuild the landing page and the learning portal on shadcn/ui with a warm, Babbel-like look, then publish on Cloudflare Pages. Brief: `docs/blueprint/REDESIGN-v1.md` (owner-approved 2026-10-31). It supersedes `FRONTEND-START.md` for visual design.

## Current state

Work is on branch `redesign/v1` (from `origin/main` at `b1545aa`) in a worktree under the session scratchpad (`/private/tmp/.../scratchpad/main-wt`). Phase 0 (foundation) and phase 1 (landing) are built and committed locally (not pushed):
- Packages added, pinned, installed with `--ignore-scripts`: radix-ui 1.8.1, lucide-react 1.61.0, class-variance-authority, clsx, tailwind-merge.
- Palette retuned in `design-system/tokens.css` (warm paper `#faf7f2`, deep blue `#1e3a8a`, terracotta mark `#c2410c`); `npm run test:contrast` passes.
- Inter self-hosted in `public/fonts/`. Unsplash photos in `web/public/photos/` (credits not yet written to `content/attribution.json`).
- `web/src/theme.css` maps shadcn colour names onto the tokens; old CSS moved to `@layer legacy` so Tailwind utilities win.
- New `Landing.tsx` + `routes/landing/landing2.css`; UI parts in `web/src/components/ui/`.
- Portal routes are lazy now; first load 149.2 / 150 KB. `npm test` 580/580.

## Phase 2 (portal) done 2026-10-31

Sidebar and mobile bar list only built sections (nav.ts NOT_YET keeps the rest routable). Today = French greeting, one session card (`today-card`), ways-in rows, weak points, data notice; the level map moved to `/app/path` (`Learn mode="path"`). Card session centred. Labels sentence case (`--tracking-label: 0`). Portal CSS: `web/src/routes/portal.css`. e2e updated for the new design: walk 652/652, rtl clear, reader 54/54.

## Phase 2b (exam-centred portal) done 2026-10-31

Owner asked for a portal built around exams. Sidebar = shadcn-style anatomy (`components/ui/sidebar.tsx`) with an exam switcher (`components/ExamSwitcher.tsx`, Radix dropdown) on top; under it the chosen exam's overview, CO/CE/PE/PO and practice papers, then skill tools. Targets in `lib/exam-targets.ts` (DELF A1-B2, DALF C1-C2, TCF, TCF Canada, TEF Canada), choice stored per profile. Pages `/app/exam`, `/app/exam/:target`, `/app/exam/:target/:section` (`routes/exam/ExamPages.tsx`) show only verified format figures from exams.json. TEF Canada format added from the owner's 2026 booklet; TCF Canada NOT VERIFIED (FEI site blocks automated reads; owner can paste the page). New UI keys are `shellExam*` (optional group: fa/ar fall back to English). Walk 656/656, rtl clear, reader 54/54.

## Phase 2c done 2026-10-31

Timer presets 5/10/20/30/60 (default 20), finish toast + system notification (permission asked on first start). Theme toggle in top bar. Card back: past/future side by side. Today: Bonjour/Bonsoir, French date, mot du jour (real card). French photo banners on list pages (RouteBanner in PortalNav, lazy). Verb drill opens on a verb of the day instead of an error. Persian: 533 strings drafted by an agent, marked DRAFT in fa.ts, listed in docs/review/fa-ui-drafts.md, app shows a draft notice (`shellFaDraft`). Arabic unchanged (falls back to English). Tests moved fallback checks to Arabic.

## Phase 2d: verb flashcards 2026-11-02

Owner asked for 200-500 cards per level. `scripts/build-verb-cards.py` builds `content/verb-cards/<level>.json` from the checked verb tables: 2,349 cards (A1 200, A2 299, B1 391, B2 492, C1 491, C2 476). Back = English Wiktionary gloss (marked unreviewed on screen) + past « il a parlé » and future « il parlera » composed from auxiliary/participle/futur ("il", not "je", to avoid elision guesses). `/app/cards?level=X` picks the level (default: exam target level, else A1); 20 new cards per session plus due cards from any level; key = verb index key, so history is shared with the Cards workspace. `decks.json` deliberately unchanged (legacy app/ and tests need four-language cards there). Test: `tests/verb-cards.test.js`. NOT done: nouns/adjectives (no word source in the repo yet; would need Lexique 3.83 for frequency and gender, plus an en.wiktionary harvest), Persian meanings for verbs.

Later 2026-11-02 the owner asked for real sentences on the back: `content/verb-sentences/<level>.json` holds, per verb, a passé composé and a futur sentence with en+fa translations, a Persian meaning, the usual preposition and construction (agent-drafted, NOT REVIEWED; review sheet `docs/review/verb-sentences.md`). `scripts/check-verb-sentences.py` checks every form against the tables; the build merges them in. 11 verbs held back (`exclude` + reason: vulgar/drugs/violence, and frire). Card front shows word type + preposition (« verb · + à »). 2,338 cards now.

## Phase 2e: flip card and timer 2026-11-03

Owner chose the "flip card" style (no reference app). `Session.tsx` card is now a 3D-flipping paper card (`.fc*` in `routes/portal.css`): tricolore band, big word + type/preposition pill on the front; back = first sense large, other senses small, construction, past|aujourd'hui|future axis (always LTR), sentences. Swipe on touch only (right Good, left Again, 96 px). Grade buttons tinted with key hints. No new package. Timer presets 5/10/20/30/45 (owner); the timer popover is `components/TimerPanel.tsx` (lazy: ring, preset tiles, start/reset, chime switch). Card taps toggle front/back; prev/next buttons and arrow keys move without grading (`goTo`); audio is opened silently on Start (`primeAudio`) so the end chime is not blocked.

## Phase 2f: noun and adjective cards 2026-11-03

`scripts/build-word-list.py` reads Lexique 3.83 (kept at `~/.cache/flw/lexique/Lexique383.tsv`, 25 MB, sha256 637ba37a…) into `data/word-frequency-list.json`: top 2,400 NOM/ADJ lemmas in the verb bands, with gender, plural, feminine. Rules worth knowing: gender read from all rows (Lexique often blanks the singular); a separate feminine form makes the headword m; `NOT_FEMININE` and `AMBIGUOUS_GENDER` are explicit exceptions; « oe » before u/i restored to « œ »; keys that fold together get `#2` (côte, marché, tâche, passe, pêche). Agents drafted `content/word-sentences/<level>.json` (meaning en/fa, article, one example; 40 held back); `scripts/check-word-sentences.py` checks them; `scripts/build-word-cards.py` writes `content/word-cards/`. Sessions interleave verbs and words (`loadLevelCards`). Review sheet `docs/review/word-sentences.md`.

## Next step

Fix « frire » in the verb tables (modelled on suffire: participle « fri », should be « frit »; also defective), then un-hold it. Nouns/adjectives decks if the owner approves the data source. Owner review of docs/review/fa-ui-drafts.md (Persian drafts); TCF Canada format from the owner's browser; then phase 8: publish on Cloudflare Pages (owner creates the account and DNS). Remaining polish: grammar, progress, verb detail and exam screens still use the older component styles.

## Decisions

- Owner chose shadcn/ui, Magic UI free parts only, Babbel-like feel, English-first landing, keep the name, Unsplash photos, everything free.
- No Docker Desktop (owner will uninstall it). Packages installed directly with scripts off, pinned to versions older than 10 days.
- No server. Cloudflare Pages free plan; backend only when accounts/sync/payments are wanted.
- shadcn `accent` is not mapped: `--color-accent` already means primary blue in the old screens.

- 2026-10-31, third landing pass (owner said passes 1-2 looked AI-made): built with the frontend-design skill. Dropped cream/terracotta, italic accent word, caps eyebrows, card grid, stats strip. Now: Paris photo hero with French headline + English line, sommaire rows, Seyes-ruled practice desk, Spectral + Inria Sans, street-sign blue #1f3a6e. Landing CSS is `web/src/routes/landing/landing3.css`.
- If the owner rejects again: ask for a reference site, do not iterate blind.

## Gotchas

- Radix Accordion writes inline styles, which the CSP prerender check refuses; FAQ uses native `<details>`.
- Prerender checks were updated: the landing no longer has the shell bar or mobile tabs.
- The main checkout is on the stale `content/b1-neg-5-meaning` branch; do not implement there.
- Playwright's own browser is not installed: run e2e with `CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and `BASE=http://localhost:4173/`.
- The worktree now lives at `.claude/worktrees/redesign-v1` (the scratchpad one was wiped by a reboot). Its path has a space: build script paths with fileURLToPath, never URL.pathname.
- The global `kbd` rule has a light background; override it on coloured buttons (axe caught it).
- Persian strings use Latin digits; the app substitutes them (a test enforces it).
- Full-page screenshots need `main{overflow:visible}`: the page scrolls inside `main`.

## How to run and test

From the worktree root: `npm test`; `cd web && npm run build && npx vite preview --port 4173`; contrast: serve the repo on 127.0.0.1:8765 and run `CHROMIUM=<Chrome binary> npm run test:contrast`.
