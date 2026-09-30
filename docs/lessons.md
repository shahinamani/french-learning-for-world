# Lessons — the checks that could not fail

**What this is:** a running list of verification faults found on this project.
Not bugs in the product — bugs in the things that are supposed to catch bugs.
They share one shape: **something reported success without having checked.**

Numbering follows Shahin's list, which spans more than this repository.

---

## The checklist

### #1 — A suite that prints FAIL and exits 0

The browser walk printed failures and returned success, so CI (and I) read it as
green. A check that cannot fail the build is decoration.

**Rule:** every suite exits non-zero on any failure, **and** exits non-zero when
zero checks ran. Prove both by planting a failure.

### #2 — A check that passes on an empty input

`check-links.sh` extracted URLs, got none, checked all zero of them and reported
success. `contrast-check.mjs` had the same shape until it was given an explicit
`exit 2` for "no checks ran".

**Rule:** "nothing to check" is a failure, not a pass.

### #3 — A pipeline whose exit status is not the one you care about

`git log … | grep …` — if `git` fails, the stream is empty, `grep` finds
nothing, and the scan reports "clean" without having read anything. Same family:
`grep … | head -3 || echo ABSENT`, where `head` always succeeds so the `||`
branch is unreachable, and `git diff --stat` (exits 0 regardless) used where
`git diff --quiet` was meant.

**Rule:** in any pipeline, ask which command's exit status you are reading. If
it is not the one that matters, dump to a file first, assert the file is
plausible, then check it. Use `set -o pipefail` where a shell allows it.

*This one recurs. It is the most common of the family.*

### #4 — An assertion that cannot match what the browser produces

The `prefers-reduced-motion` check compared a computed duration as a **string**
against `/^0\.0001s|0s/`. The CSS sets `0.01ms`, which computes to `0.00001s` —
a string that pattern can never match. It reported the CSS as broken while the
CSS was correct, which is the same fault wearing the opposite face.

**Rule:** parse values into a comparable type. Never regex a computed style.

### #5 — An assertion the broken state also satisfies

The timer check asserted the pill matched `/\d:\d\d/`. The **un-adopted
default** is `15:00`, which matches — so it passed while the pill and the
session were showing different times.

**Rule:** before trusting a check, ask what the *broken* state looks like and
confirm the assertion excludes it. Where there is a control arm to be had, take
it: the reduced-motion check now measures with the preference **off** as well,
because "nothing moves" proves nothing if nothing moved to begin with.

### #6 — When a test passes, confirm it is looking at the thing it names

**Named by Shahin, 2026-10-01.**

The conjugation tests used `?verb=etre`. The infinitive is `être`. The drill was
rendering its **not-found** state, and the assertions passed against it. Worse,
the axe accessibility scan carried the same wrong URL in its screen list — so an
entire screen was being scanned under the name "Conjugation", and it was the
wrong screen.

Fixing the URL immediately surfaced a real, serious defect the wrong URL had
been hiding: the drill's progress bar had no accessible name.

**Rule:** a passing check must assert something only the *named* screen could
satisfy — a heading, a control, a piece of its content. "The page rendered" is
not evidence that the right page rendered. Applies doubly to any list of routes
fed to a scanner, where a typo silently substitutes one screen for another.

**Same family as #3:** in both, the thing reporting success was not looking at
the thing under test.

**Swept the whole suite for this shape, 2026-10-01, and it was systemic.**
**Every single import in `tests/` pointed at `app/`, the vanilla portal, and
none at `web/`, which is what a learner loads.** Forty-two of ninety-seven tests
exercised code that is not in the build — including twelve for a hand-written
FSRS implementation that `ts-fsrs` replaced in step 4, and twelve for a timer
the React app does not use. `typography.test.js` did read the right file, but as
**text**: it asserted the source *mentions* guillemets and an apostrophe, which
a completely broken formatter also satisfies (#5).

Node 22 strips TypeScript types, so the tests now import the real modules and
call the real functions, through a resolver hook that only ever appends `.ts` to
a relative specifier (Vite allows extensionless imports; Node does not — that
friction is part of why this drifted).

**The first run of those tests found a real bug in shipped code.** The
typographic-apostrophe rule was `/(\w)'(\w)/g`, and `\w` is `[A-Za-z0-9_]`,
which does not match an accented letter. So the rule failed on precisely the
French it exists for: `l'élève`, `l'école`, `d'être`, `j'étais` all kept their
prime, while `qu'il` was corrected. 22 strings in shipped content were affected.
Fixed with `/(\p{L})'(\p{L})/gu`, and every one of the 22 now renders correctly.

That bug survived a test file dedicated to French typography, because the file
read the source instead of running it.

### #7 — An ASCII character class in a product about an accented language

**Named after the `\w` bug, swept deliberately 2026-10-01.**

`\w`, `\b`, `[a-z]` and `[A-Za-z]` all silently exclude `é à ç ê œ`. In a
French product that is not a style question — it is a correctness class. The
apostrophe bug was found by accident; the rest were found on purpose, by running
every candidate site against accented and ligatured input rather than reading it.

| Site | Accented input | Verdict |
|---|---|---|
| `fold`/`norm` in search, verb filter, answer checking | `être`, `ÊTRE`, `etre` | ✅ folded symmetrically |
| the same, with `œ`/`æ` | `soeur` vs `sœur` | ❌ **broken** — NFD does not decompose a ligature |
| number grouping `/\b(\d{1,3})…/` | `été 1240` | ✅ digits only; accents nearby are irrelevant |
| spacing rules `;!?:«»` | `Écoute !`, `« cœur »` | ✅ punctuation classes, not letter classes |
| CEFR level `.toLowerCase()`, `[abc][12]` | `B1` | ✅ ASCII by definition |
| example-sentence highlighting | all 44 sentences | ⚠️ passes today, by exact accent match only |
| locale tag parsing, key handlers, numeric sorts | — | ✅ no letters involved |

**The second real bug: `checkAnswer('soeur', 'sœur')` returned WRONG.** `œ` and
`æ` are letters, not letter-plus-accent, so `normalize('NFD')` leaves them
alone. A learner on a keyboard with no `œ` key was marked wrong for spelling
`sœur` the only way they could — and `docs/04` specifies an accent bar for
exactly this, which is not built. `cœur, sœur, œuf, œil, bœuf, vœu, nœud` are
ordinary words.

Three near-copies of the folding function had drifted apart; there is now one,
`web/src/lib/fold.ts`, which expands ligatures before decomposing. The
highlighter no longer depends on an exact accent match either.

**Rule:** in this codebase, a character class that touches learner or content
text uses `\p{L}` with the `u` flag, or folds through `fold()`. Any such site
needs a test containing a real accented word and a real ligature.

---

## How these are caught

Not by care. By two habits:

1. **Break it on purpose.** Every check in this repository has, at some point,
   been shown to fail: the CSS deleted, a secret planted, an address planted, a
   component stashed and the build re-run. A check never seen red is a check
   never seen.
2. **Read the number, not the verdict.** `4 of 188 elements animate`,
   `218 elements × 2 themes`, `10 of 22 cards`, `1 session id`. A count that is
   obviously wrong is visible; a green tick is not.

---

## Instances found on this project

| # | Where | Reported | Was |
|---|---|---|---|
| 1 | `walk.mjs` | success | printed FAIL, exited 0 |
| 2 | `check-links.sh` | success | zero URLs extracted |
| 2 | `contrast-check.mjs` | success | no floor on checks run |
| 3 | CI secret scan | clean | `git log` piped into `grep` |
| 3 | my own `grep … \| head -3 \|\| echo` | — | `\|\|` branch unreachable |
| 3 | cherry-pick verification | applied | `git diff --stat` exits 0 regardless |
| 4 | reduced-motion check | FAIL | assertion could never match |
| 5 | timer pill check | PASS | `15:00` default satisfied it |
| 6 | conjugation + axe screen list | PASS | asserting against a not-found page |
| 6 | `content.test.js` i18n parity | PASS | read `app/i18n.js`; the app's own dictionary was 40 keys short in fa and ar |
| 6 | `fsrs.test.js`, `timer.test.js` | PASS | 24 tests against modules the product replaced or never used |
| 5 | `typography.test.js` | PASS | read the source for the word "apostrophe" instead of running the formatter |
| 7 | `answer.ts` / search / verb filter | PASS | `œ` and `æ` never folded; `checkAnswer('soeur','sœur')` was WRONG |

Two more that are not checks but the same instinct: `@theme {}` in `tokens.css`
meant **not one design token was ever defined**, and the page still looked like a
page — a visual review would have passed it. And `.gitignore` said
`node_modules/` with a trailing slash, which matches directories only, so a
`node_modules` **symlink** was not ignored and would have been committed into a
public repository.
