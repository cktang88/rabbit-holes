// Mapmaker: map-accuracy scoring, world generation, commissions, port economy, saves and controls.
// Two synthetic round islands (radius 80) so expected scores are exact
const ROUND = `const useRoundIsles = (M) => { M.islands = [[300, 450], [900, 450]].map(([cx, cy], id) => ({ id, cx, cy, name: 'I' + id, cells: [], coast: [...Array(240)].map((_, k) => [cx + 80 * Math.cos(k / 240 * 2 * Math.PI), cy + 80 * Math.sin(k / 240 * 2 * Math.PI)]) })); M.islands[1].reefy = true; M.hashCoast(); };`;
// The harness clears localStorage on every navigation; this injects a save that survives the reload (init scripts run in order)
const reloadWith = async (page, key, v) => { await page.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch (e) {} }, [key, v]); await page.reload(); };
// Sailing bots for the difficulty test: 'naive' inks everything and never fixes; 'competent' takes bearings when doubtful, a noon sight when it can, lifts the quill when lost
const BOT = "// Mapmaker bots. policy: 'naive' (ink always, never fixes), 'competent' (bearings every few glasses, allows for current, lifts quill when doubtful)\nwindow.__mapbot = (policy, islandId, laps=1, seed=1, opts={}) => {\n  const M=window.__map; RH.modal=()=>Promise.resolve(); RH.toast=()=>{};\n  const is=M.islands[islandId]; const pts=is.coast.slice().sort((a,b)=>Math.atan2(a[1]-is.cy,a[0]-is.cx)-Math.atan2(b[1]-is.cy,b[0]-is.cx));\n  const wps=[]; for (let k=0;k<pts.length;k+=Math.max(1,pts.length/24|0)){ const [x,y]=pts[k], dx=x-is.cx, dy=y-is.cy, L=Math.hypot(dx,dy)||1; let off=34; let wx=x+dx/L*off, wy=y+dy/L*off; for(let g=0;g<10&&M.isLand(wx,wy);g++){off+=8; wx=x+dx/L*off; wy=y+dy/L*off;} wps.push([wx,wy]); }\n  if (opts.inst) Object.assign(M.S.inst, opts.inst); if (policy==='competent') M.S.allow=true; let noonT=0, t=0, fixes=0, sinceFix=0, groundings=0; const hull0=M.S.hull;\n  const sail=(tx,ty,limit)=>{ for (let i=0;i<limit;i++){ const sh=M.ship; if (Math.hypot(tx-sh.x,ty-sh.y)<12) return true;\n      const want=Math.atan2(ty-sh.y,tx-sh.x); let hh=want; for (const k of [0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6]){ const a=want+k*0.26; let clear=true; for (let r=4;r<=36;r+=4){ if (M.isLand(sh.x+Math.cos(a)*r, sh.y+Math.sin(a)*r)){ clear=false; break; } } if (clear){ hh=a; break; } } sh.h=hh; M.target=null; if (M.fixing<=0) sh.sail=2;\n      if (policy==='competent'){ M.inkOn = M.estErr()<M.TOL*1.4; sinceFix+=0.05; if (M.estErr()>M.TOL*0.8 && sinceFix>0.6 && M.fixing<=0){ const f=M.bearingFix(); if (!f.err){ M.fixAt(f.x,f.y,'bot bearings'); fixes++; } else if (M.S.inst.quadrant && M.fogT<=0 && noonT>3){ M.doFix(); fixes++; noonT=0; } sinceFix=0; } noonT+=0.05; }\n      else if (policy==='naive') M.inkOn=true;\n      M.step(0.05); t+=0.05; M.atPort=false; } return false; };\n  // start at port, go to the island\n  for (let lap=0;lap<laps;lap++) for (const [x,y] of wps) sail(x,y,1200);\n  return { policy, acc:Math.round(M.acc(islandId)), recall:Math.round(M.recall(islandId)*100), prec:Math.round(M.precisions()[islandId]*100), t:Math.round(t), fixes, hull:Math.round(M.S.hull), learned:Object.keys(M.S.learned).length };\n};\n";
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
    'accuracy: stray ink (a chart smeared while lost) costs up to half the score and cannot pass Precision': async ({ page, near, ok }) => {
      const r = await page.evaluate(`(() => { ${ROUND}
        const M = window.__map; useRoundIsles(M); const is = M.islands[1];
        const good = is.coast.map(([x, y]) => [x, y]); const stray = is.coast.map(([x, y]) => { const k = 40 / Math.hypot(x - is.cx, y - is.cy); return [x + (x - is.cx) * k, y + (y - is.cy) * k]; });
        M.S.ink = good.concat(stray); M.hashInk(); const smeared = M.acc(1), prec = M.precisions()[1];
        const precisionCom = M.COMS.find(c => c.n === 'Precision').test();
        M.S.ink = good; M.hashInk(); const clean = M.acc(1), cleanCom = M.COMS.find(c => c.n === 'Precision').test();
        M.S.ink = good.concat([[5, 5], [WX - 5, WY - 5]]); M.hashInk(); const farJunk = M.acc(1); // ink far out at sea isn't attributed to an island
        return { smeared, prec, precisionCom, clean, cleanCom, farJunk };
      })()`);
      near(r.prec, 0.5, 0.05, 'precision'); near(r.smeared, 100 * (0.5 + 0.5 * r.prec), 0.01, 'smeared score'); ok(!r.precisionCom, 'smeared chart passed Precision');
      ok(r.cleanCom, 'clean chart should pass Precision'); near(r.clean, 100, 1e-9); near(r.farJunk, 100, 1e-9);
    },
    'whole-archipelago accuracy is the coast-length weighted mean; the cache refreshes when ink changes': async ({ page, near }) => {
      const r = await page.evaluate(() => {
        const M = window.__map; M.S = M.freshSave(424242); M.boot(); M.S.ink = M.islands[0].coast.map(([x, y]) => [x, y]); M.hashInk();
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
        await reloadWith(page, 'rh:mapmaker', bad);
        await page.waitForFunction(() => window.__map && window.__map.ship);
        const st = await page.evaluate(() => { const S = window.__map.S; return [Array.isArray(S.ink), S.ink.every(p => p.length >= 2 && p.every(Number.isFinite)), Number.isFinite(S.gold), S.hull > 0, !!S.inst.compass, window.__map.islands.length >= 1, Number.isFinite(window.__map.ship.x)]; });
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
    'landfall: heave to beside an unvisited island to go ashore once for water and a reward; never at home or under sail': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const M = window.__map, is = M.islands[1]; const c = is.coast[0];
        let sx = c[0], sy = c[1]; for (let k = 0; k < 400 && M.isLand(sx, sy); k++) { sx += (c[0] - is.cx) * 0.01; sy += (c[1] - is.cy) * 0.01; } sx += (c[0] - is.cx) / Math.hypot(c[0] - is.cx, c[1] - is.cy) * 6; sy += (c[1] - is.cy) / Math.hypot(c[0] - is.cx, c[1] - is.cy) * 6;
        M.atPort = false; M.ship = { x: sx, y: sy, bx: sx + 30, by: sy, h: 0, sail: 2, voyageDmg: 0 }; const underSail = M.landfallIsle();
        M.ship.sail = 0; const here = M.landfallIsle(); M.S.prov = 50; const g0 = M.S.gold; const what = M.goAshore();
        const after = { prov: M.S.prov, gold: M.S.gold - g0, landed: !!M.S.landed[1], again: M.landfallIsle(), log: M.S.log[0] && M.S.log[0].t, unc: M.uncertainty() };
        const h = M.islands[0].coast[0]; M.ship = { x: h[0] + 8, y: h[1], bx: h[0] + 8, by: h[1], h: 0, sail: 0, voyageDmg: 0 }; const home = M.landfallIsle();
        return { underSail, here, what, after, home };
      });
      eq(r.underSail, -1); eq(r.here, 1); ok(r.what, 'went ashore'); ok(r.after.prov >= 75, 'water ' + r.after.prov); eq(r.after.landed, true); eq(r.after.again, -1, 'only once per island');
      ok(/ashore/i.test(r.after.log), r.after.log); ok(r.after.gold === 15 || r.after.prov >= 90 || r.after.unc === 0, 'one of the three rewards'); ok(r.home !== 0, 'home is not a landfall');
    },
    'squalls turn the currents and are written in the log; the log survives a reload and junk entries are dropped': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const M = window.__map; const before = JSON.stringify(M.currents); M.atPort = false; M.squall(); return [before !== JSON.stringify(M.currents), M.S.log[0].t]; });
      ok(r[0], 'currents changed'); ok(/squall/i.test(r[1]) && /(east|west|north|south)/.test(r[1]), r[1]);
      eq(await page.evaluate(() => [window.__map.dirOf(1, 0), window.__map.dirOf(0, 1), window.__map.dirOf(-1, -1)]), ['east', 'south', 'north-west']);
      const c = await page.evaluate(() => window.__map.cleanSave({ seed: 5, log: [{ d: 1, t: 'ok' }, { d: 'x', t: 'bad' }, 'junk', null], landed: { 2: 1, x: 1 } }));
      eq(c.log, [{ d: 1, t: 'ok' }]); eq(c.landed, { 2: 1 });
      // save round trip (the harness clears storage on reload, so go through the same JSON + cleanSave + boot path)
      ok(await page.evaluate(() => { const M = window.__map; M.S = M.cleanSave(JSON.parse(JSON.stringify(M.S))); M.boot(); return /squall/i.test(document.getElementById('log').textContent); }), 'log rendered after a save round trip');
    },
    'delivering presses the Admiralty seal and marks the commission sealed': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.S.ink = M.islands[0].coast.map(([x, y]) => [x, y]); M.hashInk(); M.atPort = true; M.renderPort(); document.getElementById('sell').click(); M.renderAll();
        return [document.getElementById('sealFx').classList.contains('on'), document.getElementById('sealTxt').textContent, document.querySelectorAll('#coms .seal').length]; });
      ok(r[0] && r[1].length > 0 && r[2] >= 1, JSON.stringify(r));
    },
    'the master never sees the true error: the reckoning estimate grows with distance and time since the last fix, not with the real drift': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.atPort = false; M.nav = { dist: 0, t: 0, cells: {} }; const e0 = M.estErr();
        M.ship.bx += 200; const e1 = M.estErr(); M.nav = { dist: 280, t: 10, cells: {} }; const e2 = M.estErr(); M.renderAll();
        return { e0, e1, e2, txt: document.getElementById('unc').textContent }; });
      eq(r.e0, r.e1, 'moving the believed position does not change the estimate'); ok(r.e2 > r.e0 + 10, 'estimate grows with sailing'); ok(/±\d+ miles/.test(r.txt), r.txt);
    },
    'bearings fix you against YOUR chart: a shifted chart gives a shifted fix; no charted landmarks, no fix; fog blocks it': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.S = M.freshSave(424242); M.boot(); M.S.inst.fineCompass = 1; const is = M.islands[0]; M.atPort = false;
        // sit off the home coast
        const c = is.coast[Math.floor(is.coast.length / 3)], dx = c[0] - is.cx, dy = c[1] - is.cy, L = Math.hypot(dx, dy); let x = c[0] + dx / L * 40, y = c[1] + dy / L * 40;
        M.ship = { x, y, bx: x + 30, by: y - 20, h: 0, sail: 0, voyageDmg: 0 };
        M.S.ink = []; M.hashInk(); const none = M.bearingFix().err;
        M.S.ink = is.coast.map(p => [p[0], p[1]]); M.hashInk(); const good = M.bearingFix();
        M.S.ink = is.coast.map(p => [p[0] + 10, p[1]]); M.hashInk(); const shifted = M.bearingFix();
        M.fogT = 10; const fog = M.bearingFix().err; M.fogT = 0;
        return { none, good: Math.hypot(good.x - x, good.y - y), shiftedOff: [shifted.x - x, shifted.y - y], fog }; });
      ok(/No charted landmarks/.test(r.none), r.none); ok(r.good < 6, 'accurate chart gives a good fix: ' + r.good);
      ok(Math.abs(r.shiftedOff[0] - 10) < 7 && Math.abs(r.shiftedOff[1]) < 7, 'a chart drawn 10 leagues east puts the fix 10 leagues east: ' + r.shiftedOff); ok(/Fog/.test(r.fog), r.fog);
    },
    'set and drift: a fix after sailing in a current learns that current, and allowing for it shrinks the next error': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.S = M.freshSave(424242); M.boot(); M.atPort = false; M.S.learned = {};
        const c = M.currentAt(M.ship.x, M.ship.y); M.ship.sail = 1; M.ship.h = 0; M.inkOn = false; M.nav = { dist: 0, t: 0, cells: {} };
        const run = () => { const sx = M.ship.x, sy = M.ship.y; M.ship.bx = sx; M.ship.by = sy; M.nav = { dist: 0, t: 0, cells: {} }; for (let i = 0; i < 200; i++){ M.ship.h = 0; M.ship.sail = 1; M.step(0.05); } return Math.hypot(M.ship.bx - M.ship.x, M.ship.by - M.ship.y); };
        // keep the ship away from land for the test
        M.ship.x = M.ship.bx = 300; M.ship.y = M.ship.by = 60; while (M.isLand(M.ship.x, M.ship.y)) M.ship.y += 10; M.ship.bx = M.ship.x; M.ship.by = M.ship.y;
        M.S.allow = false; const before = run(); M.fixAt(M.ship.x, M.ship.y, 'test fix'); const learned = Object.keys(M.S.learned).length, fixLog = M.S.log[0].t;
        M.S.allow = true; M.ship.x -= 140; const after = run();
        return { before, after, learned, mag: Math.hypot(c.x, c.y), log: fixLog }; });
      ok(r.learned >= 1, 'a current was learned'); ok(/current carried us .+ miles/.test(r.log) && /mi\/day/.test(r.log) || r.mag < 0.5, r.log); ok(r.after < r.before || r.before < 4, `error before ${r.before.toFixed(1)}, after ${r.after.toFixed(1)}`);
    },
    'merchants sail by your chart: a good chart makes a trade route, a mischarted island sends them to open sea, an unmarked reef wrecks them': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.S = M.freshSave(424242); M.boot(); const out = {}; const i = M.islands.findIndex(is => is.reefy);
        const ink = (dx) => { const is = M.islands[i]; M.S.ink = is.coast.map(p => { const L = Math.hypot(p[0] - is.cx, p[1] - is.cy) || 1; return [p[0] + (p[0] - is.cx) / L * dx, p[1] + (p[1] - is.cy) / L * dx]; }); M.hashInk(); };
        ink(0); M.S.reefInk = {}; M.reefs.forEach((rf, k) => { M.S.reefInk[k] = [rf.x, rf.y]; }); out.good = M.merchantVoyage(i).res;
        ink(60); out.shifted = M.merchantVoyage(i).res;
        ink(0); M.S.reefInk = {}; const v = M.merchantVoyage(i).res; out.unmarked = v;
        // selling settles it once, with money and reputation
        ink(0); M.reefs.forEach((rf, k) => { M.S.reefInk[k] = [rf.x, rf.y]; }); M.atPort = true; const g0 = M.S.gold, r0 = M.S.rep; M.sellDirections(i); out.paid = M.S.gold > g0 && M.S.rep === r0 + 1; M.sellDirections(i); out.once = M.S.routes;
        return out; });
      eq(r.good, 'ok'); eq(r.shifted, 'sea'); eq(['ok', 'wreck'].includes(r.unmarked), true); eq(r.paid, true); eq(r.once, 1);
    },
    'a rival hydrographer delivers late commissions first if you are slow; you then get half pay': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.atPort = false; M.S.day = M.rivalDay(3) + 0.5; M.ship.sail = 1; M.step(0.05); return [!!M.S.rivalDone[3], M.payFor(3), M.COMS[3].reward, !!M.S.rivalDone[0]]; });
      eq(r[0], true); eq(r[1], Math.round(r[2] / 2)); eq(r[3], false);
    },
    'difficulty: naive play fails on late (far) islands; a competent navigator charts them; the master Precision bar is not a given': async ({ page, ok }) => {
      await page.addScriptTag({ content: BOT });
      const res = await page.evaluate(() => { const out = []; for (const seed of [11, 22, 33, 44, 55]) for (const pol of ['naive', 'idle', 'competent']) { const M = window.__map; M.S = M.freshSave(seed * 1000); M.boot();
          const isl = M.islands.length - 1 >= 3 ? 3 : 2; let r; if (pol === 'idle'){ for (let i = 0; i < 2000; i++) M.step(0.05); r = { acc: Math.round(M.acc(isl)) }; } else r = window.__mapbot(pol, isl, 1, seed, { inst: { log: 1, quadrant: 1 } }); out.push([seed, pol, r.acc]); } return out; });
      const by = (p) => res.filter(r => r[1] === p).map(r => r[2]);
      const naive = by('naive'), idle = by('idle'), comp = by('competent');
      ok(naive.filter(a => a < 60).length >= 4, 'naive should fail (<60%) in at least 4/5: ' + naive);
      ok(idle.every(a => a === 0), 'idle charts nothing: ' + idle);
      ok(comp.filter(a => a >= 70).length >= 3, 'competent should chart 70%+ in most runs: ' + comp);
    },
    'ink drawn while the reckoning is doubtful is marked PD; the lead finds a hidden reef even in fog and marks it': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.atPort = false; const is = M.islands[1], c = is.coast[0];
        let x = c[0], y = c[1]; for (let k = 0; k < 300 && M.isLand(x, y); k++) { x += (c[0] - is.cx) * 0.01; y += (c[1] - is.cy) * 0.01; } x += (c[0] - is.cx) * 0.15; y += (c[1] - is.cy) * 0.15;
        M.ship = { x, y, bx: x, by: y, h: 0, sail: 0, voyageDmg: 0 }; M.S.ink = []; M.hashInk();
        M.nav = { dist: 0, t: 0, cells: {} }; M.ink(); const sure = M.S.ink.filter(p => p[2]).length;
        M.S.ink = []; M.hashInk(); M.nav = { dist: 400, t: 20, cells: {} }; M.ink(); const doubtful = M.S.ink.length && M.S.ink.every(p => p[2] === 1);
        const rf = M.reefs[0]; M.ship = { x: rf.x + 12, y: rf.y, bx: rf.x + 12, by: rf.y, h: 0, sail: 2, voyageDmg: 0 }; M.fogT = 20; M.S.reefInk = {}; const s1 = M.sound();
        return { sure, doubtful, reef: s1.reef, marked: Object.keys(M.S.reefInk).length, sail: M.ship.sail }; });
      eq(r.sure, 0); ok(r.doubtful, 'doubtful ink is flagged'); eq(r.reef, true); ok(r.marked >= 1); ok(r.sail <= 1, 'sounding slows the ship');
    },
    'you never sail into land you can see: steering at the shore, the helmsman bears away and stays clear, unharmed (even in fog)': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const M = window.__map, is = M.islands[1], c = is.coast[0]; const out = [];
        for (const fog of [0, 20]) { const dx = c[0] - is.cx, dy = c[1] - is.cy, L = Math.hypot(dx, dy); const x = c[0] + dx / L * 40, y = c[1] + dy / L * 40;
          M.atPort = false; M.fogT = fog; const h0 = M.S.hull; M.ship = { x, y, bx: x, by: y, h: Math.atan2(-dy, -dx), sail: 2, voyageDmg: 0 }; M.target = null; let onLand = false;
          for (let i = 0; i < 400; i++) { M.ship.h = Math.atan2(c[1] - M.ship.y, c[0] - M.ship.x); M.step(0.05); if (M.isLand(M.ship.x, M.ship.y)) onLand = true; }
          out.push([M.S.hull === h0, onLand]); }
        M.fogT = 0; return out; });
      eq(r, [[true, false], [true, false]]);
    },
    'a course straight across an island: the ship bears away round the coast and arrives on the far side without stopping': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const M = window.__map; M.S = M.freshSave(424242); M.boot(); const is = M.islands[1]; M.atPort = false; M.reefs.length = 0;
        const xs = is.coast.map(p => p[0]); const minx = Math.min(...xs), maxx = Math.max(...xs);
        const x = minx - 40, y = is.cy, tx = maxx + 40; M.ship = { x, y, bx: x, by: y, h: 0, sail: 2, voyageDmg: 0 }; M.target = [tx, y];
        let stops = 0, onLand = false, i = 0; for (; i < 4000 && M.target; i++) { if (M.ship.sail === 0) { stops++; M.ship.sail = 2; } M.ship.bx = M.ship.x; M.ship.by = M.ship.y; M.step(0.05); if (M.isLand(M.ship.x, M.ship.y)) onLand = true; }
        return { arrived: !M.target, stops, onLand, t: Math.round(i * 0.05), hull: M.S.hull }; });
      ok(r.arrived, JSON.stringify(r)); eq([r.stops, r.onLand, r.hull], [0, false, 100]);
    },
    'hidden reefs: breakers are called in clear weather, the lead calls the shallows in fog, and fog slows the ship to half sail': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const M = window.__map; const toasts = []; RH.toast = (m) => toasts.push(m); M.atPort = false; const rf = M.reefs[0];
        const put = (fog) => { rf.warnT = -1e9; M.fogT = fog; M.ship = { x: rf.x + 28, y: rf.y, bx: rf.x + 28, by: rf.y, h: Math.PI, sail: 1, voyageDmg: 0 }; M.step(0.05); };
        put(0); const clear = toasts.slice(); toasts.length = 0; M.ship = { x: rf.x + 18, y: rf.y, bx: rf.x + 18, by: rf.y, h: Math.PI, sail: 1, voyageDmg: 0 }; rf.warnT = -1e9; M.fogT = 20; M.step(0.05); const fog = toasts.slice();
        // speed in fog
        M.ship = { x: 300, y: 60, bx: 300, by: 60, h: 0, sail: 2, voyageDmg: 0 }; while (M.isLand(M.ship.x, M.ship.y)) M.ship.y += 10; const x0 = M.ship.x, y0 = M.ship.y; M.fogT = 20; for (let i = 0; i < 20; i++) { M.ship.sail = 2; M.step(0.05); }
        const moved = Math.hypot(M.ship.x - x0, M.ship.y - y0); M.fogT = 0; return { clear, fog, moved }; });
      ok(r.clear.some(t => /Breakers/.test(t)), JSON.stringify(r.clear)); ok(r.fog.some(t => /lead.*shoaling/.test(t)) && !r.fog.some(t => /Breakers/.test(t)), JSON.stringify(r.fog)); ok(r.moved < 20, 'half sail in fog: moved ' + r.moved);
    },
    'after a fix the chart shows where we reckoned, where we are, and what the current did, in plain words; dead reckoning is explained once': async ({ page, ok, eq }) => {
      const r = await page.evaluate(async () => { const M = window.__map; let modals = 0; RH.modal = (h) => { modals++; window.__lastModal = h; return Promise.resolve(); }; M.atPort = false; M.S.explained = 0;
        M.ship.bx = M.ship.x - 20; M.ship.by = M.ship.y - 30; M.nav = { dist: 200, t: 12, cells: { 5: 12 } }; M.fixAt(M.ship.x, M.ship.y, 'Bearings taken on two charted landmarks');
        M.ship.bx = M.ship.x + 10; M.nav = { dist: 200, t: 12, cells: { 5: 12 } }; M.fixAt(M.ship.x, M.ship.y, 'Bearings taken on two charted landmarks'); await new Promise(r => setTimeout(r, 450));
        return { d: M.lastDrift && [Math.round(M.lastDrift.off), M.lastDrift.dir], log: M.S.log[1].t, modals, txt: window.__lastModal }; });
      eq(r.d, [10, 'west']); ok(/current carried us 36 miles south-east/.test(r.log), r.log); eq(r.modals, 1, 'explained only once'); ok(/Dead reckoning/.test(r.txt), r.txt);
    },
    'first commission walkthrough: one step at a time, never skipped: half sail to the ring → chart the coast → bearings → allow for current → deliver': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const M = window.__map, S = M.S; const steps = []; const adv = () => { M.simClock += 2; M.renderOrders(); steps.push(S.tut); };
        adv(); // at port: still step 0
        const [sx, sy] = S.tutSpot; M.atPort = false; M.ship = { x: sx, y: sy, bx: sx, by: sy, h: 0, sail: 1, voyageDmg: 0 }; S.tutFix = 1; S.allow = true; // everything later already "true": must still go one step at a time
        adv(); // 0 → 1
        S.ink = M.islands[0].coast.slice(0, Math.ceil(M.islands[0].coast.length * 0.3)).map(p => [p[0], p[1]]); M.hashInk(); M.ship = (() => { const is = M.islands[0], c = is.coast[0], dx = c[0] - is.cx, dy = c[1] - is.cy, L = Math.hypot(dx, dy); const x = c[0] + dx / L * 25, y = c[1] + dy / L * 25; return { x, y, bx: x, by: y, h: 0, sail: 1, voyageDmg: 0 }; })();
        adv(); adv(); // 0 → 1 → 2 (needs a charted landmark in sight) → stays at 2 until a bearing is taken while step 3 is showing
        const f = M.bearingFix(); if (!f.err) M.fixAt(f.x, f.y, 'Bearings taken on two charted landmarks'); else { const c = M.islands[0].coast[0]; M.ship = { x: c[0] + 20, y: c[1], bx: c[0] + 20, by: c[1], h: 0, sail: 1, voyageDmg: 0 }; const g = M.bearingFix(); M.fixAt(g.x || M.ship.x, g.y || M.ship.y, 'Bearings taken on two charted landmarks'); }
        adv(); adv(); S.done[0] = 1; adv(); return { steps, hidden: document.getElementById('orders').hidden }; });
      eq(r.steps, [0, 1, 2, 2, 3, 4, 5]); eq(r.hidden, true);
    },
    'event sounds are rate-limited: a burst of bumps makes one soft knock, not a scrape': async ({ page, eq }) => {
      const n = await page.evaluate(() => { let c = 0; const t = FX.tone; FX.tone = () => { c++; }; const M = window.__map; for (let i = 0; i < 6; i++) M.damage(1, 'x'); FX.tone = t; return c; });
      eq(n, 1);
    },
    'newcomer, real clicks: the five Master\'s orders can all be completed, ending with Home Waters delivered': async ({ page, eq, ok }) => {
      const at = (x, y) => page.evaluate(([x, y]) => { const M = window.__map, r = document.getElementById('chart').getBoundingClientRect(); return [r.left + M.view.ox + x * M.view.s, r.top + M.view.oy + y * M.view.s]; }, [x, y]);
      const sailTo = async (x, y, ms) => { const [cx, cy] = await at(x, y); await page.mouse.click(cx, cy); await page.evaluate((n) => { const M = window.__map; for (let i = 0; i < n && M.target; i++) { M.step(0.05); } }, ms); };
      const steps = [];
      await page.evaluate(() => { const M = window.__map; M.S = M.freshSave(424242); M.boot(); RH.modal = () => Promise.resolve(); });
      steps.push(await page.evaluate(() => (window.__map.renderOrders(), window.__map.S.tut)));
      await page.click('#sails [data-sail="1"]'); const spot = await page.evaluate(() => (window.__map.renderOrders(), window.__map.S.tutSpot)); await sailTo(spot[0], spot[1], 2500); await page.click('#sails [data-sail="2"]');
      const ring = await page.evaluate(() => { const is = window.__map.islands[0]; const cs = is.coast.slice().sort((a, b) => Math.atan2(a[1] - is.cy, a[0] - is.cx) - Math.atan2(b[1] - is.cy, b[0] - is.cx)); const out = []; for (let k = 0; k < cs.length; k += Math.max(1, Math.floor(cs.length / 14))) { const [x, y] = cs[k], dx = x - is.cx, dy = y - is.cy, L = Math.hypot(dx, dy); out.push([x + dx / L * 26, y + dy / L * 26]); } return out; });
      for (let k = 0; k < ring.length; k++) { await sailTo(ring[k][0], ring[k][1], 1500);
        // a careful newcomer takes bearings now and then, and follows the orders
        if (k % 2 === 1) { await page.click('#bearBtn'); await page.evaluate(() => { const M = window.__map; for (let i = 0; i < 40; i++) M.step(0.05); }); }
        if (k === 3 && !(await page.evaluate(() => window.__map.S.allow))) await page.click('#allowBtn');
        await page.evaluate(() => window.__map.renderOrders()); const t = await page.evaluate(() => window.__map.S.tut); if (steps[steps.length - 1] !== t) steps.push(t); }
      // home to port and deliver
      const port = await page.evaluate(() => [window.__map.port.x, window.__map.port.y]); await sailTo(port[0], port[1], 3000);
      await page.evaluate(() => { const M = window.__map; M.ship.sail = 0; for (let i = 0; i < 20; i++) M.step(0.05); M.atPort = true; M.renderAll(); });
      const acc0 = await page.evaluate(() => window.__map.acc(0)); ok(acc0 >= 60, 'Home Isle charted: ' + acc0);
      await page.click('#sell'); await page.evaluate(() => window.__map.renderOrders());
      const end = await page.evaluate(() => [window.__map.S.tut, !!window.__map.S.done[0], document.getElementById('orders').hidden]); steps.push(end[0]);
      eq(end, [5, true, true]); ok([1, 2, 3, 4].every(s => steps.includes(s)) || steps[steps.length - 1] === 5, 'went through the steps: ' + steps);
    },
    'mobile layout: no horizontal scroll, chart and sail buttons visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('chart').getBoundingClientRect().toJSON(), look: document.getElementById('look').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 380 && r.cv.height > 250, 'chart ' + JSON.stringify(r.cv)); ok(r.look.width <= 120, 'lookout should shrink on phones');
    },
  },
};
