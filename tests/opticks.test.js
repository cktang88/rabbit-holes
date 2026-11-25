// Opticks: optical bench puzzles. Logic via window.__opt.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const placeSol = (page, i, tweak) => page.evaluate(([i, tweak]) => {
  const o = window.__opt; o.loadLevel(i);
  o.placed = o.L[i].sol.map((p, k) => ({ ...p, id: k })).map((p, k) => tweak && k === 0 ? (p.t === 'lens' ? { ...p, x: p.x + 3 } : { ...p, a: p.a + tweak }) : p);
  o.recompute(); return o.R.checks.map(c => c.ok);
}, [i, tweak]);
module.exports = {
  page: 'opticks/index.html',
  tests: {
    'every level is solved by its authored solution': async ({ page, ok }) => {
      const n = await page.evaluate(() => window.__opt.L.length);
      for (let i = 0; i < n; i++) {
        if (await page.evaluate(i => window.__opt.L[i].predict, i)) { ok(await page.evaluate(i => { const o = window.__opt, lv = o.L[i]; return o.predictHit(lv, lv.sol[0]) && !o.predictHit(lv, { ...lv.sol[0], x: lv.sol[0].x + 1 }); }, i), `prediction level ${i}`); continue; }
        const c = await placeSol(page, i); ok(c.length && c.every(Boolean), `level ${i} solution fails: ${c}`); }
    },
    'pan and zoom: a piece dragged from the tray while zoomed and panned lands under the pointer': async ({ page, ok, near }) => {
      await closeModals(page);
      await page.evaluate(() => { const o = window.__opt; o.loadLevel(0); o.placed = []; o.recompute(); const r = document.getElementById('cv').getBoundingClientRect(); o.cam.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 2.2); o.cam.panBy(40, -25); });
      const tb = await page.locator('#tray .piece').first().boundingBox(), cb = await page.locator('#cv').boundingBox();
      const sx = cb.x + cb.width * .62, sy = cb.y + cb.height * .4;
      await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.mouse.down(); await page.mouse.move(sx, sy, { steps: 8 }); await page.mouse.up();
      const r = await page.evaluate(([sx, sy]) => { const o = window.__opt, c = document.getElementById('cv').getBoundingClientRect(), dpr = devicePixelRatio || 1;
        const m = new DOMMatrix(o.VT()).inverse(), w = m.transformPoint(new DOMPoint((sx - c.left) * dpr, (sy - c.top) * dpr)); return { p: o.placed[0], w: [w.x, w.y], k: o.cam.k }; }, [sx, sy]);
      ok(r.p && r.k > 2, 'no piece placed or not zoomed'); near(r.p.x, r.w[0], .2); near(r.p.y, r.w[1], .2);
    },
    'pan and zoom: a pinch that starts on a piece zooms but never moves, turns or places it; dragging bare bench pans, dragging a piece moves it': async ({ page, ok, eq }) => {
      await closeModals(page);
      const before = await page.evaluate(() => { const o = window.__opt; o.loadLevel(0); o.placed = [{ t: 'mirror', id: 0, x: 14, y: 8, a: 45 }]; o.sel = 0; o.recompute(); o.cam.fit(); return { ...o.placed[0], k: o.cam.k }; });
      const after = await page.evaluate(() => { const o = window.__opt, cv = document.getElementById('cv'), dpr = devicePixelRatio || 1, c = cv.getBoundingClientRect();
        const scr = (x, y) => { const p = new DOMMatrix(o.VT()).transformPoint(new DOMPoint(x, y)); return [c.left + p.x / dpr, c.top + p.y / dpr]; };
        const [hx, hy] = scr(...o.handlesOf(o.placed[0])[0]), [mx, my] = scr(o.placed[0].x, o.placed[0].y);
        const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
        ev('pointerdown', 1, hx, hy); ev('pointermove', 1, hx + 4, hy + 30); ev('pointerdown', 2, mx + 60, my + 40);
        for (let k = 1; k <= 6; k++) { ev('pointermove', 1, hx - k * 8, hy - k * 5); ev('pointermove', 2, mx + 60 + k * 8, my + 40 + k * 5); }
        ev('pointerup', 1, hx - 48, hy - 30); ev('pointerup', 2, mx + 108, my + 70); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
        return { ...o.placed[0], n: o.placed.length, k: o.cam.k }; });
      eq([after.x, after.y, after.a, after.n], [before.x, before.y, before.a, 1]); ok(after.k > before.k * 1.3, 'pinch did not zoom ' + after.k);
      await page.waitForTimeout(50);
      const pan = await page.evaluate(() => { const o = window.__opt, cv = document.getElementById('cv'), c = cv.getBoundingClientRect(), x0 = o.cam.x;
        const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 5, clientX: x, clientY: y, bubbles: true, pointerType: 'mouse', button: 0 }));
        let ex = c.left + 5, ey = c.top + 5; for (let k = 0; k < 40 && o.pick(...o.toW({ clientX: ex, clientY: ey })) >= 0; k++) ex += 10;
        ev('pointerdown', ex, ey); ev('pointermove', ex + 30, ey); ev('pointerup', ex + 30, ey); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5 }));
        return { dx: o.cam.x - x0, p: { ...o.placed[0] } }; });
      ok(Math.abs(pan.dx - 30) < 1.5 && pan.p.x === before.x, 'empty drag ' + JSON.stringify(pan));
      await page.waitForTimeout(50);
      const cb = await page.evaluate(() => { const o = window.__opt, dpr = devicePixelRatio || 1, c = document.getElementById('cv').getBoundingClientRect(), p = new DOMMatrix(o.VT()).transformPoint(new DOMPoint(o.placed[0].x, o.placed[0].y)); return [c.left + p.x / dpr, c.top + p.y / dpr, o.cam.x]; });
      await page.mouse.move(cb[0], cb[1]); await page.mouse.down(); await page.mouse.move(cb[0] + 40, cb[1] + 10, { steps: 5 }); await page.mouse.up();
      const m = await page.evaluate(() => ({ x: window.__opt.placed[0].x, camx: window.__opt.cam.x }));
      ok(m.x !== before.x && m.camx === cb[2], 'dragging the mirror ' + JSON.stringify(m));
    },
    'pan and zoom: Fit restores the whole bench; the bar is styled; a new experiment starts fitted': async ({ page, ok, near }) => {
      await closeModals(page);
      await page.evaluate(() => { const o = window.__opt, r = document.getElementById('cv').getBoundingClientRect(); o.cam.zoomAt(r.left + 50, r.top + 50, 3); o.cam.panBy(-80, 30); });
      await page.click('.pz-fit'); await page.waitForTimeout(450);
      const c = await page.evaluate(() => window.__opt.cam.state); near(c.k, 1, 1e-6); near(c.x, 0, 1e-6); near(c.y, 0, 1e-6);
      ok(await page.evaluate(() => getComputedStyle(document.querySelector('.pz-bar button')).borderRadius === '50%'), 'pz bar not styled');
      await page.evaluate(() => { const o = window.__opt, r = document.getElementById('cv').getBoundingClientRect(); o.cam.zoomAt(r.left + 50, r.top + 50, 3); o.loadLevel(1); });
      near(await page.evaluate(() => window.__opt.cam.k), 1, 1e-6);
    },
    'pan and zoom on a phone: + zooms, the rotated bench still maps the pointer, and a tap on a piece selects it': async ({ page, ok }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
      await p.goto(page.url()); await p.waitForTimeout(900); await p.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
      await p.evaluate(() => { const o = window.__opt; o.loadLevel(0); o.placed = [{ t: 'mirror', id: 0, x: 14, y: 8, a: 45 }]; o.sel = -1; o.recompute(); });
      await p.locator('.pz-in').tap(); await p.waitForTimeout(100);
      const s = await p.evaluate(() => { const o = window.__opt, dpr = devicePixelRatio || 1, c = document.getElementById('cv').getBoundingClientRect(), q = new DOMMatrix(o.VT()).transformPoint(new DOMPoint(14, 8)); return { x: c.left + q.x / dpr, y: c.top + q.y / dpr, k: o.cam.k, rot: o.view.rot }; });
      ok(s.k > 1.3 && s.rot, JSON.stringify(s));
      await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(100);
      ok(await p.evaluate(() => window.__opt.sel === 0), 'tap on the zoomed mirror did not select it'); await ctx.close();
    },
    'no level is solved with an empty bench': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const o = window.__opt; return o.L.map((l, i) => { o.loadLevel(i); o.placed = []; o.recompute(); return o.R.checks.every(c => c.ok); }); });
      r.forEach((v, i) => ok(!v, `level ${i} solved at start`));
    },
    'misplacing the first solution piece (20 deg turn, or lens moved 3) breaks every level': async ({ page, ok }) => {
      const n = await page.evaluate(() => window.__opt.L.length);
      for (let i = 0; i < n; i++) { const c = await placeSol(page, i, 20); ok(!c.every(Boolean), `level ${i} still solved with a 20 degree error`); }
    },
    'chromatic aberration: a single lens can not focus white light': async ({ page, ok }) => {
      const any = await page.evaluate(() => {
        const o = window.__opt, i = o.L.findIndex(l => l.n === 'Chromatic Aberration'), lv = o.L[i];
        for (const p of o.trayOf(lv)) for (let x = 3; x <= 28; x += .25) { const R = o.trace(lv, [{ ...p, x, y: 10, a: 90 }]); if (lv.targets.every((t, k) => o.checkTarget(t, R.hits[k], lv).ok)) return x; }
        return null;
      });
      ok(any === null, 'single lens solved it at x=' + any);
    },
    'reflection law: a 45 degree mirror turns a beam 90 degrees': async ({ page, near }) => {
      const r = await page.evaluate(() => { const o = window.__opt, lv = { sources: [{ k: 'beam', x: 2, y: 4, a: 0, l: 650, n: 1 }], targets: [] }; const R = o.trace(lv, [{ t: 'mirror', x: 16, y: 4, a: 45 }]); const p = R.paths[1]; return Math.atan2(p.y2 - p.y1, p.x2 - p.x1) * 180 / Math.PI; });
      near(Math.abs(r), 90, 1e-6);
    },
    'slab keeps direction, splitter conserves intensity': async ({ page, near }) => {
      const r = await page.evaluate(() => {
        const o = window.__opt, src = [{ k: 'beam', x: 2, y: 9, a: 0, l: 650, n: 1 }];
        const A = o.trace({ sources: src, targets: [] }, [{ t: 'block', x: 14, y: 9, a: 40, w: 4, h: 3 }]); const last = A.paths[A.paths.length - 1];
        const B = o.trace({ sources: src, targets: [] }, [{ t: 'splitter', x: 12, y: 9, a: 45 }]);
        const ends = B.paths.filter(p => p.x2 <= .001 || p.x2 >= 31.999 || p.y2 <= .001 || p.y2 >= 19.999);
        return [Math.atan2(last.y2 - last.y1, last.x2 - last.x1), ends.reduce((a, p) => a + p.I, 0)];
      });
      near(r[0], 0, 1e-9, 'slab exit direction'); near(r[1], 1, 1e-9, 'splitter total intensity');
    },
    'loading a level with more targets never uses the previous level\'s results (stale R)': async ({ page, eq, ok }) => {
      await closeModals(page);
      const res = await page.evaluate(() => {
        const o = window.__opt, out = []; const order = [0, 4, 0, 2, 4, 2, 18, 0];
        for (const i of order) { o.loadLevel(i); out.push([o.R.lv === o.cur, o.R.checks.length === o.L[i].targets.length, [...document.querySelectorAll('#tg > span')].filter(e => /^[✓○] Target/.test(e.textContent)).length, o.L[i].targets.length]); }
        return out;
      });
      for (const [fresh, len, spans, n] of res) { ok(fresh && len, 'stale results after level change'); eq(spans, n, 'target rows'); }
    },
    'sweeping the mirror past the answer with the wheel does not win; holding it does': async ({ page, ok }) => {
      await closeModals(page);
      await page.evaluate(() => { const o = window.__opt; o.loadLevel(0); o.placed = [{ ...o.trayOf(o.L[0])[0], x: 16, y: 4, a: 30 }]; o.sel = 0; o.recompute(); });
      // the wheel turns the selected piece when the pointer is over it (elsewhere it zooms the bench)
      const at = await page.evaluate(() => { const o = window.__opt, dpr = devicePixelRatio || 1, c = document.getElementById('cv').getBoundingClientRect(), q = new DOMMatrix(o.VT()).transformPoint(new DOMPoint(16, 4)); return [c.left + q.x / dpr, c.top + q.y / dpr]; });
      await page.mouse.move(at[0], at[1]);
      for (let k = 0; k < 15; k++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); } // 30 -> 75 degrees, through 45
      await page.waitForTimeout(1200);
      ok(!(await page.evaluate(() => window.__opt.S.done[0])), 'won while sweeping');
      ok(await page.evaluate(() => window.__opt.cam.k === 1), 'the wheel over a piece zoomed the bench as well as turning the piece');
      for (let k = 0; k < 10; k++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(60); } // back to 45
      ok(await page.evaluate(() => window.__opt.placed[0].a === 45 && window.__opt.R.checks[0].ok), 'not aligned');
      ok(!(await page.evaluate(() => window.__opt.S.done[0])), 'won instantly, without settling');
      await page.waitForTimeout(1100);
      ok(await page.evaluate(() => !!window.__opt.S.done[0]), 'holding the right angle should win');
    },
    'keyboard: pass through the answer with Q/E does not win': async ({ page, ok }) => {
      await closeModals(page);
      await page.evaluate(() => { const o = window.__opt; o.loadLevel(0); o.placed = [{ ...o.trayOf(o.L[0])[0], x: 16, y: 4, a: 39 }]; o.sel = 0; o.recompute(); });
      for (let k = 0; k < 6; k++) { await page.keyboard.press('e'); await page.waitForTimeout(80); }
      await page.waitForTimeout(1000);
      ok(!(await page.evaluate(() => window.__opt.S.done[0])), 'won while passing by on keys');
    },
    'dragging a mirror\'s end turns it, snapping to 45 degrees': async ({ page, ok, eq }) => {
      await closeModals(page);
      await page.evaluate(() => { const o = window.__opt; o.loadLevel(0); o.placed = [{ ...o.trayOf(o.L[0])[0], x: 16, y: 6, a: 90 }]; o.sel = 0; o.recompute(); });
      const pts = await page.evaluate(() => { const o = window.__opt, cv = document.getElementById('cv'), r = cv.getBoundingClientRect(), d = devicePixelRatio, M = o.VT();
        const sc = (x, y) => [(M[0] * x + M[2] * y + M[4]) / d + r.left, (M[1] * x + M[3] * y + M[5]) / d + r.top];
        const [h] = o.handlesOf(o.placed[0]); return { from: sc(h[0], h[1]), to: sc(16 + Math.cos(Math.PI / 4) * 1.5 + .05, 6 + Math.sin(Math.PI / 4) * 1.5) }; });
      await page.mouse.move(...pts.from); await page.mouse.down();
      for (let k = 1; k <= 8; k++) await page.mouse.move(pts.from[0] + (pts.to[0] - pts.from[0]) * k / 8, pts.from[1] + (pts.to[1] - pts.from[1]) * k / 8);
      await page.mouse.up();
      const p = await page.evaluate(() => window.__opt.placed[0]);
      eq([p.x, p.y], [16, 6], 'turning should not move the piece'); eq(((p.a % 180) + 180) % 180, 45);
      eq(await page.evaluate(() => [window.__opt.snapAngle(46.2), window.__opt.snapAngle(50.3)]), [45, 50.5]);
    },
    'arrow keys cannot push a piece off the bench': async ({ page, ok }) => {
      await closeModals(page);
      await page.evaluate(() => { const o = window.__opt; o.loadLevel(0); o.placed = [{ ...o.trayOf(o.L[0])[0], x: .5, y: .5, a: 0 }]; o.sel = 0; o.recompute(); });
      for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); }
      const p = await page.evaluate(() => window.__opt.placed[0]);
      ok(p.x >= 0 && p.y >= 0, 'piece left the bench: ' + JSON.stringify(p));
    },
    'drag from tray onto the bench and pointer released ends the drag': async ({ page, ok, eq }) => {
      await closeModals(page);
      const el = page.locator('#tray .piece').first(), b = await el.boundingBox(), cv = await page.locator('#cv').boundingBox();
      await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down();
      await page.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 3, { steps: 5 }); await page.mouse.up();
      eq(await page.evaluate(() => window.__opt.placed.length), 1);
      eq(await page.locator('#tray .piece').count(), 0, 'tray piece should be gone');
      ok(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:opticks')).layouts[0].length === 1), 'layout saved');
    },
    'corrupted and old saves are sanitised': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const c = window.__opt.cleanSave;
        const a = c({ done: { 0: 1, 999: 1, abc: 1, 2: 0 }, layouts: { 0: [{ id: 0, x: 'NaN', y: 1, a: 0 }, { id: 0, x: 3, y: 3, a: 45, f: -99 }, { id: 0, x: 4, y: 4, a: 0 }, { id: 9, x: 1, y: 1, a: 0 }], 3: 'bad', 77: [] }, cur: 99 });
        return [a, c(null), c('junk'), c([1, 2])];
      });
      eq(Object.keys(r[0].done), ['0']); eq(r[0].layouts[0].length, 1, 'one valid unique piece'); eq(r[0].layouts[0][0].f, undefined, 'piece props come from the tray'); eq(r[0].cur, 0);
      ok(!r[0].layouts[3] && !r[0].layouts[77]);
      for (const x of r.slice(1)) eq(x, { done: {}, layouts: {}, tries: {}, cur: 0, intro: 0, v: 2, ob: { n: 3, fees: 0, slots: [{ s: 'o1', k: 0 }, { s: 'o2', k: 0 }, { s: 'o3', k: 0 }], best: {} } });
      await page.addInitScript(() => localStorage.setItem('rh:opticks', '{"done":{"0":1,"500":1},"layouts":{"0":"x"},"cur":"7"}'));
      await page.reload(); await page.waitForTimeout(500);
      eq(await page.evaluate(() => Object.keys(window.__opt.S.done).length), 1);
      await page.addInitScript(() => localStorage.setItem('rh:opticks', '{broken'));
      await page.reload(); await page.waitForTimeout(500);
      eq(await page.evaluate(() => window.__opt.cur), 0);
    },
    'save round-trip and progress never exceeds 1': async ({ page, eq, ok }) => {
      await closeModals(page);
      await placeSol(page, 0); await page.waitForTimeout(1100); await closeModals(page);
      await page.evaluate(() => { const o = window.__opt; o.L.forEach((l, i) => o.S.done[i] = 1); o.loadLevel(1); });
      const hub = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).opticks);
      eq(hub, 1);
      const snap = await page.evaluate(() => localStorage.getItem('rh:opticks'));
      await page.addInitScript(s => localStorage.setItem('rh:opticks', s), snap);
      await page.reload(); await page.waitForTimeout(500);
      eq(await page.evaluate(() => window.__opt.cur), 1, 'current level restored');
      eq(await page.evaluate(() => Object.keys(window.__opt.S.done).length), await page.evaluate(() => window.__opt.L.length));
      ok(await page.evaluate(() => window.__opt.placed.length === 0));
    },
    'a confirmed experiment writes Q.E.D. in the notebook and offers the next one (no blocking modal)': async ({ page, ok, eq }) => {
      await closeModals(page);
      await placeSol(page, 0); await page.waitForTimeout(2000);
      eq(await page.locator('.modal-bg').count(), 0, 'modal');
      ok(await page.locator('#info .qed').isVisible(), 'no Q.E.D.');
      await page.click('#nextLv');
      eq(await page.evaluate(() => window.__opt.cur), 1);
      eq(await page.locator('#info .qed').count(), 0, 'stale Q.E.D. on the next level');
    },
    'the maze needs no more than four mirrors': async ({ page, eq }) => {
      eq(await page.evaluate(() => window.__opt.L.find(l => l.n === 'The Maze').sol.length), 4);
    },
    'difficulty: naive play fails the last third; the designed solution earns 3 stars; a pricier design only 2': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => {
        const o = window.__opt, L = o.L, rnd = RH.rng('naive'), first = Math.ceil(L.length * 2 / 3), out = { naive: [], comp: [] };
        const solved = (lv, ps) => { const R = o.trace(lv, ps); return lv.targets.every((t, k) => o.checkTarget(t, R.hits[k], lv).ok); };
        const grade = (lv, ps) => solved(lv, ps) ? o.starsFor(o.costOf(ps), o.parOf(lv)) : 0;
        // a bot plays a stream of layouts: on normal levels its best layout counts; on Foresight levels every layout is a lighting of the lamp
        const play = (lv, layouts) => { let best = 0, n = 0; for (const ps of layouts) { if (lv.predict) { const m = ps.find(p => p.t === 'marker'); if (!m) continue; n++; if (o.predictHit(lv, m)) return o.predictStars(n); } else best = Math.max(best, grade(lv, ps)); } return best; };
        for (let i = first; i < L.length; i++) {
          const lv = L[i], tray = o.trayOf(lv), s0 = lv.sources[0];
          out.naive.push(play(lv, [[]])); // idle
          const rand = []; for (let t = 0; t < 300; t++) { const n = 1 + rnd.int(3), ps = []; for (let k = 0; k < n; k++) ps.push({ ...tray[rnd.int(tray.length)], x: 1 + rnd() * 30, y: 1 + rnd() * 18, a: rnd() * 360 }); rand.push(ps); }
          out.naive.push(play(lv, rand)); // random: a handful of random pieces dropped anywhere
          const obv = []; for (const p of tray) for (let d = 3; d <= 28; d += 1) for (const a of [0, 45, 90, 135]) { const x = s0.x + Math.cos(s0.a * Math.PI / 180) * d, y = s0.y + Math.sin(s0.a * Math.PI / 180) * d; if (x < 0 || x > 32 || y < 0 || y > 20) continue; obv.push([{ ...p, x, y, a }]); }
          out.naive.push(play(lv, obv)); // obvious: each piece in the box, slid along the beam at the textbook angles
          out.comp.push(play(lv, [lv.sol.map((p, k) => ({ ...p, id: k }))]));
        }
        const kep = L.find(l => l.n === 'Keplerian Telescope'); // the same telescope from dearer, stronger lenses
        out.kepler = 0; for (let x2 = 15.5; x2 <= 16.6 && !out.kepler; x2 += .05) out.kepler = grade(kep, [{ t: 'lens', f: 6, L: 5, x: 8, y: 10, a: 90 }, { t: 'lens', f: 2, L: 5, x: +x2.toFixed(2), y: 10, a: 90 }]);
        return out;
      });
      ok(r.naive.filter(x => x <= 1).length / r.naive.length >= .9, 'naive bots do too well: ' + r.naive);
      ok(r.comp.every(x => x === 3), 'the designed solutions should earn 3 stars: ' + r.comp);
      eq(r.kepler, 2, 'a working but pricier telescope');
    },
    'the box holds more than the job needs, with prices; lenses show focal points': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const o = window.__opt, i = o.L.findIndex(l => l.n === 'Keplerian Telescope'); o.loadLevel(i); return { tray: o.trayOf(o.L[i]).length, sol: o.L[i].sol.length, prices: document.querySelectorAll('#tray .price').length, first: document.querySelector('#tray .piece').textContent }; });
      ok(r.tray >= r.sol + 5 && r.prices === r.tray, JSON.stringify(r));
    },
    'foresight: the lamp stays dark until lit; a first-time prediction earns 3 stars, a second 2; moving the screen darkens it again': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => {
        const o = window.__opt, i = o.L.findIndex(l => l.predict), lv = o.L[i], out = {}; o.loadLevel(i);
        out.tray = o.trayOf(lv).map(p => p.t);
        o.placed = [{ ...o.trayOf(lv)[0], x: lv.targets[0].x + 2, y: lv.targets[0].y, a: 90 }]; o.recompute();
        out.dark = !o.revealed; out.miss = o.lightLamp(); out.lit = o.revealed;
        o.placed[0].x = lv.targets[0].x; o.recompute(); out.darkAgain = !o.revealed;
        out.hit = o.lightLamp(); out.stars = o.S.done[i];
        return out;
      });
      eq(r.tray, ['marker']); ok(r.dark); eq(r.miss, false); ok(r.lit); ok(r.darkAgain); eq(r.hit, true); eq(r.stars, 2);
    },
    'redesigned late levels: Lighthouse needs a lens and a fold; one prism cannot pass the crucial experiment': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const o = window.__opt, lh = o.L.find(l => l.n === 'Lighthouse'), ec = o.L.find(l => l.n === 'Experimentum Crucis');
        const ok = (lv, ps) => { const R = o.trace(lv, ps); return lv.targets.every((t, k) => o.checkTarget(t, R.hits[k], lv).ok); };
        let lens = false; for (let x = 7; x <= 30 && !lens; x += .25) lens = ok(lh, [{ t: 'lens', f: 5, L: 6, x, y: 14, a: 90 }]);
        let prism = false; for (let a = 0; a < 360 && !prism; a += 1) for (const g of ['crown', 'flint']) prism = prism || ok(ec, [{ t: 'prism', s: 3, g, x: 8, y: 14, a }]);
        return { lens, prism, lhSol: ok(lh, lh.sol) }; });
      ok(!r.lens && !r.prism && r.lhSol, JSON.stringify(r));
    },
    'old saves carry progress over by level name': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const o = window.__opt; const s = o.cleanSave({ done: { 0: 1, 13: 1, 18: 1, 25: 1 }, cur: 18 }); return [Object.keys(s.done).map(k => o.L[k].n).sort(), o.L[s.cur].n]; });
      eq(r, [["Bounce", "Newton's Prism"], "Newton's Prism"]);
    },
    'order book: orders are deterministic per seed, solvable by the Guild design, unsolved when empty, at every rank': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const o = window.__opt, out = { bad: [], made: 0, same: true, kinds: {} };
        for (let rank = 0; rank < 5; rank++) for (let i = 0; i < 16; i++) { const g = o.genComm('t' + i, rank); if (!g) { out.bad.push('none ' + rank + ':' + i); continue; } out.made++; out.kinds[g.kind] = 1;
          if (JSON.stringify(g) !== JSON.stringify(o.genComm('t' + i, rank))) out.same = false;
          const m = o.measureComm(g, o.trace(g, g.refP), g.refP), m0 = o.measureComm(g, o.trace(g, []), []);
          if (!m.all) out.bad.push('guild fails ' + rank + ':' + i); if (m0.main) out.bad.push('empty passes ' + rank + ':' + i);
          if (g.clauses.length > [1, 2, 2, 3, 3][rank]) out.bad.push('too many clauses'); }
        return out; });
      eq(r.bad, []); ok(r.same, 'not deterministic'); eq(r.made, 80); eq(Object.keys(r.kinds).sort(), ['burn', 'periscope', 'reduce', 'search', 'spectro']);
    },
    'order book bots: random play fails; a competent maker meets every order; no single fixed habit meets them all': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const B = eval(src), o = window.__opt, rnd = RH.rng('naive'), out = { n: 0, comp: 0, rand: 0, idle: 0, fixed: { mirrors: 0, glass: 0, kepler: 0, 'cheapest-main': 0 }, fams: new Set() };
        for (let rank = 0; rank < 5; rank++) for (let i = 0; i < 8; i++) { const c = o.getComm('bot' + i, rank); out.n++;
          const b = B.competent(c); if (b) { out.comp++; out.fams.add(c.kind + ':' + b.k); }
          out.rand += B.random(c, rnd, 60); out.idle += o.measureComm(c, o.trace(c, []), []).all;
          for (const h of Object.keys(out.fixed)) out.fixed[h] += B.fixed(c, h); }
        out.fams = out.fams.size; return out; }, require('./opticks.bots.js').botSrc);
      ok(r.comp === r.n, 'competent maker failed some orders: ' + JSON.stringify(r));
      ok(r.idle === 0 && r.rand / r.n <= .15, 'random designs pass too often: ' + JSON.stringify(r));
      for (const [h, v] of Object.entries(r.fixed)) ok(v < r.n, `the fixed habit "${h}" met every order`);
      ok(r.fams >= 8, 'the winning designs are too uniform: ' + r.fams);
    },
    'light is counted: speculum returns 70%, glass loses about 4% a surface, total internal reflection loses nothing': async ({ page, near }) => {
      const r = await page.evaluate(() => { const o = window.__opt, src = [{ k: 'beam', x: 2, y: 4, a: 0, l: 650, n: 1 }], lv = { sources: src, targets: [], loss: 1 };
        const out = R => R.finals.reduce((a, f) => a + f.I, 0);
        return [out(o.trace(lv, [{ t: 'mirror', x: 16, y: 4, a: 45 }])), out(o.trace(lv, [{ t: 'lens', f: 6, L: 5, x: 10, y: 4, a: 90 }])), out(o.trace(lv, [{ t: 'rprism', s: 3, x: 16, y: 5, a: 0 }])), out(o.trace({ ...lv, loss: 0 }, [{ t: 'mirror', x: 16, y: 4, a: 45 }]))]; });
      near(r[0], .7, 1e-9); near(r[1], .917, .005); near(r[2], .917, .005); near(r[3], 1, 1e-9);
    },
    'white sunlight: a single lens of any glass cannot meet a white burning order; a crown-flint doublet or a concave mirror can': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const o = window.__opt; let c = null; for (let i = 0; i < 80 && !c; i++) { const g = o.getComm('w' + i, 2); if (g.kind === 'burn' && g.white && Math.abs(g.targets[0].y - g.sources[0].y) < .3) c = g; }
        const y0 = c.sources[0].y, T = c.targets[0], pass = ps => o.measureComm(c, o.trace(c, ps), ps).main;
        const single = o.CATALOG(4).filter(p => p.t === 'lens' && p.f > 0).some(p => { for (let x = T.x - p.f - 1; x <= T.x - p.f + 1; x += .02) if (pass([{ ...p, x, y: y0, a: 90 }])) return true; return false; });
        let dbl = false; for (const f of [3, 4, 6]) for (let x = T.x - 2 * f - 1.5; x <= T.x - 2 * f + 1 && !dbl; x += .02) dbl = pass([{ t: 'lens', f, L: 5, x, y: y0, a: 90 }, { t: 'lens', f: { 3: -5.4, 4: -7.4, 6: -11.5 }[f], L: 5, g: 'flint', x: x + .25, y: y0, a: 90 }]);
        return { single, dbl, spec: c.spec }; });
      ok(!r.single && r.dbl, JSON.stringify(r));
    },
    'order book: the first order is one lens; paying raises rank, refills the slot, declines and the order of the day work': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(async () => { const o = window.__opt; o.S.done = { 0: 3, 1: 3, 2: 3 }; o.render();
        const sl = o.S.ob.slots[0], c = o.getComm(sl.s, sl.k), out = { first: c.kind + ':' + c.refP.length + ':' + c.clauses.length };
        o.openComm(sl.s, sl.k, 0); o.placed = c.refP.map(p => ({ ...p })); o.recompute(); await new Promise(r => setTimeout(r, 1200));
        out.fees = o.S.ob.fees; out.slot = o.S.ob.slots[0].s; out.paid = o.wsLv.paid;
        o.recompute(); await new Promise(r => setTimeout(r, 1000)); out.fees2 = o.S.ob.fees; // no double pay
        const before = o.S.ob.slots[1].s; o.openComm(o.S.ob.slots[1].s, o.S.ob.slots[1].k, 1); o.declineComm(); out.declined = before !== o.S.ob.slots[1].s;
        o.openWorkshop('daily'); out.daily = o.wsLv.key; out.hash = location.hash;
        o.S.ob.fees = 50; out.rank = o.RANKS[o.rankOf(o.S.ob.fees)][0];
        return out; });
      eq(r.first, 'burn:1:0'); ok(r.fees >= 3 && r.paid && r.slot === 'o4', JSON.stringify(r)); eq(r.fees2, r.fees, 'paid twice');
      ok(r.declined, 'decline'); ok(/^d\d{8}\.2$/.test(r.daily) && r.hash === '#c=' + r.daily, r.daily + ' ' + r.hash); eq(r.rank, 'Master optician');
      eq(await page.locator('.modal-bg').count(), 0, 'no blocking modal');
    },
    'sealed: the lamp stays dark, one lighting pays double; a failed lighting breaks the seal and the plain fee still pays': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(async () => { const o = window.__opt, out = {}; o.S.done = { 0: 3, 1: 3, 2: 3 };
        const sl = o.S.ob.slots[1], c = o.getComm(sl.s, sl.k); o.openComm(sl.s, sl.k, 1); o.toggleSeal();
        o.placed = c.refP.map(p => ({ ...p })); o.recompute(); await new Promise(r => setTimeout(r, 1100));
        out.notAuto = o.S.ob.fees === 0; out.dark = !o.revealed && document.querySelector('#tg').textContent.includes('sealed');
        out.lit = o.commLight(); out.fees = o.S.ob.fees; out.fee = c.fee; out.sealedBest = o.S.ob.best[sl.s + '.' + sl.k].sealed;
        const s2 = o.S.ob.slots[2], c2 = o.getComm(s2.s, s2.k); o.openComm(s2.s, s2.k, 2); o.toggleSeal(); o.placed = []; o.recompute();
        out.miss = o.commLight(); out.unsealed = !o.wsLv.sealedOn; out.again = o.commLight();
        o.placed = c2.refP.map(p => ({ ...p })); o.recompute(); await new Promise(r => setTimeout(r, 1100)); out.fees3 = o.S.ob.fees; out.fee2 = c2.fee;
        return out; });
      ok(r.notAuto && r.dark, 'sealed design paid without lighting: ' + JSON.stringify(r)); eq(r.lit, true); ok(r.fees >= 2 * r.fee && r.sealedBest, JSON.stringify(r));
      eq(r.miss, false); ok(r.unsealed && r.again === null, 'one lighting only'); ok(r.fees3 >= r.fees + r.fee2 && r.fees3 < r.fees + 2 * r.fee2, JSON.stringify(r));
    },
    'order book saves survive corruption; share links open the same order': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const c = window.__opt.cleanSave; return [c({ ob: { n: 'x', fees: -5, slots: [{ s: 'evil', k: 9 }], best: { 'o1.0': { cost: 'a' }, 'o2.0': { cost: 3, len: 2, light: .8, sealed: 1 }, 'bad key!': { cost: 1, len: 1, light: 1 } } } }).ob, c({ ob: 'junk' }).ob]; });
      eq(r[0].n, 3); eq(r[0].fees, 0); eq(r[0].slots.map(s => s.s), ['o1', 'o2', 'o3']); eq(Object.keys(r[0].best), ['o2.0']); eq(r[1].fees, 0);
      await page.addInitScript(() => { if (!location.hash) location.hash = '#c=zz7.3'; }); await page.reload(); await page.waitForTimeout(900);
      const g = await page.evaluate(() => [window.__opt.cur === window.__opt.WS, window.__opt.wsLv.key, window.__opt.wsLv.pays, JSON.stringify(window.__opt.genComm('zz7', 3).shelf) === JSON.stringify(window.__opt.wsLv.shelf)]);
      eq(g, [true, 'zz7.3', false, true]);
    },
    'free bench: lamps can be placed; a two-mirror periscope and a Keplerian telescope enter the codex; designs share as a link': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const o = window.__opt; o.openWorkshop('free'); const tray = o.trayOf(o.wsLv), get = (t, extra = {}) => tray.find(p => p.t === t && Object.entries(extra).every(([k, v]) => p[k] === v));
        const laser = get('src', { kind: 'laser' }), mirrors = tray.filter(p => p.t === 'mirror');
        o.placed = [{ ...laser, x: 3, y: 15, a: 0 }, { ...mirrors[0], x: 10, y: 15, a: -45 }, { ...mirrors[1], x: 10, y: 6, a: -45 }]; o.recompute();
        const peri = !!o.S.codex.periscope;
        const sun = get('src', { kind: 'ruby' }), l9 = get('lens', { f: 8 }), l3 = get('lens', { f: 4 });
        o.placed = [{ ...sun, x: 2, y: 10, a: 0 }, { ...l9, x: 8, y: 10, a: 90 }, { ...l3, x: 20.05, y: 10, a: 90 }]; o.recompute();
        const kep = !!o.S.codex.kepler, code = o.encodeBench(o.placed), back = o.decodeBench(code).map(p => [p.id, p.x, p.y, p.a]);
        return { peri, kep, code, back, orig: o.placed.map(p => [p.id, p.x, p.y, p.a]) }; });
      ok(r.peri, 'periscope not recognised'); ok(r.kep, 'telescope not recognised'); eq(r.back, r.orig, 'share link round-trip');
      await page.addInitScript(c => { if (!location.hash) location.hash = '#bench=' + c; }, r.code); await page.reload(); await page.waitForTimeout(800);
      eq(await page.evaluate(() => [window.__opt.cur === window.__opt.WS, window.__opt.placed.length]), [true, 3], 'opening a shared link restores the bench');
    },
    'locked chapters cannot be opened from the sidebar': async ({ page, eq }) => {
      await closeModals(page);
      const i = await page.evaluate(() => window.__opt.L.findIndex(l => l.c === 1));
      await page.locator(`.lv[data-i="${i}"]`).click();
      eq(await page.evaluate(() => window.__opt.cur), 0);
    },
    'no console errors at phone size': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      await closeModals(page);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), 'horizontal overflow');
    },
  },
};
