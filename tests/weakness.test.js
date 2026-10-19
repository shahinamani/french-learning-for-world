/**
 * The weakness engine (blueprint §15), run against the real corpus: real
 * concept ids and names from content/concepts.json, real card keys and French
 * fronts from the written deck, real material counts from
 * content/concept-material.json. Only the REVIEW ROWS are constructed, because
 * no learner's history exists in the repository — and a row is built exactly as
 * `appendReview` stores one, with every field of `ReviewRow`.
 *
 * Every assertion below was watched FAIL against a deliberately broken engine
 * before it was trusted (AGENTS.md §3, and the standing rule that a check that
 * has never failed has not been shown to check anything). The list of breaks
 * is in the pull request.
 *
 * The comparisons are chosen with the question AGENTS.md asks in mind — "am I
 * comparing the right two things?" — so each boundary test pairs the case that
 * must raise with the case one answer short of it, rather than asserting a
 * constant against itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  analyse, describe, walk, isWrong, saveChoice, loadChoices,
  WRONG_TO_RAISE, CORRECT_TO_CLEAR,
} from '../web/src/lib/weakness.ts';
import { translator, loadDictionary } from '../web/src/lib/i18n.ts';
// The weakness strings are a lazy English group; the card registers them in the app.
import '../web/src/lib/locales/en/weaknessEn.ts';
import { pick } from '../web/src/lib/exams.ts';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const text = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const deck = read('content/fr-core-a1.json').cards;
const concepts = read('content/concepts.json').concepts;
const material = read('content/concept-material.json').material;
const live = concepts.filter((c) => !c.isGroup && !c.retired);
const en = translator('en');
// French is fetched on demand by the app; without this `fr` would silently be
// English, and every French assertion below would be checking the wrong text.
await loadDictionary('fr');
const fr = translator('fr');
assert.notEqual(fr('wkHeading'), en('wkHeading'), 'French really loaded');

const TOPIC = 'gram.article.definite';
const cardsFor = (id) => deck.filter((c) => c.conceptIds.includes(id));
const HOUR = 3_600_000;
// Written out, NOT imported: a constant imported from the engine moves with a
// broken engine, and the check then compares the engine with itself.
const DAY = 24 * HOUR;
const CLEARED_SHOWN_MS = 14 * DAY;
const POSTPONE_MS = 7 * DAY;
const T0 = Date.UTC(2026, 9, 1);

let seq = 0;
/** A row exactly as the log stores it. `ok` is the learner's verdict. */
function row(ok, i, over = {}) {
  const cards = cardsFor(over.topic ?? TOPIC);
  const card = cards[i % cards.length];
  const audio = over.audio === true;
  return {
    id: `r${++seq}`, userId: 'u1', sessionId: 's1', reviewedAt: T0 + i * HOUR,
    cardKey: card.key,
    itemType: audio ? 'listening' : 'vocab',
    conceptIds: [over.topic ?? TOPIC],
    direction: audio ? 'audio-fr' : 'native-fr',
    promptShown: { front: card.fr, level: 'A1', type: 'vocab' },
    response: ok ? card.fr : 'wrong-answer',
    isCorrect: ok, grade: ok ? 3 : 1, durationMs: 4000,
    stateBefore: 0, stateAfter: 1, stabilityBefore: 0, stabilityAfter: 1,
    difficultyBefore: 0, difficultyAfter: 1, elapsedDays: 0, scheduledDays: 1,
    dueBefore: 0, dueAfter: 0, scheduler: 'fsrs', paramsHash: 'x', client: 'web',
    ...over,
  };
}
/** "wwwww" / "cccc" strings, oldest first: w = wrong, c = correct. */
const seqRows = (pattern, opts = {}) =>
  [...pattern].map((ch, i) => row(ch === 'c', (opts.start ?? 0) + i, opts));
const NOW = T0 + 10 * 24 * HOUR;
const run = (rows, extra = {}) => analyse(rows, { now: NOW, ...extra });
const only = (rep) => rep.all.find((w) => w.topicId === TOPIC);

test('the fixtures really are the corpus: the topic has written cards to cite', () => {
  assert.ok(cardsFor(TOPIC).length >= 2, 'the topic has at least two real cards');
  assert.ok(material[TOPIC].cards > 0);
  assert.ok(live.length > 200, `only ${live.length} live concepts were read`);
});

// ── The start rule ──────────────────────────────────────────────────────────

test('4 wrong answers do not raise a weakness; the 5th does', () => {
  const four = only(run(seqRows('wwww')));
  assert.equal(four.status, 'watching');
  assert.equal(four.situation, 'not-enough');
  const five = only(run(seqRows('wwwww')));
  assert.equal(five.status, 'active');
  assert.equal(five.situation, 'repeated');
  assert.equal(WRONG_TO_RAISE, 5, 'the blueprint number');
});

test('5 wrong answers count even when correct ones come between them', () => {
  // Never 5 correct in a row, so nothing clears; 5 wrong in total.
  const w = only(run(seqRows('wcwcwcwcw')));
  assert.equal(w.status, 'active');
  assert.equal(w.wrongCount, 5);
});

// ── The clearing rule ───────────────────────────────────────────────────────

test('it clears after 5 consecutive correct answers, and not after 4', () => {
  const four = only(run(seqRows('wwwwwcccc')));
  assert.notEqual(four.status, 'cleared');
  assert.equal(four.recheck.state, 'in-progress');
  assert.equal(four.recheck.correctInARow, 4);
  const five = only(run(seqRows('wwwwwccccc')));
  assert.equal(five.status, 'cleared');
  assert.equal(five.recheck.state, 'passed');
  assert.equal(CORRECT_TO_CLEAR, 5);
});

test('a wrong answer in the middle restarts the count of correct ones', () => {
  // 4 + 4 correct is 8 correct answers but never 5 consecutive.
  const w = only(run(seqRows('wwwwwccccwcccc')));
  assert.equal(w.status, 'improving', 'still raised, though its latest run is 4 long');
  assert.equal(w.correctRun, 4);
});

test('5 consecutive correct also empties the tally of a topic never raised', () => {
  // [interpretation 2 in weakness.ts]. Without it this is 6 wrong answers in
  // total and would be raised on the second burst.
  const w = only(run(seqRows('wwwcccccwww')));
  assert.equal(w.status, 'watching');
  assert.equal(w.wrongCount, 3);
});

test('after clearing it can be raised again by 5 new wrong answers', () => {
  const w = only(run(seqRows('wwwwwcccccwwwww')));
  assert.equal(w.status, 'active');
  assert.equal(w.recheck.state, 'not-started');
});

test('what counts as wrong: a verdict beats a grade, Again is wrong, Hard is not', () => {
  assert.equal(isWrong({ isCorrect: false, grade: 4 }), true);
  assert.equal(isWrong({ isCorrect: true, grade: 1 }), false);
  assert.equal(isWrong({ isCorrect: null, grade: 1 }), true, 'a self-rated Again');
  assert.equal(isWrong({ isCorrect: null, grade: 2 }), false, 'Hard is a recalled card');
  assert.equal(isWrong({ isCorrect: null, grade: 3 }), false);
  assert.equal(walk([]).active, false);
});

test('row order does not matter', () => {
  const rows = seqRows('wwwwwccc');
  const shuffled = [...rows].reverse();
  assert.deepEqual(run(shuffled).all, run(rows).all);
});

// ── The four situations ─────────────────────────────────────────────────────

test('(a) too little data: says so, and offers an optional check, not a verdict', () => {
  const rep = run(seqRows('wcw'));
  const w = only(rep);
  assert.equal(w.situation, 'not-enough');
  assert.equal(w.action.kind, 'diagnostic');
  const d = describe(w, en, 'Definite article');
  assert.match(d.reason, /not enough yet to conclude/i);
  assert.match(d.action, /optional/i);
  assert.equal(rep.shown, w, 'it is the suggestion on screen when nothing stronger exists');
});

test('(b) a repeated error: names the topic, shows the evidence and the practice', () => {
  const rep = run(seqRows('wcwwwcww'));
  const w = only(rep);
  assert.equal(w.situation, 'repeated');
  const d = describe(w, en, 'Definite article');
  assert.match(d.reason, /in your last few exercises you needed/i);
  assert.match(d.reason, /Definite article/);
  assert.equal(w.example.response, 'wrong-answer', 'a concrete error example');
  assert.ok(cardsFor(TOPIC).some((c) => c.fr === w.example.front), 'a real card front');
  assert.equal(w.evidence.length, 3);
  assert.ok(w.evidence[0].at > w.evidence[2].at, 'newest first');
  assert.equal(w.action.minutes, 5);
  assert.equal(w.action.to, `/practise/review?concept=${TOPIC}`, 'the real practice route');
  assert.equal(w.explainTo, `/learn/concept/${TOPIC}`);
  // Where the concept has no flashcards, the link goes to the topic page and
  // not to a review route that would be empty.
  const bare = analyse(seqRows('wwwww'), { now: NOW, hasCards: () => false });
  assert.equal(bare.all[0].action.to, `/learn/concept/${TOPIC}`);
});

test('(c) listening trouble while the written answers are fine', () => {
  const rows = [
    ...seqRows('ccc', { start: 0 }),
    ...seqRows('wwwww', { start: 3, audio: true }),
  ];
  const w = only(run(rows));
  assert.equal(w.situation, 'listening');
  assert.equal(w.action.kind, 'short-listening');
  const d = describe(w, en, 'Definite article');
  assert.match(d.reason, /listening/i);
  assert.match(d.reason, /shorter clips/i);
  assert.match(d.note, /not built yet/i, 'it says the clips are not built');

  // Control: the same five audio misses with the written ones also going
  // wrong is NOT a listening problem.
  const both = [...seqRows('wcwc', { start: 0 }), ...seqRows('wwwww', { start: 4, audio: true })];
  assert.equal(only(run(both)).situation, 'repeated');
  // And too few written answers to say they are fine.
  const fewText = [...seqRows('cc', { start: 0 }), ...seqRows('wwwww', { start: 2, audio: true })];
  assert.equal(only(run(fewText)).situation, 'repeated');
});

test('(d) improvement after practice: lighter practice, later review', () => {
  const mid = only(run(seqRows('wwwwwccc')));
  assert.equal(mid.situation, 'improving');
  assert.equal(mid.action.kind, 'lighter');
  assert.match(describe(mid, en, 'X').reason, /improved in later review/i);
  const done = only(run(seqRows('wwwwwccccc')));
  assert.equal(done.situation, 'improving');
  assert.equal(done.status, 'cleared');
  assert.match(describe(done, en, 'X').action, /lighter/i);
  // Two correct in a row is not yet an improvement worth saying.
  assert.equal(only(run(seqRows('wwwwwcc'))).situation, 'repeated');
});

test('a cleared topic is mentioned for 14 days and then left alone', () => {
  const rows = seqRows('wwwwwccccc');
  const clearedAt = rows.at(-1).reviewedAt;
  assert.ok(only(analyse(rows, { now: clearedAt + CLEARED_SHOWN_MS - 1 })));
  assert.equal(only(analyse(rows, { now: clearedAt + CLEARED_SHOWN_MS + 1 })), undefined);
});

// ── No mastery percentage, no native-language inference ─────────────────────

test('no output a learner can read contains a percentage or a mastery figure', () => {
  const situations = [
    seqRows('wcw'), seqRows('wwwww'), seqRows('wwwwwccc'), seqRows('wwwwwccccc'),
    [...seqRows('ccc'), ...seqRows('wwwww', { start: 3, audio: true })],
  ];
  const seen = new Set();
  for (const rows of situations) {
    const rep = run(rows);
    const w = only(rep);
    seen.add(w.situation + '/' + w.status);
    for (const tr of [en, fr]) {
      const d = describe(w, tr, 'Définition');
      const all = Object.values(d).filter(Boolean).join(' | ');
      assert.doesNotMatch(all, /%|per ?cent|pour ?cent|mastery|maîtrise|score/i, all);
    }
    assert.doesNotMatch(JSON.stringify(rep), /%|percent|mastery/i);
  }
  assert.equal(seen.size, 5, `every situation was exercised, got ${[...seen]}`);
});

test('no string in the weakness group, and no line of the card, carries a percentage', () => {
  const i18n = text('web/src/lib/locales/en/weaknessEn.ts');
  const group = /const weaknessEn = \{([\s\S]*?)\n\};/.exec(i18n)[1];
  assert.ok(group.length > 2000, 'the group was extracted');
  assert.doesNotMatch(group, /%|percent|mastery/i);
  const fr = text('web/src/lib/locales/fr.ts');
  const frGroup = fr.slice(fr.indexOf('wkHeading'));
  assert.doesNotMatch(frGroup, /%|pourcent|maîtrise/i);
  const card = text('web/src/features/weakness/WeaknessCard.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(card, /%|Math\.round|\* ?100|accuracy|mastery|<progress|role="meter"/);
});

test('the engine cannot see a native language, and says the threshold is not science', () => {
  const src = text('web/src/lib/weakness.ts');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /locale|navigator|language|settings|\bfa\b|\bar\b|persian|farsi/i,
    'nothing in the code can read who the learner is');
  assert.equal(analyse.length, 2, 'analyse takes rows and options, and options has no locale');
  assert.match(src, /an engineering contract, not a proven scientific\s+\*?\s*criterion/);
  assert.match(en('wkThresholdNote'), /engineering choice/);
  assert.match(en('wkThresholdNote'), /not a proven scientific criterion/);
  assert.match(fr('wkThresholdNote'), /pas un critère scientifique démontré/);
});

test('the module is importable in plain Node: no runtime import at the top level', () => {
  const src = text('web/src/lib/weakness.ts');
  const imports = [...src.matchAll(/^import\s+(?!type\b).*$/gm)];
  assert.deepEqual(imports.map((m) => m[0]), [], 'only `import type` at the top');
  assert.match(src, /await import\('\.\/db'\)/, 'IndexedDB is loaded lazily');
});

// ── Not a guilt trip: one at a time, postpone, ignore ───────────────────────

test('one suggestion at a time, with the rest counted and not listed', () => {
  const topics = ['gram.article.definite', 'gram.article.partitive', 'gram.future.simple'];
  const rows = topics.flatMap((topic, k) => seqRows('wwwww', { topic, start: k * 10 }));
  const rep = run(rows);
  assert.equal(rep.all.length, 3);
  assert.ok(rep.shown);
  assert.equal(rep.waiting, 2);
  assert.equal(rep.shown.topicId, 'gram.future.simple', 'the most recent first');
});

test('postponing hides it for 7 days, then it may return once', () => {
  const rows = seqRows('wwwww');
  const at = NOW;
  const hidden = analyse(rows, { now: at + 1000, choices: { [TOPIC]: { mode: 'postponed', at } } });
  assert.equal(hidden.shown, null);
  assert.equal(hidden.postponed.length, 1);
  assert.equal(hidden.postponed[0].hiddenUntil, at + POSTPONE_MS);
  const back = analyse(rows, { now: at + POSTPONE_MS + 1, choices: { [TOPIC]: { mode: 'postponed', at } } });
  assert.equal(back.shown?.topicId, TOPIC);
});

test('ignoring it stays ignored until 5 NEW answers go wrong', () => {
  const old = seqRows('wwwww', { start: 0 });
  const at = old.at(-1).reviewedAt + 1;
  const choices = { [TOPIC]: { mode: 'ignored', at } };
  assert.equal(analyse(old, { now: NOW, choices }).shown, null);
  const fourNew = [...old, ...seqRows('wwww', { start: 20 })];
  assert.equal(analyse(fourNew, { now: NOW, choices }).shown?.situation ?? 'none', 'not-enough');
  const fiveNew = [...old, ...seqRows('wwwww', { start: 20 })];
  assert.equal(analyse(fiveNew, { now: NOW, choices }).shown?.situation, 'repeated');
});

test('choices survive storage that throws, and report that they could not be saved', () => {
  // Plain Node has no localStorage: every write "throws" here, as in a private
  // window. The choice must still hold for this tab and say it did not persist.
  assert.equal(saveChoice('u-private', TOPIC, 'ignored', 5), false);
  assert.deepEqual(loadChoices('u-private'), { [TOPIC]: { mode: 'ignored', at: 5 } });
  assert.deepEqual(loadChoices('someone-else'), {}, 'never another learner\'s choices');
});

test('empty history is empty, not an accusation', () => {
  const rep = run([]);
  assert.equal(rep.empty, true);
  assert.equal(rep.shown, null);
  assert.deepEqual(rep.all, []);
});

// ── The whole corpus (AGENTS.md §3) ─────────────────────────────────────────

test('every live concept can be raised, named in English and French, and linked somewhere real', () => {
  const problems = [];
  let review = 0, topicPage = 0;
  for (const c of live) {
    const rows = [...'wwwww'].map((_, i) => ({
      ...row(false, i), conceptIds: [c.id],
    }));
    const rep = analyse(rows, {
      now: NOW, hasCards: (id) => (material[id]?.cards ?? 0) > 0,
    });
    const w = rep.all[0];
    if (!w || w.topicId !== c.id || w.status !== 'active') { problems.push(`${c.id} was not raised`); continue; }
    const enName = pick(c.name, 'en');
    const frName = pick(c.name, 'fr');
    if (!enName.translated) problems.push(`${c.id} has no English name`);
    if (!frName.translated) problems.push(`${c.id} has no French name`);
    const expectReview = (material[c.id]?.cards ?? 0) > 0;
    if (expectReview) review++; else topicPage++;
    if (w.action.to !== (expectReview ? `/practise/review?concept=${encodeURIComponent(c.id)}`
      : `/learn/concept/${encodeURIComponent(c.id)}`)) problems.push(`${c.id} links to ${w.action.to}`);
    const shown = [describe(w, en, enName.text), describe(w, fr, frName.text)]
      .flatMap((d) => Object.values(d)).filter(Boolean).join(' ');
    if (/%/.test(shown)) problems.push(`${c.id} renders a percent sign`);
  }
  assert.deepEqual(problems, []);
  assert.equal(review, 29, 'concepts with flashcards: counted from concept-material.json');
  assert.equal(review + topicPage, live.length);
});
