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
  const RECOGNISE_ONLY = ['bosser', 'bouffer', 'emmerder', 'foutre', 'piger',
                          'péter', 'rigoler'];
  const actual = verbs.filter((v) => !v.produce).map((v) => v.infinitive).sort();
  assert.deepEqual(actual, [...RECOGNISE_ONLY].sort());
  for (const v of verbs.filter((x) => !x.produce)) {
    assert.ok(['familier', 'argotique'].includes(v.register), v.infinitive);
    assert.ok(['A1', 'A2'].includes(v.level), v.infinitive);
  }
  // And nothing else is withheld from production: an unmarked verb is not
  // quietly demoted on a guess.
  for (const v of verbs.filter((x) => x.register === null)) {
    assert.equal(v.produce, true,
      `${v.infinitive} has no register and is not produced — a guess has crept in`);
  }
  console.log(`    recognition only: ${actual.join(', ')}`);
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
