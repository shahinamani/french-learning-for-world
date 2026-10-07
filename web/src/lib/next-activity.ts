/**
 * What to do next, decided once and in one place.
 *
 * A learner who finishes a flashcard session, a conjugation drill or an exam
 * paper is returned to a map and left to choose again. Over a forty-minute
 * evening that is four separate decisions about what to do next, and the
 * session walkthrough is where that showed: the product has material and no
 * continuation.
 *
 * This file is the DECISION only — no React, no fetch, no storage. Everything
 * it needs is passed in, so the order can be tested exhaustively in node
 * against made-up states that would take an hour each to produce in a browser.
 * `components/NextActivity.tsx` gathers the inputs and renders the answer.
 *
 * ── The order, and where each rule comes from ──────────────────────────────
 *
 * 1. **Due cards.** `progress.counts()` already defines due as `reps > 0 &&
 *    dueAt <= now`, and the whole scheduler exists to put those cards in front
 *    of a learner on the day it chose. Anything recommended ahead of a due card
 *    is this file overruling FSRS, which it has no standing to do.
 *
 * 2. **A weak concept that can actually be practised.** `progress.weakPoints()`
 *    already defines weak: at least 3 reviews and accuracy below 80 %. The
 *    addition here is ELIGIBILITY, and it is narrower than it looks — the only
 *    concept-targeted practice route in this product is
 *    `/practise/review?concept=<id>`, which needs flashcards. A concept whose
 *    material is verb forms or exam items has no such route, so recommending it
 *    would send a learner to a record page with nothing to do. `material.cards`
 *    is therefore the eligibility test, not `material.total`.
 *
 * 3. **An exam paper.** Preferring the learner's level — which this product
 *    does not store, so it is derived; see `deriveLevel`.
 *
 * 4. **New cards**, if any have never been seen. Not in the original three, but
 *    "nothing to do" is the wrong answer while 22 cards exist and the learner
 *    has seen four of them.
 *
 * 5. **Nothing**, said plainly, with the map as the way on.
 *
 * ── Two rules that are easy to get wrong ───────────────────────────────────
 *
 * **Deciding must not change anything.** Every input is a read. Nothing here
 * writes a review, touches a schedule, or marks a profile as started — a
 * recommendation that altered progress by being displayed would corrupt the
 * weakness model of anyone who merely looked at a screen.
 *
 * **Do not bounce a learner straight back into what they just finished.**
 * `justDid` demotes that activity one rank. It does not remove it: if due cards
 * remain and nothing else is eligible, due cards are still the right answer and
 * the reason says so. The rule is "do not loop pointlessly", not "never repeat".
 */
import type { Level } from './types';

export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type ActivityKind = 'review' | 'concept' | 'exam' | 'new-cards';

export type Suggestion =
  | { kind: 'review'; to: string; count: number; repeat: boolean }
  | { kind: 'concept'; to: string; conceptId: string; accuracyPct: number; cards: number; repeat: boolean }
  | { kind: 'exam'; to: string; paperId: string; level: Level; questions: number;
      levelFromHistory: boolean; repeat: boolean }
  | { kind: 'new-cards'; to: string; count: number; repeat: boolean }
  | { kind: 'none' };

/** Only what this decision needs — deliberately not the real types, so a test
 *  can build a state in four lines and the decision cannot read anything it was
 *  not given. */
export type Inputs = {
  /** From `progress.counts()`. Null when the review log could not be read. */
  counts: { due: number; fresh: number } | null;
  /** From `progress.weakPoints()`, already filtered and sorted by that module. */
  weak: { conceptId: string; accuracy: number; reviews: number }[];
  /**
   * Every concept with any review, from `progress.conceptStats()`.
   *
   * The level is derived from this and NOT from `weak`, which took one attempt
   * to get wrong: a learner who is accurate at B1 has no weak B1 concepts, so
   * deriving from the weak list alone reads a competent B1 learner as a
   * beginner and offers them an A1 paper. Falls back to `weak` when absent, so
   * a caller that cannot read the full log still gets something.
   */
  reviewed?: { conceptId: string; reviews: number }[];
  /** From `material.loadMaterial()`. A concept absent from the map has none. */
  material: Map<string, { cards: number; total: number }>;
  /** Live, non-retired concepts, for levels. */
  concepts: { id: string; level: string }[];
  papers: { id: string; level: Level; items: unknown[] }[];
  /** How many attempts the learner has on each paper id. */
  attempts: Map<string, number>;
  /** What they have just finished, so it is not offered straight back. */
  justDid?: ActivityKind | null;
};

/**
 * Where this learner's PRACTICE HISTORY sits. **Not a proficiency level.**
 *
 * The distinction is the whole of this comment. This product stores no learner
 * level — `Settings` is `ui`, `meaning`, `theme`, `sound`, there is no
 * placement test and no self-declared level — and nothing here assesses anyone.
 * What this computes is "the highest CEFR band at which they have practised
 * enough for the number to mean something", which is a heuristic for choosing
 * a paper and nothing more. A learner who has drilled thirty B1 cards is not
 * thereby B1, and the interface must not tell them they are.
 *
 * `MIN_REVIEWS` is three, which is thin on purpose: it is enough to rule out a
 * single stray review and not enough to claim anything. Raising it would make
 * the heuristic slower to move without making it more of an assessment.
 *
 * Highest rather than most-reviewed, because a learner working at B1 still
 * reviews A1 cards every day and the mode would hold them at A1 for ever.
 *
 * Returns null when the history is too thin, and **null means say nothing** —
 * not "assume A1". The caller shows a different sentence for that case.
 */
export const MIN_REVIEWS = 3;

export function levelFromPractice(
  weakOrAll: { conceptId: string; reviews: number }[],
  concepts: { id: string; level: string }[],
  minReviews = MIN_REVIEWS,
): Level | null {
  const levelOf = new Map(concepts.map((c) => [c.id, c.level]));
  const byLevel = new Map<string, number>();
  for (const s of weakOrAll) {
    const lvl = levelOf.get(s.conceptId);
    if (!lvl) continue;
    byLevel.set(lvl, (byLevel.get(lvl) ?? 0) + s.reviews);
  }
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const lvl = LEVELS[i] as Level;
    if ((byLevel.get(lvl) ?? 0) >= minReviews) return lvl;
  }
  return null;
}

/** Ascending level order, with an unknown level sorting last. */
const levelIndex = (l: Level): number => {
  const i = LEVELS.indexOf(l);
  return i < 0 ? LEVELS.length : i;
};

/** `noUncheckedIndexedAccess` is on, so an array index is `T | undefined` even
 *  where a length check guarantees otherwise. These say so explicitly rather
 *  than asserting non-null, because the empty case is real in both. */
const firstOr = <T,>(list: T[]): T | null => (list.length > 0 ? (list[0] as T) : null);

/**
 * The exam paper to offer.
 *
 * Deterministic, and every tie is broken explicitly because two papers at one
 * level is already the case (TCF B1 and TCF B2) and "whichever the array had
 * first" is a decision nobody made.
 *
 *   1. the learner's level if a paper exists there, else the nearest level
 *      BELOW it, else the lowest paper there is — never above, because too easy
 *      is a wasted twenty minutes and too hard is a reason to stop;
 *   2. fewest attempts, so an unseen paper comes before a repeat;
 *   3. more questions, so a fuller paper wins a tie;
 *   4. paper id, ascending — the final tiebreak, so the answer is stable.
 */
export function chooseExam(
  all: Inputs['papers'], attempts: Inputs['attempts'], level: Level | null,
): Inputs['papers'][number] | null {
  // A paper with no questions is not an exercise. Nothing ships one today, but
  // a recommendation that opens an empty paper is worse than no recommendation,
  // and "all six have items right now" is a fact about the content rather than
  // a property of this function.
  const papers = all.filter((p) => p.items.length > 0);
  if (papers.length === 0) return null;
  const want = level ? levelIndex(level) : -1;

  let pool = papers;
  if (want >= 0) {
    const atOrBelow = papers.filter((p) => levelIndex(p.level) <= want);
    if (atOrBelow.length > 0) {
      const best = Math.max(...atOrBelow.map((p) => levelIndex(p.level)));
      pool = atOrBelow.filter((p) => levelIndex(p.level) === best);
    } else {
      const lowest = Math.min(...papers.map((p) => levelIndex(p.level)));
      pool = papers.filter((p) => levelIndex(p.level) === lowest);
    }
  } else {
    const lowest = Math.min(...papers.map((p) => levelIndex(p.level)));
    pool = papers.filter((p) => levelIndex(p.level) === lowest);
  }

  return firstOr([...pool].sort((a, b) =>
    (attempts.get(a.id) ?? 0) - (attempts.get(b.id) ?? 0)
    || b.items.length - a.items.length
    || a.id.localeCompare(b.id)));
}

/**
 * The weak concept to offer, or null.
 *
 * `weakPoints()` sorts by accuracy then reviews and stops there, which leaves
 * ties resolved by Map insertion order — in other words by the order rows came
 * out of IndexedDB. **Two learners with identical records could be shown
 * different concepts, and the same learner could be shown a different one on
 * each reload.** The final tiebreak on `conceptId` is what makes this stable
 * and what makes the tests above able to assert anything at all.
 */
export function chooseWeakConcept(
  weak: Inputs['weak'], material: Inputs['material'],
): Inputs['weak'][number] | null {
  const eligible = weak.filter((w) => (material.get(w.conceptId)?.cards ?? 0) > 0);
  if (eligible.length === 0) return null;
  return firstOr([...eligible].sort((a, b) =>
    a.accuracy - b.accuracy
    || b.reviews - a.reviews
    || a.conceptId.localeCompare(b.conceptId)));
}

/** Build the candidates in priority order, before `justDid` is considered. */
function candidates(i: Inputs): Suggestion[] {
  const out: Suggestion[] = [];

  if ((i.counts?.due ?? 0) > 0) {
    out.push({ kind: 'review', to: '/practise/review', count: i.counts!.due, repeat: false });
  }

  const concept = chooseWeakConcept(i.weak, i.material);
  if (concept) {
    out.push({
      kind: 'concept',
      to: `/practise/review?concept=${encodeURIComponent(concept.conceptId)}`,
      conceptId: concept.conceptId,
      accuracyPct: Math.round(concept.accuracy * 100),
      cards: i.material.get(concept.conceptId)?.cards ?? 0,
      repeat: false,
    });
  }

  const level = levelFromPractice(i.reviewed ?? i.weak, i.concepts);
  const paper = chooseExam(i.papers, i.attempts, level);
  if (paper) {
    out.push({
      kind: 'exam',
      to: `/practise/exams/${encodeURIComponent(paper.id)}`,
      paperId: paper.id, level: paper.level, questions: paper.items.length,
      levelFromHistory: level !== null, repeat: false,
    });
  }

  if ((i.counts?.fresh ?? 0) > 0) {
    out.push({ kind: 'new-cards', to: '/practise/review', count: i.counts!.fresh, repeat: false });
  }

  return out;
}

/**
 * One recommendation, and nothing else.
 *
 * A screen that offers three things is the map again. The point of this is to
 * answer the question, so it answers it; "Return to the map" stays beside it
 * for a learner who wants to choose for themselves, and no activity is ever
 * started automatically.
 */
export function chooseNext(i: Inputs): Suggestion {
  const list = candidates(i);
  if (list.length === 0) return { kind: 'none' };

  const first = list[0] as Suggestion;
  if (!i.justDid || first.kind !== i.justDid) return first;

  // They have just done this. Offer the next distinct thing instead.
  const other = list.find((s) => s.kind !== i.justDid);
  if (other) return other;

  // Nothing else is eligible, so repeating is the honest answer rather than
  // sending them away — but it is MARKED, for every kind and not only reviews,
  // so the screen says why it is offering the same work again instead of
  // looking like a loop. The first version marked only `review`, which left a
  // learner who had just drilled their weakest concept being handed it back
  // with no explanation at all.
  return { ...first, repeat: true };
}
