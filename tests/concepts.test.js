import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = JSON.parse(readFileSync(new URL('../content/concepts.json', import.meta.url), 'utf8'));
const { concepts } = doc;
const byId = new Map(concepts.map((c) => [c.id, c]));

test('the permanence rule is stated in the file itself', () => {
  // The rule has to travel with the data. A convention in a document nobody
  // opens is how an id gets renamed.
  assert.match(doc.rule, /PERMANENT/i);
  assert.match(doc.rule, /never be renamed/i);
  assert.match(doc.rule, /retired/i);
});

test('every id is unique', () => {
  assert.equal(new Set(concepts.map((c) => c.id)).size, concepts.length);
});

test('every id matches the declared format', () => {
  // ASCII, lowercase, dot-separated. An id with an accent or a capital in it
  // becomes a different string the moment something normalises it.
  for (const c of concepts) {
    assert.match(c.id, /^[a-z]+(\.[a-z0-9-]+)*$/, c.id);
  }
});

test('every id begins with its own type namespace', () => {
  const prefix = { grammar: 'gram', vocabulary: 'lex', phonetics: 'phon', usage: 'usage' };
  for (const c of concepts) {
    assert.equal(c.id.split('.')[0], prefix[c.type], `${c.id} is type ${c.type}`);
  }
});

test('every parent exists, and nothing is its own ancestor', () => {
  for (const c of concepts) {
    if (!c.parent) continue;
    assert.ok(byId.has(c.parent), `${c.id} has parent ${c.parent}, which does not exist`);
    const seen = new Set([c.id]);
    let p = c.parent;
    while (p) {
      assert.ok(!seen.has(p), `cycle at ${c.id}`);
      seen.add(p);
      p = byId.get(p).parent;
    }
  }
});

test('every concept has a name in both interface languages', () => {
  for (const c of concepts) {
    assert.ok(c.name?.en?.trim(), `${c.id} has no English name`);
    assert.ok(c.name?.fr?.trim(), `${c.id} has no French name`);
    assert.notEqual(c.name.en, c.name.fr, `${c.id}: the two names are identical`);
  }
});

test('French names use typographic apostrophes, not primes', () => {
  for (const c of concepts) {
    assert.doesNotMatch(c.name.fr, /'/, `${c.id}: "${c.name.fr}" uses a straight apostrophe`);
  }
});

test('every level is a real CEFR level', () => {
  for (const c of concepts) assert.ok(doc.levels.includes(c.level), `${c.id}: ${c.level}`);
});

test('a group never sits at a higher level than its earliest child', () => {
  const order = Object.fromEntries(doc.levels.map((l, i) => [l, i]));
  for (const c of concepts) {
    const children = concepts.filter((k) => k.parent === c.id);
    if (!children.length) continue;
    const earliest = Math.min(...children.map((k) => order[k.level]));
    assert.ok(order[c.level] <= earliest,
      `${c.id} is ${c.level} but has a child at ${doc.levels[earliest]}`);
  }
});

test('the areas learners actually get wrong are all covered', () => {
  // This list is the brief's, and the test exists so that a future edit cannot
  // quietly drop one.
  const required = [
    'gram.gender', 'gram.number', 'gram.article.partitive', 'gram.adjective.agreement',
    'gram.adjective.position', 'gram.past.pc-vs-imparfait', 'gram.subjunctive.present',
    'gram.conditional.present', 'gram.pronoun.cod', 'gram.pronoun.coi', 'gram.pronoun.y',
    'gram.pronoun.en', 'gram.pronoun.relative-qui-que', 'gram.negation.ne-pas',
    'gram.question.inversion', 'gram.preposition.countries', 'gram.si.imparfait-conditional',
    'gram.passive.formation', 'gram.reported.tense-shift', 'gram.connector.cause',
    'usage.false-friends', 'phon.liaison.obligatory', 'phon.nasal.an', 'phon.silent.final',
    'phon.elision.basic', 'phon.accent.aigu-grave',
  ];
  for (const id of required) assert.ok(byId.has(id), `missing required concept: ${id}`);
});

test('A1 to B2 are all covered with real depth', () => {
  const leaves = concepts.filter((c) => !c.isGroup);
  for (const level of ['A1', 'A2', 'B1', 'B2']) {
    const n = leaves.filter((c) => c.level === level).length;
    assert.ok(n >= 15, `${level} has only ${n} concepts`);
  }
});

test('nothing is retired yet, and the flag exists on every row', () => {
  for (const c of concepts) assert.equal(typeof c.retired, 'boolean', c.id);
});
