/**
 * A component must not name a custom property that is out of scope where it is used.
 *
 * `.lp-rule` — the tricolour mark — painted its red from `--lp-rouge`, which is
 * declared on `.landing`. On the landing page it worked. Reused on the
 * dashboard it resolved to nothing, so the gradient was invalid at
 * computed-value time and `background-image` fell back to `none`: the element
 * kept its 36x4 box and painted absolutely nothing. No console error, no
 * failing selector, no missing class. It is the same shape as the
 * `--color-rouge`/`--color-danger` fallback caught in the landing — a component
 * depending on a token that is not in scope where the component is used — and
 * it is worse, because that one showed the WRONG colour and this one shows no
 * colour at all.
 *
 * This checks the text of the stylesheet. `web/e2e/walk.mjs` checks that the
 * mark actually paints in a browser on both pages; the two together are the
 * guard, because neither alone would have caught this.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../web/src/styles.css', import.meta.url), 'utf8');

/**
 * Rules, as (selector, body) pairs. Splitting on `}` is crude and sufficient:
 * the question is only ever "does this body read a property that this selector
 * cannot see", and a chunk that straddles an at-rule still answers it.
 */
function rules(src) {
  return src.split('}').map((chunk) => {
    const at = chunk.lastIndexOf('{');
    if (at < 0) return null;
    return { selector: chunk.slice(0, at).split('\n').pop().trim(), body: chunk.slice(at + 1) };
  }).filter(Boolean);
}

const RULES = rules(css);
/** Properties declared on the landing wrapper, and so unavailable off it. */
const PAGE_SCOPED = [...new Set(
  RULES.filter((r) => /^\.landing\b/.test(r.selector))
       .flatMap((r) => [...r.body.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1])))];

test('the stylesheet was parsed, and the page-scoped properties were found', () => {
  assert.ok(RULES.length > 150, `only ${RULES.length} rules parsed; fix the parse, not this number`);
  assert.ok(PAGE_SCOPED.length >= 4,
    `found ${PAGE_SCOPED.length} properties scoped to .landing — expected the --lp-* set`);
  assert.ok(PAGE_SCOPED.includes('--lp-rouge'), 'the one that caused this test should be among them');
});

test('nothing outside the landing reads a property only the landing declares', () => {
  const problems = [];
  for (const r of RULES) {
    const onLanding = /landing|\blp-/.test(r.selector);
    if (onLanding) continue;
    for (const prop of PAGE_SCOPED) {
      if (r.body.includes(`var(${prop})`)) {
        problems.push(`${r.selector} reads ${prop}, which only .landing declares`);
      }
    }
  }
  assert.deepEqual(problems, [],
    'off that page the property does not resolve, the declaration is dropped, and the element '
    + 'keeps its box and paints nothing — silently');
});

test('a selector that serves both the landing and another page reads only global tokens', () => {
  // `.lp-rule, .rule-mark` is the case in hand: one of its selectors is on the
  // landing and the other is not, so "is this selector on the landing" is not
  // the question — every selector in the list has to be.
  const problems = [];
  for (const r of RULES) {
    const parts = r.selector.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const mixed = parts.some((x) => /landing|\blp-/.test(x)) && parts.some((x) => !/landing|\blp-/.test(x));
    if (!mixed) continue;
    for (const prop of PAGE_SCOPED) {
      if (r.body.includes(`var(${prop})`)) problems.push(`${r.selector} reads ${prop}`);
    }
  }
  assert.deepEqual(problems, [], 'a shared rule must name a global token, never a page-scoped one');
});
