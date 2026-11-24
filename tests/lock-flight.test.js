// Lock Flight: hydraulics (conservation, alternation, staircases, side ponds), keeper policies, level data, saves and UI.
const ready = async page => { await page.waitForFunction(() => window.__lock && __lock.state().basins.length); };
async function reopen(page) { const p = await page.context().newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(page.url()); await ready(p); p.errs = errs; return p; }
// run a level with the keeper on, returning summary + max drift of the conserved total
const RUN = `((i, policy, setup, opts) => { const L = __lock; L.load(i, opts || {}); L.keeper(true, policy); if (setup) setup(L); const t0 = L.state().total; let s, dev = 0;
  const lim = (L.LV[i].time || 2600) + 10; for (let t = 0; t < lim; t += 5) { s = L.tick(5); dev = Math.max(dev, Math.abs(s.total - t0)); if (s.state !== 'play') break; }
  return { state: s.state, wpb: s.wpb, del: s.delivered, stars: s.stars, dev, flood: s.ledger.flood }; })`;

module.exports = {
  page: 'lock-flight/index.html',
  ready,
  tests: {
    'every level is winnable with the right policy, water is conserved, and idling never wins': async ({ page, ok }) => {
      const r = await page.evaluate(`(() => { const run = ${RUN}, L = __lock, out = [];
        const pol = { 6: 'BATCH', 8: 'FIFO', 12: 'BATCH', 15: 'PAIR', 16: 'BATCH', 17: 'BATCH' };
        for (let i = 0; i < L.LV.length; i++) {
          let res;
          if (i === 13 || i === 14) { // leaks: send the crew; storm: open flood paddles while it rains
            L.load(i); L.keeper(true, 'ALT'); const t0 = L.state().total; let s, dev = 0;
            for (let t = 0; t < L.LV[i].time + 10; t += 5) { s = L.tick(5); dev = Math.max(dev, Math.abs(s.total - t0));
              if (i === 13) { const lk = s.gates.find(g => g && g.leak > 0); if (lk) L.fix(lk.i); }
              else s.basins.forEach(b => { if (b.kind === 'pound') L.floodWeir(b.i, s.T > 110 && s.T < 290); });
              if (s.state !== 'play') break; }
            res = { state: s.state, dev };
          } else res = run(i, pol[i] || 'ALT', L2 => { if (i === 12) L2.set({ plane: 1 }); if (i === 16 || i === 17) L2.state().basins.forEach(b => b.kind === 'ch' && L2.ponds(b.i, 1)); if (i === 7) L2.policy(2, 'BATCH'); if (i === 8) L2.ponds(1, true); if (i === 10) L2.set({ pump: 1 }); if (i === 11) L2.set({ res: 1 }); });
          L.load(i); const idle = L.tick(L.LV[i].time ? L.LV[i].time + 5 : 1500);
          out.push({ i, ...res, idle: idle.state, idleWon: idle.state === 'won' || idle.state === 'endless' });
        } return out; })()`);
      for (const x of r) {
        ok(x.state === 'won' || x.state === 'endless', `level ${x.i + 1} not winnable: ${x.state}`);
        ok(x.dev < 1e-6, `level ${x.i + 1} water not conserved: drift ${x.dev}`);
        ok(!x.idleWon, `level ${x.i + 1} wins with nobody touching it`);
      }
    },
    'alternating directions halves the water per boat on a single lock': async ({ page, ok, near }) => {
      const r = await page.evaluate(`(() => { const run = ${RUN};
        const same = run(1, 'FIFO', L => L.schedule([1, 2, 3, 4].map(t => ({ t, d: 1 }))), { A: 60 });
        const alt = run(1, 'ALT', L => L.schedule([1, 2, 3, 4].map(t => ({ t, d: t % 2 ? 1 : -1 }))), { A: 60 });
        return { same, alt }; })()`);
      ok(r.same.wpb > .9 && r.same.wpb < 1.1, 'same direction ≈ 1 lockful/boat: ' + r.same.wpb);
      near(r.alt.wpb / r.same.wpb, .5, .05, 'alternation ratio');
    },
    'a staircase wants convoys: BATCH beats ALT on Bingley, and the AHA charts tell the truth': async ({ page, ok, near }) => {
      const r = await page.evaluate(`(() => { const run = ${RUN}, L = __lock, off = L2 => L2.state().basins.forEach(b => b.kind === 'ch' && L2.ponds(b.i, 0));
        return { 5: [run(5, 'FIFO'), run(5, 'ALT')], 6: [run(6, 'ALT'), run(6, 'BATCH')], 7: [run(7, 'ALT'), run(7, 'ALT', L2 => L2.policy(2, 'BATCH'))],
          8: [run(8, 'FIFO', L2 => L2.ponds(1, 0)), run(8, 'FIFO', L2 => L2.ponds(1, 1))], 16: [run(16, 'BATCH', off), run(16, 'BATCH', L2 => L2.state().basins.forEach(b => b.kind === 'ch' && L2.ponds(b.i, 1)))],
          4: [run(4, 'FIFO'), run(4, 'ALT')], 9: [run(9, 'BATCH'), run(9, 'ALT')], 15: [run(15, 'FIFO'), run(15, 'PAIR')] }; })()`);
      const AHA = { 5: [[.60, 1], [.39]], 6: [[3.27, 1], [1.18]], 7: [[1.30], [1.16]], 8: [[.54], [.45]], 16: [[1.36, 1], [.62]], 4: [[.53], [.41]], 9: [[.84, 1], [.65]], 15: [[1.21, 1], [.99]] };
      for (const k in AHA) AHA[k].forEach(([w, dry], j) => { const m = r[k][j]; near(m.wpb, w, .03, `level ${+k + 1} chart row ${j}`); ok(dry ? m.state === 'lost' : m.state === 'won', `level ${+k + 1} row ${j} state ${m.state}`); });
      ok(r[6][1].wpb < r[6][0].wpb / 2, 'BATCH should more than halve staircase water');
    },
    'policy is a real decision on The Lock-Keeper, Caen Hill and Wide Locks (the default loses or drops a star)': async ({ page, ok, eq }) => {
      const r = await page.evaluate(`(() => { const run = ${RUN}, L = __lock, dflt = i => { L.load(i); return L.state().units[0].policy; };
        return { d4: dflt(4), d9: dflt(9), d15: dflt(15), f4: run(4, 'FIFO'), a4: run(4, 'ALT'), b9: run(9, 'BATCH'), a9: run(9, 'ALT'), f15: run(15, 'FIFO'), p15: run(15, 'PAIR') }; })()`);
      eq([r.d4, r.d9, r.d15], ['FIFO', 'BATCH', 'FIFO'], 'defaults');
      ok(r.f4.state === 'won' && r.f4.stars < 3 && r.a4.stars === 3, 'Lock-Keeper: ALT must earn the water star FIFO misses');
      eq(r.b9.state, 'lost', 'Caen Hill on BATCH should run dry'); eq(r.a9.stars, 3);
      eq(r.f15.state, 'lost', 'Wide Locks on FIFO should run dry'); eq(r.p15.stars, 3);
    },
    'difficulty: naive play fails on the last third, the right plan wins, and a simple ALT-everything plan rarely earns 3 stars': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const L = __lock, st = s => (s.state === 'won' || s.state === 'endless') ? s.stars : 0;
        const run = (i, keeper, setup, each) => { L.load(i); if (keeper) L.keeper(true); if (setup) setup(); let s; const lim = (L.LV[i].time || 2600) + 10;
          for (let t = 0; t < lim; t += 5) { s = L.tick(5); if (each) each(s); if (s.state !== 'play') break; } return st(s); };
        const pondsOn = () => L.state().basins.forEach(b => b.kind === 'ch' && L.ponds(b.i, 1)), allPol = p => L.state().units.forEach((u, k) => L.policy(k, p));
        const crew = s => { const lk = s.gates.find(g => g && g.leak > 0); if (lk) L.fix(lk.i); }, flood = s => s.basins.forEach(b => { if (b.kind === 'pound') L.floodWeir(b.i, s.T > 110 && s.T < 290); });
        const comp = { 12: [() => { allPol('ALT'); L.set({ plane: 1 }); }], 13: [() => allPol('ALT'), crew], 14: [() => allPol('ALT'), flood], 15: [() => allPol('PAIR')], 16: [() => { allPol('BATCH'); pondsOn(); }], 17: [() => { allPol('BATCH'); pondsOn(); }] };
        let naive = 0, runs = 0, simple3 = 0; const competent = [];
        for (let i = 12; i < 18; i++) { const rnd = RH.rng(i);
          const bots = [run(i, false), run(i, true), ...[0, 1, 2].map(() => run(i, true, () => L.state().units.forEach((u, k) => L.policy(k, ['FIFO', 'ALT', 'BATCH'][rnd() * 3 | 0]))))];
          for (const b of bots) { runs++; if (b <= 1) naive++; }
          if (run(i, true, () => { allPol('ALT'); pondsOn(); L.set({ pump: 1, res: 1, plane: 1 }); }, crew) === 3) simple3++;
          competent.push(run(i, true, comp[i][0], comp[i][1])); }
        return { naive, runs, simple3, competent }; });
      ok(r.naive / r.runs >= .8, `naive bots (idle, keeper as found, random policies) got 2★+ in ${r.runs - r.naive}/${r.runs} late runs`);
      ok(r.competent.every(s => s >= 2), 'competent plan: ' + r.competent); ok(r.competent.filter(s => s === 3).length >= 4, '3★ reachable: ' + r.competent);
      ok(r.simple3 <= 2, `ALT everywhere + every gadget on earns 3★ on ${r.simple3}/6`);
    },
    'flights: tapping one policy label sets every lock on the hill': async ({ page, eq }) => {
      await page.evaluate(() => { __lock.load(9); __lock.keeper(true); }); const p = await page.evaluate(() => __lock.unitPos(3));
      await page.mouse.click(p[0], p[1]); eq(await page.evaluate(() => [...new Set(__lock.state().units.map(u => u.policy))]), ['FIFO']);
    },
    'side ponds catch water: a pond is filled on draining and empties on refilling': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const L = __lock; L.load(8); L.ponds(1, true); L.tick(1);
        L.fill(1); L.tick(40); const full = L.state(); L.drain(1); L.tick(40); const drained = L.state(); L.fill(1); L.tick(40); const refill = L.state();
        return { lvl: full.basins[1].level, hi: full.basins[2].level, pondAfterDrain: drained.basins[1].ponds[0], pondAfterFill: refill.basins[1].ponds[0], drawFill1: full.ledger.draw, drawFill2: refill.ledger.draw - drained.ledger.draw }; });
      ok(Math.abs(r.lvl - r.hi) < .05, 'chamber filled level with the summit');
      ok(r.pondAfterDrain > .2, 'pond holds water after draining: ' + r.pondAfterDrain);
      ok(r.pondAfterFill < r.pondAfterDrain * .2, 'pond gives it back');
      ok(r.drawFill2 < r.drawFill1 * .8, `second fill should draw less from the summit: ${r.drawFill2} vs ${r.drawFill1}`);
    },
    'gates refuse to open across a head of water, and a boat can be worked through level 1 by real taps': async ({ page, ok, eq }) => {
      await page.evaluate(() => __lock.load(0));
      eq(await page.evaluate(() => __lock.gate(1)), false, 'top gate opened with the chamber empty');
      // follow the on-screen hint with the mouse until the boat is delivered
      for (let n = 0; n < 12; n++) {
        await page.evaluate(() => __lock.tick(.5));
        const h = await page.evaluate(() => { const h = __lock.hint(); return h && { ...h, p: __lock.scr(h.x, h.kind === 'gate' ? h.z - 1.4 : h.z - .9) }; });
        if (await page.evaluate(() => __lock.state().state) === 'won') break;
        if (!h) { await page.evaluate(() => __lock.tick(4)); continue; }
        await page.mouse.click(h.p[0], h.p[1]);
        await page.evaluate(() => __lock.tick(12));
      }
      const s = await page.evaluate(() => __lock.state());
      eq(s.state, 'won', 'state'); eq(s.delivered, 1); ok(s.wpb > .8 && s.wpb < 1.2, 'one lockful ' + s.wpb);
    },
    'dead time between boats runs fast, but never through weather or with a boat on the water': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const L = __lock; L.load(1); L.keeper(true, 'ALT'); const busy = L.quiet(); let s; for (let k = 0; k < 200; k++) { s = L.tick(1); if (s.delivered >= 2 && !s.boats.length) break; } return { busy, quiet: L.quiet(), T: s.T }; });
      eq(r.busy, false, 'warping at the start with boats arriving'); eq(r.quiet, true, 'gap before boat 3 not detected');
      const T0 = await page.evaluate(() => __lock.state().T); await page.waitForTimeout(1000); const T1 = await page.evaluate(() => __lock.state().T);
      ok(T1 - T0 > 3, 'idle gap ran at only ' + (T1 - T0) + ' s per real second');
      // storm level: the storm event is pending, so no skipping ahead into it
      eq(await page.evaluate(() => { const L = __lock; L.load(14); L.schedule([{ t: 400, d: 1 }]); L.tick(1); return L.quiet(); }), false);
    },
    'policy labels cycle on tap and the keeper button toggles': async ({ page, eq }) => {
      await page.evaluate(() => __lock.load(5));
      const p = await page.evaluate(() => __lock.unitPos(0)); const seen = [];
      for (let k = 0; k < 3; k++) { await page.mouse.click(p[0], p[1]); seen.push(await page.evaluate(() => __lock.state().units[0].policy)); }
      eq(seen, ['ALT', 'BATCH', 'FIFO']);
    },
    'corrupted saves never crash the page and progress stays in [0,1]': async ({ page, ok }) => {
      for (const v of ['null', '3', '"x"', '[]', '{"done":null,"photos":7,"cur":-4}', '{"done":{"0":3,"99":3,"x":1},"cur":"zz"}', '{bad']) {
        await page.evaluate(v => { localStorage.clear(); localStorage.setItem('rh:lock-flight', v); }, v);
        const p = await reopen(page); await p.waitForTimeout(200);
        const r = await p.evaluate(() => ({ s: __lock.state().state, hub: JSON.parse(localStorage.getItem('rh:hub') || '{}')['lock-flight'], n: document.querySelectorAll('#levels .lv').length }));
        ok(!p.errs.length, `save ${v}: ${p.errs[0]}`); ok(r.s === 'play', 'state'); ok(r.n === 18, 'level list'); ok(r.hub == null || (r.hub >= 0 && r.hub <= 1), 'progress ' + r.hub);
        await p.close();
      }
    },
    'progress: winning unlocks the next canal; replaying never lowers stars or progress': async ({ page, ok, eq }) => {
      const r = await page.evaluate(`(() => { const run = ${RUN}, hub = () => JSON.parse(localStorage.getItem('rh:hub') || '{}')['lock-flight'] || 0, lock = i => document.querySelector('#levels .lv[data-i="' + i + '"]').classList.contains('lock');
        __lock.load(0); const l1 = lock(1); run(0, 'ALT'); const h1 = hub(), l1b = lock(1); __lock.load(0); __lock.tick(200); const h2 = hub(); const st = JSON.parse(localStorage.getItem('rh:lock-flight')).done[0];
        return { l1, h1, l1b, h2, st, l3: lock(3) }; })()`);
      ok(r.l1, 'level 2 locked at start'); ok(!r.l1b, 'level 2 unlocked after win'); ok(r.l3, 'level 4 still locked');
      ok(r.h1 > 0 && r.h1 <= 1); eq(r.h2, r.h1, 'losing a replay changed progress'); eq(r.st, 3);
    },
    'no stale win card: switching level right after a win never shows the old result': async ({ page, eq }) => {
      await page.evaluate(`(${RUN})(0, 'ALT')`);
      await page.evaluate(() => __lock.load(1)); await page.waitForTimeout(1300);
      eq(await page.$$eval('.modal-bg', m => m.length), 0);
    },
    'phone and desktop layouts: canvas fits, HUD and tools on screen, no errors': async ({ page, ok }) => {
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h }); await page.evaluate(() => __lock.load(9)); await page.waitForTimeout(400);
        const r = await page.evaluate(() => { const rect = id => document.getElementById(id).getBoundingClientRect(); return { hud: rect('hud'), tools: rect('tools'), sw: document.documentElement.scrollWidth }; });
        ok(r.sw <= w, 'horizontal scroll at ' + w); ok(r.tools.right <= w + 1 && r.tools.bottom <= h + 1 && r.tools.left >= -1, 'tools off-screen at ' + w);
        ok(r.hud.right <= w + 1, 'hud off-screen at ' + w);
      }
    },
  },
};
