import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardKey, normalise } from '../app/cardKey.js';
import { dictionaries } from '../app/i18n.js';

const index = JSON.parse(readFileSync(new URL('../content/decks.json', import.meta.url), 'utf8'));
const decks = index.decks.map((d) =>
  JSON.parse(readFileSync(new URL(`../content/${d.file}`, import.meta.url), 'utf8')));
const cards = decks.flatMap((d) => d.cards);

test('the index agrees with the decks it lists', () => {
  for (const [i, entry] of index.decks.entries()) {
    assert.equal(decks[i].id, entry.id);
    assert.equal(decks[i].cards.length, entry.count,
      `${entry.id}: index says ${entry.count}, deck holds ${decks[i].cards.length}`);
  }
});

test('every card key is unique', () => {
  const keys = cards.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('every key is derived from the card, so content can be re-sourced', () => {
  for (const c of cards) assert.equal(c.key, cardKey(c.type, c.fr), c.fr);
});

test('keys survive an accent or case correction', () => {
  assert.equal(normalise('Être'), normalise('etre'));
  assert.equal(cardKey('verb', 'ÊTRE'), cardKey('verb', 'être'));
});

test('every card states its own provenance and licence', () => {
  for (const c of cards) {
    assert.ok(c.provenance, `${c.fr} has no provenance`);
    assert.ok(c.licence, `${c.fr} has no licence`);
  }
});

test('no card is attributed to a textbook, course or other app', () => {
  // The rule this guards is in docs/content-provenance.md: a selection of
  // vocabulary is its compiler's work even when no sentence is copied.
  const forbidden = /textbook|manuel|vite et bien|commun fran|alter ego|edito|grammaire progressive|duolingo|anki shared|scraped/i;
  for (const c of cards) {
    assert.doesNotMatch(c.provenance, forbidden, `${c.fr}: ${c.provenance}`);
  }
});

test('every card carries an English and a Persian meaning', () => {
  for (const c of cards) {
    assert.ok(c.meanings?.en?.trim(), `${c.fr} has no English meaning`);
    assert.ok(c.meanings?.fa?.trim(), `${c.fr} has no Persian meaning`);
  }
});

test('every card has exactly one past and one future example', () => {
  for (const c of cards) {
    const tenses = c.examples.map((e) => e.tense).sort();
    assert.deepEqual(tenses, ['future', 'past'], `${c.fr}: ${tenses.join()}`);
  }
});

test('every example sentence is translated into English and Persian', () => {
  for (const c of cards) {
    for (const e of c.examples) {
      assert.ok(e.fr?.trim(), `${c.fr}: empty sentence`);
      assert.ok(e.translations?.en?.trim(), `${c.fr} / ${e.fr}: no English`);
      assert.ok(e.translations?.fa?.trim(), `${c.fr} / ${e.fr}: no Persian`);
    }
  }
});

test('Persian text is actually Persian', () => {
  const persian = /[؀-ۿ]/;
  for (const c of cards) {
    assert.match(c.meanings.fa, persian, `${c.fr}: meaning is not Persian script`);
    for (const e of c.examples) {
      assert.match(e.translations.fa, persian, `${c.fr} / ${e.fr}`);
    }
  }
});

test('each example declares the form it demonstrates, and contains it', () => {
  // A stem match cannot verify an irregular verb: neither "j'ai été" nor "je
  // serai" contains "être". So each example names the form it is there to
  // teach, which is checkable — and is what the card highlights for the
  // learner rather than leaving them to find it.
  for (const c of cards) {
    for (const e of c.examples) {
      assert.ok(e.form?.trim(), `${c.fr} / ${e.fr}: no form declared`);
      assert.ok(normalise(e.fr).includes(normalise(e.form)),
        `${c.fr}: the form "${e.form}" does not appear in "${e.fr}"`);
    }
  }
});

test('a verb card demonstrates two different forms, not the same one twice', () => {
  for (const c of cards.filter((x) => x.type === 'verb')) {
    const [past, future] = c.examples.map((e) => normalise(e.form));
    assert.notEqual(past, future, `${c.fr}: both examples show "${past}"`);
  }
});

test('every noun declares its gender and article', () => {
  for (const c of cards.filter((x) => x.type === 'noun')) {
    assert.ok(['m', 'f'].includes(c.gender), `${c.fr}: gender ${c.gender}`);
    assert.ok(c.article, `${c.fr}: no article`);
  }
});

test('every card sits at a real CEFR level', () => {
  for (const c of cards) {
    assert.ok(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(c.level), `${c.fr}: ${c.level}`);
  }
});

test('no content field carries anything shaped like a credential', () => {
  const raw = JSON.stringify(decks);
  for (const pattern of [/AKIA[0-9A-Z]{16}/, /\bsk-[A-Za-z0-9]{20,}/, /BEGIN [A-Z ]*PRIVATE KEY/,
                         /(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/]) {
    assert.doesNotMatch(raw, pattern);
  }
});

test('every interface locale defines exactly the English key set', () => {
  const expected = Object.keys(dictionaries.en).sort();
  for (const [code, dict] of Object.entries(dictionaries)) {
    assert.deepEqual(Object.keys(dict).sort(), expected, `locale ${code}`);
  }
});
