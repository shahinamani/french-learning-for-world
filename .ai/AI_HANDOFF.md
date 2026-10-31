# AI Handoff — french-learning-for-world

Shared continuity file for every AI coding agent used on this repository.
Read it first, then continue from "Next step".

Rules for whoever edits it: target 40–80 lines, hard limit 150. No secrets, no
tokens, no credentials, no connection strings, no server IPs. Narrative sections
are written by the agent; the state block is generated — do not hand-edit it.

<!-- ai:state:start -->
- Updated: 2026-10-31 11:03 +03 (git metadata only, written by a Stop hook)
- Branch: redesign/v1
- HEAD: b1545aa Merge pull request #68 from shahinamani/d2-landing
- Uncommitted: 37 file(s)
  -  M .ai/AI_HANDOFF.md
  -  M content/attribution.json
  -  M design-system/tokens.css
  -  M public/fonts/fonts.css
  -  M tests/i18n-lazy-groups.test.js
  -  M web/package-lock.json
  -  M web/package.json
  -  M web/scripts/prerender.mjs
  - … and 29 more
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

## Next step

Owner review of the portal screenshots, then phase 8: publish on Cloudflare Pages (owner creates the account and DNS). Remaining polish: grammar, progress, verb detail and exam screens still use the older component styles.

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
