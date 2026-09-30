# 06 — Step 4: shell, navigation, side panel, search, flashcards

**Status:** for review. Built at `web/`, on the stack settled in step 3.
**Verification:** 73 unit tests, 66 browser checks, 0 failures, 0 console errors.

---

## 1. Interactive-element inventory

Every interactive element, what it does, where it goes. **Nothing here is decoration pretending to be a control.**

### Shell — on every screen

| Element | Does | Goes to |
|---|---|---|
| Skip link | Jumps past the chrome | `#main`. Off-screen until focused |
| Brand (`Fr` + name) | Home | `/learn` |
| Timer pill | Toggles the timer panel; shows time remaining | in place |
| ↳ presets 5/15/30/45/60 | Selects a duration | in place; disabled while running |
| ↳ Start / Pause | Starts or stops; persists per user | in place |
| ↳ Reset | Clears the timer | in place |
| ↳ Chime toggle | Sound on/off, `aria-pressed` | in place |
| ↳ Dismiss (finished) | Clears the finished notice | in place |
| Settings icon | Account, languages, theme, profiles, erase | `/account` |
| Tab: Learn / Practise / Progress / Search | Section | `/learn`, `/practise/review`, `/progress`, `/search` |
| `⌘K` / `Ctrl-K` | Search from anywhere | `/search` |

### Learn (home)

| Element | Does | Goes to |
|---|---|---|
| 5 / 15 / 30 min | Starts a time-boxed session | `/practise/review?minutes=N` |
| **Start studying** | Starts today's session | `/practise/review` |
| Map cell (has content) | That level and skill | `/learn/level/:level/:skill` — **stub, says so** |
| Map cell (locked) | Nothing — it is a `<span>`, not a link, and carries `aria-label` naming why | — |
| Weak point row | Practice **that concept alone** | `/practise/review?concept=<id>` |

### Flashcard session

| Element | Does | Goes to |
|---|---|---|
| **Show answer** / Space / Enter | Reveals | in place |
| Again / Hard / Good / Easy, or keys 1–4 | Grades, **writes a review log row**, advances | `?i=n+1` |
| Concept chip on the back | Opens the side panel on that concept | `?panel=concept:<id>` |
| Session rail | Progress indicator, `role="progressbar"` — not interactive | — |

### Side panel

| Element | Does | Goes to |
|---|---|---|
| Close / Escape / scrim | Closes, returns focus to the opener | removes `?panel=` |
| **Practise this concept** | Practice on that concept alone | `/practise/review?concept=<id>` |

### Search · Progress · Concept · Account

| Element | Does | Goes to |
|---|---|---|
| Search box | Live query, held in the URL | `?q=` |
| Command result (`5 min`, `B1`) | Runs the command | `/practise/review?minutes=5`, `/learn?level=B1` |
| Concept result | The concept page | `/learn/concept/:id` |
| Card result | A session on that one card | `/practise/review?card=<key>` |
| Concept row (Progress) | Discloses the reviews behind the number | in place |
| Practise (Progress row) | That concept alone | `/practise/review?concept=<id>` |
| Export | Downloads the review log as JSON | — |
| Back (Concept) | History back, preserving position | — |
| Profile select / New profile | Switches or creates a profile **in this tab only** | in place |
| Interface / meaning language, theme | Applies immediately, saved per user | in place |
| Erase everything | Two-step; erases this profile only | in place |

### Named as unimplemented, not disguised

`/learn/level/:level/:skill`, `/learn/verbs`, `/practise/exams`, `/practise/listening` render a **stub that says "Not built yet"**, explains what *is* built, and offers two real destinations. **No route renders blank; no icon does nothing; no card looks clickable and isn't.**

---

## 2. The connection map, and the result of walking it

```
      ┌──────────────── ⌘K / Search ────────────────┐
      │  concepts · cards · commands (5 min, B1)    │
      └───┬──────────────┬──────────────┬───────────┘
          ▼              ▼              ▼
   /learn/concept/:id   /practise/review?card=   ?minutes=
          │
          │  practise this concept
          ▼
   ┌─────────────────────────────────────┐
   │  /practise/review                   │◀── weak point row (Learn)
   │  ?concept= ?card= ?minutes= ?s= ?i= │◀── Practise tab
   └──────────┬──────────────────────────┘◀── Progress row
              │ grade (1-4)
              ▼
     ┌──────────────────┐        concept chip
     │  REVIEW LOG ROW  │◀───────────────────────┐
     │  conceptIds[]    │                        │
     └────────┬─────────┘                 ?panel=concept:<id>
              │                                  │
      ┌───────┴────────┐                         ▼
      ▼                ▼                   ┌───────────┐
  /progress       weak points (Learn)      │ SIDE PANEL│
  what moved      ──────────────────────▶  │ record +  │
  detail 1 click  practise that concept    │ practise  │
                                           └───────────┘
```

**Walked it. 66 checks, every link clicked. Result:**

| Contract | Result |
|---|---|
| A concept in a card opens the side panel with the learner's record | ✅ and the panel is in the URL, so it is linkable |
| A wrong answer writes a log row against a concept id | ✅ 6 rows, each with grade, timing, concept ids and scheduler state on both sides |
| That row is visible in Progress and drives weak points | ✅ 6 wrong answers produced 3 weak points on the home screen |
| Weak points link into practice on those concepts | ✅ `?concept=gram.present.irregular`, lands on a real filtered session |
| Search results link into the real thing | ✅ concepts, cards and commands all resolve |
| A timer survives moving between sections | ✅ 4:59 → 4:58 across a section change, still running on return |
| Back returns to the exact place | ✅ including from the side panel into the session |
| Every route renders something | ✅ all 10, including stubs and 404 |

**Dead ends found: none.** Four routes are stubs, and each says so.

---

## 3. Budget, measured

Built, then gzipped exactly what `index.html` references.

| | Measured | Budget | |
|---|---|---|---|
| First-load JS | **118.63 KB** gz | 150 KB | ✅ |
| CSS | **7.59 KB** gz | 30 KB | ✅ |
| Fonts a French page fetches | 90.4 KB (woff2) | — | separate resource, `swap` |
| Content, after first paint | 14.7 KB gz | — | |

Breakdown: react 67.29 · router 26.10 · app 18.77 · scheduler 6.48 · css 6.73.

**Lazy chunks: none.** The scheduler is split into its own file but still statically imported, so it is fetched with the first load. Honest: I said in step 3 it would be lazy and it is not. It is 6.5 KB and we are 31 KB under budget, so it did not need to be — but the claim was wrong and is corrected here.

### ⚠️ LCP misses the budget on a slow connection

| Connection | FCP | LCP | 2.5 s budget |
|---|---|---|---|
| Slow 4G — 400 kbps, 400 ms RTT, 4× CPU | 1 580 ms | **5 288 ms** | ❌ **over** |
| Fast 4G — 9 Mbps, 85 ms, 2× CPU | 236 ms | 708 ms | ✅ |
| Wi-Fi — 30 Mbps, 20 ms | 68 ms | 256 ms | ✅ |

Two things were wrong and are fixed; one remains.

**Fixed:** the first measurement said 13 924 ms because my test server sent everything uncompressed — the browser was pulling ~380 KB of raw JavaScript where any real host sends ~118 KB. Measuring against a gzipping server brought it to 6 768 ms. Then removing the font preload and painting a real first frame in `index.html` brought FCP from 11 216 ms to 1 580 ms.

**Not fixed:** LCP is 5.3 s on Slow 4G, because the largest element only exists once React has mounted and rendered the map. **A client-rendered React app of this size cannot hit 2.5 s at 400 kbps** — 118 KB alone is 2.4 s of pure transfer before a line is parsed. The real fix is to prerender the Learn route to static HTML at build time, which would make LCP ≈ FCP ≈ 1.6 s. That is step-5 work and it is the same mechanism already planned for the landing page.

**My recommendation:** keep the 2.5 s budget and prerender, rather than relax the budget. Students on poor connections are exactly who this is for.

---

## 4. The keyboard walk — what I pressed, what happened

| Pressed | Happened |
|---|---|
| `Tab` from load | Focus landed on the skip link (off-screen until focused, then full size) |
| `Tab` ×2 | Brand, then timer pill — each with a 2 px focus ring, 2 px offset |
| `Space` on a card | Answer revealed |
| `3` | Graded Good, advanced 1/16 → 2/16, review row written |
| `1`–`4` | Again / Hard / Good / Easy, each with its interval shown |
| `Ctrl-K` from `/practise/review` | Navigated to `/search`, input focused |
| `Tab` into the side panel | Focus moved to Close, which is focused on open |
| `Escape` in the side panel | Closed, **focus returned to the concept chip that opened it** |
| `Tab` through the tab bar | All four reachable, active tab marked |

Verified: **40 focusable controls, 0 with `outline: none`.** Focus ring measured at `2px solid`.

---

## 5. Multi-user, proven

Two tabs, one origin, two profiles. The active profile is in **`sessionStorage`**, which is per-tab — `localStorage` is shared, so a profile held there could never be two learners at once.

| Check | Result |
|---|---|
| Two tabs hold different profiles | ✅ |
| Tab A studied 3 cards → 3 rows under its own id | ✅ |
| Tab B has 0 rows | ✅ |
| Tab B's Progress shows its own empty state | ✅ |
| Tab A's Progress shows its own 6 concepts | ✅ |
| Every per-learner key namespaced `flw:u:<id>:*` | ✅ |
| No learner data outside a namespace | ✅ 0 stray keys |
| The two profiles' settings are separate keys with different values | ✅ dark vs light |

**No module-level mutable state holding learner data.** Every storage key goes through `userKey(userId, name)`, which throws without a user id. Every database call takes a `userId` and throws without one. IndexedDB uses `[userId, cardKey]` as the primary key and `[userId, …]` on every index.

**Stated plainly:** `localStorage` and IndexedDB are shared per origin, so a person with devtools on a shared laptop **can** read another profile's rows. No browser API prevents that without a backend. Isolation here is the application never *constructing* a key outside its own namespace, which the walk verifies. Real isolation between people needs accounts and a server, and that is not what has been built.

---

## 6. Things I know are wrong or unfinished

1. **LCP is 5.3 s on Slow 4G** — over the 2.5 s budget. Cause understood, fix identified (prerender), not done. §3.
2. **The scheduler chunk is not lazy**, though step 3 said it would be. 6.5 KB, inside budget, but the claim was wrong.
3. **Four routes are stubs** — level/skill pages, verbs, exams, listening. They say so; they are not disguised.
4. **The map is mostly empty and honestly so.** Only A1 grammar/vocabulary/phonetics have cards, because 22 cards exist. CO/CE/PE/PO are locked at every level because no listening, reading, writing or speaking content exists at all.
5. **`/learn?level=B1`** is produced by the search command but the Learn route ignores the parameter. The link works, the filter does nothing. A loose end, found while writing this inventory.
6. **No service worker in the React app yet.** The vanilla portal has one; this does not, so offline is not yet true here. The offline *state* is designed but untested.
7. **No `prefers-reduced-motion` test.** The CSS honours it; I did not verify it in the walk.
8. **The vanilla portal still exists at `app/`.** Two apps in one repository until the React one reaches parity. Deliberate — it is the working version — but it must not be forgotten.
9. **Concept coverage is A1–B2 only.** C1 and C2 have no concepts at all, so those rows can never light up.
10. **The 22 cards exercise 29 of 224 concepts.** The weakness model works but sees a thin slice of French.

---

## 7. What step 5 should take from this

The pattern flashcards established, and which every other section follows:

1. A route with its state in the URL, including a session id, so any view is pasteable.
2. Content loaded once and shared; learner data always through a `userId`.
3. Every graded interaction writes a `ReviewRow` with `conceptIds` — that is what makes Progress and weak points work without a new table.
4. Four honest states per screen, the empty one teaching rather than showing a zero.
5. A concept chip anywhere opens the side panel; the panel always offers practice on that concept alone.
