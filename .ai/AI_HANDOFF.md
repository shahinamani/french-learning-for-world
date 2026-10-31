# AI Handoff — french-learning-for-world

Shared continuity file for every AI coding agent used on this repository.
Read it first, then continue from "Next step".

Rules for whoever edits it: target 40–80 lines, hard limit 150. No secrets, no
tokens, no credentials, no connection strings, no server IPs. Narrative sections
are written by the agent; the state block is generated — do not hand-edit it.

<!-- ai:state:start -->
- Updated: 2026-10-31 13:34 +03 (git metadata only, written by a Stop hook)
- Branch: redesign/v1
- HEAD: 428ff3b Build the portal around the learner's exam
- Uncommitted: 14 file(s)
  -  M tests/i18n-lazy-groups.test.js
  -  M web/src/components/Shell.tsx
  -  M web/src/features/flashcards/Session.tsx
  -  M web/src/features/verbs/Conjugation.tsx
  -  M web/src/lib/i18n.ts
  -  M web/src/lib/locales/fa.ts
  -  M web/src/lib/locales/fr.ts
  -  M web/src/lib/timer.ts
  - … and 6 more
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

## Next step

Owner review of docs/review/fa-ui-drafts.md (Persian drafts); TCF Canada format from the owner's browser; then phase 8: publish on Cloudflare Pages (owner creates the account and DNS). Remaining polish: grammar, progress, verb detail and exam screens still use the older component styles.

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
- Full-page screenshots need `main{overflow:visible}`: the page scrolls inside `main`.

## How to run and test

From the worktree root: `npm test`; `cd web && npm run build && npx vite preview --port 4173`; contrast: serve the repo on 127.0.0.1:8765 and run `CHROMIUM=<Chrome binary> npm run test:contrast`.
