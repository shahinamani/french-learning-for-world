import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const profiles = [
  ['Slow 4G  (400 kbps, 400 ms, 4x CPU)', 400*1024/8, 400, 4],
  ['Fast 4G  (9 Mbps, 85 ms, 2x CPU)',    9000*1024/8, 85, 2],
  ['Wi-Fi    (30 Mbps, 20 ms, 1x CPU)',   30000*1024/8, 20, 1],
];
for (const [label, down, lat, cpu] of profiles) {
  const ctx = await b.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline:false, downloadThroughput:down, uploadThroughput:down, latency:lat });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await p.goto('http://127.0.0.1:8793/#/learn', { waitUntil:'load' });
  const m = await p.evaluate(() => new Promise((res) => {
    let lcp = 0;
    new PerformanceObserver((l)=>{ for (const e of l.getEntries()) lcp = e.startTime; })
      .observe({ type:'largest-contentful-paint', buffered:true });
    setTimeout(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      res({ lcp: Math.round(lcp), fcp: Math.round(fcp?.startTime ?? 0),
            kb: Math.round(performance.getEntriesByType('resource').reduce((a,r)=>a+(r.transferSize||0),0)/1024) });
    }, 5000);
  }));
  const ok = m.lcp <= 2500 ? 'OK ' : 'OVER';
  console.log(`  ${label.padEnd(38)} FCP ${String(m.fcp).padStart(5)} ms   LCP ${String(m.lcp).padStart(5)} ms  ${ok}   ${m.kb} KB`);
  await ctx.close();
}
await b.close();
