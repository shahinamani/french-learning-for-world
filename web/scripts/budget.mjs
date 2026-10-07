/**
 * The first-load JavaScript budget, measured on every build.
 *
 * The budget — 150 KB gzipped of JS, 30 KB of CSS — has been in the documents
 * since the first week, and until now nothing enforced it. What existed instead
 * was a COMMENT in src/main.tsx stating "8 026 bytes of headroom left", typed
 * once by somebody who had measured it that day. By the time this file was
 * written the true figure was 12 882, so the comment was not merely stale: it
 * understated the headroom, which is the direction that makes people decline
 * changes they could afford.
 *
 * This repository has shipped exactly that fault before, in a comment claiming
 * a 26 KB index that had grown to 71 KB, and the lesson written down afterwards
 * was: a comment stating a measured size is a claim, and a claim nothing checks
 * goes stale silently. So this measures.
 *
 * It counts the entry chunk and everything the entry imports eagerly — which is
 * what a first visit actually downloads — and not the lazy chunks, because a
 * learner who never opens the exams section never pays for it. The lazy chunks
 * are printed anyway, so that a route quietly becoming eager is visible rather
 * than merely allowed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const BUDGET_JS = 150 * 1024;
const BUDGET_CSS = 30 * 1024;

const html = readFileSync(join(dist, 'index.html'), 'utf8');

/** Everything the HTML pulls in before anything runs: scripts and stylesheets. */
const eager = new Set();
for (const m of html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)) eager.add(m[1]);
// Vite emits `<link rel="modulepreload">` for the entry's static imports. Those
// are part of the first load even though no <script> tag names them, and
// missing them would make the measurement smaller than the download.
if (eager.size === 0) {
  console.error('BUDGET FAILED: no assets found in index.html — the measurement read nothing.');
  process.exit(1);
}

/**
 * The HTML is not taken on trust.
 *
 * It names the entry and whatever Vite chose to preload, and "whatever Vite
 * chose" is not a specification. So the static-import closure is walked from
 * the entry chunk and compared: a chunk reachable by STATIC import is part of
 * the first load whether or not a preload tag mentions it, and a disagreement
 * means this script is measuring something other than what a visitor downloads.
 *
 * It found one on its first run — against me. I had hand-counted the first load
 * as four chunks and this said three, and the walk settled it: `scheduler` is a
 * DYNAMIC import of the entry, so it is not first-load at all. The measurement
 * was right and the person was wrong, which is the usual way round.
 */
const staticImports = (file) => [...new Set(
  [...readFileSync(join(dist, 'assets', file), 'utf8')
    .matchAll(/from"\.\/([A-Za-z0-9_-]+\.js)"/g)].map((m) => m[1]))];

const entry = [...eager].find((f) => f.endsWith('.js') && /index-[^/]*\.js$/.test(f));
if (!entry) {
  console.error('BUDGET FAILED: the entry chunk is not named in index.html.');
  process.exit(1);
}
const closure = new Set([entry.replace('assets/', '')]);
for (const file of closure) for (const dep of staticImports(file)) closure.add(dep);

const namedInHtml = new Set([...eager].filter((f) => f.endsWith('.js')).map((f) => f.replace('assets/', '')));
const onlyInClosure = [...closure].filter((f) => !namedInHtml.has(f));
const onlyInHtml = [...namedInHtml].filter((f) => !closure.has(f));
if (onlyInClosure.length || onlyInHtml.length) {
  console.error('BUDGET FAILED: the HTML and the import graph disagree about the first load.');
  if (onlyInClosure.length) console.error(`  statically imported but not preloaded: ${onlyInClosure.join(', ')}`);
  if (onlyInHtml.length) console.error(`  preloaded but not statically imported: ${onlyInHtml.join(', ')}`);
  process.exit(1);
}

const gz = (p) => gzipSync(readFileSync(join(dist, p))).length;
const js = [...eager].filter((f) => f.endsWith('.js'));
const css = [...eager].filter((f) => f.endsWith('.css'));

const jsBytes = js.reduce((n, f) => n + gz(f), 0);
const cssBytes = css.reduce((n, f) => n + gz(f), 0);

const all = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'));
const lazy = all.filter((f) => !eager.has(`assets/${f}`));

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`first load: ${kb(jsBytes)} JS of ${kb(BUDGET_JS)} `
  + `(${kb(BUDGET_JS - jsBytes)} spare), ${kb(cssBytes)} CSS of ${kb(BUDGET_CSS)} `
  + `· ${js.length} eager chunks, ${lazy.length} lazy`);

let failed = false;
if (jsBytes > BUDGET_JS) {
  console.error(`BUDGET FAILED: first-load JS is ${kb(jsBytes)}, over the ${kb(BUDGET_JS)} budget `
    + `by ${kb(jsBytes - BUDGET_JS)}.`);
  console.error(js.map((f) => `  ${kb(gz(f))}  ${f}`).join('\n'));
  failed = true;
}
if (cssBytes > BUDGET_CSS) {
  console.error(`BUDGET FAILED: first-load CSS is ${kb(cssBytes)}, over the ${kb(BUDGET_CSS)} budget.`);
  failed = true;
}
// A build that measured nothing must not report success — the same shape as
// "the scan covered 0 commits and called it clean".
if (jsBytes < 50 * 1024) {
  console.error(`BUDGET FAILED: first-load JS measured ${kb(jsBytes)}, which is implausibly `
    + 'small — the asset discovery is broken, not the bundle.');
  failed = true;
}
process.exit(failed ? 1 : 0);
