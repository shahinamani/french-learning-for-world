/**
 * The Reader, walked in a real browser (blueprint section 11, acceptance row
 * "Reader").
 *
 * Imported by walk.mjs, and runnable alone:
 *
 *     BASE=http://127.0.0.1:8795/ node web/e2e/reader.mjs
 *
 * The route this walks, `#/app/reading`, is mounted by the stream that owns
 * web/src/main.tsx. Until it is, the section says so in capitals and does not
 * pretend to have passed; set READER_REQUIRED=1 (CI should, once the route is
 * mounted) to make an unmounted route a failure instead of a notice.
 *
 * Each check was first seen to FAIL on purpose — see the pull request for what
 * was broken to do it. A check that has never failed has not been shown to
 * check anything.
 */
const A1 = 'reading.a1-samedi-au-marche';

/** Rows as a reload would see them. Saved items and positions are the shared stores in the `flw` database
 *  (lib/db.ts); the questions' result is the one thing the Reader keeps in `flw-reader`. */
const WHERE = { saved: ['flw', 'saved'], position: ['flw', 'readingPositions'], result: ['flw-reader', 'result'] };
const rows = (page, which) => page.evaluate(async ([name, store]) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  if (![...db.objectStoreNames].includes(store)) return [];
  return await new Promise((res) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); });
}, WHERE[which]);

const scrollTop = (page) => page.evaluate(() => document.querySelector('main').scrollTop);

export async function readerWalk({ browser, BASE, go, ok, watch }) {
  console.log('\n=== the reader (blueprint section 11) ===');

  const probe = await browser.newContext();
  const pp = await probe.newPage();
  await go(pp, '/app/reading');
  const mounted = await pp.locator('[data-testid="reader-list"], [data-testid="rd-loading"]').count() > 0;
  await probe.close();
  if (!mounted) {
    const msg = '/app/reading is not mounted in web/src/main.tsx, so the Reader could not be walked';
    if (process.env.READER_REQUIRED === '1') { ok('the Reader route is mounted', false, msg); return; }
    console.log(`  NOT RUN  ${msg}. Set READER_REQUIRED=1 to make this a failure.`);
    return;
  }

  /* ── The library ──────────────────────────────────────────────────────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await ctx.newPage(); watch(pg, ' reader-list');
    await go(pg, '/app/reading');
    await pg.waitForSelector('[data-testid="rd-card"]');
    ok('the library lists the four texts', await pg.locator('[data-testid="rd-card"]').count() === 4);
    ok('and says how many are shown', /4/.test(await pg.locator('[data-testid="rd-count"]').innerText()));
    ok('every card carries a title and a one-line description',
       await pg.locator('[data-testid="rd-card"]').evaluateAll((els) => els.every((e) => e.querySelector('h2')?.textContent.trim() && e.querySelector('.rd-card__desc')?.textContent.trim())));

    await pg.locator('label.rd-opt', { hasText: 'Work' }).click();
    await pg.waitForTimeout(250);
    ok('a topic filter narrows the list to one text and the count follows',
       await pg.locator('[data-testid="rd-card"]').count() === 1 && /1 text/.test(await pg.locator('[data-testid="rd-count"]').innerText()));
    ok('and shows a removable chip', await pg.locator('[data-testid="rd-chip"]').count() === 1);

    // Filter state survives going into a text and coming back.
    await pg.locator('[data-testid="rd-open"]').click();
    await pg.waitForSelector('[data-testid="reader-page"]');
    await pg.locator('[data-testid="rd-back"]').click();
    await pg.waitForSelector('[data-testid="reader-list"]');
    await pg.waitForTimeout(400);
    ok('the filter is still applied after opening a text and coming back',
       await pg.locator('[data-testid="rd-card"]').count() === 1 && pg.url().includes('topic=work'), pg.url());

    await pg.locator('[data-testid="rd-chip"]').click();
    await pg.waitForTimeout(250);
    ok('removing the chip brings every text back', await pg.locator('[data-testid="rd-card"]').count() === 4);

    await pg.locator('[data-testid="rd-search"]').fill('sommeil');
    await pg.waitForTimeout(250);
    ok('search finds a text by its title', await pg.locator('[data-testid="rd-card"]').count() === 1);
    await pg.locator('[data-testid="rd-search"]').fill('zzzzzz');
    await pg.waitForTimeout(250);
    ok('a search with no hits shows the empty state with a way out',
       await pg.locator('[data-testid="rd-state-empty"]').count() === 1 && await pg.locator('[data-testid="rd-clear"]').count() === 1);
    await pg.locator('[data-testid="rd-clear"]').click();
    await pg.waitForTimeout(250);
    ok('and clearing restores the list', await pg.locator('[data-testid="rd-card"]').count() === 4);

    // Save for later: marked, and not claimed as learned.
    await pg.locator('[data-testid="rd-card-save"]').first().click();
    await pg.waitForTimeout(250);
    ok('saving a text for later marks the card', await pg.locator('[data-testid="rd-card-saved"]').count() === 1);
    const saved = await rows(pg, 'saved');
    ok('the saved text has no source sentence and no grade (saved is not learned)',
       saved.length === 1 && saved[0].context === undefined && !('grade' in saved[0]), JSON.stringify(saved));
    await ctx.close();
  }

  /* ── Loading failures: error and offline each have a way forward ───────── */
  for (const kind of ['error', 'offline']) {
    // serviceWorkers: 'block' = a device that has never cached the file (the worker would answer from its cache, and Playwright cannot route what a worker fetches).
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    if (kind === 'offline') await ctx.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
    // The service worker would answer from its cache; this walk is about the page when the file does not arrive.
    await ctx.route('**/content/reading.json', (r) => r.abort('connectionfailed'));
    // Not watched: the aborted request IS the test, and the browser logs it as a console error.
    const pg = await ctx.newPage();
    await go(pg, '/app/reading');
    await pg.waitForSelector(`[data-testid="rd-state-${kind}"]`, { timeout: 8000 }).catch(() => {});
    ok(`when the texts do not arrive the page shows the ${kind} state, with a retry`,
       await pg.locator(`[data-testid="rd-state-${kind}"]`).count() === 1 && await pg.locator('[data-testid="rd-retry"]').count() === 1);
    await ctx.unroute('**/content/reading.json');
    await pg.locator('[data-testid="rd-retry"]').click();
    await pg.waitForSelector('[data-testid="rd-card"]', { timeout: 8000 }).catch(() => {});
    ok(`and retrying after the ${kind} recovers the list`, await pg.locator('[data-testid="rd-card"]').count() === 4);
    await ctx.close();
  }

  /* ── The page: translation, selection, the panel, saving ──────────────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await ctx.newPage(); watch(pg, ' reader-page');
    await go(pg, `/app/reading/${A1}`);
    await pg.waitForSelector('[data-testid="rd-text"]');

    ok('the translation is hidden until asked for', await pg.locator('[data-testid="rd-translation"]').count() === 0);
    await pg.locator('[data-testid="rd-translation-btn"]').click();
    ok('and appears when asked, in the learner\'s language',
       /Saturdays|Saturday/.test(await pg.locator('[data-testid="rd-translation"]').innerText()));
    await pg.locator('[data-testid="rd-translation-btn"]').click();
    ok('and goes away again', await pg.locator('[data-testid="rd-translation"]').count() === 0);

    ok('the text is selectable', await pg.locator('[data-testid="rd-text"]').evaluate((e) => getComputedStyle(e).userSelect !== 'none'));
    const before = Number(await pg.locator('[data-testid="rd-size"]').innerText());
    await pg.locator('[data-testid="rd-larger"]').click();
    ok('the font size can be changed',
       Number(await pg.locator('[data-testid="rd-size"]').innerText()) > before
       && await pg.locator('[data-testid="rd-text"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)) > before);
    await pg.locator('[data-testid="rd-smaller"]').click();

    ok('listening is shown as unavailable, with the reason on the screen, not as a dead button',
       await pg.locator('[data-testid="rd-audio-unavailable"] button:disabled').count() === 1
       && /no recording/i.test(await pg.locator('[data-testid="rd-audio-unavailable"]').innerText()));

    ok('the meaning column is there before anything is selected',
       await pg.locator('[data-testid="rd-panel-empty"]').count() === 1);

    await pg.locator('[data-w]', { hasText: /^marché$/ }).first().click();
    await pg.waitForSelector('[data-testid="rd-selected"]', { timeout: 4000 }).catch(() => {});
    ok('selecting a word opens the meaning panel',
       await pg.locator('[data-testid="rd-selected"]').count() === 1 && (await pg.locator('[data-testid="rd-selected"]').innerText()).includes('marché'));
    ok('which shows the meaning in this text and the sentence it sits in',
       /market/.test(await pg.locator('[data-testid="rd-meaning"]').innerText())
       && (await pg.locator('[data-testid="rd-sentence"]').innerText()).includes('Ensuite, je vais au marché'));
    ok('and links to the dictionary', (await pg.locator('[data-testid="rd-dictionary"]').getAttribute('href')).includes('/app/vocabulary?q=march'));

    await pg.locator('[data-testid="rd-structure-btn"]').click();
    ok('"what is this structure?" says so plainly when nothing is linked, rather than guessing',
       await pg.locator('[data-testid="rd-structure-none"]').count() === 1);

    await pg.locator('[data-testid="rd-add-word"]').click();
    await pg.waitForSelector('[data-testid="rd-saved-note"]', { timeout: 4000 }).catch(() => {});
    const word = (await rows(pg, 'saved')).find((r) => r.itemId.startsWith('word:'));
    ok('adding the word stores it WITH its source sentence and the text it came from',
       !!word && word.context?.fromId === A1 && word.context?.sentence === 'Ensuite, je vais au marché avec mon frère.',
       JSON.stringify(word));
    const id1 = word?.itemId;
    await pg.locator('[data-testid="rd-add-word"]').waitFor();
    ok('and the button then says it is in the learner\'s words', await pg.locator('[data-testid="rd-add-word"]').isDisabled());

    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid="rd-text"]');
    const after = (await rows(pg, 'saved')).filter((r) => r.itemId.startsWith('word:'));
    ok('after a reload the word is still saved with the same sentence',
       after.length === 1 && after[0].itemId === id1 && after[0].context.sentence === 'Ensuite, je vais au marché avec mon frère.');
    ok('and is marked in the text', await pg.locator('.rd-w--saved').count() >= 1);

    // Saving twice is one row (contract section 3).
    await pg.locator('[data-w]', { hasText: /^marché$/ }).first().click();
    await pg.waitForSelector('[data-testid="rd-add-word"]');
    ok('reopening the saved word shows it as already added (no second row is possible)',
       await pg.locator('[data-testid="rd-add-word"]').isDisabled());

    // A phrase, chosen by selecting.
    await pg.evaluate(() => {
      const ws = [...document.querySelectorAll('[data-seg="2"] [data-w]')];
      const a = ws.find((w) => w.textContent === 'au'), b = ws.find((w) => w.textContent === 'marché');
      const r = document.createRange(); r.setStart(a.firstChild, 0); r.setEnd(b.firstChild, b.textContent.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    await pg.waitForTimeout(150);
    ok('selecting a phrase opens the panel on the phrase',
       (await pg.locator('[data-testid="rd-selected"]').innerText()).replace(/\s/g, ' ') === 'au marché');

    // Keyboard: arrows move between words, Enter opens.
    await pg.locator('[data-testid="rd-text"]').focus();
    await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Enter');
    await pg.waitForTimeout(150);
    ok('the text can be read by keyboard: arrows move word to word and Enter opens the meaning',
       (await pg.locator('[data-testid="rd-selected"]').innerText()).trim().length > 0 && await pg.locator('.rd-w--cursor').count() === 1);
    await ctx.close();
  }

  /* ── The reading position ─────────────────────────────────────────────── */
  for (const [label, viewport] of [['desktop', { width: 1280, height: 480 }], ['mobile', { width: 390, height: 640 }]]) {
    const ctx = await browser.newContext({ viewport });
    const pg = await ctx.newPage(); watch(pg, ` reader-position-${label}`);
    await go(pg, `/app/reading/${A1}`);
    await pg.waitForSelector('[data-testid="rd-text"]');
    for (let i = 0; i < 3; i++) await pg.locator('[data-testid="rd-larger"]').click();   // longer page, so it scrolls

    await pg.evaluate(() => {
      const m = document.querySelector('main'); const s = document.querySelector('[data-seg="10"]');
      m.scrollTop += s.getClientRects()[0].top - (document.querySelector('.rd-bar').getBoundingClientRect().bottom + 4);
    });
    await pg.waitForTimeout(900);
    const pos = (await rows(pg, 'position')).find((r) => r.itemId === A1);
    ok(`${label}: scrolling into the text records where the learner is`, !!pos && pos.paragraph >= 8, JSON.stringify(pos));

    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForSelector('[data-testid="rd-resumed"]', { timeout: 6000 }).catch(() => {});
    await pg.waitForTimeout(500);
    const back = await pg.evaluate(() => {
      const bar = document.querySelector('.rd-bar').getBoundingClientRect().bottom;
      const tops = [...document.querySelectorAll('[data-seg].rd-seg')].map((s) => s.getClientRects()[0].top - bar);
      return { shown: tops.findIndex((t) => t >= -2), top: document.querySelector('main').scrollTop };
    });
    ok(`${label}: opening the text again puts the learner back where they were (sentence ${pos?.paragraph + 1}), and says so`,
       await pg.locator('[data-testid="rd-resumed"]').count() === 1 && back.shown >= pos.paragraph - 1 && back.shown <= pos.paragraph + 2 && back.top > 100,
       JSON.stringify({ stored: pos?.paragraph, ...back }));

    // Opening the meaning panel must not move anything.
    const topBefore = await scrollTop(pg);
    const storedBefore = (await rows(pg, 'position')).find((r) => r.itemId === A1).paragraph;
    await pg.locator('[data-seg="10"] [data-w]').first().click();
    await pg.waitForSelector('[data-testid="rd-selected"]');
    await pg.waitForTimeout(900);
    const storedAfter = (await rows(pg, 'position')).find((r) => r.itemId === A1).paragraph;
    ok(`${label}: opening the meaning panel does not move the page or the stored position`,
       Math.abs((await scrollTop(pg)) - topBefore) <= 1 && storedAfter === storedBefore,
       `scroll ${topBefore} -> ${await scrollTop(pg)}, stored ${storedBefore} -> ${storedAfter}`);

    if (label === 'mobile') {
      const box = await pg.locator('[data-testid="rd-panel"]').boundingBox();
      ok('mobile: the panel is a bottom sheet (a dialog pinned to the bottom edge)',
         await pg.locator('[data-testid="rd-panel"]').getAttribute('role') === 'dialog' && Math.abs(box.y + box.height - viewport.height) <= 2, JSON.stringify(box));
      await pg.keyboard.press('Escape');
      ok('mobile: Escape closes the sheet', await pg.locator('[data-testid="rd-panel"]').count() === 0);
    }

    await pg.locator('[data-testid="rd-from-start"]').click().catch(() => {});
    await pg.waitForTimeout(700);
    ok(`${label}: "start from the beginning" puts the stored position back to the first sentence`,
       (await rows(pg, 'position')).find((r) => r.itemId === A1).paragraph === 0);
    await ctx.close();
  }

  /* ── Questions, explanations, result ──────────────────────────────────── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await ctx.newPage(); watch(pg, ' reader-quiz');
    await go(pg, `/app/reading/${A1}`);
    await pg.waitForSelector('[data-testid="rd-finish-reading"]');
    ok('the questions are not shown until the learner says they have finished reading', await pg.locator('[data-testid="rd-quiz"]').count() === 0);
    await pg.locator('[data-testid="rd-finish-reading"]').click();
    await pg.waitForSelector('[data-testid="rd-question"]');
    const n = await pg.locator('[data-testid="rd-question"]').count();
    ok('the text\'s own four questions appear', n === 4, String(n));

    // First question answered wrongly on purpose (option 2 is wrong where the answer is 0), the rest rightly.
    const answers = await pg.evaluate(async () => (await (await fetch('./content/reading.json')).json()).texts[0].questions.map((q) => q.answer));
    for (let i = 0; i < n; i++) {
      const q = pg.locator('[data-testid="rd-question"]').nth(i);
      const pick = i === 0 ? (answers[0] === 1 ? 2 : 1) : answers[i];
      await q.locator('[data-testid="rd-option"]').nth(pick).check();
      await q.locator('[data-testid="rd-check"]').click();
      const why = (await q.locator('[data-testid="rd-explain"]').innerText()).trim();
      ok(`question ${i + 1}: ${i === 0 ? 'a wrong' : 'a right'} answer is followed by its explanation`, why.length > 40, why);
    }
    ok('the first, wrong, answer offers a retry', await pg.locator('[data-testid="rd-question"]').first().locator('[data-testid="rd-retry-q"]').count() === 1);
    ok('answering them all shows the result with next actions',
       await pg.locator('[data-testid="rd-finished"]').count() === 1 && /3 of 4/.test(await pg.locator('[data-testid="rd-score"]').innerText())
       && await pg.locator('[data-testid="rd-to-cards"]').count() === 1);
    await pg.waitForTimeout(300);
    const res = (await rows(pg, 'result'))[0];
    ok('and the result is kept', res?.correct === 3 && res?.total === 4, JSON.stringify(res));
    await ctx.close();
  }

  /* ── A text that does not exist ───────────────────────────────────────── */
  {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage(); watch(pg, ' reader-missing');
    await go(pg, '/app/reading/reading.nope');
    await pg.waitForSelector('[data-testid="rd-state-notfound"]', { timeout: 6000 }).catch(() => {});
    ok('a text that does not exist says so and links back to the list',
       await pg.locator('[data-testid="rd-state-notfound"]').count() === 1 && await pg.locator('[data-testid="rd-state-notfound"] a').count() === 1);
    await ctx.close();
  }
}

/* ── Run alone ─────────────────────────────────────────────────────────── */
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright');
  const BASE = process.env.BASE ?? 'http://127.0.0.1:8793/';
  const failures = []; let checks = 0; const errors = [];
  const ok = (l, p, d) => { checks++; if (!p) failures.push(d ? `${l} — ${d}` : l); console.log(`${p ? '  PASS' : '  FAIL'}  ${l}`); if (!p && d) console.log(`          ${d}`); };
  const watch = (page, tag = '') => {
    page.on('pageerror', (e) => errors.push(`PAGE${tag}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE${tag}: ${m.text()}`); });
  };
  const go = async (page, hash) => { await page.goto(BASE + '#' + hash, { waitUntil: 'networkidle' }); await page.waitForTimeout(220); };
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  await readerWalk({ browser, BASE, go, ok, watch });
  await browser.close();
  const real = errors.filter((e) => !/ERR_CERT_AUTHORITY|favicon|ERR_CONNECTION_FAILED|Failed to load resource/.test(e));
  console.log(`\n${checks} checks · ${failures.length} failed · ${real.length} console errors`);
  for (const e of real.slice(0, 8)) console.log('  ' + e);
  process.exit(checks === 0 || failures.length || real.length ? 1 : 0);
}
