/**
 * Everything about a reading text that can be decided without a browser.
 * Kept free of React so tests/reader-model.test.js can run it against the real
 * content file — AGENTS.md section 3: a check runs against the corpus first.
 */
import type { ReadingText, ReadingVocab, ReadingCategory } from './types';

/* ── Sentences ───────────────────────────────────────────────────────────
 * The texts are ONE paragraph each, so "return to the paragraph" would mean
 * "return to the top". The unit the Reader remembers is the sentence, stored
 * in the contract's `paragraph` field (see store.ts). */

const ABBREVIATIONS = new Set(['m', 'mme', 'mlle', 'mm', 'dr', 'pr', 'st', 'ste', 'etc']);

export type Segment = { index: number; text: string };

export function splitSentences(body: string): Segment[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?…]+(?:\s*[»”"])?(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const end = m.index + m[0].length;
    const before = body.slice(start, m.index).match(/([\p{L}]+)$/u)?.[1]?.toLowerCase();
    if (m[0] === '.' && before && ABBREVIATIONS.has(before)) continue;
    const s = body.slice(start, end).trim();
    if (s) out.push(s);
    start = end;
  }
  const tail = body.slice(start).trim();
  if (tail) out.push(tail);
  return out.map((text, index) => ({ index, text }));
}

/* ── Tokens ──────────────────────────────────────────────────────────────
 * A word is a run of letters, hyphens inside it kept (peut-être). The
 * apostrophe separates: « l'école » is « l' » then « école », so tapping the
 * noun does not hand the learner a clitic fused to it. */

export type Token = { text: string; word: boolean };

const WORD = /[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu;

export function tokenize(sentence: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of sentence.matchAll(WORD)) {
    if (m.index > last) out.push({ text: sentence.slice(last, m.index), word: false });
    out.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last), word: false });
  return out;
}

/** Lower-case, accent-free, apostrophe-free: the form two spellings compare in. */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, '');

/* ── Matching a tapped word to the text's own glossary ───────────────────
 * The glossary has headwords (« se lever »), the text has forms (« lève »).
 * 'exact' is a folded equality with a word of the headword. 'spelling' is one
 * being a prefix of the other, shorter one at least 4 letters, at most 2 apart
 * — inflection by spelling, and NOT a claim about the grammar. It is labelled
 * as such on screen; a guess is not shown as a gloss. */

export type VocabMatch = { item: ReadingVocab; kind: 'exact' | 'spelling' };

const FUNCTION_WORDS = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'se', 's', 'a', 'au', 'aux', 'en', 'd']);

function headwordParts(fr: string): string[] {
  return fr.split(/[\s’'-]+/).map(fold).filter((w) => w && !FUNCTION_WORDS.has(w));
}

export function matchVocab(token: string, items: ReadingVocab[]): VocabMatch | null {
  const t = fold(token);
  if (!t || FUNCTION_WORDS.has(t)) return null;
  let approx: VocabMatch | null = null;
  for (const item of items) {
    const parts = headwordParts(item.fr ?? '');
    if (parts.includes(t)) return { item, kind: 'exact' };
    if (!approx && parts.some((p) => {
      const [s, l] = p.length <= t.length ? [p, t] : [t, p];
      return s.length >= 4 && l.startsWith(s) && l.length - s.length <= 2;
    })) approx = { item, kind: 'spelling' };
  }
  return approx;
}

/** The glossary entries whose source sentence lies inside this sentence. */
export function vocabInSentence(sentence: string, vocab: ReadingVocab[]): ReadingVocab[] {
  return vocab.filter((v) => sentence.includes(v.sentenceFromText) || v.sentenceFromText.includes(sentence));
}

/** Which sentence of the text holds a phrase (first occurrence), or -1. */
export function segmentOf(body: string, segments: Segment[], phrase: string): number {
  const at = body.indexOf(phrase);
  if (at < 0) return -1;
  let cursor = 0;
  for (const s of segments) {
    const start = body.indexOf(s.text, cursor);
    if (start < 0) continue;
    cursor = start + s.text.length;
    if (at < cursor) return s.index;
  }
  return -1;
}

/* ── What a save writes ───────────────────────────────────────────────── */

/** The id of a saved WORD. It names the text it came from, so reading the same
 *  word in a second text adds a second row with its own sentence instead of
 *  overwriting the first — and saving it twice in the SAME text is still one row. */
export const wordItemId = (phrase: string, fromId: string) =>
  `word:${phrase.normalize('NFC').trim().toLowerCase()}@${fromId}`;

export function buildWordSave(userId: string, phrase: string, sentence: string, fromId: string, now = Date.now()) {
  return {
    userId, itemId: wordItemId(phrase, fromId), savedAt: now,
    context: { sentence, fromId },
  };
}

/* ── Library filtering (blueprint section 8) ─────────────────────────── */

export type Duration = 'short' | 'medium' | 'long';
/** Bands by the stated reading time. The thresholds are this screen's choice. */
export const durationOf = (t: ReadingText): Duration =>
  t.readingTime.seconds < 90 ? 'short' : t.readingTime.seconds < 105 ? 'medium' : 'long';
export const minutesOf = (t: ReadingText) => Math.max(1, Math.round(t.readingTime.seconds / 60));

export type Filters = {
  q: string; level: string[]; topic: ReadingCategory[]; duration: Duration[]; type: string[];
};
export const EMPTY_FILTERS: Filters = { q: '', level: [], topic: [], duration: [], type: [] };

export function applyFilters(texts: ReadingText[], f: Filters, localTitle: (t: ReadingText) => string): ReadingText[] {
  const q = fold(f.q.trim());
  return texts.filter((t) =>
    (!f.level.length || f.level.includes(t.level ?? 'none'))
    && (!f.topic.length || f.topic.includes(t.category))
    && (!f.duration.length || f.duration.includes(durationOf(t)))
    && (!f.type.length || f.type.includes(t.type))
    && (!q || fold(`${localTitle(t)} ${t.title.fr ?? ''} ${t.title.en ?? ''} ${t.description.fr ?? ''}`).includes(q)));
}

export function parseFilters(p: URLSearchParams): Filters {
  const list = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean);
  return {
    q: p.get('q') ?? '',
    level: list('level'),
    topic: list('topic') as ReadingCategory[],
    duration: list('duration') as Duration[],
    type: list('type'),
  };
}

export function writeFilters(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q);
  for (const k of ['level', 'topic', 'duration', 'type'] as const) if (f[k].length) p.set(k, f[k].join(','));
  return p;
}
