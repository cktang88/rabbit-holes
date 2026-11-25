// Canal Mania (lock-flight): seeded countries, the water book, lock water rules, planners beat naive and random bots,
// commissions favour different answers, shares, daily maps, pan/zoom input, the section editor, saves.
const ready = async page => { await page.waitForFunction(() => window.__lf && __lf.M && __lf.an); await page.waitForTimeout(150); };
async function reopen(page, url) { const p = await page.context().newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(url || page.url()); await ready(p); p.errs = errs; return p; }
const COM = id => `__lf.COMS.find(c => c.id === '${id}')`;
// drag the mouse through a list of screen points
async function drag(page, pts) { await page.mouse.move(...pts[0]); await page.mouse.down(); for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 6; k++) await page.mouse.move(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / 6, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / 6); await page.mouse.up(); }
module.exports = {
  page: 'lock-flight/index.html',
  ready,
  tests: {
    'countries are seeded: the same spec builds the same map, different seeds differ, the daily seed is the date': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const K = __lf.K, h = M => K.hashStr(Array.from(M.h, v => v.toFixed(4)).join(',') + M.towns.map(t => t.c + t.name).join()); 
        const a = K.genMap(K.randomSpec(42)), b = K.genMap(K.randomSpec(42)), c = K.genMap(K.randomSpec(43));
        return { same: h(a) === h(b), diff: h(a) !== h(c), towns: a.towns.length, specSame: JSON.stringify(K.randomSpec(7)) === JSON.stringify(K.randomSpec(7)) }; });
      ok(r.same && r.specSame, 'same seed, same country'); ok(r.diff, 'different seed, different country'); ok(r.towns >= 3, 'towns placed');
    },
    'the water book balances: every lockful, stream, seep, spill, reservoir and pump is accounted for': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __lf.K, out = [];
        for (const seed of [3, 5, 9]) { const M = K.genMap(K.randomSpec(seed)), P = K.plan(M, { top: 4, tries: 3 });
          for (const D of [P.best.D, K.naiveDesign(M), ((D) => { D = K.clone(D); for (const k of Object.keys(K.analyse(M, K.clone(D)).sites.map(s => s.key).reduce((o, k2) => (o[k2] = 1, o), {}))) D.locks[k] = { pump: 1, ponds: 1 }; return D; })(P.best.D)]) {
            const an = K.analyse(M, K.clone(D)), st = K.newState(an), tot = () => st.S.reduce((a, b) => a + b, 0) + st.RV.reduce((a, b) => a + b, 0), t0 = tot(); let worst = 0;
            for (let m = 0; m < 120; m++) { K.stepMonth(an, st); worst = Math.max(worst, Math.abs(tot() - t0 - (st.wIn - st.wOut))); } out.push(worst); } }
        return out; });
      ok(r.every(x => x < 1e-6), 'drift ' + r.map(x => x.toExponential(1)).join(' '));
    },
    'lock water rules: a flight passes one lockful per boat whatever its rise, a staircase (n+1)/2, a plane none, side ponds save a third': async ({ page, near, eq }) => {
      const r = await page.evaluate(() => { const K = __lf.K, M = K.genMap({ seed: 1, relief: .5, towns: [[2, 5, 3], [20, 5, 3]] }), p = []; for (let x = 2; x <= 20; x++) p.push(K.idx(x, 5));
        const mk = (rise, cfg) => { const D = K.newDesign(); D.paths.push(p.slice()); p.forEach((c, i) => D.lv[c] = i < 9 ? 1 : 1 + rise); if (cfg) D.locks[K.ekey(p[8], p[9])] = cfg; return K.analyse(M, D).sites[0]; };
        return { f1: mk(1).w, f4: mk(4).w, s3: mk(3, { t: 'stair' }).w, s4: mk(4, { t: 'stair' }).w, pl: mk(4, { t: 'plane' }).w, fp: mk(2, { ponds: 1 }).w, sp: mk(3, { t: 'stair', ponds: 1 }).w, n: mk(3).n,
          capStair: mk(3, { t: 'stair' }).cap, capFlight: mk(3).cap, capDbl: mk(3, { dbl: 1 }).cap }; });
      eq([r.f1, r.f4, r.n], [1, 1, 3]); near(r.s3, 2, 1e-9); near(r.s4, 2.5, 1e-9); eq(r.pl, 0); near(r.fp, 2 / 3, 1e-9); near(r.sp, 4 / 3, 1e-9);
      eq(r.capStair < r.capFlight, true, 'staircases pass fewer boats'); eq(r.capDbl, r.capFlight * 2, 'doubling doubles capacity');
    },
    'an unfed summit runs dry and stops the boats; a dam on a stream above it keeps them moving': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __lf.K, c = __lf.COMS.find(c => c.id === 'ridge'), M = K.genMap(c.spec), P = K.plan(M), best = K.simulate(M, P.best.D), nv = K.simulate(M, K.naiveDesign(M));
        const noRes = K.clone(P.best.D); noRes.res = []; const dry = K.simulate(M, noRes);
        return { nvW: nv.lostW, nvBoats: nv.boats, bestW: best.lostW, bestBoats: best.boats, res: P.best.D.res.length, dryW: dry.lostW, dryDiv: dry.dividend, bestDiv: best.dividend, sites: best.an.sites.length }; });
      ok(r.nvW > r.nvBoats, `straight over the top: ${Math.round(r.nvW)} boats turned away vs ${Math.round(r.nvBoats)} carried`);
      ok(r.res >= 1 && r.sites >= 2, 'the planner climbs with locks and dams a stream');
      ok(r.bestW < r.bestBoats * .05, 'with the reservoir the summit holds'); ok(r.dryW > r.bestW * 3 + 50 && r.dryDiv < r.bestDiv, 'take the reservoir away and it runs dry');
    },
    'every commission: the straight-line bot and random diggers lose; the planner pays a dividend at or above par': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __lf.K, out = [];
        for (const c of __lf.COMS.filter(c => c.spec)) { const M = K.genMap(c.spec), P = K.plan(M), f = P.field.map(x => x.dividend).filter(v => v > -999).sort((a, b) => a - b), par = f[f.length >> 1];
          const nv = K.simulate(M, K.naiveDesign(M)); const rnd = K.rng(7); let rndWins = 0, rndN = 0;
          for (let k = 0; k < 12; k++) { // a random digger: wanders from each town towards the next, levels follow the ground
            const D = K.newDesign(); for (const [a, b] of K.townTree(M)) { let cur = M.towns[b].c; const path = [cur], goal = new Set([M.towns[a].c, ...D.paths.flat()]);
              for (let s = 0; s < 200 && !goal.has(cur); s++) { const [x, y] = K.xy(cur), [gx, gy] = K.xy(M.towns[a].c); const dx = rnd() < .6 ? Math.sign(gx - x) : (rnd() * 3 | 0) - 1, dy = rnd() < .6 ? Math.sign(gy - y) : (rnd() * 3 | 0) - 1; const nx = Math.max(0, Math.min(K.W - 1, x + dx)), ny = Math.max(0, Math.min(K.H - 1, y + dy)), n = K.idx(nx, ny); if (n === cur) continue; const j = path.indexOf(n); if (j >= 0) path.length = j + 1; else path.push(n); cur = n; }
              if (goal.has(cur)) K.addPath(M, D, path); }
            const s = K.simulate(M, D); rndN++; if (s.ok && s.dividend >= par) rndWins++; }
          out.push({ id: c.id, best: P.best.dividend, par, naive: nv.ok ? nv.dividend : -999, rndWins, rndN }); }
        return out; });
      for (const x of r) {
        ok(x.best > 0 && x.best >= x.par, `${x.id}: planner ${Math.round(x.best)} vs par ${Math.round(x.par)}`);
        if (x.id !== 'first') ok(x.naive < x.par && x.naive < x.best - 60, `${x.id}: the straight line (${Math.round(x.naive)}) must not reach par (${Math.round(x.par)})`);
        if (x.id !== 'first') ok(x.rndWins <= 1, `${x.id}: ${x.rndWins}/${x.rndN} random canals reached par`);
      }
    },
    'no single answer: the best canal tunnels on one commission, climbs with reservoirs on another, holds a level round on a third': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __lf.K, cls = {}; for (const c of __lf.COMS.filter(c => c.spec && c.id !== 'first')) { const M = K.genMap(c.spec), b = K.simulate(M, K.plan(M).best.D), cells = [...b.an.cells.values()];
          cls[c.id] = { tun: cells.filter(o => o.k === 'tunnel').length, rises: b.an.sites.reduce((a, s) => a + s.n, 0), res: b.an.res.length }; } return cls; });
      ok(r.tunnel.tun >= 3, 'Through the Hill is won underground: ' + JSON.stringify(r.tunnel));
      ok(r.ridge.res >= 1 && r.ridge.rises >= 2 && r.ridge.tun === 0, 'Over the Top is won by climbing with a reservoir: ' + JSON.stringify(r.ridge));
      ok(r.round.tun === 0 && r.round.rises <= 1, 'The Long Way Round is won on the level: ' + JSON.stringify(r.round));
    },
    'shares are deterministic: a design round-trips, simulates identically, and a link opens it': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const K = __lf.K, c = __lf.COMS.find(c => c.id === 'junction'), M = K.genMap(c.spec), D = K.plan(M).best.D, code = K.enc(D), back = K.dec(code);
        return { code, same: K.enc(back) === code, a: K.simulate(M, D).dividend, b: K.simulate(M, back).dividend, bad: [K.dec('!!'), K.dec('zz~q.0'), K.dec(12)].every(x => x === null || (x && x.paths.length === 0)) }; });
      ok(r.same, 'round trip'); eq(r.a, r.b, 'same dividend'); ok(r.bad, 'junk codes are refused');
      const p = await reopen(page, page.url().split('#')[0] + '#c=junction&d=' + r.code);
      const q = await p.evaluate(() => ({ id: __lf.COMS.find(c => __lf.M.spec === c.spec)?.id, code: __lf.K.enc(__lf.D) }));
      eq(q, { id: 'junction', code: r.code }); ok(!p.errs.length, p.errs[0]); await p.close();
    },
    'daily and free countries: deterministic, and every one of 8 seeds has a canal that pays': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __lf.K, out = []; for (let s = 1; s <= 8; s++) { const M = K.genMap(K.goodSpec(20260000 + s * 37)), P = K.plan(M, { top: 4, tries: 3 }); out.push(Math.round(P.best.dividend)); } return out; });
      ok(r.every(v => v > 0), 'best dividends ' + r.join(', '));
    },
    'first minute: drag from Ashby to Wexford with the mouse, open the canal, run ten years, get a dividend': async ({ page, ok, eq }) => {
      await page.evaluate(() => __lf.load(0)); await page.waitForTimeout(200);
      const [a, b] = await page.evaluate(() => [__lf.screenOf(__lf.M.towns[0].c), __lf.screenOf(__lf.M.towns[1].c)]);
      await drag(page, [a, b]); await page.waitForTimeout(200);
      const s = await page.evaluate(() => ({ joined: __lf.K.connected(__lf.an), fore: __lf.fore.dividend, sel: __lf.sel, prof: document.getElementById('prof').classList.contains('on') }));
      ok(s.joined, 'towns joined by a mouse drag'); ok(s.fore > 0, 'a positive prospectus: ' + s.fore); ok(s.prof && s.sel === 0, 'the section opens on the new cut');
      await page.click('#tOpen'); eq(await page.evaluate(() => __lf.mode), 'run');
      await page.click('#tSkip'); await page.waitForTimeout(2200);
      eq(await page.evaluate(() => __lf.mode), 'done'); ok(await page.$('.modal'), 'the dividend card'); ok(await page.evaluate(() => __lf.SAVE.done.first >= 1), 'stars saved');
    },
    'pan and zoom: wheel zooms; digging while zoomed lands under the pointer; a two-finger pinch digs nothing': async ({ page, ok, eq }) => {
      await page.evaluate(() => __lf.load(0)); await page.waitForTimeout(200);
      const k0 = await page.evaluate(() => __lf.cam.k); const [ax, ay] = await page.evaluate(() => __lf.screenOf(__lf.M.towns[0].c));
      await page.mouse.move(ax + 40, ay); for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -240); await page.waitForTimeout(100);
      const k1 = await page.evaluate(() => __lf.cam.k); ok(k1 > k0 * 1.5, `zoomed in ${k0.toFixed(1)} → ${k1.toFixed(1)}`);
      const [sx, sy] = await page.evaluate(() => __lf.screenOf(__lf.M.towns[0].c)); const tgt = await page.evaluate(([x, y]) => { const [wx, wy] = __lf.toW(x, y); return __lf.K.idx(Math.floor(wx), Math.floor(wy)); }, [sx + 120, sy]);
      await drag(page, [[sx, sy], [sx + 120, sy]]); await page.waitForTimeout(100);
      const p = await page.evaluate(() => __lf.D.paths[0]); eq(p[0], await page.evaluate(() => __lf.M.towns[0].c), 'starts at the town'); eq(p[p.length - 1], tgt, 'ends under the pointer');
      await page.evaluate(() => __lf.cam.fit()); await page.waitForTimeout(50); const [sx2, sy2] = await page.evaluate(() => __lf.screenOf(__lf.M.towns[0].c));
      const n0 = await page.evaluate(() => __lf.D.paths.length), k2 = await page.evaluate(() => __lf.cam.k);
      await page.evaluate(([x, y]) => { const el = document.getElementById('cv'), ev = (t, id, cx) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: cx, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
        ev('pointerdown', 1, x); ev('pointerdown', 2, x + 40); for (let i = 1; i <= 5; i++) { ev('pointermove', 1, x - i * 10); ev('pointermove', 2, x + 40 + i * 10); } ev('pointerup', 1, x - 50); ev('pointerup', 2, x + 90); }, [sx2, sy2]);
      await page.waitForTimeout(100);
      eq(await page.evaluate(() => __lf.D.paths.length), n0, 'a pinch that starts on a town digs nothing'); ok(await page.evaluate(() => __lf.cam.k) > k2 * 1.3, 'and it zooms');
    },
    'section editor: drag a pound up a rise, sideways to hold a level; tap a lock to make it a staircase; undo': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const K = __lf.K, M = __lf.M; __lf.load(1); const D = K.naiveDesign(__lf.M); __lf.D = D; }); await page.waitForTimeout(100);
      await page.evaluate(() => { document.getElementById('prof').classList.add('on'); }); await page.evaluate(() => __lf.load && null);
      await page.evaluate(() => { const c = __lf.D.paths[0][2]; const [x, y] = __lf.screenOf(c); const el = document.getElementById('cv'); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: x, clientY: y, bubbles: true, button: 0, pointerType: 'mouse' })); el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: x, clientY: y, bubbles: true, button: 0, pointerType: 'mouse' })); });
      await page.waitForTimeout(300);
      eq(await page.evaluate(() => __lf.sel), 0, 'tapping the canal selects it');
      const i = 3, before = await page.evaluate(i => __lf.D.lv[__lf.D.paths[0][i]], i);
      const [px, py] = await page.evaluate(i => __lf.profX(i), i);
      await drag(page, [[px, py], [px, py - 60]]); await page.waitForTimeout(150);
      const after = await page.evaluate(i => __lf.D.lv[__lf.D.paths[0][i]], i); ok(after > before, `dragged up ${before} → ${after}`);
      const [hx, hy] = await page.evaluate(() => __lf.profX(1)), [hx2] = await page.evaluate(() => __lf.profX(12));
      await drag(page, [[hx, hy], [hx2, hy]]); await page.waitForTimeout(150);
      const flat = await page.evaluate(() => { const p = __lf.D.paths[0]; return new Set(p.slice(1, 13).map(c => __lf.D.lv[c])).size; }); eq(flat, 1, 'held at one level');
      const key = await page.evaluate(() => __lf.an.sites[0] && __lf.an.sites[0].key);
      if (key) { await page.evaluate(k => { const s = __lf.an.sites.find(z => z.key === k), [x1, y1] = __lf.screenOf(s.a), [x2, y2] = __lf.screenOf(s.b), x = (x1 + x2) / 2, y = (y1 + y2) / 2, el = document.getElementById('cv');
          el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, clientX: x, clientY: y, bubbles: true, button: 0, pointerType: 'mouse' })); el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, clientX: x, clientY: y, bubbles: true, button: 0, pointerType: 'mouse' })); }, key);
        ok(await page.$eval('#insp', e => getComputedStyle(e).display !== 'none'), 'lock card opens'); await page.click('#insp [data-t=stair]'); eq(await page.evaluate(k => __lf.D.locks[k].t, key), 'stair'); }
      const h = await page.evaluate(() => JSON.stringify(__lf.D)); await page.click('#tUndo'); ok(await page.evaluate(() => JSON.stringify(__lf.D)) !== h, 'undo');
    },
    'tall phone: the map turns a quarter to fill the screen, and a finger drag still digs from town to town': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.evaluate(() => __lf.load(0)); await page.waitForTimeout(300);
      ok(await page.evaluate(() => __lf.ROT), 'rotated on a tall phone');
      const r = await page.evaluate(() => { const a = __lf.screenOf(__lf.M.towns[0].c), b = __lf.screenOf(__lf.M.towns[1].c); return { a, b, span: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
      ok(r.span > 300, `towns ${Math.round(r.span)} px apart on a 390 px screen`);
      await drag(page, [r.a, r.b]); await page.waitForTimeout(150);
      ok(await page.evaluate(() => __lf.K.connected(__lf.an)), 'joined by a drag on the rotated map');
    },
    'corrupted saves never crash the page': async ({ page, ok }) => {
      for (const v of ['null', '7', '[]', '{"v":2,"done":null,"designs":{"first":"!!~~"},"cur":99}', '{"v":2,"designs":{"ridge":"AAAA.zz"},"cur":1}', '{bad']) {
        await page.evaluate(v => { localStorage.clear(); localStorage.setItem('rh:lock-flight', v); }, v);
        const p = await reopen(page); ok(!p.errs.length, `save ${v}: ${p.errs[0]}`); ok(await p.evaluate(() => !!__lf.an)); await p.close();
      }
    },
  },
};
