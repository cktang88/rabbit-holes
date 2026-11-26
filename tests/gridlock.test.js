// Gridlock: a city you govern with rules, not roads. Several classes of selfish commuters reach a
// Wardrop equilibrium; tokens (tolls, barriers, signals, bus lanes and lines, cordons) reshape it.
// Bots check the balance: idle and random play get dismissed, an adaptive planner lasts, and no fixed recipe wins every city.
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:gridlock', raw), raw); await page.reload(); await page.waitForTimeout(500); };
const waitFor = async (page, fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(80); } return false; };

module.exports = {
  page: 'gridlock/index.html#city=test-a',
  tests: {
    'opens on a playable city: two districts, Downtown, toll and barrier tokens, nothing placed': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const C = __gl.C; return { month: C.month, homes: __gl.GL.homes(C).length, jobs: __gl.GL.jobs(C).length, hand: C.hand.slice().sort(), acts: C.acts, seed: C.seed, groups: C.groups.length }; });
      eq(r.month, 1); eq(r.homes, 2); eq(r.jobs, 1); eq(r.hand, ['close', 'toll']); eq(r.seed, 'test-a'); ok(r.acts >= 2); ok(r.groups === 2, 'both districts commute');
    },
    'Wardrop: after a month every commuter class only uses its cheapest routes, and no unused route is cheaper': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const G = __gl.GL, C = G.newCity('wardrop');
        const bad = [];
        for (let m = 0; m < 9; m++) { G.startMonth(C);
          if (m === 4) { const busy = C.roads.slice().sort((a, b) => C._x[b.id] - C._x[a.id]); C.hand = ['toll', 'close', 'signal']; C.unlock.signal = 1; G.act(C, { t: 'toll', road: busy[0].id, level: 4 }); G.act(C, { t: 'signal', road: busy[1].id, node: busy[1].a }); }
          G.runMonth(C, 30, { noCases: true }); }
        G.settle(C, 160); // run the drivers on to full equilibrium
        for (const g of C.groups) { const v = G.VOT[g.cls], c = g.paths.map(p => G.pathTime(C, p) + G.pathMoney(C, p) / v), m = Math.min(...c);
          g.paths.forEach((p, i) => { if (p.f > 20 && c[i] - m > .25) bad.push([g.id, 'used route slower by', c[i] - m]); });
          const sp = G.dijkstra(C, g.o, g.d, v), spc = G.pathTime(C, sp) + G.pathMoney(C, sp) / v; if (spc < m - .25) bad.push([g.id, 'cheaper unused route', m - spc]);
          const tot = g.paths.reduce((a, p) => a + p.f, 0) + (g.bus ? g.bus.f : 0); if (Math.abs(tot - g.n) > 1e-6) bad.push([g.id, 'flow not conserved', tot, g.n]); }
        return bad; });
      ok(!bad.length, JSON.stringify(bad.slice(0, 3)));
    },
    'values of time: a toll pushes students off a road long before couriers': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const G = __gl.GL, C = G.newCity('vot'); for (let m = 0; m < 6; m++) { G.startMonth(C); G.runMonth(C, 30, { noCases: true }); }
        G.startMonth(C); G.settle(C, 80); const snap = G.serialize(C);
        for (const rd of C.roads.filter(r => C._xc[r.id][0] > 40 && C._xc[r.id][2] > 40).sort((a, b) => C._x[b.id] - C._x[a.id])) {
          const D = G.restore(snap); D.roads[rd.id].toll = 4; G.rebuildGroups(D); G.settle(D, 80); const a = D._xc[rd.id], b = C._xc[rd.id];
          if (a[2] / b[2] < .9) return { road: rd.name, kept: [a[0] / b[0], a[2] / b[2]] }; }
        return null; });
      ok(r, 'no shared road found'); ok(r.kept[0] > r.kept[1] + .2, 'couriers should stay, students leave: ' + JSON.stringify(r));
    },
    'a closure that would strand a district is refused': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const G = __gl.GL, C = G.newCity('strand'); G.startMonth(C); const h = G.homes(C)[0];
        const only = C.roads.filter(r => r.a === h || r.b === h); if (only.length !== 1) { for (const x of only.slice(1)) x.closed = 1; }
        return G.act(C, { t: 'close', road: only[0].id }); });
      ok(/cut .* off/.test(r || ''), 'got ' + r);
    },
    'play is deterministic per seed, and a save restored mid-run continues identically': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const G = __gl.GL;
        const a = G.playBot('det-1', 'random', 14).hist, b = G.playBot('det-1', 'random', 14).hist;
        // run 6 months, save, restore, run 6 more vs straight through
        const run = (C, n) => { for (let i = 0; i < n && !C.over; i++) { G.startMonth(C); const busy = C.roads.slice().sort((p, q) => C._x[q.id] - C._x[p.id]); if (C.hand.includes('toll') && G.used(C, 'toll') < C.unlock.toll) G.act(C, { t: 'toll', road: busy[i % 3].id, level: 2 }); G.runMonth(C, 30); } return C; };
        const S = run(G.newCity('det-2'), 12), H = run(G.restore(G.serialize(run(G.newCity('det-2'), 6))), 6);
        return { same: JSON.stringify(a) === JSON.stringify(b), A: S.hist.map(h => h.avg), B: H.hist.map(h => h.avg), diff: JSON.stringify(G.playBot('det-3', 'random', 8).hist) !== JSON.stringify(G.playBot('det-4', 'random', 8).hist) }; });
      eq(r.same, true); eq(r.A, r.B); eq(r.diff, true, 'different seeds should differ');
    },
    'naive play fails: idle and random councils are always dismissed, typically within a year and a half': async ({ page, ok }) => {
      const r = await page.evaluate(() => ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].flatMap(s => ['idle', 'random'].map(b => { const x = __gl.GL.playBot(s, b, 36); return [s, b, x.months, x.over]; })));
      for (const [s, b, m, over] of r) ok(over === 'fired' && m < 30, `${b} on ${s} lasted ${m} months (${over})`);
      const ms = r.map(x => x[2]).sort((a, b) => a - b); ok(ms[ms.length >> 1] <= 18, 'median ' + ms[ms.length >> 1]);
    },
    'fixed recipes fail: each single strategy is dismissed on some seed': async ({ page, ok }) => {
      const r = await page.evaluate(() => ['tollJam', 'busAll', 'closeExpress'].map(b => [b, ['s1', 's2', 's3', 's4'].map(s => __gl.GL.playBot(s, b, 36)).filter(x => x.over === 'fired').length]));
      for (const [b, fails] of r) ok(fails >= 1, `${b} survived every seed`);
    },
    'a competent adaptive planner lasts two terms (24 months) on most cities': async ({ page, ok }) => {
      const r = await page.evaluate(() => ['c', 'e', 'h', 'a'].map(s => { const x = __gl.GL.playBot(s, 'adaptive', 30); return [s, x.months, x.over, x.cases.length]; }));
      const good = r.filter(x => x[1] >= 24);
      ok(good.length >= 3, JSON.stringify(r));
      ok(r.some(x => x[3] >= 4), 'an adaptive run should witness several casebook effects ' + JSON.stringify(r));
    },
    'drag a toll booth from the tray onto the busiest road, forecast, run, and read the result': async ({ page, ok, eq }) => {
      const tgt = await page.evaluate(() => { const C = __gl.C, rd = C.roads.slice().sort((a, b) => C._x[b.id] - C._x[a.id])[0], [x1, y1] = C.pts[rd.a], [x2, y2] = C.pts[rd.b];
        const [sx, sy] = __gl.cam.toScreen((x1 + x2) / 2, (y1 + y2) / 2); const t = document.querySelector('.tok[data-k=toll]').getBoundingClientRect(); return { id: rd.id, sx, sy, tx: t.x + t.width / 2, ty: t.y + t.height / 2 }; });
      await page.mouse.move(tgt.tx, tgt.ty); await page.mouse.down(); await page.mouse.move(tgt.tx + 30, tgt.ty - 30, { steps: 4 }); await page.mouse.move(tgt.sx, tgt.sy, { steps: 12 }); await page.mouse.up();
      eq(await page.evaluate(id => __gl.C.roads[id].toll, tgt.id), 2, 'toll placed by drag');
      await page.click('#runBtn'); ok(await page.isVisible('#fc'), 'forecast opens');
      await page.click('#fcGo');
      ok(await waitFor(page, () => __gl.phase === 'result'), 'month ran'); ok(await page.isVisible('#slip'), 'result slip');
      const txt = await page.textContent('#slip'); ok(/You forecast/.test(txt) && /Month 2/.test(txt), txt);
      await page.click('#sNext'); eq(await page.evaluate(() => __gl.C.month), 2);
    },
    'tap a token then tap a road also places it; picking it up refunds the change': async ({ page, ok, eq }) => {
      const tgt = await page.evaluate(() => { const C = __gl.C, rd = C.roads[3], [x1, y1] = C.pts[rd.a], [x2, y2] = C.pts[rd.b]; const [sx, sy] = __gl.cam.toScreen((x1 + x2) / 2, (y1 + y2) / 2); return { sx, sy, acts: C.acts }; });
      await page.click('.tok[data-k=close]'); await page.mouse.click(tgt.sx, tgt.sy);
      const placed = await page.evaluate(() => __gl.C.roads.filter(r => r.closed).length + __gl.C.roads.filter(r => r.toll).length);
      ok(placed === 1, 'one token on the map');
      eq(await page.evaluate(() => __gl.C.acts), tgt.acts - 1);
      await page.click('#chip button[data-do=undo]'); eq(await page.evaluate(() => __gl.C.acts), tgt.acts, 'refunded');
    },
    'redo month: back to planning in well under 5 s, for one credibility': async ({ page, ok, eq }) => {
      const c0 = await page.evaluate(() => __gl.C.cred);
      await page.evaluate(() => { __gl.run(30); __gl.skipAnim(); });
      ok(await waitFor(page, () => __gl.phase === 'result')); const t0 = Date.now();
      await page.click('#sRedo'); ok(await waitFor(page, () => __gl.phase === 'plan' && __gl.C.month === 1)); ok(Date.now() - t0 < 5000);
      eq(await page.evaluate(() => __gl.C.cred), Math.max(0, c0 - 1));
    },
    'closing the tab on a month\'s result does not let that month be run and booked twice': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __gl.run(30); __gl.skipAnim(); }); ok(await waitFor(page, () => __gl.phase === 'result'));
      const before = await page.evaluate(() => ({ hist: __gl.C.hist.length, treasury: __gl.C.treasury }));
      await page.reload(); await page.waitForFunction(() => window.__gl && __gl.C); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ phase: __gl.phase, month: __gl.C.month, hist: __gl.C.hist.map(h => h.m), run: !document.getElementById('runBtn').disabled }));
      eq(r, { phase: 'plan', month: 2, hist: [1], run: true }, 'reload opens the next month');
      await page.evaluate(() => { __gl.run(30); __gl.skipAnim(); }); ok(await waitFor(page, () => __gl.phase === 'result'));
      eq(await page.evaluate(() => __gl.C.hist.map(h => h.m)), [1, 2], 'each month booked once'); ok(before.hist === 1);
    },
    'restarting the city while a month is still animating leaves a clean, playable month 1 and the map keeps drawing': async ({ page, ok, eq }) => {
      await page.evaluate(() => __gl.run(30)); await page.waitForTimeout(300); ok(await page.evaluate(() => __gl.phase === 'run'), 'animating');
      await page.click('#cityBtn'); await page.click('text=Restart this city'); await page.waitForTimeout(3200);
      eq(await page.evaluate(() => ({ phase: __gl.phase, month: __gl.C.month, hist: __gl.C.hist.length, slip: document.getElementById('slip').classList.contains('on') })), { phase: 'plan', month: 1, hist: 0, slip: false });
      await page.evaluate(() => { __gl.run(30); __gl.skipAnim(); }); ok(await waitFor(page, () => __gl.phase === 'result'), 'the new city runs its month');
    },
    'saves survive: progress reloads; junk, truncated or poisoned saves give a fresh city without errors': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __gl.run(30); __gl.skipAnim(); }); await waitFor(page, () => __gl.phase === 'result');
      await page.evaluate(() => { __gl.nextMonth(); __gl.persist(); });
      await page.reload(); await page.waitForTimeout(500); eq(await page.evaluate(() => __gl.C.month), 2, 'month kept');
      const good = await page.evaluate(() => localStorage.getItem('rh:gridlock'));
      for (const raw of ['{not json', '[1,2,3]', 'null', '"x"', good.slice(0, good.length >> 1), good.replace('"roads":[', '"roads":[{"id":99,"a":-4},'), JSON.stringify({ cases: { braess: 'x', pigou: 3 }, city: '{"v":3,"seed":"z","pts":[]}', runs: -1 })]) {
        await plant(page, raw); const r = await page.evaluate(() => ({ m: __gl.C.month, ok: __gl.C.groups.length > 0, cases: __gl.META.cases }));
        ok(r.m >= 1 && r.ok, 'broken save gave a broken city: ' + raw.slice(0, 40));
      }
      eq(await page.evaluate(() => __gl.META.cases), { pigou: 3 }, 'casebook entries are sanitised');
    },
    'daily city and share links: no hash means today, a #city link loads that city, share text carries the link': async ({ page, ok, eq }) => {
      await page.goto(page.url().replace(/#.*$/, '')); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(500);
      const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      eq(await page.evaluate(() => __gl.C.seed), today);
      await page.evaluate(() => { location.hash = '#city=river-town'; }); await page.waitForTimeout(400);
      eq(await page.evaluate(() => __gl.C.seed), 'river-town');
      const t = await page.evaluate(() => __gl.shareText()); ok(/#city=river-town/.test(t) && /Gridlock/.test(t), t);
    },
    'casebook opens and lists every effect, found or not': async ({ page, ok }) => {
      await page.click('#caseBtn'); const t = await page.textContent('.modal'); ok(/Casebook · \d+ of 10/.test(t), t.slice(0, 80)); ok((await page.$$('.modal .card')).length === 10);
    },
  },
};
