/**
 * One practice paper's facts beside it: the level, the code, what this
 * practice takes, and what the real paper takes. Every figure is read from
 * the paper's own record in content/exam-papers.json.
 */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { useApp } from '../../app-context';
import type { ExamPaper } from '../../lib/exams';
import { Localised } from '../Localised';
import { AsideCard } from './index';

export function PaperFactsCard({ paper }: { paper: ExamPaper }) {
  const { t } = useApp();
  return (
    <AsideCard title={t('tdAsPaperTitle')} testId="aside-paper">
      <p className="aside-card__lead">
        <span className={`chip chip--${paper.level.toLowerCase()}`}>{paper.level}</span>{' '}
        <span className="chip">{paper.code}</span>{' '}
        <span className="chip">{paper.exam.toUpperCase()}</span>
      </p>
      <dl className="aside-facts">
        <dt>{t('tdAsPaperHere')}</dt>
        <dd>{t('minutes', { n: paper.minutes })} · {t('questions', { n: paper.items.length })}</dd>
        <dt>{t('theRealPaper')}</dt>
        <dd>{t('minutes', { n: paper.official.minutes })} · {t('marks')} {paper.official.marks}</dd>
      </dl>
      <p className="muted fine"><Localised field={paper.official.passNote} /></p>
    </AsideCard>
  );
}
