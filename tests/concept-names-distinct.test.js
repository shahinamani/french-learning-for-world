/**
 * Two concepts that read as the same concept are the same concept.
 *
 * The C1/C2 draft carried four entries whose French name was character-for-
 * character identical to a concept already live: « Le subjonctif passé »,
 * « La concordance des temps », « La mise en relief », « L’absence d’article ».
 * Merging them would have frozen a second permanent id for each — and because
 * ids are permanent, the cure afterwards is a retirement, not a deletion.
 *
 * Nothing was watching for that. The permanence test checks ids; ids were
 * distinct. This checks the thing a learner actually sees.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const live = JSON.parse(readFileSync(new URL('../content/concepts.json', import.meta.url), 'utf8'));
const concepts = live.concepts.filter((c) => !c.retired);

/** Compare names the way a reader does: case, accents and apostrophes aside. */
const key = (s) =>
  s.normalize('NFD').replace(/\p{M}+/gu, '')
    .toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();

test('the file is populated — a guard over an empty list guards nothing', () => {
  assert.ok(concepts.length >= 290, `found ${concepts.length} live concepts`);
});

for (const lang of ['en', 'fr']) {
  test(`no two concepts carry the same ${lang} name`, () => {
    const seen = new Map();
    const clashes = [];
    for (const c of concepts) {
      const k = key(c.name[lang]);
      if (seen.has(k)) clashes.push(`${seen.get(k)} and ${c.id} are both "${c.name[lang]}"`);
      else seen.set(k, c.id);
    }
    assert.deepEqual(clashes, [],
      'two ids for one concept — pick the one that already exists, or make the names say how they differ');
  });
}

/**
 * Pairs that genuinely are two things and will keep looking like one.
 *
 * `lex.law` and `lex.justice`: French divides le droit (the body of rules)
 * from la justice (the courts and their procedure) where English says "law"
 * for both. That is how the language splits them, not how we chose to. Each
 * description must name the other id, so a reader meeting one is told the
 * other exists and why it is not a duplicate.
 */
const MUST_CITE_EACH_OTHER = [['lex.law', 'lex.justice']];

test('concepts that look like duplicates say, in both languages, why they are not', () => {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  for (const pair of MUST_CITE_EACH_OTHER) {
    for (const id of pair) {
      const c = byId.get(id);
      assert.ok(c, `${id} is missing — if the pair was folded, that is the thing this test exists to stop`);
      const other = pair.find((x) => x !== id);
      for (const lang of ['en', 'fr']) {
        const text = c.description?.[lang];
        assert.ok(text?.trim(), `${id} has no ${lang} description`);
        assert.ok(text.includes(other),
          `${id}'s ${lang} description does not mention ${other}; in six months the two read as a duplicate`);
      }
    }
  }
});

test('a description, where present, is given in both languages and uses French apostrophes', () => {
  const missing = [];
  const primes = [];
  for (const c of concepts) {
    if (!c.description) continue;
    if (!c.description.en?.trim() || !c.description.fr?.trim()) missing.push(c.id);
    if (/\p{L}'\p{L}/u.test(c.description.fr ?? '')) primes.push(c.id);
  }
  assert.deepEqual(missing, [], 'one-sided descriptions');
  assert.deepEqual(primes, [], 'French descriptions carrying a straight apostrophe');
});
