/**
 * Where do the first-load bytes go?  `node scripts/attribute.mjs` (after a build).
 *
 * budget.mjs says HOW MUCH the first load weighs. This says WHOSE it is, so a
 * decision about what to move is made from a measurement and not from a feel.
 *
 * Two measurements, kept apart because they answer different questions:
 *
 *  1. Dictionary groups — MARGINAL gzip cost. For each group the object
 *     literal is cut out of the built entry chunk and the chunk is gzipped
 *     again; the difference is what that group really adds to the download
 *     (gzip shares its window across the whole chunk, so gzipping a group alone
 *     would overstate it). It measures the built file, not the source. A group
 *     that has been split out of the entry chunk is reported as "not in the
 *     entry chunk", which is the point of the split.
 *  2. Modules — Rollup's `renderedLength` (bytes after tree-shaking, BEFORE
 *     minification and gzip) for each module in each eager chunk. Gzip is not
 *     per-module, so this is a size ranking, not a gzip figure, and it is
 *     labelled as such.
 *
 * The module pass runs a throwaway build into the OS temp directory and deletes
 * it afterwards; it never touches dist/.
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
const gz = (s) => gzipSync(typeof s === 'string' ? Buffer.from(s) : s).length;

// ---- the eager set, the same definition budget.mjs uses --------------------
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const eager = new Set();
for (const m of html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/g)) eager.add(m[1].replace('assets/', ''));
console.log('EAGER CHUNKS (gzip)');
let total = 0;
for (const f of eager) {
  const n = gz(readFileSync(join(dist, 'assets', f)));
  total += n;
  console.log(`  ${kb(n).padStart(10)}  ${f}`);
}
console.log(`  ${kb(total).padStart(10)}  total\n`);

// ---- 1. dictionary groups, marginal ----------------------------------------
/** Brace-match the object literal that starts at `start` (a "{"), skipping strings. */
function literalEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  throw new Error('unbalanced literal');
}

/** Every English group in lib/i18n.ts and lib/locales/en/*.ts, by its first key. */
const libDir = join(root, 'src/lib');
const sources = [join(libDir, 'i18n.ts'),
  ...readdirSync(join(libDir, 'locales', 'en')).filter((f) => f.endsWith('.ts')).map((f) => join(libDir, 'locales', 'en', f))];
const groups = [];
for (const file of sources) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^(?:export )?const (en|\w+En)\b[^=]*= \{\n/gm)) {
    const key = src.slice(m.index + m[0].length).split('\n')
      .map((l) => l.match(/^\s*([A-Za-z_]\w*):/)).find(Boolean)?.[1];
    groups.push([m[1], key]);
  }
}

const entryFile = [...eager].find((f) => /^index-/.test(f));
const entry = readFileSync(join(dist, 'assets', entryFile), 'utf8');
const entryGz = gz(entry);
console.log(`DICTIONARY, marginal gzip cost inside ${entryFile} (${kb(entryGz)} gzip)`);
let dictTotal = 0;
for (const [name, key] of groups) {
  const at = entry.indexOf(`{${key}:`);
  if (at < 0) {
    console.log(`  ${name.padEnd(14)} not in the entry chunk (first key ${key})`);
    continue;
  }
  const end = literalEnd(entry, at);
  const marginal = entryGz - gz(entry.slice(0, at) + '{}' + entry.slice(end));
  dictTotal += marginal;
  console.log(`  ${name.padEnd(14)} ${kb(marginal).padStart(10)} gzip   ${String(end - at).padStart(6)} B minified`);
}
console.log(`  ${'sum'.padEnd(14)} ${kb(dictTotal).padStart(10)} gzip (marginal costs are not exactly additive)\n`);

// ---- 2. packages and source areas, standalone gzip -------------------------
// A throwaway, MINIFIED build in which every module is put in a chunk named for
// its bucket (an npm package, or a source area), then each chunk is gzipped on
// its own. Standalone gzip slightly overstates a bucket (it loses the shared
// window), and the buckets sum to a little more than the real first load; what
// it is good for is RANKING and for sizing a candidate before moving it. Only
// buckets reachable from the entry by static import are listed, because those
// are the first load.
const bucket = (id) => {
  if (id.includes('node_modules/')) {
    const parts = id.split('node_modules/').pop().split('/');
    return `pkg ${parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]}`;
  }
  const rel = id.replace(`${root}/src/`, '');
  if (rel === id) return null;
  const seg = rel.split('/');
  const last = (s) => s.replace(/\.tsx?$/, '');
  return `src ${seg[0] === 'lib' ? `lib/${last(seg[1])}` : seg.length > 1 ? `${seg[0]}/${last(seg[1])}` : last(seg[0])}`;
};
const out = mkdtempSync(join(tmpdir(), 'flw-attr-'));
const rows = [];
try {
  await build({
    root, logLevel: 'silent', configFile: join(root, 'vite.config.ts'),
    build: {
      outDir: out, emptyOutDir: true, reportCompressedSize: false,
      rollupOptions: { output: { manualChunks: (id) => bucket(id) } },
    },
    plugins: [{
      name: 'attribute',
      generateBundle(_o, bundle) {
        const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
        const entry = chunks.find((c) => c.isEntry);
        const reach = new Set([entry.fileName]);
        for (const f of reach) for (const d of bundle[f].imports) reach.add(d);
        for (const f of reach) rows.push([bundle[f].name, gz(bundle[f].code)]);
      },
    }],
  });
} finally { rmSync(out, { recursive: true, force: true }); }
rows.sort((a, b) => b[1] - a[1]);
console.log('FIRST-LOAD BUCKETS (standalone gzip; ranking, not an exact partition)');
rows.slice(0, 26).forEach(([n, g]) => console.log(`  ${kb(g).padStart(10)}  ${n}`));
console.log(`  ${kb(rows.reduce((s, [, g]) => s + g, 0)).padStart(10)}  sum of all ${rows.length} buckets`);
