/**
 * The meanings a learner reads, and the ones they must not.
 *
 * `venir` shipped "to come ... ; to cum, to come, to orgasm" on a verb every A1
 * course teaches in week one. It was not a typo and not an accident of
 * translation: en.wiktionary records that sense, labels it
 * `{{lb|fr|Anglicism|vulgar}}`, and the harvest stripped the label before
 * anything could read it.
 *
 * The filter is by Wiktionary's own label, not by a list of words. A word list
 * fails twice over: it misses whatever it has not heard of, and it censors the
 * innocent — « baiser » is "to kiss" and also carries vulgar senses, one word
 * with two registers, and only the label separates them.
 *
 * These checks drive the real parser over committed fixtures through
 * `--probe`. The point of the fixtures is that each one holds a sense that MUST
 * be rejected: delete `REJECT` from the harvest and this file goes red, which
 * is the only reason a filter is worth having.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

function probe(fixture) {
  return JSON.parse(execFileSync('python3', [
    join(root, 'scripts/harvest_glosses.py'), '--probe', join(root, fixture),
  ], { cwd: root, encoding: 'utf8' }));
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const all = LEVELS.flatMap((l) => read(`content/verbs/${l}.json`).verbs);

test('an explicit translation is refused, and the refusal is recorded', () => {
  const { kept, rejected } = probe('tests/fixtures/gloss-senses.wiki');
  assert.ok(!JSON.stringify(kept).includes('UNSHIPPABLE'),
    `an explicit sense reached a learner: ${JSON.stringify(kept)}`);
  assert.ok(rejected.some((r) => r.why === 'explicit'),
    'nothing was refused — the filter is not running at all');
});

test('the decision is made on our English, not on Wiktionary\'s French label', () => {
  // This is the whole ruling. `vulgar` describes the register of the FRENCH
  // word and says nothing about the English we are about to print, so these
  // two are shown WITH their register rather than withheld:
  //
  //   gueuler    to yell, to scream      coarse French, clean English
  //   démerder   to manage, to get by    the same
  //
  // Dropping them taught nothing and left a learner able to use « gueuler » in
  // a DELF oral without knowing it is coarse.
  const show = { gueuler: /to yell/, 'démerder': /to manage/, bosser: /to work/ };
  for (const [v, want] of Object.entries(show)) {
    const verb = all.find((x) => x.infinitive === v);
    assert.ok(verb, `${v} is not in the content`);
    assert.match(verb.meanings.en || '', want,
      `${v} reads "${verb.meanings.en}" — its clean translation was withheld`);
  }
  // And the register is on the page, because half the information is the half
  // that keeps a learner out of trouble.
  assert.match(all.find((v) => v.infinitive === 'gueuler').meanings.en, /\((slang|vulgar)\)/);
});

test('a verb whose PRIMARY sense is unprintable is silenced, not re-described', () => {
  // « enculer » came back as "to beat up" — its fourth sense, listed, real, and
  // not what the word means. Keeping a later sense when the first is refused
  // does not describe the verb, it substitutes a different one.
  const enculer = all.find((v) => v.infinitive === 'enculer');
  assert.equal(enculer.meanings.en, undefined,
    `enculer reads "${enculer.meanings.en}" — a marginal sense was promoted`);
  assert.equal(enculer.glossWithheld, 'explicit');
});

test('at most two senses, and the first sense is the first sense', () => {
  // « aller » is the case: a rule requiring a three-letter word rejected "to go"
  // and promoted "to attend (school, church regularly)" to first place. The
  // primary meaning of the most taught verb in French must come first.
  const { kept } = probe('tests/fixtures/gloss-senses.wiki');
  assert.equal(kept.length, 2);
  assert.match(kept[0], /^to walk/, `the first sense was not kept first: ${kept[0]}`);
  const aller = all.find((v) => v.infinitive === 'aller');
  assert.match(aller.meanings.en, /^to go\b/,
    `aller reads "${aller.meanings.en}" — its primary sense was lost`);
  // NOT by counting semicolons: a single Wiktionary sense contains them of its
  // own accord — « avoir » sense one is "to have; to own; to possess; to get",
  // which is one sense and four semicolons. Counting them called five correct
  // glosses defects. The cap on senses is asserted on the fixture above, where
  // the sense boundaries are known; here only the length a page must render.
  const long = all.filter((v) => (v.meanings?.en || '').length > 200)
    .map((v) => `${v.infinitive} (${v.meanings.en.length} chars)`);
  assert.deepEqual(long, [], 'a gloss too long for a card');
});

test('a register is shown rather than used as a reason to withhold', () => {
  // « bosser » is slang and is also how half of France says "to work".
  const { kept } = probe('tests/fixtures/gloss-senses.wiki');
  assert.ok(kept.some((k) => /\(slang\)/.test(k)),
    'a slang sense was dropped instead of marked — that teaches less, not more');
});

test('only an explicit ALTERNATIVE is dropped, not the sense around it', () => {
  // « entuber » is "to shaft, to fuck over, dupe, swindle, fool". Refusing the
  // whole sense for one synonym cost it four printable translations.
  const entuber = all.find((v) => v.infinitive === 'entuber');
  assert.match(entuber.meanings.en, /shaft/);
  assert.ok(!/fuck/i.test(entuber.meanings.en), entuber.meanings.en);
});

test('no wikitext reaches a learner', () => {
  // « chier » shipped "to shit, defecate<!-- not sure I believe the next one;"
  // because an HTML comment that spans two lines is matched by no single-line
  // pattern. The editor's private aside was part of the meaning.
  const leaking = all.filter((v) => {
    const t = v.meanings?.en || '';
    return t.includes('<!--') || t.includes('-->') || t.includes('{{') || t.includes('}}');
  }).map((v) => `${v.infinitive}: ${v.meanings.en}`);
  assert.deepEqual(leaking, []);
});

test('no gloss is a fragment left between two nested templates', () => {
  // « vouloir » shipped a sense whose entire content was the word "or", from
  // `{{ng|... {{m|en|would}} or {{m|en|should}} ...}}` stripped non-recursively.
  const fragments = all.filter((v) => (v.meanings?.en || '').split('; ')
    .some((part) => /^(or|and|also|see|etc\.?)$/i.test(part.trim())))
    .map((v) => `${v.infinitive}: ${v.meanings.en}`);
  assert.deepEqual(fragments, []);
});

test('the verbs withheld for register are exactly these, and say so', () => {
  // Declared, so that silencing another verb fails this check and un-silencing
  // one without striking it from this list fails it too. The leading English
  // translation of each of these is explicit, which is the whole reason: it is
  // our own output that is refused, not somebody else's label.
  const WITHHELD = ['chier', 'enculer', 'masturber', 'merder', 'pisser'];
  const actual = all.filter((v) => v.glossWithheld).map((v) => v.infinitive).sort();
  assert.deepEqual(actual, [...WITHHELD].sort());
  for (const v of all.filter((x) => x.glossWithheld)) {
    assert.equal(v.glossWithheld, 'explicit');
    assert.deepEqual(v.meanings, {},
      `${v.infinitive} is marked withheld and still carries a meaning`);
  }
  // A withheld verb is not a verb with a missing gloss: the reason is on the
  // entry, so the page can say why instead of showing an empty field.
  for (const v of all) {
    if (!v.glossWithheld && !v.meanings?.en) continue;
    assert.ok(!(v.glossWithheld && v.meanings?.en));
  }
});

test('the index is measured against the budget, not assumed', () => {
  // It was 26 KiB gzipped when it held one sense per verb and was pushed at 80
  // without being re-measured. The number in the source comment has been wrong
  // once; this makes it fail rather than mislead.
  
  const gz = (p) => gzipSync(readFileSync(join(root, p)), { level: 9 }).length / 1024;
  const index = gz('content/verbs-index.json');
  console.log(`    index ${index.toFixed(1)} KiB gz · `
    + LEVELS.map((l) => `${l} ${gz(`content/verbs/${l}.json`).toFixed(0)}`).join(' ') + ' KiB gz');
  assert.ok(index < 90, `the verb index is ${index.toFixed(1)} KiB gzipped`);
  for (const l of LEVELS) {
    assert.ok(gz(`content/verbs/${l}.json`) < 100, `${l}.json is ${gz(`content/verbs/${l}.json`).toFixed(1)} KiB gz`);
  }
});
