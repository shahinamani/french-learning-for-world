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
import { gitFreeEnv, REDIRECTING_VARIABLES } from './git-env.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/check-commit-messages.sh', import.meta.url));

/**
 * A throwaway repository with one commit carrying `message`.
 *
 * `cwd` is not enough to make this throwaway, and `env` is why — see
 * `tests/git-env.mjs`. `GIT_DIR` is in the environment whenever the suite runs
 * from a git hook, which is how the pre-push sweep runs it, and it beats `cwd`:
 * from a worktree this function committed its fixtures into the real
 * repository and wrote the identity below into the config every worktree
 * shares.
 */
function repoWith(message) {
  const dir = mkdtempSync(join(tmpdir(), 'attrib-'));
  const env = gitFreeEnv();
  const git = (args) => execFileSync('git', args, { cwd: dir, env, stdio: 'pipe' });
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', 'Shahin Amani']);
  // A placeholder, not the owner's real address: this is a public repository
  // and Part 0 forbids any email address in a tracked file beyond commit metadata.
  git(['config', 'user.email', 'author@example.invalid']);
  writeFileSync(join(dir, 'a.txt'), 'x'.repeat(80));
  git(['add', 'a.txt']);
  execSync('git commit -q --allow-empty-message -F -', { cwd: dir, env, input: message });
  return dir;
}

/**
 * Run the script in `dir`; return its exit code and output.
 *
 * The env matters here as much as in `repoWith`. The script scans
 * `git log --all`, so with `GIT_DIR` inherited it reads the REAL repository's
 * every ref while the test believes it is reading a one-commit fixture — and
 * then "the script passes on a clean history" is a statement about this
 * project's history, which is not what it claims to assert.
 */
function run(dir) {
  try {
    const out = execFileSync('bash', [SCRIPT],
      { cwd: dir, env: gitFreeEnv(), encoding: 'utf8', stdio: 'pipe' });
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
//
// Two entries left this list on 2026-10-07, on Shahin's ruling, and the reason
// is worth more than the cases were: the pattern used to match the bare word
// `Claude` and the bare phrase `Generated with`, so it would have refused a
// commit message saying "CLAUDE.md rewritten" or "Generated with the new
// harvester". **A blocking check must be more precise than an auditing one** —
// false positives are free in an audit, where a person reads the output, and
// expensive in a gate, because a guard that cries wolf gets bypassed with
// --no-verify and is then worth less than nothing.
//
// Nothing that actually happened here stops being caught: the trailer of
// 2026-10-06 matches three of these independently.
const OFFENDING = [
  ['a co-author trailer', `${CLEAN}\nCo-Authored-By: Someone <noreply@example.com>\n`],
  ['the vendor name in a trailer', `${CLEAN}\nCo-Authored-By: Cl` + `aude <x@y>\n`],
  ['the vendor address', `${CLEAN}\nreported by nore` + `ply@anthropic.com\n`],
  ['the product name as a phrase', `${CLEAN}\nrewritten with Cl` + `aude Code\n`],
  ['a generated-with line naming a tool', `${CLEAN}\nGenerated with Cu` + `rsor\n`],
  ['a generated-with line carrying a URL', `${CLEAN}\nGenerated with [a tool](https://example.com)\n`],
  ['the robot emoji', `${CLEAN}\n\u{1F916} generated\n`],
  ['lower case', `${CLEAN}\nco-authored-by: someone <x@y>\n`],
];

/**
 * And these must NOT fail. This half is why the guard survives: a check nobody
 * can work around is only useful if nobody needs to.
 */
const ORDINARY = [
  ['a filename is not a byline', `${CLEAN}\nCL` + `AUDE.md rewritten and moved\n`],
  ['ordinary English about generating', `${CLEAN}\nGenerated with the new harvester, not by hand\n`],
  ['generated BY a script', `${CLEAN}\ncontent/verbs.json is generated by scripts/build-verbs.py\n`],
  ['the vendor word alone', `${CLEAN}\nMove the cl` + `aude config out of the repository\n`],
  ['the company word alone', `${CLEAN}\nNote which an` + `thropic models the docs mention\n`],
  ['a sentence about the trailer', `${CLEAN}\nCo-Authored-By has nothing to do with this change\n`],
];

for (const [label, message] of ORDINARY) {
  test(`the script ACCEPTS ${label}`, () => {
    const dir = repoWith(message);
    try {
      const { code, out } = run(dir);
      assert.equal(code, 0, `a legitimate message was refused — ${label}: ${out}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

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
    execFileSync('git', ['init', '-q', '-b', 'main'],
      { cwd: dir, env: gitFreeEnv(), stdio: 'pipe' });
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
    execFileSync('git', ['add', 'lessons.md'], { cwd: dir, env: gitFreeEnv(), stdio: 'pipe' });
    execSync('git commit -q -F -',
      { cwd: dir, env: gitFreeEnv(), input: 'Record the episode in the lessons list\n' });
    const { code } = run(dir);
    assert.equal(code, 0, 'file content naming the episode must not fail the check');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/**
 * The fixtures stay in the temp directory even when git's environment says
 * otherwise. This is the check that was missing, and the defect it describes
 * really happened.
 *
 * On 2026-10-10 a push from a git worktree ran this suite through the pre-push
 * hook. `git` exports `GIT_DIR` to a hook, and from a worktree that value is
 * ABSOLUTE, so every "throwaway" git command above addressed the real
 * repository instead: two fixture commits landed on the live branch,
 * `core.bare` was set to true, and `user.email` became
 * `author@example.invalid` in the config that every worktree of this
 * repository shares. The next commit anybody made would have carried the
 * wrong author, which is the GitHub-contributions rule broken by a test run.
 *
 * In the MAIN checkout the same code is safe, and that is the part worth
 * understanding: there git exports the relative string `.git`, which resolves
 * inside whatever `cwd` the child was given — the throwaway repository. The
 * isolation was real for a year and it was an accident of one environment.
 *
 * The victim here is a second throwaway repository, never this one. A probe
 * that proved the point by damaging the repository would be the defect, not
 * the test for it.
 */
test('a hostile GIT_DIR cannot reach out of the fixture', () => {
  const victim = repoWith(CLEAN);
  const before = {
    head: execFileSync('git', ['rev-parse', 'HEAD'],
      { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
    commits: execFileSync('git', ['rev-list', '--count', '--all'],
      { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
    email: execFileSync('git', ['config', 'user.email'],
      { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
    bare: execFileSync('git', ['config', '--get', 'core.bare'],
      { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
  };

  // Exactly what a git hook hands its children, with the absolute form a
  // worktree produces.
  const saved = process.env.GIT_DIR;
  process.env.GIT_DIR = join(victim, '.git');
  let fixture;
  try {
    fixture = repoWith(CLEAN);
    const { code, out } = run(fixture);
    assert.equal(code, 0, `the fixture is clean, so the scan passes: ${out}`);

    const after = {
      head: execFileSync('git', ['rev-parse', 'HEAD'],
        { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
      commits: execFileSync('git', ['rev-list', '--count', '--all'],
        { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
      email: execFileSync('git', ['config', 'user.email'],
        { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
      bare: execFileSync('git', ['config', '--get', 'core.bare'],
        { cwd: victim, env: gitFreeEnv(), encoding: 'utf8' }).trim(),
    };

    // Each of the four is one of the four things that actually got damaged.
    assert.equal(after.head, before.head,
      'building a fixture moved the HEAD of the repository GIT_DIR pointed at');
    assert.equal(after.commits, before.commits,
      'building a fixture added commits to the repository GIT_DIR pointed at');
    assert.equal(after.email, before.email,
      'building a fixture rewrote user.email in the repository GIT_DIR pointed at');
    assert.equal(after.bare, before.bare,
      'building a fixture rewrote core.bare in the repository GIT_DIR pointed at');
  } finally {
    if (saved === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = saved;
    rmSync(victim, { recursive: true, force: true });
    if (fixture) rmSync(fixture, { recursive: true, force: true });
  }
});

test('the helper strips every variable that can redirect a git command', () => {
  // `GIT_DIR` is the one that bit, and fixing only that one is how the next
  // variable gets through. The list is asserted whole, so adding a stripped
  // name without recording it here fails, and so does quietly dropping one.
  const hostile = {};
  for (const name of REDIRECTING_VARIABLES) hostile[name] = '/nowhere';
  const saved = { ...process.env };
  try {
    Object.assign(process.env, hostile);
    const env = gitFreeEnv();
    const leaked = REDIRECTING_VARIABLES.filter((n) => n in env);
    assert.deepEqual(leaked, [], `these would still redirect git: ${leaked.join(', ')}`);
    assert.ok(REDIRECTING_VARIABLES.includes('GIT_DIR'),
      'GIT_DIR is the variable this whole episode was about');
    // And it is a filter, not a blank slate: a child still needs its PATH.
    assert.equal(gitFreeEnv().PATH, process.env.PATH, 'the rest of the environment survives');
    assert.equal(gitFreeEnv({ SKIP_FETCH: '1' }).SKIP_FETCH, '1', 'a caller may set what it means to');
  } finally {
    for (const name of REDIRECTING_VARIABLES) {
      if (name in saved) process.env[name] = saved[name]; else delete process.env[name];
    }
  }
});
