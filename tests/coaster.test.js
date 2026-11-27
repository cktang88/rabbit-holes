// Coaster: track physics (energy, stalls, loop g-forces), commissions, daily sites, sharing, saves and real input.
const ready = async page => { await page.waitForFunction(() => window.__coaster && __coaster.design.nodes.length); await page.waitForTimeout(200); };
async function reopen(page, url) { const p = await page.context().newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(url || page.url()); await ready(p); p.errs = errs; return p; }

const phone = { width: 390, height: 844 };
module.exports = {
  page: 'coaster/index.html',
  ready,
  tests: {
    'energy is conserved with friction and drag off: v²/2 + g·h stays constant after the lift': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, d = { nodes: K.REF.thrill(), lift: 1 }; d.S = K.geometry(d); const R = K.simulate(d, { mu: 0, drag: 0 });
        let lo = 1e9, hi = -1e9; R.v.forEach((v, k) => { const p = d.S[R.idx[k] + 1]; if (p.seg < 1) return; const E = v * v / 2 + 9.81 * p.y; lo = Math.min(lo, E); hi = Math.max(hi, E); });
        const F = K.simulate(d); return { spread: hi - lo, E: hi, done: R.done, vEndFric: F.vEnd, vEnd: R.vEnd }; });
      ok(r.done, 'frictionless ride should finish'); ok(r.spread / r.E < .002, `energy drifted by ${(r.spread / r.E * 100).toFixed(2)}%`);
      ok(r.vEndFric < r.vEnd, 'friction and drag must cost speed');
    },
    'a hill higher than the lift crest stalls; friction stalls one just below it too': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const K = __coaster, N = (x, y) => ({ x, y }), mk = h => ({ nodes: [N(0, 2), N(40, 30), N(65, 15), N(85, 3), N(115, h), N(145, 3), N(180, 2)], lift: 1 });
        const at = h => { const R = K.simulate((d => (d.S = K.geometry(d), d))(mk(h))); return R.stall >= 0; }, atF = h => { const d = mk(h); d.S = K.geometry(d); return K.simulate(d, { mu: 0, drag: 0 }).stall >= 0; };
        return { above: at(31), below: at(29.2), frictionlessBelow: atF(29.2), low: at(18) }; });
      eq(r.above, true, 'higher than the crest'); eq(r.below, true, 'friction should stall a hill 0.8 m below the crest'); eq(r.frictionlessBelow, false, 'without friction it clears'); eq(r.low, false);
    },
    'circular loop g-forces match the analytic values (6 g at the bottom, 0 g at the top when v² = 5gR at entry)': async ({ page, near }) => {
      const r = await page.evaluate(() => { const K = __coaster, R0 = 10, n = 400, S = [];
        for (let i = 0; i <= n; i++) { const a = i / n * 2 * Math.PI; S.push({ x: R0 * Math.sin(a), y: R0 - R0 * Math.cos(a), th: a, kv: 1 / R0, kh: 0, bank: 0, seg: 5, X: 0, Z: 0, head: 0 }); }
        const step = Math.hypot(S[1].x - S[0].x, S[1].y - S[0].y); // the sim steps DS per sample; scale the circle so samples are DS apart
        const k = .5 / step; S.forEach(p => { p.x *= k; p.y *= k; p.kv /= k; }); const R = R0 * k;
        const out = K.simulate({ S, lift: 0 }, { mu: 0, drag: 0, v0: Math.sqrt(5 * 9.81 * R) });
        const top = out.gs[Math.round(out.gs.length / 2)], bottom = out.gs[0]; return { top, bottom, R }; });
      near(r.bottom, 6, .08, 'bottom g'); near(r.top, 0, .08, 'top g');
    },
    'the teardrop (clothoid) loop keeps peak g well under the circular loop at the same entry': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, c = K.COMS.find(x => x.id === 'loop'), s = c.site();
        return { circle: K.scores({ nodes: c.start(), lift: 1 }, s).st.gmax, tear: K.scores({ nodes: K.REF.loop(), lift: 1 }, s).st.gmax }; });
      ok(r.circle > 5 && r.tear < 4.2, `circle ${r.circle.toFixed(1)} g vs teardrop ${r.tear.toFixed(1)} g`);
    },
    'flat turns throw riders sideways; banking takes it into the seat': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, c = K.COMS.find(x => x.id === 'turn'), s = c.site(), mk = b => ({ nodes: K.REF.turn().map(n => n.r ? { ...n, bank: b } : n), lift: 1 });
        return [0, 30, 50, 70].map(b => K.scores(mk(b), s).st.latmax); });
      ok(r[0] > 1.5 && r[2] < 1.2 && r[0] > r[1] && r[1] > r[2], 'side g by bank 0/30/50/70°: ' + r.map(x => x.toFixed(2)));
    },
    'every commission: the starting drawing fails, a known design passes, random scribbles score poorly': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, out = [];
        for (const c of K.COMS) { if (c.free || c.daily) continue; const s = c.site(), pass = d => K.checkReq(c, K.scores(d, s)).every(x => x[1]);
          const rnd = RH.rng(c.id.length * 31), rand = []; for (let t = 0; t < 12; t++) { const n = [{ x: 0, y: s.terrain(0) + 2 }]; let x = 0; for (let k = 0; k < 6; k++) { x += 15 + rnd() * 30; n.push({ x, y: s.terrain(x) + 1 + rnd() * 40 }); } rand.push(pass({ nodes: n, lift: 1 })); }
          out.push({ id: c.id, start: pass({ nodes: c.start(), lift: 1 }), ref: pass({ nodes: K.REF[c.id](), lift: 1 }), randomWins: rand.filter(Boolean).length }); }
        return out; });
      for (const x of r) { ok(!x.start, `${x.id}: the starting drawing already passes`); ok(x.ref, `${x.id}: known design fails`); ok(x.randomWins <= 1, `${x.id}: ${x.randomWins}/12 random tracks pass`); }
    },
    'daily site: the same seed builds the same plot and a rideable starting design; different days differ': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const K = __coaster, out = { ok: 0, det: true };
        for (let sd = 20260101; sd < 20260131; sd++) { const a = K.siteFrom(sd), b = K.siteFrom(sd); for (let x = 0; x < 240; x += 13) if (a.terrain(x) !== b.terrain(x)) out.det = false;
          if (JSON.stringify(K.dailyStart(a)) !== JSON.stringify(K.dailyStart(b))) out.det = false; if (K.scores({ nodes: K.dailyStart(a), lift: 1 }, a).ok) out.ok++; }
        out.differ = K.siteFrom(1).terrain(50) !== K.siteFrom(2).terrain(50); return out; });
      ok(r.det, 'not deterministic'); ok(r.differ); eq(r.ok, 30, 'daily starting designs must ride');
    },
    'histogram: a field of 30 polished designs exists for each commission and a better design earns more stars': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster; return K.COMS.filter(c => !c.free && !c.daily).map(c => ({ id: c.id, n: K.histogram(c).length })); });
      for (const x of r) ok(x.n >= 20, `${x.id}: only ${x.n} designs in the field`);
    },
    'share codes round-trip a design and a shared link opens it': async ({ page, eq, ok }) => {
      const code = await page.evaluate(() => { const K = __coaster, d = { nodes: K.REF.turn(), lift: 1 }, back = K.dec(K.enc(d)); return { code: K.enc(d), same: JSON.stringify(back.nodes.map(n => [n.x, n.y, n.r || 0, n.bank || 0])) === JSON.stringify(d.nodes.map(n => [n.x, n.y, n.r || 0, n.bank || 0])) }; });
      ok(code.same, 'round trip');
      const p = await reopen(page, page.url().split('#')[0] + '#c=turn&d=' + code.code);
      const r = await p.evaluate(() => ({ id: __coaster.C.id, n: __coaster.design.nodes.length, bank: __coaster.design.nodes.find(n => n.r).bank }));
      eq(r, { id: 'turn', n: 7, bank: 50 }); ok(!p.errs.length, p.errs[0]); await p.close();
    },
    'first minute: press RIDE, it stalls; drag the second hill down with the mouse; ride again and pass': async ({ page, ok, eq }) => {
      await page.click('#tRide'); await page.click('#tSkip'); await page.waitForTimeout(300);
      ok(await page.evaluate(() => __coaster.last.r.stall >= 0), 'starting design should stall');
      const [x, y] = await page.evaluate(() => { const n = __coaster.design.nodes[5]; return __coaster.screenOf(n.x, n.y); });
      const [, y2] = await page.evaluate(() => __coaster.screenOf(128, 20));
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, (y + y2) / 2); await page.mouse.move(x, y2); await page.mouse.up();
      await page.click('#tRide'); await page.click('#tSkip'); await page.waitForTimeout(400);
      eq(await page.evaluate(() => __coaster.last.ok), true, 'after lowering the hill the ride should finish');
      ok(await page.$eval('#result', e => getComputedStyle(e).display !== 'none' && /approved/i.test(e.textContent)), 'result card');
      ok(await page.evaluate(() => __coaster.SAVE.done.first >= 1), 'progress saved');
    },
    'after a ride, Undo or Reset clears the old verdict and gauge (they described a track that no longer exists); RIDE again hides it too': async ({ page, ok, eq }) => {
      for (const vp of [{ width: 1280, height: 800 }, phone]) {
        await page.setViewportSize(vp); await page.waitForTimeout(150);
        await page.evaluate(() => { __coaster.design = { nodes: __coaster.REF.first(), lift: 1 }; __coaster.ride(); });
        const shown = () => page.evaluate(() => [getComputedStyle(document.getElementById('result')).display !== 'none', getComputedStyle(document.getElementById('gauge')).display !== 'none']);
        eq(await shown(), [true, true], 'verdict after the ride');
        await page.evaluate(() => { __coaster.smooth(); __coaster.ride(); }); eq(await shown(), [true, true], 'a ride after an edit');
        await page.evaluate(() => document.getElementById('tUndo').click()); eq(await shown(), [false, false], 'undo hides the stale verdict');
        await page.evaluate(() => { __coaster.ride(); }); eq(await shown(), [true, true]);
        await page.evaluate(() => document.getElementById('tReset').click()); eq(await shown(), [false, false], 'reset hides the stale verdict');
        ok(await page.evaluate(() => { const r = document.getElementById('tRide').getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return document.getElementById('tRide').contains(e); }), 'RIDE is reachable');
      }
      await page.evaluate(() => { __coaster.ride(); document.querySelector('#result #rShare').click(); }); await page.waitForTimeout(100); // a refused clipboard is no page error
    },
    'the 3D front seat is smooth through a loop and a banked turn: no snaps in where it looks, no up-vector flip, never inside the track': async ({ page, ok }) => {
      await page.waitForFunction(() => window.THREE, null, { timeout: 10000 });
      for (const [ci, id] of [[1, 'loop'], [3, 'turn']]) {
        const r = await page.evaluate(([ci, id]) => { const X = __coaster; X.load(ci); X.design = { nodes: X.REF[id](), lift: 1 }; X.startRide(); if (!X.V3.on) X.v3Open(); const tr = X.trace3d(1 / 60, 6000, false), F = X.V3.frames;
          const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
          let maxF = 0, maxU = 0, maxAcc = 0, minUpDot = 1, prevW = 0, clear = 1e9; const n = tr.length;
          for (let i = 1; i < n; i++) { const w = ang(tr[i].f, tr[i - 1].f); maxF = Math.max(maxF, w); maxU = Math.max(maxU, ang(tr[i].u, tr[i - 1].u)); if (i > 1) maxAcc = Math.max(maxAcc, Math.abs(w - prevW) * 3600); prevW = w;
            minUpDot = Math.min(minUpDot, tr[i].u[0] * tr[i - 1].u[0] + tr[i].u[1] * tr[i - 1].u[1] + tr[i].u[2] * tr[i - 1].u[2]); }
          for (const t of tr) for (const f of F) clear = Math.min(clear, Math.hypot(f.p[0] - t.p[0], f.p[1] - t.p[1], f.p[2] - t.p[2]));
          X.v3Close(); return { n, maxF, maxU, maxAcc, minUpDot, clear, inv: X.last.st.inv }; }, [ci, id]);
        ok(r.n > 300, id + ' ride traced: ' + r.n);
        ok(r.maxF < .09 && r.maxU < .09, `${id}: the view turns at most ${(r.maxF * 57.3).toFixed(1)}° (up ${(r.maxU * 57.3).toFixed(1)}°) in a 60 fps frame`);
        ok(r.maxAcc < 40, `${id}: angular acceleration peaks at ${r.maxAcc.toFixed(0)} rad/s² (a snap is hundreds)`);
        ok(r.minUpDot > .99, `${id}: the up vector never flips: ${r.minUpDot}`);
        ok(r.clear > 1.2, `${id}: the eye stays ${r.clear.toFixed(2)} m clear of every bit of track centreline`);
        if (id === 'loop') ok(r.inv >= 1, 'the loop inverts');
      }
    },
    'loops step sideways in 3D: no two non-adjacent sections of the track pass closer than a track width plus clearance': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __coaster, out = {}; for (const id of ['loop', 'thrill', 'first']) { const F = X.trackFrames(X.geometry({ nodes: X.REF[id](), lift: 1 })); let m = 1e9;
        for (let i = 0; i < F.length; i++) for (let j = 0; j < i - 12; j++) m = Math.min(m, Math.hypot(F[i].p[0] - F[j].p[0], F[i].p[1] - F[j].p[1], F[i].p[2] - F[j].p[2]));
        let kink = 0; for (let i = 1; i < F.length; i++) kink = Math.max(kink, Math.acos(Math.min(1, F[i].fwd[0] * F[i - 1].fwd[0] + F[i].fwd[1] * F[i - 1].fwd[1] + F[i].fwd[2] * F[i - 1].fwd[2])));
        out[id] = { m, kink }; } return { out, need: X.TRACK_W + 1, W: X.LOOP_W }; });
      for (const [id, v] of Object.entries(r.out)) { ok(v.m >= r.need && v.m >= r.W - .05, `${id}: closest approach ${v.m.toFixed(2)} m (needs ${r.need})`); ok(v.kink < .15, `${id}: no kink where the track steps sideways (${v.kink.toFixed(3)} rad per 0.5 m)`); }
    },
    'airtime is taught: the tip shows on an airtime commission, a big drop into a tight crest shows green, tapping it explains, and the ride records it': async ({ page, ok, eq }) => {
      await page.evaluate(() => __coaster.load(2)); // Family Coaster needs 0.5 s of airtime
      ok(await page.evaluate(() => { const e = document.getElementById('airTip'); return !!e && e.offsetHeight > 0 && /float/.test(e.textContent); }), 'the airtime line is visible');
      ok(await page.evaluate(() => __coaster.crests().every(c => !c.air)), 'the starting hump does not float');
      await page.evaluate(() => { __coaster.design = { nodes: __coaster.REF.family(), lift: 1 }; });
      const cs = await page.evaluate(() => __coaster.crestsOnScreen()); const c = cs.find(c => c.air); ok(c, 'a tight crest after a big drop is green: ' + JSON.stringify(cs.map(c => c.g)));
      await page.mouse.click(c.sx, c.sy); ok(await page.evaluate(() => /Airtime here/.test(document.getElementById('toastC').textContent)), 'tapping the crest explains it');
      await page.evaluate(() => { __coaster.design = { nodes: [[0, 2], [30, 18], [50, 8], [70, 3], [95, 10], [120, 3], [150, 3]].map(([x, y]) => ({ x, y })), lift: 1 }; });
      const flat = await page.evaluate(() => __coaster.crestsOnScreen()); await page.mouse.click(flat[0].sx, flat[0].sy);
      ok(await page.evaluate(() => /km\/h|tighter/.test(document.getElementById('toastC').textContent)), 'a grey crest says what it needs');
      await page.evaluate(() => { __coaster.design = { nodes: __coaster.REF.family(), lift: 1 }; __coaster.ride(); });
      ok(await page.evaluate(() => __coaster.last.st.air >= .8 && /s of airtime ✓/.test(document.getElementById('result').textContent)), 'the result names the airtime');
    },
    'follow the tips: the starting family ride plus one drop and two airtime-hill stamps passes the Family Coaster': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __coaster, C = X.COMS[2]; X.load(2); X.design = { nodes: C.start(), lift: 1 };
        const before = X.scores(X.design, X.site); X.sel = 1; X.stamp('drop'); X.sel = -1; X.stamp('hill'); X.sel = -1; X.stamp('hill');
        const sc = X.scores(X.design, X.site), rows = X.checkReq(C, sc); return { before: before.st.air, air: sc.st.air, gmin: sc.st.gmin, gmax: sc.st.gmax, cost: sc.cost, green: X.crests().filter(c => c.air).length, fails: rows.filter(r => !r[1]).map(r => r[0]) }; });
      ok(r.before === 0, 'the starting drawing has no airtime: ' + r.before);
      ok(!r.fails.length, 'drop + 2 airtime hills passes: ' + JSON.stringify(r)); ok(r.green >= 2, 'both stamped hills show green');
      ok(r.gmin > -.5, 'a gentle float, not an ejector: ' + r.gmin);
    },
    'the g diagram is big enough to read, folds away, and a tap scrubs to that point of the track': async ({ page, ok, eq }) => {
      for (const [vp, minH] of [[{ width: 1280, height: 800 }, 140], [phone, 100]]) {
        await page.setViewportSize(vp); await page.waitForTimeout(200); await page.evaluate(() => { __coaster.SAVE.stripMin = false; __coaster.load(2); __coaster.design = { nodes: __coaster.REF.family(), lift: 1 }; });
        const B = await page.evaluate(() => __coaster.stripBox()); ok(B.h >= minH, `diagram ${B.h}px tall at ${vp.width}px`);
        ok(await page.evaluate(() => { const B = __coaster.stripBox(); return __coaster.nodesOnScreen().every(([, y]) => y < B.t - 8); }), 'no node sits under the diagram');
        await page.mouse.click(B.l + B.ax + (B.r - B.l - B.ax) * .5, B.t + B.h * .6); ok(await page.evaluate(() => __coaster.scrubI) > 0, 'tap scrubs');
        await page.mouse.click(B.r - 20, B.t + 6); ok(await page.evaluate(() => __coaster.stripBox().h) < 30, 'folds'); await page.mouse.click(B.r - 20, (await page.evaluate(() => __coaster.stripBox().t)) + 6); ok(await page.evaluate(() => __coaster.stripBox().h) >= minH, 'unfolds');
      }
      // during a 2D ride a tap jumps the train there
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150);
      const B2 = await page.evaluate(() => { const X = __coaster; X.V3.want = false; X.startRide(); X.cycleSpeed(); X.cycleSpeed(); X.cycleSpeed(); return X.stripBox(); }); // paused, so only the tap moves it
      await page.waitForTimeout(100); await page.mouse.click(B2.l + B2.ax + (B2.r - B2.l - B2.ax) * .7, B2.t + B2.h / 2); await page.waitForTimeout(100);
      ok(await page.evaluate(() => { const r = document.getElementById('pov').getBoundingClientRect(), B = __coaster.stripBox(); return r.bottom <= B.t || getComputedStyle(document.getElementById('pov')).display === 'none'; }), 'the front-seat inset is clear of the diagram');
      const k = await page.evaluate(() => [__coaster.play.i, __coaster.design.S.length]);
      ok(k[0] > k[1] * .6, 'the train jumped to the tapped point: ' + k);
    },
    'speed-up: playback at 1x, 2x and 4x visits every physics sample and gives identical peaks and scores': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const K = __coaster; K.load(5); K.design = { nodes: K.REF.thrill(), lift: 1 }; return [1, 2, 4].map(s => K.playback(s)); });
      const [a, b, c] = r;
      eq(a.visited, a.n - 1, 'every sample visited at 1x'); eq(c.visited, a.n - 1, 'every sample visited at 4x');
      eq([b.peak, b.low, b.thrill, b.comfort], [a.peak, a.low, a.thrill, a.comfort], '2x matches 1x'); eq([c.peak, c.low, c.thrill, c.comfort], [a.peak, a.low, a.thrill, a.comfort], '4x matches 1x');
      ok(Math.abs(a.peak - a.stats.gmax) < 1e-9 || a.peak >= a.stats.gmax, 'the gauge sees the true peak');
      ok(Math.abs(c.frames * 4 - a.frames) <= 8, `4x should take a quarter of the frames (${c.frames} vs ${a.frames})`);
    },
    'speed button cycles 1x, 2x, 4x, pause during a ride': async ({ page, eq }) => {
      await page.click('#tRide'); const seen = [];
      for (let i = 0; i < 4; i++) { seen.push(await page.evaluate(() => __coaster.play.speed)); if (i < 3) await page.click('#tSpd'); }
      eq(seen, [1, 2, 4, 0]);
      const k0 = await page.evaluate(() => __coaster.play.k); await page.waitForTimeout(400); eq(await page.evaluate(() => __coaster.play.k), k0, 'paused');
    },
    '3D ride view opens full screen, toggles to the blueprint and back, and closes at the end': async ({ page, ok, eq }) => {
      await page.waitForFunction(() => window.THREE);
      await page.click('#tRide'); await page.waitForTimeout(300);
      const big = await page.evaluate(() => { const r = document.getElementById('v3').getBoundingClientRect(); return { on: __coaster.V3.on, frac: r.width * r.height / (innerWidth * innerHeight) }; });
      ok(big.on && big.frac > .95, `3D view should fill the screen (${big.frac})`);
      await page.click('#t3d'); eq(await page.evaluate(() => __coaster.V3.on), false, 'back to the blueprint');
      ok(await page.$eval('#v3', e => getComputedStyle(e).display === 'none'));
      await page.click('#t3d'); eq(await page.evaluate(() => __coaster.V3.on), true, 'and into the ride again');
      await page.click('#tCam'); await page.waitForTimeout(200); eq(await page.evaluate(() => __coaster.V3.chase && __coaster.V3.train.visible), true, 'chase camera shows the train');
      await page.click('#tCam'); await page.click('#tSkip'); await page.waitForTimeout(300);
      eq(await page.evaluate(() => [__coaster.V3.on, !!__coaster.play]), [false, false], 'closed when the ride ends');
    },
    'front-seat camera sits on the train: 1.5 m above the track at the interpolated seat, looking along it': async ({ page, ok }) => {
      await page.waitForFunction(() => window.THREE);
      await page.evaluate(() => { const K = __coaster; K.load(5); K.design = { nodes: K.REF.thrill(), lift: 1 }; });
      await page.click('#tRide'); await page.click('#tSpd'); await page.click('#tSpd'); // 4x
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(900);
        const r = await page.evaluate(() => { const K = __coaster, P = K.play; if (!P) return null; P.speed = 0; const s = K.seatAt(); const q = new THREE.Vector3(); K.v3Open(); const c = K.V3.cam; c.getWorldDirection(q);
          const d = Math.hypot(c.position.x - s.p[0], c.position.y - s.p[1], c.position.z - s.p[2]), dot = q.x * s.fwd[0] + q.y * s.fwd[1] + q.z * s.fwd[2];
          const R = K.last.r, i0 = R.idx[P.k], S = K.design.S, tr = [S[i0].X, S[i0].y, S[i0].Z], gap = Math.hypot(s.p[0] - tr[0], s.p[1] - tr[1], s.p[2] - tr[2]); P.speed = 4; return { d, dot, gap }; });
        if (!r) break;
        ok(Math.abs(r.d - 1.5) < .3, `camera ${r.d.toFixed(2)} m from the seat`); ok(r.dot > .8, `looking along the track (${r.dot.toFixed(2)})`); ok(r.gap < 1, `seat ${r.gap.toFixed(2)} m from the physics sample`);
      }
    },
    'phone: the 3D ride renders a frame in under 16 ms with a capped pixel ratio and a low-poly scene': async ({ page, ok }) => {
      await page.setViewportSize(phone); await page.waitForFunction(() => window.THREE);
      await page.evaluate(() => { const K = __coaster; K.load(5); K.design = { nodes: K.REF.thrill(), lift: 1 }; });
      await page.click('#tRide'); await page.waitForTimeout(500);
      const b = await page.evaluate(() => __coaster.bench3d(90));
      ok(b && b.ms < 16, `frame time ${b && b.ms.toFixed(2)} ms`); ok(b.tris < 40000, `${b.tris} triangles`); ok(b.pr <= 2, `pixel ratio ${b.pr}`); ok(b.calls <= 20, `${b.calls} draw calls`);
    },
    'every starting track is a real ride: no kinks, never touches the ground, and all but First Ride (whose stall is the lesson) reach the station': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster; return K.COMS.map(c => { const sc = K.scores({ nodes: c.start(), lift: 1 }, c.site()); return { id: c.id, ok: sc.ok, stall: sc.r.stall, crash: sc.r.crash, kink: sc.r.kink }; }); });
      for (const x of r) { ok(x.crash < 0, `${x.id}: start hits the ground`); ok(!(x.kink >= 0), `${x.id}: start has a kink`); if (x.id === 'first') ok(x.stall >= 0, 'First Ride should stall at its second hill'); else ok(x.ok, `${x.id}: start must reach the station`); }
    },
    'riders talk about the ride they rode: no loop talk without a loop, no yawning at a fast ride, a blackout is never approved': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, out = []; for (const c of K.COMS.filter(c => K.REF[c.id] && !c.daily)) { const sc = K.scores({ nodes: K.REF[c.id](), lift: 1 }, c.site()); out.push({ id: c.id, inv: sc.st.inv, thr: sc.thrill, q: K.guests(sc).map(x => x[1]).join(' | ') }); }
        const N = (x, y) => ({ x, y }), hard = K.scores({ nodes: [N(0, 2), N(40, 32), N(54, 12), N(81, .5), N(95, 14), N(110, 2), N(140, 2)], lift: 1 }, K.COMS[0].site());
        return { out, hard: { gmax: hard.st.gmax, approved: K.checkReq(K.COMS[0], hard).every(x => x[1]) } }; });
      for (const x of r.out) { if (!x.inv) ok(!/loop/i.test(x.q), `${x.id}: loop talk without a loop: ${x.q}`); if (x.thr >= 45) ok(!/Yawn/.test(x.q), `${x.id}: yawning at thrill ${x.thr}`); }
      if (r.hard.gmax > 6) ok(!r.hard.approved, `a ${r.hard.gmax.toFixed(1)} g ride must not be approved`);
    },
    'live prediction: dragging a node recolours the track by predicted g before you ride': async ({ page, ok }) => {
      await page.evaluate(() => __coaster.load(1)); await page.waitForTimeout(200);
      const g0 = await page.evaluate(() => __coaster.live && __coaster.live.st.gmax); ok(g0 > 5, 'the circular loop is predicted over 5 g: ' + g0);
      const [x, y] = await page.evaluate(() => { const n = __coaster.design.nodes[7]; return __coaster.screenOf(n.x, n.y); }), [, y2] = await page.evaluate(() => __coaster.screenOf(118, 33));
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, (y + y2) / 2); await page.mouse.move(x, y2);
      const mid = await page.evaluate(() => ({ g: __coaster.live && __coaster.live.st.gmax, rode: !!__coaster.last })); await page.mouse.up();
      ok(mid.g && Math.abs(mid.g - g0) > .05 && !mid.rode, `prediction changed during the drag without riding (${g0.toFixed(2)} → ${mid.g && mid.g.toFixed(2)})`);
    },
    'phone: The Loop fits the screen on load and its checklist is visible': async ({ page, ok }) => {
      await page.setViewportSize(phone); await page.evaluate(() => __coaster.load(1)); await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const pts = __coaster.design.nodes.map(n => __coaster.screenOf(n.x, n.y)), req = document.getElementById('cReq').getBoundingClientRect();
        return { inside: pts.every(([x, y]) => x > 0 && x < innerWidth && y > 0 && y < innerHeight), req: { top: req.top, bottom: req.bottom, h: req.height }, items: document.querySelectorAll('#cReq li').length }; });
      ok(r.inside, 'every node of the loop on screen'); ok(r.items >= 2 && r.req.h > 20 && r.req.bottom <= 844 * .5, 'checklist visible near the top: ' + JSON.stringify(r.req));
    },
    'smooth track: a 4-node loop is curvature-continuous and round, where the old Catmull-Rom made a rounded square': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, N = (x, y) => ({ x, y });
        // curvature measured from the sampled positions alone (the same way for both curves)
        const kap = P => { const k = []; for (let i = 1; i < P.length - 1; i++) { const a = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x), b = Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x); let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; k.push(d / Math.hypot(P[i + 1].x - P[i - 1].x, P[i + 1].y - P[i - 1].y) * 2); } return k; };
        const cr = nodes => { const out = [], P = [nodes[0], ...nodes, nodes[nodes.length - 1]]; // the previous interpolation: centripetal Catmull-Rom
          for (let i = 1; i < P.length - 2; i++) { const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2], tj = (a, b) => Math.pow(Math.hypot(b.x - a.x, b.y - a.y) || 1e-3, .5), t0 = 0, t1 = tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
            for (let k = 0; k < 40; k++) { const t = t1 + (t2 - t1) * k / 40, L = (a, b, ta, tb) => ({ x: (tb - t) / (tb - ta) * a.x + (t - ta) / (tb - ta) * b.x, y: (tb - t) / (tb - ta) * a.y + (t - ta) / (tb - ta) * b.y });
              const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), c = L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2); out.push({ ...c, seg: i - 1, th: 0, k: 0 }); } }
          out.push({ ...nodes[nodes.length - 1], seg: nodes.length - 2, th: 0, k: 0 }); return K.resample(out); };
        const measure = S => { const k = kap(S); let jump = 0; for (let i = 1; i < k.length; i++) jump = Math.max(jump, Math.abs(k[i] - k[i - 1]));
          let th = 0; const H = [0]; for (let i = 0; i < k.length; i++) { th += k[i] * Math.hypot(S[i + 1].x - S[i].x, S[i + 1].y - S[i].y); H.push(th); }
          const c = H.findIndex(t => t > Math.PI); let i0 = c, i1 = c; while (i0 > 1 && H[i0 - 1] > Math.PI / 4) i0--; while (i1 < k.length - 1 && H[i1 + 1] < 7 * Math.PI / 4) i1++;
          const kl = k.slice(i0 - 1, i1), mean = kl.reduce((a, b) => a + b, 0) / kl.length, P = S.slice(i0, i1 + 1), xs = P.map(p => p.x), ys = P.map(p => p.y);
          return { jump, minR: Math.min(...kl) / mean, maxR: Math.max(...kl) / mean, aspect: (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs)) }; };
        const loops = { 'The Loop start': K.COMS[1].start(), 'four dots by hand': [N(0, 2), N(40, 36), N(84, 6), N(110, 14), N(102, 28), N(92, 16), N(112, 4), N(150, 4)] }, out = {};
        for (const [nm, ns] of Object.entries(loops)) out[nm] = { now: measure(K.geometry({ nodes: ns, lift: 1 })), old: measure(cr(ns)) };
        return out; });
      const f = m => `jump ${m.jump.toFixed(3)} /m per sample, κ min/mean ${m.minR.toFixed(2)}, max/mean ${m.maxR.toFixed(2)}, aspect ${m.aspect.toFixed(2)}`;
      for (const [nm, m] of Object.entries(r)) {
        ok(m.now.jump < .05, `${nm}: curvature jumps between samples: ${f(m.now)}`);
        ok(m.now.minR > .4, `${nm}: a flat side in the loop: ${f(m.now)}`); ok(m.now.maxR < 2.6, `${nm}: a corner in the loop: ${f(m.now)}`);
        ok(m.now.aspect > .6 && m.now.aspect < 1.8, `${nm}: loop proportions: ${f(m.now)}`);
        ok(m.old.jump > 2 * m.now.jump && (m.old.minR < .3 || m.old.maxR > 3), `${nm}: the test should catch the old squarish curve: ${f(m.old)}`);
      }
    },
    'elements: the + drawer stamps a clothoid loop whose handle reshapes it; it rides gentler than a circle of the same height; convert leaves plain nodes': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const K = __coaster; K.load(K.COMS.findIndex(c => c.id === 'sandbox')); K.sel = 2; }); await page.waitForTimeout(150);
      ok(await page.evaluate(() => getComputedStyle(document.getElementById('drawer')).display === 'none'), 'drawer starts closed');
      await page.click('#tPlus'); await page.click('#e_loop'); await page.waitForTimeout(150);
      const a = await page.evaluate(() => { const K = __coaster, g = K.groups()[0], ix = K.groupOf(g.id), ys = ix.map(i => K.design.nodes[i].y), xs = ix.slice(1, -1).map(i => K.design.nodes[i].x); // width of the loop itself (not its run-out)
        return { n: K.design.nodes.length, t: g.t, h: g.h, H: Math.max(...ys) - Math.min(...ys), W: Math.max(...xs) - Math.min(...xs), ok: K.live.ok, g: K.live.st.gmax, inv: K.live.st.inv, hd: K.handleOf(g).map(v => v / devicePixelRatio), closed: getComputedStyle(document.getElementById('drawer')).display === 'none' }; });
      eq(a.n, 11, 'seven loop nodes added'); eq(a.t, 'loop'); ok(a.closed, 'drawer closes after stamping'); ok(a.ok && a.inv === 1 && a.g < 4.5, `stamped loop rides: ${JSON.stringify(a)}`);
      ok(a.H / a.W > 1.1, `a teardrop is taller than wide: ${a.H}×${a.W}`);
      // the same height as a circle of four dots at the same place: the teardrop is gentler
      const circ = await page.evaluate(h => { const K = __coaster, N = (x, y) => ({ x, y }), R = h / 2, c = 100; return K.scores({ nodes: [N(0, 2), N(40, 36), N(84, 6), N(c, 6), N(c + R, 6 + R), N(c, 6 + h), N(c - R, 6 + R), N(c, 6), N(140, 5), N(180, 5)], lift: 1 }, K.site).st.gmax; }, a.H);
      ok(circ > a.g + .5, `circle ${circ.toFixed(2)} g vs stamped teardrop ${a.g.toFixed(2)} g`);
      // drag the diamond up: the loop grows and everything after it slides along
      const endX0 = await page.evaluate(() => __coaster.design.nodes.at(-1).x);
      await page.mouse.move(a.hd[0], a.hd[1]); await page.mouse.down(); for (let k = 1; k <= 5; k++) await page.mouse.move(a.hd[0], a.hd[1] - k * 8); await page.mouse.up();
      const b = await page.evaluate(() => { const K = __coaster, g = K.groups()[0]; return { h: g.h, n: K.design.nodes.length, endX: K.design.nodes.at(-1).x, sel: K.selG === g.id, insp: document.getElementById('insp').textContent }; });
      ok(b.h > a.h + 2 && b.n === 11 && b.sel, `handle raised the loop: ${a.h} → ${b.h}`); ok(b.endX > endX0, 'the rest of the ride slid along'); ok(/Loop/.test(b.insp) && /Convert/.test(b.insp), 'element card shows');
      await page.click('#iConv');
      eq(await page.evaluate(() => [__coaster.groups().length, __coaster.design.nodes.filter(n => n.g || n.el).length, __coaster.design.nodes.length]), [0, 0, 11], 'converted to plain nodes');
      const all = await page.evaluate(() => { const K = __coaster, o = {}; for (const t of Object.keys(K.ELS)) { K.design = { nodes: K.COMS.find(c => c.id === 'sandbox').start(), lift: 1 }; K.sel = 2; K.stamp(t); const L = K.live; o[t] = { ok: L.ok, lat: L.st.latmax, g: L.st.gmax }; } return o; });
      for (const [t, v] of Object.entries(all)) ok(v.ok && v.g < 6, `${t} stamp rides: ${JSON.stringify(v)}`);
      ok(all.turn.lat > .3 && all.helix.lat > .3, 'turn and helix really turn');
    },
    'tangent arms: drag a node\'s arm to pin its slope, Auto gives the smooth slope back, and a share code keeps it': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const K = __coaster; K.load(K.COMS.findIndex(c => c.id === 'sandbox')); }); await page.waitForTimeout(150);
      const [x, y] = await page.evaluate(() => { const n = __coaster.design.nodes[2]; return __coaster.screenOf(n.x, n.y); });
      await page.mouse.click(x, y); await page.waitForTimeout(100);
      const A = await page.evaluate(() => { const K = __coaster, a = K.arms(2); return { front: K.screenOf(...a.front), D: a.D.slice(), t: K.design.nodes[2].t || null }; });
      eq(A.t, null, 'auto to start'); ok(await page.evaluate(() => /auto/i.test(document.getElementById('iAuto').textContent)));
      await page.mouse.move(...A.front); await page.mouse.down(); for (let k = 1; k <= 5; k++) await page.mouse.move(A.front[0] + k * 3, A.front[1] - k * 12); await page.mouse.up();
      const B = await page.evaluate(() => { const K = __coaster, n = K.design.nodes[2]; return { t: n.t, code: K.enc(K.design), back: K.dec(K.enc(K.design)).nodes[2].t }; });
      ok(B.t && Math.atan2(B.t.y, B.t.x) > Math.atan2(A.D[1], A.D[0]) + .2, `arm tilted the slope up: ${JSON.stringify(A.D)} → ${JSON.stringify(B.t)}`);
      ok(B.back && Math.abs(B.back.x - B.t.x) < .011 && Math.abs(B.back.y - B.t.y) < .011, 'share code keeps the pinned tangent');
      await page.click('#iAuto'); eq(await page.evaluate(() => __coaster.design.nodes[2].t || null), null, 'Auto unpins');
      // a pinned tangent still leaves the neighbours smooth: the curve is C2 everywhere else
      ok(await page.evaluate(() => { const K = __coaster, d = { nodes: K.COMS.find(c => c.id === 'sandbox').start(), lift: 1 }; d.nodes[2].t = { x: 1, y: 0 }; const S = K.geometry(d); return S.every(p => isFinite(p.k) && isFinite(p.y)); }), 'pinned tangent geometry is finite');
    },
    'snapping: a dragged node snaps level with its neighbour and halfway between its neighbours; off in the drawer, it doesn\'t': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const K = __coaster, N = (x, y) => ({ x, y }); K.load(K.COMS.findIndex(c => c.id === 'sandbox')); K.design = { nodes: [N(0, 2), N(40, 36), N(84, 6), N(110, 14), N(150, 5)], lift: 1 }; }); await page.waitForTimeout(150);
      const drag = async (wx, wy) => { const [x, y] = await page.evaluate(() => { const n = __coaster.design.nodes[3]; return __coaster.screenOf(n.x, n.y); }), [x2, y2] = await page.evaluate(([a, b]) => __coaster.screenOf(a, b), [wx, wy]);
        await page.mouse.move(x, y); await page.mouse.down(); for (let k = 1; k <= 4; k++) await page.mouse.move(x + (x2 - x) * k / 4, y + (y2 - y) * k / 4); await page.mouse.up(); return page.evaluate(() => ({ ...__coaster.design.nodes[3] })); };
      const a = await drag(117.6, 6.4); eq([a.x, a.y], [117, 6], 'snapped level with node 2 and halfway between nodes 2 and 4');
      await page.click('#tPlus'); await page.click('#e_snap'); await page.click('#tPlus');
      const b = await drag(118.4, 6.6); ok(b.y !== 6 && b.x !== 117, `snap off: placed where dropped ${JSON.stringify(b)}`);
      await page.click('#tPlus'); await page.click('#e_snap'); await page.click('#tPlus');
    },
    'smooth tool: irons out a bumpy run without lowering the lift hill or touching a loop': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, N = (x, y) => ({ x, y }); K.load(K.COMS.findIndex(c => c.id === 'sandbox'));
        K.design = { nodes: [N(0, 2), N(40, 36), N(70, 14), N(84, 20), N(96, 8), N(110, 18), N(124, 6), N(140, 12), N(160, 5), N(180, 5)], lift: 1 };
        const rough = d => { const S = K.geometry(d); let s = 0; for (let i = 1; i < S.length; i++) s += (S[i].k - S[i - 1].k) ** 2; return s; };
        const before = { r: rough(K.design), crest: K.design.nodes[1].y, g: K.live.st.gmax }; K.sel = -1; K.smooth();
        const after = { r: rough(K.design), crest: K.design.nodes[1].y, g: K.live.st.gmax };
        K.design = { nodes: K.COMS[1].start(), lift: 1 }; const loop0 = JSON.stringify(K.design.nodes.slice(5, 10)); K.smooth(); const loop1 = JSON.stringify(K.design.nodes.slice(5, 10));
        return { before, after, loopKept: loop0 === loop1 }; });
      ok(r.after.r < r.before.r * .6, `curvature roughness ${r.before.r.toFixed(4)} → ${r.after.r.toFixed(4)}`); ok(r.after.crest === r.before.crest, 'lift crest untouched');
      ok(r.after.g < r.before.g, `peak g ${r.before.g.toFixed(2)} → ${r.after.g.toFixed(2)}`); ok(r.loopKept, 'loops are left alone');
    },
    'corrupted saves never crash the page': async ({ page, ok }) => {
      for (const v of ['null', '7', '[]', '{"done":null,"designs":{"first":"!!"},"cur":99}', '{bad']) {
        await page.evaluate(v => { localStorage.clear(); localStorage.setItem('rh:coaster', v); }, v);
        const p = await reopen(page); ok(!p.errs.length, `save ${v}: ${p.errs[0]}`); ok(await p.evaluate(() => __coaster.design.nodes.length >= 3)); await p.close();
      }
    },
    'after a ride on a phone the blueprint nodes are still on screen (the view is not re-fitted while the 3D ride hides the toolbar)': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => __coaster.load(0)); await page.waitForTimeout(300);
      const before = await page.evaluate(() => __coaster.nodesOnScreen());
      await page.evaluate(() => { __coaster.startRide(); }); await page.waitForTimeout(400);
      ok(await page.evaluate(() => __coaster.V3.on), '3D ride view opened');
      await page.evaluate(() => { __coaster.play.fast = 1e6; }); await page.waitForFunction(() => !__coaster.play, null, { timeout: 20000 }); await page.waitForTimeout(400);
      const after = await page.evaluate(() => __coaster.nodesOnScreen()), tb = await page.evaluate(() => document.getElementById('tools').getBoundingClientRect().top);
      ok(after.every(([x, y]) => x > -5 && x < 395 && y > 0 && y < tb), 'nodes inside the drawing after the ride: ' + JSON.stringify(after.map(a => a.map(Math.round))));
      ok(after.every(([, y], i) => Math.abs(y - before[i][1]) < 120), 'nodes stay near where they were vertically');
    },
  },
};
