/**
 * The weakness engine (blueprint §15): explainable, not a model.
 *
 * Every weakness this file returns is the output of one small state machine
 * over the learner's own review log, and carries the rows that triggered it. A
 * learner can be shown exactly why a topic was raised, and a reader can check
 * the claim against the log by hand. There is nothing here to train and
 * nothing to tune.
 *
 * ── THE START RULE, and what it is not ─────────────────────────────────────
 *
 * A topic is raised after observing 5 WRONG answers on it, and is cleared only
 * after at least 5 CONSECUTIVE correct answers. The blueprint says plainly that
 * this threshold is "an engineering contract, not a proven scientific
 * criterion", and so does this comment and so does the screen (`wkThresholdNote`).
 * Five is small enough to act on within a week of ordinary use and large enough
 * that one bad evening raises nothing. It has not been validated against
 * learners. Do not describe it as research.
 *
 * Two readings of the rule are MINE, not the blueprint's, and are marked:
 *
 *   1. "5 wrong answers" is counted CUMULATIVELY since the last clearing, not
 *      as 5 in a row. [interpretation] Otherwise a learner who is right every
 *      second time would never be raised.
 *   2. Five consecutive correct answers also empties the wrong-answer tally of
 *      a topic that was never raised. [interpretation] Without this, a card
 *      seen for three years would eventually be accused by its own old
 *      mistakes, and the clearing rule would apply only to raised topics —
 *      an asymmetry the blueprint does not state.
 *
 * What counts as wrong: `isCorrect === false`, or, where a flashcard recorded
 * no verdict, a grade of Again (1). Hard (2) is a recalled card.
 *
 * ── Four situations (§15 table) ────────────────────────────────────────────
 *   not-enough  too little data: say so, offer an OPTIONAL short check
 *   repeated    raised: show the evidence and the related practice
 *   listening   the audio answers raise it while the written ones are fine:
 *               same level, shorter clips
 *   improving   answers got better after practice: lighter practice, later review
 *
 * ── Things this file refuses to do ─────────────────────────────────────────
 *   - It never reads the learner's locale or native language. The blueprint
 *     says a native language is never a reason for a weakness; the function
 *     signature has no place to put one, which is stronger than a promise.
 *   - It never computes or returns a percentage or a mastery score. `recheck`
 *     is "k of 5 in a row", a count against a rule, not a level of mastery.
 *   - It never writes a review, a schedule or a profile flag. Choices to
 *     postpone or ignore are kept apart from the review log.
 *
 * Importable in plain Node: no browser API is touched at module load, and the
 * IndexedDB module is imported dynamically inside the one async loader.
 */
import type { ReviewRow } from './types';

export const WRONG_TO_RAISE = 5;
export const CORRECT_TO_CLEAR = 5;
/** A raised topic whose latest run is this long is called "improving". */
export const IMPROVING_RUN = 3;
/** Written answers needed, all recent ones right, before listening is blamed. */
export const TEXT_FINE_MIN = 3;
export const POSTPONE_MS = 7 * 86_400_000;
/** A cleared topic is mentioned for this long, then left alone. */
export const CLEARED_SHOWN_MS = 14 * 86_400_000;
/** A topic with a few old mistakes and nothing since is not worth a line. */
export const WATCH_WINDOW_MS = 30 * 86_400_000;
export const PRACTICE_MINUTES = 5;

export type Situation = 'not-enough' | 'repeated' | 'listening' | 'improving';
export type Status = 'watching' | 'active' | 'improving' | 'cleared';
export type Modality = 'audio' | 'text';

export type Evidence = {
  reviewId: string;
  at: number;
  cardKey: string;
  /** What the learner was shown, as recorded. */
  front: string;
  /** What the learner typed or chose. Null for a self-rated flashcard. */
  response: string | null;
  correct: boolean;
  modality: Modality;
};

export type ActionKind = 'practise' | 'diagnostic' | 'short-listening' | 'lighter';

export type Weakness = {
  topicId: string;
  situation: Situation;
  status: Status;
  wrongCount: number;
  /** Consecutive correct answers at the end of the log. */
  correctRun: number;
  latest: Evidence;
  /** The most recent wrong answer: the concrete error example. */
  example: Evidence | null;
  /** Up to three most recent wrong answers, newest first. */
  evidence: Evidence[];
  /** Message key for the one-line reason; the screen fills in the topic name. */
  reasonKey: 'wkWhyNotEnough' | 'wkWhyRepeated' | 'wkWhyListening' | 'wkWhyImproving' | 'wkWhyCleared';
  action: { kind: ActionKind; to: string; minutes: number };
  /** Where the explanation lives. The engine does not write grammar. */
  explainTo: string;
  recheck: { state: 'not-started' | 'in-progress' | 'passed'; correctInARow: number; needed: number };
  /** Set when the learner postponed this and the pause has not run out. */
  hiddenUntil: number | null;
  lastActivityAt: number;
};

export type Choice = { mode: 'postponed' | 'ignored'; at: number };
export type Choices = Record<string, Choice>;

type Answer = Evidence;

const isAudioRow = (r: ReviewRow): boolean =>
  r.itemType === 'listening' || r.itemType === 'dictation' || r.itemType === 'pronunciation'
  || r.direction === 'audio-fr' || r.direction === 'fr-audio';

/** `isCorrect` is null only when the row carries no verdict at all. */
export function isWrong(r: Pick<ReviewRow, 'isCorrect' | 'grade'>): boolean {
  if (r.isCorrect === false) return true;
  if (r.isCorrect === true) return false;
  return r.grade <= 1;
}

function toAnswer(r: ReviewRow): Answer {
  return {
    reviewId: r.id, at: r.reviewedAt, cardKey: r.cardKey,
    front: r.promptShown?.front ?? '', response: r.response ?? null,
    correct: !isWrong(r), modality: isAudioRow(r) ? 'audio' : 'text',
  };
}

type Walk = {
  active: boolean; wrongs: number; run: number;
  everRaised: boolean; clearedAt: number | null;
};

/** The whole rule. Answers must be oldest first. */
export function walk(answers: readonly Pick<Answer, 'correct' | 'at'>[]): Walk {
  const w: Walk = { active: false, wrongs: 0, run: 0, everRaised: false, clearedAt: null };
  for (const a of answers) {
    if (!a.correct) {
      w.wrongs += 1; w.run = 0;
      if (!w.active && w.wrongs >= WRONG_TO_RAISE) {
        w.active = true; w.everRaised = true; w.clearedAt = null;
      }
    } else {
      w.run += 1;
      if (w.run >= CORRECT_TO_CLEAR) {
        if (w.active) { w.active = false; w.clearedAt = a.at; }
        w.wrongs = 0;
      }
    }
  }
  return w;
}

export type Report = {
  /** No review rows at all. */
  empty: boolean;
  all: Weakness[];
  /** The one to show, or null. */
  shown: Weakness | null;
  /** Visible suggestions beyond the one shown. */
  waiting: number;
  postponed: Weakness[];
};

export type AnalyseOptions = {
  now: number;
  choices?: Choices;
  /** Concepts that have flashcards, so the practice link goes somewhere real. */
  hasCards?: (conceptId: string) => boolean;
};

const RANK: Record<Status, number> = { active: 0, improving: 1, cleared: 2, watching: 3 };

function practiseTo(topicId: string, hasCards: boolean): string {
  // `/practise/review?concept=` is the only concept-targeted practice route
  // there is, and it needs flashcards. Without them the honest destination is
  // the topic's own page.
  return hasCards
    ? `/practise/review?concept=${encodeURIComponent(topicId)}`
    : `/learn/concept/${encodeURIComponent(topicId)}`;
}

function classify(topicId: string, rows: Answer[], now: number, hasCards: boolean): Weakness | null {
  if (!rows.length) return null;
  const whole = walk(rows);
  const audio = rows.filter((a) => a.modality === 'audio');
  const text = rows.filter((a) => a.modality === 'text');
  const wa = walk(audio);
  const wt = walk(text);
  const lastText = text.slice(-TEXT_FINE_MIN);
  const textFine = text.length >= TEXT_FINE_MIN && !wt.active && lastText.every((a) => a.correct);

  let situation: Situation, status: Status, reasonKey: Weakness['reasonKey'], kind: ActionKind;
  let to = practiseTo(topicId, hasCards);

  if (whole.active && wa.active && textFine) {
    situation = 'listening'; status = 'active'; reasonKey = 'wkWhyListening'; kind = 'short-listening';
    // No listening practice is shipped (the route is a placeholder), so the
    // link goes to that placeholder rather than pretending to a clip.
    to = '/practise/listening';
  } else if (whole.active && whole.run >= IMPROVING_RUN) {
    situation = 'improving'; status = 'improving'; reasonKey = 'wkWhyImproving'; kind = 'lighter';
  } else if (whole.active) {
    situation = 'repeated'; status = 'active'; reasonKey = 'wkWhyRepeated'; kind = 'practise';
  } else if (whole.everRaised && whole.clearedAt !== null) {
    if (now - whole.clearedAt > CLEARED_SHOWN_MS) return null;
    situation = 'improving'; status = 'cleared'; reasonKey = 'wkWhyCleared'; kind = 'lighter';
  } else if (whole.wrongs >= 1) {
    const lastWrongAt = [...rows].reverse().find((a) => !a.correct)!.at;
    if (now - lastWrongAt > WATCH_WINDOW_MS) return null;
    situation = 'not-enough'; status = 'watching'; reasonKey = 'wkWhyNotEnough'; kind = 'diagnostic';
  } else {
    return null;
  }

  const wrongs = rows.filter((a) => !a.correct);
  const example = wrongs.at(-1) ?? null;
  const latest = rows.at(-1)!;
  const inARow = whole.active ? Math.min(whole.run, CORRECT_TO_CLEAR) : 0;
  return {
    topicId, situation, status,
    wrongCount: whole.wrongs, correctRun: whole.run,
    latest, example, evidence: wrongs.slice(-3).reverse(),
    reasonKey,
    action: { kind, to, minutes: PRACTICE_MINUTES },
    explainTo: `/learn/concept/${encodeURIComponent(topicId)}`,
    recheck: status === 'cleared'
      ? { state: 'passed', correctInARow: CORRECT_TO_CLEAR, needed: CORRECT_TO_CLEAR }
      : { state: inARow > 0 ? 'in-progress' : 'not-started', correctInARow: inARow, needed: CORRECT_TO_CLEAR },
    hiddenUntil: null,
    lastActivityAt: latest.at,
  };
}

/**
 * Pure. Rows may arrive in any order. A topic is a concept id; a row that
 * exercises several concepts is evidence for each of them.
 */
export function analyse(rows: readonly ReviewRow[], opts: AnalyseOptions): Report {
  const { now, choices = {}, hasCards = () => true } = opts;
  const ordered = [...rows].sort((a, b) => a.reviewedAt - b.reviewedAt || (a.id < b.id ? -1 : 1));
  const byTopic = new Map<string, Answer[]>();
  for (const r of ordered) {
    const a = toAnswer(r);
    for (const id of new Set(r.conceptIds)) {
      // "Ignore" is a floor: the topic is judged afresh from the answers after
      // it, so it returns only if 5 NEW answers go wrong — never by re-reading
      // the ones the learner already waved away.
      const c = choices[id];
      if (c?.mode === 'ignored' && r.reviewedAt <= c.at) continue;
      const list = byTopic.get(id) ?? [];
      list.push(a);
      byTopic.set(id, list);
    }
  }

  const all: Weakness[] = [];
  for (const [id, list] of byTopic) {
    const w = classify(id, list, now, hasCards(id));
    if (!w) continue;
    const c = choices[id];
    if (c?.mode === 'postponed' && c.at + POSTPONE_MS > now) w.hiddenUntil = c.at + POSTPONE_MS;
    all.push(w);
  }
  all.sort((a, b) => RANK[a.status] - RANK[b.status]
    || b.lastActivityAt - a.lastActivityAt || (a.topicId < b.topicId ? -1 : 1));

  const visible = all.filter((w) => w.hiddenUntil === null);
  return {
    empty: rows.length === 0,
    all,
    // ONE at a time, deliberately. A list of everything that went wrong this
    // month is the guilt trip the blueprint warns against.
    shown: visible[0] ?? null,
    waiting: Math.max(0, visible.length - 1),
    postponed: all.filter((w) => w.hiddenUntil !== null),
  };
}

// ── Postpone / ignore, kept apart from the review log ────────────────────────

const choiceKey = (userId: string) => `fmv.weakness.choices.${userId}`;
const memory = new Map<string, Choices>();

export function loadChoices(userId: string): Choices {
  try {
    const raw = globalThis.localStorage?.getItem(choiceKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Choices;
      memory.set(userId, parsed);
      return parsed;
    }
  } catch { /* blocked storage: fall through to this tab's memory */ }
  return memory.get(userId) ?? {};
}

/** Returns false when the choice could only be kept for this tab. */
export function saveChoice(userId: string, topicId: string, mode: Choice['mode'], now: number): boolean {
  const next = { ...loadChoices(userId), [topicId]: { mode, at: now } };
  memory.set(userId, next);
  try {
    globalThis.localStorage.setItem(choiceKey(userId), JSON.stringify(next));
    return true;
  } catch { return false; }
}

/** The only I/O in this file. Read-only against the review log. */
export async function loadReport(
  userId: string,
  opts: Omit<AnalyseOptions, 'choices'> & { limit?: number },
): Promise<Report> {
  const { reviewsForUser } = await import('./db');
  const rows = await reviewsForUser(userId, opts.limit ?? 3000);
  return analyse(rows, { ...opts, choices: loadChoices(userId) });
}

// ── The words, kept beside the rule so a test can read what a learner reads ──

type T = (key: any, vars?: Record<string, string | number>) => string;

export type Described = {
  reason: string;
  action: string;
  recheck: string;
  /** Shown only for the listening situation: says the clips are not built. */
  note: string | null;
};

/**
 * The learner-facing sentences for one weakness. `topic` is the concept's name
 * in the learner's language, resolved by the caller. Nothing here formats a
 * proportion, and a test pins that.
 */
export function describe(w: Weakness, t: T, topic: string): Described {
  const vars = { topic, n: w.wrongCount, run: w.correctRun };
  const reason = w.reasonKey === 'wkWhyNotEnough' ? t('wkWhyNotEnough', vars)
    : w.reasonKey === 'wkWhyRepeated' ? t('wkWhyRepeated', vars)
    : w.reasonKey === 'wkWhyListening' ? t('wkWhyListening', vars)
    : w.reasonKey === 'wkWhyImproving' ? t('wkWhyImproving', vars)
    : t('wkWhyCleared', vars);
  const action = w.action.kind === 'diagnostic' ? t('wkActDiagnostic')
    : w.action.kind === 'short-listening' ? t('wkActListening')
    : w.action.kind === 'lighter' ? t('wkActLighter')
    : t('wkActPractise');
  const recheck = w.recheck.state === 'passed' ? t('wkRecheckPassed')
    : w.recheck.state === 'in-progress' ? t('wkRecheckProgress', { n: w.recheck.correctInARow })
    : t('wkRecheckNone');
  return { reason, action, recheck, note: w.situation === 'listening' ? t('wkListeningNone') : null };
}
