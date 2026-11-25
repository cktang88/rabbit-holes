// Escapement: gear trains planted on a brass plate. Wheels mesh only where rims touch; hands sit at fixed dial positions.
const { escRandom, escPlan } = require('./escapement.bots.js');
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const GUILD = [1, 2, 3, 4, 5, 6, 7, 9];

module.exports = {
  page: 'escapement/index.html',
  ready: async page => { await page.waitForFunction(() => window.__esc); await closeModals(page); },
  tests: {
    'the plate: wheels mesh only at the sum of their radii, at the same depth; fouls, clashes, edges and depth are caught': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const E = window.__esc, c = E.C[0], d = E.blank(c), out = {};
        d.ax[0].g = [40]; d.ax[1].g = [80]; let R = E.solve(c, d); out.mesh = [R.ok, R.hands[0].exact, R.sp[1]];
        d.ax[1].g = [79]; R = E.solve(c, d); out.gap = R.hands[0].driven;
        d.ax[1].g = [90]; R = E.solve(c, d); out.overlap = R.probs.map(p => p.k).sort().join();
        // a compound arbor: its second wheel sits one level deeper
        const c2 = E.C.find(x => x.id === 'seconds'), e = E.blank(c2); e.ax[0].g = [16]; e.ax[1].g = []; const k = E.hang(c2, e, 0, 0, 100, 0); e.ax[k].g.push(96); e.ax[1].g = [10];
        e.ax[k].lk = [1, 0, 1]; R = E.solve(c2, e); out.compound = [R.ok, R.dep[k], R.hands[0].exact, R.sp[1] > 0];
        // too deep for a two-level plate
        const f = E.blank(c); f.ax[0].g = [20]; const a = E.hang(c, f, 0, 0, 20, -1.2); f.ax[a].g.push(20); const b = E.hang(c, f, a, 1, 20, 0); f.ax[b].g.push(20);
        out.deep = E.solve(c, f).probs.some(p => p.k === 'deep');
        return out;
      });
      eq(r.mesh, [true, true, -0.5]); eq(r.gap, false); ok(r.overlap.includes('foul') || r.overlap.includes('edge') || r.overlap.includes('clash'), 'overlap not caught: ' + r.overlap);
      eq(r.compound, [true, [0, 1], true, true]); ok(r.deep, 'depth not enforced');
    },
    'first commission in well under a minute on a phone: two jewels, two sliders, it runs and is delivered': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      ok((await page.textContent('#coach')).includes('motor'), 'no coach');
      const t0 = Date.now();
      for (const [i, T] of [[0, 40], [1, 80]]) {
        const pt = await page.evaluate(i => window.__esc.screenOf(i), i); await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(100);
        const cur = await page.evaluate(i => window.__esc.D.ax[i].g[0], i);
        await page.focus('#editor input[type=range]'); for (let k = cur; k < T; k++) await page.keyboard.press('ArrowRight');
      }
      await page.waitForTimeout(1000);
      ok(await page.evaluate(() => window.__esc.S.done.mesh === 1), 'not delivered');
      ok(Date.now() - t0 < 20000, 'too slow');
      ok(!(await page.locator('#nextF').isHidden()), 'no Next button on the plate');
      ok(!(await page.textContent('#coach')).length, 'coach still showing');
    },
    'swinging a hung wheel round its driver snaps it into mesh with the hand (mouse drag)': async ({ page, ok }) => {
      await page.evaluate(() => { const E = window.__esc; E.S.done.mesh = 1; E.open('idler'); });
      // motor 20, hang a 50 on it, give the hand arbor a 60: rims can close at two angles
      await page.evaluate(() => { const E = window.__esc, c = E.com(), d = E.D; d.ax[0].g = [20]; d.ax[1].g = [60]; E.hang(c, d, 0, 0, 74, 2.5); E.refresh(); });
      const target = await page.evaluate(() => { const E = window.__esc, c = E.com(), P = E.R.P, s = E.circleX(P[0], 10 + 37, P[1], 37 + 30)[0]; return E.screenOf ? [s, Math.atan2(s[1] - P[0][1], s[0] - P[0][0])] : null; });
      const st = await page.evaluate(() => window.__esc.screenOf(3));
      await page.mouse.move(st[0], st[1]); await page.mouse.down();
      // sweep the pointer round the motor towards the meshing angle
      const path = await page.evaluate(a1 => { const E = window.__esc, P = E.R.P, out = []; const a0 = 2.5; for (let k = 0; k <= 20; k++) { const a = a0 + (a1 - a0) * k / 20, x = P[0][0] + 47 * Math.cos(a), y = P[0][1] + 47 * Math.sin(a); out.push(x); out.push(y); } return out; }, target[1]);
      for (let k = 0; k < path.length; k += 2) { const sc = await page.evaluate(([x, y]) => { const E = window.__esc; return E.toScreenW(x, y); }, [path[k], path[k + 1]]); await page.mouse.move(sc[0], sc[1]); }
      await page.mouse.up(); await page.waitForTimeout(900);
      const r = await page.evaluate(() => { const E = window.__esc; return { lk: E.D.ax[3].lk, driven: E.R.hands[0].driven, ok: E.R.ok, done: E.S.done.idler }; });
      ok(r.lk && r.driven, 'did not snap into mesh: ' + JSON.stringify(r)); ok(r.ok && r.done, 'idler commission not met: ' + JSON.stringify(r));
    },
    'naive play fails: random tinkering never makes a working movement': async ({ page, ok }) => {
      await page.addScriptTag({ content: escRandom.toString() });
      const r = await page.evaluate(gl => { const E = window.__esc, coms = [...E.C.slice(1), ...gl.map(l => E.guildDef('t' + l, l))]; return coms.map(c => [0, 1, 2].filter(s => escRandom(c, s)).length); }, GUILD);
      ok(r.every(x => x === 0), 'random play succeeded: ' + r);
    },
    'competent adaptive play builds every commission; no fixed policy builds them all': async ({ page, ok }) => {
      await page.addScriptTag({ content: escPlan.toString() });
      const r = await page.evaluate(gl => { const E = window.__esc, coms = [...E.C, ...gl.map(l => E.guildDef('t' + l, l))], out = {};
        for (const pol of ['adaptive', 'min', 'plus1', 'straight']) out[pol] = coms.map(c => !!escPlan(c, 'x', pol));
        out.ids = coms.map(c => c.id + (c.level || '')); return out; }, GUILD);
      ok(r.adaptive.every(Boolean), 'adaptive failed: ' + r.ids.filter((_, i) => !r.adaptive[i]));
      for (const pol of ['min', 'plus1', 'straight']) ok(r[pol].some(x => !x), `${pol} builds everything`);
    },
    'deterministic per seed: the same Guild commission, the same members, the same histograms': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const E = window.__esc, a = E.guildDef('det', 4), b = E.guildDef('det', 4), c = E.guildDef('det2', 4);
        const pa = JSON.stringify(E.guildPop(a)), pb = JSON.stringify(E.guildPop(E.guildTry('det', 4, a.att))); return { same: JSON.stringify(a) === JSON.stringify(b), diff: JSON.stringify(a) !== JSON.stringify(c), pop: pa === pb, n: E.guildPop(a).length }; });
      ok(r.same && r.diff, 'commission not seeded'); ok(r.pop, 'members differ'); ok(r.n >= 10, 'thin guild: ' + r.n);
    },
    'error readout: never "every 0 days"; exact, tiny and huge errors read sensibly': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const E = window.__esc, D = 86400; return [E.drift(0, 29.5 * D), E.drift(26210000, 29.5 * D), E.drift(1000, 29.5 * D), E.drift(-.5, 365 * D), E.drift(3, 60), E.drift(1e-9, D * 30), E.fmtP(NaN), E.fmtP(2)]; });
      eq(r[0], 'exact, forever'); eq(r[1], 'hopelessly wrong'); ok(/gains a day in \d+ (days|years)/.test(r[2]), r[2]); ok(/loses a day in/.test(r[3]), r[3]); ok(/a second/.test(r[4]), r[4]); ok(!r.some(x => /\b0 days|NaN/.test(x)), r.join(' | ')); eq(r[7], '2 s');
    },
    'saves: corrupt or hostile saves load; no NaN anywhere on the page; a design survives reload': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const E = window.__esc, put = v => localStorage.setItem('rh:esc2', typeof v === 'string' ? v : JSON.stringify(v)), out = [];
        for (const v of ['{{', 'null', '[1]', { done: { mesh: 'x', zz: 1 }, best: { mesh: { e: 'NaN', g: 2, t: 120 }, idler: { e: 0, g: -1, t: 2 } }, guild: { level: 'x', seed: 5 }, cur: 7, designs: { mesh: { ax: [{ g: ['a'] }, { g: [1e9] }, { g: [20], p: [9, 0, 0], a: 'x' }] } } }]) {
          put(v); const s = E.loadState(); out.push([Object.keys(s.done).join(), Object.keys(s.best).join(), s.guild.level, s.cur, E.cleanDesign(E.C[0], s.designs.mesh)]); }
        return out; });
      eq(r[3].slice(0, 4), ['mesh', '', 1, 'mesh']); eq(r[3][4], null);
      r.forEach(x => ok(Number.isFinite(x[2]), 'bad guild level'));
      await page.evaluate(() => localStorage.setItem('rh:esc2', JSON.stringify({ done: { mesh: 1 }, best: { mesh: { e: null, g: 2, t: 'x' } }, cur: 'idler', designs: { idler: { ax: [{ g: [20] }, { g: [60] }, { g: [74], p: [0, 0, 0], a: 0.3, lk: [1, 0, 0] }] } } })));
      await page.reload(); await page.waitForFunction(() => window.__esc); await page.waitForTimeout(400);
      const t = await page.evaluate(() => ({ txt: document.body.innerText, n: window.__esc.D.ax.length, cur: window.__esc.S.cur }));
      ok(!/NaN|undefined|Infinity/.test(t.txt), 'NaN on page'); eq([t.n, t.cur], [3, 'idler']);
    },
    'share link: #m= opens the commission with the shared movement running': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const E = window.__esc, c = E.C.find(x => x.id === 'seconds'), d = E.plan(c, RH.rng('share'), { tries: 20, attempts: 8 }); E.S.done = { mesh: 1, idler: 1 }; E.open('seconds'); E.D = d; });
      await page.click('#shareB');
      const h = await page.evaluate(() => location.hash);
      ok(h.startsWith('#m='), 'no link');
      await page.evaluate(() => localStorage.clear());
      await page.reload(); await page.waitForFunction(() => window.__esc); await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ cur: window.__esc.S.cur, ok: window.__esc.R.ok }));
      eq(r, { cur: 'seconds', ok: true });
    },
    'the Guild: a delivered design is ranked on three histograms; today\'s commission is the same for everyone': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const E = window.__esc; ['mesh', 'idler', 'seconds', 'motion', 'pillar', 'pocket'].forEach(k => E.S.done[k] = 1); E.S.guild = { seed: 'gt', level: 2, daily: 0, n: 0 }; E.open('guild'); });
      await page.evaluate(() => { const E = window.__esc, c = E.com(); for (let s = 0; s < 10; s++) { const d = E.plan(c, RH.rng('gg' + s), { tries: 20, attempts: 8 }); if (d && E.solve(c, d).ok) { E.D = d; break; } } });
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => ({ n: window.__esc.S.guild.n, h: document.querySelectorAll('#ledger .hsvg svg').length, best: !!window.__esc.S.best[window.__esc.ckey(window.__esc.com())] }));
      ok(r.n === 1 && r.best, 'not delivered: ' + JSON.stringify(r)); eq(r.h, 3);
      await page.click('#gDaily');
      const d = await page.evaluate(() => window.__esc.S.guild.seed);
      ok(/^daily:\d{4}-\d\d-\d\d$/.test(d), d);
    },
    'mobile: the plate and the bench editor share one screen; nothing spills sideways': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const pt = await page.evaluate(() => window.__esc.screenOf(0)); await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(200);
      const r = await page.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(), e = document.getElementById('editor').getBoundingClientRect(); return { stage: s.height, edBottom: e.bottom, sw: document.documentElement.scrollWidth, bw: document.getElementById('bench').scrollWidth }; });
      ok(r.stage > 380 && r.edBottom < 844, JSON.stringify(r)); ok(r.sw <= 392 && r.bw <= 392, 'sideways: ' + JSON.stringify(r));
    },
  },
};
