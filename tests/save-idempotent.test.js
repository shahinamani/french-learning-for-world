/**
 * Saving is idempotent: pressing save twice leaves one row, and saving again
 * with a different sentence updates the row instead of adding a second.
 * (CONTRACTS-v0.2 section 3, blueprint section 18.)
 *
 * Runs the real `upgradeSchema` and the real `saveRow` against a model of
 * IndexedDB's keyPath semantics (tests/idb-model.mjs). The real-browser version
 * of the same check is in web/e2e/walk.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from './idb-model.mjs';
import { upgradeSchema, DB_VERSION, saveRow } from '../web/src/lib/personal-store.ts';

const fresh = () => new Database().open(DB_VERSION, upgradeSchema);
// What db.ts saveItem does: read the row under the key, build the row, put it.
const save = (db, userId, itemId, now, context) => {
  const s = db.store('saved');
  const row = saveRow(s.get([userId, itemId]), userId, itemId, now, context);
  s.put(row);
  return row;
};

const ctx1 = { sentence: 'Elle a pris le train de huit heures.', fromId: 'text.a2.gare' };
const ctx2 = { sentence: 'Nous avons pris le train ensemble.', fromId: 'news.2026-10-12.sncf' };

test('saving the same item twice leaves exactly one row', () => {
  const db = fresh();
  save(db, 'u1', 'word.prendre', 1000, ctx1);
  save(db, 'u1', 'word.prendre', 2000, ctx1);
  assert.equal(db.store('saved').count, 1);
});

test('the second save keeps the first savedAt', () => {
  const db = fresh();
  save(db, 'u1', 'word.prendre', 1000, ctx1);
  save(db, 'u1', 'word.prendre', 2000, ctx1);
  assert.equal(db.store('saved').get(['u1', 'word.prendre']).savedAt, 1000);
});

test('saving with a different context updates the row, it does not add one', () => {
  const db = fresh();
  save(db, 'u1', 'word.prendre', 1000, ctx1);
  save(db, 'u1', 'word.prendre', 2000, ctx2);
  const rows = db.store('saved').getAll();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].context, ctx2);
});

test('the source sentence and the source id travel with the word', () => {
  const db = fresh();
  save(db, 'u1', 'word.prendre', 1000, ctx1);
  const row = db.store('saved').get(['u1', 'word.prendre']);
  assert.equal(row.context.sentence, ctx1.sentence);
  assert.equal(row.context.fromId, ctx1.fromId);
});

test('a later save with no context does not erase the context already stored', () => {
  const db = fresh();
  save(db, 'u1', 'word.prendre', 1000, ctx1);
  save(db, 'u1', 'word.prendre', 2000);
  assert.deepEqual(db.store('saved').get(['u1', 'word.prendre']).context, ctx1);
});

test('two learners saving the same item get two rows, each their own', () => {
  const db = fresh();
  save(db, 'u1', 'word.prendre', 1000, ctx1);
  save(db, 'u2', 'word.prendre', 1500, ctx2);
  assert.equal(db.store('saved').count, 2);
  assert.deepEqual(db.store('saved').get(['u1', 'word.prendre']).context, ctx1);
  assert.deepEqual(db.store('saved').get(['u2', 'word.prendre']).context, ctx2);
});

test('saving without a user id or an item id is refused', () => {
  assert.throws(() => saveRow(undefined, '', 'word.prendre', 1), /without an id/);
  assert.throws(() => saveRow(undefined, 'u1', '', 1), /without an id/);
});

test('every personal store is keyed [userId, itemId] and every index starts with userId', () => {
  const db = fresh();
  for (const name of ['saved', 'readingPositions', 'playbackPositions', 'notes']) {
    const s = db.store(name);
    assert.deepEqual(s.keyPath, ['userId', 'itemId'], `${name} key`);
    for (const [idx, kp] of Object.entries(s.indexes)) assert.equal(kp[0], 'userId', `${name}.${idx}`);
  }
});
