import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline:false, downloadThroughput:400*1024/8, uploadThroughput:400*1024/8, latency:400 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const timeline = [];
p.on('response', async (r) => {
  const u = r.url().split('/').pop();
  timeline.push({ t: Date.now(), what: u, size: (await r.headerValue('content-length')) || '?' });
});
const t0 = Date.now();
await p.goto('http://127.0.0.1:8793/#/learn', { waitUntil:'load' });
const out = await p.evaluate(() => new Promise((res) => {
  const entries = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) entries.push({
      t: Math.round(e.startTime), size: e.size,
      el: e.element ? (e.element.tagName + '.' + (e.element.className || '').toString().slice(0,26)) : '?',
      text: (e.element?.textContent || '').trim().slice(0, 34),
    });
  }).observe({ type:'largest-contentful-paint', buffered:true });
  setTimeout(() => res({ entries,
    fonts: performance.getEntriesByType('resource').filter(r=>r.name.includes('woff2'))
      .map(r=>({ n:r.name.split('/').pop(), start:Math.round(r.startTime), end:Math.round(r.responseEnd) })),
  }), 7000);
}));
console.log('LCP candidates, in order:');
for (const e of out.entries) console.log(`  ${String(e.t).padStart(5)} ms  size ${String(e.size).padStart(7)}  <${e.el}>  "${e.text}"`);
console.log('\nfont requests:');
for (const f of out.fonts) console.log(`  ${f.n.padEnd(28)} start ${f.start} ms  done ${f.end} ms`);
console.log('\nresource order:');
for (const r of timeline.slice(0,10)) console.log(`  +${String(r.t-t0).padStart(5)} ms  ${r.what}`);
await b.close();
