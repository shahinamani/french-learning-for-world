# Palette decision — bleu, blanc, rouge

**Decided by the owner on 2026-10-19.** The blueprint's §22 lists the palette
among the things that are *"پیشنهادهای این سند که هنوز تأیید طراحی نیستند …
اینها برای تبدیل به تصمیم نوشته شده‌اند"* — suggestions written so that a
decision could be taken. This is that decision, so it replaces §16's indigo,
teal and gold rather than contradicting the document.

## The values, and why these exact ones

The obvious flag colours do not survive a contrast check. The familiar web
red `#EF4135` is **3.83:1** on white, which fails AA for normal text — a
palette built on it would be unusable for anything but decoration.

So the values are the **French state's own design system (DSFR)**, which
exists precisely because the republic's colours had to be made accessible.
Both measured here, not quoted:

| Role | Token | Value | On white | White on it |
|:--|:--|:--|--:|--:|
| Blue, primary | `--fr-bleu` | `#000091` | **14.91** | **14.91** |
| Red, accent | `--fr-rouge` | `#E1000F` | **4.99** | **4.99** |
| White, surface | `--fr-blanc` | `#FFFFFF` | — | — |

Both pass AA for normal text in both directions. That is unusual for a flag
palette and is the reason for choosing the state values over the poster ones.

## How the three are used

Bleu-blanc-rouge is a **tricolour, not a gradient**. Three rules keep it from
looking like a sports kit:

1. **White dominates.** It is the surface of everything a learner reads.
   The page sits on a near-white canvas; cards are pure white.
2. **Blue carries structure and action.** Headings, the primary button, the
   active navigation state, links. It is the colour the eye follows.
3. **Red is punctuation, never a field.** The active tab's underline, a
   focused accent rule, the one emphasis on a hero. Red is never a background
   behind body text and never more than a few percent of a screen.

A full-width red band, red body text, or blue and red adjacent at equal weight
are all out. The tricolour should be legible as an idea and almost never as
three stripes.

## Non-negotiable, carried over

- **Flags are still not used for languages.** The blueprint forbids using a
  flag to stand for a language, and that is untouched by using the flag's
  colours as a brand. The language control stays text: Français, English,
  فارسی, العربية.
- **Error and success stay independent of the brand.** Red is now a brand
  colour, so danger must not be "the red one". Danger keeps its own distinct
  value and is never the only signal — it always carries a word or an icon.
  This is the one real risk the tricolour introduces and it is handled here.
- **Each theme is measured separately.** Dark is not an inversion. On dark,
  `#000091` is unreadable, so the blue lightens to a measured tint and the red
  lifts to stay above 4.5:1.
- **Changing the theme must not change a colour's role.** Primary stays
  primary.

## Token contract — every stream codes against these names

```
--fr-bleu            #000091   structure, primary action, links, active nav
--fr-bleu-hover      (measured) hover for the above
--fr-bleu-ink        #FFFFFF   text on a blue fill
--fr-bleu-soft       (measured) blue-tinted fill, ink on top
--fr-rouge           #E1000F   punctuation accent only
--fr-rouge-ink       #FFFFFF   text on a red fill
--fr-rouge-soft      (measured) red-tinted fill, ink on top
--fr-blanc           #FFFFFF   card and sheet surface
--fr-canvas          (measured) the near-white page behind the cards
--fr-ink             (measured) body text, a near-black with a blue cast
```

The existing semantic tokens (`--color-accent`, `--color-surface`,
`--color-ink` and the rest) keep their names and are **remapped** onto these.
No component should reference `--fr-*` directly; they exist so the brand can
be changed in one file again later.

## What proves it

`design-system/contrast-check.mjs` measures rendered pixels, and the browser
walk runs axe-core over every screen in English light and dark, Persian and
Arabic. A palette is accepted when both are clean — not when it looks right in
a screenshot.
