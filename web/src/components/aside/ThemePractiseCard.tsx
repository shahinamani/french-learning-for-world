/**
 * "Practise this theme": the page's own flashcard link (passed as children),
 * then the papers of the learner's exam in which the theme is evidenced, each a
 * link to that section's page (redesign v2b, owner 2026-11-19). The sections
 * come from the theme's evidence, never from a guess.
 */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import type { Dict } from '../../lib/i18n';
import { useTarget, type SectionKey } from '../../lib/exam-targets';
import { AsideCard } from './index';
import { Icon } from '../Icon';

const SEC_LABEL: Record<SectionKey, keyof Dict> = { co: 'shellExamSecCo', ce: 'shellExamSecCe', pe: 'shellExamSecPe', po: 'shellExamSecPo' };
const ORDER: SectionKey[] = ['co', 'ce', 'pe', 'po'];

/** A paper's abbreviation in the evidence (CO, CE, PE, PO; TCF/TEF also EE, EO) to a section. */
export function sectionOfPaper(paper: string): SectionKey | null {
  const p = paper.trim().toUpperCase();
  if (p.startsWith('CO')) return 'co';
  if (p.startsWith('CE')) return 'ce';
  if (p.startsWith('PE') || p.startsWith('EE')) return 'pe';
  if (p.startsWith('PO') || p.startsWith('EO')) return 'po';
  return null;
}

export function ThemePractiseCard({ papers, children }: { papers: string[]; children?: ReactNode }) {
  const { t } = useApp();
  const userId = useUserId();
  const [target] = useTarget(userId);
  const sections = ORDER.filter((s) => papers.some((p) => sectionOfPaper(p) === s));
  return (
    <AsideCard title={t('tdCsPractiseTitle')} testId="aside-theme-practise">
      {children}
      {!target && <p className="muted fine">{t('tdCsPractiseNoExam')} <Link to="/app/exam">{t('shellExamChoose')}</Link></p>}
      {target && sections.length > 0 && (
        <>
          <p className="aside-card__facts">{t('tdCsPractiseInExam')} · {target.label}</p>
          <ul className="aside-list">
            {sections.map((s) => (
              <li key={s}>
                <Link to={`/app/exam/${target.id}/${s}`}>{t(SEC_LABEL[s])} <Icon name="chevron" size={14} /></Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </AsideCard>
  );
}
