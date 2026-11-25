// Watershed: a landscape eroded by the stream-power law. Rivers capture each other's headwaters; the player places
// geological agents (lava, shale, sandstone, upwarp, a falling sea) to make the drainage meet a commission.
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:watershed', raw), raw); await page.reload(); await page.waitForTimeout(1500); };
const waitFor = async (page, fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(80); } return false; };

module.exports = {
  page: 'watershed/index.html',
  ready: async page => { await page.waitForFunction(() => window.__ws && __ws.w0, null, { timeout: 15000 }); },
  tests: {
    'drainage: every land square reaches a sea, and the water arriving at the seas equals the rain that fell': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const { WS } = __ws, w = WS.cloneWorld(__ws.w0); for (let s = 0; s < 40; s++) WS.step(w);
        let land = 0, out = 0, lost = 0; for (let i = 0; i < WS.N; i++) { if (w.sea[i]) { continue; } land++; let j = i, k = 0; while (!w.sea[j] && k++ < WS.N) j = w.rcv[j]; if (!w.sea[j]) lost++; if (w.sea[w.rcv[i]]) out += w.A[i]; if (w.lab[i] !== w.sea[j]) lost++; }
        return { land, out, lost }; });
      ok(r.lost === 0, r.lost + ' squares lost'); near(r.out, r.land, 1e-6, 'water in = water out');
    },
    'stream power: faster uplift makes higher relief, softer rock makes lower relief': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { WS } = __ws; const P = { seed: 'phys', seas: [{ side: 'S', a: .3, b: .7 }] };
        const relief = (u, k) => { const w = WS.genWorld(P); for (let i = 0; i < WS.N; i++) { w.U[i] *= u; w.K[i] *= k; } for (let s = 0; s < 500; s++) WS.step(w); let m = 0; for (const v of w.z) m = Math.max(m, v); return m; };
        return [relief(1, 1), relief(2, 1), relief(1, 3)]; });
      ok(r[1] > r[0] * 1.4, 'double uplift ' + r); ok(r[2] < r[0] * .8, 'soft rock ' + r);
    },
    'deterministic: the same plate and agents give the same land, to the last digit': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const { WS } = __ws, P = WS.PLATES[1]; const a = WS.simulate(WS.genWorld(P), P, P.sol), b = WS.simulate(WS.genWorld(P), P, P.sol);
        return [a.when === b.when, a.w.z.every((v, i) => v === b.w.z[i]), WS.genWorld({ seed: 'x', seas: [{ side: 'W', a: .3, b: .6 }] }).z[700] !== WS.genWorld({ seed: 'y', seas: [{ side: 'W', a: .3, b: .6 }] }).z[700]]; });
      eq(r, [true, true, true]);
    },
    'every plate: nothing done fails, the survey\'s own solution wins, random agents mostly fail': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { WS } = __ws, out = [];
        WS.PLATES.forEach((P, i) => { const w = WS.genWorld(P), R = WS.rng('rand' + i); const none = WS.simulate(w, P, []).ok, sol = WS.simulate(w, P, P.sol);
          let wins = 0; for (let k = 0; k < 8; k++) { const ag = []; for (const [t, n] of Object.entries(P.agents)) for (let j = 0; j < n; j++) ag.push(t === 'fall' ? { t, sea: R.int(P.seas.length) } : { t, x: 2 + R.int(WS.W - 4), y: 2 + R.int(WS.H - 4) }); if (WS.simulate(w, P, ag).ok) wins++; }
          out.push([i, none, sol.ok, sol.when, wins]); }); return out; });
      for (const [i, none, sol, when, wins] of r) { ok(!none, `plate ${i + 1} is solved with no agents`); ok(sol, `plate ${i + 1}: stored solution fails`); ok(wins <= 3, `plate ${i + 1}: ${wins}/8 random tries win`); }
    },
    'a searching surveyor solves plates; a fixed habit does not solve them all': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { WS } = __ws;
        const solve = (P, w) => { const kinds = Object.keys(P.agents); for (const t of kinds) { const C = t === 'fall' ? P.seas.map((_, s) => ({ t, sea: s })) : []; if (t !== 'fall') for (let y = 2; y < WS.H - 2; y += 3) for (let x = 2; x < WS.W - 2; x += 3) C.push({ t, x, y });
          const near = (a) => { const G = P.goal, c = G.towns ? G.towns[0] : G.at; return !c || a.t === 'fall' || Math.hypot(a.x - c[0], a.y - c[1]) < 12; };
          for (const a of C.filter(near)) if (WS.simulate(w, P, [a]).ok) return true; } return false; };
        const habit = (P, w) => { const G = P.goal, c = G.towns ? G.towns[0] : G.at || [27, 18], t = Object.keys(P.agents)[0]; return WS.simulate(w, P, [t === 'fall' ? { t, sea: G.sea || 0 } : { t, x: c[0], y: c[1] }]).ok; };
        const one = WS.PLATES.map((P, i) => [i, P]).filter(([, P]) => P.par && P.par.n === 1).slice(0, 4);
        return { solved: one.map(([i, P]) => { const w = WS.genWorld(P); return [i, solve(P, w)]; }), habit: WS.PLATES.map(P => habit(P, WS.genWorld(P))) }; });
      ok(r.solved.every(x => x[1]), 'search failed on ' + JSON.stringify(r.solved));
      ok(r.habit.some(x => !x), 'one habit solved every plate');
    },
    'drag shale from the box onto the plate, let it rain, read the result, retry in under 5 s': async ({ page, ok, eq }) => {
      await page.evaluate(() => __ws.open('p0', '')); await waitFor(page, () => __ws.w0 && __ws.key === 'p0');
      const tgt = await page.evaluate(() => { const [sx, sy] = __ws.cam.toScreen(20.5, 12.5); const t = document.querySelector('.ag').getBoundingClientRect(); return { sx, sy, tx: t.x + t.width / 2, ty: t.y + t.height / 2, kind: document.querySelector('.ag').dataset.t }; });
      await page.mouse.move(tgt.tx, tgt.ty); await page.mouse.down(); await page.mouse.move(tgt.tx + 20, tgt.ty - 30, { steps: 4 }); await page.mouse.move(tgt.sx, tgt.sy, { steps: 10 }); await page.mouse.up();
      eq(await page.evaluate(() => __ws.agents.map(a => [a.t, a.x, a.y])), [[tgt.kind, 20, 12]]);
      await page.click('#runBtn'); ok(await waitFor(page, () => __ws.phase === 'result', 8000), 'run finished'); ok(await page.isVisible('#slip'));
      const t0 = Date.now(); await page.click('#sAgain'); await page.click('#runBtn'); await page.evaluate(() => __ws.hurry());
      ok(await waitFor(page, () => __ws.phase === 'result', 5000)); ok(Date.now() - t0 < 5000, 'retry took ' + (Date.now() - t0));
      eq(await page.evaluate(() => __ws.agents.length), 1, 'agents kept between tries');
    },
    'tap a placed agent to lift it again': async ({ page, eq }) => {
      await page.evaluate(() => { __ws.open('p0', ''); }); await waitFor(page, () => __ws.w0 && __ws.key === 'p0');
      await page.evaluate(() => __ws.place(Object.keys(__ws.P.agents)[0], 30.5, 20.5)); eq(await page.evaluate(() => __ws.agents.length), 1);
      const [sx, sy] = await page.evaluate(() => __ws.cam.toScreen(30.5, 20.5)); await page.mouse.click(sx, sy); eq(await page.evaluate(() => __ws.agents.length), 0);
    },
    'a whole run, start to finish, takes well under 5 s': async ({ page, ok }) => {
      const ms = await page.evaluate(() => { const { WS } = __ws, P = __ws.P, t0 = performance.now(); WS.simulate(__ws.w0, P, []); return performance.now() - t0; });
      ok(ms < 1500, 'simulation took ' + ms);
    },
    'links: #plate=N&a=... opens that plate with those agents; daily plates are dated and differ': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const s = __ws.SAVE; s.best.p0 = { t: 0, n: 1 }; s.best.p1 = { t: 100, n: 1 }; localStorage.setItem('rh:watershed', JSON.stringify(s)); });
      await page.goto(page.url().replace(/#.*$/, '') + '#plate=2&a=f0'); await page.reload(); await waitFor(page, () => __ws.w0 && __ws.key === 'p1');
      eq(await page.evaluate(() => [__ws.key, __ws.agents]), ['p1', [{ t: 'fall', sea: 0 }]]);
      ok(/#plate=2&a=f0/.test(await page.evaluate(() => __ws.shareText())));
      const d = await page.evaluate(() => { const a = __ws.WS.dailyPlate('2026-01-01'), b = __ws.WS.dailyPlate('2026-01-02'); return [JSON.stringify(a.seas) !== JSON.stringify(b.seas) || a.goal.sea !== b.goal.sea || a.n !== b.n, a.seed]; });
      eq(d, [true, 'daily:2026-01-01']);
      await page.evaluate(() => { location.hash = '#daily=2026-03-04'; }); ok(await waitFor(page, () => __ws.key === 'd2026-03-04' && __ws.w0 && __ws.P.goal.min > 0, 8000), 'daily opens');
    },
    'today\'s plate is winnable: a falling sea plus the best single agent meets it, nothing done does not': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { WS } = __ws; const out = [];
        for (const date of ['2026-11-25', '2026-11-26', '2026-12-01']) { const P = WS.dailyPlate(date), w = WS.genWorld(P); const none = WS.simulate(w, P, []).ok; let best = WS.simulate(w, P, [{ t: 'fall', sea: P.goal.sea }]).ok;
          if (!best) for (let y = 3; y < WS.H - 2 && !best; y += 5) for (let x = 3; x < WS.W - 2 && !best; x += 5) for (const t of ['shale', 'rise']) if (!best && WS.simulate(w, P, [{ t: 'fall', sea: P.goal.sea }, { t, x, y }]).ok) best = true;
          out.push([date, none, best]); } return out; });
      for (const [d, none, best] of r) { ok(!none, d + ' solved by doing nothing'); ok(best, d + ' not winnable by the search'); }
    },
    'saves survive corruption: junk and poisoned records load a working plate': async ({ page, ok, eq }) => {
      for (const raw of ['{oops', '[]', '"str"', JSON.stringify({ best: { p0: { t: -5, n: 1 }, p1: 'x', p2: { t: 50, n: 1 } }, notes: { lake: 1, evil: 1 }, placed: { p0: 'l999.999_zz_s1' }, cur: { a: 1 } })]) {
        await plant(page, raw); ok(await waitFor(page, () => __ws.w0 && __ws.key), 'plate loads for ' + raw.slice(0, 20));
      }
      eq(await page.evaluate(() => [__ws.SAVE.best, __ws.SAVE.notes, __ws.agents.length]), [{ p2: { t: 50, n: 1 } }, { lake: 1 }, 0]);
    },
  },
};
