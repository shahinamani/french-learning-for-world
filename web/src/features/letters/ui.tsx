import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { Icon } from '../../components/Icon';
import { pick } from '../../lib/exams';
import { fr as frText } from '../../lib/typography';
import { loadLetters, failureKind } from './data';
import type { L10n, LettersFile } from './types';

export type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; data: LettersFile }
  | { state: 'offline' }
  | { state: 'error' };

/** The letters content, and the honest reason when there is none. */
export function useLetters(): [Loaded, () => void] {
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    loadLetters()
      .then((d) => { if (live) setData({ state: 'ready', data: d }); })
      .catch(() => { if (live) setData({ state: failureKind() }); });
    return () => { live = false; };
  }, [tick]);
  // Coming back online is a reason to try again without asking.
  useEffect(() => {
    if (data.state !== 'offline') return;
    const on = () => setTick((n) => n + 1);
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [data.state]);
  return [data, () => { setData({ state: 'loading' }); setTick((n) => n + 1); }];
}

/** Loading, offline and error, each with its way forward. Null when ready. */
export function NotReady({ loaded, retry }: { loaded: Loaded; retry: () => void }) {
  const { t } = useApp();
  if (loaded.state === 'ready') return null;
  if (loaded.state === 'loading') {
    return (
      <div className="lw" aria-busy="true" data-testid="lw-loading">
        <p className="lw-note" role="status">{t('lwLoading')}</p>
        <div className="skeleton skeleton--title" /><div className="skeleton skeleton--text" />
      </div>
    );
  }
  const off = loaded.state === 'offline';
  return (
    <div className="lw">
      <LettersState kind={loaded.state} title={t(off ? 'lwOfflineTitle' : 'lwErrorTitle')} body={t(off ? 'lwOfflineBody' : 'lwErrorBody')}>
        <button type="button" className="btn btn--primary" onClick={retry} data-testid="lw-retry">{t('lwRetry')}</button>
      </LettersState>
    </div>
  );
}

export function LettersState({ kind, title, body, children }:
  { kind: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="lw-state" data-testid={`lw-state-${kind}`} role={kind === 'error' || kind === 'offline' ? 'alert' : 'status'}>
      <Icon name={kind === 'notfound' ? 'info' : 'alert'} size={32} />
      <h2>{title}</h2>
      {body && <p dir="auto">{body}</p>}
      {children}
    </div>
  );
}

export function NotFoundLetter() {
  const { t } = useApp();
  return (
    <div className="lw">
      <LettersState kind="notfound" title={t('lwNotFoundTitle')} body={t('lwNotFoundBody')}>
        <Link className="btn btn--primary" to="/app/writing">{t('lwBackHome')}</Link>
      </LettersState>
    </div>
  );
}

/** A field in the learner's interface language, falling back as `pick` does. */
export function useText() {
  const { settings } = useApp();
  return (f: L10n | undefined) => pick(f, settings.ui);
}

/**
 * French spacing and apostrophes, without grouping digits. lib/typography's
 * fr() writes 2026 as « 2 026 »; in a letter every long number is a year, a
 * postcode or an order number, and none of those is grouped.
 */
export const letterFr = (s: string) => frText(s).replace(/(\d)\u00A0(?=\d{3}(?!\d))/g, '$1');

/** French, with French spacing and apostrophes, marked as French for screen readers. */
export function Fr({ children, as: As = 'span', className }: { children: string; as?: 'span' | 'p' | 'strong'; className?: string }) {
  return <As lang="fr" dir="ltr" className={className}>{letterFr(children)}</As>;
}

/** The learner's language, unless it is French: then the French is enough. */
export function Gloss({ field, className = 'lw-gloss' }: { field: L10n; className?: string }) {
  const text = useText();
  const { settings } = useApp();
  if (settings.ui === 'fr') return null;
  const g = text(field);
  if (!g.text || g.locale === 'fr') return null;
  return <span className={className} lang={g.locale} dir="auto">{g.text}</span>;
}
