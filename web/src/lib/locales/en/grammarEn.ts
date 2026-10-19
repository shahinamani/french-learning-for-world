/**
 * English grammarEn — a lazy part of the English dictionary.
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
 * The grammar loop and the Exercise component (stream S2-grammar, 2026-10-18).
 *
 * A fifth optional group, for the standing reason of the other four: adding to
 * `en` obliges Persian and Arabic, and inventing those is what this project
 * does not do. English and French are written here; Persian and Arabic fall
 * back to English behind `notTranslatedHere`. Every key carries the prefix
 * `grl` (NOT `gram`: the core key `grammar` begins with it).
 *
 * The lesson TEXT is not in this group. It is in content/lessons.json, in the
 * languages its writer supplied; these are only the words around it.
 */
export const grammarEn = {
  grlTitle: 'Grammar',
  grlLead: 'Short lessons: the idea, two examples, how it differs from its neighbour, then practice that explains every answer.',
  grlSearch: 'Search grammar',
  grlSearchPlaceholder: 'passé composé, partitive…',
  grlFilterLevel: 'Level',
  grlFilterTopic: 'Topic',
  grlAll: 'All',
  grlCount: '{n} of {total} lessons',
  grlActiveFilters: 'Active filters',
  grlRemoveFilter: 'Remove filter: {name}',
  grlClearFilters: 'Clear all filters',
  grlSearchChip: 'Search: {q}',
  grlNoMatch: 'No lesson matches these filters.',
  grlNoMatchHelp: 'Remove a filter or clear the search.',
  grlQuestionsN: '{n} practice questions',
  grlOpenLesson: 'Open lesson',
  grlLoading: 'Loading the lessons…',
  grlLoadError: 'The lessons could not be loaded.',
  grlLoadErrorHelp: 'Nothing is wrong with your progress. Try again.',
  grlOffline: 'You are offline, and these lessons are not stored on this device yet.',
  grlOfflineHelp: 'Reconnect, then try again.',
  grlRetryLoad: 'Try again',
  grlEmpty: 'There are no grammar lessons yet.',
  grlEmptyHelp: 'None has been written. The vocabulary and verbs sections still work.',
  grlNoLesson: 'There is no lesson for this yet.',
  grlNoLessonHelp: 'The concept exists, but nobody has written a lesson on it.',
  grlBackToList: 'All grammar lessons',
  grlBackToOrigin: 'Back to what you were doing',
  grlStepExplanation: 'The idea',
  grlStepExamples: 'Two examples',
  grlStepDifference: 'How it differs from {name}',
  grlStepPractice: 'Practice',
  grlSimpler: 'Simpler explanation',
  grlFullAgain: 'Full explanation',
  grlOpenNearby: 'Open the lesson on {name}',
  grlNotInYourLanguage: 'Part of this lesson is not written in your language yet. Those parts are shown in English.',
  grlDrafted: 'Drafted, not reviewed. No teacher has read this lesson, and nobody has checked the grammar against a reference.',
  grlQuestionOf: 'Question {n} of {total}',
  grlFinishedTitle: 'Practice finished',
  grlFinishedScore: '{n} of {total} right on the first try.',
  grlPracticeAgain: 'Practise again',
  grlReturnOrigin: 'Return to where you came from',
  grlReturnList: 'Back to all grammar lessons',
  grlExCheck: 'Check',
  grlExChoose: 'Choose an answer first.',
  grlExRight: 'Correct.',
  grlExWrong: 'Not quite.',
  grlExAnswerIs: 'The answer is {a}.',
  grlExWhyRight: 'Why this is right',
  grlExWhyWrong: 'Why “{a}” is wrong',
  grlExNoNote: 'No note was written for the choice you made.',
  grlExYours: 'Your answer',
  grlExTheAnswer: 'Correct answer',
  grlExRetry: 'Try again',
  grlExContinue: 'Continue',
  grlExLoading: 'Loading the question…',
  grlExError: 'This question could not be loaded.',
  grlExOffline: 'You are offline.',
  grlExEmpty: 'There is no question here.',
  grlExFinished: 'Finished.',
};

export const GRAMMAR_KEYS = Object.keys(grammarEn) as (keyof typeof grammarEn)[];

registerEnglish(grammarEn);
