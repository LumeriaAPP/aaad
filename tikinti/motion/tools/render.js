// İstifadə: node frames.js OUTDIR FPS START END [workerId workers]
const { chromium } = require('playwright');
const [OUT, FPS, T0, T1, WID, WN] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +(process.argv[6] || 0), +(process.argv[7] || 1)];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8766/?capture');
  await p.evaluate(() => window.ready);
  const f0 = Math.round(T0 * FPS), f1 = Math.round(T1 * FPS);
  const t0 = Date.now(); let n = 0;
  for (let f = f0 + WID; f < f1; f += WN) {
    await p.evaluate((t) => window.seek(t), f / FPS);
    await p.screenshot({ path: `${OUT}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    n++;
  }
  console.log('worker', WID, 'frames', n, 'ms/frame', Math.round((Date.now() - t0) / Math.max(1, n)));
  await b.close();
})();
