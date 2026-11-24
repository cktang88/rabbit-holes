// Gridlock: the traffic model must reach a Wardrop equilibrium (every used route equally fast, no unused route faster),
// match textbook answers (Braess, Pigou), and every city must be solvable but not solved at the start.
const settle = `(() => { let g = 1, i = 0; for (; i < 60000; i++) { g = __gl.adjust(.004); if (g < 1e-4 && i > 300) break; } return __gl.average(); })`;
// apply a plan like ['CD'] (close/build) or ['AT$20'] (toll) to the current city
const apply = `((lv, names) => { __gl.load(lv); const L = __gl.LV[lv], R = __gl.roads();
  for (const nm of names) { const [a, t] = nm.split('$'); const r = R.find(r => r.a + r.b === a); if (!r) throw new Error('no road ' + a); if (t !== undefined) r.toll = +t; else if (r.ghost) r.built = 1; else r.closed = 1; }
  __gl.rebuild(); return (${settle})(); })`;
const SOL = { 0: ['HW'], 1: ['HX', 'XW'], 2: ['CD'], 3: ['NS'], 4: ['HW'], 5: ['PR', 'RW'], 6: ['QN'], 7: ['AT$20'], 8: ['CD$22'], 9: ['QM$15', 'QR$10'], 10: ['AC', 'MW', 'PA$12'] };
// the tempting-but-wrong moves for each city
const WRONG = { 10: ['AC'], 1: ['HX'], 2: ['AC'], 3: ['CS'], 4: ['NS'], 5: ['PR'], 6: ['PM'], 7: ['AT$40'], 8: ['CD$40'], 9: ['QM$40', 'MW$40'] };
const toScreen = async (page, x, y) => page.evaluate(([x, y]) => { const v = __gl.view(); return [(x * v.s + v.ox) / v.dpr, (y * v.s + v.oy) / v.dpr]; }, [x, y]);
// the harness clears localStorage on every navigation, so a test save is planted by an init script that runs after that
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:gridlock', raw), raw); await page.reload(); await page.waitForTimeout(400); };
const waitFor = async (page, fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(100); } return false; };

module.exports = {
  page: 'gridlock/index.html',
  tests: {
    'level data: 11 cities, every road joins two real nodes, every home has a route to work': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => __gl.LV.map((L, i) => { __gl.load(i); const bad = [...L.roads, ...(L.ghosts || [])].filter(r => !L.nodes[r.a] || !L.nodes[r.b] || r.a === r.b).length;
        return { bad, reach: __gl.P().every(ps => ps.length > 0), demand: L.demand.every(d => L.nodes[d.o] && L.nodes[d.d] && d.n > 0), tools: Object.keys(L.tools).length }; }));
      eq(r.length, 11);
      r.forEach((x, i) => { eq(x.bad, 0, 'city ' + i); ok(x.reach, 'city ' + i + ' unreachable at start'); ok(x.demand && x.tools >= 1, 'city ' + i); });
    },
    'Braess network: equilibrium 80 min with the free connector, 65 min without (analytic)': async ({ page, near }) => {
      const r = await page.evaluate(`[${apply}(2, []), ${apply}(2, ['CD'])]`);
      near(r[0], 80, .05, 'with connector'); near(r[1], 65, .05, 'connector closed');
    },
    'Pigou network: equilibrium matches x = (40 - toll)/20 for every toll': async ({ page, near }) => {
      for (const t of [0, 5, 10, 15, 20, 25, 30]) {
        const avg = await page.evaluate(`${apply}(7, ['AT$${t}'])`);
        const x = Math.min(2, (40 - t) / 20), want = (x * 20 * x + (2 - x) * 40) / 2; // x thousand drivers on the street (20x min), the rest on the 40-min highway
        near(avg, want, .06, 'toll ' + t);
      }
    },
    'Rush Hour: a 10+5x street gives 20 min (everyone switches)': async ({ page, near }) => {
      near(await page.evaluate(`${apply}(0, [])`), 30, 1e-6); near(await page.evaluate(`${apply}(0, ['HW'])`), 20, .01);
    },
    'Wardrop condition: on every city, used routes cost the same and no route is cheaper': async ({ page, ok }) => {
      const bad = await page.evaluate(`(() => { const bad = []; for (let lv = 0; lv < __gl.LV.length; lv++) for (const plan of [[], ${JSON.stringify(SOL)}[lv]]) {
        ${apply}(lv, plan); const R = __gl.roads(), t = r => r.t0 + r.k * r.cars / 1000;
        __gl.P().forEach((ps, j) => { const c = ps.map(p => p.e.reduce((a, i) => a + t(R[i]) + R[i].toll, 0)), m = Math.min(...c);
          ps.forEach((p, q) => { if (p.f > 5 && c[q] - m > .05) bad.push([lv, plan.join('+'), j, p.key, c[q] - m]); });
          const tot = ps.reduce((a, p) => a + p.f, 0); if (Math.abs(tot - __gl.LV[lv].demand[j].n) > 1e-6) bad.push([lv, 'flow not conserved', tot]); }); }
        return bad; })()`);
      ok(!bad.length, JSON.stringify(bad.slice(0, 3)));
    },
    'flows are conserved when roads open and close mid-equilibrium': async ({ page, near }) => {
      const r = await page.evaluate(() => { __gl.load(3); for (let i = 0; i < 200; i++) __gl.adjust(.004); const R = __gl.roads(), out = [];
        for (const k of [4, 5, 4, 0, 0]) { R[k].closed = !R[k].closed; __gl.rebuild(); for (let i = 0; i < 50; i++) __gl.adjust(.004); out.push(__gl.P()[0].reduce((a, p) => a + p.f, 0)); } return out; });
      r.forEach(v => near(v, 4000, 1e-6));
    },
    'every city: unsolved at start, known plan wins, tempting plan fails': async ({ page, ok }) => {
      for (let lv = 0; lv < 11; lv++) {
        const [start, sol, wrong, target] = await page.evaluate(`[${apply}(${lv}, []), ${apply}(${lv}, ${JSON.stringify(SOL[lv])}), ${WRONG[lv] ? `${apply}(${lv}, ${JSON.stringify(WRONG[lv])})` : 'Infinity'}, __gl.LV[${lv}].target]`);
        ok(start > target + .3, `city ${lv} solved at start (${start} vs ${target})`);
        ok(sol <= target, `city ${lv} solution ${sol} > ${target}`);
        ok(wrong > target, `city ${lv} wrong plan wins (${wrong})`);
      }
    },
    'build/close cities: brute force finds a solution but most choices fail': async ({ page, ok }) => {
      const r = await page.evaluate(`(() => { const out = []; for (let lv = 0; lv < __gl.LV.length; lv++) { const L = __gl.LV[lv]; if (L.tools.toll) continue;
        __gl.load(lv); const cand = __gl.roads().map((r, i) => [r, i]).filter(([r]) => L.tools.build ? r.ghost : !r.ghost).map(([r]) => r.a + r.b), k = L.tools.build || L.tools.close;
        const combos = [[]]; const rec = (s, c) => { if (c.length) combos.push(c.slice()); if (c.length >= k) return; for (let j = s; j < cand.length; j++) { c.push(cand[j]); rec(j + 1, c); c.pop(); } }; rec(0, []);
        let wins = 0; for (const c of combos) if (${apply}(lv, c) <= L.target) wins++; out.push([lv, wins, combos.length]); } return out; })()`);
      for (const [lv, wins, n] of r) ok(wins >= 1 && wins <= Math.max(1, n / 3), `city ${lv}: ${wins}/${n} plans win`);
    },
    'Congestion Charge: no single toll reaches the target (two are needed)': async ({ page, ok }) => {
      const best = await page.evaluate(`(() => { let best = 1e9; const n = __gl.LV[9].roads.length; for (let i = 0; i < n; i++) for (let t = 0; t <= 40; t += 5) { __gl.load(9); const R = __gl.roads(); R[i].toll = t; __gl.rebuild(); best = Math.min(best, (${settle})()); } return best; })()`);
      ok(best > 29.2, 'single toll reached ' + best);
    },
    'Your City: the trap road alone hurts; grades need the right pair, then a toll; no toll-free plan reaches Masterplan': async ({ page, ok, eq }) => {
      const r = await page.evaluate(`({ base: ${apply}(10, []), trap: ${apply}(10, ['AC']), mw: ${apply}(10, ['MW']), pair: ${apply}(10, ['AC', 'MW']), master: ${apply}(10, ['AC', 'MW', 'PA$12']) })`);
      ok(r.trap > r.base + 2, 'the Skyline Expressway alone should make things worse ' + JSON.stringify(r));
      eq(await page.evaluate(r => [r.base, r.mw, r.pair, r.master].map(a => __gl.gradeOf(10, a)), r), ['Approved', 'Approved', 'Commended', 'Masterplan']);
      ok(r.base > 30, 'sandbox solved at start');
      // every affordable set of proposals, with or without one closure and no tolls, stays short of Masterplan
      const best = await page.evaluate(`(() => { const L = __gl.LV[10], G = L.ghosts, names = G.map(g => g.a + g.b), roads = L.roads.map(r => r.a + r.b); let best = 1e9;
        for (let m = 0; m < 1 << G.length; m++) { let cost = 0; const plan = []; G.forEach((g, j) => { if (m >> j & 1) { cost += g.cost; plan.push(names[j]); } }); if (cost > L.budget) continue;
          for (const cl of [null, ...roads]) best = Math.min(best, ${apply}(10, cl ? [...plan, cl] : plan)); } return best; })()`);
      ok(best > 24.3 && best <= 26.2, 'best toll-free plan ' + best);
    },
    'Your City: the budget is enforced through real clicks, and a better plan re-stamps the file': async ({ page, ok, eq }) => {
      await page.evaluate(() => { localStorage.setItem('rh:gridlock', '{}'); __gl.load(10); });
      const click = async nm => { const [x, y] = await page.evaluate(nm => { const r = __gl.roads().find(r => r.a + r.b === nm), v = __gl.view(); return [(r.lx * v.s + v.ox) / v.dpr, (r.ly * v.s + v.oy) / v.dpr]; }, nm); await page.mouse.click(x, y); };
      await click('AC'); await click('MW'); eq(await page.evaluate(() => __gl.budgetLeft()), 0);
      await click('QB'); eq(await page.evaluate(() => __gl.roads().find(r => r.a + r.b === 'QB').built), 0, 'built over budget');
      ok(await waitFor(page, () => __gl.won, 10000), 'pair did not win'); await page.waitForTimeout(1600);
      eq(await page.evaluate(() => __gl.gradeOf(10, __gl.best[10])), 'Commended');
      await page.evaluate(() => { __gl.roads().find(r => r.a + r.b === 'PA').toll = 12; });
      ok(await waitFor(page, () => __gl.gradeOf(10, __gl.best[10]) === 'Masterplan', 15000), 'toll did not improve the grade');
      eq(await page.evaluate(() => document.getElementById('stamp').textContent), 'Masterplan');
    },
    'a road with no route to work makes the average infinite (multi-home too)': async ({ page, eq }) => {
      const r = await page.evaluate(() => { __gl.load(5); const R = __gl.roads(); R.filter(r => r.a === 'Q').forEach(r => r.closed = 1); __gl.rebuild(); return [__gl.average(), __gl.average(0)]; });
      eq(r[0], null, 'JSON of Infinity'); // JSON.stringify(Infinity) === 'null'
      eq(r[1] > 0 && r[1] < 1e9, true);
    },
    'real clicks: closing the connector wins only after drivers settle, and saves': async ({ page, ok, eq, near }) => {
      await page.evaluate(() => __gl.load(2)); await page.waitForTimeout(300);
      const [x, y] = await toScreen(page, 500, 260); await page.mouse.click(x, y);
      ok(await page.evaluate(() => __gl.roads().find(r => r.a + r.b === 'CD').closed), 'click did not close CD');
      await page.waitForTimeout(250); ok(!(await page.evaluate(() => __gl.won)), 'won before the traffic settled');
      ok(await waitFor(page, () => __gl.won), 'never won');
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:gridlock')).done), { 2: 1 });
      near(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).gridlock), 1 / 11, 1e-9);
    },
    'toll slider held on the answer does not win until released': async ({ page, ok }) => {
      await page.evaluate(() => __gl.load(7)); await page.waitForTimeout(300);
      const [x, y] = await toScreen(page, 320, 450); await page.mouse.click(x, y);
      ok(await page.evaluate(() => __gl.sel >= 0), 'road not selected');
      const b = await page.locator('#tollR').boundingBox();
      await page.mouse.move(b.x + 8, b.y + b.height / 2); await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
      const v = await page.evaluate(() => __gl.roads().find(r => r.a + r.b === 'AT').toll); ok(v >= 16 && v <= 24, 'slider gave toll ' + v);
      await page.waitForTimeout(3500); ok(!(await page.evaluate(() => __gl.won)), 'won while the slider was still held');
      await page.mouse.up(); ok(await waitFor(page, () => __gl.won), 'did not win after release');
    },
    'sweeping the toll slider across the answer and on to $40 does not win': async ({ page, ok }) => {
      await page.evaluate(() => __gl.load(7)); await page.waitForTimeout(300);
      const [x, y] = await toScreen(page, 320, 450); await page.mouse.click(x, y);
      const b = await page.locator('#tollR').boundingBox();
      await page.mouse.move(b.x + 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 30 }); await page.mouse.up();
      await page.waitForTimeout(3000); ok(!(await page.evaluate(() => __gl.won)), 'won after sweeping past');
    },
    'locked cities cannot be opened; Next appears only after a win': async ({ page, eq, ok }) => {
      await page.evaluate(() => document.querySelector('.lv[data-i="5"]').click()); await page.waitForTimeout(100);
      eq(await page.evaluate(() => __gl.LV.indexOf(__gl.LV.find(L => L.n === document.getElementById('title').textContent))), 0, 'locked city opened');
      ok(!(await page.locator('#next').isVisible()), 'next visible before win');
      await page.evaluate(() => { const r = __gl.roads().find(r => r.a + r.b === 'HW'); r.built = 1; __gl.rebuild(); });
      ok(await waitFor(page, () => __gl.won)); await page.locator('#next').click();
      eq(await page.evaluate(() => document.getElementById('title').textContent), 'Detour');
      ok(!(await page.locator('#next').isVisible()), 'next still visible on the new city');
    },
    'saves: corrupted, out-of-range and v1 saves load safely': async ({ page, eq }) => {
      const r = await page.evaluate(() => [null, 5, 'x', [], { done: null, cur: 'a' }, { done: { 0: 1, 99: 1, x: 1 }, cur: 42 }, { done: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, cur: 4 }, { done: { 0: 1, 1: 1, 2: 1, 3: 1 }, cur: 3 }, { v: 2, done: { 3: 1 }, cur: 3 }].map(__gl.cleanSave));
      eq(r.slice(0, 5).map(s => [s.done, s.cur]), Array(5).fill([{}, 0]));
      eq(r[5], { v: 2, done: { 0: 1 }, cur: 0, best: {} });
      eq(r[6], { v: 2, done: { 0: 1, 1: 1, 2: 1, 3: 1 }, cur: 3, best: {} }, 'v1 Ring Road (old 4) moves to 3');
      eq(r[7], { v: 2, done: { 0: 1, 1: 1, 2: 1 }, cur: 2, best: {} }, 'v1 Cheonggyecheon is dropped');
      eq(r[8].cur, 3);
      for (const bad of ['{not json', '"str"', '{"done":7,"cur":-1}']) {
        await plant(page, bad);
        eq(await page.evaluate(() => document.getElementById('title').textContent), 'Rush Hour', bad);
        eq(await page.evaluate(() => document.querySelectorAll('.lv.lock').length), 10, 'locks after ' + bad);
      }
    },
    'progress: replaying a solved city never lowers it, and it never exceeds 1': async ({ page, ok, eq }) => {
      await plant(page, JSON.stringify({ v: 2, done: Object.fromEntries([...Array(11).keys()].map(i => [i, 1])), cur: 10 }));
      eq(await page.evaluate(() => document.getElementById('title').textContent), 'Your City', 'resumes the saved city');
      await page.evaluate(() => __gl.load(0)); eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).gridlock), 1);
      await page.evaluate(() => { const r = __gl.roads().find(r => r.a + r.b === 'HW'); r.built = 1; __gl.rebuild(); }); ok(await waitFor(page, () => __gl.won));
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).gridlock), 1);
    },
    'no console errors at phone size; switching all cities leaves no stale toll panel': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (let i = 0; i < 11; i++) { await page.evaluate(i => __gl.load(i), i); await page.waitForTimeout(80); ok(!(await page.locator('#toll').isVisible()), 'toll panel left open on ' + i); }
    },
  },
};
