/**
 * The dependency gate, and proof that it can fail.
 *
 * `CHECKLIST.md` recorded "no dependency scanning" as a gap. The gate added for
 * it blocks on PRODUCTION advisories at high or above and merely reports
 * everything else — a split that is deliberate, because this project ships no
 * server and loads nothing cross-origin, so a dev-server advisory needing
 * Windows and a local attacker is not a risk to somebody revising French on a
 * phone. A gate that fails on those is one people learn to ignore.
 *
 * The real audit needs the registry, so these drive the script with a STUBBED
 * `npm` on PATH: deterministic, offline, and able to produce the failure the
 * real one has not produced since the react-router upgrade. A gate nobody has
 * watched fail is a guess about what it does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(root, 'scripts/check-dependencies.sh');

/**
 * Run the gate with a fake `npm` whose `audit` exits with `code`.
 * `node` stays real, because the script pipes JSON through it.
 */
function withStubbedNpm(code, json = '{"metadata":{"vulnerabilities":{"high":0,"total":0}}}', message = 'stubbed npm audit') {
  const bin = mkdtempSync(join(tmpdir(), 'bin-'));
  const npm = join(bin, 'npm');
  writeFileSync(npm, `#!/usr/bin/env bash
if [ "$1" = "audit" ]; then
  for a in "$@"; do if [ "$a" = "--json" ]; then echo '${json}'; exit 0; fi; done
  echo "${message}"
  exit ${code}
fi
exit 0
`);
  chmodSync(npm, 0o755);
  try {
    const out = execFileSync('bash', [SCRIPT], {
      encoding: 'utf8', cwd: root,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

test('a production advisory FAILS the gate', () => {
  const r = withStubbedNpm(1);
  assert.equal(r.code, 1, 'the gate passed while production audit reported a finding');
  assert.match(r.out, /production dependencies in .* carry a high or critical advisory/);
  assert.match(r.out, /Triage before upgrading/, 'it must say what to do, not just fail');
  assert.match(r.out, /Do not run 'npm audit fix --force'/);
});

test('a clean production tree passes', () => {
  const r = withStubbedNpm(0);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /No high or critical advisory in any production dependency/);
});

test('dev-only findings are reported, never enforced', () => {
  // Production clean, dev dirty: the gate must pass AND still print the count.
  const r = withStubbedNpm(0, '{"metadata":{"vulnerabilities":{"high":3,"moderate":1,"total":4}}}');
  assert.equal(r.code, 0, 'a dev-only advisory must not fail the build');
  assert.match(r.out, /including dev: .*3 high/, 'but it must be visible');
});

test('both dependency trees are scanned, not just the application', () => {
  const r = withStubbedNpm(0);
  assert.match(r.out, /root \(test tooling\)/);
  assert.match(r.out, /web \(the application\)/);
});

test('CI runs the gate', () => {
  const ci = execFileSync('cat', [join(root, '.github/workflows/ci.yml')], { encoding: 'utf8' });
  assert.match(ci, /check-dependencies\.sh/,
    'the gate exists but nothing runs it — a script nobody calls is not a control');
});

test('the real audit agrees: no production advisory today', () => {
  // The one that mattered was react-router 7.9.1, XSS via open redirects, in the
  // PRODUCTION tree. It was upgraded to 7.18.4 — a minor bump, verified by the
  // full suite and 315 browser checks — rather than left for a scanner to
  // report for ever. This is the only test here that needs the network; it
  // records the state rather than enforcing it, so an offline run says so.
  let out;
  try {
    out = execFileSync('bash', [SCRIPT], { encoding: 'utf8', cwd: root, timeout: 120_000 });
  } catch (e) {
    if (/ENOTFOUND|EAI_AGAIN|network|offline/i.test(`${e.stdout}${e.stderr}`)) {
      console.log('    skipped: no registry reachable');
      return;
    }
    assert.fail(`the real audit reports a production advisory:\n${e.stdout}${e.stderr}`);
  }
  assert.match(out, /No high or critical advisory/);
});

test('an unreachable audit service is NOT reported as clean', () => {
  // `npm audit` exits non-zero for a network failure and for a finding alike.
  // Without separating them, an offline runner reports every dependency as
  // advisory-laden — and a gate that cries wolf when the network hiccups is one
  // people disable. Exit 2, its own code, so a caller cannot read "we could not
  // look" as "we looked and found nothing".
  const r = withStubbedNpm(1, '{"metadata":{"vulnerabilities":{"total":0}}}', 'npm ERR! code ENOTFOUND');
  assert.equal(r.code, 2, 'a network failure must not share an exit code with a finding');
  assert.match(r.out, /could not reach the audit service/i);
  assert.match(r.out, /NOT a clean scan/i);
  assert.ok(!/No high or critical advisory/.test(r.out),
    'it must not also claim the dependencies are clean');
});

test('a real finding is still distinguished from a network failure', () => {
  const r = withStubbedNpm(1, '{"metadata":{"vulnerabilities":{"total":0}}}', 'found 1 high severity vulnerability');
  assert.equal(r.code, 1, 'a genuine advisory keeps its own exit code');
  assert.match(r.out, /carry a high or critical advisory/);
});
