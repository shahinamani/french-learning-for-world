import type { Locale } from '../../lib/types';

/** The shape of `content/reading.json`, read from the file and not from a plan. */
export type L10n = Partial<Record<Locale, string>>;

export type ReadingCategory = 'daily' | 'work' | 'science' | 'culture';
export const CATEGORIES: readonly ReadingCategory[] = ['daily', 'work', 'science', 'culture'];

export type ReadingQuestion = {
  id: string;
  prompt: L10n;
  options: L10n[];
  answer: number;
  explain: L10n;
};

export type ReadingVocab = L10n & { sentenceFromText: string };

export type ReadingText = {
  id: string;
  type: 'text';
  category: ReadingCategory;
  /** `null` means nobody has said; it is not "A1". The file always has one today. */
  level: string | null;
  levelBasis: string | null;
  title: L10n;
  description: L10n;
  body: L10n;
  words: number;
  readingTime: { wordsPerMinute: number; seconds: number };
  source: { kind: string; name: string; licence: string; rightOfUse: string; readAt: string };
  review: { owner: unknown; teacher: unknown };
  relations: { words: string[]; verbs: string[]; grammar: string[] };
  questions: ReadingQuestion[];
  vocabulary: ReadingVocab[];
  /** Not in the file today. When the first recording is licensed it arrives here. */
  media?: { audio?: { url: string } };
};

/** docs/blueprint/CONTRACTS-v0.2.md section 3, verbatim. */
export type SavedItem = {
  userId: string; itemId: string; savedAt: number;
  context?: { sentence: string; fromId: string };
};
export type ReadingPosition = { userId: string; itemId: string; paragraph: number; updatedAt: number };
