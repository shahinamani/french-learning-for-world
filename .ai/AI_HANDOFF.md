# AI Handoff — french-learning-for-world

Shared continuity file for every AI coding agent used on this repository.
Read it first, then continue from "Next step".

Rules for whoever edits it: target 40–80 lines, hard limit 150. No secrets, no
tokens, no credentials, no connection strings, no server IPs. Narrative sections
are written by the agent; the state block is generated — do not hand-edit it.

<!-- ai:state:start -->
- Updated: 2026-10-18 22:18 +03 (git metadata only, written by a Stop hook)
- Branch: HEAD
- HEAD: a9d0211 Merge pull request #55 from shahinamani/feat/weakness-engine
- Uncommitted: 1 file(s)
  - ?? .ai/
<!-- ai:state:end -->

## Goal
A French learning portal the owner can test privately and eventually sell. The
current push is turning a verb reference into a learning environment: a
workspace with flashcards, quiz, dialogues, grammar, vocabulary and progress.

**Read `AGENTS.md` first.** Its §2 (say what has not been checked) and §3 (run
a check against the whole corpus and adjudicate every accusation) are not
decoration — most of the defects found here were checks comparing the wrong two
things.

## Current state
`main` at the merge of PR #50. Merged recently: #49 the workspace, #50 the
educational card backs and the first dialogue unit.

Branch `integration/app-routes` (2026-10-18) merges the grammar loop and the
Reader and mounts both lazily under `/app/grammar` and `/app/reading`.
`Progress` shows `WeaknessCard` and no accuracy percentage, and its export
carries the personal stores. The Reader's quiz scores moved from a separate
`flw-reader` database into `flw` (schema 3, store `readerResults`); the export
format is version 4. `/app/grammar/:id` renders the lesson where one exists and otherwise the concept
page (routes/app/GrammarOrConcept.tsx, a lazy chunk), so the 6 lessons are an
upgrade over 297 working concept pages.

- **Workspace** at `/workspace`, lazy-loaded. Six tabs, all opening real
  content. Filters, shuffle, jump-to-card and the position always agree.
- **Cards**: 2,371 eligible records = 2,363 verbs with a gloss + 8 deck nouns.
  **32 have worked educational backs**; the rest say they are a gloss.
- **Card back**: Persian meaning, then présent / passé composé / futur simple
  behind one click, each with tense label, the conjugated group highlighted,
  Persian + English, and per-example listen. Nouns get examples and no tense.
- **Dialogues**: one complete A1 unit (Au café) with comprehension questions,
  feedback, explanation and retry.
- **Coverage is printed on the page**: `32 / 2371 with worked examples ·
  0 / 2371 checked by a teacher`. Both counted at runtime.
- Checks: 467 unit tests, 387 browser checks, 20 contrast checks, all green.

## Next step
Continue the content batches: A1 has 208 eligible cards and 32 are done.
Draft the next bounded batch of A1 verbs into `content/card-backs.json`, then
A2. Do not mass-produce — reuse existing written material first, keep
`tests/card-backs.test.js` passing, and never mark anything reviewed.

## Decisions
- **Known = FSRS Easy (4), To review = Again (1)**, written through
  `appendReview` under the existing card keys. Not a second store. The
  four-grade session under Practise is unchanged and is the finer instrument.
  Measured reason: this engine's learning steps are 1/6/10 minutes and only
  Easy leaves learning, so Good and Again are indistinguishable afterwards.
- **Piles are read from the schedule, not FSRS's state enum** — a first
  sighting enters Learning however it is graded, so the enum cannot express
  "known". Horizon is 12 h (`KNOWN_HORIZON_MS`).
- **Persian may be drafted for educational content; it is never marked
  reviewed.** Arabic is still held — no Arabic reader exists.
- **New interface strings go in an OPTIONAL i18n group** (`workspaceEn`),
  English + French only, so fa/ar fall back behind `notTranslatedHere` rather
  than obliging invented translations. Four such groups exist now.
- **The preview is loopback only.** No deployment is authorised.

## Gotchas
- **The written deck and the verb index disagree on one key**: the deck has
  `v:etre`, the index `v:être`. `buildCards` matches on folded identity and the
  DECK key wins, because the review log already uses it. Do not "simplify" it.
- **`gzserver.py` must stay threaded.** It was `TCPServer`, which serves one
  connection at a time; a browser held it open and the preview answered nobody
  for two days while the port stayed bound.
- **Tests cannot import `ts-fsrs`.** CI and the pre-push sweep run the unit
  suite with `web/node_modules` hidden, so anything needing the real scheduler
  belongs in `web/e2e/walk.mjs`.
- **Throwaway git repos in tests must use `gitFreeEnv()`** (`tests/git-env.mjs`).
  `GIT_DIR` is in a hook's environment and beats `cwd`; from a worktree this
  once committed fixtures onto a live branch and rewrote `user.email`.
- Walk scans must wait for a selector, not a fixed delay, and must not assume
  which card they land on — nouns sit alphabetically among the verbs.

## How to run and test
```sh
./scripts/preview.sh          # private preview, loopback only, 127.0.0.1:8793
npm test                      # unit suite
node web/e2e/walk.mjs         # browser walk (needs the preview running)
node design-system/contrast-check.mjs
```
Branch from `main`, never stack PRs, and verify on `main` after a merge.
