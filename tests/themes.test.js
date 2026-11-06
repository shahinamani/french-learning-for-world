/**
 * Themes and free resources (2026-11-06).
 *
 * scripts/build-themes.py needs Lexique (25 MB, not in the repository), so CI
 * cannot rebuild the themes. This test checks what the built files must still
 * satisfy without it: each theme word that claims to be a card IS that card,
 * with the card's own French and level; each exam link carries a source and a
 * date; and the free-resources catalogue keeps its rules.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const R = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const ARABIC_ONLY = /[يك]/;

const cards = new Map();
for (const lv of LEVELS) {
  for (const kind of ['word-cards', 'verb-cards']) {
    for (const c of R(`content/${kind}/${lv}.json`).cards) cards.set(c.key, { ...c, level: lv });
  }
}
const index = R('content/themes.json');
const files = readdirSync(new URL('../content/themes/', import.meta.url)).filter((f) => f.endsWith('.json'));
const themes = index.themes.map((t) => R(`content/themes/${t.id}.json`));

test('the index and the theme files are the same set, with the same counts', () => {
  assert.deepEqual(files.map((f) => f.replace('.json', '')).sort(), index.themes.map((t) => t.id).sort());
  for (const [i, t] of themes.entries()) {
    assert.deepEqual(index.themes[i].counts, { words: t.words.length, verbs: t.verbs.length, expressions: t.expressions.length }, t.id);
    assert.deepEqual(index.themes[i].exams, t.exams, t.id);
  }
});

test('every source theme was built', () => {
  const src = R('data/themes.json');
  assert.deepEqual(src.themes.map((t) => t.id).sort(), index.themes.map((t) => t.id).sort());
});

test('a theme word with a card key is that card: same French, same level', () => {
  for (const t of themes) {
    for (const w of [...t.words, ...t.verbs]) {
      if (!w.key) continue;
      const c = cards.get(w.key);
      assert.ok(c, `${t.id}: ${w.key} is not a card`);
      assert.equal(w.fr, c.fr, `${t.id}: ${w.key}`);
      assert.equal(w.level, c.level, `${t.id}: ${w.key}`);
      assert.ok(!w.levelEstimated, `${t.id}: ${w.key} is a card; its level is its band, not an estimate`);
    }
  }
});

test('a theme-only word says its level is an estimate, and is a noun with an article', () => {
  for (const t of themes) {
    for (const w of t.words.filter((x) => !x.key)) {
      assert.equal(w.levelEstimated, true, `${t.id}: ${w.fr}`);
      assert.ok(LEVELS.includes(w.level), `${t.id}: ${w.fr}`);
      assert.equal(w.type, 'noun', `${t.id}: ${w.fr}`);
      assert.match(w.article, /^(le|la|les|l’)$/, `${t.id}: ${w.fr}`);
    }
  }
});

test('no word is listed twice in one theme', () => {
  for (const t of themes) {
    const seen = new Set();
    for (const w of t.words) {
      const k = w.fr.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      assert.ok(!seen.has(k), `${t.id}: ${w.fr} twice`);
      seen.add(k);
    }
  }
});

test('expressions have a level, an English translation, and Persian in Persian letters', () => {
  for (const t of themes) {
    assert.equal(t.reviewed, false, `${t.id}: nobody has reviewed a theme yet`);
    for (const x of t.expressions) {
      assert.ok(LEVELS.includes(x.level), `${t.id}: ${x.fr}`);
      assert.ok(x.fr && x.en, `${t.id}: ${x.fr}`);
      assert.ok(['speaking', 'writing', 'both'].includes(x.use), `${t.id}: ${x.fr}`);
      if (x.fa) assert.ok(!ARABIC_ONLY.test(x.fa), `${t.id}: ${x.fr}`);
    }
  }
});

const EXAMS = { delf: ['A1', 'A2', 'B1', 'B2'], dalf: ['C1', 'C2'], tcf: [null], 'tcf-canada': [null], 'tef-canada': [null], tef: [null] };

test('every exam link names its exam, level, paper, source and the date it was read', () => {
  for (const t of themes) {
    for (const e of t.evidence) {
      assert.ok(e.exam in EXAMS, `${t.id}: exam ${e.exam}`);
      assert.ok(EXAMS[e.exam].includes(e.level), `${t.id}: ${e.exam} at level ${e.level}`);
      assert.ok(e.paper && e.topic, `${t.id}: ${e.topic}`);
      assert.match(e.source.url, /^https:\/\//, `${t.id}: ${e.topic}`);
      assert.match(e.source.readOn, /^\d{4}-\d{2}-\d{2}$/, `${t.id}: ${e.topic}`);
      assert.ok(e.source.what, `${t.id}: ${e.topic}`);
    }
    // The summary's exam list is exactly what the evidence supports.
    const want = [...new Set(t.evidence.map((e) => `${e.exam}|${e.level}`))].sort();
    assert.deepEqual(t.exams.map((e) => `${e.exam}|${e.level}`).sort(), want, t.id);
  }
});

// ── Free resources ────────────────────────────────────────────────────────
const res = R('content/resources.json');
const KINDS = ['podcast', 'video', 'book', 'website', 'exam-practice', 'news', 'dictionary', 'app'];

test('free resources: unique, https, a known kind, free or free tier, a check result', () => {
  assert.match(res.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  const ids = new Set(), urls = new Set();
  for (const r of res.resources) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`); ids.add(r.id);
    assert.ok(!urls.has(r.url), `duplicate url ${r.url}`); urls.add(r.url);
    assert.match(r.url, /^https:\/\//, r.id);
    assert.ok(KINDS.includes(r.kind), r.id);
    assert.ok(['free', 'free-tier'].includes(r.cost), r.id);
    assert.ok(['ok', 'blocked'].includes(r.checked), r.id);
    assert.ok(r.title && r.publisher && r.description, r.id);
    for (const e of r.exams) assert.ok(e in EXAMS, `${r.id}: ${e}`);
    // Levels are shown only where the publisher states them.
    if (r.levels.length) assert.equal(r.levelsFrom, 'publisher', r.id);
    for (const lv of r.levels) assert.ok(LEVELS.includes(lv), r.id);
  }
});

test('a site that answers every address with a bot challenge cannot be marked checked', () => {
  // france-education-international.fr returned 200 for a page that does not
  // exist on 2026-11-06 (an Anubis challenge), so a 200 from it proves nothing.
  for (const r of res.resources.filter((x) => x.url.startsWith('https://www.france-education-international.fr/'))) {
    assert.equal(r.checked, 'blocked', r.id);
  }
});
