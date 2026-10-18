/**
 * The Reader's storage ADAPTER.
 *
 * `web/src/lib/db.ts` does not have the `SavedItem` / `ReadingPosition` stores
 * on `main` yet; another stream owns that file and is adding them. Until they
 * land this file keeps the same two shapes — copied from
 * docs/blueprint/CONTRACTS-v0.2.md section 3, not invented — in its OWN
 * IndexedDB database, so nothing in the existing `flw` schema is touched.
 *
 * To swap in the real stores: re-implement the six functions exported below on
 * top of db.ts and delete the `openDB` block. No caller imports anything else
 * from this file, and every function already takes the userId first.
 *
 * What this does NOT yet do, because it lives outside `flw`: `eraseUser()` in
 * db.ts will not remove these rows, and the learner's export will not include
 * them. `eraseReaderUser` is exported so the owner of that wiring can call it.
 * That gap goes away when the stores move into db.ts.
 *
 * Idempotence (contract section 3): every store is keyed [userId, itemId], so a
 * double press is an overwrite and never a second row.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { ReadingPosition, SavedItem } from './types';

export type ReaderResult = {
  userId: string; itemId: string; correct: number; total: number; updatedAt: number;
};

const NAME = 'flw-reader';
let dbp: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(NAME, 1, {
      upgrade(d) {
        d.createObjectStore('saved', { keyPath: ['userId', 'itemId'] });
        d.createObjectStore('position', { keyPath: ['userId', 'itemId'] });
        d.createObjectStore('result', { keyPath: ['userId', 'itemId'] });
      },
    }).catch((e) => { dbp = null; throw e; });
  }
  return dbp;
}

const need = (userId: string, fn: string) => {
  if (!userId) throw new Error(`${fn} without a user id`);
};
const userRange = (userId: string) => IDBKeyRange.bound([userId, ''], [userId, '￿']);

/* Saved items ------------------------------------------------------------- */

export async function putSaved(item: SavedItem): Promise<void> {
  need(item.userId, 'putSaved');
  await (await db()).put('saved', item);
}
export async function deleteSaved(userId: string, itemId: string): Promise<void> {
  need(userId, 'deleteSaved');
  await (await db()).delete('saved', [userId, itemId]);
}
export async function savedForUser(userId: string): Promise<SavedItem[]> {
  need(userId, 'savedForUser');
  return (await db()).getAll('saved', userRange(userId));
}

/* Reading position and result --------------------------------------------- */

export async function putPosition(p: ReadingPosition): Promise<void> {
  need(p.userId, 'putPosition');
  await (await db()).put('position', p);
}
export async function getPosition(userId: string, itemId: string): Promise<ReadingPosition | undefined> {
  need(userId, 'getPosition');
  return (await db()).get('position', [userId, itemId]);
}
export async function putResult(r: ReaderResult): Promise<void> {
  need(r.userId, 'putResult');
  await (await db()).put('result', r);
}
export async function resultsForUser(userId: string): Promise<ReaderResult[]> {
  need(userId, 'resultsForUser');
  return (await db()).getAll('result', userRange(userId));
}
export async function positionsForUser(userId: string): Promise<ReadingPosition[]> {
  need(userId, 'positionsForUser');
  return (await db()).getAll('position', userRange(userId));
}

/** Delete everything this adapter holds for one profile. */
export async function eraseReaderUser(userId: string): Promise<void> {
  need(userId, 'eraseReaderUser');
  const d = await db();
  const tx = d.transaction(['saved', 'position', 'result'], 'readwrite');
  await Promise.all(['saved', 'position', 'result'].map((s) => tx.objectStore(s).delete(userRange(userId))));
  await tx.done;
}
