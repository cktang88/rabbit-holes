// Ring Shepherd (in the slingshot/ slot): ring physics (resonances, shepherding, gap opening), the problem ladder,
// bots, the daily problem, saves, share links, input and the WebGL particle system. Runs the page in ?lite mode
// (few particles, low resolution) because the test browser renders WebGL in software.
const ready = async (page) => { await page.waitForFunction(() => window.__ring && window.__ring.G, null, { timeout: 20000 }); };
const reloadWith = async (page, v) => { await page.addInitScript((val) => { try { localStorage.setItem('rh:rings', val); } catch (e) {} }, v); await page.reload(); await ready(page); };
// in-page helpers: run a problem with a setup function for up to N orbits
const RUN = `(c, setup, orbits) => { const R = window.__ring, G = R.newState(c); setup(G, R); for (let k = 0; k < orbits && !G.solved; k++) R.tick(G, 32); return G; }`;
module.exports = {
  page: 'slingshot/index.html?lite',
  ready,
  tests: {
    'a 2:1 resonance carves its lane where Kepler says (a_moon · 2^(-2/3)), and a bigger moon carves a wider one': async ({ page, ok }) => {
      const r = await page.evaluate((RUN) => { const run = eval(RUN), R = window.__ring, out = [];
        for (const X of [1.7, 1.9, 2.1]) for (const m of [3e-6, 1e-5]) { const G = run({ start: [[1.45, 2.35, 50000]], check: () => ({ ok: false }) }, (G, R) => R.addMoon(G, X * Math.pow(2, 2 / 3), m, 0, 0), 150);
          const g = R.PH.gaps(G.S, .01).sort((a, b) => Math.abs((a.a0 + a.a1) / 2 - X) - Math.abs((b.a0 + b.a1) / 2 - X))[0]; out.push({ X, m, c: g ? (g.a0 + g.a1) / 2 : 0, w: g ? g.w : 0 }); }
        return out; }, RUN);
      for (const q of r) ok(Math.abs(q.c - q.X) < .03, `lane for ${q.X} at ${q.c.toFixed(3)}`);
      for (let i = 0; i < r.length; i += 2) ok(r[i + 1].w > r[i].w, `bigger moon, wider lane at ${r[i].X}: ${r[i].w} vs ${r[i + 1].w}`);
    },
    'an embedded moon opens a gap only above the threshold; a moonlet leaves a propeller instead': async ({ page, ok }) => {
      const r = await page.evaluate((RUN) => { const run = eval(RUN), R = window.__ring, C = { start: [[1.45, 2.35, 50000]], check: () => ({ ok: false }) };
        const lane = (m) => { const G = run(C, (G, R) => R.addMoon(G, 2.0, m, 0, 0), 100); const g = R.PH.gaps(G.S, .005).filter(q => q.a0 < 2 && q.a1 > 2)[0]; return g ? g.w : 0; };
        return { moonlet: lane(1e-7), moon: lane(3e-6), open: [R.PH.gapOpening(1e-7, 2), R.PH.gapOpening(3e-6, 2)] }; }, RUN);
      ok(r.moonlet < .02, 'moonlet lane ' + r.moonlet); ok(r.moon >= .03, 'moon lane ' + r.moon); ok(r.open[0] < 2.5 && r.open[1] > 3, JSON.stringify(r.open));
    },
    'shepherds hold a narrow ring for 1,000 orbits; a free ring spreads; without moons dust is conserved': async ({ page, ok }) => {
      const r = await page.evaluate((RUN) => { const run = eval(RUN), R = window.__ring, C = { start: [], check: () => ({ ok: false }) };
        const width = (G) => R.PH.narrowRings(G.S).sort((a, b) => b.m - a.m)[0].w;
        const free = run(C, (G, R) => R.pour(G, 2, 15000, .01), 1000), held = run(C, (G, R) => { R.pour(G, 2, 15000, .01); R.addMoon(G, 1.94, 3e-6, 0, 0); R.addMoon(G, 2.06, 3e-6, 1, 0); }, 1000);
        return { free: width(free), held: width(held), mass: R.PH.total(free.S) / 15000 }; }, RUN);
      ok(r.free > .1, 'free ring ' + r.free); ok(r.held < .04, 'shepherded ring ' + r.held); ok(Math.abs(r.mass - 1) < .02, 'mass ' + r.mass);
    },
    'deterministic: the same actions give the same rings, bit for bit': async ({ page, eq }) => {
      const h = await page.evaluate((RUN) => { const run = eval(RUN), R = window.__ring; const one = () => { const G = run(R.COMMS[1], (G, R) => { R.addMoon(G, 3.0, 8e-6, 0, 0); R.pour(G, 2.6, 5000); }, 60); let s = 0; for (let i = 0; i < G.S.length; i++) s = (s * 31 + Math.round(G.S[i] * 1000)) % 1e9; return [s, G.orbits]; };
        return [one(), one()]; }, RUN);
      eq(h[0], h[1]);
    },
    'every problem is solved by competent play (the right moons in the right places)': async ({ page, ok }) => {
      const r = await page.evaluate((RUN) => { const run = eval(RUN), R = window.__ring, C = R.COMMS, X = 1.9 * Math.pow(2, 2 / 3);
        const plans = [(G, R) => R.pour(G, 2.0, 25000), (G, R) => R.addMoon(G, 2.0 * Math.pow(2, 2 / 3), 1e-5, 0, 0), (G, R) => R.addMoon(G, 2.0, 2e-6, 0, 0), (G, R) => R.addMoon(G, 1.75, 1e-7, 0, 0),
          (G, R) => { R.pour(G, 2.0, 15000, .01); R.addMoon(G, 1.94, 3e-6, 0, 0); R.addMoon(G, 2.06, 3e-6, 1, 0); }, (G, R) => { R.pour(G, 2.0, 15000, .01); R.addMoon(G, 1.94, 3e-6, 0, .03); R.addMoon(G, 2.06, 3e-6, 1, 0); },
          (G, R) => { R.pour(G, 1.75, 60000, .15); R.addMoon(G, 1.62 * Math.pow(2, 2 / 3), 6e-6, 0, 0); R.addMoon(G, 1.9, 3e-6, 1, 0); R.pour(G, 2.95, 9000, .01); R.addMoon(G, 2.89, 3e-6, 2, 0); R.addMoon(G, 3.02, 3e-6, 3, 0); }];
        return C.map((c, i) => { const G = run(c, plans[i], 1100); return [c.id, !!G.solved, c.check(G).p]; }); }, RUN);
      for (const [id, s, p] of r) ok(s, `${id} not solved: ${p}`);
    },
    'naive play fails: doing nothing, pouring anywhere, or dropping random moons': async ({ page, ok }) => {
      const r = await page.evaluate((RUN) => { const run = eval(RUN), R = window.__ring, rng = RH.rng('naive'); let wins = 0, tot = 0;
        for (const i of [1, 4, 5, 6]) for (let k = 0; k < 4; k++) { tot++; const G = run(R.COMMS[i], (G, R) => { for (let q = 0; q < 2; q++) { R.pour(G, 1.3 + rng() * 2, 5000 + rng() * 10000); R.addMoon(G, 1.2 + rng() * 2.2, Math.pow(10, -8 + rng() * 3.5), 0, 0); } }, 300); if (G.solved) wins++; }
        const idle = R.COMMS.map(c => !!run(c, () => {}, 200).solved); return { wins, tot, idle }; }, RUN);
      ok(r.wins / r.tot <= .15, `random play solved ${r.wins}/${r.tot}`); ok(r.idle.every(x => !x), 'idling solved something: ' + r.idle);
    },
    'the problem of the day: same seed, same problem; competent play wins; no fixed placement wins every day': async ({ page, ok, eq }) => {
      const r = await page.evaluate((RUN) => { const run = eval(RUN), R = window.__ring; let comp = 0, fixed = 0, n = 10; const same = JSON.stringify(R.dailyComm('2026-11-25').start) === JSON.stringify(R.dailyComm('2026-11-25').start) && R.dailyComm('2026-11-25').X === R.dailyComm('2026-11-25').X;
        for (let i = 0; i < n; i++) { const c = R.dailyComm('2027-01-' + (i + 1)); if (run(c, (G, R) => R.addMoon(G, c.X * Math.pow(2, 2 / 3), 1e-5, 0, 0), 150).solved) comp++; if (run(c, (G, R) => R.addMoon(G, 3.0, 1e-5, 0, 0), 150).solved) fixed++; }
        return { same, comp, fixed, n, differ: R.dailyComm('a').X !== R.dailyComm('b').X }; }, RUN);
      ok(r.same && r.differ); ok(r.comp >= r.n - 1, `competent ${r.comp}/${r.n}`); ok(r.fixed < r.n, `fixed placement won ${r.fixed}/${r.n}`);
    },
    'saves survive corruption': async ({ page, ok }) => {
      for (const v of ['{', 'null', '[]', '7', '{"v":1,"cur":"zz","done":{"0":{"moons":"x"},"1":{"moons":-1,"orbits":5}},"seen":5}', '{"v":1,"cur":"day:2026-01-01","done":{"0":{"moons":0,"orbits":100}}}']) {
        await reloadWith(page, v); const s = await page.evaluate(() => ({ key: window.__ring.key, done: window.__ring.SAVE.done, n: window.__ring.G.S.length }));
        ok(s.n > 100 && typeof s.key === 'string', 'loads after ' + v); }
    },
    'share link replays the moons and the poured dust': async ({ page, ok, eq }) => {
      const url = await page.evaluate(() => { const R = window.__ring; R.openComm('0'); R.addMoon(R.G, 2.7, 2e-6, 0, 0); R.pour(R.G, 2.0, 12000); R.G.log.push(['p', 0, 2.0, 12000]); R.setMoons(R.G); return R.shareURL(); });
      await page.goto(url); await page.reload(); await ready(page);
      const r = await page.evaluate(() => ({ moons: window.__ring.G.moons.map(m => [m.a, m.m]), dust: window.__ring.PH.total(window.__ring.G.S) }));
      eq(r.moons, [[2.7, 2e-6]]); ok(Math.abs(r.dust - 12000) < 1, 'dust ' + r.dust);
    },
    'input: dragging pours dust (grains and GPU particles), holding grows a moon, tapping a moon makes it eccentric': async ({ page, ok }) => {
      await page.evaluate(() => { window.__ring.speed = 0; });
      const pts = await page.evaluate(() => { const out = []; for (let k = 0; k <= 12; k++) { const th = -1 + k * .12; out.push(window.__ring.screenOf(2 * Math.cos(th), 0, 2 * Math.sin(th))); } return out; });
      await page.mouse.move(...pts[0]); await page.mouse.down(); for (const q of pts) { await page.mouse.move(...q); await page.waitForTimeout(40); } await page.mouse.up();
      const a = await page.evaluate(() => { const b = window.__ring.readParticles(); let n = 0; for (let i = 2; i < b.length; i += 4) n += b[i] > .5; return { poured: window.__ring.G.poured, alive: n }; });
      ok(a.poured > 2000 && a.alive > 50, JSON.stringify(a));
      await page.click('#tMoon'); const m = await page.evaluate(() => window.__ring.screenOf(2.9, 0, 0)); await page.mouse.move(...m); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
      const b = await page.evaluate(() => window.__ring.G.moons.map(q => q.m)); ok(b.length === 1 && b[0] > 1e-7, 'moon grown ' + b);
      const mp = await page.evaluate(() => { const q = window.__ring.G.moons[0]; return window.__ring.screenOf(q.a * Math.cos(q.th), 0, q.a * Math.sin(q.th)); });
      await page.mouse.click(...mp); ok(await page.evaluate(() => window.__ring.G.moons[0].e > 0), 'tap made the orbit eccentric');
      await page.evaluate(() => { window.__ring.speed = 1; }); await page.click('#speedBtn'); ok((await page.textContent('#speedBtn')).includes('20'), 'speed button cycles to 20×');
    },
    'WebGL: float render targets, 100k+ grains at full quality, adaptive quality steps down when frames are slow': async ({ page, ok }) => {
      await page.goto(page.url().replace('?lite', '')); await ready(page); await page.waitForTimeout(4000);
      const r = await page.evaluate(() => ({ cap: window.__ring.CAP, f: window.__ring.floatRT, q: window.__ring.quality }));
      ok(r.f, 'float render targets'); ok(r.cap >= 100000, 'grains ' + r.cap); ok(r.q.quality > 0, 'software GL is slow, so quality should have stepped down: ' + JSON.stringify(r.q));
    },
  },
};
