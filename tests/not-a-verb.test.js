/**
 * A lemma Lexique tags as a verb that nobody uses as one.
 *
 * `éperdre` shipped at C2 glossed "to lose one's way". It is in the frequency
 * list because the ADJECTIVE « éperdu » exists: 100% of its corpus frequency is
 * the four participle agreement forms — éperdu, éperdue, éperdus, éperdues —
 * and not one finite form is attested in either corpus. There was no verb to
 * teach.
 *
 * Shahin's framing was "obsolete", mine is attestation, and attestation is the
 * one that can be measured: **an archaic verb people still write keeps its
 * place with a register label; a lemma nobody conjugates has no verb to teach.**
 *
 * Until this file existed the three removals were a hand-written list of three
 * and the detector was a query run once in a session. **A fourth would have
 * arrived unnoticed**, which is the exception-list failure this project has hit
 * before: a list of known cases with no check that the list is complete.
 *
 * `data/participle-share.json` carries the measurement per lemma so the check
 * does not need Lexique's 24.65 MiB. Every lemma it finds must be declared
 * below with a reason — dropped or kept — and an undeclared one fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const shares = read('data/participle-share.json').shares;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const shipped = new Set(LEVELS.flatMap((l) => read(`content/verbs/${l}.json`).verbs)
  .map((v) => v.infinitive));

/**
 * Every lemma whose entire corpus frequency is past participles.
 *
 * `dropped` — the adjective is the living word and the verb is not used.
 * `kept`    — a living verb whose usage is participle-heavy for a reason that
 *             has nothing to do with the verb being dead. **The measurement
 *             cannot tell these apart**, which is why this is a list a person
 *             reads rather than a rule the build applies.
 */
const DECLARED = {
  'éperdre': { dropped: true, why: '« éperdu » is the living word; the verb is not used' },
  'dépourvoir': { dropped: true, why: '« dépourvu » is the living word' },
  'dénuer': { dropped: true, why: '« dénué (de) » is the living word' },
  'découverte': { dropped: true, why: 'not a verb at all — a noun Lexique mis-tags' },
  'sous-titrer': { dropped: false, why: 'films are subtitled rather than people subtitling them, '
    + 'and « ils ont sous-titré le film » is ordinary French' },
};

test('every all-participle lemma is declared, dropped or kept, with a reason', () => {
  const found = Object.entries(shares)
    .filter(([, d]) => d.pp >= 0.995 && d.finite <= 0.005)
    .map(([lemma]) => lemma);
  assert.ok(found.length >= 4, `only ${found.length} found — is the measurement loaded?`);
  const undeclared = found.filter((l) => !(l in DECLARED));
  assert.deepEqual(undeclared, [],
    'a lemma with no finite form attested has appeared and nobody has ruled on '
    + 'it. Read it, then add it to DECLARED as dropped or kept with a reason.');
  // And the declarations must still be true of the content.
  const wrong = [];
  for (const [lemma, { dropped }] of Object.entries(DECLARED)) {
    if (dropped && shipped.has(lemma)) wrong.push(`${lemma} is declared dropped and ships`);
    if (!dropped && !shipped.has(lemma)) wrong.push(`${lemma} is declared kept and does not ship`);
    if (!(lemma in shares)) wrong.push(`${lemma} is declared and is not in the measurement`);
  }
  assert.deepEqual(wrong, []);
  console.log(`    ${found.length} all-participle lemmas · `
    + `${Object.values(DECLARED).filter((d) => d.dropped).length} dropped · `
    + `${Object.values(DECLARED).filter((d) => !d.dropped).length} kept`);
});

test('the measurement is not automated, and the kept case is why', () => {
  // « sous-titrer » scores identically to « éperdre » on the only signal
  // available: 100% participle, no finite form. One is a living verb and one is
  // not, and no number here separates them. A filter that cannot tell them
  // apart is a filter for a human to read.
  const st = shares['sous-titrer'], ep = shares['éperdre'];
  assert.ok(st.pp >= 0.995 && ep.pp >= 0.995);
  assert.ok(st.finite <= 0.005 && ep.finite <= 0.005);
  assert.ok(shipped.has('sous-titrer') && !shipped.has('éperdre'),
    'the two are treated identically — the human ruling has been lost');
});

test('douer is kept: a learner meets « doué » and must be able to look it up', () => {
  // 98% participle and Shahin's ruling: « la nature l'a doué de » is real, and
  // the cost of carrying a verb a learner will only ever read is far lower than
  // the cost of dropping one they meet in a text and cannot look up.
  assert.ok(shipped.has('douer'));
  assert.ok(shares['douer'].pp > 0.9, 'douer is no longer participle-dominant — recheck');
});

test('the 85-99% band is a known, bounded, unresolved question', () => {
  // Between "clearly an adjective" and "ordinary verb" sit verbs whose
  // participle dominates for ordinary reasons — « chromer », « bonder »,
  // « diplômer ». They are listed for one human pass rather than guessed at,
  // and this check only holds the size of the question steady.
  const band = Object.entries(shares)
    .filter(([l, d]) => d.pp >= 0.85 && d.pp < 0.995 && shipped.has(l));
  assert.ok(band.length >= 20 && band.length <= 60,
    `${band.length} verbs in the 85-99% band — the question has changed size`);
  console.log(`    ${band.length} verbs between 85% and 99% participle, awaiting one read`);
});
