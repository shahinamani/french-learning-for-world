/**
 * Four English groups travel with lazy routes instead of sitting in the first
 * load: workspaceEn, weaknessEn, grammarEn, readerEn (web/src/lib/locales/en/).
 *
 * Splitting a dictionary is safe only while two things stay true, and neither
 * is visible at the keyboard:
 *
 *   1. NO CODE IN THE FIRST LOAD ASKS FOR A LAZY KEY. If it did, that key would
 *      render as its own name until the route was opened. This is a property of
 *      the import graph, so it is checked on the import graph: walk the STATIC
 *      imports from main.tsx (a dynamic import() is a chunk boundary and is not
 *      followed) and refuse any module in that closure that mentions a lazy key.
 *   2. EVERY CODE THAT ASKS FOR ONE IS LOADED WITH IT. A module that uses the
 *      keys must be reachable from a module that imports the group, or the
 *      group may not be registered when it renders.
 *
 * And the behaviour the learner sees: Persian and Arabic legitimately lack
 * these groups and fall back to English; French carries every key itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translator, loadDictionary } from '../web/src/lib/i18n.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../web/src');
const GROUPS = ['workspaceEn', 'weaknessEn', 'grammarEn', 'readerEn'];
const groupFile = (g) => join(ROOT, 'lib/locales/en', `${g}.ts`);
const read = (p) => readFileSync(p, 'utf8');

/** Top-level keys of `export const <name> = { ... }`, from the source. */
function keysOf(name) {
  const text = read(groupFile(name));
  const open = text.indexOf('{', text.search(new RegExp(`const ${name}\\b`)));
  let depth = 0, end = -1, quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) { end = i; break; }
  }
  const body = text.slice(open + 1, end)
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""')
    .replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
  return [...body.matchAll(/(?:^|[\n,])\s*([A-Za-z_]\w*)\s*:/g)].map((m) => m[1]);
}
const KEYS = Object.fromEntries(GROUPS.map((g) => [g, keysOf(g)]));

// ── the import graph ───────────────────────────────────────────────────────
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile() && /\.tsx?$/.test(c)) return c;
  }
  return null;
}
/** Static value imports only: `import type` is erased, `import(...)` is a chunk boundary. */
function staticImports(file) {
  const text = stripComments(read(file));
  const out = [];
  for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
    const r = resolveImport(file, m[1]);
    if (r) out.push(r);
  }
  return out;
}
function closure(start) {
  const seen = new Set([start]);
  for (const f of seen) for (const d of staticImports(f)) seen.add(d);
  return seen;
}
function allSources(dir = ROOT, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) allSources(p, acc); else if (/\.tsx?$/.test(p)) acc.push(p);
  }
  return acc;
}
const SOURCES = allSources().filter((p) => !p.includes('/lib/locales/') && !p.endsWith('/lib/i18n.ts'));
const mentions = (file, keys) => {
  const text = stripComments(read(file));
  return keys.filter((k) => new RegExp(`\\b${k}\\b`).test(text));
};

const MAIN = join(ROOT, 'main.tsx');
const EAGER = closure(MAIN);

test('the scan is wired to something: main.tsx reaches the shell, and the lazy routes are not in its closure', () => {
  assert.ok(EAGER.size > 40, `only ${EAGER.size} modules reached from main.tsx; the import walk is broken`);
  assert.ok([...EAGER].some((f) => f.endsWith('components/Shell.tsx')), 'Shell is in the first load');
  for (const lazy of ['features/reader/index.tsx', 'features/grammar/index.ts',
                      'features/workspace/Workspace.tsx', 'features/weakness/WeaknessCard.tsx']) {
    assert.ok(!EAGER.has(join(ROOT, lazy)), `${lazy} is a chunk of its own, not part of the first load`);
  }
  for (const g of GROUPS) assert.ok(KEYS[g].length >= 20, `${g}: ${KEYS[g].length} keys read; fix the extraction`);
});

test('no module in the first load asks for a key of a lazy group', () => {
  const offences = [];
  for (const g of GROUPS) {
    for (const f of EAGER) {
      if (f.includes('/lib/locales/') || f.endsWith('/lib/i18n.ts')) continue;
      const hit = mentions(f, KEYS[g]);
      if (hit.length) offences.push(`${f.replace(ROOT + '/', '')} uses ${g} keys: ${hit.slice(0, 4).join(', ')}`);
    }
    assert.ok(!EAGER.has(groupFile(g)), `${g} is not imported by anything in the first load`);
  }
  assert.deepEqual(offences, [], 'move the key to an eager group (see wsTitle in shellEn) or move the code');
});

test('every module that asks for a lazy key is loaded together with an import of its group', () => {
  const offences = [];
  for (const g of GROUPS) {
    const importers = SOURCES.filter((f) => staticImports(f).includes(groupFile(g)));
    assert.ok(importers.length >= 1, `${g} is imported by no route chunk, so it is never registered`);
    const covered = new Set();
    for (const i of importers) for (const f of closure(i)) covered.add(f);
    for (const f of SOURCES) {
      const hit = mentions(f, KEYS[g]);
      if (hit.length && !covered.has(f)) {
        offences.push(`${f.replace(ROOT + '/', '')} uses ${g} keys (${hit[0]}…) but no importer of ${g} reaches it`);
      }
    }
  }
  assert.deepEqual(offences, []);
});

test('the lazy groups share no key with each other, so registration order cannot matter', () => {
  const seen = new Map();
  const clash = [];
  for (const g of GROUPS) for (const k of KEYS[g]) {
    if (seen.has(k)) clash.push(`${k} in ${seen.get(k)} and ${g}`);
    seen.set(k, g);
  }
  assert.deepEqual(clash, []);
});

// ── the behaviour ─────────────────────────────────────────────────────────
// This file is a process of its own (node --test isolates files), so nothing
// has registered a group yet when the first test below runs.
test('the split is real: before a route registers its group, i18n.ts does not carry it', () => {
  for (const g of GROUPS) {
    const k = KEYS[g][0];
    assert.equal(translator('en')(k), k, `${g}.${k} must not be in the always-loaded dictionary`);
  }
});

test('Persian and Arabic fall back to English once the group is registered, and never to a key name', async () => {
  // Made BEFORE the group exists: the translator reads the English dictionary on
  // every call, so a group registered later must still be seen by it.
  const early = { fa: translator('fa'), ar: translator('ar') };
  await import('../web/src/lib/locales/english-all.ts');
  await Promise.all([loadDictionary('fa'), loadDictionary('ar')]);
  const en = translator('en');
  const bad = [];
  for (const g of GROUPS) for (const k of KEYS[g]) {
    const english = en(k);
    if (english === k) { bad.push(`en cannot say ${k}`); continue; }
    for (const loc of ['fa', 'ar']) {
      if (translator(loc)(k) !== english) bad.push(`${loc}.${k} is not the English fallback`);
      if (early[loc](k) !== english) bad.push(`${loc}.${k}: a translator made before registration missed it`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
  // and they really are absent from those dictionaries: the fallback is exercised, not bypassed
  const faSrc = read(join(ROOT, 'lib/locales/fa.ts')), arSrc = read(join(ROOT, 'lib/locales/ar.ts'));
  for (const g of GROUPS) {
    assert.ok(!new RegExp(`\\b${KEYS[g][0]}\\s*:`).test(faSrc), `fa has no ${g}`);
    assert.ok(!new RegExp(`\\b${KEYS[g][0]}\\s*:`).test(arSrc), `ar has no ${g}`);
  }
});

test('French carries every key of every lazy group itself', async () => {
  await loadDictionary('fr');
  const fr = read(join(ROOT, 'lib/locales/fr.ts'));
  const missing = GROUPS.flatMap((g) => KEYS[g].filter((k) => !new RegExp(`\\b${k}\\s*:`).test(fr)).map((k) => `${g}.${k}`));
  assert.deepEqual(missing, []);
  const t = translator('fr');
  for (const g of GROUPS) assert.notEqual(t(KEYS[g][0]), KEYS[g][0]);
});
