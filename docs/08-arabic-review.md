# Arabic needs a human reader — a launch condition

**Status: open. Updated 2026-10-06.**

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

> **Correction, 2026-10-01.** This section previously said these six terms were
> shipped. They were in the file and **never reached a screen.** `VerbTense.name`
> was typed `Record<'en' | 'fr', string>`, and `VerbDetail.tsx` and
> `Conjugation.tsx` both read `ui === 'fr' ? name.fr : name.en`, so an Arabic
> learner saw “Present” and “Imperfect” while the Arabic sat unused in the
> content file. Found by looking at a Persian screenshot, not by any check.
> The type now admits all four languages, both screens render through
> `Localised`, and `tests/content-names-localised.test.js` asserts every tense
> name reaches a Persian and an Arabic learner. **So these six are now genuinely
> on screen, and genuinely unreviewed — which is what this section always meant.**

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

### 3b. Five interface strings added 2026-10-01, without a reader

Same judgement as the tense names — short, terminological — and listed here
rather than left for the reviewer to discover.

The map's seven columns used to read `CO CE PE PO Gr Voc Phon` in every
language. Those are **French** abbreviations (compréhension orale, compréhension
écrite, production écrite, production orale…), and they named the skill to
nobody who did not already know the French. They are now real labels:

| key | Arabic as shipped | English |
|---|---|---|
| `skillListening` | `الفهم السمعي` | Listening |
| `skillReading` | `الفهم القرائي` | Reading |
| `skillWriting` | `التعبير الكتابي` | Writing |
| `skillSpeaking` | `التعبير الشفوي` | Speaking |
| `notTranslatedName` | `يُعرض بالإنجليزية — لم يُترجَم هذا الاسم إلى العربية بعد.` | Shown in English — this name has not been translated into your language yet. |

As with the tense names: the question is not whether each is good Arabic, but
whether an Arabic-speaking learner of French would recognise it as the name of
that CEFR skill. If the convention in Arabic-language French teaching differs,
the convention wins.

### 3b-ii. Seven strings about a learner's own data, added 2026-10-02

These are **not** short and terminological, and they are the most consequential
Arabic in the product: they are the promise that progress is stored only in the
browser and is lost if the browser is cleared. An Arabic learner who misreads
this loses their history. Written without a reader, like the rest, and flagged
here as the highest priority in this document.

| key | Arabic as shipped |
|---|---|
| `dataTitle` | `أين يُحفظ تقدّمك` |
| `dataStored` | `كل ما تفعله هنا — سجلّ المراجعة والإعدادات والتقدّم — يُحفظ في هذا المتصفّح وحده.` |
| `dataNotSent` | `لا يُرسَل شيء إلى أي مكان. لا حساب ولا خادم ولا طرف ثالث، ولهذا لا يطلب منك هذا الموقع الموافقة على شيء.` |
| `dataClear` | `إذا مسحت بيانات المتصفّح أو عملت في نافذة خاصة، فسيضيع كل شيء ولا يمكن استرجاعه.` |
| `dataExport` | `صدّر نسخة من الإعدادات قبل تغيير الجهاز، ثم استوردها في الجهاز الجديد.` |
| `dataUnderstood` | `فهمت` |
| `dataOpen` | `أين يبقى تقدّمك وكيف تحتفظ به` |

The question for the reviewer is not only whether the Arabic is correct but
whether `dataClear` is **unmistakable**. It is the warning, and a warning that
reads as a mild caveat has failed.

### 3c. Concept names — **Arabic deliberately held, like the exam text**

The 297 concept names existed in English and French only, and were rendered to
Arabic and Persian learners **in English, in silence**, on Learn, Progress,
Search, the concept page and the side panel. They now go through `pick()`, so an
Arabic learner sees the English *and a line in Arabic saying it is not
translated* — `notTranslatedName` — rather than English presented as Arabic.

Persian has been written for the 85 A1 concepts, because Shahin reads Persian
and can check it. **Arabic is held at zero on purpose**, and the ledger in
`tests/content-names-localised.test.js` records that as a declared number, so
translating a level without updating the ledger fails, and adding an
untranslated concept fails too.

### 4. Exam papers — **prompts and explanations deliberately not written in Arabic**

76 prompts, 76 explanations and 16 stimulus labels exist in English, French and
Persian. **Arabic on those fields is held, on purpose** — every one is
`"ar": null`. The count was 28 when this section was written; two batches of
B2 structure items have been added since, and the slots stayed empty.

Paper **titles** are a different, shorter string, and they are in Arabic
already, on the same judgement as the tense names: short, terminological, and
unchecked by anyone who reads Arabic. The one added 2026-10-06 is
`TCF — بنية اللغة B2، الدفعة الثانية` (`tcf-b2-structure-3`). The five titles
already in the file are the same kind of unreviewed string.

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
- Every content name a learner reads now reports whether it is in their language,
  and no source file chooses between exactly two languages for a content field —
  `tests/content-names-localised.test.js`, whose detector is run against a
  planted sample on every run.
- Every value is in Arabic script, non-empty, and free of stray invisible
  characters.
- No two keys read identically where English keeps them apart.
- Every `{placeholder}` survives into the Arabic and is bidi-isolated at
  substitution time, in `translator()` — the single point where substitution
  happens, so no call site can miss it.
- Arabic is declared `dir: 'rtl'`.

Each of those has been seen failing on purpose, not merely seen passing.
