/**
 * Which pages are placeholders, and what each offers instead. Kept apart from
 * the Placeholder component so the router can read the table in the first load
 * while the page itself (and its side column) arrives as a lazy chunk.
 */
import type { Dict } from '../../lib/i18n';

export type Instead = { to: string; label: keyof Dict };

const SEARCH: Instead = { to: '/app/search', label: 'search' };
const TODAY: Instead = { to: '/app/today', label: 'shellGoMap' };

/** Which pages are placeholders, and what each offers instead. Every `to` here
 *  is a route that exists; the walk follows each one. */
export const PLACEHOLDERS: Record<string, { missing: keyof Dict; instead: Instead[] }> = {
  path: { missing: 'shellMissingPath', instead: [TODAY, { to: '/app/cards', label: 'cards' }] },
  vocabulary: { missing: 'shellMissingVocabulary', instead: [{ to: '/app/cards', label: 'cards' }, { to: '/app/themes', label: 'shellNavThemes' }, SEARCH] },
  grammar: { missing: 'shellMissingGrammar', instead: [SEARCH, TODAY] },
  reading: { missing: 'shellMissingReading', instead: [{ to: '/app/verbs', label: 'verbs' }, SEARCH] },
  output: { missing: 'shellMissingOutput', instead: [{ to: '/app/writing', label: 'shellNavWriting' }, { to: '/app/verbs/drill', label: 'shellGoDrill' }] },
  news: { missing: 'shellMissingNews', instead: [SEARCH, TODAY] },
  podcasts: { missing: 'shellMissingPodcasts', instead: [{ to: '/app/listening', label: 'shellNavListening' }, TODAY] },
  saved: { missing: 'shellMissingSaved', instead: [{ to: '/app/progress', label: 'progress' }, { to: '/app/cards', label: 'cards' }] },
};
