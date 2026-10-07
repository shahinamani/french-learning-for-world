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
// What has to be in the HTML is the LANDING page, because `/` now shows that
// to anybody the build can know about: hasStarted() reads localStorage, node
// has none, so the stranger's branch is taken. This used to assert a 6xN map
// and a session card, and those assertions would now pass on a prerender of
// the wrong page — a crawler and a first-time visitor would both read a study
// map again, which is the fault this whole change exists to fix.
const summary = JSON.parse(readFileSync(new URL('../../content/portal-summary.json', import.meta.url), 'utf8'));

for (const [what, re] of [
  ['the landing page itself', /data-testid="landing"/],
  ['the headline', /class="landing__headline"/],
  ['the way in', /data-testid="landing-start"/],
  ['what you can do today', /data-testid="landing-today"/],
  ['what is not here yet', /data-testid="landing-notyet"/],
  ['the examinations section', /data-testid="landing-exams"/],
  ['the returning-learner placeholder', /data-testid="landing-boot"/],
  ['the shell chrome', /class="tabs"/],
  ['the shell bar', /class="bar"/],
]) {
  if (!re.test(html)) {
    console.error(`PRERENDER FAILED: ${what} is missing from the prerendered HTML.`);
    process.exit(1);
  }
}

// The numbers have to be IN the static HTML, not fetched afterwards: the whole
// point of importing portal-summary.json rather than fetching it is that a
// crawler and a slow first paint read real figures. Checked against the
// generated summary, in the same locale-aware format the page renders, so this
// cannot pass on a page full of placeholders.
const fmt = (v) => new Intl.NumberFormat('en').format(v);
for (const [what, value] of [
  ['the verb count', summary.verbs],
  ['the searchable form count', summary.formsSearchable],
  ['the number of concepts with nothing to practise', summary.conceptsWithoutMaterial],
]) {
  if (!html.includes(fmt(value))) {
    console.error(`PRERENDER FAILED: ${what} (${fmt(value)}) is not in the prerendered HTML — `
      + 'the page is rendering placeholders instead of the summary.');
    process.exit(1);
  }
}

// Honesty is not a footnote: the gap section must appear before the footer, and
// within the same screenful of structure as what-you-can-do. A stylesheet or a
// reorder that drops it to the bottom is a product decision, and it fails here
// rather than shipping quietly.
const posHave = html.indexOf('data-testid="landing-today"');
const posGaps = html.indexOf('data-testid="landing-notyet"');
const posFoot = html.indexOf('class="landing__footer"');
if (!(posHave < posGaps && posGaps < posFoot)) {
  console.error('PRERENDER FAILED: "what is not here yet" must come straight after '
    + '"what you can do today" and before the footer.');
  process.exit(1);
}
// A style attribute in the prerendered HTML is blocked by the
// Content-Security-Policy, which has no 'unsafe-inline'. React's style prop at
// runtime is fine — it sets CSSOM properties — but anything rendered into this
// file is parsed as HTML and refused.
const styled = html.replace(/<!--[\s\S]*?-->/g, '').match(/<[a-z0-9]+[^>]*\sstyle="/gi);
if (styled) {
  console.error(`PRERENDER FAILED: ${styled.length} inline style attribute(s) in the `
    + `prerendered HTML. The CSP forbids them; use a utility class.`);
  process.exit(1);
}
writeFileSync(indexPath, html);
rmSync(out, { recursive: true, force: true });
console.log(`prerendered landing: index.html ${before} → ${html.length} bytes; `
  + `${summary.verbs} verbs and the gap section present`);
