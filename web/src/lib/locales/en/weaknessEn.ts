/**
 * English weaknessEn — a lazy part of the English dictionary.
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
 * The weakness suggestion (blueprint §15), added 2026-10-18.
 *
 * A fifth optional group, for the standing reason: adding to `en` obliges
 * Persian and Arabic, and inventing those is what this project does not do.
 * English and French only; the other two fall back to English behind
 * `notTranslatedHere`.
 *
 * Copy rules from the blueprint: a reason and a link, never a mastery figure,
 * and nothing that reads as a guilt trip.
 */
export const weaknessEn = {
  wkHeading: 'A topic worth another look',
  wkThresholdNote: 'A topic is raised after 5 wrong answers and cleared after 5 correct answers in a row. These two numbers are an engineering choice made for this app. They are not a proven scientific criterion.',
  wkNoPressure: 'You can skip this. Nothing here is a streak, and skipping costs nothing.',

  // The reason — one per situation
  wkWhyNotEnough: 'There is not enough yet to conclude anything about “{topic}”. You have given {n} wrong answers on it, and it takes 5 before this page says a topic needs work.',
  wkWhyRepeated: 'In your last few exercises you needed “{topic}” again: {n} wrong answers so far.',
  wkWhyListening: 'On “{topic}” your written answers are going well, but the listening ones are not: {n} wrong. The same level with shorter clips may help.',
  wkWhyImproving: 'Your answers on “{topic}” improved in later review: {run} correct in a row. A lighter practice and a later review should be enough.',
  wkWhyCleared: 'Your answers on “{topic}” improved: 5 correct in a row since it was raised. A lighter practice and a later review are enough.',

  // The evidence
  wkLatest: 'Latest evidence',
  wkExample: 'An example of the mistake',
  wkShown: 'You were shown',
  wkAnswered: 'You answered',
  wkSelfRated: 'You marked this card to review.',
  wkWhen: 'on {date}',
  wkExplain: 'Read the explanation of this topic',
  wkExplainNote: 'This panel shows what your answers recorded. It does not guess why.',

  // The action
  wkActPractise: 'Practise this for 5 minutes',
  wkActDiagnostic: 'Take an optional short check',
  wkActListening: 'Shorter listening clips, 5 minutes',
  wkActLighter: 'A lighter practice, 5 minutes',
  wkListeningNone: 'Listening practice is not built yet, so this link opens the placeholder page.',

  // The re-check
  wkRecheckNone: 'Re-check: answer 5 in a row correctly and this topic clears.',
  wkRecheckProgress: 'Re-check: {n} of 5 correct in a row.',
  wkRecheckPassed: 'Re-check passed: 5 correct in a row.',

  // Postpone or ignore
  wkPostpone: 'Not now — ask again in 7 days',
  wkIgnore: 'Ignore this topic',
  wkIgnoreNote: 'An ignored topic comes back only if 5 more answers go wrong.',
  wkPostponedDone: 'Postponed for 7 days.',
  wkIgnoredDone: 'Ignored. It will not come back unless 5 new answers go wrong.',
  wkNotSaved: 'This choice could not be saved on this device, so it lasts only until you close this tab.',
  wkWaiting: '{n} more suggestions are waiting. They are shown one at a time.',

  // The five states
  wkLoading: 'Looking at your recent answers…',
  wkErrorTitle: 'Your answers could not be read.',
  wkErrorBody: 'Nothing was changed. Trying again is safe.',
  wkRetry: 'Try again',
  wkOfflineTitle: 'You are offline.',
  wkOfflineBody: 'Your answers are stored on this device, but topic names and practice links need a connection to load.',
  wkEmptyTitle: 'No answers yet, so nothing to say.',
  wkEmptyBody: 'This page only speaks once it has something your own answers back up.',
  wkEmptyAction: 'Start a 5-minute review',
  wkFinishedTitle: 'Nothing needs another look right now.',
  wkFinishedBody: 'No topic has reached 5 wrong answers, or the ones that did were postponed, ignored or have improved.',
  wkFinishedAction: 'Practise something else',
};

export const WEAKNESS_KEYS = Object.keys(weaknessEn) as (keyof typeof weaknessEn)[];

registerEnglish(weaknessEn);
