/**
 * The verbs that cannot be used without a reflexive pronoun.
 *
 * « souvenir » was in the content as a bare infinitive, glossed "to remember",
 * with a conjugation table reading « je souviens », « tu souviens », « il
 * souvient » — six rows of French that does not exist. A learner studying that
 * table would have written « je souviens » in an exam, and would have learned
 * it from us. Nothing in the content marked the verb, so nothing could have
 * caught it: the shape of the data had no place to say "this verb needs a
 * pronoun", which is why it went unsaid for every one of the 51.
 *
 * Detection is Wiktionary's `{{lb|fr|pronominal}}` and `{{lb|fr|reflexive}}` on
 * EVERY usable sense. Not "any sense": about five hundred verbs have a
 * pronominal sense among others — « trouver » and « se trouver » — and the bare
 * infinitive is their correct headword.
 *
 * The same reviewer as the glosses, in other words. 51 is short enough for a
 * French teacher to read in ten minutes, and that review has not happened.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { reflexivePronoun, withPronoun } from '../web/src/lib/pronominal.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const all = LEVELS.flatMap((l) => read(`content/verbs/${l}.json`).verbs);
const index = read('content/verbs-index.json').verbs;

test('souvenir is marked, and its headword is « se souvenir »', () => {
  const v = all.find((x) => x.infinitive === 'souvenir');
  assert.ok(v, 'souvenir is not in the content');
  assert.equal(v.pronominal, true, 'souvenir is not marked pronominal');
  assert.equal(v.headword, 'se souvenir');
  // And in the index, which is what the LIST renders. A learner who reads the
  // wrong headword in the list has learned it wrong before opening the verb.
  assert.equal(index.find((x) => x.infinitive === 'souvenir').headword, 'se souvenir');
});

test('the pronominal-only verbs are exactly these 51', () => {
  // Declared in full, because the list is the claim. Wiktionary's labels are
  // its only reviewer; a teacher reading this list is the next step, and when
  // they move one this check tells whoever changed it what they changed.
  const EXPECTED = [
    'absenter', 'accouder', 'agenouiller', 'attabler', 'biler', 'blottir',
    'cabrer', 'camer', 'chamailler', 'complaire', 'démener', 'démerder',
    'ébrouer', 'écrier', 'écrouler', 'efforcer', 'élancer', 'emparer',
    'empiffrer', 'empresser', 'enquérir', 'entraider', 'entrecroiser',
    'entretuer', 'envoler', 'épanouir', 'éperdre', 'éprendre', 'esclaffer',
    'évader', 'évanouir', 'évaporer', 'extasier', 'fier', 'gourer',
    'insurger', 'lamenter', 'marrer', 'méfier', 'obstiner', 'prosterner',
    'prostituer', 'raviser', 'rebeller', 'recoucher', 'recroqueviller',
    'rendormir', 'repentir', 'souvenir', 'suicider', 'tapir',
  ];
  const actual = all.filter((v) => v.pronominal).map((v) => v.infinitive)
    .sort((a, b) => a.localeCompare(b, 'fr'));
  assert.deepEqual(actual, [...EXPECTED].sort((a, b) => a.localeCompare(b, 'fr')));
  console.log(`    ${actual.length} pronominal-only verbs`);
});

test('a verb with a pronominal sense among others keeps the bare infinitive', () => {
  // « trouver » is "to find" and « se trouver » is "to be located". Marking it
  // pronominal-only would be the mirror of the souvenir defect: it would teach
  // that « je trouve » is wrong, and it is not.
  for (const inf of ['trouver', 'appeler', 'mettre', 'passer', 'rappeler']) {
    const v = all.find((x) => x.infinitive === inf);
    assert.equal(v.pronominal, false, `${inf} was marked pronominal-only`);
    assert.equal(v.headword, null);
  }
});

test('a label LIST is a disjunction, not a conjunction', () => {
  // « transporter » carries `{{lb|fr|transitive|or|pronominal}}` — transitive OR
  // pronominal. Read as a conjunction it became pronominal-only, and the page
  // would have taught that « se transporter » is the only form of "to
  // transport". Five verbs were wrong this way.
  for (const inf of ['transporter', 'entrouvrir', 'effondrer']) {
    const v = all.find((x) => x.infinitive === inf);
    if (!v) continue;
    assert.equal(v.pronominal, false,
      `${inf} is marked pronominal-only; its label list says it is also transitive`);
  }
});

test('the pronoun elides against the form, and only before a vowel', () => {
  assert.equal(withPronoun('je', 0, 'souviens'), 'je me souviens');
  assert.equal(withPronoun('tu', 1, 'souviens'), 'tu te souviens');
  assert.equal(withPronoun('il/elle', 2, 'souvient'), 'il/elle se souvient');
  assert.equal(withPronoun('nous', 3, 'souvenons'), 'nous nous souvenons');
  assert.equal(withPronoun('vous', 4, 'souvenez'), 'vous vous souvenez');
  assert.equal(withPronoun('ils/elles', 5, 'souviennent'), 'ils/elles se souviennent');
  // A vowel elides, and the apostrophe closes up against the form.
  assert.equal(withPronoun('je', 0, 'évanouis'), "je m'évanouis");
  assert.equal(withPronoun('il/elle', 2, 'évanouit'), "il/elle s'évanouit");
  // nous and vous never elide: « nous nous évanouissons », not « nous n'… ».
  assert.equal(withPronoun('nous', 3, 'évanouissons'), 'nous nous évanouissons');
  // Against whatever actually begins the form, not against the infinitive:
  // « je m'en souviens » is right, and this is why the pronoun is chosen from
  // the form rather than decided once per verb.
  assert.equal(reflexivePronoun(0, 'en souviens'), "m'");
});

test('no pronominal-only verb begins with h, which this rule cannot handle', () => {
  // « s'habiller » elides and « se hâter » does not, and nothing in the
  // spelling tells the two h's apart. There is no h in the set today; if one
  // arrives, this fails rather than printing a wrong pronoun in silence.
  const h = all.filter((v) => v.pronominal && /^h/i.test(v.infinitive))
    .map((v) => v.infinitive);
  assert.deepEqual(h, [],
    'a pronominal verb beginning with h needs an aspiré/muet ruling before it ships');
});

test('every pronominal verb has a headword and every other verb has none', () => {
  const bad = [];
  for (const v of all) {
    if (v.pronominal && !v.headword) bad.push(`${v.infinitive}: pronominal with no headword`);
    if (!v.pronominal && v.headword) bad.push(`${v.infinitive}: headword without the flag`);
    if (v.headword && !v.headword.endsWith(v.infinitive)) {
      bad.push(`${v.infinitive}: headword "${v.headword}" is not this verb`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the headword elides in the content, not only in the browser', () => {
  const s = all.find((v) => v.infinitive === 'souvenir');
  const e = all.find((v) => v.infinitive === 'évanouir');
  assert.equal(s.headword, 'se souvenir');
  assert.equal(e.headword, "s'évanouir");
});

test('the detector reports through --probe, so it is checkable', () => {
  const out = JSON.parse(execFileSync('python3', [
    join(root, 'scripts/harvest_glosses.py'), '--probe',
    join(root, 'tests/fixtures/gloss-senses.wiki'),
  ], { cwd: root, encoding: 'utf8' }));
  assert.equal(out.pronominalOnly, false,
    'a fixture with transitive senses was called pronominal-only');
});
