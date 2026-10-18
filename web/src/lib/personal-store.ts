/**
 * The schema and the write rules of the personal stores, with no dependency on
 * `idb` or a browser, so the unit suite (which runs with web/node_modules
 * hidden) can execute them.
 *
 * `db.ts` calls `upgradeSchema` from IndexedDB's `upgrade` callback and builds
 * its rows with the `*Row` functions.
 */

export const DB_NAME = 'flw';
/** 1: reviews + cards.  2: saved, readingPositions, playbackPositions, notes.
 *  3: readerResults (the score of a text's comprehension questions). */
export const DB_VERSION = 3;

/** The slice of IDBDatabase / IDBObjectStore that the upgrade uses. Note what
 *  is NOT here: no deleteObjectStore, no deleteIndex. An upgrade that cannot
 *  call them cannot drop a learner's history. */
export interface UpgradeStore { createIndex(name: string, keyPath: string[]): unknown }
export interface UpgradeDb {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string, opts: { keyPath: string | string[] }): UpgradeStore;
}

/** Each store is created only if it is missing, so running the upgrade over an
 *  existing database leaves what is there untouched. */
export function upgradeSchema(d: UpgradeDb, oldVersion: number) {
  if (oldVersion < 1) {
    const reviews = d.createObjectStore('reviews', { keyPath: 'id' });
    reviews.createIndex('by-user-time', ['userId', 'reviewedAt']);
    reviews.createIndex('by-user-card', ['userId', 'cardKey']);
    reviews.createIndex('by-user-session', ['userId', 'sessionId']);
    const cards = d.createObjectStore('cards', { keyPath: ['userId', 'cardKey'] });
    cards.createIndex('by-user-due', ['userId', 'dueAt']);
  }
  if (oldVersion < 2) {
    const make = (name: string, index: string, field: string) => {
      if (d.objectStoreNames.contains(name)) return;
      d.createObjectStore(name, { keyPath: ['userId', 'itemId'] })
        .createIndex(index, ['userId', field]);
    };
    make('saved', 'by-user-time', 'savedAt');
    make('readingPositions', 'by-user-updated', 'updatedAt');
    make('playbackPositions', 'by-user-updated', 'updatedAt');
    make('notes', 'by-user-updated', 'updatedAt');
  }
  if (oldVersion < 3) {
    if (!d.objectStoreNames.contains('readerResults')) {
      d.createObjectStore('readerResults', { keyPath: ['userId', 'itemId'] })
        .createIndex('by-user-updated', ['userId', 'updatedAt']);
    }
  }
}

const need = (v: string, what: string) => { if (!v) throw new Error(`${what} without an id`); };

type Ctx = { sentence: string; fromId: string };

/** The row to write for a save, given whatever is already stored under the same
 *  [userId, itemId]. The first savedAt stands; a new context replaces the old
 *  one; a save with no context keeps the one already there. */
export function saveRow(
  existing: { savedAt: number; context?: Ctx } | undefined,
  userId: string, itemId: string, now: number, context?: Ctx,
) {
  need(userId, 'save'); need(itemId, 'save');
  const row: { userId: string; itemId: string; savedAt: number; context?: Ctx } =
    { userId, itemId, savedAt: existing?.savedAt ?? now };
  const c = context ?? existing?.context;
  if (c) row.context = { sentence: c.sentence, fromId: c.fromId };
  return row;
}

export function readingRow(userId: string, itemId: string, paragraph: number, now: number) {
  need(userId, 'reading position'); need(itemId, 'reading position');
  if (!Number.isInteger(paragraph) || paragraph < 0) throw new Error('paragraph must be a whole number >= 0');
  return { userId, itemId, paragraph, updatedAt: now };
}

export function playbackRow(userId: string, itemId: string, seconds: number, now: number) {
  need(userId, 'playback position'); need(itemId, 'playback position');
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('seconds must be a number >= 0');
  return { userId, itemId, seconds, updatedAt: now };
}

export function noteRow(userId: string, itemId: string, text: string, now: number) {
  need(userId, 'note'); need(itemId, 'note');
  return { userId, itemId, text, updatedAt: now };
}
