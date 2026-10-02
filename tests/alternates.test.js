/**
 * A learner must never be marked wrong for correct French.
 *
 * 124 verbs admit two spellings — « essaie »/« essaye », « martèle »/« martelle »,
 * « espérerai »/« espèrerai » — across 2,986 forms. The conjugation drill reads
 * `accepted` and honours them. These checks exist because of how easily that
 * could stop being true, and because I spent four messages reporting a defect
 * in the other two surfaces that does not exist:
 *
 *   flashcards    reveal, then self-rate 1-4. Nothing is typed and nothing is
 *                 spell-checked, so there is nothing to pass `also` to.
 *   exams         every item is multiple choice. `options[]` and an `answer`
 *                 index, graded `chosen === item.answer`, radio buttons in
 *                 ExamSit.tsx. Nothing is typed there either.
 *
 * The claim "only Conjugation.tsx passes `also`" was true; the inference "so
 * the others mark correct French wrong" was never checked. What follows is the
 * check I should have written instead of repeating the claim.
 *
 * Two real exposures remain, and both are guarded here:
 *
 *   1. A multiple-choice distractor that is ALSO correct French. Today none,
 *      and papers are still being written.
 *   2. A typed-answer exam item added later. `ExamItem` has no field for one,
 *      so the defect is currently inexpressible — which is exactly how the
 *      souvenir defect survived. If someone adds the field, this fails until
 *      the answer goes through `checkAnswer` with its alternates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { normalise, checkAnswer } from '../web/src/lib/answer.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const verbs = LEVELS.flatMap((l) => read(`content/verbs/${l}.json`).verbs);
const papers = read('content/exam-papers.json').papers;

/** Every form that has a second accepted spelling, both ways round. */
const alternates = new Map();
const link = (a, b) => {
  if (!alternates.has(a)) alternates.set(a, new Set());
  alternates.get(a).add(b);
};
let withAlt = new Set();
for (const v of verbs) {
  for (const t of v.tenses) {
    (t.accepted || []).forEach((a, i) => {
      if (a && a !== t.forms[i]) { link(t.forms[i], a); link(a, t.forms[i]); withAlt.add(v.infinitive); }
    });
  }
}

test('the alternates exist in the content at the scale claimed', () => {
  assert.ok(withAlt.size >= 120, `${withAlt.size} verbs carry a second spelling`);
  assert.ok(alternates.size >= 2500, `${alternates.size} forms have an alternate`);
  console.log(`    ${withAlt.size} verbs · ${alternates.size} forms with a second spelling`);
});

test("the drill's data path accepts both spellings, on every pair", () => {
  // Exactly what Conjugation.tsx does: checkAnswer(typed, forms[i], [accepted[i]]).
  //
  // The first version of this check called checkAnswer(alternate, form) with no
  // third argument and failed — correctly. Without the alternates, rejecting
  // the alternate is the function doing its job. The test was wrong, not the
  // code, which is the third time this week a metric of mine has accused
  // working code. A check must reproduce the real call, not a simpler one.
  const bad = [];
  for (const v of verbs) {
    for (const t of v.tenses) {
      (t.accepted || []).forEach((a, i) => {
        if (!a || a === t.forms[i]) return;
        const also = [a];
        if (!checkAnswer(a, t.forms[i], also).correct) {
          bad.push(`${v.infinitive} ${t.id}: « ${a} » rejected against « ${t.forms[i]} »`);
        }
        // And the canonical spelling must still pass with the alternate present:
        // widening the accepted set must never narrow it.
        if (!checkAnswer(t.forms[i], t.forms[i], also).correct) {
          bad.push(`${v.infinitive} ${t.id}: « ${t.forms[i]} » rejected by its own alternate`);
        }
      });
    }
  }
  assert.deepEqual(bad.slice(0, 8), []);
  // Seen failing: drop the third argument and the pairs stop being accepted.
  const essayer = verbs.find((v) => v.infinitive === 'essayer');
  const pres = essayer.tenses.find((t) => t.id === 'present');
  assert.equal(checkAnswer('essaye', pres.forms[0], [pres.accepted[0]]).correct, true);
  assert.equal(checkAnswer('essaye', pres.forms[0]).correct, false,
    'the alternate is accepted even without being passed — the argument does nothing');
});

test('no multiple-choice distractor is also correct French', () => {
  // The live exposure, now that nothing is typed: a paper that offers
  // « essaie » as the answer and « essaye » as a wrong option marks a learner
  // wrong for correct French without ever checking a spelling.
  const bad = [];
  for (const p of papers) {
    for (const item of p.items) {
      const opts = (item.options || []).map((o) => o.fr);
      const right = opts[item.answer];
      opts.forEach((o, i) => {
        if (i === item.answer) return;
        if (normalise(o) === normalise(right)) {
          bad.push(`${p.id}/${item.id}: « ${o} » differs from the answer only by accent or case`);
        } else if (alternates.get(right)?.has(o)) {
          bad.push(`${p.id}/${item.id}: « ${o} » is an accepted alternate of « ${right} »`);
        }
      });
    }
  }
  assert.deepEqual(bad, []);
});

test('every exam item is graded by index, or this suite is out of date', () => {
  // THE SHAPE GUARD. Nothing in ExamItem can express a typed answer, which is
  // why no exam can currently mark a spelling wrong. The day somebody adds one,
  // this fails — and the fix is to route it through checkAnswer with the
  // alternates, not to delete this check.
  const typed = [];
  for (const p of papers) {
    for (const item of p.items) {
      if (!Array.isArray(item.options) || item.options.length < 2) {
        typed.push(`${p.id}/${item.id}: no options — is this a typed answer?`);
      }
      if (typeof item.answer !== 'number') {
        typed.push(`${p.id}/${item.id}: answer is ${typeof item.answer}, not an index`);
      }
    }
  }
  assert.deepEqual(typed, [],
    'an exam item that is not multiple choice has appeared. A typed answer must '
    + 'go through checkAnswer(given, expected, accepted) or it will mark « essaye » '
    + 'wrong. See tests/alternates.test.js.');
  const n = papers.reduce((a, p) => a + p.items.length, 0);
  console.log(`    ${n} exam items, all graded by index`);
});

test('the conjugation drill passes the alternates, and still does', () => {
  // Source-level, because this is the one surface where a learner types French
  // and the only thing standing between them and a wrong mark is one argument.
  const src = readFileSync(join(root, 'web/src/features/verbs/Conjugation.tsx'), 'utf8');
  const call = src.match(/checkAnswer\([^)]*\)/);
  assert.ok(call, 'the drill no longer calls checkAnswer');
  assert.match(call[0], /accepted/,
    `the drill calls ${call[0]} — without the accepted spellings, « essaye » is wrong`);
});

test('the flashcard session grades nothing, which is why it needs no alternates', () => {
  // Asserted rather than assumed — the assumption is what I got wrong. If a
  // text input appears here, a learner starts typing French and this fails.
  const src = readFileSync(join(root, 'web/src/features/flashcards/Session.tsx'), 'utf8');
  assert.ok(!/type="text"|<textarea/.test(src),
    'the flashcard session now takes typed input and must check it with alternates');
  assert.match(src, /reveal/, 'the flashcard session is reveal-and-rate');
});
