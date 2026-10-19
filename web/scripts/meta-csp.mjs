/**
 * Optional build step, for a host that cannot send response headers.
 *
 * Does nothing unless FLW_META_CSP=1, so the Cloudflare build, the local build
 * and CI are byte-for-byte what they were. The GitHub Pages workflow sets it.
 *
 * It copies the Content-Security-Policy out of public/_headers INTO a <meta
 * http-equiv> in dist/index.html, so there is one policy and not two that
 * drift. Three directives cannot be carried by a <meta> element and browsers
 * ignore them there (and log a console error for the first): frame-ancestors,
 * report-uri and sandbox. They are removed rather than left in, because a
 * directive that is present but ignored reads like a control that is working.
 * That is the whole of what this step can do; docs/deploying-github-pages.md
 * lists what it cannot.
 *
 * A <meta> CSP only governs what is parsed AFTER it, so it is placed first in
 * <head>, directly after the charset declaration.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.FLW_META_CSP !== '1') {
  console.log('meta CSP: skipped (FLW_META_CSP is not 1)');
  process.exit(0);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const headers = readFileSync(resolve(root, 'public/_headers'), 'utf8');
const line = headers.split('\n').map((l) => l.trim()).find((l) => l.startsWith('Content-Security-Policy:'));
if (!line) { console.error('META CSP FAILED: no Content-Security-Policy line in public/_headers.'); process.exit(1); }

const IGNORED_IN_META = ['frame-ancestors', 'report-uri', 'sandbox'];
const all = line.slice('Content-Security-Policy:'.length).split(';').map((d) => d.trim()).filter(Boolean);
const dropped = all.filter((d) => IGNORED_IN_META.includes(d.split(/\s+/)[0])).map((d) => d.split(/\s+/)[0]);
const policy = all.filter((d) => !IGNORED_IN_META.includes(d.split(/\s+/)[0])).join('; ');

for (const need of ["default-src 'none'", "script-src 'self'", "base-uri 'none'"]) {
  if (!policy.includes(need)) { console.error(`META CSP FAILED: the derived policy lost "${need}".`); process.exit(1); }
}
if (/frame-ancestors|report-uri|sandbox/.test(policy)) { console.error('META CSP FAILED: an ignored directive survived.'); process.exit(1); }
if (policy.includes('"')) { console.error('META CSP FAILED: a double quote would end the attribute.'); process.exit(1); }

const indexPath = resolve(root, 'dist/index.html');
let html = readFileSync(indexPath, 'utf8');
if (html.includes('http-equiv="Content-Security-Policy"')) { console.error('META CSP FAILED: index.html already has one.'); process.exit(1); }
const anchor = html.match(/<meta charset="[^"]*">/i);
if (!anchor) { console.error('META CSP FAILED: no charset meta to anchor on.'); process.exit(1); }
// Referrer-Policy is the one other header a <meta> can carry for real
// (<meta name="referrer">), so it is copied from _headers the same way.
const refLine = headers.split('\n').map((l) => l.trim()).find((l) => l.startsWith('Referrer-Policy:'));
const referrer = refLine ? refLine.slice('Referrer-Policy:'.length).trim() : '';
if (!/^[a-z-]+$/.test(referrer)) { console.error('META CSP FAILED: no usable Referrer-Policy in public/_headers.'); process.exit(1); }
html = html.replace(anchor[0],
  `${anchor[0]}\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n<meta name="referrer" content="${referrer}">`);
writeFileSync(indexPath, html);
console.log(`meta CSP + referrer (${referrer}): injected ${all.length - dropped.length} of ${all.length} directives (cannot be carried by <meta>: ${dropped.join(', ') || 'none present'})`);
