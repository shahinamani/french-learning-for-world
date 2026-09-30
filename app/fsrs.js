// Spaced repetition scheduling — FSRS v4.5.
//
// Why a memory model rather than a "known / to review" flag: a flag records a
// judgement the learner made once, and then shows them the card again whenever
// they happen to open the app. A memory model estimates when the card is about
// to be forgotten and shows it then. The whole point of the portal is that the
// learner does not have to decide what to study.
//
// Two numbers are tracked per card:
//   stability   — how many days until recall probability falls to 90%
//   difficulty  — 1..10, how much this particular card resists stabilising
//
// Published default parameters. They are a starting point, not a truth: they
// can later be re-fitted from a learner's own review log, which is exactly why
// every review is stored with its rating and elapsed time.

export const RATING = Object.freeze({ AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 });

const W = Object.freeze([
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
]);

const DECAY = -0.5;
const FACTOR = 19 / 81;          // so that R(S, S) === 0.9 exactly
const MIN_STABILITY = 0.01;
const MAX_STABILITY = 36500;     // 100 years; stops runaway intervals
const MAX_INTERVAL_DAYS = 3650;

const clampDifficulty = (d) => Math.min(10, Math.max(1, d));
const clampStability = (s) => Math.min(MAX_STABILITY, Math.max(MIN_STABILITY, s));

/** Probability of recalling a card `elapsedDays` after the last review. */
export function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + (FACTOR * t) / stability, DECAY);
}

/** Days until recall probability falls to `requestedRetention`. */
export function intervalDays(stability, requestedRetention = 0.9) {
  const raw = (stability / FACTOR) * (Math.pow(requestedRetention, 1 / DECAY) - 1);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(raw)));
}

function initialStability(rating) {
  return clampStability(W[rating - 1]);
}

function initialDifficulty(rating) {
  return clampDifficulty(W[4] - W[5] * (rating - 3));
}

function nextDifficulty(difficulty, rating) {
  const delta = difficulty - W[6] * (rating - 3);
  // Mean reversion towards the difficulty an "easy" first answer would imply,
  // so a single bad day does not brand a card hard forever.
  return clampDifficulty(W[7] * initialDifficulty(RATING.EASY) + (1 - W[7]) * delta);
}

function stabilityAfterRecall(difficulty, stability, r, rating) {
  const hardPenalty = rating === RATING.HARD ? W[15] : 1;
  const easyBonus = rating === RATING.EASY ? W[16] : 1;
  const growth =
    Math.exp(W[8]) *
    (11 - difficulty) *
    Math.pow(stability, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) *
    hardPenalty *
    easyBonus;
  return clampStability(stability * (1 + growth));
}

function stabilityAfterLapse(difficulty, stability, r) {
  const next =
    W[11] *
    Math.pow(difficulty, -W[12]) *
    (Math.pow(stability + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - r));
  // Forgetting never makes a card *more* stable than it already was.
  return clampStability(Math.min(next, stability));
}

/**
 * A card the learner has never seen.
 * `dueAt: 0` sorts it before anything scheduled, so "new" is just "very due".
 */
export function newCardState() {
  return {
    stability: 0, difficulty: 0, reps: 0, lapses: 0,
    dueAt: 0, lastReviewedAt: 0, lastRating: 0,
  };
}

/**
 * Apply a rating. Pure: same inputs, same output, no clock of its own — the
 * caller passes `now`, which is what makes this testable without faking time.
 *
 * @returns {{state: object, intervalDays: number}}
 */
export function review(state, rating, now, requestedRetention = 0.9) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 4) {
    throw new RangeError(`rating must be 1..4, received ${rating}`);
  }
  const first = !state || state.reps === 0 || state.stability <= 0;

  let stability;
  let difficulty;
  let elapsedDays = 0;

  if (first) {
    stability = initialStability(rating);
    difficulty = initialDifficulty(rating);
  } else {
    elapsedDays = Math.max(0, (now - state.lastReviewedAt) / 86400000);
    const r = retrievability(elapsedDays, state.stability);
    difficulty = nextDifficulty(state.difficulty, rating);
    stability = rating === RATING.AGAIN
      ? stabilityAfterLapse(difficulty, state.stability, r)
      : stabilityAfterRecall(difficulty, state.stability, r, rating);
  }

  // A lapse is shown again in the same session, not in a day's time.
  const days = rating === RATING.AGAIN ? 0 : intervalDays(stability, requestedRetention);
  const dueAt = rating === RATING.AGAIN
    ? now + 60000
    : now + days * 86400000;

  return {
    intervalDays: days,
    state: {
      stability,
      difficulty,
      reps: (state?.reps ?? 0) + 1,
      lapses: (state?.lapses ?? 0) + (rating === RATING.AGAIN ? 1 : 0),
      dueAt,
      lastReviewedAt: now,
      lastRating: rating,
    },
  };
}

/** What each button will do, for the labels under the buttons. */
export function previewIntervals(state, now, requestedRetention = 0.9) {
  const out = {};
  for (const [name, rating] of Object.entries(RATING)) {
    out[name] = review(state, rating, now, requestedRetention).intervalDays;
  }
  return out;
}
