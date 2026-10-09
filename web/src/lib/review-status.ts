/**
 * Who checked an exercise, and whether that check still applies.
 *
 * Until now there was one `review` record and one question — approved or not —
 * and the learner-facing line said **"not checked by a teacher"**. Those are not
 * the same claim. The project's owner reads French and can catch a wrong answer
 * key; a qualified teacher's verification is a different thing, and approving
 * an item used to clear a marker that spoke for the second while recording only
 * the first.
 *
 * So there are two records, and they never overwrite each other:
 *
 *   review.owner    the author's own check. Useful, recorded, and it does
 *                   **nothing** to the teacher marker.
 *   review.teacher  an attributable qualified review: a named reviewer AND a
 *                   credential reference. A `role` field on its own would be an
 *                   arbitrary string that anybody could set to "teacher"; what
 *                   makes it a claim is that it names who, and what qualifies
 *                   them, in a file that is committed and reviewable.
 *
 * **A credential is recorded, not verified.** `credential` is a string the
 * reviewer gives — "DELF/DALF examiner, ref 12345" — and nothing in this
 * project checks it against a registry, because there is no server, no account
 * and nobody to do the checking. What requiring it buys is attributability: a
 * claim with a name and a stated qualification attached can be questioned by
 * anybody reading the committed file, where `role: "teacher"` alone cannot.
 * The learner-facing line says so in as many words, and must keep saying so —
 * do not reword it into a project endorsement of the qualification, and do not
 * build a verification system to make the stronger wording true.
 *
 * **A legacy record counts as unverified.** `review.state` without either
 * sub-record is what 76 items carry today; none of it is upgraded, because
 * nobody can retroactively say a teacher looked at something.
 *
 * ── Why a fingerprint ──────────────────────────────────────────────────────
 *
 * A review is of a specific question, not of an id. Change the prompt, the
 * options, the answer key or the explanation and the previous verification no
 * longer covers what a learner now sees — so each record stores a fingerprint
 * of the content it was taken against, and a mismatch makes the review STALE
 * rather than valid. Without it, editing an approved item silently inherits its
 * approval, which is the quietest way for a review system to start lying.
 */
import type { ExamItem } from './exams';

export type ReviewDecision = 'approved' | 'rejected';
export type ReviewRole = 'owner' | 'teacher';

export type ReviewRecord = {
  decision: ReviewDecision;
  /** Who. A name or handle that identifies a person, not a role word. */
  by: string;
  /** ISO date. */
  at: string;
  note?: string | null;
  /** The content this decision was taken against. */
  fingerprint: string;
};

/** A teacher record additionally says what qualifies them, in words a reader
 *  can check — "DELF/DALF examiner, FEI ref 12345", "agrégée de lettres". */
export type TeacherReviewRecord = ReviewRecord & { credential: string };

export const ROLES: ReviewRole[] = ['owner', 'teacher'];
export const DECISIONS: ReviewDecision[] = ['approved', 'rejected'];

/**
 * A stable fingerprint of everything a review is a judgement about.
 *
 * FNV-1a over canonical JSON. Not a security hash and not trying to be: it
 * detects an edit, and `apply-review.py` computes the identical value with the
 * identical algorithm so the two halves of this workflow cannot disagree.
 *
 * Deliberately covers **only** what changes the exercise: the prompt in every
 * language, the options, the answer key, the explanation and any stimulus.
 * Adding a concept id or fixing a typo in an unrelated field must not throw
 * away a teacher's work.
 */
export function fingerprintItem(item: Pick<ExamItem,
  'prompt' | 'options' | 'answer' | 'explain' | 'stimulus'>): string {
  const canonical = JSON.stringify([
    sortedEntries(item.prompt as Record<string, unknown>),
    (item.options ?? []).map((o) => o.fr),
    item.answer,
    sortedEntries(item.explain as Record<string, unknown>),
    item.stimulus?.fr ?? null,
  ]);
  return fnv1a(canonical);
}

function sortedEntries(o: Record<string, unknown> | undefined): [string, unknown][] {
  if (!o) return [];
  return Object.keys(o).sort().map((k) => [k, o[k] ?? null]);
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export type TeacherStatus =
  | { verified: false; reason: 'none' }
  | { verified: false; reason: 'rejected'; by: string }
  | { verified: false; reason: 'stale'; by: string }
  | { verified: false; reason: 'incomplete' }
  | { verified: true; by: string; credential: string; at: string };

/**
 * Whether a learner may be told a teacher has checked this question.
 *
 * Every path that is not an attributable, current, approving teacher record
 * returns `verified: false` — including a record that is merely malformed,
 * because an incomplete claim is not a weaker claim, it is no claim.
 */
export function teacherStatus(item: Pick<ExamItem, 'review' | 'prompt' | 'options'
  | 'answer' | 'explain' | 'stimulus'>): TeacherStatus {
  const t = item.review?.teacher;
  if (!t) return { verified: false, reason: 'none' };
  if (t.decision === 'rejected') return { verified: false, reason: 'rejected', by: t.by || '' };
  if (t.decision !== 'approved') return { verified: false, reason: 'incomplete' };
  if (!t.by?.trim() || !t.credential?.trim() || !t.at?.trim() || !t.fingerprint?.trim()) {
    return { verified: false, reason: 'incomplete' };
  }
  if (t.fingerprint !== fingerprintItem(item)) {
    return { verified: false, reason: 'stale', by: t.by };
  }
  return { verified: true, by: t.by, credential: t.credential, at: t.at };
}

/** The one question the three exam screens ask. */
export const teacherVerified = (item: Parameters<typeof teacherStatus>[0]): boolean =>
  teacherStatus(item).verified;

/** For a paper: every item must be verified before the marker comes off. */
export const allTeacherVerified = (items: Parameters<typeof teacherStatus>[0][]): boolean =>
  items.length > 0 && items.every(teacherVerified);
