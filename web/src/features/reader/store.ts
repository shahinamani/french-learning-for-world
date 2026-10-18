/**
 * What the Reader reads and writes, in one place.
 *
 * Saved items and reading positions are the shared stores in `lib/db.ts`
 * (`saved`, `readingPositions`; contract section 3), so a saved word is in the
 * same database as the learner's reviews, is exported with them, and is erased
 * with them. This file only gives them the names the Reader's components use.
 *
 * The result of a text's comprehension questions is the `readerResults` store
 * in the same database (schema version 3), so `eraseUser()` removes it and the
 * export carries it. It holds a score and a time, never a word or a sentence.
 */
import {
  saveItem, unsaveItem, allSaved, putReadingPosition, getReadingPosition,
  putReaderResult, readerResultsForUser,
} from '../../lib/db';
import type { ReaderResult } from '../../lib/types';
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

/* Results ---------------------------------------------------------------- */

/** Held in the shared `flw` database (store `readerResults`, keyed
 *  [userId, itemId]) so it is exported and erased with everything else. */
export type { ReaderResult };

export async function putResult(r: ReaderResult): Promise<void> {
  await putReaderResult(r);
}
export async function resultsForUser(userId: string): Promise<ReaderResult[]> {
  return readerResultsForUser(userId);
}
