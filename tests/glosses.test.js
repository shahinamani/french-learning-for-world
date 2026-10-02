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

test('a sense Wiktionary labels vulgar is refused, and the refusal is recorded', () => {
  const { kept, rejected } = probe('tests/fixtures/gloss-senses.wiki');
  assert.ok(!JSON.stringify(kept).includes('UNSHIPPABLE'),
    `a vulgar-labelled sense reached a learner: ${JSON.stringify(kept)}`);
  const byLabel = rejected.filter((r) => r.why === 'label');
  assert.ok(byLabel.some((r) => r.labels.includes('vulgar')),
    'nothing was rejected by label — the filter is not running at all');
});

test('a derogatory sense is refused too, not only a vulgar one', () => {
  const { kept, rejected } = probe('tests/fixtures/gloss-comment-and-slur.wiki');
  assert.ok(!JSON.stringify(kept).includes('SLUR'), 'a slur reached a learner');
  assert.ok(rejected.some((r) => r.why === 'label' && r.labels.includes('derogatory')));
  // Both comment forms, and both senses behind them. Two rules strip comments:
  // closed ones anywhere, and one left unclosed to the end of the section. The
  // second alone would take every sense after the first comment with it, so
  // this asserts the sense AFTER a closed comment is still there — without it,
  // deleting the closed-comment rule broke nothing and the suite stayed green.
  assert.deepEqual(kept, ['to eat', 'to drink'],
    'a sense behind an HTML comment was lost or a comment reached the gloss');
});

test('a verb whose every sense is refused gets no gloss at all', () => {
  const { kept, rejected } = probe('tests/fixtures/gloss-all-rejected.wiki');
  assert.deepEqual(kept, [], 'a gloss survived where every sense was rejected');
  assert.equal(rejected.length, 2);
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
  // one without striking it from this list fails it too. Every English
  // translation Wiktionary records for these is labelled vulgar.
  const WITHHELD = ['chier', 'démerder', 'emmerder', 'enculer', 'entuber',
                    'gueuler', 'merder'];
  const actual = all.filter((v) => v.glossWithheld).map((v) => v.infinitive).sort();
  assert.deepEqual(actual, [...WITHHELD].sort());
  for (const v of all.filter((x) => x.glossWithheld)) {
    assert.equal(v.glossWithheld, 'vulgar');
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
