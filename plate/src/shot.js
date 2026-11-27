// usage: node shot.js "<query>" out.png [w h] [waitms]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [q, out, w = 480, h = 270, wait = 2500] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('console: ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  await p.goto('http://localhost:8765/plate/index.html' + q);
  try { await p.waitForFunction(() => window.__plate && __plate.ready, null, { timeout: 60000 }); } catch (e) { errs.push('not ready'); }
  await p.waitForTimeout(+wait);
  if (process.env.EVAL) console.log(JSON.stringify(await p.evaluate(process.env.EVAL)));
  await p.screenshot({ path: out });
  console.log('shot', out, Date.now() - t0, 'ms', errs.slice(0, 8).join('\n'));
  await b.close();
})();
