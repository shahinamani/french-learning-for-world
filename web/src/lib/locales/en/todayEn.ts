/**
 * English todayEn — a lazy part of the English dictionary (see weaknessEn.ts
 * for how lazy groups work). Today's side column and the backup reminder, and
 * the storage status in Settings, added 2026-11-03.
 *
 * Lazy because the first load had no room left: the 150 KB budget was at
 * 149.9 KB, and these strings are only shown on Today and Settings, whose
 * chunks import this file. French and Persian carry the keys themselves;
 * Arabic falls back to English.
 */
import { registerEnglish } from '../../i18n';

export const todayEn = {
  tdAside: 'Your week and your exam',
  tdWeek: 'This week',
  asideExamTitle: 'In your exam',
  asideExamOpen: 'This section of the exam',
  asideSavedTitle: 'Words you saved from texts',
  asideSavedNone: 'Tap a word in a text and save it; it appears here and in your cards.',
  asideSavedCount: '{n} saved words',
  asidePlanNone: 'Open Today to build the session of the day.',
  tipReadingTitle: 'How to read for the exam',
  tipReadingBody: 'Read the questions first, then the text. Guess an unknown word from its sentence before you tap it. For true or false, find the sentence that proves it.',
  tipWritingTitle: 'What the marker looks for',
  tipWritingBody: 'The structure before the words: greeting, a first line that says why you write, two paragraphs with an example each, a closing formula, a signature. Count your words; the minimum is a line of the task.',
  tipCardsTitle: 'How the intervals work',
  tipCardsBody: 'Rate honestly. A card you got right comes back later each time; a card you missed returns tomorrow. Ten minutes every day beats an hour on Sunday.',
  tipVerbsTitle: 'The verbs that matter most',
  tipVerbsBody: 'Être, avoir, aller, faire and the ten most frequent irregulars carry most sentences. Learn the present, the passé composé and the futur of each before any rarer tense.',
  tipGrammarTitle: 'How to use a lesson',
  tipGrammarBody: 'Read the idea, say the two examples aloud, then answer the four questions without looking back. A wrong answer is the point: its explanation is the lesson.',
  tipExamTitle: 'On the day',
  tipExamBody: 'Arrive with your identity document and a pen. The papers run listening, reading, writing in one sitting; speaking is a separate appointment. Timing in each paper is yours to manage.',
  tipThemesTitle: 'Why themes',
  tipThemesBody: 'Exam tasks are set on everyday subjects: renting a flat, a trip, work, health. A theme gives you the words, the verbs and the phrases to talk and write about one of them.',
  tipSearchTitle: 'What you can search',
  tipSearchBody: 'A French word, an English or Persian meaning, a verb form, a grammar point. Press Enter to open the first result; Cmd or Ctrl plus K opens search from anywhere.',
  tipDialoguesTitle: 'How to use a dialogue',
  tipDialoguesBody: 'Listen once without reading, then read along, then answer the questions. Say the replies aloud: the speaking paper is a conversation of this kind.',
  tipPathTitle: 'What the map shows',
  tipPathBody: 'Each cell counts the concepts of that level and skill that have exercises here. It is a map of the material, not a measure of you.',
  tipProgressTitle: 'What is counted',
  tipProgressBody: 'Every number here is a count of what you did on this device: reviews, right answers, days. Nothing is a prediction of a mark.',
  tdCsResultsTitle: 'Your results on texts',
  tdCsResultsCount: '{n} of {m} texts answered',
  tdCsResultsLast: 'Last: {c} of {n} questions right',
  tdCsResultsNone: 'No text answered yet. Finish a text and its questions and the score appears here.',
  tdCsFactsTitle: 'About this text',
  tdCsFactsWords: '{n} words',
  tdCsFactsMinutes: 'about {n} min at {w} words a minute',
  tdCsFactsSource: 'Source',
  tdCsFactsReadOn: 'read on {date}',
  tdCsTextWordsTitle: 'Words saved from this text',
  tdCsTextWordsNone: 'Nothing saved from this text yet. Touch a word and add it with its sentence.',
  tdCsTextWordsOther: '{n} more from other texts',
  tdCsDraftsTitle: 'Your drafts',
  tdCsDraftsNone: 'No drafts yet. A letter you start is kept here, in this browser.',
  tdCsDraftsUpdated: 'updated {date}',
  tdCsPartsTitle: 'The parts, in order',
  tdCsPractiseTitle: 'Practise this theme',
  tdCsPractiseInExam: 'Where it appears in your exam',
  tdCsPractiseNoExam: 'Choose your exam to see which papers this theme appears in.',
  tdCards: 'cards reviewed',
  tdDays: 'Studied on {n} of the last 7 days',
  tdBackupTitle: 'Save a copy of your progress',
  tdBackupBody: 'Your progress lives only in this browser. A copy saved to your device brings it back if the browser is cleared, and moves it to a new device.',
  tdBackupSave: 'Save a copy',
  tdBackupLater: 'Later',
  tdBackupDone: 'Saved. Keep the file somewhere safe; Settings can load it on any device.',
  tdPersistOn: 'This browser has agreed to keep your progress and will not delete it on its own.',
  tdPersistOff: 'This browser has not yet agreed to keep your progress permanently. Saving a copy now and then keeps it safe.',
  tdSession: 'This session',
  tdDone: '{n} of {m} cards',
  tdKeys: 'Keyboard',
  tdKeyFlip: 'Turn the card',
  tdKeyMove: 'Previous or next card',
  tdKeyGrade: 'Again, hard, good, easy',
};

registerEnglish(todayEn);
