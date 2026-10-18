/** Loading the lessons, and the honest page-level states around it. */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { loadLessons, type LessonData } from './lessons';

export type LessonsState =
  | { status: 'loading' }
  | { status: 'error' | 'offline' }
  | { status: 'ready'; data: LessonData };

export function useLessons(): [LessonsState, () => void] {
  const [state, setState] = useState<LessonsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    loadLessons()
      .then((data) => { if (live) setState({ status: 'ready', data }); })
      .catch(() => {
        if (!live) return;
        // `navigator.onLine === false` is reliable in one direction only: it is
        // false when the device KNOWS it has no network. True proves nothing,
        // so a failure while "online" stays a plain error.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setState({ status: offline ? 'offline' : 'error' });
      });
    return () => { live = false; };
  }, [attempt]);

  return [state, useCallback(() => setAttempt((n) => n + 1), [])];
}

type Action = { label: string; onClick?: () => void; to?: string; testId: string };

/** One block for the non-ready states, each with a way forward. */
export function PageState(
  { kind, title, body, primary, secondary }:
  { kind: 'loading' | 'error' | 'offline' | 'empty'; title: ReactNode; body?: ReactNode;
    primary?: Action; secondary?: Action },
) {
  const act = (a: Action, cls: string) => a.to
    ? <Link className={`btn ${cls}`} to={a.to} data-testid={a.testId}>{a.label}</Link>
    : <button type="button" className={`btn ${cls}`} onClick={a.onClick} data-testid={a.testId}>{a.label}</button>;
  return (
    <div className="card grl-state" data-testid={`grl-${kind}`}
         role={kind === 'error' || kind === 'offline' ? 'alert' : 'status'}
         aria-busy={kind === 'loading' ? true : undefined}>
      {kind === 'loading' && <div className="skeleton skeleton--text" aria-hidden="true" />}
      <p><strong>{title}</strong></p>
      {body && <p className="muted">{body}</p>}
      {(primary || secondary) && (
        <div className="ex-actions">
          {primary && act(primary, 'btn--primary')}
          {secondary && act(secondary, 'btn--ghost')}
        </div>
      )}
    </div>
  );
}

/** Loading / error / offline for either page. Returns the node to show, or null when ready. */
export function useLessonsGate(state: LessonsState, retry: () => void): ReactNode | null {
  const { t } = useApp();
  if (state.status === 'ready') return null;
  if (state.status === 'loading') return <PageState kind="loading" title={t('grlLoading')} />;
  if (state.status === 'offline') {
    return <PageState kind="offline" title={t('grlOffline')} body={t('grlOfflineHelp')}
                      primary={{ label: t('grlRetryLoad'), onClick: retry, testId: 'grl-retry' }} />;
  }
  return <PageState kind="error" title={t('grlLoadError')} body={t('grlLoadErrorHelp')}
                    primary={{ label: t('grlRetryLoad'), onClick: retry, testId: 'grl-retry' }} />;
}
