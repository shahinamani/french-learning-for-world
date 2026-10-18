/**
 * Local store. IndexedDB, not localStorage: a daily learner writes tens of
 * thousands of review rows over a few years, localStorage is synchronous,
 * string-only and capped near 5 MB.
 *
 * IndexedDB is shared across every tab of an origin, so isolation between
 * learners cannot come from the database — it comes from `userId` being the
 * first element of every key and every index. No query in the application
 * reads a row without naming whose row it is.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ReviewRow, CardState, SavedItem, ReadingPosition, PlaybackPosition, Note, ReaderResult } from './types';
import type { PersonalExport } from './export-format';
import { DB_NAME, DB_VERSION, upgradeSchema, saveRow, readingRow, playbackRow, noteRow } from './personal-store';
// Every function below that WRITES calls markStarted(). It is called here, at
// the four places a record is actually created, rather than when a learner
// presses a button — pressing "Start learning" stores nothing, and somebody who
// browsed a verb table and left has not started.
import { markStarted, clearStarted } from './started';

interface FlwDB extends DBSchema {
  reviews: {
    key: string;
    value: ReviewRow;
    indexes: {
      'by-user-time': [string, number];
      'by-user-card': [string, string];
      'by-user-session': [string, string];
    };
  };
  cards: {
    key: [string, string];   // [userId, cardKey] — the user is part of the key
    value: CardState & { userId: string; cardKey: string };
    indexes: { 'by-user-due': [string, number] };
  };
  // Version 2. Keyed [userId, itemId]: a second write is an overwrite.
  saved: { key: [string, string]; value: SavedItem; indexes: { 'by-user-time': [string, number] } };
  readingPositions: { key: [string, string]; value: ReadingPosition; indexes: { 'by-user-updated': [string, number] } };
  playbackPositions: { key: [string, string]; value: PlaybackPosition; indexes: { 'by-user-updated': [string, number] } };
  notes: { key: [string, string]; value: Note; indexes: { 'by-user-updated': [string, number] } };
  // Version 3. The Reader's comprehension score; same keying, same export, same erase.
  readerResults: { key: [string, string]; value: ReaderResult; indexes: { 'by-user-updated': [string, number] } };
}

let dbPromise: Promise<IDBPDatabase<FlwDB>> | null = null;

// A connection is not learner data, so caching it holds nothing that could
// leak between users. Every call below still takes a userId.
function db() {
  if (!dbPromise) {
    // The schema lives in personal-store.ts so it can be tested without a
    // browser. An upgrade only CREATES missing stores; the reviews and cards
    // written at version 1 are never touched.
    dbPromise = openDB<FlwDB>(DB_NAME, DB_VERSION, {
      upgrade(d, oldVersion) { upgradeSchema(d as never, oldVersion); },
    });
  }
  return dbPromise;
}

export async function putCardState(userId: string, cardKey: string, state: CardState) {
  if (!userId) throw new Error('putCardState without a user id');
  await (await db()).put('cards', { ...state, userId, cardKey });
  markStarted();
}

export async function getCardState(userId: string, cardKey: string) {
  if (!userId) throw new Error('getCardState without a user id');
  return (await db()).get('cards', [userId, cardKey]);
}

export async function allCardStates(userId: string) {
  if (!userId) throw new Error('allCardStates without a user id');
  return (await db()).getAllFromIndex('cards', 'by-user-due',
    IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]));
}

/**
 * Append a review and write the card's new state in ONE transaction. A log
 * that disagrees with the card it describes is worse than no log.
 */
export async function appendReview(row: ReviewRow, nextState: CardState) {
  if (!row.userId) throw new Error('appendReview without a user id');
  const d = await db();
  const tx = d.transaction(['reviews', 'cards'], 'readwrite');
  await Promise.all([
    tx.objectStore('reviews').add(row),
    tx.objectStore('cards').put({ ...nextState, userId: row.userId, cardKey: row.cardKey }),
    tx.done,
  ]);
  markStarted();
}

export async function reviewsForUser(userId: string, limit = 500): Promise<ReviewRow[]> {
  if (!userId) throw new Error('reviewsForUser without a user id');
  const d = await db();
  const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
  const rows: ReviewRow[] = [];
  let cursor = await d.transaction('reviews').store.index('by-user-time').openCursor(range, 'prev');
  while (cursor && rows.length < limit) { rows.push(cursor.value); cursor = await cursor.continue(); }
  return rows;
}

export async function reviewsForCard(userId: string, cardKey: string): Promise<ReviewRow[]> {
  if (!userId) throw new Error('reviewsForCard without a user id');
  return (await db()).getAllFromIndex('reviews', 'by-user-card', [userId, cardKey]);
}

/* ── Saved items, positions, notes ─────────────────────────────────────────
 * Every call names the learner. Writes call markStarted() like the others. */

/** Idempotent: [userId, itemId] is the key, so pressing save twice is one row.
 *  The first savedAt is kept; a later save may add or replace the context. */
export async function saveItem(userId: string, itemId: string,
                               context?: { sentence: string; fromId: string }) {
  if (!userId) throw new Error('saveItem without a user id');
  const d = await db();
  const tx = d.transaction('saved', 'readwrite');
  const existing = await tx.store.get([userId, itemId]);
  const row = saveRow(existing, userId, itemId, Date.now(), context);
  await tx.store.put(row);
  await tx.done;
  markStarted();
  return row;
}
export async function unsaveItem(userId: string, itemId: string) {
  if (!userId) throw new Error('unsaveItem without a user id');
  await (await db()).delete('saved', [userId, itemId]);
}
export async function getSaved(userId: string, itemId: string) {
  if (!userId) throw new Error('getSaved without a user id');
  return (await db()).get('saved', [userId, itemId]);
}
export async function allSaved(userId: string) {
  if (!userId) throw new Error('allSaved without a user id');
  return (await db()).getAllFromIndex('saved', 'by-user-time',
    IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]));
}

export async function putReadingPosition(userId: string, itemId: string, paragraph: number) {
  await (await db()).put('readingPositions', readingRow(userId, itemId, paragraph, Date.now()));
  markStarted();
}
export async function getReadingPosition(userId: string, itemId: string) {
  if (!userId) throw new Error('getReadingPosition without a user id');
  return (await db()).get('readingPositions', [userId, itemId]);
}
export async function putPlaybackPosition(userId: string, itemId: string, seconds: number) {
  await (await db()).put('playbackPositions', playbackRow(userId, itemId, seconds, Date.now()));
  markStarted();
}
export async function getPlaybackPosition(userId: string, itemId: string) {
  if (!userId) throw new Error('getPlaybackPosition without a user id');
  return (await db()).get('playbackPositions', [userId, itemId]);
}
export async function putNote(userId: string, itemId: string, text: string) {
  await (await db()).put('notes', noteRow(userId, itemId, text, Date.now()));
  markStarted();
}
export async function getNote(userId: string, itemId: string) {
  if (!userId) throw new Error('getNote without a user id');
  return (await db()).get('notes', [userId, itemId]);
}

export async function putReaderResult(r: ReaderResult) {
  if (!r.userId) throw new Error('putReaderResult without a user id');
  if (!r.itemId) throw new Error('putReaderResult without an item id');
  await (await db()).put('readerResults', r);
  markStarted();
}
export async function readerResultsForUser(userId: string) {
  if (!userId) throw new Error('readerResultsForUser without a user id');
  const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
  return (await db()).getAllFromIndex('readerResults', 'by-user-updated', range);
}

/** Everything personal beyond reviews and cards, shaped for the export file. */
export async function personalForUser(userId: string) {
  if (!userId) throw new Error('personalForUser without a user id');
  const d = await db();
  const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
  const [saved, reading, playback, notes, readerResults] = await Promise.all([
    d.getAllFromIndex('saved', 'by-user-time', range),
    d.getAllFromIndex('readingPositions', 'by-user-updated', range),
    d.getAllFromIndex('playbackPositions', 'by-user-updated', range),
    d.getAllFromIndex('notes', 'by-user-updated', range),
    d.getAllFromIndex('readerResults', 'by-user-updated', range),
  ]);
  return { saved, reading, playback, notes, readerResults };
}

/**
 * Import a parsed export into THIS profile. The rows arrive without a user id —
 * it is a local profile id and means nothing on another device — so every row
 * is re-keyed to the importing learner.
 *
 * Rows are identified by their own `id` and skipped if already present, so
 * importing the same file twice does not double a learner's history. Card
 * states are taken only when the imported one was reviewed more recently than
 * what is already here, so an import can never move a card backwards.
 *
 * One transaction: a half-applied import is worse than a refused one.
 */
export async function importForUser(
  userId: string,
  data: { rows: Omit<ReviewRow, 'userId'>[]; cards: (CardState & { cardKey: string })[];
          personal?: PersonalExport },
): Promise<{ rows: number; rowsSkipped: number; cards: number }> {
  if (!userId) throw new Error('importForUser without a user id');
  const d = await db();
  const tx = d.transaction(['reviews', 'cards', 'saved', 'readingPositions', 'playbackPositions', 'notes', 'readerResults'], 'readwrite');
  // Personal rows: a saved item is kept if already here (its first savedAt and
  // context stand); positions and notes are taken only when newer, so an
  // import can never move a learner backwards.
  const p = data.personal;
  let personal = 0;
  if (p) {
    for (const s of p.saved) {
      if (await tx.objectStore('saved').get([userId, s.itemId])) continue;
      await tx.objectStore('saved').put({ ...s, userId }); personal++;
    }
    const newer = async <S extends 'readingPositions' | 'playbackPositions' | 'notes' | 'readerResults'>(
      name: S, rows: { itemId: string; updatedAt: number }[]) => {
      const st = tx.objectStore(name);
      for (const r of rows) {
        const have = await st.get([userId, r.itemId]);
        if (have && have.updatedAt >= r.updatedAt) continue;
        await st.put({ ...r, userId } as never); personal++;
      }
    };
    await newer('readingPositions', p.reading);
    await newer('playbackPositions', p.playback);
    await newer('notes', p.notes);
    await newer('readerResults', p.readerResults ?? []);
  }
  const reviews = tx.objectStore('reviews');
  const cards = tx.objectStore('cards');
  let added = 0, skipped = 0, written = 0;

  for (const r of data.rows) {
    const row = { ...r, userId } as ReviewRow;
    if (await reviews.get(row.id)) { skipped++; continue; }
    await reviews.add(row);
    added++;
  }
  for (const c of data.cards) {
    const { cardKey, ...state } = c;
    const existing = await cards.get([userId, cardKey]);
    const incomingSeen = state.lastReviewedAt ?? 0;
    const existingSeen = existing?.lastReviewedAt ?? 0;
    if (existing && existingSeen >= incomingSeen) continue;
    await cards.put({ ...state, userId, cardKey });
    written++;
  }
  await tx.done;
  // An imported history is studying here, even though none of it happened on
  // this device. Without this, somebody restoring six months of work on a new
  // laptop would be greeted by the page that explains what this site is.
  if (added || written || personal) markStarted();
  return { rows: added, rowsSkipped: skipped, cards: written };
}

/** Erases one learner and nothing else. */
export async function eraseUser(userId: string) {
  if (!userId) throw new Error('eraseUser without a user id');
  const d = await db();
  const tx = d.transaction(['reviews', 'cards', 'saved', 'readingPositions', 'playbackPositions', 'notes', 'readerResults'], 'readwrite');
  const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
  for (const [name, index] of [['saved', 'by-user-time'], ['readingPositions', 'by-user-updated'],
                               ['playbackPositions', 'by-user-updated'], ['notes', 'by-user-updated'],
                               ['readerResults', 'by-user-updated']] as const) {
    let c = await tx.objectStore(name).index(index as never).openCursor(range);
    while (c) { await c.delete(); c = await c.continue(); }
  }
  let rc = await tx.objectStore('reviews').index('by-user-time').openCursor(range);
  while (rc) { await rc.delete(); rc = await rc.continue(); }
  let cc = await tx.objectStore('cards').index('by-user-due').openCursor(range);
  while (cc) { await cc.delete(); cc = await cc.continue(); }
  await tx.done;
  // Somebody who erased their work is a stranger again, and that is not a
  // euphemism: there is nothing on this device to show them a dashboard about.
  clearStarted();
}
