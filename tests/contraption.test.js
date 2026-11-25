// The Gentle Machine (contraption/): bring fragile cargo down to a basket so gently it survives ten seeded tomorrows.
// Determinism of the planck world, a scripted machine for every bench, random machines failing, the book of braking
// recognising techniques from behaviour, share links, autosave, mobile drag under zoom, and frame time.
const ready = async (page) => { await page.waitForFunction(() => window.__gm && window.__gm.view); await page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove())); };
module.exports = {
  page: 'contraption/index.html',
  ready,
  tests: {
    'the physics is deterministic: the same machine gives the same ten tomorrows, to the last bit': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const { GM, pById } = window.__gm; const B = pById.hammock;
        const fin = (k) => { const s = new GM.Sim(B, B.sol, k); s.run(); const p = s.cargo.b.getPosition(); return [s.t, p.x, p.y, s.peak, s.result.why]; };
        const a = GM.runAll(B, B.sol), b = GM.runAll(B, B.sol);
        return { a: JSON.stringify(a.res), b: JSON.stringify(b.res), f1: fin(3), f2: fin(3), f0: fin(0), f5: fin(5) }; });
      eq(r.a, r.b, 'ten tomorrows twice'); eq(r.f1, r.f2, 'exact final state'); ok(JSON.stringify(r.f0) !== JSON.stringify(r.f5), 'another tomorrow differs');
    },
    'every bench has a scripted machine that passes, using only the parts in its box': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { GM } = window.__gm; return GM.BENCHES.map(B => { const R = GM.runAll(B, B.sol);
        const fits = Object.entries(B.sol.reduce((m, p) => (m[p[0]] = (m[p[0]] || 0) + 1, m), {})).every(([t, n]) => (B.bin[t] || 0) >= n);
        return { id: B.id, saved: R.saved, pass: B.pass || 7, fits }; }); });
      for (const b of r) { ok(b.fits, b.id + ' solution fits the box'); ok(b.saved >= b.pass, `${b.id}: ${b.saved}/10 (needs ${b.pass})`); }
    },
    'random machines from the same box mostly fail: placement matters': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { GM } = window.__gm, rnd = GM.rng('random-machines'); const out = {};
        for (const B of GM.BENCHES) { let pass = 0, n = 12;
          for (let k = 0; k < n; k++) { const ps = []; for (const [t, c] of Object.entries(B.bin)) for (let i = 0; i < c; i++) if (rnd() < .6) ps.push([t, Math.round((.5 + rnd() * 23) * 4) / 4, Math.round((.5 + rnd() * 13) * 4) / 4, Math.round((rnd() - .5) * 6)]);
            const s = new GM.Sim(B, ps, 0); s.run(); if (s.result.ok && GM.runAll(B, ps).saved >= (B.pass || 7)) pass++; }
          out[B.id] = pass / n; }
        return out; });
      const all = Object.values(r), mean = all.reduce((a, b) => a + b, 0) / all.length;
      ok(mean < .1, 'random machines pass rarely: ' + JSON.stringify(r)); for (const [id, f] of Object.entries(r)) ok(f <= .25, id + ' random pass rate ' + f);
    },
    'the book of braking recognises techniques from what happens': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { GM, pById } = window.__gm; const found = (B, ps, k = 0) => { const s = new GM.Sim(B, ps, k); s.run(); return [...s.found]; };
        const drop = (cargo, h, ps = [], vy = 0) => found({ id: 'test', cargo, drop: [5, h, 0, vy], basket: [20, 0], fixed: [] }, ps);
        return { ramp: found(pById.first, pById.first.sol), switchback: found(pById.zigzag, pById.zigzag.sol), cushion: found(pById.cushion, pById.cushion.sol), hammock: found(pById.hammock, pById.hammock.sol),
          parachute: found(pById.parachute, pById.parachute.sol), freefall: drop('egg', 6), torn: drop('jelly', 6), burst: drop('bubble', 1.2, [], -6), lever: found(pById.seesaw, pById.seesaw.sol), none: drop('egg', .6) }; });
      for (const k of ['ramp', 'switchback', 'cushion', 'hammock', 'parachute', 'freefall', 'torn', 'burst']) ok(r[k].includes(k), `${k}: ${r[k]}`);
      ok(r.lever.includes('lever') || r.lever.includes('counterweight'), 'catch and lower: ' + r.lever);
      ok(!r.none.includes('freefall') && !r.none.includes('ramp'), 'a short drop records nothing: ' + r.none);
    },
    'running plays tomorrow 1 live, runs the other nine behind it, and Reset is instant and keeps the machine': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const g = window.__gm; g.openBench(g.pById.first, g.pById.first.sol); g.startRun(); });
      await page.waitForFunction(() => window.__gm.results.every(r => r), null, { timeout: 30000 });
      const r = await page.evaluate(() => { const g = window.__gm; const strip = [...document.querySelectorAll('#strip i')].map(i => i.className.trim().split(' ')[0]); const t0 = performance.now(); document.getElementById('runBtn').click(); return { strip, ms: performance.now() - t0, mode: g.mode, parts: g.parts.length, saved: g.results.filter(x => x && x.ok).length }; });
      eq(r.strip.length, 10); ok(r.strip.every(c => c === 'ok' || c === 'bad'), 'all ten shown: ' + r.strip); eq(r.mode, 'build'); eq(r.parts, 3, 'machine kept'); ok(r.ms < 200, 'reset took ' + r.ms.toFixed(0) + ' ms');
    },
    'passing a bench records the best on three axes and opens the next bench': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const g = window.__gm; const before = g.benchOpen(1); g.openBench(g.pById.first, g.pById.first.sol); g.startRun();
        const R = g.GM.runAll(g.B, g.parts); g.results.splice(0, 10, ...R.res); g.summary(); return { before, after: g.benchOpen(1), best: g.SAVE.best.first, parts: g.unlocked().parts }; });
      eq(r.before, false); eq(r.after, true); ok(r.best.saved >= 7 && r.best.cost === 3 && r.best.lean === 3 && r.best.gentle > 0, JSON.stringify(r.best)); eq(r.parts.sort(), ['cushion', 'plank'], 'the sandbox offers what you have met (the next two benches open)');
    },
    'share links round-trip exactly, and the machine lives in the address bar': async ({ page, eq }) => {
      const a = await page.evaluate(() => { const g = window.__gm; g.openBench(g.pById.hammock, g.pById.hammock.sol); const code = g.encodeMachine(); const m = g.decodeMachine(code);
        return { code, id: m.b.id, ps: m.ps, orig: g.pById.hammock.sol, res: JSON.stringify(g.GM.runAll(m.b, m.ps).res) }; });
      eq(a.id, 'hammock'); eq(a.ps, a.orig);
      await page.goto('about:blank'); await page.goto('http://localhost:8765/contraption/index.html#m=' + a.code); await ready(page);
      const b = await page.evaluate(() => { const g = window.__gm; return { id: g.B.id, ps: g.parts, res: JSON.stringify(g.GM.runAll(g.B, g.parts).res) }; });
      eq(b.id, 'hammock'); eq(b.ps, a.orig); eq(b.res, a.res, 'the opened link replays the same ten tomorrows');
      const junk = await page.evaluate(() => [window.__gm.decodeMachine('!!!'), window.__gm.decodeMachine(btoa('{"p":"nope"}'))]); eq(junk, [null, null]);
    },
    'autosave keeps the build on each bench across a reload; save export and import round-trip; junk is cleaned': async ({ page, eq }) => {
      await page.evaluate(() => { const g = window.__gm; g.openBench(g.pById.first); g.parts = [['plank', 4, 3.5, -1], ['plank', 7, 2.5, -1]]; });
      await page.goto('http://localhost:8765/contraption/index.html'); await ready(page);
      const r = await page.evaluate(() => { const g = window.__gm; const txt = btoa(unescape(encodeURIComponent(JSON.stringify(g.SAVE)))); const back = g.cleanSave(JSON.parse(decodeURIComponent(escape(atob(txt)))));
        return { id: g.B.id, ps: g.parts, same: JSON.stringify(back) === JSON.stringify(g.SAVE), junk: g.cleanSave({ best: { first: 'x', nope: { saved: 3 } }, mech: { ramp: 1, zz: 2 }, builds: { first: [['laser', 1, 1, 0], ['plank', 99, -5, 40]] } }) }; });
      eq(r.id, 'first'); eq(r.ps, [['plank', 4, 3.5, -1], ['plank', 7, 2.5, -1]]); eq(r.same, true);
      eq(r.junk.best, {}); eq(Object.keys(r.junk.mech), ['ramp']); eq(r.junk.builds.first, [['plank', 23.7, 0.3, 12]]);
    },
    'the daily bench is the same for a date, differs between dates, and its template machine passes': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const g = window.__gm; const a = g.dailyBench('2026-11-25'), b = g.dailyBench('2026-11-25'), c = g.dailyBench('2026-11-26');
        return { same: JSON.stringify(a) === JSON.stringify(b), diff: JSON.stringify(a.drop) + a.cargo !== JSON.stringify(c.drop) + c.cargo, savedA: g.GM.runAll(a, a.sol).saved, savedC: g.GM.runAll(c, c.sol).saved, rnd: g.GM.runAll(a, [['plank', 12, 7, 3]]).saved }; });
      eq(r.same, true); ok(r.diff, 'another day, another bench'); ok(r.savedA >= 7 && r.savedC >= 7, 'template machines pass: ' + r.savedA + ', ' + r.savedC); ok(r.rnd < 7, 'a stray plank does not');
    },
    'mobile: drag a part from the box onto the zoomed bench lands under the finger; drag it again; tap to turn': async ({ page, ok, eq, near }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      await page.evaluate(() => { const g = window.__gm; g.openBench(g.pById.cushion, []); g.cam.zoomAt(200, 400, 2); });
      await page.waitForTimeout(100);
      const r = await page.evaluate(() => { const g = window.__gm, cv = document.getElementById('cv'), cr = cv.getBoundingClientRect(), btn = document.querySelector('.part[data-t="cushion"]'), br = btn.getBoundingClientRect();
        const ev = (t, tgt, x, y, id = 7) => tgt.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 }));
        const tx = cr.left + cr.width * .55, ty = cr.top + cr.height * .45;
        ev('pointerdown', btn, br.left + 20, br.top + 20); for (let k = 1; k <= 8; k++) ev('pointermove', window, br.left + 20 + (tx - br.left - 20) * k / 8, br.top + 20 + (ty - br.top - 20) * k / 8); ev('pointerup', window, tx, ty);
        const want = g.toM(tx, ty), p1 = g.parts[0] && g.parts[0].slice();
        // drag the placed part 60 px right, then tap it
        const [sx, sy] = g.toScreenM(p1[1], p1[2]); ev('pointerdown', cv, sx, sy, 8); for (let k = 1; k <= 6; k++) ev('pointermove', cv, sx + k * 10, sy, 8); ev('pointerup', cv, sx + 60, sy, 8);
        const p2 = g.parts[0].slice(), want2 = g.toM(sx + 60, sy); const [qx, qy] = g.toScreenM(p2[1], p2[2]); ev('pointerdown', cv, qx, qy, 9); ev('pointerup', cv, qx, qy, 9);
        const pop = document.getElementById('pop').classList.contains('on'); document.querySelector('#pop [data-a="l"]').click();
        return { want, p1, p2, want2, pop, turn: g.parts[0][3], k: g.cam.k, n: g.parts.length }; });
      eq(r.n, 1, 'one cushion placed'); near(r.p1[1], r.want[0], .2, 'x under the finger'); near(r.p1[2], r.want[1], .2, 'y under the finger');
      near(r.p2[1], r.want2[0], .2, 'dragged with the finger'); ok(r.pop, 'a tap opens the part toolbar'); eq(r.turn, 1, 'turned one notch'); ok(r.k > 1, 'still zoomed');
    },
    'a pinch on the bench zooms and does not move parts': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      const r = await page.evaluate(async () => { const g = window.__gm; g.openBench(g.pById.first, g.pById.first.sol); g.cam.fit(false); const k0 = g.cam.k, cv = document.getElementById('cv');
        const [sx, sy] = g.toScreenM(4, 3.5); const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
        ev('pointerdown', 1, sx, sy); ev('pointerdown', 2, sx + 40, sy); ev('pointermove', 1, sx - 30, sy); ev('pointermove', 2, sx + 80, sy); await new Promise(r => setTimeout(r, 60)); ev('pointerup', 1, sx - 30, sy); ev('pointerup', 2, sx + 80, sy);
        return { k0, k1: g.cam.k, ps: g.parts, sol: g.pById.first.sol }; });
      ok(r.k1 > r.k0 * 1.2, 'zoomed: ' + r.k0 + ' → ' + r.k1); eq(r.ps, r.sol, 'parts untouched');
    },
    'mobile layout: the bench is the screen, the box fits, nothing scrolls sideways': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const g = window.__gm; g.openBench(g.pById.grand); const st = document.getElementById('stage').getBoundingClientRect(), bins = [...document.querySelectorAll('.part')].map(b => b.getBoundingClientRect());
        return { sw: document.documentElement.scrollWidth, stage: st.width * st.height / (innerWidth * innerHeight), binsOk: bins.every(b => b.height >= 40), n: bins.length }; });
      ok(r.sw <= 390, 'no sideways scroll: ' + r.sw); ok(r.stage > .5, 'bench area ' + r.stage.toFixed(2)); ok(r.binsOk && r.n >= 6, 'parts box buttons ' + r.n);
    },
    'speed: 150 bodies step and draw 60 frames inside a phone budget (best of three)': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const g = window.__gm; const ps = []; for (let i = 0; i < 120; i++) ps.push(['block', 1 + (i % 20) * 1.1, 4 + Math.floor(i / 20) * 1.2, 0]); for (let i = 0; i < 4; i++) ps.push(['hammock', 4 + i * 5, 2, 0]);
        g.openBench(g.sandboxBench('jelly'), ps); g.startRun(); const S = g.live; const n = S.bodies.length; let best = 1e9;
        for (let rep = 0; rep < 3; rep++) { const t0 = performance.now(); for (let k = 0; k < 60; k++) { S.step(); g.draw(); } best = Math.min(best, performance.now() - t0); }
        g.stopRun(); return { n, best }; });
      ok(r.n >= 150, 'bodies: ' + r.n); ok(r.best < 600, `60 frames of ${r.n} bodies took ${r.best.toFixed(0)} ms (budget 600, 10 ms a frame here)`);
    },
  },
};
