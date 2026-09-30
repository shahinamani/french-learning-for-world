# 02 — The review log

**Status:** design, for review. **Swept against the build 2026-09-30** — what was built, and what was not, is marked **[as built]** below and in `docs/07`. Written **before** the information architecture, on Shahin's instruction, because Progress and every weak point is a query over this table and the IA has to know what it can ask for.

---

## Why this comes first

Our current scheduler stores only the *present* state of a card: its stability, difficulty, and when it is next due. That is enough to schedule, and useless for everything else. It cannot answer:

- *Which grammar concept is failing?* — we never recorded what the card was testing.
- *Is it getting better or worse?* — we overwrote the previous state.
- *Are the scheduler's parameters right for this learner?* — refitting needs the history that produced them.
- *What did I study last Tuesday?* — gone.

Every one of those is a row-level question about the past. **A log added later starts empty**, so the first months of every learner's history would be unrecoverable — which is the whole argument for building it now rather than after launch.

`ts-fsrs` (MIT) already defines a `ReviewLog`; this design follows its shape and adds the columns our product needs on top.

---

## The scheduler contract we adopt

From `ts-fsrs`, verified by reading `packages/fsrs/src/models.ts`:

```ts
enum State  { New = 0, Learning = 1, Review = 2, Relearning = 3 }
enum Rating { Manual = 0, Again = 1, Hard = 2, Good = 3, Easy = 4 }
type Grade  = Exclude<Rating, Rating.Manual>   // what a learner can press
```

Four states, not two. The distinction that matters to us: **`Learning`** is a card being met for the first time, **`Relearning`** is a card that was known and was forgotten. They deserve different intervals and — more importantly here — they mean different things in a weakness report. A word you have never known is not a weakness; a word you knew last month and have lost is.

`Rating.Manual` exists for reschedules that were not a learner's judgement (an import, a reset, a parameter refit). Logging it separately keeps administrative events out of the accuracy statistics.

---

## The row

One row per review. Append-only: nothing in this table is ever updated in place, because a log you can edit is not a log.

| Column | Type | Why it exists |
|---|---|---|
| `id` | uuid | — |
| `reviewed_at` | timestamptz | The moment of the answer. **Not** a date: "how do I do late at night" is a real question. |
| `user_id` | uuid, nullable | **Null for anonymous learners.** Study works with no account; the log lives in IndexedDB and carries a null user until they sign in, at which point the rows are claimed. **[as built — changed]** `userId` is **required and never null.** Anonymous learners get a locally-generated profile id instead, because step 4 had to support more than one learner per browser and a null user cannot be told apart from another null user. Every storage key goes through `userKey(userId, name)`, which *throws* without an id, and the IndexedDB primary key is `[userId, cardKey]`. Claiming rows on sign-in becomes a re-key of an existing id rather than a fill-in of nulls. |
| `card_key` | text | The content-derived key (`v:etre`), never an array index or a database id, so content can be re-authored without orphaning history. |
| `item_type` | enum | `vocab · verb_form · grammar · listening · reading · cloze · dictation · pronunciation` — the exercise kind, so "you are fine reading and lost listening" is answerable. |
| `concept_ids` | text[] | **The column the weakness model is built on.** What this review actually tested: `['gram.passe-compose.etre-aux', 'verb.aller', 'cefr.A2']`. One review can exercise several concepts, which is why it is an array and not a foreign key. |
| `direction` | enum | `fr→native · native→fr · audio→fr · fr→audio`. Recognition and production fail separately and a learner needs to know which. |
| `prompt_shown` | jsonb | **What was actually on screen** — the sentence, the blank, the options offered. Content gets revised; without this, an old row's meaning drifts. |
| `response` | jsonb, nullable | What the learner typed or chose. Null for a self-graded flashcard. |
| `is_correct` | boolean, nullable | For machine-markable exercises. Null where correctness is the learner's own judgement — it is not the same thing as a grade and must not be conflated. |
| `grade` | smallint | `Rating` 0–4. `0` = Manual. |
| `duration_ms` | integer | Time to answer. Hesitation is signal: a card graded Good after eleven seconds is not known. |
| `state_before` | smallint | `State` before this review. |
| `state_after` | smallint | `State` after. |
| `stability_before` / `stability_after` | real | |
| `difficulty_before` / `difficulty_after` | real | |
| `elapsed_days` | real | Days since the previous review of this card — from the log, not recomputed later. |
| `scheduled_days` | integer | Interval this review produced. |
| `due_before` / `due_after` | timestamptz | |
| `scheduler` | text | e.g. `fsrs-6`. Algorithms change; rows scheduled by different versions must stay distinguishable. |
| `params_hash` | text | Hash of the weight vector in force. Without it, a refit makes every earlier row uninterpretable. **[as built — MISSING]** This column is specified here and is **not** in `ReviewRow`. Every other column in this table is. The consequence is the one stated in the sentence above it: if the FSRS weights are ever refit, rows written before the refit cannot be told from rows written after, and the whole log becomes uninterpretable for optimisation. It is cheap now and impossible retroactively. Open. |
| `client` | text | `web · pwa · offline-sync`. |
| `session_id` | uuid | Groups rows into a sitting, so "time studied" is measurable without a separate table. |

**Invariants**

- Append-only. Corrections are new rows with `grade = Manual`, never edits.
- `state_before`/`state_after` and the stability/difficulty pairs are written together in one transaction with the card's new state, or neither is written. A log that disagrees with the card it describes is worse than no log.
- `card_key` is not a foreign key to a content table. Content is versioned separately and a deleted card must not take its history with it.

---

## What each product surface asks of it

This is the test of the schema: every feature in the brief must be a query here, not a new table.

| Brief requirement | Query |
|---|---|
| **Due today** | current card state, not the log |
| **Time spent** | `sum(duration_ms) group by session_id, date` |
| **Streak** | `count(distinct date(reviewed_at at time zone :tz))` — note the learner's own time zone, or the streak breaks when they travel |
| **Words known** | cards in `state = Review` with `stability >= 21` — **[as built] not implemented.** Progress shows reviews, accuracy and per-concept weakness; there is no "words known" figure on any screen. The query is right; nothing calls it |
| **Weak points** | `concept_ids` unnested, `avg(grade)` and lapse rate per concept over the last N reviews, ranked. **This is the whole feature, and it is one query.** |
| **Recognition vs production gap** | the same, split by `direction` |
| **Listening vs reading gap** | the same, split by `item_type` |
| **"You knew this and lost it"** | rows where `state_before = Review` and `state_after = Relearning` |
| **Answering too fast / guessing** | `is_correct = true` and `duration_ms` below a per-item-type floor |
| **History** | the log, filtered |
| **Goals** | targets compared against the aggregates above |
| **Parameter refit** | the log replayed through the optimiser, which is exactly the input FSRS's optimiser expects |

Nothing in the brief's Progress section needs a table that is not here.

---

## Concepts — the piece that has to exist for any of this to work

`concept_ids` only pays off if concepts are a real, stable taxonomy rather than free text. Proposed shape, with a flat dotted namespace so it can be queried by prefix:

```
gram.<area>.<point>     gram.passe-compose.etre-aux
                        gram.subjonctif.apres-conjonctions
                        gram.accord.participe-passe-cod
verb.<infinitive>       verb.aller
form.<tense>            form.imparfait
lex.<theme>             lex.administration
phon.<feature>          phon.nasal-on-vs-an
                        phon.liaison-obligatoire
cefr.<level>            cefr.A2
```

A learner never sees an id — they see *"Le passé composé avec être"*, translated. The id is the join key, and it is the thing that lets a listening exercise, a cloze and a flashcard all count toward the same weakness.

**This taxonomy is a content-design task, not a coding one**, and it is on the critical path: the review log is worthless without it, and it should be drafted alongside the grammar reference in the IA.

---

## Storage, given there is no backend yet

The platform is anonymous-first and currently has no server.

- **Now:** the log lives in **IndexedDB** on the device. `localStorage` is wrong for this — it is synchronous, string-only, and capped around 5 MB, and a daily learner generates tens of thousands of rows over a few years. IndexedDB is asynchronous, indexable on `reviewed_at` and `card_key`, and effectively unbounded.
- **Export:** the log is included in the existing progress export, so a learner can carry their history to another device with no account at all. **[as built — half true]** The React app **exports** and does not **import**. A learner can download their history and cannot load it anywhere, so "carry it to another device" is not something the product does today. The vanilla portal at `app/` has both. Import is on the parity list in `docs/07` and is a precondition for deleting that portal.
- **Later, if accounts arrive:** the same rows, same columns, in Postgres. Indexes on `(user_id, reviewed_at desc)`, `(user_id, card_key)`, and a GIN index on `concept_ids`.
- **Retention:** rows are the learner's own record and are not aggregated away. They are deleted when the learner deletes their data, entirely and on request.
- **Privacy:** no analytics, no third party, nothing leaves the device unless the learner signs in or exports. `prompt_shown` and `response` can contain free writing, which is personal data; it stays local by default and this must not change quietly.

---

## What this obliges us to build in step 4, not later

1. The IndexedDB store, the append path, and the transaction that keeps card state and log row consistent.
2. The concept taxonomy, at least for A1–A2, before the first lesson content is authored.
3. `ts-fsrs` replacing our hand-written scheduler, with `State` and `ReviewLog` wired through.
4. A migration for the 22 cards already carrying progress: existing card state is preserved, and their log simply starts now. Their history is genuinely lost — there are only 22 of them and no real learners yet, which is the cheapest moment this will ever happen.

---

## The learner sees their own log — decided

Plain, not clever: what they reviewed, when, how it went, what is due next.
Three reasons, and the first is not the important one.

1. **It is their data.** A free platform that keeps your record from you is not
   free.
2. **It is the data-export requirement.** The same rows that render this screen
   are the export; there is no second implementation and no divergence between
   what is shown and what is downloaded.
3. **It is what makes the weakness model trustworthy.** A learner told "you are
   weak on the subjunctive" will believe it if they can see the twelve reviews
   that produced the claim. Told it with no evidence, they will argue with it —
   and they will be right to.

**It must not become a wall of rows.** The design is summary-first:

```
CETTE SEMAINE          142 révisions · 1 h 18 · 6 jours sur 7
  lun ▮▮▮▮▮▮   mar ▮▮▮   mer ▮▮▮▮▮▮▮▮   jeu —   ven ▮▮▮▮ …

CE QUI A BOUGÉ
  ▲ Passé composé            62 % → 81 %     18 révisions   ▸
  ▼ Subjonctif présent       74 % → 55 %      9 révisions   ▸    ← why we say it
  ● Les nasales              nouveau          4 révisions   ▸

DÛ MAINTENANT   14 cartes · 8 min      ▸ Commencer
```

Each `▸` opens the rows behind that line — the individual reviews, with what
was shown, the grade and the time taken. **Detail is one click away and never
the default view.** A full chronological list exists at the bottom, paginated,
for anyone who wants it. Export is one button on the same screen.
