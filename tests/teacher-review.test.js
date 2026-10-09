/**
 * Owner approval is not teacher verification.
 *
 * The learner-facing line says **"not checked by a teacher"**, and until now
 * `review.state === 'approved'` removed it — so the author approving his own
 * drafts would have cleared a marker that speaks for somebody else. These
 * assert the separation, and the three ways a teacher record can fail to be
 * one: absent, unattributable, or taken against a question that has since
 * changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  teacherStatus, teacherVerified, allTeacherVerified, fingerprintItem, ROLES, DECISIONS,
} from '../web/src/lib/review-status.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

/** A question, with whatever review record a test wants. */
const item = (review = {}, over = {}) => ({
  id: 'b2-1', kind: 'mcq',
  prompt: { en: 'Pick one', fr: 'Choisissez' },
  options: [{ fr: 'soit' }, { fr: 'était' }],
  answer: 0,
  explain: { en: 'Because the subjunctive follows.', fr: 'Parce que le subjonctif suit.' },
  stimulus: { fr: 'Bien que ce ___ difficile, il continue.' },
  conceptIds: ['c.subj'],
  review: { state: 'unreviewed', by: null, at: null, ...review },
  ...over,
});

const teacherRecord = (over = {}, it = item()) => ({
  decision: 'approved', by: 'A. Dubois', credential: 'DELF/DALF examiner, ref 12345',
  at: '2026-10-09', fingerprint: fingerprintItem(it), ...over,
});

/* ── Owner approval ───────────────────────────────────────────────────── */

test('an OWNER approval does not make an item teacher-verified', () => {
  const it = item({
    state: 'approved', by: 'Shahin Amani', at: '2026-10-09',
    owner: { decision: 'approved', by: 'Shahin Amani', at: '2026-10-09', fingerprint: 'x' },
  });
  assert.equal(teacherVerified(it), false, 'the author approving his own draft is not a teacher check');
  assert.equal(teacherStatus(it).reason, 'none');
});

test('the legacy records every item carries today are unverified', () => {
  // 76 items have `state` and no role at all. None may be upgraded: nobody can
  // retroactively say a teacher looked at something.
  for (const state of ['unreviewed', 'approved', 'rejected']) {
    assert.equal(teacherVerified(item({ state, by: 'Shahin Amani' })), false, state);
  }
});

/* ── A real teacher review ────────────────────────────────────────────── */

test('an attributable, current, approving teacher record verifies', () => {
  const base = item();
  const it = item({ teacher: teacherRecord({}, base) });
  const s = teacherStatus(it);
  assert.equal(s.verified, true);
  assert.equal(s.by, 'A. Dubois');
  assert.match(s.credential, /examiner/);
});

test('a teacher REJECTION never verifies', () => {
  const base = item();
  const it = item({ teacher: teacherRecord({ decision: 'rejected' }, base) });
  assert.equal(teacherVerified(it), false);
  assert.equal(teacherStatus(it).reason, 'rejected');
});

test('an unattributable teacher record is no claim at all', () => {
  const base = item();
  for (const missing of [{ by: '' }, { credential: '' }, { credential: '   ' }, { at: '' }, { fingerprint: '' }]) {
    const it = item({ teacher: teacherRecord(missing, base) });
    assert.equal(teacherVerified(it), false, JSON.stringify(missing));
    assert.equal(teacherStatus(it).reason, 'incomplete');
  }
});

test('a role word on its own verifies nothing', () => {
  // `role: "teacher"` is a string anybody can type. What makes it a claim is
  // naming who and what qualifies them.
  const it = item({ state: 'approved', role: 'teacher', by: 'Someone' });
  assert.equal(teacherVerified(it), false);
});

/* ── Staleness ────────────────────────────────────────────────────────── */

test('changing the question invalidates the teacher review', () => {
  const base = item();
  const reviewed = teacherRecord({}, base);
  for (const edit of [
    { prompt: { en: 'Pick the other one', fr: 'Choisissez' } },
    { options: [{ fr: 'soit' }, { fr: 'fût' }] },
    { answer: 1 },
    { explain: { en: 'Changed reason.', fr: 'Raison changée.' } },
    { stimulus: { fr: 'Quoique ce ___ difficile, il continue.' } },
    // Removing the sentence a learner reads is as material as changing it.
    { stimulus: undefined },
  ]) {
    const after = item({ teacher: reviewed }, edit);
    assert.equal(teacherVerified(after), false, `editing ${Object.keys(edit)[0]} kept the review`);
    assert.equal(teacherStatus(after).reason, 'stale');
    assert.equal(teacherStatus(after).by, 'A. Dubois', 'and still says who checked the old version');
  }
});

test('an unrelated edit does NOT throw the review away', () => {
  // A teacher's work is expensive. Adding a concept id must not discard it.
  const base = item();
  const after = item({ teacher: teacherRecord({}, base) }, { conceptIds: ['c.subj', 'c.new'], level: 'B2' });
  assert.equal(teacherVerified(after), true);
});

/* ── The two records are independent ──────────────────────────────────── */

test('a later owner decision does not erase teacher evidence', () => {
  const base = item();
  const t = teacherRecord({}, base);
  const it = item({
    teacher: t,
    owner: { decision: 'rejected', by: 'Shahin Amani', at: '2026-10-10', note: 'wording', fingerprint: t.fingerprint },
    state: 'rejected',
  });
  assert.deepEqual(it.review.teacher, t, 'the teacher record survived an owner decision');
  assert.equal(teacherVerified(it), true, 'and still governs the marker');
});

test('a paper keeps the marker until every item is verified', () => {
  const base = item();
  const verified = item({ teacher: teacherRecord({}, base) });
  assert.equal(allTeacherVerified([verified, verified]), true);
  assert.equal(allTeacherVerified([verified, item({ state: 'approved' })]), false);
  assert.equal(allTeacherVerified([]), false, 'an empty paper is not a verified paper');
});

/* ── apply-review.py refuses what it should ───────────────────────────── */

function applyDecisions(decisions) {
  const dir = mkdtempSync(join(tmpdir(), 'review-'));
  const papers = {
    version: 1,
    papers: [{ id: 'p1', exam: 'tcf', level: 'B2', skill: 'structure', code: 'X',
      name: { en: 'P' }, minutes: 10,
      official: { minutes: 10, marks: 10, passNote: { en: '' }, source: { en: '' } },
      practiceNote: { en: '' }, items: [item()] }],
  };
  const papersPath = join(dir, 'papers.json');
  const decisionsPath = join(dir, 'decisions.json');
  writeFileSync(papersPath, JSON.stringify(papers));
  writeFileSync(decisionsPath, JSON.stringify({ version: 1, decisions }));
  try {
    const out = execFileSync('python3', [join(root, 'scripts/apply-review.py'),
      '--papers', papersPath, '--decisions', decisionsPath], { encoding: 'utf8', cwd: root });
    return { code: 0, out, papers: JSON.parse(readFileSync(papersPath, 'utf8')) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const decision = (over = {}) => ({
  itemId: 'b2-1', paperId: 'p1', verdict: 'approved',
  by: 'Shahin Amani', at: '2026-10-09', ...over,
});

test('the applier refuses an invalid role, writing nothing', () => {
  const r = applyDecisions([decision({ role: 'reviewer' })]);
  assert.equal(r.code, 2);
  assert.match(r.out, /role 'reviewer' is not one of/);
  assert.match(r.out, /REFUSING/);
});

test('the applier refuses an invalid decision', () => {
  const r = applyDecisions([decision({ verdict: 'maybe' })]);
  assert.equal(r.code, 2);
  assert.match(r.out, /decision 'maybe' is not one of/);
});

test('the applier refuses a teacher review with no credential', () => {
  const r = applyDecisions([decision({ role: 'teacher' })]);
  assert.equal(r.code, 2);
  assert.match(r.out, /needs a credential reference/);
});

test('an owner decision is recorded as owner, and is not teacher-verified', () => {
  const r = applyDecisions([decision()]);
  assert.equal(r.code, 0, r.out);
  const written = r.papers.papers[0].items[0];
  assert.equal(written.review.owner.decision, 'approved');
  assert.equal(written.review.teacher, undefined);
  assert.ok(written.review.owner.fingerprint, 'the content it judged is recorded');
  assert.equal(teacherVerified(written), false);
});

test('a teacher decision records the credential and verifies', () => {
  const r = applyDecisions([decision({
    role: 'teacher', by: 'A. Dubois', credential: 'DELF/DALF examiner, ref 12345',
  })]);
  assert.equal(r.code, 0, r.out);
  const written = r.papers.papers[0].items[0];
  assert.equal(written.review.teacher.credential, 'DELF/DALF examiner, ref 12345');
  assert.equal(teacherVerified(written), true, 'the fingerprint the script wrote must match the one the browser computes');
});

test('an owner decision after a teacher one keeps both', () => {
  const r = applyDecisions([
    decision({ role: 'teacher', by: 'A. Dubois', credential: 'agrégée de lettres' }),
    decision({ role: 'owner', by: 'Shahin Amani', verdict: 'rejected', note: 'wording' }),
  ]);
  assert.equal(r.code, 0, r.out);
  const written = r.papers.papers[0].items[0];
  assert.equal(written.review.teacher.by, 'A. Dubois');
  assert.equal(written.review.owner.decision, 'rejected');
});

test('the shared vocabularies are the ones the applier enforces', () => {
  const py = readFileSync(join(root, 'scripts/apply-review.py'), 'utf8');
  for (const role of ROLES) assert.ok(py.includes(`"${role}"`), `${role} missing from the applier`);
  for (const d of DECISIONS) assert.ok(py.includes(`"${d}"`), `${d} missing from the applier`);
});
