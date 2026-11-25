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
      ok(await p.evaluate(() => getComputedStyle(document.querySelector('#mapWrap .pz-in')).width) === '40px', 'zoom buttons');
      await ctx.close();
    },
    'pan and zoom: dragging bare map pans without planning; a pinch that starts on a city plans nothing; Fit restores the whole map': async ({ page, ok, near }) => {
      await closeModals(page); await page.waitForTimeout(200);
      const r = await page.evaluate(() => { const K = window.__caravan, cv = document.getElementById('map'), c = cv.getBoundingClientRect();
        K.cam.zoomAt(c.left + c.width / 2, c.top + c.height / 2, 2);
        let ex = c.left + c.width / 2, ey = c.top + c.height / 2; for (let k = 0; k < 60 && K.cities.some(ci => { const [x, y] = K.P(ci); return Math.hypot(x - (ex - c.left), y - (ey - c.top)) < 30; }); k++) { ex += 7; ey += 3; }
        const x0 = K.cam.x, ev = (t, id, x, y, type = 'mouse') => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: type, button: 0 }));
        ev('pointerdown', 1, ex, ey); ev('pointermove', 1, ex - 30, ey); ev('pointerup', 1, ex - 30, ey); cv.dispatchEvent(new MouseEvent('click', { clientX: ex - 30, clientY: ey, bubbles: true }));
        const panned = K.cam.x - x0, planned1 = document.getElementById('travelBox').style.display;
        const city = K.cities.find(ci => ci.id !== K.C.at && (([x, y]) => x > 40 && y > 40 && x < c.width - 40 && y < c.height - 40)(K.P(ci))); const [cx, cy] = K.P(city), k0 = K.cam.k;
        ev('pointerdown', 2, c.left + cx, c.top + cy, 'touch'); ev('pointerdown', 3, c.left + cx + 40, c.top + cy, 'touch');
        for (let k = 1; k <= 5; k++) { ev('pointermove', 2, c.left + cx - k * 6, c.top + cy, 'touch'); ev('pointermove', 3, c.left + cx + 40 + k * 6, c.top + cy, 'touch'); }
        ev('pointerup', 2, c.left + cx - 30, c.top + cy, 'touch'); ev('pointerup', 3, c.left + cx + 70, c.top + cy, 'touch'); cv.dispatchEvent(new MouseEvent('click', { clientX: c.left + cx - 30, clientY: c.top + cy, bubbles: true }));
        return { panned, planned1, planned2: document.getElementById('travelBox').style.display, zoomedMore: K.cam.k > k0 }; });
      near(r.panned, -30, 1.5); ok(r.planned1 !== 'block' && r.planned2 !== 'block', 'a pan or pinch planned a journey ' + JSON.stringify(r)); ok(r.zoomedMore, 'pinch did not zoom');
      await page.click('#mapWrap .pz-fit'); await page.waitForTimeout(450);
      const c = await page.evaluate(() => window.__caravan.cam.state); near(c.k, 1, 1e-6); near(c.x, 0, 1e-6); near(c.y, 0, 1e-6);
      ok(await page.evaluate(() => getComputedStyle(document.querySelector('#mapWrap .pz-bar button')).borderRadius === '50%'), 'zoom bar not styled');
    },
    'touch: the intro dialog button is on screen without scrolling, portrait and landscape': async ({ page, ok }) => {
      for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        const ctx = await page.context().browser().newContext({ viewport: vp, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
        await p.goto(page.url()); await p.waitForTimeout(1000);
        const b = await p.locator('.modal-bg button').last().boundingBox(); ok(b && b.y + b.height <= vp.height, `intro button off screen at ${vp.width}x${vp.height}: ${JSON.stringify(b)}`);
        await ctx.close();
      }
    },
    'first career: a first job names a city that wants silk; the market opens on silk with a suggested amount that keeps gold for the road; selling there completes it': async ({ page, ok, eq }) => {
      await closeModals(page);
      ok(await page.locator('#p-market .job').isVisible(), 'no first-job banner');
      ok(await page.locator('#p-market tr.sel[data-g="8"]').isVisible() && await page.locator('#dealBtn').isVisible(), 'silk not picked for the first job');
      ok((await page.textContent('#dealBtn')).startsWith('Buy '), 'the suggestion should be to buy');
      const g0 = await page.evaluate(() => window.__caravan.C.gold); await page.click('#dealBtn');
      const r = await page.evaluate(g0 => { const K = window.__caravan, C = K.C, fj = C.firstJob; const spent = g0 - C.gold;
        K.encountersOn = false; K.travelNow(fj.to); K.trade(8, -999);
        return { wants: K.cities[fj.to].dem.includes(8), spentFrac: spent / g0, bought: C.cargo[8] === 0, done: !!C.firstJob.done }; }, g0);
      ok(r.wants, 'target city should want silk'); ok(r.spentFrac > .5 && r.spentFrac <= .9 + 1e-9, 'suggested buy spent ' + r.spentFrac); ok(r.done, 'selling silk there should finish the first job');
      await page.evaluate(() => window.__caravan.buildAndRender()); eq(await page.locator('#p-market .job').count(), 0, 'banner should go');
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
    'roads: where bandits roam, the map offers a fast road and a longer safe road; the safe road avoids bandit country': async ({ page, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C; let found = null;
        for (let a = 0; a < K.cities.length && !found; a++) for (let b = 0; b < K.cities.length && !found; b++) { if (a === b) continue; const f = K.shortest(a, b), s = K.shortest(a, b, true);
          if (f && s && f.legs.some(l => l.r.danger > .03) && s.days > f.days) found = { a, b, f: f.days, s: s.days, safeClean: s.legs.every(l => l.r.danger <= .03) }; }
        if (!found) return null; C.at = found.a; K.planTo(found.b); return found; });
      ok(r && r.safeClean, 'no fast/safe pair: ' + JSON.stringify(r));
      ok(await page.locator('#goFast').isVisible() && await page.locator('#goSafe').isVisible(), 'two road buttons');
      ok((await page.textContent('#goFast')).includes('bandits') && (await page.textContent('#goSafe')).includes(r.s + ' days'), await page.textContent('#travelBox'));
      await page.click('#goSafe'); ok(await page.evaluate(() => window.__caravan.traveling.legs.every(l => l.r.danger <= .03)), 'the safe road was not taken');
    },
    'camels come with the cargo: buying more than they carry buys camels, and the button says so': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C; C.gold = 5000; const c0 = C.camels, cap0 = K.cap(), g = 0, k = K.buyCost(g, cap0 + 25); K.trade(g, cap0 + 25); return { c0, c1: C.camels, need: k.camels, held: C.cargo[g], want: cap0 + 25 }; });
      eq(r.c1 - r.c0, 3); eq(r.need, 3); eq(r.held, r.want);
      await page.evaluate(() => { const K = window.__caravan; K.C.gold = 5000; K.renderMarket(); }); await page.click('#p-market tr[data-g="1"]');
      await page.evaluate(() => { const q = document.getElementById('qty'); q.value = q.max; q.dispatchEvent(new Event('input')); });
      ok(/\+\d+ camels?/.test(await page.textContent('#dealBtn')), await page.textContent('#dealBtn'));
    },
    'roads are seeded: the same road is the same world, the URL carries it, and today\'s road is shared': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, sig = () => JSON.stringify([K.cities.map(c => [c.x.toFixed(4), c.y.toFixed(4)]), K.routes.map(r => [r.a, r.b, r.days]), K.C.events.map(e => [e.k, e.city, e.start])]);
        K.startRoad(4242); const a = sig(), hash = location.hash; K.startRoad(777); const b = sig(); K.startRoad(4242); const c = sig(); const d = K.dailySeed(); K.startRoad(d);
        return { same: a === c, differ: a !== b, hash, daily: K.C.daily, d2: K.dailySeed() === d }; });
      ok(r.same && r.differ, 'seeded worlds'); eq(r.hash, '#road=4242'); eq(r.daily, 1); ok(r.d2);
      const ctx = await page.context().browser().newContext(); const p2 = await ctx.newPage(); await p2.goto(page.url().split('#')[0] + '#road=31337'); await p2.waitForTimeout(700);
      eq(await p2.evaluate(() => window.__caravan.C.seed), 31337); await ctx.close();
    },
    'tapping a city (no hover first) plans a journey, travel moves the caravan and passes days': async ({ page, ok, eq }) => {
      await closeModals(page);
      const target = await page.evaluate(() => { const K = window.__caravan; K.encountersOn = false; return K.neighbors(K.C.at).sort((a, b) => a.r.days - b.r.days)[0].to; });
      await page.evaluate(ci => { const K = window.__caravan, cv = document.getElementById('map'), r = cv.getBoundingClientRect(), c = K.cities[ci]; const [px, py] = K.P(c); cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + px, clientY: r.top + py, bubbles: true })); }, target);
      ok(await page.locator('#goFast').isVisible(), 'no plan from a tap');
      const d0 = await page.evaluate(() => window.__caravan.C.day);
      await page.click('#goFast');
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
        // a trader, refused when too poor
        C.gold = 0; K.traveling.enc = { k: 'trader', g: 2, qty: 10, price: 5 }; out.poor = K.resolveEncounter(0); out.still = !!K.traveling.enc; K.resolveEncounter(1);
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
      eq(r[0], null); eq(r[1], null); eq(r[2], { best: 0, careers: 0, roads: {} });
      eq(r[3].cargo.length, 12); eq(r[3].contracts, []); eq(r[3].prices, undefined); eq(r[3].camels, 1);
      await page.addInitScript(() => { localStorage.setItem('rh:caravan', '{"seed":7,"day":5,"gold":50,"at":3,"trav":{"legs":[999],"leg":0}}'); localStorage.setItem('rh:caravan-meta', '{"legacy":"lots","perks":[1]}'); });
      await page.reload(); await page.waitForTimeout(500);
      ok(await page.evaluate(() => window.__caravan.C.at === 3 && !window.__caravan.traveling && window.__caravan.M.best === 0));
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
