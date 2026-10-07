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
import type { ReviewRow, CardState } from './types';
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
}

let dbPromise: Promise<IDBPDatabase<FlwDB>> | null = null;

// A connection is not learner data, so caching it holds nothing that could
// leak between users. Every call below still takes a userId.
function db() {
  if (!dbPromise) {
    dbPromise = openDB<FlwDB>('flw', 1, {
      upgrade(d) {
        const reviews = d.createObjectStore('reviews', { keyPath: 'id' });
        reviews.createIndex('by-user-time', ['userId', 'reviewedAt']);
        reviews.createIndex('by-user-card', ['userId', 'cardKey']);
        reviews.createIndex('by-user-session', ['userId', 'sessionId']);
        const cards = d.createObjectStore('cards', { keyPath: ['userId', 'cardKey'] });
        cards.createIndex('by-user-due', ['userId', 'dueAt']);
      },
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
  data: { rows: Omit<ReviewRow, 'userId'>[]; cards: (CardState & { cardKey: string })[] },
): Promise<{ rows: number; rowsSkipped: number; cards: number }> {
  if (!userId) throw new Error('importForUser without a user id');
  const d = await db();
  const tx = d.transaction(['reviews', 'cards'], 'readwrite');
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
  if (added || written) markStarted();
  return { rows: added, rowsSkipped: skipped, cards: written };
}

/** Erases one learner and nothing else. */
export async function eraseUser(userId: string) {
  if (!userId) throw new Error('eraseUser without a user id');
  const d = await db();
  const tx = d.transaction(['reviews', 'cards'], 'readwrite');
  const range = IDBKeyRange.bound([userId, -Infinity], [userId, Infinity]);
  let rc = await tx.objectStore('reviews').index('by-user-time').openCursor(range);
  while (rc) { await rc.delete(); rc = await rc.continue(); }
  let cc = await tx.objectStore('cards').index('by-user-due').openCursor(range);
  while (cc) { await cc.delete(); cc = await cc.continue(); }
  await tx.done;
  // Somebody who erased their work is a stranger again, and that is not a
  // euphemism: there is nothing on this device to show them a dashboard about.
  clearStarted();
}
