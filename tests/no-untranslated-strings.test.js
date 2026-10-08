/**
 * A string that never enters the dictionary cannot be caught by a parity check
 * on the dictionary.
 *
 * `tests/i18n-four-languages.test.js` proves all four dictionaries carry the
 * same keys. It said nothing about `<a className="skip">Skip to content</a>`,
 * the theme selector's «Theme / System / Light / Dark», or two route stubs that
 * took English prose as a prop — because none of those strings was ever a key.
 * Every one of them rendered in English on a Persian and an Arabic page, and
 * the first screenshot of an RTL page showed the skip link in English across
 * the Persian app name.
 *
 * Same family as #11: the checker reported truthfully on the set it was given,
 * and the defect lived outside the set.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `.pathname` percent-encodes: a clone under a path containing a space
// gave `/Users/.../Projects%20Shahin/...` and the suite could not start.
const SRC = fileURLToPath(new URL('../web/src/', import.meta.url));

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
});
const FILES = walk(SRC);

test('there are components to check — a guard over no files guards nothing', () => {
  assert.ok(FILES.length >= 15, `found ${FILES.length} .tsx files`);
});

/**
 * Words that are the same in every language we ship, or are not words.
 * Each one is here because it was looked at, not because it was convenient.
 */
const NOT_TRANSLATABLE = new Set([
  'A1', 'A2', 'B1', 'B2', 'C1', 'C2',   // CEFR levels, the same in every language
  'DELF', 'DALF', 'TCF', 'TEF',          // examination names, proper nouns
]);

const strip = (s) => s.replace(/\{[^}]*\}/g, '').trim();

test('no user-visible text is written into a component instead of the dictionary', () => {
  const offenders = [];
  for (const file of FILES) {
    const src = readFileSync(file, 'utf8');
    const rel = file.slice(SRC.length);

    // Text between JSX tags: >Some words<
    for (const m of src.matchAll(/>([^<>{}\n]{3,})</g)) {
      const text = strip(m[1]);
      if (!/[A-Za-z]{3}/.test(text)) continue;        // punctuation, digits, spacing
      if (NOT_TRANSLATABLE.has(text)) continue;
      // `x >= 1 && Number(mins[1])` sits between a `>` and a `<` too. Prose does
      // not contain operators; code does. Rejecting on them rather than trying
      // to parse JSX keeps this honest about what it can and cannot see.
      if (/[=&|;()[\]$+*/\\]/.test(text)) continue;
      if (!/^[A-Z]/.test(text) && !text.includes(' ')) continue;  // css-ish fragments
      offenders.push(`${rel}: >${text}<`);
    }

    // Attributes a screen reader or a tooltip speaks.
    for (const m of src.matchAll(/\b(aria-label|aria-description|placeholder|alt|title)="([^"]{3,})"/g)) {
      const text = strip(m[2]);
      if (!/[A-Za-z]{3}/.test(text) || NOT_TRANSLATABLE.has(text)) continue;
      offenders.push(`${rel}: ${m[1]}="${text}"`);
    }
  }
  assert.deepEqual(offenders, [],
    'put it in web/src/lib/i18n.ts and the three locale files, and read it back with t()');
});

test('every key the components ask for exists in all four dictionaries', () => {
  // The reverse drift: t('somethingNew') added, dictionaries not updated. The
  // translator falls back to English silently, so nothing else would notice.
  const asked = new Set();
  for (const file of FILES) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g)) {
      asked.add(m[1]);
    }
  }
  assert.ok(asked.size >= 60, `found only ${asked.size} t() calls; fix the scan, not this number`);

  const dicts = {};
  for (const [code, p] of [['en', '../web/src/lib/i18n.ts'], ['fr', '../web/src/lib/locales/fr.ts'],
                           ['fa', '../web/src/lib/locales/fa.ts'], ['ar', '../web/src/lib/locales/ar.ts']]) {
    dicts[code] = readFileSync(new URL(p, import.meta.url), 'utf8');
  }
  // The landing page's strings are the one legitimate absence: a locale without
  // them is saying nobody has written that page in that language, and the page
  // shows English behind `landingUntranslated` rather than a machine
  // translation of the one screen a stranger judges the project by. English
  // holds them in `landingEn`, which these regexes find in the same file.
  //
  // Narrow on purpose: `landing*` keys may be absent from fa and ar and from
  // nowhere else. A missing key anywhere else still fails, and the
  // all-or-nothing rule is enforced in tests/i18n-app.test.js.
  // Two optional groups now. Named by prefix because that is how they are
  // named in i18n.ts, and asserted below to be present in English and French so
  // the exception cannot swallow the fallback the page actually serves.
  const OPTIONAL = ['landing', 'next', 'importTooLarge'];
  const landingMayBeAbsent = (key, code) =>
    OPTIONAL.some((p) => key.startsWith(p)) && (code === 'fa' || code === 'ar');

  const missing = [];
  for (const key of [...asked].sort()) {
    for (const [code, src] of Object.entries(dicts)) {
      if (new RegExp(`\\b${key}\\s*:`).test(src)) continue;
      if (landingMayBeAbsent(key, code)) continue;
      missing.push(`${code} has no "${key}"`);
    }
  }
  assert.deepEqual(missing, [], 'a component asks for a key that does not exist');

  // And the exception must not have swallowed the English, which is what the
  // fallback actually serves. A landing key missing from `landingEn` would
  // render the key's own name on the front page.
  const landingAsked = [...asked].filter((k) => OPTIONAL.some((p) => k.startsWith(p)));
  assert.ok(landingAsked.length > 25,
    `only ${landingAsked.length} optional keys are asked for — the scan missed a screen`);
  for (const key of landingAsked) {
    assert.match(dicts.en, new RegExp(`\\b${key}\\s*:`),
      `a screen asks for ${key} and English does not define it`);
    assert.match(dicts.fr, new RegExp(`\\b${key}\\s*:`),
      `French has the landing page and is missing ${key}`);
  }
});
