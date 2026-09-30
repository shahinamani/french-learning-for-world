/**
 * The exam papers. These items are the only content in the project a learner is
 * scored on, so the invariants are stricter than for flashcards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const papers = JSON.parse(readFileSync(new URL('../content/exam-papers.json', import.meta.url), 'utf8'));
const concepts = JSON.parse(readFileSync(new URL('../content/concepts.json', import.meta.url), 'utf8'));
const conceptIds = new Set(concepts.concepts.map((c) => c.id));
const items = papers.papers.flatMap((p) => p.items.map((i) => ({ ...i, paper: p.id })));

test('there are papers, and every one has items', () => {
  assert.ok(papers.papers.length >= 3, 'at least three papers');
  for (const p of papers.papers) assert.ok(p.items.length >= 8, `${p.id} has items`);
});

test('every item joins the concept taxonomy', () => {
  for (const it of items) {
    assert.ok(it.conceptIds?.length, `${it.id} has concept ids`);
    for (const c of it.conceptIds) {
      assert.ok(conceptIds.has(c), `${it.id} references a real concept: ${c}`);
    }
  }
});

test('every item has a well-formed question', () => {
  for (const it of items) {
    assert.ok(it.options.length >= 3, `${it.id} offers a real choice`);
    assert.ok(Number.isInteger(it.answer), `${it.id} has an answer index`);
    assert.ok(it.answer >= 0 && it.answer < it.options.length, `${it.id} answer is in range`);
    assert.ok(it.explain?.en && it.explain?.fr, `${it.id} explains itself in en and fr`);
    const seen = new Set(it.options.map((o) => o.fr));
    assert.equal(seen.size, it.options.length, `${it.id} has no duplicate options`);
  }
});

/**
 * The first draft of this file had the correct answer at index 0 for all 28
 * items. Every check above passed. A learner would have noticed in two
 * questions, which is the point: correctness tests do not catch a paper that is
 * merely useless.
 */
test('the correct answer is not always in the same position', () => {
  const byIndex = new Map();
  for (const it of items) byIndex.set(it.answer, (byIndex.get(it.answer) ?? 0) + 1);
  assert.ok(byIndex.size >= 3, 'answers are spread over at least three positions');
  const worst = Math.max(...byIndex.values());
  assert.ok(worst / items.length < 0.5,
    `no position holds half the answers (worst ${worst}/${items.length})`);
});

test('ids are unique', () => {
  const ids = items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique');
  const pids = papers.papers.map((p) => p.id);
  assert.equal(new Set(pids).size, pids.length, 'paper ids are unique');
});

test('every paper is timed and says how it differs from the real thing', () => {
  for (const p of papers.papers) {
    assert.ok(p.minutes > 0, `${p.id} has a duration`);
    assert.ok(p.official?.source, `${p.id} records where its format facts came from`);
    assert.ok(p.practiceNote, `${p.id} states how it differs from a real paper`);
  }
});

/**
 * The hard rule from docs/02. Real exam papers are copyright of the bodies that
 * administer them; nothing here may be taken from one.
 */
test('nothing is attributed to a past paper, textbook or course', () => {
  // The papers only — NOT the top-level `note`, which exists precisely to say
  // that no past paper was used and therefore contains the forbidden phrases.
  // The first version of this test scanned the whole file and failed on the
  // project's own disclaimer: a check reading something other than what it
  // names (docs/lessons.md #6).
  const text = JSON.stringify(papers.papers).toLowerCase();
  for (const forbidden of ['annales', 'past paper', 'sujet officiel', 'vite et bien',
    'les mots de l’info', 'hachette', 'clé international', 'didier']) {
    assert.ok(!text.includes(forbidden), `no reference to ${forbidden}`);
  }
  assert.ok(papers.note.includes('original'), 'the file states its content is original');
  assert.ok(papers.licence?.shortName, 'the file carries its licence');
});

test('French text uses typographic apostrophes, not primes', () => {
  // Only the `fr` fields. The first version walked every string and failed on
  // "the TCF's own scale" in an English note, where a straight apostrophe is
  // correct — the check was not looking at what it named.
  const offenders = [];
  const walk = (v, path, inFrench) => {
    if (typeof v === 'string') {
      if (inFrench && /\w'\w/.test(v)) offenders.push(`${path}: ${v.slice(0, 50)}`);
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, inFrench || k === 'fr');
    }
  };
  walk(papers.papers, 'papers', false);
  assert.deepEqual(offenders, [], 'no straight apostrophes in French content');
});

test('the apostrophe check is looking at French, and would catch a prime there', () => {
  // Proving the check above can fail, since it was wrong once already.
  const offenders = [];
  const walk = (v, path, inFrench) => {
    if (typeof v === 'string') {
      if (inFrench && /\w'\w/.test(v)) offenders.push(path);
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, inFrench || k === 'fr');
    }
  };
  walk({ good: { fr: 'l\u2019\u00e9l\u00e8ve' }, bad: { fr: "l'eleve" }, english: "the TCF's scale" }, 'x', false);
  assert.deepEqual(offenders, ['x.bad.fr'], 'catches a prime in French, ignores English');
});
