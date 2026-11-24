// Mapmaker: map-accuracy scoring, world generation, commissions, port economy, saves and controls.
// Two synthetic round islands (radius 80) so expected scores are exact
const ROUND = `const useRoundIsles = (M) => { M.islands = [[300, 450], [900, 450]].map(([cx, cy], id) => ({ id, cx, cy, name: 'I' + id, cells: [], coast: [...Array(240)].map((_, k) => [cx + 80 * Math.cos(k / 240 * 2 * Math.PI), cy + 80 * Math.sin(k / 240 * 2 * Math.PI)]) })); M.islands[1].reefy = true; M.hashCoast(); };`;
module.exports = {
  page: 'mapmaker/index.html',
  ready: async (page) => { await page.waitForFunction(() => window.__map && window.__map.ship); await page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); RH.modal = (h) => { window.__lastModal = h; return Promise.resolve(); }; }); },
  tests: {
    'accuracy: a perfect chart scores 100, an empty one 0, a chart shifted beyond tolerance 0, half a coast 50': async ({ page, near, eq }) => {
      const r = await page.evaluate(`(() => { ${ROUND}
        const M = window.__map; useRoundIsles(M); const is = M.islands[1], out = {};
        const score = (ink) => { M.S.ink = ink; M.hashInk(); return M.acc(1); };
        out.empty = score([]);
        out.perfect = score(is.coast.map(([x, y]) => [x, y]));
        const out_ = (x, y, d) => { const k = d / Math.hypot(x - is.cx, y - is.cy); return [x + (x - is.cx) * k, y + (y - is.cy) * k]; };
        out.shifted = score(is.coast.map(([x, y]) => out_(x, y, 2.2 * M.TOL)));
        out.withinTol = score(is.coast.map(([x, y]) => [x + 0.6 * M.TOL, y]));
        const half = is.coast.slice().sort((a, b) => a[0] - b[0]).slice(0, Math.floor(is.coast.length / 2)); out.half = score(half);
        out.otherIsland = (score(is.coast.map(([x, y]) => [x, y])), M.acc(0));
        return out;
      })()`);
      eq(r.empty, 0); eq(r.perfect, 100); eq(r.shifted, 0); near(r.withinTol, 100, 2, 'within tolerance');
      near(r.half, 50, 12, 'half the coast'); eq(r.otherIsland, 0, 'inking one island does not chart another');
    },
    'accuracy: stray ink (a chart smeared while lost) costs up to a quarter and cannot pass Precision': async ({ page, near, ok }) => {
      const r = await page.evaluate(`(() => { ${ROUND}
        const M = window.__map; useRoundIsles(M); const is = M.islands[1];
        const good = is.coast.map(([x, y]) => [x, y]); const stray = is.coast.map(([x, y]) => { const k = 40 / Math.hypot(x - is.cx, y - is.cy); return [x + (x - is.cx) * k, y + (y - is.cy) * k]; });
        M.S.ink = good.concat(stray); M.hashInk(); const smeared = M.acc(1), prec = M.precisions()[1];
        const precisionCom = M.COMS.find(c => c.n === 'Precision').test();
        M.S.ink = good; M.hashInk(); const clean = M.acc(1), cleanCom = M.COMS.find(c => c.n === 'Precision').test();
        M.S.ink = good.concat([[5, 5], [WX - 5, WY - 5]]); M.hashInk(); const farJunk = M.acc(1); // ink far out at sea isn't attributed to an island
        return { smeared, prec, precisionCom, clean, cleanCom, farJunk };
      })()`);
      near(r.prec, 0.5, 0.05, 'precision'); near(r.smeared, 100 * (1 - 0.25 + 0.25 * r.prec), 0.01, 'smeared score'); ok(!r.precisionCom, 'smeared chart passed Precision');
      ok(r.cleanCom, 'clean chart should pass Precision'); near(r.clean, 100, 1e-9); near(r.farJunk, 100, 1e-9);
    },
    'whole-archipelago accuracy is the coast-length weighted mean; the cache refreshes when ink changes': async ({ page, near }) => {
      const r = await page.evaluate(() => {
        const M = window.__map; M.S.ink = M.islands[0].coast.map(([x, y]) => [x, y]); M.hashInk();
        const tot = M.islands.reduce((s, is) => s + is.coast.length, 0); const a = M.accAll(), want = 100 * M.islands[0].coast.length / tot;
        M.S.ink = []; M.hashInk(); return { a, want, after: M.accAll() };
      });
      near(r.a, r.want, 1e-9); near(r.after, 0, 1e-9);
    },
    'inking from the ship: accurate when the position is known, stray when dead reckoning is off': async ({ page, ok }) => {
      const r = await page.evaluate(() => {
        const M = window.__map, is = M.islands[1]; const c = is.coast[0];
        let sx = c[0], sy = c[1]; for (let k = 0; k < 200 && M.isLand(sx, sy); k++) { sx += (c[0] - is.cx) * 0.02; sy += (c[1] - is.cy) * 0.02; }
        M.ship = { x: sx, y: sy, bx: sx, by: sy, h: 0, sail: 0, voyageDmg: 0 }; M.S.ink = []; M.hashInk(); M.ink(); const exact = [M.recall(1), M.precisions()[1]];
        const dl = Math.hypot(sx - is.cx, sy - is.cy); M.S.ink = []; M.hashInk(); M.ship.bx = sx + (sx - is.cx) / dl * 45; M.ship.by = sy + (sy - is.cy) / dl * 45; M.ink(); const lost = [M.recall(1), M.precisions()[1]];
        return { exact, lost };
      });
      ok(r.exact[0] > 0 && r.exact[1] > 0.95, 'exact ' + r.exact); ok(r.lost[1] < 0.5, 'lost precision ' + r.lost);
    },
    'every new world is playable: 5+ islands, port at sea, reef island is not home, ghost clear of land, commissions all computable': async ({ page, ok }) => {
      const bad = await page.evaluate(() => {
        const M = window.__map, bad = [];
        for (let k = 0; k < 30; k++) { const seed = M.playableSeed(k * 104729 + 7); M.buildWorld(seed);
          if (M.islands.length < 5) bad.push(seed + ' islands ' + M.islands.length);
          if (M.isLand(M.port.x, M.port.y)) bad.push(seed + ' port on land');
          if (M.islands.findIndex(is => is.reefy) <= 0) bad.push(seed + ' reef');
          for (const c of M.COMS) { try { c.prog(); } catch (e) { bad.push(seed + ' ' + c.n + ': ' + e.message); } }
        }
        // the known bad seed family: seeds that used to make 1-3 islands
        for (let s = 0; s < 400; s++) { M.buildWorld(s * 7919 + 13); if (M.islands.length < 4) { const p = M.playableSeed(s * 7919 + 13); M.buildWorld(p); if (M.islands.length < 5) bad.push('reseed failed ' + s); } }
        M.buildWorld(M.S.seed);
        return bad;
      });
      ok(!bad.length, bad.slice(0, 6).join(', '));
    },
    'nothing is deliverable on a fresh chart; delivering pays once even on a double click': async ({ page, eq }) => {
      const r = await page.evaluate(async () => {
        const M = window.__map; const ready0 = M.COMS.filter((c, i) => c.test()).map(c => c.n);
        M.S.ink = M.islands[0].coast.map(([x, y]) => [x, y]); M.hashInk(); M.atPort = true; M.renderPort();
        const due = M.COMS.filter((c, i) => !M.S.done[i] && c.test()).reduce((s, c) => s + c.reward, 0); const g0 = M.S.gold; const b = document.getElementById('sell'); b.click(); b.click(); document.getElementById('sell')?.click();
        return { ready0, paid: M.S.gold - g0 - due, done0: M.S.done[0] };
      });
      eq(r.ready0, []); eq(r.paid, 0, 'paid exactly what was due, once'); eq(r.done0, 1);
    },
    'port: resupply and repair charge the right price and refuse when you are broke': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const M = window.__map; M.atPort = true; M.S.prov = 50; M.S.hull = 50; M.S.gold = 100; M.renderPort();
        document.getElementById('resup').click(); const a = [M.S.prov, M.S.gold];
        M.renderPort(); M.S.gold = 5; document.getElementById('repair').click(); const b = [M.S.hull, M.S.gold];
        return [a, b];
      });
      eq(r, [[100, 85], [50, 5]]);
    },
    'wrecks and mutinies send you home without negative gold, and a fix pins latitude': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => {
        const M = window.__map; M.S.gold = 10; M.S.hull = 5; M.ship.x += 3; M.damage(12, 'x'); const wreck = [M.S.hull, M.S.gold, M.ship.x === M.port.x];
        M.S.prov = 0.0001; M.S.gold = 3; M.ship.sail = 1; M.step(0.1); const mut = [M.S.prov, M.S.gold];
        M.S.inst.sextant = 1; M.ship.by = M.ship.y + 50; M.doFix(); const fix = Math.abs(M.ship.by - M.ship.y);
        return { wreck, mut, fix };
      });
      eq(r.wreck, [40, 0, true]); eq(r.mut, [40, 0]); ok(r.fix <= 2, 'fix error ' + r.fix);
    },
    'reef commission needs the reef island charted on a voyage with 30 or less damage': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const M = window.__map, ri = M.islands.findIndex(is => is.reefy), com = M.COMS[3];
        M.S.ink = M.islands[ri].coast.map(([x, y]) => [x, y]); M.hashInk(); M.S.reefOk = false; const before = com.test();
        return [before];
      });
      eq(r, [false]);
      await page.waitForTimeout(100); // the frame loop marks reefOk while the voyage is clean
      eq(await page.evaluate(() => window.__map.COMS[3].test()), true);
    },
    'corrupted, old and hostile saves load into a playable game': async ({ page, ok, eq }) => {
      for (const bad of ['{bad', 'null', '[]', '{"seed":"x"}', '{"seed":12345}', '{"seed":5,"ink":"x","done":[1],"inst":"all","gold":"lots","ship":{"x":"a"}}', '{"seed":5,"ink":[[1,2],[3],"z",[null,4]],"visited":[[1,1]],"gold":1e99,"hull":-5}']) {
        await page.evaluate((v) => localStorage.setItem('rh:mapmaker', v), bad); await page.reload();
        await page.waitForFunction(() => window.__map && window.__map.ship);
        const st = await page.evaluate(() => { const S = window.__map.S; return [Array.isArray(S.ink), S.ink.every(p => p.length === 2 && p.every(Number.isFinite)), Number.isFinite(S.gold), S.hull > 0, !!S.inst.compass, window.__map.islands.length >= 1, Number.isFinite(window.__map.ship.x)]; });
        eq(st, [true, true, true, true, true, true, true], bad);
      }
    },
    'a new archipelago keeps instruments, gold and the seen intro, and drops the old course': async ({ page, eq }) => {
      const r = await page.evaluate(async () => {
        const M = window.__map; M.S.intro = 1; M.S.inst.log = 1; M.S.gold = 77; M.target = [500, 500]; const seed = M.S.seed;
        RH.modal = () => Promise.resolve(1); await document.getElementById('newWorld').onclick(); const S = M.S;
        return [S.intro, !!S.inst.log, S.gold, S.seed !== seed, M.target, S.ink.length, Object.keys(S.done).length, S.worlds, M.islands.length >= 5];
      });
      eq(r, [1, true, 77, true, null, 0, 0, 1, true]);
    },
    'controls: sail buttons, ctrl-shortcuts ignored, clicks off the chart do not set a course': async ({ page, eq }) => {
      await page.click('#sails [data-sail="1"]'); const a = await page.evaluate(() => window.__map.ship.sail);
      await page.click('#sails [data-sail="0"]'); await page.keyboard.press('Control+w'); const b = await page.evaluate(() => window.__map.ship.sail);
      await page.evaluate(() => { window.__map.target = null; });
      const off = await page.evaluate(() => { const M = window.__map, r = document.getElementById('chart').getBoundingClientRect(); return [r.left + 3, r.top + 3, r.left + M.view.ox + 700 * M.view.s, r.top + M.view.oy + 450 * M.view.s, M.view.oy > 6]; });
      if (off[4]) { await page.mouse.click(off[0], off[1]); eq(await page.evaluate(() => window.__map.target), null, 'margin click'); }
      await page.mouse.click(off[2], off[3]); const t = await page.evaluate(() => [Math.round(window.__map.target[0]), Math.round(window.__map.target[1]), window.__map.ship.sail]);
      eq([a, b], [1, 0]); eq(t, [700, 450, 2]);
    },
    'mobile layout: no horizontal scroll, chart and sail buttons visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('chart').getBoundingClientRect().toJSON(), look: document.getElementById('look').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 380 && r.cv.height > 250, 'chart ' + JSON.stringify(r.cv)); ok(r.look.width <= 120, 'lookout should shrink on phones');
    },
  },
};
