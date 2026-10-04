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
import { translator } from '../web/src/lib/i18n.ts';
import { pick } from '../web/src/lib/exams.ts';
import { foldLabel, INVISIBLE, SCRIPT, isolatesBalanced } from './text-identity.mjs';

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
  // Left deliberately: English keeps these apart, the learner does not need them
  // apart. «Commencer» for both Start and Start studying, «À travailler» for the
  // heading and the label, are the same act in the same place.
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
 * Bidi isolation is the renderer's job, not the translator's wording.
 *
 * Twelve strings substituted Latin text — a French answer, a search query, a
 * level, a clock — straight into an RTL sentence, where the run and the
 * punctuation around it reorder on screen. The fix is in `translator()`, the
 * single point where substitution happens, and NOT at the call sites: a rule
 * applied at call sites is a rule one call site will always miss, and it will
 * be the one added next month by someone who never read that file.
 */
test('translator isolates every substituted value in a right-to-left language', () => {
  const problems = [];
  for (const loc of ['fa', 'ar']) {
    const t = translator(loc);
    const out = t('timeLeft', { c: '12:34' });
    if (!out.includes('\u2068' + '12:34' + '\u2069')) problems.push(`${loc}: ${JSON.stringify(out)}`);
    const q = translator(loc)('searchEmpty', { q: 'passé composé' });
    if (!q.includes('\u2068' + 'passé composé' + '\u2069')) problems.push(`${loc} searchEmpty: ${JSON.stringify(q)}`);
  }
  assert.deepEqual(problems, [], 'an unisolated substitution in RTL text');
});

test('translator leaves left-to-right languages alone', () => {
  // Isolates cost nothing to render but are noise where there is no conflict,
  // and an invisible character in an English string is a thing to explain later.
  for (const loc of ['en', 'fr']) {
    const out = translator(loc)('timeLeft', { c: '12:34' });
    assert.ok(!/[\u2066-\u2069]/.test(out), `${loc} should not be isolated: ${JSON.stringify(out)}`);
    assert.ok(out.includes('12:34'), `${loc} still substitutes: ${JSON.stringify(out)}`);
  }
});

test('every placeholder still survives substitution in all four languages', () => {
  const bad = [];
  for (const loc of LOC) {
    const t = translator(loc);
    for (const [k, v] of dict[loc]) {
      const names = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (!names.length) continue;
      const vars = Object.fromEntries(names.map((n) => [n, `<${n}>`]));
      const out = t(k, vars);
      if (/\{\w+\}/.test(out)) bad.push(`${loc}.${k} left a placeholder unfilled: ${out}`);
    }
  }
  assert.deepEqual(bad, [], 'a placeholder the translator could not fill');
});

// ── Content files ─────────────────────────────────────────────────────────
function walk(node, path, fn) {
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`, fn));
  else if (node && typeof node === 'object') {
    fn(node, path);
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, fn);
  }
}
const CONTENT = ['fr-core-a1.json', 'tense-names.json', 'exam-papers.json', 'decks.json', 'exams.json'];
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
 * so a French column would restate it.
 *
 * The three `ar: HELD` rows are a decision, not a backlog item. Arabic exam
 * text waits for a human reader of Arabic (docs/08-arabic-review.md). A wrong
 * explanation teaches a wrong thing and the learner believes it, so 72
 * unreviewed Arabic explanations would be worse than English plus a line
 * saying it is English — which is what an Arabic learner now sees.
 */
const EXPECTED_SHAPES = {
  'decks.json decks[].title':                          { n: 1,  have: 'en/fr/fa/ar' },
  'exam-papers.json papers[].name':                    { n: 4,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.papers.A1[].name':     { n: 4,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.papers.A2[].name':     { n: 4,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.papers.B1[].name':     { n: 4,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.papers.B2[].name':     { n: 4,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.papers.C1[].name':     { n: 4,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.papers.C2[].name':     { n: 2,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.compulsory[].name':    { n: 3,  have: 'en/fr/fa/ar' },
  'exams.json exams[].structure.optional[].name':      { n: 2,  have: 'en/fr/fa/ar' },
  // These three were PLAIN ENGLISH STRINGS until 2026-10-01, with no locale
  // keys at all — so the shape map could not see them and even the French
  // interface showed English. Found by looking at an RTL screenshot, where
  // the English also rendered with its full stops at the wrong end.
  'exam-papers.json papers[].official.passNote':       { n: 4,  have: 'en/fr/fa' },   // ar: HELD
  'exam-papers.json papers[].official.source':         { n: 4,  have: 'en/fr/fa' },   // ar: HELD
  'exam-papers.json papers[].practiceNote':            { n: 4,  have: 'en/fr/fa' },   // ar: HELD
  'exam-papers.json papers[].items[].prompt':          { n: 36, have: 'en/fr/fa' },   // ar: HELD
  'exam-papers.json papers[].items[].explain':         { n: 36, have: 'en/fr/fa' },   // ar: HELD
  'exam-papers.json papers[].items[].stimulus.label':  { n: 16, have: 'en/fr/fa' },   // ar: HELD
  'fr-core-a1.json title':                             { n: 1,  have: 'en/fr/fa/ar' },
  'fr-core-a1.json cards[].meanings':                  { n: 22, have: 'en/fr/fa/ar' },
  'fr-core-a1.json cards[].examples[].translations':   { n: 44, have: 'en/fa/ar' },   // fr by design
  'tense-names.json tenses.conditionnel':          { n: 1, have: 'en/fr/fa/ar' },
  'tense-names.json tenses.futur':                 { n: 1, have: 'en/fr/fa/ar' },
  'tense-names.json tenses.imparfait':             { n: 1, have: 'en/fr/fa/ar' },
  'tense-names.json tenses.passe-compose':         { n: 1, have: 'en/fr/fa/ar' },
  'tense-names.json tenses.passe-simple':          { n: 1, have: 'en/fr/fa/ar' },
  'tense-names.json tenses.present':               { n: 1, have: 'en/fr/fa/ar' },
  'tense-names.json tenses.subjonctif':            { n: 1, have: 'en/fr/fa/ar' },
  'tense-names.json tenses.subjonctif-imparfait':  { n: 1, have: 'en/fr/fa/ar' },
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

// ── The honest state, where a language is deliberately absent ─────────────
test('a learner reading a language the exam text lacks is told so, not served English in silence', () => {
  const papers = JSON.parse(R('content/exam-papers.json')).papers;
  const items = papers.flatMap((p) => p.items);

  // The decision, asserted: Persian is there, Arabic is deliberately not.
  assert.ok(items.every((i) => i.explain.fa?.trim()), 'every explanation exists in Persian');
  assert.ok(items.every((i) => !i.explain.ar), 'no Arabic explanation is shipped before a reader has seen it');

  // pick() is what draws the line, and it has to report the absence.
  assert.equal(pick(items[0].explain, 'fa').translated, true);
  assert.equal(pick(items[0].explain, 'ar').translated, false);
  assert.ok(pick(items[0].explain, 'ar').text.trim(), 'and still shows something readable');

  // and the line exists to be drawn with, in all four languages.
  for (const c of LOC) {
    assert.ok(dict[c].get('notTranslatedHere')?.trim(), `${c} can say the content is not in its language`);
  }
});

test('French quotations inside Persian explanations are isolated, and the isolates are balanced', () => {
  // « Fermé le dimanche et le lundi » inside a Persian sentence reorders on
  // screen without FSI…PDI around it. A stray opener is worse than none: it
  // swallows the rest of the paragraph.
  const items = JSON.parse(R('content/exam-papers.json')).papers.flatMap((p) => p.items);
  const unbalanced = [];
  let isolated = 0;
  for (const it of items) {
    for (const field of ['prompt', 'explain']) {
      const fa = it[field].fa;
      if (!fa) continue;
      if (!isolatesBalanced(fa)) unbalanced.push(`${it.id}.${field}`);
      isolated += [...fa.matchAll(/\u2068/g)].length;
    }
  }
  assert.deepEqual(unbalanced, [], 'unbalanced bidi isolates');
  assert.ok(isolated >= 60, `only ${isolated} isolated runs; the French quotations should be wrapped`);
});

test('no learner-facing content field is a bare string instead of a set of languages', () => {
  // The shape map can only report on fields that HAVE languages. A field that
  // is a plain string has none, so it is invisible to it — which is how three
  // paragraphs stayed English in every interface, French included.
  const LEARNER_TEXT = /^(passNote|practiceNote|source|label|prompt|explain|title|name)$/;
  /**
   * Named, with reasons, rather than loosening the pattern:
   *  - a licence's formal name is a legal identifier and is not translated;
   *  - an external page's title is in that page's own language and carries its
   *    own `lang` field, so translating it would misattribute it.
   */
  const NOT_OURS_TO_TRANSLATE = new Set([
    'exam-papers.json licence.name',
    'exams.json exams[].resources[].title',
  ]);
  const bare = [];
  for (const file of CONTENT) {
    walk(JSON.parse(R(`content/${file}`)), '', (node, path) => {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'string' && LEARNER_TEXT.test(k)) {
          const id = `${file} ${path.replace(/\[\d+\]/g, '[]')}.${k}`;
          if (!NOT_OURS_TO_TRANSLATE.has(id)) bare.push(id);
        }
      }
    });
  }
  assert.deepEqual([...new Set(bare)], [],
    'learner-facing text must be {en, fr, …} so it can be translated and so this map can see it');
});

test('Persian and Arabic text uses the same digits the application substitutes', () => {
  // The app renders numbers with `String(v)` — 30, 25, 12:34 — so prose written
  // with ۰۱۲ or ٠١٢ puts two numbering systems on one card. The exam paper
  // screen showed « ۲۵ نمره » beside « 25 », which a Persian reader sees at once
  // and a machine checking only the dictionary never would.
  //
  // This fixes the INCONSISTENCY, not the choice: localising every number
  // (scores, clocks, counts) is a product decision, and until it is taken the
  // honest state is one system everywhere.
  const INDIC = /[\u0660-\u0669\u06F0-\u06F9]/;
  const bad = [];
  for (const c of ['fa', 'ar']) {
    for (const [k, v] of dict[c]) if (INDIC.test(v)) bad.push(`${c}.${k}: ${v.slice(0, 40)}`);
  }
  for (const file of CONTENT) {
    walk(JSON.parse(R(`content/${file}`)), '', (node, path) => {
      for (const l of ['fa', 'ar']) {
        if (typeof node[l] === 'string' && INDIC.test(node[l])) {
          bad.push(`${file} ${path}.${l}: ${node[l].slice(0, 40)}`);
        }
      }
    });
  }
  assert.deepEqual(bad, [], 'two numbering systems on one screen');
});
