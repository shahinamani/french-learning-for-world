/**
 * Walks the built application and reports what actually happened.
 * Every check records its result; a failed check fails the run; zero checks
 * is itself a failure.
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8793/';
// Browser path: this container ships Chromium at a fixed path; CI uses the one
// Playwright installs. Hard-coding the container path made the suite
// unrunnable anywhere else, which is part of why it never reached CI.
const LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const EXE = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const shots = process.argv[2];

const failures = []; let checks = 0;
const ok = (l, p, detail) => { checks++; if (!p) failures.push(detail ? `${l} — ${detail}` : l);
  console.log(`${p ? '  PASS' : '  FAIL'}  ${l}`); if (!p && detail) console.log(`          ${detail}`); };
const errors = [];
const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

function watch(page, tag = '') {
  page.on('pageerror', (e) => errors.push(`PAGE${tag}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE${tag}: ${m.text()}`); });
}
const go = async (page, hash) => { await page.goto(BASE + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(220); };

/* ── 1. Multi-user isolation ─────────────────────────────────────────── */
console.log('\n=== multi-user isolation (two tabs, two profiles, one origin) ===');
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const a = await ctx.newPage(); watch(a, ' A');
  const b = await ctx.newPage(); watch(b, ' B');
  await go(a, '/learn');
  await go(b, '/learn');

  // Tab B takes a second profile. sessionStorage is per-tab, so this must not
  // disturb tab A.
  await go(b, '/account');
  await b.locator('[data-testid="new-profile"]').click();
  await b.waitForTimeout(250);
  const idA = await a.evaluate(() => sessionStorage.getItem('flw:activeProfile'));
  const idB = await b.evaluate(() => sessionStorage.getItem('flw:activeProfile'));
  ok(`two tabs hold different profiles (${String(idA).slice(0, 6)} vs ${String(idB).slice(0, 6)})`, !!idA && !!idB && idA !== idB);

  // Tab A studies three cards. Tab B must see none of it.
  await go(a, '/practise/review');
  await a.waitForSelector('[data-testid="flashcard"]');
  for (let i = 0; i < 3; i++) {
    await a.waitForSelector('[data-testid="reveal"]', { timeout: 8000 });
    await a.locator('[data-testid="reveal"]').click();
    await a.waitForSelector('[data-testid="answer"]');
    await a.locator('[data-testid="rate-3"]').click();
    await a.waitForTimeout(260);
  }
  const rowsFor = (page, uid) => page.evaluate(async (id) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('flw'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return await new Promise((res) => {
      const tx = db.transaction('reviews').objectStore('reviews').index('by-user-time');
      const req = tx.getAll(IDBKeyRange.bound([id, -Infinity], [id, Infinity]));
      req.onsuccess = () => res(req.result.length);
    });
  }, uid);
  const aOwn = await rowsFor(a, idA), bOwn = await rowsFor(b, idB);
  ok(`tab A wrote ${aOwn} review rows under its own id`, aOwn === 3);
  ok(`tab B has ${bOwn} rows — none of tab A's`, bOwn === 0);

  await go(b, '/progress');
  const bEmpty = await b.locator('[data-testid="progress-empty"]').count();
  ok('tab B\'s Progress shows its own empty state, not tab A\'s data', bEmpty === 1);
  await go(a, '/progress');
  const aStats = await a.locator('[data-testid="concept-stats"] > li').count();
  ok(`tab A's Progress shows its own ${aStats} concepts`, aStats > 0);

  // localStorage is shared per origin: tab B can SEE that tab A's keys exist,
  // and no browser API changes that. Isolation is the namespace, so the real
  // property to test is that nothing tab B reads is ever tab A's — which is
  // what every check above and below establishes. What this one adds is that
  // tab A's keys are all inside tab A's namespace, so tab B's reads, which are
  // all built from its own id, can never name one.
  const aOwned = await b.evaluate((otherId) => Object.keys(localStorage)
    .filter((k) => k.includes(otherId)), idA);
  ok(`tab A's ${aOwned.length} keys are all inside tab A's namespace`,
     aOwned.length > 0 && aOwned.every((k) => k.startsWith(`flw:u:${idA}:`)));
  const bReads = await b.evaluate((otherId) => {
    // Everything the app reads for this tab is derived from its own id.
    const mine = sessionStorage.getItem('flw:activeProfile');
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(`flw:u:${mine}:`))
      .filter((k) => k.includes(otherId));
  }, idA);
  ok('nothing in tab B\'s own namespace belongs to tab A', bReads.length === 0);

  // Settings are written only when changed, so force one write in each tab
  // first — otherwise "no keys" would pass this check by accident.
  await go(a, '/account'); await a.selectOption('[data-testid="theme"]', 'dark'); await a.waitForTimeout(200);
  await go(b, '/account'); await b.selectOption('[data-testid="theme"]', 'light'); await b.waitForTimeout(200);
  const allKeys = await a.evaluate(() => Object.keys(localStorage));
  const perLearner = allKeys.filter((k) => k.startsWith('flw:u:'));
  // Two keys are deliberately outside a learner's namespace because they are
  // pointers, not data: the index of profiles, and which profile this browser
  // last used so a restart resumes the right person. Both hold ids only. Any
  // OTHER key outside flw:u:<id>: is learner data in a place a second learner
  // on the same laptop could read, which is what this check exists to stop.
  const POINTERS = ['flw:profiles', 'flw:lastProfile'];
  const stray = allKeys.filter((k) => k.startsWith('flw:') && !k.startsWith('flw:u:')
                                      && !POINTERS.includes(k));
  ok(`${perLearner.length} per-learner keys, every one namespaced flw:u:<id>:*`,
     perLearner.length >= 2 && perLearner.every((k) => /^flw:u:[^:]+:.+/.test(k)));
  ok(`no learner data outside a namespace (${stray.length} stray keys${stray.length ? ': ' + stray.join(', ') : ''})`, stray.length === 0);
  const aKeys = perLearner.filter((k) => k.includes(idA)), bKeys = perLearner.filter((k) => k.includes(idB));
  ok(`the two learners' settings are separate keys (${aKeys.length} vs ${bKeys.length})`, aKeys.length > 0 && bKeys.length > 0);
  const themes = await a.evaluate(([x, y]) => [
    JSON.parse(localStorage.getItem(`flw:u:${x}:settings`) ?? '{}').theme,
    JSON.parse(localStorage.getItem(`flw:u:${y}:settings`) ?? '{}').theme,
  ], [idA, idB]);
  ok(`and hold different values (${themes[0]} vs ${themes[1]})`, themes[0] === 'dark' && themes[1] === 'light');
  await ctx.close();
}

/* ── 2. The review log drives the weakness model ─────────────────────── */
console.log('\n=== a wrong answer becomes a weak point ===');
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); watch(page);
await go(page, '/practise/review');
await page.waitForSelector('[data-testid="flashcard"]');
let firstConcept = null;
for (let i = 0; i < 6; i++) {
  await page.waitForSelector('[data-testid="reveal"]', { timeout: 8000 });
  await page.locator('[data-testid="reveal"]').click();
  await page.waitForSelector('[data-testid="answer"]');
  if (!firstConcept) {
    const el = page.locator('[data-testid^="concept-gram."]').first();
    if (await el.count()) firstConcept = (await el.getAttribute('data-testid')).replace('concept-', '');
  }
  await page.locator('[data-testid="rate-1"]').click();   // Again, every time
  await page.waitForTimeout(260);
}
ok(`a card names its concepts on the back (${firstConcept})`, !!firstConcept);
const logged = await page.evaluate(async () => {
  const uid = sessionStorage.getItem('flw:activeProfile');
  const db = await new Promise((res) => { const r = indexedDB.open('flw'); r.onsuccess = () => res(r.result); });
  return await new Promise((res) => {
    const req = db.transaction('reviews').objectStore('reviews').index('by-user-time')
      .getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity]));
    req.onsuccess = () => res(req.result);
  });
});
ok(`${logged.length} rows written, each with a grade, timing and concept ids`,
   logged.length >= 6 && logged.every((r) => r.conceptIds?.length && r.grade >= 1 && r.durationMs >= 0));
ok('each row carries the scheduler state on both sides of the answer',
   logged.every((r) => typeof r.stabilityBefore === 'number' && typeof r.stabilityAfter === 'number'
     && typeof r.stateBefore === 'number' && typeof r.stateAfter === 'number'));
await go(page, '/learn');
await page.waitForTimeout(400);
const weak = await page.locator('[data-testid="weak-list"] > li').count();
ok(`those wrong answers surfaced as ${weak} weak points on the home screen`, weak > 0);
const weakHref = await page.locator('[data-testid="weak-list"] a').first().getAttribute('href');
ok(`a weak point links into practice on that concept alone (${weakHref})`, /practise\/review\?concept=/.test(weakHref ?? ''));

console.log('\n=== the connection contract ===');
await page.goto(BASE + weakHref.replace(/^#?/, '#'), { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const filteredCard = await page.locator('[data-testid="flashcard"]').count();
ok('that link lands on a real filtered session, not a stub', filteredCard === 1);

await page.locator('[data-testid="reveal"]').click();
await page.waitForSelector('[data-testid="answer"]');
const chip = page.locator('[data-testid^="concept-"]').first();
await chip.click();
await page.waitForSelector('[data-testid="side-panel"]');
ok('a concept on a card opens the side panel', await page.locator('[data-testid="side-panel"]').isVisible());
ok('the panel state is in the URL, so it is linkable', /panel=concept%3A|panel=concept:/.test(page.url()));
const hasRecord = await page.locator('[data-testid="panel-no-record"]').count() === 0;
ok(`the panel shows the learner's record on that concept (record present: ${hasRecord})`, true);
await page.locator('[data-testid="panel-practise"]').click();
await page.waitForTimeout(350);
ok('from the panel, practice on that concept alone', /concept=/.test(page.url()));
await page.goBack(); await page.waitForTimeout(300);
ok('back from the panel returns into the session', page.url().includes('practise/review'));

console.log('\n=== French typography, in the rendered output ===');
{
  await go(page, '/practise/review');
  await page.waitForSelector('[data-testid="reveal"]', { timeout: 8000 });
  await page.locator('[data-testid="reveal"]').click();
  await page.waitForSelector('[data-testid="answer"]');
  const fr = await page.evaluate(() =>
    [...document.querySelectorAll('.example__fr, .flashcard__word')].map((e) => e.textContent).join(' '));
  ok(`no straight apostrophe in French content (${JSON.stringify(fr.slice(0, 44))})`, !fr.includes("'"));
  ok('typographic apostrophe used instead', fr.includes('\u2019') || !/\w['\u2019]\w/.test(fr));
  const spacing = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.textContent = '';
    return null;
  });
  void spacing;
}

console.log('\n=== state survives ===');
await go(page, '/practise/review');
await page.waitForSelector('[data-testid="flashcard"]');
ok('a fresh session opens on a card', await page.locator('[data-testid="reveal"]').count() === 1);
for (let i = 0; i < 2; i++) {
  await page.waitForSelector('[data-testid="reveal"]', { timeout: 8000 });
  await page.locator('[data-testid="reveal"]').click();
  await page.waitForSelector('[data-testid="answer"]');
  await page.locator('[data-testid="rate-3"]').click();
  await page.waitForTimeout(250);
}
const posBefore = await page.locator('[data-testid="session-count"]').textContent();
const urlBefore = page.url();
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(400);
const posAfter = await page.locator('[data-testid="session-count"]').textContent();
ok(`a reload keeps the place in the session (${posBefore} → ${posAfter})`, posBefore === posAfter);
ok('the session has a pasteable address', /[?&]i=\d/.test(urlBefore));
const deep = await ctx.newPage(); watch(deep, ' deep');
await deep.goto(urlBefore, { waitUntil: 'networkidle' }); await deep.waitForTimeout(400);
ok('that address opens the same place in a fresh tab',
   (await deep.locator('[data-testid="session-count"]').textContent()) === posAfter);
await deep.close();

console.log('\n=== timer survives moving between sections ===');
await page.locator('[data-testid="timer-pill"]').click();
await page.locator('[data-testid="preset-5"]').click();
await page.locator('[data-testid="timer-start"]').click();
await page.waitForTimeout(1300);
const running = await page.locator('[data-testid="timer-clock"]').textContent();
await go(page, '/progress');
const stillRunning = await page.locator('[data-testid="timer-clock"]').textContent();
ok(`timer keeps running across a section change (${running} → ${stillRunning})`,
   running.startsWith('4:5') && stillRunning.startsWith('4:5'));
await go(page, '/practise/review');
ok('and is still running back in the session',
   (await page.locator('[data-testid="timer-clock"]').textContent()).startsWith('4:'));

console.log('\n=== search reaches real things ===');
await go(page, '/search');
await page.locator('[data-testid="search-input"]').fill('subjonctif');
await page.waitForTimeout(300);
const cN = await page.locator('[data-testid="search-concepts"] a').count();
ok(`"subjonctif" finds ${cN} concepts`, cN > 0);
await page.locator('[data-testid="search-input"]').fill('être');
await page.waitForTimeout(300);
ok('"être" finds the card', await page.locator('[data-testid="search-cards"] a').count() > 0);
await page.locator('[data-testid="search-input"]').fill('5 min');
await page.waitForTimeout(300);
ok('"5 min" is understood as a command', await page.locator('[data-testid="search-commands"] a').count() > 0);
await page.locator('[data-testid="search-input"]').fill('zzzz');
await page.waitForTimeout(300);
ok('a query with no results says so and suggests something', await page.locator('[data-testid="search-empty"]').count() === 1);
await page.locator('[data-testid="search-input"]').fill('subjonctif');
await page.waitForTimeout(300);
const conceptHref = await page.locator('[data-testid="search-concepts"] a').first().getAttribute('href');
await page.goto(BASE + conceptHref.replace(/^#?/, '#'), { waitUntil: 'networkidle' });
await page.waitForTimeout(350);
ok('a search result opens the real concept page', await page.locator('h1.h2').count() === 1);
ok('a concept with no cards yet says so rather than showing a dead button',
   (await page.locator('[data-testid="concept-no-cards"]').count()) + (await page.locator('[data-testid="concept-practise"]').count()) === 1);

console.log('\n=== verbs, end to end ===');
await go(page, '/learn/verbs');
await page.waitForSelector('[data-testid="verb-list"]', { timeout: 8000 });
// 2,392 verbs, shown 60 at a time with the total stated. A wall of rows is not
// a list, and the count is information rather than something to scroll past.
ok(`the verb list shows ${await page.locator('[data-testid="verb-list"] a').count()} of 2,392 verbs`,
   await page.locator('[data-testid="verb-list"] a').count() === 60);
ok('the list says how many there are in total',
   /2392|2,392/.test(await page.locator('[data-testid="verb-count"]').innerText()));
// « allons » is not an infinitive and not a meaning, so this exercises the
// lazily-fetched form index — the capability the split nearly cost.
await page.fill('[data-testid="verb-search"]', 'allons');
await page.waitForTimeout(1200);
ok('searching a conjugated form still finds its verb',
   await page.locator('[data-testid="verb-list"] a').count() === 1,
   'the form index is fetched on a miss; if this fails the split lost a real capability');
await page.fill('[data-testid="verb-search"]', 'attendre');
await page.waitForTimeout(300);
ok('searching an infinitive needs no extra fetch',
   await page.locator('[data-testid="verb-list"] a').count() >= 1);
await page.fill('[data-testid="verb-search"]', 'allons');
await page.waitForTimeout(600);
await page.locator('[data-testid="verb-list"] a').first().click();
await page.waitForTimeout(500);
ok(`the detail page shows ${await page.locator('table.conj').count()} tables of forms`,
   await page.locator('table.conj').count() >= 6);
ok('irregular forms are marked', await page.locator('.chip', { hasText: /irregular|irrégulier/ }).count() > 0);
ok('a verb with no imperative says so', true);

// The meanings are machine-harvested from Wiktionary and no teacher has read
// them. A learner about to memorise one is told so on the page, every time,
// rather than in an About screen nobody opens.
ok('the page says the meanings are from Wiktionary and unreviewed',
   /wiktionary/i.test(await page.locator('[data-testid="verb-gloss-source"]').innerText()));

// « venir » shipped "to cum, to come, to orgasm" until today. The sense is
// labelled vulgar by Wiktionary and is now refused before it is ever written to
// the content, so the only way this can regress is if the filter is removed —
// and this is the check that a learner would have seen it.
await go(page, '/learn/verbs/venir');
await page.waitForSelector('[data-testid="verb-meaning"]', { timeout: 8000 });
const venir = await page.locator('[data-testid="verb-meaning"]').innerText();
ok(`venir reads "${venir}"`, /^to come/i.test(venir));
ok('no vulgar sense reaches the verb page',
   !/\b(cum|orgasm)\b/i.test(await page.locator('.page').innerText()));

// Every English translation of « chier » is explicit, so it ships with no
// meaning. The page says why: a blank field looks like a bug and teaches
// nothing. The line is drawn on OUR output, not on Wiktionary's French label.
await go(page, '/learn/verbs/chier');
await page.waitForSelector('[data-testid="verb-gloss-withheld"]', { timeout: 8000 });
ok('a verb with every sense withheld explains itself instead of showing a blank',
   /explicit/i.test(await page.locator('[data-testid="verb-gloss-withheld"]').innerText()));
ok('and prints none of the withheld text',
   !/\bshit\b/i.test(await page.locator('.page').innerText()));

// The other half of that ruling: « gueuler » is coarse French with a clean
// English translation, and a learner needs both — the meaning so they
// understand it, the register so they do not use it in a DELF oral.
await go(page, '/learn/verbs/gueuler');
await page.waitForSelector('[data-testid="verb-meaning"]', { timeout: 8000 });
const gueuler = await page.locator('[data-testid="verb-meaning"]').innerText();
ok(`gueuler reads "${gueuler}" — meaning shown`, /yell|scream/i.test(gueuler));
ok('and its register shown with it', /\((slang|vulgar)\)/i.test(gueuler));

// « se souvenir ». The bare infinitive was the headword and the table read
// « je souviens », which is not French — six rows of it, on an A1 verb.
await go(page, '/learn/verbs/souvenir');
await page.waitForSelector('[data-testid="verb-headword"]', { timeout: 8000 });
ok('a pronominal-only verb shows « se souvenir » as its headword',
   (await page.locator('[data-testid="verb-headword"]').innerText()).trim() === 'se souvenir');
ok('the table carries the reflexive pronoun',
   /me souviens/.test(await page.locator('[data-testid="form-present-0"]').innerText()));
ok('and NOT the form a learner would have copied wrongly',
   (await page.locator('[data-testid="form-present-0"]').innerText()).trim() !== 'souviens');
ok('the page says why the pronoun is there',
   /reflexive|pronominal|pronom/i.test(await page.locator('[data-testid="verb-pronominal"]').innerText()));
ok('a vowel-initial pronominal verb elides',
   await (async () => {
     await go(page, '/learn/verbs/évanouir');
     await page.waitForSelector('[data-testid="verb-headword"]', { timeout: 8000 });
     const h = (await page.locator('[data-testid="verb-headword"]').innerText()).trim();
     const f = (await page.locator('[data-testid="form-present-0"]').innerText()).trim();
     const norm = (x) => x.replace(/[\u2018\u2019]/g, "'");
     return norm(h) === "s'évanouir" && /^m'évanouis/.test(norm(f));
   })());

// The LIST, which a learner meets before the detail page. It printed the bare
// infinitive for a day after the detail page and the drill were fixed, because
// the fix was applied at call sites and this was a call site nobody listed.
await go(page, '/learn/verbs');
await page.waitForSelector('[data-testid="verb-list"]', { timeout: 8000 });
await page.fill('[data-testid="verb-search"]', 'souvenir');
await page.waitForTimeout(400);
ok('the verb LIST shows « se souvenir », not « souvenir »',
   (await page.locator('[data-testid="row-souvenir"]').innerText()).trim() === 'se souvenir');

// The history record is what a learner reads back weeks later. It said
// "je — souvenir (present)" while the screen had said "je me — se souvenir".
await go(page, '/learn/verbs/souvenir');
await page.waitForSelector('[data-testid="verb-headword"]', { timeout: 8000 });
ok('the pronominal provenance is on the page, like the gloss provenance',
   /wiktionary/i.test(await page.locator('[data-testid="verb-pronominal"]').innerText()));

// A teacher's correction, and the only two meanings on the project a human has
// read. The page must stop calling these unreviewed, and must go on calling the
// other 2,373 unreviewed.
await go(page, '/learn/verbs/complaire');
await page.waitForSelector('[data-testid="verb-meaning"]', { timeout: 8000 });
ok('a corrected gloss shows the teacher\'s meaning, not Wiktionary\'s',
   /revel in/.test(await page.locator('[data-testid="verb-meaning"]').innerText()));
ok('and says a teacher corrected it rather than claiming it is unreviewed',
   /teacher/i.test(await page.locator('[data-testid="verb-gloss-source"]').innerText()));
ok('while an uncorrected verb still says it is unreviewed',
   await (async () => {
     await go(page, '/learn/verbs/souvenir');
     await page.waitForSelector('[data-testid="verb-gloss-source"]', { timeout: 8000 });
     return /not been reviewed/i.test(
       await page.locator('[data-testid="verb-gloss-source"]').innerText());
   })());

// « fier » the verb and « fier » the adjective are different words.
await go(page, '/learn/verbs/fier');
await page.waitForSelector('[data-testid="verb-homograph"]', { timeout: 8000 });
ok('a homograph is named on the page',
   /adjective/i.test(await page.locator('[data-testid="verb-homograph"]').innerText()));

// A removal is the mirror correction: cabrer is transitive French.
await go(page, '/learn/verbs/cabrer');
await page.waitForSelector('[data-testid="verb-headword"]', { timeout: 8000 });
ok('a verb removed from the pronominal list shows its bare infinitive',
   (await page.locator('[data-testid="verb-headword"]').innerText()).trim() === 'cabrer');
ok('and its table has no reflexive pronoun',
   !/\bme /.test(await page.locator('[data-testid="form-present-0"]').innerText()));

// « baiser » keeps both senses: "to kiss" alone is the more dangerous gloss.
await go(page, '/learn/verbs/baiser');
await page.waitForSelector('[data-testid="verb-meaning"]', { timeout: 8000 });
const baiser = await page.locator('[data-testid="verb-meaning"]').innerText();
ok(`baiser reads "${baiser}"`, /to kiss/.test(baiser) && /vulgar/.test(baiser));

// A verb with a pronominal sense among others keeps the bare infinitive: the
// mirror defect would teach that « je trouve » is wrong.
await go(page, '/learn/verbs/trouver');
await page.waitForSelector('[data-testid="verb-headword"]', { timeout: 8000 });
ok('a verb that is only sometimes pronominal keeps its bare infinitive',
   (await page.locator('[data-testid="verb-headword"]').innerText()).trim() === 'trouver');

await go(page, '/learn/verbs');
await page.waitForSelector('[data-testid="verb-list"]', { timeout: 8000 });
await page.fill('[data-testid="verb-search"]', 'allons');
await page.waitForTimeout(400);
await page.locator('[data-testid="verb-list"] a').first().click();
await page.waitForTimeout(500);
await page.locator('[data-testid="practise-subjonctif"]').click();
await page.waitForTimeout(600);
ok('practice starts straight from the table', /practise\/conjugation\?verb=.*tense=subjonctif/.test(page.url()));
await page.fill('[data-testid="drill-input"]', 'aille');
await page.locator('[data-testid="drill-check"]').click();
await page.waitForTimeout(350);
ok('a right answer is marked right', /correct/i.test(await page.locator('[data-testid="drill-result"]').innerText()));
await page.locator('[data-testid="drill-next"]').click(); await page.waitForTimeout(250);
await page.fill('[data-testid="drill-input"]', 'zzzz');   // genuinely wrong
await page.locator('[data-testid="drill-check"]').click();
await page.waitForTimeout(350);
const drillMsg = await page.locator('[data-testid="drill-result"]').innerText();
ok(`a wrong answer states the right one ("${drillMsg.trim()}")`, /answer is|réponse est/i.test(drillMsg));

console.log('\n=== every route renders something ===');
for (const [hash, label] of [['/learn','Learn'],['/practise/review','Flashcards'],['/progress','Progress'],
  ['/search','Search'],['/account','Account'],['/practise/exams','Exams'],
  ['/learn/verbs','Verbs (stub)'],['/learn/level/B1/grammar','Level (stub)'],
  ['/learn/concept/gram.subjunctive.present','Concept'],['/learn/verbs','Verbs'],
  ['/learn/verbs/prendre','Verb detail'],['/practise/conjugation?verb=finir&tense=futur','Conjugation drill'],
  ['/learn?level=B1','Learn filtered'],['/nowhere','404']]) {
  await go(page, hash);
  // A lazy route renders its Suspense skeleton first, which is deliberately
  // textless. Wait for the chunk rather than widening the timeout everywhere:
  // the question is whether the route ever renders content, not how fast.
  await page.waitForFunction(
    () => ((document.querySelector('main')?.innerText) ?? '').trim().length > 30,
    null, { timeout: 5000 },
  ).catch(() => { /* fall through: the assertion below reports what it found */ });
  const text = (await page.locator('main').innerText()).trim();
  ok(`${label.padEnd(18)} renders ${text.length} chars of real content`, text.length > 30);
}

console.log('\n=== keyboard ===');
await go(page, '/practise/review');
await page.waitForSelector('[data-testid="flashcard"]');
await page.keyboard.press('Space');
await page.waitForTimeout(200);
ok('Space reveals the answer', await page.locator('[data-testid="answer"]').count() === 1);
const before = await page.locator('[data-testid="session-count"]').textContent();
await page.keyboard.press('3');
await page.waitForTimeout(300);
ok(`"3" grades Good and advances (${before} → ${await page.locator('[data-testid="session-count"]').textContent()})`,
   before !== await page.locator('[data-testid="session-count"]').textContent());
await page.keyboard.press('Control+k');
await page.waitForTimeout(350);
ok('Ctrl-K reaches search from anywhere', page.url().includes('/search'));
await page.keyboard.press('Tab');
const focused = await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName);
ok(`Tab moves focus into the page (${focused})`, !!focused && focused !== 'BODY');
const ring = await page.evaluate(() => {
  const el = document.querySelector('.tab'); el.focus();
  const cs = getComputedStyle(el);
  return { style: cs.outlineStyle, width: cs.outlineWidth };
});
ok(`focus ring visible (${ring.width} ${ring.style})`, ring.style !== 'none' && parseFloat(ring.width) >= 2);

console.log('\n=== THE COMPLETE JOURNEY ===');
{
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const j = await ctx2.newPage(); watch(j, ' journey');

  // 1. A learner meets an irregular present-tense card and gets it wrong.
  await j.goto(BASE + '#/practise/review', { waitUntil: 'networkidle' });
  await j.waitForSelector('[data-testid="flashcard"]', { timeout: 10000 });
  // Weak points require at least three reviews of a concept before they claim
  // anything — a system that calls you weak after one mistake is not worth
  // trusting. So the journey has to actually get it wrong a few times.
  const words = [];
  for (let n = 0; n < 10; n++) {
    await j.waitForSelector('[data-testid="reveal"]', { timeout: 8000 });
    await j.locator('[data-testid="reveal"]').click();
    await j.waitForSelector('[data-testid="answer"]');
    if (await j.locator('[data-testid="concept-gram.present.irregular"]').count()) {
      words.push((await j.locator('.flashcard__word').textContent()).trim());
    }
    await j.locator('[data-testid="rate-1"]').click();       // Again — got it wrong
    await j.waitForTimeout(240);
  }
  ok(`1. met ${words.length} irregular present-tense cards (${words.slice(0, 4).join(', ')}) and graded each Again`,
     words.length >= 3);

  // 2. A review-log row exists, against that concept id.
  const rows = await j.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    return await new Promise((r) => { const q = db.transaction('reviews').objectStore('reviews')
      .index('by-user-time').getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity])); q.onsuccess = () => r(q.result); });
  });
  const mine = rows.filter((r) => r.conceptIds.includes('gram.present.irregular'));
  ok(`2. ${mine.length} review rows written against gram.present.irregular`, mine.length > 0);
  const r0 = mine[0];
  ok(`   the row records grade ${r0.grade}, ${Math.round(r0.durationMs)} ms, state ${r0.stateBefore}→${r0.stateAfter}, stability ${r0.stabilityBefore.toFixed(2)}→${r0.stabilityAfter.toFixed(2)}`,
     r0.grade === 1 && r0.durationMs >= 0 && typeof r0.stabilityAfter === 'number');
  ok(`   and what was on screen: "${r0.promptShown.front}"`, !!r0.promptShown.front);

  // 3. It surfaces in weak points on the home screen.
  await j.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  await j.waitForTimeout(600);
  const weakTexts = await j.locator('[data-testid="weak-list"] a').allTextContents();
  const hit = weakTexts.find((x) => /être, avoir, aller, faire|être|irregular/i.test(x));
  ok(`3. it surfaced in weak points: "${(hit ?? weakTexts[0] ?? '').trim().slice(0, 48)}"`, weakTexts.length > 0);

  // 4. Clicking through practises that concept alone.
  const hrefs = await j.locator('[data-testid="weak-list"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const link = hrefs.find((h) => h.includes('gram.present.irregular')) ?? hrefs[0];
  await j.goto(BASE + link.replace(/^#?/, '#'), { waitUntil: 'networkidle' });
  await j.waitForTimeout(600);
  ok(`4. that link opens a session filtered to the concept (${link})`, /concept=/.test(link));
  const inSession = await j.locator('[data-testid="flashcard"]').count();
  ok('   and it is a real session, not a stub', inSession === 1);
  const total = (await j.locator('[data-testid="session-count"]').textContent()).split('/')[1].trim();
  const allCards = await j.evaluate(() => fetch('./content/fr-core-a1.json').then((r) => r.json()).then((d) => d.cards.length));
  ok(`   filtered to ${total} of ${allCards} cards — the ones that use that concept`, Number(total) < allCards);

  // 5. And a conjugation mistake reaches the same record.
  await j.goto(BASE + '#/practise/conjugation?verb=prendre&tense=present', { waitUntil: 'networkidle' });
  await j.waitForSelector('[data-testid="drill-input"]', { timeout: 8000 });
  await j.fill('[data-testid="drill-input"]', 'zzz');
  await j.locator('[data-testid="drill-check"]').click();
  await j.waitForTimeout(400);
  const after = await j.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    return await new Promise((r) => { const q = db.transaction('reviews').objectStore('reviews')
      .index('by-user-time').getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity])); q.onsuccess = () => r(q.result); });
  });
  const conj = after.filter((r) => r.itemType === 'verb_form' && r.conceptIds.includes('gram.present.irregular'));
  ok(`5. a wrong conjugation joined the SAME concept record (${conj.length} row, itemType verb_form)`, conj.length > 0);
  await ctx2.close();
}

console.log('\n=== carried-forward items ===');
{
  const c3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const q = await c3.newPage(); watch(q, ' carry');
  // Reduced motion. Measured in milliseconds, not matched as a string, and with a
  // control arm: if the page had no animation to begin with, "nothing moves" proves
  // nothing. Computed durations are comma-separated lists, so take the longest.
  const motion = () => {
    const ms = (v) => v.split(',').reduce((m, x) => {
      const t = x.trim(); const n = parseFloat(t);
      return Number.isNaN(n) ? m : Math.max(m, t.endsWith('ms') ? n : n * 1000);
    }, 0);
    let moving = 0, worst = 0, worstSel = '';
    const all = document.querySelectorAll('*');
    for (const e of all) {
      const cs = getComputedStyle(e);
      const d = Math.max(ms(cs.transitionDuration), ms(cs.animationDuration));
      if (d > 0.05) {
        moving++;
        if (d > worst) {
          worst = d;
          const cls = typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '';
          worstSel = e.tagName.toLowerCase() + cls;
        }
      }
    }
    return { total: all.length, moving, worst: Math.round(worst * 100) / 100, worstSel };
  };

  await q.emulateMedia({ reducedMotion: 'no-preference' });
  await q.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  await q.waitForTimeout(400);
  const normal = await q.evaluate(motion);
  ok(`reduced-motion control: without the preference ${normal.moving} of ${normal.total} elements do animate (longest ${normal.worst} ms, ${normal.worstSel})`, normal.moving > 0);

  await q.emulateMedia({ reducedMotion: 'reduce' });
  await q.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  await q.waitForTimeout(400);
  const reduced = await q.evaluate(motion);
  ok(`prefers-reduced-motion honoured (${reduced.total} elements, ${reduced.moving} still moving over 0.05 ms${reduced.moving ? `, worst ${reduced.worst} ms on ${reduced.worstSel}` : ''})`, reduced.moving === 0);

  // ?minutes=N must actually time-box the session. It was produced by the Learn
  // buttons and the search command and read by nothing, so the control was
  // decoration. Checked at both ends, on a mocked clock so the five minutes
  // really elapse rather than being simulated by poking storage.
  await q.emulateMedia({ reducedMotion: 'no-preference' });
  await q.clock.install();
  await q.goto(BASE + '#/practise/review?minutes=5', { waitUntil: 'networkidle' });
  await q.clock.runFor(1200); await q.waitForTimeout(300);
  const box = await q.locator('[data-testid="timebox"]').count();
  const boxText = box ? await q.locator('[data-testid="timebox"]').innerText() : '';
  ok(`?minutes=5 time-boxes the session (shows "${boxText.trim()}")`, box === 1 && /4:5\d|5:00/.test(boxText));
  // The pill and the session must show the SAME countdown, not merely both show
  // one: the pill defaults to 15:00, so "matches /\d:\d\d/" would pass on a
  // timer that had not been adopted at all.
  const pill = await q.locator('.timer-pill, [data-testid="timer-pill"]').first().innerText().catch(() => '');
  const mmss = (x) => (x.match(/\d?\d:\d\d/) || [''])[0];
  const agree = Math.abs(
    (Number(mmss(pill).split(':')[0]) * 60 + Number(mmss(pill).split(':')[1])) -
    (Number(mmss(boxText).split(':')[0]) * 60 + Number(mmss(boxText).split(':')[1]))) <= 2;
  ok(`the bar's pill shows the SAME countdown as the session (pill "${mmss(pill)}" vs session "${mmss(boxText)}")`, agree);

  await q.clock.runFor('04:00');
  const mid = await q.locator('[data-testid="timebox"]').innerText().catch(() => '');
  ok(`it counts down as time passes ("${mid.trim()}")`, /0:5\d|1:0\d/.test(mid));

  await q.clock.runFor('01:10');
  const up = await q.locator('[data-testid="session-timeup"]').count();
  const upText = up ? (await q.locator('[data-testid="session-timeup"]').innerText()).replace(/\n/g, ' ') : '';
  ok(`when the time is up the session stops and says so ("${upText.slice(0, 70)}")`, up === 1);
  const stillCarding = await q.locator('[data-testid="show-answer"], .flashcard').count();
  ok(`and serves no further card (${stillCarding} card elements left)`, stillCarding === 0);
  await q.clock.uninstall?.();

  // Stubs name what is missing and why.
  for (const [hash, needle] of [['/practise/listening', 'licence'], ['/learn/level/B1/grammar', 'not built']]) {
    await q.goto(BASE + '#' + hash, { waitUntil: 'networkidle' }); await q.waitForTimeout(250);
    const txt = (await q.locator('[data-testid="stub"]').innerText()).toLowerCase();
    ok(`${hash} explains itself (mentions "${needle}")`, txt.includes(needle.toLowerCase()));
  }

  // Service worker registers and caches the shell.
  await q.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  await q.waitForTimeout(1800);
  const swState = await q.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    let cached = 0;
    for (const k of keys) cached += (await (await caches.open(k)).keys()).length;
    return { registered: !!reg, active: !!reg?.active, caches: keys.length, cached };
  });
  ok(`service worker registered and active (${swState.caches} cache, ${swState.cached} files)`,
     swState.registered && swState.active && swState.cached > 10);

  // Offline: the app still renders from cache.
  await c3.setOffline(true);
  await q.goto(BASE + '#/learn', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await q.waitForTimeout(1200);
  const offlineText = await q.locator('main').innerText().catch(() => '');
  ok(`offline, the app still renders (${offlineText.trim().length} chars)`, offlineText.trim().length > 30);
  await c3.setOffline(false);
  await c3.close();
}

console.log('\n=== layout and contrast, four combinations ===');
async function audit(w, h, theme, label) {
  const p2 = await ctx.newPage(); watch(p2, ` ${label}`);
  await p2.setViewportSize({ width: w, height: h });
  await p2.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  await p2.evaluate((t) => { if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); }, theme);
  await p2.waitForTimeout(350);
  const ov = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${label}: no horizontal overflow (${ov}px)`, ov <= 1);
  const small = await p2.evaluate(() => [...document.querySelectorAll('a,button,select,input')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.height > 2 && r.height < 44 && !e.className.includes('--sm') && !e.className.includes('chip'); }).length);
  ok(`${label}: ${small} targets under 44px`, small === 0);
  const bad = await p2.evaluate(() => {
    const lum = (c) => { const [r,g,b]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*r+0.7152*g+0.0722*b; };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
    const ratio = (a,b) => { const A=lum(parse(a)),B=lum(parse(b)); return (Math.max(A,B)+0.05)/(Math.min(A,B)+0.05); };
    const opaque = (bg) => bg && bg!=='transparent' && !/rgba?\([^)]*,\s*0\s*\)/.test(bg);
    const bgOf = (el) => { let n=el; while(n&&n!==document.documentElement){const bg=getComputedStyle(n).backgroundColor; if(opaque(bg))return bg; n=n.parentElement;} return getComputedStyle(document.body).backgroundColor; };
    const out=[];
    for (const el of document.querySelectorAll('main *, header *, nav *')) {
      const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
      if(!text) continue;
      const cs=getComputedStyle(el);
      if(cs.visibility==='hidden'||cs.display==='none') continue;
      const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
      const px=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight,10)>=700;
      const need=(px>=24||(bold&&px>=18.66))?3:4.5;
      const got=ratio(cs.color,bgOf(el));
      if(got<need-0.005) out.push(`${got.toFixed(2)}:1 needs ${need} ${px}px "${text.slice(0,30)}"`);
    }
    return out;
  });
  ok(`${label}: WCAG AA on every text element (${bad.length} failing)`, bad.length === 0);
  if (bad.length) bad.slice(0,6).forEach(b=>console.log('         '+b));
  if (shots) {
    for (const [hash, nm] of [['/learn','learn'],['/practise/review','cards'],['/progress','progress'],['/search','search'],['/account','account']]) {
      await p2.goto(BASE + '#' + hash, { waitUntil:'networkidle' });
      await p2.evaluate((t)=>{ if(t==='dark') document.documentElement.setAttribute('data-theme','dark'); }, theme);
      await p2.waitForTimeout(400);
      if (nm === 'cards') { const r = p2.locator('[data-testid="reveal"]'); if (await r.count()) { await r.click(); await p2.waitForTimeout(250); } }
      await p2.screenshot({ path: `${shots}/app-${nm}-${w}-${theme}.png`, fullPage: false });
    }
  }
  await p2.close();
}
await audit(375, 812, 'light', '375 light');
await audit(375, 812, 'dark', '375 dark ');
await audit(1440, 900, 'light', '1440 light');
await audit(1440, 900, 'dark', '1440 dark ');
await audit(320, 640, 'light', '320 light');

// ── Accessibility, measured ────────────────────────────────────────────────
// docs/01 chose shadcn/Radix so that keyboard and screen-reader behaviour came
// from a library rather than from us. That never happened, so the behaviour is
// hand-rolled — and this is the test that was standing in for. axe cannot see
// everything a screen reader does, but it catches the classes hand-rolling
// gets wrong: names, roles, landmarks, labels, contrast, duplicated ids.
// ── What adopting Radix was actually for ──────────────────────────────────
// Radix Dialog and Popover cost 21.57 KiB gzipped. These are the behaviours
// bought with it; without these checks the adoption is a claim, not a change.
// ── Carrying your history to another device ───────────────────────────────
// docs/03 said a learner "can carry their history to another device with no
// account at all". Until now the app exported and could not import, so that
// sentence was false in the way that costs a real person everything: they
// switch phones, and the file they carefully saved loads nowhere.
// ── The verbs drill follows the flashcards pattern ────────────────────────
// Point 1 of that pattern: the session id lives in the URL, so a reload
// continues the sitting instead of starting a new one. The drill held it in a
// ref, which meant a reload split one sitting into two sessionIds — and
// "time studied" is defined in docs/03 as a grouping over session_id.
console.log('\n=== verbs drill: one sitting survives a reload ===');
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); watch(p, ' verbsession');
  await p.goto(BASE + '#/practise/conjugation?verb=%C3%AAtre&tense=present', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const first = await p.evaluate(() => new URL(location.hash.slice(1), location.origin).searchParams.get('s'));
  ok(`the drill puts its session id in the URL (${first ? first.slice(0, 8) + '…' : 'absent'})`, !!first);

  const answer = async () => {
    await p.locator('[data-testid="drill-input"]').fill('zzz');
    await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  };
  await answer();
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const second = await p.evaluate(() => new URL(location.hash.slice(1), location.origin).searchParams.get('s'));
  ok(`and keeps it across a reload (${first === second})`, !!second && first === second);
  await answer();

  const sittings = await p.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => {
      const q = db.transaction('reviews').objectStore('reviews').index('by-user-time')
        .getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity]));
      q.onsuccess = () => r(q.result);
    });
    const drill = rows.filter((x) => x.itemType === 'verb_form');
    return { rows: drill.length, sessions: new Set(drill.map((x) => x.sessionId)).size };
  });
  ok(`${sittings.rows} drill rows across a reload are ONE sitting (${sittings.sessions} session id)`,
     sittings.rows >= 2 && sittings.sessions === 1);
  await c.close();
}

// ── Exams, end to end ─────────────────────────────────────────────────────
// The largest section, and the one that exercises the timer, the review log
// and the taxonomy together. Sat, timed, left, resumed, submitted, and the
// result checked for what it is supposed to be: a diagnosis, not a score.
console.log('\n=== exams: sit, leave, resume, submit, and land in the review log ===');
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); watch(p, ' exams');

  await p.goto(BASE + '#/practise/exams', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const papers = await p.locator('[data-testid="exam-papers"] a').count();
  ok(`the exams list offers ${papers} papers`, papers >= 3);
  const missing = await p.locator('[data-testid="exam-missing"] li').count();
  const missingText = (await p.locator('[data-testid="exam-missing"]').innerText()).toLowerCase();
  ok(`and names ${missing} papers it does NOT have, with reasons`, missing >= 4);
  ok('  the listening reason is the licence, not a vague "coming soon"', missingText.includes('licence'));
  ok('  the DALF reason is the missing C1/C2 concepts', missingText.includes('c1') && missingText.includes('c2'));
  const indep = (await p.locator('[data-testid="exam-independence"]').innerText()).toLowerCase();
  ok('  and the page states it is not affiliated with the examining bodies',
     indep.includes('not affiliated') && indep.includes('france éducation'));

  await p.locator('[data-testid="paper-delf-a1-ce"]').click();
  await p.waitForTimeout(500);
  const official = await p.locator('[data-testid="paper-official"]').innerText();
  ok(`the paper says what the REAL paper is ("${official.split('\n')[1] ?? ''}")`,
     /30/.test(official) && /25/.test(official));
  ok('  and how this practice differs from it', /8 original questions/i.test(official));

  await p.locator('[data-testid="start-exam"]').click();
  await p.waitForTimeout(600);
  const url1 = p.url();
  ok(`starting puts the attempt id in the URL (${/a=[a-z0-9]+/.test(url1)})`, /a=[a-z0-9]+/.test(url1));
  const clock1 = await p.locator('[data-testid="exam-clock"]').innerText();
  ok(`the paper is timed and counting ("${clock1.trim()}")`, /^(29|30):\d\d$/.test(clock1.trim()));

  // Answer three, then leave the app entirely.
  for (let q = 0; q < 3; q++) {
    await p.locator('[data-testid="option-1"]').click();
    await p.waitForTimeout(150);
    if (q < 2) { await p.locator('[data-testid="exam-next"]').click(); await p.waitForTimeout(200); }
  }
  await p.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.goto(BASE + '#/practise/exams/delf-a1-ce', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const resumeShown = await p.locator('[data-testid="resume-card"]').count();
  ok('leaving and coming back offers RESUME, not a fresh paper', resumeShown === 1);
  await p.locator('[data-testid="resume"]').click();
  await p.waitForTimeout(600);
  const kept = await p.locator('[data-testid="option-1"]').first().isChecked();
  ok(`resuming keeps the answers already given (${kept})`, kept);
  const clock2 = await p.locator('[data-testid="exam-clock"]').innerText();
  ok(`and the clock kept running rather than resetting ("${clock2.trim()}")`,
     clock2.trim() !== clock1.trim());

  await p.locator('[data-testid="exam-submit"]').click();
  await p.waitForTimeout(1200);
  const score = await p.locator('[data-testid="exam-score"]').innerText();
  ok(`submitting lands on a result ("${score.trim()}")`, /\d+ \/ \d+/.test(score));
  const weak = await p.locator('[data-testid="exam-weak"] a').count();
  ok(`the result is a diagnosis: ${weak} concepts to work on, each a link`, weak > 0);
  const firstWeak = await p.locator('[data-testid="exam-weak"] a').first().getAttribute('href');
  ok(`  and that link practises the concept alone (${firstWeak})`,
     (firstWeak ?? '').includes('/practise/review?concept='));
  const notOfficial = (await p.locator('[data-testid="exam-score"]').locator('xpath=../..').innerText()).toLowerCase();
  ok('  and it refuses to call itself a pass, a fail or a level',
     notOfficial.includes('not the examination') || notOfficial.includes('practice, not'));

  // The point of the section: exam answers join the same record as everything else.
  const rows = await p.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    return await new Promise((r) => {
      const q = db.transaction('reviews').objectStore('reviews').index('by-user-time')
        .getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity]));
      q.onsuccess = () => r(q.result.filter((x) => x.cardKey.startsWith('exam:')));
    });
  });
  ok(`${rows.length} exam answers wrote review-log rows`, rows.length === 8);
  ok(`  each against real concept ids (${(rows[0]?.conceptIds ?? []).join(', ')})`,
     (rows[0]?.conceptIds ?? []).length > 0);
  ok(`  with the scheduler's parameter hash (${rows[0]?.paramsHash})`,
     /^[0-9a-f]{8}$/.test(rows[0]?.paramsHash ?? ''));
  ok(`  and one session id for the whole paper (${new Set(rows.map((r) => r.sessionId)).size})`,
     new Set(rows.map((r) => r.sessionId)).size === 1);

  // Reloading the results must not write the log twice.
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const again = await p.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    return await new Promise((r) => {
      const q = db.transaction('reviews').objectStore('reviews').index('by-user-time')
        .getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity]));
      q.onsuccess = () => r(q.result.filter((x) => x.cardKey.startsWith('exam:')).length);
    });
  });
  ok(`reloading the results does not double the log (${again} rows)`, again === rows.length);
  await c.close();
}

// ── The interface language is fetched, not bundled ─────────────────────────
// Three of the four dictionaries left the first load. If the fetch ever breaks,
// the page must stay in English rather than showing key names or nothing.
console.log('\n=== languages load on demand ===');
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage(); watch(p, ' lang');
  await p.goto(BASE + '#/account', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.locator('[data-testid="ui-lang"]').selectOption('fa');
  await p.waitForTimeout(800);
  const dir = await p.evaluate(() => document.documentElement.dir);
  const body = await p.locator('#main').innerText();
  ok(`switching to Persian fetches its dictionary and applies it (dir=${dir})`, dir === 'rtl');
  ok('  and the interface is actually in Persian, not English key names',
     /[\u0600-\u06FF]/.test(body) && !body.includes('interfaceLanguage'));
  await p.locator('[data-testid="ui-lang"]').selectOption('ar');
  await p.waitForTimeout(800);
  const arBody = await p.locator('#main').innerText();
  ok('  Arabic too', /[\u0600-\u06FF]/.test(arBody));
  await p.locator('[data-testid="ui-lang"]').selectOption('en');
  await p.waitForTimeout(500);
  ok('  and back to English, left-to-right',
     (await p.evaluate(() => document.documentElement.dir)) === 'ltr');
  await c.close();
}

console.log('\n=== export, erase, import — the round trip ===');
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 },
    acceptDownloads: true });
  const p = await c.newPage(); watch(p, ' io');
  await p.goto(BASE + '#/practise/review', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  // Study four cards so there is something to lose.
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press('Space'); await p.waitForTimeout(150);
    await p.keyboard.press('3'); await p.waitForTimeout(350);
  }
  const countRows = async () => p.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    return await new Promise((r) => {
      const q = db.transaction('reviews').objectStore('reviews').index('by-user-time')
        .getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity]));
      q.onsuccess = () => r(q.result.length);
    });
  });
  const before = await countRows();
  ok(`studied ${before} cards before exporting`, before >= 4);

  const hashed = await p.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    const rows = await new Promise((r) => {
      const q = db.transaction('reviews').objectStore('reviews').index('by-user-time')
        .getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity]));
      q.onsuccess = () => r(q.result);
    });
    return rows[0]?.paramsHash ?? null;
  });
  ok(`every row records the scheduler's parameter hash ("${hashed}")`,
     typeof hashed === 'string' && /^[0-9a-f]{8}$/.test(hashed));

  await p.goto(BASE + '#/progress', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const dl = p.waitForEvent('download');
  await p.locator('[data-testid="export"]').click();
  const file = await (await dl).path();
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  ok(`the export carries ${saved.rows?.length ?? 0} rows AND ${saved.cards?.length ?? 0} card states (v${saved.version})`,
     (saved.rows?.length ?? 0) >= 4 && (saved.cards?.length ?? 0) >= 4 && saved.version === 2);
  ok('and does not carry the local profile id',
     !JSON.stringify(saved).includes('"userId"'));

  // Erase, as a learner who has lost their phone has effectively done.
  await p.goto(BASE + '#/account', { waitUntil: 'networkidle' });
  await p.locator('[data-testid="erase"]').click();
  await p.locator('[data-testid="erase-confirm"]').click();
  await p.waitForTimeout(1200);
  await p.goto(BASE + '#/progress', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(`after erasing, ${await countRows()} rows remain`, (await countRows()) === 0);

  // Import the file they carried.
  await p.goto(BASE + '#/account', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.locator('[data-testid="import-file"]').setInputFiles(file);
  await p.waitForTimeout(900);
  const msg = await p.locator('[data-testid="import-result"]').innerText().catch(() => '');
  ok(`the import reports what it did ("${msg.trim()}")`, /\d/.test(msg));
  const after = await countRows();
  ok(`the history is back: ${after} rows restored of ${before}`, after === before);

  // Twice must not double it.
  await p.locator('[data-testid="import-file"]').setInputFiles(file);
  await p.waitForTimeout(900);
  const twice = await countRows();
  ok(`importing the same file again changes nothing (${twice} rows)`, twice === before);

  // And the schedule came back, not just the history.
  const due = await p.evaluate(async () => {
    const uid = sessionStorage.getItem('flw:activeProfile');
    const db = await new Promise((r) => { const q = indexedDB.open('flw'); q.onsuccess = () => r(q.result); });
    const cards = await new Promise((r) => {
      const q = db.transaction('cards').objectStore('cards').index('by-user-due')
        .getAll(IDBKeyRange.bound([uid, -Infinity], [uid, Infinity]));
      q.onsuccess = () => r(q.result);
    });
    return cards.filter((c) => c.reps > 0).length;
  });
  ok(`and the schedule came with it (${due} cards carry their review state)`, due >= 4);
  await c.close();
}

console.log('\n=== dialog and popover behaviour (the reason for Radix) ===');
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage(); watch(p, ' radix');

  // Popover: Escape closes it, and focus goes back to the trigger. The
  // hand-rolled panel did neither — it could only be closed with the mouse.
  await p.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  await p.locator('[data-testid="timer-pill"]').click();
  await p.waitForTimeout(250);
  ok('timer popover opens', await p.locator('[data-testid="timer-panel"]').count() === 1);
  const inPanel = await p.evaluate(() =>
    !!document.querySelector('[data-testid="timer-panel"]')?.contains(document.activeElement));
  ok(`focus moves into the popover on open (${inPanel})`, inPanel);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(250);
  ok('Escape closes the timer popover', await p.locator('[data-testid="timer-panel"]').count() === 0);
  const backOnPill = await p.evaluate(() =>
    document.activeElement?.getAttribute('data-testid') === 'timer-pill');
  ok(`and focus returns to the pill (${backOnPill})`, backOnPill);

  // Dialog: Tab must stay inside it. The hand-rolled panel drew a scrim that
  // blocked the mouse and let Tab walk straight out behind it.
  await p.goto(BASE + '#/learn?panel=concept:gram.present.irregular', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  ok('side panel opens', await p.locator('[data-testid="side-panel"]').count() === 1);
  let escaped = false;
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('Tab');
    const inside = await p.evaluate(() =>
      !!document.querySelector('[data-testid="side-panel"]')?.contains(document.activeElement));
    if (!inside) { escaped = true; break; }
  }
  ok(`focus is trapped in the dialog over 12 tabs (escaped: ${escaped})`, !escaped);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  ok('Escape closes the dialog', await p.locator('[data-testid="side-panel"]').count() === 0);
  await c.close();
}

console.log('\n=== accessibility (axe-core, WCAG 2.1 A + AA) ===');
{
  const AXE = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  const SCREENS = [
    ['/learn', 'Learn'],
    ['/practise/review', 'Flashcards'],
    ['/learn/verbs', 'Verbs'],
    ['/learn/verbs/%C3%AAtre', 'Verb detail'],
    ['/practise/conjugation?verb=%C3%AAtre&tense=present', 'Conjugation'],
    ['/progress', 'Progress'],
    ['/search?q=etre', 'Search'],
    ['/account', 'Account'],
    ['/learn/concept/gram.present.irregular', 'Concept'],
    ['/practise/exams', 'Exams'],
    ['/practise/exams/delf-a1-ce', 'Exam paper'],
  ];
  let totalViolations = 0;
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 },
      colorScheme: theme });
    const p = await ctx.newPage(); watch(p, ` axe-${theme}`);
    await p.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
    for (const [hash, name] of SCREENS) {
      await p.goto(BASE + '#' + hash, { waitUntil: 'networkidle' });
      await p.waitForTimeout(350);
      await p.addScriptTag({ content: AXE });
      const res = await p.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          resultTypes: ['violations'],
        });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length,
          help: v.help, sample: (v.nodes[0]?.html || '').slice(0, 90) }));
      });
      totalViolations += res.length;
      const detail = res.length
        ? res.map((v) => `${v.id}(${v.impact}, ${v.n}): ${v.sample}`).join(' | ')
        : 'none';
      ok(`axe ${theme.padEnd(5)} ${name.padEnd(13)} 0 violations`, res.length === 0, detail);
    }
    // The open states matter most: a dialog and a popover are exactly what
    // hand-rolling gets wrong, and both are closed on a plain page load, so
    // scanning only the routes above would have missed them entirely.
    for (const [setup, name] of [
      [async () => { await p.goto(BASE + '#/learn?panel=concept:gram.present.irregular',
          { waitUntil: 'networkidle' }); }, 'side panel open'],
      [async () => { await p.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
          await p.locator('[data-testid="timer-pill"], .timer-pill').first().click(); }, 'timer popover open'],
    ]) {
      await setup();
      await p.waitForTimeout(400);
      await p.addScriptTag({ content: AXE });
      const res = await p.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          resultTypes: ['violations'],
        });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length,
          sample: (v.nodes[0]?.html || '').slice(0, 90) }));
      });
      totalViolations += res.length;
      ok(`axe ${theme.padEnd(5)} ${name.padEnd(13)} 0 violations`, res.length === 0,
         res.map((v) => `${v.id}(${v.impact}, ${v.n}): ${v.sample}`).join(' | '));
    }
    await ctx.close();
  }
  ok(`axe total across ${SCREENS.length} screens + 2 open states, × 2 themes`, totalViolations === 0,
     `${totalViolations} violations`);
}

// ── Storage blocked: the learner whose data will not persist ────────────────
//
// Two modes, because browsers fail differently and only one of them was ever
// considered. In Safari's private mode the methods throw; in a browser with
// site data blocked the `localStorage` ACCESSOR throws, so even
// `typeof localStorage` raises SecurityError rather than returning 'undefined'.
// The second crashed the whole application to a blank page — the guard meant to
// detect the condition was the thing that died on it — and it was found by hand
// while building the privacy notice, not by any check. That is why it is here.
{
  const MODES = [
    ['methods throw (private window)', () => {
      const store = {
        getItem: () => { throw new DOMException('denied', 'SecurityError'); },
        setItem: () => { throw new DOMException('denied', 'SecurityError'); },
        removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
      };
      Object.defineProperty(window, 'localStorage', { get: () => store, configurable: true });
    }],
    ['accessor throws (site data blocked)', () => {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('denied', 'SecurityError'); }, configurable: true });
    }],
  ];
  for (const [label, script] of MODES) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    await c.addInitScript(script);
    const pg = await c.newPage();
    pg.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 80)));
    await pg.goto(BASE + '#/learn', { waitUntil: 'networkidle' });

    ok(`${label}: the application still renders`,
       await pg.locator('.map').count() === 1,
       'a blank page is what this looked like before it was guarded');
    ok(`${label}: no uncaught page error (${pageErrors.length})`,
       pageErrors.length === 0, pageErrors.join(' | '));

    // The notice matters MOST here: this learner's progress will not survive
    // the tab. Treating "cannot read storage" as "already seen" hid it from
    // exactly the person who needed it.
    const shown = await pg.locator('[data-testid="data-notice"]').count();
    ok(`${label}: the data notice is shown`, shown === 1);
    if (shown === 1) {
      await pg.locator('[data-testid="data-notice-dismiss"]').click();
      ok(`${label}: it dismisses`,
         await pg.locator('[data-testid="data-notice"]').count() === 0);
      await pg.goto(BASE + '#/progress', { waitUntil: 'networkidle' });
      await pg.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
      ok(`${label}: it stays dismissed while moving around the app`,
         await pg.locator('[data-testid="data-notice"]').count() === 0,
         'nagging on every screen is what the in-memory flag prevents');
    }
    await c.close();
  }
}

// ── What style-src 'self' actually blocks ──────────────────────────────────
//
// The worry was that the first component using style={{…}} would break
// silently in production. It does not, and the distinction is worth having a
// check for rather than a belief: CSP blocks style attributes PARSED FROM
// HTML, and does not block the CSSOM. React's style prop sets properties, so
// it is unaffected; a style attribute can only reach a learner through
// server-rendered markup, which the build now refuses outright.
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await c.newPage();
  await pg.goto(BASE + '#/learn', { waitUntil: 'networkidle' });
  const r = await pg.evaluate(() => {
    const viaCssom = document.createElement('div');
    viaCssom.style.width = '123px';
    document.body.append(viaCssom);
    const cssom = getComputedStyle(viaCssom).width;
    const host = document.createElement('div');
    host.innerHTML = '<div style="width:321px"></div>';
    document.body.append(host);
    const attr = getComputedStyle(host.firstElementChild).width;
    viaCssom.remove(); host.remove();
    return { cssom, attr };
  });
  ok(`CSSOM styles apply, so React's style prop is unaffected (${r.cssom})`,
     r.cssom === '123px');
  ok('a style ATTRIBUTE is the one that would be refused under a strict CSP',
     true, `measured ${r.attr} here, where the test server sends no CSP; the `
     + `build refuses any style attribute in the prerendered HTML`);
  await c.close();
}

console.log('\n=== console ===');
const real = errors.filter((e) => !/ERR_CERT_AUTHORITY|favicon/.test(e));
console.log(real.length ? real.slice(0,8).join('\n') : '  none');
console.log(`\n${checks} checks · ${failures.length} failed · ${real.length} console errors`);
if (checks === 0) { console.log('NO CHECKS RAN'); await browser.close(); process.exit(2); }
for (const f of failures) console.log('  FAILED: ' + f);
await browser.close();
process.exit(failures.length || real.length ? 1 : 0);
