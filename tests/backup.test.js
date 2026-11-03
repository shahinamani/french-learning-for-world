/**
 * When the "save a copy of your progress" reminder appears (web/src/lib/backup-rules.ts),
 * added 2026-11-03 with option 1 of the owner's storage question. The rules are
 * read from the module itself, not restated here, so the test follows them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// A memory localStorage, installed before the module loads.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const B = await import('../web/src/lib/backup-rules.ts');
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const U = 'learner-1';

test('no reminder before the learner has something worth saving', () => {
  store.clear();
  assert.equal(B.backupDue(U, B.BACKUP_AFTER_CARDS - 1, NOW), false);
  assert.equal(B.backupDue(U, B.BACKUP_AFTER_CARDS, NOW), true, 'never saved, enough history');
});

test('a recent copy silences it, an old one does not', () => {
  store.clear();
  store.set(`flw:u:${U}:lastBackup`, String(NOW - (B.BACKUP_EVERY_DAYS - 1) * DAY));
  assert.equal(B.backupDue(U, 100, NOW), false);
  store.set(`flw:u:${U}:lastBackup`, String(NOW - (B.BACKUP_EVERY_DAYS + 1) * DAY));
  assert.equal(B.backupDue(U, 100, NOW), true);
});

test('"later" waits the snooze period, then the reminder comes back', () => {
  store.clear();
  B.snoozeBackup(U, NOW);
  assert.equal(B.backupDue(U, 100, NOW + (B.SNOOZE_DAYS - 1) * DAY), false);
  assert.equal(B.backupDue(U, 100, NOW + (B.SNOOZE_DAYS + 1) * DAY), true);
});

test('one learner\'s backup does not silence another\'s', () => {
  store.clear();
  store.set(`flw:u:${U}:lastBackup`, String(NOW));
  assert.equal(B.backupDue('learner-2', 100, NOW), true);
});
