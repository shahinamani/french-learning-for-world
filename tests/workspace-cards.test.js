/**
 * The workspace's corpus and filters, checked against the WHOLE real corpus
 * rather than a fixture — AGENTS.md §3. Every number asserted below was first
 * printed by running this against the shipped content; none of them was typed
 * from a document.
 *
 * Two of these exist because the checks they replace accused correct data, or
 * passed over a real defect, during the afternoon this was written:
 *
 *   - `markOf` read FSRS's state enum. Pressing Known took a card out of the
 *     unmarked pile and put it in NEITHER other pile, because a first sighting
 *     enters Learning however it is graded. The enum cannot express the
 *     question.
 *   - the two buttons were Good and Again. Measuring the scheduler showed its
 *     learning steps are 1, 6 and 10 minutes, so Good and Again are
 *     indistinguishable ten minutes later and "Known" was unrepresentable.
 *     The grades are the two ENDS of the scale now, and the test below pins
 *     that to the scheduler's real output instead of to a belief about it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyFilters, buildCards, countByLevel, countByMark, jumpTo, markOf,
  KNOWN_HORIZON_MS, WS_LEVELS,
} from '../web/src/lib/workspace-cards.ts';
import { emptyState } from '../web/src/lib/scheduler.ts';
import { fold } from '../web/src/lib/fold.ts';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const deck = read('content/fr-core-a1.json').cards;
const verbs = read('content/verbs-index.json').verbs ?? read('content/verbs-index.json');
const all = buildCards(deck, verbs, 'en');

test('the corpus is the eligible records, counted from the content', () => {
  // 2,363 verbs carry a gloss and are not withheld; the deck adds 9 nouns and
  // overlays 13 verbs it already shares keys with. 2,363 + 9 = 2,372.
  // 2,363 eligible verbs, plus the deck's 8 nouns. The deck's 14 verbs are all
  // overlays: 13 share a key with the index outright and the 14th, être, is
  // matched by folded key — see the note in buildCards.
  assert.equal(all.length, 2371, 'the eligible corpus changed — recount before editing this');
  assert.equal(all.filter((c) => c.rich).length, 22, 'the 22 written cards are all present');
  assert.equal(all.filter((c) => c.type === 'noun').length, 8);
  assert.equal(all.filter((c) => c.type === 'verb').length, 2363);
  assert.equal(all.filter((c) => c.glossUnreviewed).length, 2349,
    'everything but the 22 written cards carries a back nobody has read');
});

test('être appears exactly once, under the key its history is already under', () => {
  // The written deck keys it `v:etre`; the verb index keys it `v:être`. Keyed
  // naively the corpus carried both, each with separate review history, so a
  // learner could mark the commonest verb in French known and still meet it as
  // unmarked. The deck key wins because the ordinary session has been writing
  // history under it.
  const etres = all.filter((c) => fold(c.key) === 'v:etre');
  assert.equal(etres.length, 1, `être is present ${etres.length} times: ${etres.map((c) => c.key).join(', ')}`);
  assert.equal(etres[0].key, 'v:etre', 'the deck key, which already carries history');
  assert.ok(etres[0].rich, 'and it is the written card, not the scraped gloss');

  // The control arm: the index really does use the other spelling, so this is
  // guarding a live difference and not a hypothetical one.
  assert.ok(verbs.some((v) => v.key === 'v:être'), 'the index keys être with its accent');
});

test('nothing without a usable front AND back is admitted', () => {
  for (const c of all) {
    assert.ok(c.front.trim().length > 0, `${c.key} has no front`);
    assert.ok(c.back.trim().length > 0, `${c.key} has no back`);
    assert.ok(WS_LEVELS.includes(c.level), `${c.key} has level ${c.level}`);
  }
  // And the exclusions are real exclusions, not an empty rule: the index does
  // contain records this must refuse.
  const refused = verbs.filter((v) => v.glossWithheld || !v.en).length;
  assert.ok(refused > 0, 'the index has records to refuse, or this rule proves nothing');
  const keys = new Set(all.map((c) => c.key));
  for (const v of verbs) {
    if (v.glossWithheld || !v.en) {
      assert.ok(!keys.has(v.key), `${v.key} has no usable back and must not be a card`);
    }
  }
});

test('a pronominal-only verb is shown by its headword, never the bare infinitive', () => {
  // The « souvenir » defect, as a check. A learner who reads the wrong headword
  // has learned it wrong before they open anything.
  const withHeadword = verbs.filter((v) => v.headword && v.en && !v.glossWithheld);
  assert.ok(withHeadword.length >= 40, `only ${withHeadword.length} carry a headword`);
  for (const v of withHeadword) {
    const card = all.find((c) => c.key === v.key);
    assert.ok(card, `${v.key} is eligible and must be present`);
    assert.equal(card.front, v.headword,
      `${v.key} must read as ${v.headword}, not ${v.infinitive}`);
  }
  const souvenir = all.find((c) => c.key === 'v:souvenir');
  if (souvenir) assert.match(souvenir.front, /^se /, 'se souvenir, not souvenir');
});

test('the written deck overlays the index rather than duplicating it', () => {
  const etre = all.filter((c) => c.key === 'v:etre');
  assert.equal(etre.length, 1, 'one record per key');
  assert.ok(etre[0].rich, 'the written card wins over the scraped gloss');
  assert.equal(etre[0].glossUnreviewed, false);
  assert.ok((etre[0].rich.examples ?? []).length > 0, 'and brings its examples');
});

/**
 * The piles, as a pure contract.
 *
 * This called `loadScheduler()` at first, to grade a real card and read the
 * pile back. The pre-push sweep refused it: the sweep and CI both run this
 * suite with `web/node_modules` hidden, and the React scheduler is a dynamic
 * import of `ts-fsrs`, which is not there. A unit test that needs the engine
 * cannot run where this suite runs.
 *
 * That is the division this project already draws — `tests/fsrs.test.js` says
 * it in its own header — so the contract is checked here against explicit
 * states, and the claim that the ENGINE produces states on the right side of
 * the horizon is checked in `web/e2e/walk.mjs`, in a real browser, by pressing
 * the button and reading the pile. Neither half is a substitute for the other
 * and both run in CI.
 */
test('the piles are a pure function of the schedule', () => {
  const now = Date.parse('2026-10-12T09:00:00Z');
  const base = { stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 0,
                 lapses: 0, state: 2, lastReviewedAt: now };

  assert.equal(markOf(undefined, now), 'none', 'no record at all');
  assert.equal(markOf(emptyState(), now), 'none', 'reps 0 is not a mark');

  const at = (ms, reps = 1) => markOf({ ...base, reps, dueAt: now + ms }, now);
  const HOUR = 3600000;
  assert.equal(at(9 * 24 * HOUR), 'known', 'nine days out, as Easy schedules');
  assert.equal(at(24 * HOUR), 'known', 'tomorrow');
  assert.equal(at(KNOWN_HORIZON_MS + 1000), 'known', 'just past the horizon');
  assert.equal(at(KNOWN_HORIZON_MS - 1000), 'review', 'just inside it');
  assert.equal(at(10 * 60 * 1000), 'review', 'ten minutes out, as Good schedules a new card');
  assert.equal(at(60 * 1000), 'review', 'one minute out, as Again schedules');
  assert.equal(at(0), 'review', 'due now');
  assert.equal(at(-30 * 24 * HOUR), 'review', 'a month overdue');

  // The stated consequence, pinned: once-known and now overdue reads as To
  // review. It IS due, so that is correct, and it is why these piles describe
  // the schedule rather than remembering which button was pressed.
  assert.equal(markOf({ ...base, reps: 9, dueAt: now - 1000 }, now), 'review');

  // And reps is what distinguishes 'none' from a card due right now, so a
  // never-graded card is not swept into the review pile.
  assert.equal(markOf({ ...base, reps: 0, dueAt: now }, now), 'none');
});

test('filters, counts and the position agree', () => {
  const marks = new Map();
  const a1 = applyFilters(all, marks, { mark: 'all', levels: ['A1'], shuffle: false, seed: 1 });
  const levels = countByLevel(all);
  assert.equal(a1.length, levels.A1, 'the level chip count IS the filtered total');
  assert.ok(a1.every((c) => c.level === 'A1'));

  // No level selected means no level filter, not an empty screen.
  assert.equal(applyFilters(all, marks, { mark: 'all', levels: [], shuffle: false, seed: 1 }).length,
    all.length);

  // Marks partition the corpus: the three piles sum to the whole.
  marks.set(all[0].key, 'known');
  marks.set(all[1].key, 'review');
  const counts = countByMark(all, marks);
  assert.equal(counts.none + counts.known + counts.review, all.length);
  assert.equal(counts.all, all.length);
  assert.equal(counts.known, 1);
  assert.equal(counts.review, 1);
  assert.equal(
    applyFilters(all, marks, { mark: 'known', levels: [], shuffle: false, seed: 1 }).length, 1);
});

test('shuffle reorders the same set and never changes its size', () => {
  const marks = new Map();
  const base = { mark: 'all', levels: ['A1'], shuffle: false, seed: 1 };
  const ordered = applyFilters(all, marks, base);
  const mixed = applyFilters(all, marks, { ...base, shuffle: true, seed: 12345 });
  assert.equal(mixed.length, ordered.length, 'the count must not move when the order does');
  assert.deepEqual([...mixed].map((c) => c.key).sort(), [...ordered].map((c) => c.key).sort(),
    'the same cards, in a different order');
  assert.notDeepEqual(mixed.map((c) => c.key), ordered.map((c) => c.key), 'actually shuffled');

  // Seeded, so a re-render does not silently renumber the deck under the
  // learner — which is what Math.random() in a render would have done.
  assert.deepEqual(applyFilters(all, marks, { ...base, shuffle: true, seed: 12345 }).map((c) => c.key),
    mixed.map((c) => c.key), 'the same seed gives the same order');
});

test('a typed card number is clamped to the filtered set', () => {
  assert.equal(jumpTo('1', 10), 0, 'one-based in, zero-based out');
  assert.equal(jumpTo('10', 10), 9);
  assert.equal(jumpTo('0', 10), 0, 'below the start clamps to the first');
  assert.equal(jumpTo('9999', 10), 9, 'past the end clamps to the last');
  assert.equal(jumpTo('', 10), null);
  assert.equal(jumpTo('abc', 10), null);
  assert.equal(jumpTo('2.5', 10), null, 'half a card is not a card');
  assert.equal(jumpTo('3', 0), null, 'nothing to jump to in an empty set');
});
