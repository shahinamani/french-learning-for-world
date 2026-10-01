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

### #8 — A default that writes into permanent public history

**2026-10-01. The most expensive lesson on this project, and the cheapest to have prevented.**

A tool-attribution trailer was appended to commit messages by default. Nobody
chose it; it simply arrived. It reached a public repository, where the
Contributors panel then listed a second name on Shahin's own project.

The removal is where it got expensive:

1. **Rewriting the messages** took a `filter-repo` pass over every branch. That
   part worked — author names, emails and author dates all preserved, every tree
   hash identical.
2. **The rewrite closed the pull request.** Force-pushing `main`, a PR's *base*
   branch, auto-closes it, and GitHub then **refuses to reopen** a PR whose head
   was force-pushed. The page, its description and its history were gone for good.
3. **The pull-request ref kept the commit alive anyway.** `refs/pull/1/head`
   still pointed into the pre-rewrite history, and the trailered commit was its
   ancestor. **GitHub keeps `refs/pull/*` permanently and offers no way to delete
   them.** No rewrite, no branch deletion, no gc could reach it.
4. **So the repository had to be deleted and rebuilt.** A settings snapshot, a
   verified bundle, a hard stop for authorisation, a fresh repository, both
   branches pushed by name, and ten verification checks — to remove one line that
   was never wanted.

**What it cost:** a rebuild, a lost pull request, and a session spent on it.
**What prevention would have cost:** not adding the line.

**Settled 2026-10-01, and not to be re-opened: the address in `c279308` stays.**

The pre-push sweep caught an email address in a tracked file — `docs/99-handoff.md`
reintroduced one that commit `069185d` had removed. The address was taken out of
the working tree, and the commit that already carries it was **deliberately left
alone.** Shahin's reasoning, recorded here so nobody re-derives it:

- The address is in the **author field of every commit** on this repository
  already. That is where it belongs and it is not removable without rewriting
  every commit. Stripping it from one document changes nothing real.
- Rewriting history on a pull request's **base** branch closed the last pull
  request permanently, and `refs/pull/*` kept the old commit reachable anyway.
  The cure cost a repository rebuild. The disease here is one line of prose.

**The distinction that makes this consistent rather than an exception:** a
*credential* is removed whatever it costs, because it is live and abusable. A
*published author address* is already public by the design of git, so the
rewrite buys nothing and the PR is a real loss. The sweep stays exactly as it
is — it was right to stop the push, and this is the judgement that follows it,
not a reason to loosen it.

**Rules, now enforced rather than remembered:**

- No attribution trailer, no "generated with" line, no robot emoji, in any commit
  message, pull-request description, README, changelog or file. Every commit is
  authored by Shahin Amani and nothing else — the address lives in commit
  metadata, where it belongs, and nowhere a scraper reads.
- `scripts/check-commit-messages.sh` runs in the required `test` job and fails on
  any of those patterns in any commit message across `--all`.
- It scans **messages, not files**, so this page may name the episode. There is a
  test asserting exactly that distinction, because a check that also flagged
  documentation would be turned off within a week.
- **The detector is seen red on every run, not once.** A single historic red run
  would have proved it worked one time — and would have left the offending commit
  in the history forever, which is the harm itself. Instead
  `tests/commit-attribution.test.js` builds a throwaway repository, plants each
  offending form in turn, and asserts the script exits 1: six forms, plus the
  empty-history case exiting 2 rather than passing, plus the documentation case
  passing.

**The general shape.** A default that writes into an append-only public record is
not a small default. Before accepting one, ask what removing it would cost — and
whether the platform will even let you.

### #9 — A guard on the key, with nothing on what the reader sees

**2026-10-01, found while merging the C1/C2 draft.**

`tests/concept-ids-permanent.test.js` checks that ids are unique, well formed,
parented and never renamed. Every one of those passed on the C1/C2 draft. Four
of its entries were still duplicates of concepts already live:

| Draft id | Already existed as | Both named |
|---|---|---|
| `gram.subjunctive.passe` | `gram.subjunctive.past` (B2) | « Le subjonctif passé » — *and* "The past subjunctive" |
| `gram.reported.concordance` | `gram.reported.tense-shift` (B1) | « La concordance des temps » |
| `gram.expression.mise-en-relief` | `gram.expression.emphasis` (B2) | « La mise en relief » |
| `gram.article.absence` | `gram.article.omission` (B1) | « L’absence d’article » |

The ids were distinct, so the uniqueness check was satisfied. The **names** were
character-for-character identical, which is the only part a learner ever sees.

This mattered more than an ordinary duplicate. Ids are permanent by design, so
merging would not have been correctable by deletion — each pair would have
needed a retirement, and any learner who had reviewed against the wrong half
would have had their record split across two ids for one piece of French.

The check that now exists compares names the way a reader does — case, accents
and apostrophes folded — in **both** languages separately. Its first run found a
fifth collision that had been live since the taxonomy was written: the group
`phon.elision` and its child `phon.elision.basic` were **both** « L’élision », so
a French-interface learner saw a heading nested inside itself. The English names
differed, which is exactly why nobody noticed.

**Rule:** a uniqueness guard on an internal key is not a uniqueness guard. Check
the field the user reads, in every language it is read in — a collision can exist
in one language and not another, and the one you do not speak is the one that
survives.

**Same family as #6:** the check was looking at something adjacent to the thing
under test, and passing on it.

### #10 — The alphabet was an assumption, and nobody declared it

**2026-10-01. Found while pointing the guards at the two languages nobody here reads.**

#7 was written up as a lesson about `\w`. That was too small. The real lesson is
that **every character class encodes a belief about which alphabet the text is
written in, and that belief is almost never stated.** `\w` excludes `é`; it also
excludes the whole of Arabic and Persian, and nothing in the code says so.

The proof arrived within a day. `concept-names-distinct.test.js` — written the
same day #7 was written up, by someone who had just written it up — ended with
`.replace(/[^a-z0-9']+/g, ' ')`:

```
foldLabel('العربية') -> ''      foldLabel('فارسی') -> ''
```

Every Arabic and Persian string folds to the empty string. Pointed at four
languages unchanged, that guard would have reported every Arabic label as
colliding with every other Arabic label, produced a wall of nonsense, and been
switched off inside a week — leaving the two languages least able to be reviewed
by eye with no guard at all.

This is why the class matters more than the instance. Fixing `\w` fixed one
regex. The belief behind it — *text is Latin unless something says otherwise* —
survived the fix and reappeared immediately in new code.

What a fold for this product actually has to do, none of which NFD or NFC does:

| | |
|---|---|
| ZWNJ U+200C | the Persian half-space. **Invisible.** `می‌رود` and `میرود` differ by one codepoint |
| ك U+0643 / ي U+064A | Arabic kaf and yeh against Persian ک U+06A9 and ی U+06CC — near-identical glyphs |
| ـ U+0640 | tatweel: decoration, no meaning — *except* where it carries a prefix onto a Latin word |
| harakat | combining marks, optional, and stripped by the same rule as the French accents |
| ٠١٢ / ۰۱۲ | Arabic-Indic and extended Arabic-Indic digits are the same digits as `012` |

**Rule:** a character class, a fold or a comparison that touches learner-facing
text must be demonstrated against a real string in **every** script the product
ships, in the test, visibly. Not asserted — run. And where a language cannot be
reviewed by eye here, what is legitimate in it is written down with a reason:
the tatweel in `لـFrance` is **correct** Arabic typography, and a non-reader
"tidying" it away would be introducing the defect, not removing it.

### #11 — A checker that cannot parse the shape the defect lives in

**2026-10-01. Found one layer under #10, and it is a different fault.**

The i18n parity and placeholder checks read values with
`/(\w+)\s*:\s*'((?:[^'\\]|\\.)*)'/g` — single-quoted values only. Thirteen
French strings are written with double quotes. The checks never saw them.

What makes this its own lesson rather than another instance of #3 is **why**
those thirteen are double-quoted:

> They contain an apostrophe.

So the reader was blind to exactly the strings most likely to carry an
apostrophe fault — not by coincidence, but by the same cause. The quoting style
*is* the signal that the value contains the character under test. The hole in
the checker was cut in the precise shape of the problem.

**And the defect was in there.** Ten of the thirteen carried a straight prime:
`Aujourd'hui`, `S'entraîner`, `Minuteur d'étude`, `Langue de l'interface`,
`Outil d'étude indépendant`. `fr()` in `typography.ts` is applied to content —
concept names, verb forms, exam text — and **never to `t()` output**, so the
French interface had been rendering primes since the day it was written. Behind
a test file named for i18n parity, which was passing.

The giveaway was sitting in plain sight and nothing was reading it: `fr=147`
where `en=fa=ar=160`. Nobody compared the counts.

**Rules:**

- A reader must report what it read, and the counts must be compared. Four
  dictionaries now have to yield the same number of values, with a floor.
  A reader that silently returns a subset is #3 with better manners.
- When writing a checker, ask what the defective input *looks like* — and
  confirm the parser accepts that form. If values containing `X` are written
  differently from values that do not, a checker for `X` must parse both, and
  that is the first thing to test.

### #12 — A type that could not express the defect, so the compiler endorsed it

**2026-10-01. Found by looking at a Persian screenshot, which is not a method.**

`VerbTense.name` was declared `Record<'en' | 'fr', string>` and `Concept.name`
the same. `content/verbs.json` carries `حال ساده` and `المضارع` for every tense.
The type had no place to put them, so eighteen call sites wrote
`ui === 'fr' ? name.fr : name.en` — and **every one of those is type-correct**.
`tsc` passed. 184 unit tests passed. The RTL walk passed 856 checks, because
direction, overflow and isolation were all genuinely right: the text was
correctly laid out, and in the wrong language.

Three guards were adjacent to this and none of them could see it:

- **i18n parity** checks the 169 interface strings. A content name is not a key.
- **`concept-names-distinct`** checks that two concepts do not read alike — in
  `en` and `fr` only, the two languages that were never the problem.
- **the RTL walk** rendered ten screens, and **not one of them displayed a
  content name**: search shows nothing without a query, and the concept page was
  not in the list at all. The screens where the defect lived were the screens
  nobody walked.

**What makes it its own lesson rather than another #9:** in #9 the guard was
pointed at the wrong field. Here the *type* said the wrong field was the only
field there was. A guard can be added to a codebase; a type is agreed with the
compiler, and once agreed it reports every instance of the defect as correct.

**And the giveaway was in the data the whole time.** `name.fa` existed in
`content/verbs.json`, unreferenced, for as long as the type had excluded it.
Nothing compared what the content file offered against what the type admitted.

**Rules:**

- A field that holds learner-facing text is typed `Partial<Record<Locale, string>>`
  — every language the product ships — and is read through `pick()`, which
  reports whether what it returned is the learner's language. A two-language
  branch over a content field is now a test failure
  (`tests/content-names-localised.test.js`), with the detector run against a
  planted sample on every run.
- **A screen that renders a content name must be in the browser walk.** A walk
  whose screen list omits the screens where a class of defect lives is #6 at the
  level of the suite rather than the assertion.
- Where a language is not translated yet, say so on the page. The honest state
  is cheap and ships today; the translation arrives per level, counted in a
  ledger asserted with `deepEqual`, so finishing a level and forgetting the
  ledger fails too.

### #13 — A job that only runs on the branch it is never exercised on

**2026-10-01, the moment pull request #1 merged.**

`ci.yml` and `pages.yml` both have a job that runs the unit suite. They had
drifted: `ci.yml` runs

```
node --import ./tests/register.mjs --test tests/*.test.js
```

and `pages.yml` ran the same command **without the resolver hook**, which is what
lets Node resolve a relative import of a `.ts` module. Every test that imports one
dies on load.

It had been wrong since the suite was pointed at `web/`. Nobody saw it, because
`pages.yml` triggers on **push to `main`** only, and every commit for that whole
period lived on a feature branch. The resolver reached `main` for the first time
with the merge — so the job failed the first time it was ever genuinely
exercised, and took the Pages deploy down with it. The site did not publish.

**The shape:** a check whose trigger excludes the place the work happens is not
a check that passes. It is a check with no result at all, and an empty result
reads exactly like a green one in a branch-protection UI that is only watching
two other names.

**Second fault, found at the same moment and cheaper to fix than to explain
later:** both workflows had a job called `test`, and the ruleset requires a
status check called `test`. Two different runs were reporting under one name.
Renamed to `pages-test`.

**Rules:**

- A workflow that runs on `main` only is unverified until something merges. If
  it runs a command, that command is also run somewhere the work actually
  happens — or the two commands are one command in one place.
- When two workflows run "the same" suite, they drift. Diff them deliberately, or
  make one call the other.
- A required status-check name belongs to exactly one job. Two jobs sharing it
  makes the branch's reported state depend on which run lands last.

### #14 — A required status check identifies by NAME, and nothing else

**2026-10-01, found beside #13 and the more serious of the two.**

The ruleset protecting `main` requires status checks called `test` and
`browser`. Read back from the API, the requirement is:

```
context='test'      integration_id=None
context='browser'   integration_id=None
```

**`integration_id=None` means the requirement matches on the name alone** —
nothing binds it to a workflow, a job, or even to GitHub Actions. Both `ci.yml`
and `pages.yml` had a job called `test`. The merge of pull request #1 produced
exactly this on `main`:

```
name=test      conclusion=success    .../runs/36866704090   (ci.yml)
name=test      conclusion=failure    .../runs/36866703259   (pages.yml)
name=browser   conclusion=success    .../runs/36866704090
name=deploy    conclusion=skipped    .../runs/36866703259
```

Two check runs, one name, opposite conclusions, on one commit. Which one the
branch *appears* to satisfy is a question about ordering, not about whether the
tests passed.

**Why this is worse than a naming collision.** Branch protection is read as a
guarantee: nothing merges unless `test` passed. What it actually says is
*something called `test` passed.* A second workflow — added later, by anyone,
for any purpose — can satisfy or break that requirement without touching the
suite it is supposed to guard. The protection is weaker than it reads, and it
reads as absolute.

**Rules:**

- A required status-check name belongs to **exactly one job in exactly one
  workflow**. Before adding a job, check the name is not already required or
  already produced elsewhere.
- Verify protection by listing what a commit actually reported, not by reading
  the ruleset: `gh api repos/<owner>/<repo>/commits/<ref>/check-runs`. Two rows
  with one name is the defect, and it is invisible in the ruleset itself.
- A rule that matches on a string is only as strong as the uniqueness of that
  string, and nothing in the platform enforces that uniqueness for you.

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
| 8 | commit messages | *no check existed* | a default trailer reached public history; cure was a repository rebuild |
| 9 | C1/C2 concept draft | *ids all unique* | four entries carried a name already live, where ids are permanent |
| 9 | `phon.elision` / `.basic` | PASS, since the taxonomy was written | identical French name, group and child; English names differed |
| 10 | `concept-names-distinct` fold | PASS | ASCII-only: every Arabic and Persian string folded to `""` |
| 11 | i18n parity + placeholder checks | PASS | single-quoted values only — blind to the 13 strings that hold an apostrophe |
| 11 | French interface strings | *no check existed* | 10 carried a straight prime; `fr()` is never applied to `t()` output |
| 11 | `fr=147` vs `en=fa=ar=160` | *in plain sight* | nothing compared the counts |
| 12 | `Concept.name`, `VerbTense.name` | `tsc` clean | typed `Record<'en' \| 'fr', string>`; 18 sites served English to fa and ar, and `name.fa` sat unread in `verbs.json` |
| 12 | the RTL walk's screen list | 856 checks, 0 failed | no screen in the list rendered a content name |
| 13 | `pages.yml` unit-test job | *never ran* | triggers on push to `main` only; broken since the resolver arrived, failed the first time it was exercised, and the site did not deploy |
| 14 | the `test` required check | *protection read as absolute* | matched by name only (`integration_id=None`); two workflows reported under it, success and failure on one commit |
| 2 | `no-untranslated-strings.test.js` | *could not start* | `new URL(...).pathname` percent-encodes; a clone under a path with a space in it crashed the suite |

Two more that are not checks but the same instinct: `@theme {}` in `tokens.css`
meant **not one design token was ever defined**, and the page still looked like a
page — a visual review would have passed it. And `.gitignore` said
`node_modules/` with a trailing slash, which matches directories only, so a
`node_modules` **symlink** was not ignored and would have been committed into a
public repository.
