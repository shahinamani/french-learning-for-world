/**
 * The portal's navigation, written once.
 *
 * The sidebar, the mobile sheets, the breadcrumb and the placeholder pages all
 * read this table, so a route cannot be in one and missing from another. The
 * order and grouping are docs/blueprint/CONTRACTS-v0.2.md section 1.
 *
 * Labels are dictionary KEYS, not English: prose passed around here is how two
 * screens once came to be English in all four languages (see Stub.tsx).
 */
import type { Dict } from '../../lib/i18n';

export type NavItem = { id: string; to: string; icon: string; label: keyof Dict };

const item = (id: string, icon: string, label: keyof Dict): NavItem =>
  ({ id, to: `/app/${id}`, icon, label });

export const TODAY = item('today', 'home', 'today');
export const PATH = item('path', 'path', 'shellNavPath');
export const VOCABULARY = item('vocabulary', 'wordtag', 'vocabulary');
export const CARDS = item('cards', 'stackedcards', 'cards');
export const VERBS = item('verbs', 'bookclock', 'verbs');
export const GRAMMAR = item('grammar', 'openbook', 'grammar');
export const LISTENING = item('listening', 'headphones', 'shellNavListening');
export const READING = item('reading', 'textpage', 'shellNavReading');
export const WRITING = item('writing', 'micpen', 'shellNavWriting');
export const OUTPUT = item('output', 'micpen', 'shellNavOutput');
export const NEWS = item('news', 'newspaper', 'shellNavNews');
export const PODCASTS = item('podcasts', 'soundwave', 'shellNavPodcasts');
export const EXAMS = item('exams', 'examsheet', 'exams');
export const SAVED = item('saved', 'bookmark', 'shellNavSaved');
export const PROGRESS = item('progress', 'chart', 'progress');
/** The learner's exam (redesign v1): named here so the breadcrumb finds it. */
export const EXAM = item('exam', 'examsheet', 'shellExamMy');

/** Redesign v1 (docs/blueprint/REDESIGN-v1.md §4): the navigation shows only
 *  what exists. Vocabulary, listening, speaking, news, podcasts and
 *  saved have no content yet; their routes stay and say so, but no menu sends a
 *  learner to an empty page. Each returns to these lists when it is built. */
export const FREE_GROUP: NavItem[] = [CARDS, VERBS, GRAMMAR, READING, WRITING];
/** Built later. Kept here so the breadcrumb and the placeholder pages still
 *  find their names. */
export const NOT_YET: NavItem[] = [VOCABULARY, LISTENING, OUTPUT, NEWS, PODCASTS, SAVED];

export const ALL_ITEMS: NavItem[] =
  [TODAY, EXAM, PATH, ...FREE_GROUP, EXAMS, PROGRESS, ...NOT_YET];

/** Bottom of the sidebar. Not a group: four standing exits from the learning. */
export const FOOTER: NavItem[] = [
  { id: 'account', to: '/account', icon: 'user', label: 'account' },
  { id: 'appearance', to: '/account', icon: 'appearance', label: 'shellAppearance' },
  { id: 'help', to: '/about', icon: 'help', label: 'shellHelp' },
  { id: 'exit', to: '/', icon: 'exit', label: 'shellExit' },
];

/** What the mobile "Learn" sheet lists, and what "More" lists. */
export const LEARN_SHEET: NavItem[] = [VERBS, GRAMMAR, READING, WRITING];
export const MORE_SHEET: NavItem[] = [PROGRESS, PATH];

/** Which top-level nav item a pathname belongs to, for the breadcrumb. */
export function itemFor(pathname: string): NavItem | undefined {
  const seg = pathname.split('/')[2];
  return ALL_ITEMS.find((i) => i.id === seg);
}

export function groupFor(item: NavItem): keyof Dict | null {
  if (FREE_GROUP.includes(item)) return 'shellGroupFree';
  return null;
}
