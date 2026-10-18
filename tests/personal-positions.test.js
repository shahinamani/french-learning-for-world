/**
 * Reading position, playback position and notes: write, read back, overwrite,
 * read back. And the export file carries all of it, and an older export file
 * (no personal data) still imports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Database } from './idb-model.mjs';
import { upgradeSchema, DB_VERSION, readingRow, playbackRow, noteRow } from '../web/src/lib/personal-store.ts';
import { exportRows, parseExport, EXPORT_FORMAT } from '../web/src/lib/export-format.ts';

const fresh = () => new Database().open(DB_VERSION, upgradeSchema);

test('reading position round-trips and an overwrite replaces it', () => {
  const s = fresh().store('readingPositions');
  s.put(readingRow('u1', 'text.a2.gare', 3, 100));
  assert.deepEqual(s.get(['u1', 'text.a2.gare']), { userId: 'u1', itemId: 'text.a2.gare', paragraph: 3, updatedAt: 100 });
  s.put(readingRow('u1', 'text.a2.gare', 7, 200));
  assert.equal(s.count, 1);
  assert.equal(s.get(['u1', 'text.a2.gare']).paragraph, 7);
  assert.equal(s.get(['u1', 'text.a2.gare']).updatedAt, 200);
});

test('playback position round-trips, keeps fractions, and an overwrite replaces it', () => {
  const s = fresh().store('playbackPositions');
  s.put(playbackRow('u1', 'audio.news.12', 41.5, 100));
  assert.equal(s.get(['u1', 'audio.news.12']).seconds, 41.5);
  s.put(playbackRow('u1', 'audio.news.12', 0, 200));
  assert.equal(s.count, 1);
  assert.equal(s.get(['u1', 'audio.news.12']).seconds, 0, 'zero is a position, not "none"');
});

test('a note round-trips, an overwrite replaces it, an emptied note is still a row', () => {
  const s = fresh().store('notes');
  s.put(noteRow('u1', 'word.prendre', 'se prend avec le train', 100));
  assert.equal(s.get(['u1', 'word.prendre']).text, 'se prend avec le train');
  s.put(noteRow('u1', 'word.prendre', '', 200));
  assert.equal(s.count, 1);
  assert.equal(s.get(['u1', 'word.prendre']).text, '');
});

test('positions are per learner: the same item for another user is a different row', () => {
  const s = fresh().store('readingPositions');
  s.put(readingRow('u1', 'text.a2.gare', 3, 1));
  s.put(readingRow('u2', 'text.a2.gare', 9, 1));
  assert.equal(s.get(['u1', 'text.a2.gare']).paragraph, 3);
  assert.equal(s.get(['u2', 'text.a2.gare']).paragraph, 9);
  assert.equal(s.get(['u3', 'text.a2.gare']), undefined, 'a learner who never read it gets nothing');
});

test('nonsense positions are refused rather than stored', () => {
  assert.throws(() => readingRow('u1', 'x', -1, 1), /paragraph/);
  assert.throws(() => readingRow('u1', 'x', 1.5, 1), /paragraph/);
  assert.throws(() => playbackRow('u1', 'x', -3, 1), /seconds/);
  assert.throws(() => playbackRow('u1', 'x', NaN, 1), /seconds/);
  assert.throws(() => noteRow('', 'x', 't', 1), /without an id/);
});

// ── export / import ───────────────────────────────────────────────────────

const personal = {
  saved: [{ userId: 'local-1', itemId: 'word.prendre', savedAt: 5,
            context: { sentence: 'Elle a pris le train.', fromId: 'text.a2.gare' } }],
  reading: [{ userId: 'local-1', itemId: 'text.a2.gare', paragraph: 4, updatedAt: 6 }],
  playback: [{ userId: 'local-1', itemId: 'audio.news.12', seconds: 41.5, updatedAt: 7 }],
  notes: [{ userId: 'local-1', itemId: 'word.prendre', text: 'avec le train', updatedAt: 8 }],
};

test('export carries saved items with their context, positions and notes, without a user id', () => {
  const file = exportRows([], [], personal);
  assert.ok(!file.includes('local-1'), 'the local profile id leaked into the file');
  const back = parseExport(file).personal;
  assert.deepEqual(back.saved, [{ itemId: 'word.prendre', savedAt: 5,
    context: { sentence: 'Elle a pris le train.', fromId: 'text.a2.gare' } }]);
  assert.deepEqual(back.reading, [{ itemId: 'text.a2.gare', paragraph: 4, updatedAt: 6 }]);
  assert.deepEqual(back.playback, [{ itemId: 'audio.news.12', seconds: 41.5, updatedAt: 7 }]);
  assert.deepEqual(back.notes, [{ itemId: 'word.prendre', text: 'avec le train', updatedAt: 8 }]);
});

test('an export from before these stores existed (version 2) still imports, with nothing personal', () => {
  const v2 = JSON.stringify({ format: EXPORT_FORMAT, version: 2, exportedAt: 'x',
    rows: [{ id: 'r1', cardKey: 'v:etre', reviewedAt: 1, grade: 3, conceptIds: [] }],
    cards: [{ cardKey: 'v:etre', dueAt: 2 }] });
  const r = parseExport(v2);
  assert.equal(r.rows.length, 1);
  assert.equal(r.cards.length, 1);
  assert.deepEqual(r.personal, { saved: [], reading: [], playback: [], notes: [], readerResults: [] });
});

test('malformed personal rows are dropped, good ones beside them kept', () => {
  const file = JSON.stringify({ format: EXPORT_FORMAT, version: 3, exportedAt: 'x', rows: [], cards: [],
    saved: [{ itemId: 'ok', savedAt: 1 }, { itemId: '', savedAt: 1 }, { itemId: 'x', savedAt: '1' }, null],
    reading: [{ itemId: 'a', paragraph: -2, updatedAt: 1 }, { itemId: 'b', paragraph: 2, updatedAt: 1 }],
    playback: [{ itemId: 'a', seconds: 'soon', updatedAt: 1 }],
    notes: [{ itemId: 'a', text: 5, updatedAt: 1 }, { itemId: 'b', text: 'ok', updatedAt: 1 }] });
  const p = parseExport(file).personal;
  assert.deepEqual(p.saved.map((r) => r.itemId), ['ok']);
  assert.deepEqual(p.reading.map((r) => r.itemId), ['b']);
  assert.deepEqual(p.playback, []);
  assert.deepEqual(p.notes.map((r) => r.itemId), ['b']);
});

test('the Reader\'s score lives in the shared database, is exported and is read back', () => {
  const s = fresh().store('readerResults');
  s.put({ userId: 'u1', itemId: 'text.a2.gare', correct: 3, total: 4, updatedAt: 9 });
  s.put({ userId: 'u1', itemId: 'text.a2.gare', correct: 4, total: 4, updatedAt: 10 });
  assert.equal(s.count, 1, 'keyed [userId, itemId]: a second write is an overwrite');
  const file = exportRows([], [], { readerResults: [s.get(['u1', 'text.a2.gare'])] });
  assert.ok(!file.includes('"u1"'), 'the local profile id is not exported');
  assert.deepEqual(parseExport(file).personal.readerResults,
    [{ itemId: 'text.a2.gare', correct: 4, total: 4, updatedAt: 10 }]);
});

test('a malformed reader result is dropped, not repaired', () => {
  const file = JSON.stringify({ format: EXPORT_FORMAT, version: 4, exportedAt: 'x', rows: [], cards: [],
    readerResults: [{ itemId: 'a', correct: 5, total: 4, updatedAt: 1 }, { itemId: 'b', correct: '2', total: 4, updatedAt: 1 },
                    { itemId: 'c', correct: 2, total: 4, updatedAt: 1 }] });
  assert.deepEqual(parseExport(file).personal.readerResults.map((r) => r.itemId), ['c']);
});
