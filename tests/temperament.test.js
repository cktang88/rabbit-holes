// Temperament: tuning maths, every commission solvable, deliberate commit, saves.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const solutions = () => {
  const T = window.__tm, SC = 1200 * Math.log2(81 / 80);
  const just = [0, 1200 * Math.log2(16 / 15), 1200 * Math.log2(9 / 8), 1200 * Math.log2(6 / 5), 1200 * Math.log2(5 / 4), 1200 * Math.log2(4 / 3), 1200 * Math.log2(45 / 32), 1200 * Math.log2(3 / 2), 1200 * Math.log2(8 / 5), 1200 * Math.log2(5 / 3), 1200 * Math.log2(9 / 5), 1200 * Math.log2(15 / 8)];
  const optimise = i => { // coordinate descent on the worst error, from equal temperament
    const g = T.C[i].goals, err = c => Math.max(...g.map(x => T.goalEval(x, c).err)); let c = T.ET(), e = err(c);
    for (const step of [8, 4, 2, 1, .5, .25, .1, .05]) for (let pass = 0; pass < 40; pass++) { let imp = false;
      for (let n = 1; n < 12; n++) for (const d of [step, -step]) { c[n] += d; const e2 = err(c); if (e2 < e - 1e-9) { e = e2; imp = true; } else c[n] -= d; }
      if (!imp) break; }
    return c;
  };
  const P = k => T.PRESET[k].c();
  return [P('pyth'), P('pyth'), P('pyth'), P('pyth'), P('mean'), just, P('mean'), P('mean'), T.chainFrom(-SC / 4, -SC / 4, 11, 0), P('werck'), P('vallotti'), P('et'), P('vallotti'), P('mean'), optimise(14), P('et')];
};

module.exports = {
  page: 'temperament/index.html',
  ready: async page => { await page.waitForFunction(() => window.__tm); await closeModals(page); },
  tests: {
    'interval maths: pure fifth has no beats, ET fifth beats ~0.89 Hz, comma is conserved': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, pyth = T.PRESET.pyth.c(), et = T.ET();
        const sums = []; for (let t = 0; t < 20; t++) { const c = T.ET().map((x, i) => i ? x + (Math.random() - .5) * 60 : 0); sums.push([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].reduce((a, i) => a + T.dev(c, i, 7), 0)); }
        return { b0: T.beats(pyth, 0, 7), bet: T.beats(et, 0, 7), dEt: T.dev(et, 0, 7), m3: T.dev(T.PRESET.mean.c(), 0, 4), sums, octave: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(i => Math.abs(T.iv(et, i, 7) - 700) < 1e-9) };
      });
      near(r.b0, 0, 1e-9); near(r.bet, 0.886, 0.01); near(r.dEt, -1.955, 0.001); near(r.m3, 0, 1e-9); ok(r.octave, 'ET fifths not 700');
      r.sums.forEach(s => near(s, -23.46, 0.01, 'sum of fifth deviations around the circle must be minus the Pythagorean comma'));
    },
    'every commission: unmet at start, met by a known tuning': async ({ page, ok, eq }) => {
      const r = await page.evaluate(sol => {
        const T = window.__tm, S = eval('(' + sol + ')')();
        return T.C.map((c, i) => ({ i, start: Math.min(...c.goals.map(g => T.goalEval(g, T.startTuning(i)).stars)), sol: Math.min(...c.goals.map(g => T.goalEval(g, S[i]).stars)) }));
      }, solutions.toString());
      eq(r.length, 16);
      ok(r.every(x => x.start === 0), 'met at start: ' + r.filter(x => x.start).map(x => x.i));
      ok(r.every(x => x.sol >= 1), 'unsolvable: ' + JSON.stringify(r.filter(x => x.sol < 1)));
    },
    'the wolf goal moves with the wolf': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const T = window.__tm, g = T.C[3].goals.at(-1); return [T.goalEval(g, T.PRESET.pyth.c()).ok, T.goalEval(g, T.chainFrom(0, 0, 11, 0)).ok, T.goalEval(g, T.ET()).ok]; });
      eq(r, [true, false, false]);
    },
    'regression: dragging the note slider through the target does not complete the commission': async ({ page, ok }) => {
      const box = await page.locator('#nSl').boundingBox(), y = box.y + box.height / 2, xAt = v => box.x + 8 + (box.width - 16) * (v + 50) / 100;
      await page.mouse.move(xAt(-40), y); await page.mouse.down();
      for (let v = -40; v <= 40; v += 2) { await page.mouse.move(xAt(v), y); await page.waitForTimeout(30); }
      await page.mouse.up(); await page.waitForTimeout(1400);
      ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'swept through pure and it completed');
    },
    'holding the slider on pure completes only after release and settle': async ({ page, ok }) => {
      const box = await page.locator('#nSl').boundingBox(), y = box.y + box.height / 2, xAt = v => box.x + 8 + (box.width - 16) * (v + 50) / 100;
      await page.mouse.move(xAt(-30), y); await page.mouse.down(); await page.mouse.move(xAt(2), y, { steps: 6 });
      const e = await page.evaluate(() => { const T = window.__tm; return Math.abs(T.dev(T.tun(), 0, 7)); });
      ok(e <= 2, 'did not land within 2 cents: ' + e);
      await page.waitForTimeout(1400);
      ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'completed while dragging');
      await page.mouse.up(); await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[0] >= 1), 'did not complete after settling');
    },
    'rapid clicks through the target do not complete; stopping there does': async ({ page, ok }) => {
      // G starts 9 cents flat; pure needs about +11. Click +5 three times quickly (passes through pure at +10) then -5 back.
      for (const d of ['5', '5', '5']) { await page.click(`#noteBox [data-n="${d}"]`); await page.waitForTimeout(120); }
      await page.click('#noteBox [data-n="-5"]'); await page.click('#noteBox [data-n="-5"]'); await page.click('#noteBox [data-n="-5"]');
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'completed by clicking through');
      for (let n = 0; n < 2; n++) await page.click('#noteBox [data-n="5"]');
      await page.click('#noteBox [data-n="1"]');
      await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[0] >= 1), 'did not complete when stopped on pure');
    },
    'switching commission during the settle window cancels the award': async ({ page, ok }) => {
      await page.evaluate(() => { const T = window.__tm, t = T.tun(); t[7] = 1200 * Math.log2(1.5); T.render(); T.setCur(1); });
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'awarded a commission that was left');
      await page.evaluate(() => window.__tm.setCur(0)); await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[0] === 3), 'settled pure fifth not awarded on return');
    },
    'acts unlock in order; progress bounded; corrupt saves load': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, put = v => localStorage.setItem('rh:temper', typeof v === 'string' ? v : JSON.stringify(v)), out = {};
        out.a1 = T.actOpen(1); T.S.done[0] = 3; T.S.done[1] = 1; T.S.done[2] = 2; out.a1b = T.actOpen(1);
        put('{{'); out.junk = Object.keys(T.loadState().done).length;
        put({ done: { 0: 7, 1: 0, 99: 3, 2: 'x' }, tun: { 0: [1, 2], 1: Array(12).fill(0), 2: Array(12).fill(null) }, cur: 'q' });
        const s = T.loadState(); out.s = [s.done, Object.keys(s.tun), s.cur];
        for (let i = 0; i < 16; i++) T.S.done[i] = 3; T.render(); out.hub = JSON.parse(localStorage.getItem('rh:hub')).temperament;
        return out;
      });
      eq([r.a1, r.a1b], [false, true]); eq(r.junk, 0); eq(r.s, [{ 0: 3 }, ['1'], 0]);
      ok(r.hub === undefined || r.hub <= 1, 'hub ' + r.hub);
    },
    'phone layout: no horizontal scroll': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, 'overflow');
    },
  },
};
