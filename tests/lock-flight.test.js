// Canal Mania (lock-flight): seeded countries, the water book, lock water rules, planners beat naive and random bots,
// commissions favour different answers, shares, daily maps, pan/zoom input, the section editor, saves; and The Canal Age:
// bots over seventy years, replay from the log, rivals, railways and offers, the first minute and the phone.
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
    'each commission\'s brief, done literally, pays a dividend (so no level is a wall)': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const K = __lf.K, BRIEF = eval('(' + src + ')'), out = [];
        for (const c of __lf.COMS.filter(c => c.spec)) { const M = K.genMap(c.spec), D = BRIEF[c.id](K, M), s = K.simulate(M, D); out.push({ id: c.id, div: Math.round(s.dividend), ok: s.ok, res: D.res.length }); } return out; }, "{\n  // what each commission's brief tells the player to do, done literally\n  first: (K, M) => { const D = K.newDesign(), a = M.towns[0].c, b = M.towns[1].c; K.addPath(M, D, [a, ...K.lineCells(a, b)]); return D; },\n  ridge: (K, M) => { // over the saddle; drag the summit pound down until a stream lies above it; dam that stream\n    const a = M.towns[0].c, b = M.towns[1].c, D = K.newDesign(); K.addPath(M, D, K.routeGrid(M, a, new Set([b]), 1.5, 1, Math.max(M.h[a], M.h[b])));\n    for (let k = 0; k < 6; k++) { const an = K.analyse(M, K.clone(D)), top = an.pounds.reduce((p, q) => q.lv > p.lv ? q : p), rc = K.bestReservoir(M, an, top.id); if (rc >= 0) { D.res.push(rc); break; } for (const c of top.cells) D.lv[c] = top.lv - 1; K.prune(D); }\n    return D; },\n  tunnel: (K, M) => { const D = K.newDesign(), a = M.towns[0].c, b = M.towns[1].c, p = [a, ...K.lineCells(a, b)]; K.addPath(M, D, p); p.forEach(c => D.lv[c] = D.lv[a]); K.prune(D); return D; },\n  round: (K, M) => { const D = K.newDesign(), a = M.towns[0].c, b = M.towns[1].c; const p = K.routeGrid(M, a, new Set([b]), 0, 8, Math.max(M.h[a], M.h[b])); K.addPath(M, D, p); p.forEach(c => D.lv[c] = D.lv[a]); K.prune(D); return D; },\n  dry: (K, M) => { // climb the ridge, bank water in a reservoir, side ponds on the summit locks\n    const a = M.towns[0].c, b = M.towns[1].c, D = K.newDesign(); K.addPath(M, D, K.routeGrid(M, a, new Set([b]), 1.5, 1, Math.max(M.h[a], M.h[b])));\n    for (let k = 0; k < 6; k++) { const an = K.analyse(M, K.clone(D)), top = an.pounds.reduce((p, q) => q.lv > p.lv ? q : p), rc = K.bestReservoir(M, an, top.id); if (rc >= 0) { D.res.push(rc); for (const s of top.down) D.locks[s.key] = { ponds: 1 }; break; } for (const c of top.cells) D.lv[c] = top.lv - 1; K.prune(D); }\n    return D; },\n  junction: (K, M) => { // a branching network that holds its level through the ridge; double the busiest lock\n    const D = K.planDesign(M, { al: 0, be: 0, lam: 20, stair: 0 }), r = K.simulate(M, D); let best = null, bl = -1;\n    for (const s of r.an.sites) { const l = s.routes.reduce((a, ri) => a + r.months[100].flows[ri], 0); if (l > bl) { bl = l; best = s; } }\n    if (best) D.locks[best.key] = { dbl: 1 }; return D; },\n}\n");
      for (const x of r) ok(x.ok && x.div > 0, `${x.id}: the brief's own recipe made ${x.div}`);
      ok(r.find(x => x.id === 'ridge').res === 1, 'Over the Top: lowering the summit brings a stream above it to dam');
    },
    'no single answer: the best canal tunnels on one commission, climbs with reservoirs on another, holds a level round on a third': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __lf.K, cls = {}; for (const c of __lf.COMS.filter(c => c.spec && c.id !== 'first')) { const M = K.genMap(c.spec), b = K.simulate(M, K.plan(M).best.D), cells = [...b.an.cells.values()];
          cls[c.id] = { tun: cells.filter(o => o.k === 'tunnel').length, rises: b.an.sites.reduce((a, s) => a + s.n, 0), res: b.an.res.length }; } return cls; });
      ok(r.tunnel.tun >= 3, 'Through the Hill is won underground: ' + JSON.stringify(r.tunnel));
      ok(r.ridge.res >= 1 && r.ridge.rises >= 2 && r.ridge.tun === 0, 'Over the Top is won by climbing with a reservoir: ' + JSON.stringify(r.ridge));
      ok(r.round.tun === 0 && r.round.rises <= 1, 'The Long Way Round is won on the level: ' + JSON.stringify(r.round));
    },
    'the result card agrees with itself: a bust is never "the best canal stock", and the counts read right': async ({ page, ok }) => {
      await page.evaluate(() => { __lf.load(1); __lf.D = __lf.K.naiveDesign(__lf.M); __lf.open(); __lf.skip(); }); await page.waitForTimeout(2300);
      const t = await page.$eval('.modal', e => e.textContent);
      ok(/bust/.test(t), 'a bust is called a bust'); ok(!/best canal stock|handsome/.test(t), 'no boasting on a bust: ' + t.slice(0, 200)); ok(!/\b1 months\b/.test(t), 'plural');
      ok(!/\b0k tons\b/.test(t), 'cargo reads in tons');
      const bg = await page.$eval('.modal .modal-actions', e => getComputedStyle(e).backgroundColor); ok(!/rgb\(1[0-9], 2[0-9], 3[0-9]\)/.test(bg), 'no dark block behind the buttons: ' + bg);
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
    // ================= The Canal Age (age.js): the long game =================
    'Canal Age bots: drawing the shortest line and waiting fails badly; the best day-one design loses to an engineer who keeps building; no single strategy wins every map': async ({ ok }) => {
      const A = require(require('path').join(__dirname, '../lock-flight/age.js')), L = { naive: A.naive, staticPlan: A.staticPlan, ...A.STRATS }, wins = {}, rows = [];
      for (const s of [1, 2, 3, 4, 5, 6]) { const v = {}; for (const [nm, cfg] of Object.entries(L)) v[nm] = A.score(A.play(s, cfg));
        const best = Object.keys(v).reduce((a, b) => v[a] >= v[b] ? a : b); wins[best] = (wins[best] || 0) + 1; rows.push(s + ': ' + Object.entries(v).map(([k, x]) => k + ' ' + x).join(', '));
        ok(v.naive < .35 * v.adaptive, `map ${s}: the straight line should fail badly: ${rows.at(-1)}`);
        ok(v.staticPlan < v.adaptive, `map ${s}: a perfect-at-start canal should lose to one that keeps building: ${rows.at(-1)}`); }
      ok(Object.keys(wins).length >= 2, 'one strategy won every map: ' + JSON.stringify(wins) + '\n' + rows.join('\n'));
    },
    'Canal Age model: the water book still balances in a seventy-year run, a game replays exactly from its log, and rewinding keeps the past': async ({ ok, eq, near }) => {
      const A = require(require('path').join(__dirname, '../lock-flight/age.js')), K = require(require('path').join(__dirname, '../lock-flight/core.js'));
      const G = A.newGame(5), h = A.firstHint(G); ok(h, 'a first canal is suggested');
      ok(A.act(G, { k: 'build', d: K.enc(A.branch(G, G.places[h.i].c, [G.places[h.j].c])) }), 'the first canal is affordable');
      const st = G.st, tot = () => st.S.reduce((a, b) => a + b, 0) + st.RV.reduce((a, b) => a + b, 0), t0 = tot(), w0 = st.wIn - st.wOut; let worst = 0;
      for (let m = 0; m < 240; m++) { A.step(G); if (G.st !== st || G.an.pounds.length !== st.S.length) break; worst = Math.max(worst, Math.abs(tot() - t0 - (st.wIn - st.wOut - w0))); }
      ok(worst < 1e-6, 'water drift ' + worst);
      const s0 = G.D.paths.length && K.analyse(G.M, K.clone(G.D)).sites[0]; if (s0) A.act(G, { k: 'mode', key: s0.key, v: 'pair' });
      for (let m = 0; m < 300; m++) A.step(G);
      const nc = Object.keys(G.D.lv).map(Number), far = G.places.findIndex((p, i) => !G.an.cells.has(G.M.towns[i].c)); if (far >= 0) { const D2 = A.branch(G, G.places[far].c, nc); if (D2) A.act(G, { k: 'build', d: K.enc(D2) }); }
      for (let m = 0; m < 100; m++) A.step(G);
      const code = A.encLog(G.log), R = A.replay(5, A.decLog(code), G.m);
      eq([R.m, R.places.length, R.D.paths.length], [G.m, G.places.length, G.D.paths.length], 'replayed game shape'); near(R.cash, G.cash, 1e-6, 'replayed bank');
      const back = A.replay(5, G.log.filter(a => a.m < 300), 300); eq(back.m, 300); ok(back.log.every(a => a.m < 300), 'rewound log holds only the past');
    },
    'Canal Age pressure: a rival is refused if you join its towns first; railways take trade from slow canals; the railway\'s offer ends the game at its price': async ({ ok }) => {
      const A = require(require('path').join(__dirname, '../lock-flight/age.js')), K = require(require('path').join(__dirname, '../lock-flight/core.js'));
      // play the engineer to the first rival petition, then compare joining the two places against ignoring them
      const G = A.newGame(4); let pet = null; while (!G.over && !pet) { A.bot(G, A.STRATS.trunk); A.step(G); pet = G.rivals.find(v => !v.open && !v.gone); }
      ok(pet, 'a rival petitions'); const save = A.encLog(G.log);
      const ignore = A.replay(4, A.decLog(save), G.m); let G2 = ignore; while (G2.m < pet.at + 2) { A.bot(G2, A.STRATS.trunk); A.step(G2); }
      ok(G2.rivals.some(v => v.open), 'ignored, the rival canal opens');
      const join = A.replay(4, A.decLog(save), G.m), nc = Object.keys(join.D.lv).map(Number);
      for (const i of [pet.i, pet.j]) if (!join.an.cells.has(join.M.towns[i].c)) { const D2 = A.branch(join, join.places[i].c, Object.keys(join.D.lv).map(Number)); if (D2) { join.cash += 1000; A.act(join, { k: 'build', d: K.enc(D2) }); } }
      while (join.m < pet.at + 2) A.step(join);
      ok(join.rivals.some(v => v.gone) && !join.rivals.some(v => v.open), 'joined first, the petition is thrown out');
      // railways: the same canal carries less once trains run, and fly-boats win some back
      const H = A.play(7, A.STRATS.adaptive), y0 = H.years.find(y => y.year === 1828), y1 = H.years.at(-1); ok(H.rails.length >= 3, 'railways spread');
      ok(y1.net < y0.net, `trains cut the canal's income: ${y0.net.toFixed(0)} in 1828, ${y1.net.toFixed(0)} in ${y1.year}`);
      // an offer: selling ends the game at the offer's price
      const S = A.newGame(7); while (!S.over && !S.offer) { A.bot(S, A.STRATS.adaptive); A.step(S); }
      ok(S.offer && S.offer.price > 0, 'the railway makes an offer'); ok(A.act(S, { k: 'sell' }) && S.over && A.score(S) === S.offer.price, 'sold at the offer');
    },
    'Canal Age first minute: drag from a place, read the prospectus, open, a branch shows the engineer\'s estimate before it is paid, and a reload carries on where you were': async ({ page, ok, eq }) => {
      const p = await reopen(page, page.url().split('#')[0] + '#age=20261125'); await p.reload(); await ready(p); await p.waitForTimeout(400);
      eq(await p.evaluate(() => [__lf.C ? 1 : 1, __lf.mode, !!__lf.G]), [1, 'survey', true]);
      // dig from the port toward the mill the surveyor suggests (as a player would, with the mouse)
      await p.waitForFunction(() => __lf.G.hint, null, { timeout: 8000 });
      const pts = await p.evaluate(() => { const G = __lf.G, a = G.places[G.hint.i].c, b = G.places[G.hint.j].c, D2 = __lf.AGE.branch(G, a, [b]); return D2.paths[0].map(c => __lf.screenOf(c)); });
      await drag(p, pts); await p.waitForTimeout(300);
      const pros = await p.evaluate(() => ({ paths: __lf.D.paths.length, net: __lf.fore && __lf.fore.net, txt: document.getElementById('goals').textContent }));
      ok(pros.paths === 1 && pros.net != null && /Prospectus/.test(pros.txt), 'prospectus after the first drag: ' + JSON.stringify(pros));
      await p.click('#tOpen'); for (let k = 0; k < 8; k++) { await p.waitForTimeout(350); await p.evaluate(() => { const n = document.getElementById('note'); if (n && n.style.display === 'block' && document.getElementById('nOk')) document.getElementById('nOk').click(); }); } // news cards pause the clock: carry on
      const run = await p.evaluate(() => ({ mode: __lf.mode, m: __lf.G.m, cash: __lf.G.cash })); ok(run.mode === 'run' && run.m >= 2, 'months pass in real time: ' + JSON.stringify(run));
      // a branch while running: the estimate card, then Build pays from the bank
      await p.evaluate(() => { __lf.setSpeed(0); document.querySelectorAll('#note').forEach(e => e.style.display = 'none'); });
      const b = await p.evaluate(() => { const G = __lf.G, nc = Object.keys(G.D.lv).map(Number), i = G.places.findIndex((q, k) => !G.an.cells.has(G.M.towns[k].c)), D2 = __lf.AGE.branch(G, G.places[i].c, nc); const pth = D2.paths[D2.paths.length - 1].slice().reverse(); return pth.map(c => __lf.screenOf(c)); });
      await drag(p, b); await p.waitForTimeout(300);
      const est = await p.evaluate(() => ({ shown: document.getElementById('note').style.display, txt: document.getElementById('note').textContent, cash: __lf.G.cash, paths: __lf.G.D.paths.length }));
      ok(est.shown === 'block' && /cost/.test(est.txt) && est.paths === 1, 'estimate before paying: ' + JSON.stringify(est));
      await p.click('#pBuild'); await p.waitForTimeout(200);
      const after = await p.evaluate(() => ({ paths: __lf.G.D.paths.length, cash: __lf.G.cash, m: __lf.G.m }));
      ok(after.paths === 2 && after.cash < est.cash, 'the branch is built and paid for: ' + JSON.stringify(after));
      await p.evaluate(() => { __lf.setSpeed(0); ageSave(); });
      const q = await reopen(p, p.url().split('#')[0]); await q.waitForTimeout(300);
      const back = await q.evaluate(() => ({ mode: __lf.mode, m: __lf.G.m, paths: __lf.G.D.paths.length, cash: __lf.G.cash }));
      eq([back.mode, back.m, back.paths], ['run', after.m, 2], 'carried on after a reload'); ok(Math.abs(back.cash - after.cash) < 1e-6, 'same bank after reload');
      ok(!p.errs.length && !q.errs.length, p.errs[0] || q.errs[0]); await q.close(); await p.close();
    },
    'Canal Age on a phone: the map, the tools and a news card all fit the screen': async ({ page, ok }) => {
      const p = await page.context().newPage(); await p.setViewportSize({ width: 390, height: 844 }); await p.goto(page.url().split('#')[0] + '#age=20261125'); await p.reload(); await ready(p); await p.waitForTimeout(400);
      await p.evaluate(() => { const G = __lf.G, h = __lf.AGE.firstHint(G), D2 = __lf.AGE.branch(G, G.places[h.i].c, [G.places[h.j].c]); __lf.D = D2; openCanal(); __lf.setSpeed(0); __lf.AGE.unlock(G, 'fly'); ageDrainNews(); });
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => { const box = id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }, inside = b => b[0] >= 0 && b[1] >= 0 && b[2] <= innerWidth && b[3] <= innerHeight;
        const tb = [...document.querySelectorAll('#tools button')].map(e => e.getBoundingClientRect()); return { tools: inside(box('tools')), note: inside(box('note')), btn: Math.min(...tb.map(b => Math.min(b.width, b.height))), map: __lf.screenOf(__lf.G.places[0].c) }; });
      ok(r.tools && r.note, 'tools and the news card on screen'); ok(r.btn >= 28, 'buttons big enough: ' + r.btn); ok(r.map[0] > 0 && r.map[0] < 390 && r.map[1] > 0 && r.map[1] < 844, 'the map is on screen');
      await p.close();
    },
    'corrupted saves never crash the page': async ({ page, ok }) => {
      for (const v of ['null', '7', '[]', '{"v":2,"done":null,"designs":{"first":"!!~~"},"cur":99}', '{"v":2,"designs":{"ridge":"AAAA.zz"},"cur":1}', '{"v":2,"cur":6,"age":{"seed":5,"log":"zz|b|!! 3|m|1-2:p 4|b|AB0.CC","m":99}}', '{"v":2,"cur":6,"age":{"seed":"x","log":7,"m":-4}}', '{bad']) {
        await page.evaluate(v => { localStorage.clear(); localStorage.setItem('rh:lock-flight', v); }, v);
        const p = await reopen(page); ok(!p.errs.length, `save ${v}: ${p.errs[0]}`); ok(await p.evaluate(() => !!__lf.an)); await p.close();
      }
    },
  },
};
