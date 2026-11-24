// Ant Mind: map data, pathfinding, scent painting, goals/stars, saves and input.
const paintTrail = `(mi) => { const A = window.__ant; const cv = document.getElementById('cv'), rc = cv.getBoundingClientRect();
  const ev = (x, y) => ({ clientX: rc.left + x * A.cell, clientY: rc.top + y * A.cell });
  let k = -1, bd = 1e9; for (let i = 0; i < A.W * A.H; i++) if (A.food[i] > 0 && A.home[i] < bd) { bd = A.home[i]; k = i; }
  const path = []; let x = k % A.W, y = (k / A.W) | 0;
  for (let s = 0; s < 400; s++) { path.push([x, y]); let bx = x, by = y, bv = A.home[A.idx(x, y)];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= A.W || Y >= A.H) continue; if (A.home[A.idx(X, Y)] < bv) { bv = A.home[A.idx(X, Y)]; bx = X; by = Y; } }
    if (bx === x && by === y) break; x = bx; y = by; }
  path.reverse(); A.painting = 1; A.brush = 'forage'; for (let i = 0; i < path.length; i += 2) A.paint(ev(path[i][0] + 0.5, path[i][1] + 0.5)); A.painting = 0; }`;
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
    'a scent trail from nest to food wins First Light quickly; doing nothing does not': async ({ page, ok }) => {
      const r = await page.evaluate(`(() => { const A = window.__ant; const trail = ${paintTrail};
        A.openMap(0); A.paused = true; let t = 0; for (; t < 150 * 20 && !A.gameOver; t++) { if (t % 300 === 0) trail(0); A.stepWorld(0.05); }
        const won = [A.gameOver, A.delivered, t / 20, A.SAVE.stars[0]];
        A.openMap(0); A.paused = true; for (let k = 0; k < 150 * 20 && !A.gameOver; k++) A.stepWorld(0.05);
        return { won, idle: A.delivered }; })()`);
      ok(r.won[0] && r.won[1] >= 50 && r.won[2] < 90, 'trail run ' + JSON.stringify(r.won));
      ok(r.won[3] >= 2, 'a fast clear earns at least two stars: ' + r.won[3]);
      ok(r.idle < 50, 'idle colony delivered ' + r.idle);
    },
    'gland reserve never goes negative and an empty gland paints nothing; right-drag erases every scent': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const A = window.__ant, rc = document.getElementById('cv').getBoundingClientRect(); A.openMap(0); A.paused = true;
        const ev = (x, y) => ({ clientX: rc.left + x * A.cell, clientY: rc.top + y * A.cell });
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
      eq(r[0], 0); eq(r[1], { stars: {}, ups: [], cur: 0 }); eq(r[2], { stars: { 0: 3 }, ups: ['legs'], cur: 0 });
      for (const bad of ['{bad', 'null', '"str"', '{"stars":[],"ups":"x","cur":15}']) {
        await page.evaluate((v) => localStorage.setItem('rh:ant', v), bad); await page.reload(); await page.waitForFunction(() => window.__ant && window.__ant.G);
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
      const b = await page.evaluate(() => { const A = window.__ant; A.openMap(0); A.paused = true; for (let k = 0; k < 7 * 20; k++) A.stepWorld(0.05); return document.getElementById('banner').textContent; });
      ok(/drag from your nest/i.test(b), b);
    },
    'mobile layout: no horizontal scroll and the map is fully visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.left >= 0 && r.cv.right <= 390 && r.cv.width > 300, 'canvas ' + JSON.stringify(r.cv));
    },
  },
};
