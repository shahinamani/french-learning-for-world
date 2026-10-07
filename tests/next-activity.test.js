/**
 * What the portal recommends next, exhaustively.
 *
 * The decision lives in `web/src/lib/next-activity.ts` with no React, no fetch
 * and no storage, so every state can be built here in four lines. Producing
 * "a learner with three weak concepts, one of which has flashcards, who has
 * just finished a drill, whose level cannot be derived" in a browser is an hour
 * of setup; here it is an object literal, and that is the whole reason the
 * decision was separated from the component.
 *
 * What these assert is not "the order is right" — that is a product judgement,
 * written down in the module. They assert that the order IS what is written
 * down, that eligibility is narrower than material, that every tie has an
 * answer, and that absent data produces a sensible recommendation rather than
 * an exception.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseNext, chooseExam, chooseWeakConcept, deriveLevel, LEVELS,
} from '../web/src/lib/next-activity.ts';

/** A learner with nothing at all. Each test overrides only what it is about. */
const base = () => ({
  counts: { due: 0, fresh: 0 },
  weak: [],
  material: new Map(),
  concepts: [],
  papers: [],
  attempts: new Map(),
  justDid: null,
});

const paper = (id, level, n) => ({ id, level, items: Array(n).fill(0) });
const mat = (pairs) => new Map(pairs.map(([id, cards, total]) => [id, { cards, total: total ?? cards }]));

/* ── Priority ─────────────────────────────────────────────────────────── */

test('due cards come before everything else', () => {
  const s = chooseNext({
    ...base(),
    counts: { due: 7, fresh: 3 },
    weak: [{ conceptId: 'c.weak', accuracy: 0.2, reviews: 10 }],
    material: mat([['c.weak', 5]]),
    papers: [paper('p1', 'A1', 8)],
  });
  assert.equal(s.kind, 'review');
  assert.equal(s.count, 7);
  assert.equal(s.to, '/practise/review');
  assert.equal(s.repeat, false);
});

test('with nothing due, a weak concept that has cards comes next', () => {
  const s = chooseNext({
    ...base(),
    weak: [{ conceptId: 'c.weak', accuracy: 0.4, reviews: 9 }],
    material: mat([['c.weak', 6]]),
    papers: [paper('p1', 'A1', 8)],
  });
  assert.equal(s.kind, 'concept');
  assert.equal(s.conceptId, 'c.weak');
  assert.equal(s.accuracyPct, 40);
  assert.equal(s.cards, 6);
  assert.equal(s.to, '/practise/review?concept=c.weak');
});

test('with nothing due and no eligible concept, an exam paper', () => {
  const s = chooseNext({ ...base(), papers: [paper('p1', 'A1', 8)] });
  assert.equal(s.kind, 'exam');
  assert.equal(s.paperId, 'p1');
  assert.equal(s.questions, 8);
  assert.equal(s.to, '/practise/exams/p1');
});

test('with none of those, new cards are better than nothing', () => {
  const s = chooseNext({ ...base(), counts: { due: 0, fresh: 12 } });
  assert.equal(s.kind, 'new-cards');
  assert.equal(s.count, 12);
});

test('with genuinely nothing, it says so rather than inventing something', () => {
  assert.equal(chooseNext(base()).kind, 'none');
});

/* ── Eligibility is narrower than material ────────────────────────────── */

test('a weak concept whose only material is verb forms or exam items is NOT offered', () => {
  // The only concept-targeted practice route is /practise/review?concept=,
  // which needs flashcards. Offering a concept without them sends a learner to
  // a record page with nothing to do — a dead end dressed as a recommendation.
  const s = chooseNext({
    ...base(),
    weak: [{ conceptId: 'c.verbs', accuracy: 0.3, reviews: 20 }],
    material: new Map([['c.verbs', { cards: 0, total: 2389 }]]),
  });
  assert.equal(s.kind, 'none', 'a concept with 2 389 exercises and no cards is still not practisable here');
});

test('a weak concept absent from the material map is not offered', () => {
  const s = chooseNext({
    ...base(),
    weak: [{ conceptId: 'c.unknown', accuracy: 0.1, reviews: 30 }],
  });
  assert.equal(s.kind, 'none');
});

test('eligibility is applied before the sort, not after', () => {
  // The weakest concept has no cards; the second weakest does. Filtering after
  // sorting and taking [0] would return nothing at all.
  const got = chooseWeakConcept(
    [{ conceptId: 'c.worst', accuracy: 0.1, reviews: 9 },
     { conceptId: 'c.next', accuracy: 0.5, reviews: 9 }],
    mat([['c.next', 3]]),
  );
  assert.equal(got.conceptId, 'c.next');
});

/* ── Ties, which must have an answer ──────────────────────────────────── */

test('identical weak concepts resolve by id, the same way every time', () => {
  const weak = [
    { conceptId: 'c.zebra', accuracy: 0.5, reviews: 4 },
    { conceptId: 'c.alpha', accuracy: 0.5, reviews: 4 },
  ];
  const m = mat([['c.zebra', 2], ['c.alpha', 2]]);
  assert.equal(chooseWeakConcept(weak, m).conceptId, 'c.alpha');
  // Reversed input, same answer: without the id tiebreak this follows whatever
  // order rows came out of IndexedDB, so one learner could see a different
  // concept on each reload.
  assert.equal(chooseWeakConcept([...weak].reverse(), m).conceptId, 'c.alpha');
});

test('accuracy beats review count, and review count beats the id', () => {
  const m = mat([['a', 1], ['b', 1], ['c', 1]]);
  assert.equal(chooseWeakConcept(
    [{ conceptId: 'a', accuracy: 0.6, reviews: 50 }, { conceptId: 'b', accuracy: 0.3, reviews: 3 }], m).conceptId, 'b');
  assert.equal(chooseWeakConcept(
    [{ conceptId: 'a', accuracy: 0.5, reviews: 3 }, { conceptId: 'b', accuracy: 0.5, reviews: 9 }], m).conceptId, 'b');
});

test('exam ties: fewest attempts, then more questions, then id', () => {
  const papers = [paper('tcf-b', 'B1', 12), paper('tcf-a', 'B1', 12)];
  const none = new Map();
  assert.equal(chooseExam(papers, none, 'B1').id, 'tcf-a', 'id breaks the final tie');
  assert.equal(chooseExam(papers, new Map([['tcf-a', 2]]), 'B1').id, 'tcf-b', 'an unattempted paper first');
  assert.equal(chooseExam([paper('x', 'B1', 8), paper('y', 'B1', 20)], none, 'B1').id, 'y', 'the fuller paper');
});

/* ── Level, which this product does not store ─────────────────────────── */

const concepts = [
  { id: 'a1.one', level: 'A1' }, { id: 'a1.two', level: 'A1' },
  { id: 'b1.one', level: 'B1' }, { id: 'c1.one', level: 'C1' },
];

test('the level is the highest with enough evidence, not the most reviewed', () => {
  // A learner working at B1 still reviews A1 cards every day. The mode would
  // hold them at A1 for ever.
  const level = deriveLevel(
    [{ conceptId: 'a1.one', reviews: 200 }, { conceptId: 'b1.one', reviews: 4 }], concepts);
  assert.equal(level, 'B1');
});

test('thin evidence at a level does not count as that level', () => {
  assert.equal(deriveLevel([{ conceptId: 'b1.one', reviews: 2 }], concepts), null);
  assert.equal(deriveLevel([{ conceptId: 'b1.one', reviews: 3 }], concepts), 'B1');
});

test('no evidence at all gives null, which is not A1', () => {
  assert.equal(deriveLevel([], concepts), null);
  assert.equal(deriveLevel([{ conceptId: 'not.a.concept', reviews: 99 }], concepts), null);
});

test('an unknown level offers the lowest paper, and says the level is unknown', () => {
  const s = chooseNext({
    ...base(),
    concepts,
    papers: [paper('b2', 'B2', 20), paper('a1', 'A1', 8), paper('b1', 'B1', 12)],
  });
  assert.equal(s.kind, 'exam');
  assert.equal(s.paperId, 'a1', 'start at the bottom rather than guess high');
  assert.equal(s.levelKnown, false);
});

test('a known level never offers a paper above it', () => {
  // Too easy is a wasted twenty minutes; too hard is a reason to stop.
  const papers = [paper('a1', 'A1', 8), paper('b2', 'B2', 20)];
  const s = chooseExam(papers, new Map(), 'B1');
  assert.equal(s.id, 'a1', 'the nearest level BELOW, never above');
  assert.equal(chooseExam(papers, new Map(), 'B2').id, 'b2');
});

test('when every paper is above the learner, the lowest is offered', () => {
  const s = chooseExam([paper('b2', 'B2', 20), paper('c1', 'C1', 20)], new Map(), 'A1');
  assert.equal(s.id, 'b2');
});

test('no papers at all is not an error', () => {
  assert.equal(chooseExam([], new Map(), 'B1'), null);
});

/* ── Missing data ─────────────────────────────────────────────────────── */

test('an unreadable review log does not stop a recommendation', () => {
  // counts === null is what the component passes when IndexedDB threw — a
  // private window, or blocked site data. The learner still gets an exam paper.
  const s = chooseNext({ ...base(), counts: null, papers: [paper('p1', 'A1', 8)] });
  assert.equal(s.kind, 'exam');
});

test('an unreadable log with nothing else gives none, not a crash', () => {
  assert.equal(chooseNext({ ...base(), counts: null }).kind, 'none');
});

/* ── Not looping straight back ────────────────────────────────────────── */

test('after a review session, an eligible concept is offered instead of more cards', () => {
  const s = chooseNext({
    ...base(),
    counts: { due: 5, fresh: 0 },
    weak: [{ conceptId: 'c.weak', accuracy: 0.4, reviews: 9 }],
    material: mat([['c.weak', 6]]),
    justDid: 'review',
  });
  assert.equal(s.kind, 'concept');
});

test('but with nothing else eligible, due cards are still the answer — and marked', () => {
  // The rule is "do not loop pointlessly", not "never repeat". FSRS put those
  // cards there; sending the learner away because they just studied would be
  // this file overruling the scheduler.
  const s = chooseNext({ ...base(), counts: { due: 5, fresh: 0 }, justDid: 'review' });
  assert.equal(s.kind, 'review');
  assert.equal(s.repeat, true, 'the screen must be able to say why it offers the same thing again');
});

test('after an exam, the next exam is not pushed when anything else exists', () => {
  const s = chooseNext({
    ...base(),
    counts: { due: 0, fresh: 9 },
    papers: [paper('p1', 'A1', 8), paper('p2', 'A2', 8)],
    justDid: 'exam',
  });
  assert.equal(s.kind, 'new-cards');
});

test('after a concept session, the same concept is not offered straight back', () => {
  const s = chooseNext({
    ...base(),
    weak: [{ conceptId: 'c.weak', accuracy: 0.4, reviews: 9 }],
    material: mat([['c.weak', 6]]),
    papers: [paper('p1', 'A1', 8)],
    justDid: 'concept',
  });
  assert.equal(s.kind, 'exam');
});

test('justDid never invents an activity that is not eligible', () => {
  const s = chooseNext({ ...base(), justDid: 'review' });
  assert.equal(s.kind, 'none');
});

/* ── Shape ────────────────────────────────────────────────────────────── */

test('every suggestion carries a route, and none of them is the current screen', () => {
  const cases = [
    chooseNext({ ...base(), counts: { due: 1, fresh: 0 } }),
    chooseNext({ ...base(), weak: [{ conceptId: 'c', accuracy: 0.1, reviews: 5 }], material: mat([['c', 1]]) }),
    chooseNext({ ...base(), papers: [paper('p', 'A1', 1)] }),
    chooseNext({ ...base(), counts: { due: 0, fresh: 1 } }),
  ];
  for (const s of cases) {
    assert.ok(s.to && s.to.startsWith('/'), `${s.kind} has a route`);
    assert.ok(!s.to.includes('undefined'), `${s.kind} route is built, not interpolated from nothing`);
  }
  assert.equal(LEVELS.length, 6);
});

/* ── The level comes from everything reviewed, not from the weak list ───── */

test('a learner accurate at B1 is not read as a beginner', () => {
  // The first version derived the level from `weak` alone. A learner who is
  // ACCURATE at B1 has no weak B1 concepts, so that version saw only their weak
  // A1 points and offered them an A1 paper — reading competence as absence.
  const s = chooseNext({
    ...base(),
    concepts,
    weak: [{ conceptId: 'a1.one', accuracy: 0.5, reviews: 6 }],
    reviewed: [{ conceptId: 'a1.one', reviews: 6 }, { conceptId: 'b1.one', reviews: 40 }],
    papers: [paper('a1', 'A1', 8), paper('b1', 'B1', 12)],
  });
  assert.equal(s.kind, 'exam');
  assert.equal(s.paperId, 'b1');
  assert.equal(s.levelKnown, true);
});

test('without the full log it falls back to the weak list rather than failing', () => {
  const s = chooseNext({
    ...base(),
    concepts,
    weak: [{ conceptId: 'b1.one', accuracy: 0.5, reviews: 5 }],
    papers: [paper('a1', 'A1', 8), paper('b1', 'B1', 12)],
  });
  assert.equal(s.paperId, 'b1');
});
