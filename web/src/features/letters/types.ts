import type { Locale } from '../../lib/types';

/** The shape of `content/letters.json`, read from the file and not from a plan. */
export type L10n = Partial<Record<Locale, string>>;

export type LetterKind = 'formal' | 'informal';
export const KINDS: readonly LetterKind[] = ['formal', 'informal'];

export type LetterPhrase = L10n & { fr: string };

export type LetterPart = {
  id: string;
  name: L10n;
  purpose: L10n;
  phrases: LetterPhrase[];
};

export type LetterKindContent = {
  id: LetterKind;
  register: 'vous' | 'tu';
  name: L10n;
  when: L10n;
  registerNote: L10n;
  /** A skeleton the learner can start from. Square brackets are theirs to fill. */
  outline: string;
  parts: LetterPart[];
  pitfalls: L10n[];
  model: {
    title: L10n;
    level: string | null;
    levelBasis: string | null;
    segments: { part: string; text: string }[];
  };
};

export type LetterTask = {
  id: string;
  kind: LetterKind;
  /** `null` means nobody has said. Today every task carries the author's level. */
  level: string | null;
  levelBasis: string | null;
  task: L10n;
  review: { owner: unknown; teacher: unknown };
};

export type LettersFile = { kinds: LetterKindContent[]; tasks: LetterTask[] };

/** The model letter as one text, the way a learner would write it. */
export const modelText = (k: LetterKindContent) => k.model.segments.map((s) => s.text).join('\n\n');

/** A task id for writing without a set task, one per kind. */
export const freeTaskId = (kind: LetterKind) => `letter.${kind}.free`;
