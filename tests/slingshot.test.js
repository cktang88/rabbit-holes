// Slingshot: heliocentric gravity, assists, mission data, the plan-then-launch interface, saves and difficulty.
// The harness clears localStorage on every navigation; this injects a save that survives the reload (init scripts run in order)
const reloadWith = async (page, key, v) => { await page.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch (e) {} }, [key, v]); await page.reload(); };
const ready = async (page) => { await page.waitForFunction(() => window.__sling && window.__sling.L); await page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove())); };
module.exports = {
  page: 'slingshot/index.html',
  ready,
  tests: {
    'energy is conserved on a Sun orbit, and a probe launched with no kick stays on Earth\'s orbit': async ({ page, ok }) => {
      const r = await page.evaluate(() => {
        const s = window.__sling, SUN = s.SUN, eps = 20; const L = { planets: [s.L.planets[0]], target: -1, visits: [], t0: 0 };
        const U = (x, y) => -(SUN.m / eps) * Math.atan(eps / Math.hypot(x - SUN.x, y - SUN.y));
        let px = null, py = null, E0 = null, dev = 0, rmin = 1e9, rmax = 0;
        const st = s.startState(L, 0, 0, 0); px = st.x; py = st.y;
        s.simulate(L, 0, 0, (x, y) => { const vx = (x - px) / s.DT, vy = (y - py) / s.DT; px = x; py = y; const E = 0.5 * (vx * vx + vy * vy) + U(x, y); if (E0 === null) E0 = E; dev = Math.max(dev, Math.abs(E - E0) / Math.abs(E0)); const d = Math.hypot(x - SUN.x, y - SUN.y); rmin = Math.min(rmin, d); rmax = Math.max(rmax, d); }, null, 0);
        return { dev, rmin, rmax };
      });
      ok(r.dev < 0.005, 'energy drift ' + r.dev); ok(r.rmin > 147 && r.rmax < 153, `orbit radius ${r.rmin.toFixed(1)}–${r.rmax.toFixed(1)}`);
    },
    'a gravity assist: in the planet\'s frame the probe leaves as fast as it came; in the Sun\'s frame it leaves faster': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const s = window.__sling; s.openLevel('10'); const o = s.MISSIONS[10].sols[0]; const x = s.simulate(s.L, o.ang, o.dv, null, null, o.t0); return x.flybys.filter(f => f.n === 'Jupiter')[0]; });
      ok(r, 'a Jupiter flyby happened');
      ok(Math.abs(r.relOut - r.relIn) / r.relIn < 0.12, `planet frame ${r.relIn.toFixed(1)} → ${r.relOut.toFixed(1)}`);
      ok(r.helOut - r.helIn > 20, `Sun frame ${r.helIn.toFixed(1)} → ${r.helOut.toFixed(1)}`);
    },
    'every mission is solvable inside its Δv budget; assist missions cannot be done without the assist on that budget': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const s = window.__sling, bad = [];
        s.MISSIONS.forEach((M, n) => { s.openLevel(String(n)); const wins = M.sols.filter(o => o.dv <= M.budget && s.simulate(s.L, o.ang, o.dv, null, null, o.t0).res === 'win'); if (!wins.length) bad.push(n + ' no stored solution wins');
          if (M.p >= 1 && !(M.budget < M.noAssist)) bad.push(n + ' budget allows a direct flight'); if (M.par > M.budget) bad.push(n + ' par above budget'); });
        return bad; });
      ok(!bad.length, bad.join(', '));
    },
    'live flight follows the plan exactly and wins; stars come from Δv against par and from launching once': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const s = window.__sling; s.hold(true); s.openLevel('0'); const o = s.MISSIONS[0].sols[0]; s.setWindow(o.t0);
        const pred = s.simulate(s.L, o.ang, o.dv); s.launch({ ang: o.ang, dv: o.dv }); let g = 0; while (s.mode === 'fly' && g++ < 10000) s.tick(1 / 60);
        return { pred: pred.res, predS: pred.s, steps: s.stepN, mode: s.mode, stars: s.S.best['0'] && s.S.best['0'].stars, want: s.starsFor(o.dv, true, s.L), hub: JSON.parse(localStorage.getItem('rh:hub')).slingshot,
          st: [s.starsFor(4, true, { par: 4 }), s.starsFor(4, false, { par: 4 }), s.starsFor(9, true, { par: 4 }), s.starsFor(9, false, { par: 4 })] }; });
      eq(r.pred, 'win'); eq(r.mode, 'done'); eq(r.steps, r.predS + 1); eq(r.stars, r.want); ok(r.hub > 0 && r.hub <= 1);
      eq(r.st, [3, 2, 2, 1]);
    },
    'frame-rate independent: 3 s of flight is the same at 30, 60 and 144 Hz, and a hidden tab cannot fast-forward': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const s = window.__sling; s.hold(true); s.openLevel('0'); const out = [];
        for (const hz of [30, 60, 144]) { s.reset(); s.launch({ ang: 1.2, dv: 5 }); for (let f = 0; f < 3 * hz; f++) s.tick(1 / hz); out.push([s.stepN, +s.probe.x.toFixed(6), +s.probe.y.toFixed(6)]); }
        s.reset(); s.launch({ ang: 1.2, dv: 5 }); s.tick(30); return { out, hidden: s.stepN }; });
      ok(r.out.every(o => Math.abs(o[0] - 360) <= 1), JSON.stringify(r.out)); const at = r.out.filter(o => o[0] === r.out[1][0]); ok(at.length >= 2); eq(at[0].slice(1), at[1].slice(1)); ok(r.hidden <= 24, 'capped ' + r.hidden);
    },
    'the burn budget never goes negative and the engine stops when it is spent': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const s = window.__sling; s.hold(true); s.openLevel('0'); s.launch({ ang: 1.57, dv: 2 }); s.mouse = [800, 0]; s.thrusting = true; let max = 0;
        for (let i = 0; i < 2000 && s.mode === 'fly'; i++){ s.liveStep(); max = Math.max(max, s.dvUsed); } return { max, budget: s.L.budget }; });
      ok(r.max <= r.budget + 1e-9, `used ${r.max} of ${r.budget}`);
    },
    'plan, then commit: releasing the drag only aims; Compute plots the whole path (three per mission); only Launch flies; the window dial only works while aiming': async ({ page, eq, ok }) => {
      const pos = await page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(), p = s.toS(s.probe.x, s.probe.y); return [r.left + p[0], r.top + p[1]]; });
      await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0] - 60, pos[1] + 40, { steps: 5 }); await page.mouse.up();
      const a = await page.evaluate(() => [window.__sling.mode, !!window.__sling.aim]);
      eq(a, ['aim', true]);
      for (let k = 0; k < 4; k++) await page.click('#computeBtn', { force: true });
      const c = await page.evaluate(() => [window.__sling.runsLeft, window.__sling.computed && window.__sling.computed.pts.length > 50, document.getElementById('computeBtn').disabled]);
      eq(c, [0, true, true]);
      await page.evaluate(() => window.__sling.setWindow(5)); eq(await page.evaluate(() => window.__sling.computed), null, 'a new window invalidates the plot');
      await page.click('#launchBtn'); const f = await page.evaluate(() => { const s = window.__sling; const t0 = s.L.t0; s.setWindow(20); return [s.mode, s.L.t0, t0]; });
      eq(f, ['fly', 5, 5]);
    },
    'touch: a finger drag aims; the Launch button flies': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const s = window.__sling, cv = document.getElementById('cv'), rc = cv.getBoundingClientRect(), p = s.toS(s.probe.x, s.probe.y); const X = rc.left + p[0], Y = rc.top + p[1];
        const ev = (t, x, y) => new PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', bubbles: true, isPrimary: true });
        cv.dispatchEvent(ev('pointerdown', X, Y)); window.dispatchEvent(ev('pointermove', X - 50, Y + 30)); window.dispatchEvent(ev('pointerup', X - 50, Y + 30)); const m1 = s.mode; document.getElementById('launchBtn').click(); return [m1, s.mode]; });
      eq(r, ['aim', 'fly']);
    },
    'corrupted and pre-orbit saves load safely': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const c = window.__sling.cleanSave; return [c(null).best, c({ best: { 0: { stars: 3, fuel: 0 } }, cur: 3 }).best, c({ v: 3, best: { 0: { stars: 2, dv: 5 }, 99: { stars: 3 } }, cur: 50 })]; });
      eq(r[0], {}); eq(r[1], {}, 'older versions are not migrated: the missions are new'); eq(r[2].best, { 0: { stars: 2, dv: 5 } }); eq(r[2].cur, 0);
      for (const bad of ['{not json', 'null', '{"v":3,"best":5,"cur":"7"}', '{"v":3,"cur":11,"best":{}}']) { await reloadWith(page, 'rh:sling', bad); await ready(page); eq(await page.evaluate(() => [window.__sling.levelKey, window.__sling.mode]), ['0', 'aim'], bad); }
    },
    'locked missions cannot be reached by buttons, Next, or a stale save': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const s = window.__sling; s.S.best['0'] = { stars: 1, dv: 9 }; return { open1: s.levelOpen(1), open2: s.levelOpen(2), open3: s.levelOpen(3), dis: document.querySelector('[data-k="3"]').disabled }; });
      eq(r, { open1: true, open2: false, open3: false, dis: true });
      const nextShown = await page.evaluate(() => { const s = window.__sling; s.hold(true); for (const k in s.S.best) delete s.S.best[k]; s.openLevel('2'); s.end('win'); return !!document.getElementById('nextL'); });
      eq(nextShown, false);
    },
    'difficulty: naive launches fail the late missions; the planner\'s solution wins; full-throttle searching misses the par star': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const s = window.__sling, out = { greedy: [], random: [], idle: [], planner: [], simple: [] }; const rng = RH.rng(9);
        for (let n = 8; n < s.NLEV; n++){ const M = s.MISSIONS[n]; s.openLevel(String(n)); const L = s.L;
          // greedy: point straight at the target (or straight out for the tour), full budget, launch now
          const st = s.startState(L, 0, 0, 0); const tgt = M.target >= 0 ? s.bodyPos(L.planets[M.target], 0) : [st.x + (st.x - 800), st.y + (st.y - 500)];
          out.greedy.push(s.simulate(L, Math.atan2(tgt[1] - st.y, tgt[0] - st.x), M.budget, null, null, 0).res === 'win');
          // random: ten uplinks with random aims, kicks and windows
          let rw = 0; for (let k = 0; k < 10; k++) if (s.simulate(L, rng() * 6.283, 2 + rng() * (M.budget - 2), null, null, Math.floor(rng() * 40)).res === 'win') rw++; out.random.push(rw);
          out.idle.push(s.simulate(L, 0, 0, null, null, 0).res === 'win');
          const o = M.sols[0]; out.planner.push(s.simulate(L, o.ang, o.dv, null, null, o.t0).res === 'win');
          // simple: sweep 36 directions at full budget, at the planner's window; even when it wins, it burns the whole budget
          let sw = null; for (let k = 0; k < 36 && !sw; k++) if (s.simulate(L, k / 36 * 6.283, M.budget, null, null, o.t0).res === 'win') sw = M.budget; out.simple.push(sw === null ? 0 : s.starsFor(sw, true, M)); }
        return out; });
      const n = r.greedy.length;
      ok(r.greedy.filter(Boolean).length <= n * 0.2, 'greedy wins ' + r.greedy);
      ok(r.random.reduce((a, b) => a + b, 0) <= n * 10 * 0.2, 'random uplinks won ' + r.random + ' of 10 each');
      ok(r.idle.every(x => !x), 'idle'); ok(r.planner.every(Boolean), 'planner ' + r.planner);
      ok(r.simple.every(st => st < 3), 'full-throttle stars ' + r.simple);
    },
    'launch-date strip: for an aim, it marks the dates that arrive; the planner\'s window is among the best': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const s = window.__sling; s.openLevel('3'); const o = s.MISSIONS[3].sols[0]; const q = s.windowQuality({ ang: o.ang, dv: o.dv }); return { len: q.length, at: q[o.t0], max: Math.max(...q) }; });
      ok(r.len === 41, 'one cell per second of window'); ok(r.at === 1 && r.max === 1, JSON.stringify(r));
    },
    'deep space sandbox: a seed sets the planets; unlimited computing; no stars are recorded': async ({ page, eq, ok }) => {
      await page.evaluate(() => document.getElementById('binderBtn').click()); await page.fill('#seedIn', 'pioneer'); await page.press('#seedIn', 'Enter');
      const r = await page.evaluate(() => { const s = window.__sling; const a = JSON.stringify(s.deepMission('pioneer').planets.map(p => p.ph)), b = JSON.stringify(s.deepMission('pioneer').planets.map(p => p.ph)), c = JSON.stringify(s.deepMission('mariner').planets.map(p => p.ph));
        s.hold(true); s.end('win'); return { key: s.levelKey, runs: s.runsLeft, same: a === b, differ: a !== c, best: Object.keys(s.S.best).length }; });
      eq(r.key, 'deep:pioneer'); ok(r.runs > 3); ok(r.same && r.differ); eq(r.best, 0);
    },
    'the Δv beside the probe and the ΔV panel always read the same value, while dragging and after release': async ({ page, eq }) => {
      const pos = await page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(), p = s.toS(s.probe.x, s.probe.y); return [r.left + p[0], r.top + p[1]]; });
      const read = () => page.evaluate(() => { const s = window.__sling; return [document.getElementById('dvP').textContent.match(/ΔV ([\d.]+)/)[1], s.shownDv().toFixed(1)]; });
      await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0] - 40, pos[1] + 30, { steps: 4 }); await page.waitForTimeout(80);
      const during = await read(); await page.mouse.move(pos[0] - 70, pos[1] + 50, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(80); const after = await read();
      const label = await page.evaluate(() => window.__sling.aimText(window.__sling.aim));
      eq(during[0], during[1], 'while dragging'); eq(after[0], after[1], 'after release'); eq(label.startsWith('ΔV ' + after[0]), true, label);
    },
    'touch, portrait phone: the window dial, Compute and Launch are all uncovered, and a real tap on Launch flies': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await page.waitForTimeout(300);
      const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(120); };
      const drag = async (pts) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] }); for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(120); };
      const hit = await page.evaluate(() => ['winR', 'computeBtn', 'launchBtn'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [id, e && (e.id === id || document.getElementById(id).contains(e)), Math.round(Math.min(r.width, r.height))]; }));
      for (const [id, top, size] of hit) { ok(top, id + ' is covered by something'); ok(size >= 28, id + ' too small: ' + size); }
      const p = await page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(), q = s.toS(s.probe.x, s.probe.y); return [r.left + q[0], r.top + q[1]]; });
      await drag([[p[0], p[1]], [p[0] - 20, p[1] + 20], [p[0] - 45, p[1] + 55]]);
      eq(await page.evaluate(() => [window.__sling.mode, !!window.__sling.aim]), ['aim', true]);
      const c = await page.evaluate(() => { const r = document.getElementById('computeBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await tap(c[0], c[1]);
      eq(await page.evaluate(() => window.__sling.runsLeft), 2, 'tapping Compute computes');
      const l = await page.evaluate(() => { const r = document.getElementById('launchBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await tap(l[0], l[1]);
      eq(await page.evaluate(() => window.__sling.mode), 'fly', 'tapping the middle of Launch launches');
    },
    'mobile layout: no horizontal scroll and the plot is visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 380 && r.cv.height >= 250, JSON.stringify(r.cv));
    },
  },
};
