/**
 * A section that is planned but not built. It says so, names what IS built,
 * and offers somewhere real to go. A route that renders nothing, or a zero
 * with no explanation, is the dead end the brief forbids — this is the honest
 * alternative, and it is deliberately not disguised as content.
 */
import { Link } from 'react-router';
import { useApp } from '../app-context';
import { Icon } from '../components/Icon';

/**
 * A section that is planned but not built. It names itself, says plainly what
 * is missing and why, and offers somewhere real to go. A stub that pretends is
 * worse than one that admits.
 */
export function Stub({ title, status }: { title: string; status?: string }) {
  const { t } = useApp();
  return (
    <div className="page">
      <div className="empty" data-testid="stub">
        <div className="empty__icon"><Icon name="book" size={34} /></div>
        <p className="empty__title">{title}</p>
        <p className="empty__body"><strong>{t('notBuilt')}.</strong>{' '}
          {status ?? t('notBuiltBody')}</p>
        <div className="row gap-2 wrap" style={{ justifyContent: 'center', marginBlockStart: 'var(--space-5)' }}>
          <Link className="btn btn--primary" to="/practise/review">{t('practise')}</Link>
          <Link className="btn" to="/search">{t('search')}</Link>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  const { t } = useApp();
  return (
    <div className="page">
      <div className="empty" data-testid="not-found">
        <div className="empty__icon"><Icon name="alert" size={34} /></div>
        <p className="empty__title">404</p>
        <p className="empty__body">{t('notBuiltBody')}</p>
        <Link className="btn btn--primary" to="/learn">{t('learn')}</Link>
      </div>
    </div>
  );
}
