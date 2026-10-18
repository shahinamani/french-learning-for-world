/**
 * Moving the database from version 1 to version 2 must not lose a single
 * review or card state. A migration that silently dropped a store would
 * destroy a learner's spaced-repetition history, which cannot be recovered
 * unless they exported it.
 *
 * The version-1 schema below is written out BY HAND, copied from what db.ts
 * created before this change (git: e0af679). It is not produced by the new
 * code, so a mistake in the new code cannot make the seed agree with it.
 *
 * Model of IndexedDB, not IndexedDB (tests/idb-model.mjs). The same proof in
 * a real browser, on a real v1 database, is the "migration" section of
 * web/e2e/walk.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Database } from './idb-model.mjs';
import { upgradeSchema, DB_VERSION } from '../web/src/lib/personal-store.ts';

function v1Upgrade(d) {
  const reviews = d.createObjectStore('reviews', { keyPath: 'id' });
  reviews.createIndex('by-user-time', ['userId', 'reviewedAt']);
  reviews.createIndex('by-user-card', ['userId', 'cardKey']);
  reviews.createIndex('by-user-session', ['userId', 'sessionId']);
  const cards = d.createObjectStore('cards', { keyPath: ['userId', 'cardKey'] });
  cards.createIndex('by-user-due', ['userId', 'dueAt']);
}

/** Two learners with real-shaped history: 120 reviews over 40 cards each. */
function seededV1() {
  const db = new Database().open(1, v1Upgrade);
  const reviews = [], cards = [];
  for (const userId of ['u-ines', 'u-karim']) {
    for (let c = 0; c < 40; c++) {
      const cardKey = `verb:${c}`;
      cards.push({ userId, cardKey, dueAt: 1_760_000_000_000 + c * 86_400_000,
                   stability: 2.5 + c / 10, difficulty: 5, reps: 3, lapses: c % 4, state: 'review',
                   lastReviewedAt: 1_759_000_000_000 + c });
      for (let k = 0; k < 3; k++) {
        reviews.push({ id: `${userId}-${c}-${k}`, userId, cardKey, sessionId: `s${k}`,
                       reviewedAt: 1_758_000_000_000 + c * 1000 + k, grade: 1 + ((c + k) % 4),
                       conceptIds: ['c.passe-compose', `c.v${c % 5}`] });
      }
    }
  }
  reviews.forEach((r) => db.store('reviews').add(r));
  cards.forEach((r) => db.store('cards').put(r));
  return { db, reviews, cards };
}

test('the seed is real: it has history in it', () => {
  const { db } = seededV1();
  assert.equal(db.store('reviews').count, 240);
  assert.equal(db.store('cards').count, 80);
});

test('opening a v1 database at the new version keeps every review row, byte for byte', () => {
  const { db, reviews } = seededV1();
  db.open(DB_VERSION, upgradeSchema);
  assert.equal(db.version, DB_VERSION);
  assert.equal(db.store('reviews').count, reviews.length);
  for (const r of reviews) assert.deepEqual(db.store('reviews').get(r.id), r);
});

test('opening a v1 database at the new version keeps every card state, byte for byte', () => {
  const { db, cards } = seededV1();
  db.open(DB_VERSION, upgradeSchema);
  assert.equal(db.store('cards').count, cards.length);
  for (const c of cards) assert.deepEqual(db.store('cards').get([c.userId, c.cardKey]), c);
});

test('the v1 indexes survive with the same key paths', () => {
  const { db } = seededV1();
  db.open(DB_VERSION, upgradeSchema);
  assert.deepEqual(db.store('reviews').indexes, {
    'by-user-time': ['userId', 'reviewedAt'], 'by-user-card': ['userId', 'cardKey'],
    'by-user-session': ['userId', 'sessionId'],
  });
  assert.deepEqual(db.store('cards').indexes, { 'by-user-due': ['userId', 'dueAt'] });
  assert.equal(db.store('reviews').keyPath, 'id');
  assert.deepEqual(db.store('cards').keyPath, ['userId', 'cardKey']);
});

test('the upgrade deletes nothing and re-creates nothing that exists', () => {
  const { db } = seededV1();
  const before = { reviews: db.store('reviews'), cards: db.store('cards') };
  db.open(DB_VERSION, upgradeSchema);
  assert.deepEqual(db.deleted, [], 'deleteObjectStore was called');
  assert.equal(db.store('reviews'), before.reviews, 'reviews store object was replaced');
  assert.equal(db.store('cards'), before.cards, 'cards store object was replaced');
});

test('the four new stores exist after the upgrade and start empty', () => {
  const { db } = seededV1();
  db.open(DB_VERSION, upgradeSchema);
  for (const n of ['saved', 'readingPositions', 'playbackPositions', 'notes']) {
    assert.ok(db.store(n), n);
    assert.equal(db.store(n).count, 0, n);
  }
});

test('a learner can still be reviewed after the upgrade: new rows land beside old ones', () => {
  const { db, reviews } = seededV1();
  db.open(DB_VERSION, upgradeSchema);
  db.store('reviews').add({ id: 'new-1', userId: 'u-ines', cardKey: 'verb:0', sessionId: 's9',
                            reviewedAt: 1_770_000_000_000, grade: 3, conceptIds: [] });
  assert.equal(db.store('reviews').count, reviews.length + 1);
});

test('opening at the new version twice is harmless', () => {
  const { db, reviews } = seededV1();
  db.open(DB_VERSION, upgradeSchema);
  db.open(DB_VERSION, upgradeSchema);
  assert.equal(db.store('reviews').count, reviews.length);
});

test('a brand-new database gets all seven stores', () => {
  const db = new Database().open(DB_VERSION, upgradeSchema);
  assert.deepEqual([...db.stores.keys()].sort(),
    ['cards', 'notes', 'playbackPositions', 'readerResults', 'readingPositions', 'reviews', 'saved']);
});

test('the shipped code opens the database through upgradeSchema, at DB_VERSION, under the old name', () => {
  const src = readFileSync(new URL('../web/src/lib/db.ts', import.meta.url), 'utf8');
  assert.match(src, /openDB<FlwDB>\(DB_NAME, DB_VERSION/);
  assert.match(src, /upgradeSchema\(/);
  const schema = readFileSync(new URL('../web/src/lib/personal-store.ts', import.meta.url), 'utf8');
  assert.match(schema, /DB_NAME = 'flw'/);
  assert.equal(DB_VERSION, 3);
  // The upgrade is typed so it cannot reach these; this keeps it that way.
  assert.doesNotMatch(schema.replace(/\/\*[\s\S]*?\*\//g, ''), /deleteObjectStore|deleteIndex|\.clear\(/);
});
