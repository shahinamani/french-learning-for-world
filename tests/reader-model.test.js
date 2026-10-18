/**
 * The Reader's model, run against the whole of content/reading.json.
 *
 * AGENTS.md section 3: a check is run against the corpus before it lands. Each
 * assertion below was first run over all four texts, and the one place where
 * the check and the data disagreed is stated in the second test rather than
 * loosened away. These are structural facts about the screen; nothing here is
 * evidence that the French, the Persian or the glosses are right.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  splitSentences, tokenize, matchVocab, vocabInSentence, buildWordSave, wordItemId,
  applyFilters, parseFilters, writeFilters, EMPTY_FILTERS, durationOf, fold,
} from '../web/src/features/reader/model.ts';

const file = JSON.parse(readFileSync(new URL('../content/reading.json', import.meta.url), 'utf8'));
const texts = file.texts;
const norm = (s) => s.replace(/\s+/g, ' ').trim();

test('the sentences of every text put back together are the text', () => {
  for (const t of texts) {
    const segs = splitSentences(t.body.fr);
    assert.ok(segs.length >= 8, `${t.id}: ${segs.length} sentences`);
    assert.equal(norm(segs.map((s) => s.text).join(' ')), norm(t.body.fr), t.id);
  }
});

test('every glossary sentence lies inside one or two adjacent sentences', () => {
  // The A1 text quotes a seller (« ... ! ») and its glossary entry runs on
  // into the next sentence, so one entry spans TWO of this splitter's
  // sentences. That is the data's choice and a fair one; the Reader handles it
  // with vocabInSentence(), which matches in both directions. What would be a
  // real fault is an entry that no run of sentences contains.
  for (const t of texts) {
    const segs = splitSentences(t.body.fr).map((s) => s.text);
    for (const v of t.vocabulary) {
      const hit = segs.some((_, i) => [segs[i], segs.slice(i, i + 2).join(' ')].some((c) => c.includes(v.sentenceFromText)));
      assert.ok(hit, `${t.id}: "${v.sentenceFromText}" is in no run of two sentences`);
      assert.ok(segs.some((s) => vocabInSentence(s, [v]).length === 1), `${t.id}: ${v.fr} reaches no sentence`);
    }
  }
});

test('tokens put back together are the sentence, and words are only letters', () => {
  for (const t of texts) for (const s of splitSentences(t.body.fr)) {
    const toks = tokenize(s.text);
    assert.equal(toks.map((k) => k.text).join(''), s.text);
    for (const k of toks) if (k.word) assert.match(k.text, /^[\p{L}\p{M}]+(-[\p{L}\p{M}]+)*$/u);
  }
});

test('touching ANY word of ANY text yields a save that keeps a real source sentence', () => {
  let n = 0;
  for (const t of texts) {
    for (const s of splitSentences(t.body.fr)) {
      for (const k of tokenize(s.text)) {
        if (!k.word) continue;
        const row = buildWordSave('u1', k.text, s.text, t.id, 5);
        n++;
        assert.ok(t.body.fr.includes(row.context.sentence), `${t.id}: sentence is not in the text`);
        assert.ok(row.context.sentence.includes(k.text), `${t.id}: the sentence lacks "${k.text}"`);
        assert.equal(row.context.fromId, t.id);
        assert.equal(row.userId, 'u1');
        assert.deepEqual(Object.keys(row).sort(), ['context', 'itemId', 'savedAt', 'userId']);
      }
    }
  }
  assert.ok(n > 500, `only ${n} words were walked`);
});

test('saving the same word twice in one text is one row; in two texts it is two', () => {
  assert.equal(wordItemId('Marché', 'a'), wordItemId(' marché ', 'a'));
  assert.notEqual(wordItemId('marché', 'a'), wordItemId('marché', 'b'));
  const first = buildWordSave('u', 'marché', 'Je vais au marché.', 'a', 1);
  const again = buildWordSave('u', 'marché', 'Je vais au marché.', 'a', 2);
  assert.equal(first.itemId, again.itemId);
});

test('a glossary match is never made from a function word, and exact beats spelling', () => {
  const items = [{ fr: 'se lever', en: 'x', fa: 'y', sentenceFromText: 's' }, { fr: 'le marché', en: 'x', fa: 'y', sentenceFromText: 's' }];
  for (const w of ['le', 'la', 'se', 'de', 'un', 'en', 'je']) assert.equal(matchVocab(w, items), null, w);
  assert.equal(matchVocab('marché', items).kind, 'exact');
  assert.equal(matchVocab('MARCHÉ', items).kind, 'exact');
  assert.equal(matchVocab('lève', items).kind, 'spelling');
  assert.equal(matchVocab('marchands', items), null, 'marchands is not marché');
  assert.equal(matchVocab('maison', items), null);
});

test('over the real corpus, every glossary hit is an exact word or a labelled spelling match', () => {
  let exact = 0, spelling = 0;
  for (const t of texts) for (const s of splitSentences(t.body.fr)) {
    const here = vocabInSentence(s.text, t.vocabulary);
    for (const k of tokenize(s.text)) {
      if (!k.word) continue;
      const m = matchVocab(k.text, here);
      if (!m) continue;
      assert.ok(m.kind === 'exact' || m.kind === 'spelling');
      if (m.kind === 'exact') exact++; else spelling++;
      assert.ok(fold(m.item.fr).includes(fold(k.text).slice(0, 4)), `${t.id}: ${k.text} -> ${m.item.fr}`);
    }
  }
  assert.ok(exact > 15 && spelling > 3, `exact ${exact}, spelling ${spelling}`);
});

test('filters: each of the four categories finds its text, and the URL round-trips', () => {
  const title = (t) => t.title.en;
  for (const c of ['daily', 'work', 'science', 'culture']) {
    const r = applyFilters(texts, { ...EMPTY_FILTERS, topic: [c] }, title);
    assert.equal(r.length, 1, c);
  }
  assert.equal(applyFilters(texts, { ...EMPTY_FILTERS, level: ['B1'] }, title).length, 2);
  assert.equal(applyFilters(texts, { ...EMPTY_FILTERS, q: 'MARCHE' }, title).length, 1, 'accent- and case-blind');
  assert.equal(applyFilters(texts, { ...EMPTY_FILTERS, q: 'zzzz' }, title).length, 0);
  assert.equal(applyFilters(texts, { ...EMPTY_FILTERS, level: ['A1'], topic: ['work'] }, title).length, 0, 'filters AND together');
  for (const t of texts) assert.ok(['short', 'medium', 'long'].includes(durationOf(t)));
  const f = { q: 'sommeil', level: ['B1', 'A2'], topic: ['science'], duration: ['medium'], type: ['text'] };
  assert.deepEqual(parseFilters(writeFilters(f)), f);
  assert.equal(writeFilters(EMPTY_FILTERS).toString(), '');
});
