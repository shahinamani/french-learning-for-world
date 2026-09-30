import { fold } from './fold';

/**
 * Comparing what a learner typed with what French requires.
 *
 * Accents are forgiven because a keyboard may not have them; everything else
 * is exact. The rule this replaces, in an earlier generation of this idea,
 * accepted any input of three characters or more that appeared anywhere inside
 * the answer — so typing "ais" passed "je suis allé(e)", and the exercise
 * marked itself correct for someone who did not know the answer, which is
 * worse than no checking at all.
 */
/** Kept as a named export because it is part of this module's contract; the
 *  implementation is shared so search, the verb filter and answer checking
 *  cannot drift apart again. */
export const normalise = fold;

export type Check = { correct: boolean; accentsOnly: boolean };

export function checkAnswer(given: string, expected: string): Check {
  const g = given.trim();
  if (!g) return { correct: false, accentsOnly: false };
  // "allé(e)" accepts both "allé" and "allée": the parenthesis is optional.
  const variants = [
    expected,
    expected.replace(/\((.*?)\)/g, ''),
    expected.replace(/[()]/g, ''),
  ].map(normalise);
  const n = normalise(g);
  const correct = variants.includes(n);
  // Exactly right apart from accents is worth saying, because it is a
  // different mistake from not knowing the form.
  const exact = [expected, expected.replace(/\((.*?)\)/g, ''), expected.replace(/[()]/g, '')]
    .some((v) => v.trim().toLowerCase() === g.toLowerCase());
  return { correct, accentsOnly: correct && !exact };
}
