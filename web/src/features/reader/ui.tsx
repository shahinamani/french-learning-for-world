import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { loadReading, failureKind } from './data';
import type { ReadingText } from './types';

/** The breakpoint where the meaning panel stops being a bottom sheet. Mirrors reader.css. */
const WIDE = '(min-width: 56rem)';

export function useWide(): boolean {
  const q = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches;
  const [wide, setWide] = useState(q);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(WIDE);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; texts: ReadingText[] }
  | { state: 'offline' }
  | { state: 'error' };

/** The texts, and the honest reason when there are none. `retry` refetches. */
export function useReadingTexts(): [Loaded, () => void] {
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    setData({ state: 'loading' });
    loadReading()
      .then((texts) => { if (live) setData({ state: 'ready', texts }); })
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
  return [data, () => setTick((n) => n + 1)];
}

/** One of the five states. Every one carries the way forward. */
export function ReaderState({ kind, title, body, children, icon }:
  { kind: string; title: string; body?: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="rd-state" data-testid={`rd-state-${kind}`} role={kind === 'error' || kind === 'offline' ? 'alert' : 'status'}>
      <Icon name={icon ?? 'info'} size={32} />
      <h2>{title}</h2>
      {body && <p dir="auto">{body}</p>}
      {children}
    </div>
  );
}
