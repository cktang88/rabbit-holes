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
    'one verb: drag back from the probe and let go launches; a tiny drag does nothing; dragging empty space pans; the wheel zooms; Fit frames probe and target': async ({ page, eq, ok }) => {
      const probeAt = () => page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(), p = s.toS(s.probe.x, s.probe.y); return [r.left + p[0], r.top + p[1]]; });
      let pos = await probeAt();
      await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0] + 4, pos[1] + 3); await page.mouse.up();
      eq(await page.evaluate(() => window.__sling.mode), 'aim', 'a 5 px wobble does not launch');
      const c0 = await page.evaluate(() => ({ ...window.__sling.cam }));
      await page.mouse.move(pos[0] - 200, pos[1] - 150); await page.mouse.down(); await page.mouse.move(pos[0] - 120, pos[1] - 100, { steps: 4 }); await page.mouse.up();
      const c1 = await page.evaluate(() => ({ ...window.__sling.cam, mode: window.__sling.mode }));
      ok(Math.abs(c1.x - c0.x) > 5 && c1.mode === 'aim', 'dragging empty space pans without launching ' + JSON.stringify([c0, c1]));
      await page.mouse.move(400, 300); await page.mouse.wheel(0, -300); await page.waitForTimeout(100);
      ok(await page.evaluate(() => window.__sling.cam.z) > c1.z * 1.1, 'wheel up zooms in');
      await page.click('#fitBtn');
      const f = await page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(), on = (x, y) => { const p = s.toS(x, y); return p[0] > 0 && p[1] > 0 && p[0] < r.width && p[1] < r.height; };
        const tg = s.L.planets[s.L.target]; return [on(s.probe.x, s.probe.y), [0, 1, 2, 3].every(k => on(s.SUN.x + Math.cos(k * Math.PI / 2) * tg.r, s.SUN.y + Math.sin(k * Math.PI / 2) * tg.r))]; });
      eq(f, [true, true], 'Fit shows the probe and the whole target orbit');
      pos = await probeAt(); await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0] - 60, pos[1] + 40, { steps: 5 });
      eq(await page.evaluate(() => window.__sling.mode), 'aim', 'still aiming while the finger is down'); await page.mouse.up();
      eq(await page.evaluate(() => [window.__sling.mode, window.__sling.dvUsed > 0]), ['fly', true], 'letting go launches');
    },
    'one goal sentence for every mission; tools appear one at a time: no launch-date strip or engines on the first missions': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const s = window.__sling, out = [];
        for (let n = 0; n < s.MISSIONS.length; n++){ s.openLevel(String(n)); const g = document.getElementById('goalP').textContent; out.push([n, g, document.getElementById('window').classList.contains('on')]); }
        return out; });
      for (const [n, g] of r){ ok(g.length > 10 && g.length < 90 && /km\/s/.test(g) && (g.match(/\./g) || []).length <= 2, `mission ${n} goal: ${g}`); }
      eq(r.slice(0, 2).map(x => x[2]), [false, false], 'no launch-date strip on the first two missions'); eq(r[2][2], true, 'the strip arrives on mission 3');
      const e = await page.evaluate(() => { const s = window.__sling; s.openLevel('0'); const o = s.MISSIONS[0].sols[0]; s.setWindow(o.t0); s.launch({ ang: o.ang, dv: o.dv }); const a = document.getElementById('burnBar').classList.contains('on');
        s.openLevel('3'); const q = s.MISSIONS[3].sols[0]; s.setWindow(q.t0); s.launch({ ang: q.ang, dv: q.dv }); const b = document.getElementById('burnBar').classList.contains('on');
        const d0 = s.dvUsed; s.burnDir = 1; for (let k = 0; k < 12; k++) s.liveStep(); s.burnDir = 0; return [a, b, s.dvUsed > d0]; });
      eq(e, [false, true, true], 'engines only from program 2, and Speed up spends Δv');
    },
    'touch: a finger drag from the probe launches on release; two fingers pinch-zoom without launching': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const s = window.__sling, cv = document.getElementById('cv'), rc = cv.getBoundingClientRect();
        const ev = (t, x, y, id) => new PointerEvent(t, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', bubbles: true, isPrimary: id === 1 });
        const z0 = s.cam.z, cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
        cv.dispatchEvent(ev('pointerdown', cx - 30, cy, 1)); cv.dispatchEvent(ev('pointerdown', cx + 30, cy, 2));
        cv.dispatchEvent(ev('pointermove', cx - 80, cy, 1)); cv.dispatchEvent(ev('pointermove', cx + 80, cy, 2));
        window.dispatchEvent(ev('pointerup', cx - 80, cy, 1)); window.dispatchEvent(ev('pointerup', cx + 80, cy, 2)); const pinch = [s.cam.z / z0, s.mode];
        const p = s.toS(s.probe.x, s.probe.y), X = rc.left + p[0], Y = rc.top + p[1];
        cv.dispatchEvent(ev('pointerdown', X, Y, 3)); cv.dispatchEvent(ev('pointermove', X - 50, Y + 30, 3)); const mid = s.mode; window.dispatchEvent(ev('pointerup', X - 50, Y + 30, 3));
        return [pinch, mid, s.mode]; });
      ok(r[0][0] > 1.8 && r[0][1] === 'aim', 'pinch zoomed ' + JSON.stringify(r[0])); eq(r.slice(1), ['aim', 'fly']);
    },
    'the guided first mission: the ghost arrow is the stored solution, and pulling along it wins': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const s = window.__sling; s.openLevel('0'); const o = s.MISSIONS[0].sols[0]; s.setWindow(o.t0); s.launch({ ang: o.ang, dv: o.dv }); for (let k = 0; k < 9000 && s.mode === 'fly'; k++) s.liveStep(); return s.mode; });
      eq(r, 'done'); eq(await page.evaluate(() => document.getElementById('msg').textContent.includes('★') || /arriv|orbit|reach/i.test(document.getElementById('msg').textContent)), true);
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
    'the Δv beside the probe and the Δv panel read the same value while dragging': async ({ page, eq }) => {
      const pos = await page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(), p = s.toS(s.probe.x, s.probe.y); return [r.left + p[0], r.top + p[1]]; });
      const read = () => page.evaluate(() => { const s = window.__sling; return [document.getElementById('dvP').textContent.match(/Δv ([\d.]+)/)[1], s.shownDv().toFixed(1), s.aimText(s.aimVec())]; });
      await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0] - 40, pos[1] + 30, { steps: 4 }); await page.waitForTimeout(80);
      const a = await read(); await page.mouse.move(pos[0] - 70, pos[1] + 50, { steps: 4 }); await page.waitForTimeout(80); const b = await read(); await page.mouse.up();
      eq(a[0], a[1]); eq(b[0], b[1]); eq(b[2].startsWith('Δv ' + b[0]), true, b[2]); eq(+b[0] > +a[0], true, 'a longer pull is a bigger kick');
    },
    'touch, portrait phone: goal, Fit and Missions are uncovered; a real finger drag from the probe launches': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await page.waitForTimeout(300);
      const drag = async (pts) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] }); for (const [x, y] of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150); };
      const hit = await page.evaluate(() => ['fitBtn', 'binderBtn'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [id, e && (e.id === id || document.getElementById(id).contains(e)), Math.round(Math.min(r.width, r.height))]; }));
      for (const [id, top, size] of hit) { ok(top, id + ' is covered by something'); ok(size >= 28, id + ' too small: ' + size); }
      const vis = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && !b.closest('#side') && getComputedStyle(b).visibility !== 'hidden'; }).length);
      ok(vis <= 4, 'few buttons on screen at the start: ' + vis);
      const p = await page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(), q = s.toS(s.probe.x, s.probe.y); return [r.left + q[0], r.top + q[1]]; });
      await drag([[p[0], p[1]], [p[0] - 20, p[1] + 20], [p[0] - 45, p[1] + 55]]);
      eq(await page.evaluate(() => window.__sling.mode), 'fly', 'a finger drag and release launches');
    },
    'mobile layout: no horizontal scroll and the plot is visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 380 && r.cv.height >= 250, JSON.stringify(r.cv));
    },
  },
};
