/**
 * The verb content a learner actually loads.
 *
 * Rewritten when the deck went from 14 verbs in one file to 2,389 across an
 * index and six level shards. The claims are the same ones the 14-verb version
 * made — every tense has six persons, no form is empty, every concept id is
 * real — which is the point: the shape changed, the guarantees did not.
 *
 * Two claims are new and belong to the new scale. Every verb in the index must
 * be findable in its own shard, because the index is what the list renders and
 * the shard is what the verb page loads; an entry in one and not the other is a
 * row that leads to a not-found screen. And nothing withheld by
 * `conjugation_exceptions.py` may appear at all — `gésir` is conjugated wrongly
 * and `découverte` is not a verb, so a learner must meet neither.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const index = read('content/verbs-index.json').verbs;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const shards = Object.fromEntries(LEVELS.map((l) => [l, read(`content/verbs/${l}.json`).verbs]));
const all = LEVELS.flatMap((l) => shards[l]);
const conceptIds = new Set(read('content/concepts.json').concepts.map((c) => c.id));
const tenseNames = read('content/tense-names.json').tenses;

test('the content is populated — a guard over an empty deck guards nothing', () => {
  assert.ok(index.length >= 2000, `${index.length} verbs in the index`);
  assert.ok(all.length >= 2000, `${all.length} verbs across the shards`);
  console.log(`    ${index.length} verbs · ` + LEVELS.map((l) => `${l} ${shards[l].length}`).join(' · '));
});

test('every verb in the index is in its own shard, and nowhere else', () => {
  const missing = [], misfiled = [];
  for (const s of index) {
    const here = shards[s.level]?.some((v) => v.infinitive === s.infinitive);
    if (!here) missing.push(`${s.infinitive} (index says ${s.level})`);
    const elsewhere = LEVELS.filter((l) => l !== s.level
      && shards[l].some((v) => v.infinitive === s.infinitive));
    if (elsewhere.length) misfiled.push(`${s.infinitive} also in ${elsewhere.join(', ')}`);
  }
  assert.deepEqual(missing, [], 'a row in the list that leads to a not-found screen');
  assert.deepEqual(misfiled, [], 'the same verb in two shards means two paradigms to disagree');
});

test('every tense has six persons and no empty form', () => {
  const bad = [];
  for (const v of all) {
    if (v.persons.length !== 6) bad.push(`${v.infinitive}: ${v.persons.length} persons`);
    if (v.tenses.length < 5) bad.push(`${v.infinitive}: only ${v.tenses.length} tenses`);
    for (const t of v.tenses) {
      if (t.forms.length !== 6) bad.push(`${v.infinitive} ${t.id}: ${t.forms.length} forms`);
      for (const f of t.forms) {
        // An impersonal verb has only a third person: « il faut », « il pleut ».
        // Its empty persons are correct French, and the entry says so.
        if ((!f || !f.trim()) && !v.impersonal) {
          bad.push(`${v.infinitive} ${t.id}: an empty form`);
        }
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('an impersonal verb is marked, and is the only kind with empty persons', () => {
  const impersonal = all.filter((v) => v.impersonal).map((v) => v.infinitive);
  assert.ok(impersonal.length >= 1, 'no verb is marked impersonal — falloir should be');
  assert.ok(impersonal.includes('falloir'), `impersonal: ${impersonal.join(', ')}`);
  console.log(`    impersonal: ${impersonal.join(', ')}`);
  for (const v of all.filter((x) => !x.impersonal)) {
    for (const t of v.tenses) {
      assert.ok(t.forms.every((f) => f && f.trim()),
        `${v.infinitive} ${t.id} has an empty form but is not marked impersonal`);
    }
  }
});

test('every tense id has a name in all four languages', () => {
  const unknown = new Set();
  for (const v of all) for (const t of v.tenses) if (!tenseNames[t.id]) unknown.add(t.id);
  assert.deepEqual([...unknown], [],
    'a tense whose name is in no dictionary renders as nothing at all');
  for (const [id, name] of Object.entries(tenseNames)) {
    for (const loc of ['en', 'fr', 'fa', 'ar']) {
      assert.ok(name[loc], `tense ${id} has no ${loc} name`);
    }
  }
});

test('a tense either names a concept that exists, or names none at all', () => {
  const bad = [];
  for (const v of all) {
    for (const t of v.tenses) {
      if (t.conceptId === null) {
        // Read-only tenses have no concept: nothing drills them, so nothing can
        // be weak at them. Null is the honest answer; a wrong id would detach a
        // whole tense from the weakness model silently.
        if (t.produced) bad.push(`${v.infinitive} ${t.id} is drilled but names no concept`);
        continue;
      }
      if (!conceptIds.has(t.conceptId)) {
        bad.push(`${v.infinitive} ${t.id}: ${t.conceptId} is not in the taxonomy`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('the read-only tenses are marked so, and are never drilled', () => {
  const readOnly = new Set(read('content/tense-names.json').readOnly.ids);
  const bad = [];
  for (const v of all) {
    for (const t of v.tenses) {
      if (readOnly.has(t.id) && t.produced) {
        bad.push(`${v.infinitive} ${t.id} would be drilled`);
      }
      if (!readOnly.has(t.id) && !t.produced) {
        bad.push(`${v.infinitive} ${t.id} is marked read-only but is not one`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), [],
    'the passé simple is read in every B2 text and written in none of them');
});

test('nothing withheld by the exception list reaches a learner', () => {
  // gésir is conjugated wrongly and découverte is not a verb. Both are named in
  // scripts/conjugation_exceptions.py, and a learner must meet neither.
  const WITHHELD = ['gésir', 'découverte', 'clore', 'choir', 'ouïr', 'seoir',
                    'faillir', 'défaillir',
                    // Lexique tags these as verbs; 100% of their frequency is
                    // past participles and no finite form is attested. The
                    // adjectives « éperdu », « dépourvu », « dénué » are the
                    // living words.
                    'éperdre', 'dépourvoir', 'dénuer'];
  const leaked = WITHHELD.filter((w) => index.some((v) => v.infinitive === w)
                                     || all.some((v) => v.infinitive === w));
  assert.deepEqual(leaked, [],
    'a verb we cannot conjugate correctly must not be shown conjugated');
});

test('every verb records where its conjugation and its meaning came from', () => {
  const bad = [];
  for (const v of all) {
    if (v.provenance !== 'generated') bad.push(`${v.infinitive}: provenance ${v.provenance}`);
    if (!v.licence) bad.push(`${v.infinitive}: no licence`);
    // A meaning and a conjugation come from different places, and the data has
    // to say so — docs/02 requires provenance per item, not per file.
    const hasGloss = Boolean(v.meanings && v.meanings.en);
    if (hasGloss && !['wiktionary-en', 'teacher'].includes(v.glossProvenance)) {
      bad.push(`${v.infinitive}: a gloss with provenance ${v.glossProvenance}`);
    }
    if (!hasGloss && v.glossProvenance) {
      bad.push(`${v.infinitive}: gloss provenance but no gloss`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('the level a verb is filed under matches its frequency rank', () => {
  const BANDS = { A1: [1, 200], A2: [201, 500], B1: [501, 900],
                  B2: [901, 1400], C1: [1401, 1900], C2: [1901, 2400] };
  const bad = [];
  for (const v of index) {
    const [lo, hi] = BANDS[v.level];
    if (v.rank < lo || v.rank > hi) bad.push(`${v.infinitive}: rank ${v.rank} filed as ${v.level}`);
  }
  assert.deepEqual(bad.slice(0, 10), [],
    'level is assigned from frequency; a verb outside its band was filed by hand or by accident');
});

test('where French admits two spellings, the second is carried on the form', () => {
  // A learner writing « essaye » or « martelle » is right. The drill reads
  // `accepted` to know that; without it, a correct answer is marked wrong,
  // which is the one failure this product will not have.
  const withAlt = all.filter((v) => v.tenses.some((t) => t.accepted));
  assert.ok(withAlt.length >= 40,
    `only ${withAlt.length} verbs carry an alternate spelling — the -ayer, é_er `
    + 'and -eler/-eter families alone should be far more');
  const essayer = all.find((v) => v.infinitive === 'essayer');
  assert.ok(essayer, 'essayer is not in the content');
  const pres = essayer.tenses.find((t) => t.id === 'present');
  assert.deepEqual(pres.forms.slice(0, 3), ['essaie', 'essaies', 'essaie']);
  assert.deepEqual(pres.accepted.slice(0, 3), ['essaye', 'essayes', 'essaye']);
  // An alternate must never equal the form it stands beside, or it is noise.
  const noise = [];
  for (const v of all) {
    for (const t of v.tenses) {
      if (!t.accepted) continue;
      t.accepted.forEach((a, i) => { if (a && a === t.forms[i]) noise.push(`${v.infinitive} ${t.id}`); });
    }
  }
  assert.deepEqual(noise.slice(0, 5), []);
  console.log(`    ${withAlt.length} verbs carry a second accepted spelling`);
});

test('nearly every verb has an English gloss, and the gaps are named', () => {
  const without = all.filter((v) => !v.meanings || !v.meanings.en).map((v) => v.infinitive);
  console.log(`    ${all.length - without.length} of ${all.length} glossed`);
  assert.ok(without.length <= 30,
    `${without.length} verbs have no meaning at all: ${without.slice(0, 12).join(', ')}`);
});

test('the shards are small enough to send one at a time', () => {
  // The whole set is about 4 MiB. The split exists so a learner at B1 fetches
  // B1, and a shard that grows past a quarter of a megabyte raw has stopped
  // being a shard.
  for (const l of LEVELS) {
    const path = join(root, `content/verbs/${l}.json`);
    assert.ok(existsSync(path), `content/verbs/${l}.json is missing`);
    const kib = readFileSync(path).length / 1024;
    assert.ok(kib < 1200, `${l}.json is ${kib.toFixed(0)} KiB raw`);
  }
});

test('the build is deterministic — the same inputs give the same content', () => {
  // Two builds from identical inputs produced different files on 2026-10-03.
  // Every sort key in build-verbs.py is a frequency, thousands of verbs share
  // one, and the candidates were held in a SET whose iteration order Python
  // randomises per process — so ties fell out differently each run, every
  // rebuild made a content diff, and the review sheets went stale with nothing
  // having changed.
  //
  // This checks the property that fixes it rather than running the build twice
  // (which needs Lexique's 24.65 MiB): no two verbs may share a rank, and the
  // ranks must be exactly 1..n with no gaps. A tie broken arbitrarily shows up
  // as neither — it shows up as a DIFFERENT order, which only a second build
  // can see — so the real guard is the tiebreak itself, asserted in the source.
  const ranks = index.map((v) => v.rank);
  assert.equal(new Set(ranks).size, ranks.length, 'two verbs share a rank');
  const WITHHELD = 11;    // defective, not-a-verb, not-used-as-a-verb
  assert.ok(Math.min(...ranks) >= 1 && Math.max(...ranks) <= 2400,
    `ranks run ${Math.min(...ranks)}..${Math.max(...ranks)}`);
  // Rank is a position in the full 2,400 ordering, so the verbs withheld on
  // purpose leave gaps. Asserting 1..n accused a correct build — the invariant
  // is that the gaps are exactly the withheld ones.
  assert.equal(2400 - ranks.length, WITHHELD,
    `${2400 - ranks.length} ranks are missing and ${WITHHELD} verbs are withheld`);

  const src = readFileSync(join(root, 'scripts/build-verbs.py'), 'utf8');
  const sorts = [...src.matchAll(/key=lambda l:(.*)$/gm)].map((m) => m[1]);
  assert.ok(sorts.length >= 3, `found ${sorts.length} orderings — the pattern missed some`);
  // `, l)` is the tiebreak. `get(l, 0.0)` is not one, and reading the capture
  // only as far as the first `)` confused the two.
  const untied = sorts.filter((k) => !/,\s*l\s*\)/.test(k)).map((k) => k.trim());
  assert.deepEqual(untied, [],
    'an ordering has no tiebreak on the lemma, so equal frequencies order by '
    + 'set iteration and the build stops being reproducible');
});
