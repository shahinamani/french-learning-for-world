/**
 * Drive the review tool with a real keyboard, in a real browser.
 *
 * Not a unit test — it needs `vite` running, which is the only place the tool
 * exists. Run it before asking somebody to sit a two-hour session:
 *
 *   cd web && npx vite --port 5199 --strictPort &
 *   node web/e2e/review-tool.mjs
 *
 * Written because the mastery states were typechecked and never seen, and I
 * then made the same mistake again with this tool: the endpoints answered curl
 * and the page served, so I reported it working while every key handler, the
 * note field and the batch-done state were unobserved. If A, R, S, N, C or ←
 * misbehave, the reviewer finds out in their first minute and the session is
 * wasted.
 *
 * It restores data/review-decisions.json at the end. A test that leaves a
 * verdict behind writes a review nobody performed.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:5199/__review';
const DEC = fileURLToPath(new URL('../../data/review-decisions.json', import.meta.url));
const backup = readFileSync(DEC, 'utf8');

let pass = 0, fail = 0;
const ok = (what, cond) => { (cond ? pass++ : fail++);
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${what}`); };
const decisions = () => JSON.parse(readFileSync(DEC, 'utf8')).decisions;

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

try {
  await p.goto(`${BASE}?batch=4&by=Keyboard%20Test`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.stim', { timeout: 8000 });

  console.log('\n=== the screen ===');
  ok(`it shows an item and a count ("${await p.locator('#count').innerText()}")`,
     /1 of 4/.test(await p.locator('#count').innerText()));
  ok('the flagged item is first, with its doubt in full',
     (await p.locator('.flag').count()) === 1
     && /unsure/i.test(await p.locator('.flag').innerText()));
  ok('the correct option is marked',
     (await p.locator('ol.opts li.right').count()) === 1);
  ok('nothing is recorded for it yet',
     (await p.locator('[data-recorded="none"]').count()) === 1);

  console.log('\n=== R: a rejection without a reason is refused ===');
  const firstId = (await p.locator('.gap').first().innerText()).split(' ')[0];
  await p.keyboard.press('r');
  await p.waitForTimeout(250);
  ok('the keyboard did not record it',
     decisions().length === 0);
  ok('the note field is focused and says why',
     await p.locator('#note').evaluate((n) => n === document.activeElement));
  ok(`the placeholder asks for a reason`,
     /reason/i.test(await p.locator('#note').getAttribute('placeholder')));
  ok('and the screen has not advanced',
     /1 of 4/.test(await p.locator('#count').innerText()));

  console.log('\n=== typing in the note does not trigger the keys ===');
  await p.keyboard.type('a rejection with a reason: approve and skip are in this text');
  await p.waitForTimeout(150);
  ok('typing "a" and "s" while in the note recorded nothing',
     decisions().length === 0 && /1 of 4/.test(await p.locator('#count').innerText()));

  console.log('\n=== Esc leaves the note, then R records with the reason ===');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  ok('Esc blurred the note',
     !(await p.locator('#note').evaluate((n) => n === document.activeElement)));
  await p.keyboard.press('r');
  await p.waitForTimeout(300);
  const d1 = decisions();
  ok(`the rejection is recorded (${d1.length})`, d1.length === 1 && d1[0].verdict === 'rejected');
  ok('with the reviewer from the query string', d1[0].by === 'Keyboard Test');
  ok('and the reason', /rejection with a reason/.test(d1[0].note ?? ''));
  ok('and the screen advanced', /2 of 4/.test(await p.locator('#count').innerText()));

  console.log('\n=== A, then S ===');
  await p.keyboard.press('a');
  await p.waitForTimeout(300);
  ok('A records an approval', decisions().some((d) => d.verdict === 'approved'));
  await p.keyboard.press('s');
  await p.waitForTimeout(300);
  ok('S records a skip', decisions().some((d) => d.verdict === 'skipped'));
  ok('three decisions now', decisions().length === 3);

  console.log('\n=== ← returns, SHOWS the record, and can change it ===');
  await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(250);
  ok(`back at item 2 ("${await p.locator('#count').innerText()}")`,
     /2 of 4/.test(await p.locator('#count').innerText()));
  const shown = await p.locator('.recorded').innerText().catch(() => '');
  ok(`it shows what was recorded ("${shown.split('\n')[0]}")`, /approved/i.test(shown));
  await p.keyboard.press('s');
  await p.waitForTimeout(300);
  const changed = decisions().find((d) => d.itemId === decisions()[1]?.itemId);
  ok('S overwrote the approval rather than adding a second decision',
     decisions().length === 3
     && decisions().filter((d) => d.verdict === 'approved').length === 0);

  console.log('\n=== C clears a mis-key ===');
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(200);
  const beforeClear = decisions().length;
  await p.keyboard.press('c');
  await p.waitForTimeout(300);
  ok(`C removed the record (${beforeClear} -> ${decisions().length})`,
     decisions().length === beforeClear - 1);
  ok('and stayed on the item rather than advancing',
     (await p.locator('[data-recorded="none"]').count()) === 1);

  console.log('\n=== a rejected rule pulls its siblings forward ===');
  // Flagging is blind to confident error: b1-agr-1 to -4 all rest on one rule,
  // and if it is wrong all four are wrong with no flag on any of them. So
  // rejecting one must offer the others now, not in three months.
  await p.goto(`${BASE}?paper=tcf-b2-structure-2&batch=20&by=Keyboard%20Test`,
               { waitUntil: 'networkidle' });
  await p.waitForSelector('.stim', { timeout: 8000 });
  // Walk to the agreement item.
  const currentId = () => p.locator('[data-item]').getAttribute('data-item');
  let found = false;
  for (let n = 0; n < 20; n++) {
    if ((await currentId()) === 'b1-agr-2') { found = true; break; }
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(90);
  }
  ok(`reached b1-agr-2 (on ${await currentId()})`, found);
  const ruleShown = await p.locator('.rule').innerText().catch(() => '');
  ok(`the item names the rule it rests on ("${ruleShown.split('\n')[0]}")`,
     /rule it rests on/i.test(ruleShown));
  ok(`and lists every item resting on it, including the one being read`,
     /4 items stand or fall together/.test(ruleShown)
     && ['b1-agr-1', 'b1-agr-2', 'b1-agr-3', 'b1-agr-4']
          .every((id) => ruleShown.includes(id)));
  ok('and shows the risk the rule carries',
     /se parler/i.test(ruleShown));

  await p.keyboard.press('n');
  await p.keyboard.type('the direct/indirect distinction looks reversed to me');
  await p.keyboard.press('Escape');
  await p.keyboard.press('r');
  await p.waitForTimeout(400);
  const bannerEl = p.locator('[data-pulled]');
  ok('rejecting it announces the correlated failure',
     (await bannerEl.count()) === 1);
  const banner = await bannerEl.innerText().catch(() => '');
  ok(`the banner names the siblings now coming next ("${banner.split('\n').slice(0,2).join(' ').slice(0,80)}…")`,
     /rest on it and now come next|No other item/i.test(banner));
  const next = await currentId();
  ok(`the very next item is a sibling, not the next in paper order (${next})`,
     ['b1-agr-1', 'b1-agr-3', 'b1-agr-4'].includes(next));

  console.log('\n=== a cluster of five is shown AS a cluster ===');
  // adjective.before-figurative-after-literal carries five items: if that rule
  // is wrong, five fall together — a larger correlated surface than the
  // agreement trio that prompted the mechanism. A line of small grey text does
  // not say that.
  await p.goto(`${BASE}?paper=tcf-b2-structure-3&batch=20&by=Keyboard%20Test`,
               { waitUntil: 'networkidle' });
  await p.waitForSelector('.stim', { timeout: 8000 });
  let onCluster = false;
  for (let n = 0; n < 20; n++) {
    if ((await p.locator('[data-cluster-size]').getAttribute('data-cluster-size')
          .catch(() => null)) === '5') { onCluster = true; break; }
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(80);
  }
  ok('reached the five-item cluster', onCluster);
  ok('it is marked as a cluster, not just described',
     (await p.locator('.rule.cluster').count()) === 1);
  const cl = await p.locator('.cluster-list').innerText().catch(() => '');
  ok(`it says how many stand or fall together ("${cl.split('\n')[0]}")`,
     /5 items stand or fall together/.test(cl));
  ok('and names every one of them, including the item being read',
     ['b2-adj-1', 'b2-adj-2', 'b2-adj-3', 'b2-adj-4', 'b2-adj-5']
       .every((id) => cl.includes(id)));
  ok('and says what approving it commits the reviewer to',
     /approved the rule for all of them/.test(cl));

  // Each sibling carries its own verdict once recorded, so a reviewer returning
  // to the cluster can see how much of it is done.
  await p.keyboard.press('a');
  await p.waitForTimeout(300);
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(250);
  const after = await p.locator('.cluster-list').innerText().catch(() => '');
  ok(`a decided sibling shows its verdict in the cluster ("${
       (after.match(/b2-adj-\d · \w+/) ?? ['none'])[0]}")`,
     /b2-adj-\d · approved/.test(after));

  console.log('\n=== the batch-done state ===');
  for (let n = 0; n < 24; n++) { await p.keyboard.press('s'); await p.waitForTimeout(120); }
  const done = await p.locator('.done').innerText().catch(() => '');
  ok(`it says the batch is done ("${done.split('\n')[0]}")`, /batch done/i.test(done));
  ok('and says nothing was written into the content',
     /Nothing has been written into the content/i.test(done));
  ok('and names the applier', /apply-review\.py/.test(done));
  ok('the note field is hidden at the end',
     await p.locator('#note').evaluate((n) => n.style.display === 'none'));

  console.log(`\nuncaught page errors: ${errs.length}${errs.length ? ' — ' + errs.join('; ') : ''}`);
  ok('no page errors', errs.length === 0);
} finally {
  writeFileSync(DEC, backup);
  await b.close();
}
console.log(`\n${pass + fail} checks · ${fail} failed`);
process.exit(fail ? 1 : 0);
