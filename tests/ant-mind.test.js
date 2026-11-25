// Ant Mind: map data, pathfinding, scent painting, goals/stars, saves and input.
const paintTrail = `(mi) => { const A = window.__ant; const cv = document.getElementById('cv'), rc = cv.getBoundingClientRect();
  const ev = (x, y) => { const q = A.toScreen(x, y); return { clientX: q[0], clientY: q[1] }; };
  let k = -1, bd = 1e9; for (let i = 0; i < A.W * A.H; i++) if (A.food[i] > 0 && A.home[i] < bd) { bd = A.home[i]; k = i; }
  const path = []; let x = k % A.W, y = (k / A.W) | 0;
  for (let s = 0; s < 400; s++) { path.push([x, y]); let bx = x, by = y, bv = A.home[A.idx(x, y)];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= A.W || Y >= A.H) continue; if (A.home[A.idx(X, Y)] < bv) { bv = A.home[A.idx(X, Y)]; bx = X; by = Y; } }
    if (bx === x && by === y) break; x = bx; y = by; }
  path.reverse(); A.strokeStart(); A.painting = 1; A.brush = 'forage'; for (let i = 0; i < path.length; i += 2) A.paint(ev(path[i][0] + 0.5, path[i][1] + 0.5)); A.painting = 0; }`;
// The harness clears localStorage on every navigation; this injects a save that survives the reload (init scripts run in order)
const reloadWith = async (page, key, v) => { await page.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch (e) {} }, [key, v]); await page.reload(); };
// Colony bots for the difficulty test: idle (the map's starting chemistry), greedy (max trail, no evaporation, no wandering), and a tuned chemistry a thoughtful player finds
const BOT = "window.__antbot=(mi,policy,seedShift=0)=>{ const A=window.__ant; RH.modal=()=>Promise.resolve(); RH.toast=()=>{};\n  for (let i=0;i<20;i++) A.SAVE.stars[i]=A.SAVE.stars[i]||1; A.openMap(mi); A.paused=true; const M=A.MAPS[mi];\n  const rc=document.getElementById('cv').getBoundingClientRect(); const ev=(x,y)=>{ const q=A.toScreen(x,y); return {clientX:q[0], clientY:q[1]}; };\n  const stroke=(pts,brush)=>{ A.brush=brush; A.strokeStart(); A.painting=1; for (const [x,y] of pts) A.paint(ev(x+0.5,y+0.5)); A.painting=0; };\n  const pathTo=(k)=>{ const path=[]; let x=k%A.W,y=(k/A.W)|0; for(let s=0;s<400;s++){ path.push([x,y]); let bx=x,by=y,bv=A.home[A.idx(x,y)]; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){ const X=x+dx,Y=y+dy; if(X<0||Y<0||X>=A.W||Y>=A.H) continue; if(A.home[A.idx(X,Y)]<bv){bv=A.home[A.idx(X,Y)];bx=X;by=Y;} } if(bx===x&&by===y) break; x=bx;y=by; } return path.reverse(); };\n  const rng=RH.rng(77+seedShift); document.getElementById('ratio').value=10; // every policy starts from the default hatch ratio\n  if (policy==='random') A.setChem({dep:20+rng()*180, evap:rng()*100, noise:rng()*100});\n  if (policy==='greedy') A.setChem({dep:200, evap:0, noise:0});\n  const chemFor=(M)=> M.moving? {dep:110,evap:85,noise:50} : M.rain? {dep:200,evap:30,noise:25} : M.cold? {dep:150,evap:35,noise:25} : M.layout? {dep:100,evap:85,noise:40} : {dep:130,evap:45,noise:30};\n  if (policy==='competent') A.setChem(chemFor(M));\n  let scout=true; if (policy.startsWith('chem:')){ const [d,e,n,ra,sc]=policy.slice(5).split('/').map(Number); A.setChem({dep:d,evap:e,noise:n}); document.getElementById('ratio').value= Number.isFinite(ra)? ra : (M.rival||M.spider)?35:0; if (sc===0) scout=false; }\n  if (policy==='competent') document.getElementById('ratio').value = (M.rival||M.spider)? 35 : 0;\n  let t=0;\n  for (; t<M.t*20 && !A.gameOver; t++){\n    if ((policy==='competent'||policy.startsWith('chem:')) && t%300===0){\n      let k=-1,bd=1e9; for(let i=0;i<A.W*A.H;i++) if(A.food[i]>0&&A.home[i]<bd){bd=A.home[i];k=i;} if (k>=0 && !(M.layout) && scout) stroke(pathTo(k).filter((_,i)=>i%2===0).slice(0,60),'forage');\n      const foes=[...A.spiders.filter(s=>s.hp>0)]; if (A.nests[1]&&A.nests[1].hp>0) foes.push(A.nests[1]);\n      if (foes.length && A.unlockedScent(A.SCENTS[1])){ const f=foes[0]; stroke(pathTo(A.idx(f.x|0,f.y|0)).filter((_,i)=>i%2===0),'alarm'); }\n    }\n\n    A.stepWorld(0.05);\n  }\n  const [v,n]=A.goalProgress(); return {mi, policy, won: v>=n, stars: v>=n? A.SAVE.stars[mi] : 0, t:Math.round(t/20), v:Math.round(v), n:Math.round(n)};\n};\n";
module.exports = {
  page: 'ant-mind/index.html',
  ready: async (page) => { await page.waitForFunction(() => window.__ant && window.__ant.G); await page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); window.__ant.paused = true; RH.modal = (h) => { window.__lastModal = h; return Promise.resolve(); }; }); },
  tests: {
    'every map is winnable on paper: enough reachable food, reachable spiders and rival nest, nests on open ground, not won at start': async ({ page, ok }) => {
      const bad = await page.evaluate(() => {
        const A = window.__ant, bad = [];
        A.MAPS.forEach((M, i) => { A.build(i);
          const seen = new Uint8Array(A.W * A.H), q = [A.idx(A.nests[0].x, A.nests[0].y)]; seen[q[0]] = 1;
          for (let h = 0; h < q.length; h++) { const j = q[h], x = j % A.W, y = (j / A.W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= A.W || Y >= A.H) continue; const k = A.idx(X, Y); if (!seen[k] && A.G[k] !== A.ROCK) { seen[k] = 1; q.push(k); } } }
          let reach = 0; for (let k = 0; k < A.W * A.H; k++) if (seen[k]) reach += A.food[k];
          if (M.g.type === 'food' && reach < M.g.n * 2) bad.push(`${i} food ${reach}<${M.g.n * 2}`);
          if (M.g.type === 'kill' && A.spiders.length < M.g.n) bad.push(i + ' too few spiders');
          A.spiders.forEach((sp, k) => { if (!A.passable(sp.x, sp.y) || !(A.home[A.idx(sp.x | 0, sp.y | 0)] < 1e9)) bad.push(`${i} spider ${k} stuck in ${A.G[A.idx(sp.x | 0, sp.y | 0)]}`); });
          for (const n of A.nests) if (A.G[A.idx(n.x, n.y)] !== A.PASS) bad.push(i + ' nest blocked');
          if (A.nests[1] && !(A.home[A.idx(A.nests[1].x, A.nests[1].y)] < 1e9) && !seen[A.idx(A.nests[1].x, A.nests[1].y)]) bad.push(i + ' rival unreachable');
          if (M.g.type === 'nest' && !A.nests[1]) bad.push(i + ' nest goal without rival');
          const [v, n] = A.goalProgress(); if (v >= n) bad.push(i + ' won at start');
        });
        return bad;
      });
      ok(!bad.length, bad.join(', '));
    },
    'pathfinding: home distance is 0 at the nest, 1 per step, 1.41 diagonal, and never through rock': async ({ page, near, eq }) => {
      const r = await page.evaluate(() => {
        const A = window.__ant; A.build(0); const G = A.G; G.fill(A.PASS); const n = { x: 50, y: 50 };
        let d = A.bfs(n); const a = [d[A.idx(50, 50)], d[A.idx(53, 50)], d[A.idx(53, 53)], d[A.idx(50, 47)]];
        for (let y = 0; y < A.H; y++) G[A.idx(60, y)] = A.ROCK; d = A.bfs(n);
        return { a, wall: d[A.idx(61, 50)] };
      });
      eq(r.a.slice(0, 2), [0, 3]); near(r.a[2], 3 * 1.41, 1e-4); eq(r.a[3], 3); eq(r.wall, 1e9);
    },
    'ants lay their own trails: with no input the colony finds food slowly; a scout trail and stronger chemistry make it faster; no trail at all is slowest': async ({ page, ok }) => {
      const r = await page.evaluate(`(() => { const A = window.__ant; const trail = ${paintTrail}; const run = (chem, scout) => { A.openMap(0); A.paused = true; if (chem) A.setChem(chem); let t = 0; for (; t < 150 * 20 && !A.gameOver; t++) { if (scout && t % 300 === 0) trail(0); A.stepWorld(0.05); } return [Math.round(t / 20), Math.round(A.delivered)]; };
        return { idle: run(null, false), scout: run(null, true), strong: run({ dep: 150, evap: 35, noise: 25 }, false), none: run({ dep: 20, evap: 100, noise: 35 }, false) }; })()`);
      ok(r.scout[0] < r.idle[0], 'scout trail speeds it up: ' + JSON.stringify(r)); ok(r.strong[0] < r.idle[0], 'stronger trail chemistry speeds it up: ' + JSON.stringify(r)); ok(r.none[0] > r.idle[0], 'without trails the colony is slowest: ' + JSON.stringify(r));
    },
    'double bridge: on yesterday\'s long trail with slow evaporation the colony stays stuck; fast evaporation lets the short way win': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = window.__ant; for (let i = 0; i < 20; i++) A.SAVE.stars[i] = 1; const run = (chem) => { A.openMap(1); A.paused = true; if (chem) A.setChem(chem); let t = 0; for (; t < 200 * 20 && !A.gameOver; t++) A.stepWorld(0.05); const [v, n] = A.goalProgress(); return { won: v >= n, share: Math.round(A.bridgeShare() * 100), t: Math.round(t / 20) }; };
        return { stuck: run(null), fast: run({ dep: 100, evap: 80, noise: 35 }) }; });
      ok(!r.stuck.won && r.stuck.share < 50, 'stuck: ' + JSON.stringify(r.stuck)); ok(r.fast.won && r.fast.share >= 70, 'fast evaporation: ' + JSON.stringify(r.fast));
    },
    'gland reserve never goes negative and an empty gland paints nothing; right-drag erases every scent': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const A = window.__ant, rc = document.getElementById('cv').getBoundingClientRect(); A.openMap(0); A.paused = true;
        const ev = (x, y) => { const q = A.toScreen(x, y); return { clientX: q[0], clientY: q[1] }; };
        A.painting = 1; let min = 1; for (let k = 0; k < 4000; k++) { A.paint(ev(20 + (k * 7) % 150, 10 + (k * 13) % 100)); min = Math.min(min, A.gland); } A.painting = 0;
        const sum = () => A.scent.forage.reduce((s, v) => s + v, 0); const before = sum();
        A.painting = 1; A.paint(ev(5, 5)); A.paint(ev(100, 100)); A.painting = 0; const after = sum();
        A.scent.alarm[A.idx(60, 60)] = 1; A.scent.forage[A.idx(60, 60)] = 1; A.painting = -1; A.paint(ev(60.5, 60.5)); A.painting = 0;
        return { min, gland: A.gland, grew: after - before, erased: [A.scent.alarm[A.idx(60, 60)], A.scent.forage[A.idx(60, 60)]] };
      });
      ok(r.min >= 0, 'gland ' + r.min); ok(r.gland <= 0.002, 'gland should be drained, got ' + r.gland); eq(r.grew, 0); eq(r.erased, [0, 0]);
    },
    'scent fades over time and rain washes it away much faster': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = window.__ant; A.openMap(0); A.paused = true; const i = A.idx(100, 60);
        A.scent.forage[i] = 1; for (let k = 0; k < 20; k++) A.stepWorld(0.05); const dry = A.scent.forage[i];
        A.scent.forage[i] = 1; A.rainT = 5; for (let k = 0; k < 20; k++) A.stepWorld(0.05); const wet = A.scent.forage[i];
        return { dry, wet }; });
      ok(r.dry < 1 && r.dry > 0.6, 'dry decay ' + r.dry); ok(r.wet < 0.2 * r.dry, 'rain decay ' + r.wet);
    },
    'goals: kills, rival nest and timeouts end the map correctly; stars only improve': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const A = window.__ant, out = {};
        A.SAVE.stars[4] = 1; A.SAVE.stars[5] = 3; A.openMap(5); A.paused = true; A.kills = 1; A.checkEnd(); out.kill = [A.gameOver, A.SAVE.stars[5]];
        A.SAVE.stars[10] = 1; A.openMap(11); A.paused = true; A.nests[1].hp = 0; A.checkEnd(); out.nest = A.gameOver;
        A.openMap(0); A.paused = true; A.timeLeft = 0.01; A.stepWorld(0.05); out.timeout = [A.gameOver, /season ended/.test(window.__lastModal)];
        A.openMap(0); A.paused = true; A.delivered = 50; A.timeLeft = 140; A.checkEnd(); out.fast = A.SAVE.stars[0];
        A.openMap(0); A.paused = true; A.delivered = 50; A.timeLeft = 5; A.checkEnd(); out.slowAfterFast = A.SAVE.stars[0];
        out.hub = JSON.parse(localStorage.getItem('rh:hub'))['ant-mind'];
        return out;
      });
      eq(r.kill, [true, 3], 'a 1-star replay must not lower 3 stars'); eq(r.nest, true); eq(r.timeout, [true, true]); eq(r.fast, 3); eq(r.slowAfterFast, 3);
      ok(r.hub > 0 && r.hub <= 1, 'hub ' + r.hub);
    },
    'nothing leaks from one map into the next (dig field, particles, hatch timers, deliveries)': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const A = window.__ant; A.SAVE.stars[2] = 1; A.openMap(3); A.paused = true; A.scent.dig.fill(1); for (let k = 0; k < 10; k++) A.stepWorld(0.05); A.delivered = 33;
        const was = A.digMixOn; A.openMap(0); return [was, A.digMixOn, A.fx.length, A.hatchT, A.delivered]; });
      eq(r, [true, false, 0, 0, 0]);
    },
    'locked maps cannot be opened; corrupted saves load safely': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const A = window.__ant; document.querySelector('[data-m="6"]').click(); A.openMap(9);
        return [A.mapI, A.cleanSave(null), A.cleanSave({ stars: { 0: 3, 1: 7, 50: 2 }, ups: ['legs', 'bogus', 3], cur: 99 })]; });
      eq(r[0], 0); eq(r[1], { stars: {}, ups: [], chem: { dep: 100, evap: 50, noise: 35 }, chemSet: {}, cur: 0 }); eq(r[2], { stars: { 0: 3 }, ups: ['legs'], cur: 0, chem: { dep: 100, evap: 50, noise: 35 }, chemSet: {} });
      for (const bad of ['{bad', 'null', '"str"', '{"stars":[],"ups":"x","cur":15}']) {
        await reloadWith(page, 'rh:ant', bad); await page.waitForFunction(() => window.__ant && window.__ant.G);
        eq(await page.evaluate(() => window.__ant.mapI), 0, bad);
      }
    },
    'real mouse and touch both paint forage scent on the canvas': async ({ page, ok }) => {
      const box = await page.evaluate(() => document.getElementById('cv').getBoundingClientRect().toJSON());
      await page.mouse.move(box.x + 60, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 200, box.y + 120, { steps: 8 }); await page.mouse.up();
      const m = await page.evaluate(() => window.__ant.scent.forage.reduce((s, v) => s + v, 0));
      ok(m > 1, 'mouse painted ' + m);
      const t = await page.evaluate(() => { const A = window.__ant; A.scent.forage.fill(0); const cv = document.getElementById('cv'), r = cv.getBoundingClientRect();
        const ev = (ty, x, y) => new PointerEvent(ty, { clientX: r.left + x, clientY: r.top + y, pointerId: 3, pointerType: 'touch', bubbles: true, isPrimary: true, button: 0, buttons: 1 });
        cv.dispatchEvent(ev('pointerdown', 80, 80)); for (let k = 1; k < 10; k++) cv.dispatchEvent(ev('pointermove', 80 + k * 15, 80 + k * 5)); window.dispatchEvent(ev('pointerup', 230, 130));
        return [A.scent.forage.reduce((s, v) => s + v, 0), A.painting]; });
      ok(t[0] > 1 && t[1] === 0, 'touch painted ' + JSON.stringify(t));
    },
    'newcomers who have not painted get a hint banner': async ({ page, ok }) => {
      const b = await page.evaluate(() => { const A = window.__ant; A.openMap(0); A.paused = true; for (let k = 0; k < 9 * 20; k++) A.stepWorld(0.05); return document.getElementById('banner').textContent; });
      ok(/find food on their own/i.test(b), b);
    },
    'windfalls: none on the first map; later maps drop food somewhere reachable, 28-95 steps from the nest': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => {
        const A = window.__ant; A.openMap(0); A.paused = true; const first = A.windT;
        A.SAVE.stars[0] = A.SAVE.stars[1] = 1; A.openMap(2); A.paused = true; const out = [];
        for (let k = 0; k < 6; k++) { const before = A.food.reduce((s, v) => s + v, 0); const w = A.windfall(); const after = A.food.reduce((s, v) => s + v, 0); out.push(w ? [A.home[A.idx(w.x, w.y)], after - before] : null); }
        A.windT = 0.01; A.stepWorld(0.05); const timed = A.windfalls.length;
        return { first, out, timed, banner: document.getElementById('banner').textContent };
      });
      eq(r.first, 1e9, 'no windfalls while learning');
      ok(r.out.every(w => w && w[0] >= 28 && w[0] <= 95 && w[1] > 0), JSON.stringify(r.out)); ok(r.timed >= 7, 'the timer drops one too'); ok(/Fresh food/.test(r.banner), r.banner);
    },
    'tallies: one stroke per unit, gates of five, coarser units for big numbers': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const t = window.__ant.tally; const strokes = (h) => (h.match(/M/g) || []).length; return [strokes(t(0)), strokes(t(4)), strokes(t(5)), strokes(t(12)), /×10/.test(t(120)), strokes(t(120)), /×100/.test(t(1300)), / 1300$/.test(t(1300))]; });
      eq(r, [0, 4, 5, 12, true, 12, true, true]);
    },
    'a win grows the tunnel bloom first, then shows the result': async ({ page, ok }) => {
      const r = await page.evaluate(async () => { const A = window.__ant; window.__lastModal = null; A.openMap(0); A.paused = true; A.delivered = 50; A.checkEnd();
        const early = [!!A.winFx, A.winFx && A.winFx.segs.length, window.__lastModal]; await new Promise(res => setTimeout(res, 2100)); return { early, late: window.__lastModal }; });
      ok(r.early[0] && r.early[1] > 50 && r.early[2] === null, JSON.stringify(r.early)); ok(/colony thrives/.test(r.late), 'modal after the bloom');
    },
    'phones: portrait turns the map on its side, touch maps back to the right cell, and the panel lives in a drawer': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(700);
      const r = await page.evaluate(() => { const A = window.__ant, cv = document.getElementById('cv'), rc = cv.getBoundingClientRect(), c = A.cell;
        const a = A.toScreen(0, 0), b = A.toScreen(A.W, A.H); const mapArea = Math.abs(b[0] - a[0]) * Math.abs(b[1] - a[1]);
        const [sx, sy] = A.toScreen(50, 30); const turned = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]); const back = A.toCell({ clientX: sx, clientY: sy });
        const sideHidden = getComputedStyle(document.getElementById('side')).visibility; document.getElementById('drawerBtn').click(); const sideOpen = getComputedStyle(document.getElementById('side')).visibility;
        return { rot: A.rotated, turned, back, area: mapArea / (390 * 844), sideHidden, sideOpen }; });
      eq([r.rot, r.turned], [true, true]); ok(Math.abs(r.back[0] - 50) < 0.01 && Math.abs(r.back[1] - 30) < 0.01, JSON.stringify(r.back)); ok(r.area > 0.45, 'map area ' + r.area);
      eq([r.sideHidden, r.sideOpen], ['hidden', 'visible']);
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300);
      eq(await page.evaluate(() => window.__ant.rotated), false, 'landscape phones keep the map upright');
    },
    'pan and zoom: scent painted while zoomed lands under the finger, a pinch paints nothing, and Fit frames the whole soil': async ({ page, ok, eq }) => {
      await page.evaluate(() => { window.__ant.paused = true; window.__ant.scent.forage.fill(0); });
      const rc = await page.evaluate(() => document.getElementById('cv').getBoundingClientRect().toJSON());
      await page.mouse.move(rc.x + rc.width / 2, rc.y + rc.height / 2); await page.mouse.wheel(0, -400); await page.waitForTimeout(80);
      const z = await page.evaluate(() => { const A = window.__ant; return { k: A.cam.k }; });
      await page.mouse.move(rc.x + rc.width / 2 - 100, rc.y + rc.height / 2); await page.mouse.down(); await page.mouse.up();
      const hit = await page.evaluate(() => { const A = window.__ant, f = A.scent.forage; let sx = 0, sy = 0, n = 0; for (let i = 0; i < f.length; i++) if (f[i] > 0) { sx += (i % A.W) * f[i]; sy += ((i / A.W) | 0) * f[i]; n += f[i]; } return [sx / n, sy / n, n]; });
      const want = await page.evaluate((q) => window.__ant.toCell({ clientX: q[0], clientY: q[1] }), [rc.x + rc.width / 2 - 100, rc.y + rc.height / 2]);
      ok(hit[2] > 0 && Math.hypot(hit[0] - want[0], hit[1] - want[1]) < 1.5, 'painted under the cursor: ' + JSON.stringify({ hit, want, z }));
      const p = await page.evaluate(async () => { const A = window.__ant, cv = document.getElementById('cv'); A.scent.forage.fill(0); A.cam.fit(); const k0 = A.cam.k;
        const ev = (t, id, x, y, tgt = cv) => tgt.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
        ev('pointerdown', 1, 300, 300); ev('pointerdown', 2, 360, 300); ev('pointermove', 1, 260, 300); ev('pointermove', 2, 400, 300); await new Promise(r => setTimeout(r, 90)); ev('pointermove', 1, 250, 300); ev('pointerup', 1, 250, 300, window); ev('pointerup', 2, 400, 300, window);
        let n = 0; for (const v of A.scent.forage) if (v > 0) n++; const zoomed = A.cam.k / k0;
        document.querySelector('.pz-fit').click(); await new Promise(r => setTimeout(r, 400)); const rc = cv.getBoundingClientRect(), a = A.toScreen(0, 0), b = A.toScreen(A.W, A.H);
        return { painted: n, zoomed, fit: [Math.min(a[0], b[0]) >= rc.left - 1, Math.min(a[1], b[1]) >= rc.top - 1, Math.max(a[0], b[0]) <= rc.right + 1, Math.max(a[1], b[1]) <= rc.bottom + 1] }; });
      eq(p.painted, 0, 'a pinch paints nothing'); ok(p.zoomed > 1.5, 'the pinch zoomed ' + p.zoomed); eq(p.fit, [true, true, true, true], 'Fit frames the soil');
    },
    'difficulty: on late maps idle and greedy chemistry fail; a chemistry tuned to the season wins, but not with three stars': async ({ page, ok }) => {
      await page.addScriptTag({ content: BOT });
      const r = await page.evaluate(() => { const out = []; for (const [mi, tuned] of [[16, 'chem:200/45/50'], [18, 'chem:110/85/50']]) for (const pol of ['idle', 'greedy', tuned]) { const A = window.__ant; A.SAVE.stars = {}; const x = window.__antbot(mi, pol); out.push([mi, pol, x.won, x.stars]); } return out; });
      const naive = r.filter(x => x[1] === 'idle' || x[1] === 'greedy'), tuned = r.filter(x => x[1].startsWith('chem:'));
      ok(naive.filter(x => x[2] && x[3] > 1).length === 0 && naive.filter(x => x[2]).length <= naive.length * 0.2, 'naive: ' + JSON.stringify(naive));
      ok(tuned.every(x => x[2]), 'tuned should win: ' + JSON.stringify(tuned)); ok(tuned.every(x => x[3] < 3), 'three stars need better than a simple tuning: ' + JSON.stringify(tuned));
    },
    'no map is unwinnable: encoded strategies win the hardest maps (Spider Season, Two Fronts, First Frost, Siege, The Long Winter), where idle play fails': async ({ page, ok }) => {
      await page.addScriptTag({ content: BOT });
      // strategy = trail strength / evaporation / wandering / % soldiers hatched [/ 0 = no scout trails]
      const plan = { 9: 'chem:200/40/20/60/0', 13: 'chem:200/40/20/80', 15: 'chem:150/80/50/0', 17: 'chem:200/40/20/80', 19: 'chem:150/80/50/40' };
      const r = await page.evaluate((plan) => { const out = []; for (const [mi, pol] of Object.entries(plan)) { window.__ant.SAVE.stars = {}; const w = window.__antbot(+mi, pol); window.__ant.SAVE.stars = {}; const idle = window.__antbot(+mi, 'idle'); out.push([+mi, w.won, idle.won && idle.stars > 1]); } return out; }, plan);
      for (const [mi, won, idleGood] of r) { ok(won, `map ${mi + 1}: the encoded strategy should win`); ok(!idleGood, `map ${mi + 1}: idle play should not win well`); }
    },
    'ant mill: on Death Spiral the foragers circle a closed trail and starve; fast evaporation or a wiped gap breaks the mill': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = window.__ant; for (let i = 0; i < 20; i++) A.SAVE.stars[i] = 1; const rc = document.getElementById('cv').getBoundingClientRect();
        const run = (chem, wipe) => { A.openMap(7); A.paused = true; if (chem) A.setChem(chem); let t = 0, peak = 0;
          if (wipe){ const m = A.mill; A.strokeStart(); A.painting = -1; for (let d = -6; d <= 6; d++) A.paint((q => ({ clientX: q[0], clientY: q[1] }))(A.toScreen(m.x + m.r + d, m.y))); A.painting = 0; }
          for (; t < 200 * 20 && !A.gameOver; t++) { A.stepWorld(0.05); if (t === 400) peak = A.millShare(); } const [v, n] = A.goalProgress(); return { won: v >= n, peak: Math.round(peak * 100), t: Math.round(t / 20), food: Math.round(A.delivered) }; };
        return { idle: run(null), evap: run({ dep: 200, evap: 80, noise: 0 }) }; });
      ok(!r.idle.won && r.idle.peak >= 80 && r.idle.food < 10, 'idle colony mills: ' + JSON.stringify(r.idle)); ok(r.evap.won, 'evaporation breaks the mill: ' + JSON.stringify(r.evap));
    },
    'mobile layout: no horizontal scroll and the map is fully visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.left >= 0 && r.cv.right <= 390 && r.cv.width > 300, 'canvas ' + JSON.stringify(r.cv));
    },
  },
};
