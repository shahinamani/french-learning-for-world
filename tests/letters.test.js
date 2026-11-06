/**
 * Letters (production écrite): the content file and the structure checks,
 * tested against each other.
 *
 * AGENTS.md section 3: a check runs against known-good data before it lands.
 * The known-good data here is the two model letters and the phrase banks in
 * content/letters.json — what the page TEACHES. If the desk flagged a phrase
 * the page recommends, the two would contradict each other in front of the
 * learner, so that is the first thing compared. Then each check is shown to
 * catch the mistake it exists for, because a check that passes everything
 * passes the model letters too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkLetter, countWords, greetingOf } from '../web/src/features/letters/model.ts';

const file = JSON.parse(readFileSync(new URL('../content/letters.json', import.meta.url), 'utf8'));
const kind = (id) => file.kinds.find((k) => k.id === id);
const modelText = (k) => k.model.segments.map((s) => s.text).join('\n\n');
const states = (kindId, text) => Object.fromEntries(checkLetter(kindId, text).map((c) => [c.id, c.state]));
const replacePart = (k, part, text) =>
  k.model.segments.map((s) => (s.part === part ? text : s.text)).join('\n\n');

// ── The file ────────────────────────────────────────────────────────────

test('there are exactly the two kinds, formal and informal', () => {
  assert.deepEqual(file.kinds.map((k) => k.id), ['formal', 'informal']);
  assert.equal(kind('formal').register, 'vous');
  assert.equal(kind('informal').register, 'tu');
});

test('every learner-facing field has French, English and Persian', () => {
  const missing = [];
  const need = (f, where) => {
    for (const l of ['fr', 'en', 'fa']) if (!f?.[l]?.trim()) missing.push(`${where}.${l}`);
  };
  for (const k of file.kinds) {
    need(k.name, `${k.id}.name`); need(k.when, `${k.id}.when`); need(k.registerNote, `${k.id}.registerNote`);
    need(k.model.title, `${k.id}.model.title`);
    k.pitfalls.forEach((p, i) => need(p, `${k.id}.pitfalls[${i}]`));
    for (const p of k.parts) {
      need(p.name, `${k.id}.${p.id}.name`); need(p.purpose, `${k.id}.${p.id}.purpose`);
      p.phrases.forEach((ph, i) => need(ph, `${k.id}.${p.id}.phrases[${i}]`));
    }
  }
  for (const t of file.tasks) need(t.task, t.id);
  assert.deepEqual(missing, []);
});

test('the model letter uses only its kind\'s parts, in the order the page teaches them', () => {
  for (const k of file.kinds) {
    const order = k.parts.map((p) => p.id);
    const seen = k.model.segments.map((s) => order.indexOf(s.part));
    assert.ok(!seen.includes(-1), `${k.id}: a segment names a part that is not listed`);
    assert.deepEqual(seen, [...seen].sort((a, b) => a - b), `${k.id}: segments out of order`);
  }
});

test('tasks belong to a kind, have unique ids, and none claims the free-writing id', () => {
  const ids = file.tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of file.tasks) {
    assert.ok(kind(t.kind), `${t.id}: unknown kind ${t.kind}`);
    assert.ok(t.id.startsWith(`letter.${t.kind}.`), `${t.id}: id does not name its kind`);
    assert.ok(!t.id.endsWith('.free'), `${t.id}: .free is the free-writing desk`);
    assert.equal(t.levelBasis, 'author', `${t.id}: a level is the author's until somebody measures it`);
  }
  for (const k of file.kinds) assert.ok(file.tasks.some((t) => t.kind === k.id), `${k.id} has no task`);
});

test('nobody is said to have reviewed it, and no exam figure is carried unverified', () => {
  assert.match(file.reviewNote, /NOT REVIEWED/);
  assert.match(file.examNote, /NOT VERIFIED/);
  for (const t of file.tasks) assert.deepEqual(t.review, { owner: null, teacher: null }, t.id);
  // AGENTS.md section 2: an unverified exam structure carries no figures.
  const text = JSON.stringify(file);
  assert.doesNotMatch(text, /"(?:minWords|wordsMin|wordTarget|minimum)"\s*:/);
});

// ── The checks against what the page teaches ─────────────────────────────

test('each model letter passes every structure check for its kind', () => {
  for (const k of file.kinds) {
    const bad = checkLetter(k.id, modelText(k)).filter((c) => c.state !== 'ok');
    assert.deepEqual(bad, [], `${k.id} model letter`);
  }
});

test('every greeting the page recommends is recognised as a greeting', () => {
  for (const k of file.kinds) {
    for (const ph of k.parts.find((p) => p.id === 'salutation').phrases) {
      const s = states(k.id, replacePart(k, 'salutation', ph.fr));
      assert.equal(s.salutation, 'ok', `${k.id}: « ${ph.fr} »`);
    }
  }
});

test('every closing the page recommends is recognised as a closing, and the formal ones echo the greeting', () => {
  for (const k of file.kinds) {
    for (const ph of k.parts.find((p) => p.id === 'closing').phrases) {
      const s = states(k.id, replacePart(k, 'closing', ph.fr));
      assert.equal(s.closing, 'ok', `${k.id}: « ${ph.fr} »`);
      if (k.id === 'formal') assert.equal(s.echo, 'ok', `echo: « ${ph.fr} »`);
      assert.equal(s.tone, 'ok', `tone: « ${ph.fr} »`);
    }
  }
});

test('no phrase the page recommends sets off the tone or register warnings of its own kind', () => {
  for (const k of file.kinds) {
    for (const p of k.parts) {
      for (const ph of p.phrases) {
        const s = states(k.id, `${modelText(k)}\n\n${ph.fr}`);
        assert.notEqual(s.tone, 'warn', `${k.id}.${p.id}: « ${ph.fr} »`);
        assert.notEqual(s.register, 'warn', `${k.id}.${p.id}: « ${ph.fr} »`);
      }
    }
  }
});

test('the outline is a start, not a pass: its brackets are flagged', () => {
  for (const k of file.kinds) {
    const s = states(k.id, k.outline);
    assert.equal(s.placeholders, 'warn', k.id);
    // The outline's own instructions say « vous » to the learner; that is not the letter's register.
    assert.notEqual(s.register, 'warn', `${k.id}: the instructions in brackets were read as the letter`);
    assert.equal(s.tone, 'ok', k.id);
  }
});

// ── Each check catches what it is for ───────────────────────────────────

const formal = modelText(kind('formal'));
const informal = modelText(kind('informal'));

test('an empty page is missing everything a formal letter needs', () => {
  const s = states('formal', '');
  for (const id of ['placeDate', 'object', 'salutation', 'closing', 'register', 'signature']) {
    assert.equal(s[id], 'missing', id);
  }
});

test('one tu in a formal letter is caught, including an elided t\'', () => {
  const c = checkLetter('formal', formal.replace('Je souhaiterais également savoir', 'Je t\'écris aussi pour savoir'));
  const r = c.find((x) => x.id === 'register');
  assert.equal(r.state, 'warn');
  assert.deepEqual(r.found, ["t'"]);
  assert.equal(states('formal', formal.replace('ma commande', 'ta commande')).register, 'warn');
});

test('familiar words in a formal letter, stiff ones in a friendly one', () => {
  assert.equal(states('formal', formal.replace('Camille MARTIN\n12', 'Salut !\n\nCamille MARTIN\n12')).tone, 'warn');
  assert.equal(states('informal', informal.replace("Je t'embrasse,", 'Veuillez agréer, chère Léa, mes salutations distinguées.')).tone, 'warn');
  assert.equal(states('informal', `Objet : Mon déménagement\n\n${informal}`).tone, 'warn');
  // « un objet » in a sentence is a noun, not a subject line.
  assert.equal(states('informal', informal.replace('Il est petit', "J'ai trouvé un objet ancien. Il est petit")).tone, 'ok');
});

test('email forms are told apart from letter forms', () => {
  assert.equal(states('formal', formal.replace('Madame, Monsieur,\n', 'Bonjour Madame,\n')).salutation, 'warn');
  const closing = kind('formal').model.segments.find((s) => s.part === 'closing').text;
  assert.equal(states('formal', formal.replace(closing, 'Cordialement,')).closing, 'warn');
});

test('a closing that does not repeat the greeting is caught', () => {
  const s = states('formal', formal.replace('Madame, Monsieur,\n', 'Monsieur le Directeur,\n'));
  assert.equal(s.salutation, 'ok');
  assert.equal(s.echo, 'warn');
});

test('vous to a friend is a question, not a fault, and no tu at all is noted', () => {
  assert.equal(states('informal', informal.replace('est-ce que tu serais libre', 'est-ce que vous seriez libres')).register, 'warn');
  assert.equal(states('informal', 'Chère Léa,\n\nIl fait beau.\n\nBises,\n\nInès').register, 'missing');
});

test('a letter that stops on a sentence is not signed', () => {
  assert.equal(states('informal', informal.replace(/\n\nInès$/, '')).signature, 'missing');
});

test('greetings are read off their own line, with « Cher » in its forms', () => {
  assert.equal(greetingOf('informal', 'Chère Léa,\n\nCoucou'), 'Chère Léa');
  assert.equal(greetingOf('informal', 'Salut Tom !\n'), 'Salut Tom');
  assert.equal(greetingOf('formal', 'Madame, Monsieur,\n\nJe'), 'Madame, Monsieur');
  assert.equal(greetingOf('formal', 'Je vous écris, Madame, pour'), null);
});

test('words are counted between spaces, punctuation alone is not a word', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords("l'école est là !"), 3);
  assert.equal(countWords('39 euros — merci.'), 3);
});

test('French quoted inside Persian is isolated, and every isolate is closed', () => {
  // The same rule as the exam papers (tests/i18n-four-languages.test.js):
  // « Lyon, le 6 novembre 2026 » inside a Persian sentence reorders on screen
  // without FSI…PDI around it, and a stray opener swallows the paragraph.
  const fa = [];
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) (k === 'fa' && typeof v === 'string' ? fa.push(v) : walk(v));
  };
  walk(file);
  const bare = fa.flatMap((s) => [...s.matchAll(/«([^«»⁨]*[A-Za-z][^«»]*)»/g)].map((m) => m[1]))
    .filter((q) => !/[؀-ۿ]/.test(q));
  assert.deepEqual(bare, [], 'a French quotation in Persian without FSI…PDI');
  for (const s of fa) {
    let depth = 0;
    for (const ch of s) { if (ch === '⁨') depth++; else if (ch === '⁩') depth--; assert.ok(depth >= 0, s); }
    assert.equal(depth, 0, s);
  }
});
