/**
 * No learner-facing surface may print a verb's bare infinitive.
 *
 * « se souvenir » was fixed three times. First the detail page heading and the
 * drill prompt — and the LIST went on printing "souvenir" for another day,
 * because the fix was applied at call sites and the list was a call site
 * nobody had listed. Then the table caption and the history record, both found
 * only by grepping after Shahin asked whether the job was finished.
 *
 * Five surfaces, discovered one at a time, by hand, each time after declaring
 * the work done. That is the signature of a rule enforced by remembering it.
 *
 * So this check reads the source. Any component that renders a verb identifier
 * must go through `verbLabel()`, and printing `.infinitive` into text is a
 * failure here rather than a defect a learner finds. It is a crude check — it
 * reads JSX as text — and it is the one that would have caught all four of the
 * surfaces I missed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(root, 'web/src');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

/**
 * Printing a verb identifier into the rendered output. `{verb.infinitive}`,
 * `frText(v.infinitive)`, `${verb.infinitive}` in a template that becomes text.
 *
 * NOT matched, because these are the identifier doing its job rather than text
 * a learner reads: a route (`encodeURIComponent`), a React key, a record key
 * (`conj:${verb.infinitive}`), a comparison, a filter, a test id.
 */
const PRINTS = /(?:\{|\(|\$\{)\s*(?:frText\()?\s*(?:verb|v|summary)\.infinitive/g;

/**
 * Remove the places the identifier is legitimately used, WITH their arguments,
 * before looking for a bare render.
 *
 * The first version of this check allowed a whole LINE if it contained any
 * allowed token. It passed when the list was reverted to the bare infinitive,
 * because the same line carried `data-testid={`row-${v.infinitive}`}` — the
 * attribute I had added so the browser check could find the row. **The guard
 * was blinded by the thing that made it testable.** A line is not the right
 * unit; an expression is.
 */
const scrub = (line) => line
  .replace(/data-testid=\{[^}]*\}/g, '')
  .replace(/\bkey=\{[^}]*\}/g, '')
  .replace(/encodeURIComponent\([^)]*\)/g, '')
  .replace(/verbLabel\([^)]*\)/g, '')
  .replace(/`[^`]*(?:conj:|v:)[^`]*`/g, '')
  .replace(/\.(?:includes|startsWith|localeCompare|sort|filter|find|some|every|map)\([^)]*\)/g, '');

/** Still line-level, because a comparison is a whole-line judgement. */
const ALLOWED = /=== |!== |\bkey:|norm\(/;

test('no component prints a verb infinitive where a learner reads it', () => {
  const offenders = [];
  for (const file of sources(SRC)) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('*') || line.trim().startsWith('//')) return;
      const scrubbed = scrub(line);
      PRINTS.lastIndex = 0;
      if (!PRINTS.test(scrubbed)) return;
      if (ALLOWED.test(scrubbed)) return;
      offenders.push(`${relative(root, file)}:${i + 1}  ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(offenders, [],
    'use verbLabel(v) — a pronominal-only verb is « se souvenir », not « souvenir »');
});

test('the check is sensitive — it fails on a line that would ship the defect', () => {
  // Seen red rather than assumed. If this file's pattern stops matching the
  // thing it is for, the check above becomes a check of nothing.
  for (const bad of [
    '        <span lang="fr">{frText(verb.infinitive)}</span>',
    // The exact line that slipped past the first version of this check: a bare
    // render on a line that also carries an allowed attribute.
    '    <span data-testid={`row-${v.infinitive}`}>{frText(v.infinitive)}</span>',
  ]) {
    const scrubbed = scrub(bad);
    PRINTS.lastIndex = 0;
    assert.ok(PRINTS.test(scrubbed), `the pattern no longer matches: ${bad.trim()}`);
    assert.ok(!ALLOWED.test(scrubbed), `the allow-list now excuses: ${bad.trim()}`);
  }
  // And it does NOT fire on the identifier doing its job.
  for (const fine of [
    '  <Link to={`/learn/verbs/${encodeURIComponent(v.infinitive)}`}>',
    '    const cardKey = `conj:${verb.infinitive}:${tense.id}:${index}`;',
    '      <li key={v.infinitive}>',
    '        {frText(verbLabel(verb))}',
  ]) {
    const scrubbed = scrub(fine);
    PRINTS.lastIndex = 0;
    assert.ok(!PRINTS.test(scrubbed) || ALLOWED.test(scrubbed),
      `false positive on: ${fine.trim()}`);
  }
});

test('verbLabel is the only thing that decides what a verb is called', () => {
  const pron = readFileSync(join(SRC, 'lib/pronominal.ts'), 'utf8');
  assert.match(pron, /export function verbLabel/);
  // The fallback chain lives in one place. `headword ?? infinitive` spread
  // across five components is how four of them came to disagree.
  const spread = sources(SRC).filter((f) => !f.endsWith('pronominal.ts'))
    .filter((f) => /headword\s*(\?\?|\|\|)\s*\w+\.infinitive/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(root, f));
  assert.deepEqual(spread, [], 'the fallback belongs in verbLabel, not at the call site');
});
