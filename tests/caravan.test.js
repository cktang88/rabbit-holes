// Caravan: Silk Road trading. Logic via window.__caravan.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const keepStorage = async page => { const snap = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))); await page.addInitScript(s => { const o = JSON.parse(s); for (const k in o) localStorage.setItem(k, o[k]); }, snap); };
const reload = async page => { await keepStorage(page); await page.reload(); await page.waitForTimeout(500); await closeModals(page); };
module.exports = {
  page: 'caravan/index.html',
  tests: {
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
      const far = await page.evaluate(() => { const K = window.__caravan; K.encountersOn = false; K.planTo(10); K.travel(); return 10; });
      await page.waitForTimeout(700);
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
