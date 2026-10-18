/**
 * English workspaceEn — a lazy part of the English dictionary.
 *
 * This file is NOT imported by lib/i18n.ts. The module that owns the screens
 * using these keys imports it (see the line "registers its English" in that
 * module), so the strings travel in that screen's chunk and are registered
 * before any of its components can render. A key asked for by code that is
 * reachable from main.tsx WITHOUT passing through such an import would render
 * as its own name; tests/i18n-lazy-groups.test.js is the guard for that.
 */
import { registerEnglish } from '../../i18n';

/**
 * The learning workspace, added 2026-10-12.
 *
 * A fourth optional group, for the same standing reason as the third: adding
 * to `en` obliges Persian and Arabic, and inventing those is what this project
 * does not do. French is written here because French is written here; Persian
 * and Arabic fall back to English behind `notTranslatedHere`, which is the
 * established pattern and not a gap being hidden.
 */
export const workspaceEn = {
  wsSummaryLead: 'Vocabulary cards, built from the written deck and the verb index.',
  wsSummaryRich: 'written cards, with example sentences and four languages',
  wsSummaryGloss: 'verb cards whose English meaning comes from Wiktionary and has been read by nobody',
  wsCeiling: 'Graded practice and explanations stop at B2. The levels above it are frequency bands for vocabulary, not a claim that C1 or C2 is taught here.',
  wsLocalOnly: 'Marks are kept on this device, in this browser. There is no account and nothing is uploaded.',

  // Tabs
  wsTabFlashcards: 'Flashcards',
  wsTabQuiz: 'Quiz',
  wsTabDialogues: 'Dialogues',
  wsTabGrammar: 'Grammar',
  wsTabVocabulary: 'Vocabulary',
  wsTabProgress: 'Progress',

  // Top controls
  wsTimer: 'Session timer',
  wsTimerStart: 'Start',
  wsTimerPause: 'Pause',
  wsTimerResume: 'Resume',
  wsTimerReset: 'Reset',
  wsTimerSound: 'Chime at the end',
  wsVoiceSpeed: 'Voice speed',
  wsVoice: 'Voice',
  wsVoiceNone: 'No French voice on this device',
  wsVoiceNoneHelp: 'Listen needs a French system voice. Nothing is downloaded by this page, so until one is installed the button stays off.',
  wsRegionFrance: 'France',
  wsRegionCanada: 'Canada',
  wsRegionOther: 'Other French',
  wsSpeechAid: 'Machine speech, as a pronunciation aid. It is not listening practice and is not a model of a native speaker.',

  // Filters
  wsFilters: 'Filters',
  wsFilterAll: 'All',
  wsFilterUnmarked: 'Not yet marked',
  wsFilterReview: 'To review',
  wsFilterKnown: 'Known',
  wsShuffle: 'Shuffle',
  wsShuffleOff: 'In order',
  wsLevels: 'Levels',
  wsJump: 'Go to card',
  wsJumpGo: 'Go',

  // The card
  wsReveal: 'Show the answer',
  wsRevealHint: 'Click the card, or press Enter or Space',
  wsHide: 'Hide the answer',
  wsGlossUnreviewed: 'This meaning comes from Wiktionary. No teacher has read it.',
  wsExamples: 'Examples',
  wsPrev: 'Previous',
  wsNext: 'Next',
  wsListen: 'Listen',
  wsKnown: 'Known',
  wsToReview: 'To review',
  wsMarkedKnown: 'Marked known',
  wsMarkedReview: 'Marked for review',

  // Empty and honest states
  wsEmptyFiltered: 'No cards match these filters.',
  wsEmptyFilteredHelp: 'Widen the levels, or choose All.',
  wsNoDialogues: 'There are no dialogues in this project.',
  wsNoDialoguesWhy: 'None has been written, and no recording has been obtained under a licence that permits use. This tab stays empty until there is real content behind it.',
  wsOpen: 'Open',
  wsQuizLead: 'Exam papers, with an explanation for every question after you submit.',
  wsGrammarLead: 'Grammar points, and how much material sits behind each one.',
  wsVocabLead: 'Every verb in the project, with its tables, searchable.',
  wsProgressLead: 'What this device has recorded.',

  // ── The educational back of a card ───────────────────────────────────────
  wsMeaning: 'Meaning',
  wsShowExamples: 'Show examples',
  wsHideExamples: 'Hide examples',
  wsUsage: 'Note',
  wsGlossOnly: 'This card has a dictionary gloss only — no examples have been written for it yet.',
  wsDrafted: 'Meaning, examples and Persian drafted here. No teacher has read them and no Persian reader has checked them.',
  wsPatternImpersonal: 'Impersonal verb',
  wsPatternPronominal: 'Pronominal verb',
  wsCoverageEnriched: 'with worked examples',
  wsCoverageReviewed: 'checked by a teacher',
  wsComprehension: 'Comprehension',
  wsCorrect: 'Correct.',
  wsNotQuite: 'Not quite.',
  wsRetry: 'Try again',
  wsMarkMapping: 'Known writes the Easy grade and To review writes Again, into the same spaced-repetition record as the four-grade session — which still exists under Practise and is the finer instrument. Nothing is collapsed: Hard and Good are not reachable from here, and a card you graded there keeps that grade.',
};

export const WORKSPACE_KEYS = Object.keys(workspaceEn) as (keyof typeof workspaceEn)[];

registerEnglish(workspaceEn);
