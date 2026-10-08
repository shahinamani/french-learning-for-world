/**
 * The export file format: writing it, and reading one back.
 *
 * Separated from `progress.ts` so it can be tested without a browser. The rest
 * of that module queries IndexedDB, so importing it pulls in `idb` — and the
 * unit suite runs with the web dependencies hidden, exactly as CI has them, so
 * the parser's tests could not have run there at all. A parser whose tests only
 * work on the author's machine is the shape this project has been bitten by
 * before.
 *
 * `progress.ts` re-exports everything here, so no caller changed.
 */
import type { ReviewRow, CardState } from './types';



export const EXPORT_FORMAT = 'french-learning-for-world/review-log';
export const EXPORT_VERSION = 2;

/**
 * The export carries the review log AND the card states.
 *
 * Version 1 carried rows only, which made "carry your history to another
 * device" half true in a way that would have bitten a real learner: the
 * history would arrive and every card would be due-new, because the schedule
 * lives in the card states, not in the log. Version 1 files still import; their
 * card states are simply absent and the scheduler starts those cards over,
 * which is the best that can be done with what they contain.
 *
 * `userId` is deliberately NOT exported. It is a local profile id, meaningless
 * on another device, and the import assigns the importing profile's own.
 */
export function exportRows(rows: ReviewRow[], states: (CardState & { cardKey: string })[] = []) {
  return JSON.stringify({
    format: EXPORT_FORMAT, version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    rows: rows.map(({ userId: _userId, ...rest }) => rest),
    cards: states.map(({ cardKey, ...state }) => ({ cardKey, ...stripUser(state) })),
  }, null, 2);
}

function stripUser<T extends object>(o: T) {
  const { userId: _userId, ...rest } = o as T & { userId?: string };
  return rest;
}

export type ImportReport = {
  rows: number; rowsSkipped: number; cards: number; version: number;
};

/** What an import would do, decided from the file alone. Throws on anything
 *  that is not one of our exports, rather than guessing at a stranger's JSON. */
export function parseExport(text: string): { rows: Omit<ReviewRow, 'userId'>[];
                                             cards: (CardState & { cardKey: string })[];
                                             version: number } {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('notJson'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('notOurs');
  const o = parsed as Record<string, unknown>;
  if (o.format !== EXPORT_FORMAT) throw new Error('notOurs');
  const version = Number(o.version);
  if (!Number.isFinite(version) || version < 1 || version > EXPORT_VERSION) throw new Error('version');
  const rows = Array.isArray(o.rows) ? o.rows : [];
  const cards = Array.isArray(o.cards) ? o.cards : [];
  // Two things here are validated because of what READS them later, not
  // because of what the type says. Both were confirmed by test before being
  // fixed (`tests/parse-export.test.js`):
  //
  //   conceptIds — `conceptStats()` uses every entry as a Map key. A number, an
  //     object or a nested array becomes "1" or "[object Object]" and then sits
  //     on the progress screen indistinguishable from a real concept. The array
  //     was checked; its contents were not.
  //   grade — `conceptStats()` does `r.grade >= 3` and `r.grade === 1`. The
  //     string "4" satisfies the first by coercion, so a corrupt or hostile file
  //     could move a learner's accuracy with a value that is not a grade.
  //
  // The accepted range is 0-4, which is what `ReviewRow` permits — NOT the 1-4
  // of `GRADES`. No code writes 0 today, but the type has always allowed it, so
  // a backup from an older build may carry it and rejecting it would discard
  // real history on the one path that exists to recover history.
  //
  // A MISSING grade keeps its row: an old export that never had the field is
  // still a review that happened, and `conceptStats` simply counts it as
  // reviewed rather than as correct. A grade that is PRESENT and is not a grade
  // drops its row, because there is no honest value to substitute.
  const isGrade = (g: unknown): boolean =>
    typeof g === 'number' && Number.isInteger(g) && g >= 0 && g <= 4;

  const goodRows = rows.filter((r): r is Omit<ReviewRow, 'userId'> =>
    !!r && typeof r === 'object'
    && typeof (r as { id?: unknown }).id === 'string'
    && typeof (r as { cardKey?: unknown }).cardKey === 'string'
    && Number.isFinite((r as { reviewedAt?: unknown }).reviewedAt as number)
    && Array.isArray((r as { conceptIds?: unknown }).conceptIds)
    && (!('grade' in r) || isGrade((r as { grade?: unknown }).grade)))
    .map((r) => ({
      ...r,
      conceptIds: (r.conceptIds as unknown[]).filter((c): c is string => typeof c === 'string'),
    }));
  const goodCards = cards.filter((c): c is CardState & { cardKey: string } =>
    !!c && typeof c === 'object'
    && typeof (c as { cardKey?: unknown }).cardKey === 'string'
    && Number.isFinite((c as { dueAt?: unknown }).dueAt as number));
  return { rows: goodRows, cards: goodCards, version };
}
