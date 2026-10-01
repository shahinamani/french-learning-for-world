**Supersedes #1**, which was auto-closed when `main` was force-pushed to strip tool-attribution trailers from the commit messages. GitHub will not reopen a pull request whose head branch has been force-pushed, so this is a replacement. No code or history was lost — the rewrite preserved every author name, email and author date, and every tree hash.

Brings the working study portal onto `main`, with the planning documents for the dashboard and the sections built since.

## What is here

**The study app** — flashcards with FSRS spaced repetition, a drift-proof study timer, a verbs section (14 verbs × 6 tenses × 6 persons = 504 forms), and **examinations**: timed, resumable practice papers whose results map to concepts rather than a bare score. Interface and content in English, French, Persian and Arabic with full right-to-left layout. Progress stored only on the learner's own device, exportable and re-importable.

**The documents** — `docs/01` research, `docs/02` content licences, `docs/03` the review log, `docs/04` information architecture, `docs/05` design system, `docs/06` the step-4 report, `docs/07` the claim sweep, and `docs/lessons.md`.

## Things worth a reviewer's attention

**Everything joins one table.** Every graded interaction anywhere — a flashcard, a conjugation, an exam question — writes a `ReviewRow` against concept ids. That is what makes Progress, weak points and the exam diagnosis one feature rather than three.

**The budget is measured at every step.** First-load JS is **139 609 bytes gzipped against a 150 000 budget — 10 391 bytes of headroom**. Adding the exams section initially cost 6 172 bytes and left only 1 854; the cause was four interface languages shipping to every learner. The dictionaries are now split, so a learner downloads the one they read. Headroom is higher *after* the largest section than before it.

**Content licensing.** Every item is original work. Real DELF, DALF, TCF and TEF papers are the copyright of the bodies that administer them and none is reproduced. What is taken from them is factual — a paper's name, duration and mark scheme — recorded per paper with its source.

**What is deliberately absent, and says so.** No listening papers (no audio under a permitting licence; machine speech is not offered as listening practice), no writing or speaking papers (neither can be machine-marked), no DALF (C1–C2 only, and the taxonomy stops at B2). The product names each gap with its reason.

## Verification

Both browser suites run in CI on every push and pull request, with `test` and `browser` as required checks on `main`:

- **97** unit and content tests
- **169** browser checks — every route, the connection walk, the complete learner journey, multi-user isolation across two tabs, the service worker and offline, reduced motion, the export/erase/import round trip, exams sat-left-resumed-submitted, lazy language loading, and axe-core on twelve screens plus the dialog and popover open states, in both themes
- **20** design-system checks — WCAG AA contrast against real rendered backgrounds, layout at 320/375/1440, focus visibility, right-to-left

## Known and unfinished

`docs/06` §6 and `docs/07` carry the full list. The largest: 22 flashcards exercise 29 of 224 concepts, B2 is the stated ceiling with no date for C1–C2, and no screen reader has been used — axe covers perhaps a third to a half of WCAG.


---
