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
 * Concepts that are genuinely distinct and will keep looking like one thing.
 *
 * Each entry is a hub and the concepts it is most likely to be folded into.
 * The hub's description must name every spoke; every spoke's description must
 * name the hub. Both directions, or a reader who arrives at the spoke is never
 * told the hub exists.
 *
 * `lex.law` / `lex.justice`: French divides le droit (the body of rules) from
 * la justice (the courts and their procedure) where English says "law" for
 * both. That is how the language splits them, not how we chose to.
 *
 * `phon.rhythm.conversation` (C2) against the three C1 entries that name the
 * phenomena it involves. It is the weakest of the C2 additions precisely
 * because those three between them name every phenomenon in it, so the
 * boundary — one phenomenon in isolation, versus all of them at once across
 * speakers in real time — has to be stated rather than assumed.
 */
const MUST_CITE = [
  { hub: 'lex.law', spokes: ['lex.justice'] },
  { hub: 'phon.rhythm.conversation',
    spokes: ['phon.rhythm.reduced', 'phon.liaison.rapide', 'phon.vowel.e-caduc'] },
];

test('a concept that could be folded into another says so, by id, in both languages', () => {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const problems = [];
  const cites = (id, other) => {
    const c = byId.get(id);
    if (!c) return problems.push(`${id} is missing — if it was folded away, that is what this test exists to stop`);
    for (const lang of ['en', 'fr']) {
      const text = c.description?.[lang];
      if (!text?.trim()) problems.push(`${id} has no ${lang} description`);
      else if (!text.includes(other)) problems.push(`${id}'s ${lang} description does not name ${other}`);
    }
  };
  for (const { hub, spokes } of MUST_CITE) {
    for (const s of spokes) {
      cites(hub, s);   // the hub names each thing it is not
      cites(s, hub);   // and each of those names the hub
    }
  }
  assert.deepEqual(problems, [],
    'a stated boundary is what keeps two concepts from being read as a duplicate in six months');
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
