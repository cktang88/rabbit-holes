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
      const r = await page.evaluate(() => __gl.LV.slice(0, __gl.GI).map((L, i) => { __gl.load(i); const bad = [...L.roads, ...(L.ghosts || [])].filter(r => !L.nodes[r.a] || !L.nodes[r.b] || r.a === r.b).length;
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
      const bad = await page.evaluate(`(() => { const bad = []; for (let lv = 0; lv < __gl.GI; lv++) for (const plan of [[], ${JSON.stringify(SOL)}[lv]]) {
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
      const r = await page.evaluate(`(() => { const out = []; for (let lv = 0; lv < __gl.GI; lv++) { const L = __gl.LV[lv]; if (L.tools.toll || L.budget) continue;
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
      ok(best > 24 && best <= 26.2, 'best toll-free plan ' + best);
    },
    'Two Suburbs: the best average and the fairest plan are different stamps; Zero Sum needs a road and a toll for the top': async ({ page, eq, ok }) => {
      const r = await page.evaluate(`(() => { const g = plan => { ${apply}(5, plan); return [__gl.average(), __gl.worstHome()]; };
        const fast = g(['PR', 'RW']), fair = g(['PR', 'RW', 'PM']);
        return { fast, fair, gFast: __gl.gradeOf(5, ...fast), gFair: __gl.gradeOf(5, ...fair), z1: __gl.gradeOf(6, ${apply}(6, ['QN'])), z2: __gl.gradeOf(6, ${apply}(6, ['QN', 'QM$5'])) }; })()`);
      ok(r.fast[0] < r.fair[0] && r.fair[1] < r.fast[1], 'fast plan should beat the fair one on average and lose on the worst suburb ' + JSON.stringify(r));
      eq([r.gFast, r.gFair, r.z1, r.z2], ['Commended', 'Masterplan', 'Commended', 'Masterplan']);
    },
    'Your City: the budget is enforced through real clicks, and a better plan re-stamps the file': async ({ page, ok, eq }) => {
      await page.evaluate(() => { localStorage.setItem('rh:gridlock', '{}'); __gl.load(10); });
      const click = async nm => { const [x, y] = await page.evaluate(nm => { const r = __gl.roads().find(r => r.a + r.b === nm), v = __gl.view(); return [(r.lx * v.s + v.ox) / v.dpr, (r.ly * v.s + v.oy) / v.dpr]; }, nm); await page.mouse.click(x, y); };
      await click('AC'); await page.locator('#fcSkip').click(); await click('MW'); eq(await page.evaluate(() => __gl.budgetLeft()), 0);
      await click('QB'); eq(await page.evaluate(() => __gl.roads().find(r => r.a + r.b === 'QB').built), 0, 'built over budget');
      ok(await waitFor(page, () => __gl.won, 10000), 'pair did not win'); await page.waitForTimeout(1600);
      eq(await page.evaluate(() => __gl.gradeOf(10, __gl.best[10])), 'Commended');
      await page.evaluate(() => { __gl.roads().find(r => r.a + r.b === 'PA').toll = 12; });
      ok(await waitFor(page, () => __gl.gradeOf(10, __gl.best[10]) === 'Masterplan', 15000), 'toll did not improve the grade');
      eq(await page.evaluate(() => document.getElementById('stamp').textContent), 'Masterplan');
    },
    'difficulty: naive play fails the late cities; a competent search wins; Masterplan needs a solver-level plan': async ({ page, ok }) => {
      const r = await page.evaluate(`(() => {
        const settle = ${settle};
        // stars: 0 = over target, then one per grade reached
        const stars = (lv, a) => { const L = __gl.LV[lv]; if (!(a <= L.target + 1e-6)) return 0; return L.grades ? L.grades.filter(([m]) => a <= m + 1e-6).length : 1; };
        const evalPlan = (lv, plan) => { __gl.load(lv); const R = __gl.roads(); for (const a of plan) { const r = R[a.i]; if (a.toll != null) r.toll = a.toll; else if (r.ghost) r.built = 1; else r.closed = 1; } __gl.rebuild(); return settle(); };
        // every single action a player could take on a city (tolls at a coarse $10 grid)
        const actions = (lv, plan) => { const L = __gl.LV[lv], R = __gl.roads(), out = [], used = new Set(plan.map(a => a.i));
          const spent = plan.reduce((s, a) => s + (R[a.i].ghost ? R[a.i].cost || 1 : 0), 0), closes = plan.filter(a => !R[a.i].ghost && a.toll == null).length, tolls = plan.filter(a => a.toll != null).length;
          R.forEach((r, i) => { if (used.has(i)) return;
            if (r.ghost && L.tools.build && (L.budget ? spent + (r.cost || 0) <= L.budget : plan.filter(a => R[a.i].ghost).length < L.tools.build)) out.push({ i });
            if (!r.ghost && L.tools.close && closes < L.tools.close) out.push({ i });
            if (!r.ghost && L.tools.toll && tolls < L.tools.toll) for (const t of [10, 20, 30]) out.push({ i, toll: t }); });
          return out; };
        let seed = 1; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
        const late = [7, 8, 9, 10], res = { naive: [], comp: {}, solver: {} };
        for (const lv of late) {
          const L = __gl.LV[lv];
          // idle
          res.naive.push(stars(lv, evalPlan(lv, [])));
          // the obvious move: price (or build) the most visible thing; tolls at a round $20 on the busiest roads
          __gl.load(lv); for (let i = 0; i < 300; i++) __gl.adjust(.004); const R = __gl.roads();
          const busy = R.map((r, i) => [r.ghost ? -1 : r.cars * (r.k || 0), i]).sort((a, b) => b[0] - a[0]);
          let obvious = []; if (L.tools.build) { let left = L.budget || 1e9; R.forEach((r, i) => { if (r.ghost && (r.cost || 0) <= left && obvious.length < (L.tools.build || 0)) { obvious.push({ i }); left -= r.cost || 0; } }); }
          if (L.tools.toll) for (let j = 0; j < L.tools.toll; j++) obvious.push({ i: busy[j][1], toll: 20 });
          res.naive.push(stars(lv, evalPlan(lv, obvious)));
          // random players
          for (let k = 0; k < 4; k++) { const plan = []; for (let n = 0; n < 4; n++) { const A = actions(lv, plan); if (!A.length || rnd() < .25) break; const a = A[Math.floor(rnd() * A.length)]; if (a.toll != null) a.toll = Math.round(rnd() * 40); plan.push(a); } res.naive.push(stars(lv, evalPlan(lv, plan))); }
          // competent: greedy search, one best single action at a time on the coarse grid
          let plan = [], best = evalPlan(lv, []);
          for (;;) { let pick = null; for (const a of actions(lv, plan)) { const v = evalPlan(lv, [...plan, a]); if (v < best - 1e-3) { best = v; pick = a; } } if (!pick) break; plan.push(pick); }
          res.comp[lv] = stars(lv, best);
        }
        // solver-level plans (fine toll grid, found offline): Masterplan is reachable
        res.solver[9] = stars(9, evalPlan(9, [{ i: 2, toll: 12 }, { i: 6, toll: 12 }]));
        const names = __gl.LV[10].roads.map(r => r.a + r.b).concat(__gl.LV[10].ghosts.map(r => r.a + r.b));
        res.solver[10] = stars(10, evalPlan(10, [{ i: names.indexOf('AC') }, { i: names.indexOf('MW') }, { i: names.indexOf('PA'), toll: 12 }]));
        return res; })()`);
      const low = r.naive.filter(s => s <= 1).length / r.naive.length;
      ok(low >= .8, `naive play got 2+ stars too often: ${JSON.stringify(r.naive)}`);
      for (const lv of [7, 8, 9, 10]) ok(r.comp[lv] >= 1, `competent search failed city ${lv}: ${JSON.stringify(r.comp)}`);
      ok(r.comp[9] < 3 && r.comp[10] < 3, `the simple search should not reach Masterplan on the last two cities: ${JSON.stringify(r.comp)}`);
      ok(r.solver[9] === 3 && r.solver[10] === 3, `solver plans should reach Masterplan: ${JSON.stringify(r.solver)}`);
    },
    'days: drivers re-planning each morning from yesterday\'s times settle on the Wardrop equilibrium (Braess: 80, then 65)': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => { const day = rate => { let g = 1, n = 0; for (; n < 2000 && !(g < 1e-4 && n > 20); n++) g = __gl.adjust(rate); return [__gl.average(), n]; };
        __gl.load(2); const open = day(.1); const R = __gl.roads(); R.find(r => r.a + r.b === 'CD').closed = 1; __gl.rebuild(); const shut = day(.1); __gl.load(2); const slow = day(.04); return { open, shut, slow }; });
      near(r.open[0], 80, .05); near(r.shut[0], 65, .05); near(r.slow[0], 80, .05); ok(r.slow[1] > r.open[1], 'cautious drivers should take more days to settle');
      // the live game: the day counter runs and the city settles on screen
      await page.evaluate(() => __gl.load(0)); await page.waitForTimeout(2500); ok(await page.evaluate(() => __gl.DAY.n > 5 && __gl.DAY.gap < .05), 'days did not run or settle');
      ok((await page.locator('#dayTxt').textContent()).includes('settled'), 'settled text');
    },
    'routes: tapping a suburb shows the routes its drivers choose between, with times and shares': async ({ page, ok }) => {
      await page.evaluate(() => __gl.load(2)); await page.waitForTimeout(2500);
      const [x, y] = await toScreen(page, 130, 330); await page.mouse.click(x, y);
      const t = await page.locator('#routes').textContent(); ok(/Home/.test(t) && /via C/.test(t) && /%/.test(t), t);
    },
    'camera: wheel zooms about the cursor, a drag on open ground pans, Fit restores the whole map': async ({ page, ok, eq }) => {
      await page.evaluate(() => __gl.load(0)); await page.waitForTimeout(300);
      await page.mouse.move(640, 600); await page.mouse.wheel(0, -400); await page.waitForTimeout(100);
      ok(await page.evaluate(() => __gl.cam.z > 1.3), 'wheel did not zoom');
      const before = await page.evaluate(() => [__gl.cam.x, __gl.cam.y]); await page.mouse.move(640, 700); await page.mouse.down(); await page.mouse.move(540, 650, { steps: 5 }); await page.mouse.up();
      const after = await page.evaluate(() => [__gl.cam.x, __gl.cam.y]); ok(Math.abs(after[0] - before[0]) > 50, 'drag did not pan');
      await page.locator('#fitBtn').click(); eq(await page.evaluate(() => [__gl.cam.z, __gl.cam.user]), [1, false]);
    },
    'growing city: the same seed grows the same city; another seed grows a different one': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const G = __gl.grow, run = seed => { G.init(seed); G.headless = true; for (let m = 0; m < 6; m++) G.month(); G.headless = false; return JSON.stringify([__gl.LV[__gl.GI].nodes, __gl.LV[__gl.GI].demand]); };
        return [run('alpha'), run('alpha'), run('beta')]; });
      eq(r[0], r[1]); ok(r[0] !== r[2], 'different seeds grew the same city');
    },
    'growing city: idle and random play gridlock within months; connecting suburbs by joining roads holds far longer': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const G = __gl.grow, S = G.GROW, N = () => __gl.LV[__gl.GI].nodes, Dm = () => __gl.LV[__gl.GI].demand;
        const reach = (from, to) => { const seen = new Set([from]), q = [from]; while (q.length) { const n = q.pop(); if (n === to) return true; for (const r of __gl.roads()) if (r.a === n && !seen.has(r.b)) { seen.add(r.b); q.push(r.b); } } return false; };
        const connect = o => { const [x, y] = N()[o], to = Dm().find(d => d.o === o).d, c = [];
          for (const [n, [nx, ny, k]] of Object.entries(N())) if (n !== o && k !== 'home' && reach(n, to)) c.push([Math.hypot(nx - x, ny - y), () => G.build(o, n, 'street')]);
          __gl.roads().forEach((r, i) => { if (r.a === o || !reach(r.b, to)) return; const mx = (N()[r.a][0] + N()[r.b][0]) / 2, my = (N()[r.a][1] + N()[r.b][1]) / 2; c.push([Math.hypot(mx - x, my - y) + 5, () => G.split(o, i, 'street')]); });
          c.sort((a, b) => a[0] - b[0]); for (const [, f] of c.slice(0, 6)) if (!f()) return; };
        const play = (seed, policy) => { G.init(seed); let s = 9; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647; G.headless = true;
          while (!S.over && S.month < 40) { policy(rnd); G.settle(); G.headless = true; G.month(); } G.headless = false; return S.month; };
        const idle = () => {}, random = rnd => { const ks = Object.keys(N()); for (let t = 0; t < 3; t++) G.build(ks[Math.floor(rnd() * ks.length)], ks[Math.floor(rnd() * ks.length)], 'street'); };
        const joiner = () => __gl.P().forEach((ps, j) => { if (!ps.length) connect(Dm()[j].o); });
        return ['a1', 'b2'].map(seed => [play(seed, idle), play(seed, random), play(seed, joiner)]); });
      for (const [idle, random, joiner] of r) { ok(idle <= 6 && random <= 8, 'naive play lasted too long ' + JSON.stringify(r)); ok(joiner >= 2 * Math.max(idle, random), 'connecting play should last much longer ' + JSON.stringify(r)); }
    },
    'growing city: drag from a suburb onto a road joins it; the run, its seed and best score are saved and shareable': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __gl.grow.init('share1'); __gl.grow.GROW.speed = 0; }); await page.waitForTimeout(400);
      eq(await page.evaluate(() => location.hash), '#grow=share1');
      // the first two suburbs come connected; a third is added and connected by a real drag onto the nearest road
      await page.evaluate(() => { __gl.grow.headless = true; __gl.grow.month(); __gl.grow.headless = false; });
      const [ax, ay, bx, by] = await page.evaluate(() => { const L = __gl.LV[__gl.GI], o = L.demand[2].o, v = __gl.view(), r = __gl.roads()[0], [x, y] = L.nodes[o], mx = (L.nodes[r.a][0] + L.nodes[r.b][0]) / 2, my = (L.nodes[r.a][1] + L.nodes[r.b][1]) / 2;
        return [(x * v.s + v.ox) / v.dpr, (y * v.s + v.oy) / v.dpr, (mx * v.s + v.ox) / v.dpr, (my * v.s + v.oy) / v.dpr]; });
      await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(200);
      ok(await page.evaluate(() => __gl.P()[2].length > 0 && Object.keys(__gl.LV[__gl.GI].nodes).some(k => /^J/.test(k))), 'drag onto a road did not connect the suburb by a junction');
      await page.evaluate(() => { const G = __gl.grow; G.headless = true; while (!G.GROW.over) G.month(); G.headless = false; });
      ok(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:gridlock')).growBest.share1 >= 1), 'best not saved');
      await page.goto(page.url().replace(/#.*/, '') + '#grow=share2'); await page.reload(); await page.waitForTimeout(800);
      eq(await page.evaluate(() => [__gl.grow.GROW.seed, document.getElementById('title').textContent]), ['share2', 'Growing City']);
    },
    'a road with no route to work makes the average infinite (multi-home too)': async ({ page, eq }) => {
      const r = await page.evaluate(() => { __gl.load(5); const R = __gl.roads(); R.filter(r => r.a === 'Q').forEach(r => r.closed = 1); __gl.rebuild(); return [__gl.average(), __gl.average(0)]; });
      eq(r[0], null, 'JSON of Infinity'); // JSON.stringify(Infinity) === 'null'
      eq(r[1] > 0 && r[1] < 1e9, true);
    },
    'real clicks: closing the connector wins only after drivers settle, and saves': async ({ page, ok, eq, near }) => {
      await page.evaluate(() => __gl.load(2)); await page.waitForTimeout(300);
      const [x, y] = await page.evaluate(() => { const r = __gl.roads().find(r => r.a + r.b === 'CD'), v = __gl.view(); return [(r.lx * v.s + v.ox) / v.dpr, (r.ly * v.s + v.oy) / v.dpr]; }); await page.mouse.click(x, y);
      ok(await page.evaluate(() => __gl.roads().find(r => r.a + r.b === 'CD').closed), 'click did not close CD');
      ok(await page.locator('#fc').isVisible(), 'no forecast prompt'); await page.waitForTimeout(600);
      ok(await page.evaluate(() => !__gl.won && __gl.fc.pending), 'drivers moved before the forecast');
      await page.locator('#fcIn').fill('65'); await page.locator('#fcGo').click();
      await page.waitForTimeout(250); ok(!(await page.evaluate(() => __gl.won)), 'won before the traffic settled');
      ok(await waitFor(page, () => __gl.won), 'never won');
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:gridlock')).done), { 2: 1 });
      ok(await waitFor(page, () => __gl.forecasts[2] === 1), 'a good forecast is not recorded');
      ok((await page.locator('#fcRes').textContent()).includes('good call'), 'forecast result');
      near(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).gridlock), 1 / 12, 1e-9);
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
      eq(r[5], { v: 2, done: { 0: 1 }, cur: 0, best: {}, grade: {}, fc: {}, growBest: {} });
      eq(r[6], { v: 2, done: { 0: 1, 1: 1, 2: 1, 3: 1 }, cur: 3, best: {}, grade: {}, fc: {}, growBest: {} }, 'v1 Ring Road (old 4) moves to 3');
      eq(r[7], { v: 2, done: { 0: 1, 1: 1, 2: 1 }, cur: 2, best: {}, grade: {}, fc: {}, growBest: {} }, 'v1 Cheonggyecheon is dropped');
      eq(r[8].cur, 3);
      for (const bad of ['{not json', '"str"', '{"done":7,"cur":-1}']) {
        await plant(page, bad);
        eq(await page.evaluate(() => document.getElementById('title').textContent), 'Rush Hour', bad);
        eq(await page.evaluate(() => document.querySelectorAll('.lv.lock').length), 11, 'locks after ' + bad);
      }
    },
    'progress: replaying a solved city never lowers it, and it never exceeds 1': async ({ page, ok, eq }) => {
      await plant(page, JSON.stringify({ v: 2, done: Object.fromEntries([...Array(12).keys()].map(i => [i, 1])), cur: 10 }));
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
