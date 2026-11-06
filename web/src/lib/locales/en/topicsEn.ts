/**
 * English topicsEn — a lazy part of the English dictionary (see weaknessEn.ts
 * for how lazy groups work). Themes and free resources, added 2026-11-06.
 *
 * Lazy because the first load has no room: the sidebar (a lazy chunk) and the
 * two pages import this file. French and Persian carry the keys themselves;
 * Persian is a draft (docs/review/fa-ui-drafts.md); Arabic falls back.
 */
import { registerEnglish } from '../../i18n';

export const topicsEn = {
  // The list
  tpTitle: 'Themes',
  tpLede: 'Exam tasks are set on everyday subjects: renting a flat, a hotel stay, sport, work. Each theme gathers the words, verbs and expressions you need to talk and write about it.',
  tpForExam: 'Seen in {exam} sample papers',
  tpForExamNone: 'No official {exam} sample paper read so far is set on these themes. Any of them can still come up.',
  tpOthers: 'More themes',
  tpAll: 'All themes',
  tpChooseExam: 'Choose your exam to see which themes its official sample papers use.',
  tpCounts: '{w} words · {v} verbs · {e} expressions',
  tpInExam: 'In {exam} samples',
  tpHowTitle: 'How themes are matched to exams',
  tpHowBody: 'A theme is linked to an exam only when we read an official sample paper or the exam body’s own description and found a task on that subject. Each link names the document and the date it was read. Prep sites’ “top themes” lists are not used.',
  tpLoading: 'Loading themes…',

  // One theme
  tpBack: 'All themes',
  tpWords: 'Words',
  tpVerbs: 'Verbs',
  tpExpressions: 'Expressions',
  tpLevel: 'Level',
  tpUpTo: 'Up to {level}',
  tpAllLevels: 'All levels',
  tpNoneAtLevel: 'Nothing in this list at these levels yet.',
  tpUseSpeaking: 'speaking',
  tpUseWriting: 'writing',
  tpUseBoth: 'speaking and writing',
  tpPractise: 'Practise this theme’s cards',
  tpPractiseNote: '{n} of these words and verbs are flashcards. Practising them here adds to the same review history as your level decks.',
  tpEvidenceTitle: 'Where this theme appears in exams',
  tpEvidenceNone: 'We have not yet found this theme in an official sample paper. That does not mean it cannot come up.',
  tpEvidenceYours: 'Your exam',
  tpEvidenceOther: 'Other exams',
  tpReadOn: 'read on {date}',
  tpNotFound: 'This theme does not exist.',

  // Free resources
  rsTitle: 'Free resources',
  rsLede: 'Podcasts, videos, books, sample papers and tools you can use without paying. Only legal sources: public broadcasters, exam bodies, public-domain books.',
  rsKind: 'Type',
  rsAllKinds: 'All',
  rsLevelAny: 'Any level',
  rsForMyExam: 'Only for {exam}',
  rsCount: '{n} resources',
  rsNone: 'No resource matches these filters.',
  rsFreeTier: 'Free tier',
  rsFree: 'Free',
  rsInLanguage: 'Explained in {lang}',
  rsChecked: 'List compiled on {date}. Whether something is fully free or has a paid tier can change.',
  rsIndependent: 'This project is not connected to any of these publishers and receives nothing from them.',
  rsKindExamPractice: 'Exam practice',
  rsKindPodcast: 'Podcasts',
  rsKindVideo: 'Videos',
  rsKindNews: 'Easy news',
  rsKindBook: 'Free books',
  rsKindWebsite: 'Exercises',
  rsKindDictionary: 'Dictionaries',
  rsKindApp: 'Apps',
};

registerEnglish(topicsEn);
