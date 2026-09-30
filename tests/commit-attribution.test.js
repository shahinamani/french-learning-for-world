/**
 * Proves `scripts/check-commit-messages.sh` actually catches what it exists for.
 *
 * A one-off red run proves the check worked once, on one commit, and leaves that
 * commit in the repository's history forever — which is precisely the harm being
 * prevented here. So the proof is built in instead: this test creates a
 * throwaway git repository in a temp directory, plants the offending message in
 * it, and asserts the script fails. It runs on every push, so the detector is
 * seen red continuously rather than once.
 *
 * The forbidden strings below are file content, not commit messages. The script
 * scans messages only, so documentation may discuss the episode by name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/check-commit-messages.sh', import.meta.url));

/** A throwaway repository with one commit carrying `message`. */
function repoWith(message) {
  const dir = mkdtempSync(join(tmpdir(), 'attrib-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', 'Shahin Amani']);
  // A placeholder, not the owner's real address: this is a public repository
  // and Part 0 forbids any email address in a tracked file beyond commit metadata.
  git(['config', 'user.email', 'author@example.invalid']);
  writeFileSync(join(dir, 'a.txt'), 'x'.repeat(80));
  git(['add', 'a.txt']);
  execSync('git commit -q --allow-empty-message -F -', { cwd: dir, input: message });
  return dir;
}

/** Run the script in `dir`; return its exit code and output. */
function run(dir) {
  try {
    const out = execFileSync('bash', [SCRIPT], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const CLEAN = 'Add the verb conjugation table\n\nSix tenses, six persons, derived by rule.\n';

test('the script passes on a clean history', () => {
  const dir = repoWith(CLEAN);
  try {
    const { code, out } = run(dir);
    assert.equal(code, 0, `expected pass, got ${code}: ${out}`);
    assert.match(out, /No tool attribution/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Each of these must make it fail. This is the SEEN_RED record, executed.
const OFFENDING = [
  ['a co-author trailer', `${CLEAN}\nCo-Authored-By: Someone <noreply@example.com>\n`],
  ['the vendor name', `${CLEAN}\nCo-Authored-By: Cl` + `aude <x@y>\n`],
  ['the company name', `${CLEAN}\nsigned off via an` + `thropic tooling\n`],
  ['a generated-with line', `${CLEAN}\nGenerated with a code tool\n`],
  ['the robot emoji', `${CLEAN}\n\u{1F916} generated\n`],
  ['lower case', `${CLEAN}\nco-authored-by: someone <x@y>\n`],
];

for (const [label, message] of OFFENDING) {
  test(`the script FAILS on ${label}`, () => {
    const dir = repoWith(message);
    try {
      const { code, out } = run(dir);
      assert.equal(code, 1, `expected exit 1 for ${label}, got ${code}: ${out}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('the script fails, rather than passing, when it reads nothing', () => {
  // An empty repository has no commits. "Nothing to check" must not read as
  // "clean" — that shape has appeared repeatedly on this project.
  const dir = mkdtempSync(join(tmpdir(), 'attrib-empty-'));
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir, stdio: 'pipe' });
    const { code } = run(dir);
    assert.equal(code, 2, 'an unreadable or empty history exits 2, not 0');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('documentation may discuss the episode without tripping the check', () => {
  // docs/lessons.md names the vendor repeatedly. The script scans messages, not
  // files, and this asserts that distinction rather than assuming it.
  const dir = repoWith(CLEAN);
  try {
    writeFileSync(join(dir, 'lessons.md'),
      'The trailer said Co-Authored-By: Cl' + 'aude, from An' + 'thropic tooling.\n');
    execFileSync('git', ['add', 'lessons.md'], { cwd: dir, stdio: 'pipe' });
    execSync('git commit -q -F -', { cwd: dir, input: 'Record the episode in the lessons list\n' });
    const { code } = run(dir);
    assert.equal(code, 0, 'file content naming the episode must not fail the check');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
