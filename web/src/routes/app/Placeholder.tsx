/**
 * A section of the portal that is on the route map and not built.
 *
 * It says what is missing, why where the reason is known, and where to go
 * instead. It never says "coming soon": that is a promise with no date, and the
 * blueprint names it as a reason to reject the page. Nothing here is styled to
 * look like content. A lazy route like every other page (redesign v2b): its
 * side column reads the learner's plan, which has no place in the first load.
 */
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { Icon } from '../../components/Icon';
import type { Dict } from '../../lib/i18n';
import type { NavItem } from './nav';
import { PlanCard, TipCard } from '../../components/aside';
import type { Instead } from './placeholders';

export type { Instead } from './placeholders';
export { PLACEHOLDERS } from './placeholders';

export function Placeholder({ item, missing, instead }: {
  item: NavItem; missing: keyof Dict; instead: Instead[];
}) {
  const { t } = useApp();
  return (
    <div className="page dash">
      <div className="empty dash__main" data-testid={`placeholder-${item.id}`}>
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
      {/* A dead end still shows where to go: today's plan and what the map means. */}
      <aside className="dash__aside"><PlanCard /><TipCard id="path" /></aside>
    </div>
  );
}
