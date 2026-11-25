// Low Reynolds: Purcell's swimmer in resistive-force theory. Physics invariants (scallop theorem, linearity,
// frame-rate independence, reversal), every level solvable / not solved at start, saves and UI edge cases.
const setup = page => page.evaluate(() => {
  window.circ = (r, cx, cy) => Array.from({ length: 64 }, (_, i) => [cx + r * Math.cos(i / 64 * 2 * Math.PI), cy - r * Math.sin(i / 64 * 2 * Math.PI)]);
  window.unlock = () => { for (let i = 0; i < __lr.LV.length; i++) __lr.SAVE.done[i] = 1; };
  // steer with a turning loop / straight loop toward waypoints (backs off when blocked)
  window.pilot = (wps, maxPath = 4000) => { const X = __lr, sw = X.sw(); let mode = '', used = 0;
    for (const [wx, wy, rad = .5] of wps) while (Math.hypot(sw.x - wx, sw.y - wy) > rad && used < maxPath) {
      const e = Math.atan2(Math.sin(Math.atan2(wy - sw.y, wx - sw.x) - sw.phi), Math.cos(Math.atan2(wy - sw.y, wx - sw.x) - sw.phi));
      const m = e > .15 ? 'L' : e < -.15 ? 'R' : 'S';
      if (m !== mode) { mode = m; X.setLoop(m === 'L' ? circ(.65, -.7, -.7) : m === 'R' ? circ(.65, .7, .7) : circ(1.15, 0, 0)); }
      X.advance(.2); used += .2; if (X.St().blocked) { X.reverse(); X.advance(3); mode = ''; }
    } return used; };
  // E. coli policies, run headless: returns the time the food was reached, -1 if eaten, -2 if time ran out
  window.coli = (lv, pol, seed) => { const X = __lr; X.bodySeed(seed); X.load(lv); const L = X.level, sw = X.sw(); let last = -1, rs = seed * 13 + 7; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < L.time; t += .05) { X.coliStep(.05); if (Math.hypot(sw.x - L.food[0], sw.y - L.food[1]) < L.foodR) return t; if (X.St().eaten) return -1; const T = X.bd.taste;
      if (X.bd.reads !== last) { last = X.bd.reads;
        if (pol === 'random') { if (rnd() < .25) X.tumble(); } else if (pol === 'always') X.tumble();
        else if (pol === 'compare') { if (L.predator) { const dx = L.predator[0] - sw.x, dy = L.predator[1] - sw.y, d = Math.hypot(dx, dy); if (d < 18 && (Math.cos(sw.phi) * dx + Math.sin(sw.phi) * dy) / d > -.3 && X.bd.mode === 'run') { X.tumble(); T.length = 0; continue; } }
          if (T.length >= 6) { const a = (T[T.length - 1] + T[T.length - 2] + T[T.length - 3]) / 3, b = (T[T.length - 4] + T[T.length - 5] + T[T.length - 6]) / 3; if (a < b) { X.tumble(); T.length = 0; } } } } }
    return -2; };
  // sperm tail: fixed stroke, run to the line; returns the energy used if it made it inside time and budget, else 0
  window.tail = (lv, n, A) => { const X = __lr; X.load(lv); const L = X.level, b = X.bd; b.n = n; b.A = A; b.running = true; for (let t = 0; t < L.time + .01 && b.x < L.dist; t += .02) X.tailStep(.02); return b.x >= L.dist && b.E <= L.ebudget && b.t <= L.time + .02 ? b.E : 0; };
  __lr.playing = false;
});
const openWith = async (page, save) => {
  const p2 = await page.context().newPage(), errs = []; p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(page.url()); await p2.evaluate(s => localStorage.setItem('rh:lowre', s), save); await p2.reload(); await p2.waitForTimeout(400);
  return { p2, errs };
};
module.exports = {
  page: 'low-reynolds/index.html',
  tests: {
    'Stokes flow: body velocity is linear in shape velocity': async ({ page, near }) => {
      const r = await page.evaluate(() => { const o = []; for (const [a, b, c, d] of [[.3, -.5, .7, .2], [1, 1, -.3, .4], [-1.2, .4, .1, -.9]]) {
        const bv = (t1, t2, d1, d2) => { const o = new Float64Array(3); __lr.bodyVel(t1, t2, d1, d2, o); return Array.from(o); };
        const v1 = bv(a, b, c, d), v2 = bv(a, b, 3 * c, 3 * d), vn = bv(a, b, -c, -d), v0 = bv(a, b, 0, d), vs = bv(a, b, c, 0).map((x, i) => x + v0[i]);
        o.push([v1, v2, vn, vs]); } return o; });
      for (const [v1, v2, vn, vs] of r) for (let i = 0; i < 3; i++) { near(v2[i], 3 * v1[i], 1e-12); near(vn[i], -v1[i], 1e-12); near(vs[i], v1[i], 1e-12); }
    },
    'scallop theorem: reciprocal strokes go nowhere, fast/slow or not': async ({ page, near, ok }) => {
      await setup(page);
      const r = await page.evaluate(() => { const X = __lr, out = [];
        for (const asym of [false, true]) { X.load(0); X.asym = asym; const sw = X.sw(), x0 = sw.x; while (X.St().cycles < 8) X.advance(.05);
          // finish exactly on a whole stroke: travel back to the loop start
          out.push([sw.x - x0, sw.y, sw.phi - Math.PI / 2, X.St().strokes]); }
        // a two-hinge back-and-forth line is reciprocal too
        unlock(); X.load(1); X.setLoop(Array.from({ length: 64 }, (_, i) => { const t = Math.sin(i / 64 * Math.PI * 2) * 1.2; return [t, t]; }), true); const sw = X.sw(), x0 = sw.x, s0 = X.St().strokes; while (X.St().strokes - s0 < 6) X.advance(.05);
        out.push([sw.x - x0, sw.y, sw.phi]); X.asym = false; return out; });
      for (const [dx, dy, phi] of r) { ok(Math.abs(dx) < .02, 'net drift ' + dx); near(dy, 0, .02); near(phi, 0, .02); }
      // over a whole number of strokes it is essentially exact
      const exact = await page.evaluate(() => { const X = __lr; X.load(0); const sw = X.sw(), x0 = sw.x; let mx = 0; for (let k = 0; k < 400; k++) { X.advance(.05); mx = Math.max(mx, Math.abs(sw.x - x0)); }
        const per = X.loop.reduce((a, p, i, L) => a + Math.hypot(L[(i + 1) % L.length][0] - p[0], L[(i + 1) % L.length][1] - p[1]), 0);
        X.load(0); const x1 = X.sw().x; X.advance(per * 7); return [X.sw().x - x1, mx]; });
      ok(Math.abs(exact[0]) < 1e-6, 'after exactly 7 strokes the scallop is back: ' + exact[0]);
      ok(exact[1] > .01, 'but it does wiggle in between');
    },
    'two hinges swim; reversing the loop reverses the motion with equal energy': async ({ page, ok, near }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr, o = [];
        for (const rev of [false, true]) { X.load(1); if (rev) { X.setLoop(X.loop.slice().reverse()); } const s0 = X.St().strokes, e0 = X.St().energy, x0 = X.sw().x; while (X.St().strokes - s0 < 4) X.advance(.02); o.push([X.sw().x - x0, X.sw().phi, X.St().energy - e0]); }
        return o; });
      ok(r[0][0] > .2, 'circle swims forward ' + r[0][0]); ok(r[1][0] < -.2, 'reversed swims back ' + r[1][0]);
      near(r[0][0], -r[1][0], .01); near(r[0][1], 0, .02, 'centred circle swims straight'); near(r[0][2], r[1][2], .05, 'same energy both ways');
      ok(r[0][2] > 0, 'swimming costs energy');
    },
    'frame-rate and step-size independence': async ({ page, near }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr, o = {};
        const run = (chunk, total, ds = .004, pre) => { X.ds = ds; X.load(1); X.setLoop(circ(.65, .7, .7)); X.load(1); let t = 0; while (t < total - 1e-9) { const c = Math.min(chunk, total - t); X.advance(c * 2.2 * 3); t += c; } const sw = X.sw(); X.ds = .004; return [sw.x, sw.y, sw.phi, X.St().energy, X.St().strokes]; };
        o.f30 = run(1 / 30, 6); o.f144 = run(1 / 144, 6); o.f20 = run(1 / 20, 6); o.fine = run(1 / 60, 6, .001); return o; });
      for (const k of ['f144', 'f20', 'fine']) for (let i = 0; i < 5; i++) near(r[k][i], r.f30[i], 3e-3 * Math.max(1, Math.abs(r.f30[i])), `${k}[${i}]`);
    },
    'off-centre loops turn the swimmer; mirrored loops turn the other way': async ({ page, ok, near }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr, o = [];
        for (const c of [[.7, .7], [-.7, -.7]]) { X.load(1); X.setLoop(circ(.65, ...c)); X.load(1); while (X.St().strokes < 5) X.advance(.05); o.push(X.St().phi); } return o; });
      ok(Math.abs(r[0]) > .1, 'turns ' + r[0]); near(r[0], -r[1], .02);
    },
    'every level: not solved at start, solvable, wrong strategy fails': async ({ page, ok }) => {
      await setup(page);
      const R = await page.evaluate(() => { FX.setMuted(true); unlock(); const X = __lr, o = {}, W = () => X.level.test(X.St()) || X.won;
        const tick = () => { const L = X.level, sw = X.sw(), St = X.St();
          if (L.target) St.reached = Math.hypot(sw.x - L.target[0], sw.y - L.target[1]) < (L.tr || .45);
          if (L.line != null) St.reached = L.maxCycles || L.budget ? Math.abs(sw.x - L.start[0]) >= Math.abs(L.line) : (L.line > 0 ? sw.x >= L.line : sw.x <= L.line); };
        const until = (cond, step = .05, max = 40000) => { let k = 0; while (!cond() && k++ < max) { X.advance(step); tick(); } tick(); };
        X.LV.forEach((l, i) => { X.load(i); tick(); o['start' + i] = l.test(X.St()); });
        X.load(0); until(() => X.St().cycles >= 8); o.w0 = W(); X.load(0); X.preset('line'); until(() => X.St().cycles >= 8); o.s0 = W();
        X.load(1); until(() => X.sw().x >= 2.6, .1, 4000); o.p1 = W(); X.load(1); X.drawLoop(circ(1.1, 0, 0)); until(() => X.sw().x >= 2.6, .1, 4000); o.s1 = W();
        X.load(2); pilot([[1.8, -2.6], [5.4, -2.6, .6]]); tick(); o.s2 = W();
        X.load(3); X.asym = false; until(() => X.St().cycles >= 40, .1); o.w3 = W(); X.load(3); X.asym = true; until(() => X.St().reached || X.St().cycles >= 80, .1); o.s3 = W(); X.asym = false;
        // E. coli: the textbook strategy (tumble when the taste has dropped over the last second), on a fixed seed
        for (const lv of [4, 5, 6]) { let won = 0; for (const seed of [1, 2, 3, 4, 5]) { if (coli(lv, 'compare', seed) >= 0) won++; } o['s' + lv] = won >= 3; o['w' + lv] = [1, 2, 3, 4, 5].filter(s2 => coli(lv, 'never', s2) >= 0).length <= 1; }
        for (const lv of [7, 8]) { o['s' + lv] = tail(lv, ...(lv === 7 ? [.5, .15] : [.75, .2])) > 0; o['w' + lv] = tail(lv, 1.5, .2) === 0; }
        return o; });
      for (let i = 0; i < 9; i++) ok(!R['start' + i], `level ${i} solved at start`);
      for (const k of ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) ok(R[k], `${k} not solved: ` + JSON.stringify(R));
      for (const k of ['w0', 'w3', 'p1']) ok(!R[k], `${k}: wrong strategy won`);
      for (const k of ['w4', 'w5', 'w6', 'w7', 'w8']) ok(R[k], `${k}: the naive strategy should fail`);
    },
    'level 1 waits for the player: idling never wins, and nothing swims until a stroke is chosen': async ({ page, eq, ok }) => {
      await page.evaluate(() => { __lr.load(0); __lr.playing = true; }); await page.click('[data-s="8"]'); await page.waitForTimeout(4000);
      eq(await page.evaluate(() => [__lr.won, __lr.St().strokes]), [false, 0], 'the default stroke ran by itself');
      ok(/Your move/.test(await page.textContent('#stat')), 'prompt for the first stroke');
      await page.click('[data-p="line"]'); await page.waitForFunction(() => __lr.won, null, { timeout: 20000 });
    },
    'goo: a reciprocal stroke swims only when it is fast one way and slow the other': async ({ page, ok, near }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr, o = {};
        for (const [lv, as] of [[0, false], [0, true], [3, false], [3, true]]) { X.load(lv); X.asym = as; const sw = X.sw(), x0 = sw.x; while (X.St().cycles < 10) X.advance(.05); o[lv + (as ? 'a' : '')] = sw.x - x0; }
        X.asym = false; return o; });
      near(r[0], 0, .03, 'water'); near(r['0a'], 0, .03, 'water, fast/slow'); near(r[3], 0, .03, 'goo, same speed both ways'); ok(r['3a'] > .2, 'goo, fast open slow close swims: ' + r['3a']);
    },
    'E. coli: runs, tumbles (~68°), circles near glass, gets pulled by a feeding current': async ({ page, ok, near }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr, o = {};
        X.bodySeed(1); X.load(4); const sw = X.sw(), x0 = sw.x, y0 = sw.y; for (let k = 0; k < 20; k++) X.coliStep(.05); o.speed = Math.hypot(sw.x - x0, sw.y - y0);
        const turns = []; for (let k = 0; k < 300; k++) { const p0 = sw.phi; X.tumble(); for (let q = 0; q < 6; q++) X.coliStep(.05); turns.push(Math.abs(sw.phi - p0)); } o.turn = turns.reduce((a, v) => a + v, 0) / turns.length * 180 / Math.PI;
        X.bodySeed(2); X.load(5); const s5 = X.sw(), pts = []; for (let k = 0; k < 400; k++) { X.coliStep(.05); pts.push([s5.x, s5.y]); } const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; o.R = pts.reduce((a, p) => a + Math.hypot(p[0] - cx, p[1] - cy), 0) / pts.length;
        X.bodySeed(3); X.load(6); const s6 = X.sw(); s6.x = X.level.predator[0] + 3.2; s6.y = X.level.predator[1]; s6.phi = 0; for (let k = 0; k < 10; k++) X.coliStep(.05); o.eaten = X.St().eaten;
        return o; });
      near(r.speed, 8, .5, 'run speed (BL/s over 1 s)'); near(r.turn, 70, 15, 'mean tumble angle'); ok(r.R > 15 && r.R < 40, 'circling radius near glass ≈ v/ω (blurred by rotational diffusion): ' + r.R); ok(r.eaten, 'too close to the ciliate: swept in');
    },
    'sperm tail: bigger waves are faster but cost more; a towed bead slows it': async ({ page, ok }) => {
      await setup(page);
      const r = await page.evaluate(() => { const X = __lr; return [X.tailUP(1, .1, .3), X.tailUP(1, .3, .3), X.tailUP(1, .3, 2)]; });
      ok(r[1][0] > r[0][0] && r[1][1] / r[1][0] > r[0][1] / r[0][0], 'bigger wave: faster, dearer per body length');
      ok(r[2][0] < r[1][0], 'cargo slows the swimmer');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      await setup(page);
      const R = await page.evaluate(() => { FX.setMuted(true); unlock(); const X = __lr, out = { naive: 0, naiveN: 0, comp: [] };
        const grade = (lv, t, e) => { const L = X.LV[lv]; return L.body === 'coli' ? (t <= L.par ? 3 : t <= L.par2 ? 2 : 1) : (e <= L.par ? 3 : e <= L.par2 ? 2 : 1); };
        for (const pol of ['never', 'random', 'always']) for (const seed of [1, 2, 3, 4, 5, 6]) { out.naiveN++; const t = coli(6, pol, seed); if (t >= 0 && grade(6, t) > 1) out.naive++; }
        for (const [n, A] of [[1.5, .2], [3, .35], [.5, .05], [2, .3], [1, .35], [2.5, .1]]) for (const lv of [7, 8]) { out.naiveN++; const e = tail(lv, n, A); if (e > 0 && grade(lv, 0, e) > 1) out.naive++; }
        // competent: E. coli tumbles on a falling taste and away from the predator; the tail picks the cheapest fast-enough stroke on a coarse grid
        const cs = []; for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) { const t = coli(6, 'compare', seed); cs.push(t >= 0 ? grade(6, t) : 0); } out.coli = cs;
        for (const lv of [7, 8]) { let best = 0; for (const n of [.5, 1.5, 2.5]) for (const A of [.1, .2, .3]) { const e = tail(lv, n, A); if (e > 0 && (!best || e < best)) best = e; } out.comp.push(best ? grade(lv, 0, best) : 0); }
        return out; });
      ok(R.naive / R.naiveN <= .2, `naive play got 2★+ on ${R.naive}/${R.naiveN} late runs`);
      ok(R.coli.filter(g => g >= 1).length >= 7 && R.comp.every(g => g >= 1), 'competent play wins: ' + JSON.stringify(R));
      ok(R.coli.filter(g => g === 3).length <= 3 && R.comp.every(g => g < 3), '3★ needs better than competent: ' + JSON.stringify(R));
    },
    'Reset keeps the drawn loop and restarts the swimmer': async ({ page, eq }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr; X.load(1); X.setLoop(circ(1.3, .1, 0)); const mine = JSON.stringify(X.loop); X.advance(5);
        document.getElementById('reset').click(); return [JSON.stringify(X.loop) === mine, X.sw().x, X.St().strokes, X.St().energy]; });
      eq(r, [true, 0, 0, 0]);
    },
    'running out of energy offers a retry': async ({ page, ok, eq }) => {
      await setup(page);
      await page.evaluate(() => { unlock(); __lr.load(7); __lr.playing = true; });
      await page.click('[data-s="8"]'); await page.evaluate(() => document.getElementById('swimB').click());
      await page.waitForFunction(() => __lr.failed, null, { timeout: 30000 });
      ok(/energy|slow/i.test(await page.textContent('#toast')), 'fail message');
      ok(await page.evaluate(() => !!document.getElementById('tretry'))); await page.evaluate(() => document.getElementById('tretry').click());
      eq(await page.evaluate(() => [__lr.failed, __lr.bd.x, __lr.bd.E]), [false, 0, 0]);
    },
    'level change hides the previous lesson toast; locked levels are refused': async ({ page, eq, ok }) => {
      await setup(page);
      await page.evaluate(() => { __lr.load(0); __lr.preset('line'); while (__lr.St().cycles < 8) __lr.advance(.1); __lr.playing = true; });
      await page.waitForFunction(() => __lr.won, null, { timeout: 5000 });
      ok(await page.$eval('#toast', t => t.classList.contains('on')));
      ok(await page.evaluate(() => __lr.shutter > 0), 'photomicrograph shutter fired'); ok(/OBSERVED/.test(await page.textContent('#toast')), 'stamped');
      await page.click('#levels .lv[data-i="0"]');
      eq(await page.$eval('#toast', t => t.classList.contains('on')), false);
      await page.evaluate(() => __lr.load(5)); eq(await page.evaluate(() => __lr.SAVE.cur), 1, 'locked level opened');
      const locked = await page.$$eval('#levels .lv.lock', e => e.map(x => +x.dataset.i)); eq(locked, [2, 3, 4, 5, 6, 7, 8, 9]);
      const hub = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub'))['low-reynolds']); ok(Math.abs(hub - 1 / 9) < 1e-9, 'progress ' + hub);
    },
    'saved loop slots: save, load, persist, and garbage slots are dropped': async ({ page, eq, ok }) => {
      await setup(page);
      await page.evaluate(() => { unlock(); __lr.load(1); __lr.setLoop(circ(.5, .3, .2)); __lr.useSlot(0, true); __lr.preset('square'); __lr.useSlot(0); });
      const l = await page.evaluate(() => __lr.loop[0]); ok(Math.abs(l[0] - .8) < 1e-3, 'slot 1 restored ' + l);
      const save = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rh:lowre')); s.slots[1] = [[NaN, 1], [2]]; s.slots[2] = 'x'; return JSON.stringify(s).replace('[[null,1],[2]]', '[[null,1],[2]]'); });
      const { p2, errs } = await openWith(page, save);
      eq(errs, []); const slots = await p2.evaluate(() => __lr.SAVE.slots.map(s => s ? s.length : null)); eq(slots, [64, null, null]);
      await p2.evaluate(() => __lr.useSlot(1)); // empty slot: saves rather than loading garbage
      ok(await p2.evaluate(() => __lr.loop.every(p => isFinite(p[0]) && isFinite(p[1]))));
      await p2.close();
    },
    'corrupted / odd saves load without errors': async ({ page, eq }) => {
      for (const [save, cur] of [['null', 0], ['7', 0], ['[]', 0], ['{"done":5,"cur":3}', 0], ['{"cur":-2}', 0], ['{"cur":"zz"}', 0], ['{"cur":7}', 0],
        ['{"done":{"0":1,"1":1},"cur":2}', 2], ['{"done":{"0":1,"1":1},"cur":5}', 2], ['{"slots":"no","cur":0}', 0], ['{"slots":[[[0,0],[1,1],[1,0]],7,null]}', 0], ['{oops', 0]]) {
        const { p2, errs } = await openWith(page, save);
        await p2.waitForTimeout(200);
        eq(errs, [], 'errors for ' + save); eq(await p2.evaluate(() => __lr.SAVE.cur), cur, 'level for ' + save);
        await p2.close();
      }
    },
    'drawing a loop with the mouse sets the stroke; a tap does not': async ({ page, ok, eq }) => {
      await setup(page);
      await page.evaluate(() => { unlock(); __lr.load(1); });
      const before = await page.evaluate(() => JSON.stringify(__lr.loop));
      const b = await page.locator('#pad').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      await page.mouse.click(cx, cy); eq(await page.evaluate(() => JSON.stringify(__lr.loop)), before, 'a tap replaced the loop');
      await page.mouse.move(cx + 30, cy); await page.mouse.down();
      for (let k = 1; k <= 40; k++) await page.mouse.move(cx + 30 * Math.cos(k / 40 * 6.283), cy + 30 * Math.sin(k / 40 * 6.283));
      await page.mouse.up();
      const l = await page.evaluate(() => __lr.loop); eq(l.length, 64); ok(l.every(p => Math.abs(p[0]) <= 1.45 && Math.abs(p[1]) <= 1.45));
    },
    'touch: the microscope view and the pad block browser pinch-zoom and scrolling': async ({ page, eq }) => {
      eq(await page.evaluate(() => [getComputedStyle(document.getElementById('cv')).touchAction, getComputedStyle(document.getElementById('pad')).touchAction]), ['none', 'none']);
      // a cancelled touch ends the stroke being drawn: the next move doesn't extend it
      await page.evaluate(() => { const p = document.getElementById('pad'), r = p.getBoundingClientRect(), ev = (t, x, y) => p.dispatchEvent(new PointerEvent(t, { pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 7 }));
        ev('pointerdown', 20, 20); ev('pointermove', 60, 20); ev('pointercancel', 60, 20); ev('pointermove', 60, 80); ev('pointerup', 60, 80); });
      eq(await page.evaluate(() => __lr.St().drawn), false, 'a cancelled touch still drew a loop');
    },
    'pond: a seed always makes the same pond and the same assay; a genome\'s gait is its stroke under the Stokes solver': async ({ page, ok, eq, near }) => {
      const r = await page.evaluate(() => { const Q = __lr.pond, C = __lr.circLoop, P1 = Q.pondOf(4242, 3), P2 = Q.makePond(P1.seed, 3), P3 = Q.makePond(4243, 3);
        const g = Q.mkGenome(C(.2, .1, 1, 24), 11, .15), A = Q.runAssay(P1, g), B = Q.runAssay(P1, Q.mkGenome(C(.2, .1, 1, 24), 11, .15));
        const line = Q.mkGenome(Array.from({ length: 12 }, (_, i) => { const t = Math.sin(i / 12 * 6.28) * 1.2; return [t, t]; }));
        const f = Q.mkGenome(C(0, 0, 1.15, 24), 15), s = Q.mkGenome(C(0, 0, 1.15, 24), 5);
        return { same: JSON.stringify([P1.patches.map(p => [p.x0, p.y0]), P1.grains]) === JSON.stringify([P2.patches.map(p => [p.x0, p.y0]), P2.grains]), differ: JSON.stringify(P3.grains) !== JSON.stringify(P2.grains),
          runs: [A.cells.length, A.born, B.cells.length, B.born], step: g.step, line: line.step, fast: [f.vx / s.vx, f.cost / s.cost],
          enc: Q.encGenome(Q.decGenome(Q.encGenome(g))) === Q.encGenome(g), bad: [Q.decGenome('x'), Q.decGenome('A'.repeat(24) + '.99.99')].map(v => !!v) }; });
      ok(r.same && r.differ, 'seeded ponds'); eq(r.runs[0], r.runs[2], 'assay replays'); eq(r.runs[1], r.runs[3]);
      ok(r.step > .1 && r.line < .005, 'a loop swims, a back-and-forth stroke has no step: ' + JSON.stringify(r));
      near(r.fast[0], 3, .01, 'three times the rate, three times the speed (the step per stroke is geometry)'); near(r.fast[1], 9, .05, 'and nine times the drag power');
      ok(r.enc, 'genome codes round-trip'); eq(r.bad, [false, true]);
    },
    'pond difficulty: naive founders die out; a round stroke meets par; the pipette beats it, and breeding from champions improves a weak founder': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const Q = __lr.pond; let x = 5; const R = () => (x = x * 16807 % 2147483647) / 2147483647, o = { line: 0, scrib: 0, ref: 0, pip: 0, bred: 0, weak: 0, par: 0, n: 0, refOK: 0 };
        const pip = A => { if (A.drops && Math.abs(A.t - [40, 70, 100][3 - A.drops]) < .05) { const c = A.cells.reduce((b, c) => !b || c.E > b.E ? c : b, null); if (c) Q.pipetteClone(A, c); } };
        for (const tier of [1, 2, 3, 4, 5]) for (const sd of [101, 202, 303]) { const P = Q.pondOf(sd, tier); o.n++; o.par += P.par;
          o.line += Q.runAssay(P, Q.mkGenome(Array.from({ length: 12 }, (_, i) => { const t = Math.sin(i / 12 * 6.28) * 1.2; return [t, t]; })))/*n*/.score;
          o.scrib += Q.runAssay(P, Q.mkGenome(Array.from({ length: 12 }, () => [(R() * 2 - 1) * 1.3, (R() * 2 - 1) * 1.3])))/*n*/.score;
          const ref = Q.runAssay(P, Q.refGenome())/*n*/.score; o.ref += ref; if (ref >= P.par * .7) o.refOK++;
          o.pip += Q.runAssay(P, Q.refGenome(), pip)/*n*/.score;
          const weak = Q.mkGenome(__lr.circLoop(.3, -.2, .6, 12), 7, .05); o.weak += Q.runAssay(P, weak)/*n*/.score; let g = weak, n = 0; for (let k = 0; k < 5; k++) { const A = Q.runAssay(P, g); n = A/*n*/.score; const ch = Q.champion(A); if (ch) g = Q.mkGenome(ch.G.loop, ch.G.rate, ch.G.k); } o.bred += n; }
        return o; });
      ok(r.line === 0, 'a back-and-forth founder can never colonise: ' + JSON.stringify(r)); ok(r.scrib <= r.n, 'random scribbles all but die: ' + JSON.stringify(r));
      ok(r.refOK >= r.n * 2 / 3, 'the reference stroke earns two stars in most ponds (one run is partly luck): ' + JSON.stringify(r));
      ok(r.pip > r.ref * 1.5, 'three well-placed drops of the pipette should pay: ' + JSON.stringify(r)); ok(r.bred > r.weak * 1.3, 'breeding from champions should improve a weak founder: ' + JSON.stringify(r));
    },
    'pond UI: release, tap to inspect, pipette clones and feeds (three drops), the report breeds the next founder; links carry the genome; saves stay small': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __lr.SAVE.done[0] = __lr.SAVE.done[1] = 1; __lr.load(9); __lr.pond.openPond(77, 2); });
      ok(/Release/.test(await page.textContent('#pRel')), 'release button'); ok(await page.isDisabled('#pPip'), 'no pipette before release');
      await page.click('#pRel'); await page.click('[data-s="1"]'); await page.evaluate(() => { __lr.playing = false; }); await page.waitForTimeout(200);
      const tapCell = async () => { const xy = await page.evaluate(() => { const c = __lr.pond.assay.cells[0], v = __lr.toV(c.x, c.y), d = Math.min(devicePixelRatio, 2); return [v[0] / d, v[1] / d]; }); await page.mouse.click(xy[0], xy[1]); };
      await tapCell(); ok(await page.evaluate(() => !!__lr.pond.sel), 'a tap inspects a cell');
      const n0 = await page.evaluate(() => __lr.pond.assay.cells.length); await page.click('#pPip'); await tapCell();
      eq(await page.evaluate(() => [__lr.pond.assay.drops, __lr.pond.arm]), [2, false]); ok(await page.evaluate(() => __lr.pond.assay.cells.length) >= n0 + 5, 'six clones');
      await page.click('#pPip'); const f = await page.evaluate(() => { const Q = __lr.pond, A = Q.assay, i = 20, j = 2, v = __lr.toV(i + .5, j + .5), d = Math.min(devicePixelRatio, 2); return [v[0] / d, v[1] / d, A.F[j * Q.PW + i]]; });
      await page.mouse.click(f[0], f[1]); ok(await page.evaluate(() => __lr.pond.assay.F[2 * __lr.pond.PW + 20]) > f[2] + .5, 'a drop of food where you tap');
      await page.evaluate(() => { const A = __lr.pond.assay; while (!A.done) __lr.pond.pondTick(A); __lr.playing = true; }); await page.waitForTimeout(400);
      ok(await page.evaluate(() => document.getElementById('toast').classList.contains('on')), 'the report');
      if (await page.$('#pBreed')) { const ch = await page.evaluate(() => __lr.pond.encGenome(__lr.pond.sel.G).split('.')[0]); await page.click('#pBreed'); eq(await page.evaluate(() => __lr.pond.encGenome(__lr.pond.mkGenome(__lr.loop)).split('.')[0]), ch, 'the champion is the new founder'); }
      const url = await page.evaluate(() => location.href); ok(/#pond=\d+-2~[A-Za-z0-9_-]{24}\.\d+\.\d+/.test(url), 'link: ' + url);
      const p2 = await page.context().newPage(); await p2.goto(url); await p2.waitForFunction(() => window.__lr && __lr.pond.P);
      eq(await p2.evaluate(() => [__lr.level.n, __lr.pond.P.tier, __lr.pond.encGenome(__lr.pond.mkGenome(__lr.loop)).split('.')[0]]), ['The Pond', 2, url.split('~')[1].split('.')[0]]); await p2.close();
      ok(await page.evaluate(() => localStorage.getItem('rh:lowre').length) < 3000, 'small save');
    },
    'pan and zoom: the pond zooms round the pointer, drags pan, a pinch does nothing else, a tap while zoomed picks the cell under it, Fit restores': async ({ page, ok, eq, near }) => {
      await page.evaluate(() => { __lr.SAVE.done[0] = __lr.SAVE.done[1] = 1; __lr.load(9); __lr.pond.openPond(31, 1); __lr.pond.release(); __lr.playing = false; });
      await page.waitForTimeout(100);
      const d = await page.evaluate(() => Math.min(devicePixelRatio, 2)), at = () => page.evaluate(d => { const c = __lr.pond.assay.cells[3]; return __lr.toV(c.x, c.y).map(v => v / d); }, d);
      const s0 = await at(); await page.mouse.move(s0[0], s0[1]); await page.mouse.wheel(0, -300); await page.waitForTimeout(80);
      const s1 = await at(); ok(await page.evaluate(() => __lr.pz.k) > 1.3, 'zoomed'); near(s1[0], s0[0], 3); near(s1[1], s0[1], 3);
      await page.mouse.click(s1[0], s1[1]); ok(await page.evaluate(() => __lr.pond.sel === __lr.pond.assay.cells[3]), 'a tap while zoomed picks the cell under it');
      const x0 = await page.evaluate(() => __lr.pz.x); await page.mouse.move(640, 600); await page.mouse.down(); await page.mouse.move(700, 600, { steps: 5 }); await page.mouse.up();
      near(await page.evaluate(() => __lr.pz.x) - x0, 60, 2, 'drag pans');
      const r = await page.evaluate(() => { const el = document.getElementById('cv'), k = __lr.pz.k, n = __lr.pond.assay.cells.length, sel = __lr.pond.sel; const ev = (ty, id, x, y) => el.dispatchEvent(new PointerEvent(ty, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
        ev('pointerdown', 1, 500, 400); ev('pointerdown', 2, 560, 400); ev('pointermove', 1, 470, 400); ev('pointermove', 2, 590, 400); ev('pointerup', 1, 470, 400); ev('pointerup', 2, 590, 400); return [__lr.pz.k / k, __lr.pond.assay.cells.length === n && __lr.pond.sel === sel]; });
      ok(r[0] > 1.5 && r[1], 'pinch zoomed and did nothing else: ' + r);
      await page.click('.pz-fit'); await page.waitForTimeout(450); eq(await page.evaluate(() => [__lr.pz.k, __lr.pz.x, __lr.pz.y]), [1, 0, 0]);
    },
    'no overflow or console errors at phone and desktop sizes': async ({ page, ok }) => {
      await setup(page);
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h });
        for (let i = 0; i < 9; i++) { await page.evaluate(i => { unlock(); __lr.load(i); }, i); await page.waitForTimeout(80); }
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + w);
      }
    },
  },
};
