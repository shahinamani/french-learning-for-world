/**
 * The name a learner reads, in the language they chose — or an honest statement
 * that we do not have it.
 *
 * `tests/i18n-four-languages.test.js` checks the 169 interface strings. Nothing
 * checked the *content* names, and that is where the defect was: all 297
 * concept names existed in English and French only, and eighteen call sites
 * read `ui === 'fr' ? name.fr : name.en`. A Persian learner was served English
 * in silence on Learn, Progress, Search, the concept page and the side panel.
 * The verb tenses were worse — `content/verbs.json` carries حال ساده and
 * المضارع for every tense, and a two-language TYPE threw them away, so the
 * compiler endorsed the loss.
 *
 * None of it was visible to any existing check:
 *   - key parity passes: content names are not keys;
 *   - the RTL walk passed 856 checks: direction and overflow were correct;
 *   - `tsc` passed: `Record<'en' | 'fr', string>` was satisfied exactly.
 * It was found by looking at a screenshot. That is not a method, which is why
 * this file exists.
 *
 * docs/lessons.md #9: a guard on an internal key is not a guard. Check the
 * field the user reads, in every language it is read in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { pick } from '../web/src/lib/exams.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const concepts = JSON.parse(readFileSync(join(root, 'content/concepts.json'), 'utf8'))
  .concepts.filter((c) => !c.retired);
const verbs = JSON.parse(readFileSync(join(root, 'content/verbs.json'), 'utf8')).verbs;
const LOCALES = ['en', 'fr', 'fa', 'ar'];

test('the inputs are populated — a check over an empty list checks nothing', () => {
  assert.ok(concepts.length >= 290, `${concepts.length} live concepts`);
  assert.ok(verbs.length >= 14, `${verbs.length} verbs`);
  const tenses = verbs.flatMap((v) => v.tenses);
  assert.ok(tenses.length >= 84, `${tenses.length} verb tenses`);
});

// ── 1. The shape. A name field must be able to hold every language ──────────

test('every content name is a locale map, not a two-language record', () => {
  const bad = [];
  for (const c of concepts) {
    if (!c.name || typeof c.name !== 'object') { bad.push(`${c.id}: no name object`); continue; }
    for (const k of Object.keys(c.name)) if (!LOCALES.includes(k)) bad.push(`${c.id}: unknown language "${k}"`);
  }
  for (const v of verbs) {
    for (const t of v.tenses) {
      for (const k of Object.keys(t.name ?? {})) {
        if (!LOCALES.includes(k)) bad.push(`${v.key} ${t.id}: unknown language "${k}"`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

// ── 2. What the learner actually gets, run through the real pick() ──────────

/**
 * Not a reimplementation: this imports the function the app renders with, so a
 * change to the fallback rule fails here rather than shipping. docs/lessons.md
 * #6 — `typography.test.js` read the source for the word "apostrophe" instead
 * of running the formatter, and a completely broken formatter satisfied it.
 */
test('pick() reports a fallback as a fallback, in every language, on real content', () => {
  const sample = concepts.find((c) => c.id === 'gram.present.irregular') ?? concepts[0];
  assert.equal(pick(sample.name, 'en').translated, true);

  const tense = verbs.find((v) => v.key === 'v:être').tenses.find((t) => t.id === 'present');
  assert.equal(pick(tense.name, 'fa').text, 'حال ساده');
  assert.equal(pick(tense.name, 'fa').translated, true, 'fa exists in verbs.json and must be served');
  assert.equal(pick(tense.name, 'fa').locale, 'fa');

  // A field with no Persian must say so rather than hand back English quietly.
  const noFa = { en: 'Grammar', fr: 'La grammaire' };
  assert.equal(pick(noFa, 'fa').text, 'Grammar');
  assert.equal(pick(noFa, 'fa').translated, false, 'English served to a Persian learner must report translated:false');
  assert.equal(pick(noFa, 'fa').locale, 'en', 'the lang attribute must name the language actually returned');
});

test('every verb tense name reaches a Persian and an Arabic learner', () => {
  const missing = [];
  for (const v of verbs) {
    for (const t of v.tenses) {
      for (const loc of ['fa', 'ar']) {
        if (!pick(t.name, loc).translated) missing.push(`${v.key} ${t.id} ${loc}`);
      }
    }
  }
  assert.deepEqual(missing, [],
    'these exist in content/verbs.json; if this fails, a type or a call site is discarding them again');
});

// ── 3. The coverage ledger ──────────────────────────────────────────────────

/**
 * Asserted with deepEqual, like KNOWN_COLLISIONS: translating a level without
 * updating this fails, and adding an untranslated concept fails too. An
 * allowlist that only ever grows is a way of not fixing things.
 *
 * Persian first because Shahin reads Persian and can check it. Arabic is held
 * for the same reason the exam text is held — nobody in this loop reads it, and
 * a wrong name is believed (docs/08-arabic-review.md).
 */
const EXPECTED_NAME_COVERAGE = {
  A1: { fa: 85, ar: 0 },
  A2: { fa: 0, ar: 0 },
  B1: { fa: 0, ar: 0 },
  B2: { fa: 0, ar: 0 },
  C1: { fa: 0, ar: 0 },
  C2: { fa: 0, ar: 0 },
};

test('concept name coverage per level and language is exactly what we declare', () => {
  const actual = {};
  for (const level of Object.keys(EXPECTED_NAME_COVERAGE)) {
    actual[level] = { fa: 0, ar: 0 };
    for (const c of concepts.filter((x) => x.level === level)) {
      for (const loc of ['fa', 'ar']) if (pick(c.name, loc).translated) actual[level][loc]++;
    }
  }
  assert.deepEqual(actual, EXPECTED_NAME_COVERAGE,
    'translate a level and raise the number here; add an untranslated concept and this tells you');
});

// ── 4. Distinctness in every language a name is read in ─────────────────────

/**
 * docs/lessons.md #10: a fold that touches learner-facing text must be
 * demonstrated against a real string in every script the product ships — run,
 * not asserted. The previous fold ended `[^a-z0-9']+`, which turns every
 * Persian and Arabic string into the empty string, so every such name would
 * have "collided" with every other.
 */
const fold = (s) => s
  .normalize('NFD')
  .replace(/[ً-ْٰ]/g, '')        // harakat: optional, like French accents
  .replace(/ـ/g, '')                        // tatweel: decoration
  .replace(/‌|‏|‎/g, '')          // ZWNJ and the direction marks: invisible
  .replace(/ك/g, 'ک').replace(/ي/g, 'ی')  // Arabic kaf/yeh → Persian
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
  .replace(/\p{M}+/gu, '')
  .toLowerCase().replace(/[’']/g, "'")
  .replace(/[^\p{L}\p{N}']+/gu, ' ').trim();

test('the fold survives every script this product ships — demonstrated, not assumed', () => {
  // If any of these folds to "", the guard below reports nonsense and gets
  // switched off within a week, leaving the languages nobody here reads
  // with no guard at all.
  for (const [label, s] of [
    ['English', 'The past subjunctive'],
    ['French', 'L’élision'],
    ['French ligature', 'Le cœur'],
    ['Persian', 'حال ساده'],
    ['Persian with ZWNJ', 'می‌رود'],
    ['Arabic', 'المضارع'],
    ['Arabic with harakat', 'يُعرض'],
  ]) {
    const folded = fold(s);
    console.log(`    fold(${label}) ${JSON.stringify(s)} -> ${JSON.stringify(folded)}`);
    assert.notEqual(folded, '', `${label} folded away to the empty string`);
  }
  // The two near-identical letter pairs must fold together, or a Persian name
  // written with Arabic letterforms reads as distinct while looking identical.
  assert.equal(fold('کی'), fold('كي'), 'Persian and Arabic kaf/yeh must fold together');
  assert.equal(fold('می‌رود'), fold('میرود'), 'the Persian half-space is invisible and must fold away');
});

for (const loc of LOCALES) {
  test(`no two concepts read identically in ${loc}`, () => {
    const seen = new Map();
    const clashes = [];
    for (const c of concepts) {
      const v = c.name?.[loc];
      if (!v || !v.trim()) continue;           // absent is handled by the ledger above
      const k = fold(v);
      if (seen.has(k)) clashes.push(`${loc}: ${seen.get(k)} + ${c.id} — both “${v}”`);
      else seen.set(k, c.id);
    }
    assert.deepEqual(clashes, []);
  });
}

// ── 5. The source guard: the next two-language branch fails CI, not a reader ─

/**
 * This is the part that outlives the fix. The defect was not the English text;
 * it was the shape `ui === 'fr' ? x.fr : x.en`, which no type and no runtime
 * check can distinguish from a deliberate choice. So the shape itself is
 * forbidden, and the detector is run against a planted sample on every run —
 * docs/lessons.md #8: a check seen red once is a check seen once.
 */
const TWO_LANGUAGE_BRANCH = /ui\s*===\s*'fr'\s*\?[^;}\n]*\.(?:fr|en)\b/;

const walk = (dir) => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? walk(p) : (/\.tsx?$/.test(p) ? [p] : []);
});

test('the two-language branch detector fires on a planted sample', () => {
  for (const planted of [
    "const name = settings.ui === 'fr' ? frText(c.name.fr) : c.name.en;",
    "{settings.ui === 'fr' ? tn.name.fr : tn.name.en}",
    "const label = settings.ui === 'fr' ? x.name.fr : x.name.en;",
  ]) {
    assert.ok(TWO_LANGUAGE_BRANCH.test(planted), `detector blind to: ${planted}`);
  }
  // And it must not fire on the legitimate neighbours it sits beside.
  for (const innocent of [
    "<Localised field={concept.name} />",
    "const shown = pick(concept.name, settings.ui);",
    "lang={settings.ui}",
  ]) {
    assert.ok(!TWO_LANGUAGE_BRANCH.test(innocent), `detector too broad: ${innocent}`);
  }
});

test('no source file chooses between exactly two languages for a content field', () => {
  const files = walk(join(root, 'web/src'));
  assert.ok(files.length >= 20, `only ${files.length} source files scanned`);
  const hits = [];
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (TWO_LANGUAGE_BRANCH.test(line)) hits.push(`${relative(root, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [],
    'use <Localised field={…} /> to render, or pick(field, ui) where a plain string is needed');
});
