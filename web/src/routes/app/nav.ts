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
export const OUTPUT = item('output', 'micpen', 'shellNavOutput');
export const NEWS = item('news', 'newspaper', 'shellNavNews');
export const PODCASTS = item('podcasts', 'soundwave', 'shellNavPodcasts');
export const EXAMS = item('exams', 'examsheet', 'exams');
export const SAVED = item('saved', 'bookmark', 'shellNavSaved');
export const PROGRESS = item('progress', 'chart', 'progress');

/** The group the contract calls "free learning": collapsible in the sidebar. */
export const FREE_GROUP: NavItem[] = [VOCABULARY, CARDS, VERBS, GRAMMAR, LISTENING, READING, OUTPUT];
export const DISCOVER_GROUP: NavItem[] = [NEWS, PODCASTS];

export const ALL_ITEMS: NavItem[] =
  [TODAY, PATH, ...FREE_GROUP, ...DISCOVER_GROUP, EXAMS, SAVED, PROGRESS];

/** Bottom of the sidebar. Not a group: four standing exits from the learning. */
export const FOOTER: NavItem[] = [
  { id: 'account', to: '/account', icon: 'user', label: 'account' },
  { id: 'appearance', to: '/account', icon: 'appearance', label: 'shellAppearance' },
  { id: 'help', to: '/about', icon: 'help', label: 'shellHelp' },
  { id: 'exit', to: '/', icon: 'exit', label: 'shellExit' },
];

/** What the mobile "Learn" sheet lists, and what "More" lists. */
export const LEARN_SHEET: NavItem[] = [...FREE_GROUP, ...DISCOVER_GROUP];
export const MORE_SHEET: NavItem[] = [PATH, EXAMS, PROGRESS];

/** Which top-level nav item a pathname belongs to, for the breadcrumb. */
export function itemFor(pathname: string): NavItem | undefined {
  const seg = pathname.split('/')[2];
  return ALL_ITEMS.find((i) => i.id === seg);
}

export function groupFor(item: NavItem): keyof Dict | null {
  if (FREE_GROUP.includes(item)) return 'shellGroupFree';
  if (DISCOVER_GROUP.includes(item)) return 'shellGroupDiscover';
  return null;
}
