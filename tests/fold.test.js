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
      const r = await page.evaluate(() => { const F = __fold; const t = F.LV[13].best; const s = (b) => { F.SAVE.best[13] = b; return F.stars(13); };
        const out = [s(0), s(Math.ceil(t * 0.7) - 1), s(Math.ceil(t * 0.7)), s(Math.ceil(t * 0.9)), s(t), s(t + 3)];
        F.LV.forEach((_, i) => { F.SAVE.best[i] = 999; F.SAVE.machine[i] = F.SAVE.machine[i] ?? 5; }); F.commit(F.pos); return { out, prog: JSON.parse(localStorage.getItem('rh:hub')).fold }; });
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
      await dismiss(page);
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
    'phone layout: no horizontal scroll, canvas is large enough': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
      const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 350 && r.cv.height >= 400, JSON.stringify(r.cv));
    },
  },
};
