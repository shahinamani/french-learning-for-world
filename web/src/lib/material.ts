/**
 * Which concepts a learner can actually practise.
 *
 * The taxonomy has 261 live concepts. **65 of them have any exercise at all.**
 * 196 have none, and at C1 and C2 it is 0 of 71 — while the learn map shows
 * those cells as clickable.
 *
 * That gap is why this file exists. The map promised six skills at six levels
 * and 18 of those promises resolved to "Not built yet"; listing each level's
 * concepts fixes the dead end, but only if the list also says which concepts
 * have something behind them. A list of 22 concepts where 18 are empty is the
 * same lie one level further down.
 *
 * Material reaches a concept from three places, and they are very uneven:
 *
 *   flashcards    29 concepts — one hand-written A1 deck of 22 cards
 *   verb drills    7 concepts — but 2,389 verbs' worth, so these are deep
 *   exam items    49 concepts — 28 items across three papers, so these are thin
 *
 * `countable` is deliberately a count of EXERCISES and not of concepts: one
 * concept with 2,389 drillable verbs and one with a single exam item are not
 * the same offer, and a page that showed both as "available" would be telling a
 * learner something false about their evening.
 */
import type { Concept } from './types';

export type Material = {
  /** Exercises that reach this concept, by where they come from. */
  cards: number;
  verbForms: number;
  examItems: number;
  /** The sum. Zero means the concept is named in the taxonomy and nothing
   *  teaches it — which is true of 196 of the 261 live concepts. */
  total: number;
};

export const NO_MATERIAL: Material = { cards: 0, verbForms: 0, examItems: 0, total: 0 };

let cache: Promise<Map<string, Material>> | null = null;

/**
 * The generated counts. 5.8 KiB, one fetch, no recomputation.
 *
 * Counted by `scripts/build-concept-material.py` rather than in the browser so
 * there is one source of truth: a client that re-counted could disagree with
 * the page that shows the counts and nothing would notice.
 */
export function loadMaterial(): Promise<Map<string, Material>> {
  if (!cache) {
    cache = fetch('./content/concept-material.json')
      .then((r) => { if (!r.ok) throw new Error('concept-material'); return r.json(); })
      .then((d: { material: Record<string, Material> }) =>
        new Map(Object.entries(d.material)))
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** The concepts a learner would be shown for one cell of the learn map. */
export function conceptsFor(concepts: Concept[], level: string, type: string): Concept[] {
  return concepts
    .filter((c) => !c.isGroup && !c.retired && c.level === level && c.type === type)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * What one cell of the map should say.
 *
 * `locked`   nothing in the taxonomy — the skill is not modelled at this level.
 * `listed`   concepts exist and NONE of them has an exercise. The cell is
 *            honest about being a plan rather than a route. This is C1 and C2
 *            in their entirety.
 * `partial`  some concepts have exercises and some do not. Every level from A1
 *            to B2 is here, and the page says which is which.
 * `ready`    every concept has at least one exercise. Nothing is `ready` today.
 */
export type CellState = 'locked' | 'listed' | 'partial' | 'ready';

export function cellState(
  concepts: Concept[], material: Map<string, Material>, level: string, type: string,
): { state: CellState; concepts: number; withMaterial: number; exercises: number } {
  const list = conceptsFor(concepts, level, type);
  let withMaterial = 0, exercises = 0;
  for (const c of list) {
    const m = material.get(c.id);
    if (m && m.total > 0) { withMaterial += 1; exercises += m.total; }
  }
  const state: CellState = list.length === 0 ? 'locked'
    : withMaterial === 0 ? 'listed'
    : withMaterial === list.length ? 'ready' : 'partial';
  return { state, concepts: list.length, withMaterial, exercises };
}
