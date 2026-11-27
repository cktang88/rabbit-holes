// Wind Tunnel: a GPU lattice-Boltzmann smoke tunnel. Physics is asserted through window.__wt on a coarse grid (?ny=80)
// with the frame loop paused, so every run is a fixed number of lattice steps (deterministic, no frame timing).
const N = 'const N = __wt.naca, xs = [.03, .12, .3, .5, .72, .9];';
const run = (page, lv, pts, o = {}, n = 2800) => page.evaluate(([lv, pts, o, n]) => {
  const N = __wt.naca, xs = [.03, .12, .3, .5, .72, .9];
  __wt.setLevel(lv); const P = typeof pts === 'string' ? eval(pts) : pts;
  if (P || Object.keys(o).length) __wt.setShape(P, o);
  __wt.step(n, { dye: false });
  return Object.assign({ ok: __wt.constraintsOK(), passed: __wt.state.passed, stars: __wt.state.stars, nan: __wt.state.nan }, __wt.statsSince(1600));
}, [lv, pts, o, n]);
const D = Math.PI / 180;
// a known-good design for every request (what a thoughtful player would build)
const GOOD = {
  round: ['N(.25, .8, 0, .4, xs, .25)'],
  plate: ['N(.30, .7, 0, .4, xs, .3)'],
  chimney: ['N(.30, .8, 0, .4, xs, .3)'],
  rotor: [null, { spin: 2 }],
  glider: ['N(.08, .45, .06, .4)', { tilt: 8 * D }],
  stall: [null, { tilt: 36 * D }],
  sail: ['N(.06, .4, .06, .4)', { tilt: 15 * D }],
  bridge: ['[[-.3,0],[-.23,.028],[.23,.028],[.3,0],[.23,-.028],[-.23,-.028]]'],
  slip: [null, { cx: .8 }],
};
const tests = {
  'loads: WebGL2 sim runs, overlay and gauges present, no NaN': async ({ page, ok, eq }) => {
    const r = await page.evaluate(() => { __wt.step(200); return { st: __wt.state, p: __wt.perf(), f: __wt.forces() }; });
    eq(r.st.level, 'round'); eq(r.st.grid, [192, 80]); ok(r.st.nan === 0 && isFinite(r.f.drag), 'nan'); ok(r.p.draws > 10 && r.p.draws < 400, 'draws ' + r.p.draws);
    ok(await page.isVisible('#gDrag') && await page.isVisible('#card'));
  },
  'the circle sheds vortices: lift swings both ways at the default wind': async ({ page, ok }) => {
    const r = await page.evaluate(() => { __wt.setLevel('round'); __wt.step(3000, { dye: false }); const h = __wt.history().filter(x => x[0] > 1400).map(x => x[1]); let flips = 0; for (let i = 1; i < h.length; i++) if (Math.sign(h[i]) !== Math.sign(h[i - 1])) flips++; return { flips, max: Math.max(...h), min: Math.min(...h), s: __wt.statsSince(1600) }; });
    ok(r.flips >= 2 && r.max > .4 && r.min < -.4, 'no shedding: ' + JSON.stringify(r)); ok(Math.abs(r.s.lift) < .3, 'mean lift should be ~0: ' + r.s.lift);
  },
  'a teardrop the same height as a flat plate has well under half its drag': async ({ page, ok }) => {
    const plate = await run(page, 'plate', null), tear = await run(page, 'plate', 'N(.30, .7, 0, .4, xs, .3)');
    ok(tear.ok && plate.ok, 'both keep the board inside');
    ok(tear.drag < plate.drag * .5, `plate ${plate.drag.toFixed(2)} teardrop ${tear.drag.toFixed(2)}`);
  },
  'lift rises with tilt, then stalls': async ({ page, ok }) => {
    const L = []; for (const a of [6, 18, 36, 52]) L.push((await run(page, 'stall', null, { tilt: a * D })).lift);
    ok(L[1] > L[0] && L[2] > L[1], 'lift should rise: ' + L.map(v => v.toFixed(2)));
    ok(L[3] < L[2] * .9, 'lift should fall past the stall: ' + L.map(v => v.toFixed(2)));
  },
  'spin makes lift (Magnus), and the sign follows the spin': async ({ page, ok }) => {
    const a = await run(page, 'rotor', null, { spin: 1.5 }), b = await run(page, 'rotor', null, { spin: -1.5 });
    ok(a.lift > 1 && b.lift < -1, `${a.lift} ${b.lift}`);
  },
  'no NaN after 5000 steps at full gale with a sharp plate': async ({ page, ok }) => {
    const r = await page.evaluate(() => { __wt.setLevel('sandbox'); __wt.setWind(3200); __wt.setShape(__wt.rrect(.02, .24, .002), { tilt: .5 }); __wt.step(5000, { dye: false }); const v = __wt.readVel(); let bad = 0; for (let i = 0; i < v.length; i++) if (!isFinite(v[i])) bad++; return { bad, nan: __wt.state.nan, f: __wt.forces() }; });
    ok(r.bad === 0 && r.nan === 0 && isFinite(r.f.drag), JSON.stringify(r));
  },
  'every request is passable with a known-good design (and the start shape does not pass)': async ({ page, ok }) => {
    const bad = [];
    for (const id of Object.keys(GOOD)) {
      const [pts, o] = GOOD[id], r = await run(page, id, pts, o || {});
      if (!r.passed || !r.ok) bad.push(`${id}: passed=${r.passed} keep=${r.ok} drag=${r.drag.toFixed(2)} lift=${r.lift.toFixed(2)} sway=${r.sway.toFixed(2)} ld=${r.ld.toFixed(2)} drive=${r.drive.toFixed(2)}`);
    }
    const lvls = await page.evaluate(() => __wt.LV.map(l => l.id)); ok(lvls.every(id => GOOD[id]), 'a level without a bot design');
    for (const id of ['round', 'plate', 'chimney', 'sail']) { const r = await run(page, id, null); if (r.passed) bad.push(id + ': start shape passes'); }
    ok(!bad.length, bad.join(' | '));
  },
  'the daily crate is passable with a fairing; progress saves': async ({ page, ok }) => {
    const r = await page.evaluate(() => { const lv = __wt.setLevel('daily'), L = __wt.level, [w, h] = L.keep.rect;
      const H = [[-w / 2 - h * .35, 0], [-w / 2 - .004, h * .42 + .01], [-w / 2 + h * .15, h / 2 + .012], [w / 2, h / 2 + .012], [w / 2 + h * .9, h / 4], [w / 2 + h * 2.2, 0]];
      __wt.setShape([...H, ...H.slice(1, -1).reverse().map(p => [p[0], -p[1]])]); __wt.step(2800, { dye: false }); return { st: __wt.state, save: __wt.save(), goal: L.goal }; });
    ok(r.st.passed, JSON.stringify(r.st.eval && r.st.eval.st) + ' goal ' + JSON.stringify(r.goal));
    ok(Object.values(r.save.daily)[0].stars >= 1);
  },
  'mouse: dragging the tail handle reshapes the body, undo restores it, the design survives a reload': async ({ page, ok, eq }) => {
    await page.evaluate(() => __wt.setLevel('round'));
    const [x, y] = await page.evaluate(() => { const b = __wt.bodies[0], p = b.pts[4], w = __wt.toWorld(b, p[0], p[1]); return __wt.scr(w[0], w[1]); });
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y, { steps: 6 }); await page.mouse.up();
    const tail = await page.evaluate(() => __wt.bodies[0].pts[4][0]); ok(tail > .15, 'tail moved to ' + tail);
    eq(await page.evaluate(() => __wt.bodies[0].pts[4][1]), 0, 'mirror keeps the axis point on the axis');
    await page.click('#undoBtn'); ok(Math.abs(await page.evaluate(() => __wt.bodies[0].pts[4][0]) - .1) < 1e-6, 'undo');
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 50, y, { steps: 5 }); await page.mouse.up();
    await page.reload(); await page.waitForFunction(() => window.__wt);
    ok(await page.evaluate(() => __wt.bodies[0].pts[4][0]) > .15, 'design not saved');
  },
  'mirror toggle and point add/remove keep the shape symmetric': async ({ page, ok, eq }) => {
    const r = await page.evaluate(() => { __wt.setLevel('sandbox'); const b = __wt.bodies[0];
      b.pts[2] = [.05, .14]; b.pts[6] = [.05, -.14];
      const sym = () => b.pts.every((p, i) => { const q = b.pts[(b.pts.length - i) % b.pts.length]; return Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] + q[1]) < 1e-9; });
      const a = sym(); __wt.removePoint(b, 2); const n1 = b.pts.length, s1 = sym();
      document.querySelector('#mirBtn').click(); b.pts[1] = [-.2, .3]; document.querySelector('#mirBtn').click(); const s2 = sym();
      return { a, n1, s1, s2, m: b.mirror }; });
    ok(r.a && r.s1 && r.s2 && r.m, JSON.stringify(r)); eq(r.n1, 6);
  },
  'request list: locked requests show as unknown; finishing one unlocks the next': async ({ page, ok }) => {
    await page.click('#jobsBtn'); ok(await page.isVisible('.job[data-id="plate"][disabled]'));
    await page.evaluate(() => document.querySelector('.modal-bg').remove());
    await run(page, 'round', GOOD.round[0]);
    await page.click('#jobsBtn'); ok(!(await page.isDisabled('.job[data-id="plate"]')));
    await page.click('.job[data-id="plate"]'); ok(await page.evaluate(() => __wt.level.id === 'plate'));
  },
  'perf hook: draw calls per frame within a phone budget': async ({ page, ok }) => {
    await page.evaluate(() => __wt.pause(false)); await page.waitForTimeout(800);
    const p = await page.evaluate(() => __wt.perf()); ok(p.draws > 0 && p.draws < 60, 'draws per frame ' + p.draws); ok(p.spf >= 2);
  },
};
module.exports = {
  page: 'wind-tunnel/index.html?ny=80&paused', viewport: { width: 960, height: 600 },
  ready: async page => { await page.waitForFunction(() => window.__wt); },
  tests,
};
