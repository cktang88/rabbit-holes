// Belt Trick: SU(2) lift (sign after 360/720), BFS pars, level win rules, bets, mechanisms, golf, share codes, saves.
const ready = async page => { await page.waitForFunction(() => window.__belt && __belt.LV); await page.waitForTimeout(300); };
async function reopen(page, url) { const p = await page.context().newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(url || page.url()); await ready(p); p.errs = errs; return p; }
const QT = ['X+90', 'X-90', 'Y+90', 'Y-90', 'Z+90', 'Z-90'];

module.exports = {
  page: 'belt-trick/index.html',
  ready,
  tests: {
    'quaternion lift: 360° flips the sign, 720° restores it, about any axis; G48 is the binary octahedral group': async ({ page, eq, ok, near }) => {
      const r = await page.evaluate(() => { const B = __belt, out = {};
        for (const a of 'XYZ') { out[a + '360'] = B.seqQ([a + '+360'])[0]; out[a + '720'] = B.seqQ([a + '+360', a + '+360'])[0]; out[a + '4q'] = B.seqQ([a + '+90', a + '+90', a + '+90', a + '+90'])[0]; }
        out.ijk = B.seqQ(['X+180', 'Y+180', 'Z+180']); out.kji = B.seqQ(['Z+180', 'Y+180', 'X+180']); out.g48 = B.G48.length;
        // continuous turning through rotateBy keeps the lift (no sign flips): level 1, turn 360 in small steps
        B.level(0); B.rotate([1, 0, 0], 360); out.live = B.q(); B.rotate([1, 0, 0], 360); out.live2 = B.q();
        out.closed = B.G48.every(a => B.G48.some(b => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) > .999)); return out; });
      for (const a of 'XYZ') { near(r[a + '360'], -1, 1e-9, a + '360'); near(r[a + '720'], 1, 1e-9, a + '720'); near(r[a + '4q'], -1, 1e-9, a + ' four quarters'); }
      near(Math.abs(r.ijk[0]), 1, 1e-9, 'ijk is ±1'); eq(Math.sign(r.ijk[0]), -Math.sign(r.kji[0]), 'order of half-turns changes the sign');
      eq(r.g48, 48); near(r.live[0], -1, 1e-6, 'live 360'); near(r.live2[0], 1, 1e-6, 'live 720');
    },
    'BFS pars are optimal and solve() paths reach the target': async ({ page, eq, ok }) => {
      const r = await page.evaluate(QT => { const B = __belt, out = []; const id = [1, 0, 0, 0];
        out.push(['-1 by quarters', B.bfsPar(B.seqQ(['X+360']), QT)]);
        out.push(['identity', B.bfsPar(id, QT)]);
        out.push(['one quarter', B.bfsPar(B.seqQ(['Y+90']), QT)]);
        // every element of G48 is reachable, and the BFS distance equals the length of the reconstructed path
        let maxD = 0, bad = 0; for (const g of B.G48) { const d = B.bfsPar(id, QT, g), p = B.solve(id, QT, g); maxD = Math.max(maxD, d); const q = B.seqQ(p); if (p.length !== d || Math.abs(q[0] * g[0] + q[1] * g[1] + q[2] * g[2] + q[3] * g[3]) < .999) bad++; }
        return { out, maxD, bad, pars: B.LV.map((l, i) => { B.level(i); return B.par; }) }; }, QT);
      eq(r.out, [['-1 by quarters', 4], ['identity', 0], ['one quarter', 1]]); eq(r.bad, 0); ok(r.maxD >= 4 && r.maxD <= 8, 'diameter ' + r.maxD);
      eq(r.pars[1], 4); eq(r.pars[5], 1); eq(r.pars[6], 4);
    },
    'level rules: right answers win, wrong ones do not, nothing wins at the start': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const B = __belt, out = [];
        const T = (lv, wrong, right, sel) => { B.level(lv); B.relax(); B.check('relax'); const auto = B.won;
          B.level(lv); if (sel != null) B.sel(sel); wrong.forEach(t => B.move(t)); B.relax(); B.check('relax'); const w = B.won;
          B.level(lv); if (sel != null) B.sel(sel); right.forEach(t => B.move(t)); B.relax(); B.check('relax'); out.push([lv + 1, auto, w, B.won]); };
        const q4 = ['X+90', 'X+90', 'X+90', 'X+90'];
        T(0, [...q4, ...q4], q4); T(1, ['X+90', 'X+90'], q4); T(2, ['X+360'], ['X+360', 'Y+360']); T(3, ['Z+180', 'Y+180', 'X+180'], ['X+180', 'Y+180', 'Z+180']);
        T(5, ['Z+90'], ['Z-270']); T(6, ['X+90', 'X-90'], q4); T(7, ['Y+90', 'Y+90', 'Y+90'], ['Y-90', 'Y-90', 'Y-90']); T(8, ['X+90', 'X-90'], q4);
        T(10, ['X+90'], ['X-90', 'Y-90', 'Y-90']);
        B.level(9); B.sel(0); q4.forEach(t => B.move(t)); B.relax(); B.check('relax'); const chainHalf = B.won; B.sel(2); q4.forEach(t => B.move(t)); B.relax(); B.check('relax'); out.push([10, false, chainHalf, B.won]);
        return out; });
      for (const [lv, auto, wrong, right] of r) { eq(auto, false, `level ${lv} won at start`); eq(wrong, false, `level ${lv} won with a wrong answer`); eq(right, true, `level ${lv} right answer`); }
    },
    'move limits: One Move allows exactly one, Two Different Turns forbids repeating an axis, locked cubes stay put': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const B = __belt; B.level(5); B.move('Z+90'); const q1 = B.q(); B.move('Z+90'); const q2 = B.q();
        B.level(2); B.move('X+360'); const a = B.q(); B.move('X+360'); const b = B.q();
        B.level(8); const qb = B.q(1); B.sel(1); B.move('X+90'); const qb2 = B.q(1);
        return { one: JSON.stringify(q1) === JSON.stringify(q2), rep: JSON.stringify(a) === JSON.stringify(b), lock: JSON.stringify(qb) === JSON.stringify(qb2) }; });
      eq(r, { one: true, rep: true, lock: true });
    },
    'Place Your Bets needs three right in a row (regression: random guessing used to win)': async ({ page, eq, ok }) => {
      const r = await page.evaluate(async () => { const B = __belt, sl = ms => new Promise(r => setTimeout(r, ms)); B.level(4);
        const one = async right => { for (let k = 0; k < 60 && !(B.bet.seq && B.bet.phase === 'watch'); k++) await sl(50); B.flush(); const plus = B.seqQ(B.bet.seq)[0] > 0; B.placeBet(right ? plus : !plus); B.relax(); await sl(50); };
        await one(true); await one(true); const s2 = B.bet.right; await one(false); const s0 = B.bet.right, w0 = B.won;
        B.nextBet(); await one(true); await one(true); B.nextBet(); await one(true); await sl(1100);
        return { s2, s0, w0, won: B.won, lamp: document.getElementById('lampt').textContent }; });
      eq(r.s2, 2); eq(r.s0, 0, 'a miss resets the streak'); eq(r.w0, false); eq(r.won, true);
    },
    'two wrong bets in a row teach the rule instead of leaving it to guesswork': async ({ page, ok }) => {
      const r = await page.evaluate(async () => { const B = __belt, sl = ms => new Promise(r => setTimeout(r, ms)); B.level(4); const tx = [];
        for (let n = 0; n < 2; n++) { for (let k = 0; k < 60 && !(B.bet.seq && B.bet.phase === 'watch'); k++) await sl(50); B.flush(); B.placeBet(!(B.seqQ(B.bet.seq)[0] > 0)); B.relax(); tx.push(document.getElementById('toast').textContent); if (!n) B.nextBet(); }
        return tx; });
      ok(!/Rule/.test(r[0]), 'rule shown after one miss'); ok(/Rule/.test(r[1]) && /360/.test(r[1]), 'no rule after two misses: ' + r[1]);
    },
    'regression: a delayed win from the previous level never lands on the next one': async ({ page, eq }) => {
      const r = await page.evaluate(async () => { const B = __belt, sl = ms => new Promise(r => setTimeout(r, ms)); B.level(4);
        for (let n = 0; n < 3; n++) { for (let k = 0; k < 60 && !(B.bet.seq && B.bet.phase === 'watch'); k++) await sl(50); B.flush(); B.placeBet(B.seqQ(B.bet.seq)[0] > 0); B.relax(); if (n < 2) B.nextBet(); }
        B.level(5); await sl(1200); const wonAfter = B.won, done5 = !!B.SAVE.done[5], done4 = !!B.SAVE.done[4];
        // golf: matching a hole then switching level must not advance a hole on the next level (it used to throw)
        B.level(15); B.solve([1, 0, 0, 0], ['X+90', 'X-90', 'Y+90', 'Y-90', 'Z+90', 'Z-90'], B.seqQ(B.LV[15].holes[0])).forEach(t => B.move(t)); B.level(16); await sl(1300);
        return { wonAfter, done5, done4, hole: B.golf.hole }; });
      eq(r, { wonAfter: false, done5: false, done4: false, hole: 0 });
    },
    'mechanisms: anti-twister gear orders need +1/2 (sign and size), wrong trains snap; the satellite needs half-speed driving': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const B = __belt, out = {};
        const tryG = o => { B.gears(o); B.run(); B.sim(10); return { k: B.gj.k, broken: B.mech.broken }; };
        B.level(13); out.g = [tryG({ T: 24, idler: false }), tryG({ T: 24, idler: true }), tryG({ T: 30, idler: true }), tryG({ T: 36, idler: true }), tryG({ A: 16, B: 16, C: 24 })]; out.gwon = B.won; out.gstars = B.SAVE.done[13];
        // three snapped cables empty the drawer and the orders start again
        B.level(13); out.out = [tryG({ T: 12, idler: true }), tryG({ T: 24, idler: true }), tryG({ T: 18, idler: true }), tryG({ T: 36, idler: false })].map(x => x.k);
        for (const mode of ['never', 'always', 'alt']) { B.level(14); B.hold(true); B.sim(17, t => B.hold(mode === 'always' || (mode === 'alt' && (t % 1.2) < .6))); out[mode] = B.won; }
        return out; });
      eq(r.g, [{ k: 0, broken: true }, { k: 1, broken: false }, { k: 1, broken: true }, { k: 2, broken: false }, { k: 2, broken: false }], 'gear orders');
      eq(r.gwon, true); eq(r.gstars, 2, 'two snapped cables cost a star'); eq(r.out, [0, 1, 1, 0], 'out of cable sends you back to order 1'); eq([r.never, r.always, r.alt], [false, false, true]);
    },
    'golf: optimal play scores par and a sign-wrong match does not count': async ({ page, eq, ok }) => {
      const r = await page.evaluate(async () => { const B = __belt, sl = ms => new Promise(r => setTimeout(r, ms)), out = {};
        for (const lv of [15, 16]) { B.level(lv); for (let h = 0; h < 3; h++) { B.solve([1, 0, 0, 0], ['X+90', 'X-90', 'Y+90', 'Y-90', 'Z+90', 'Z-90'], B.seqQ(B.LV[lv].holes[B.golf.hole])).forEach(t => B.move(t)); await sl(1250); }
          await sl(1100); out[lv] = { won: B.won, total: B.golf.total, par: B.golf.results.reduce((a, r) => a + r[1], 0) }; }
        B.level(16); ['X+90', 'X+90', 'X-90', 'X-90'].forEach(t => B.move(t)); out.wrongSign = B.golf.matched; return out; });
      for (const lv of [15, 16]) { eq(r[lv].won, true, 'golf ' + lv); eq(r[lv].total, r[lv].par, 'par ' + lv); }
      eq(r.wrongSign, false);
    },
    'the waiter: two full turns relax the arm, one does not': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const B = __belt, out = {}; B.calm = true;
        for (const turns of [1, 2]) { B.level(11); B.startWaiter(); B.sim(turns * 4, () => B.rotate([0, 1, 0], 360 / 4 / 60)); B.sim(3); out[turns] = B.won; }
        B.calm = false; return out; });
      eq(r, { 1: false, 2: true });
    },
    'share codes round-trip every angle, and long shared sequences play in full (regression)': async ({ page, eq, ok }) => {
      const toks = ['X+90', 'X-90', 'Y+180', 'Z-180', 'X+360', 'Y-360', 'Z+270', 'X-270'];
      eq(await page.evaluate(t => __belt.decode(__belt.enc(t)), toks), toks);
      const seq = ['X+90', 'Y+90', 'Z+90', 'X+90', 'Y+90', 'Z+90', 'X+90', 'Y+90'];
      const code = await page.evaluate(t => __belt.enc(t), seq);
      const p = await reopen(page, page.url().split('#')[0] + '#seq=' + code); await p.waitForTimeout(1200);
      await p.evaluate(() => __belt.flush());
      const r = await p.evaluate(s => ({ q: __belt.q(), want: __belt.seqQ(s), lv: __belt.level_ }), seq);
      eq(r.lv, 18); ok(Math.abs(r.q.reduce((a, v, i) => a + v * r.want[i], 0)) > .999, 'shared sequence was truncated'); ok(!p.errs.length, p.errs[0]); await p.close();
    },
    'level 1 by hand: four taps on +90°, then swinging the cable loop round the box shows it stuck (and that wins the lesson)': async ({ page, eq, ok }) => {
      await page.evaluate(() => __belt.level(0)); await page.waitForTimeout(200);
      for (let k = 0; k < 4; k++) { await page.click('[data-m="X+90"]'); await page.waitForTimeout(450); }
      await page.waitForFunction(() => !__belt.busy, null, { timeout: 5000 });
      ok(/swing it round the box/.test(await page.$eval('#goal', g => g.textContent)), 'coach should say to swing the loop now');
      eq(await page.$eval('#lampt', e => e.textContent), '?', 'the gauge stays covered until the loop has been tried');
      const p = await page.evaluate(() => __belt.ribbonScreen(0, .35)), c = await page.evaluate(() => __belt.screen(0)), rad = Math.hypot(p[0] - c[0], p[1] - c[1]), a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
      await page.mouse.move(p[0], p[1]); await page.mouse.down();
      for (let k = 1; k <= 54; k++) { const a = a0 + k / 48 * 2 * Math.PI; await page.mouse.move(c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)); }
      await page.mouse.up(); await page.waitForFunction(() => !__belt.relaxing, null, { timeout: 8000 });
      eq(await page.evaluate(() => __belt.won), true, 'stuck cable after one full turn should complete level 1');
      eq(await page.$eval('#lampt', e => e.textContent), 'stuck −1');
    },
    'level 2: keep turning forwards and the loop frees the cable after the second full turn': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const B = __belt; B.level(1); const out = []; for (let k = 1; k <= 4; k++) { B.move('X+90'); if (k === 4) { B.relax(); B.check('relax'); } out.push(B.won); } return out; });
      eq(r, [false, false, false, true]);
    },
    'difficulty: naive play fails on the last third, competent play wins, 3 stars need solver-level play': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const B = __belt, QT = ['X+90', 'X-90', 'Y+90', 'Y-90', 'Z+90', 'Z-90'], stars = over => over <= 0 ? 3 : over <= 2 ? 2 : 1, rnd = RH.rng(7), res = { naive: 0, runs: 0, comp: [], simple: [] };
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
        const mul = (t, q) => { const a = B.seqQ([t]); return [a[0] * q[0] - a[1] * q[1] - a[2] * q[2] - a[3] * q[3], a[0] * q[1] + a[1] * q[0] + a[2] * q[3] - a[3] * q[2], a[0] * q[2] - a[1] * q[3] + a[2] * q[0] + a[3] * q[1], a[0] * q[3] + a[1] * q[2] - a[2] * q[1] + a[3] * q[0]]; };
        // golf: each hole is a target in the 48-element group, matched with the game's rule (sign included); strokes capped at 40
        const golf = (lv, policy) => { let over = 0; for (const h of B.LV[lv].holes) { const tg = B.seqQ(h), par = B.bfsPar([1, 0, 0, 0], QT, tg); let q = [1, 0, 0, 0], n = 0;
            while (dot(q, tg) < Math.cos(.07) && n < 40) { q = mul(policy(q, tg), q); n++; } over += n >= 40 ? 99 : n - par; } return stars(over); };
        const randomP = () => QT[rnd() * 6 | 0], greedyP = (q, tg) => QT.reduce((b, t) => Math.abs(dot(mul(t, q), tg)) > Math.abs(dot(mul(b, q), tg)) ? t : b, QT[0]);
        const solverP = (q, tg) => B.solve(q, QT, tg)[0];
        for (const lv of [15, 16]) { for (let t = 0; t < 3; t++) { res.runs++; if (golf(lv, randomP) <= 1) res.naive++; } res.simple.push(golf(lv, greedyP)); res.comp.push(golf(lv, solverP)); }
        // anti-twister: random parts from the drawer vs the right trains; every snap costs a star
        const gear = picks => { B.level(13); let guard = 0; while (!B.won && guard++ < 40) { B.gears(picks(B.gj.k)); B.run(); B.sim(10); } return B.won ? B.SAVE.done[13] : 0; };
        const J = B.LV[13].jobs, pick = a => a[rnd() * a.length | 0];
        for (let t = 0; t < 3; t++) { delete B.SAVE.done[13]; res.runs++; if (gear(k => J[k].stages ? { A: pick(J[k].gears), B: pick(J[k].gears), C: pick(J[k].gears) } : { T: pick(J[k].gears), idler: rnd() < .5 }) <= 1) res.naive++; }
        delete B.SAVE.done[13]; res.comp.push(gear(k => [{ T: 24, idler: true }, { T: 36, idler: true }, { A: 16, B: 16, C: 24 }][k]));
        // satellite: never / always / random long holds vs steady half-speed driving
        const sat = f => { B.level(14); B.hold(true); B.sim(17, f); return B.won ? 3 : 0; };
        const randHold = (() => { let next = 0, on = true; return t => { if (t >= next) { on = !on; next = t + .5 + rnd() * 2; } B.hold(on); }; })();
        for (const f of [() => B.hold(false), () => B.hold(true), randHold]) { res.runs++; if (sat(f) <= 1) res.naive++; }
        res.comp.push(sat(t => B.hold((t % 1.2) < .6)));
        return res; });
      ok(r.naive / r.runs >= .8, `naive bots got 2★+ in ${r.runs - r.naive}/${r.runs} late runs`);
      ok(r.comp.every(s => s === 3), 'competent: ' + r.comp); ok(r.simple.some(s => s < 3), 'greedy golf (blind to the hidden sign) still gets 3★: ' + r.simple);
    },
    'the lamp: lit while the cable is flat, dark when twisted or stuck — success is visible without reading': async ({ page, ok }) => {
      const lv = async () => { await page.waitForTimeout(200); return page.evaluate(() => __belt.lampLevel()); };
      await page.evaluate(() => __belt.level(0)); const start = await lv();
      await page.evaluate(() => { ['X+90', 'X+90'].forEach(t => __belt.move(t)); }); const twisted = await lv();
      await page.evaluate(() => { ['X+90', 'X+90'].forEach(t => __belt.move(t)); __belt.swing(); }); const stuck = await lv();
      await page.evaluate(() => { __belt.level(1); ['X+90', 'X+90', 'X+90', 'X+90'].forEach(t => __belt.move(t)); __belt.swing(); }); const lit = await lv();
      ok(start > .9, 'lamp on at the start ' + start); ok(twisted < .5, 'twisted lamp should be dim ' + twisted); ok(stuck < .5, 'stuck lamp should be dark ' + stuck); ok(lit > .9, 'freed lamp should light ' + lit);
    },
    'two hands: a swing is one counted move that clears at most two full turns; One Swing needs the right direction': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const B = __belt, q = t => [0, 1, 2, 3].forEach(() => B.move(t));
        B.level(17); q('X+90'); B.swing(); B.check('relax'); const fwd = { won: B.won, flat: B.ribbons()[0].flat, swings: B.swings }; const second = B.swing();
        B.level(17); q('X-90'); B.swing(); B.check('relax'); const back = { won: B.won, stars: B.SAVE.done[17] };
        B.level(2); B.move('X+360'); B.swing(); B.move('Y+360'); B.swing(); B.check('relax'); const extra = B.SAVE.done[2];
        return { fwd, second, back, extra }; });
      eq(r.fwd, { won: false, flat: false, swings: 1 }, 'four turns forward: one swing is not enough'); eq(r.second, false, 'no second swing on this rig');
      eq(r.back, { won: true, stars: 3 }); ok(r.extra < 3, 'a wasted extra swing costs a star: ' + r.extra);
    },
    'keyboard: X turns the cube, Shift+X turns it back; RELAX is disabled while betting': async ({ page, near, ok }) => {
      await page.evaluate(() => __belt.level(10)); await page.waitForTimeout(100);
      const q0 = await page.evaluate(() => { __belt.flush(); return __belt.q(); });
      await page.keyboard.press('x'); await page.keyboard.press('Shift+X'); await page.waitForFunction(() => !__belt.queueN && !__belt.busy, null, { timeout: 20000 });
      const q1 = await page.evaluate(() => __belt.q());
      near(q0.reduce((a, v, i) => a + v * q1[i], 0), 1, 1e-6, 'x then shift-x is the identity');
      await page.evaluate(() => __belt.level(4)); ok(await page.$eval('#rx', b => b.disabled), 'RELAX enabled during bets');
    },
    'corrupted saves never crash and a locked level is never resumed': async ({ page, ok, eq }) => {
      for (const v of ['null', '[]', '{"done":null,"best":3,"cur":"x"}', '{"done":{"0":3,"77":3},"cur":9}', '{"rec":{"moves":7},"recSteps":"zz","cur":17}']) {
        await page.evaluate(v => { localStorage.clear(); localStorage.setItem('rh:belt-trick', v); }, v);
        const p = await reopen(page); const lv = await p.evaluate(() => __belt.level_);
        ok(!p.errs.length, `save ${v}: ${p.errs[0]}`); ok(lv <= 1 || lv === 18, `resumed into locked level ${lv} from ${v}`); await p.close();
      }
      const hub = await page.evaluate(() => { const B = __belt; for (let i = 0; i < B.LV.length - 1; i++) B.SAVE.done[i] = 3; B.level(0); return JSON.parse(localStorage.getItem('rh:hub'))['belt-trick']; });
      eq(hub, 1);
    },
  },
};
