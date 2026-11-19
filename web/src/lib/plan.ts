/**
 * Today's session: three steps, built once a day, kept on the device.
 *
 * The portal used to be a set of tools with no order between them; a learner
 * with twenty minutes had to decide four times. The plan decides once: the
 * cards that are due, one grammar lesson (the weak point's if there is one),
 * one text at the exam's level. It is stored per profile under today's date,
 * so the screens that finish a step can mark it and name the next one.
 *
 * Nothing here is an assessment, and nothing here writes a review.
 */
import { userKey } from './session';

export type StepKind = 'cards' | 'lesson' | 'text';
export type Step = { kind: StepKind; to: string; title: string; fr?: string; minutes: number; done: boolean };
export type Plan = { day: string; steps: Step[] };

export const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const key = (userId: string) => userKey(userId, 'plan');

export function readPlan(userId: string, now = Date.now()): Plan | null {
  try {
    const raw = localStorage.getItem(key(userId));
    const p = raw ? JSON.parse(raw) as Plan : null;
    return p && p.day === dayOf(now) && Array.isArray(p.steps) ? p : null;
  } catch { return null; }
}

export function savePlan(userId: string, plan: Plan): void {
  try { localStorage.setItem(key(userId), JSON.stringify(plan)); } catch { /* private window */ }
}

/** Marks a step done and returns the next step still to do, if any. */
export function completeStep(userId: string, kind: StepKind, now = Date.now()): Step | null {
  const plan = readPlan(userId, now);
  if (!plan) return null;
  let seen = false;
  for (const s of plan.steps) if (s.kind === kind) { s.done = true; seen = true; }
  if (!seen) return null;
  savePlan(userId, plan);
  return plan.steps.find((s) => !s.done) ?? null;
}

export const minutesOf = (plan: Plan) => plan.steps.reduce((n, s) => n + s.minutes, 0);
export const nextStep = (plan: Plan) => plan.steps.find((s) => !s.done) ?? null;
