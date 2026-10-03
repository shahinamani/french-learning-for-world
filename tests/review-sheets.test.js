/**
 * The review sheets must agree with the content they describe.
 *
 * `docs/reviews/levels-priority.md` and `levels-all.md` are generated from
 * `content/verbs/*.json` by `scripts/level-review.py`, and a generated document
 * is the easiest thing in a repository to leave behind: nothing fails when it
 * goes stale, and a teacher ruling on a sheet that no longer matches the
 * content is ruling on nothing. The handoff document had a merged pull request
 * and a dead branch at the top of it for nineteen pull requests for exactly
 * this reason.
 *
 * Regenerating to compare would need Lexique 3.83, which is 24.65 MiB and is
 * not in the repository. So this checks the claims the sheets make that CAN be
 * checked without it: that every verb they name exists, and sits at the level
 * they say it sits at.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const verbs = LEVELS.flatMap((l) => read(`content/verbs/${l}.json`).verbs);
const byHeadword = new Map(verbs.map((v) => [v.headword || v.infinitive, v]));

/** `| 1402 | C1 | `paumer` | gloss | evidence |  |` */
function rows(file) {
  const text = readFileSync(join(root, file), 'utf8');
  return [...text.matchAll(/^\| (\d+) \| (A1|A2|B1|B2|C1|C2) \| `([^`]+)` \|/gm)]
    .map((m) => ({ rank: Number(m[1]), level: m[2], verb: m[3] }));
}

for (const file of ['docs/reviews/levels-priority.md', 'docs/reviews/levels-all.md',
                    'docs/reviews/pronominal.md']) {
  test(`${file} names verbs that exist, at the level it claims`, () => {
    const rs = rows(file);
    assert.ok(rs.length >= 40, `${file} has ${rs.length} rows — it did not parse`);
    const wrong = [];
    for (const r of rs) {
      const v = byHeadword.get(r.verb);
      if (!v) { wrong.push(`${r.verb} is in the sheet and not in the content`); continue; }
      if (v.level !== r.level) wrong.push(`${r.verb}: sheet says ${r.level}, content says ${v.level}`);
      if (v.rank !== r.rank) wrong.push(`${r.verb}: sheet says rank ${r.rank}, content says ${v.rank}`);
    }
    assert.deepEqual(wrong.slice(0, 8), [],
      `${file} is out of date — regenerate with scripts/level-review.py`);
    console.log(`    ${file.split('/').pop()}: ${rs.length} rows, all current`);
  });
}

test('levels-all.md covers every verb, so nothing is unreviewable', () => {
  const named = new Set(rows('docs/reviews/levels-all.md').map((r) => r.verb));
  const missing = verbs.filter((v) => !named.has(v.headword || v.infinitive))
    .map((v) => v.infinitive);
  assert.deepEqual(missing.slice(0, 8), [],
    'a verb has no row in any sheet, so no ruling can reach it');
  assert.equal(named.size, verbs.length);
});

test('the pronominal sheet lists exactly the pronominal verbs', () => {
  // The sheet has been written by hand three times — 51, then 48, then 44 —
  // and scripts/pronominal-review.py now generates it. A sheet that disagrees
  // with the content is a sheet a teacher rules on for nothing.
  const named = new Set(rows('docs/reviews/pronominal.md').map((r) => r.verb));
  const actual = verbs.filter((v) => v.pronominal).map((v) => v.headword);
  assert.deepEqual([...named].sort(), [...actual].sort(),
    'regenerate with scripts/pronominal-review.py');
  console.log(`    pronominal.md: ${named.size} verbs`);
});

test('the priority sheet is a sitting, not a project', () => {
  // 194 of 2,392. The first version of the generator used a flat rank
  // difference instead of a ratio and flagged 1,414, which is not a review
  // sheet — it is the same problem with extra steps.
  const n = rows('docs/reviews/levels-priority.md').length;
  assert.ok(n >= 100 && n <= 400,
    `${n} verbs flagged — under 100 is not finding the errors, over 400 is not reviewable`);
  console.log(`    ${n} of ${verbs.length} flagged for review`);
});
