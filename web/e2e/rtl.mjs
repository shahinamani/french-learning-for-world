/**
 * Right-to-left: the first time anything has LOOKED at these pages.
 *
 * Every four-language check so far has read the DATA — parity, collisions,
 * script, letterforms, isolation. None of it renders a page. A dictionary can
 * be perfect in Persian and the page still be unusable, because the faults that
 * matter in RTL live in the layout: a control mirrored but not its icon, a
 * number that lands on the wrong side of its label, a row that overflows the
 * viewport to the left where nobody scrolls.
 *
 * docs/lessons.md #10, carried over: the belief embedded in layout code is as
 * invisible to the person who wrote it as the alphabet one was. So this does
 * not ask "does it look right" — it asserts things the broken state fails.
 *
 * Screenshots are written too, because Shahin reads Persian and the machine
 * does not. The checks are what fails the build; the screenshots are what a
 * reader checks the checks against.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8793/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const EXE = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const OUT = process.argv[2];
if (OUT) mkdirSync(OUT, { recursive: true });

let checks = 0;
const failures = [];
const ok = (label, pass, detail) => {
  checks++;
  if (!pass) failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${label}${!pass && detail ? `\n          ${detail}` : ''}`);
};

/**
 * Each screen names something ONLY that screen can show.
 *
 * The first run waited 260 ms and screenshotted whatever was there. For the two
 * lazily-loaded exam routes that was the Suspense skeleton — so every check
 * passed, and every screenshot was of a grey placeholder. docs/lessons.md #6:
 * a passing check must assert something only the named screen could satisfy.
 */
const SCREENS = [
  ['/learn', 'learn', '[data-testid="start-session"]'],
  ['/learn/verbs', 'verbs', '[data-testid="verb-list"] a, [data-testid="verbs-empty"]'],
  ['/learn/verbs/%C3%AAtre', 'verb-detail', '[data-testid="form-present-0"]'],
  ['/practise/review', 'flashcards', '[data-testid="flashcard"], [data-testid="start-session"]'],
  ['/practise/conjugation?verb=%C3%AAtre&tense=present', 'conjugation', '#drill-answer'],
  ['/practise/exams', 'exams', '[data-testid="exam-papers"] a'],
  ['/practise/exams/delf-a1-ce', 'exam-paper', '[data-testid="start-exam"]'],
  ['/progress', 'progress', '[data-testid="week-summary"]'],
  ['/search', 'search', 'input[type="search"], .input'],
  ['/account', 'account', '[data-testid="theme"]'],
];

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

for (const locale of ['fa', 'ar']) {
  for (const [width, height] of [[375, 812], [1440, 900]]) {
    for (const theme of ['light', 'dark']) {
      const tag = `${locale}-${width}-${theme}`;
      console.log(`\n=== ${tag} ===`);
      // navigator.languages is what app-context reads, so the locale option is
      // the real path a learner takes, not a localStorage fixture.
      const ctx = await browser.newContext({
        viewport: { width, height }, locale, colorScheme: theme, deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      for (const [hash, name, ready] of SCREENS) {
        await page.goto(BASE + '#' + hash, { waitUntil: 'networkidle' });
        let rendered = true;
        try { await page.waitForSelector(ready, { timeout: 8000, state: 'visible' }); }
        catch { rendered = false; }
        ok(`${tag} ${name}: the screen itself rendered (${ready})`, rendered,
           'the check ran against a skeleton or an error state, not the named screen');
        // and nothing is still a placeholder
        const skeletons = await page.locator('.skeleton').count();
        ok(`${tag} ${name}: no loading placeholder left on screen (${skeletons})`, skeletons === 0);
        await page.waitForTimeout(120);

        const r = await page.evaluate(() => {
          const d = document.documentElement;
          const vw = d.clientWidth;
          const box = (el) => el.getBoundingClientRect();
          const outside = (b) => b.left < -1 || b.right > vw + 1;
          const describe = (el) =>
            `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`;

          // Elements sticking out of the viewport. In RTL the overflow goes the
          // other way, so `scrollWidth > clientWidth` alone misses it.
          //
          // One pattern is legitimate: a control parked off-screen until it is
          // focused — the skip link. It is NOT exempted by name. It is focused
          // here and has to come back inside the viewport; if it does, it is
          // doing its job, and if it does not, a keyboard user in Persian or
          // Arabic cannot reach the main content and that is the finding.
          const offenders = [];
          let provedByFocus = 0;
          for (const el of document.querySelectorAll('body *')) {
            const b = box(el);
            if (b.width === 0 || b.height === 0) continue;
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.overflow === 'hidden') continue;
            if (!outside(b)) continue;

            const focusable = el.matches('a[href], button, input, select, textarea, [tabindex]');
            if (focusable) {
              el.focus({ preventScroll: true });
              const back = !outside(box(el));
              // blur(), not "restore the previous element". document.body is not
              // focusable, so focus() on it is a no-op and the probed element
              // KEPT focus — which left the skip link visible on every screen
              // after the first, so it was never detected as off-screen again
              // and the screenshots showed it mid-page in English. A check that
              // changes the state it is measuring reports on its own footprint.
              el.blur();
              if (back) { provedByFocus++; continue; }
              offenders.push(`${describe(el)} stays outside the viewport even when focused`);
              continue;
            }
            offenders.push(`${describe(el)} [${Math.round(b.left)}..${Math.round(b.right)}] vw=${vw}`);
          }

          // Any French run must stay left-to-right inside the RTL page.
          const frWrong = [...document.querySelectorAll('[lang="fr"]')]
            .filter((el) => getComputedStyle(el).direction !== 'ltr')
            .map((el) => el.className || el.tagName);
          const nav = document.querySelector('nav');
          const main = document.getElementById('main') || document.querySelector('main');
          return {
            dir: d.dir, lang: d.lang, vw,
            scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
            bodyDir: getComputedStyle(document.body).direction,
            offenders: offenders.slice(0, 4), offenderCount: offenders.length, provedByFocus,
            frCount: document.querySelectorAll('[lang="fr"]').length,
            frWrong: frWrong.slice(0, 3),
            navLeft: nav ? Math.round(box(nav).left) : null,
            navWidth: nav ? Math.round(box(nav).width) : null,
            mainLeft: main ? Math.round(box(main).left) : null,
            activeTag: document.activeElement ? document.activeElement.tagName : null,
          };
        });

        ok(`${tag} ${name}: <html dir=rtl lang=${locale}>`,
           r.dir === 'rtl' && r.lang === locale, `got dir=${r.dir} lang=${r.lang}`);
        ok(`${tag} ${name}: body resolves right-to-left`, r.bodyDir === 'rtl', `direction=${r.bodyDir}`);
        ok(`${tag} ${name}: nothing overflows the viewport (${r.offenderCount} stray, ` +
           `${r.provedByFocus} off-screen-until-focused and proved to return)`,
           r.offenderCount === 0, r.offenders.join(' | '));
        ok(`${tag} ${name}: the off-screen-until-focused controls exist and return (${r.provedByFocus})`,
           r.provedByFocus >= 1, 'the skip link should be parked off-screen and come back on focus');
        // Mirroring, asserted on the LAYOUT rather than on a heading. The first
        // version of this check read `document.querySelector('h1')` and
        // required it on the right — but on /learn the first h1 is the session
        // card, which correctly mirrors to the LEFT. The check encoded a belief
        // about which element is the page heading, which is the same fault in a
        // different costume (docs/lessons.md #10).
        if (width >= 1024) {
          ok(`${tag} ${name}: the navigation rail is on the right, content on the left ` +
             `(nav ${r.navLeft}, main ${r.mainLeft})`,
             r.navLeft !== null && r.mainLeft !== null && r.navLeft > r.mainLeft,
             'at desktop width an RTL page puts the rail on the inline-start side, which is the right');
        } else {
          ok(`${tag} ${name}: the navigation spans the width at phone size (${r.navWidth}/${r.vw})`,
             r.navWidth !== null && r.navWidth > r.vw * 0.8);
        }
        ok(`${tag} ${name}: no horizontal page scroll (${r.scrollWidth}/${r.clientWidth})`,
           r.scrollWidth <= r.clientWidth + 1);
        ok(`${tag} ${name}: ${r.frCount} French runs, all still left-to-right`,
           r.frWrong.length === 0, r.frWrong.join(', '));
        ok(`${tag} ${name}: the overflow probe left nothing focused (${r.activeTag})`,
           r.activeTag === 'BODY', 'the check must not change what it is measuring');

        if (OUT) await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: false });
      }

      // The accent bar: French characters, so the TOOLBAR stays left-to-right
      // even here — and the arrow keys have to agree with whichever way it runs.
      await page.goto(BASE + '#/practise/conjugation?verb=%C3%AAtre&tense=present',
                      { waitUntil: 'networkidle' });
      await page.waitForTimeout(220);
      const input = page.locator('#drill-answer');
      if (await input.count()) {
        await input.click();
        await page.waitForTimeout(160);
        const bar = page.locator('[data-testid="accent-bar"]');
        const present = await bar.count();
        ok(`${tag} accent bar opens on focus`, present === 1);
        if (present === 1) {
          const barDir = await bar.evaluate((el) => getComputedStyle(el).direction);
          ok(`${tag} accent bar runs left-to-right (French characters)`, barDir === 'ltr', barDir);

          // Caret insertion, in an RTL page, into an ltr input.
          await input.fill('');
          await input.type('etre');
          await page.locator('[data-testid="accent-e\\u0300"]').first().click().catch(async () => {
            await bar.locator('button').nth(1).click();
          });
          const after = await input.inputValue();
          ok(`${tag} a character is inserted at the caret (${JSON.stringify(after)})`,
             after.length === 5 && after.startsWith('etre'), after);

          // Roving tabindex: exactly one button tabbable, and the arrows move
          // focus the way the toolbar reads.
          const first = bar.locator('button').first();
          await first.focus();
          const tabbable = await bar.evaluate((el) =>
            [...el.querySelectorAll('button')].filter((b) => b.tabIndex === 0).length);
          ok(`${tag} exactly one accent key is in the tab order (${tabbable})`, tabbable === 1);

          const labelOf = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
          const a0 = await labelOf();
          await page.keyboard.press('ArrowRight');
          const a1 = await labelOf();
          await page.keyboard.press('ArrowLeft');
          const a2 = await labelOf();
          ok(`${tag} arrow keys move along the toolbar and back (${a0} → ${a1} → ${a2})`,
             a0 !== null && a1 !== null && a0 !== a1 && a0 === a2);

          await page.keyboard.press('End');
          const atEnd = await labelOf();
          await page.keyboard.press('Home');
          const atHome = await labelOf();
          ok(`${tag} Home and End reach the ends (${atEnd} / ${atHome})`,
             atEnd !== atHome && atHome === a0);
          if (OUT) await page.screenshot({ path: `${OUT}/${tag}-accent-bar.png` });
        }
      } else {
        ok(`${tag} accent bar: the drill input exists`, false, 'no #drill-answer on the conjugation screen');
      }

      ok(`${tag}: no page or console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
}

await browser.close();
console.log(`\n${checks} checks, ${failures.length} failed`);
if (!checks) { console.error('NO CHECKS RAN — that is a failure, not a pass'); process.exit(2); }
if (failures.length) { console.error('\nFAILURES:'); failures.forEach((f) => console.error('  ' + f)); process.exit(1); }
console.log('RTL walk: all clear');
