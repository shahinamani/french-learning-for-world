/**
 * Themes (« thèmes ») and the free-resources catalogue, added 2026-11-06.
 *
 * Named "topics" in code because "theme" already means light/dark appearance
 * here (settings.theme). The learner sees "Themes".
 *
 * A theme groups the words, verbs and expressions a learner needs to speak
 * and write about one subject: housing, the hotel, sport, work. Built by
 * scripts/build-themes.py into content/themes.json (the index, small) and
 * content/themes/<id>.json (one theme, fetched when opened).
 *
 * What a theme says about an EXAM is evidence, not opinion: each entry names
 * the official sample paper or exam-body page where that topic was read, and
 * the date. A theme with no evidence for an exam says so; it does not claim
 * the theme cannot come up.
 *
 * Words and verbs that are also flashcards keep their card key, so practising
 * a theme writes to the same review history as the level decks.
 */
import type { Level } from './types';
import type { Target } from './exam-targets';

export const TOPIC_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type Names = { fr: string; en: string; fa?: string };

export type Evidence = {
  exam: string;            // id in exams.json: delf, dalf, tcf, tcf-canada, tef-canada
  level: string | null;    // DELF and DALF levels; null for the TCF and the TEF
  paper: string;           // CO, CE, PE, PO, EE, EO, ...
  topic: string;           // what the exercise is about, in French
  source: { what: string; url: string; readOn: string; kind: string };
  quote?: string;
};

export type TopicSummary = {
  id: string;
  names: Names;
  counts: { words: number; verbs: number; expressions: number };
  /** One per exam and level with evidence. */
  exams: { exam: string; level: string | null }[];
};

export type TopicWord = {
  key: string | null;      // the flashcard key, or null for a theme-only word
  fr: string;
  type: 'noun' | 'adjective' | 'verb';
  article?: string | null;
  en: string;
  fa?: string | null;
  level: Level | null;
  /** Level is the drafter's estimate, not the frequency band of a card. */
  levelEstimated?: boolean;
};

export type TopicExpression = {
  fr: string; en: string; fa?: string | null; level: Level; use: 'speaking' | 'writing' | 'both';
};

export type Topic = TopicSummary & {
  reviewed: boolean;
  words: TopicWord[];
  verbs: TopicWord[];
  expressions: TopicExpression[];
  evidence: Evidence[];
};

const get = <T,>(path: string): Promise<T> =>
  fetch(path).then((r) => { if (!r.ok) throw new Error(path); return r.json() as Promise<T>; });

let index: Promise<{ themes: TopicSummary[]; builtOn: string }> | null = null;
export function loadTopics() {
  index ??= get<{ themes: TopicSummary[]; builtOn: string }>('./content/themes.json')
    .catch((e) => { index = null; throw e; });
  return index;
}

const one = new Map<string, Promise<Topic>>();
export function loadTopic(id: string): Promise<Topic> {
  if (!/^[a-z-]+$/.test(id)) return Promise.reject(new Error('topic id'));
  let p = one.get(id);
  if (!p) {
    p = get<Topic>(`./content/themes/${id}.json`).catch((e) => { one.delete(id); throw e; });
    one.set(id, p);
  }
  return p;
}

/** Does this evidence speak about the learner's exam? DELF A1 evidence is
 *  about DELF A1, not about DELF B2: the levels are different papers. */
export function matches(e: { exam: string; level: string | null }, target: Target): boolean {
  if (e.exam !== target.exam) return false;
  return target.level ? e.level === target.level : true;
}

/** The levels a learner preparing this target should see by default: up to
 *  the target's level. The TCF and the TEF are sat at no level: all. */
export function levelsFor(target: Target | null): Level[] {
  if (!target?.level) return TOPIC_LEVELS;
  const i = TOPIC_LEVELS.indexOf(target.level as Level);
  return i < 0 ? TOPIC_LEVELS : TOPIC_LEVELS.slice(0, i + 1);
}

export const EXAM_LABEL: Record<string, string> = {
  delf: 'DELF', dalf: 'DALF', tcf: 'TCF', 'tcf-canada': 'TCF Canada', 'tef-canada': 'TEF Canada', tef: 'TEF',
};
export const examLabel = (e: { exam: string; level: string | null }) =>
  `${EXAM_LABEL[e.exam] ?? e.exam.toUpperCase()}${e.level ? ` ${e.level}` : ''}`;

// ── Free resources ────────────────────────────────────────────────────────
export type ResourceKind = 'podcast' | 'video' | 'book' | 'website' | 'exam-practice' | 'news' | 'dictionary' | 'app';
export const RESOURCE_KINDS: ResourceKind[] =
  ['exam-practice', 'podcast', 'video', 'news', 'book', 'website', 'dictionary', 'app'];

export type FreeResource = {
  id: string; title: string; url: string; publisher: string;
  kind: ResourceKind;
  cost: 'free' | 'free-tier'; costNote?: string;
  levels: Level[]; levelsFrom: 'publisher' | 'none';
  skills: string[]; exams: string[];
  language: string; description: string; licence?: string;
  checked: 'ok' | 'blocked';
};

let resources: Promise<{ checkedOn: string; resources: FreeResource[] }> | null = null;
export function loadResources() {
  resources ??= get<{ checkedOn: string; resources: FreeResource[] }>('./content/resources.json')
    .catch((e) => { resources = null; throw e; });
  return resources;
}
