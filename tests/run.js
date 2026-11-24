#!/usr/bin/env node
// Test runner for every experiment. Each tests/<game>.test.js exports
//   module.exports = { page: 'game/index.html', tests: { 'name': async ({ page, eq, ok, near, throws }) => {...} } }
// Tests run inside a real browser page (Playwright) and call the game's logic via its debug handle (window.__xx)
// or pure functions it exposes. Usage: node tests/run.js [game ...]   (needs `python3 -m http.server 8765` or starts one)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = +process.env.PORT || 8765, BASE = `http://localhost:${PORT}/`;
const up = () => new Promise(r => http.get(BASE + 'index.html', res => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false)));
(async () => {
  let srv = null;
  if (!(await up())) { srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' }); for (let i = 0; i < 50 && !(await up()); i++) await new Promise(r => setTimeout(r, 100)); }
  const want = process.argv.slice(2);
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).filter(f => !want.length || want.includes(f.replace('.test.js', '')));
  const browser = await chromium.launch();
  let pass = 0, fail = 0; const failures = [];
  for (const f of files) {
    const spec = require(path.join(__dirname, f)), game = f.replace('.test.js', '');
    for (const [name, fn] of Object.entries(spec.tests)) {
      const ctx = await browser.newContext({ viewport: spec.viewport || { width: 1280, height: 800 } });
      const page = await ctx.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
      const t0 = Date.now();
      try {
        await page.goto(BASE + spec.page); await page.waitForLoadState('load'); if (spec.ready) await spec.ready(page); else await page.waitForTimeout(800);
        await fn({ page, ...assertions });
        if (errors.length && !spec.allowPageErrors) throw new Error('page error: ' + errors[0]);
        pass++; console.log(`  ✓ ${game} › ${name} (${Date.now() - t0}ms)`);
      } catch (e) { fail++; failures.push(`${game} › ${name}: ${e.message}`); console.log(`  ✗ ${game} › ${name}\n      ${e.message.split('\n')[0]}`); }
      await ctx.close();
    }
  }
  await browser.close(); if (srv) srv.kill();
  console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log(failures.map(s => ' - ' + s).join('\n')); process.exit(1); }
})();
const fmt = v => JSON.stringify(v);
const assertions = {
  eq(a, b, msg = '') { if (fmt(a) !== fmt(b)) throw new Error(`${msg} expected ${fmt(b)}, got ${fmt(a)}`); },
  ok(v, msg = 'expected truthy') { if (!v) throw new Error(msg); },
  near(a, b, tol = 1e-6, msg = '') { if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} expected ${b} ±${tol}, got ${a}`); },
  async throws(fn, msg = 'expected an error') { try { await fn(); } catch (e) { return; } throw new Error(msg); },
};
