// Fold (2D HP model): contact counting, chain validity, move legality, optimum/targets, level progression, saves, input.

// Independent exact optimum by brute force (no symmetry tricks) for short chains.
const BRUTE_SRC = `(S)=>{ let best=0; const P=[[0,0]]; const used=new Set(['0,0']);
  const rec=()=>{ if (P.length===S.length){ const m=new Map(P.map((p,i)=>[p+'',i])); let c=0;
      for (let i=0;i<P.length;i++) for (let j=i+2;j<P.length;j++) if (S[i]==='H'&&S[j]==='H'&&Math.abs(P[i][0]-P[j][0])+Math.abs(P[i][1]-P[j][1])===1) c++;
      if (c>best) best=c; return; }
    const l=P[P.length-1]; for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ if (P.length===1 && (dx!==1)) continue; const q=[l[0]+dx,l[1]+dy]; if (used.has(q+'')) continue; used.add(q+''); P.push(q); rec(); P.pop(); used.delete(q+''); } };
  rec(); return best; }`;

// Canonical key of a fold under translation, rotation and reflection (moves are symmetric, so this is safe for BFS).
const CANON_SRC = `(P)=>{ let best=null; for (let t=0;t<8;t++){ const q=P.map(([x,y])=>{ let a=x,b=y; if(t&1)a=-a; if(t&2)b=-b; if(t&4)[a,b]=[b,a]; return [a,b]; });
  const x0=Math.min(...q.map(p=>p[0])), y0=Math.min(...q.map(p=>p[1])); const k=q.map(p=>(p[0]-x0)+','+(p[1]-y0)).join(';'); if (best===null||k<best) best=k; } return best; }`;

async function reopen(page) { const p2 = await page.context().newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message)); await p2.goto(page.url()); await p2.waitForTimeout(300); p2.errs = errs; return p2; }
// Real touch input through Chrome's protocol (touch emulation on, finger drags with intermediate moves).
async function touchSession(page) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); return cdp; }
async function touchDrag(cdp, a, b, steps = 6) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1], id: 1 }] });
  for (let k = 1; k <= steps; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a[0] + (b[0] - a[0]) * k / steps, y: a[1] + (b[1] - a[1]) * k / steps, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
async function touchPinch(cdp, c, d0, d1) { const pts = (d) => [{ x: c[0] - d, y: c[1], id: 1 }, { x: c[0] + d, y: c[1], id: 2 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + (d1 - d0) * k / 5) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
const dismiss = (page) => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));

module.exports = {
  page: 'fold/index.html',
  tests: {
    'contacts: known small cases (chain neighbours and H–P never count)': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const c = (P, S) => __fold.contacts(P, S).c; return [
        c([[0, 0], [1, 0], [2, 0], [3, 0]], 'HPPH'), c([[0, 0], [0, 1], [1, 1], [1, 0]], 'HPPH'), c([[0, 0], [0, 1], [1, 1], [1, 0]], 'HHHH'),
        c([[0, 0], [0, 1], [1, 1], [1, 0]], 'HPPP'), c([[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]], 'HPPHPH'), c([[0, 0], [1, 0]], 'HH')]; });
      eq(r, [0, 1, 1, 0, 2, 0]);
    },
    'valid(): rejects overlaps and broken bonds': async ({ page, eq }) => {
      eq(await page.evaluate(() => [__fold.valid([[0, 0], [1, 0], [1, 1]]), __fold.valid([[0, 0], [1, 0], [0, 0]]), __fold.valid([[0, 0], [2, 0]]), __fold.valid([[0, 0], [1, 1]])]), [true, false, false, false]);
    },
    'warm-up targets equal an independent brute-force optimum, and are > 0': async ({ page, eq, ok }) => {
      const r = await page.evaluate((B) => { const brute = eval(B); return __fold.LV.map((L, i) => L.exact ? [__fold.optimum(i), brute(L.seq)] : null).filter(Boolean); }, BRUTE_SRC);
      eq(r.length, 10); for (const [a, b] of r) { eq(a, b); ok(a > 0); }
    },
    'every warm-up is solvable from a straight chain using only the moves unlocked at that level': async ({ page, ok }) => {
      // randomized local search over the moves tryMove allows at that level (a random walk explores the reachable folds)
      const r = await page.evaluate(() => { const F = __fold, out = []; let seed = 11; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) % n; };
        for (let lv = 0; lv < F.LV.length; lv++) { const L = F.LV[lv]; if (!L.exact) continue; F.open(lv); const target = F.optimum(lv), n = L.seq.length;
          let found = -1;
          for (let rs = 0; rs < 20 && found < 0; rs++) { let P = L.seq.split('').map((_, k) => [k, 0]), cur = 0; // annealing-style walk with restarts
            for (let it = 0; it < 30000 && found < 0; it++) { const i = rnd(n); F.pos = P; const Q = F.tryMove(i, [P[i][0] + rnd(3) - 1, P[i][1] + rnd(3) - 1]); if (!Q) continue;
              const c = F.contacts(Q, L.seq).c; if (c >= cur || rnd(1000) < 1000 * Math.exp((c - cur) / 0.6)) { P = Q; cur = c; } if (c >= target) found = it; } }
          out.push([L.name, found]); }
        return out; });
      for (const [n, d] of r) ok(d >= 0, n + ' not reached with its tools');
    },
    'move legality: 4000 random drags/pivots with all tools always leave a valid, connected chain': async ({ page, eq }) => {
      const bad = await page.evaluate(() => { const F = __fold; F.open(12); let seed = 3; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) % n; }; const bad = []; const n = F.pos.length;
        for (let k = 0; k < 4000; k++) { const i = rnd(n); if (rnd(10) === 0) { F.sel = i; F.pivot(i, ['cw', 'ccw', 'mirror'][rnd(3)]); }
          else { const p = F.pos[i]; const Q = F.tryMove(i, [p[0] + rnd(3) - 1, p[1] + rnd(3) - 1]); if (Q) { if (!F.valid(Q) || Q.length !== n) { bad.push(k); break; } F.commit(Q); } }
          if (!F.valid(F.pos)) { bad.push('pivot ' + k); break; } }
        document.querySelectorAll('.toast').forEach(t => t.remove()); return bad; });
      eq(bad, []);
    },
    'locked tools really are locked (warm-up 1 has no pull or crankshaft)': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const F = __fold; F.open(0); F.pos = [[0, 0], [1, 0], [2, 0], [3, 0]];
        return [F.tryMove(1, [1, 1]), F.tryMove(0, [1, 1]) && 'end ok', F.tryMove(2, [2, -1])]; });
      eq(r, [null, 'end ok', null]);
    },
    'undo / redo restore exact positions; best score is kept after undo': async ({ page, eq }) => {
      await dismiss(page);
      const r = await page.evaluate(() => { const F = __fold; F.open(0); const a = JSON.stringify(F.pos);
        F.commit(F.tryMove(0, [1, 1])); F.commit(F.tryMove(3, [2, 1])); const b = JSON.stringify(F.pos); const best = F.SAVE.best[0];
        F.undo(); F.undo(); const c = JSON.stringify(F.pos); F.redo(); F.redo(); return { same0: a === c, same2: b === JSON.stringify(F.pos), best, bestAfter: F.SAVE.best[0] }; });
      eq(r, { same0: true, same2: true, best: 1, bestAfter: 1 });
    },
    'stars thresholds and progress fraction (never above 1)': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const F = __fold; const t = F.LV[16].best; const s = (b) => { F.SAVE.best[16] = b; return F.stars(16); };
        const out = [s(0), s(Math.ceil(t * 0.8) - 1), s(Math.ceil(t * 0.8)), s(Math.ceil(t * 0.95)), s(t), s(t + 3)];
        F.LV.forEach((L, i) => { F.SAVE.best[i] = 999; F.SAVE.machine[i] = F.SAVE.machine[i] ?? 5; if (L.design) F.SAVE.dstar[i] = 3; }); F.commit(F.pos); return { out, prog: JSON.parse(localStorage.getItem('rh:hub')).fold }; });
      eq(r.out, [0, 0, 1, 2, 3, 3]); eq(r.prog, 1);
    },
    'level unlocking: next level after a star; next group opens after 3 folded levels': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const F = __fold; const u = () => [F.unlocked(1), F.unlocked(10)];
        const a = u(); F.SAVE.best[0] = 1; const b = u(); F.SAVE.best[1] = F.optimum(1); F.SAVE.best[2] = F.optimum(2); const c = u(); return [a, b, c]; });
      eq(r, [[false, false], [true, false], [true, true]]);
    },
    'clicking a locked level does nothing': async ({ page, eq }) => {
      await dismiss(page); await page.click('#levels .lv[data-i="5"]'); eq(await page.evaluate(() => __fold.li), 0);
    },
    'machine: deterministic search returns a valid fold whose contacts equal its reported score': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const F = __fold; const L = F.LV.find(l => l.machine); const M = F.makeMachine(L.seq); for (let i = 0; i < 300; i++) M.step();
        const M2 = F.makeMachine(L.seq); for (let i = 0; i < 300; i++) M2.step();
        return { v: F.valid(M.bestP), c: F.contacts(M.bestP, L.seq).c, best: M.best, same: M2.best === M.best }; });
      ok(r.v); eq(r.c, r.best); ok(r.best > 0); ok(r.same, 'deterministic');
    },
    'machine level: no stars before the computer finishes (no stars that later vanish), page stays responsive, result saved': async ({ page, eq, ok }) => {
      await dismiss(page);
      const i = await page.evaluate(() => { const F = __fold; const i = F.LV.findIndex(l => l.machine); F.SAVE.best[i] = 3; F.open(i); return i; });
      const t0 = Date.now(); const s0 = await page.evaluate((i) => [__fold.stars(i), !!__fold.machineRuns[i]], i); ok(Date.now() - t0 < 400, 'page blocked');
      eq(s0, [0, true]);
      await page.waitForFunction((i) => __fold.SAVE.machine[i] != null, i, { timeout: 8000 });
      const m = await page.evaluate((i) => [__fold.SAVE.machine[i], JSON.parse(localStorage.getItem('rh:fold')).machine[i]], i); ok(m[0] > 0); eq(m[1], m[0]);
    },
    'mouse: fold warm-up 1 by dragging both ends; celebrates and offers the next level': async ({ page, eq, ok }) => {
      await dismiss(page); await page.click('#modes [data-m="precise"]');
      const drag = async (i, dx, dy) => { const [x, y] = await page.evaluate((i) => __fold.screen(i), i); const c = await page.evaluate(() => __fold.cellPx());
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx * c * 0.5, y + dy * c * 0.5, { steps: 3 }); await page.mouse.move(x + dx * c, y + dy * c, { steps: 3 }); await page.mouse.up(); };
      await drag(0, 1, 1); await drag(3, -1, 1);
      eq(await page.textContent('#score'), '1'); eq(await page.evaluate(() => __fold.SAVE.best[0]), 1);
      ok(await page.isVisible('#nextBtn')); await page.click('#nextBtn'); eq(await page.evaluate(() => __fold.li), 1);
    },
    'pivot buttons only when pivot is unlocked; they rotate around the selected bead': async ({ page, eq, ok }) => {
      await dismiss(page);
      eq(await page.isVisible('#pivots'), false);
      await page.evaluate(() => { for (const k of [0, 1, 2]) __fold.SAVE.best[k] = __fold.optimum(k); __fold.open(10); __fold.sel = 2; });
      ok(await page.isVisible('#pivots'));
      await page.click('#pivots [data-pv="cw"]');
      const P = await page.evaluate(() => __fold.pos.slice(0, 3)); eq(P, [[2, -2], [2, -1], [2, 0]]);
    },
    'saved folds that are invalid (overlap, wrong length, junk) are not loaded; corrupted saves are survivable': async ({ page, eq }) => {
      const cases = [
        ['{"cur":0,"best":{},"folds":{"0":[[0,0],[0,0],[1,0],[2,0]]},"machine":{}}', 0],
        ['{"cur":1,"best":{"0":1},"folds":{"1":[[0,0],[1,0]]},"machine":{}}', 0],
        ['{"cur":"x","best":null,"folds":5}', 0], ['null', 0], ['[1,2]', 0], ['{"cur":999}', 0], ['{"cur":0,"best":{"0":"NaN"},"bestFold":{"0":[["a"]]}}', 0]];
      for (const [raw] of cases) {
        await page.evaluate((raw) => localStorage.setItem('rh:fold', raw), raw); const p2 = await reopen(page);
        const st = await p2.evaluate(() => ({ v: __fold.valid(__fold.pos), straight: __fold.pos.every((p, k) => p[0] === k && p[1] === 0), cur: __fold.li }));
        eq(p2.errs, [], raw); eq(st.v, true, raw); eq(st.straight, true, raw);
        await p2.evaluate(() => document.getElementById('loadBest').click()); eq(await p2.evaluate(() => __fold.valid(__fold.pos)), true);
        await p2.close();
      }
    },
    'save/load round-trip keeps the fold and best': async ({ page, eq }) => {
      await page.evaluate(() => { const F = __fold; F.commit(F.tryMove(0, [1, 1])); F.commit(F.tryMove(3, [2, 1])); });
      const p2 = await reopen(page); const r = await p2.evaluate(() => [__fold.contacts().c, __fold.SAVE.best[0]]); eq(r, [1, 1]); await p2.close();
    },
    'matching the target photographs the fold into the notebook': async ({ page, eq, ok }) => {
      await dismiss(page);
      await page.evaluate(() => { const F = __fold; F.open(0); F.commit(F.tryMove(0, [1, 1])); F.commit(F.tryMove(3, [2, 1])); });
      eq(await page.locator('#photos .photo').count(), 1); ok(/Warm-up 1 — 1 contacts/.test(await page.textContent('#photos')));
      await page.evaluate(() => { const F = __fold; F.undo(); F.redo(); }); eq(await page.locator('#photos .photo').count(), 1, 'no second photo for the same record');
    },
    'landscape phone: levels live in a drawer that opens from the Levels button and closes on pick': async ({ page, eq, ok }) => {
      await dismiss(page); await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300);
      const vis = () => page.evaluate(() => { const r = document.getElementById('left').getBoundingClientRect(); return r.right > 5; });
      eq(await vis(), false); await page.click('#lvBtn'); await page.waitForTimeout(350); eq(await vis(), true);
      await page.evaluate(() => { __fold.SAVE.best[0] = 1; __fold.open(0); }); eq(await vis(), true);
      await page.click('#levels .lv[data-i="1"]'); await page.waitForTimeout(350); eq(await vis(), false); eq(await page.evaluate(() => __fold.li), 1);
      const st = await page.locator('#cv').boundingBox(); ok(st.width * st.height > 0.45 * 844 * 390, 'stage ' + st.width + 'x' + st.height);
    },
    'parity ceiling is a true upper bound on every warm-up and benchmark': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const F = __fold; return F.LV.map((L, i) => [L, i]).filter(([L]) => !L.design).filter(([L, i]) => { const t = L.exact ? F.optimum(i) : L.best ?? 0; return t > F.parityBound(L.seq); }).map(([L]) => L.name); });
      ok(!bad.length, bad.join(','));
    },
    'design: click balls to set H/P, ask the machine to check; stars for best, unique, unique with 2+ contacts': async ({ page, eq, ok }) => {
      await dismiss(page);
      const di = await page.evaluate(() => { const F = __fold; for (let k = 0; k < 3; k++) F.SAVE.best[k] = F.optimum(k); const di = F.LV.findIndex(l => l.design); F.open(di); return di; });
      ok(await page.evaluate((di) => __fold.unlocked(di), di), 'design opens after three warm-ups');
      for (const i of [1, 2, 5, 6]) { const [x, y] = await page.evaluate((i) => __fold.screen(i), i); await page.mouse.click(x, y); }
      eq(await page.evaluate(() => document.getElementById('seq').textContent), 'PHHPPHHP');
      await page.click('#verifyBtn'); ok(/Unique/.test(await page.textContent('#designRes')));
      eq(await page.evaluate((di) => __fold.stars(di), di), 3);
      const r = await page.evaluate((di) => { const F = __fold, sh = F.LV[di].shape; return [F.verifyDesign(sh, 'HHHHHHHH').stars, F.verifyDesign(sh, 'PPPPPPPP').stars, F.verifyDesign(sh, 'HPPPPPPH').stars]; }, di);
      ok(r[0] <= 1 && r[1] === 0, JSON.stringify(r));
      const p2 = await reopen(page); eq(await p2.evaluate((di) => [__fold.SAVE.dseq[di], __fold.SAVE.dstar[di]], di), ['PHHPPHHP', 3]); await p2.close();
    },
    'machine search replay: frames play its chain, temperature falls, and the board returns to your fold': async ({ page, eq, ok }) => {
      await dismiss(page);
      const i = await page.evaluate(() => { const F = __fold; const i = F.LV.findIndex(l => l.machine); F.SAVE.best[i] = 1; F.open(i); return i; });
      await page.waitForFunction((i) => __fold.SAVE.machine[i] != null, i, { timeout: 10000 });
      const before = await page.evaluate(() => JSON.stringify(__fold.pos));
      ok(await page.isVisible('#watchBtn')); await page.click('#watchBtn');
      const tr = await page.evaluate((i) => { const t = __fold.machineTraces[i]; return { n: t.length, T0: t[0].T, T1: t.at(-1).T, valid: t.every(f => __fold.valid(f.P)) }; }, i);
      ok(tr.n > 10 && tr.T1 < tr.T0 && tr.valid, JSON.stringify(tr)); ok(await page.evaluate(() => !!__fold.replay));
      eq(await page.evaluate(() => JSON.stringify(__fold.pos)), before, 'replay never touches your fold');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const F = __fold; const lateIdx = F.LV.map((L, i) => i).filter(i => !F.LV[i].design && F.LV[i].grp !== 'Warm-up').slice(-12);
        let seed = 4; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) % n; };
        const res = { random: 0, greedy: 0, competent: 0, greedy3: 0, n: 0 };
        for (const i of lateIdx) { const L = F.LV[i]; F.open(i); const n = L.seq.length; const t = L.best ?? (() => { const M = F.makeMachine(L.seq); for (let k = 0; k < 600; k++) M.step(); return M.best; })(); F.SAVE.machine[i] = t;
          const walk = (moves, greedy) => { let P = L.seq.split('').map((_, k) => [k, 0]), cur = 0, best = 0; for (let m = 0; m < moves; m++) { const b = rnd(n); F.pos = P; const Q = F.tryMove(b, [P[b][0] + rnd(3) - 1, P[b][1] + rnd(3) - 1]); if (!Q) continue; const c = F.contacts(Q, L.seq).c; if (!greedy || c >= cur) { P = Q; cur = c; best = Math.max(best, c); } } return best; };
          const st = (c) => { F.SAVE.best[i] = c; return F.stars(i); };
          res.n++; if (st(walk(3000, false)) >= 2) res.random++; const g = walk(6000, true); if (st(g) >= 2) res.greedy++; if (st(g) === 3) res.greedy3++;
          const M = F.makeMachine(L.seq); for (let k = 0; k < 200; k++) M.step(); if (st(M.best) >= 1) res.competent++; }
        return res; });
      ok(r.random / r.n <= .2, 'random ≥2★ ' + r.random + '/' + r.n); ok(r.greedy / r.n <= .2, 'greedy ≥2★ ' + r.greedy + '/' + r.n);
      ok(r.competent / r.n >= .8, 'annealing earns a star on ' + r.competent + '/' + r.n); ok(r.greedy3 <= 1, 'greedy 3★ on ' + r.greedy3 + '/' + r.n + ' ' + JSON.stringify(r));
    },
    'touch (phone): long chains keep finger-sized beads; pinch zooms; Fit shows everything; a finger drag folds': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(page.url()); await page.waitForTimeout(600); await dismiss(page);
      const cdp = await touchSession(page);
      await page.evaluate(() => { const F = __fold; for (const k of [0, 1, 2]) F.SAVE.best[k] = F.optimum(k); F.open(19); });
      ok(await page.evaluate(() => __fold.cellSize) >= 30, 'bead spacing on the 100-bead chain');
      const box = await page.locator('#cv').boundingBox(); const c = [box.x + box.width / 2, box.y + box.height / 2];
      const z0 = await page.evaluate(() => __fold.cellSize); await touchPinch(cdp, c, 80, 30); const z1 = await page.evaluate(() => __fold.cellSize); ok(z1 < z0 * .6, `pinch out ${z0} -> ${z1}`);
      await touchPinch(cdp, c, 30, 90); ok(await page.evaluate(() => __fold.cellSize) > z1 * 2, 'pinch in');
      await page.click('#fitBtn'); const f = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return __fold.pos.every((p, i) => { const [x, y] = __fold.screen(i); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }); }); ok(f, 'Fit shows the whole chain');
      await page.evaluate(() => { __fold.open(0); __fold.setMode('precise'); }); const a = await page.evaluate(() => __fold.screen(0)); const cs = await page.evaluate(() => __fold.cellSize);
      await touchDrag(cdp, a, [a[0] + cs, a[1] + cs]); eq(await page.evaluate(() => JSON.stringify(__fold.pos[0])), '[1,1]');
    },
    'pull mode: 200 random drags always leave a valid, self-avoiding, connected chain; the grabbed ball reaches its cell': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const F = __fold; F.open(12); const n = F.pos.length; let seed = 21; const rnd = (k) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) % k; };
        let bad = 0, reached = 0, tries = 0;
        for (let k = 0; k < 200; k++) { const i = rnd(n), p = F.pos[i]; const t = [p[0] + rnd(9) - 4, p[1] + rnd(9) - 4]; const Q = F.relay(F.pos, i, [p[0] + Math.sign(t[0] - p[0]) || p[0] + 1, p[1]]); if (Q) { if (!F.valid(Q) || Q.length !== n) bad++; else F.pos = Q; }
          // and through the real gesture path
          const before = JSON.stringify(F.pos[i]); F.setMode('pull'); }
        // real stepwise pulls toward random targets
        for (let k = 0; k < 200; k++) { const i = rnd(n), p = F.pos[i]; const t = [p[0] + rnd(7) - 3, p[1] + rnd(7) - 3]; let P = F.pos; for (let s2 = 0; s2 < 6; s2++) { const c = P[i]; const dx = Math.sign(t[0] - c[0]), dy = Math.sign(t[1] - c[1]); if (!dx && !dy) break; const nx = Math.abs(t[0] - c[0]) >= Math.abs(t[1] - c[1]) ? [c[0] + dx, c[1]] : [c[0], c[1] + dy]; const Q = F.relay(P, i, nx); if (!Q) break; P = Q; }
          tries++; if (!F.valid(P) || P.length !== n) bad++; if (P[i][0] === t[0] && P[i][1] === t[1]) reached++; F.pos = P; }
        return { bad, reached, tries }; });
      eq(r.bad, 0); ok(r.reached / r.tries > .6, 'grabbed ball usually reaches the cell: ' + r.reached + '/' + r.tries);
    },
    'pull mode by mouse: dragging the middle ball far moves it there and the chain follows as one gesture (one undo)': async ({ page, ok, eq }) => {
      await dismiss(page); await page.evaluate(() => { const F = __fold; for (const k of [0, 1, 2]) F.SAVE.best[k] = F.optimum(k); F.open(10); });
      const [x, y] = await page.evaluate(() => __fold.screen(10)); const cs = await page.evaluate(() => __fold.cellSize);
      const start = await page.evaluate(() => JSON.stringify(__fold.pos));
      await page.mouse.move(x, y); await page.mouse.down(); for (let k = 1; k <= 12; k++) await page.mouse.move(x, y - k * cs / 3); await page.mouse.up();
      const r = await page.evaluate(() => ({ p: __fold.pos[10], v: __fold.valid(__fold.pos), h: __fold.hist.length }));
      ok(r.v); eq(r.p[1], -4, 'moved 4 cells up'); eq(r.h, 1, 'one undo step');
      await page.click('#undo'); eq(await page.evaluate(() => JSON.stringify(__fold.pos)), start);
    },
    'draw mode: trace a path from the N end and the chain is laid exactly along it; crossing the stroke stops it': async ({ page, ok, eq }) => {
      await dismiss(page); await page.evaluate(() => { __fold.open(5); __fold.setMode('draw'); });
      const cs = await page.evaluate(() => __fold.cellSize); const o = await page.evaluate(() => __fold.screen(0));
      const path = [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2]]; // a compact S from bead 0's cell
      const P0 = await page.evaluate(() => __fold.pos[0]);
      await page.mouse.move(...o); await page.mouse.down(); for (const [dx, dy] of path.slice(1)) await page.mouse.move(o[0] + dx * cs, o[1] + dy * cs, { steps: 3 });
      await page.mouse.move(o[0] + 1 * cs, o[1] + 1 * cs, { steps: 3 }); // try to cross the stroke: ignored
      await page.mouse.up();
      const r = await page.evaluate(() => ({ pos: __fold.pos, v: __fold.valid(__fold.pos) }));
      ok(r.v); eq(r.pos.slice(0, path.length), path.map(([dx, dy]) => [P0[0] + dx, P0[1] + dy]));
    },
    'touch (phone): Pull and Draw work with a finger': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(page.url()); await page.waitForTimeout(600); await dismiss(page);
      const cdp = await touchSession(page);
      // Pull: drag the middle ball of warm-up 6 three cells up
      await page.evaluate(() => { const F = __fold; F.open(5); F.setMode('pull'); });
      const cs = await page.evaluate(() => __fold.cellSize); const m = await page.evaluate(() => __fold.screen(5)); const p0 = await page.evaluate(() => __fold.pos[5].slice());
      await touchDrag(cdp, m, [m[0], m[1] - 3 * cs], 12);
      const r = await page.evaluate(() => ({ p: __fold.pos[5], v: __fold.valid(__fold.pos), h: __fold.hist.length }));
      ok(r.v, 'valid chain'); eq(r.p, [p0[0], p0[1] - 3]); eq(r.h, 1, 'one gesture, one undo');
      // Draw: unfold, then trace an S from the N end
      await page.evaluate(() => { const F = __fold; F.commit(F.pos.map((_, k) => [k, 0])); F.setMode('draw'); });
      const o = await page.evaluate(() => __fold.screen(0)); const P0 = await page.evaluate(() => __fold.pos[0].slice());
      const path = [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2], [1, 2], [0, 2]];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: o[0], y: o[1], id: 1 }] });
      for (let k = 1; k < path.length; k++) { const [ax, ay] = path[k - 1], [bx, by] = path[k]; for (const f of [.5, 1]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: o[0] + (ax + (bx - ax) * f) * cs, y: o[1] + (ay + (by - ay) * f) * cs, id: 1 }] }); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const d = await page.evaluate(() => ({ pos: __fold.pos, v: __fold.valid(__fold.pos) }));
      ok(d.v); eq(d.pos.slice(0, path.length), path.map(([dx, dy]) => [P0[0] + dx, P0[1] + dy]));
    },
    'phone layout: no horizontal scroll, canvas is large enough': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
      const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 350 && r.cv.height >= 400, JSON.stringify(r.cv));
    },
  },
};
