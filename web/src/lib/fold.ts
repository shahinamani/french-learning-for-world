/**
 * Folding French text for comparison — one implementation, used by search, the
 * verb filter and answer checking.
 *
 * There were three near-copies of this before, which is how they came to
 * disagree with each other. They all did `toLowerCase().normalize('NFD')` and
 * stripped combining marks, which handles é è ê ë à â ç î ï ô û ù correctly.
 *
 * What none of them handled is the ligatures. `œ` and `æ` are single letters,
 * not a letter plus an accent, so NFD does not decompose them: `normalize('NFD')`
 * leaves `œ` as `œ`. The consequences were real and French-specific —
 *
 *   checkAnswer('soeur', 'sœur')  ->  WRONG
 *   search 'coeur'                ->  does not find 'cœur'
 *
 * — and they land hardest on exactly the learner this platform is for: someone
 * on a keyboard with no `œ` key, who has no way to type it (`docs/04` specifies
 * an accent bar for this and it is not built yet). `cœur, sœur, œuf, œil, bœuf,
 * vœu, nœud` are ordinary words, not edge cases.
 *
 * Folding is for COMPARISON ONLY. Never render a folded string: `sœur` is the
 * correct spelling and `soeur` is not.
 */

/** Expanded before decomposition, because NFD will not do it. */
const LIGATURES: [RegExp, string][] = [
  [/œ/g, 'oe'], [/Œ/g, 'OE'],
  [/æ/g, 'ae'], [/Æ/g, 'AE'],
];

const COMBINING_MARKS = /[̀-ͯ]/g;

export function fold(s: string): string {
  let out = s.toLowerCase();
  for (const [re, to] of LIGATURES) out = out.replace(re, to.toLowerCase());
  return out
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    // A typographic apostrophe and a prime are the same keystroke to a learner.
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two strings differ only in accents, ligatures, case or spacing. */
export const sameFolded = (a: string, b: string) => fold(a) === fold(b);
