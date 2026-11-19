/**
 * "This session": today's plan with the current step marked, how far the
 * session has got, how many were right, and the time per card — all measured
 * in this sitting, on this device. Nothing is predicted.
 */
import '../../lib/locales/en/todayEn';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { readPlan, type StepKind } from '../../lib/plan';
import { Num } from '../Num';
import { AsideCard } from './index';

export function SessionCard({ current, done, total, right, rightKey, times, countKey = 'tdDone' }:
  { current?: StepKind; done: number; total: number; right: number;
    /** Which sentence the right count is: cards are rated, drill answers are checked. */
    rightKey: 'tdBsRight' | 'tdBsRightSoFar';
    /** Milliseconds per graded item, in the order they were graded. */
    times: number[];
    countKey?: 'tdDone' | 'tdBsFormsDone' }) {
  const { t } = useApp();
  const userId = useUserId();
  const plan = readPlan(userId);
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 100) / 10 : null;
  return (
    <AsideCard title={t('tdSession')} testId="aside-session">
      <p className="aside-card__lead"><Num>{t(countKey, { n: done, m: total })}</Num></p>
      <div className="session-aside__rail rail" aria-hidden="true">
        <span className="rail__fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <p className="aside-card__facts"><Num>{t(rightKey, { n: right })}</Num></p>
      <p className="aside-card__facts">
        {avg === null ? t('tdBsNoTiming') : <Num>{t('tdBsAvgSeconds', { n: avg })}</Num>}
      </p>
      {plan ? (
        <ol className="aside-steps" data-testid="aside-session-plan">
          {plan.steps.map((s, i) => (
            <li key={s.kind} data-done={s.done || undefined} aria-current={s.kind === current ? 'step' : undefined}
                className={s.kind === current ? 'is-here' : undefined}>
              <span className="aside-steps__n">{s.done ? '✓' : i + 1}</span>
              <Link to={s.to}>{s.fr ? <span lang="fr" dir="ltr">{s.fr}</span> : s.title}</Link>
              {s.kind === current && <span className="aside-steps__here muted">{t('tdBsPlanHere')}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted fine">{t('tdBsNoPlan')} <Link to="/app/today">{t('today')}</Link></p>
      )}
    </AsideCard>
  );
}
