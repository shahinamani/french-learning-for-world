# Handoff — where this stands, last updated 2026-10-02

> ## Read this before you trust anything below
>
> **This document is the account of the agent that did the work, and nobody has
> checked it against the repository.** Where it describes what was built, read
> the code. Where it reports a number, re-run the thing that produced it — every
> figure here came from a command, and every one of those commands can be run
> again.
>
> **The ninety hand-written irregular verb models have only the oracles as their
> reviewer.** No French teacher has read them. They agree with Lexique on
> 34,150 attested forms and with fr.wiktionary.org on 100,228, which is strong
> evidence and is not the same as being checked by somebody who speaks the
> language. If one of those models is wrong in a form neither corpus attests, a
> learner will be taught it and nothing in this project will object.
>
> **And the single most important fact about what the product CONTAINS,
> copied 2026-10-06 from `content/concept-material.json` `theOneNumber`
> (re-run `scripts/build-concept-material.py` rather than trust this paragraph):
> 71,021 verb forms, 79 flashcards, 111 exam items — 99.7% of every exercise
> here is a verb form.** 74 of 261 live concepts have any exercise at all, and
> at C1 and C2 it is 0 of 71. This is a verb reference with a course-shaped
> taxonomy around it. The 111 counts a concept link, not a question: 76
> questions, twenty of them the unreviewed batch two on four B2 points that
> had no exercise before 2026-10-06.
>
> **And the number that should govern every content decision from here:
> 15–25 hours of teacher review for 150 exam items** — six to ten minutes each
> to check the French, the distractors and the explanation. Drafting them takes
> an afternoon. Measured on 2026-10-04 by writing eight properly and counting
> what had NOT been done; see the lessons entry "drafting is minutes; the review
> that makes it safe to teach is the cost".
>
> That is the single most important fact about the state of this work.


Written because a session ended mid-task. It assumes you have none of the
conversation that produced the work. Everything here is either in the repository
or is a decision that was taken verbally and would otherwise be lost.

**Twenty pull requests are merged. The work is on `main` at `09a1078`** — the
latest state is §9, at the end of this document; the paragraphs between here and
there were written on earlier days and describe earlier commits. `main` is
protected: `test` and
`browser` required, no force-push, no deletion — commit to a branch and open a
pull request.
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
both themes. **1016 checks over 13 screens, 0 failed** at the last complete run,
on the Chromium revision Playwright pins (1187).

**[2026-10-01] Two screens were added**, and the reason is worth keeping: the
walk rendered ten screens and **not one of them displayed a content name**.
Search shows nothing without a query and the concept page was not in the list,
so 856 checks passed over a product that was showing English concept names to
every Persian and Arabic learner. `/learn/concept/:id` and `/search?q=` are
now walked.

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

~~**Nothing is half-written. The tree is committed and pushed, 184 unit tests
pass, `tsc` is clean and the build is clean.**~~

> **[2026-10-01] Struck, and left visible because it is the lesson.** Every one
> of those four claims was true, and every one was about a local machine. **CI
> was red at the time this was written** — this very document carried an email
> address in a tracked file, which failed the personal-data scan on the push and
> on the pull request. The handoff written so a lost session loses nothing
> omitted the one fact a reader checks first, and read as green.
>
> A handoff now **ends with a CI run**: url, timestamp, conclusion, and the sha
> it refers to. Asserted by `tests/handoff-and-push-safety.test.js`, whose
> detector is run against this document's own closing claim on every run. And
> the sweep is a **pre-push hook** now, so it no longer depends on somebody
> remembering to run it.

~~The one thing not completed: the Persian screenshots were never sent.~~
**Done 2026-10-01.** 104 PNGs produced on the pinned browser and sent as images.
Reproduce with:

```
cd web && npm run build
python3 e2e/gzserver.py dist 8793 &
node e2e/rtl.mjs /path/to/output-dir
```

`{fa,ar}-{375,1440}-{light,dark}-{screen}.png`, 13 screens plus an accent-bar
shot per context.

**The open item is Shahin's Persian verdict on the 85 A1 concept names**, which
were written in this session and are unreviewed. A2 and B1 wait on it.

## 4. What to do next, in order

1. **Shahin's verdict on the A1 Persian concept names**, then A2 and B1 in that
   order. Arabic concept names stay held until there is a reader.
2. **Part 9.1 remainder**: per-language typography on screen (the dictionary is
   checked; the rendering is not). ~~an axe-core accessibility pass in the two
   RTL locales — the existing axe scan runs in English only.~~ **Done
   2026-10-10**, in `walk.mjs` rather than `rtl.mjs`, because `rtl.mjs` is not
   run in CI and a scan on one machine is not a guarantee. 52 scans: English in
   both themes, Persian and Arabic in light, over 11 screens plus the side
   panel and the timer popover. 0 violations. Both new guards were seen red on
   purpose first — a planted `image-alt` found on all 13 Persian scans, and the
   locale-fallback guard caught the Persian pass rendering `dir="ltr"`.
3. Then the order Shahin set: **TRANSLATIONS → SLIDES → C1/C2 content →
   landing page.**
4. `docs/08-arabic-review.md` must be updated whenever Arabic strings are added,
   so the reviewer gets one document rather than a trail.

## 5. Known broken, unproven, or deliberately unfinished

- **No screen reader has been used on this project.** axe-core is not a screen
  reader, and nothing here should be described as screen-reader tested.
- **The axe accessibility scan runs in English, Persian and Arabic** since
  2026-10-10 — 52 scans in `walk.mjs`, English in both themes, the two RTL
  locales in light only. The stated boundary: a rule that is **both**
  locale-sensitive and colour-sensitive would not be covered in the RTL
  locales. None in the WCAG 2.1 A/AA set is; contrast reads two colours, not
  the glyphs between them. The comment in `walk.mjs` names the place to fix it
  if that ever stops being true.
- **`rtl.mjs` is still not run in CI.** Its 1016 layout checks are a local
  result, and the figure in the heading of §2 should be read that way. The axe
  pass was deliberately put in `walk.mjs` instead, which is the required
  `browser` check. Putting the RTL layout walk into CI is not done.
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

---

---

## 9. State at 2026-10-02 — the verbs are in, the glosses are not clean

Written because a session ended with context exhausted. Everything below is in
the repository; nothing here is only in a conversation.

### What changed today

**Content: 14 verbs became 2,392.** A learner browsing verbs now sees 2,392 with
every tense, every person, the auxiliary, the group and the irregularity marked.

    content/verbs-index.json   2,392 lines, 80 KiB gz  — list and search
    content/verbs/<level>.json paradigms by CEFR level, ~35 KiB gz each
    content/verb-forms.json    82,798 forms → infinitive, 237 KiB gz, LAZY
    content/tense-names.json   8 tenses × 4 languages, once
    content/attribution.json   sources and licences, rendered at /about

Sharded by level because that is what a session follows. Shards are **not**
precached; the service worker's stale-while-revalidate caches each on first use.

**The conjugator** (`scripts/conjugate.py`, `scripts/irregular_models.py`)
generates by rule — no conjugation table is copied, because Verbiste is GPL-2+
and GPL cannot flow into CC BY-SA. 90 irregular models, keyed on the ENDING that
identifies a family rather than a representative verb (docs/lessons.md #18).

    2,374 of 2,400 verbs: every corpus-attested form correct
    0.10% mismatch across 34,150 forms · 0 unclassified
    SHIPPABLE 2,392 · 8 withheld, each named with a reason

**Two oracles, and the second earns its place.** Lexique 3.83 (CC BY-SA 4.0)
attests ~19 of a verb's ~45 forms. fr.wiktionary.org (CC BY-SA 4.0) carries
complete paradigms: **2,389 verbs, 100,228 forms compared, 98.66% agreed**, and
it found three real errors in forms Lexique does not attest at all (maudire,
prévaloir, haïr → « hâït »). Harvest takes ~41 minutes and caches.

**The gate runs in CI.** `tests/fixtures/lexique-verbs.json.gz` is 150 KiB
gzipped against the 24.65 MiB original and gives identical results.

**Glosses:** 2,375 of 2,392 from en.wiktionary (CC BY-SA 4.0).

**Alternates:** French admits two spellings in three families (essaie/essaye,
espérerai/espèrerai, martèle/martelle). 124 verbs carry `accepted` on the form,
generated by the same rules with the other choice made. The conjugation drill
honours them.

### Resume order, set by Shahin on 2026-10-02

1. ~~**Gloss quality.**~~ **Done 2026-10-02.** Two senses, the decision made on
   our own English output rather than Wiktionary's French label (Shahin's
   ruling: show the meaning, show the register), 100 sampled across the bands,
   and the page says the meanings are unreviewed. Five verbs are silent and say
   why. See `tests/glosses.test.js`.
1b. ~~**Pronominal-only verbs.**~~ **Done 2026-10-02, and it was the most
   serious defect found so far.** « souvenir » was glossed "to remember" with a
   table reading « je souviens » — six rows of French that does not exist, on an
   A1 verb. 51 verbs are pronominal-only; they now carry `pronominal` and a
   headword (« se souvenir », « s'évanouir ») and the table shows the pronoun.
   **The 51 have had no review but Wiktionary's labels. It is a ten-minute read
   for a teacher and it is the highest-value ten minutes available.**
2. **Alternates in the flashcard session and the exam engine.** Only the
   conjugation drill honours `accepted`. A learner marked wrong for correct
   French in an exam is the same defect where it hurts most.
3. **Re-measure the verb index against the budget** — 26 → 80 KiB gzipped was
   pushed without checking, and the budget has never slipped before.
4. **The level-assignment list** for Shahin's 150–250 manual moves: verb,
   frequency-assigned level, room for his correction.
5. **The 51 pronominal-only verbs are with Shahin for a ruling** —
   `docs/reviews/pronominal-51.md` has the list with a column for his verdict.
   `cabrer`, `évaporer` and `prostituer` are already flagged as likely wrong.
   This review matters more than the glosses: a wrong meaning teaches one wrong
   word, a wrong reflexive marking teaches a wrong conjugation on every row.
6. **Never open a pull request whose base is not `main`.** On 2026-10-03 PR #27
   was stacked on PR #26's branch. #26 merged into `main` first, #27 then merged
   into a branch that was already gone, GitHub reported it `MERGED`, and its
   work — five of Shahin's gloss corrections and a test file — was absent from
   `main` for a day. **A pull request whose base is not `main` can report
   success and deliver nothing**, and nothing in CI or the merge UI says so.
   Branch from `main` and rebase when `main` moves.
7. **Build inputs are in `data/`** and the page caches are at
   `~/.cache/flw/`, not in a scratchpad. `data/README.md` states what losing
   them costs: 4,793 requests against Wikimedia, about 28 minutes. `content/`
   rebuilds from `data/wiktionary-glosses.json` with no network at all.

### What is wrong right now, in priority order

1. **Gloss quality is unreviewed and some of it is unusable.** « venir » ships
   with "to cum, to come, to orgasm" as a third sense. This is in content a
   learner reads. The fix Shahin specified: take the first one or two senses
   only, drop senses Wiktionary labels vulgar/slang/obscene using the LABEL not
   the text, then sample a hundred across frequency bands for him to read, and
   say on the page that meanings come from Wiktionary and are unreviewed.
2. **Alternates are honoured only in the conjugation drill.** The flashcard
   session and the exam engine have their own answer paths and have NOT been
   checked. A learner marked wrong for correct French in the exam engine is the
   same defect where it hurts most.
3. **The verb index tripled, 26 → 80 KiB gzipped, and was pushed without
   re-measuring against the budget.** The budget (150 KB JS / 30 KB CSS, docs/01)
   is the one discipline on this project that has never slipped.
4. **Level assignment is raw frequency.** Shahin will move 150–250 by hand and
   needs the list as verb / assigned level / room for his correction. `paumer`
   at C1 is the example: frequent in film dialogue, absent from every exam.
5. **No Persian or Arabic meanings for any of the 2,392**, and the cost against
   his review sittings is not estimated.

### Unchanged and still true

- **Arabic has no reader.** ~15 strings now wait, the highest-priority being the
  seven data-honesty strings — see docs/08. A launch condition.
- **No screen reader has been used.** axe is not a screen reader. It now runs
  in English, Persian and Arabic (2026-10-10); that widens the scan, and
  changes nothing about the screen-reader claim.
- **B2 is the stated ceiling and that is correct.** The taxonomy reaches C2; no
  card, drill or exam item is written against a C1 or C2 id. 2,392 verbs include
  C1 and C2 frequency bands, which does NOT change the ceiling claim.
- **Nothing is deployed.** Cloudflare Pages is prepared (`web/public/_headers`,
  `_redirects`, `.nvmrc`) and waits on DNS at Namecheap for frenchmavie.com.
  Build: root `web`, command `npm ci && npm run build`, output `dist`,
  `NODE_VERSION=22`. HSTS carries `preload` deliberately and the domain must NOT
  be submitted to hstspreload.org without Shahin saying so.
- **No landing page**, so the honest-status copy has nowhere to live.
- **`app/` still exists.** Of the nine parity conditions in docs/07, the About
  destination is now built (`/about`); a real exams section is still a stub.
- **Audio and the review tool are stopped** by instruction. Piper evaluated and
  licence-checked; the voice is generated but unjudged — sample artifact exists.
  Settled before that work resumes: **the release asset is downloaded into
  `dist/` at build time, never fetched by the browser**, because the CSP's
  `'self'` and the privacy rule both require it.
- **Compound tenses, construction, pronominal behaviour and
  preposition-before-infinitive** are Part 2 requirements and are NOT started.

### Merge authority, as granted 2026-10-02

Merge own PRs only when ALL hold: CI green on the exact head SHA, checked
**before** merging; inside agreed scope; not a deploy, history rewrite, branch
protection change, or licence/policy decision; **no new Persian or Arabic
content**; and reported in the next message. Unsure means outside.

### Lessons added today

#16 a suffix match is a proxy for a family · #17 `typeof` is not safe on a
property accessor that can throw · #18 the fix for matching too eagerly is not
to match less.

The typographic apostrophe (U+2019) has now broken three things in this project
and twice in `harvest_wiktionary.py` — the second time because one of my own
edits replaced the block containing the earlier fix. Two edits that day silently
replaced text that no longer existed and asserted nothing.

---

## 10. CI status — the last line, because it is the one that is checkable

**`main` at `346baae`** — required checks `test` **success**, `browser`
**success**.
Run: <https://github.com/shahinamani/french-learning-for-world/actions/runs/37021813641>
Observed **2026-10-02T14:43:09Z**. 232 unit tests, 183 browser checks.

This block reports the **last CI run observed on this branch**, which is the run
of the push before this document was last written — a document cannot name the
run of the commit that contains it. Whoever pushes next observes that run and
updates this block as the final act of their session. A local test count is not
a substitute and is not accepted here: `tests/handoff-and-push-safety.test.js`
rejects "184 unit tests pass, tsc is clean and the build is clean" as a CI
status, because that is exactly the sentence this document shipped while CI
was red.
