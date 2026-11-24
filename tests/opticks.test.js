// Opticks: optical bench puzzles. Logic via window.__opt.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const placeSol = (page, i, tweak) => page.evaluate(([i, tweak]) => {
  const o = window.__opt; o.loadLevel(i);
  o.placed = o.trayOf(o.L[i]).slice(0, o.L[i].sol.length).map((p, k) => tweak && k === 0 ? (p.t === 'lens' ? { ...p, x: p.x + 3 } : { ...p, a: p.a + tweak }) : p);
  o.recompute(); return o.R.checks.map(c => c.ok);
}, [i, tweak]);
module.exports = {
  page: 'opticks/index.html',
  tests: {
    'every level is solved by its authored solution': async ({ page, ok }) => {
      const n = await page.evaluate(() => window.__opt.L.length);
      for (let i = 0; i < n; i++) { const c = await placeSol(page, i); ok(c.length && c.every(Boolean), `level ${i} solution fails: ${c}`); }
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
      const box = await page.locator('#cv').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let k = 0; k < 15; k++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); } // 30 -> 75 degrees, through 45
      await page.waitForTimeout(1200);
      ok(!(await page.evaluate(() => window.__opt.S.done[0])), 'won while sweeping');
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
      for (const x of r.slice(1)) eq(x, { done: {}, layouts: {}, cur: 0, intro: 0 });
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
