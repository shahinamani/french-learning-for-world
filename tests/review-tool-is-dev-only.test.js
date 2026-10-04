/**
 * The review tool writes to disk. Nothing a learner loads may be able to.
 *
 * Written **before the endpoint exists**, on Shahin's instruction, because the
 * cheapest moment to constrain a write path is before there is one. A tool that
 * accepts a POST and writes JSON into `content/` is exactly the shape that must
 * never reach a build: in development it is a keyboard-driven review screen; in
 * anything a stranger can load it is an unauthenticated file writer.
 *
 * Three independent claims, because any one of them alone has a hole:
 *
 *   1. the plugin is `apply: 'serve'`, so Vite never includes it in a build;
 *   2. nothing under `web/src/` — the code that IS built — mentions the
 *      endpoint, so even a mistaken `apply` could not produce a caller;
 *   3. the endpoint prefix is defined in exactly one place, so these checks
 *      cannot be defeated by a second spelling of the same string.
 *
 * docs/lessons.md #1: a check that cannot fail is decoration. Each of the three
 * is run against a planted sample on every run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The one spelling of the review endpoint. Changing it here is the only way. */
const ENDPOINT = '/__review';
const PLUGIN = join(root, 'web/vite-plugins/review.ts');

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? walk(p) : [p];
}) : []);

test('the endpoint prefix is distinctive enough to be greppable', () => {
  // `/api` or `/save` would collide with ordinary words and make every check
  // below unreliable. A double underscore appears nowhere else in this codebase.
  assert.match(ENDPOINT, /^\/__[a-z]+$/, 'the endpoint must be an unmistakable, reserved-looking path');
});

test('no file in the built application mentions the review endpoint', () => {
  const files = walk(join(root, 'web/src'));
  assert.ok(files.length >= 20, `only ${files.length} source files scanned — this guard is guarding nothing`);
  const hits = files.filter((f) => readFileSync(f, 'utf8').includes(ENDPOINT))
    .map((f) => relative(root, f));
  assert.deepEqual(hits, [],
    `web/src is what a learner loads. Nothing there may call ${ENDPOINT}`);
});

test('the review plugin, once it exists, is serve-only and never bundled', (t) => {
  if (!existsSync(PLUGIN)) {
    // Not a skip that hides anything: the two checks above already hold the
    // line, and this one has nothing to assert until the file is written.
    t.skip(`${relative(root, PLUGIN)} does not exist yet — the other two checks still apply`);
    return;
  }
  const src = readFileSync(PLUGIN, 'utf8');
  assert.match(src, /apply:\s*'serve'/,
    "the plugin must declare apply: 'serve', or Vite will include it in a build");
  assert.match(src, /configureServer/,
    'a serve-only plugin hooks configureServer; anything else suggests it also runs at build time');
  assert.doesNotMatch(src, /transform\s*\(|renderChunk\s*\(|generateBundle\s*\(/,
    'build hooks in a serve-only plugin mean it is not serve-only');
});

test('the plugin is handed a decoded path, not a URL pathname', () => {
  // This repository lives under "Projects Shahin". `new URL(...).pathname`
  // percent-encodes the space, so the plugin opened every file at a path that
  // does not exist and the dev server answered nothing — it started cleanly and
  // died on the first request, which is the worst way for this to fail.
  const cfg = readFileSync(join(root, 'web/vite.config.ts'), 'utf8');
  assert.match(cfg, /fileURLToPath/,
    'the plugin root must come from fileURLToPath, which decodes');
  assert.doesNotMatch(cfg, /import\.meta\.url\)\.pathname/,
    '.pathname percent-encodes; a space in the repository path breaks every file read');
});

test('the vite config does not add the review plugin unconditionally', (t) => {
  const cfg = readFileSync(join(root, 'web/vite.config.ts'), 'utf8');
  // The import path, not the word "review" — the config already contains that
  // word in a comment about reviewing from file://, and the first version of
  // this check failed on it. A detector too broad is switched off as fast as
  // one too narrow (docs/lessons.md #15).
  if (!/vite-plugins\/review/.test(cfg)) {
    t.skip('the config does not import the review plugin yet');
    return;
  }
  // Either the plugin is serve-only by its own declaration (checked above) or
  // the config gates it on the command. Both is better; one is required.
  const gated = /command\s*===\s*'serve'/.test(cfg) || /mode\s*===\s*'development'/.test(cfg);
  const pluginDeclaresServe = existsSync(PLUGIN)
    && /apply:\s*'serve'/.test(readFileSync(PLUGIN, 'utf8'));
  assert.ok(gated || pluginDeclaresServe,
    'the review plugin must be gated on the dev command or declare apply: serve');
});

// ── Each claim, run against a planted sample ────────────────────────────────

test('the detectors fire on planted samples', () => {
  const mentions = (text) => text.includes(ENDPOINT);
  assert.ok(mentions(`fetch('${ENDPOINT}/save', { method: 'POST' })`),
    'a caller in application code would not be detected');
  assert.ok(mentions(`const url = "${ENDPOINT}/gloss";`), 'a bare string would not be detected');
  assert.ok(!mentions("fetch('/api/save')"), 'the detector is too broad');

  const serveOnly = (src) => /apply:\s*'serve'/.test(src);
  assert.ok(serveOnly("export default { name: 'review', apply: 'serve', configureServer() {} }"));
  assert.ok(!serveOnly("export default { name: 'review', configureServer() {} }"),
    'a plugin with no apply would be accepted as serve-only');

  const hasBuildHook = (src) => /transform\s*\(|renderChunk\s*\(|generateBundle\s*\(/.test(src);
  assert.ok(hasBuildHook('export default { transform() {} }'), 'a build hook would not be detected');
  assert.ok(!hasBuildHook('export default { configureServer() {} }'), 'too broad');

  // And the config detector must read the import, not the English word.
  const imports = (cfg) => /vite-plugins\/review/.test(cfg);
  assert.ok(imports("import review from './vite-plugins/review';"));
  assert.ok(!imports('// keeps it working from file:// during review.'),
    'a comment containing the word "review" must not be read as importing the plugin');
});
