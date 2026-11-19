import { Link } from 'react-router';
import { useApp } from '../app-context';

/**
 * The end of an activity (redesign v2): one next thing to do, the quieter
 * alternatives beside it, and always a way back to Today. A lesson, a text or
 * a verb page used to end in nothing, and the learner went back to the
 * sidebar to decide again.
 */
export type Step = { to: string; label: string; testId?: string };

export function NextStep({ primary, others = [], testId }: { primary: Step | null; others?: Step[]; testId?: string }) {
  const { t } = useApp();
  return (
    <nav className="next-step" aria-label={t('nextStepLabel')} data-testid={testId ?? 'next-step'}>
      {primary && <Link className="btn btn--primary btn--lg" to={primary.to} data-testid={primary.testId}>{primary.label}</Link>}
      {others.map((o) => <Link key={o.to} className="btn" to={o.to} data-testid={o.testId}>{o.label}</Link>)}
      <Link className="btn btn--ghost" to="/app/today" data-testid="next-step-today">{t('backToToday')}</Link>
    </nav>
  );
}
