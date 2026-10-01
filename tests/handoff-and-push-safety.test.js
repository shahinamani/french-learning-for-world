/**
 * Two safeguards that existed as habits, made into things that fail.
 *
 * On 2026-10-01 the pre-push sweep caught an email address in a tracked file and
 * stopped a push. The commit before it had gone out **without** the sweep being
 * run, so CI had been red for hours — on the personal-data scan, which exists
 * precisely to catch what it was failing on. And `docs/99-handoff.md`, the
 * document written so a lost session loses nothing, reported "184 unit tests
 * pass, tsc is clean and the build is clean" and never mentioned it.
 *
 * Every one of those local claims was true. All four were about this machine.
 * The one fact a reader would check first — what CI says — was absent, and the
 * document read as green.
 *
 * So:
 *   1. the sweep runs on the push itself, not when someone remembers;
 *   2. a handoff ends with a CI run, not a local result.
 *
 * Both are asserted here, and both detectors are run against planted samples on
 * every run — docs/lessons.md #8: a check seen red once is a check seen once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

// ── 1. The sweep runs on the push ───────────────────────────────────────────

test('a pre-push hook exists, is executable, and runs the whole sweep', () => {
  const path = join(root, '.githooks/pre-push');
  const mode = statSync(path).mode;
  assert.ok(mode & 0o111, '.githooks/pre-push is not executable, so git will skip it silently');

  const hook = read('.githooks/pre-push');
  assert.match(hook, /pre-push-sweep\.sh/, 'the hook must run the sweep, not a cheaper subset of it');
  assert.match(hook, /exit 1/, 'the hook must fail the push, not merely print');
  // A hook that runs the sweep and ignores its exit status is decoration.
  assert.match(hook, /if ! bash scripts\/pre-push-sweep\.sh/,
    "the hook must branch on the sweep's exit status");
});

test('the sweep it calls is present and executable', () => {
  const mode = statSync(join(root, 'scripts/pre-push-sweep.sh')).mode;
  assert.ok(mode & 0o111, 'scripts/pre-push-sweep.sh is not executable');
  const sweep = read('scripts/pre-push-sweep.sh');
  for (const step of [/credential/i, /attribution/i, /personal data/i, /unit tests/i]) {
    assert.match(sweep, step, 'the sweep lost one of the five steps it exists to run as one command');
  }
});

test('the hook is enabled by the command the documentation gives', () => {
  // The documented route is ./scripts/setup-hooks.sh, so that is what has to
  // reach BOTH hooks — otherwise the instruction is true of one and quietly
  // false of the other, and a contributor meets the push hook as a surprise.
  const setup = read('scripts/setup-hooks.sh');
  assert.match(setup, /core\.hooksPath \.githooks/, 'setup-hooks.sh must set hooksPath');
  assert.match(setup, /chmod \+x \.githooks/, 'setup-hooks.sh must make every hook executable');
  assert.match(setup, /pre-push/, 'setup-hooks.sh must say the push hook is now active');

  // Each document separately. Concatenating them let either one drop the
  // instruction while the other carried the check — found by planting exactly
  // that and watching this pass.
  for (const doc of ['CONTRIBUTING.md', 'SECURITY.md']) {
    const text = read(doc);
    assert.match(text, /setup-hooks\.sh/, `${doc} must give the enabling command`);
    assert.match(text, /pre-push/,
      `${doc} must tell a contributor the push hook exists, or they will meet it as a surprise`);
  }
});

// ── 2. A handoff ends with CI, not with a local claim ───────────────────────

const RUN_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/(\d{6,})/;
const ISO_UTC = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/;
const CONCLUSION = /\b(success|failure|cancelled|timed_out)\b/;
const SHA = /\b([0-9a-f]{7,40})\b/;

/** The last 1800 characters: "the last line of the document", with room for a block. */
const tail = (s) => s.slice(-1800);

test('the CI-status detector rejects the handoff that actually shipped', () => {
  // These are the real closing claims of the handoff that went out red, plus
  // two neighbours. None of them is a CI status, and each must be rejected.
  const planted = [
    'Nothing is half-written. The tree is committed and pushed, 184 unit tests pass, `tsc` is clean and the build is clean.',
    'All green locally. 196 tests pass.',
    'CI is green.',                       // a claim with nothing to check it against
    'See the Actions tab.',
  ];
  for (const p of planted) {
    const ok = RUN_URL.test(p) && ISO_UTC.test(p) && CONCLUSION.test(p);
    assert.equal(ok, false, `a local-only claim was accepted as a CI status: ${p}`);
  }
  // And it must accept a real one, or it rejects everything and proves nothing.
  const good = 'Branch tip 5f92c08 — `test` success, `browser` success. '
    + 'Run https://github.com/shahinamani/french-learning-for-world/actions/runs/36861092703 '
    + 'observed 2026-10-01T12:23:03Z.';
  assert.ok(RUN_URL.test(good) && ISO_UTC.test(good) && CONCLUSION.test(good),
    'the detector rejects a well-formed CI status');
});

test('docs/99-handoff.md ends with a CI run: url, timestamp, conclusion and sha', () => {
  const end = tail(read('docs/99-handoff.md'));
  assert.match(end, RUN_URL, 'no GitHub Actions run URL in the closing section');
  assert.match(end, ISO_UTC, 'no UTC timestamp saying when that run was observed');
  assert.match(end, CONCLUSION, 'no run conclusion — "passing" is a claim, a conclusion is a fact');
  assert.match(end, /\btest\b/, 'the two required checks are named individually');
  assert.match(end, /\bbrowser\b/, 'the two required checks are named individually');
});

test('the commit the handoff reports CI for is really in this history', () => {
  const end = tail(read('docs/99-handoff.md'));
  const sha = end.match(/\b([0-9a-f]{7,40})\b/g)?.find((h) => {
    try {
      execFileSync('git', ['cat-file', '-e', `${h}^{commit}`], { cwd: root, stdio: 'ignore' });
      return true;
    } catch { return false; }
  });
  assert.ok(sha, 'the closing section names no commit that exists in this repository');

  // Not freshness — reachability. A fabricated or copied-in sha fails here,
  // which is what stops the block being filled in from memory.
  let reachable = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: root, stdio: 'ignore' });
  } catch { reachable = false; }
  assert.ok(reachable, `${sha} is not an ancestor of HEAD — the CI block names a commit not in this branch`);
});

test('the ancestry check rejects a commit that is not in this history', () => {
  // The control arm: if every sha passed, the check above would prove nothing.
  let reachable = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'HEAD'],
      { cwd: root, stdio: 'ignore' });
  } catch { reachable = false; }
  assert.equal(reachable, false, 'the empty-tree object was accepted as an ancestor commit');
});
