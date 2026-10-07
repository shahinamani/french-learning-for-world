/**
 * Four-language parity for the REACT app's dictionary.
 *
 * `tests/content.test.js` has had a parity test since the beginning — and it
 * imports `app/i18n.js`, the vanilla portal's dictionary. The React app's
 * dictionary has never been checked. It was passing while `fa` and `ar` were
 * forty keys short, because the check was reading a different file from the one
 * the product ships (docs/lessons.md #6).
 *
 * The source is TypeScript, and the test runner has no transpiler, so the
 * dictionaries are extracted from the text. That is fragile in one specific
 * way — a reformat could defeat the extraction and the test would then pass on
 * nothing — so the extraction asserts it found four blocks with a plausible
 * number of keys before comparing anything (docs/lessons.md #2).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// English lives in i18n.ts (bundled, and the prerender needs it synchronously);
// the other three are separate modules, fetched only by a learner who reads
// them. The test follows the code rather than assuming one file.
const src = readFileSync(new URL('../web/src/lib/i18n.ts', import.meta.url), 'utf8');
const sourceFor = (code) => code === 'en'
  ? src
  : readFileSync(new URL(`../web/src/lib/locales/${code}.ts`, import.meta.url), 'utf8');

/** The body of `const <code>[: Dict] = { … };`. */
function bodyOf(code) {
  const text = sourceFor(code);
  const m = new RegExp(`const ${code}(?:\\s*:\\s*\\w+)?\\s*=\\s*\\{`).exec(text);
  if (!m) return null;
  const open = text.indexOf('{', m.index + m[0].length - 1);
  let depth = 0, end = -1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  return end < 0 ? null : text.slice(open + 1, end);
}

test('each non-English dictionary is its own lazy module', () => {
  for (const code of ['fr', 'fa', 'ar']) {
    const text = sourceFor(code);
    assert.match(text, new RegExp(`export default ${code}`), `${code} is a default export`);
    assert.ok(!src.includes(`const ${code}`),
      `${code} is NOT in the main bundle's i18n.ts — all four cost 13 820 B gzipped in the first load`);
  }
  assert.match(src, /const en = \{/, 'English stays bundled: the prerender needs it synchronously');
});

/**
 * Every top-level key, not only the ones that begin a line — this file puts
 * several keys on one line, and a line-anchored regex silently compared a
 * subset of 70 of about 150. The scanner walks the body, skips the inside of
 * quoted strings (French values are full of apostrophes and colons), skips
 * COMMENTS, and takes identifiers followed by `:` at brace depth 0.
 *
 * Comments were added on 2026-10-04, after a `//` comment reading "actually
 * here: 196 of the 261 concepts…" was read as a key named `here` and reported
 * as missing from every other locale. The parser was wrong, not the
 * dictionaries — and the next person to write a colon in a comment would have
 * hit the same thing, so this is fixed here rather than by rewording the prose.
 */
function keysOf(code) {
  const body = bodyOf(code);
  if (body == null) return null;
  const keys = [];
  let depth = 0, quote = null, token = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    // A comment can contain anything, including `word:`. Skip to its end.
    if (ch === '/' && body[i + 1] === '/') {
      while (i < body.length && body[i] !== '\n') i++;
      token = ''; continue;
    }
    if (ch === '/' && body[i + 1] === '*') {
      i += 2;
      while (i < body.length && !(body[i] === '*' && body[i + 1] === '/')) i++;
      i += 1; token = ''; continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; token = ''; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; token = ''; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; token = ''; continue; }
    if (depth === 0 && /[A-Za-z0-9_$]/.test(ch)) { token += ch; continue; }
    if (depth === 0 && ch === ':' && token) { keys.push(token); token = ''; continue; }
    token = '';
  }
  return keys;
}

const LOCALES = ['en', 'fr', 'fa', 'ar'];

test('the extraction found all four dictionaries with real content', () => {
  for (const code of LOCALES) {
    const keys = keysOf(code);
    assert.ok(keys, `dictionary ${code} was found in the source`);
    assert.ok(keys.length > 120,
      `dictionary ${code} has a plausible number of keys (found ${keys.length}) — ` +
      'if this fails after a reformat, fix the extraction rather than the assertion');
  }
});

test('the key scanner ignores comments, including colons inside them', () => {
  // Seen failing: before this, a comment reading "actually here: 196 of the 261
  // concepts…" produced a key called `here`. The check accused four correct
  // dictionaries of missing a key that did not exist.
  const en = keysOf('en');
  assert.ok(!en.includes('here'), 'a word from a comment is being read as a key');
  // And the scanner still finds the real keys around the comment.
  for (const real of ['conceptsWithExercises', 'noExercisesYet', 'mastery_solid']) {
    assert.ok(en.includes(real), `${real} was lost by the comment skipping`);
  }
});

/**
 * The landing page's copy lives in its own object, `landingEn`, and it is the
 * ONE part of the dictionary a locale is allowed not to have.
 *
 * Absence is a statement: nobody has written that page in that language, so the
 * page shows English with `landingUntranslated` above it. That is the truth,
 * and it is better than a machine translation of the one screen a stranger
 * judges the whole project by. Farsi is being written by hand; Arabic waits for
 * a reviewer, which is a launch condition.
 *
 * Read from the source rather than listed here, so the exception cannot drift
 * from the keys it is about.
 */
function landingKeys() {
  const m = /const landingEn\s*=\s*\{/.exec(src);
  assert.ok(m, 'landingEn was not found in i18n.ts');
  const open = src.indexOf('{', m.index + m[0].length - 1);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(open + 1, end);
  const keys = [...body.matchAll(/(?:^|\n)\s*([A-Za-z][A-Za-z0-9_$]*)\s*:/g)].map((x) => x[1]);
  assert.ok(keys.length > 20, `only ${keys.length} landing keys extracted — fix the extraction`);
  return keys;
}

test('every locale defines exactly the English key set, landing copy aside', () => {
  const expected = [...keysOf('en')].sort();
  const landing = landingKeys();
  for (const code of LOCALES.filter((c) => c !== 'en')) {
    const keys = keysOf(code);
    const missing = expected.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !expected.includes(k) && !landing.includes(k));
    assert.deepEqual(missing, [], `${code} is missing keys`);
    assert.deepEqual(extra, [], `${code} has keys English does not`);
  }
});

test('the landing copy is all present or all absent in a locale', () => {
  // Half a translated landing page is worse than an English one, because the
  // reader cannot tell which half they are getting — and `landingTranslated()`
  // in i18n.ts decides whether to show the "this is English" marker by exactly
  // this all-or-nothing rule. A locale with 29 of the 30 keys would show no
  // marker and one English sentence in the middle of a Persian page.
  const landing = landingKeys();
  const state = {};
  for (const code of LOCALES) {
    const keys = new Set(keysOf(code));
    const have = landing.filter((k) => keys.has(k));
    state[code] = have.length;
    assert.ok(have.length === 0 || have.length === landing.length,
      `${code} has ${have.length} of ${landing.length} landing strings — it must have `
      + `all of them or none: missing ${landing.filter((k) => !keys.has(k)).join(', ')}`);
  }
  // English holds them in landingEn rather than in `en`, so 0 here is right.
  assert.equal(state.en, 0, 'the landing copy belongs in landingEn, not in en');
  assert.equal(state.fr, landing.length, 'French has been written and must stay complete');
  // Recorded rather than asserted as permanent: when Shahin sends the Farsi it
  // becomes landing.length, and this line is what tells the next reader that
  // the English on those screens is deliberate and not a bug.
  for (const code of ['fa', 'ar']) {
    assert.ok(state[code] === 0 || state[code] === landing.length,
      `${code} is part-translated`);
  }
  console.log(`    landing copy: ${landing.length} strings · `
    + `fr ${state.fr ? 'written' : 'not written'} · `
    + `fa ${state.fa ? 'written' : 'English behind the marker'} · `
    + `ar ${state.ar ? 'written' : 'English behind the marker'}`);
});

test('no locale repeats a key', () => {
  for (const code of LOCALES) {
    const keys = keysOf(code);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    assert.deepEqual([...new Set(dupes)], [], `${code} has duplicate keys`);
  }
});

test('every locale is declared with a text direction', () => {
  for (const code of LOCALES) {
    const re = new RegExp(`${code}:\\s*\\{\\s*name:\\s*'[^']+',\\s*dir:\\s*'(ltr|rtl)'`);
    assert.match(src, re, `${code} declares a name and a direction in LOCALES`);
  }
  assert.match(src, /fa:\s*\{[^}]*dir:\s*'rtl'/, 'Persian is right-to-left');
  assert.match(src, /ar:\s*\{[^}]*dir:\s*'rtl'/, 'Arabic is right-to-left');
});

test('placeholders match across locales', () => {
  // A string with {n} in English must keep {n} everywhere, or a number
  // silently vanishes in one language and nobody notices.
  const bodies = Object.fromEntries(LOCALES.map((c) => [c, bodyOf(c)]));
  // Single-quoted values ONLY was the bug here: 13 French strings are
  // double-quoted because they contain an apostrophe, so this check silently
  // skipped them. tests/i18n-four-languages.test.js explains it at length.
  const read = (body) => {
    const out = new Map();
    let i = 0;
    for (;;) {
      const m = /([A-Za-z][A-Za-z0-9_$]*)\s*:\s*(['"`])/.exec(body.slice(i));
      if (!m) break;
      const [, key, q] = m;
      let j = i + m.index + m[0].length, val = '';
      while (j < body.length) {
        const ch = body[j];
        if (ch === '\\') { val += body[j + 1]; j += 2; continue; }
        if (ch === q) break;
        val += ch; j++;
      }
      out.set(key, val);
      i = j + 1;
    }
    return out;
  };
  const en = read(bodies.en);
  const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const problems = [];
  for (const code of ['fr', 'fa', 'ar']) {
    const dict = read(bodies[code]);
    for (const [k, v] of en) {
      const want = placeholders(v);
      if (!want.length || !dict.has(k)) continue;
      const got = placeholders(dict.get(k));
      if (want.join(',') !== got.join(',')) {
        problems.push(`${code}.${k}: expected {${want.join('} {')}}, got ${got.length ? '{' + got.join('} {') + '}' : 'none'}`);
      }
    }
  }
  assert.deepEqual(problems, [], 'placeholders are preserved in every translation');
});
