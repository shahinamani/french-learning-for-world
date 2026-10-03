/**
 * Register, and the difference between "standard" and "nobody has said".
 *
 * Shahin's taxonomy: soutenu / standard / familier / argotique, plus a
 * produce-or-recognise flag. His band rule: a verb marked familier or
 * argotique does not belong in A1 or A2 production content, whatever its
 * frequency. « paumer » at C1 is the case — a learner should understand it and
 * should not use it in a DELF oral.
 *
 * **It cannot be derived, and that was measured before the field was built.**
 * 89% of the 2,389 verbs carry no register label anywhere in their Wiktionary
 * senses; only 2.4% carry one on the leading sense. The spoken/written skew
 * cannot stand in: verbs with a leading informal label skew +1.32 towards
 * speech, unlabelled verbs -1.06, but 26% of unlabelled verbs are at least as
 * spoken-skewed as the median informal one — so a skew proxy would mark some
 * 563 ordinary verbs familier, « calmer » and « inviter » among them.
 *
 * So the field is 4% seeded from labels and 96% empty, and the empty value is
 * `null` rather than `"standard"`. That distinction is the whole point: a
 * default that masquerades as a judgement is how « souvenir » went unmarked for
 * 51 verbs — the shape could not tell "checked and ordinary" from "never looked
 * at".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const verbs = LEVELS.flatMap((l) => read(`content/verbs/${l}.json`).verbs);
const VALUES = ['soutenu', 'standard', 'familier', 'argotique'];

test('register is one of the four values, or null for "nobody has said"', () => {
  const bad = verbs.filter((v) => v.register !== null && !VALUES.includes(v.register))
    .map((v) => `${v.infinitive}: ${v.register}`);
  assert.deepEqual(bad, []);
  const marked = verbs.filter((v) => v.register);
  const unset = verbs.length - marked.length;
  console.log(`    ${marked.length} marked · ${unset} unset`);
  // The field would be a lie if the unset case had been filled with a default.
  assert.ok(unset > 2000,
    `only ${unset} verbs are unset — has something defaulted them to standard?`);
});

test('a register value always says where it came from, and vice versa', () => {
  const bad = [];
  for (const v of verbs) {
    if (v.register && !v.registerProvenance) bad.push(`${v.infinitive}: register with no provenance`);
    if (!v.register && v.registerProvenance) bad.push(`${v.infinitive}: provenance with no register`);
    if (v.registerProvenance && !['teacher', 'derived'].includes(v.registerProvenance)) {
      bad.push(`${v.infinitive}: provenance ${v.registerProvenance}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the band rule holds: familier or argotique is not produced at A1 or A2', () => {
  // Shahin's rule, enforced where it is explicit. The seven it catches are the
  // same seven that tier 1 of the level sheet flagged by hand.
  // argotique: recognition only at every level.
  // familier: recognition only at A1/A2 and produced from B1 WITH the register
  // shown — the A1/A2 block exists so nobody learns « bosser » as if it were
  // « travailler », and withholding it later teaches a French nobody speaks.
  //
  // All of these are argotique, because the PLACEMENT rule moved every
  // familier verb to B1 or later. Six had no gloss to read a label from:
  // withholding a gloss for explicit English destroyed the evidence of the very
  // register it was withheld for, so a withheld gloss now implies argotique.
  const RECOGNISE_ONLY = [
    'chier', 'dealer', 'déglinguer', 'dégueuler', 'démerder', 'emmerder',
    'enculer', 'entuber', 'foutre', 'gamberger', 'glander', 'gueuler',
    'marrer', 'masturber', 'merder', 'morfler', 'pioncer', 'pisser', 'tapiner',
  ];
  const actual = verbs.filter((v) => !v.produce).map((v) => v.infinitive).sort();
  assert.deepEqual(actual, [...RECOGNISE_ONLY].sort());
  for (const v of verbs.filter((x) => !x.produce)) {
    assert.equal(v.register, 'argotique', v.infinitive);
  }
  // And a familier verb IS produced, from B1 upwards, which is where the
  // placement rule puts all of them.
  const familier = verbs.filter((v) => v.register === 'familier');
  assert.ok(familier.length > 0);
  for (const v of familier) {
    assert.equal(v.produce, true,
      `${v.infinitive} is familier at ${v.level} and is withheld from production`);
  }
  // And nothing else is withheld from production: an unmarked verb is not
  // quietly demoted on a guess.
  for (const v of verbs.filter((x) => x.register === null)) {
    assert.equal(v.produce, true,
      `${v.infinitive} has no register and is not produced — a guess has crept in`);
  }
  console.log(`    recognition only: ${actual.join(', ')}`);
});

test('the PLACEMENT rule: nothing familier or argotique sits below B1', () => {
  // Shahin's rule applies to the BAND, not only to the drill. « pisser » was
  // placed at A2 by spoken frequency with no gloss shown — a blank row on a
  // beginner's screen — and marking it recognition-only left it there.
  const early = verbs
    .filter((v) => ['familier', 'argotique'].includes(v.register)
                && ['A1', 'A2'].includes(v.level))
    .map((v) => `${v.infinitive} (${v.level}, ${v.register})`);
  assert.deepEqual(early, []);
  const low = verbs.filter((v) => ['familier', 'argotique'].includes(v.register));
  assert.ok(low.length >= 50, `only ${low.length} low-register verbs`);
  console.log(`    ${low.length} familier/argotique verbs, bands `
    + `${[...new Set(low.map((v) => v.level))].sort().join('/')}`);
});

test('a withheld gloss implies argotique, because withholding hid the label', () => {
  const withheld = verbs.filter((v) => v.glossWithheld === 'explicit');
  assert.ok(withheld.length >= 5, `${withheld.length} verbs have a withheld gloss`);
  for (const v of withheld) {
    assert.equal(v.register, 'argotique',
      `${v.infinitive} has a withheld gloss and register ${v.register}`);
    assert.equal(v.produce, false);
    assert.ok(!['A1', 'A2'].includes(v.level), `${v.infinitive} is at ${v.level}`);
  }
});

test('a verb nobody conjugates is kept with its attested form, or dropped', () => {
  const KEPT = { sacrer: 'sacra', douer: 'douait', assoiffer: 'assoiffent',
                 'rapiécer': 'rapiécerait', bonder: 'bondait' };
  const actual = Object.fromEntries(verbs.filter((v) => v.rarelyConjugated)
    .map((v) => [v.infinitive, v.rarelyConjugated.attestedForm]));
  assert.deepEqual(actual, KEPT);
  for (const inf of ['répertorier', 'diplômer']) {
    assert.equal(verbs.find((v) => v.infinitive === inf), undefined,
      `${inf} ships and has no finite form attested at all`);
  }
});

test('the rule cannot fire on the 96% nobody has read, and says so', () => {
  // The honest limit. « paumer » is thoroughly colloquial, its leading
  // Wiktionary sense carries no label, so it is unmarked and the band rule does
  // not see it. That is a known gap, not a claim about paumer.
  const paumer = verbs.find((v) => v.infinitive === 'paumer');
  assert.equal(paumer.register, null,
    'paumer is marked now — if a teacher ruled, update this check and the gap note');
  assert.equal(paumer.produce, true, 'the band rule fired on an unmarked verb');
  const derived = verbs.filter((v) => v.registerProvenance === 'derived').length;
  const teacher = verbs.filter((v) => v.registerProvenance === 'teacher').length;
  assert.ok(derived > 0);
  console.log(`    ${teacher} read by a teacher · ${derived} drafted from a label`
    + ` · ${verbs.length - teacher - derived} unread`);
});
