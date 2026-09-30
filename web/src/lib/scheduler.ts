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
import { fsrs, generatorParameters, createEmptyCard, Rating, State, type Card as FsrsCard } from 'ts-fsrs';
import type { CardState } from './types';

export const SCHEDULER_ID = 'fsrs-6';
export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;
export type Grade = (typeof GRADES)[number];

const params = generatorParameters({ enable_fuzz: true, enable_short_term: true });
const engine = fsrs(params);

export function emptyState(): CardState {
  const c = createEmptyCard(new Date(0));
  return toState(c);
}

function toState(c: FsrsCard): CardState {
  return {
    dueAt: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as 0 | 1 | 2 | 3,
    lastReviewedAt: c.last_review ? c.last_review.getTime() : null,
  };
}

function toFsrs(s: CardState): FsrsCard {
  return {
    due: new Date(s.dueAt),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    last_review: s.lastReviewedAt ? new Date(s.lastReviewedAt) : undefined,
    learning_steps: 0,
  } as FsrsCard;
}

/** Pure: same inputs, same output, and the clock is an argument. */
export function review(state: CardState, grade: Grade, now: number): CardState {
  const out = engine.next(toFsrs(state), new Date(now), grade);
  return toState(out.card);
}

/** What each button will do, for the label under it. */
export function preview(state: CardState, now: number): Record<Grade, number> {
  const scheduled = engine.repeat(toFsrs(state), new Date(now));
  const out = {} as Record<Grade, number>;
  for (const g of GRADES) {
    const card = scheduled[g].card;
    out[g] = Math.max(0, Math.round((card.due.getTime() - now) / 86_400_000));
  }
  return out;
}

export { Rating, State };
