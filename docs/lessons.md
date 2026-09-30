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

Two more that are not checks but the same instinct: `@theme {}` in `tokens.css`
meant **not one design token was ever defined**, and the page still looked like a
page — a visual review would have passed it. And `.gitignore` said
`node_modules/` with a trailing slash, which matches directories only, so a
`node_modules` **symlink** was not ignored and would have been committed into a
public repository.
