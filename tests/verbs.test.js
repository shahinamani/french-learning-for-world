import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = JSON.parse(readFileSync(new URL('../content/verbs.json', import.meta.url), 'utf8'));
const concepts = JSON.parse(readFileSync(new URL('../content/concepts.json', import.meta.url), 'utf8'));
const conceptIds = new Set(concepts.concepts.map((c) => c.id));
const byInf = new Map(doc.verbs.map((v) => [v.infinitive, v]));

test('every verb has every tense, for all six persons', () => {
  for (const v of doc.verbs) {
    assert.equal(v.persons.length, 6, v.infinitive);
    assert.ok(v.tenses.length >= 6, `${v.infinitive} has only ${v.tenses.length} tenses`);
    for (const t of v.tenses) {
      assert.equal(t.forms.length, 6, `${v.infinitive} ${t.id}`);
      for (const f of t.forms) assert.ok(f && f.trim(), `${v.infinitive} ${t.id} has an empty form`);
    }
  }
});

test('every tense names the concept it exercises, and it exists', () => {
  for (const v of doc.verbs) {
    for (const t of v.tenses) {
      assert.ok(t.conceptId, `${v.infinitive} ${t.id} names no concept`);
      assert.ok(conceptIds.has(t.conceptId), `${v.infinitive} ${t.id}: ${t.conceptId} is not in the taxonomy`);
    }
    assert.ok(v.conceptIds.length > 0, v.infinitive);
    for (const id of v.conceptIds) assert.ok(conceptIds.has(id), `${v.infinitive}: ${id}`);
  }
});

test('irregular verbs are marked, and the regular ones are not', () => {
  for (const inf of ['être', 'avoir', 'aller', 'faire', 'pouvoir', 'vouloir', 'devoir', 'dire', 'voir', 'prendre']) {
    assert.equal(byInf.get(inf)?.irregular, true, inf);
  }
  for (const inf of ['parler', 'manger', 'commencer', 'finir']) {
    assert.equal(byInf.get(inf)?.irregular, false, inf);
  }
});

test('known forms are right — spot checks a French teacher would make', () => {
  const at = (inf, tense, person) => byInf.get(inf).tenses.find((t) => t.id === tense).forms[person];
  assert.equal(at('être', 'present', 4), 'êtes');
  assert.equal(at('être', 'imparfait', 0), 'étais');          // not "sois"
  assert.equal(at('aller', 'futur', 0), 'irai');              // suppletive stem
  assert.equal(at('faire', 'present', 4), 'faites');
  assert.equal(at('pouvoir', 'subjonctif', 0), 'puisse');
  assert.equal(at('commencer', 'imparfait', 0), 'commençais'); // cedilla before a
  assert.equal(at('commencer', 'imparfait', 3), 'commencions');// but not before i
  assert.equal(at('manger', 'imparfait', 0), 'mangeais');      // e kept before a
  assert.equal(at('manger', 'imparfait', 3), 'mangions');      // dropped before i
  assert.equal(at('finir', 'present', 3), 'finissons');        // second group
  assert.equal(at('prendre', 'present', 5), 'prennent');
  assert.equal(at('voir', 'futur', 0), 'verrai');
});

test('the conditional is the future stem with imperfect endings', () => {
  for (const v of doc.verbs) {
    const fut = v.tenses.find((t) => t.id === 'futur').forms[0];      // …ai
    const cond = v.tenses.find((t) => t.id === 'conditionnel').forms[0]; // …ais
    assert.equal(cond, fut.slice(0, -2) + 'ais', v.infinitive);
  }
});

test('verbs taking être are marked and conjugate their perfect with it', () => {
  const aller = byInf.get('aller');
  assert.equal(aller.auxiliary, 'être');
  assert.match(aller.tenses.find((t) => t.id === 'passe-compose').forms[0], /^suis /);
  assert.equal(aller.tenses.find((t) => t.id === 'passe-compose').conceptId, 'gram.past.pc-etre');
  const parler = byInf.get('parler');
  assert.equal(parler.auxiliary, 'avoir');
  assert.match(parler.tenses.find((t) => t.id === 'passe-compose').forms[0], /^ai /);
});

test('verbs with no imperative say so rather than inventing one', () => {
  // pouvoir and devoir have no imperative in ordinary French.
  assert.equal(byInf.get('pouvoir').imperative, null);
  assert.equal(byInf.get('devoir').imperative, null);
  assert.deepEqual(byInf.get('dire').imperative, ['dis', 'disons', 'dites']);
});

test('no straight apostrophes anywhere in the verb data', () => {
  assert.doesNotMatch(JSON.stringify(doc), /\w'\w/);
});

test('every verb carries its provenance and licence', () => {
  for (const v of doc.verbs) {
    assert.equal(v.provenance, 'original');
    assert.ok(v.licence);
  }
});
