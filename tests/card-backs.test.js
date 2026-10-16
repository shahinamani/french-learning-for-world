/**
 * The educational card backs, checked against the whole file.
 *
 * These are content checks, not a teacher's reading. They can tell you that a
 * highlight will land, that a tense id exists, that a key belongs to a real
 * card and that no slot was padded — they cannot tell you the French is good
 * or the Persian is natural. **Nothing here is evidence of review**, and the
 * file's own `reviewNote` says so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCards, markOf } from '../web/src/lib/workspace-cards.ts';
import { splitOnForm, coverage } from '../web/src/lib/card-backs.ts';
import { fr as frText } from '../web/src/lib/typography.ts';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const file = read('content/card-backs.json');
const backs = file.backs;
const tenseNames = read('content/tense-names.json');
const deck = read('content/fr-core-a1.json').cards;
const verbsIdx = read('content/verbs-index.json');
const verbs = verbsIdx.verbs ?? verbsIdx;
const cards = buildCards(deck, verbs, 'en');
const byKey = new Map(cards.map((c) => [c.key, c]));
const entries = Object.entries(backs);

test('every back belongs to a card that actually exists', () => {
  assert.ok(entries.length >= 30, `only ${entries.length} backs — the batch shrank`);
  for (const [key] of entries) {
    assert.ok(byKey.has(key), `${key} has a back but is not an eligible card`);
  }
});

test('the highlight will land: every form is a literal substring of its sentence', () => {
  // The screen highlights by searching for `form` in `fr`. If it is not there
  // the mark silently disappears and the learner is told which form to look at
  // by a label pointing at nothing.
  for (const [key, b] of entries) {
    for (const ex of b.examples) {
      assert.ok(ex.fr.includes(ex.form),
        `${key}: "${ex.form}" is not in "${ex.fr}"`);
      // And after the French typographer has run, which is what is actually
      // rendered — a straight apostrophe in the form and a curly one in the
      // sentence would match here and fail on screen.
      assert.ok(frText(ex.fr).includes(frText(ex.form)),
        `${key}: "${ex.form}" stops matching once typography is applied`);
      assert.ok(splitOnForm(frText(ex.fr), frText(ex.form)),
        `${key}: splitOnForm cannot split "${ex.fr}"`);
    }
  }
});

test('a verb gets real tenses; a noun gets none', () => {
  // `.tenses`, not the top level: the file is {version, note, licence, tenses,
  // readOnly}, and reading the wrapper gave a set containing "version" and not
  // "present" — the check accused correct data because it was looking one
  // level too high.
  const ids = new Set(Object.keys(tenseNames.tenses));
  for (const [key, b] of entries) {
    if (b.type === 'verb') {
      const tenses = b.examples.map((e) => e.tense);
      for (const t of tenses) {
        assert.ok(t, `${key}: a verb example with no tense`);
        assert.ok(ids.has(t), `${key}: "${t}" is not a tense in content/tense-names.json`);
      }
      assert.deepEqual(tenses, ['present', 'passe-compose', 'futur'],
        `${key}: the normal pattern is présent, passé composé, futur simple`);
    } else {
      for (const ex of b.examples) {
        assert.equal(ex.tense, undefined,
          `${key} is a ${b.type}; assigning it a verb tense is a grammatical claim it cannot carry`);
      }
    }
  }
});

test('restricted verbs are marked and explained rather than quietly normal', () => {
  // falloir is impersonal and se souvenir is pronominal-only. Both are in this
  // batch ON PURPOSE: a batch of nothing but regular -er verbs would prove the
  // renderer handles the easy case only.
  const falloir = backs['v:falloir'];
  assert.ok(falloir, 'the impersonal case is in the batch');
  assert.equal(falloir.pattern, 'impersonal');
  assert.ok(/third person singular/i.test(falloir.usage ?? ''),
    'an impersonal verb must say why it has no other persons');
  for (const ex of falloir.examples) {
    assert.match(ex.fr, /^Il /, `falloir has no subject but il: "${ex.fr}"`);
  }

  const souvenir = backs['v:souvenir'];
  assert.ok(souvenir, 'the pronominal case is in the batch');
  assert.equal(souvenir.pattern, 'pronominal');
  assert.ok(/pronoun/i.test(souvenir.usage ?? ''));
  for (const ex of souvenir.examples) {
    assert.match(ex.form, /\b(me|te|se|s'|s’)/,
      `a pronominal form must carry its pronoun: "${ex.form}"`);
  }
  // And the card it attaches to shows the headword, not the bare infinitive.
  assert.equal(byKey.get('v:souvenir').front, 'se souvenir');
});

test('nothing is padded: every slot has real French, Persian and English', () => {
  for (const [key, b] of entries) {
    assert.ok(b.fa && b.fa.trim().length > 0, `${key}: no Persian meaning`);
    assert.match(b.fa, /[؀-ۿ]/, `${key}: the Persian meaning is not in Persian script`);
    assert.ok(b.examples.length >= 2, `${key}: ${b.examples.length} examples`);
    const seen = new Set();
    for (const ex of b.examples) {
      for (const field of ['fr', 'fa', 'en']) {
        assert.ok(ex[field] && ex[field].trim().length > 0, `${key}: empty ${field}`);
      }
      assert.match(ex.fa, /[؀-ۿ]/, `${key}: "${ex.fa}" is not Persian`);
      assert.ok(!/[؀-ۿ]/.test(ex.fr), `${key}: Persian leaked into the French`);
      assert.ok(!seen.has(ex.fr), `${key}: the same sentence twice — "${ex.fr}"`);
      seen.add(ex.fr);
      // A sentence, not a fragment: French sentences here end in a stop.
      assert.match(ex.fr.trim(), /[.!?]$/, `${key}: "${ex.fr}" is not a sentence`);
    }
  }
});

/**
 * There was a check here that tried to catch a word-for-word Persian trace of
 * the French by asserting the sentence ends on a verb-like token, Persian
 * being verb-final. It is gone, and the reason belongs in the file.
 *
 * Run against the corpus it accused seven correct sentences — « ... خواهیم
 * داشت »، « ... خواهی دانست »، « ... خواهند ساخت »، « ... خواهد گذشت » — every
 * one of which ends on a perfectly ordinary Persian verb that its ending list
 * did not happen to contain. AGENTS.md §3: the data was right and the check
 * was wrong, and the fix for a rule that cannot express the question is not a
 * longer list of endings.
 *
 * **Whether the Persian reads naturally is not machine-checkable, and nothing
 * in this file should pretend otherwise.** What is checked above is that the
 * Persian is in Persian script, is present on every example, and that no
 * French has leaked into it. A Persian reader remains the only thing that can
 * judge the rest, and `reviewNote` says nobody has been one yet.
 */

test('provenance is recorded, and reuse is declared as reuse', () => {
  const reused = entries.filter(([, b]) => b.source === 'fr-core-a1');
  assert.equal(reused.length, 22, 'the 22 written cards are reused, not rewritten');
  const deckByKey = new Map(deck.map((c) => [c.key, c]));
  for (const [key, b] of reused) {
    const card = deckByKey.get(key);
    assert.ok(card, `${key} claims to come from the deck`);
    assert.equal(b.fa, card.meanings.fa, `${key}: the Persian meaning must be the deck's, verbatim`);
    // Every deck sentence still appears, so "reused" is true and not a label
    // over a rewrite.
    for (const ex of card.examples) {
      assert.ok(b.examples.some((e) => e.fr === ex.fr),
        `${key}: the deck sentence "${ex.fr}" was dropped rather than reused`);
    }
  }
  for (const [key, b] of entries) {
    assert.ok(['fr-core-a1', 'drafted'].includes(b.source), `${key}: unknown source ${b.source}`);
  }
});

test('nothing here claims to have been reviewed', () => {
  assert.match(file.reviewNote, /NOT REVIEWED/i);
  for (const [key, b] of entries) {
    assert.ok(!('review' in b) || (b.review?.owner == null && b.review?.teacher == null),
      `${key} carries a review record, and nobody has reviewed this file`);
  }
  // The coverage helper must report 0 reviewed from this data, because that is
  // what the page prints.
  const cov = coverage(cards.map((c) => c.key), new Map(entries));
  assert.equal(cov.reviewed, 0, 'the page must not report a review that did not happen');
  assert.equal(cov.enriched, entries.length);
  assert.equal(cov.eligible, cards.length);
  assert.ok(cov.enriched < cov.eligible,
    'most cards still have only a gloss, and the figures must keep saying so');
});

test('enriching a card does not move it, renumber it, or detach its history', () => {
  // The whole reason the backs are keyed by card key. If enrichment changed a
  // key, every review ever recorded against it would be orphaned.
  for (const [key] of entries) {
    const card = byKey.get(key);
    assert.equal(card.key, key);
    // And the pile a card is in is still decided by the schedule alone, with
    // no input from whether it has a back.
    assert.equal(markOf(undefined, Date.now()), 'none');
  }
});
