/**
 * English todayEn — a lazy part of the English dictionary (see weaknessEn.ts
 * for how lazy groups work). Today's side column and the backup reminder, and
 * the storage status in Settings, added 2026-11-03.
 *
 * Lazy because the first load had no room left: the 150 KB budget was at
 * 149.9 KB, and these strings are only shown on Today and Settings, whose
 * chunks import this file. French and Persian carry the keys themselves;
 * Arabic falls back to English.
 */
import { registerEnglish } from '../../i18n';

export const todayEn = {
  tdAside: 'Your week and your exam',
  tdWeek: 'This week',
  tdCards: 'cards reviewed',
  tdDays: 'Studied on {n} of the last 7 days',
  tdBackupTitle: 'Save a copy of your progress',
  tdBackupBody: 'Your progress lives only in this browser. A copy saved to your device brings it back if the browser is cleared, and moves it to a new device.',
  tdBackupSave: 'Save a copy',
  tdBackupLater: 'Later',
  tdBackupDone: 'Saved. Keep the file somewhere safe; Settings can load it on any device.',
  tdPersistOn: 'This browser has agreed to keep your progress and will not delete it on its own.',
  tdPersistOff: 'This browser has not yet agreed to keep your progress permanently. Saving a copy now and then keeps it safe.',
  tdSession: 'This session',
  tdDone: '{n} of {m} cards',
  tdKeys: 'Keyboard',
  tdKeyFlip: 'Turn the card',
  tdKeyMove: 'Previous or next card',
  tdKeyGrade: 'Again, hard, good, easy',
};

registerEnglish(todayEn);
