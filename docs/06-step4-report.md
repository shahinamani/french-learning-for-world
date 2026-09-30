# 06 — Step 4: shell, navigation, side panel, search, flashcards

**Status:** step 4 report, kept as the record of that step. Built at `web/`.
**Verification at the time:** 73 unit tests, 66 browser checks, 0 failures, 0 console errors.
**Swept against the build 2026-09-30:** now **82 unit tests, 94 browser checks**, 0 failures, 0 console errors. Numbers that moved are corrected in place and marked **[step 5]**; §6 records where each known defect ended up.

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
| First-load JS | **118.63 KB** gz → **[step 5] 116.47 KiB** (119 261 B) | 150 KB | ✅ |
| CSS | **7.59 KB** gz → **[step 5] 6.86 KiB** (7 024 B) | 30 KB | ✅ |
| Fonts a French page fetches | 90.4 KiB (woff2) | — | separate resource, ~~`swap`~~ **[step 5] `optional`** |
| Content, after first paint | 14.7 KB gz | — | |

Breakdown: react 67.29 · router 26.10 · app 18.77 · scheduler 6.48 · css 6.73.
**[step 5]** re-measured `gzip -9`: react 67.28 · router 26.04 · app 23.15 · css 6.86, plus `scheduler` 7.11 **not** in the first load.

~~**Lazy chunks: none.**~~ **[step 5] The scheduler is now genuinely lazy.** It is loaded through `loadScheduler()`, `dist/index.html` does not reference it, and it does not arrive until a card is graded. 7 283 bytes = 7.11 KiB. The step-3 claim was wrong when this report was written, was reported as wrong here rather than quietly fixed, and is now true.

### ⚠️ LCP misses the budget on a slow connection — **[step 5] fixed, 1 648 ms**

| Connection | FCP | LCP | 2.5 s budget |
|---|---|---|---|
| Slow 4G — 400 kbps, 400 ms RTT, 4× CPU | 1 580 ms | **5 288 ms** | ❌ **over** |
| **[step 5]** Slow 4G, after prerendering the home route | **1 648 ms** | **1 648 ms** | ✅ FCP = LCP, one candidate |
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

**[step 5] Each item below is marked with where it ended up. Nothing here was deleted to make the list shorter.**

1. ~~**LCP is 5.3 s on Slow 4G**~~ — **RESOLVED.** Prerendering the home route brought it to **1 648 ms**, with FCP = LCP. The budget was held, not moved.
2. ~~**The scheduler chunk is not lazy**~~ — **RESOLVED.** It is a real lazy chunk now; `index.html` does not reference it.
3. **Four routes are stubs** — **now three.** `/learn/verbs` is built (14 verbs, every tense, a drill that writes review rows). `/learn/level/:level/:skill`, `/practise/exams` and `/practise/listening` remain stubs and each says what is missing and why.
4. **The map is mostly empty and honestly so.** Only A1 grammar/vocabulary/phonetics have cards, because 22 cards exist. CO/CE/PE/PO are locked at every level because no listening, reading, writing or speaking content exists at all.
5. ~~**`/learn?level=B1`** ignored by the Learn route~~ — **RESOLVED.** The parameter filters the map to that level and shows a labelled control to clear it.
6. ~~**No service worker in the React app**~~ — **RESOLVED.** Generated after the build from the real hashed filenames; 18 files precached; offline renders 396 characters of the app, checked with the network cut.
7. ~~**No `prefers-reduced-motion` test**~~ — **RESOLVED, and the first version of the test was wrong.** It matched the computed duration as a *string* against `/^0\.0001s|0s/`, and the browser computes `0.01ms` as `0.00001s`, which that pattern never matches — so the check failed while the CSS was correct. It now parses durations to milliseconds and has a control arm: with the preference off, 4 of 188 elements animate; with it on, 0 do. Removing the CSS makes it fail, which was checked.
8. **The vanilla portal still exists at `app/`.** Two apps in one repository until the React one reaches parity. Deliberate — it is the working version — but it must not be forgotten.
9. **Concept coverage is A1–B2 only.** C1 and C2 have no concepts at all, so those rows can never light up.
10. **The 22 cards exercise 29 of 224 concepts.** The weakness model works but sees a thin slice of French. **[step 5]** unchanged — the verbs section adds 504 forms against tense concepts, but the card deck is still 22.
11. **[step 5, new]** **No shadcn/ui and no Radix**, though docs 01, 04 and 05 all named them as the stack. The components are hand-written. See `docs/05` for what that costs.
12. **[step 5, new]** **Neither the browser walk nor the contrast check runs in CI.** Playwright is not a project dependency, so both suites are run by hand. A change that breaks either will merge green.
13. **[step 5, new]** **`params_hash` is missing from the review row**, though `docs/03` specifies it. If the FSRS weights are ever refit, earlier rows become uninterpretable.

---

## 7. What step 5 should take from this

The pattern flashcards established, and which every other section follows:

1. A route with its state in the URL, including a session id, so any view is pasteable.
2. Content loaded once and shared; learner data always through a `userId`.
3. Every graded interaction writes a `ReviewRow` with `conceptIds` — that is what makes Progress and weak points work without a new table.
4. Four honest states per screen, the empty one teaching rather than showing a zero.
5. A concept chip anywhere opens the side panel; the panel always offers practice on that concept alone.
