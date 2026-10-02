/**
 * The conjugator, checked against real French, on every push.
 *
 * Ninety verb models are hand-written. Their only reviewer is the corpus, and
 * until this file existed that reviewer did not run on any push: validation
 * needed a 24.65 MiB download that is not in the repository, so every change to
 * those models since they were written was verified on one machine and nowhere
 * else. A check that only the author can run is a check the next person will
 * break without knowing.
 *
 * `tests/fixtures/lexique-verbs.json.gz` is a reduced subset — the verb rows of
 * the 2,400 most frequent verbs, only the orthography and the tense/person tags
 * this project validates against. **150 KiB gzipped against 24.65 MiB**, which
 * is the whole reason committing it is reasonable where committing audio was
 * not. It is CC BY-SA 4.0, redistributed under the same licence, attributed in
 * `content/attribution.json` and visible to a learner at `/about`.
 *
 * What this asserts is not "the conjugator is right" — no corpus can say that,
 * and Lexique attests only about 19 of a verb's 45 forms. It asserts that every
 * form the corpus *does* hold is reproduced exactly, and that every
 * disagreement has been classified by hand. An unclassified disagreement is the
 * dangerous state: nobody has yet decided whether we are wrong or the corpus is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const oracle = JSON.parse(gunzipSync(
  readFileSync(join(root, 'tests/fixtures/lexique-verbs.json.gz'))).toString('utf8'));

/** Run the conjugator and get its own report, rather than reimplementing it. */
function validate() {
  const out = execFileSync('python3', [
    join(root, 'scripts/conjugate.py'), '--validate-fixture',
    join(root, 'tests/fixtures/lexique-verbs.json.gz'), '--show-failures', '0',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const num = (re) => { const m = out.match(re); return m ? Number(m[1].replace(/,/g, '')) : null; };
  return {
    out,
    considered: num(/verbs considered[^:]*:\s*([\d,]+)/),
    checked: num(/forms checked against the corpus:\s*([\d,]+)/),
    mismatches: num(/mismatches:\s*([\d,]+)/),
    clean: num(/verbs with every attested form correct:\s*([\d,]+)/),
    unclassified: num(/withheld as unclassified:\s*([\d,]+)/),
    shippable: num(/SHIPPABLE:\s*([\d,]+)/),
  };
}

test('the fixture is populated — a gate over an empty oracle is not a gate', () => {
  assert.equal(oracle.licence, 'CC BY-SA 4.0');
  assert.match(oracle.source, /Lexique/);
  const verbs = Object.keys(oracle.verbs);
  assert.ok(verbs.length >= 2000, `${verbs.length} verbs in the fixture`);
  const forms = verbs.reduce((n, v) => n + oracle.verbs[v].length, 0);
  assert.ok(forms >= 30000, `${forms} attested forms`);
  console.log(`    oracle: ${verbs.length} verbs, ${forms} attested forms`);
});

test('every form the corpus attests is reproduced exactly', () => {
  const r = validate();
  console.log(`    ${r.clean} of ${r.considered} verbs correct · ${r.checked} forms checked `
            + `· ${r.mismatches} mismatches · ${r.shippable} shippable`);
  assert.ok(r.checked >= 25000, `only ${r.checked} forms checked — the gate is not reading the oracle`);
  assert.ok(r.clean >= 2300, `${r.clean} verbs fully correct; this must not fall`);
});

test('no disagreement with the corpus is left unclassified', () => {
  const r = validate();
  assert.equal(r.unclassified, 0,
    'an unclassified disagreement means nobody has decided whether we are wrong '
    + 'or the corpus is — see scripts/conjugation_exceptions.py');
});

test('the gate reports failure when the conjugator is wrong', () => {
  // Seen red rather than assumed: a verb conjugated by a deliberately broken
  // rule must be counted as a mismatch. This runs the real script against a
  // one-verb fixture whose attested form cannot be produced.
  const broken = join(root, 'tests/fixtures/.gate-probe.json');
  const probe = {
    source: 'probe', licence: 'CC BY-SA 4.0',
    verbs: { parler: [['XXXparlons', 'ind:pre:1p']] },
  };
  writeProbe(broken, probe);
  try {
    const out = execFileSync('python3', [
      join(root, 'scripts/conjugate.py'), '--validate-fixture', broken, '--show-failures', '2',
    ], { cwd: root, encoding: 'utf8' });
    assert.match(out, /mismatches:\s*1\b/,
      'a form the conjugator cannot produce was not reported as a mismatch');
    assert.match(out, /withheld as unclassified:\s*1\b/,
      'an unclassified disagreement was not withheld');
  } finally {
    rmProbe(broken);
  }
});

function writeProbe(path, obj) {
  writeFileSync(path, gzipSync(Buffer.from(JSON.stringify(obj), 'utf8')));
}
function rmProbe(path) {
  rmSync(path, { force: true });
}
