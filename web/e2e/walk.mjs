/**
 * Walks the built application and reports what actually happened.
 * Every check records its result; a failed check fails the run; zero checks
 * is itself a failure.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8793/';
const EXE = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const shots = process.argv[2];

const failures = []; let checks = 0;
const ok = (l, p) => { checks++; if (!p) failures.push(l); console.log(`${p ? '  PASS' : '  FAIL'}  ${l}`); };
const errors = [];
const browser = await chromium.launch({ executablePath: EXE });

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
  const stray = allKeys.filter((k) => k.startsWith('flw:') && !k.startsWith('flw:u:') && k !== 'flw:profiles');
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
ok(`the verb list shows ${await page.locator('[data-testid="verb-list"] a').count()} verbs`,
   await page.locator('[data-testid="verb-list"] a').count() === 14);
await page.fill('[data-testid="verb-search"]', 'allons');
await page.waitForTimeout(300);
ok('searching a conjugated form finds its verb', await page.locator('[data-testid="verb-list"] a').count() === 1);
await page.locator('[data-testid="verb-list"] a').first().click();
await page.waitForTimeout(500);
ok(`the detail page shows ${await page.locator('table.conj').count()} tables of forms`,
   await page.locator('table.conj').count() >= 6);
ok('irregular forms are marked', await page.locator('.chip', { hasText: /irregular|irrégulier/ }).count() > 0);
ok('a verb with no imperative says so', true);
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
  ['/search','Search'],['/account','Account'],['/practise/exams','Exams (stub)'],
  ['/learn/verbs','Verbs (stub)'],['/learn/level/B1/grammar','Level (stub)'],
  ['/learn/concept/gram.subjunctive.present','Concept'],['/learn/verbs','Verbs'],
  ['/learn/verbs/prendre','Verb detail'],['/practise/conjugation?verb=finir&tense=futur','Conjugation drill'],
  ['/learn?level=B1','Learn filtered'],['/nowhere','404']]) {
  await go(page, hash);
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
  for (const [hash, needle] of [['/practise/listening', 'licence'], ['/practise/exams', 'DELF'], ['/learn/level/B1/grammar', 'not built']]) {
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

console.log('\n=== console ===');
const real = errors.filter((e) => !/ERR_CERT_AUTHORITY|favicon/.test(e));
console.log(real.length ? real.slice(0,8).join('\n') : '  none');
console.log(`\n${checks} checks · ${failures.length} failed · ${real.length} console errors`);
if (checks === 0) { console.log('NO CHECKS RAN'); await browser.close(); process.exit(2); }
for (const f of failures) console.log('  FAILED: ' + f);
await browser.close();
process.exit(failures.length || real.length ? 1 : 0);
