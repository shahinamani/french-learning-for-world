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
import { readFileSync, writeFileSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const DEC = join(root, 'data/review-decisions.json');
const PAPERS = join(root, 'content/exam-papers.json');

function applier(args = []) {
  try {
    return { ok: true, out: execFileSync('python3',
      [join(root, 'scripts/apply-review.py'), ...args],
      { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: (e.stdout ?? '') + (e.stderr ?? ''), code: e.status };
  }
}

/** Run with a planted decisions file, always restoring both files. */
function withDecisions(decisions, fn) {
  const decBak = existsSync(DEC) ? readFileSync(DEC, 'utf8') : null;
  copyFileSync(PAPERS, PAPERS + '.bak');
  try {
    writeFileSync(DEC, JSON.stringify({ version: 1, decisions }, null, 1) + '\n');
    return fn();
  } finally {
    copyFileSync(PAPERS + '.bak', PAPERS);
    rmSync(PAPERS + '.bak');
    if (decBak === null) rmSync(DEC, { force: true });
    else writeFileSync(DEC, decBak);
  }
}

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
    const it = read('content/exam-papers.json').papers
      .flatMap((p) => p.items).find((x) => x.id === 'b2-sv-1');
    assert.equal(it.review.state, 'approved');
    assert.equal(it.review.by, 'A Teacher');
    assert.equal(it.review.at, '2026-10-04T12:00:00.000Z');
  });
});

test('a rejection without a reason is refused, and nothing is written', () => {
  withDecisions([D({ verdict: 'rejected', note: '  ' })], () => {
    const before = readFileSync(PAPERS, 'utf8');
    const r = applier();
    assert.equal(r.ok, false, 'the applier accepted a rejection with no reason');
    assert.match(r.out, /rejected with no reason/);
    assert.equal(readFileSync(PAPERS, 'utf8'), before, 'the content was written anyway');
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
      const it = read('content/exam-papers.json').papers
        .flatMap((p) => p.items).find((x) => x.id === 'b2-sv-2');
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
    const before = readFileSync(PAPERS, 'utf8');
    const r = applier();
    assert.ok(r.ok, r.out);
    assert.equal(readFileSync(PAPERS, 'utf8'), before,
      'a skip wrote to the content; a skip means "not now"');
    assert.match(r.out, /1 skips left in the queue/);
  });
});

test('applying does not reformat the file', () => {
  // The reason the applier is Python and not Node. Two decisions must change
  // the lines they decide and nothing else.
  withDecisions([D()], () => {
    const before = readFileSync(PAPERS, 'utf8').split('\n');
    applier();
    const after = readFileSync(PAPERS, 'utf8').split('\n');
    // A multiset difference, which is insensitive to lines shifting: the
    // question is which lines appeared and disappeared, not which index moved.
    const count = (ls) => ls.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map());
    const b = count(before), a = count(after);
    let appeared = 0, vanished = 0;
    for (const [l, n] of a) appeared += Math.max(0, n - (b.get(l) ?? 0));
    for (const [l, n] of b) vanished += Math.max(0, n - (a.get(l) ?? 0));
    assert.ok(appeared + vanished <= 12,
      `${appeared} lines appeared and ${vanished} vanished for one decision — it reformatted`);
    assert.ok(appeared > 0, 'the decision was not written at all');
  });
});
