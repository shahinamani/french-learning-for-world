/**
 * A guard, not a convention.
 *
 * Every import in this suite once pointed at `app/` — the vanilla portal — and
 * none at `web/`, which is what a learner loads. Forty-two of ninety-seven
 * tests exercised code that is not in the build, and nothing was watching,
 * because extensionless imports resolve in Vite and not in Node so the path of
 * least resistance was to test the old plain-JavaScript portal.
 *
 * `app/` is still deployed until the parity conditions in docs/07 are met, so
 * testing it is legitimate — but a file may only do so ON PURPOSE, by saying so
 * at the top. Every other test file is held to the shipped code.
 *
 * This runs in the `test` job, which is a required status check on `main`, so
 * a new test that quietly points at `app/` cannot merge.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const DIR = new URL('./', import.meta.url);
const SELF = 'suite-targets-the-build.test.js';
// This file necessarily contains the marker string it searches for, so it must
// exclude itself or it reports itself — the same self-reference that made the
// exam-papers check fail on the project's own "no past papers" disclaimer.
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.test.js') && f !== SELF);

/** A file declaring, in its own header, that `app/` is what it means to test. */
const MARKER = 'THIS FILE TESTS `app/`';

const read = (f) => readFileSync(new URL(f, DIR), 'utf8');
const importsFrom = (src, dir) =>
  [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((p) => p.startsWith(`../${dir}/`));

test('the suite is not empty — a guard over no files guards nothing', () => {
  assert.ok(FILES.length >= 8, `found ${FILES.length} test files`);
});

test('no test imports from app/ unless it says at the top that it means to', () => {
  const offenders = [];
  for (const f of FILES) {
    const src = read(f);
    const appImports = importsFrom(src, 'app');
    if (appImports.length && !src.includes(MARKER)) {
      offenders.push(`${f} imports ${appImports.join(', ')} without declaring "${MARKER}"`);
    }
  }
  assert.deepEqual(offenders, [],
    'a test that points at app/ is not evidence about the shipped app — ' +
    'either point it at web/, or declare in the file header that it tests app/ on purpose');
});

test('a file does not test both app/ and web/ — it cannot be evidence about both', () => {
  const offenders = [];
  for (const f of FILES) {
    const src = read(f);
    if (importsFrom(src, 'app').length && importsFrom(src, 'web').length) offenders.push(f);
  }
  assert.deepEqual(offenders, [], 'mixed-target test files');
});

test('every declared app/ test really does import from app/', () => {
  // The reverse drift: a file keeps the marker after being pointed at web/,
  // and the marker stops meaning anything.
  const stale = FILES.filter((f) => {
    const src = read(f);
    return src.includes(MARKER) && importsFrom(src, 'app').length === 0;
  });
  assert.deepEqual(stale, [], 'files claiming to test app/ but importing nothing from it');
});

test('a module under unit test does not need web dependencies installed', () => {
  // The `test` CI job installs nothing from `web/`. A tested lib module that
  // imports a bare package — `react`, `idb`, `ts-fsrs` — is unloadable there,
  // and the suite goes red on a clean runner while passing on any machine that
  // happens to have web/node_modules. That happened: `useTick` lived in
  // lib/timer.ts and pulled in React, and it was only caught by CI on the
  // rebuilt repository. A type-only import is fine: types are stripped.
  const ROOT_DEPS = new Set(['playwright', 'axe-core']);
  const offenders = [];
  const tested = new Set();
  for (const f of FILES) {
    for (const p of importsFrom(read(f), 'web')) {
      const m = /web\/src\/(.+\.tsx?)$/.exec(p);
      if (m) tested.add(m[1]);
    }
  }
  for (const rel of tested) {
    const src = readFileSync(new URL(`../web/src/${rel}`, DIR), 'utf8');
    for (const m of src.matchAll(/^import\s+(type\s+)?[^'"]*from\s+['"]([^'".][^'"]*)['"]/gm)) {
      const [, typeOnly, spec] = m;
      if (typeOnly) continue;                       // stripped at runtime
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!ROOT_DEPS.has(pkg)) offenders.push(`web/src/${rel} imports '${spec}' at runtime`);
    }
  }
  assert.deepEqual(offenders, [],
    'move the React-dependent part into web/src/hooks/ and keep the lib module pure');
});

test('the shipped modules are actually covered by something', () => {
  // Naming the modules a learner depends on, so deleting their tests is visible
  // rather than silent.
  const covered = new Set();
  for (const f of FILES) {
    for (const p of importsFrom(read(f), 'web')) {
      const m = /web\/src\/lib\/([a-zA-Z-]+)\.ts/.exec(p);
      if (m) covered.add(m[1]);
    }
  }
  for (const required of ['typography', 'fold', 'answer', 'scheduler', 'timer', 'exams']) {
    assert.ok(covered.has(required), `web/src/lib/${required}.ts is imported by some test`);
  }
});
