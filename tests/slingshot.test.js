// Slingshot: gravity integrator, live flight, level data, saves and input.
module.exports = {
  page: 'slingshot/index.html',
  ready: async (page) => { await page.waitForFunction(() => window.__sling && window.__sling.L); await page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove())); },
  tests: {
    'energy is conserved on a bound orbit around a fixed planet (softened potential)': async ({ page, ok }) => {
      const r = await page.evaluate(() => {
        const { simulate, DT } = window.__sling; const m = 2e6, eps = 20;
        const L = { bodies: [{ x: 800, y: 500, m, rad: 20 }], start: [800, 300], target: [-1e5, -1e5], tr: 1 };
        const U = (x, y) => { const d = Math.hypot(x - 800, y - 500); return -(m / eps) * Math.atan(eps / d); };
        const out = {};
        for (const [name, speed] of [['circular', Math.sqrt(m * 200 / (200 * 200 + 400))], ['eccentric', 70]]) {
          let px = 800, py = 300, E0 = null, maxDev = 0, n = 0;
          const res = simulate(L, 0, speed, (x, y) => { const vx = (x - px) / DT, vy = (y - py) / DT; px = x; py = y; const E = 0.5 * (vx * vx + vy * vy) + U(x, y); if (E0 === null) E0 = E; maxDev = Math.max(maxDev, Math.abs(E - E0) / Math.abs(E0)); n++; return n < 120 * 20; });
          out[name] = { maxDev, res: res.res };
        }
        return out;
      });
      ok(r.circular.res === 'stop' && r.eccentric.res === 'stop', 'orbits should stay bound for 20 s: ' + JSON.stringify(r));
      ok(r.circular.maxDev < 0.005, 'circular orbit energy drift ' + r.circular.maxDev);
      ok(r.eccentric.maxDev < 0.03, 'eccentric orbit energy drift ' + r.eccentric.maxDev);
    },
    'free flight is a straight line at constant speed; mirror-symmetric setups give mirrored paths': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => {
        const { simulate } = window.__sling; const pts = [];
        const free = simulate({ bodies: [], start: [100, 100], target: [-1e5, 0], tr: 1 }, 0.3, 200, (x, y, s) => { pts.push([x, y]); return s < 600; });
        const A = [], B = [];
        simulate({ bodies: [{ x: 800, y: 400, m: 2e6, rad: 20 }], start: [300, 500], target: [-1e5, 0], tr: 1 }, -0.2, 260, (x, y, s) => { A.push([x, y]); return s < 900; });
        simulate({ bodies: [{ x: 800, y: 600, m: 2e6, rad: 20 }], start: [300, 500], target: [-1e5, 0], tr: 1 }, 0.2, 260, (x, y, s) => { B.push([x, y]); return s < 900; });
        let mirr = 0; for (let i = 0; i < A.length; i++) mirr = Math.max(mirr, Math.abs(A[i][0] - B[i][0]) + Math.abs((1000 - A[i][1]) - B[i][1]));
        const last = pts[pts.length - 1];
        return { free: free.res, n: pts.length, last, mirr };
      });
      const t = r.n / 120;
      near(r.last[0], 100 + Math.cos(0.3) * 200 * t, 1e-6, 'x');
      near(r.last[1], 100 + Math.sin(0.3) * 200 * t, 1e-6, 'y');
      ok(r.mirr < 1e-6, 'mirror asymmetry ' + r.mirr);
    },
    'collision, escape and timeout are detected': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const { simulate } = window.__sling; const body = { x: 600, y: 500, m: 2e6, rad: 30 };
        const L = { bodies: [body], start: [200, 500], target: [-1e5, 0], tr: 1 };
        const crash = simulate(L, 0, 200); const away = simulate(L, Math.PI, 300);
        const slow = simulate({ bodies: [], start: [800, 500], target: [-1e5, 0], tr: 1 }, 0, 1);
        return [crash.res, crash.body === body, away.res, slow.res];
      });
      eq(r, ['crash', true, 'lost', 'timeout']);
    },
    'live flight matches the predicted trajectory and wins the level': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const s = window.__sling; s.hold(true); const sol = s.solvable(s.L)[0];
        const pred = s.simulate(s.L, sol.ang, sol.pow);
        s.launch({ ang: sol.ang, pow: sol.pow }); let guard = 0; while (s.mode === 'fly' && guard++ < 10000) s.tick(1 / 60);
        return { pred: pred.res, predSteps: pred.s, live: s.mode, steps: s.stepN, stars: s.S.best['0'] && s.S.best['0'].stars, hub: JSON.parse(localStorage.getItem('rh:hub')).slingshot };
      });
      eq(r.pred, 'win'); eq(r.live, 'done'); eq(r.steps, r.predSteps + 1, 'same step on which the win fires');
      eq(r.stars, 3); ok(r.hub > 0 && r.hub <= 1, 'hub progress ' + r.hub);
    },
    'frame-rate independent: 3 s of flight is the same at 30, 60 and 144 Hz (and a hidden tab cannot fast-forward)': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const s = window.__sling; s.hold(true); const out = [];
        for (const hz of [30, 60, 144]) { s.reset(); s.launch({ ang: -0.4, pow: 200 }); let n = 0; for (let f = 0; f < 3 * hz; f++) { s.tick(1 / hz); n++; } out.push([s.stepN, +s.probe.x.toFixed(6), +s.probe.y.toFixed(6), s.mode]); }
        s.reset(); s.launch({ ang: -0.4, pow: 200 }); s.tick(30); const hidden = s.stepN; // 30 s gap (tab was hidden)
        return { out, hidden };
      });
      ok(r.out.every(o => Math.abs(o[0] - 360) <= 1), 'steps ' + JSON.stringify(r.out));
      const at = r.out.filter(o => o[0] === r.out[1][0]); ok(at.length >= 2, 'at least two rates land on the same step');
      eq(at[0].slice(1), at[1].slice(1), 'same position on the same step');
      ok(r.hidden <= 24, 'one long frame must be capped, got ' + r.hidden + ' steps');
    },
    'fuel never goes negative and thrust stops when it is empty': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const s = window.__sling; s.hold(true);
        s.L = { ...s.L, bodies: [], target: [-1e5, -1e5], rings: null, start: [800, 500] }; s.reset();
        s.launch({ ang: 0, pow: 0.001 }); s.mouse = [800, 0]; s.thrusting = true; let min = 1, steps = 0;
        while (s.fuel > 0 && steps < 5000) { s.liveStep(); min = Math.min(min, s.fuel); steps++; }
        const vy0 = s.probe.vy; for (let i = 0; i < 240; i++) s.liveStep();
        return { min, fuel: s.fuel, steps, vy0, vy1: s.probe.vy, mode: s.mode };
      });
      eq(r.fuel, 0); ok(r.min >= 0, 'fuel went negative'); ok(Math.abs(r.steps - 1 / 0.18 * 120) < 3, 'burn lasts ~5.6 s, took ' + r.steps);
      eq(r.vy1, r.vy0, 'no acceleration with an empty tank');
    },
    'every campaign level is solvable, not trivially straight, and gauntlet rings lie on a real solution': async ({ page, ok }) => {
      const bad = await page.evaluate(() => {
        const s = window.__sling; const bad = [];
        for (let n = 0; n < 40; n++) { const sys = Math.floor(n / 8), idx = n % 8; const L = s.buildLevel(sys, idx, 1);
          if (!s.solvable(L).length) bad.push(n + ' unsolvable');
          if (!(sys === 0 && idx < 3) && !L.rings && s.tooEasy(L)) bad.push(n + ' straight shot');
          if (sys === 3 && !(L.rings && L.rings.length >= 2)) bad.push(n + ' rings');
          if (Math.hypot(L.start[0] - L.target[0], L.start[1] - L.target[1]) < L.tr + 200) bad.push(n + ' starts at target');
          if (s.simulate(L, 0, 0).res === 'win') bad.push(n + ' wins with no launch'); }
        return bad;
      });
      ok(!bad.length, bad.join(', '));
    },
    'rings must be flown in order: hitting the target without them is not a win': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const s = window.__sling; const L = { bodies: [], start: [200, 500], target: [1200, 500], tr: 40, rings: [[700, 300, 30]] };
        return [s.simulate(L, 0, 400).res, s.simulate({ ...L, rings: [[700, 500, 30]] }, 0, 400).res];
      });
      eq(r, ['lost', 'win']);
    },
    'corrupted, old and hostile saves load safely': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const c = window.__sling.cleanSave;
        return [c(null), c('x'), c([]), c({ best: { 0: { stars: 3, fuel: 0 }, 77: { stars: 3 }, 1: { stars: 9 }, 2: 'x' }, cur: 999, deep: { 'deep:a': { stars: 2, fuel: 0.4 }, junk: { stars: 1 } } })];
      });
      eq(r[0].best, {}); eq(r[1].cur, 0); eq(r[2].deep, {});
      eq(r[3].best, { 0: { stars: 3, fuel: 0 } }); eq(r[3].cur, 0); eq(Object.keys(r[3].deep), ['deep:a']);
      for (const bad of ['{not json', 'null', '{"best":5,"cur":"7"}', '{"cur":30,"best":{}}']) {
        await page.evaluate((v) => localStorage.setItem('rh:sling', v), bad);
        await page.reload(); await page.waitForFunction(() => window.__sling && window.__sling.L);
        const st = await page.evaluate(() => [window.__sling.levelKey, window.__sling.mode]);
        eq(st, ['0', 'aim'], 'save ' + bad);
      }
    },
    'locked levels cannot be reached by buttons, Next, or a stale save': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const s = window.__sling; for (let i = 0; i < 8; i++) delete s.S.best[i];
        s.S.best['7'] = { stars: 1, fuel: 1 }; // a lucky clear of 1-8 must not open system 2
        return { open8: s.levelOpen(8), next7: s.nextOpen(7), next2: s.nextOpen(2), open3: s.levelOpen(3), disabled: document.querySelector('[data-k="8"]').disabled };
      });
      eq(r.open8, false); eq(r.next7, -1); eq(r.next2, 7, 'only the already-cleared level after 3'); eq(r.open3, false); eq(r.disabled, true);
      // win level 7 directly: the result box must not offer Next into a locked system
      const nextShown = await page.evaluate(() => { const s = window.__sling; s.hold(true); s.openLevel('7'); s.end('win'); return !!document.getElementById('nextL'); });
      eq(nextShown, false);
      await page.evaluate(() => { localStorage.setItem('rh:sling', JSON.stringify({ best: {}, cur: 20, intro: 1 })); });
      await page.reload(); await page.waitForFunction(() => window.__sling && window.__sling.L);
      eq(await page.evaluate(() => window.__sling.levelKey), '0');
    },
    'real mouse: a tiny drag does not launch, a real drag does; the last path is kept after a retry': async ({ page, eq, ok }) => {
      const pos = await page.evaluate(() => { const s = window.__sling, r = document.getElementById('cv').getBoundingClientRect(); return [r.left + s.view.ox + s.L.start[0] * s.view.s, r.top + s.view.oy + s.L.start[1] * s.view.s]; });
      await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0] - 1, pos[1]); await page.mouse.up();
      eq(await page.evaluate(() => window.__sling.mode), 'aim');
      await page.mouse.move(pos[0], pos[1]); await page.mouse.down(); await page.mouse.move(pos[0] - 60, pos[1] + 40, { steps: 5 }); await page.mouse.up();
      eq(await page.evaluate(() => window.__sling.mode), 'fly');
      await page.waitForTimeout(400); await page.keyboard.press('r');
      const st = await page.evaluate(() => [window.__sling.mode, (window.__sling.lastShot || []).length > 3]);
      eq(st, ['aim', true]);
    },
    'typing a seed containing "r" or a space does not restart or thrust; Enter flies it; long seeds are clipped': async ({ page, eq, ok }) => {
      await page.evaluate(() => { const s = window.__sling; s.hold(true); s.launch({ ang: 0.5, pow: 150 }); s.tick(0.5); });
      await page.click('#seedIn'); await page.keyboard.type('orion r ');
      const st = await page.evaluate(() => [window.__sling.mode, window.__sling.thrusting]);
      eq(st, ['fly', false]);
      await page.fill('#seedIn', 'x'.repeat(200)); await page.keyboard.press('Enter');
      const key = await page.evaluate(() => window.__sling.levelKey);
      ok(key.startsWith('deep:') && key.length <= 5 + 32, 'deep key ' + key.length);
    },
    'touch: a drag with a finger launches the probe': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const s = window.__sling, cv = document.getElementById('cv'), rc = cv.getBoundingClientRect();
        const X = rc.left + s.view.ox + s.L.start[0] * s.view.s, Y = rc.top + s.view.oy + s.L.start[1] * s.view.s;
        const ev = (t, x, y) => new PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', bubbles: true, isPrimary: true });
        cv.dispatchEvent(ev('pointerdown', X, Y)); window.dispatchEvent(ev('pointermove', X - 50, Y + 30)); window.dispatchEvent(ev('pointerup', X - 50, Y + 30));
        return s.mode;
      });
      eq(r, 'fly');
    },
    'mobile layout: no horizontal scroll and the play area is visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 380 && r.cv.height >= 250, 'canvas ' + JSON.stringify(r.cv));
    },
  },
};
