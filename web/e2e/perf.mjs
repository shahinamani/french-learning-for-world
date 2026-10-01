import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
// Slow 4G, as Chrome DevTools defines it, plus a 4x CPU slowdown for a phone.
await cdp.send('Network.emulateNetworkConditions', {
  offline:false, downloadThroughput: 400*1024/8, uploadThroughput: 400*1024/8, latency: 400 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto('http://127.0.0.1:8793/#/learn', { waitUntil:'load' });
const m = await p.evaluate(() => new Promise((res) => {
  let lcp = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; })
    .observe({ type:'largest-contentful-paint', buffered:true });
  setTimeout(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    res({ lcp: Math.round(lcp), fcp: Math.round(fcp?.startTime ?? 0),
          dcl: Math.round(nav.domContentLoadedEventEnd),
          transferred: Math.round(performance.getEntriesByType('resource')
            .reduce((a,r)=>a+(r.transferSize||0),0)/1024) });
  }, 6000);
}));
console.log('Simulated Slow 4G (400 kbps, 400 ms RTT) + 4x CPU throttle, 390px viewport:');
console.log(`  FCP  ${m.fcp} ms`);
console.log(`  LCP  ${m.lcp} ms   budget 2500 ms   ${m.lcp <= 2500 ? 'OK' : 'OVER'}`);
console.log(`  DCL  ${m.dcl} ms`);
console.log(`  transferred ${m.transferred} KB`);
await b.close();
process.exit(m.lcp <= 2500 ? 0 : 1);
