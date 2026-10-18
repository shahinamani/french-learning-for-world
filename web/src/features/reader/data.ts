import type { ReadingText } from './types';

export type ReadingFailure = 'offline' | 'error';

/** Content is not learner data, so one shared fetch is safe. Failure is not cached. */
let cache: Promise<ReadingText[]> | null = null;

export function loadReading(): Promise<ReadingText[]> {
  if (!cache) {
    cache = fetch('./content/reading.json')
      .then((r) => { if (!r.ok) throw new Error(`reading.json ${r.status}`); return r.json(); })
      .then((d: { texts?: ReadingText[] }) => {
        if (!Array.isArray(d.texts)) throw new Error('reading.json has no texts');
        return d.texts;
      })
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** A failed fetch while the browser says it is offline is the OFFLINE state, not a broken one. */
export const failureKind = (): ReadingFailure =>
  typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error';
