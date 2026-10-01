/**
 * French typography, tested by RUNNING the formatter.
 *
 * The previous version of this file read `typography.ts` as text and asserted
 * the source contained a guillemet and an apostrophe. A completely broken
 * formatter satisfies that, and one nearly was: the apostrophe rule used `\w`,
 * which does not match an accented letter, so `l'élève`, `l'école`, `d'être`
 * and `j'étais` all kept their prime while `qu'il` was corrected. The test
 * passed throughout (docs/lessons.md #5).
 *
 * Every assertion here compares output to an expected string, and the accented
 * cases are first because they are the ones that were broken.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fr, frIf } from '../web/src/lib/typography.ts';
import { fold, sameFolded } from '../web/src/lib/fold.ts';

const NNBSP = ' ';   // U+202F narrow no-break space
const NBSP = ' ';    // U+00A0 no-break space
const RSQUO = '’';   // U+2019 right single quotation mark

// ── The bug this file failed to catch ─────────────────────────────────────

test('the apostrophe rule works beside accented letters', () => {
  assert.equal(fr("l'élève"), `l${RSQUO}élève`);
  assert.equal(fr("l'école"), `l${RSQUO}école`);
  assert.equal(fr("d'être"), `d${RSQUO}être`);
  assert.equal(fr("j'étais"), `j${RSQUO}étais`);
  assert.equal(fr("qu'il"), `qu${RSQUO}il`, 'the unaccented case that always worked');
  assert.equal(fr("aujourd'hui"), `aujourd${RSQUO}hui`);
  assert.equal(fr("l'œuf"), `l${RSQUO}œuf`, 'and beside a ligature');
});

test('an apostrophe that is not an elision is left alone', () => {
  assert.equal(fr("'"), "'", 'a lone prime is not a contraction');
  assert.equal(fr("' a"), "' a");
});

// ── Spacing ───────────────────────────────────────────────────────────────

test('narrow no-break space before ; ! ?', () => {
  assert.equal(fr('Vraiment ?'), `Vraiment${NNBSP}?`);
  assert.equal(fr('Vraiment?'), `Vraiment${NNBSP}?`, 'inserted when missing');
  assert.equal(fr('Écoute !'), `Écoute${NNBSP}!`, 'after an accented capital');
  assert.equal(fr('sœur ; frère'), `sœur${NNBSP}; frère`, 'after a ligature');
});

test('no-break space before a colon', () => {
  assert.equal(fr('Attention : ici'), `Attention${NBSP}: ici`);
  assert.equal(fr('Élève: ici'), `Élève${NBSP}: ici`);
});

test('a colon inside a URL or a clock time is not touched', () => {
  assert.equal(fr('https://example.org/a'), 'https://example.org/a');
  assert.equal(fr('à 8:30'), 'à 8:30');
  assert.equal(fr('de 9:05 à 10:15'), 'de 9:05 à 10:15');
});

test('guillemets take a narrow no-break space on the inside only', () => {
  assert.equal(fr('« exemple »'), `«${NNBSP}exemple${NNBSP}»`);
  assert.equal(fr('«exemple»'), `«${NNBSP}exemple${NNBSP}»`, 'inserted when missing');
  assert.equal(fr('« été »'), `«${NNBSP}été${NNBSP}»`, 'with accents inside');
  assert.equal(fr('« cœur »'), `«${NNBSP}cœur${NNBSP}»`, 'with a ligature inside');
  assert.equal(fr('Il a dit « oui ».'), `Il a dit «${NNBSP}oui${NNBSP}».`,
    'and nothing is added outside them');
});

test('no space is added before a full stop or a comma', () => {
  assert.equal(fr('Voilà.'), 'Voilà.');
  assert.equal(fr('un, deux, trois.'), 'un, deux, trois.');
});

test('long numbers are grouped, short ones are not, and accents nearby do not confuse it', () => {
  assert.equal(fr('1240 mots'), `1${NBSP}240 mots`);
  assert.equal(fr('240 mots'), '240 mots');
  assert.equal(fr('Chapitre 1240'), `Chapitre 1${NBSP}240`);
  assert.equal(fr('été 1240'), `été 1${NBSP}240`);
});

test('accented capitals keep their accents — the formatter must not strip them', () => {
  for (const s of ['ÉCOUTE', 'À BIENTÔT', 'ÊTRE', 'Ça', 'SŒUR']) {
    assert.equal(fr(s), s, `${s} is unchanged`);
  }
});

test('the formatter is idempotent over every rule it has', () => {
  const cases = ['Vraiment ?', 'Attention : ici', '« exemple »', "l'élève", "d'être",
    '1240 mots', 'Écoute !', 'sœur ; frère', 'https://example.org', 'à 8:30'];
  for (const s of cases) {
    const once = fr(s);
    assert.equal(fr(once), once, `stable for ${JSON.stringify(s)}`);
    assert.equal(fr(fr(once)), once, `stable over three passes for ${JSON.stringify(s)}`);
  }
});

test('frIf applies only to French', () => {
  assert.equal(frIf('fr', 'Vraiment ?'), `Vraiment${NNBSP}?`);
  assert.equal(frIf('en', 'Really ?'), 'Really ?');
  assert.equal(frIf('fa', 'Really ?'), 'Really ?');
  assert.equal(frIf('ar', 'Really ?'), 'Really ?');
});

// ── Folding, which is comparison and NOT rendering ────────────────────────

test('fold removes accents', () => {
  assert.equal(fold('été'), 'ete');
  assert.equal(fold('français'), 'francais');
  assert.equal(fold('où'), 'ou');
  assert.equal(fold('ÊTRE'), 'etre');
});

test('fold expands the œ and æ ligatures, which NFD does not', () => {
  // normalize('NFD') leaves œ alone: it is a letter, not a letter plus accent.
  assert.equal('œ'.normalize('NFD'), 'œ', 'NFD alone cannot do this');
  assert.equal(fold('sœur'), 'soeur');
  assert.equal(fold('cœur'), 'coeur');
  assert.equal(fold('œuf'), 'oeuf');
  assert.equal(fold('Œuvre'), 'oeuvre');
  assert.equal(fold('ex æquo'), 'ex aequo');
});

test('fold treats a typographic apostrophe and a prime as the same keystroke', () => {
  assert.ok(sameFolded("aujourd'hui", `aujourd${RSQUO}hui`));
});

test('sameFolded is true across accents, ligatures, case and spacing', () => {
  assert.ok(sameFolded('soeur', 'sœur'));
  assert.ok(sameFolded('  ÉTÉ ', 'ete'));
  assert.ok(sameFolded('Ça', 'ca'));
  assert.ok(!sameFolded('sœur', 'frère'), 'and false for genuinely different words');
  assert.ok(!sameFolded('sui', 'suis'), 'a missing letter is still a different word');
});

test('folding is never used for rendering — it is lossy on purpose', () => {
  // A reminder in executable form: the folded string is not French.
  assert.notEqual(fold('sœur'), 'sœur');
  assert.equal(fr('sœur'), 'sœur', 'the renderer keeps the correct spelling');
});
