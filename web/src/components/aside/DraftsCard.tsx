/**
 * The learner's letter drafts, in the side column of the writing pages
 * (redesign v2b, owner 2026-11-19). The page resolves each draft's task title;
 * this card only lays them out, and says "none yet" honestly.
 */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { AsideCard } from './index';
import { Icon } from '../Icon';

export type DraftRow = { to: string; title: string; words: number; updatedAt: number };

export function DraftsCard({ drafts }: { drafts: DraftRow[] | null }) {
  const { t, settings } = useApp();
  const date = (ms: number) => { try { return new Intl.DateTimeFormat(settings.ui, { dateStyle: 'medium' }).format(ms); } catch { return ''; } };
  return (
    <AsideCard title={t('tdCsDraftsTitle')} testId="aside-drafts">
      {drafts === null && <div className="skeleton skeleton--text" />}
      {drafts !== null && drafts.length === 0 && <p className="muted fine">{t('tdCsDraftsNone')}</p>}
      {drafts !== null && drafts.length > 0 && (
        <ul className="aside-list aside-drafts">
          {drafts.slice(0, 5).map((d) => (
            <li key={d.to}>
              <Link to={d.to}>
                <span className="aside-drafts__body">
                  <span dir="auto">{d.title}</span>
                  <span className="muted">{t('tdCsFactsWords', { n: d.words })} · {t('tdCsDraftsUpdated', { date: date(d.updatedAt) })}</span>
                </span>
                <Icon name="chevron" size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AsideCard>
  );
}
