/**
 * Behaviour tests against the modules the product actually ships.
 *
 * The sweep that produced this file found that EVERY import in the suite
 * pointed at `app/` — the vanilla portal — and none at `web/`, which is what a
 * learner loads. Forty-two of ninety-seven tests exercised code that is not in
 * the build, including twelve for a hand-written FSRS implementation that
 * `ts-fsrs` replaced in step 4. `typography.test.js` did read the right file,
 * but as TEXT: it asserted the source mentions guillemets, which a broken
 * formatter would also satisfy (docs/lessons.md #5).
 *
 * Node 22 strips TypeScript types, so these import the real modules and call
 * the real functions. The `app/` tests are kept — that portal is still the
 * deployed one until the parity conditions in docs/07 are met — but they are
 * now labelled as testing `app/`, not as testing the product.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { fr, frIf } from '../web/src/lib/typography.ts';
import { normalise, checkAnswer } from '../web/src/lib/answer.ts';
import { hashParams, emptyState, GRADES, SCHEDULER_ID } from '../web/src/lib/scheduler.ts';
import { formatClock, remainingSeconds, PRESETS } from '../web/src/lib/timer.ts';
import { score } from '../web/src/lib/exams.ts';

const NNBSP = ' ';
const NBSP = ' ';

// ── French typography, by behaviour ────────────────────────────────────────

test('fr() puts a narrow no-break space before high punctuation', () => {
  assert.equal(fr('Vraiment ?'), `Vraiment${NNBSP}?`);
  assert.equal(fr('Vraiment?'), `Vraiment${NNBSP}?`);
  assert.equal(fr('Quoi !'), `Quoi${NNBSP}!`);
  assert.equal(fr('a; b'), `a${NNBSP}; b`);
});

test('fr() puts a no-break space before a colon, but not inside a URL or a time', () => {
  assert.equal(fr('Attention : ici'), `Attention${NBSP}: ici`);
  assert.equal(fr('https://example.org'), 'https://example.org');
  assert.equal(fr('à 8:30'), 'à 8:30');
});

test('fr() spaces the inside of guillemets and nothing outside them', () => {
  assert.equal(fr('« exemple »'), `«${NNBSP}exemple${NNBSP}»`);
  assert.equal(fr('«exemple»'), `«${NNBSP}exemple${NNBSP}»`);
});

test('fr() converts a prime to a typographic apostrophe, including beside accents', () => {
  assert.equal(fr("qu'il"), 'qu’il');
  assert.equal(fr('l’élève'), 'l’élève', 'already correct stays correct');
  // These four all failed before: \w does not match an accented letter, so the
  // rule broke on precisely the French it exists for.
  assert.equal(fr("l'élève"), 'l’élève');
  assert.equal(fr("l'école"), 'l’école');
  assert.equal(fr("d'être"), 'd’être');
  assert.equal(fr("j'étais"), 'j’étais');
});

test('fr() groups long numbers and leaves short ones alone', () => {
  assert.equal(fr('1240 mots'), `1${NBSP}240 mots`);
  assert.equal(fr('240 mots'), '240 mots');
});

test('fr() is idempotent — the thing a formatter applied at render must be', () => {
  for (const s of ['Vraiment ?', 'Attention : ici', '« exemple »', "l'élève", '1240']) {
    assert.equal(fr(fr(s)), fr(s), `stable for ${JSON.stringify(s)}`);
    assert.equal(fr(fr(fr(s))), fr(s), `stable over three passes for ${JSON.stringify(s)}`);
  }
});

test('fr() leaves an empty string alone and never throws', () => {
  assert.equal(fr(''), '');
  for (const s of ['', ' ', '?', '«»', '::', '1', 'ÉCOUTE']) assert.equal(typeof fr(s), 'string');
});

test('frIf() applies only to French', () => {
  assert.equal(frIf('fr', 'Vraiment ?'), `Vraiment${NNBSP}?`);
  assert.equal(frIf('en', 'Really ?'), 'Really ?', 'English keeps its own spacing');
  assert.equal(frIf('ar', 'Really ?'), 'Really ?');
});

// ── Answer checking ───────────────────────────────────────────────────────

test('checkAnswer accepts the exact form', () => {
  assert.deepEqual(checkAnswer('suis', 'suis'), { correct: true, accentsOnly: false });
});

test('checkAnswer forgives a missing accent but says so', () => {
  assert.deepEqual(checkAnswer('etais', 'étais'), { correct: true, accentsOnly: true });
  assert.deepEqual(checkAnswer('étais', 'étais'), { correct: true, accentsOnly: false });
});

test('checkAnswer treats an optional ending as optional', () => {
  for (const given of ['allé', 'allée', 'allé(e)']) {
    assert.equal(checkAnswer(given, 'allé(e)').correct, true, given);
  }
});

test('checkAnswer rejects a substring — the failure mode the module was written to kill', () => {
  // A previous generation of this idea accepted any input of three characters
  // or more found anywhere inside the answer, so "ais" passed "je suis allé".
  assert.equal(checkAnswer('ais', 'je suis allé(e)').correct, false);
  assert.equal(checkAnswer('suis', 'je suis allé(e)').correct, false);
  assert.equal(checkAnswer('', 'suis').correct, false);
  assert.equal(checkAnswer('   ', 'suis').correct, false);
});

test('checkAnswer ignores surrounding whitespace and case, not spelling', () => {
  assert.equal(checkAnswer('  Suis ', 'suis').correct, true);
  assert.equal(checkAnswer('sui', 'suis').correct, false);
  assert.equal(normalise('  ÉTAIS  '), 'etais');
});

// ── Scheduler ─────────────────────────────────────────────────────────────

test('hashParams is stable, sensitive, and the right shape', () => {
  const w = [0.4, 1.2, 3.17, 15.69];
  assert.match(hashParams(w), /^[0-9a-f]{8}$/);
  assert.equal(hashParams(w), hashParams([...w]), 'same weights give the same hash');
  assert.notEqual(hashParams(w), hashParams([0.4, 1.2, 3.17, 15.70]),
    'a changed weight changes the hash — the whole point, per docs/03');
  assert.notEqual(hashParams(w), hashParams([1.2, 0.4, 3.17, 15.69]),
    'order matters: a reordered vector is a different vector');
  assert.equal(hashParams([]).length, 8, 'an empty vector still hashes');
});

test('emptyState describes a card nobody has seen', () => {
  const s = emptyState();
  assert.equal(s.reps, 0);
  assert.equal(s.state, 0, 'State.New');
  assert.equal(s.lastReviewedAt, null);
  assert.equal(s.dueAt, 0, 'a new card is not scheduled into the future');
  assert.notEqual(emptyState(), emptyState(), 'a fresh object each time, not a shared one');
});

test('the grades are the four a learner can press, and Manual is not among them', () => {
  assert.deepEqual([...GRADES], [1, 2, 3, 4]);
  assert.ok(!GRADES.includes(0), 'Rating.Manual is not a learner grade');
  assert.equal(SCHEDULER_ID, 'fsrs-6', 'rows record which algorithm scheduled them');
});

// ── Timer ─────────────────────────────────────────────────────────────────

test('formatClock renders mm:ss and never a negative', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(59), '0:59');
  assert.equal(formatClock(60), '1:00');
  assert.equal(formatClock(1800), '30:00');
  assert.equal(formatClock(3600), '1:00:00', 'an hour reads as an hour, not 60 minutes');
  assert.equal(formatClock(-5), '0:00', 'an overrun shows zero, not "-0:05"');
});

test('remainingSeconds counts down from an absolute moment and floors at zero', () => {
  const now = 1_000_000;
  assert.equal(remainingSeconds(now + 60_000, now), 60);
  assert.equal(remainingSeconds(now, now), 0);
  assert.equal(remainingSeconds(now - 60_000, now), 0, 'past deadlines are zero, not negative');
});

test('the presets are the durations the brief asked for', () => {
  assert.ok(PRESETS.includes(5) && PRESETS.includes(60), 'from a short session to an hour');
  assert.deepEqual([...PRESETS].sort((a, b) => a - b), [...PRESETS], 'in order');
});

// ── Exam scoring ──────────────────────────────────────────────────────────

const paper = {
  id: 'p', exam: 'x', level: 'A1', skill: 'reading', code: 'CE',
  name: {}, minutes: 10, official: {}, practiceNote: '',
  items: [
    { id: 'i1', kind: 'mcq', prompt: {}, options: [{ fr: 'a' }, { fr: 'b' }], answer: 0,
      conceptIds: ['c.one'], explain: {} },
    { id: 'i2', kind: 'mcq', prompt: {}, options: [{ fr: 'a' }, { fr: 'b' }], answer: 1,
      conceptIds: ['c.one', 'c.two'], explain: {} },
    { id: 'i3', kind: 'mcq', prompt: {}, options: [{ fr: 'a' }, { fr: 'b' }], answer: 0,
      conceptIds: ['c.two'], explain: {} },
  ],
};
const attempt = (answers) => ({
  attemptId: 'a', paperId: 'p', startedAt: 0, endsAt: 1, answers,
  submittedAt: 1, loggedAt: null,
});

test('score counts what was right, and what was merely attempted', () => {
  const s = score(paper, attempt({ i1: 0, i2: 0 }));
  assert.equal(s.total, 3);
  assert.equal(s.correct, 1, 'i1 right, i2 wrong, i3 unanswered');
  assert.equal(s.answered, 2, 'unanswered is not the same as wrong');
});

test('an unanswered question counts against the concept, but is not a wrong answer', () => {
  const s = score(paper, attempt({}));
  assert.equal(s.correct, 0);
  assert.equal(s.answered, 0);
  const one = s.byConcept.find((c) => c.conceptId === 'c.one');
  assert.equal(one.total, 2, 'both questions using c.one are counted');
  assert.equal(one.correct, 0);
});

test('option 0 is a real answer, not a missing one', () => {
  // `Number.isInteger(0)` is true but `if (chosen)` is false. Choosing the
  // first option must not read as "did not answer".
  const s = score(paper, attempt({ i1: 0 }));
  assert.equal(s.answered, 1, 'choosing option 0 counts as answered');
  assert.equal(s.correct, 1, 'and as correct when it is the right one');
});

test('concepts come back weakest first, because that is the point of the screen', () => {
  // c.two: i2 right, i3 wrong -> 1/2. c.one: i1 right, i2 right -> 2/2.
  const s = score(paper, attempt({ i1: 0, i2: 1, i3: 1 }));
  assert.equal(s.byConcept[0].conceptId, 'c.two', 'the weaker concept leads');
  assert.equal(s.byConcept[0].correct, 1);
  assert.equal(s.byConcept.at(-1).conceptId, 'c.one');
});

test('a perfect paper reports no weakness rather than an empty ranking', () => {
  const s = score(paper, attempt({ i1: 0, i2: 1, i3: 0 }));
  assert.equal(s.correct, 3);
  assert.ok(s.byConcept.every((c) => c.correct === c.total));
});
