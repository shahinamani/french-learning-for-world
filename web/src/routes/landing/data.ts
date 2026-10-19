/**
 * The few pieces of real content the landing page shows.
 *
 * Why this file exists and is not an import of the content files: the landing
 * page is eager and prerendered, so anything it imports is in the first load.
 * card-backs.json, dialogues.json, reading.json and exam-papers.json together
 * are far larger than the handful of lines shown here, and the first load has
 * 10 KB of budget to spare, not 100.
 *
 * What stops this copy drifting from the content it quotes is
 * tests/landing-data.test.js, which reads the content files and asserts every
 * string, level, duration and source below is still what they say. A figure
 * typed here without that test would be a claim with nothing behind it.
 *
 * Nothing in this file is invented. Where the content has a Persian or Arabic
 * rendering it is NOT copied: the landing page is English and French only, and
 * the other two fall back to English behind the untranslated marker.
 */

/** The flashcard: content/fr-core-a1.json card `v:etre`, with the worked
 *  example from content/card-backs.json (same sentence, same form). */
export const PREVIEW_CARD = {
  key: 'v:etre',
  front: 'être',
  level: 'A1' as const,
  meaning: {
    en: 'to be',
    fr: 'exister, se trouver dans un état',
  } as Record<string, string>,
  example: {
    fr: 'Hier, j\'ai été très fatigué.',
    form: 'été',
    en: 'Yesterday I was very tired.',
  },
};

/** A passage from content/dialogues.json, unit `a1-au-cafe`: its first four
 *  lines, in order, word for word. */
export const PREVIEW_DIALOGUE = {
  id: 'a1-au-cafe',
  level: 'A1' as const,
  title: { fr: 'Au café', en: 'At the café' } as Record<string, string>,
  lines: [
    { speaker: 'Le serveur', fr: 'Bonjour ! Qu\'est-ce que vous prenez ?', en: 'Hello! What will you have?' },
    { speaker: 'Claire', fr: 'Bonjour. Un café, s\'il vous plaît.', en: 'Hello. A coffee, please.' },
    { speaker: 'Le serveur', fr: 'Un café. Et avec ça ?', en: 'One coffee. Anything else?' },
    { speaker: 'Claire', fr: 'Un croissant aussi. C\'est combien ?', en: 'A croissant as well. How much is it?' },
  ],
};

export type Level = 'A1' | 'A2' | 'B1' | 'B2';
export type Kind = 'reading' | 'dialogue' | 'exam' | 'cards' | 'verbs';

/** A real item a visitor can open today. `to` is a route that exists. */
export type Item = {
  id: string;
  kind: Kind;
  level: Level;
  fr: string;
  en: string;
  to: string;
  /** Reading: seconds, from content/reading.json `readingTime.seconds`.
   *  Exam: minutes, from content/exam-papers.json `minutes`. */
  seconds?: number;
  minutes?: number;
};

export const READING = {
  market: { id: 'reading.a1-samedi-au-marche', kind: 'reading', level: 'A1', seconds: 82,
    fr: 'Mon samedi au marché', en: 'My Saturday at the market',
    to: '/app/reading/reading.a1-samedi-au-marche' },
  work: { id: 'reading.a2-premiere-journee', kind: 'reading', level: 'A2', seconds: 98,
    fr: 'Une première journée de travail', en: 'A first day at work',
    to: '/app/reading/reading.a2-premiere-journee' },
  sleep: { id: 'reading.b1-sommeil-et-memoire', kind: 'reading', level: 'B1', seconds: 102,
    fr: 'Le sommeil et la mémoire', en: 'Sleep and memory',
    to: '/app/reading/reading.b1-sommeil-et-memoire' },
  music: { id: 'reading.b1-fete-de-la-musique', kind: 'reading', level: 'B1', seconds: 106,
    fr: 'La Fête de la musique', en: 'The Fête de la musique',
    to: '/app/reading/reading.b1-fete-de-la-musique' },
} satisfies Record<string, Item>;

export const DIALOGUE: Item = {
  id: 'a1-au-cafe', kind: 'dialogue', level: 'A1',
  fr: 'Au café', en: 'At the café', to: '/app/workspace',
};

export const EXAMS = {
  delfA1: { id: 'delf-a1-ce', kind: 'exam', level: 'A1', minutes: 30,
    fr: 'DELF A1 — Compréhension des écrits', en: 'DELF A1 — Reading',
    to: '/app/exams/delf-a1-ce' },
  tcfB1: { id: 'tcf-structure', kind: 'exam', level: 'B1', minutes: 8,
    fr: 'TCF — Structure de la langue', en: 'TCF — Structure of the language',
    to: '/app/exams/tcf-structure' },
  tcfB2: { id: 'tcf-b2-structure', kind: 'exam', level: 'B2', minutes: 5,
    fr: 'TCF — Subjonctif ou indicatif (B2)', en: 'TCF — Subjunctive or indicative (B2)',
    to: '/app/exams/tcf-b2-structure' },
} satisfies Record<string, Item>;

export const CARDS: Item = {
  id: 'fr-core-a1', kind: 'cards', level: 'A1',
  fr: 'Français essentiel A1', en: 'Core French A1', to: '/app/cards',
};

export const VERBS: Item = {
  id: 'verbs', kind: 'verbs', level: 'A1',
  fr: 'Les verbes', en: 'Verbs', to: '/app/verbs',
};

/** The levels the reading texts span, from content/reading.json. */
export const READING_LEVELS = ['A1', 'B1'] as const;

export type Goal = 'life' | 'work' | 'travel' | 'university' | 'exam';
export const GOALS: Goal[] = ['life', 'work', 'travel', 'university', 'exam'];
export const DEFAULT_GOAL: Goal = 'life';

/**
 * What fits each goal TODAY. These are the real items that exist, picked by a
 * person reading their subject (a work text for work, a science text for
 * university). It is not a recommendation engine and the page says so: the
 * guided path is a placeholder in the product.
 */
export const GOAL_ITEMS: Record<Goal, Item[]> = {
  life: [READING.market, DIALOGUE, CARDS],
  work: [READING.work, VERBS, CARDS],
  travel: [DIALOGUE, READING.market, VERBS],
  university: [READING.sleep, EXAMS.tcfB1, VERBS],
  exam: [EXAMS.delfA1, EXAMS.tcfB1, EXAMS.tcfB2],
};

/** The worked example of an error and its remedial practice. It is an
 *  illustration, labelled as one on the page; it is not a real learner's. */
export const EXAMPLE_ERROR = {
  wrote: 'J\'ai allé au marché.',
  correct: 'Je suis allé au marché.',
  verb: 'aller',
  drill: '/app/verbs/drill?verb=aller',
};

/** The four steps of "one learning, many shapes", on the same sentence as the
 *  card above. `form` is the word picked out, `verb` the verb it belongs to. */
export const FLOW = {
  sentence: PREVIEW_CARD.example.fr,
  form: PREVIEW_CARD.example.form,
  verb: PREVIEW_CARD.front,
};
