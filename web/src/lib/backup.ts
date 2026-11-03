/**
 * Keeping a learner's progress safe without a server (owner, 2026-11-03).
 *
 * Everything lives in this browser. Two things make that safer:
 *
 *  1. Persistent storage. By default a browser may evict a site's data under
 *     storage pressure or, on Safari, after weeks without a visit. Asking for
 *     persistence (navigator.storage.persist) tells it not to. Chrome decides
 *     silently from engagement; Firefox may ask the learner. It is asked once
 *     the learner has something to lose — after a graded card — never on the
 *     first paint.
 *  2. A backup reminder. Export already exists and is the only recovery path
 *     (DATA.md). A learner with real history who has not saved a copy for two
 *     weeks is reminded, with one button; "later" waits a week.
 *
 * Neither sends anything anywhere: the backup is a file the learner downloads.
 */
import { lastKey } from './backup-rules';
export * from './backup-rules';
import { allCardStates, personalForUser, reviewsForUser } from './db';
import { exportRows } from './progress';

/** Download the learner's whole record as one file, and remember when. */
export async function downloadBackup(userId: string): Promise<void> {
  // The card states and the personal stores go with the log: without the
  // states every card arrives due-new, and without the rest a restore would
  // quietly lose saved words, positions, notes and the Reader's scores.
  const [rows, states, personal] = await Promise.all([
    reviewsForUser(userId, Number.MAX_SAFE_INTEGER), allCardStates(userId), personalForUser(userId)]);
  const url = URL.createObjectURL(new Blob([exportRows(rows, states, personal)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'french-learning-progress.json';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try { localStorage.setItem(lastKey(userId), String(Date.now())); } catch { /* the file is saved; only the reminder will come back */ }
}
