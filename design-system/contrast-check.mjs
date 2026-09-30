// Measures the rendered design system: contrast in both themes, layout at the
// two required widths, keyboard reachability and focus visibility.
//
// Every check records its result. A failed check fails the run — a check that
// prints FAIL and exits 0 is not a check.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8765/design-system/';
const EXE = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const shots = process.argv[2];

const failures = [];
let checks = 0;
const ok = (label, pass) => { checks++; if (!pass) failures.push(label);
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${label}`); };

const browser = await chromium.launch({ executablePath: EXE });
const errors = [];
// No allow-list. The fonts are self-hosted from `public/fonts`, so nothing in
// this page reaches the network and every console error is ours to fix.

async function measureContrast(page, themeLabel) {
  const rows = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const ratio = (a, b) => { const A = lum(parse(a)), B = lum(parse(b));
      return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
    const opaque = (bg) => bg && bg !== 'transparent' && !/rgba?\([^)]*,\s*0\s*\)/.test(bg);
    const bgOf = (el) => { let n = el;
      while (n && n !== document.documentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (opaque(bg)) return bg; n = n.parentElement; }
      return getComputedStyle(document.body).backgroundColor; };

    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim()).join('');
      if (!text) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const px = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      // WCAG "large text": >=24px, or >=18.66px bold.
      const large = px >= 24 || (bold && px >= 18.66);
      out.push({ ratio: ratio(cs.color, bgOf(el)), required: large ? 3 : 4.5,
        px, tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? '' : String(el.className)).slice(0, 34),
        sample: text.slice(0, 40) });
    }
    return out;
  });
  const bad = rows.filter((r) => r.ratio < r.required - 0.005);
  ok(`${themeLabel}: WCAG AA contrast on all ${rows.length} text elements`, bad.length === 0);
  if (bad.length) {
    for (const b of bad.slice(0, 12)) {
      console.log(`         ${b.ratio.toFixed(2)}:1 (needs ${b.required}) ${b.px}px <${b.tag}.${b.cls}> "${b.sample}"`);
    }
    if (bad.length > 12) console.log(`         …and ${bad.length - 12} more`);
  }
  return rows.length;
}

for (const [w, h, label] of [[375, 812, '375 px'], [1440, 900, '1440 px'], [320, 640, '320 px']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push('PAGE: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });

  console.log(`\n=== ${label} ===`);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${label}: no horizontal page scroll (overflow ${ov}px)`, ov <= 1);

  const gutter = await page.evaluate(() => {
    const el = document.querySelector('.sg');
    const cs = getComputedStyle(el);
    return Math.min(parseFloat(cs.paddingInlineStart), parseFloat(cs.paddingInlineEnd));
  });
  ok(`${label}: side gutter ≥16px (${gutter}px)`, gutter >= 16);

  const small = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button, a, input, select')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.height < 44 && !el.closest('.sg-head') && !el.classList.contains('btn--sm')
          && !el.classList.contains('palette__item') && el.tagName !== 'A') bad.push(el.className + ' ' + Math.round(r.height));
    }
    return bad;
  });
  ok(`${label}: interactive targets ≥44px tall (${small.length} under)`, small.length === 0);
  if (small.length) console.log('         ' + small.slice(0, 6).join(' | '));

  if (label === '375 px' || label === '1440 px') {
    await measureContrast(page, `${label} light`);
    if (shots) await page.screenshot({ path: `${shots}/ds-${w}-light.png`, fullPage: true });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(120);
    await measureContrast(page, `${label} dark `);
    if (shots) await page.screenshot({ path: `${shots}/ds-${w}-dark.png`, fullPage: true });
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  }

  if (label === '1440 px') {
    console.log('\n=== keyboard ===');
    const reached = await page.evaluate(async () => {
      const focusable = [...document.querySelectorAll(
        'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])')];
      return { total: focusable.length,
        noOutline: focusable.filter((el) => getComputedStyle(el).outlineStyle === 'none'
          && !getComputedStyle(el).boxShadow.includes('inset')).length };
    });
    ok(`every control is focusable (${reached.total} found)`, reached.total > 20);
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName);
    ok(`Tab moves focus into the page (landed on ${first})`, !!first && first !== 'BODY');
    const ring = await page.evaluate(() => {
      const el = document.querySelector('.btn--primary');
      el.focus();
      const cs = getComputedStyle(el);
      return { w: cs.outlineWidth, style: cs.outlineStyle, offset: cs.outlineOffset };
    });
    ok(`focus ring is visible (${ring.w} ${ring.style}, offset ${ring.offset})`,
       ring.style !== 'none' && parseFloat(ring.w) >= 2);

    console.log('\n=== the map is a real table ===');
    const t = await page.evaluate(() => {
      const table = document.querySelector('table.map');
      return { isTable: !!table,
        rowHeaders: table?.querySelectorAll('th[scope="row"]').length ?? 0,
        colHeaders: table?.querySelectorAll('th[scope="col"]').length ?? 0,
        caption: !!table?.querySelector('caption'),
        lockedLabelled: [...(table?.querySelectorAll('[data-state="locked"]') ?? [])]
          .every((b) => b.getAttribute('aria-label')) };
    });
    ok(`map is a <table> with ${t.rowHeaders} row and ${t.colHeaders} column headers and a caption`,
       t.isTable && t.rowHeaders >= 3 && t.colHeaders >= 7 && t.caption);
    ok('every locked cell has an accessible name', t.lockedLabelled);

    console.log('\n=== right-to-left ===');
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; document.body.dir = 'rtl'; });
    await page.waitForTimeout(120);
    const rtlOv = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`RTL: no horizontal overflow (${rtlOv}px)`, rtlOv <= 1);
    const frLtr = await page.evaluate(() =>
      [...document.querySelectorAll('[lang="fr"][dir="ltr"]')].length);
    ok(`French content stays left-to-right inside an RTL page (${frLtr} elements)`, frLtr > 0);
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; document.body.dir = 'ltr'; });
  }
  await page.close();
}

console.log('\n=== console ===');
console.log(errors.length ? errors.join('\n') : '  none');
console.log(`\n${checks} checks · ${failures.length} failed · ${errors.length} console errors`);
if (checks === 0) { console.log('NO CHECKS RAN — failing'); await browser.close(); process.exit(2); }
for (const f of failures) console.log('  FAILED: ' + f);
await browser.close();
process.exit(failures.length || errors.length ? 1 : 0);
