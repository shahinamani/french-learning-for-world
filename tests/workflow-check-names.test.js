/**
 * One required status-check name, one job.
 *
 * The ruleset protecting `main` requires checks called `test` and `browser`.
 * Read back from the API, both carry `integration_id=None`, which means the
 * requirement matches on the **name alone** — nothing binds it to a workflow, a
 * job, or even to GitHub Actions.
 *
 * Both `ci.yml` and `pages.yml` had a job called `test`. The merge of pull
 * request #1 put two check runs named `test` on one commit:
 *
 *     name=test     success    runs/36866704090   (ci.yml)
 *     name=test     failure    runs/36866703259   (pages.yml)
 *
 * Branch protection reads as "nothing merges unless `test` passed". What it
 * says is "something called `test` passed". docs/lessons.md #14.
 *
 * Nothing in GitHub enforces that uniqueness, so it is enforced here. This
 * check costs nothing and the defect it prevents is invisible in the ruleset
 * itself — you can only see it by listing what a commit actually reported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));

/** The names the ruleset requires. Mirrored here deliberately: a test cannot
 *  read the ruleset (it needs an authenticated API call), so this is the one
 *  place the expectation is written down, and it is asserted with deepEqual so
 *  that changing the ruleset without changing this fails. */
const REQUIRED_CHECKS = ['browser', 'test'];

/**
 * The job names a workflow publishes as check runs.
 *
 * A job's check-run name is its key, unless the job sets `name:`, in which case
 * that wins — so a parser that only reads keys would miss exactly the renames
 * someone reaches for when they hit this problem. docs/lessons.md #11: confirm
 * the parser accepts the shape the defect lives in.
 */
function jobCheckNames(src) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];
  const names = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.trim() !== '') break;          // dedent: out of jobs:
    const key = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (!key) continue;
    let name = key[1];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[j]) || /^\S/.test(lines[j])) break;
      const override = lines[j].match(/^ {4}name:\s*(.+?)\s*$/);
      if (override) { name = override[1].replace(/^['"]|['"]$/g, ''); break; }
    }
    names.push(name);
  }
  return names;
}

/** Each job as {name, body}, body being the lines belonging to that job. */
function jobBlocks(src) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];
  const blocks = [];
  let current = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.trim() !== '') break;
    const key = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (key) { current = { name: key[1], body: [] }; blocks.push(current); continue; }
    if (current) current.body.push(line);
  }
  return blocks.map((b) => ({ name: b.name, body: b.body.join('\n') }));
}

const active = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));

test('there are workflows to check — a guard over no files guards nothing', () => {
  assert.ok(active.length >= 1, `no active workflow files found in ${dir}`);
});

test('the job parser reads both a plain key and a name: override', () => {
  const sample = [
    'name: Example', 'on: push', 'jobs:',
    '  test:', '    runs-on: ubuntu-latest', '    steps:', '      - run: echo hi',
    '  deploy:', '    name: publish', '    needs: test',
    '  browser:', '    runs-on: ubuntu-latest',
  ].join('\n');
  assert.deepEqual(jobCheckNames(sample), ['test', 'publish', 'browser'],
    'a parser that misses `name:` would miss the very rename this check is about');
  assert.deepEqual(jobCheckNames('on: push\nno jobs here\n'), []);
});

test('no two jobs in any active workflow publish the same check name', () => {
  const seen = new Map();
  const clashes = [];
  for (const file of active) {
    for (const name of jobCheckNames(readFileSync(join(dir, file), 'utf8'))) {
      if (seen.has(name)) clashes.push(`"${name}" in both ${seen.get(name)} and ${file}`);
      else seen.set(name, file);
    }
  }
  assert.deepEqual(clashes, [],
    'two jobs reporting under one name makes a required check ambiguous — docs/lessons.md #14');
});

test('each required check is produced by exactly one job', () => {
  const produced = active.flatMap((f) => jobCheckNames(readFileSync(join(dir, f), 'utf8')));
  for (const required of REQUIRED_CHECKS) {
    const n = produced.filter((p) => p === required).length;
    assert.equal(n, 1,
      `the ruleset requires "${required}" and ${n} job(s) produce it — 0 means it can never pass, 2 means it is ambiguous`);
  }
});

test('a disabled workflow is really inert, not merely renamed in spirit', () => {
  // `.disabled` works only because GitHub reads `.yml` and `.yaml` and nothing
  // else. A file left as `pages.yml.disabled.yml` would still run.
  for (const f of readdirSync(dir).filter((x) => x.includes('disabled'))) {
    assert.ok(!/\.ya?ml$/.test(f),
      `${f} is marked disabled but still ends in .yml, so GitHub will run it`);
    const head = readFileSync(join(dir, f), 'utf8').slice(0, 400);
    assert.match(head, /DISABLED/,
      `${f} is switched off with no reason at the top; the next person will not know what has to be true to turn it back on`);
  }
});

/**
 * Anything that verifies this repository: the unit suite, the browser walk, the
 * RTL walk, the contrast check, the attribution scan, the sweep.
 *
 * It was once "any job that runs the unit suite", which is the narrow reading
 * that let the browser job keep a depth-1 checkout — nothing in the walk reads
 * history *today*, which is precisely the state the Pages job was in until the
 * first day it mattered.
 */
const SUITE_ENTRYPOINT = /(?:tests|web\/e2e|design-system|scripts)\/[\w.*/-]+\.(?:m?js|sh)/;

test('any job that runs any part of the suite checks out the whole history', () => {
  // `actions/checkout` fetches depth 1 by default, and a check that reads
  // history gives a different answer at depth 1 than at full depth — so the
  // same suite passed in the workflow that set `fetch-depth: 0` and failed in
  // the one that did not. docs/lessons.md #15.
  const offenders = [];
  const runners = [];
  for (const file of active) {
    for (const job of jobBlocks(readFileSync(join(dir, file), 'utf8'))) {
      if (!SUITE_ENTRYPOINT.test(job.body)) continue;
      runners.push(`${file}:${job.name}`);
      if (!/fetch-depth:\s*0/.test(job.body)) offenders.push(`${file}:${job.name}`);
    }
  }
  // Printed, not merely counted: a number that is obviously wrong is visible,
  // a green tick is not.
  console.log(`    jobs running part of the suite: ${runners.join(', ')}`);
  assert.ok(runners.length >= 2,
    `only ${runners.length} job(s) matched — the entry-point pattern has stopped matching, so this guard is guarding nothing`);
  assert.deepEqual(offenders, [],
    'a shallow checkout gives a history-reading check a different answer than a full one');
});

test('the entry-point pattern recognises every part of the suite, not just the unit tests', () => {
  // The narrow version of this matched `tests/*.test.js` only, which is how a
  // job running the browser walk kept a depth-1 checkout.
  for (const command of [
    'node --import ./tests/register.mjs --test tests/*.test.js',
    'node web/e2e/walk.mjs /tmp/shots',
    'node web/e2e/rtl.mjs /tmp/shots',
    'node design-system/contrast-check.mjs',
    'bash scripts/check-commit-messages.sh',
    './scripts/pre-push-sweep.sh',
  ]) {
    assert.ok(SUITE_ENTRYPOINT.test(command), `entry point not recognised: ${command}`);
  }
  for (const innocent of [
    'npm ci',
    'npx playwright install --with-deps chromium',
    'npm run build',
    'curl -fsS -o /dev/null http://127.0.0.1:8793/',
  ]) {
    assert.ok(!SUITE_ENTRYPOINT.test(innocent), `pattern too broad: ${innocent}`);
  }
});

test('the fetch-depth detector fires on a job that omits it', () => {
  const withDepth = [
    'jobs:', '  test:', '    steps:',
    '      - uses: actions/checkout@v4', '        with:', '          fetch-depth: 0',
    '      - run: node --import ./tests/register.mjs --test tests/*.test.js',
  ].join('\n');
  const without = withDepth.split('\n').filter((l) => !/fetch-depth/.test(l)).join('\n');
  const runs = (src) => jobBlocks(src).filter((j) => SUITE_ENTRYPOINT.test(j.body));
  assert.equal(runs(withDepth).length, 1);
  assert.match(runs(withDepth)[0].body, /fetch-depth:\s*0/);
  assert.doesNotMatch(runs(without)[0].body, /fetch-depth:\s*0/,
    'the detector would not notice a missing fetch-depth, which is the whole defect');
});
