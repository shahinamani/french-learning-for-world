# Handoff — where this stands, 2026-10-01

Written because a session ended mid-task. It assumes you have none of the
conversation that produced the work. Everything here is either in the repository
or is a decision that was taken verbally and would otherwise be lost.

**Branch: `feat/portal-foundation`. Tip: `314e856`. Pull request: #1 into `main`.**
`main` is at `ffb6393` and is protected: `test` and `browser` are required
checks, no force-push, no deletion.

---

## 1. The standing rules, because they are not optional

- **No tool attribution anywhere, ever.** No `Co-Authored-By`, no "generated
  with", no robot emoji — not in a commit message, a pull-request description, a
  README, a changelog or any file. Every commit is authored
  Shahin Amani and nothing else — the address lives in commit metadata, where
  it belongs, and nowhere a scraper reads. This is enforced:
  `scripts/check-commit-messages.sh` runs in the required `test` job, and
  `tests/commit-attribution.test.js` builds throwaway repositories and plants six
  offending forms on every run, so the detector is seen red continuously rather
  than once. A single historic red run would have left the offending commit in
  history forever, which is the harm itself. This rule exists because a default
  trailer once reached public history and the cure was deleting and rebuilding
  the whole repository (`docs/lessons.md` #8).
- **This is a public repository.** Before every push, run
  `scripts/pre-push-sweep.sh`: credentials, commit attribution, personal data,
  unit tests with `web/node_modules` hidden as CI has them, and nothing heavy
  staged. All five in one command, because a safeguard split across five commands
  is a safeguard that gets partially run.
- **Evidence, not claims.** Every check in this repository has been seen failing
  on purpose. A check never seen red is a check never seen.
- **Say what is wrong or unfinished in the same message as what is done.**
- **Ask before deciding anything that affects the learner.**
- **Content licensing is a hard blocker.** Never copy, adapt or "rephrase"
  content from any commercial textbook, course or app. Every source and licence
  is recorded in `docs/02-content-licences.md`.

## 2. What was completed in this session

### Concepts: A1–C2, 297 of them

`content/concepts.json` holds 297 concepts (85 A1, 68 A2, 50 B1, 21 B2, 51 C1,
22 C2), 261 leaves under 4 roots. **Ids are permanent and public** — the file
states the rule and `tests/concept-ids-permanent.test.js` enforces it against a
frozen fixture of the original 224.

The C1/C2 draft was audited against six named C2 areas before merging. Four were
already covered and were deliberately left alone; three were genuinely missing
and were added:

- `gram.expression.ellipse` — a clause with its verb or head removed. Distinct
  from `gram.connector.implicite`, which drops the link between propositions.
- `usage.proverbe` — a proverb is a whole proposition offered as shared truth,
  which is what makes it an argumentative move. `usage.idiomes` (C1) covers
  fixed expressions as lexemes; this is not that.
- `phon.rhythm.conversation` — following several speakers at full speed. **This
  is the weakest of the three**, because the three C1 phonetics entries between
  them name every phenomenon in it. It was kept, and given a stated boundary
  rather than removed.

**Four draft entries were duplicates of concepts already live.** Ids distinct,
names character-for-character identical (`gram.subjunctive.passe` vs
`gram.subjunctive.past`, and three more). Removed before merge. A fifth had been
live since the taxonomy was written: `phon.elision` and `phon.elision.basic`
were both « L'élision », surviving because the **English** names differed.

**`lex.law` / `lex.justice` must never be folded.** French divides *le droit*
(the body of rules) from *la justice* (the courts and their procedure) where
English says "law" for both. `lex.law` was renamed from "Law and justice" to
"Le droit", because the old name swallowed both halves and is why the pair read
as a duplicate. Both now carry descriptions naming the other id, and
`tests/concept-names-distinct.test.js` asserts each cites the other.

### Four languages

English, French, Persian, Arabic. 169 interface keys each.

- **Bidi isolation lives in `translator()`**, at the one point where
  substitution happens — not at the call sites. A rule applied at call sites is
  a rule one call site will always miss. RTL locales only.
- **`web/src/components/Localised.tsx`** renders any field whose language is not
  guaranteed, with `dir="auto"` and the `lang` that `pick()` actually returned.
  Same argument. Use it for anything that might fall back to English.
- **`pick()` in `web/src/lib/exams.ts`** returns `{ text, translated, locale }`.
  `field[ui] ?? field.en` is forbidden: it serves English and says nothing.
- Collisions fixed: `fr.marks` → « Barème » (it was « Points », colliding with
  `concepts` on the exam results screen); `close`/`dismiss` separated in fr, fa
  and ar. `start`/`startSession` and `whatToWorkOn`/`toWorkOn` are left
  collapsed **on purpose** — English happens to keep them apart, the learner
  does not need them apart. They are listed in `KNOWN_COLLISIONS` with that
  reason.

### Arabic is a launch condition

**`docs/08-arabic-review.md` is the single document for this. Keep it current.**
Nobody in this project reads Arabic. Shahin reads Persian and French.

- **Exam prompts, explanations and stimulus labels exist in English, French and
  Persian. Arabic is deliberately held** until a human reader reviews it. A
  learner trusts an explanation; a wrong one teaches a wrong thing and is
  believed. An Arabic learner sees the English text plus `notTranslatedHere` —
  a line, in Arabic, saying it has not been translated yet.
- Tense names, interface strings and the two content titles **were shipped in
  Arabic without a reader**, on the judgement that they are short and
  terminological. `docs/08` says so plainly and lists them for review.
- The reviewer's first question is whether the tatweel in `لـFrance` is correct.
  It was written deliberately (the prefix ل cannot join a Latin word) and is
  listed as *allowed* in the test rather than stripped, because a non-reader
  "tidying" it away would introduce the defect. Either answer tells us whether
  the review is being read or skimmed.

### RTL, verified by looking

`web/e2e/rtl.mjs` renders every screen in Persian and Arabic at 375 and 1440 in
both themes. **856 checks, 0 failed** at the last complete run.

Found only by looking at the rendered page, after every data check passed:

1. **Strings that never entered the dictionary** — "Skip to content", the whole
   theme selector, two route stubs taking English prose as a prop. All English
   in all four languages. The parity check reported truthfully on the set it was
   given; the defect lived outside the set.
2. **Three learner-facing paragraphs were plain English strings** with no locale
   keys at all (`passNote`, `practiceNote`, `source`). Even the French interface
   showed English.
3. **English inside an RTL paragraph reordered** — "with at least 5 of 25 on
   `.each`", "the 4 8 exercises". Fixed by `Localised`.
4. **Two numbering systems on one card** — Persian digits in prose beside `30`
   and `25` substituted by the app. Normalised to ASCII and guarded.
5. **`AccentBar` read `ArrowRight` as forward** — correct, but only by
   coincidence, and only while the hard-coded `dir="ltr"` stayed. It now reads
   the computed direction.

Confirmed correct and left alone: `styles.css` uses logical properties
throughout with no physical `left`/`right`; `<html dir>` is set from `LOCALES`;
the skip link mirrors and returns on focus; the accent bar stays `ltr` on an RTL
page, inserts at the caret, keeps exactly one key in the tab order, and Home/End
reach both ends.

---

## 3. In flight when the session ended

**Nothing is half-written. The tree is committed and pushed, 184 unit tests
pass, `tsc` is clean and the build is clean.**

The one thing not completed: **the Persian screenshots were never sent to
Shahin.** He reads Persian and asked to see them as images rather than as a
description. They are produced by:

```
cd web && npm run build
python3 e2e/gzserver.py dist 8793 &
node e2e/rtl.mjs /path/to/output-dir
```

88 PNGs: `{fa,ar}-{375,1440}-{light,dark}-{screen}.png` plus an accent-bar shot
per context. **They were regenerated after the digit fix but not reviewed and
not sent.** That is the immediate next step.

## 4. What to do next, in order

1. **Send Shahin the Persian screenshots.** He will check the Persian himself.
2. **Part 9.1 remainder**: per-language typography on screen (the dictionary is
   checked; the rendering is not), and an axe-core accessibility pass in the two
   RTL locales — the existing axe scan runs in English only.
3. Then the order Shahin set: **TRANSLATIONS → SLIDES → C1/C2 content →
   landing page.**
4. `docs/08-arabic-review.md` must be updated whenever Arabic strings are added,
   so the reviewer gets one document rather than a trail.

## 5. Known broken, unproven, or deliberately unfinished

- **No screen reader has been used on this project.** axe-core is not a screen
  reader, and nothing here should be described as screen-reader tested.
- **The axe accessibility scan runs in English only.** RTL has layout checks but
  no accessibility scan.
- **Arabic has had no human review.** See `docs/08`. This is a launch condition.
- **`app/` still exists and is still deployed.** It is the old vanilla portal.
  Two of the nine parity conditions in `docs/07-claim-sweep.md` are unmet, so it
  cannot be deleted yet. `tests/suite-targets-the-build.test.js` forbids a test
  from importing `app/` unless its header declares that it means to.
- **Sounds and listening are blocked on licensing, not on code.** No recording
  has been obtained under a licence that permits use. Machine speech is not
  shipped as listening practice.
- **No card, drill or exam item is written against a C1 or C2 id.** The taxonomy
  reaches C2; the product does not. **Every learner-facing page still says B2,
  and that is correct.** Do not change the ceiling claim before the content
  changes. This was stated explicitly and is to be held.
- **Number localisation is an open product decision.** Numbers render as ASCII
  everywhere. Localising them (scores, clocks, counts) was not taken; the
  inconsistency was fixed, not the choice.
- **`claude/confident-johnson-xu1f22`** is a local branch of pre-rebuild
  history. Its tip tree is byte-identical to `dbc2351` on
  `feat/portal-foundation`, so it contains nothing that is not already on
  GitHub. It was deliberately NOT pushed: it would add a stale divergent history
  to a public repository for no benefit. Delete it, or push it with
  `git push -u origin claude/confident-johnson-xu1f22` if you want it kept.

## 6. The lessons list is the most valuable file here

`docs/lessons.md` — eleven entries, each a verification fault: something that
reported success without having checked. Read it before writing a check.

The two most load-bearing, both found this session:

> **#10 — The alphabet was an assumption, and nobody declared it.** Every
> character class encodes a belief about which alphabet the text is in, and that
> belief is almost never stated. Fixing `\w` fixed one regex. The belief behind
> it — *text is Latin unless something says otherwise* — survived the fix and
> reappeared the same day, in new code, written by the person who had just
> written the lesson up. **The class reproduces itself through the author of the
> fix.** Carried into the RTL work, where it appeared again: a mirroring check
> that assumed the first `h1` is the page heading.

> **#11 — A checker that cannot parse the shape the defect lives in.** The i18n
> reader matched single-quoted values only. Thirteen French strings are
> double-quoted *because they contain an apostrophe* — so the checker was blind
> to exactly the strings most likely to carry an apostrophe fault, by the same
> cause. Ten of the thirteen had it. `fr=147` against `en=fa=ar=160` was in
> plain sight and nothing compared the counts.

The pattern worth keeping from both: **a guard on an internal key is not a
guard.** Check the field the user reads, in every language it is read in. A
collision can exist in one language and not another, and the language you don't
speak is the one that survives.

## 7. How the guards are shaped, so you don't loosen them by accident

`KNOWN_COLLISIONS`, `EXPECTED_SHAPES` and the exemption lists are asserted with
`deepEqual`, not `includes`. **Adding a defect fails, and fixing one without
striking it from the list also fails.** That is deliberate: an allowlist that
only ever grows is a way of not fixing things. If a list needs changing, change
it on purpose and say why in the commit.

Exemptions are named individually with a reason, never widened into a pattern.
Two examples worth copying: the tatweel in `لـFrance` is listed as correct
Arabic typography; a licence's formal name and external page titles are listed
as not ours to translate.
