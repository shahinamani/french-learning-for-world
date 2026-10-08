/**
 * The personal-data scanner, and the two things about it that went wrong.
 *
 * It existed twice — once in `scripts/pre-push-sweep.sh`, once inline in CI —
 * with the same intent and two patterns. Only the local one had been widened to
 * catch a REGEX-ESCAPED address, which is how an address appears in source
 * code, because source code is where matchers live. So a local pass and a CI
 * pass meant different things, and `CHECKLIST.md` recorded it as a gap.
 *
 * It also printed what it found. On a public repository that turns a near miss
 * into the exposure the scanner exists to prevent: the address lands in a CI
 * log anyone can read.
 *
 * Every address below is built by concatenation at runtime. Writing one as a
 * literal would make this file trip the very scanner it tests — which is worth
 * knowing, because it is also why the escaped form matters.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(root, 'scripts/check-personal-data.sh');

/** Run the scanner over a directory of planted files. */
function scan(files) {
  const dir = mkdtempSync(join(tmpdir(), 'pd-'));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    try {
      const out = execFileSync('bash', [SCRIPT, dir], { encoding: 'utf8', cwd: root });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const user = 'some' + 'one';
const plain = `${user}@gmail.com`;
const escaped = `${user}@gmail\\.com`;

test('a plain address is refused', () => {
  const r = scan({ 'a.txt': `write to ${plain} today\n` });
  assert.equal(r.code, 1);
  assert.match(r.out, /a\.txt:1/);
});

test('a REGEX-ESCAPED address is refused — the gap this closes', () => {
  // `@gmail\.com` inside a pattern. The un-widened CI copy expected a dot
  // immediately after the domain and walked straight past the backslash.
  const r = scan({ 'b.test.js': `assert.match(s, /${escaped}/);\n` });
  assert.equal(r.code, 1, 'an escaped address must not pass');
  assert.match(r.out, /b\.test\.js:1/);
});

test('it never prints the address it found', () => {
  const r = scan({ 'c.txt': `${plain}\n`, 'd.js': `/${escaped}/\n` });
  assert.equal(r.code, 1);
  assert.ok(!r.out.includes(plain), 'the plain address leaked into the output');
  assert.ok(!r.out.includes(`${user}@gmail`), 'a fragment of the address leaked');
  assert.match(r.out, /c\.txt:1/);
  assert.match(r.out, /d\.js:1/);
  assert.match(r.out, /not printed/i, 'and it says why it is withholding');
});

test('ordinary addresses that are not personal are left alone', () => {
  const r = scan({
    'ok.txt': 'write to user@example.com or team@company.co or a@b.invalid\n',
    'ok2.md': 'noreply@github.com and 1234+name@users.noreply.github.com\n',
  });
  assert.equal(r.code, 0, `a legitimate address was refused: ${r.out}`);
  assert.match(r.out, /No personal email address/);
});

test('more providers than the original pattern knew', () => {
  for (const domain of ['outlook.com', 'yahoo.co.uk', 'proton.me', 'icloud.com']) {
    const r = scan({ 'e.txt': `${user}@${domain}\n` });
    assert.equal(r.code, 1, `${domain} was not caught`);
  }
});

test('binary files and build output are not scanned', () => {
  // -I skips binaries; dist and node_modules are excluded. A scanner that reads
  // a 2 MB bundle byte by byte on every push is a scanner people switch off.
  const r = scan({ 'f.bin': `\u0000\u0001${plain}\u0000\n` });
  assert.equal(r.code, 0, 'a binary file should not be scanned as text');
});

test('the repository itself is clean under this scanner', () => {
  const out = execFileSync('bash', [SCRIPT], { encoding: 'utf8', cwd: root });
  assert.match(out, /No personal email address/);
});

test('both callers run this one script, so they cannot drift again', () => {
  const sweep = readFileSync(join(root, 'scripts/pre-push-sweep.sh'), 'utf8');
  const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.match(sweep, /check-personal-data\.sh/, 'the pre-push sweep must call the shared script');
  assert.match(ci, /check-personal-data\.sh/, 'CI must call the shared script');
  // And neither may carry its own copy of the pattern any more.
  for (const [name, text] of [['pre-push-sweep.sh', sweep], ['ci.yml', ci]]) {
    assert.ok(!/gmail\|outlook\|yahoo/.test(text),
      `${name} still contains its own address pattern — that is how they drifted`);
  }
});
