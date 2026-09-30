# 01 — Research: what already exists, and what we should build

**For:** Shahin Amani · **Status:** for review, before any application code
**Date:** 2026-09-30

---

## 0. Method — and what I could not verify

The brief says *evidence, not claims*, so this section is first.

**What I verified first-hand:**

| Source | How |
|---|---|
| `open-spaced-repetition/ts-fsrs` | Cloned and read. **MIT.** Read `packages/fsrs/src/models.ts` and the public exports. |
| `LibreLingo/LibreLingo` | Cloned and read. **AGPL-3.0.** See the licence note below. |

> ### Licence note — read before reusing anything in this document
>
> **LibreLingo is AGPL-3.0.** Its *structure and ideas* informed this document
> and may inform ours: a schema is not a copyrightable work, and "put the
> licence inside the content file" is a design decision, not code.
> **No LibreLingo code has been copied into this project, and none may be.**
> AGPL-3.0 is a strong copyleft: copying its source would oblige us to release
> this entire platform — including any server we ever run — under AGPL-3.0.
> If anyone later finds a line here that looks like LibreLingo's, it arrived by
> coincidence or by mistake, and it must be removed rather than justified.
>
> **ts-fsrs is MIT.** Its code *may* be used, with the copyright notice
> retained. This is the one library in this document we may copy from.
>
> Both clones were read and then deleted; neither is vendored here.
| Product comparisons, dashboard UX, UI libraries, French typography | Web search, sources listed at the end. |

**What I could not do, and you should know it:** this container's network policy **blocks direct access to every product site named in the brief** — `duolingo.com`, `busuu.com`, `khanacademy.org`, `linear.app`, `ui.shadcn.com`, `tatoeba.org`, `kwiziq.com` all return **403 at the egress proxy**. I could not sign up, click through a real lesson, or tab through their interfaces. Product findings below come from search results plus prior knowledge — **they are not the result of me using these products today.** Where a claim rests only on that, I have marked it *(indirect)*.

If you want first-hand walkthroughs, widen **Network access** in the cloud environment menu (title bar → Edit) and I will redo Part 1 properly.

**Housekeeping the brief asked me to check:**

- Git identity checked and correct: commits are authored as Shahin Amani, so they count on his contribution graph. (The address itself is deliberately not repeated in this file — it is already in commit metadata, where it has to be; printing it in a document scrapers read is an extra exposure that buys nothing.)
- **The storage-hygiene skill named in the brief is not installed in this session.** I found no such skill. I will not prune, delete or release any resource, and I have created nothing outside this repository except two read-only clones under `/home/user/` for the research above. Tell me if that skill should be available and I will flag it rather than guess at its rules.
- **Branching conflict, needs your word.** The brief says work lands on `main`. My standing instruction for this session is to develop on `claude/confident-johnson-xu1f22` and never push elsewhere without explicit permission. Also relevant: `main` still carries the very first commit with a tool-attribution trailer, while the feature branch's history is now clean. See §5.

---

## Part 1 — Twelve products, one paragraph each

### French-specific

**Kwiziq / Progress with Lawless French.** The most intelligent thing in the category and the closest to what this brief describes. Regular micro-quizzes build what it calls a *brainmap*: the system infers which grammar concepts you have mis-learned and which you are merely unsure of, then serves the specific material that repairs each. Learners report the tests pinpoint errors accurately and the explanations are succinct *(indirect)*. **What it gets right:** diagnosis before prescription — it tells you *what is wrong with your French*, not just *how many points you scored*. **What it gets wrong:** it is paid, the interface is dated and text-dense in an unwelcoming way, and it is grammar-first to the exclusion of listening and speaking. **Steal:** the weakness model. It is exactly the brief's "weak points the system has detected, and what to do about them", and nothing else in the category does it.

**Lawless French.** A genuine reference site written by one teacher (Laura K. Lawless), organised by grammar topic with clear explanations at every level. **Right:** breadth and plain explanation; it is what learners actually land on from a search. **Wrong:** it is a website, not a system — no progress, no scheduling, and the free tier is ad-supported and cluttered. **Steal:** the topic taxonomy for a grammar reference. **Avoid:** letting reference material live apart from practice.

**TV5MONDE Apprendre.** Public-broadcaster material graded A1–B2, built on real video with exercises attached *(indirect)*. **Right:** authentic audio and video at a stated CEFR level — the single hardest asset to produce ourselves. **Wrong:** navigation is confusing, exercises are shallow, and there is no memory of what you did. **Steal:** grading real media by level, and "something to watch" as a first-class content type. **Note:** link to it, never mirror it.

**RFI Français Facile.** Daily news read slowly, with transcripts. **Right:** the content is new every day, which solves the staleness problem no curriculum solves. **Wrong:** no progression and no personalisation; it is a radio feed with a transcript. **Steal:** "something to read, graded by level" pulled from a live source.

**Le Point du FLE.** A directory of thousands of free French exercises across the web. **Right:** coverage — it is where teachers actually send students. **Wrong:** it is a 2003 link farm; quality varies wildly and nothing is tracked. **Steal:** nothing structurally. It is the proof that *aggregation without curation is not a product*.

### General language platforms

**Duolingo.** The best habit-builder ever made in this category: the streak, the short session, the green owl. **Right:** getting people to come back daily, which is the only thing that produces fluency. **Wrong:** it teaches French grammar through sentence-translation *with no explanation of why a construction works*, so adult learners plateau and cannot self-correct. Its gamification has drifted into pressure and dark patterns. **Steal:** short sessions and visible daily progress. **Avoid:** gamification that manufactures guilt, and teaching without explanation.

**Babbel.** The adult's answer to Duolingo: explicit grammar explanations calibrated to adult learners, CEFR-aligned progression that maps toward DELF, reasonable audio, and real cultural content. **Right:** it respects that the learner is an adult with a reason. **Wrong:** **dialogues play at one speed** — a widely-cited complaint and a direct justification for the brief's adjustable-speed requirement. Paid. **Steal:** CEFR-aligned path, explicit grammar, cultural framing.

**Busuu.** Its distinguishing feature is community correction: you record or write, and native speakers correct you. **Right:** it solves production — the thing software cannot mark. **Wrong:** correction quality varies enormously, and its drill/review tools are weaker than Anki or Clozemaster. **Steal:** the insight that *writing and speaking need a human or a very good model in the loop, and pretending otherwise is dishonest*. For us this is the hardest unsolved piece.

**Anki.** The serious tool. Its scheduler (now FSRS) is the best free memory model that exists, and its data model has survived twenty years. **Right:** the algorithm, and total user ownership of data. **Wrong:** the interface is famously hostile — the desktop client gives too little guidance or example, and the web interface cannot even import a deck. It assumes you already know what a deck, a note type and a card template are. **Steal:** the scheduler, wholesale. **Avoid:** the interface, entirely. The gap between Anki's engine and Anki's UI is the opportunity this project exists in.

**Clozemaster.** Fill-the-gap sentences at volume, drawn from Tatoeba. **Right:** cloze-in-context beats isolated word pairs, and the sentence bank is openly licensed. **Wrong:** the interface is retro and unclean, the synthesised audio is low-end, and it is near-useless below A2 because you need a foundation to guess from context. **Steal:** cloze from real sentences, and Tatoeba as a licensed source. **Avoid:** shipping synthetic audio and calling it listening practice.

**Memrise.** Was a strong SRS with user-made courses and native-speaker video clips. **Right:** the video clips of real people saying real phrases. **Wrong:** its **one-size-fits-all algorithm "ends up fitting no one and no item"** — learners want intervals that vary by item difficulty, which is precisely what FSRS does and Memrise does not. Recent changes degraded both algorithm and interface and the community reacted badly. **Steal:** short native-speaker clips. **Avoid:** a fixed-interval scheduler.

**LingQ.** Import any text, read it, tap unknown words, they enter your study list. **Right:** the learner brings their own content, so motivation is never the app's problem. **Wrong:** the interface is cluttered and dated, and the free tier is heavily limited. **Steal:** "words I'm learning" as a set built by reading, not by a curriculum author — which the brief already asks for.

**Lingvist.** Adaptive vocabulary by frequency, with a clean interface. **Right:** frequency-ordered introduction means the first 1,000 words you learn are the 1,000 you will actually meet. **Wrong:** vocabulary only; no grammar, no production, little context. **Steal:** frequency ordering for introducing new cards — and it is licence-clean, since frequency is a fact derivable from open corpora (Lexique).

### Outside language learning

**Oura** redesigned in late 2025 around **"one big thing — the most critical score or insight you need right now."** Every other metric remains available but stops competing for attention, with three depths: at-a-glance rings, mid-level metrics, then precise exploratory views. This is the most directly applicable idea in the whole research set. **Strava** is the counter-example most often cited: it optimises for comparison against others, which motivates the already-fit and demoralises everyone else. **Khan Academy** gets the mastery ladder right — you see the skill tree and what unlocks — but its dashboard has historically been criticised as cluttered *(indirect)*. **Linear** and **Todoist** demonstrate that density is not the enemy of clarity when there is a command palette: one keystroke reaches anything, so the visible surface can stay calm. **Brilliant** shows that a "next lesson" card plus a visible path beats a grid of everything.

The synthesis from dashboard research: *good dashboard UX is measured in **seconds-to-answer**, not in how the screen looks*, and **progressive disclosure** — summary first, detail on demand — is the pattern that makes density survivable.

### Claims to verify when browsing is available

Two *(indirect)* findings carry the recommendation, so they are the ones to
check first if this is ever redone with working access. Everything else could
move without changing the design.

| Claim | Rests on | What it decides | If it is wrong |
|---|---|---|---|
| Kwiziq builds a per-learner "brainmap" that identifies mis-learned concepts and serves the material that repairs them | Search results and its own marketing, **not** an account I used | The whole weakness model, and therefore the review-log schema | The log is still right — it is how *any* weakness model is built — but our claim to be matching a proven approach weakens to a claim about a plausible one |
| Anki's interface is the standard complaint against it, and the gap between its engine and its interface is the opening for this project | Search results and forum reports | The framing of the entire product: "Anki's brain, a humane face" | If learners do not actually find Anki hard, our differentiator is smaller than stated and the case for building rests on French specificity alone |

Lower-stakes *(indirect)* claims, recorded so nobody mistakes them for
first-hand: Babbel's single-speed dialogues, Memrise's fixed-interval
scheduler, Clozemaster's synthesised audio, TV5MONDE's navigation, Khan
Academy's dashboard clutter.

---

## Part 2 — Five patterns to copy, five to avoid

### Copy

1. **A weakness model, not a score.** *(Kwiziq)* Store enough per-attempt data to say "your *passé composé* with *être* is the problem, here are four minutes that fix it." This requires logging every attempt, not just current state — see §3.
2. **One big thing, then depth on demand.** *(Oura)* The dashboard opens with a single recommended action and today's session. Everything else in the brief's long list is one interaction away, not on screen at once.
3. **A command palette over everything.** *(Linear, Todoist)* One search box that returns lessons, grammar points, words, verbs and exercises, reachable by keystroke. This is how we satisfy "find anything you want to learn" without a wall of boxes.
4. **FSRS, with a full review log.** *(Anki / ts-fsrs)* Per-item stability and difficulty, four grades, and a stored `ReviewLog` so parameters can later be re-fitted to the individual learner.
5. **Licence as a field in the content model.** *(LibreLingo)* Verified first-hand: its `course.yaml` carries `License: {Name, Short name, Link}` as structured data. This makes §4 of the brief a query, not an audit.

### Avoid

1. **Gamification that manufactures guilt.** *(Duolingo)* Streaks that punish, notifications that nag, fake urgency. The brief forbids dark patterns; this is where they live in this category.
2. **A fixed interval for every item.** *(Memrise)* An algorithm that fits no one.
3. **An engine with a hostile interface.** *(Anki)* Never make the learner understand our data model to use the product.
4. **Synthesised audio presented as listening practice.** *(Clozemaster)* Either real recorded speech, or say plainly that it is machine speech.
5. **Aggregation without curation.** *(Le Point du FLE)* A directory of links is not a learning platform. Every link we surface must be graded, labelled and placed in a path.

---

## Part 3 — What this repository already has (and what it lacks)

Worth stating plainly, because it changes the estimate.

**Already built, working, tested, and licence-clean:**

- An FSRS scheduler with 12 unit tests, a drift-proof study timer with 12 tests, local progress storage with export/import, a four-language i18n layer (English, Persian, French, Arabic) with right-to-left support, exam sections for DELF/DALF/TCF/TEF with 22 verified-`https` outbound links, an offline service worker, and 56 unit + 55 browser checks.
- **22 A1 cards — all original work written for this project.** I re-checked: there is no content in this repository credited to *Les mots de l'info* or *Vite et Bien*. The §4 blocker refers to a **different, earlier codebase**. Nothing contaminated has ever been committed here.

**Gaps our own engine has, found by reading ts-fsrs (MIT) today:**

| ts-fsrs has | We have | Why it matters |
|---|---|---|
| `State: New / Learning / Review / Relearning` | stability > 0 or not | We cannot distinguish a card being learned from one being relearned after a lapse, so early-stage scheduling is cruder than it should be. |
| `ReviewLog` per review | current state only | **This is the blocker for the weakness model.** Without a log we can never say *which* concept is failing, nor re-fit parameters per learner. |
| `Rating.Manual` | 4 grades only | No way to reschedule a card administratively. |
| Learning-steps strategy | none | No sub-day steps for brand-new material. |

**Recommendation:** replace our hand-written scheduler with `ts-fsrs` (MIT — compatible, attribution only) and **add a review log from day one**. Retro-fitting a log after launch means losing every learner's history up to that point.

---

## Part 4 — Three directions for the dashboard

All three assume mobile-first, 320→1440 px, and the full content list from §2 of the brief.

### Direction A — "The Coach"
The dashboard opens on **one recommendation** and **today's session**: *"12 cards due · 8 minutes"* with 5 / 15 / 30-minute buttons, under it a single detected weakness with a one-tap fix, under that a compact review queue. Everything else — levels, skills, grammar, verbs, vocabulary, exams — lives behind a persistent search and a browse tab.
*Model:* Oura + Kwiziq. *Strength:* a student who opens it at 7 a.m. knows what to do in under two seconds; it is the least intimidating for a beginner. *Weakness:* a student who wants to *explore* has to go looking; the breadth is real but not visible, which risks reading as "four boxes" — the exact failure Shahin rejected.

### Direction B — "The Atlas"
The dashboard **is** the map: a two-axis view of French — CEFR level down, skill across — with the student's position, progress and what unlocks next drawn on it. Grammar, verbs, vocabulary and topics are entered from the map. Today's session is a persistent bar, not the main event.
*Model:* Khan Academy's mastery tree + Brilliant. *Strength:* answers "what is there to learn, and where am I" instantly and visibly; breadth is the first impression, which is what the brief asks for. *Weakness:* heavier on a 320 px screen, and it shows a new student a large map of things they cannot do yet, which can demoralise.

### Direction C — "The Workbench"
A dense two-pane console: persistent left navigation over the full taxonomy, main pane for content, `⌘K` command palette reaching every lesson, word, verb and exercise. Progress is a strip, not a page.
*Model:* Linear, Todoist. *Strength:* the fastest tool to *use* once learned; genuinely satisfies "find anything". *Weakness:* it is a power-user interface; on a phone the left pane becomes a drawer and the density advantage largely evaporates. Wrong first impression for a free public platform aimed at the general public.

### ⚖️ Recommendation — **A as the shell, B as the home tab, C's palette throughout**

Not a compromise; a division of labour, and each part is doing what it was proven good at.

- **Home = the Atlas (B).** The level × skill map, with progress on it, is the answer to "not four boxes". It is the first thing the student sees and it shows the whole platform at a glance.
- **Above it, pinned = the Coach (A).** One card: today's session, the time chooser, and the single most useful next action. This is Oura's "one big thing" and it survives being scrolled past.
- **Search = the palette (C).** One box, keyboard-reachable, searching lessons, grammar, verbs, words, exercises and exams — the brief's "one search box" requirement, implemented as the mechanism that lets the visible surface stay calm.
- **Weakness panel** sits below the map, driven by the review log from §3.

On a phone this stacks: session card → map (scrollable, level-major) → weaknesses → due today. On desktop it is a three-column layout with the map given the width it needs.

**Proposed bundle budget:** ≤ **150 KB** gzipped JavaScript and ≤ **30 KB** gzipped CSS for the shell plus the home route; ≤ 60 KB gzipped per lazily-loaded section; LCP under 2.5 s on a simulated Slow 4G. Content ships as paged JSON outside the bundle. I will measure and report against this, not assert it.

---

## Part 5 — Decisions I need from you before step 2

1. **Framework.** My recommendation: **React + Vite + TypeScript + Tailwind, with shadcn/ui components on Radix primitives** — accessibility (keyboard, focus, ARIA) comes built in rather than hand-rolled, the components are copied into the repo so there is no runtime dependency to bloat the bundle, and Tremor can be added later only if the progress charts justify it. The trade-off against today's zero-dependency vanilla approach is real: we gain accessible components and lose the "no build step, no `node_modules`" simplicity that currently makes this repo deployable by pushing. Alternative if you prefer to keep that: stay vanilla and hand-build the components, which costs weeks and is where accessibility bugs breed.
2. **`main` vs the feature branch**, and whether to replace `main`'s history so the tool-attribution trailer disappears from your profile entirely.
3. **Network access** — widen it, or accept Part 1 as indirect?
4. **Direction** — A, B, C, or the recommended combination?

I have written no application code, per the brief.

---

## Sources

Products and comparisons: [Which app should I use to learn a language](https://www.olesentuition.co.uk/single-post/which-app-should-i-use-to-learn-a-language-duolingo-memrise-babbel-quizlet-busuu) · [Duolingo alternatives for French](https://www.lingolegend.com/post/duolingo-alternatives-for-french) · [Babbel vs Duolingo for French](https://copycatcafe.com/blog/babbel-vs-duolingo) · [Best French learning apps](https://kilolingo.com/compare/french-learning-apps) · [Clozemaster review](https://www.langoly.com/clozemaster-review/) · [Clozemaster vs Anki](https://www.clozemaster.com/blog/clozemaster-vs-anki/) · [Memrise vs Anki vs Lingvist](https://memriseforum.mylittlewordland.com/community.memrise.com/t/how-does-memrises-spaced-repetition-compare-to-anki-and-lingvist/17297.html) · [Anki as a spaced-repetition tool (study)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10403443/) · [Progress with Lawless French](https://progress.lawlessfrench.com/for-students) · [French listening resources](https://www.fluentu.com/blog/french/listen-to-french/?lang=en)

Dashboard and UX: [Oura app redesign](https://www.instrument.com/work/oura-app) · [Dashboard UX pattern analysis](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards) · [Dashboard design principles](https://uxpilot.ai/blogs/dashboard-design-principles) · [Progress tracker design](https://www.uxpin.com/studio/blog/design-progress-trackers/) · [Khan Academy UX case study](https://medium.com/@vatsakshat0143/ux-case-study-redesigning-the-khan-academy-app-85afcec5fcd8)

UI libraries: [shadcn vs Radix vs Base UI](https://dev.to/edriso/shadcn-vs-radix-vs-base-ui-which-one-should-a-junior-pick-in-2026-1jml) · [shadcn/ui vs Radix vs Headless UI](https://starterpick.com/guides/shadcn-vs-radix-vs-headless-ui-2026) · [Next.js UI libraries compared](https://thekitbase.app/blog/nextjs-ui-libraries-compared-2026)

French typography: [French punctuation and spaces](https://i18n.leifgehrmann.com/french-punctuation/) · [French typography guide](https://azerty.global/en/french-typography) · [Non-breaking space](https://en.wikipedia.org/wiki/Non-breaking_space)

Code read first-hand: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT) · [LibreLingo](https://github.com/LibreLingo/LibreLingo) (AGPL-3.0, structure only — no code taken)
