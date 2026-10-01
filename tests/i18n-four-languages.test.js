/**
 * The four languages, checked the way a reader of each would check them.
 *
 * docs/lessons.md #9 says: a collision can exist in one language and not
 * another — the language you don't speak is the one that survives. Nobody in
 * this project's loop reads Arabic; Persian has one reader. So every defect of
 * that class hides in Arabic first and Persian second, while the English and
 * French views look fine. This file exists to look where nobody is looking.
 *
 * What it does NOT do: judge whether a translation is good. It judges only what
 * a machine can judge without reading the language — parity, collisions,
 * script, invisible characters, and text direction. Arabic still needs a human
 * reader before launch, and that is a named item in docs/07, not an assumption.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foldLabel, INVISIBLE, SCRIPT } from './text-identity.mjs';

const LOC = ['en', 'fr', 'fa', 'ar'];
const R = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const src = R('web/src/lib/i18n.ts');
const sourceFor = (c) => (c === 'en' ? src : R(`web/src/lib/locales/${c}.ts`));

function bodyOf(code) {
  const text = sourceFor(code);
  const m = new RegExp(`const ${code}(?:\\s*:\\s*\\w+)?\\s*=\\s*\\{`).exec(text);
  assert.ok(m, `dictionary ${code} was found`);
  const open = text.indexOf('{', m.index + m[0].length - 1);
  let d = 0, end = -1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') d++;
    else if (ch === '}') { d--; if (!d) { end = i; break; } }
  }
  return text.slice(open + 1, end);
}

/**
 * Reads a value whichever quote style it uses.
 *
 * The regex this replaces — `/(\w+)\s*:\s*'((?:[^'\\]|\\.)*)'/g` — matched
 * single-quoted values only, and silently skipped 13 French strings. Every one
 * of the 13 is double-quoted BECAUSE it contains an apostrophe, which is to say
 * the check could not see precisely the strings most likely to carry an
 * apostrophe fault. Same shape as #3: it reported on a subset and called it the
 * set.
 */
function entries(code) {
  const body = bodyOf(code);
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
}

const dict = Object.fromEntries(LOC.map((c) => [c, entries(c)]));

test('every dictionary was read whole — not a quote-style subset of itself', () => {
  const sizes = LOC.map((c) => dict[c].size);
  for (const [i, n] of sizes.entries()) {
    assert.ok(n > 150, `${LOC[i]} yielded ${n} values; fix the extraction, not this number`);
  }
  assert.equal(new Set(sizes).size, 1,
    `the four dictionaries read as ${LOC.map((c, i) => `${c}=${sizes[i]}`).join(' ')} — ` +
    'unequal counts mean the reader is missing values in one language, which is how ' +
    '13 French strings went unchecked');
});

// ── Collisions, per language ──────────────────────────────────────────────
/**
 * Two keys whose translations read identically, where English keeps them apart.
 * This is docs/lessons.md #9 applied to the interface: `phon.elision` and
 * `phon.elision.basic` were both « L'élision » and survived because the English
 * names differed.
 *
 * KNOWN, dated 2026-10-01, and asserted EXACTLY — the test fails if one is
 * added AND if one is fixed without being struck from this list. An allowlist
 * that only ever grows is a way of not fixing things.
 */
const KNOWN_COLLISIONS = [
  'ar: close + dismiss',
  'fa: close + dismiss',
  'fr: close + dismiss',
  'fr: marks + concepts',
  'fr: start + startSession',
  'fr: whatToWorkOn + toWorkOn',
];
/** Keys English itself does not distinguish, so no translation can be asked to. */
const SAME_IN_ENGLISH_TOO = (a, b) =>
  foldLabel(dict.en.get(a) ?? '\u0000') === foldLabel(dict.en.get(b) ?? '\u0001');

test('no two interface strings read identically in a language where English keeps them apart', () => {
  const found = [];
  for (const c of LOC) {
    const seen = new Map();
    for (const [k, v] of dict[c]) {
      const f = foldLabel(v);
      if (!f) continue;
      const first = seen.get(f);
      if (first === undefined) { seen.set(f, k); continue; }
      if (SAME_IN_ENGLISH_TOO(first, k)) continue;
      found.push(`${c}: ${first} + ${k}`);
    }
  }
  assert.deepEqual(found.sort(), KNOWN_COLLISIONS,
    'a label the learner sees twice for two different things — or a fixed one still listed');
});

// ── Script, letterforms and invisible characters ──────────────────────────
test('every Persian and Arabic string is actually in Arabic script', () => {
  const bad = [];
  for (const c of ['fa', 'ar']) {
    for (const [k, v] of dict[c]) {
      if (v.trim() && !SCRIPT.arabic.test(v)) bad.push(`${c}.${k}: "${v}"`);
    }
  }
  assert.deepEqual(bad, [], 'a value left in English or French under an RTL locale');
});

test('Persian uses Persian letterforms, not the Arabic ones that look like them', () => {
  // ک U+06A9 and ی U+06CC, not ك U+0643 and ي U+064A. The glyphs are nearly
  // identical; the codepoints are not, and no one who does not read Persian
  // will ever see the difference.
  const bad = [];
  for (const [k, v] of dict.fa) {
    const hits = [...new Set([...v.matchAll(SCRIPT.arabicOnlyInPersian)].map((m) => m[0]))];
    if (hits.length) bad.push(`fa.${k} uses ${hits.join(' ')}`);
  }
  assert.deepEqual(bad, [], 'Arabic letterforms in Persian text');
});

test('Persian uses the half-space, which is evidence a Persian reader wrote it', () => {
  // ZWNJ U+200C. Persian written without it throughout is Persian typed by
  // someone who does not write Persian. A count, not a verdict (#how-caught).
  const withZwnj = [...dict.fa.values()].filter((v) => v.includes('‌')).length;
  assert.ok(withZwnj >= 20,
    `only ${withZwnj} Persian strings use a half-space; expected the dictionary to read as hand-written Persian`);
  const arZwnj = [...dict.ar.values()].filter((v) => v.includes('‌'));
  assert.equal(arZwnj.length, 0, 'Arabic does not use the Persian half-space');
});

/**
 * Tatweel (U+0640) in `لـFrance` and `لـ «{q}»` is CORRECT Arabic typography:
 * the prefix ل cannot join to a Latin word, so the tatweel carries the
 * connection. It is listed rather than stripped, because a non-reader of Arabic
 * "tidying" it away would be introducing the defect, not removing one.
 */
const ALLOWED_TATWEEL = ['ar.examIndependence', 'ar.searchEmpty'];

test('no invisible character sits in a string where it carries no meaning', () => {
  const bad = [];
  for (const c of LOC) {
    for (const [k, v] of dict[c]) {
      for (const [name, re] of Object.entries(INVISIBLE)) {
        const hits = v.match(re);
        if (!hits) continue;
        if (name === 'zwnj' && c === 'fa') continue;
        if (name === 'tatweel' && ALLOWED_TATWEEL.includes(`${c}.${k}`)) continue;
        bad.push(`${c}.${k}: ${hits.length}× ${name}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'invisible characters cannot be reviewed by eye, so they are checked here');
});

test('no value is empty or padded with space', () => {
  const bad = [];
  for (const c of LOC) {
    for (const [k, v] of dict[c]) {
      if (!v.trim()) bad.push(`${c}.${k} is empty`);
      else if (v !== v.trim()) bad.push(`${c}.${k} has edge whitespace`);
    }
  }
  assert.deepEqual(bad, [], 'empty or padded interface strings');
});

// ── French typography, in the dictionary and not only in content ──────────
test('French interface strings use the typographic apostrophe', () => {
  // web/src/lib/typography.ts fr() is applied to CONTENT — concept names, verb
  // forms, exam text — and never to t() output. So a prime in the dictionary
  // reaches the screen unconverted. Ten strings carried one; all ten were in
  // the 13 the old extractor could not see.
  const bad = [];
  for (const [k, v] of dict.fr) if (/\p{L}'\p{L}/u.test(v)) bad.push(`fr.${k}: "${v.slice(0, 50)}"`);
  assert.deepEqual(bad, [], 'straight apostrophes in French interface strings');
});

test('French keeps its space before the high punctuation', () => {
  const bad = [];
  for (const [k, v] of dict.fr) {
    if (/[^\s   ][;!?:]/.test(v)) bad.push(`fr.${k}: "${v.slice(0, 50)}"`);
  }
  assert.deepEqual(bad, [], 'French requires a space before ; ! ? :');
});

// ── Direction and bidi ────────────────────────────────────────────────────
test('both RTL languages are declared right-to-left', () => {
  for (const c of ['fa', 'ar']) {
    assert.match(src, new RegExp(`${c}:\\s*\\{[^}]*dir:\\s*'rtl'`), `${c} is declared rtl`);
  }
  for (const c of ['en', 'fr']) {
    assert.match(src, new RegExp(`${c}:\\s*\\{[^}]*dir:\\s*'ltr'`), `${c} is declared ltr`);
  }
});

/**
 * A placeholder that is replaced by LATIN text inside an RTL sentence needs
 * bidi isolation, or the substituted run and the punctuation around it reorder
 * on screen. Numbers are handled by the bidi algorithm; a French answer, a
 * search query, a level like "B1" and a clock like "12:34" are not reliably.
 *
 * `translator()` substitutes with a plain string split/join and the result goes
 * into a text node, so there is nothing isolating them today. KNOWN and dated;
 * the fix is in the renderer, not in these strings.
 */
const SUBSTITUTES_LATIN = new Set(['a', 'q', 'level', 'c']);
const KNOWN_UNISOLATED = [
  'ar.accentsOnly', 'ar.answerIs', 'ar.importDone', 'ar.searchEmpty',
  'ar.showingLevel', 'ar.timeLeft',
  'fa.accentsOnly', 'fa.answerIs', 'fa.importDone', 'fa.searchEmpty',
  'fa.showingLevel', 'fa.timeLeft',
];

test('Latin text substituted into an RTL sentence is isolated, or listed as not yet', () => {
  const found = [];
  for (const c of ['fa', 'ar']) {
    for (const [k, v] of dict[c]) {
      if (!SCRIPT.arabic.test(v)) continue;
      if (/[⁦-⁩‎‏]/.test(v)) continue;
      const ph = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (ph.some((p) => SUBSTITUTES_LATIN.has(p))) found.push(`${c}.${k}`);
    }
  }
  assert.deepEqual(found.sort(), KNOWN_UNISOLATED,
    'an unisolated Latin substitution in RTL text — or one fixed and still listed');
});

// ── Content files ─────────────────────────────────────────────────────────
function walk(node, path, fn) {
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, fn));
  else if (node && typeof node === 'object') {
    fn(node, path);
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, fn);
  }
}
const CONTENT = ['fr-core-a1.json', 'verbs.json', 'exam-papers.json', 'decks.json', 'exams.json'];
const shapes = () => {
  const out = new Map();
  for (const file of CONTENT) {
    walk(JSON.parse(R(`content/${file}`)), '', (node, path) => {
      const have = LOC.filter((l) => typeof node[l] === 'string');
      if (have.length < 2) return;
      const key = `${file} ${path.replace(/\[\d+\]/g, '[]')}`;
      const rec = out.get(key) ?? { n: 0, have: have.join('/') };
      rec.n++;
      out.set(key, rec);
    });
  }
  return out;
};

/**
 * What multilingual content exists today, and in which languages.
 *
 * `translations` carries no `fr` on purpose: it translates a French sentence,
 * so a French column would restate it. `verbs[].meanings.fr` is empty for the
 * same reason — the headword is the French. Everything else marked below as
 * short of all four is a real gap, inventoried rather than hidden, so that
 * "Persian and Arabic are supported" cannot be said while 158 nodes of it are
 * English-only.
 */
const EXPECTED_SHAPES = {
  'decks.json decks[].title':                          { n: 1,  have: 'en/fr/fa' },   // GAP: ar
  'exam-papers.json papers[].name':                    { n: 3,  have: 'en/fr/fa/ar' },
  'exam-papers.json papers[].items[].prompt':          { n: 28, have: 'en/fr' },      // GAP: fa, ar
  'exam-papers.json papers[].items[].explain':         { n: 28, have: 'en/fr' },      // GAP: fa, ar
  'exam-papers.json papers[].items[].stimulus.label':  { n: 16, have: 'en/fr' },      // GAP: fa, ar
  'fr-core-a1.json title':                             { n: 1,  have: 'en/fr/fa' },   // GAP: ar
  'fr-core-a1.json cards[].meanings':                  { n: 22, have: 'en/fr/fa/ar' },
  'fr-core-a1.json cards[].examples[].translations':   { n: 44, have: 'en/fa/ar' },   // fr by design
  'verbs.json verbs[].meanings':                       { n: 14, have: 'en/fr/fa/ar' },
  'verbs.json verbs[].tenses[].name':                  { n: 84, have: 'en/fr' },      // GAP: fa, ar
};

test('the multilingual shape of the content is exactly what is written down', () => {
  const actual = Object.fromEntries([...shapes()].map(([k, v]) => [k, v]).sort());
  assert.deepEqual(actual, EXPECTED_SHAPES,
    'content gained or lost a language somewhere — update this map deliberately, ' +
    'so nobody can claim four-language support that 158 nodes do not have');
});

test('Persian and Arabic content is in Arabic script, with Persian letterforms', () => {
  const bad = [];
  for (const file of CONTENT) {
    walk(JSON.parse(R(`content/${file}`)), '', (node, path) => {
      for (const l of ['fa', 'ar']) {
        const v = node[l];
        if (typeof v !== 'string' || !v.trim()) continue;
        if (!SCRIPT.arabic.test(v)) bad.push(`${file} ${path}.${l}: "${v.slice(0, 40)}"`);
        if (l === 'fa') {
          const hits = [...new Set([...v.matchAll(SCRIPT.arabicOnlyInPersian)].map((m) => m[0]))];
          if (hits.length) bad.push(`${file} ${path}.fa uses ${hits.join(' ')}`);
        }
      }
    });
  }
  assert.deepEqual(bad, [], 'content in the wrong script, or Persian written with Arabic letterforms');
});
