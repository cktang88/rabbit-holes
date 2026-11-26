// Fold (inverse folding): the exact folding machine, commissions and their requirements, design bots, the daily
// generator, saves, sharing and touch input.
const ready = async (page) => { await page.waitForFunction(() => window.__fold && window.__fold.C); await page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove())); };
const reloadWith = async (page, v) => { await page.addInitScript((val) => { try { localStorage.setItem('rh:fold', val); } catch (e) {} }, v); await page.reload(); await ready(page); };
// One working design per commission, found by the lab bots (scratch tools, see the report). Each must pass in the page.
const REFS = require('./fixtures/fold-refs.json');
async function touchSession(page) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); return cdp; }
async function touchDrag(cdp, a, b, steps = 8) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1], id: 1 }] });
  for (let k = 1; k <= steps; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a[0] + (b[0] - a[0]) * k / steps, y: a[1] + (b[1] - a[1]) * k / steps, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
async function touchTap(cdp, a) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1], id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
// in-page helpers: pass (all requirements incl. sturdiness), a competent adaptive designer, fixed strategies
const HELPERS = `(() => { const F = window.__fold;
  const pass = (c, S) => { const e = F.evaluate(c, S); if (!e.ok) return false; return !c.robust || F.robustOf(c, S).frac >= c.robust; };
  const competent = (c, seed) => { let S = F.runGen(F.botGen(c, 'player:' + seed, 700)).S; if (pass(c, S)) return true; if (!c.robust || !F.evaluate(c, S).ok) return false;
    const R = RH.rng('polish' + seed); let best = F.robustOf(c, S).frac; for (let it = 0; it < 40; it++) { const M = S.slice(); M[R.int(c.n)] = R.int(c.types); if (!F.evaluate(c, M).ok) continue; const x = F.robustOf(c, M).frac; if (x >= best) { S = M; best = x; } if (best >= c.robust) return true; } return false; };
  const fixed = (p, n, types) => Array.from({ length: n }, (_, i) => Math.min(types - 1, 'PHKD'.indexOf(p[i % p.length])));
  return { F, pass, competent, fixed }; })()`;
module.exports = {
  page: 'fold/index.html',
  ready,
  tests: {
    'the machine enumerates every fold: counts match the known self-avoiding walk numbers': async ({ page, eq }) => {
      // pinned chain of n beads = (n−1)-step self-avoiding walks on the square lattice: 4, 12, 36, 100, 284, 780, 2172, 5916, 16268, 44100
      const r = await page.evaluate(() => [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => window.__fold.FE.enumerate(n, []).N));
      eq(r, [4, 12, 36, 100, 284, 780, 2172, 5916, 16268, 44100]);
    },
    'the lowest energy it reports is the true minimum (independent brute force over coordinates)': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const { FE, COMMS } = window.__fold, R = RH.rng('bf'), bad = [];
        for (let t = 0; t < 30; t++) { const c = COMMS[t % COMMS.length], n = Math.min(c.n, 8), L = c.lig.A, S = Array.from({ length: n }, () => R.int(4)), pH = ['n', 'acid', 'base'][t % 3];
          const E = FE.enumerate(n, L), a = FE.assess(E, S, pH, L); let best = 1e9; const P = [[0, 0]], used = new Set(['0,0', ...L.map(q => q.x + ',' + q.y)]);
          const rec = () => { if (P.length === n) { best = Math.min(best, FE.energyOf(P, S, pH, L)); return; } const l = P[P.length - 1]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = [l[0] + dx, l[1] + dy], k = q + ''; if (used.has(k)) continue; used.add(k); P.push(q); rec(); P.pop(); used.delete(k); } };
          rec(); if (best !== a.emin || FE.energyOf(FE.coords(E, a.kmin), S, pH, L) !== a.emin) bad.push([t, best, a.emin]); }
        return bad; });
      ok(!bad.length, JSON.stringify(bad));
    },
    'chemistry: oil grips oil, opposite charges grip, acid neutralises D and base neutralises K': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const F = window.__fold, c = (A) => ({ n: 8, types: 4, lig: { A } }), g = (L, s, pH) => F.grip(c(L), s.split('').map(x => 'PHKD'.indexOf(x)), { lig: 'A', pH });
        const oil = [{ x: 1, y: 1, t: 'o' }, { x: 2, y: 1, t: 'o' }], plus = [{ x: 1, y: 1, t: '+' }, { x: 2, y: 1, t: '+' }];
        return { pp: g(oil, 'PPPPPPPP', 'n'), hh: g(oil, 'PHHPPPPP', 'n'), dd: g(plus, 'PDDPPPPP', 'n'), ddAcid: g(plus, 'PDDPPPPP', 'acid'), kk: g(plus, 'PKKPPPPP', 'n'), kkBase: g(plus, 'PKKPPPPP', 'base') }; });
      ok(r.pp < 0.5, 'plain chain grips nothing ' + r.pp); ok(r.hh > 1.2, 'oily beads grip wax ' + r.hh); ok(r.dd > 1.2, 'D grips + ' + r.dd); ok(r.ddAcid < 0.5, 'acid releases ' + r.ddAcid); ok(r.kk < 0, 'K repels + ' + r.kk); ok(Math.abs(r.kkBase - r.pp) < 1e-9, 'base neutralises K');
    },
    'every commission has a working design (incl. sturdiness), and the lab design passes in the page': async ({ page, ok }) => {
      const bad = await page.evaluate(([refs, H]) => { const { F, pass } = eval(H); return F.COMMS.map((c, i) => { const S = refs[i].split('').map(x => 'PHKD'.indexOf(x)); return S.length === c.n && pass(c, S) ? null : i; }).filter(x => x !== null); }, [REFS, HELPERS]);
      ok(!bad.length, 'no working design for ' + bad.join(','));
    },
    'naive play fails: random sequences and fixed patterns; no fixed pattern does every commission': async ({ page, ok }) => {
      const r = await page.evaluate((H) => { const { F, pass, fixed } = eval(H), R = RH.rng('naive'); let rnd = 0, tot = 0; const pats = ['P', 'H', 'HP', 'PH', 'HHP', 'K', 'D', 'HK', 'HD', 'KD', 'PHHP'], wins = {};
        F.COMMS.forEach((c, i) => { if (i >= 7) return; for (let k = 0; k < 12; k++) { tot++; if (pass(c, Array.from({ length: c.n }, () => R.int(c.types)))) rnd++; } });
        for (const p of pats) wins[p] = F.COMMS.filter((c, i) => i < 7 && pass(c, fixed(p, c.n, c.types))).length;
        return { rnd, tot, wins }; }, HELPERS);
      ok(r.rnd / r.tot < 0.12, `random sequences pass ${r.rnd}/${r.tot}`);
      for (const [p, w] of Object.entries(r.wins)) ok(w <= 2, `fixed pattern ${p} passes ${w} of the first 7 commissions`);
    },
    'competent adaptive play (a design bot that reads the assay) passes the first commissions': async ({ page, ok }) => {
      const r = await page.evaluate((H) => { const { F, competent } = eval(H); return [0, 1, 2, 3, 5].map(i => competent(F.COMMS[i], 'c' + i)); }, HELPERS);
      ok(r.every(Boolean), JSON.stringify(r));
    },
    'daily commissions: deterministic per seed, the machine\'s own draft passes, competent play wins, no fixed strategy wins every seed': async ({ page, ok, eq }) => {
      const r = await page.evaluate((H) => { const { F, pass, competent, fixed } = eval(H); const seeds = ['day:2026-11-25', 'day:2026-12-01', 'lab:7', 'lab:99', 'lab:abc'];
        const pats = ['P', 'H', 'HP', 'K', 'D', 'HK', 'HD', 'KD', 'HHKP', 'PHHD'], wins = {}; let comp = 0, mach = 0, same = 0;
        for (const s of seeds) { const c = F.genComm(s), c2 = F.genComm(s); if (JSON.stringify(c) === JSON.stringify(c2)) same++;
          if (pass(c, c.machine.split('').map(x => 'PHKD'.indexOf(x)))) mach++; if (competent(c, s)) comp++;
          for (const p of pats) if (pass(c, fixed(p, c.n, 4))) wins[p] = (wins[p] || 0) + 1; }
        return { n: seeds.length, comp, mach, same, wins, differ: JSON.stringify(F.genComm('lab:1')) !== JSON.stringify(F.genComm('lab:2')) }; }, HELPERS);
      eq(r.same, r.n); ok(r.differ, 'different seeds give different commissions'); eq(r.mach, r.n);
      ok(r.comp >= r.n - 1, `competent bot ${r.comp}/${r.n}`);
      for (const [p, w] of Object.entries(r.wins)) ok(w < r.n, `fixed ${p} wins every seed`);
    },
    'folding replaces the sketch with the machine\'s fold, scores 3 axes and records the best on each axis separately': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const F = window.__fold; F.open('c:0'); 'PHHPHPPP'.split('').forEach((ch, i) => F.paint(i, 'PHKD'.indexOf(ch))); const before = JSON.stringify(F.pos); F.foldNow(true);
        const a = { ok: F.result.ok, moved: JSON.stringify(F.pos) !== before, valid: F.valid(F.pos), rob: F.robust.frac, done: { ...F.SAVE.done['c:0'] } };
        'PHHHHHHH'.split('').forEach((ch, i) => F.paint(i, 'PHKD'.indexOf(ch))); F.foldNow(true); a.done2 = { ...F.SAVE.done['c:0'] }; a.m2 = F.result.f; a.open1 = F.isOpen('c:1'); return a; });
      ok(r.ok); ok(r.moved, 'chain moved to the native fold'); ok(r.valid); ok(r.rob >= 0 && r.rob <= 1);
      eq(r.done.oil, 3); ok(r.done2.oil === 3, 'oil best kept at 3'); ok(r.done2.margin >= r.m2 - .01 && r.done2.margin > r.done.margin, 'margin best rises'); ok(r.open1);
    },
    'sturdiness requirement: a design that grips but breaks under typos fails, and weak beads are known': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const F = window.__fold, c = F.COMMS[7]; const S = 'PHHPHPPPPP'.split('').map(x => 'PHKD'.indexOf(x)); const e = F.evaluate(c, S), rb = F.robustOf(c, S); return { ok: e.ok, frac: rb.frac, weak: rb.weak.filter(x => x).length }; });
      ok(!(r.ok && r.frac >= .7), JSON.stringify(r)); ok(r.weak > 0);
    },
    'saves survive corruption': async ({ page, ok }) => {
      for (const v of ['{', 'null', '[]', '"x"', '{"v":2,"cur":"c:99","done":{"c:0":{"margin":"x","oil":-3}},"drafts":{"c:0":{"seq":"ZZZ","pos":[[0,0]]}},"gen":{"day:x":{"n":99}}}',
        '{"v":2,"cur":"day:2026-01-01","done":{"c:0":{"margin":1,"oil":3,"seq":"PHHPHPPP"}},"drafts":{"c:0":{"seq":"PHHPHPPP","pos":[[0,0],[5,5],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]}},"gen":{"day:2026-01-01":{"n":9,"types":4,"lig":{"A":[{"x":0,"y":0,"t":"o"}]},"req":[]}}}']) {
        await reloadWith(page, v);
        const s = await page.evaluate(() => { const F = window.__fold; return { key: F.key, n: F.pos.length, valid: F.valid(F.pos), cn: F.C.n, done: Object.keys(F.SAVE.done) }; });
        ok(s.valid && s.n === s.cn, 'loads a valid chain after save ' + v.slice(0, 30));
      }
    },
    'share link loads the commission and the design; the hash for a daily opens it': async ({ page, ok, eq }) => {
      await page.goto(page.url().split('#')[0] + '#c=0&s=PHHPHPPP'); await page.reload(); await ready(page);
      eq(await page.evaluate(() => window.__fold.seqStr()), 'PHHPHPPP');
      await page.goto(page.url().split('#')[0] + '#daily=2026-11-25'); await page.reload();
      await page.waitForFunction(() => window.__fold && window.__fold.key === 'day:2026-11-25', null, { timeout: 15000 });
      const r = await page.evaluate(() => ({ req: window.__fold.C.req.length, saved: !!window.__fold.SAVE.gen['day:2026-11-25'] })); ok(r.req >= 2 && r.saved);
    },
    'touch: tap paints, drag bends (N stays pinned), drag from N draws the chain': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.reload(); await ready(page); const cdp = await touchSession(page); await page.waitForTimeout(300);
      const at = (i) => page.evaluate((i) => window.__fold.screenOf(i), i);
      await touchTap(cdp, await at(3)); await page.waitForTimeout(100);
      eq(await page.evaluate(() => window.__fold.seq[3]), 1);
      const p7 = await at(7); await touchDrag(cdp, p7, [p7[0] - 40, p7[1] - 130]); await page.waitForTimeout(100);
      const a = await page.evaluate(() => ({ pos: window.__fold.pos, valid: window.__fold.valid(window.__fold.pos) }));
      ok(a.valid); eq(a.pos[0], [0, 0]); ok(a.pos[7][1] < 0, 'bead 7 pulled up: ' + JSON.stringify(a.pos[7]));
      const p0 = await at(0); await touchDrag(cdp, p0, [p0[0], p0[1] - 120]); await page.waitForTimeout(100);
      const b = await page.evaluate(() => ({ pos: window.__fold.pos, valid: window.__fold.valid(window.__fold.pos) }));
      ok(b.valid); eq(b.pos[0], [0, 0]); eq(b.pos[1], [0, -1]);
    },
    'the FAILS/WORKS stamp belongs to the folded design: editing it or opening another commission takes the stamp off': async ({ page, ok, eq }) => {
      await page.click('#foldBtn'); await page.waitForFunction(() => window.__fold.result && !window.__fold.busy, null, { timeout: 8000 });
      ok(await page.isVisible('#stamp.on'), 'stamped after folding');
      const [sx, sy] = await page.evaluate(() => window.__fold.screenOf(3)); await page.mouse.click(sx, sy); await page.waitForTimeout(150);
      eq(await page.evaluate(() => [window.__fold.result.stale, document.getElementById('stamp').classList.contains('on')]), [true, false], 'edited design is unstamped');
      await page.click('#foldBtn'); await page.waitForFunction(() => window.__fold.result && !window.__fold.result.stale && !window.__fold.busy, null, { timeout: 8000 }); ok(await page.isVisible('#stamp.on'));
      await page.evaluate(() => { window.__fold.SAVE.done['c:0'] = { margin: 0, oil: 0 }; window.__fold.open('c:1'); }); await page.waitForTimeout(100);
      eq(await page.evaluate(() => [window.__fold.key, document.getElementById('stamp').classList.contains('on')]), ['c:1', false], 'a new commission opens unstamped');
    },
    'the Fold button keeps its label while hovered': async ({ page, ok }) => {
      await page.hover('#foldBtn'); const c = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('foldBtn')); return [s.color, s.backgroundColor]; });
      ok(c[0] !== c[1] && !/255, 246, 220/.test(c[1]), 'hovered Fold button colours ' + c.join(' on '));
    },
    'the Fold button runs the machine and the stamp and assay update; folding n=11 takes under 1.5 s here': async ({ page, ok }) => {
      await page.click('#foldBtn'); await page.waitForFunction(() => window.__fold.result && window.__fold.robust && window.__fold.robust.frac != null, null, { timeout: 8000 });
      ok(await page.isVisible('#stamp.on'));
      const ms = await page.evaluate(() => { const F = window.__fold; F.SAVE.done['c:10'] = { margin: 0, oil: 0 }; F.open('c:11'); const t0 = performance.now(); F.evaluate(F.C, F.seq); return performance.now() - t0; });
      ok(ms < 1500, 'first fold of the 11-bead lock took ' + ms.toFixed(0) + ' ms');
    },
  },
};
