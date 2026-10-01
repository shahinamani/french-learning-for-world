/**
 * Concept ids are permanent and public.
 *
 * Once a learner has review history against an id, that id is frozen: renaming,
 * re-scoping or reusing it silently detaches their history from the thing it
 * was about. `content/concepts.json` states the rule in its own text; this is
 * the check that enforces it.
 *
 * `tests/fixtures/concept-ids-frozen.json` holds the 224 ids as committed
 * before C1 and C2 were drafted. Adding levels must not disturb one of them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

const live = read('../content/concepts.json');
const frozen = read('./fixtures/concept-ids-frozen.json');
const liveIds = live.concepts.map((c) => c.id);

test('the frozen fixture is real — a guard over an empty list guards nothing', () => {
  assert.equal(frozen.ids.length, frozen.count);
  assert.ok(frozen.count >= 224, `expected at least 224 frozen ids, found ${frozen.count}`);
});

test('every frozen id is still present, spelled exactly the same', () => {
  const present = new Set(liveIds);
  const missing = frozen.ids.filter((id) => !present.has(id));
  assert.deepEqual(missing, [],
    'a frozen concept id was renamed or removed — learners may have review history against it');
});

test('no id is used twice', () => {
  const dupes = liveIds.filter((id, i) => liveIds.indexOf(id) !== i);
  assert.deepEqual([...new Set(dupes)], [], 'duplicate concept ids');
});

test('every id matches the published format: lowercase ASCII, dots, hyphens', () => {
  // Caught a real one in the C1 draft: `gram.negation.explétif` would have been
  // frozen forever with an accented character inside an ASCII namespace.
  const bad = liveIds.filter((id) => !/^[a-z0-9]+(\.[a-z0-9-]+)*$/.test(id));
  assert.deepEqual(bad, [], 'ids outside the published format');
});

test('every parent exists, and no concept is its own ancestor', () => {
  const byId = new Map(live.concepts.map((c) => [c.id, c]));
  const orphans = live.concepts.filter((c) => c.parent && !byId.has(c.parent)).map((c) => c.id);
  assert.deepEqual(orphans, [], 'concepts whose parent does not exist');

  for (const c of live.concepts) {
    const seen = new Set([c.id]);
    let p = c.parent;
    while (p) {
      assert.ok(!seen.has(p), `cycle in the taxonomy at ${c.id}`);
      seen.add(p);
      p = byId.get(p)?.parent ?? null;
    }
  }
});

test('every level and type is one the file declares', () => {
  for (const c of live.concepts) {
    assert.ok(live.levels.includes(c.level), `${c.id} has an undeclared level: ${c.level}`);
    assert.ok(live.types.includes(c.type), `${c.id} has an undeclared type: ${c.type}`);
  }
});

test('every concept is named in English and French', () => {
  const unnamed = live.concepts.filter((c) => !c.name?.en?.trim() || !c.name?.fr?.trim()).map((c) => c.id);
  assert.deepEqual(unnamed, [], 'concepts with a missing name');
});

test('French concept names use typographic apostrophes, not primes', () => {
  const bad = live.concepts.filter((c) => /\p{L}'\p{L}/u.test(c.name.fr)).map((c) => `${c.id}: ${c.name.fr}`);
  assert.deepEqual(bad, [], 'French names carrying a straight apostrophe');
});
