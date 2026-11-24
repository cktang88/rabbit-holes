// Temperament: tuning maths, every commission solvable, deliberate commit, saves.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const solutions = () => {
  const T = window.__tm, SC = 1200 * Math.log2(81 / 80);
  const just = [0, 1200 * Math.log2(16 / 15), 1200 * Math.log2(9 / 8), 1200 * Math.log2(6 / 5), 1200 * Math.log2(5 / 4), 1200 * Math.log2(4 / 3), 1200 * Math.log2(45 / 32), 1200 * Math.log2(3 / 2), 1200 * Math.log2(8 / 5), 1200 * Math.log2(5 / 3), 1200 * Math.log2(9 / 5), 1200 * Math.log2(15 / 8)];
  // Remote Keys: minimax optimum (worst error ~3.26 cents), found offline by smoothed-max descent.
  const remote = [0, 105.213, 208.801, 283.275, 387.944, 494.786, 600, 705.214, 808.795, 882.728, 987.397, 1094.786];
  const P = k => T.PRESET[k].c();
  return [P('pyth'), P('pyth'), P('pyth'), T.wolfAt(2), P('mean'), just, P('mean'), P('mean'), T.chainFrom(-SC / 4, -SC / 4, 11, 0), P('werck'), P('vallotti'), P('et'), P('vallotti'), P('mean'), remote, P('et')];
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
    'The Comma: the wolf tool tunes eleven pure fifths, and where you put the wolf decides the commission': async ({ page, eq, near }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, [f11, off] = T.C[3].goals, out = [];
        for (let w = 0; w < 12; w++) { const c = T.wolfAt(w), d = [...Array(12).keys()].map(i => T.dev(c, i, 7));
          out.push({ w, c0: c[0], wolf: d[w], others: Math.max(...d.filter((_, i) => i !== w).map(Math.abs)), f11: T.goalEval(f11, c).stars, off: T.goalEval(off, c).ok }); }
        return out;
      });
      r.forEach(x => { eq(x.c0, 0, 'C moved'); near(x.wolf, -23.46, .01, 'wolf size'); near(x.others, 0, 1e-6, 'other fifths'); eq(x.f11, 3); });
      // the piece is in flats down to A-flat: C, F, B-flat, E-flat, A-flat (G#), G fifths are taken
      eq(r.filter(x => x.off).map(x => x.w), [1, 2, 4, 6, 9, 11]);
    },
    'wolf button: select a fifth, press it, the tuning follows': async ({ page, ok }) => {
      await page.evaluate(() => { const T = window.__tm; T.S.done = { 0: 3, 1: 3, 2: 3 }; T.setCur(3); });
      await page.click('#wheel .arc[data-k="7"][data-i="2"]');
      await page.click('#ivWolf');
      const r = await page.evaluate(() => { const T = window.__tm, t = T.tun(); return Math.abs(T.dev(t, 2, 7) + 23.46) < .01; });
      ok(r, 'wolf not placed on D–A');
      await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[3] === 3), 'commission not met');
      ok(await page.locator('.modal .seal').count() === 1, 'no seal');
      ok(await page.evaluate(() => document.getElementById('kbd').classList.contains('gliss')), 'no glissando');
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
