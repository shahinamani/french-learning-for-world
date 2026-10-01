# 05 — Design system

**Status:** step 3 deliverable. Rendered at `design-system/index.html`, measured by `design-system/contrast-check.mjs`.
**Stack it targets:** Vite + React + TypeScript + Tailwind, plus two Radix primitives.
**Swept against the build on 2026-09-30** — corrections are marked **[corrected 2026-09-30]** and listed in `docs/07`.

---

## What is here

| File | What it is |
|---|---|
| `design-system/tokens.css` | The single source of truth. Every colour, size, radius, duration and breakpoint. |
| `design-system/components.css` | Every component, built only from tokens. No literal value appears in it. |
| `design-system/index.html` | The rendered style guide. Theme and direction toggles, and a live contrast readout. |
| `design-system/contrast-check.mjs` | The measurement. 20 checks across three widths and both themes. |

Run the page: `python3 -m http.server 8000` then open `/design-system/`.
Run the checks: `node design-system/contrast-check.mjs` with Playwright available.

---

## The decisions

### Colour

One accent — a deep indigo — used sparingly. Neutrals carry a slight blue bias toward it, because a pure grey beside a coloured accent reads as unconsidered.

Three colour families that never mix:

- **Status** (`success · warning · danger · info`) for system state.
- **Ratings** (`again · hard · good · easy`) — their own ramp, because they are a four-point scale rather than four statuses, and they appear on the same screen as status colours.
- **CEFR levels** (A1→C2) — a *sequential* ramp, green through to magenta. A categorical palette would imply the six levels are unrelated things; they are ordered, and the colour should say so.

**Colour is never the only signal.** The taught form in an example is underlined as well as tinted. A locked map cell is dashed and dimmed and carries an `aria-label`. Each rating button shows its interval in words.

### Type

Two families.

- **Newsreader** carries French — a text serif with enough character to make a headword feel like a word rather than a data field, and proper accents at display size. Applied automatically by `:where([lang="fr"])`, so marking content as French is what makes it look French.
- **Vazirmatn** carries the interface and covers Latin, Persian and Arabic from one family. That is why the two right-to-left languages need no separate font stack.

Modular scale, ten steps, nothing between them. The headword is fluid — `clamp(2.5rem, 11vw, 3.75rem)` — so it dominates a 320 px screen without becoming absurd at 1440 px. French line-height is `1.7` where English would take `1.55`: accented capitals need the room.

### Spacing, radius, elevation

4 px base, no half steps. The side gutter is `--space-4` at every width, set once on one wrapper. Radius and shadow are applied **by role**: `sm` for inputs, `md` for buttons and cards, `lg` for sheets; `raised` for a card that is an object, `overlay` for something floating above the page. Applying the same radius and shadow to every block flattens the hierarchy, which is what went wrong in the portal's first interface.

---

## Measured, not asserted

`node design-system/contrast-check.mjs` — **20 checks, 0 failures, 0 console errors.** Re-run 2026-09-30.

| What | Result |
|---|---|
| WCAG AA contrast, every text element against its **real rendered background** | 218 elements × 2 themes = **436 measurements, all pass** *(was written as 217/434; re-counted)* |
| Horizontal overflow at 320 / 375 / 1440 px | 0 px at every width |
| Side gutter | 16 px at every width |
| Interactive targets ≥ 44 px | 0 under, at every width |
| Focus ring | 2 px solid, 2 px offset, present on all 40 controls |
| The level map is a real `<table>` | 3 row headers, 8 column headers, a caption |
| Locked cells have accessible names | all |
| Right-to-left | no overflow; French content stays LTR inside an RTL page |

**The check fails the build when something fails.** It records every failed assertion, exits non-zero, and exits `2` if no checks ran at all — a check that prints FAIL and exits 0 is not a check.

**[corrected 2026-09-30]** It also used to allow-list console errors matching `fonts.(googleapis|gstatic)` and to print *"none (font-host failure allow-listed)"* on every clean run — a suppression notice for a failure that stopped happening once the fonts were self-hosted in step 4. The allow-list is removed: every console error now fails the run, and the check still passes 20/20 with nothing allow-listed.

### Four real defects the measurement caught

1. **Not one token was ever defined.** `tokens.css` declared everything inside `@theme { }`, which is a Tailwind *build-time* directive. A browser ignores the at-rule completely, so every `var()` fell back to nothing and the page rendered with browser defaults — no spacing, no colour, no focus ring. It still *looked* like a page, so a visual review would have passed it. Tokens now sit on `:root`, which is valid everywhere; Tailwind v4 consumes them through `@theme inline`.
2. **`--color-ink-faint` failed AA in both themes** — 3.35:1 light, 4.18:1 dark, against a 4.5 requirement at every text size (only ≥24 px, or ≥18.66 px bold, qualifies as "large"). Corrected to `#5c6470` / `#8d96a5`.
3. **Three CEFR chips failed AA** in light theme on their own tinted fills: A1 3.30:1, A2 3.34:1, B1 4.48:1. Darkened to 4.73, 5.47 and 6.08 while keeping the ramp ordered.
4. **`ink-faint` then still failed on the sunken surface** at 4.47:1 — three hundredths short, and the locked map cells and keyboard hints both sit on it. A token must clear AA on **every** surface it is placed on, not the common one.

Points 2–4 are the argument for measuring against the rendered background rather than checking a palette in isolation: each of those pairs looked fine.

---

## Known, and not hidden

**[corrected 2026-09-30] Fonts now render as designed.** This section previously said *"Fonts do not render as designed in this container — the network policy blocks the font host"*. That was true when it was written and stopped being true in step 4: both families are self-hosted from `public/fonts/` (Newsreader and Vazirmatn, OFL-1.1, licences committed beside the files), the style guide loads them from `../public/fonts/fonts.css`, and the contrast check now runs with no network allow-list at all. The three reasons for self-hosting — this container, the offline case, and not sending every visitor's IP to a third party — are all discharged. See `docs/02`.

**[resolved 2026-10-01] Playwright is now a pinned devDependency and both browser suites run in CI.** This section said it should happen in step 4 and it did not; every browser number in the step-4 and step-5 reports was therefore one moment on one machine. A `browser` job now installs Playwright and Chromium from a committed lockfile, builds the app, serves it gzipped as a real host would, and runs the walk and the contrast check on every push and every pull request, uploading screenshots as an artifact. Verified green on a GitHub runner, not merely written. Both suites had hard-coded this container's Chromium path, which is part of why they had never run anywhere else.

---

## How this became components — planned, built, and settled

This section used to say each component "becomes a shadcn component wrapping a
Radix primitive". For steps 4 and 5 that was false: nothing used shadcn/ui or
Radix. The sweep in `docs/07` found it and Shahin settled it on 2026-10-01 —
**adopt Radix where hand-rolling genuinely breaks, keep the simple things
hand-written, and measure the cost.**

**shadcn/ui is still not used**, and that is deliberate: it is a generator that
copies component source into the repository, and what was actually needed was
two primitives, added directly. The table records all three states:

| Here | Planned (step 3) | **As built, 2026-10-01** |
|---|---|---|
| side panel | Radix `Dialog` | ✅ **`@radix-ui/react-dialog`.** Adopted. |
| `.timer-panel` | — | ✅ **`@radix-ui/react-popover`.** Adopted. |
| `.palette` | cmdk + Radix `Dialog` | ❌ **not adopted.** `/search` is a *page* of results grouped under headings, not an inline autocomplete. It is already a list of real links: Tab reaches every result and a screen reader gets headings and list structure. Turning it into a `combobox` would replace that with `aria-activedescendant` on a single input — **worse**, for a feature it does not have. |
| `.tabs` | Radix `Tabs` | ❌ **not adopted.** Radix `Tabs` is for switching panels *within* a page. This is site navigation: it changes the route. `<nav aria-label="Main">` of `NavLink`s with `aria-current="page"` is correct, and Radix `Tabs` here would have reintroduced the exact `aria-selected` error axe caught. |
| select | Radix `Select` | ❌ **not adopted.** The four selects are native `<select>`. Radix `Select` is a div-based replacement that loses the platform picker — on a phone that is a real downgrade. This is not hand-rolling; it is the platform, and the platform is better. |
| tooltip | Radix `Tooltip` | ❌ **nothing to adopt.** There are no tooltips. A tooltip is a poor pattern on touch, and every control here has a visible label or an `aria-label`. |
| `.btn`, `.input`, `.field`, `.alert` | Radix `Slot`, form parts | ❌ hand-written, deliberately. A button does not need a library. |
| `.map` | plain `<table>` | plain `<table>` — as planned |
| `.flashcard`, `.rate`, `.rail` | our own | our own |

**Two of six adopted, and the cost measured before committing to it:**
**+22 088 bytes = +21.57 KiB** gzipped, first-load JS from 117.08 to
**138.65 KiB** against a 150 KB budget. That is two thirds of the remaining
headroom for two components, which is itself an argument against adopting the
other four.

**What the 21.57 KiB bought, proved by reverting to measure it.** Three checks
in the walk fail on the pre-Radix build and pass on this one:

| Behaviour | Hand-rolled | With Radix |
|---|---|---|
| Focus moves into the timer popover on open | ❌ | ✅ |
| Escape closes the timer popover | ❌ (mouse only) | ✅ |
| Focus is trapped in the side panel over 12 tabs | ❌ escaped | ✅ |
| Escape closes the side panel | ✅ already | ✅ |
| Focus returns to the opener | ✅ already | ✅ |

The side panel had also been declaring `aria-modal="false"` while drawing a
scrim that blocked every pointer user — modal to the mouse, not to a screen
reader. Radix resolves that rather than papering over it.

**And the test the library was standing in for now exists:** axe-core runs on
**10 screens plus the dialog and popover open states, in both themes**, in CI.
On its first run it found a *critical* violation on every screen — `aria-selected`
on a `role="presentation"` span in the tab bar, which was also hiding the label
from the accessibility tree. That is precisely the class of defect `docs/01`
predicted hand-rolling would produce, and it had passed the type-checker, 82
unit tests and 99 browser checks.

**Still not discharged:** axe catches roughly a third to a half of WCAG issues.
**No screen reader has been used on this product.** That remains true and should
not be mistaken for "accessible".

Writing them as plain CSS first made the design reviewable before any framework existed, and it is why the accessibility defects were found now rather than after twelve components had inherited them.

**Budget check at this step:** `tokens.css` + `components.css` are **7 353 bytes = 7.18 KiB gzipped** together (measured, `gzip -9`, 2026-09-30; written as "7.5 KB" in step 3). The application's built stylesheet, which is these two plus Tailwind's output, is **7 024 bytes = 6.86 KiB gzipped** — smaller, because Tailwind drops what no component uses. Against a 30 KB CSS budget.

---

## Opened for step 4 — where each one ended up

1. **Self-host the fonts** — **done** in step 4. Five woff2 files, both OFL licences committed beside them, `unicode-range` so a French page fetches 92 608 bytes of the 197 020 shipped.
2. **The concept taxonomy** (`docs/03`) — **done**: 297 concepts, 261 leaves under 4 roots, A1–C2, ids permanent. The 22 cards exercise 29 of them.
   **[extended 2026-10-01]** 73 concepts added for C1 and C2. The taxonomy now reaches C2; **the product does not.** No card, drill or exam item is written against a C1 or C2 id, and every learner-facing page still says B2, which is still true. The ceiling claim changes when the content does, not before.
3. **A dark-theme toggle in the product** — **done**: three states (light, dark, system) on `/account`. **[corrected 2026-09-30]** this said "stored per device"; it is stored **per profile**, under `flw:u:<id>:settings`, so two profiles in two tabs hold different themes. `docs/06` had this right and this file had it wrong.
