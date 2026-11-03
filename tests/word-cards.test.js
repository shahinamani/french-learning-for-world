/**
 * The noun and adjective flashcards (content/word-cards/<level>.json), added
 * 2026-11-03. The word, its gender, plural and feminine come from Lexique
 * (data/word-frequency-list.json); meanings, the article and the example are
 * drafted (content/word-sentences) and checked by scripts/check-word-sentences.py.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const script = (name) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));
const list = read('data/word-frequency-list.json').words;
const decks = Object.fromEntries(LEVELS.map((l) => [l, read(`content/word-cards/${l}.json`)]));

test('the word list is 2,400 words in the verb bands: 200, 300, 400, 500, 500, 500', () => {
  assert.equal(list.length, 2400);
  const per = LEVELS.map((l) => list.filter((w) => w.level === l).length);
  assert.deepEqual(per, [200, 300, 400, 500, 500, 500]);
});

test('every drafted entry passes the check against the word list', () => {
  execFileSync('python3', [script('check-word-sentences.py')]);
});

test('the committed card files are what the script builds today', () => {
  const files = [...LEVELS.map((l) => `content/word-cards/${l}.json`), 'content/word-cards/index.json'];
  const before = files.map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
  execFileSync('python3', [script('build-word-cards.py')]);
  const after = files.map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
  assert.deepEqual(after, before, 'content/word-cards is stale: run scripts/build-word-cards.py');
});

test('every level has between 200 and 500 word cards, less only what was held back', () => {
  for (const l of LEVELS) {
    const n = decks[l].cards.length;
    const held = read(`content/word-sentences/${l}.json`).entries.filter((e) => e.exclude).length;
    assert.equal(n + held, list.filter((w) => w.level === l).length, l);
    assert.ok(n >= 190 && n <= 500, `${l}: ${n}`);
  }
});

test('a noun card shows an article that agrees with its gender', () => {
  for (const l of LEVELS) for (const c of decks[l].cards.filter((x) => x.type === 'noun')) {
    if (c.article === 'le') assert.notEqual(c.gender, 'f', c.key);
    if (c.article === 'la') assert.notEqual(c.gender, 'm', c.key);
    assert.ok(['m', 'f', 'mf'].includes(c.gender), `${c.key}: no gender`);
  }
});

test('no word card shares a key with a verb card', () => {
  const verbs = new Set(LEVELS.flatMap((l) => read(`content/verb-cards/${l}.json`).cards.map((c) => c.key)));
  for (const l of LEVELS) for (const c of decks[l].cards) assert.ok(!verbs.has(c.key), c.key);
});
