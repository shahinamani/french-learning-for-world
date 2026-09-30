/**
 * Scheduling. A thin wrapper over ts-fsrs (MIT) so that nothing else in the
 * application imports it directly — the algorithm can then be replaced, or its
 * parameters refitted per learner, without touching a component.
 *
 * ts-fsrs gives four states rather than the two our first implementation had.
 * The distinction that matters to the product: `Learning` is a word being met
 * for the first time, `Relearning` is one that was known and has been lost.
 * A word never known is not a weakness; a word lost last month is.
 */
import type { Card as FsrsCard } from 'ts-fsrs';
import type { CardState } from './types';

export const SCHEDULER_ID = 'fsrs-6';
// The grade values are FSRS's, restated rather than imported: importing the
// enum would pull the whole library into the first-load bundle, which is the
// thing this file exists to avoid.
export const GRADES = [1, 2, 3, 4] as const;
export type Grade = (typeof GRADES)[number];

/** A card nobody has seen. No library needed to describe one. */
export function emptyState(): CardState {
  return {
    dueAt: 0, stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0,
    reps: 0, lapses: 0, state: 0, lastReviewedAt: null,
  };
}

/**
 * ts-fsrs is ~6.5 KB gzipped and is not needed to paint any screen — only to
 * grade a card. It is loaded on demand, once, when a session starts.
 * Step 3 claimed this was already true; it was not, and this is the correction.
 */
let enginePromise: Promise<{
  review: (s: CardState, g: Grade, now: number) => CardState;
  preview: (s: CardState, now: number) => Record<Grade, number>;
  paramsHash: string;
}> | null = null;

/**
 * A short, stable digest of the weight vector in force, written onto every
 * review row. `docs/03` specified this and it was never built; its own
 * justification says why that matters — if the weights are ever refit, rows
 * written before the refit cannot be told from rows written after, and the
 * whole log becomes uninterpretable as optimiser input. Retroactively
 * impossible, so it is cheap now and never cheap again.
 *
 * FNV-1a: 8 hex characters, no dependency, and the value only ever has to be
 * compared for equality — it is not a security hash.
 */
export function hashParams(weights: readonly number[]): string {
  let h = 0x811c9dc5;
  for (const ch of weights.map((w) => w.toFixed(6)).join(',')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function loadScheduler() {
  if (!enginePromise) {
    enginePromise = import('ts-fsrs').then((m) => {
      const params = m.generatorParameters({ enable_fuzz: true, enable_short_term: true });
      const engine = m.fsrs(params);
      const paramsHash = hashParams(params.w);
      const toState = (c: FsrsCard): CardState => ({
        dueAt: c.due.getTime(), stability: c.stability, difficulty: c.difficulty,
        elapsedDays: c.elapsed_days, scheduledDays: c.scheduled_days,
        reps: c.reps, lapses: c.lapses, state: c.state as 0 | 1 | 2 | 3,
        lastReviewedAt: c.last_review ? c.last_review.getTime() : null,
      });
      const toFsrs = (s: CardState): FsrsCard => ({
        due: new Date(s.dueAt || Date.now()), stability: s.stability, difficulty: s.difficulty,
        elapsed_days: s.elapsedDays, scheduled_days: s.scheduledDays,
        reps: s.reps, lapses: s.lapses, state: s.state,
        last_review: s.lastReviewedAt ? new Date(s.lastReviewedAt) : undefined,
        learning_steps: 0,
      } as FsrsCard);
      return {
        paramsHash,
        review: (state: CardState, grade: Grade, now: number) =>
          toState(engine.next(toFsrs(state), new Date(now), grade as 1 | 2 | 3 | 4).card),
        preview: (state: CardState, now: number) => {
          const scheduled = engine.repeat(toFsrs(state), new Date(now));
          const out = {} as Record<Grade, number>;
          for (const g of GRADES) {
            out[g] = Math.max(0, Math.round((scheduled[g].card.due.getTime() - now) / 86_400_000));
          }
          return out;
        },
      };
    });
  }
  return enginePromise;
}





