import type { Level, Locale } from './types';
import { userKey } from './session';

/**
 * Pick a translation, and say when there is not one.
 *
 * `field[ui] ?? field.en` is the shape that made this necessary: it serves
 * English to an Arabic learner and says nothing, so the interface claims to be
 * in Arabic while the content is not. Exam explanations are the worst place for
 * that — a learner trusts an explanation, and a silent language switch is the
 * mildest of the things that can go wrong there.
 *
 * Arabic exam text is deliberately absent until a human reader of Arabic has
 * reviewed it (docs/08-arabic-review.md). Until then the honest state is
 * English plus a line saying so, and `translated: false` is what draws that line.
 */
export function pick(field: Partial<Record<Locale, string>> | undefined, ui: Locale):
  { text: string; translated: boolean } {
  const want = field?.[ui]?.trim();
  if (want) return { text: want, translated: true };
  return { text: field?.en?.trim() || field?.fr?.trim() || '', translated: false };
}

export type ExamItem = {
  id: string;
  kind: 'mcq' | 'cloze';
  stimulus?: { fr: string; label?: Partial<Record<Locale, string>> };
  prompt: Partial<Record<Locale, string>>;
  options: { fr: string }[];
  answer: number;
  level?: Level;
  conceptIds: string[];
  explain: Partial<Record<Locale, string>>;
};

export type ExamPaper = {
  id: string;
  exam: string;
  level: Level;
  skill: string;
  code: string;
  name: Partial<Record<Locale, string>>;
  minutes: number;
  official: { minutes: number; marks: number; passNote: string; source: string };
  practiceNote: string;
  items: ExamItem[];
};

let cache: Promise<ExamPaper[]> | null = null;

export function loadPapers(): Promise<ExamPaper[]> {
  if (!cache) {
    cache = fetch('./content/exam-papers.json')
      .then((r) => { if (!r.ok) throw new Error('exam-papers'); return r.json(); })
      .then((d) => d.papers as ExamPaper[])
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/**
 * An attempt in progress.
 *
 * It is persisted, not held in state, because an exam is the one place in this
 * product where losing your work actually costs something: a learner forty
 * minutes into a timed paper who reloads, or whose phone kills the tab, must
 * come back to the same paper with the same time remaining — not to a fresh
 * one, and not to a finished one.
 *
 * `endsAt` is an absolute moment, not a remaining count, for the same reason
 * the study timer works that way: a backgrounded tab stops getting timer
 * callbacks, and a countdown that decrements would quietly gain time.
 */
export type Attempt = {
  attemptId: string;
  paperId: string;
  startedAt: number;
  endsAt: number;
  /** index in the paper's item list -> chosen option index */
  answers: Record<string, number>;
  submittedAt: number | null;
  /** Set once the results have been written to the review log, so a reload of
   *  the results page cannot write them twice. */
  loggedAt: number | null;
};

const key = (userId: string, attemptId: string) => userKey(userId, `exam:${attemptId}`);

export function loadAttempt(userId: string, attemptId: string): Attempt | null {
  try {
    const raw = localStorage.getItem(key(userId, attemptId));
    if (!raw) return null;
    const a = JSON.parse(raw) as Attempt;
    if (!a || typeof a.paperId !== 'string' || !Number.isFinite(a.endsAt)) return null;
    return a;
  } catch { return null; }
}

export function saveAttempt(userId: string, a: Attempt) {
  try { localStorage.setItem(key(userId, a.attemptId), JSON.stringify(a)); } catch { /* private window */ }
}

/** Every attempt this learner has, newest first. Used by the paper page to
 *  offer "resume" rather than silently starting a second attempt. */
export function attemptsFor(userId: string, paperId: string): Attempt[] {
  const out: Attempt[] = [];
  try {
    const prefix = userKey(userId, 'exam:');
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const a = JSON.parse(localStorage.getItem(k) as string) as Attempt;
      if (a?.paperId === paperId) out.push(a);
    }
  } catch { /* private window */ }
  return out.sort((x, y) => y.startedAt - x.startedAt);
}

export const remainingMs = (a: Attempt, now: number) => Math.max(0, a.endsAt - now);
export const isExpired = (a: Attempt, now: number) => !a.submittedAt && a.endsAt <= now;

/** A finished attempt, scored. */
export type Scored = {
  total: number;
  correct: number;
  answered: number;
  byConcept: { conceptId: string; correct: number; total: number }[];
};

export function score(paper: ExamPaper, a: Attempt): Scored {
  let correct = 0, answered = 0;
  const tally = new Map<string, { correct: number; total: number }>();
  for (const item of paper.items) {
    const chosen = a.answers[item.id];
    const has = Number.isInteger(chosen);
    if (has) answered++;
    const right = has && chosen === item.answer;
    if (right) correct++;
    for (const c of item.conceptIds) {
      const t = tally.get(c) ?? { correct: 0, total: 0 };
      t.total++;
      if (right) t.correct++;
      tally.set(c, t);
    }
  }
  const byConcept = [...tally.entries()]
    .map(([conceptId, t]) => ({ conceptId, ...t }))
    // Weakest first: this list is the point of the results screen. A bare
    // score tells a learner nothing they can act on.
    .sort((x, y) => (x.correct / x.total) - (y.correct / y.total) || y.total - x.total);
  return { total: paper.items.length, correct, answered, byConcept };
}
