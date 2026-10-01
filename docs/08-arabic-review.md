# Arabic needs a human reader — a launch condition

**Status: open. 2026-10-01.**

This is not a backlog item and not a nice-to-have. **The platform does not launch
in Arabic until a person who reads Arabic has reviewed what is below.**

## Why this document exists

Everything machine-checkable about the four languages is checked, on every push,
in `tests/i18n-four-languages.test.js`: key parity, per-language collisions,
script membership, Persian letterforms against the Arabic ones that look like
them, invisible characters, empty values, direction, and bidi isolation.

None of that tells you whether the Arabic is **right**. A string can pass every
one of those checks and still be wrong, stilted, or say something other than
what the English says — and nobody in this project's loop would know. Shahin
reads Persian and French. Nobody here reads Arabic.

The guiding rule, from `docs/lessons.md` #9: *a collision can exist in one
language and not another — the language you don't speak is the one that
survives.*

## Start here: one question that tests whether you are reading carefully

**In `ar.examIndependence` and `ar.searchEmpty`, the text contains `لـFrance`
and `لـ «{q}»` — a lam followed by a tatweel (U+0640) before a Latin word.
Is that correct?**

It was written deliberately: the prefix ل cannot join to a Latin word, so the
tatweel carries the connection. It is listed as allowed in the test rather than
stripped, precisely because somebody who does not read Arabic "tidying it away"
would be introducing a defect, not removing one.

If you think it is wrong, say so — that is a real finding. If you think it is
right, say why. Either answer tells us the review is being read rather than
skimmed.

## What to review, in priority order

### 1. The interface dictionary — `web/src/lib/locales/ar.ts`

160 strings. Every one is on screen. Particular things to look at:

- **`dismiss` was changed on 2026-10-01** from a value identical to `close`
  (both were `إغلاق`). It is now `تجاهل`. English distinguishes *Close* a panel
  from *Dismiss* a notification; confirm the Arabic distinction is the right one.
- **`marks` / `concepts`** — the same collision happened in French, where both
  became « Points » on the exam results screen. Arabic has `الدرجات` and
  `النقاط`. Confirm these do not read as the same thing in context.
- **The six strings that are identical to the Persian** after folding
  (`فعل`, `اسم`, `مذكّر`, `مؤنّث`, `دقيقة`, and a French placeholder). These look
  like shared vocabulary rather than a copy-paste; confirm.
- **Register.** The interface addresses a learner directly. Is it consistent?

### 2. Verb tense names — `content/verbs.json`

Six terms, each repeated across fourteen verbs, added 2026-10-01 **without an
Arabic reader**, on the judgement that they are short and terminological:

| id | Arabic as shipped | French |
|---|---|---|
| `present` | `المضارع` | Présent |
| `imparfait` | `الماضي الناقص` | Imparfait |
| `passe-compose` | `الماضي المركّب` | Passé composé |
| `futur` | `المستقبل البسيط` | Futur simple |
| `conditionnel` | `الشرطي الحاضر` | Conditionnel présent |
| `subjonctif` | `المضارع المنصوب` | Subjonctif présent |

These describe **French** tenses. The question is not whether each term is good
Arabic grammar terminology for Arabic, but whether an Arabic-speaking learner of
French would recognise it as the name of that French tense. If the convention in
Arabic-language French teaching differs, the convention wins.

### 3. Content titles

`content/decks.json` and `content/fr-core-a1.json` both carry
`الفرنسية الأساسية A1`. Added without a reader, same caveat.

### 4. Exam papers — **deliberately not written yet**

28 prompts, 28 explanations and 16 stimulus labels exist in English, French and
Persian. **Arabic is held, on purpose.**

A learner trusts an explanation. A wrong explanation teaches a wrong thing and
is believed, which makes it worse than no explanation at all. So an Arabic
learner currently sees the English text and a line saying, in Arabic, that it
has not been translated yet — `notTranslatedHere`, rendered by `pick()` in
`web/src/lib/exams.ts`, which reports whether what it returned is the learner's
language rather than falling back in silence.

This is the honest state. It stays until a reader exists.

## What a reviewer needs

- The running site, in Arabic, at phone and desktop width.
- `web/src/lib/locales/ar.ts` beside `web/src/lib/i18n.ts` (English is the
  structural source of truth; the keys match one-for-one).
- No French required. Where a French term appears inside Arabic text it is
  wrapped in bidi isolates so it renders as one piece; if any of it renders
  broken or reordered, that is a finding and worth reporting.

## What is already guaranteed without a reader

So the review can concentrate on meaning:

- The key set matches English exactly, with no duplicates and none missing.
- Every value is in Arabic script, non-empty, and free of stray invisible
  characters.
- No two keys read identically where English keeps them apart.
- Every `{placeholder}` survives into the Arabic and is bidi-isolated at
  substitution time, in `translator()` — the single point where substitution
  happens, so no call site can miss it.
- Arabic is declared `dir: 'rtl'`.

Each of those has been seen failing on purpose, not merely seen passing.
