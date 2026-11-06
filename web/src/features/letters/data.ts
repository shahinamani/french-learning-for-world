import type { LettersFile } from './types';

/** Content is not learner data, so one shared fetch is safe. Failure is not cached. */
let cache: Promise<LettersFile> | null = null;

export function loadLetters(): Promise<LettersFile> {
  if (!cache) {
    cache = fetch('./content/letters.json')
      .then((r) => { if (!r.ok) throw new Error(`letters.json ${r.status}`); return r.json(); })
      .then((d: Partial<LettersFile>) => {
        if (!Array.isArray(d.kinds) || !Array.isArray(d.tasks)) throw new Error('letters.json has no kinds or tasks');
        return d as LettersFile;
      })
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** A failed fetch while the browser says it is offline is the OFFLINE state, not a broken one. */
export const failureKind = (): 'offline' | 'error' =>
  typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error';
