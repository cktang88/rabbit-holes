// Caravan: Silk Road trading. Logic via window.__caravan.
const { caravanBot } = require('./caravan.bots.js');
const { networkHouse } = require('./caravan.network.js');
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
    'no answer on screen: the market shows only this city, plus the last news of the city you tap, with its age and usual price': async ({ page, ok }) => {
      await closeModals(page);
      const h0 = await page.textContent('#p-market table.mk tr'); ok(!/best known/i.test(h0) && /tap a city/i.test(h0), h0);
      const r = await page.evaluate(() => { const K = window.__caravan; K.C.firstJob = null; K.planTo(2); return document.querySelector('#p-market table.mk tr').textContent; });
      ok(/Dunhuang/.test(r) && /old|unknown/.test(r), r);
    },
    'the first job never crosses bandit country; the plan card says so honestly when a road is risky': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = window.__caravan, out = []; for (let s = 1; s <= 30; s++) { K.startRoad(s * 7717); const fj = K.C.firstJob, p = K.shortest(0, fj.to); out.push(p.legs.every(l => l.r.danger === 0)); } return out; });
      ok(r.every(Boolean), 'risky first job on some roads: ' + r);
    },
    'the world moves: wars close roads and routes go round them; caravanserais shorten roads for good; a fat profit draws rivals': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, out = {}; K.startRoad(99); const C = K.C;
        out.kinds = [...new Set(C.events.map(e => e.k))].sort(); out.n = C.events.length;
        const war = C.events.find(e => e.k === 'war'), serai = C.events.find(e => e.k === 'serai');
        if (war) { const [a, b] = K.ROADS[war.road], r0 = K.routes[war.road]; const before = K.shortest(a, b).legs.map(l => l.r); C.day = war.start; K.applyRoads(); const during = K.shortest(a, b); out.war = r0.shut === 1 && before.includes(r0) && (!during || !during.legs.some(l => l.r === r0)); C.day = war.end; K.applyRoads(); out.reopened = r0.shut === 0; }
        if (serai) { const r0 = K.routes[serai.road], d0 = r0.days; C.day = serai.start; K.applyRoads(); out.serai = r0.days < d0; }
        C.day = 0; K.applyRoads();
        // a big profitable sale sends the nearest idle rival there with the same good
        C.at = 2; C.cargo[8] = 80; C.cost[8] = 1; C.rivals.forEach(rv => rv.to = null); K.trade(8, -999); out.copied = C.rivals.some(rv => rv.copy && rv.to === 2 && rv.g === 8);
        return out; });
      ok(r.n >= 15, 'too few events: ' + r.n); ok(r.kinds.length >= 5, 'event kinds: ' + r.kinds);
      ok(r.war !== false && r.reopened !== false && r.serai !== false, JSON.stringify(r)); ok(r.copied, 'no rival copied the run');
    },
    'phone: one screen with no page scroll; the route card is a bottom sheet with big buttons that pinches cannot zoom': async ({ page, ok }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
      await p.goto(page.url().split('#')[0]); await p.waitForTimeout(900); await p.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
      await p.evaluate(() => window.__caravan.planTo(2)); await p.waitForTimeout(150);
      const m = await p.evaluate(() => { const b = document.getElementById('goBtn').getBoundingClientRect(), tb = document.getElementById('travelBox'), mk = document.getElementById('p-market').getBoundingClientRect();
        return { scroll: document.documentElement.scrollHeight, h: innerHeight, btn: b.height, ta: getComputedStyle(tb).touchAction, mkTop: mk.top, mkVisible: mk.top < innerHeight - 100 }; });
      ok(m.scroll <= m.h + 1, 'page scrolls: ' + JSON.stringify(m)); ok(m.btn >= 44, 'set out button ' + m.btn); ok(m.ta === 'none', 'touch-action ' + m.ta); ok(m.mkVisible, 'market below the fold ' + m.mkTop);
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
    'the Road\'s Ledger: an honest house that builds a news network completes it in about two years; a pure trader never does': async ({ page, ok }) => {
      await closeModals(page); await page.addScriptTag({ content: networkHouse.toString() });
      const r = await page.evaluate(() => { const S = [1013, 2026, 3039], honest = { corr: true, lofts: true, sell: true, forge: false };
        const full = S.map(s => networkHouse(s, honest)); window.__caravan.persist(); const size = localStorage.getItem('rh:caravan').length; return { full, size, trader: networkHouse(1013, { until: 800 }) }; });
      ok(r.size < 50000, 'save size ' + r.size);
      ok(r.full.every(x => x.ledger != null && x.ledger < 1400), 'network houses: ' + JSON.stringify(r.full.map(x => [x.ledger, x.fresh])));
      ok(r.full.every(x => x.trips >= 25 && x.trips <= 60), 'journeys to the Ledger: ' + r.full.map(x => x.trips));
      ok(r.trader.ledger == null && r.trader.fresh < 12, 'a pure trader should never get near: ' + JSON.stringify(r.trader));
    },
    'ablation: lofts are needed, and selling news to every house pays over 10% more than selling only to open the phases': async ({ page, ok }) => {
      await closeModals(page); await page.addScriptTag({ content: networkHouse.toString() });
      const r = await page.evaluate(() => { const S = [1013, 2026, 3039], base = { corr: true, lofts: true, sell: true, forge: false }, run = o => S.map(s => networkHouse(s, { ...base, ...o })), mean = (a, k) => a.reduce((x, y) => x + y[k], 0) / a.length;
        const noLoft = networkHouse(1013, { ...base, lofts: false, until: 1100 }), honest = run({}), unlock = run({ sell: 'unlock' });
        return { noLoft, f: [mean(honest, 'fortune'), mean(unlock, 'fortune')], d: [mean(honest, 'ledger'), mean(unlock, 'ledger')] }; });
      ok(r.noLoft.ledger == null, 'without lofts the Ledger should be out of reach: ' + JSON.stringify(r.noLoft));
      ok(r.f[0] > r.f[1] * 1.1, 'selling news should pay over 10%: ' + r.f);
      console.log('      fortune all houses/unlock only', r.f.map(Math.round), 'ledger days', r.d.map(Math.round));
    },
    'forging has a counter: always forging loses the Ledger race and honour; a couple of lies near the end still pay, at a price in honour': async ({ page, ok }) => {
      await closeModals(page); await page.addScriptTag({ content: networkHouse.toString() });
      const r = await page.evaluate(() => { const S = [1013, 2026, 3039], base = { corr: true, lofts: true, sell: true }, run = o => S.map(s => networkHouse(s, { ...base, ...o }));
        return { honest: run({ forge: false }), always: run({ forge: 'always', until: 1300 }), late: run({ forge: true, lie: 1 }) }; });
      const days = x => x.ledger ?? 1e9, mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length, rate = x => x.fortune / x.ledger;
      const slower = r.always.filter((x, k) => days(x) > days(r.honest[k])).length;
      ok(slower >= 2, 'always forging should lose the race to the Ledger on most roads: ' + JSON.stringify(r.always.map(days)) + ' vs ' + JSON.stringify(r.honest.map(days)));
      ok(mean(r.always, x => x.honour) < 30 && mean(r.always, x => x.caught) > 10, 'always forging should get caught, again and again: ' + JSON.stringify(r.always.map(x => [x.honour, x.forged, x.caught])));
      ok(r.late.every(x => x.ledger != null) && mean(r.late, rate) > mean(r.honest, rate) * 1.1, 'two late lies should earn over 10% more gold a day: ' + mean(r.late, rate) + ' vs ' + mean(r.honest, rate));
      ok(mean(r.late, x => x.honour) < mean(r.honest, x => x.honour) - 10, 'and cost honour: ' + JSON.stringify(r.late.map(x => x.honour)));
      console.log('      ledger days honest/always/late', [r.honest, r.always, r.late].map(a => a.map(x => x.ledger ?? '—').join(',')).join(' | '), ' gold a day honest/late', Math.round(mean(r.honest, rate)), Math.round(mean(r.late, rate)), ' honour', [r.honest, r.always, r.late].map(a => Math.round(mean(a, x => x.honour))));
    },
    'phases open through play: correspondents after four journeys, selling after three correspondents, lofts after a sale, rumours after three houses': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C, out = []; K.headless = true; K.encountersOn = false; C.gold = 5000;
        out.push(K.hireCorr()); for (const to of [1, 0, 1, 0]) K.travelNow(to); out.push(C.phase);
        out.push(K.hireCorr()); K.travelNow(1); K.hireCorr(); K.travelNow(2); K.hireCorr(); out.push(C.phase, Object.keys(C.corr).length);
        out.push(K.buildLoft()); K.sellNews(0); out.push(C.phase); K.sellNews(1); K.sellNews(2); out.push(C.phase); K.headless = false; return out; });
      eq(r, [false, 2, true, 3, 3, false, 4, 5]);
      await page.evaluate(() => window.__caravan.renderAll()); ok(await page.locator('#house .houses').isVisible() && await page.locator('#openMk').isVisible(), 'the network takes over the panel and the market folds to one line');
    },
    'letters crawl along the roads; a pigeon loft chain makes them arrive much sooner': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C; C.at = 0; const slow = K.newsPath(22, 0).days; for (const ci of [0, 2, 5, 11, 14, 17, 22]) C.lofts[ci] = 1; const fast = K.newsPath(22, 0);
        C.phase = 2; C.corr[22] = { since: 0 }; const d0 = C.day; let sent = null; for (let k = 0; k < 8 && !sent; k++) { K.tick(); sent = C.letters.find(l => l.f === 22); }
        const arrive = sent.a; while (C.day < arrive) K.tick(); return { slow, fast: fast.days, pig: fast.way.some(w => w[2]), arrived: C.book[22] && C.book[22].day === sent.s && C.book[22].src === 'corr' }; });
      ok(r.fast < r.slow / 3 && r.pig, JSON.stringify(r)); ok(r.arrived, 'the letter should land in the price book on the day it arrives');
    },
    'houses trade on what they know: sold news fills their book; a forged letter sends them hauling, and when caught they trust you less, will not buy, and forge letters to you': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = window.__caravan; K.newCareerSeed(1013); const C = K.C, rv = C.rivals[0]; K.headless = true; C.phase = 5;
        for (let ci = 0; ci < 23; ci++) K.see(ci); const before = Object.keys(rv.book).length, pay = K.sellNews(0), after = Object.keys(rv.book).length;
        rv.bought = -99; const t0 = rv.trust, fpay = K.forge(0, 11, 11, 2); rv.to = null; rv.at = 11; const fake = rv.fake; rv.to = 11; rv.left = 1; rv.g = null; K.tick();
        const caught = rv.trust < t0 * 0.6; rv.bought = -99; const refuse = K.sellPrice_(rv) === 0; let forgedToMe = false; for (let d = 0; d < 70 && !forgedToMe; d++){ K.tick(); forgedToMe = C.letters.some(l => l.fake && l.src === 0) || Object.values(C.book).some(b => b.fake && b.src === 0); }
        K.headless = false; return { before, after, pay, fpay, fake: !!fake, caught, refuse, forgedToMe, honour: K.honour() }; });
      ok(r.after > r.before && r.pay > 0, 'selling news should fill their book: ' + JSON.stringify(r)); ok(r.fpay > 0 && r.fake && r.caught && r.refuse && r.forgedToMe, JSON.stringify(r));
    },
    'a lie is caught more often when it is bigger or one of many; the burned house tells the others, stops sharing news, and its loft keepers refuse your pigeons': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = window.__caravan; K.newCareerSeed(1013); const C = K.C; K.headless = true; C.phase = 5;
        const c = [1.5, 2.5, 4].map(x => K.catchChance(x)); C.lies = [C.day, C.day, C.day]; const often = K.catchChance(1.5); C.lies = [];
        const home = K.RIVAL_HOME[0], rv = C.rivals[0]; C.lofts[home] = 1; const near = K.cities.map(x => x.id).find(x => x !== home && K.crow(x, home) <= 24 && K.crow(x, home) > 10); C.lofts[near] = 1;
        const byPigeon = () => (K.newsPath(home, near) || { way: [] }).way.some(w => w[2]);
        rv.trust = 0.6; const sharing = () => { C.letters = []; for (let d = 0; d < 24; d++) K.tick(); return C.letters.some(l => l.src === 0 && !l.fake) || Object.values(C.book).some(b => b.src === 0 && !b.fake && C.day - b.day < 24); };
        const pigeonBefore = byPigeon(), sharedBefore = sharing(), others0 = C.rivals.slice(1).map(o => o.trust);
        K.burned(rv); const othersDrop = C.rivals.slice(1).every((o, k) => o.trust < others0[k] - 0.1);
        K.headless = false; return { c, often, pigeonBefore, sharedBefore, trust: rv.trust, othersDrop, pigeonAfter: byPigeon(), sharedAfter: (K.headless = true, sharing()), cap: C.rivals.every(o => o.trust <= 0.9 + 1e-9) }; });
      ok(r.c[0] < r.c[1] && r.c[1] < r.c[2] && r.often > r.c[0] + 0.2, 'catch chance should grow with size and frequency: ' + JSON.stringify(r));
      ok(r.othersDrop && r.trust < 0.3 && r.cap, 'a caught lie should spread: ' + JSON.stringify(r));
      ok(r.pigeonBefore && !r.pigeonAfter, 'their loft keepers should refuse your pigeons: ' + JSON.stringify(r));
      ok(r.sharedBefore && !r.sharedAfter, 'a burned house should stop sharing its news: ' + JSON.stringify(r));
      await page.evaluate(() => { window.__caravan.headless = false; });
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
    'upkeep: camels eat, debts sell a camel, gold never negative': async ({ page, eq, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C; C.gold = 0.01; const cam = C.camels; K.tick(); return [cam - C.camels, C.gold >= 0, C.day]; });
      eq(r[0], 1); ok(r[1]); eq(r[2], 1);
    },
    'roads are chosen for you: through bandit country with a light load, round it with a heavy one': async ({ page, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const K = window.__caravan, C = K.C; let pair = null;
        for (let a = 0; a < K.cities.length && !pair; a++) for (let b = 0; b < K.cities.length && !pair; b++) { if (a === b) continue; const f = K.shortest(a, b), s = K.shortest(a, b, true);
          if (f && s && f.legs.some(l => l.r.danger > .03) && s.days > f.days && s.days - f.days < 30) pair = { a, b }; }
        if (!pair) return null; C.at = pair.a; C.cargo = C.cargo.map(() => 0); K.planTo(pair.b); const light = K.traveling, lightDanger = document.getElementById('travelBox').textContent;
        const lightRoute = window.__caravan.cities && document.getElementById('travelBox').textContent.includes('long way'); C.cargo[11] = 300; K.planTo(pair.b); const heavy = document.getElementById('travelBox').textContent.includes('long way');
        return { lightRoute, heavy }; });
      ok(r && !r.lightRoute && r.heavy, JSON.stringify(r));
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
      ok(Math.abs(await page.evaluate(() => window.__caravan.cities[0].price[8]) - price) < 0.01, 'prices rolled back');
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
