/**
 * The verb flashcards (content/verb-cards/<level>.json), built from the verb
 * tables by scripts/build-verb-cards.py. Added 2026-11-02 when the owner asked
 * for 200–500 cards per level; these checks compare each card with the table
 * it was built from, not with itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const read = (p) => JSON.parse(readFileSync(new URL(`../content/${p}`, import.meta.url), 'utf8'));
const decks = Object.fromEntries(LEVELS.map((l) => [l, read(`verb-cards/${l}.json`)]));
const tables = Object.fromEntries(LEVELS.map((l) =>
  [l, new Map(read(`verbs/${l}.json`).verbs.map((v) => [v.key, v]))]));

// Counted as the learner meets them: the verb cards plus the written cards of
// that level that are not the same verb (the session merges the two). Counting
// one file alone would compare the wrong thing: A1 has 199 verb cards once a
// vulgar verb is held back, and 208 cards on screen.
const fold = (k) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const written = read('fr-core-a1.json').cards;
test('every level offers between 200 and 500 cards, and the count field says so', () => {
  for (const l of LEVELS) {
    const verbs = new Set(decks[l].cards.map((c) => fold(c.key)));
    const extra = written.filter((c) => c.level === l && !verbs.has(fold(c.key))).length;
    const n = decks[l].cards.length + extra;
    assert.ok(n >= 200 && n <= 500, `${l}: ${n}`);
    assert.equal(decks[l].count, decks[l].cards.length);
  }
});

test('every drafted sentence passes the table check', () => {
  execFileSync('python3', [new URL('../scripts/check-verb-sentences.py', import.meta.url).pathname]);
});

test('a card with sentences carries both tenses, translated, and is marked as a draft', () => {
  for (const l of LEVELS) {
    if (!decks[l].sentences) continue;
    assert.match(decks[l].sentences, /NOT REVIEWED/);
    for (const c of decks[l].cards) {
      assert.deepEqual(c.examples.map((e) => e.tense), ['past', 'future'], c.key);
      for (const e of c.examples) assert.ok(e.translations.en && e.translations.fa, c.key);
    }
  }
});

test('the committed files are what the script builds today', () => {
  const before = LEVELS.map((l) => readFileSync(new URL(`../content/verb-cards/${l}.json`, import.meta.url), 'utf8'));
  execFileSync('python3', [new URL('../scripts/build-verb-cards.py', import.meta.url).pathname]);
  const after = LEVELS.map((l) => readFileSync(new URL(`../content/verb-cards/${l}.json`, import.meta.url), 'utf8'));
  assert.deepEqual(after, before, 'content/verb-cards is stale: run scripts/build-verb-cards.py');
});

test('keys are unique across levels and each is a verb of that level', () => {
  const seen = new Set();
  for (const l of LEVELS) for (const c of decks[l].cards) {
    assert.ok(!seen.has(c.key), c.key); seen.add(c.key);
    assert.ok(tables[l].has(c.key), `${c.key} is not in verbs/${l}.json`);
  }
});

test('the past is il + the right auxiliary + the table\'s participle; the future is the table\'s il form', () => {
  for (const l of LEVELS) for (const c of decks[l].cards) {
    const v = tables[l].get(c.key);
    const pronominal = Boolean(v.headword);
    const aux = pronominal || v.auxiliary === 'être' ? 'est' : 'a';
    assert.ok(c.past.form.endsWith(`${aux} ${v.participles.past}`), `${c.fr}: ${c.past.form}`);
    const futur = v.tenses.find((t) => t.id === 'futur').forms[2];
    assert.ok(c.future.form.endsWith(futur), `${c.fr}: ${c.future.form}`);
    for (const k of ['past', 'future']) {
      assert.equal(c[k].fr, `il ${c[k].form}`);
      if (pronominal) assert.match(c[k].form, /^(se |s')/, `${c.fr} ${k}`);
      else assert.doesNotMatch(c[k].form, /^(se |s')/, `${c.fr} ${k}`);
    }
    assert.equal(c.fr, v.headword || v.infinitive);
  }
});

test('a pronominal form elides before a vowel and only then', () => {
  for (const l of LEVELS) for (const c of decks[l].cards) for (const k of ['past', 'future']) {
    const m = c[k].form.match(/^(se |s')(.)/);
    if (!m) continue;
    const vowel = /[aàâäeéèêëiîïoôöuùûüy]/i.test(m[2]);
    assert.equal(m[1] === "s'", vowel, `${c.fr}: ${c[k].form}`);
  }
});
