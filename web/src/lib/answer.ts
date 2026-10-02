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

/**
 * @param also  Other spellings French accepts for this form. Not a kindness:
 *   « essaye » and « essaie » are both correct, and a drill that refuses one
 *   teaches a learner that a right answer is wrong — which is worse than
 *   teaching nothing, because they will carry it into an exam.
 */
export function checkAnswer(given: string, expected: string, also: string[] = []): Check {
  const g = given.trim();
  if (!g) return { correct: false, accentsOnly: false };
  // "allé(e)" accepts both "allé" and "allée": the parenthesis is optional.
  const spellings = [expected, ...also.filter(Boolean)];
  const variants = spellings.flatMap((e) => [
    e,
    e.replace(/\((.*?)\)/g, ''),
    e.replace(/[()]/g, ''),
  ]).map(normalise);
  const n = normalise(g);
  const correct = variants.includes(n);
  // Exactly right apart from accents is worth saying, because it is a
  // different mistake from not knowing the form.
  const exact = spellings.flatMap((e) => [e, e.replace(/\((.*?)\)/g, ''), e.replace(/[()]/g, '')])
    .some((v) => v.trim().toLowerCase() === g.toLowerCase());
  return { correct, accentsOnly: correct && !exact };
}
