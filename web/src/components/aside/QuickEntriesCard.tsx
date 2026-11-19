/** Straight into the parts of the portal a search usually ends at. */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import type { Dict } from '../../lib/i18n';
import { Icon } from '../Icon';
import { AsideCard } from './index';

const ENTRIES: { to: string; label: keyof Dict; fr: string }[] = [
  { to: '/app/verbs', label: 'verbs', fr: 'les verbes' },
  { to: '/app/grammar', label: 'grammar', fr: 'la grammaire' },
  { to: '/app/themes', label: 'shellNavThemes', fr: 'les thèmes' },
  { to: '/app/reading', label: 'shellNavReading', fr: 'la lecture' },
  { to: '/app/dialogues', label: 'navDialogues', fr: 'les dialogues' },
];

export function QuickEntriesCard() {
  const { t } = useApp();
  return (
    <AsideCard title={t('tdAsQuickTitle')} testId="aside-quick">
      <ul className="aside-list">
        {ENTRIES.map((e) => (
          <li key={e.to}>
            <Link to={e.to}>
              <span>{t(e.label)} <span className="muted fr-inline" lang="fr" dir="ltr">{e.fr}</span></span>
              <Icon name="chevron" size={14} />
            </Link>
          </li>
        ))}
      </ul>
    </AsideCard>
  );
}
