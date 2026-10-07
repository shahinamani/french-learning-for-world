/**
 * The landing page's numbers, checked against the content they describe.
 *
 * A stranger's first screen says "2,387 verbs" and "196 of 261 points have
 * nothing to practise". Those are the claims most likely to be believed and
 * least likely to be re-measured — this repository has already shipped a
 * comment stating 26 KB about a 71 KB file for several commits, because the
 * number was typed once and nothing checked it afterwards.
 *
 * So these checks RECOMPUTE each figure from the content rather than asserting
 * a constant. A test asserting `verbs === 2387` would be a second place for the
 * same number to go stale, and would pass happily after somebody deleted half
 * the verbs. What is asserted here is agreement between two readings of one
 * corpus, plus floors that make "it read nothing" fail rather than pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, 'content', p), 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const summary = read('portal-summary.json');

test('the file exists, is small, and says where it comes from', () => {
  const bytes = readFileSync(join(root, 'content/portal-summary.json')).length;
  assert.ok(bytes < 2048, `${bytes} bytes — this is imported into the bundle, keep it small`);
  assert.match(summary.note, /portal-summary\.py/);
  assert.match(summary.note, /recomputes/);
});

test('the verb figures match the verb content', () => {
  const index = read('verbs-index.json').verbs;
  assert.ok(index.length > 2000, 'the index was not read');
  assert.equal(summary.verbs, index.length);
  for (const lvl of LEVELS) {
    assert.equal(summary.verbsByLevel[lvl], index.filter((v) => v.level === lvl).length,
      `verbsByLevel.${lvl} is stale`);
  }
  assert.equal(summary.formsSearchable, Object.keys(read('verb-forms.json').forms).length);

  // The drilled count applies the same rule as the material build: only what a
  // learner is asked to PRODUCE. If these two ever disagree, one of them is
  // promising practice that no screen offers.
  let drilled = 0;
  for (const lvl of LEVELS) {
    for (const verb of read(`verbs/${lvl}.json`).verbs) {
      if (verb.produce === false) continue;
      for (const t of verb.tenses) {
        if (t.conceptId && t.produced) drilled += t.forms.filter(Boolean).length;
      }
    }
  }
  assert.equal(summary.formsDrilled, drilled);
  assert.ok(drilled > 50000, `only ${drilled} drilled forms — the shards were not read`);
  assert.ok(summary.formsDrilled < summary.formsSearchable,
    'more forms drilled than exist is impossible');
});

test('the flashcard figure is cards, not card-concept pairs', () => {
  const decks = read('decks.json').decks;
  const cards = decks.reduce((n, d) => n + read(d.file).cards.length, 0);
  assert.equal(summary.cards, cards);
  assert.equal(summary.cardDecks, decks.length);
  // The trap this file exists to avoid: concept-material.json advertises a
  // larger "cards" figure because a card tagged with four concepts counts four
  // times. Fine in a build report, a 46% overstatement on a front page.
  const attributions = read('concept-material.json');
  const advertised = Number((attributions.theOneNumber.match(/· ([\d,]+) flashcards/) ?? [])[1]
    ?.replace(/,/g, ''));
  if (Number.isFinite(advertised)) {
    assert.notEqual(summary.cards, advertised + 1e-9);
    assert.ok(summary.cards <= advertised,
      'the landing figure must not exceed the attribution count');
  }
});

test('the exam figures match the papers, and nothing is called reviewed that is not', () => {
  const papers = read('exam-papers.json').papers;
  assert.equal(summary.papers, papers.length);
  assert.equal(summary.examItems, papers.reduce((n, p) => n + p.items.length, 0));

  const approved = papers.flatMap((p) => p.items)
    .filter((i) => (i.review || {}).state === 'approved').length;
  assert.equal(summary.examItemsReviewed, approved);
  assert.ok(summary.examItemsReviewed <= summary.examItems);

  const coverage = {};
  for (const p of papers) {
    const family = (p.exam || p.id.split('-')[0]).toUpperCase();
    (coverage[family] ??= new Set()).add(p.level);
  }
  assert.deepEqual(Object.keys(summary.paperCoverage).sort(), Object.keys(coverage).sort());
  for (const [family, levels] of Object.entries(coverage)) {
    assert.deepEqual(summary.paperCoverage[family], [...levels].sort(), `${family} coverage`);
  }
});

test('the concept figures match, and the ceiling is derived rather than declared', () => {
  const concepts = read('concepts.json').concepts;
  const live = concepts.filter((c) => !c.isGroup && !c.retired);
  const material = read('concept-material.json').material;
  const withMaterial = live.filter((c) => c.id in material);

  assert.equal(summary.liveConcepts, live.length);
  assert.equal(summary.conceptsWithMaterial, withMaterial.length);
  assert.equal(summary.conceptsWithoutMaterial, live.length - withMaterial.length);
  assert.equal(summary.conceptsWithMaterial + summary.conceptsWithoutMaterial,
    summary.liveConcepts, 'the two halves do not add up to the whole');

  // "Practice stops at B2" is a claim about the content. Deriving it means that
  // the day one C1 exercise lands, the landing page stops saying B2 without
  // anybody remembering to edit a string.
  const levelled = LEVELS.filter((lvl) => withMaterial.some((c) => c.level === lvl));
  assert.equal(summary.practiceCeiling, levelled[levelled.length - 1] ?? null);
  assert.ok(summary.conceptsWithoutMaterial > 0,
    'if every concept has material the honesty section needs rewriting, not this test');
});

test('an examination counts as verified only if its structure carries a read date', () => {
  const exams = read('exams.json').exams.filter((e) => e.preparationOffered);
  const verified = exams.filter((e) => (e.structure || {}).verifiedOn).map((e) => e.code);
  const unverified = exams.filter((e) => !(e.structure || {}).verifiedOn).map((e) => e.code);

  assert.deepEqual(summary.examsVerified, [...verified].sort());
  assert.deepEqual(summary.examsUnverified, [...unverified].sort());
  assert.ok(exams.length > 0, 'no examination offers preparation — the file was not read');

  // Seen the wrong way round once: the first version of the generator asked for
  // a `structureUnverifiedWhileOffering` flag that does not exist in this file,
  // so every examination came back verified — including TEF, whose own note
  // reads "NOT VERIFIED" in capitals. The page would have told a stranger we
  // had checked a grid nobody has opened.
  for (const e of exams) {
    const claimed = summary.examsVerified.includes(e.code);
    const note = ((e.structure || {}).note || '');
    if (/NOT VERIFIED/i.test(note)) {
      assert.equal(claimed, false,
        `${e.code} says NOT VERIFIED in its own note and the summary calls it verified`);
    }
  }
});

test('the generator is deterministic — running it twice changes nothing', () => {
  const before = readFileSync(join(root, 'content/portal-summary.json'), 'utf8');
  execFileSync('python3', [join(root, 'scripts/build-portal-summary.py')],
    { cwd: root, encoding: 'utf8' });
  const after = readFileSync(join(root, 'content/portal-summary.json'), 'utf8');
  assert.equal(after, before,
    'the summary on disk is stale, or the generator is not deterministic — '
    + 'run scripts/build-portal-summary.py and commit the result');
});
