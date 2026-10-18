/**
 * What the Reader reads and writes, in one place.
 *
 * Saved items and reading positions are the shared stores in `lib/db.ts`
 * (`saved`, `readingPositions`; contract section 3), so a saved word is in the
 * same database as the learner's reviews, is exported with them, and is erased
 * with them. This file only gives them the names the Reader's components use.
 *
 * ONE thing is still held here: the result of a text's comprehension
 * questions. The contract has no store for it, and `db.ts` is not this stream's
 * file, so it lives in a small database of its own (`flw-reader`), keyed
 * [userId, itemId] like everything else. Consequences, stated rather than
 * hidden: `eraseUser()` in db.ts does not remove it and the learner's export
 * does not include it. `eraseReaderResults` is exported for whoever wires erase.
 * It holds a score and a time, never a word or a sentence.
 */
import { openDB, type IDBPDatabase } from 'idb';
import {
  saveItem, unsaveItem, allSaved, putReadingPosition, getReadingPosition,
} from '../../lib/db';
import type { ReadingPosition, SavedItem } from './types';

/* Saved items ------------------------------------------------------------- */

/** Idempotent: [userId, itemId] is the key, so a second press is an overwrite. */
export async function putSaved(item: SavedItem): Promise<void> {
  await saveItem(item.userId, item.itemId, item.context);
}
export async function deleteSaved(userId: string, itemId: string): Promise<void> {
  await unsaveItem(userId, itemId);
}
export async function savedForUser(userId: string): Promise<SavedItem[]> {
  return allSaved(userId);
}

/* Reading position -------------------------------------------------------- */

/** `paragraph` holds a SENTENCE index: the texts are one paragraph each, so the
 *  paragraph would always be 0 and could not bring anyone back to anywhere. */
export async function putPosition(userId: string, itemId: string, paragraph: number): Promise<void> {
  await putReadingPosition(userId, itemId, paragraph);
}
export async function getPosition(userId: string, itemId: string): Promise<ReadingPosition | undefined> {
  return getReadingPosition(userId, itemId);
}
export async function positionsFor(userId: string, itemIds: string[]): Promise<Map<string, number>> {
  const rows = await Promise.all(itemIds.map((id) => getReadingPosition(userId, id)));
  return new Map(rows.flatMap((r) => (r ? [[r.itemId, r.paragraph] as [string, number]] : [])));
}

/* Results (the one adapter that remains) ---------------------------------- */

export type ReaderResult = {
  userId: string; itemId: string; correct: number; total: number; updatedAt: number;
};

let dbp: Promise<IDBPDatabase> | null = null;
function resultsDb(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB('flw-reader', 1, {
      upgrade(d) { d.createObjectStore('result', { keyPath: ['userId', 'itemId'] }); },
    }).catch((e) => { dbp = null; throw e; });
  }
  return dbp;
}
const userRange = (userId: string) => IDBKeyRange.bound([userId, ''], [userId, '￿']);

export async function putResult(r: ReaderResult): Promise<void> {
  if (!r.userId) throw new Error('putResult without a user id');
  await (await resultsDb()).put('result', r);
}
export async function resultsForUser(userId: string): Promise<ReaderResult[]> {
  if (!userId) throw new Error('resultsForUser without a user id');
  return (await resultsDb()).getAll('result', userRange(userId));
}
export async function eraseReaderResults(userId: string): Promise<void> {
  if (!userId) throw new Error('eraseReaderResults without a user id');
  await (await resultsDb()).delete('result', userRange(userId));
}
