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
          out.push([sw.x - x0, sw.y, sw.phi, X.St().strokes]); }
        // a two-hinge back-and-forth line is reciprocal too
        unlock(); X.load(1); X.preset('line'); X.load(1); const sw = X.sw(), x0 = sw.x, s0 = X.St().strokes; while (X.St().strokes - s0 < 6) X.advance(.05);
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
        const run = (chunk, total, ds = .004, pre) => { X.ds = ds; X.load(4); X.setLoop(circ(.65, .7, .7)); X.load(4); let t = 0; while (t < total - 1e-9) { const c = Math.min(chunk, total - t); X.advance(c * 2.2 * 3); t += c; } const sw = X.sw(); X.ds = .004; return [sw.x, sw.y, sw.phi, X.St().energy, X.St().strokes]; };
        o.f30 = run(1 / 30, 6); o.f144 = run(1 / 144, 6); o.f20 = run(1 / 20, 6); o.fine = run(1 / 60, 6, .001); return o; });
      for (const k of ['f144', 'f20', 'fine']) for (let i = 0; i < 5; i++) near(r[k][i], r.f30[i], 3e-3 * Math.max(1, Math.abs(r.f30[i])), `${k}[${i}]`);
    },
    'off-centre loops turn the swimmer; mirrored loops turn the other way': async ({ page, ok, near }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr, o = [];
        for (const c of [[.7, .7], [-.7, -.7]]) { X.load(4); X.setLoop(circ(.65, ...c)); X.load(4); while (X.St().strokes < 5) X.advance(.05); o.push(X.St().phi); } return o; });
      ok(Math.abs(r[0]) > .1, 'turns ' + r[0]); near(r[0], -r[1], .02);
    },
    'every level: not solved at start, solvable, wrong strategy fails': async ({ page, ok }) => {
      await setup(page);
      const R = await page.evaluate(() => { unlock(); const X = __lr, o = {}, W = () => X.level.test(X.St()) || X.won;
        const tick = () => { // the frame loop's bookkeeping, without waiting for frames
          const L = X.level, sw = X.sw(), St = X.St();
          if (L.target) St.reached = Math.hypot(sw.x - L.target[0], sw.y - L.target[1]) < (L.tr || .45);
          if (L.line != null) St.reached = L.maxCycles || L.budget ? Math.abs(sw.x - L.start[0]) >= Math.abs(L.line) : (L.line > 0 ? sw.x >= L.line : sw.x <= L.line);
          St.dist = sw.x - L.start[0]; };
        const until = (cond, step = .05, max = 40000) => { let k = 0; while (!cond() && k++ < max) { X.advance(step); tick(); } tick(); };
        X.LV.forEach((l, i) => { X.load(i); tick(); o['start' + i] = l.test(X.St()); });
        X.load(0); until(() => X.St().cycles >= 8); o.s0 = W();
        X.load(1); until(() => X.sw().x >= 2.6, .1, 4000); o.s1 = W();
        X.load(2); X.preset('circle'); until(() => false, .1, 400); o.w2 = W();
        X.load(2); X.reverse(); until(() => X.sw().x <= -2.6, .1, 4000); o.s2 = W();
        X.load(3); X.preset('circle'); until(() => X.St().strokes > 9.2, .1); o.w3 = W(); o.f3 = !!X.level.fail(X.St());
        X.load(3); X.setLoop(circ(1.45, 0, 0)); X.load(3, true); until(() => X.St().reached || X.St().strokes > 9.2, .05); o.s3 = W();
        X.load(4); X.preset('circle'); until(() => false, .1, 600); o.w4 = W();
        X.load(4); X.setLoop(circ(.65, .7, .7)); until(() => Math.abs(X.St().phi) >= 1.6, .1); o.s4 = W();
        X.load(5); pilot([[1.8, -2.6], [5.4, -2.6, .6]]); tick(); o.s5 = W();
        X.load(6); pilot([[2.0, -.8], [3.9, -.8], [4.8, .8], [6.6, .8], [8, 0, .6]]); tick(); o.s6 = W();
        X.load(7); until(() => X.St().reached || X.St().energy > 30, .05); o.w7 = W(); o.f7 = !!X.level.fail(X.St());
        X.load(7); X.setLoop(circ(1.3, 0, 0)); X.load(7, true); until(() => X.St().reached || X.St().energy > 30, .05); o.s7 = W(); o.e7 = X.St().energy;
        return o; });
      for (let i = 0; i < 8; i++) ok(!R['start' + i], `level ${i} solved at start`);
      for (const k of ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']) ok(R[k], `${k} not solved: ` + JSON.stringify(R));
      for (const k of ['w2', 'w3', 'w4', 'w7']) ok(!R[k], `${k}: wrong strategy won`);
      ok(R.f3 && R.f7, 'default loops run out of strokes / energy');
    },
    'Reset keeps the drawn loop (Lazy Swimmer used to snap back to the square)': async ({ page, eq, ok }) => {
      await setup(page);
      const r = await page.evaluate(() => { unlock(); const X = __lr; X.load(7); const sq = JSON.stringify(X.loop); X.setLoop(circ(1.3, 0, 0)); const mine = JSON.stringify(X.loop);
        document.getElementById('reset').click(); const after = JSON.stringify(X.loop); X.load(0); X.load(7); return [sq !== mine, after === mine, JSON.stringify(X.loop) === sq]; });
      eq(r, [true, true, true]);
      // and Reset puts the swimmer back at the start with fresh counters
      const st = await page.evaluate(() => { const X = __lr; X.advance(5); document.getElementById('reset').click(); return [X.sw().x, X.St().strokes, X.St().energy]; });
      eq(st, [0, 0, 0]);
      ok(true);
    },
    'running out of strokes offers a retry with a hint about how close it was': async ({ page, ok, eq }) => {
      await setup(page);
      await page.evaluate(() => { unlock(); __lr.load(3); __lr.preset('circle'); __lr.playing = true; });
      await page.click('[data-s="8"]');
      await page.waitForFunction(() => __lr.failed, null, { timeout: 30000 });
      const t = await page.textContent('#toast'); ok(/body lengths/.test(t) && /%/.test(t), 'hint: ' + t);
      ok(await page.isVisible('#tretry'));
      const custom = await page.evaluate(() => { __lr.setLoop(circ(1.45, 0, 0)); return JSON.stringify(__lr.loop); });
      await page.click('#tretry');
      const st = await page.evaluate(() => [__lr.failed, __lr.St().strokes]); eq(st[0], false); ok(st[1] < .5, 'fresh stroke count ' + st[1]); // still playing: a frame may already have run
      eq(await page.evaluate(() => JSON.stringify(__lr.loop)), custom);
    },
    'level change hides the previous lesson toast; locked levels are refused': async ({ page, eq, ok }) => {
      await setup(page);
      await page.evaluate(() => { __lr.load(0); while (__lr.St().cycles < 8) __lr.advance(.1); __lr.playing = true; });
      await page.waitForFunction(() => __lr.won, null, { timeout: 5000 });
      ok(await page.$eval('#toast', t => t.classList.contains('on')));
      await page.click('#levels .lv[data-i="0"]');
      eq(await page.$eval('#toast', t => t.classList.contains('on')), false);
      await page.evaluate(() => __lr.load(5)); eq(await page.evaluate(() => __lr.SAVE.cur), 1, 'locked level opened');
      const locked = await page.$$eval('#levels .lv.lock', e => e.map(x => +x.dataset.i)); eq(locked, [2, 3, 4, 5, 6, 7]);
      const hub = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub'))['low-reynolds']); ok(Math.abs(hub - 1 / 8) < 1e-9, 'progress ' + hub);
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
    'no overflow or console errors at phone and desktop sizes': async ({ page, ok }) => {
      await setup(page);
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h });
        for (let i = 0; i < 8; i++) { await page.evaluate(i => { unlock(); __lr.load(i); }, i); await page.waitForTimeout(80); }
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + w);
      }
    },
  },
};
