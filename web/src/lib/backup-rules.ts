/**
 * The rules for when to remind a learner to save a copy of their progress,
 * and the browser's persistent-storage request. Kept apart from backup.ts so
 * they import nothing outside the app: the unit tests run them without the
 * web packages installed, as CI does. See backup.ts for the why.
 */
import { userKey } from './session';

const DAY = 86_400_000;
/** Remind once this many cards have been reviewed at least once. */
export const BACKUP_AFTER_CARDS = 30;
export const BACKUP_EVERY_DAYS = 14;
export const SNOOZE_DAYS = 7;

const safely = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

let asked = false;
/** Ask the browser to keep this site's data. Safe to call often; asks once per page. */
export async function requestPersistence(): Promise<boolean> {
  const s = globalThis.navigator?.storage;
  if (!s?.persist || !s.persisted) return false;
  try {
    if (await s.persisted()) return true;
    if (asked) return false;
    asked = true;
    return await s.persist();
  } catch { return false; }
}

/** Whether the browser has agreed to keep this site's data; null if it cannot say. */
export async function isPersisted(): Promise<boolean | null> {
  const s = globalThis.navigator?.storage;
  if (!s?.persisted) return null;
  try { return await s.persisted(); } catch { return null; }
}

export const lastKey = (u: string) => userKey(u, 'lastBackup');
const snoozeKey = (u: string) => userKey(u, 'backupSnoozedUntil');

export function lastBackup(userId: string): number | null {
  const v = safely(() => Number(localStorage.getItem(lastKey(userId))), 0);
  return v > 0 ? v : null;
}

/** True when the learner has history worth saving and no recent copy of it. */
export function backupDue(userId: string, reviewedCards: number, now = Date.now()): boolean {
  if (reviewedCards < BACKUP_AFTER_CARDS) return false;
  const snoozed = safely(() => Number(localStorage.getItem(snoozeKey(userId))), 0);
  if (snoozed > now) return false;
  const last = lastBackup(userId);
  return last === null || now - last > BACKUP_EVERY_DAYS * DAY;
}

export function snoozeBackup(userId: string, now = Date.now()): void {
  safely(() => localStorage.setItem(snoozeKey(userId), String(now + SNOOZE_DAYS * DAY)), undefined);
}

