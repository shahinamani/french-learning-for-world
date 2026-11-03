# Redesign v1 — landing and learning portal

**Status:** approved direction, not yet built. Written 2026-10-31 from `origin/main` at `b1545aa`, on branch `redesign/v1`.
**Decided by the owner on 2026-10-31:** the current landing and portal are not at product quality and are rebuilt on a ready-made, free design system. Chosen from a side-by-side comparison of real screenshots:

| Decision | Choice | Rejected, and why |
|---|---|---|
| Component library | **shadcn/ui** (MIT, Radix primitives, Tailwind 4, React 19, RTL supported) | Untitled UI React (best parts paid), Mantine (different styling system, admin look), coss ui (smaller community) |
| Landing effects | **Magic UI**, free components only, a few on the landing page only | Magic UI Pro (paid) |
| Brand feel | **Warm, serious, adult — in the spirit of Babbel**: editorial serif headings, warm paper canvas, real photographs, one strong accent | Busuu (young), Lingoda (sales-led), Duolingo (needs paid illustration) |
| Cost | **Everything free.** No paid template, font, image, or service | — |

### What this supersedes
`FRONTEND-START.md` (2026-10-25) is **superseded for visual design and components**: its bans on shadcn/ui, its fixed palette and its "do not relitigate" table no longer apply. `CONTRACTS-v0.2.md` §1 navigation is **changed** by §4 below. Everything else in both documents stands.

### What does not change
The engine and the honesty rules are not part of the redesign:
- FSRS scheduling (`lib/scheduler.ts`, `ts-fsrs`), the review log and IndexedDB stores (`lib/db.ts`), export / import / delete.
- All content in `content/`, the 2,387 verbs, grammar, reading, exam papers.
- Guest only. No account, no sync, no sign-in button.
- Interface in English, Persian, French, Arabic; full RTL; French always `lang="fr"` and LTR.
- Offline service worker, hash routing, prerendered landing, CSP without inline styles.
- No invented numbers, testimonials, learner counts or success rates. Unreviewed content stays marked. No machine-written Persian or Arabic presented as reviewed.

---

## 1. The product in one paragraph

A free French study portal for adults with a date in their calendar: an exam (DELF, DALF, TCF, TEF), a master's application, a move. It should feel like a calm, well-made study tool from a serious publisher, not a template and not a game. A visitor understands in five seconds what it is, tries a real card on the landing page, and lands in the portal on **one next action**.

## 2. Visual language

| Token | Proposal | Note |
|---|---|---|
| Canvas | `#FAF7F2` warm paper | Measure with `npm run test:contrast` before shipping |
| Surface (cards) | `#FFFFFF` | French sits on the cleanest ground |
| Ink | `#1C1917` | Body text |
| Muted ink | `#57534E` | Must reach 4.5:1 on canvas |
| Primary (actions, focus) | `#1E3A8A` deep French blue | White text on it |
| Accent (highlights only, never body text) | `#C2410C` terracotta | Underlines, the italic word in a headline, small marks |
| CEFR, rating, status colours | Kept as three separate families, retuned to the new canvas | |
| Radius | 12px cards, 10px controls, full for pills | shadcn `--radius: 0.75rem` |
| Shadow | One soft level for raised cards; none elsewhere | |

**Type.** All self-hosted, all OFL, no font CDN:
- Headings and every French word: **Newsreader** (already in `public/fonts/`). It is the "Babbel serif" of this product.
- Interface, Latin: **Inter** (add, self-hosted, variable, latin + latin-ext subsets).
- Interface, Persian and Arabic: **Vazirmatn** (already in `public/fonts/`).

**Photography.** Real photographs of adults studying, cafés, Paris and Montréal streets. Source: **Unsplash** (free licence, no attribution required; record the photographer and URL per image in `content/attribution.json` anyway). Served as AVIF/WebP at two widths, lazy below the fold. No AI-generated images. No stock photo with a visible brand.

**Motion.** 150–250 ms ease-out on hover and state changes. Landing only: one fade-in on scroll and the card flip in the try-it block. Everything off under `prefers-reduced-motion`.

## 3. Stack additions

| Package | Why | Weight note |
|---|---|---|
| shadcn/ui components (copied into `web/src/components/ui/`) | Button, Card, Badge, Input, Tabs, Dialog, Sheet, DropdownMenu, Tooltip, Progress, Separator, Sidebar, Command (search), Table, Skeleton, Sonner (toasts) | Copied source, not a dependency |
| `radix-ui` | The primitives shadcn uses. Replaces the two separate `@radix-ui/react-*` packages already here | Tree-shaken per component |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn's variant helpers | ~8 KB gz together |
| `lucide-react` | Icons. Replaces the hand-drawn `Icon.tsx` set | Per-icon imports only |
| Magic UI (copied source) | `BlurFade`, `Marquee` on the landing page | Only components that do not need `motion`; if one does, it is dropped |

**First-load budget.** `scripts/budget.mjs` allows 150 KB of first-load JS, and `main` uses 146.6 KB. The redesign keeps the budget by **splitting the landing from the portal**: the landing (prerendered, the page a stranger sees) loads only its own chunk; the portal shell and every portal route become lazy. The budget number is not raised without the owner's yes.

## 4. Navigation — show only what exists

The current sidebar lists 14 destinations; 6 of them are empty placeholders. A visitor who clicks one finds nothing, which reads as unfinished. New navigation:

```
Sidebar (desktop)                 Mobile bar (exactly five)
  Today                             Today · Cards · Learn · Exams · More
  ── Practise
  Cards                           "Learn" sheet: Verbs, Grammar, Reading
  Verbs                           "More" sheet:  Progress, Settings, About
  Grammar
  Reading
  Exams
  ── You
  Progress
  Settings
```

- `/app/path` absorbs the level map (moved off Today). Linked from Today and Progress, not from the sidebar.
- Vocabulary, Listening, Speaking & writing, News, Podcasts, Saved: **routes stay, links go.** They render one honest "coming" page each. A single "Coming next" strip on Today names them in one line. When one gets real content, it returns to the sidebar.
- `nav.ts` stays the one table for sidebar, sheets and breadcrumb.

## 5. Landing page (`/`)

Order, top to bottom. Every figure comes from `content/portal-summary.json`.

1. **Header** — wordmark, language switch, "Start learning". Sticky, translucent on scroll.
2. **Hero** — two columns. Left: serif headline with one terracotta italic word, one sentence, primary "Start learning — free", secondary "See what's inside", a line "No account. Your progress stays on your device." Right: photo collage (2–3 Unsplash images) with the real flashcard floating over it.
3. **Proof strip** — real counts only: 2,387 verbs fully conjugated · 6 practice exam papers · 4 interface languages · works offline.
4. **Try it** — the existing real flashcard and dialogue previews, restyled. Kept: they are the best part of the current page.
5. **How it works** — three steps with icons: learn a card → the scheduler brings it back before you forget → see your weak points.
6. **For your exam** — DELF, DALF, TCF, TEF tiles, each stating honestly what is available now.
7. **What is not here yet** — the honesty band, restyled as a calm card, not a warning.
8. **FAQ** — accordion. Free? Account? Offline? Who checked the content?
9. **Footer** — about, independence notice, licence, source on GitHub, languages.

## 6. Portal screens

| Route | Picture | Mode |
|---|---|---|
| `/app/today` | Greeting line. One large "Continue" card: due count, minutes, 5 / 15 / 30, one Start button. Below: one weak point if the log has one; three small shortcuts (verbs drill, a reading text, an exam paper); the "Coming next" strip. No level table here. | Browse |
| `/app/cards` | Focus mode: sidebar hidden on desktop, card centred, max 640px. Front, "Show answer", back with examples, four rating buttons each showing its interval, keyboard hints (Space, 1–4), undo, progress bar, end-of-session summary. | Study |
| `/app/verbs` | Search on top, level filter chips, a clean table: infinitive (serif), meaning, group, level. | Browse |
| `/app/verbs/:infinitive` | Header with infinitive and meaning; Tabs per mood; tense tables in cards; "Drill this verb". | Study |
| `/app/grammar`, `/:id` | List grouped by level; lesson page as a readable article (max 70ch) with exercises in cards. | Browse / Study |
| `/app/reading`, `/:id` | Cards with photo-free typographic covers; reader page as an article with tap-a-word meaning panel (Sheet on mobile, side panel on desktop). | Browse / Study |
| `/app/exams` and children | Paper list as cards with level badge, minutes, questions; sit screen in focus mode with a timer; results with per-question review. | Browse / Study |
| `/app/progress` | Real counts from the review log, the level map, weak points with practice links. No percentages of mastery. | Browse |
| `/account` → shown as **Settings** | Interface language, meaning language, theme, export / import / delete data. | Browse |

**States.** Every screen that loads data has loading (skeleton), error (retry), offline, empty (with a next link) and finished. A state without a way forward is unfinished.

**Access.** 44px targets, visible focus ring in primary, keyboard for every action, RTL mirrored layout with LTR French, 320px without horizontal scroll, light and dark themes.

## 7. Build order

One phase lands green before the next starts. Each phase ends with screenshots at 390 and 1440, English and Persian, shown to the owner.

| Phase | Outcome | Done when |
|---|---|---|
| 0 | Foundation: packages, theme tokens in shadcn variables, fonts, `components/ui/`, a style-guide route (dev only) | Build passes, budget passes, contrast passes |
| 1 | Landing page | Owner approves the screenshots. Prerender still produces the real figures |
| 2 | Portal shell (sidebar, mobile bar, top bar, search, focus mode) and Today | `portal-routes.mjs` and `rtl.mjs` updated and passing |
| 3 | Card session | `session-walkthrough.mjs` and `walk.mjs` updated and passing |
| 4 | Verbs list, verb page, drill | — |
| 5 | Grammar and Reading | `reader.mjs` updated and passing |
| 6 | Exams, Progress, Settings, coming-soon pages | — |
| 7 | Quality pass: full e2e, axe, contrast, Lighthouse on the preview build | All existing checks pass |
| 8 | Publish on Cloudflare Pages (see §8) | The main journeys work on the public URL, not only locally |

The e2e scripts select some elements by today's class names. Each phase updates the scripts it breaks in the same change; no test is deleted to make a phase pass.

## 8. Hosting

No server. The site is static and runs in the visitor's browser. **Cloudflare Pages, free plan**: static traffic is not metered, so 20,000 or 50,000 visitors cost nothing. GitHub → Cloudflare builds and publishes each change in a few minutes. Security headers come from the existing `_headers` file.

The owner does, once: create a free Cloudflare account, connect the GitHub repository in the Pages dashboard, and point `frenchmavie.com` at it (DNS at Namecheap). Step-by-step instructions are given at phase 8.

A backend is needed only for accounts, sync, payments or a teacher dashboard. None is in this redesign. When one is, Cloudflare Workers + D1 or Supabase (both with free tiers) come before renting a server.

## 9. Not in this redesign

Licensed audio, listening and podcasts; news; teacher review of content (blocker B4); more cards and texts; accounts and sync. The redesign makes the product look and work like a finished product **for what exists**, and makes room for these without promising them.

## 10. Owner answers (2026-10-31)

1. Audience: **English first, worldwide.** The landing opens in English; Persian, French and Arabic stay in the switcher. Screenshots are approved in English first, then checked in Persian (RTL).
2. Name: **French ma vie** stays, domain `frenchmavie.com`.
3. Photographs: **Unsplash, yes**, credits recorded in `content/attribution.json`.
4. New packages are installed **in isolation**, not directly on the Mac.
