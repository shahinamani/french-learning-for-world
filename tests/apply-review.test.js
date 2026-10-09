/**
 * The applier, and the records it must refuse to write.
 *
 * The review tool writes `data/review-decisions.json` and never touches the
 * content. `scripts/apply-review.py` applies it, in Python, with the same
 * serialiser the build uses — a Node round-trip of this file would reformat the
 * whole thing and make every review diff unreadable, and two serialisers for
 * one file is how two sources of truth begin. Measured: applying two decisions
 * changes 14 lines, which are the 14 lines that changed.
 *
 * What it must refuse matters more than what it writes. **While building this I
 * applied a test decision and the content then said "approved by Shahin Amani"
 * for items he had never seen** — a false attribution of review, in the one
 * project whose central claim is that it says what has and has not been
 * checked. It was reverted, and these checks exist so the next one is caught by
 * something other than my noticing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const DEC = join(root, 'data/review-decisions.json');
const PAPERS = join(root, 'content/exam-papers.json');

/**
 * Work on COPIES, never on the real content.
 *
 * The first version of this file applied decisions to
 * `content/exam-papers.json` and restored it in a `finally`. Node runs test
 * FILES in parallel, so that is not isolation — it is a window, and
 * `tests/alternates.test.js` read the file inside it and failed on content that
 * was correct a millisecond either side. A test that mutates shared state is
 * flaky by construction, however carefully it tidies up.
 */
const TMP = mkdtempSync(join(tmpdir(), 'flw-review-'));
const TMP_PAPERS = join(TMP, 'exam-papers.json');
const TMP_DEC = join(TMP, 'review-decisions.json');

function applier(args = []) {
  try {
    return { ok: true, out: execFileSync('python3',
      [join(root, 'scripts/apply-review.py'),
       '--papers', TMP_PAPERS, '--decisions', TMP_DEC, ...args],
      { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: (e.stdout ?? '') + (e.stderr ?? ''), code: e.status };
  }
}

/** Plant a decisions file and a fresh copy of the content, in a temp directory. */
function withDecisions(decisions, fn) {
  copyFileSync(PAPERS, TMP_PAPERS);
  writeFileSync(TMP_DEC, JSON.stringify({ version: 1, decisions }, null, 1) + '\n');
  return fn();
}

/** The copy the applier just wrote, parsed. */
const applied = () => JSON.parse(readFileSync(TMP_PAPERS, 'utf8'));

const D = (over) => ({
  itemId: 'b2-sv-1', paperId: 'tcf-b2-structure', verdict: 'approved',
  note: null, by: 'A Teacher', at: '2026-10-04T12:00:00.000Z', ...over,
});

test('nobody is recorded as having reviewed anything yet', () => {
  // The state this project is actually in. When it fails because a review has
  // happened, update it and name the reviewer.
  const items = read('content/exam-papers.json').papers.flatMap((p) => p.items);
  const claimed = items.filter((i) => i.review.by).map((i) => `${i.id} by ${i.review.by}`);
  assert.deepEqual(claimed, [],
    'the content claims somebody reviewed an item. If they did, update this check; '
    + 'if a tool wrote it, that is a false record of review and must be reverted');
  assert.deepEqual(read('data/review-decisions.json').decisions, []);
});

test('an approval is applied, with the reviewer and the date', () => {
  withDecisions([D()], () => {
    const r = applier();
    assert.ok(r.ok, r.out);
    const it = applied().papers.flatMap((p) => p.items).find((x) => x.id === 'b2-sv-1');
    assert.equal(it.review.state, 'approved');
    assert.equal(it.review.by, 'A Teacher');
    assert.equal(it.review.at, '2026-10-04T12:00:00.000Z');
  });
});

test('a rejection without a reason is refused, and nothing is written', () => {
  withDecisions([D({ verdict: 'rejected', note: '  ' })], () => {
    const before = readFileSync(TMP_PAPERS, 'utf8');
    const r = applier();
    assert.equal(r.ok, false, 'the applier accepted a rejection with no reason');
    assert.match(r.out, /rejected with no reason/);
    assert.equal(readFileSync(TMP_PAPERS, 'utf8'), before, 'the content was written anyway');
  });
});

test('approving a FLAGGED item without a note is refused', () => {
  // b2-sv-2 carries `uncertain`. The flag says the writer did not know; an
  // approval with no word about it throws away the only record of the question.
  withDecisions([D({ itemId: 'b2-sv-2' })], () => {
    const r = applier();
    assert.equal(r.ok, false, 'a flagged item was approved silently');
    assert.match(r.out, /flagged uncertain/);
  });
  // And with a note, it goes through.
  withDecisions([D({ itemId: 'b2-sv-2', note: 'Checked: the indicative is what the TCF marks.' })],
    () => {
      const r = applier();
      assert.ok(r.ok, r.out);
      const it = applied().papers.flatMap((p) => p.items).find((x) => x.id === 'b2-sv-2');
      assert.equal(it.review.state, 'approved');
      assert.match(it.review.note, /TCF marks/);
    });
});

test('a decision naming an item that does not exist is refused', () => {
  withDecisions([D({ itemId: 'b2-sv-999' })], () => {
    const r = applier();
    assert.equal(r.ok, false);
    assert.match(r.out, /no such item/);
  });
});

test('a skip is not a verdict and changes nothing', () => {
  withDecisions([D({ verdict: 'skipped' })], () => {
    const before = readFileSync(TMP_PAPERS, 'utf8');
    const r = applier();
    assert.ok(r.ok, r.out);
    assert.equal(readFileSync(TMP_PAPERS, 'utf8'), before,
      'a skip wrote to the content; a skip means "not now"');
    assert.match(r.out, /1 skips left in the queue/);
  });
});

test('applying does not reformat the file', () => {
  // The reason the applier is Python and not Node. Two decisions must change
  // the lines they decide and nothing else.
  withDecisions([D()], () => {
    const before = readFileSync(TMP_PAPERS, 'utf8').split('\n');
    applier();
    const after = readFileSync(TMP_PAPERS, 'utf8').split('\n');
    // A multiset difference, which is insensitive to lines shifting: the
    // question is which lines appeared and disappeared, not which index moved.
    const count = (ls) => ls.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map());
    const b = count(before), a = count(after);
    let appeared = 0, vanished = 0;
    for (const [l, n] of a) appeared += Math.max(0, n - (b.get(l) ?? 0));
    for (const [l, n] of b) vanished += Math.max(0, n - (a.get(l) ?? 0));
    // Bounded AND proportional. The absolute cap rose from 12 to 24 when a
    // decision started writing a nested record — role, reviewer, date, note and
    // the content fingerprint — which is more lines for the same one item. The
    // fraction is what actually guards the original fault: a reformat rewrites
    // the whole file, so it would show as a large share of it, not as a dozen
    // lines either way.
    const changed = appeared + vanished;
    assert.ok(changed <= 24,
      `${appeared} lines appeared and ${vanished} vanished for one decision — it reformatted`);
    assert.ok(changed / before.length < 0.05,
      `${changed} of ${before.length} lines changed — that is a reformat, not a decision`);
    assert.ok(appeared > 0, 'the decision was not written at all');
  });
});
