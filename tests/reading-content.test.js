/**
 * The reading texts, checked against the whole file.
 *
 * These are content checks, not a teacher's reading. They can tell you that a
 * highlight will land, that an answer index exists, that the Persian is in
 * Persian script and that the stated reading time follows from the stated
 * pace. They cannot tell you the French is good, the Persian natural, or the
 * level right. **Nothing here is evidence of review**, and the file's own
 * `reviewNote` says so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const file = read('content/reading.json');
const texts = file.texts;

// Latin letters, including accented ones (French leaking into Persian).
const LATIN = /[A-Za-zÀ-ɏ]/;
// Persian/Arabic script block.
const ARABIC = /[؀-ۿ]/;
// French quoted inside Persian prose is deliberate (« Cela ne signifie pas… »):
// the learner is being shown the exact words of the text. Remove those spans
// before looking for leakage.
const withoutQuotedFrench = (s) => s.replace(/«[^»]*[A-Za-zÀ-ɏ][^»]*»/g, '');
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s) => s.split(/(?<=[.!?؟])\s+/).filter(Boolean);

test('four texts: one per category, two at A1/A2 and two at B1', () => {
  assert.equal(texts.length, 4);
  assert.deepEqual(texts.map((t) => t.category).sort(), ['culture', 'daily', 'science', 'work']);
  const levels = texts.map((t) => t.level);
  assert.equal(levels.filter((l) => l === 'A1' || l === 'A2').length, 2);
  assert.equal(levels.filter((l) => l === 'B1').length, 2);
});

test("level is the author's assignment and says so; it is never presented as a measurement", () => {
  for (const t of texts) {
    assert.equal(t.levelBasis, 'author', `${t.id}: levelBasis`);
    assert.ok(['A1', 'A2', 'B1'].includes(t.level), `${t.id}: level ${t.level}`);
  }
  assert.match(file.levelNote, /ASSIGNED BY THE AUTHOR/);
});

test('each text is 120-220 words and the stated count is the real count', () => {
  for (const t of texts) {
    const n = words(t.body.fr);
    assert.ok(n >= 120 && n <= 220, `${t.id}: ${n} words`);
    assert.equal(t.words, n, `${t.id}: stated ${t.words}, counted ${n}`);
  }
});

test('reading time follows from the stated pace, within 5 seconds', () => {
  // Tolerance: `seconds` is rounded to the nearest second, so the true error
  // is under 1 s; 5 s allows a hand edit of the pace without a regenerate but
  // not a time that was never computed.
  for (const t of texts) {
    const { wordsPerMinute: wpm, seconds } = t.readingTime;
    assert.ok(Number.isInteger(wpm) && wpm >= 60 && wpm <= 250, `${t.id}: implausible pace ${wpm}`);
    const expected = (words(t.body.fr) / wpm) * 60;
    assert.ok(Math.abs(seconds - expected) <= 5,
      `${t.id}: ${seconds}s stated, ${expected.toFixed(1)}s from ${wpm} wpm`);
  }
  assert.match(file.note, /ASSUMED/, 'the file must say the pace is an assumption');
});

test('the highlight will land: every sentenceFromText is a literal substring of its text', () => {
  // The Reader highlights by searching for the sentence in body.fr.
  for (const t of texts) {
    assert.ok(t.vocabulary.length >= 6 && t.vocabulary.length <= 10,
      `${t.id}: ${t.vocabulary.length} vocabulary items`);
    for (const v of t.vocabulary) {
      assert.ok(v.sentenceFromText.length > 0, `${t.id}/${v.fr}: empty sentence`);
      assert.ok(t.body.fr.includes(v.sentenceFromText),
        `${t.id}/${v.fr}: sentence not in text: "${v.sentenceFromText}"`);
      for (const k of ['fr', 'fa', 'en']) assert.ok(v[k] && v[k].trim(), `${t.id}/${v.fr}: empty ${k}`);
    }
    const keys = t.vocabulary.map((v) => v.fr);
    assert.equal(new Set(keys).size, keys.length, `${t.id}: duplicate vocabulary item`);
  }
});

test('every question has 4 distinct options, one in-range answer, and an explanation in both languages', () => {
  for (const t of texts) {
    assert.ok(t.questions.length >= 3 && t.questions.length <= 5, `${t.id}: ${t.questions.length} questions`);
    for (const q of t.questions) {
      const where = `${t.id}/${q.id}`;
      assert.equal(q.options.length, 4, `${where}: options`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, `${where}: answer ${q.answer}`);
      for (const loc of ['en', 'fa']) {
        assert.ok(q.prompt[loc]?.trim(), `${where}: prompt.${loc}`);
        assert.ok(q.explain[loc]?.trim().length > 30, `${where}: explain.${loc} is empty or a stub`);
        for (const o of q.options) assert.ok(o[loc]?.trim(), `${where}: option ${loc}`);
        const set = new Set(q.options.map((o) => o[loc]));
        assert.equal(set.size, 4, `${where}: duplicate options in ${loc}`);
      }
    }
  }
  const ids = texts.flatMap((t) => t.questions.map((q) => q.id));
  assert.equal(new Set(ids).size, ids.length, 'question ids must be unique');
});

test('the answers are not all in one position (a lazy pattern is guessable without reading)', () => {
  const positions = texts.flatMap((t) => t.questions.map((q) => q.answer));
  assert.ok(new Set(positions).size >= 3, `answers only use positions ${[...new Set(positions)]}`);
  for (const t of texts) {
    assert.ok(new Set(t.questions.map((q) => q.answer)).size >= 2, `${t.id}: every answer in one slot`);
  }
});

test('Persian is in Persian script, with no Latin leakage', () => {
  // What this accused on its first run: the Persian explanation of q1 in the
  // market text carried the bare word "alors" in Latin script in the middle of
  // Persian prose. The check was right and the data was wrong (every other
  // French word in these fields was already inside « »), so the data was fixed
  // to quote it as «alors». The « » exception below is the one deliberate
  // allowance, and it is limited to prompts and explanations: titles, bodies,
  // vocabulary and options get no exception at all.
  const strict = (label, s) => {
    assert.ok(ARABIC.test(s), `${label}: no Persian script`);
    assert.ok(!LATIN.test(s), `${label}: Latin letters in Persian field: "${s}"`);
  };
  for (const t of texts) {
    strict(`${t.id} title.fa`, t.title.fa);
    strict(`${t.id} description.fa`, t.description.fa);
    strict(`${t.id} body.fa`, t.body.fa);
    for (const v of t.vocabulary) strict(`${t.id}/${v.fr} fa`, v.fa);
    for (const q of t.questions) {
      for (const o of q.options) strict(`${t.id}/${q.id} option.fa`, o.fa);
      for (const [k, s] of [['prompt', q.prompt.fa], ['explain', q.explain.fa]]) {
        assert.ok(ARABIC.test(s), `${t.id}/${q.id} ${k}.fa: no Persian script`);
        const rest = withoutQuotedFrench(s);
        assert.ok(!LATIN.test(rest), `${t.id}/${q.id} ${k}.fa: Latin outside a « » quotation: "${rest}"`);
      }
    }
  }
});

test('the translations are not stubs: about as many sentences as the French', () => {
  // A truncated or collapsed translation would pass every other check.
  for (const t of texts) {
    const nf = sentences(t.body.fr).length;
    const np = sentences(t.body.fa).length;
    assert.ok(Math.abs(nf - np) <= 3, `${t.id}: ${nf} French sentences, ${np} Persian`);
    assert.ok(words(t.body.fa) >= words(t.body.fr) * 0.6, `${t.id}: Persian is suspiciously short`);
    assert.ok(words(t.body.en) >= words(t.body.fr) * 0.7, `${t.id}: English is suspiciously short`);
  }
});

test('titles and descriptions exist in fr, en and fa', () => {
  for (const t of texts) {
    for (const k of ['title', 'description']) {
      for (const loc of ['fr', 'en', 'fa']) assert.ok(t[k][loc]?.trim(), `${t.id}: ${k}.${loc}`);
    }
  }
});

test('no text is duplicated, within the file or against the dialogue unit already in the repo', () => {
  const ids = texts.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(texts.map((t) => t.body.fr)).size, texts.length);
  assert.equal(new Set(texts.map((t) => t.title.fr)).size, texts.length);
  const seen = new Map();
  for (const t of texts) {
    for (const s of sentences(t.body.fr)) {
      if (words(s) < 6) continue;
      assert.ok(!seen.has(s), `"${s}" is in both ${seen.get(s)} and ${t.id}`);
      seen.set(s, t.id);
    }
  }
  const dialogues = read('content/dialogues.json');
  const lines = new Set(dialogues.dialogues.flatMap((d) => d.lines.map((l) => l.fr)));
  for (const s of seen.keys()) assert.ok(!lines.has(s), `copies a dialogue line: ${s}`);
});

test('provenance: original, own, licensed, dated; and nothing is reviewed', () => {
  for (const t of texts) {
    assert.deepEqual(t.source, {
      kind: 'original', name: 'Written for French ma vie', licence: 'CC BY-SA 4.0',
      rightOfUse: 'own', readAt: t.source.readAt,
    }, `${t.id}: source`);
    assert.match(t.source.readAt, /^\d{4}-\d{2}-\d{2}$/, `${t.id}: readAt`);
    assert.equal(t.type, 'text');
    assert.deepEqual(t.review, { owner: null, teacher: null }, `${t.id}: review must be null/null`);
    assert.equal(t.review.teacher, null);
  }
  assert.match(file.reviewNote, /DRAFTED, NOT REVIEWED/);
});

test('every item carries the content-model fields; relations are lists, not claims', () => {
  for (const t of texts) {
    for (const k of ['id', 'type', 'level', 'levelBasis', 'topics', 'goals', 'skill', 'version',
      'title', 'body', 'source', 'review', 'relations']) {
      assert.ok(k in t, `${t.id}: missing ${k}`);
    }
    for (const k of ['words', 'verbs', 'grammar']) assert.ok(Array.isArray(t.relations[k]));
    for (const g of t.goals) {
      assert.ok(['general', 'daily', 'work', 'study', 'exam'].includes(g), `${t.id}: goal ${g}`);
    }
  }
});

test('topics name concepts that exist', () => {
  const concepts = readFileSync(new URL('../content/concepts.json', import.meta.url), 'utf8');
  for (const t of texts) {
    for (const topic of t.topics) assert.ok(concepts.includes(`"${topic}"`), `${t.id}: unknown topic ${topic}`);
  }
});
