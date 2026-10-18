/**
 * The auxiliary of every verb: « je suis arrivé », not « j'ai arrivé ».
 *
 * The defect this exists for: arriver, rester, tomber and entrer shipped as
 * `avoir`, and the verb page printed it. The generator took the auxiliary from
 * the conjugation MODEL, which knows how a verb conjugates and not which verb
 * it is. Nothing checked it, because the field was a string in a closed set and
 * every value was in the set.
 *
 * The check below compares the right two things: what the CONTENT says against
 * what an INDEPENDENT source says about the same verb (the fr.wiktionary page,
 * harvested into data/auxiliaries.json), not against the generator's own rule,
 * which is the thing under suspicion. The one place a hand-written list appears
 * is the anchor test, and it is an oracle for the test, not a source for the
 * content.
 *
 * **The `\b` trap.** JavaScript's `\b` is ASCII-only, so `ê` is not a word
 * character and `/\bêtre\b/` finds no boundary before the `ê`: it matches
 * nothing, silently, and a check built on it passes forever. Word edges here use
 * `(?<![\p{L}])` with the `u` flag, and the first test pins the trap so it
 * cannot be reintroduced unnoticed.
 *
 * `AUX_CONTENT_DIR` points the audit at another copy of `content/` — used to
 * watch the check fail against the content as it stood before the fix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentDir = process.env.AUX_CONTENT_DIR ?? join(root, 'content');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const index = read(join(contentDir, 'verbs-index.json')).verbs;
const all = LEVELS.flatMap((l) => read(join(contentDir, 'verbs', `${l}.json`)).verbs);
const byLemma = new Map(all.map((v) => [v.infinitive, v]));
const evidence = read(join(root, 'data/auxiliaries.json')).verbs;
const rulingKeys = new Set(
  [...readFileSync(join(root, 'scripts/auxiliary_rulings.py'), 'utf8')
    .matchAll(/^ {4}"([^"]+)": \{/gm)].map((m) => m[1]));

/** Every accusation the audit can raise, as strings. Pure, so it can be shown to fail. */
function audit(verbs, evidenceOf, rulings) {
  const bad = [];
  for (const v of verbs) {
    const set = [v.auxiliary, v.auxiliaryAlso].filter(Boolean);
    if (!['avoir', 'être'].includes(v.auxiliary)) bad.push(`${v.infinitive}: auxiliary is ${JSON.stringify(v.auxiliary)}`);
    if (v.auxiliaryAlso !== null && !['avoir', 'être'].includes(v.auxiliaryAlso)) bad.push(`${v.infinitive}: auxiliaryAlso is ${JSON.stringify(v.auxiliaryAlso)}`);
    if (v.auxiliaryAlso === v.auxiliary) bad.push(`${v.infinitive}: both auxiliaries are ${v.auxiliary}`);
    if (v.auxiliaryProvenance === 'rule') bad.push(`${v.infinitive}: auxiliary is a model default, nobody looked it up`);
    if (!v.auxiliaryProvenance) bad.push(`${v.infinitive}: no auxiliaryProvenance`);
    // A reflexive verb takes être. No exception exists in French.
    if (v.pronominal && (v.auxiliary !== 'être' || v.auxiliaryAlso)) {
      bad.push(`${v.infinitive}: pronominal-only but auxiliary ${set.join('/')}`);
    }
    const e = evidenceOf[v.infinitive];
    if (v.auxiliaryProvenance === 'ruling') {
      if (!rulings.has(v.infinitive)) bad.push(`${v.infinitive}: says "ruling" but scripts/auxiliary_rulings.py has none`);
    } else if (!v.pronominal && e) {
      const want = e.plain.length ? e.plain : e.reflexive;
      if (JSON.stringify([...set].sort()) !== JSON.stringify([...want].sort())) {
        bad.push(`${v.infinitive}: content ${set.join('/')} against fr.wiktionary ${want.join('/')}`);
      }
    }
    if (v.auxiliaryExamples) {
      for (const [aux, s] of Object.entries(v.auxiliaryExamples)) {
        if (!set.includes(aux)) bad.push(`${v.infinitive}: an example for ${aux}, which the verb does not take`);
        if (!s || typeof s !== 'string') bad.push(`${v.infinitive}: empty example for ${aux}`);
      }
    }
  }
  return bad;
}

const wordRe = (alternatives) => new RegExp(`(?<![\\p{L}])(?:${alternatives})(?![\\p{L}])`, 'iu');

test('the word-edge helper matches « être »; the naive \\b does not (the trap, pinned)', () => {
  assert.equal(/\bêtre\b/.test('il faut être content'), false, 'if this ever turns true the trap is gone and this test should be deleted');
  assert.equal(wordRe('être').test('il faut être content'), true);
  assert.equal(wordRe('être').test('un hêtre'), false, 'must not match inside a longer word');
});

test('the audit is not vacuous: it covers the whole corpus, and it fails on the old defect', () => {
  assert.ok(all.length >= 2300, `${all.length} verbs audited`);
  assert.equal(index.length, all.length);
  // The defect, injected: arriver given avoir, evidence untouched.
  const broken = all.map((v) => (v.infinitive === 'arriver'
    ? { ...v, auxiliary: 'avoir', auxiliaryProvenance: 'fr-wiktionary' } : v));
  const accused = audit(broken, evidence, rulingKeys);
  assert.ok(accused.some((a) => a.startsWith('arriver:')), `expected arriver to be accused, got ${accused}`);
  // And a pronominal verb given avoir, the other half of the defect.
  const broken2 = all.map((v) => (v.infinitive === 'enfuir' || v.pronominal ? { ...v, auxiliary: 'avoir' } : v));
  assert.ok(audit(broken2, evidence, rulingKeys).length > 0);
  // The naive \b version of "does any verb carry être" sees nothing at all.
  assert.equal(JSON.stringify(all.map((v) => v.auxiliary)).match(/\bêtre\b/g), null);
  assert.ok(JSON.stringify(all.map((v) => v.auxiliary)).match(wordRe('être'), 'g') !== null);
});

test('every verb\'s auxiliary agrees with fr.wiktionary, or carries a written ruling', () => {
  const bad = audit(all, evidence, rulingKeys);
  assert.deepEqual(bad, [], `${bad.length} verbs with the wrong or unsourced auxiliary`);
  const ruled = all.filter((v) => v.auxiliaryProvenance === 'ruling').map((v) => v.infinitive);
  assert.deepEqual([...rulingKeys].filter((k) => !ruled.includes(k) && byLemma.has(k)), [],
    'a ruling that no verb in the content uses is a ruling that has stopped applying');
  const dual = all.filter((v) => v.auxiliaryAlso).length;
  console.log(`    ${all.length} verbs: ${all.filter((v) => v.auxiliary === 'être').length} principal être, `
    + `${dual} take both, ${ruled.length} by ruling`);
});

test('the index and the shards say the same thing', () => {
  const bad = [];
  for (const s of index) {
    const v = byLemma.get(s.infinitive);
    if (!v) { bad.push(`${s.infinitive}: not in a shard`); continue; }
    if (s.auxiliary !== v.auxiliary) bad.push(`${s.infinitive}: index ${s.auxiliary}, shard ${v.auxiliary}`);
    if ((s.auxiliaryAlso ?? null) !== v.auxiliaryAlso) bad.push(`${s.infinitive}: index also ${s.auxiliaryAlso}, shard ${v.auxiliaryAlso}`);
  }
  assert.deepEqual(bad, []);
});

test('the verbs of the house of être (DR MRS VANDERTRAMP and their compounds) take être', () => {
  // A hand-written oracle for THIS test only. The content is not built from it.
  const etre = ['devenir', 'revenir', 'monter', 'rester', 'sortir', 'venir', 'aller', 'naître',
    'descendre', 'entrer', 'retourner', 'tomber', 'rentrer', 'arriver', 'mourir', 'partir',
    'parvenir', 'intervenir', 'survenir', 'advenir', 'provenir', 'redevenir', 'retomber',
    'décéder', 'repartir', 'ressortir'];
  const bad = [];
  for (const l of etre) {
    const v = byLemma.get(l);
    if (!v) continue;                       // not every compound is in the 2,400
    if (![v.auxiliary, v.auxiliaryAlso].includes('être')) bad.push(`${l}: ${v.auxiliary}`);
  }
  assert.deepEqual(bad, []);
  // And the ones that must not be: « j'ai prévenu », « j'ai passé un examen ».
  assert.equal(byLemma.get('prévenir').auxiliary, 'avoir');
  assert.equal(byLemma.get('prévenir').auxiliaryAlso, null);
  assert.equal(byLemma.get('passer').auxiliary, 'avoir');
  assert.equal(byLemma.get('passer').auxiliaryAlso, 'être');
  assert.equal(byLemma.get('arriver').auxiliary, 'être');
  assert.equal(byLemma.get('arriver').auxiliaryAlso, null);
});

test('no sentence in the content conjugates an être-only verb with avoir', () => {
  // The second, independent look: the French the product itself prints.
  const etreOnly = all.filter((v) => v.auxiliary === 'être' && !v.auxiliaryAlso && !v.pronominal
    && v.participles.past);
  const pps = etreOnly.flatMap((v) => {
    const pp = v.participles.past;
    return [pp, `${pp}e`, `${pp}s`, `${pp}es`].map((f) => [f, v.infinitive]);
  });
  assert.ok(pps.length > 20, 'the scan has participles to look for');
  const owner = new Map(pps);
  const re = wordRe(`(?:ai|as|a|avons|avez|ont|aurai|aura|aurait|avait|avais|eu)\\s+(${[...owner.keys()].join('|')})`);
  // The scan is shown to see: a sentence that must be caught, and one that must not.
  assert.ok(re.test("Il a arrivé hier."), 'the scan misses « il a arrivé »');
  assert.ok(re.test("J'ai arrivée"), 'the scan misses an elided « j\'ai »');
  assert.ok(!re.test("Il est arrivé hier."), 'the scan accuses the correct sentence');
  const strings = [];
  const walk = (x) => {
    if (typeof x === 'string') strings.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  for (const f of readdirSync(contentDir)) {
    if (!f.endsWith('.json') || f.startsWith('verb')) continue;
    walk(read(join(contentDir, f)));
  }
  assert.ok(strings.length > 1000, `${strings.length} strings scanned`);
  const hits = strings.filter((s) => re.test(s.replace(/’/g, "'")));
  assert.deepEqual(hits, [], 'avoir + the participle of an être-only verb');
  console.log(`    scanned ${strings.length} strings for ${owner.size} être-only participle forms`);
});

test('the evidence file covers every verb and says when it was read', () => {
  const meta = read(join(root, 'data/auxiliaries.json'));
  assert.match(meta.read, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(existsSync(join(root, 'scripts/auxiliary_rulings.py')));
  const missing = all.filter((v) => !evidence[v.infinitive]).map((v) => v.infinitive);
  assert.deepEqual(missing, []);
});
