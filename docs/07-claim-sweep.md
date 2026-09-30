# 07 — The claim sweep: every statement in docs 01–06, checked against the build

**Date:** 2026-09-30 · **Why:** *"A false claim in a design doc is the same class of fault as a check that can't fail."*

Design documents are the record. If one says the build does something it does
not do, the document is wrong and the record is wrong, and nobody finds out
until they depend on it. So every falsifiable claim in `docs/01`–`docs/06` was
re-checked against the build rather than against memory. Corrections were
written **into** those files, marked `[corrected 2026-09-30]` or `[as built]`,
and the originals left visible — a document that quietly rewrites itself is no
better than one that was wrong.

**Result: 44 claims checked. 31 held. 13 had drifted.** Every one of the 13 is
below, with what it said, what is true, and how that was established.

---

## Settled by Shahin, 2026-10-01

Every drift below was decided rather than carried. The decisions, and where
each landed:

| Drift | Decision | State |
|---|---|---|
| Browser suites never ran in CI | **CI first, ahead of everything** | ✅ both suites run on every push and PR, green on a GitHub runner |
| shadcn/Radix named, never adopted | **axe-core in CI; adopt Radix only where hand-rolling breaks; keep simple things hand-written; measure** | ✅ Dialog + Popover adopted, +21.57 KiB measured; four primitives deliberately not adopted; axe on 10 screens × 2 themes |
| `user_id` nullable in spec, required in build | **required is correct — fix the doc** | ✅ `docs/03` corrected |
| Export without import | **build it** | ✅ export v2 carries states; import is idempotent and never moves a card backwards |
| `params_hash` specified, never built | **build it or delete it** | ✅ built — 8-char FNV-1a of the weight vector, on every row |
| No landing page; home prerendered for LCP | **fine — say plainly that SEO is unaddressed** | ✅ stated in `docs/04` |

---

## The 12 that had drifted

### 1. shadcn/ui and Radix — named as the stack in three documents, never adopted

| | |
|---|---|
| **Said** | `docs/01`, `docs/04`, `docs/05`: "Vite + React + TypeScript + Tailwind + **shadcn/ui**". `docs/05` had a table headed *"How this becomes shadcn/ui in step 4"*, mapping each component to "a shadcn component wrapping a Radix primitive". |
| **True** | Neither is in the build. Runtime dependencies are `idb`, `react`, `react-dom`, `react-router`, `ts-fsrs`. Four hand-written components: `Shell`, `SidePanel`, `Search`, `Icon`. |
| **Evidence** | `web/package.json`; `grep -rn "radix\|shadcn\|cmdk" web/` returns nothing. |
| **Why it matters** | `docs/01` chose the stack so that "accessibility (keyboard, focus, ARIA) comes built in rather than hand-rolled", and said hand-rolling "is where accessibility bugs breed". That risk was taken and never written down. |
| **Done** | The table in `docs/05` is now *planned vs built*, with the cost stated. The decision is recorded where it should have been recorded when it was taken. |

This is the largest single drift and it is not a numbers error — it is a
design decision that was made silently by not doing the thing.

### 2. `docs/05`: "Fonts do not render as designed — the network policy blocks the font host"

True when written in step 3, false since step 4. Both families are self-hosted
from `public/fonts/` and the style guide loads them locally. **Proved** by
deleting the contrast check's console allow-list for `fonts.(googleapis|gstatic)`
entirely and re-running: 20 checks, 0 failures, **0 console errors**, nothing
allow-listed. That allow-list was itself a defect of the same family — on every
clean run it printed *"none (font-host failure allow-listed)"*, announcing a
suppression that had stopped happening.

### 3. `docs/05`: Playwright "should be added as a devDependency in step 4"

**Not done, and the consequence is live.** Playwright is still not a project
dependency, and **CI runs neither the browser walk nor the contrast check** —
only the 82 unit tests and the secret and personal-data scans. Every browser
number in `docs/06` and in the step-5 report was produced by hand. A change that
breaks contrast, layout, or any of the 94 walk checks merges green today.
Named in `docs/05` and in `docs/06` §6 as open.

### 4. `docs/03`: `params_hash` — specified, not built

`ReviewRow` implements 25 of the 26 columns in the design. `params_hash` is the
one missing. Its own justification in `docs/03` says why that matters: without
it, refitting the FSRS weights makes every earlier row uninterpretable. Cheap
now, impossible retroactively. **Open.**

### 5. `docs/03`: `user_id` "nullable — null for anonymous learners"

Built as **required and never null**. Anonymous learners get a locally
generated profile id, because step 4 had to keep two learners in two tabs
apart and one null cannot be told from another. `userKey()` throws without an
id; the IndexedDB primary key is `[userId, cardKey]`. A deliberate change that
was never written down.

### 6. `docs/03`: "a learner can carry their history to another device"

The React app **exports and does not import**. History can be downloaded and
loaded nowhere. The vanilla portal at `app/` has both. This is a real
functional gap, not a wording problem, and it is on the parity list below.

### 7. `docs/03`: "Words known — cards in `state = Review` with `stability >= 21`"

Not implemented. No screen shows a "words known" figure. The query is right;
nothing calls it.

### 8. `docs/01` and `docs/04`: "the landing page prerendered to static HTML for SEO"

There is **no landing page**. `/` redirects to `/learn`, and it is the **home
route** that is prerendered — for **LCP**, not SEO, and it worked (5 288 ms →
1 648 ms). The app also uses a hash router, so routes below the home are `#/…`
and not separately crawlable. Landing-page SEO is unbuilt work, not done work.

### 9. `docs/04`: the accent bar "on every writing input"

Not built. There is one typed input — the conjugation drill — and it has no
accent bar. It accepts an unaccented answer and marks it *right, but the
accents*, which is a mitigation and not the feature.

### 10. `docs/04`: "every listening exercise has a transcript"

There is no audio anywhere in the product. The rule governs nothing today.

### 11. `docs/04`: `frenchText()`, and the palette as a focus trap

The formatter is `fr()` / `frIf()`. The palette was built as a **route**, not a
modal, so there is no dialog and nothing to trap; the focus-trap-and-return
behaviour lives on the **side panel** instead, which is walked and checked.

### 12. `docs/06`: "5 / 15 / 30 min — starts a time-boxed session", and "dead ends found: none"

`?minutes=N` was written by the Learn buttons **and** the search command, and
**read by nothing**. The link landed on a real session, so the walk's link check
passed — but the session it landed on was not time-boxed, so the control was
decoration promising a behaviour that did not exist. `docs/06` §1 listed it as
working and §2 concluded "dead ends found: none". Both were wrong.

**Fixed, not just documented,** since this is step 5's TIMERS item: the session
now reads the parameter, starts the *same* timer the pill in the bar drives,
shows the time remaining as text, and stops serving cards when it reaches zero.

Two defects surfaced while building it, both worth recording:

- **`restore()` is a destructive read.** It clears the timer on expiry so the
  finish is reported exactly once — correct, so the chime cannot fire twice, and
  unit-tested. But with a second consumer polling it, the two race and one never
  sees the finish. The session therefore holds its own end time and compares it
  to the wall clock; `restore` keeps its once-only semantics for the chime.
- **My first test for this could not fail usefully.** It asserted the pill
  matched `/\d:\d\d/`, which "15:00" — the *un-adopted default* — satisfies. It
  passed while the pill and the session were showing different times. It now
  requires the two to agree within two seconds, and runs on a mocked clock so
  the five minutes actually elapse instead of being faked by poking storage.
- **And the tightened test then caught a real intermittent bug**, which is the
  point of tightening it. The bar adopted the session's timer by *polling*
  storage every 250 ms, so on a slow render it showed its 15:00 default while
  the session counted down from 5:00 — the precise disagreement the shared
  timer exists to prevent. It failed on one run in four and I had already
  called it fixed. The adoption is now event-driven: writing or clearing the
  timer dispatches an event the bar listens for, alongside `storage` for other
  tabs, so the pill updates on the write rather than on the next poll. Four
  consecutive runs agree.

### 13. Counts that had simply moved

| Claim | Was | Is |
|---|---|---|
| `docs/01` test counts | 56 unit + 55 browser | **82 unit + 94 browser** |
| `docs/02` interface strings | 92 keys × 4 | **109 keys × 4** |
| `docs/05` contrast measurements | 217 elements × 2 = 434 | **218 × 2 = 436** |
| `docs/05` design-system CSS | 7.5 KB gz | **7 353 B = 7.18 KiB** |
| `docs/06` first-load JS | 118.63 KB gz | **119 261 B = 116.47 KiB** |
| `docs/06` app CSS | 7.59 KB gz | **7 024 B = 6.86 KiB** |
| `docs/06` `font-display` | `swap` | **`optional`** |
| `docs/06` lazy chunks | none | **one** — `scheduler`, 7 283 B, absent from `index.html` |

---

## The 31 that held

Checked and true, so that "swept" means swept and not skimmed.

**Content** — 22 A1 cards, all `provenance: original`, 44 example sentences
(one past + one future each), meanings in en/fa/ar/fr · 224 concepts, 190
leaves, 4 roots, ids permanent · 29 concepts exercised by the deck · 14 verbs ×
6 tenses × 6 persons = **504 forms** exactly, 12 imperatives · 4 exams, 22
distinct URLs, **0 non-https**, `checkedOn: null` · no textbook-derived content
anywhere, asserted by a test.

**Fonts** — 5 woff2, both OFL-1.1 licences committed beside them, a French page
fetches **92 608 B of 197 020 B** shipped (the "90.4 KB of 192 KB" claim,
exact).

**Budget** — first-load JS, CSS, the single lazy chunk and LCP 1 648 ms all
inside the budgets set in `docs/01`, which were held rather than moved.

**Accessibility** — 20 contrast checks pass with no allow-list; 436
text-element contrast measurements against real rendered backgrounds, 0 fail;
0 horizontal overflow at 320/375/1440; 0 targets under 44 px; 40 focusable
controls, none with `outline: none`; the map is a real `<table>` with a caption
and 3 + 8 headers; locked cells all carry accessible names.

**Behaviour** — multi-user isolation across two tabs; every learner key under
`flw:u:<id>:*` with 0 strays; the append-only log and card state written in one
transaction; service worker, 18 files, offline renders; `?level=B1` honoured;
the four stub routes each say what is missing.

**Process** — the two research clones were read and deleted, and neither is
vendored (`/home/user/` holds only this repository); no content is credited to
any textbook; the `LICENSE` (MIT, code) and `LICENSE-CONTENT` (CC BY-SA 4.0)
files exist as `docs/02` says (MIT for code, CC BY-SA 4.0 for content), and no
licence or "open source" wording appears anywhere a learner can see it — the one
occurrence is the listening stub explaining that no audio ships because none has
a licence permitting it, which is an explanation and not a legal notice. Checked
across `index.html`, `app/` and `web/src`.

---

## Two defects the sweep found in the tooling itself

Not in the documents — in the things that are supposed to catch the documents.

**1. The `prefers-reduced-motion` check could not pass.** It compared the
computed duration as a *string* against `/^0\.0001s|0s/`. The CSS sets
`0.01ms`, which the browser computes as `0.00001s` — a string that pattern can
never match. The check reported the CSS as broken while the CSS was correct.
Rewritten to parse durations into milliseconds, and given a **control arm**,
because "nothing moves" proves nothing if nothing moved to begin with: with the
preference off **4 of 188** elements animate (longest 160 ms, `a.btn`); with it
on, **0**. Deleting the media query makes it fail — checked, then restored.

**2. `.gitignore` had a hole a symlink walked through.** The pattern was
`node_modules/`. A trailing slash matches directories only, and `web/e2e/node_modules`
is a **symlink**, so `git check-ignore` said *not ignored* and a `git add -A`
would have committed a dangling absolute path — pointing into a container
scratch directory — into a public repository. Changed to `node_modules`, with
the reason written beside it so nobody re-adds the slash.

---

## Carry-forward: C1 and C2 — **B2 is the ceiling, and no date is offered**

The honest answer rather than a date that would slip.

The taxonomy holds **224 concepts covering A1–B2**. C1 and C2 have **none**, so
those two rows of the map can never light up. The map renders every C1 and C2
cell as a locked `<span>` — not a link — with an accessible name ending "not
built", so a screen reader announces it as unavailable rather than silently
skipping it. That is not a bug to be scheduled away: C1
and C2 are where a learner needs *argumentation, register, idiom and nuance*,
which is the hardest content in the platform to write and the easiest to get
subtly wrong. It is also the content most likely to be reached for from a
textbook, which is the one thing `docs/02` forbids absolutely.

**So: B2 is the stated ceiling until the A1–B2 content is deep rather than
thin.** The deck is 22 cards exercising 29 of 224 concepts. Adding two more
levels on top of that would widen a platform that is not yet deep. When A1–B2
has real coverage, C1–C2 becomes a content project with a date. Naming one now
would be a number invented to close a line item.

Meanwhile the product says so rather than implying otherwise, which is the part
that matters to a learner who arrives at C1.

---

## Carry-forward: what "parity" means, concretely, for deleting `app/`

The vanilla portal at `app/` (108 KB, 7 modules, `index.html`, `sw.js`) is the
working version and still the one that would be deployed. It must not be
deleted on a feeling that the React app "is basically there". These are the
conditions, and each is checkable:

| # | Condition | Status |
|---|---|---|
| 1 | **Exams section is real, not a stub** — 4 exams, all 22 official links, the independence disclaimer | ⛔ stub |
| 2 | **Progress import**, not only export — a file exported from either app loads into the React app | ⛔ export only |
| 3 | **An About / independence notice** exists as its own destination | ⛔ absent (text lives on the exam stub) |
| 4 | **Browse all content** — every card reachable without knowing what to search for | ⚠️ search reaches cards and concepts; there is no browse-everything list |
| 5 | All four languages, both RTL, across every screen the React app has | ✅ 109 keys × 4, parity asserted by a test |
| 6 | Timer with chime, surviving navigation and reload | ✅ walked |
| 7 | Offline via service worker | ✅ 18 files, offline render checked |
| 8 | Progress export produces the same information | ✅ |
| 9 | The walk and the contrast check **run in CI**, so the vanilla portal's deletion is not the moment regressions start shipping | ⛔ neither runs in CI |

**Four conditions are unmet, and `app/` stays until all nine are green.**
Condition 9 is deliberately on the list: deleting the fallback while the safety
net is manual would be the worst possible order to do these in.
