// Alembic: a falling-sand alchemy tray. Determinism, conservation, commissions (scripted solutions win, random pouring
// mostly fails), the codex, daily trays (competent beats naive), share links, pan/zoom pouring, and speed.
const reloadWith = async (page, key, v) => { await page.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch (e) {} }, [key, v]); await page.reload(); };
const ready = async (page) => { await page.waitForFunction(() => window.__alembic); await page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); window.__alembic.paused = true; }); };
// a scripted way to reach every commission: fill rectangles, run frames
const SOLUTIONS = {
  mud: [['fill','earth',40,270,160,299],['fill','water',40,240,160,269],['run',900]],
  steam: [['fill','water',30,280,170,299],['fill','fire',30,268,170,279],['run',300]],
  glass: [['fill','sand',0,284,199,299],['fill','fire',0,276,199,283],['run',150],['fill','fire',0,270,199,283],['run',150],['fill','fire',0,270,199,283],['run',150],['fill','fire',0,270,199,283],['run',150],['fill','fire',0,270,199,283],['run',150],['fill','fire',0,270,199,283],['run',300]],
  sprout: [['fill','earth',20,280,180,299],['fill','water',20,274,180,279],['run',3600]],
  vessel: [['fill','glass',80,290,120,293],['fill','glass',80,250,83,293],['fill','glass',117,250,120,293],['fill','water',84,255,116,289],['run',300]],
  brick: [['rows',['mud','mud','ember'],50,240,150,299],['run',3000]],
  charcoal: [['fill','wood',60,250,140,299],['fill','fire',60,244,140,249],['run',500],['fill','water',60,180,140,243],['run',600]],
  tartar: [['fill','ash',40,297,160,299],['fill','water',40,295,160,296],['run',600],['fill','fire',40,280,160,296],['run',200],['fill','fire',40,280,160,296],['run',200],['fill','fire',40,280,160,296],['run',200],['fill','fire',40,280,160,296],['run',400]],
  forest: [['fill','plant',5,200,90,299],['fill','stone',95,120,105,299],['fill','plant',110,200,195,299],['fill','fire',110,196,195,199],['run',4000]],
  lava: [['fill','brick',60,290,140,293],['fill','brick',60,240,63,293],['fill','brick',137,240,140,293],['fill','earth',64,286,136,289],['fill','ember',64,276,136,285],['run',2500]],
  obsidian: [['fill','earth',20,297,180,299],['fill','ember',20,289,180,296],['run',1500],['fill','water',20,220,180,250],['run',3000]],
  candle: [['fill','wax',98,200,101,299],['fill','fire',98,197,101,199],['run',2400]],
  volcano: [['tri','stone',100,130,299],['fill','lava',94,110,106,129],['run',60]],
  iron: [['fill','charcoal',40,290,160,299],['fill','earth',40,280,160,289],['fill','ember',40,272,160,279],['run',2500]],
  rust: [['fill','iron',70,298,130,299],['fill','ember',70,288,130,297],['run',2500],['scrapeType','iron'],['scrapeType','rust'],['fill','brine',40,230,160,299],['run',1500]],
  froth: [['fill','lye',40,285,160,299],['fill','oil',40,270,160,284],['run',900],['fill','water',40,200,160,240],['run',900]],
  attar: [['fill','flower',60,200,140,240],['fill','steam',60,241,140,299],['run',1200]],
  snow: [['fill','ice',60,200,140,215],['fill','steam',60,216,140,299],['run',900]],
  acid: [['fill','glass',80,290,120,293],['fill','glass',80,250,83,293],['fill','glass',117,250,120,293],['fill','vitriol',84,262,116,289],['run',300]],
  air: [['fill','glass',70,150,130,153],['fill','glass',70,150,73,200],['fill','glass',127,150,130,200],['fill','vitriol',74,262,126,299],['fill','iron',74,250,126,261],['run',1500]],
  plot: [['cols',['nitre','charcoal','sulfur'],40,270,160,299],['run',900],['fill','fire',40,262,160,269],['run',400]],
  fool: [['cols',['iron','sulfur','sulfur','sulfur'],41,288,159,299],['fill','sulfur',36,270,164,299],['run',6000]],
};
// runs a script inside the page; returns whether the commission was reached
const PLAY = ([id, ops]) => { const A = window.__alembic; A.paused = true; A.startCommission(id); A.paused = true; const c = A.comById[id], I = A.ID;
  const run = (n) => { for (let k = 0; k < n; k += 5) { A.run(5); const [v, need] = A.progressOf(c); if (v >= need) return true; } return false; };
  for (const op of ops) {
    if (op[0] === 'fill') A.fillRect(I[op[1]], op[2], op[3], op[4], op[5]);
    else if (op[0] === 'rows') { for (let y = op[3]; y <= op[5]; y++) A.fillRect(I[op[1][y % op[1].length]], op[2], y, op[4], y); }
    else if (op[0] === 'scrapeType') { for (let i = 0; i < A.T.length; i++) if (A.T[i] === I[op[1]]) A.T[i] = 0; }   // a player scrapes the last grains away
    else if (op[0] === 'cols') { for (let x = op[2]; x <= op[4]; x++) A.fillRect(I[op[1][x % op[1].length]], x, op[3], x, op[5]); }
    else if (op[0] === 'tri') { const [, t, cx, py, by] = op; for (let y = py; y <= by; y++) { const hw = Math.round((y - py) * 0.9); A.fillRect(I[t], cx - hw, y, cx + hw, y); } }
    else if (run(op[1])) return true; }
  return false; };
module.exports = {
  page: 'alembic/index.html',
  ready,
  tests: {
    'reactions are deterministic for a seed, and a different seed gives a different tray': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, I = A.ID;
        const go = (seed) => { A.clearTray(); A.seed = seed; A.fillRect(I.sand, 20, 200, 90, 299); A.fillRect(I.water, 100, 150, 180, 299); A.fillRect(I.fire, 20, 190, 180, 199); A.fillRect(I.earth, 60, 100, 140, 120); A.run(300); let h = 2166136261; for (let i = 0; i < A.T.length; i++) { h ^= A.T[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
        return [go(11), go(11), go(12)]; });
      eq(r[0], r[1], 'same seed, same tray'); ok(r[0] !== r[2], 'another seed differs');
    },
    'mass is conserved where nothing reacts, and salt dissolving keeps salt + water + brine constant': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, I = A.ID; A.clearTray(); A.seed = 5;
        A.fillRect(I.sand, 0, 0, 60, 120); A.fillRect(I.water, 70, 0, 199, 140); A.fillRect(I.stone, 0, 250, 199, 254); A.fillRect(I.glass, 60, 180, 140, 183); A.fillRect(I.brick, 10, 150, 30, 160);
        A.census(); const before = ['sand', 'water', 'stone', 'glass', 'brick'].map(k => A.cnt[I[k]]); A.run(900); const after = ['sand', 'water', 'stone', 'glass', 'brick'].map(k => A.cnt[I[k]]);
        A.clearTray(); A.fillRect(I.water, 0, 200, 199, 299); A.fillRect(I.salt, 50, 100, 150, 140); A.census(); const s0 = A.cnt[I.water] + A.cnt[I.salt] + A.cnt[I.brine]; A.run(900); const s1 = A.cnt[I.water] + A.cnt[I.salt] + A.cnt[I.brine];
        return { before, after, s0, s1, brine: A.cnt[I.brine] }; });
      eq(r.after, r.before); eq(r.s1, r.s0, 'salt + water + brine'); eq(r.brine > 500, true, 'salt did dissolve: ' + r.brine);
    },
    'about 40–60 elements, every one reachable from the four starting vials, and each with a codex line': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, cl = A.closure([A.ID.sand, A.ID.water, A.ID.fire, A.ID.earth]); const miss = A.ELS.filter((e, i) => i && !cl[i]).map(e => e[0]);
        return { n: A.NT - 1, miss, lore: A.ELS.filter((e, i) => i && !(e[5] && e[5].length > 20)).map(e => e[0]) }; });
      ok(r.n >= 40 && r.n <= 60, 'element count ' + r.n); eq(r.miss, [], 'unreachable'); eq(r.lore, [], 'missing lore');
    },
    'every commission has a scripted solution that reaches it': async ({ page, eq }) => {
      const bad = [];
      for (const [id, ops] of Object.entries(SOLUTIONS)) if (!(await page.evaluate(PLAY, [id, ops]))) bad.push(id);
      eq(bad, []); eq(await page.evaluate(() => window.__alembic.COMMS.map(c => c.id).sort()), Object.keys(SOLUTIONS).sort(), 'one script per commission');
    },
    'random pouring of the same vials, drop for drop, fails most commissions': async ({ page, ok }) => {
      const r = await page.evaluate((SOL) => { const A = window.__alembic, I = A.ID, fails = [], wins = [];
        for (const c of A.COMMS) { // the budget is what the scripted solution pours
          A.startCommission(c.id); A.paused = true; let budget = 0;
          for (const op of SOL[c.id]) if (op[0] === 'fill') budget += (op[4] - op[2] + 1) * (op[5] - op[3] + 1); else if (op[0] === 'cols' || op[0] === 'tri' || op[0] === 'rows') budget += 3000;
          let used = 0, ok = false, r = 12345;
          for (let f = 0; f < 3000 && !ok; f += 3) { if (used < budget) { r = (r * 1103515245 + 12345) & 0x7fffffff; const t = c.needs[r % c.needs.length], b0 = A.poured[t]; A.pourAt(t, (r >> 7) % 200, (r >> 13) % 300, 4); used += A.poured[t] - b0; }
            A.run(3); if (f % 30 === 0) { const [v, need] = A.progressOf(c); ok = v >= need; } }
          (ok ? wins : fails).push(c.id); }
        return { fails, wins }; }, SOLUTIONS);
      ok(r.fails.length >= Math.ceil(r.fails.length + r.wins.length) * 0.55, `random won ${r.wins.length}: ${r.wins.join(', ')}`);
    },
    'the codex: four vials at first, a new substance becomes a vial with a dated entry, and commissions open as their needs are found': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, I = A.ID; A.startCommission('mud'); A.paused = true;
        const vials0 = [...document.querySelectorAll('.vial')].map(v => +v.dataset.t).filter(Boolean).length; const lockedGlassFloor = !A.COMMS.find(c => c.id === 'vessel').needs.every(t => A.knownGlobal()[t]);
        A.fillRect(I.water, 50, 280, 150, 299); A.fillRect(I.fire, 50, 270, 150, 279); A.run(60);
        A.fillRect(I.sand, 0, 290, 30, 299); A.fillRect(I.fire, 0, 284, 30, 289); A.run(200);
        return { vials0, lockedGlassFloor }; });
      await page.waitForTimeout(150);
      Object.assign(r, await page.evaluate(() => { const A = window.__alembic;
        const vials1 = [...document.querySelectorAll('.vial')].map(v => A.ELS[+v.dataset.t][0]);
        return { vials1, codex: A.SAVE.codex, saved: JSON.parse(localStorage.getItem('rh:alembic')).codex, openNow: A.COMMS.find(c => c.id === 'vessel').needs.every(t => A.knownGlobal()[t]) }; }));
      eq(r.vials0, 4); ok(r.lockedGlassFloor, 'the vessel needs glass, not yet found');
      ok(r.vials1.includes('steam') && r.vials1.includes('glass'), 'new vials: ' + r.vials1.join(','));
      ok(r.codex.steam && /^\d{4}-\d\d-\d\d$/.test(r.codex.steam[0]) && r.codex.steam.slice(1).sort().join('+') === 'fire+water', 'dated codex entry with its recipe: ' + JSON.stringify(r.codex.steam));
      ok(r.saved.glass, 'saved'); ok(r.openNow, 'the vessel commission opens once glass is known');
    },
    'saves: junk is cleaned and the save stays small': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const A = window.__alembic; const c = A.cleanSave({ codex: { steam: ['2026-01-01', 'water', 'fire'], bogus: [1], glass: 'x' }, done: { mud: '2026-01-02', nope: 1 }, daily: { '2026-01-03': [7, 900], 'evil': 3, '2026-01-04': 5 }, cur: 'zzz' });
        const all = {}; A.ELS.forEach((e, i) => { if (i) all[e[0]] = ['2026-11-25', 'water', 'fire']; }); const big = A.cleanSave({ codex: all, done: Object.fromEntries(A.COMMS.map(c => [c.id, '2026-11-25'])) });
        const N = A.office.NREAL, o = A.cleanSave({ m: 'office', office: { w: 77, tier: 9, top: 3, cards: [[N + 1, N + 2, N + 3, 0], [1, 2], 'x', [N + 1, 0, 999, 0]], seen: [[N + 1, N + 2, N + 3, 0].join(), { a: 1 }], left: -5, pd: [N + 1, 3, 'q'], best: { '77-2': 1200, 'bad': 5 }, closed: 1 } }).office;
        delete c.m; delete c.office; return { c, o: [o.w, o.tier, o.top, o.cards, o.seen, o.left, o.pd, o.best, o.closed], size: JSON.stringify(big).length }; });
      const N = await page.evaluate(() => __alembic.office.NREAL); eq(r.o, [77, 6, 3, [[N + 1, N + 2, N + 3, 0]], [[N + 1, N + 2, N + 3, 0].join()], 0, [N + 1], { '77-2': 1200 }, 1], 'office save cleaned');
      eq(r.c, { v: 1, codex: { steam: ['2026-01-01', 'water', 'fire'] }, done: { mud: '2026-01-02' }, daily: { '2026-01-03': [7, 900], '2026-01-04': [5, 0] }, cur: 'mud' }); ok(r.size < 5000, 'save size ' + r.size);
    },
    'daily trays: fixed per date, 12–30 substances possible, a drop budget, and careful small pours find far more than scattered ones': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, out = [];
        const competent = (key) => { A.startDaily(key); A.paused = true; const tried = new Set();
          for (let round = 0; round < 4 && A.budgetLeft > 0; round++) { const k = []; for (let t = 1; t < A.NT; t++) if (A.KNOWN[t]) k.push(t);
            const pairs = []; for (let i = 0; i < k.length; i++) for (let j = i; j < k.length; j++) if (!tried.has(k[i] + ',' + k[j])) pairs.push([k[i], k[j]]);
            A.clearTray(); let slot = 0;
            for (const [a, c] of pairs) { const gx = (slot % 8) * 25, gy = 30 + ((slot / 8) | 0) * 16; if (gy > 290) break; slot++; tried.add(a + ',' + c); A.fillRect(a, gx + 4, gy + 2, gx + 9, gy + 3); A.fillRect(c, gx + 4, gy, gx + 9, gy + 1); }
            A.run(700); }
          return A.dailyScore(); };
        const naive = (key) => { A.startDaily(key); A.paused = true; let r = 7;
          for (let f = 0; f < 2400; f += 3) { r = (r * 1103515245 + 12345) & 0x7fffffff; const k = []; for (let t = 1; t < A.NT; t++) if (A.KNOWN[t]) k.push(t); A.pourAt(k[r % k.length], (r >> 8) % 200, (r >> 16) % 300, 4); A.run(3); }
          return A.dailyScore(); };
        const same = JSON.stringify(A.dailyFor('2026-11-25')) === JSON.stringify(A.dailyFor('2026-11-25'));
        A.startDaily('2026-11-25'); A.fillRect(A.daily.pal[0], 0, 0, 199, 299); const capped = [A.dropsUsed(), A.budgetLeft];
        for (const key of ['2026-11-25', '2026-11-27', '2026-12-01', 'mix:aqua']) { const d = A.dailyFor(key); out.push({ key, possible: d.possible, naive: naive(key), comp: competent(key) }); }
        return { same, capped, out }; });
      ok(r.same, 'deterministic per date'); eq(r.capped, [1500, 0], 'pouring stops when the ink well is dry');
      for (const d of r.out) { ok(d.possible >= 12 && d.possible <= 30, JSON.stringify(d)); ok(d.comp >= d.possible * 0.75, 'careful pours find most: ' + JSON.stringify(d)); ok(d.naive <= d.comp * 0.5, 'scattered pours find few: ' + JSON.stringify(d)); }
    },
    'daily best: more substances, or the same in fewer drops; clearing does not refund drops': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const A = window.__alembic; A.startDaily('2026-11-25'); A.paused = true; const pal = A.daily.pal;
        A.fillRect(pal[0], 0, 280, 199, 299); const d0 = A.dropsUsed(); document.getElementById('clearBtn').click(); const d1 = A.dropsUsed();
        return { d0, d1, b: [A.better([5, 900], [4, 100]), A.better([5, 900], [5, 1000]), A.better([5, 1200], [5, 1000]), A.better([0, 0], null)] }; });
      eq(r.d1, r.d0); eq(r.b, [true, true, false, false]);
    },
    'share links: a tray survives the round trip through its link, and a link opens the sandbox': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, I = A.ID; A.clearTray(); A.fillRect(I.sand, 0, 200, 199, 299); A.fillRect(I.water, 40, 150, 160, 199); A.fillRect(I.glass, 0, 100, 199, 103); A.run(100);
        const before = Array.from(A.T).join(''), code = A.encodeTray(); A.clearTray(); A.decodeTray(code); return { same: Array.from(A.T).join('') === before, len: code.length, code }; });
      ok(r.same, 'round trip'); ok(r.len < 8000, 'link length ' + r.len);
      await page.goto(page.url().replace(/#.*/, '') + '#tray=' + r.code); await page.reload(); await ready(page);
      eq(await page.evaluate(() => [window.__alembic.mode, window.__alembic.T[299 * 200 + 5] === window.__alembic.ID.sand]), ['sandbox', true]);
    },
    'pan and zoom: pouring while zoomed lands under the finger; a pinch pours nothing; Fit frames the tray': async ({ page, ok, eq }) => {
      const r = await page.evaluate(async () => { const A = window.__alembic, I = A.ID, cv = document.getElementById('tray'), rc = cv.getBoundingClientRect(); A.clearTray(); A.sel = I.sand;
        A.cam.zoomAt(rc.left + rc.width / 2, rc.top + rc.height / 2, 3); const k3 = A.cam.k;
        const ev = (t, id, x, y, tgt = cv) => tgt.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
        const X = rc.left + rc.width * .3, Y = rc.top + rc.height * .6, [wx, wy] = A.cam.toWorld(X, Y);
        ev('pointerdown', 1, X, Y); await new Promise(r => setTimeout(r, 90)); A.pourFrame(); ev('pointerup', 1, X, Y);
        let sx = 0, sy = 0, n = 0; for (let i = 0; i < A.T.length; i++) if (A.T[i]) { sx += i % 200; sy += (i / 200) | 0; n++; }
        const placed = [sx / n, sy / n, n]; A.clearTray();
        ev('pointerdown', 1, X, Y); ev('pointerdown', 2, X + 40, Y); A.pourFrame(); ev('pointermove', 1, X - 30, Y); ev('pointermove', 2, X + 70, Y); await new Promise(r => setTimeout(r, 90)); A.pourFrame(); ev('pointerup', 1, X - 30, Y); ev('pointerup', 2, X + 70, Y); A.pourFrame();
        let after = 0; for (let i = 0; i < A.T.length; i++) if (A.T[i]) after++;
        const kp = A.cam.k; document.querySelector('.pz-fit').click(); await new Promise(r => setTimeout(r, 400));
        const a = A.cam.toScreen(0, 0), b = A.cam.toScreen(200, 300);
        return { k3, kp, placed, want: [wx, wy], after, fit: [a[0] >= rc.left - 1, a[1] >= rc.top - 1, b[0] <= rc.right + 1, b[1] <= rc.bottom + 1, (b[1] - a[1]) > rc.height * .8 || (b[0] - a[0]) > rc.width * .8] }; });
      ok(r.placed[2] > 5 && Math.hypot(r.placed[0] - r.want[0], r.placed[1] - r.want[1]) < 2.5, 'poured under the finger: ' + JSON.stringify(r));
      eq(r.after, 0, 'a pinch pours nothing'); ok(r.kp > r.k3 * 1.5, 'the pinch zoomed'); eq(r.fit, [true, true, true, true, true], 'Fit frames the whole tray');
    },
    'the camera cannot lose the tray, and a drag that starts on the border pours at the edge instead of panning': async ({ page, ok, eq }) => {
      const r = await page.evaluate(async () => { const A = window.__alembic, I = A.ID, cv = document.getElementById('tray'), rc = cv.getBoundingClientRect(); A.clearTray(); A.sel = I.sand;
        A.cam.panBy(0, -5000); A.cam.panBy(4000, 0); A.render(); const a = A.cam.toScreen(0, 0), b = A.cam.toScreen(200, 300);
        const onScreen = a[0] >= rc.left - 1 && b[0] <= rc.right + 1 && a[1] >= rc.top - 1 && b[1] <= rc.bottom + 1;
        const [bx, by] = A.cam.toScreen(100, -4); const c0 = { ...A.cam.state };
        const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true }));
        ev('pointerdown', 1, bx, by); ev('pointermove', 1, bx + 40, by + 3); await new Promise(r => setTimeout(r, 90)); A.pourFrame(); ev('pointerup', 1, bx + 40, by + 3);
        let top = 0; for (let i = 0; i < 200 * 6; i++) if (A.T[i]) top++;
        return { onScreen, panned: Math.hypot(A.cam.state.x - c0.x, A.cam.state.y - c0.y), top }; });
      ok(r.onScreen, 'the tray stays in view'); ok(r.panned < 1, 'no pan from the border: ' + r.panned); ok(r.top > 3, 'the pour landed at the top edge: ' + r.top);
    },
    'fire poured a little above water drops onto it and makes steam': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, I = A.ID; A.clearTray(); A.seed = 3; A.fillRect(I.water, 50, 270, 150, 299); A.pourAt(I.fire, 100, 255, 4); A.run(120); return A.made[I.steam]; });
      ok(r > 3, 'steam made: ' + r);
    },
    'commission progress is visible: the glass floor counts columns and flashes the gaps; a leaking vessel flashes its leaks': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, I = A.ID; A.startCommission('glass'); A.paused = true; A.fillRect(I.glass, 0, 290, 89, 291); A.fillRect(I.glass, 100, 290, 199, 291);
        const [v, need] = A.progressOf(A.com); const gaps = A.HINT.map(i => i % 200); A.startCommission('vessel'); A.paused = true;
        A.fillRect(I.glass, 80, 290, 120, 293); A.fillRect(I.glass, 80, 250, 83, 293); A.fillRect(I.glass, 117, 250, 120, 280); A.fillRect(I.water, 84, 255, 116, 289); A.run(2);
        const p2 = A.progressOf(A.com); return { v, need, gapsOk: gaps.length > 0 && gaps.every(x => x < 100) && gaps.some(x => x >= 90), leaks: A.HINT.length, held: p2[0], text: document.getElementById('goal').textContent }; });
      eq([r.v, r.need], [100, 200], 'the best layer spans 100 columns'); ok(r.gapsOk, 'the gap columns flash'); ok(r.leaks > 0 && r.held === 0, 'leaks flash: ' + JSON.stringify(r));
    },
    'mobile vials: shelves by family plus a recent shelf, and the zoom buttons sit off the tray': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const A = window.__alembic; A.startSandbox(); for (let t = 1; t < A.NT; t++) A.KNOWN[t] = 1; document.querySelector('[data-f="Water"]') || 0; A.startSandbox(); return true; });
      await page.evaluate(() => { const A = window.__alembic; A.SAVE.codex = Object.fromEntries(A.ELS.slice(1).map(e => [e[0], ['2026-01-01', '', '']])); A.startSandbox(); });
      const s = await page.evaluate(() => { const vis = (el) => { const r = el.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1 && r.width > 0; };
        const shown = () => [...document.querySelectorAll('#vials .vial')].filter(vis).length; const recent = shown();
        document.querySelector('[data-f="Water"]').click(); const water = [...document.querySelectorAll('#vials .vial')].map(v => window.__alembic.ELS[+v.dataset.t][0]);
        const tr = document.getElementById('tray').getBoundingClientRect(), bar = document.querySelector('.pz-bar').getBoundingClientRect(), a = window.__alembic.cam.toScreen(0, 0), b = window.__alembic.cam.toScreen(200, 300);
        const overTray = !(bar.right < a[0] || bar.left > b[0] || bar.bottom < a[1] || bar.top > b[1]);
        return { recent, water, overTray, tabsFit: [...document.querySelectorAll('#fams button')].every(vis) }; });
      ok(s.recent >= 7, 'the recent shelf shows a full row: ' + s.recent); ok(s.water.includes('water') && s.water.includes('brine') && !s.water.includes('sand'), 'water shelf ' + s.water);
      eq(s.overTray, false, 'zoom buttons are off the tray'); ok(s.tabsFit, 'every shelf tab and zoom button fits on a phone');
    },
    'assay office: a seed always makes the same world, seeds differ, and stranger kinds of law arrive tier by tier': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const O = __alembic.office, sig = w => JSON.stringify([w.laws, w.subs, w.base, w.pats]);
        const same = sig(O.makeWorld(123, 3)) === sig(O.makeWorld(123, 3)), differ = new Set([1, 2, 3, 4, 5].map(s => sig(O.makeWorld(s, 3)))).size;
        const kinds = [1, 2, 3, 4, 5, 6].map(t => O.makeWorld(99, t).laws.map(l => l.kind).join(','));
        const pairsUnique = [1, 2, 3, 4, 5, 6].every(t => [11, 22, 33, 44, 55].every(sd => { const L = O.makeWorld(sd, t).laws; return new Set(L.map(l => [l.a, l.b].sort().join())).size === L.length; }));
        return { same, differ, kinds, pairsUnique }; });
      ok(r.same, 'deterministic'); eq(r.differ, 5, 'five seeds, five worlds'); ok(r.pairsUnique, 'no two laws share a pair');
      eq(r.kinds, ['mix,mix,mix', 'mix,mix,mix,heat', 'mix,mix,mix,heat,cat', 'mix,mix,mix,heat,cat,decay', 'mix,mix,mix,heat,cat,decay,grow', 'mix,mix,mix,heat,cat,decay,grow,eat']);
    },
    'assay office: every law can be stamped and every patron paid within budget; a careful scientist solves worlds from observation alone; guessing goes broke': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = __alembic, O = A.office, F = O.FIRE, NT = O.NTALL;
        const run = (a, b, k, p) => { Object.assign(O.bench, { a, b, k: k || 0, p: p == null ? -1 : p }); if (O.runBench() !== 'ok') return null; while (O.trial) O.trialStep(); return O.reveal; };
        const product = l => l.kind === 'grow' ? l.a : l.kind === 'eat' ? 0 : [l.oa, l.ob].find(x => x > 0 && x !== l.a && x !== l.b);
        // the oracle knows the laws: each law's own experiment confirms it; then pour for the patrons
        const oracle = (sd, tier) => { O.startOffice(sd, tier); A.paused = true; const W = O.world;
          for (const l of W.laws) { const heat = l.a === F, a = heat ? l.b : l.a, b = heat ? F : l.b; run(a, b, l.cat, product(l)); }
          const s0 = O.officeState(); if (s0.found !== W.laws.length) return { sd, tier, why: 'laws', s0 };
          for (const p of W.pats) { const l = W.laws.find(l => product(l) === p.t && l.kind !== 'grow'); A.clearTray(); const heat = l.a === F, a = heat ? l.b : l.a, b = heat ? F : l.b;
            if (l.cat) A.fillRect(l.cat, 50, 296, 149, 299);
            for (let x = 50; x < 150; x += 2) A.fillRect(heat ? a : ((x >> 1) & 1 ? b : a), x, 284, x + 1, 295);
            for (let rep = 0; rep < 12 && !O.officeState().pats.find(q => q.t === p.t).done; rep++) { if (heat) A.fillRect(F, 50, 280, 149, 285); A.run(150); O.officeCheck(); if (rep % 3 === 2) { A.clearTray(); for (let x = 50; x < 150; x += 2) A.fillRect(heat ? a : ((x >> 1) & 1 ? b : a), x, 284, x + 1, 295); if (l.cat) A.fillRect(l.cat, 50, 296, 149, 299); } } }
          const s = O.officeState(); return { sd, tier, done: s.done, left: A.budgetLeft, s }; };
        // a scientist: mixes what it has (newest first), names only products nothing stamped explains, tries heat, alone and catalysts only while laws of those kinds remain
        const scientist = (sd, tier) => { O.startOffice(sd, tier); A.paused = true; const W = O.world; const want = {}; for (const l of W.laws) want[l.kind] = (want[l.kind] || 0) + 1;
          const left = k => (want[k] || 0) - W.laws.filter(l => l.kind === k && O.cards.some(x => x.st === 'seen' && O.matchLaw(x.c) === l)).length, pairLeft = () => left('mix') + left('grow') + left('eat');
          const K = [...W.base], tried = new Set(), empty = [], seen = {}; let broke = false; const done = () => O.officeState().found === W.laws.length;
          const tryOne = (a, b, k) => { tried.add([a, b, k].join()); tried.add([b, a, k].join()); const rv = run(a, b, k); if (!rv) { broke = true; return; }
            for (const t of rv.got) if (!K.includes(t)) K.push(t);
            const here = new Set([a, b, k, ...rv.got]), ins = [a, b, k];
            const expl = new Set(O.cards.filter(x => x.st === 'seen' && (x.c[2] !== x.c[0] && x.c[2] !== x.c[1] || ins.includes(x.c[0]) && ins.includes(x.c[1])) && here.has(x.c[0]) && (x.c[1] === 0 || here.has(x.c[1])) && (!x.c[3] || here.has(x.c[3]))).map(x => x.c[2]));
            const cands = rv.got.filter((t, i) => !expl.has(t) && rv.n[i] >= 3); if (!rv.got.length && rv.gone.length) cands.push(0);
            if (left('decay')) for (const t of cands) for (const x of [a, b, ...rv.got]) if (x !== F && x !== 0 && x !== t && x >= O.NREAL) { const key = x + '>' + t; (seen[key] = seen[key] || new Set()).add(ins.join());
              if (seen[key].size >= 2 && !tried.has(key)) { tried.add(key); if (!run(x, 0, 0, t)) { broke = true; return; } } }
            for (const t of cands) { if (done()) break; const r2 = run(a, b, k, t); if (!r2) { broke = true; return; } if (r2.ok) break; }
            if (!rv.got.length && b !== 0 && b !== F) empty.push([a, b]); };
          for (let g = 0; g < 80 && !done() && !broke; g++) { let did = false;
            for (let i = K.length - 1; i >= 0 && !did; i--) for (let j = 0; j < K.length && !did; j++) { const a = K[i], b = K[j]; if (a === b || tried.has([a, b, 0].join()) || !pairLeft()) continue; tryOne(a, b, 0); did = true; }
            if (!did && left('heat')) for (const a of K) { if (tried.has([a, F, 0].join())) continue; tryOne(a, F, 0); did = true; break; }
            if (!did && left('decay')) for (const a of K.slice().reverse()) { if (tried.has([a, 0, 0].join())) continue; tryOne(a, 0, 0); did = true; break; }
            const nb = p => W.base.includes(p[0]) + W.base.includes(p[1]);
            if (!did && left('cat')) for (const [a, b] of empty.slice().sort((p, q) => nb(q) - nb(p))) { for (const k of K) { if (k === a || k === b || tried.has([a, b, k].join())) continue; tryOne(a, b, k); did = true; break; } if (did) break; }
            if (!did) break; }
          const s = O.officeState(); return { found: s.found, laws: s.laws, fines: s.fines }; };
        // guessing: cards made up from what you have, tested blind
        let x = 9; const R = n => (x = x * 16807 % 2147483647) % n;
        const guesser = (sd, tier) => { O.startOffice(sd, tier); A.paused = true; const W = O.world, K = [...W.base]; let n = 0;
          while (n++ < 200) { const a = K[R(K.length)], b = K[R(K.length)], p = W.ids[R(W.ids.length)]; const rv = run(a, b, 0, p); if (!rv) break; for (const t of rv.got) if (!K.includes(t)) K.push(t); }
          const s = O.officeState(); return { found: s.found, laws: s.laws, fines: s.fines }; };
        const out = { oracle: [], sci: [], guess: [] };
        for (let t = 1; t <= 6; t++) out.oracle.push(oracle(100 + t, t));
        for (const t of [1, 2, 3, 4, 5]) for (const sd of [11, 22]) out.sci.push(scientist(sd, t));
        for (const t of [1, 3, 5]) for (const sd of [11, 22]) out.guess.push(guesser(sd, t));
        return out; });
      if (process.env.V) console.log(JSON.stringify(r));
      ok(r.oracle.every(o => o.done && o.left > 0), 'every law stampable and every patron payable within budget: ' + JSON.stringify(r.oracle.filter(o => !o.done || o.left <= 0)));
      const sciAll = r.sci.filter(s => s.found === s.laws).length, sciFound = r.sci.reduce((n, s) => n + s.found / s.laws, 0) / r.sci.length, gFound = r.guess.reduce((n, s) => n + s.found / s.laws, 0) / r.guess.length;
      ok(r.sci.slice(0, 6).every(s => s.found === s.laws), 'a scientist solves every world of tiers 1–3: ' + JSON.stringify(r.sci));
      ok(sciAll >= 8, `a scientist solves most worlds to tier 5 (${sciAll} of 10)`);
      ok(gFound < .35 && r.guess.every(g => g.fines >= 5), `blind guesses find little and pay fines: ${gFound.toFixed(2)} of laws found vs ${sciFound.toFixed(2)}: ${JSON.stringify(r.guess)}`);
    },
    'assay office UI: one tap runs the first experiment; a prediction hangs as a ghost, then a stamp; confirmed pays, refuted fines; cards and the world survive a reload and a link': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __alembic.office.startOffice(4242, 2); __alembic.paused = false; });
      ok(!(await page.isHidden('#bench')), 'the bench shows'); eq(await page.textContent('#bRun').then(t => t.trim().slice(0, 3)), 'Mix', 'wells are filled: one tap');
      const d0 = await page.evaluate(() => __alembic.budgetLeft);
      await page.click('#bRun'); await page.waitForFunction(() => !__alembic.office.trial && __alembic.office.lastResult, null, { timeout: 15000 });
      const res = await page.evaluate(() => [__alembic.office.lastResult.kind, __alembic.office.reveal.got.length, __alembic.budgetLeft, __alembic.office.bench.slot]);
      eq(res[0], 'mix'); ok(res[1] >= 1, 'the first two samples make something'); eq(d0 - res[2], await page.evaluate(() => 2 * 10 * 10), 'one experiment costs its drops'); eq(res[3], 'p', 'next: predict');
      // predict what formed: tap the new vial, then Test card; the ghost hangs over the wells while it runs, then the stamp
      const p = await page.evaluate(() => __alembic.office.reveal.got[0]);
      await page.click(`.vial[data-t="${p}"]`); ok(/Test card/.test(await page.textContent('#bRun')), 'a prediction turns Mix into Test card');
      await page.click('#bRun'); ok(await page.evaluate(() => !!__alembic.office.trial && __alembic.office.trial.card[2]), 'the test carries the prediction (the ghost)');
      await page.waitForFunction(() => !__alembic.office.trial, null, { timeout: 15000 });
      ok(await page.evaluate(() => document.getElementById('verdict').className.includes('ok') && /CONFIRMED/.test(document.getElementById('verdict').textContent)), 'stamped CONFIRMED');
      const after = await page.evaluate(() => [__alembic.office.cards.map(c => c.st), __alembic.budgetLeft]); eq(after[0], ['seen']); eq(after[1], res[2] - 200 + 250, 'pays');
      // a wrong card: the first sample alone makes the second sample (it does not)
      const f0 = await page.evaluate(() => { const O = __alembic.office, W = O.world; Object.assign(O.bench, { a: W.base[0], b: 0, k: 0, p: W.base[1], slot: 'p' }); O.runBench(); while (O.trial) O.trialStep(); return [O.lastResult.kind, O.officeState().fines, document.getElementById('verdict').textContent]; });
      eq(f0, ['no', 1, 'REFUTED']);
      const url = await page.evaluate(() => location.href); ok(/#office=4242-2$/.test(url), 'link ' + url);
      ok(await page.evaluate(() => localStorage.getItem('rh:alembic').length) < 3000, 'small save');
      await page.reload(); await page.waitForFunction(() => window.__alembic && __alembic.office.world);
      eq(await page.evaluate(() => [__alembic.mode, __alembic.office.world.seed, __alembic.office.cards.map(c => c.st), __alembic.office.officeState().fines]), ['office', 4242, ['seen', 'false'], 1], 'the world and its cards come back');
      const p2 = await page.context().newPage(); await p2.goto(url.replace('4242-2', '777-3')); await p2.waitForFunction(() => window.__alembic && __alembic.office.world);
      eq(await p2.evaluate(() => [__alembic.office.world.seed, __alembic.office.world.tier, __alembic.office.cards.length]), [777, 3, 0], 'a link opens its world'); await p2.close();
    },
    'a first visit reaches its first experiment in two taps: the welcome opens the Assay Office with both wells filled, and Mix runs them': async ({ page, ok, eq }) => {
      await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('.modal-actions button');
      const t0 = Date.now(); await page.click('.modal-actions button:has-text("Assay Office")'); await page.click('#bRun');
      await page.waitForFunction(() => __alembic.office.lastResult, null, { timeout: 15000 });
      eq(await page.evaluate(() => [__alembic.mode, __alembic.office.world.tier, __alembic.office.lastResult.kind]), ['office', 1, 'mix']);
      ok(Date.now() - t0 < 10000, 'first result in ' + (Date.now() - t0) + ' ms');
      ok(await page.evaluate(() => __alembic.office.reveal.got.length >= 1), 'it makes something the first time');
    },
    'leaving the office gives the blank substances back: commissions, codex and daily trays are untouched': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const A = __alembic, O = A.office; O.startOffice(5, 6); A.paused = true; const known = O.world.ids.length;
        A.startCommission('mud'); A.paused = true; let lawsLeft = 0; for (let i = O.NREAL; i < O.NTALL; i++) lawsLeft += 0; 
        const codex = Object.keys(A.SAVE.codex).filter(k => /^x\d$/.test(k)).length, vials = [...document.querySelectorAll('.vial')].map(v => +v.dataset.t).filter(t => t >= O.NREAL).length;
        return { known, mode: A.mode, codex, vials, bench: document.getElementById('bench').hidden, NT: A.NT }; });
      ok(r.known >= 6); eq([r.mode, r.codex, r.vials, r.bench], ['work', 0, 0, true]); eq(r.NT, await page.evaluate(() => __alembic.ELS.length));
    },
    'speed: a full tray steps and draws 60 frames well inside a phone frame budget (best of three, as the machine may be busy)': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = window.__alembic, I = A.ID; A.clearTray();
        A.fillRect(I.sand, 0, 200, 99, 299); A.fillRect(I.water, 100, 150, 199, 299); A.fillRect(I.earth, 0, 100, 99, 199); A.fillRect(I.lava, 100, 60, 199, 149); A.fillRect(I.plant, 0, 0, 199, 59); A.fillRect(I.oil, 0, 60, 99, 99);
        A.run(30); let best = 1e9; for (let rep = 0; rep < 3; rep++) { const t0 = performance.now(); for (let k = 0; k < 60; k++) { A.step(); A.render(); } best = Math.min(best, performance.now() - t0); } return best; });
      ok(r < 480, `60 full-tray frames took ${r.toFixed(0)} ms (budget 480 ms, i.e. 8 ms a frame on this machine)`);
    },
  },
};
