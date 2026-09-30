/** Queries over the review log. Every one of them names whose rows it wants. */
import { reviewsForUser, allCardStates } from './db';
import type { ReviewRow, Card } from './types';

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

export function exportRows(rows: ReviewRow[]) {
  return JSON.stringify({ format: 'french-learning-for-world/review-log', version: 1,
    exportedAt: new Date().toISOString(), rows }, null, 2);
}
