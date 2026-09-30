# 05 — Design system

**Status:** step 3 deliverable. Rendered at `design-system/index.html`, measured by `design-system/contrast-check.mjs`.
**Stack it targets:** Vite + React + TypeScript + Tailwind + shadcn/ui.

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

`node design-system/contrast-check.mjs` — **20 checks, 0 failures, 0 console errors.**

| What | Result |
|---|---|
| WCAG AA contrast, every text element against its **real rendered background** | 217 elements × 2 themes = **434 measurements, all pass** |
| Horizontal overflow at 320 / 375 / 1440 px | 0 px at every width |
| Side gutter | 16 px at every width |
| Interactive targets ≥ 44 px | 0 under, at every width |
| Focus ring | 2 px solid, 2 px offset, present on all 40 controls |
| The level map is a real `<table>` | 3 row headers, 8 column headers, a caption |
| Locked cells have accessible names | all |
| Right-to-left | no overflow; French content stays LTR inside an RTL page |

**The check fails the build when something fails.** It records every failed assertion, exits non-zero, and exits `2` if no checks ran at all — a check that prints FAIL and exits 0 is not a check.

### Four real defects the measurement caught

1. **Not one token was ever defined.** `tokens.css` declared everything inside `@theme { }`, which is a Tailwind *build-time* directive. A browser ignores the at-rule completely, so every `var()` fell back to nothing and the page rendered with browser defaults — no spacing, no colour, no focus ring. It still *looked* like a page, so a visual review would have passed it. Tokens now sit on `:root`, which is valid everywhere; Tailwind v4 consumes them through `@theme inline`.
2. **`--color-ink-faint` failed AA in both themes** — 3.35:1 light, 4.18:1 dark, against a 4.5 requirement at every text size (only ≥24 px, or ≥18.66 px bold, qualifies as "large"). Corrected to `#5c6470` / `#8d96a5`.
3. **Three CEFR chips failed AA** in light theme on their own tinted fills: A1 3.30:1, A2 3.34:1, B1 4.48:1. Darkened to 4.73, 5.47 and 6.08 while keeping the ramp ordered.
4. **`ink-faint` then still failed on the sunken surface** at 4.47:1 — three hundredths short, and the locked map cells and keyboard hints both sit on it. A token must clear AA on **every** surface it is placed on, not the common one.

Points 2–4 are the argument for measuring against the rendered background rather than checking a palette in isolation: each of those pairs looked fine.

---

## Known, and not hidden

**Fonts do not render as designed in this container.** The network policy blocks the font host, so the screenshots show system fallbacks — the layout, spacing, colour and contrast measurements are all valid, but the letterforms are not the ones specified. The fallback stacks are real faces, so nothing breaks.

**Self-hosting the two families is the step-4 action.** It fixes three things at once: this container, the offline case (a cross-origin font is not in our service-worker cache), and the privacy exposure of sending every visitor's IP to a third party — which a German court has held to breach the GDPR. Both families are OFL, so self-hosting is permitted; it needs network access to fetch them once.

**The contrast check requires Playwright**, which is not a project dependency. It runs from a dev environment that has it. In CI it should be added as a devDependency when the Vite project is scaffolded in step 4.

---

## How this becomes shadcn/ui in step 4

The CSS above is the **contract**, not the implementation. Each component becomes a shadcn component wrapping a Radix primitive, and these class names become the Tailwind utilities it composes:

| Here | Step 4 |
|---|---|
| `.btn`, `.btn--primary` | `Button` with `variant` — Radix `Slot` |
| `.input`, `.field` | `Input`, `Label`, `FormMessage` |
| `.palette` | `Command` — cmdk + Radix `Dialog`, focus trap included |
| `.tabs` | Radix `Tabs` with `role="tablist"` |
| `.alert` | `Alert` with `role="status"` / `role="alert"` by severity |
| `.map` | stays a plain `<table>` — no primitive improves on it |
| `.flashcard`, `.rate`, `.rail` | our own, composed from tokens |

Writing them as plain CSS first made the design reviewable before any framework existed, and it is why the accessibility defects were found now rather than after twelve components had inherited them.

**Budget check at this step:** `tokens.css` + `components.css` are **7.5 KB gzipped** together (measured, `gzip -9`). Against a 30 KB CSS budget that leaves 22.5 KB for Tailwind's own output and the application's utilities.

---

## Open for step 4

1. **Self-host the fonts** — needs network access, fixes the GDPR exposure and offline.
2. **The concept taxonomy** (`docs/03`) is still the critical-path content task and blocks the weak-points screen.
3. A **dark-theme toggle in the product**, not only in this style guide: three states (light, dark, system), stored per device.
