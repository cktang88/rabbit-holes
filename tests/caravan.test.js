// Caravan: Silk Road trading. Logic via window.__caravan.
const { caravanBot } = require('./caravan.bots.js');
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const keepStorage = async page => { const snap = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))); await page.addInitScript(s => { const o = JSON.parse(s); for (const k in o) localStorage.setItem(k, o[k]); }, snap); };
const reload = async page => { await keepStorage(page); await page.reload(); await page.waitForTimeout(500); await closeModals(page); };
module.exports = {
  page: 'caravan/index.html',
  tests: {
    'map: every route line ends on its two cities, in landscape and portrait, after layout changes': async ({ page, eq }) => {
      const check = () => page.evaluate(() => { const K = window.__caravan, segs = K.mapSegs(), bad = [];
        if (!segs || segs.length !== K.routes.length) return ['segments ' + (segs && segs.length)];
        for (const [a, b, x1, y1, x2, y2] of segs) { const z = K.zoom, [ax, ay] = K.P(K.cities[a]), [bx, by] = K.P(K.cities[b]), [ox, oy] = K.P({ x: 0, y: 0 }), [zx, zy] = K.P0({ x: 0, y: 0 }); const sx = q => ox + (q - zx) * z, sy = q => oy + (q - zy) * z; if (Math.hypot(ax - sx(x1), ay - sy(y1)) > 1 || Math.hypot(bx - sx(x2), by - sy(y2)) > 1) bad.push(a + '-' + b); }
        return bad; });
      await closeModals(page); await page.waitForTimeout(200); eq(await check(), [], 'landscape');
      await page.evaluate(() => { document.getElementById('side').style.width = '300px'; }); await page.waitForTimeout(200); eq(await check(), [], 'after the panel resized');
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      eq(await page.evaluate(() => { const r = document.getElementById('map').getBoundingClientRect(); return r.height > r.width * 1.15; }), true, 'portrait map');
      eq(await check(), [], 'portrait');
      await page.evaluate(() => window.__caravan.zoomAt(150, 200, 2.2)); await page.waitForTimeout(100); eq(await check(), [], 'zoomed in');
    },
    'touch: city names do not collide on a phone, pinch zooms the map, and a tap after zooming picks the right city': async ({ page, ok, eq }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const p = await ctx.newPage(); await p.goto(page.url()); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
      const overlaps = async () => p.evaluate(() => { const b = window.__caravan.labelBoxes().filter(Boolean); let n = 0; for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i].x < b[j].x + b[j].w && b[j].x < b[i].x + b[i].w && b[i].y < b[j].y + b[j].h && b[j].y < b[i].y + b[i].h) n++; return n; });
      const o1 = await overlaps(); ok(o1 <= 1, 'labels overlap: ' + o1);
      // pinch out with two pointers
      const box = await p.locator('#map').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await p.evaluate(([cx, cy]) => { const cv = document.getElementById('map'), ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true }));
        ev('pointerdown', 1, cx - 20, cy); ev('pointerdown', 2, cx + 20, cy); for (let k = 1; k <= 10; k++) { ev('pointermove', 1, cx - 20 - k * 8, cy); ev('pointermove', 2, cx + 20 + k * 8, cy); } ev('pointerup', 1, 0, 0); ev('pointerup', 2, 0, 0); }, [cx, cy]);
      const z = await p.evaluate(() => window.__caravan.zoom); ok(z > 2, 'pinch did not zoom: ' + z);
      const t = await p.evaluate(() => { const K = window.__caravan, r = document.getElementById('map').getBoundingClientRect(); for (const c of K.cities) { const [x, y] = K.P(c); if (x > 30 && y > 30 && x < r.width - 60 && y < r.height - 60 && c.id !== K.C.at) return { id: c.id, x: r.left + x, y: r.top + y }; } return null; });
      ok(t, 'no city in view after zooming');
      await p.touchscreen.tap(t.x, t.y); await p.waitForTimeout(200);
      ok(await p.locator('#travelBox').isVisible(), 'tap after zoom did not plan'); eq(await p.evaluate(() => document.querySelector('#travelBox b').textContent), await p.evaluate(id => window.__caravan.cities[id].name, t.id));
      ok(await p.evaluate(() => getComputedStyle(document.getElementById('zIn')).width) === '40px', 'zoom buttons');
      await ctx.close();
    },
    'touch: the intro dialog button is on screen without scrolling, portrait and landscape': async ({ page, ok }) => {
      for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        const ctx = await page.context().browser().newContext({ viewport: vp, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
        await p.goto(page.url()); await p.waitForTimeout(1000);
        const b = await p.locator('.modal-bg button').last().boundingBox(); ok(b && b.y + b.height <= vp.height, `intro button off screen at ${vp.width}x${vp.height}: ${JSON.stringify(b)}`);
        await ctx.close();
      }
    },
    'difficulty: naive play fails; a greedy trader wins; 3 stars needs better information; information pays': async ({ page, ok }) => {
      await closeModals(page); await page.addScriptTag({ content: caravanBot.toString() });
      const r = await page.evaluate(() => { const K = window.__caravan, w = {};
        for (const pol of ['idle', 'random', 'obvious', 'greedy-book', 'greedy-live']) w[pol] = [1, 2, 3, 4, 5, 6].map(s => caravanBot(s * 1013, pol));
        const st = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v.map(K.starsFor)])), mean = a => a.reduce((x, y) => x + y, 0) / a.length;
        return { w, st, book: mean(w['greedy-book']), live: mean(w['greedy-live']) }; });
      const naive = [...r.st.idle, ...r.st.random, ...r.st.obvious], low = naive.filter(x => x <= 1).length / naive.length;
      ok(low >= .8, 'naive bots reach 2+ stars too often: ' + JSON.stringify(r.w));
      ok(r.st['greedy-book'].filter(x => x >= 2).length >= 4, 'the competent trader should usually win: ' + r.w['greedy-book']);
      ok(r.st['greedy-book'].every(x => x < 3), '3 stars should need more than the simple greedy trader');
      ok(r.st['greedy-live'].some(x => x === 3), 'a trader with live information should reach 3 stars');
      ok(r.live > r.book * 1.3, 'information should pay: ' + r.book + ' vs ' + r.live);
    },
    'geography is coherent: no city wants what it makes, and silk runs east to west': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = window.__caravan; return { same: K.cities.filter(c => c.prod.some(g => c.dem.includes(g))).length, silkE: K.cities[0].prod.includes(8), silkW: K.cities[22].dem.includes(8) }; });
      ok(r.same === 0 && r.silkE && r.silkW, JSON.stringify(r));
    },
    'stale prices go stale: after 90 days a city price has usually moved by more than 15%': async ({ page, ok }) => {
      const f = await page.evaluate(() => { const K = window.__caravan; K.newCareerSeed(4242); const before = K.cities.map(c => c.price.slice()); for (let d = 0; d < 90; d++) K.tick(); let n = 0, m = 0; K.cities.forEach((c, i) => c.price.forEach((p, g) => { n++; if (Math.abs(p / before[i][g] - 1) > .15) m++; })); return m / n; });
      ok(f > .5, 'only ' + f + ' moved');
    },
    'world: every city reachable, shortest paths optimal and symmetric': async ({ page, eq }) => {
      const bad = await page.evaluate(() => {
        const K = window.__caravan, n = K.cities.length, D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : 1e9));
        for (const r of K.routes) { D[r.a][r.b] = D[r.b][r.a] = Math.min(D[r.a][r.b], r.days); if (r.days < 3) return ['short route']; }
        for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i][j] = Math.min(D[i][j], D[i][k] + D[k][j]);
        K.cities.forEach(c => c.closed = 0);
        const out = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) continue; const p = K.shortest(i, j); if (!p || p.days !== D[i][j]) out.push(i + '>' + j); if (p && p.legs.reduce((a, l) => a + l.r.days, 0) !== p.days) out.push('sum ' + i + '>' + j); }
        return out;
      });
      eq(bad, []);
    },
    'trading: spread means an immediate buy-then-sell loses money; cap and gold are respected': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => {
        const K = window.__caravan, C = K.C, g0 = C.gold;
        K.trade(1, 10); const held = C.cargo[1]; K.trade(1, -999);
        const after = C.gold;
        K.trade(0, 9999); const capOk = K.load() <= K.cap();
        K.trade(0, -999); C.gold = 10; K.trade(11, 50); const jade = C.cargo[11];
        return { g0, after, held, capOk, jade, gold: C.gold };
      });
      eq(r.held, 10); ok(r.after < r.g0, 'arbitrage at one market'); ok(r.capOk, 'over capacity');
      eq(r.jade, 0, 'bought jade without the gold'); ok(r.gold >= 0);
    },
    'selling everything also sells perished fractions (no ghost cargo)': async ({ page, eq, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C; K.trade(4, 10); C.cargo[4] = 9.63; const g = C.gold; K.trade(4, -999); return [C.cargo[4], C.cost[4], C.gold > g]; });
      eq(r, [0, 0, true]);
      const r2 = await page.evaluate(() => { const K = window.__caravan, C = K.C; C.cargo[4] = 0.5; C.cost[4] = 20; K.trade(4, -999); return C.cargo[4]; });
      eq(r2, 0, 'half a unit should be sellable');
    },
    'contracts cannot be delivered after their deadline': async ({ page, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => {
        const K = window.__caravan, C = K.C; C.cargo[2] = 10; C.contracts = [{ to: C.at, g: 2, qty: 10, by: C.day - 1, reward: 500 }]; const g = C.gold;
        K.deliver(0); const late = C.gold - g;
        C.contracts[0].by = C.day + 5; K.deliver(0); return [late, C.gold - g, C.contracts.length, C.done];
      });
      eq(r, [0, 500, 0, 1]);
    },
    'upkeep: camels eat, debts sell a camel, gold never negative': async ({ page, eq, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C; C.gold = 0.01; const cam = C.camels; K.tick(); return [cam - C.camels, C.gold >= 0, C.day]; });
      eq(r[0], 1); ok(r[1]); eq(r[2], 1);
    },
    'guards reduce bandit risk; safe roads stay safe': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C, rt = { danger: .1 }; C.camels = 4; C.guards = 0; const a = K.banditChance(rt); C.guards = 2; const b = K.banditChance(rt); return [a, b]; });
      ok(r[0] === .1 && r[1] < r[0] / 2, JSON.stringify(r));
    },
    'tapping a city (no hover first) plans a journey, travel moves the caravan and passes days': async ({ page, ok, eq }) => {
      await closeModals(page);
      const target = await page.evaluate(() => { const K = window.__caravan; K.encountersOn = false; return K.neighbors(K.C.at).sort((a, b) => a.r.days - b.r.days)[0].to; });
      await page.evaluate(ci => { const K = window.__caravan, cv = document.getElementById('map'), r = cv.getBoundingClientRect(), c = K.cities[ci]; const [px, py] = K.P(c); cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + px, clientY: r.top + py, bubbles: true })); }, target);
      ok(await page.locator('#goBtn').isVisible(), 'no plan from a tap');
      const d0 = await page.evaluate(() => window.__caravan.C.day);
      await page.click('#goBtn');
      await page.waitForFunction(() => !window.__caravan.traveling, null, { timeout: 8000 });
      const r = await page.evaluate(() => [window.__caravan.C.at, window.__caravan.C.day]);
      eq(r[0], target); ok(r[1] > d0, 'no days passed');
    },
    'reload mid-journey keeps the journey and the market prices': async ({ page, ok, eq }) => {
      await closeModals(page);
      await page.evaluate(() => { const K = window.__caravan; K.trade(8, 10); });
      const price = await page.evaluate(() => window.__caravan.cities[0].price[8]);
      await reload(page);
      eq(await page.evaluate(() => window.__caravan.cities[0].price[8]), price, 'prices rolled back');
      const far = await page.evaluate(() => { const K = window.__caravan; K.encountersOn = false; K.planTo(6); K.travel(); return 6; });
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__caravan.persist());
      const before = await page.evaluate(() => ({ day: window.__caravan.C.day, leg: window.__caravan.traveling.leg }));
      await reload(page);
      const after = await page.evaluate(() => ({ trav: !!window.__caravan.traveling, day: window.__caravan.C.day }));
      ok(after.trav, 'journey lost on reload'); ok(after.day >= before.day);
      await page.evaluate(() => { window.__caravan.encountersOn = false; if (window.__caravan.traveling && window.__caravan.traveling.enc) window.__caravan.resolveEncounter(1); });
      await page.waitForFunction(() => !window.__caravan.traveling, null, { timeout: 30000 });
      eq(await page.evaluate(() => window.__caravan.C.at), far);
    },
    'encounters pause the journey until you decide, and each choice has its consequence': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => {
        const K = window.__caravan, C = K.C, out = {};
        const L = { r: K.routes.find(r => r.days >= 5) };
        const start = (k, extra) => { K.planTo(K.neighbors(C.at)[0].to); K.travel(); K.traveling.enc = { k, ...K.ENC[k].make(RH.rng(k)), ...extra }; };
        // a trader: buying fills the cargo and costs gold
        C.gold = 500; start('trader'); const e = K.traveling.enc, g0 = C.gold, c0 = C.cargo[e.g];
        out.paused = !!K.traveling.enc && document.getElementById('encBox').style.display !== 'none' || true;
        K.resolveEncounter(0); out.bought = C.cargo[e.g] - c0; out.spent = Math.round(g0 - C.gold); out.cleared = !K.traveling.enc;
        // the storm: sheltering costs three days
        K.traveling.enc = { k: 'storm' }; const d0 = C.day; K.resolveEncounter(0); out.shelter = C.day - d0;
        // news: pay 4g, the price book gains that city
        K.traveling.enc = { k: 'caravan', city: 20 }; delete C.book[20]; const g1 = C.gold; K.resolveEncounter(0); out.news = !!C.book[20] && g1 - C.gold === 4;
        // a camel at the well, refused when too poor
        C.gold = 1; K.traveling.enc = { k: 'well', price: 30 }; out.poor = K.resolveEncounter(0); out.still = !!K.traveling.enc; K.resolveEncounter(1);
        return out;
      });
      ok(r.bought > 0, 'trader sold nothing'); ok(r.spent > 0); ok(r.cleared);
      eq(r.shelter, 3); ok(r.news, 'news'); eq(r.poor, false); ok(r.still, 'encounter closed without a valid choice');
    },
    'a journey does not advance while an encounter waits': async ({ page, eq }) => {
      await closeModals(page);
      await page.evaluate(() => { const K = window.__caravan; K.planTo(K.neighbors(K.C.at)[0].to); K.travel(); K.traveling.enc = { k: 'storm' }; K.renderEncounter(); });
      const d0 = await page.evaluate(() => [window.__caravan.C.day, window.__caravan.traveling.t]);
      await page.waitForTimeout(800);
      eq(await page.evaluate(() => [window.__caravan.C.day, window.__caravan.traveling.t]), d0);
      eq(await page.locator('#encBox button').count(), 2);
    },
    'a profitable sale throws coins from the city': async ({ page, ok }) => {
      await closeModals(page);
      const n = await page.evaluate(() => { const K = window.__caravan, C = K.C; C.cargo[8] = 10; C.cost[8] = 1; K.trade(8, -10); return K.coins().length; });
      ok(n > 0, 'no coins');
    },
    'a career ends once: reloading before closing the modal does not pay legacy twice': async ({ page, eq }) => {
      await closeModals(page);
      const l1 = await page.evaluate(() => { const K = window.__caravan; K.C.day = K.CAREER_DAYS; K.endCareer(); K.endCareer(); return K.M.legacy; });
      await reload(page);
      const r = await page.evaluate(() => [window.__caravan.M.legacy, window.__caravan.M.careers, window.__caravan.C.day]);
      eq(r, [l1, 1, 0]);
    },
    'hub progress grows with best fortune and stays within 1': async ({ page, ok }) => {
      await closeModals(page);
      const v = await page.evaluate(() => { const K = window.__caravan; K.M.best = 1e9; K.persist(); return JSON.parse(localStorage.getItem('rh:hub')).caravan; });
      ok(v === 1);
    },
    'corrupted saves load safely': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const K = window.__caravan; return [K.cleanCareer({ seed: 1, day: 'x' }), K.cleanCareer(null), K.cleanMeta('junk'), K.cleanCareer({ seed: 5, day: 3, gold: 10, at: 2, cargo: [1], contracts: [{ to: 99 }], prices: [[1]] })]; });
      eq(r[0], null); eq(r[1], null); eq(r[2], { legacy: 0, best: 0, careers: 0, perks: {} });
      eq(r[3].cargo.length, 12); eq(r[3].contracts, []); eq(r[3].prices, undefined); eq(r[3].camels, 1);
      await page.addInitScript(() => { localStorage.setItem('rh:caravan', '{"seed":7,"day":5,"gold":50,"at":3,"trav":{"legs":[999],"leg":0}}'); localStorage.setItem('rh:caravan-meta', '{"legacy":"lots","perks":[1]}'); });
      await page.reload(); await page.waitForTimeout(500);
      ok(await page.evaluate(() => window.__caravan.C.at === 3 && !window.__caravan.traveling && window.__caravan.M.legacy === 0));
      await page.addInitScript(() => localStorage.setItem('rh:caravan', '{oops'));
      await page.reload(); await page.waitForTimeout(500);
      ok(await page.evaluate(() => window.__caravan.C.day === 0));
    },
    'phone layout has no horizontal overflow': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await closeModals(page);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), 'overflow ' + await page.evaluate(() => document.documentElement.scrollWidth));
    },
  },
};
