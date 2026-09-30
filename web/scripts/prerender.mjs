/**
 * Runs after `vite build`. Builds an SSR bundle of src/prerender.tsx, renders
 * the home route, and injects the markup into dist/index.html in place of the
 * empty #root — so the first paint is the real screen, not a spinner.
 *
 * It renders the real components, not a hand-written copy of them: a copy
 * drifts from the page the moment either changes.
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '.prerender');

await build({
  root,
  logLevel: 'error',
  build: {
    ssr: resolve(root, 'src/prerender.tsx'),
    outDir: out,
    emptyOutDir: true,
    rollupOptions: { output: { format: 'es', entryFileNames: 'prerender.mjs' } },
  },
});

const { render } = await import(pathToFileURL(resolve(out, 'prerender.mjs')).href);
const markup = render();

const indexPath = resolve(root, 'dist/index.html');
let html = readFileSync(indexPath, 'utf8');
const before = html.length;
// The placeholder holds nested divs, so a non-greedy match to the first
// </div> would cut it in half. Replace from #root up to the script tag.
const start = html.indexOf('<div id="root">');
// Vite hoists the module script into <head>, so there is no <script> after
// #root to anchor on — the placeholder runs to </body>.
const end = html.indexOf('</body>', start);
if (start < 0 || end < 0) { console.error('PRERENDER FAILED: could not find #root in dist/index.html'); process.exit(1); }
html = html.slice(0, start) + `<div id="root">${markup}</div>\n` + html.slice(end);

// A prerender that silently emitted nothing would look like a successful build
// and cost exactly the thing it exists for.
// What has to be in the HTML is the largest element on the screen — the map.
// The session card's numbers come from IndexedDB and cannot be known at build
// time, so it is prerendered in its loading state, which is correct and is
// what the learner would see for those few milliseconds anyway.
const rows = (html.match(/<th scope="row"/g) ?? []).length;
const cells = (html.match(/class="map__cell"/g) ?? []).length;
if (!/class="map"/.test(html) || rows !== 6 || cells !== 42) {
  console.error(`PRERENDER FAILED: expected a 6x7 map, found ${rows} rows and ${cells} cells.`);
  process.exit(1);
}
if (!/class="tabs"/.test(html) || !/class="bar"/.test(html)) {
  console.error('PRERENDER FAILED: the shell chrome is missing.');
  process.exit(1);
}
writeFileSync(indexPath, html);
rmSync(out, { recursive: true, force: true });
console.log(`prerendered home: index.html ${before} → ${html.length} bytes; map and session card present`);
