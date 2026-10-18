/* ── Portal routes (blueprint v0.2, CONTRACTS section 1) ──────────────────
 *
 * Three properties, each stated as something that can be false:
 *   1. every old address forwards to its new one, and does so with `replace`
 *      (one history entry, so Back does not return to the old address);
 *   2. every learner route renders something that is not the 404 page;
 *   3. no visible link, button or standalone icon is without a name.
 *
 * The icon-name check is a checker, and a checker that has never failed is not
 * known to work. So it is run first against a button this section injects with
 * an icon and no name, and must flag it.
 */
export async function portalRoutes({ browser, BASE, ok, watch, go }) {
console.log('\n=== portal routes, redirects and icon names ===');
{
  const hashOf = (pg) => decodeURIComponent(new URL(pg.url()).hash.slice(1));
  const pathOf = (pg) => hashOf(pg).split('?')[0];

  // Runs in the page. Returns the controls and bare icons that have no name.
  const unnamedIn = () => {
    const shown = (e) => (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true }) : !!e.offsetParent);
    const nameOf = (e) => {
      const aria = e.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const by = e.getAttribute('aria-labelledby');
      if (by) { const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim(); if (t) return t; }
      if (e.labels && e.labels.length) { const t = [...e.labels].map((l) => l.textContent).join(' ').trim(); if (t) return t; }
      return (e.textContent ?? '').replace(/\s+/g, ' ').trim();
    };
    const bad = [];
    for (const e of document.querySelectorAll('a[href], button, [role="button"], [role="link"], input:not([type="hidden"]), select, summary')) {
      if (shown(e) && !nameOf(e)) bad.push(e.outerHTML.slice(0, 140));
    }
    for (const s of document.querySelectorAll('svg')) {
      if (!shown(s)) continue;
      const hidden = s.getAttribute('aria-hidden') === 'true';
      const named = (s.getAttribute('aria-label') || '').trim() && s.getAttribute('role') === 'img';
      // A hidden icon is fine only inside a control that has its own name.
      if (hidden) { const c = s.closest('a,button,[role="button"]'); if (c && !nameOf(c)) bad.push('icon in unnamed control: ' + c.outerHTML.slice(0, 120)); }
      else if (!named) bad.push('svg neither hidden nor named: ' + s.outerHTML.slice(0, 100));
    }
    return bad;
  };

  const ctx5 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const r = await ctx5.newPage(); watch(r, ' routes');
  await go(r, '/app/today');

  // The checker must be able to fail: inject a nameless icon button.
  await r.evaluate(() => {
    const b = document.createElement('button');
    b.id = 'walk-injected';
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14"/></svg>';
    document.body.appendChild(b);
  });
  const flagged = await r.evaluate(unnamedIn);
  ok('icon-name checker flags an injected button that has an icon and no name',
     flagged.some((f) => f.includes('walk-injected')), JSON.stringify(flagged));
  await r.evaluate(() => document.getElementById('walk-injected')?.remove());

  // 1. The redirect table. Real ids, read from the app rather than invented.
  await go(r, '/app/exams');
  const paperHref = await r.locator('a[href*="/app/exams/"]').first().getAttribute('href').catch(() => null);
  const paperId = paperHref ? decodeURIComponent(paperHref.split('/app/exams/')[1].split('/')[0].split('?')[0]) : 'tcf-b2-structure';
  const TABLE = [
    ['/learn', '/app/today'],
    ['/learn/verbs', '/app/verbs'],
    ['/learn/verbs/être', '/app/verbs/être'],
    ['/learn/concept/gram.present.irregular', '/app/grammar/gram.present.irregular'],
    ['/learn/level/A1/grammar', '/app/path/A1/grammar'],
    ['/practise', '/app/cards'],
    ['/practise/review', '/app/cards'],
    ['/practise/conjugation', '/app/verbs/drill'],
    ['/practise/exams', '/app/exams'],
    [`/practise/exams/${paperId}`, `/app/exams/${paperId}`],
    [`/practise/exams/${paperId}/sit`, `/app/exams/${paperId}/sit`],
    [`/practise/exams/${paperId}/results`, `/app/exams/${paperId}/results`],
    ['/practise/listening', '/app/listening'],
    ['/progress', '/app/progress'],
    ['/workspace', '/app/workspace'],
    ['/search', '/app/search'],
    ['/app', '/app/today'],
  ];
  for (const [oldPath, newPath] of TABLE) {
    await go(r, '/app/today');
    const before = await r.evaluate(() => history.length);
    await r.evaluate((h) => { location.hash = h; }, '#' + oldPath);
    await r.waitForTimeout(500);
    const landed = pathOf(r);
    const grew = (await r.evaluate(() => history.length)) - before;
    const notFound = await r.locator('[data-testid="not-found"]').count();
    ok(`${oldPath} forwards to ${newPath}`, landed === newPath && notFound === 0,
       `landed on ${landed}, not-found page: ${notFound}`);
    // One entry for the address the learner followed; the redirect adds none.
    // A push would make this 2 and Back would return to the old address.
    ok(`${oldPath} replaces rather than pushes (history grew by ${grew})`, grew === 1);
    await r.goBack(); await r.waitForTimeout(250);
    ok(`Back from ${newPath} leaves for Today, not for ${oldPath} again`, pathOf(r) === '/app/today', `went to ${pathOf(r)}`);
  }

  // The query string is state the old links carry; it must survive.
  await go(r, '/app/today');
  await r.evaluate(() => { location.hash = '#/practise/review?minutes=5'; });
  await r.waitForTimeout(600);
  ok('a redirect keeps the query string (?minutes=5)', pathOf(r) === '/app/cards' && /minutes=5/.test(hashOf(r)), hashOf(r));

  // 2. Every learner route renders, and the placeholders say what is missing.
  const ROUTES = ['today', 'path', 'vocabulary', 'cards', 'verbs', 'grammar', 'listening', 'reading', 'output',
                  'news', 'podcasts', 'exams', 'saved', 'progress', 'search', 'workspace'];
  const PLACEHOLDER = ['path', 'vocabulary', 'grammar', 'reading', 'output', 'news', 'podcasts', 'saved'];
  for (const id of ROUTES) {
    await go(r, `/app/${id}`);
    const nf = await r.locator('[data-testid="not-found"]').count();
    const mainText = (await r.locator('main').innerText()).trim();
    ok(`/app/${id} renders a page (${mainText.length} chars, no 404)`, nf === 0 && mainText.length > 40);
  }
  for (const id of PLACEHOLDER) {
    await go(r, `/app/${id}`);
    const ph = r.locator(`[data-testid="placeholder-${id}"]`);
    const text = await ph.innerText();
    ok(`/app/${id} is an honest placeholder: says it is not built, never "coming soon"`,
       await ph.count() === 1 && /not built yet/i.test(text) && !/coming soon|stay tuned|bientôt/i.test(text), text.slice(0, 90));
    // Every "instead" link must lead somewhere that is not another dead end.
    const hrefs = await ph.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    let allLive = hrefs.length > 0;
    for (const h of hrefs) {
      await r.goto(BASE + h, { waitUntil: 'networkidle' }); await r.waitForTimeout(200);
      if (await r.locator('[data-testid="not-found"]').count() || (await r.locator('[data-testid^="placeholder-"]').count())) allLive = false;
    }
    ok(`/app/${id}: all ${hrefs.length} "instead" links reach a built page`, allLive, hrefs.join(' '));
  }

  // 3. Shell structure, desktop.
  await go(r, '/app/verbs');
  const sidebarLinks = await r.locator('[data-testid="sidebar"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const wanted = ['today', 'path', 'vocabulary', 'cards', 'verbs', 'grammar', 'listening', 'reading', 'output',
                  'news', 'podcasts', 'exams', 'saved', 'progress'].map((s) => `#/app/${s}`);
  ok('the sidebar lists the fourteen contract routes in order',
     JSON.stringify(sidebarLinks.slice(0, 14)) === JSON.stringify(wanted), sidebarLinks.slice(0, 14).join(' '));
  ok('the sidebar ends with account, appearance and language, help, exit',
     JSON.stringify(sidebarLinks.slice(14)) === JSON.stringify(['#/account', '#/account', '#/about', '#/']), sidebarLinks.slice(14).join(' '));
  ok('the sidebar marks the current page with aria-current',
     await r.locator('[data-testid="nav-verbs"][aria-current="page"]').count() === 1);
  ok('the breadcrumb shows where you are',
     (await r.locator('[data-testid="breadcrumb"]').innerText()).replace(/\s+/g, ' ').includes('Free learning'));
  await r.locator('#gsearch-q').fill('manger');
  await r.locator('#gsearch-q').press('Enter');
  await r.waitForTimeout(500);
  ok('the global search submits to the search page with the query in the address',
     pathOf(r) === '/app/search' && /q=manger/.test(hashOf(r)), hashOf(r));

  // The free-learning group collapses and remembers.
  await go(r, '/app/today');
  const toggle = r.locator('[data-testid="nav-free-toggle"]');
  ok('the free-learning group starts open', await toggle.getAttribute('aria-expanded') === 'true');
  await toggle.click();
  ok('it collapses', await toggle.getAttribute('aria-expanded') === 'false' && !(await r.locator('[data-testid="nav-vocabulary"]').isVisible()));
  await r.reload({ waitUntil: 'networkidle' }); await r.waitForTimeout(300);
  ok('and is still collapsed after a reload', await r.locator('[data-testid="nav-free-toggle"]').getAttribute('aria-expanded') === 'false');
  await go(r, '/app/verbs');
  ok('but opens by itself when the current page is inside it',
     await r.locator('[data-testid="nav-free-toggle"]').getAttribute('aria-expanded') === 'true');
  await go(r, '/app/today');
  await r.locator('[data-testid="nav-free-toggle"]').click();   // restore: open
  await r.reload({ waitUntil: 'networkidle' });

  // 4. Icon names, desktop, every route.
  let unnamedDesktop = [];
  for (const id of [...ROUTES, 'account']) {
    await go(r, id === 'account' ? '/account' : `/app/${id}`);
    for (const b of await r.evaluate(unnamedIn)) unnamedDesktop.push(`${id}: ${b}`);
  }
  ok(`no icon or control lacks a name on ${ROUTES.length + 1} desktop routes`, unnamedDesktop.length === 0, unnamedDesktop.slice(0, 3).join(' | '));
  await ctx5.close();

  // 5. Mobile.
  const ctx6 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await ctx6.newPage(); watch(m, ' mobile');
  await go(m, '/app/today');
  const barLabels = await m.locator('[data-testid="mobile-bar"] .tab').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  ok(`the bottom bar has exactly five items (${barLabels.join(' · ')})`, barLabels.length === 5);
  ok('and the sidebar is not in the accessibility tree at this width', !(await m.locator('[data-testid="sidebar"]').isVisible()));
  const learnBtn = m.locator('[data-testid="mbar-learn"]');
  await learnBtn.click();
  await m.waitForSelector('[data-testid="nav-sheet"]');
  const box = await m.locator('[data-testid="nav-sheet"]').boundingBox();
  ok(`the Learn menu opens as a bottom sheet (bottom ${Math.round(box.y + box.height)} of 844, width ${Math.round(box.width)} of 390)`,
     Math.abs(box.y + box.height - 844) <= 1 && Math.abs(box.width - 390) <= 1);
  ok('the sheet has an accessible title', await m.locator('[data-testid="nav-sheet"]').getAttribute('aria-labelledby') !== null);
  ok('the sheet lists the seven free-learning items and the two discovery ones',
     await m.locator('[data-testid="nav-sheet"] a').count() === 9);
  const unnamedSheet = await m.evaluate(unnamedIn);
  ok('no control is unnamed with the sheet open', unnamedSheet.length === 0, unnamedSheet.join(' | '));
  await m.keyboard.press('Escape'); await m.waitForTimeout(250);
  ok('Escape closes the sheet', await m.locator('[data-testid="nav-sheet"]').count() === 0);
  ok('and focus returns to the control that opened it',
     await m.evaluate(() => document.activeElement?.getAttribute('data-testid')) === 'mbar-learn');
  await m.locator('[data-testid="mbar-more"]').click();
  await m.waitForSelector('[data-testid="nav-sheet"]');
  await m.locator('[data-testid="sheet-exams"]').click(); await m.waitForTimeout(400);
  ok('choosing an item in the sheet navigates and closes it',
     pathOf(m) === '/app/exams' && await m.locator('[data-testid="nav-sheet"]').count() === 0, pathOf(m));
  let unnamedMobile = [];
  for (const id of [...ROUTES, 'account']) {
    await go(m, id === 'account' ? '/account' : `/app/${id}`);
    for (const b of await m.evaluate(unnamedIn)) unnamedMobile.push(`${id}: ${b}`);
  }
  ok(`no icon or control lacks a name on ${ROUTES.length + 1} mobile routes`, unnamedMobile.length === 0, unnamedMobile.slice(0, 3).join(' | '));
  const ovf = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`mobile: no horizontal overflow on the last route (${ovf}px)`, ovf <= 1);
  await ctx6.close();
}
}
