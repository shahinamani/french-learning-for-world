/**
 * A mini-index of one letter kind's parts, in order, each a link to its
 * anchor on the page (redesign v2b, owner 2026-11-19). Hash routing means the
 * anchor goes through the router's Link, not a bare href.
 */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { AsideCard } from './index';

export function PartsIndexCard({ parts }: { parts: { id: string; fr: string; local?: string }[] }) {
  const { t } = useApp();
  return (
    <AsideCard title={t('tdCsPartsTitle')} testId="aside-parts">
      <ol className="aside-steps">
        {parts.map((p, i) => (
          <li key={p.id}>
            <span className="aside-steps__n">{i + 1}</span>
            <Link to={{ hash: `#lw-part-${p.id}` }}>
              <span lang="fr" dir="ltr">{p.fr}</span>
              {p.local && <span className="muted aside-parts__local" dir="auto"> · {p.local}</span>}
            </Link>
          </li>
        ))}
      </ol>
    </AsideCard>
  );
}
