# 04 — Information architecture: sitemap and navigation

**Status:** step 2 deliverable, for review. No application code written.
**Direction:** approved — level × skill map as home, one pinned session card above it, command-palette search.

---

## The one thing this has to get right

> A student opens this and can find anything they want to learn in French — by level, by skill, by topic, by grammar point, by verb, by situation, by how much time they have right now.

Six access paths to the same content. The failure mode is building six separate sections that each hold a *copy* of the taxonomy. So the rule below governs everything that follows:

**Content is stored once and indexed six ways.** A lesson on *le passé composé* is one record. It appears under B1, under Grammar, under the verb `avoir`, in a search for "past tense", in the weak-points panel, and in a 5-minute session — because each of those is a *filter over one index*, not a separate tree. The command palette and the level map are two views of the same query.

---

## Sitemap

```
/                                   Landing (signed out) — what this is, in five seconds
│
├── /learn                          ◆ HOME — the level × skill map
│   │                                 pinned above it: today's session card
│   │
│   ├── /learn/[level]              A1 · A2 · B1 · B2 · C1 · C2
│   │   └── /learn/[level]/[skill]  listening · reading · writing · speaking
│   │                               grammar · vocabulary · pronunciation
│   │       └── …/[lesson]          a single lesson
│   │
│   ├── /learn/grammar              Grammar reference
│   │   ├── ?topic=                   by topic (tenses, agreement, pronouns, …)
│   │   ├── ?level=                   by difficulty
│   │   └── /learn/grammar/[point]  one point: rule, examples, exercises,
│   │                               "your record on this" (from the review log)
│   │
│   ├── /learn/verbs                Conjugation tool
│   │   └── /learn/verbs/[verb]     every tense, audio, practise this verb
│   │
│   ├── /learn/vocabulary           By theme
│   │   ├── /learn/vocabulary/[theme]   travel · work · food · health ·
│   │   │                               admin & paperwork · relationships ·
│   │   │                               news · housing · money · study
│   │   └── /learn/vocabulary/mine      ◆ words I'm learning
│   │
│   └── /learn/pronunciation        Phonetics
│       └── /learn/pronunciation/[feature]
│              nasal vowels · liaison · the French R · [y] vs [u] ·
│              e muet · open/closed e — the ones that break English speakers
│
├── /practise                       ◆ everything that grades you
│   ├── /practise/review            SRS session — the default, "what's due"
│   ├── /practise/session?min=5|15|30   the daily practice, time-boxed
│   ├── /practise/quiz              quizzes with explanatory feedback
│   ├── /practise/listening         audio, adjustable speed
│   ├── /practise/dialogues         role-play scenarios
│   ├── /practise/writing           writing practice with correction
│   └── /practise/exams             ◆ mock exams
│       └── /practise/exams/[exam]  DELF · DALF · TCF · TEF
│           └── …/[paper]           by skill: CO · CE · PE · PO
│
├── /progress                       ◆ every screen here is a query over the review log
│   ├── /progress                   where am I, honestly
│   ├── /progress/weak              what the system detected, and the fix
│   ├── /progress/history           what I did, and what's due
│   └── /progress/goals             goals I set myself
│
├── /discover
│   ├── /search?q=                  ◆ one box, everything
│   ├── /discover/read              something to read, graded
│   ├── /discover/watch             something to watch, graded
│   ├── /discover/bookmarks         saved
│   └── /discover/notes             my notes
│
├── /account
│   ├── /account/profile
│   ├── /account/language           interface language — EN · FR (+ FA · AR, already built)
│   ├── /account/accessibility      motion, contrast, text size, audio speed default
│   ├── /account/appearance         light · dark · system
│   └── /account/data               export · import · delete everything
│
└── /about                          independence notice, how it works, contact
```

◆ marks a screen with a genuinely new interaction, not a list.

---

## Navigation

### Mobile (320–767 px) — the primary design

```
┌────────────────────────────────┐
│ ▓▓▓▓▓▓▓░░░░░░░   session rail  │  3px, fills as you review
├────────────────────────────────┤
│  Fr        [⏱ 12:40]    [⌘] [⚙]│  bar: timer pill · search · settings
├────────────────────────────────┤
│                                │
│   ┌──────────────────────────┐ │
│   │ AUJOURD'HUI              │ │  ← pinned session card, always first
│   │ 14 cartes · 8 min        │ │
│   │ [ 5 min ][ 15 ][ 30 ]    │ │
│   │ ▸ Commencer              │ │
│   └──────────────────────────┘ │
│                                │
│   VOTRE NIVEAU  ·  A2          │
│   ┌────┬────┬────┬────┬────┐   │  ← the map, level-major on mobile
│   │ 🎧 │ 📖 │ ✍️ │ 🗣 │ ⚙︎ │   │     one row per level, scroll down
│   │ 78%│ 64%│ 30%│ 12%│ 55%│   │     tap a cell → that skill at that level
│   └────┴────┴────┴────┴────┘   │
│   A1 ✓   A2 ●   B1 ○   B2 ○    │
│                                │
│   À TRAVAILLER                 │  ← weak points, from the review log
│   · Passé composé avec être    │
│   · Les nasales [ɑ̃] / [ɔ̃]      │
│                                │
├────────────────────────────────┤
│  📚      ✏️      📊      🔍     │  ← 4 tabs, not 5
│ Apprendre Pratiquer Progrès Chercher│
└────────────────────────────────┘
```

**Four tabs, not five.** *About* and *Account* live behind the ⚙ in the bar — they are visited once, and a fifth tab at 320 px costs every other tab its label. The current portal has five and the labels already shrink to 0.6 rem; that is a warning, not a precedent.

**The map on a phone** is level-major: a row per CEFR level, a cell per skill, percentage in the cell. It scrolls vertically. This is the compromise that keeps "breadth visible" true on a 320 px screen — you see six rows × seven columns of *where you are*, without a desktop grid squeezed into a phone.

### Desktop (1024 px+)

```
┌──────────────────────────────────────────────────────────────────┐
│  Fr  French Learning        [ ⌘K  Chercher… ]      [⏱] [⚙] [FR]  │
├───────────────┬──────────────────────────────────┬───────────────┤
│ APPRENDRE     │  AUJOURD'HUI                     │  À TRAVAILLER │
│  Parcours     │  ┌────────────────────────────┐  │  Passé comp.  │
│  Grammaire    │  │ 14 cartes · 8 min          │  │  avec être    │
│  Verbes       │  │ [5][15][30]  ▸ Commencer   │  │  ▸ 4 min      │
│  Vocabulaire  │  └────────────────────────────┘  │               │
│  Prononciation│                                  │  Nasales      │
│               │  A1 ✓✓✓✓✓✓✓                      │  ▸ 6 min      │
│ PRATIQUER     │  A2 ●●●●○○○   ← the map, full    │               │
│  Révision     │  B1 ○○○○○○○      width, skills   │  DÛ AUJOURD'HUI│
│  Quiz         │  B2 ○○○○○○○      across          │  14 cartes    │
│  Écoute       │  C1 ○○○○○○○                      │  3 leçons     │
│  Dialogues    │  C2 ○○○○○○○                      │               │
│  Écrit        │      CO CE PE PO Gr Voc Phon     │  SÉRIE        │
│  Examens      │                                  │  ▮▮▮▮▮▯▯ 5 j  │
│               │                                  │               │
│ PROGRÈS       │                                  │               │
│ DÉCOUVRIR     │                                  │               │
└───────────────┴──────────────────────────────────┴───────────────┘
```

Three columns at ≥1280 px, two at 1024–1279 px (right rail folds under the map), one at <1024 px (the mobile stack). The left rail is the full taxonomy — this is where "density with clarity" lives, and it is why the mobile tab bar can be only four items.

### The command palette — `⌘K` / `Ctrl K`, and a visible button

One index, six result types, grouped and labelled:

```
┌──────────────────────────────────────────────┐
│ 🔍  passé comp                               │
├──────────────────────────────────────────────┤
│ GRAMMAIRE                                    │
│   Le passé composé avec avoir          B1 ●  │
│   Le passé composé avec être           B1 ○  │
│   Accord du participe passé            B2 ○  │
│ VERBES                                       │
│   avoir — passé composé                      │
│ LEÇONS                                       │
│   Raconter son week-end          A2 · 8 min  │
│ EXERCICES                                    │
│   Cloze : passé composé          12 phrases  │
│ MES MOTS                                     │
│   composer                          en cours │
├──────────────────────────────────────────────┤
│ ↑↓ naviguer   ⏎ ouvrir   esc fermer          │
└──────────────────────────────────────────────┘
```

It also takes commands, not only queries: `5 min` starts a five-minute session, `A2 écoute` jumps to that cell, `conjuguer aller` opens the verb. On mobile it is the fourth tab, full screen, keyboard up on open.

**Filters** that work on every listing: level (A1–C2), skill, topic, length (<5 / 5–15 / >15 min), difficulty, status (not started / in progress / due / known). They are URL state — `/learn/grammar?level=B1&topic=temps&status=due` — so a filtered view is shareable and the back button behaves.

---

## The honest states, per screen type

The brief rejects zeros. Every screen has four states designed, not three plus a spinner.

| | Loading | **Empty** | Error | Offline |
|---|---|---|---|---|
| **Session card** | skeleton of the card, same height, no layout shift | **"Rien n'est dû. Commencez par 5 minutes."** with a start button — never "0 cartes" | "Impossible de charger votre session" + Réessayer | "Hors ligne — 14 cartes prêtes", works from cache |
| **Level map** | skeleton grid, real row/column labels already visible | new student: A1 lit, everything above dimmed with **"Commencez ici"**, plus a placement-test link | keeps the last known map, banner above | full map from cache, progress marked "à synchroniser" |
| **Weak points** | two skeleton rows | **"Pas encore assez de données. Après une vingtaine de révisions, vos points faibles apparaîtront ici."** — explains *when* it will fill | inline, section-scoped, rest of page fine | last computed, timestamped |
| **Search** | debounced, no spinner under 300 ms | **"Rien pour « xyz ». Essayez : passé composé, nasales, voyager."** — real suggestions | "Recherche indisponible" + browse links | searches the cached index, says so |
| **Any list** | 3–5 skeleton rows | what the section is for + one action | retry, scoped | cached, badged |

**The first-run dashboard is a teaching screen, not an empty one.** A new student sees: a 5-minute first session already chosen for them, A1 open with everything above visibly locked, a one-line explanation of what the map is, and an optional placement test. No zeros anywhere.

---

## Accessibility, designed in rather than audited later

- **Landmarks:** one `<header>`, one `<nav aria-label="Principal">`, one `<main>`, one `<footer>`. The tab bar is `<nav>`, not a list of buttons.
- **Keyboard:** every action reachable by Tab. Skip link first. `⌘K` from anywhere. The palette is a focus trap that returns focus to the opener. Rating a card: `1`–`4`, and Space to reveal.
- **Focus:** visible on every control, 2 px, ≥3:1 against its background. Never `outline: none`.
- **The map is a `<table>`** with `<th scope>` on levels and skills, because that is what it is. A screen reader then announces "B1, écoute, 64 %" — a grid of divs announces nothing.
- **Contrast:** WCAG AA — 4.5:1 body, 3:1 large text and UI boundaries, in **both** themes. Measured, not assumed.
- **Motion:** `prefers-reduced-motion` removes transitions; the session rail jumps rather than slides.
- **Audio:** never the only channel. Every listening exercise has a transcript, revealed after the attempt.
- **Text:** the layout survives 200 % zoom and `font-size` overrides; no fixed heights on text containers.
- **Language:** `lang` on every element whose language differs from the page — the French sentence inside an English interface is `lang="fr"`, and this is what makes a screen reader pronounce it as French rather than as English nonsense.

---

## French typography — the rules we implement

Getting these wrong is the detail that tells a French speaker the product was not made by anyone who reads French.

| Rule | Character | Example |
|---|---|---|
| Narrow no-break space **before** `;` `!` `?` | `U+202F` | `Vraiment ?` |
| No-break space **before** `:` | `U+00A0` | `Attention : …` |
| No-break space **inside** guillemets | `U+00A0` / `U+202F` | `« exemple »` |
| **No** space before `.` `,` | — | `Voilà.` |
| No-break space in numbers and units | `U+00A0` | `1 240 mots`, `8 min` |
| Apostrophe is typographic, not a prime | `U+2019` | `l’élève`, never `l'élève` |
| Capitals keep their accents | — | `ÉCOUTE`, never `ECOUTE` |
| `Œ` / `œ` is a letter | `U+0153` | `cœur`, `sœur` |

Implemented as one `frenchText()` formatter applied to every French string at render, with unit tests — **not** as a convention for authors to remember. Note `U+202F` is not in every font: the fallback stack must include a face that has it, or it renders as a box.

**An accent bar** for learners without a French keyboard — `é è ê ë à â ç î ï ô û ù œ æ « »` — on every writing input. Borrowed from LibreLingo's per-course "special characters" list, which exists for exactly this reason.

---

## Two things this IA depends on that do not exist yet

1. **The concept taxonomy** (`docs/03-review-log.md`). `/progress/weak`, the "your record on this" panel on every grammar point, and the palette's cross-type results all join on `concept_ids`. Until the taxonomy is drafted, those three are wireframes with no data behind them. It is on the critical path and it is content work, not code.
2. **Content at every level.** The map will honestly show A1 partly filled and A2–C2 empty, because that is true. The empty states above are designed to say so rather than hide it.

---

## ⚠️ The framework decision needs revisiting — with the numbers you asked for

You said: *say so now with numbers rather than discovering it in step 4.* I built and measured, rather than estimating.

**Method:** minimal App Router page, `next build` with `output: 'export'`, gzip -9 over exactly the scripts `index.html` references. Same for Vite. Both deleted afterwards.

| Stack | First-load JS (gzipped) | Verdict against the 150 KB budget |
|---|---|---|
| **Next.js 16.3.7 App Router**, client page | **168.6 KB** | ✗ over before a line of ours |
| **Next.js 16.3.7 App Router**, server component page | **168.3 KB** | ✗ — server components do **not** reduce the client baseline |
| **Vite 7 + React 19 + react-router 7** | **79.2 KB** | ✓ leaves ~70 KB for our code |
| Current vanilla portal | 23.3 KB JS + 4.8 KB CSS | — |

**Next.js costs 89 KB more than Vite for identical output**, and the App Router's own runtime is the reason. Adding Radix (~20 KB for the primitives the home screen needs), `ts-fsrs` (~10 KB) and our application code (~25 KB) puts Next.js at roughly **225 KB** and Vite at roughly **135 KB**.

**Recommendation: keep every reason you gave, drop only Next.js.** Use **Vite + React + TypeScript + Tailwind + shadcn/ui**. shadcn's components are React + Radix + Tailwind and its CLI supports Vite directly — so you still get MIT components copied into the repo that you own and can change, Radix's keyboard and screen-reader behaviour, and Tailwind making the token rule enforceable. None of your three reasons was a Next.js reason.

**What dropping Next.js actually costs us:**

- **Server rendering** — worth nothing here. The app is anonymous-first with no backend and no per-request data; there is nothing to render on a server.
- **File-based routing** — react-router or TanStack Router gives the same thing.
- **Image optimisation** — we have an icon.
- **SEO on the landing page** — this one is real. A client-rendered landing page ranks badly. Fix: prerender the landing page to static HTML at build time (Vite supports this), which is better than SSR for a page that is identical for everyone.

**If you want Next.js anyway** — a legitimate choice for the ecosystem and for the day a backend arrives — then the budget must rise to **250 KB gzipped** for shell + home, and I will hold that instead. What I will not do is keep both the framework and a 150 KB budget and quietly miss it.

---

## Settled

| | |
|---|---|
| **Framework** | Vite + React + TypeScript + Tailwind + shadcn/ui. Budget stays **150 KB** gzipped, measured at every step. Landing page prerendered to static HTML for SEO. |
| **Content licence** | CC BY-SA 4.0, knowingly and permanently — `docs/02` |
| **Mobile navigation** | **Four tabs.** *About* in settings |
| **Review log** | **The learner sees it**, summary-first with detail one click away, and it doubles as the data export — `docs/03` |

`/progress/history` is therefore the learner-facing view of the review log, and
`/account/data` exports the same rows rather than a separate format.
