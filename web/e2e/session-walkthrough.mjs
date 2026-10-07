/**
 * Sit the forty-minute session, as a learner, and report what actually happens.
 *
 * Not a test — a MEASUREMENT. Run it when you want to know what the portal
 * offers on a given evening rather than what the routes imply, which is the
 * question that produced this file: the walk-through in the handoff had been
 * read off the router and the content counts, and two of its claims were wrong.
 *
 *   node web/e2e/session-walkthrough.mjs      (with dist/ served on :8793)
 *
 * Every duration it prints is MECHANICAL TIME — clicking and typing, no reading
 * and no thinking — so each one is a floor. Where the app runs out of things to
 * do, that is not a floor, it is the end, and the end is the number that
 * matters.
 *
 * Two things it corrected on 2026-10-04:
 *   - "Tuesday night two: nothing is due" was wrong. All 22 cards come back.
 *   - "0 papers offered" was this script counting before a lazy route loaded,
 *     not a defect in the product. Hence the 1,200 ms waits.
 */
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8793/';
const log = (...a) => console.log(...a);
const ms = (t) => `${(t / 1000).toFixed(1)}s`;

const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
// 1,200 ms, not 220: the exam list is a lazily loaded route and a short wait
// counted zero papers where there are three. The script was wrong, not the app.
const go = async (h) => { await p.goto(BASE + '#' + h, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); };
const txt = async (sel) => (await p.locator(sel).first().innerText().catch(() => '')).replace(/\n+/g, ' · ').trim();

log('================ TUESDAY NIGHT ONE ================');
let t0 = Date.now();
await go('/');
log(`\n[home] loaded in ${ms(Date.now() - t0)}`);
log(`  session card: "${(await txt('[data-testid="session-card"], .card')).slice(0, 110)}"`);
const navLinks = await p.locator('nav a, .bar a, .tabs a').evaluateAll(
  (as) => [...new Set(as.map((a) => a.textContent.trim()).filter(Boolean))]);
log(`  navigation offers: ${navLinks.join(' · ')}`);

await go('/learn');
const cells = await p.locator('a.map__cell').count();
const dashes = await p.locator('span.map__cell').count();
log(`\n[learn map] ${cells} clickable cells, ${dashes} showing a dash`);
const states = await p.locator('a.map__cell').evaluateAll(
  (as) => as.map((a) => a.getAttribute('data-state')));
const tally = states.reduce((m, s) => ({ ...m, [s]: (m[s] ?? 0) + 1 }), {});
log(`  by state: ${JSON.stringify(tally)}`);

// --- the review session, which is the thing a learner is told to do ---------
t0 = Date.now();
await go('/practise/review');
await p.waitForTimeout(600);
let graded = 0;
while (graded < 60) {
  const reveal = p.locator('[data-testid="reveal"], [data-testid="show-answer"]');
  if (!(await reveal.count())) break;
  await reveal.first().click();
  await p.waitForTimeout(40);
  const rate = p.locator('[data-testid="rate-3"]');
  if (!(await rate.count())) break;
  await rate.click();
  graded += 1;
  await p.waitForTimeout(40);
}
const afterReview = await txt('.empty__title, .empty__body, [data-testid="session-done"]');
log(`\n[review] graded ${graded} cards in ${ms(Date.now() - t0)} of mechanical time`);
log(`  then the screen says: "${afterReview.slice(0, 140)}"`);

// --- the verb drill, the only thing with unlimited supply -------------------
t0 = Date.now();
await go('/learn/verbs/parler');
const tenses = await p.locator('table.conj').count();
const practiseButtons = await p.locator('[data-testid^="practise-"]').count();
log(`\n[one verb] ${tenses} tables, ${practiseButtons} "practise" buttons`);
t0 = Date.now();
await go('/practise/conjugation?verb=parler&tense=present');
let answers = 0;
while (answers < 10) {
  const f = p.locator('[data-testid="drill-input"]');
  if (!(await f.count())) break;
  await f.fill('zzz');
  await p.locator('[data-testid="drill-check"]').click();
  await p.waitForTimeout(40);
  answers += 1;
  const n = p.locator('[data-testid="drill-next"]');
  if (await n.count()) { await n.click(); await p.waitForTimeout(40); } else break;
}
log(`[drill] one tense of one verb = ${answers} answers in ${ms(Date.now() - t0)}`);
log(`  then: "${(await txt('.empty__body, [data-testid="drill-done"]')).slice(0, 100)}"`);

// --- exams -----------------------------------------------------------------
await go('/practise/exams');
const papers = await p.locator('a[href*="/practise/exams/"]').count();
log(`\n[exams] ${papers} papers offered`);
const paperNames = await p.locator('a[href*="/practise/exams/"]').evaluateAll(
  (as) => as.map((a) => a.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)));
paperNames.forEach((n) => log(`  ${n}`));

await go('/progress');
log(`\n[progress] "${(await txt('.page')).slice(0, 160)}"`);
log(`\nuncaught page errors: ${errs.length}`);

// ================ TUESDAY NIGHT TWO ================
log('\n================ TUESDAY NIGHT TWO (24h later) ================');
await p.clock.install({ time: new Date(Date.now() + 24 * 3600 * 1000) });
await go('/');
log(`[home] session card: "${(await txt('[data-testid="session-card"], .card')).slice(0, 140)}"`);
await go('/practise/review');
await p.waitForTimeout(700);
const reveal2 = await p.locator('[data-testid="reveal"], [data-testid="show-answer"]').count();
log(`[review] a card to grade? ${reveal2 ? 'yes' : 'NO'}`);
log(`  the screen says: "${(await txt('.empty__title, .empty__body')).slice(0, 180)}"`);
await go('/learn/level/A2/grammar');
const solid = await p.locator('[data-testid^="state-"]').allInnerTexts();
log(`[level page] states on A2 grammar: ${JSON.stringify(solid.reduce((m, s) => ({ ...m, [s]: (m[s] ?? 0) + 1 }), {}))}`);
await b.close();
