/**
 * The two fingerprints must be one fingerprint.
 *
 * A teacher's review records a hash of the question it was taken against:
 * `scripts/apply-review.py` writes it, and `web/src/lib/review-status.ts`
 * recomputes it in the browser to decide whether the review still applies. Two
 * implementations of one hash in two languages is a standing invitation to
 * divergence, and divergence here is not a wrong number on a screen — it is
 * **every teacher review reading as stale**, or worse, an edited question
 * quietly keeping an approval it no longer deserves.
 *
 * Parity was first checked by hand: both sides run over all 76 items, diff the
 * output. That check passed and then existed nowhere. This is the durable form
 * of it, and it asks three things:
 *
 *   1. the two agree on the whole real corpus;
 *   2. they agree on a NON-BMP character — the case that motivated iterating
 *      UTF-16 code units in Python, because iterating Python characters agrees
 *      on every French string and diverges on an emoji or a maths italic;
 *   3. changing ANY material field moves the hash, on both sides, including
 *      `stimulus`, which the staleness tests had not covered.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { fingerprintItem } from '../web/src/lib/review-status.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * The Python half, run as the applier itself would run it.
 *
 * It imports `scripts/apply-review.py` rather than reimplementing anything:
 * a copy of the algorithm in this file would pass for ever while the applier
 * drifted, which is the exact fault this test exists to catch. The module is
 * imported by path because its name has a hyphen in it.
 */
const PY = `
import importlib.util, json, pathlib, sys
spec = importlib.util.spec_from_file_location(
    "apply_review", pathlib.Path(sys.argv[1]) / "scripts/apply-review.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(json.dumps([mod.fingerprint(it) for it in json.load(sys.stdin)]))
`;

const pythonFingerprints = (items) => JSON.parse(execFileSync(
  'python3', ['-c', PY, root],
  { input: JSON.stringify(items), encoding: 'utf8', cwd: root }));

test('both halves agree on every item in the real corpus', () => {
  const papers = JSON.parse(readFileSync(join(root, 'content/exam-papers.json'), 'utf8'));
  const items = papers.papers.flatMap((p) => p.items);
  assert.ok(items.length >= 76, `only ${items.length} items — the corpus shrank`);

  const py = pythonFingerprints(items);
  const ts = items.map(fingerprintItem);
  const disagree = items
    .map((it, i) => (py[i] === ts[i] ? null : `${it.id}: python ${py[i]} vs browser ${ts[i]}`))
    .filter(Boolean);
  assert.deepEqual(disagree, [], 'the applier and the browser would disagree about staleness');
  // And the hash must actually distinguish questions: 76 identical values would
  // satisfy every assertion above and detect no edit at all.
  assert.ok(new Set(ts).size > items.length * 0.9,
    `${new Set(ts).size} distinct fingerprints for ${items.length} items — the hash is not reading the content`);
});

/* ── The cases a French corpus cannot exercise ─────────────────────────── */

const base = {
  id: 'fp-1',
  prompt: { en: 'Choose the form that fits 𝒜', fr: 'Choisissez la forme qui convient 😀' },
  options: [{ fr: 'soit' }, { fr: 'était' }],
  answer: 0,
  explain: { en: 'Subjunctive after « bien que » — 𝔄', fr: 'Subjonctif après « bien que »' },
  stimulus: { fr: 'Bien que ce ___ difficile, il continue. 𝕊' },
};

test('a NON-BMP character hashes identically on both sides', () => {
  // U+1D49C, U+1F600, U+1D504, U+1D54A: each is a surrogate PAIR in UTF-16 and
  // a single character in Python. Iterating Python characters here yields a
  // different hash; iterating UTF-16 code units yields the browser's.
  const [py] = pythonFingerprints([base]);
  assert.equal(py, fingerprintItem(base),
    'a question containing an emoji or a maths italic would read as stale the moment a teacher approved it');
});

test('every material field moves the hash, on both sides', () => {
  const edits = {
    prompt: { prompt: { ...base.prompt, en: 'Choose the other form 𝒜' } },
    'prompt (a second language)': { prompt: { ...base.prompt, fr: 'Autre question 😀' } },
    options: { options: [{ fr: 'soit' }, { fr: 'fût' }] },
    answer: { answer: 1 },
    explain: { explain: { ...base.explain, en: 'A different reason.' } },
    stimulus: { stimulus: { fr: 'Quoique ce ___ difficile, il continue. 𝕊' } },
  };
  const names = Object.keys(edits);
  const variants = names.map((n) => ({ ...base, ...edits[n] }));

  const py = pythonFingerprints([base, ...variants]);
  const ts = [base, ...variants].map(fingerprintItem);
  assert.deepEqual(py, ts, 'the two halves disagreed on an edited question');

  names.forEach((name, i) => {
    assert.notEqual(ts[i + 1], ts[0], `editing ${name} did not change the fingerprint`);
  });
});

test('an immaterial field does NOT move the hash, on both sides', () => {
  // The other half of the rule. A teacher's work is expensive, and adding a
  // concept id or a level must not discard it — in the applier as well as in
  // the browser.
  const after = { ...base, conceptIds: ['c.subj', 'c.new'], level: 'B2', tags: ['x'] };
  const [a, b] = pythonFingerprints([base, after]);
  assert.equal(a, b, 'the applier would rewrite a fingerprint for an unrelated edit');
  assert.equal(fingerprintItem(after), fingerprintItem(base));
});

test('a missing stimulus is distinguishable from an empty one', () => {
  // `(item.get("stimulus") or {}).get("fr")` and `item.stimulus?.fr ?? null`
  // must land on the same value for an absent field, which is where two
  // null-handling idioms in two languages usually part company.
  const absent = { ...base }; delete absent.stimulus;
  const empty = { ...base, stimulus: { fr: '' } };
  const py = pythonFingerprints([absent, empty]);
  assert.deepEqual(py, [fingerprintItem(absent), fingerprintItem(empty)]);
  assert.notEqual(py[0], py[1], 'no stimulus and an empty stimulus hash alike');
});
