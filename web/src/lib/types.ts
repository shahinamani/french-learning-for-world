/** Shapes shared across the app. Kept in one file so a field cannot drift. */

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Locale = 'en' | 'fr' | 'fa' | 'ar';

/** ts-fsrs State, mirrored so nothing outside the scheduler imports ts-fsrs. */
export const CardStateName = ['New', 'Learning', 'Review', 'Relearning'] as const;
export type CardStateName = (typeof CardStateName)[number];

export type CardState = {
  dueAt: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  lastReviewedAt: number | null;
};

/** One append-only row per review. See docs/03-review-log.md. */
export type ReviewRow = {
  id: string;
  userId: string;
  sessionId: string;
  reviewedAt: number;
  cardKey: string;
  itemType: 'vocab' | 'verb_form' | 'grammar' | 'listening' | 'reading' | 'cloze' | 'dictation' | 'pronunciation';
  /** What this review actually tested. The weakness model is built on this. */
  conceptIds: string[];
  direction: 'fr-native' | 'native-fr' | 'audio-fr' | 'fr-audio';
  promptShown: { front: string; level: Level; type: string };
  response: string | null;
  isCorrect: boolean | null;
  grade: 0 | 1 | 2 | 3 | 4;
  durationMs: number;
  stateBefore: 0 | 1 | 2 | 3;
  stateAfter: 0 | 1 | 2 | 3;
  stabilityBefore: number;
  stabilityAfter: number;
  difficultyBefore: number;
  difficultyAfter: number;
  elapsedDays: number;
  scheduledDays: number;
  dueBefore: number;
  dueAfter: number;
  scheduler: string;
  /** Digest of the FSRS weight vector in force. Without it a later refit makes
   *  every earlier row uninterpretable — see docs/03. */
  paramsHash: string;
  client: 'web';
};

export type Concept = {
  id: string;
  type: 'grammar' | 'vocabulary' | 'phonetics' | 'usage';
  level: Level;
  parent: string | null;
  /** Every language we have. `pick()` decides what a given learner sees, and
   *  reports whether it is their language — never a silent English fallback. */
  name: Partial<Record<Locale, string>>;
  retired: boolean;
  isGroup: boolean;
};

export type Card = {
  key: string;
  type: 'verb' | 'noun' | 'adjective';
  level: Level;
  fr: string;
  prep?: string | null;
  article?: string | null;
  gender?: 'm' | 'f' | null;
  meanings: Partial<Record<Locale, string>>;
  examples: Array<{
    tense: 'past' | 'future';
    form: string;
    fr: string;
    translations: Partial<Record<Locale, string>>;
  }>;
  /** Which concepts this card exercises. Joins the card to the weakness model. */
  conceptIds: string[];
};
