import test from 'node:test';
import assert from 'node:assert/strict';
import { RATING, newCardState, review, retrievability, intervalDays, previewIntervals } from '../app/fsrs.js';

const DAY = 86400000;
const T0 = Date.parse('2026-01-01T09:00:00Z');

test('recall probability is exactly 0.9 after one stability period', () => {
  for (const s of [1, 7, 30, 365]) {
    assert.ok(Math.abs(retrievability(s, s) - 0.9) < 1e-9, `stability ${s}`);
  }
});

test('recall probability decays with elapsed time and never leaves 0..1', () => {
  const s = 10;
  assert.ok(retrievability(0, s) === 1);
  assert.ok(retrievability(5, s) > retrievability(50, s));
  assert.ok(retrievability(100000, s) > 0);
  assert.ok(retrievability(1, s) <= 1);
});

test('a never-seen card is due before anything scheduled', () => {
  assert.equal(newCardState().dueAt, 0);
});

test('answering Good repeatedly lengthens the interval every time', () => {
  let state = newCardState();
  let now = T0;
  let previous = 0;
  for (let i = 0; i < 6; i += 1) {
    const out = review(state, RATING.GOOD, now);
    assert.ok(out.intervalDays > previous, `rep ${i + 1}: ${out.intervalDays} > ${previous}`);
    previous = out.intervalDays;
    state = out.state;
    now += out.intervalDays * DAY;
  }
});

test('the four ratings are ordered: Again < Hard < Good < Easy', () => {
  const p = previewIntervals(newCardState(), T0);
  assert.ok(p.AGAIN < p.HARD, 'again < hard');
  assert.ok(p.HARD < p.GOOD, 'hard < good');
  assert.ok(p.GOOD < p.EASY, 'good < easy');
});

test('Again collapses stability, counts a lapse, and returns within the session', () => {
  let state = newCardState();
  let now = T0;
  for (let i = 0; i < 4; i += 1) {
    const out = review(state, RATING.GOOD, now);
    state = out.state; now += out.intervalDays * DAY;
  }
  const strong = state.stability;
  const lapsed = review(state, RATING.AGAIN, now).state;
  assert.ok(lapsed.stability < strong, 'stability must fall');
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.dueAt - now <= 5 * 60000, 'a forgotten card comes back in minutes, not days');
});

test('forgetting never increases stability', () => {
  let state = newCardState();
  let now = T0;
  for (let i = 0; i < 3; i += 1) {
    const out = review(state, RATING.GOOD, now);
    state = out.state; now += out.intervalDays * DAY;
  }
  const after = review(state, RATING.AGAIN, now).state;
  assert.ok(after.stability <= state.stability);
});

test('difficulty stays inside 1..10 under any sequence of ratings', () => {
  let state = newCardState();
  let now = T0;
  const ratings = [1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 2, 3, 1, 4, 2, 1, 1, 4];
  for (const r of ratings) {
    const out = review(state, r, now);
    state = out.state;
    assert.ok(state.difficulty >= 1 && state.difficulty <= 10, `difficulty ${state.difficulty}`);
    assert.ok(state.stability > 0, `stability ${state.stability}`);
    now += Math.max(1, out.intervalDays) * DAY;
  }
});

test('intervals are whole days of at least one, and bounded', () => {
  assert.equal(intervalDays(0.0001), 1);
  assert.ok(Number.isInteger(intervalDays(5)));
  assert.ok(intervalDays(1e9) <= 3650);
});

test('an invalid rating is rejected rather than silently scheduled', () => {
  assert.throws(() => review(newCardState(), 0, T0), RangeError);
  assert.throws(() => review(newCardState(), 5, T0), RangeError);
  assert.throws(() => review(newCardState(), 2.5, T0), RangeError);
});

test('reviewing is pure — the state passed in is never mutated', () => {
  const before = newCardState();
  const snapshot = JSON.stringify(before);
  review(before, RATING.GOOD, T0);
  assert.equal(JSON.stringify(before), snapshot);
});

test('a longer wait before a successful recall earns more stability', () => {
  const first = review(newCardState(), RATING.GOOD, T0).state;
  const soon = review(first, RATING.GOOD, T0 + 1 * DAY).state;
  const late = review(first, RATING.GOOD, T0 + 10 * DAY).state;
  assert.ok(late.stability > soon.stability);
});
