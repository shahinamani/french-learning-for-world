/**
 * A section of the portal that is on the route map and not built.
 *
 * It says what is missing, why where the reason is known, and where to go
 * instead. It never says "coming soon": that is a promise with no date, and the
 * blueprint names it as a reason to reject the page. Nothing here is styled to
 * look like content.
 */
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { Icon } from '../../components/Icon';
import type { Dict } from '../../lib/i18n';
import type { NavItem } from './nav';

export type Instead = { to: string; label: keyof Dict };

export function Placeholder({ item, missing, instead }: {
  item: NavItem; missing: keyof Dict; instead: Instead[];
}) {
  const { t } = useApp();
  return (
    <div className="page">
      <div className="empty" data-testid={`placeholder-${item.id}`}>
        <div className="empty__icon"><Icon name={item.icon} size={34} /></div>
        <h1 className="empty__title">{t(item.label)}</h1>
        <p className="empty__body"><strong>{t('notBuilt')}.</strong> {t(missing)}</p>
        <p className="eyebrow">{t('shellInstead')}</p>
        <div className="row gap-2 wrap" style={{ justifyContent: 'center' }}>
          {instead.map((i, n) => (
            <Link key={i.to} className={`btn${n === 0 ? ' btn--primary' : ''}`} to={i.to}>{t(i.label)}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const SEARCH: Instead = { to: '/app/search', label: 'search' };
const TODAY: Instead = { to: '/app/today', label: 'shellGoMap' };
const WORKSPACE: Instead = { to: '/app/workspace', label: 'shellGoWorkspace' };

/** Which pages are placeholders, and what each offers instead. Every `to` here
 *  is a route that exists; the walk follows each one. */
export const PLACEHOLDERS: Record<string, { missing: keyof Dict; instead: Instead[] }> = {
  path: { missing: 'shellMissingPath', instead: [TODAY, { to: '/app/cards', label: 'cards' }] },
  vocabulary: { missing: 'shellMissingVocabulary', instead: [WORKSPACE, { to: '/app/cards', label: 'cards' }, SEARCH] },
  grammar: { missing: 'shellMissingGrammar', instead: [SEARCH, TODAY] },
  reading: { missing: 'shellMissingReading', instead: [{ to: '/app/verbs', label: 'verbs' }, SEARCH] },
  output: { missing: 'shellMissingOutput', instead: [{ to: '/app/verbs/drill', label: 'shellGoDrill' }, { to: '/app/verbs', label: 'verbs' }] },
  news: { missing: 'shellMissingNews', instead: [SEARCH, TODAY] },
  podcasts: { missing: 'shellMissingPodcasts', instead: [{ to: '/app/listening', label: 'shellNavListening' }, TODAY] },
  saved: { missing: 'shellMissingSaved', instead: [{ to: '/app/progress', label: 'progress' }, { to: '/app/cards', label: 'cards' }] },
};
