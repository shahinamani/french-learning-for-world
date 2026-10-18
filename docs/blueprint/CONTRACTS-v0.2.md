# Shared contracts — blueprint v0.2

§20 requires a shared component, data and progress contract **before** any
stream expands, and forbids two workers racing on one file. This is that
contract. It is written once, by the coordinator, and changed only by a note
here plus a message to the owners of the affected streams.

---

## 1. Routes and navigation (§5)

All learner routes live under `/app/`. Hash routing stays (static hosting, no
rewrite server), so the address is `#/app/today`.

```
/                     landing (public, prerendered)
/app/today            امروز من            home icon
/app/path             مسیر من             path icon
/app/vocabulary       واژگان              word-tag icon        ┐
/app/cards            فلش‌کارت            stacked-cards icon   │ group:
/app/verbs            فعل و زمان‌ها       book+clock icon      │ یادگیری آزاد
/app/grammar          گرامر               open-book icon       │ (collapsible,
/app/listening        شنیدن               headphones icon      │  remembers
/app/reading          خواندن              text-page icon       │  last state)
/app/output           گفتن و نوشتن        mic+pen icon         ┘
/app/news             خبرها               newspaper icon       ┐ کشف محتوا
/app/podcasts         پادکست‌ها           sound-wave icon      ┘
/app/exams            آزمون‌ها            exam-sheet icon
/app/saved            کتابخانهٔ من        bookmark icon
/app/progress         پیشرفت و ضعف‌ها     chart icon
```

Sidebar bottom (not a group): account · appearance & language · help · exit.
Top of every page: global search ("چه چیزی می‌خواهی یاد بگیری؟"), breadcrumb,
and exit.

**Mobile** (§5): bottom bar is exactly five — امروز · یادگیری · مرور ·
ذخیره‌ها · بیشتر. Search sits at the top of the learning page. Filters open as
a bottom sheet and the active selection stays visible on the page.

**Every icon carries a visible or accessible name.** §16 and the appendix both
require it; an icon row without names is a named rejection reason in §21.

### Redirects — old paths must not 404

| Old | New |
|:--|:--|
| `/learn` | `/app/today` |
| `/learn/verbs` | `/app/verbs` |
| `/learn/verbs/:infinitive` | `/app/verbs/:infinitive` |
| `/learn/concept/:id` | `/app/grammar/:id` |
| `/practise/review` | `/app/cards` |
| `/practise/conjugation` | `/app/verbs/drill` — **amended, see below** |
| `/practise/exams/*` | `/app/exams/*` |
| `/practise/listening` | `/app/listening` |
| `/progress` | `/app/progress` |
| `/workspace` | `/app/workspace` — **amended, see below** |
| `/search` | `/app/search` |
| `/learn/level/:level/:skill` | `/app/path/:level/:skill` — **added, was missing** |

### Amendment 1 — three corrections to the table above

Raised by the stream that implemented it, accepted by the coordinator. In each
case the contract was wrong or incomplete and the code is right; recording it
here rather than making working code match a mistake.

1. **`/practise/conjugation` → `/app/verbs/drill`.** The contract said
   `/app/verbs/:infinitive` with a drill tab. No such tab exists, and the drill
   page takes `?verb=` rather than a path parameter, so the contract's target
   would have dropped the learner on a verb page with their drill lost. When
   the verbs stream adds a real drill tab it may retarget this.
2. **`/workspace` → `/app/workspace`.** The contract said `/app/today`. But
   Today *is* the existing Learn page, and Learn carries a button to the
   workspace — so the contract's target would have made that button a
   self-loop, which is a dead control and a §21 rejection reason.
3. **`/learn/level/:level/:skill` was missing from the table entirely.** It is
   a real route with real links pointing at it, and leaving it out would have
   produced exactly the 404 the redirect section exists to prevent.

The general rule this establishes: **a stream that finds the contract wrong
says so and implements the correct thing, and the coordinator amends the
contract.** A contract that is silently worked around stops being one.

Appendix §1: direct link, refresh and open-in-new-tab must all preserve the
path. A redirect is `replace`, never a push, so Back does not loop.

---

## 2. Content model (§18)

One shape for every learnable thing. `id` is permanent and public.

```ts
type ContentId = string;            // stable, never reissued

type ContentItem = {
  id: ContentId;
  type: 'card' | 'verb' | 'grammar' | 'text' | 'news' | 'audio'
      | 'podcast' | 'exercise' | 'exam' | 'scenario';
  level: Level | null;              // null = nobody has said. NOT "A1".
  levelBasis: 'corpus-frequency' | 'author' | 'source' | null;
  topics: string[];                 // lex.* / usage.* ids
  goals: ('general'|'daily'|'work'|'study'|'exam')[];
  skill: ('reading'|'listening'|'speaking'|'writing'|'vocab'|'grammar')[];
  version: string;                  // content version, bumped on edit
  title: Partial<Record<Locale, string>>;
  body?: Partial<Record<Locale, string>>;
  media?: { audio?: MediaRef; image?: MediaRef };
  source: SourceRef;                // REQUIRED. see §3 below
  review: { owner: null | ReviewRecord; teacher: null | ReviewRecord };
  relations: { words: ContentId[]; verbs: ContentId[]; grammar: ContentId[] };
  next?: ContentId[];               // "next purpose"
};

type SourceRef = {
  kind: 'original' | 'external';
  name: string;
  url?: string;
  licence: string;                  // e.g. 'CC BY-SA 4.0'
  rightOfUse: 'own' | 'embed-permitted' | 'link-only';
  readAt: string;                   // ISO date the source was checked
};
```

Three rules that are not negotiable, each from the blueprint:

1. **`review.teacher = null` until a teacher has actually read it.** Nothing
   in the pipeline may set it. (§18, §21 کیفیت محتوا)
2. **`rightOfUse: 'link-only'` content is never embedded** — it gets an intro
   card and an external link, and it does not count as Reader content. (§11)
3. **A meaning in context is not a dictionary sense.** Context meanings are
   stored on the occurrence, not written back into the word entry. (§18)

`level: null` renders as "سطح مشخص نشده", never as a guess. This is the
project's standing `null ≠ value` rule.

---

## 3. Progress and personal model (§18, §19)

Everything personal is keyed by `userId` first — the existing rule in
`web/src/lib/db.ts`. Nothing here replaces FSRS or rewrites existing rows.

```ts
type ReviewEvent   = existing ReviewRow;        // UNCHANGED. do not alter.
type CardState     = existing CardState;        // UNCHANGED.

type SavedItem = {
  userId: string; itemId: ContentId; savedAt: number;
  // The source sentence travels with the word — journey J1 ends with
  // "phrase + source sentence + review history" and this is where it lives.
  context?: { sentence: string; fromId: ContentId };
};

type ReadingPosition  = { userId: string; itemId: ContentId;
                          paragraph: number; updatedAt: number };
type PlaybackPosition = { userId: string; itemId: ContentId;
                          seconds: number; updatedAt: number };
type Note = { userId: string; itemId: ContentId; text: string; updatedAt: number };
```

**Idempotence (§18).** `save(itemId)` twice must leave one row. Key every
store by `[userId, itemId]` so a double press is an overwrite, not an insert.
This is a test, not a convention: `tests/save-idempotent.test.js`.

**Two buttons vs four grades.** Already settled and must not be re-collapsed:
the card surface writes Easy/Again, the four-grade session writes all four,
both through `appendReview` under the same key, and the mapping is stated on
screen.

---

## 4. Component contract (§16)

Every component below ships all five states — `loading`, `error`, `offline`,
`empty`, `finished` — each with a clear next action. A state with no way
forward is a named rejection reason.

| Component | Owns | Must do |
|:--|:--|:--|
| `PortalShell` | S1 | header, grouped sidebar, mobile bar, breadcrumb, RTL, theme |
| `ContentCard` | S1 | image, title, type, level, duration, has-audio/text/translation, status, source if external, **two** actions (شروع / ذخیره) with no click conflict; **no autoplay** |
| `FilterBar` | S1 | active chips, result count, remove-one, state kept on return, bottom sheet on mobile |
| `Reader` | S2 | word selection → meaning panel → translation → audio → position kept |
| `AudioPlayer` | S2 | play/pause, ±seek, speed, accessible time bar, repeat sentence, text, error, buffering; one player, starting a new file stops the previous |
| `Flashcard` | S2 | front/back, examples, ratings, **undo**, audio, session end |
| `Exercise` | S2 | question, input, check, explanatory answer, retry, continue |
| `WeaknessCard` | S2 | the reason for the suggestion and a link to the practice; **no mastery %** |
| `Modal/Sheet` | S1 | focus trap, focus return, Escape, accessible title and close |
| `StateMessage` | S1 | the five states above |

### Design tokens (§16) — exact values from the blueprint

```
--bp-canvas:    #F7F8FC    page background
--bp-surface:   #FFFFFF    cards and sheets
--bp-ink:       #17233B    text
--bp-primary:   #2457C5    primary action
--bp-accent:    #087F8C    complement
--bp-emphasis:  #D4A34A    limited emphasis only
```

Rules: each theme gets its own measured tokens; **changing theme must not
change a button's colour role**; error and success colours are independent of
the preferred palette. Latin base 16–18px, line width 60–75 Latin characters,
line spacing user-adjustable. Contrast is measured by
`design-system/contrast-check.mjs` against rendered pixels, not asserted.

The existing indigo `--color-accent: #38407f` and the gold added for the
workspace stay until S1 maps them onto the blueprint palette in one commit —
piecemeal colour changes across streams are how a palette stops being a
palette.

### Motion (§6, §16)

Landing 600–900 ms, staged entry, no scroll hijacking, no autoplay audio, no
blocking intro. Portal animation is *less* than the landing. `reduced motion`
removes movement while keeping information and function.

---

## 5. How streams integrate

- One branch per stream, always from `main`, never stacked (AGENTS.md §5).
- A stream may not edit a file it does not own (§A of the checklist). If it
  needs one, it asks the owner; it does not reach in.
- No simultaneous change to a shared build or data file without coordination
  (Appendix §2, explicit prohibition).
- Every PR runs the full suite plus the journeys it touches. "All tests
  passed" repeated without a named run is not progress (§20).
