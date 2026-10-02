import type { Locale } from './types';

export const LOCALES: Record<Locale, { name: string; dir: 'ltr' | 'rtl' }> = {
  en: { name: 'English', dir: 'ltr' },
  fr: { name: 'Français', dir: 'ltr' },
  fa: { name: 'فارسی', dir: 'rtl' },
  ar: { name: 'العربية', dir: 'rtl' },
};

/** `en` is the structural source of truth; the test asserts the other three match its keys. */
const en = {
  verbs: 'Verbs', verbsIntro: 'Search any verb and see every tense and mood. Practice runs straight from the table, and what you get wrong joins the same record as everything else.', verbSearchPlaceholder: 'être, to take, allons…', irregular: 'irregular', regular: 'regular', auxiliary: 'auxiliary', imperative: 'Imperative', noImperative: 'This verb has no imperative in ordinary French.', practiseTense: 'Practise', yourAnswer: 'Your answer', check: 'Check', next: 'Next', correct: 'Correct.', accentsOnly: 'Right, but the accents: {a}', answerIs: 'The answer is {a}',
  appName: 'French Learning for World',
  mainNav: 'Main',
  accentBar: 'French characters',
  exams: 'Examinations', questions: '{n} questions',
  examsIntro: 'Practice papers for the French examinations, written for this project. They are not past papers and not official material.',
  examsAvailable: 'What you can practise now', examsMissing: 'What is not here, and why',
  examsMissingIntro: 'These papers are missing for reasons, not by oversight. Each one says what is blocking it.',
  whyNoListening: 'No listening paper: we ship no audio, because none has been obtained under a licence that permits it. Machine speech is not offered as listening practice.',
  whyNoWriting: 'No writing paper: writing needs a human or a very good model to mark it, and pretending otherwise would waste your time.',
  whyNoSpeaking: 'No speaking paper: the same, and it also needs recording and a marker.',
  whyNoDalf: 'No DALF: it is C1 and C2 only, and the concept map for this project stops at B2. B2 is the stated ceiling until A1–B2 is deep rather than thin.',
  examIndependence: 'This project is independent. It is not affiliated with, endorsed by or connected to France Éducation international, the Chambre de commerce et d’industrie de Paris, or any body that administers these examinations. No past paper is reproduced here.',
  theRealPaper: 'The real paper', thisPractice: 'This practice:', duration: 'Duration', marks: 'Marks', source: 'Source',
  startExam: 'Start — {n} minutes', resume: 'Resume', attemptInProgress: 'You have a paper in progress',
  yourAttempts: 'Your past attempts', paperNotFound: 'That paper does not exist.',
  attemptNotFound: 'That attempt is not on this device.',
  attemptNotFoundBody: 'Attempts are stored on the device you sat them on. Start a new one, or open it on the device you used.',
  attemptFinished: 'You have already finished this attempt.', seeResults: 'See the results',
  questionsAnswered: 'Questions answered', previous: 'Previous',
  submitExam: 'Finish — {n} of {m} answered',
  skipToContent: 'Skip to content',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  stubLevelTitle: 'Level and skill',
  stubLevelBody: 'Lesson pages per level and skill are not built. The concepts for this level exist and are searchable, and the flashcards and verbs sections cover A1 today. Next after Sounds and Timers.',
  stubSoundsTitle: 'Sounds and listening',
  stubSoundsBody: 'Blocked on audio, not on code: this project may only use recordings whose licence permits it, and none has been obtained yet. Machine speech is not shipped as listening practice. The phonetics concepts exist and are searchable now.',
  notTranslatedHere: 'Shown in English — these questions and explanations have not been translated into your language yet.',
  examResumable: 'Your answers are saved as you go. You can close this and come back; the clock keeps running.',
  yourResult: 'Your result', score: 'Score', answeredOf: '{n} of {m} answered',
  notAnOfficialResult: 'This is practice, not the examination. It is not a pass or a fail and it is not a level.',
  whatToWorkOn: 'What to work on', whatWentWell: 'What went well', nothingWeak: 'Every concept in this paper came out right.',
  everyQuestion: 'Every question', incorrect: 'Wrong', notAnswered: 'Not answered',
  theAnswer: 'the answer', youChose: 'You chose', backToPaper: 'Back to the paper',
  importData: 'Bring your progress in', chooseFile: 'Choose a file…',
  importBody: 'Load a file you exported from this app, on this device or another one. Your history is added to this profile; nothing already here is lost, and importing the same file twice changes nothing.',
  importDone: 'Added {n} reviews, skipped {s} already here, updated {c} cards.',
  importNotJson: 'That file is not readable as JSON.',
  importNotOurs: 'That is not a progress file from this app.',
  importVersion: 'That file was made by a newer version of this app.',
  sessionOfMinutes: 'Your {n}-minute session is finished.', keepGoing: 'Keep studying', timeLeft: '{c} left',
  learn: 'Learn', practise: 'Practise', progress: 'Progress', search: 'Search',
  settings: 'Settings', account: 'Account', about: 'About', close: 'Close', back: 'Back',
  today: 'Today', dueNow: 'Due now', newCards: 'New', learned: 'Learned', cards: 'Cards',
  yourLevel: 'Your level', allLevels: 'All levels', showingLevel: 'Showing {level} only', toWorkOn: 'To work on', start: 'Start', startSession: 'Start studying',
  minutes: '{n} min', sessionOf: '{n} cards · {m} min',
  nothingDue: 'Nothing is due right now', nothingDueBody: 'Study ahead with new cards, or come back later.',
  studyAhead: 'Study new cards', sessionDone: 'Session finished',
  sessionDoneBody: 'Everything due has been reviewed.', reviewed: 'Reviewed: {n}',
  showAnswer: 'Show answer', again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy',
  now: 'now', days: '{n}d', past: 'Past', future: 'Future',
  verb: 'verb', noun: 'noun', adjective: 'adjective', masculine: 'masculine', feminine: 'feminine',
  timer: 'Study timer', pause: 'Pause', reset: 'Reset', dismiss: 'Dismiss',
  timerDone: 'Time is up.', timerDoneSilent: 'Time is up. The browser would not play the chime.',
  timerAway: 'Your timer finished while you were away.',
  soundOn: 'Chime on', soundOff: 'Chime off',
  conceptRecord: 'Your record on this', practiseThis: 'Practise this concept',
  noRecordYet: 'No reviews yet. Study a card that uses it and this fills in.',
  reviewsCount: '{n} reviews', accuracy: 'Accuracy', lastSeen: 'Last seen',
  relatedConcepts: 'What this card tests', openPanel: 'Open details',
  searchPlaceholder: 'Lessons, grammar, verbs, words…',
  searchEmpty: 'Nothing for “{q}”. Try: passé composé, liaison, voyager.',
  searchHint: 'Type to search. Try a level like “B1”, or a time like “5 min”.',
  grammar: 'Grammar', vocabulary: 'Vocabulary', phonetics: 'Pronunciation', usage: 'Usage',
  // The seven columns of the map. They were CO CE PE PO Gr Voc Phon — French
  // abbreviations, unexplained, in every language. They meant nothing to a
  // Persian or Arabic learner and little to an English one.
  skillListening: 'Listening', skillReading: 'Reading', skillWriting: 'Writing', skillSpeaking: 'Speaking',
  notTranslatedName: 'Shown in English — this name has not been translated into your language yet.',
  concepts: 'Concepts', sessions: 'Sessions', loading: 'Loading…',
  loadFailed: 'Could not load the content.', retry: 'Try again',
  offline: 'Offline — what is already on this device still works.',
  storageBlocked: 'This browser is not saving progress — it may be a private window.',
  weakNone: 'Not enough data yet. After about twenty reviews your weak points appear here.',
  weakIntro: 'Weak points appear here as you study. The system watches which concepts you get wrong and shows the ones to work on.',
  history: 'History', thisWeek: 'This week', whatMoved: 'What moved', noHistory: 'No reviews yet.',
  interfaceLanguage: 'Interface language', meaningLanguage: 'Meaning shown in',
  profile: 'Profile', switchProfile: 'Switch profile', newProfile: 'New profile',
  exportData: 'Export my data', eraseData: 'Erase everything',
  eraseConfirm: 'Erase all progress for this profile? This cannot be undone.',
  // Where the meanings come from, said on the page rather than in a document
  // nobody opens. 2,366 glosses were taken from en.wiktionary.org by script and
  // no French teacher has read them; a learner is entitled to know that before
  // they memorise one.
  glossSource: 'Meanings come from Wiktionary and have not been reviewed by a teacher.',
  glossWithheldVulgar: 'No meaning is shown: every sense Wiktionary records for this verb is marked vulgar. The verb is in the list because it is common in speech, not because it is one to use.',
  notBuilt: 'Not built yet',
  notBuiltBody: 'This section is planned. The shell, search, the side panel and flashcards are complete; the rest follow the same pattern.',
  independence: 'Independent study tool. Not affiliated with any examination body. No certificates are issued.',
  // The promise this product makes to a learner about their own data. Shown on
  // first entry and permanently reachable, because somebody who loses six
  // months of history to a cleared browser was never warned by a sentence
  // buried in settings.
  dataTitle: 'Where your progress is kept',
  dataStored: 'Everything you do here — your review history, your settings and your progress — is stored in this browser only.',
  dataNotSent: 'It is never sent anywhere. There is no account, no server and no third party involved, which is why this site asks you to agree to nothing.',
  dataClear: 'If you clear your browser data, or study in a private window, it is gone and cannot be recovered.',
  dataExport: 'Export a copy from Settings before you change device, and import it on the new one.',
  dataUnderstood: 'Got it',
  // /about — what this is, and the attribution CC BY-SA requires.
  aboutTitle: 'About this project',
  aboutWhat: 'A free, open study tool for French, built around spaced repetition. No account, no tracking, and nothing you do here leaves your browser.',
  aboutIndependenceHeading: 'Independence',
  aboutSources: 'Sources and licences',
  aboutSourcesIntro: 'Openly licensed work this project is built on. Each is used under the licence shown, and each licence requires that it be named here.',
  verbCount: 'Showing {shown} of {total} verbs. Type to narrow the list.',
  readNotWritten: 'Read, not written',
};

export type Dict = typeof en;

/**
 * English is bundled; the other three are fetched when a learner actually uses
 * them. All four in the first load cost 13 820 bytes gzipped, of which any one
 * learner reads a quarter — and the budget has no room for three languages
 * nobody on this page is reading.
 *
 * Until a dictionary arrives the translator falls back to English, which is why
 * `en` cannot itself be lazy: the prerendered HTML is rendered with it.
 */
const loaded: Partial<Record<Locale, Dict>> = { en };
const pending: Partial<Record<Locale, Promise<Dict>>> = {};

export function dictionaryFor(locale: Locale): Dict | undefined {
  return loaded[locale];
}

export function loadDictionary(locale: Locale): Promise<Dict> {
  if (loaded[locale]) return Promise.resolve(loaded[locale] as Dict);
  if (!pending[locale]) {
    pending[locale] = (locale === 'fr' ? import('./locales/fr')
      : locale === 'fa' ? import('./locales/fa')
      : import('./locales/ar'))
      .then((m) => { loaded[locale] = m.default; return m.default; })
      .catch((e) => { delete pending[locale]; throw e; });
  }
  return pending[locale] as Promise<Dict>;
}

/**
 * Bidi isolation, applied where the substitution happens.
 *
 * A placeholder in an RTL sentence is replaced by text whose direction we do
 * not control: a French answer, a search query someone typed, a level like
 * «B1», a clock like «12:34». Dropped in bare, the substituted run and the
 * punctuation around it reorder on screen, and the sentence a Persian or
 * Arabic learner reads is not the sentence that was written.
 *
 * U+2068 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL ISOLATE tells the bidi
 * algorithm to resolve the inserted run on its own and put it back as one
 * piece. FSI rather than LRI because the value may legitimately be either
 * direction.
 *
 * This lives here and not at the call sites on purpose. A rule applied at call
 * sites is a rule one call site will always miss — and it will be the one added
 * next month by someone who never read this file. There is one substitution
 * point in the product; it is this line.
 */
const FSI = '\u2068';
const PDI = '\u2069';

export function translator(locale: Locale) {
  const dict = loaded[locale] ?? en;
  const isolate = LOCALES[locale].dir === 'rtl';
  return (key: keyof Dict, vars?: Record<string, string | number>): string => {
    let out: string = dict[key] ?? en[key] ?? String(key);
    if (vars) for (const [k, v] of Object.entries(vars)) {
      const value = isolate ? `${FSI}${v}${PDI}` : String(v);
      out = out.split(`{${k}}`).join(value);
    }
    return out;
  };
}

export function detectLocale(langs: readonly string[]): Locale {
  for (const tag of langs) {
    const base = String(tag).toLowerCase().split('-')[0] as Locale;
    if (base && base in LOCALES) return base;
  }
  return 'en';
}
