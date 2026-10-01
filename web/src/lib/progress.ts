/** Queries over the review log. Every one of them names whose rows it wants. */
import { reviewsForUser, allCardStates } from './db';
import type { ReviewRow, Card, CardState } from './types';

export type Counts = { due: number; fresh: number; learned: number; total: number };

export async function counts(userId: string, cards: Card[], now: number): Promise<Counts> {
  const states = await allCardStates(userId);
  const byKey = new Map(states.map((s) => [s.cardKey, s]));
  let due = 0, fresh = 0, learned = 0;
  for (const c of cards) {
    const s = byKey.get(c.key);
    if (!s || s.reps === 0) fresh += 1;
    else {
      if (s.dueAt <= now) due += 1;
      if (s.stability >= 21) learned += 1;
    }
  }
  return { due, fresh, learned, total: cards.length };
}

export type ConceptStat = {
  conceptId: string; reviews: number; correct: number; accuracy: number;
  lapses: number; lastSeen: number;
};

/** The weakness model: one pass over the log, grouped by concept. */
export async function conceptStats(userId: string): Promise<Map<string, ConceptStat>> {
  const rows = await reviewsForUser(userId, 2000);
  const out = new Map<string, ConceptStat>();
  for (const r of rows) {
    for (const id of r.conceptIds) {
      const s = out.get(id) ?? { conceptId: id, reviews: 0, correct: 0, accuracy: 0, lapses: 0, lastSeen: 0 };
      s.reviews += 1;
      if (r.grade >= 3) s.correct += 1;
      if (r.grade === 1) s.lapses += 1;
      s.lastSeen = Math.max(s.lastSeen, r.reviewedAt);
      out.set(id, s);
    }
  }
  for (const s of out.values()) s.accuracy = s.reviews ? s.correct / s.reviews : 0;
  return out;
}

/** Weakest first, but only where there is enough evidence to say anything. */
export async function weakPoints(userId: string, minReviews = 3): Promise<ConceptStat[]> {
  const stats = await conceptStats(userId);
  return [...stats.values()]
    .filter((s) => s.reviews >= minReviews && s.accuracy < 0.8)
    .sort((a, b) => a.accuracy - b.accuracy || b.reviews - a.reviews);
}

export async function statsForConcept(userId: string, conceptId: string): Promise<ConceptStat | null> {
  return (await conceptStats(userId)).get(conceptId) ?? null;
}

export async function weekSummary(userId: string, now: number) {
  const rows = await reviewsForUser(userId, 3000);
  const start = now - 7 * 86_400_000;
  const week = rows.filter((r) => r.reviewedAt >= start);
  const byDay = new Map<string, number>();
  for (const r of week) {
    const d = new Date(r.reviewedAt).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  return {
    reviews: week.length,
    minutes: Math.round(week.reduce((a, r) => a + r.durationMs, 0) / 60_000),
    days: byDay.size,
    byDay,
  };
}

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
  const goodRows = rows.filter((r): r is Omit<ReviewRow, 'userId'> =>
    !!r && typeof r === 'object'
    && typeof (r as { id?: unknown }).id === 'string'
    && typeof (r as { cardKey?: unknown }).cardKey === 'string'
    && Number.isFinite((r as { reviewedAt?: unknown }).reviewedAt as number)
    && Array.isArray((r as { conceptIds?: unknown }).conceptIds));
  const goodCards = cards.filter((c): c is CardState & { cardKey: string } =>
    !!c && typeof c === 'object'
    && typeof (c as { cardKey?: unknown }).cardKey === 'string'
    && Number.isFinite((c as { dueAt?: unknown }).dueAt as number));
  return { rows: goodRows, cards: goodCards, version };
}
