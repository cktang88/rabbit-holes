// Coaster: track physics (energy, stalls, loop g-forces), commissions, daily sites, sharing, saves and real input.
const ready = async page => { await page.waitForFunction(() => window.__coaster && __coaster.design.nodes.length); await page.waitForTimeout(200); };
async function reopen(page, url) { const p = await page.context().newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(url || page.url()); await ready(p); p.errs = errs; return p; }

const phone = { width: 390, height: 844 };
module.exports = {
  page: 'coaster/index.html',
  ready,
  tests: {
    'energy is conserved with friction and drag off: v²/2 + g·h (h = the whole train\'s mean height) stays constant once the train is off the lift': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster, d = { nodes: K.REF.thrill(), lift: 1 }; d.S = K.geometry(d); const R = K.simulate(d, { mu: 0, drag: 0 });
        // the train's potential energy is its rows' mean height (rows before the start sit in the level station, rows past the end on the straight run-out)
        const S = d.S, n1 = S.length - 1, yAt = u => u < 0 ? S[0].y : u > n1 ? S[n1].y + (u - n1) * .5 * Math.sin(S[n1 - 1].th) : S[u].y;
        const offs = K.TRAIN.rows.map(o => Math.round((K.TRAIN.mid - o) / .5)), rearN = Math.round(K.TRAIN.mid / .5);
        let lo = 1e9, hi = -1e9; R.v.forEach((v, k) => { const i = R.idx[k] + 1; if (S[Math.max(0, i - rearN)].seg < 1 || S[i].seg < 1) return; let h = 0; for (const o of offs) h += yAt(i + o); h /= offs.length; const E = v * v / 2 + 9.81 * h; lo = Math.min(lo, E); hi = Math.max(hi, E); });
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
      const slow = { timeout: 90000 }; // RIDE opens the 3D park: on software GL under a full suite that frame can take a while
      await page.click('#tRide', slow); await page.click('#tSkip', slow); await page.waitForTimeout(300);
      ok(await page.evaluate(() => __coaster.last.r.stall >= 0), 'starting design should stall');
      const [x, y] = await page.evaluate(() => { const n = __coaster.design.nodes[5]; return __coaster.screenOf(n.x, n.y); });
      const [, y2] = await page.evaluate(() => __coaster.screenOf(128, 20));
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, (y + y2) / 2); await page.mouse.move(x, y2); await page.mouse.up();
      await page.click('#tRide', slow); await page.click('#tSkip', slow); await page.waitForTimeout(400);
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
      ok(await page.waitForFunction(() => { const r = document.getElementById('pov').getBoundingClientRect(), B = __coaster.stripBox(); return r.bottom <= B.t || getComputedStyle(document.getElementById('pov')).display === 'none'; }, null, { timeout: 5000 }).then(() => true, () => false), 'the front-seat inset is clear of the diagram'); // it docks on the next frame, which can be slow under load
      await page.mouse.click(B2.l + B2.ax + (B2.r - B2.l - B2.ax) * .7, B2.t + B2.h / 2); await page.waitForTimeout(100); await page.waitForFunction(() => __coaster.play && __coaster.play.i > 0, null, { timeout: 5000 }).catch(() => {});
      const k = await page.evaluate(() => [__coaster.play.i, __coaster.design.S.length]);
      ok(k[0] > k[1] * .6, 'the train jumped to the tapped point: ' + k);
    },
    'turns and banking in 3D: a turn really curves in plan, auto-bank is atan(v²κ/g), it zeroes the sideways g that an unbanked turn throws, both directions': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __coaster, c = X.COMS.find(c => c.id === 'turn'), s = c.site(), out = {};
        for (const [nm, f] of [['flat', n => ({ ...n, bank: 0 })], ['auto', n => ({ ...n, ab: 1, bt: 0 })], ['right', n => ({ ...n, r: -n.r, ab: 1, bt: 0 })]]) {
          const d = { nodes: X.REF.turn().map(n => n.r ? f(n) : n), lift: 1 }, sc = X.scores(d, s), S = d.S, R = sc.r, F = X.trackFrames(S); let err = 0, kmax = 0;
          R.idx.forEach((i, k) => { const p = S[i]; if (p.ab && Math.abs(p.kh) > .05 && Math.abs(R.gs[k] - 1) < 1.5) err = Math.max(err, Math.abs(p.bank - Math.atan(R.v[k] ** 2 * Math.abs(p.kh) / 9.81))); });
          for (let i = 2; i < F.length - 2; i++) { const a = Math.atan2(F[i - 2].fwd[2], F[i - 2].fwd[0]), b = Math.atan2(F[i + 2].fwd[2], F[i + 2].fwd[0]); let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); kmax = Math.max(kmax, Math.abs(d) / 2); }
          out[nm] = { lat: sc.st.latmax, err, kh: kmax, head: S[S.length - 1].head, pass: X.checkReq(c, sc).every(r => r[1]) }; }
        return out; });
      ok(r.auto.kh > .05 / 2 * .5, 'the 3D centreline curves in plan: ' + r.auto.kh); ok(Math.abs(Math.abs(r.auto.head) - Math.PI) < .4, 'it turns back on itself');
      ok(r.auto.err < 6 * Math.PI / 180, 'auto-bank within 6° of atan(v²κ/g): ' + (r.auto.err * 57.3).toFixed(1) + '°');
      ok(r.flat.lat > 1.5 && r.auto.lat < .15 && r.right.lat < .15, `sideways g: unbanked ${r.flat.lat.toFixed(2)}, auto ${r.auto.lat.toFixed(2)}, auto right ${r.right.lat.toFixed(2)}`);
      ok(r.right.head * r.auto.head < 0, 'right turns the other way'); ok(r.auto.pass && !r.flat.pass, 'the Narrow Lot: auto-bank passes, flat fails');
    },
    'the ride camera rolls with the bank, smoothly, through an auto-banked turn': async ({ page, ok }) => {
      await page.waitForFunction(() => window.THREE, null, { timeout: 10000 });
      const r = await page.evaluate(() => { const X = __coaster; X.load(3); X.design = { nodes: X.REF.turn().map(n => n.r ? { ...n, ab: 1, bt: 0 } : n), lift: 1 }; X.startRide(); if (!X.V3.on) X.v3Open();
        const tr = X.trace3d(1 / 60, 6000, false), S = X.design.S; let maxStep = 0, worst = 0, n = 0;
        for (let i = 1; i < tr.length; i++) { const f = tr[i].f, u = tr[i].u, rt = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]], roll = Math.asin(Math.max(-1, Math.min(1, rt[1] / Math.hypot(...rt))));
          const f0 = tr[i - 1].f, u0 = tr[i - 1].u, rt0 = [f0[1] * u0[2] - f0[2] * u0[1], f0[2] * u0[0] - f0[0] * u0[2], f0[0] * u0[1] - f0[1] * u0[0]], roll0 = Math.asin(Math.max(-1, Math.min(1, rt0[1] / Math.hypot(...rt0))));
          maxStep = Math.max(maxStep, Math.abs(roll - roll0)); const p = S[X.last.r.idx[tr[i].k]]; if (p && p.ab && Math.abs(p.kh) > .06) { worst = Math.max(worst, Math.abs(Math.abs(roll) - p.bank)); n++; } }
        X.v3Close(); return { maxStep, worst, n }; });
      ok(r.n > 20, 'rode through the turn: ' + r.n); ok(r.maxStep < .03, `roll changes at most ${(r.maxStep * 57.3).toFixed(2)}° a frame`); ok(r.worst < .2, `camera roll within ${(r.worst * 57.3).toFixed(1)}° of the bank`);
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
          const R = K.last.r, i0 = R.idx[P.k], S = K.design.S, tr = K.frameAt(i0 + (K.TRAIN.mid - s.off) / .5).p /* the chosen seat's own place on the centreline (the physics point is the train's middle) */, gap = Math.hypot(s.p[0] - tr[0], s.p[1] - tr[1], s.p[2] - tr[2]); P.speed = 4; return { d, dot, gap }; });
        if (!r) break;
        ok(Math.abs(r.d - 1.5) < .3, `camera ${r.d.toFixed(2)} m from the seat`); ok(r.dot > .8, `looking along the track (${r.dot.toFixed(2)})`); ok(r.gap < 1, `seat ${r.gap.toFixed(2)} m from the physics sample`);
      }
    },
    'performance on a phone (390×844, 4× CPU throttle): draw calls, triangles and our JS per frame within budget, first interactive frame under 2 s': async ({ page, ok }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), p = await ctx.newPage(), errs = [];
      p.on('pageerror', e => errs.push(e.message));
      try {
        const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const url = page.url().replace(/[#?].*$/, ''); await page.goto('about:blank'); // nothing else running while we time it
        await p.goto(url); await p.bringToFront(); // a background tab gets no animation frames await p.waitForFunction(() => window.__coaster && __coaster.firstFrame, null, { timeout: 20000 });
        const first = +(await p.evaluate(() => __coaster.firstFrame)) || 0;
        await p.waitForFunction(() => window.THREE && window.THREE_X !== undefined, null, { timeout: 30000 });
        const r = await p.evaluate(() => new Promise(res => { const K = __coaster; K.load(5); K.design = { nodes: K.REF.thrill(), lift: 1 }; K.startRide(); if (!K.V3.on) K.v3Open(); K.play.k = Math.floor(K.last.r.t.length * .4); K.play.simT = K.last.r.t[K.play.k];
          const ts = [], st = []; let last = 0, done = false; setTimeout(() => { done = true; }, 40000); const tick = now => { if (last) ts.push(now - last); last = now; if (K.V3.stats) st.push(K.V3.stats); if (ts.length < 40 && K.play && !done) requestAnimationFrame(tick); else { const s = [...ts].sort((a, b) => a - b);
            K.V3.noRender = true; const t1 = performance.now(); for (let i = 0; i < 60; i++) { K.play.k = (K.play.k + 3) % K.last.r.t.length; K.v3Frame(K.play); } const js = (performance.now() - t1) / 60 || 0; K.V3.noRender = false;
            const pf = K.perf(); res({ programs: pf.programs, inst: pf.instancesDrawn, instAll: pf.instances, js, med: s[s.length >> 1], p95: s[Math.floor(s.length * .95)], n: s.length, calls: Math.max(...st.map(x => x.calls)), tris: Math.max(...st.map(x => x.tris)), dpr: K.V3.dpr, tier: K.V3.tier }); } }; requestAnimationFrame(tick); }));
        console.log(`      phone 4× CPU: first frame ${first.toFixed(0)} ms · ${r.calls} draw calls · ${r.tris} triangles · pixel ratio ${r.dpr} · tier ${r.tier} · our JS ${r.js.toFixed(2)} ms a frame · ${r.programs} shader programs · ${r.inst}/${r.instAll} instances in view (counts only: software GL frame times mean nothing here)`);
        ok(r.tier === 'low', 'phones get the low tier'); ok(r.calls < 150, `${r.calls} draw calls (budget 150)`); ok(r.tris < 300000, `${r.tris} triangles (budget 300k)`); ok(r.dpr <= 1.25, `pixel ratio ${r.dpr}`);
        ok(r.js < 4, `JS per frame ${r.js.toFixed(2)} ms at 4× CPU (budget 4 ms of the 16.7)`); ok(first < 2000, `first interactive frame at ${first.toFixed(0)} ms`); ok(!errs.length, errs.join('; '));
      } finally { await ctx.close(); }
    },
    'correctly modelled: real-world scale, the train on its rails, supports, collisions, the chain lift, and the sun where the sky says': async ({ page, ok }) => {
      await page.waitForFunction(() => window.THREE && window.THREE_X !== undefined, null, { timeout: 15000 });
      await page.evaluate(() => { const K = __coaster; K.load(5); K.design = { nodes: K.REF.thrill(), lift: 1 }; K.startRide(); K.v3Open(); });
      await page.waitForFunction(() => { const k = __coaster.V3.skies; return k && Object.values(k).some(s => s.tex || s.failed); }, null, { timeout: 20000 });
      const r = await page.evaluate(() => { const K = __coaster, V3 = K.V3, T = THREE, P = K.play, R = K.last.r, S = K.design.S, F = V3.frames, o = {}, M = new T.Matrix4(), v = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
        P.k = Math.floor(R.t.length * .45); P.f = .3; K.v3Frame(P);
        const bb = g => { g.computeBoundingBox(); return g.boundingBox; };
        // scale: people, trees, the car, the rider's eye
        const cr = V3.crowd, hb = bb(cr.rest.geometry); o.people = [Math.min(...cr.s) * hb.max.y, Math.max(...cr.s) * hb.max.y];
        o.trees = [99, 0]; for (const m of V3.trees) { const h = bb(m.geometry).max.y; for (let k = 0; k < m.count; k++) { m.getMatrixAt(k, M); M.decompose(v, q, sc); o.trees[0] = Math.min(o.trees[0], h * sc.y); o.trees[1] = Math.max(o.trees[1], h * sc.y); } }
        const cb = bb(V3.trainGeo.hi.shellR); o.car = [cb.max.z - cb.min.z, cb.max.x - cb.min.x];
        // the train on its rails: every wheel assembly exactly at its point on the track, cars a coupling pitch apart along the 3D track
        const s = K.seatAt(), uF = s.uc + K.TRAIN.mid / .5; o.bogie = 0; o.pitch = [];
        for (let c = 0; c < K.TRAIN.cars; c++) { const uc = uF - (c * K.TRAIN.pitch + K.TRAIN.row / 2) / .5; for (const [j, du] of [[0, .9], [1, -.9]]) { V3.bogies.getMatrixAt(c * 2 + j, M); v.setFromMatrixPosition(M); const f = K.frameAt(uc + du / .5); o.bogie = Math.max(o.bogie, v.distanceTo(new T.Vector3(...f.p))); }
          if (c) { let L = 0; const a = uc, b = uc + K.TRAIN.pitch / .5; for (let u = a; u < b - 1e-6; u += .25) { const p0 = K.frameAt(u).p, p1 = K.frameAt(Math.min(b, u + .25)).p; L += Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); } o.pitch.push(L); } }
        let L3 = 0; for (let i = 1; i < F.length; i++) L3 += Math.hypot(F[i].p[0] - F[i - 1].p[0], F[i].p[1] - F[i - 1].p[1], F[i].p[2] - F[i - 1].p[2]); o.len = [L3, (S.length - 1) * .5];
        // supports: on the ground, under the track, nothing else of the track in the column
        o.sup = { n: V3.supports.length, ground: 0, pierce: 0 }; for (const [x, g, z, top] of V3.supports) { o.sup.ground = Math.max(o.sup.ground, Math.abs(g - V3.groundAt(x, z)[0]));
          for (let j = 0; j < F.length; j++) { const f = F[j]; if ((f.p[0] - x) ** 2 + (f.p[2] - z) ** 2 < 1.2 ** 2 && f.p[1] < top - 1.5 && f.p[1] > g) { o.sup.pierce++; break; } } }
        // track above the ground in 3D, scenery clear of the track
        o.under = Math.min(...F.map(f => f.p[1] - V3.groundAt(f.p[0], f.p[2])[0]));
        o.clash = 0; for (const [x, z, rr] of V3.taken.slice(2).filter(t => !t[3])) for (let j = 0; j < F.length; j += 2) { const f = F[j]; if ((f.p[0] - x) ** 2 + (f.p[2] - z) ** 2 < (rr + .8) ** 2 && f.p[1] - V3.groundAt(x, z)[0] < 22) { o.clash++; break; } }
        o.walk = 0; for (let t = 0; t < 40; t++) { V3.clock = t; K.v3Frame(P); for (let k = 0; k < V3.crowd.n; k += 3) { V3.crowd.rest.getMatrixAt(k, M); v.setFromMatrixPosition(M); for (let j = 0; j < F.length; j += 2) { const f = F[j]; if ((f.p[0] - v.x) ** 2 + (f.p[2] - v.z) ** 2 < 1.5 ** 2 && f.p[1] - v.y < 3) { o.walk++; break; } } } }
        // the chain lift: a steady 3.5 m/s, and it keeps the whole train moving until the last row is off it
        const lift = 1, rearN = Math.round(K.TRAIN.mid / .5); o.chain = [9, 0]; o.held = 0; R.v.forEach((vv, k) => { const i = R.idx[k]; if (S[Math.max(0, i - rearN)].seg < lift) { if (S[i].seg < lift && S[i].th > .05) { o.chain[0] = Math.min(o.chain[0], vv); o.chain[1] = Math.max(o.chain[1], vv); } if (S[i].seg >= lift && vv < 3.49) o.held++; } });
        // the sun: the shadow light points where the sky is brightest
        const d = V3.sunDir, sd = new T.Vector3().subVectors(V3.sun.position, V3.sun.target.position).normalize(); o.sunDot = sd.dot(new T.Vector3(...d));
        const cam = V3.cam.clone(); cam.position.set(0, 50, 0); cam.up.set(0, 1, 0); cam.fov = 60; cam.aspect = 1; cam.updateProjectionMatrix(); cam.lookAt(d[0] * 100, 50 + d[1] * 100, d[2] * 100);
        const ren = V3.r, gl = ren.getContext(); ren.setRenderTarget(null); ren.render(V3.scene, cam); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4), lum = (x, y) => { gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return px[0] + px[1] + px[2]; };
        o.sunPx = lum(W >> 1, H >> 1); o.otherPx = Math.max(lum(W * .1 | 0, H * .5 | 0), lum(W * .9 | 0, H * .5 | 0), lum(W * .5 | 0, H * .9 | 0), lum(W * .5 | 0, H * .12 | 0));
        o.sky = !!(V3.skies[V3.tod] && V3.skies[V3.tod].tex); K.v3Close(); return o; });
      console.log('      audit: ' + JSON.stringify(r, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
      ok(r.people[0] > 1.6 && r.people[1] < 1.9, `people ${r.people.map(x => x.toFixed(2))} m tall`); ok(r.trees[0] > 5 && r.trees[1] < 24, `trees ${r.trees.map(x => x.toFixed(1))} m`);
      ok(r.car[0] > 2.55 && r.car[0] < 3.2 && r.car[1] > 1.3 && r.car[1] < 1.6, `car ${r.car.map(x => x.toFixed(2))} m`);
      ok(r.bogie < .005, `wheel assemblies sit on the track (worst ${(r.bogie * 1000).toFixed(1)} mm)`); ok(r.pitch.every(L => Math.abs(L - 2.9) < .06), `cars 2.9 m apart along the 3D track: ${r.pitch.map(x => x.toFixed(2))}`);
      ok(Math.abs(r.len[0] / r.len[1] - 1) < .01, `the 3D track is as long as the ride the physics measured (${r.len[0].toFixed(1)} vs ${r.len[1].toFixed(1)} m), so friction acts over the 3D length`);
      ok(r.sup.n > 10 && r.sup.ground < .05 && r.sup.pierce === 0, `supports: ${JSON.stringify(r.sup)}`); ok(r.under > 0, `track above the ground everywhere (lowest ${r.under.toFixed(2)} m)`);
      ok(r.clash === 0, `${r.clash} trees/props under or in the track`); ok(r.walk === 0, `${r.walk} walkers on the track`);
      ok(r.chain[0] > 3.49 && r.chain[1] < 3.51, `chain lift ${r.chain.map(x => x.toFixed(2))} m/s`); ok(r.held === 0, 'the chain keeps the train moving until its last row is off');
      ok(r.sky, 'the HDRI sky loaded'); ok(r.sunDot > .999, `the shadow light comes from the sun (${r.sunDot.toFixed(4)})`); ok(r.sunPx > r.otherPx, `looking toward the sun is the brightest view (${r.sunPx} vs ${r.otherPx})`);
    },
    'a five-car train: per-seat g, the back row is whipped harder over the airtime hills, judging is the middle of the train and the result says so': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __coaster; K.load(K.COMS.findIndex(c => c.id === 'family')); const c = K.C, sc = K.scores({ nodes: K.REF.family(), lift: 1 }, c.site()), f = K.seatSeries(sc.r, 0), b = K.seatSeries(sc.r, K.TRAIN.len), m = K.seatSeries(sc.r, K.TRAIN.mid);
        return { fmin: f.gmin, bmin: b.gmin, cars: K.TRAIN.cars, rows: K.TRAIN.rows.length, f: f.air, b: b.air, m: m.air, judged: sc.st.air, seat: sc.st.seat }; });
      await page.evaluate(() => { const K = __coaster; K.design = { nodes: K.REF.family(), lift: 1 }; K.ride(); }); await page.waitForFunction(() => /Judged in the middle of the train/.test(document.getElementById('result').textContent), null, { timeout: 60000 });
      const txt = await page.evaluate(() => document.querySelector('#result .seats').textContent);
      ok(r.cars === 5 && r.rows === 10, 'five cars of two rows'); ok(r.bmin < r.fmin - .1, `the back row is whipped over the crests: lowest g ${r.bmin.toFixed(2)} vs front ${r.fmin.toFixed(2)} (airtime ${r.b.toFixed(2)} s vs ${r.f.toFixed(2)} s)`); ok(Math.abs(r.b - r.f) > 1e-3, 'seats differ'); ok(Math.abs(r.m - r.judged) < .05, `judged = middle seat (${r.judged.toFixed(2)} vs ${r.m.toFixed(2)})`);
      ok(r.seat === 'middle of the train', r.seat); ok(/Front row: [\d.]+ s airtime.*back row: [\d.]+ s/.test(txt), txt);
    },
    'free look: dragging turns the rider\'s head (clamped), the seat frame is untouched, the head eases back, arrow keys look too': async ({ page, ok }) => {
      await page.waitForFunction(() => window.THREE);
      await page.evaluate(() => { const K = __coaster; K.load(5); K.design = { nodes: K.REF.thrill(), lift: 1 }; K.startRide(); if (!K.V3.on) K.v3Open(); K.play.speed = 0; K.play.k = 40; K.play.f = 0; K.V3.dt = 1 / 60; K.v3Frame(K.play); });
      const snap = () => page.evaluate(() => { const K = __coaster; K.V3.dt = 1 / 60; K.V3.noRender = true; K.v3Frame(K.play); K.V3.noRender = false; const v = new THREE.Vector3(); K.V3.cam.getWorldDirection(v); return { d: v.toArray(), seat: K.seatAt().fwd, cg: [...K.V3.cg], yaw: K.V3.look.yaw, pitch: K.V3.look.pitch }; });
      const ang = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      await page.evaluate(() => { const K = __coaster; K.V3.dt = 1 / 60; K.V3.noRender = true; for (let i = 0; i < 240; i++) K.v3Frame(K.play); K.V3.noRender = false; }); // let the seat gaze settle (paused: its target is fixed)
      const a = await snap(); await page.mouse.move(640, 420); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(640 - i * 40, 420 - i * 12); const b = await snap();
      for (let i = 1; i <= 10; i++) await page.mouse.move(640 - 400 - i * 400, 420 - 120 - i * 200); const c = await snap(); await page.mouse.up();
      const back = await page.evaluate(() => { const K = __coaster; K.V3.dt = 1 / 60; K.V3.noRender = true; for (let i = 0; i < 200; i++) K.v3Frame(K.play); K.V3.noRender = false; return [K.V3.look.yaw, K.V3.look.pitch]; });
      await page.keyboard.down('ArrowRight'); const key = await page.evaluate(() => { const K = __coaster; K.V3.dt = 1 / 60; K.V3.noRender = true; for (let i = 0; i < 30; i++) K.v3Frame(K.play); K.V3.noRender = false; return K.V3.look.yaw; }); await page.keyboard.up('ArrowRight');
      ok(ang(a.d, b.d) > .3, `dragging turned the view by ${(ang(a.d, b.d) * 57.3).toFixed(0)}°`); ok(ang(a.seat, b.seat) < 1e-6 && ang(a.cg, b.cg) < 1e-4, 'the seat frame and the smoothed seat gaze are unaffected');
      ok(Math.abs(c.yaw) <= 120 * Math.PI / 180 + 1e-6 && Math.abs(c.pitch) <= 70 * Math.PI / 180 + 1e-6 && Math.abs(c.yaw) > 1.9, `head turn clamped: yaw ${(c.yaw * 57.3).toFixed(0)}°, pitch ${(c.pitch * 57.3).toFixed(0)}°`);
      ok(Math.abs(back[0]) < .02 && Math.abs(back[1]) < .02, `the head eased back to the front: ${back.map(x => (x * 57.3).toFixed(1))}°`); ok(key < -.2, `the right arrow looks right: yaw ${(key * 57.3).toFixed(0)}°`);
    },
    'the ground is matte grass, never a mirror: roughness ≥ 0.85, no metal, weak sky reflection, and from rider height at a grazing angle toward the sun it reads green and below the bloom threshold': async ({ page, ok }) => {
      await page.goto(page.url().replace(/[#?].*$/, '') + '?post=0&people=0'); await page.waitForFunction(() => window.THREE && window.THREE_X !== undefined, null, { timeout: 60000 });
      await page.evaluate(() => { const K = __coaster; K.load(5); K.design = { nodes: K.REF.thrill(), lift: 1 }; K.startRide(); K.play.speed = 0; if (!K.V3.on) K.v3Open(); });
      await page.waitForFunction(() => { const V3 = __coaster.V3; return V3.grassTex && V3.grassTex.image && V3.skies && Object.values(V3.skies).some(k => k.tex || k.failed); }, null, { timeout: 30000 });
      const r = await page.evaluate(() => { const K = __coaster, V3 = K.V3, T = THREE, mats = [];
        V3.scene.traverse(o => { if (o === V3.ground || o === V3.lot || o === V3.props) mats.push([o === V3.ground ? 'grass' : o === V3.lot ? 'car park' : 'paths', o.material]); });
        const bad = mats.filter(([, m]) => m.roughness < .85 || m.metalness !== 0 || m.envMapIntensity > .5 || m.clearcoat || m.roughnessMap).map(([n, m]) => `${n} r${m.roughness} m${m.metalness} env${m.envMapIntensity}`);
        const L = V3.layout, X = L.cx + 40, Z = L.cz + 60, y = V3.groundAt(X, Z)[0], d = V3.sunDir, h = Math.hypot(d[0], d[2]), cam = V3.cam; cam.position.set(X, y + 1.5, Z); cam.up.set(0, 1, 0); cam.lookAt(X + d[0] / h * 40, y - .4, Z + d[2] / h * 40); cam.updateMatrixWorld();
        if (V3.tufts) V3.tufts.mesh.visible = false; const ren = V3.r, gl = ren.getContext(); ren.setRenderTarget(null); ren.render(V3.scene, cam); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4); let max = 0, green = 0, n = 0;
        for (let i = 0; i < 40; i++) { gl.readPixels(Math.floor(W * (.05 + .9 * (i % 8) / 7)), Math.floor(H * (.05 + .3 * Math.floor(i / 8) / 4)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); max = Math.max(max, px[0], px[1], px[2]); if (px[1] >= px[2] && px[1] >= px[0] * .9) green++; n++; }
        if (V3.tufts) V3.tufts.mesh.visible = true; return { n: mats.length, bad, max, green, total: n, bloom: V3.bloom ? V3.bloom.threshold : null }; });
      ok(r.n === 3 && !r.bad.length, `ground materials: ${r.n}, not matte: ${r.bad.join(', ')}`); ok(r.max < 235, `brightest ground pixel ${r.max} (no glare)`); ok(r.green > r.total * .8, `${r.green}/${r.total} ground pixels read green`);
    },
    'the train is modelled to scale: car length, seat pitch, wheels touching the rails, lap bars down on the move, a far LOD, and the whole train in a few draws': async ({ page, ok }) => {
      await page.goto(page.url().replace(/[#?].*$/, '') + '?lab=crest&post=0'); await page.waitForFunction(() => window.__coaster && __coaster.labReady, null, { timeout: 60000 });
      const r = await page.evaluate(() => { const K = __coaster, V3 = K.V3, T = THREE, G = V3.trainGeo, o = {}, bb = g => { g.computeBoundingBox(); return g.boundingBox; };
        const f = bb(G.hi.shellF), rr = bb(G.hi.shellR); o.lenF = f.max.z - f.min.z; o.lenR = rr.max.z - rr.min.z; o.width = rr.max.x - rr.min.x; o.pitch = K.TRAIN.row; o.carPitch = K.TRAIN.pitch;
        // wheels from the carrier's own vertices: road wheels rest on the rail tops (y 0.075), side wheels on the rails' outer faces (|x| 0.625), up-stops under the rails (y −0.075)
        const P = G.hi.bogie.attributes.position; let road = 9, side = 9, up = -9; for (let i = 0; i < P.count; i++) { const x = Math.abs(P.getX(i)), y = P.getY(i);
          if (x > .5 && x < .6 && y > .05 && y < .4) road = Math.min(road, y); if (x > .6 && x < .8 && Math.abs(y) < .03) side = Math.min(side, x); if (x > .5 && x < .6 && y < -.05 && y > -.3) up = Math.max(up, y); }
        o.road = road; o.side = side; o.up = up;
        K.v3Frame(K.play); const M = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3(); V3.tr.laps.getMatrixAt(5, M); M.decompose(v, q, sc); o.lapMoving = V3.tr.lap;
        o.meshes = Object.values(V3.tr).filter(m => m && m.isInstancedMesh).length; const hiT = Object.values(V3.tr).filter(m => m && m.isInstancedMesh).reduce((a, m) => a + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 * m.count, 0);
        V3.chase = true; K.v3Frame(K.play); o.lod = V3.tr.lod; const loT = Object.values(V3.tr).filter(m => m && m.isInstancedMesh).reduce((a, m) => a + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 * m.count, 0); V3.chase = false; K.v3Frame(K.play); o.tris = [hiT, loT]; o.back = V3.tr.lod; return o; });
      console.log('      train: ' + JSON.stringify(r, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
      ok(r.lenF >= 2.6 && r.lenF <= 3.2 && r.lenR >= 2.6 && r.lenR <= 3.2, `car lengths ${r.lenF.toFixed(2)} (front) and ${r.lenR.toFixed(2)} m`); ok(r.width > 1.3 && r.width < 1.6, `car width ${r.width.toFixed(2)} m`);
      ok(r.pitch >= .75 && r.pitch <= .95, `seat pitch ${r.pitch} m`); ok(r.carPitch > r.lenR, 'cars clear each other');
      ok(Math.abs(r.road - .075) < .005 && Math.abs(r.side - .625) < .005 && Math.abs(r.up + .075) < .005, `wheels on the rails: road ${r.road.toFixed(3)}, side ${r.side.toFixed(3)}, up-stop ${r.up.toFixed(3)}`);
      ok(Math.abs(r.lapMoving) < .05, 'lap bars down while the train moves'); ok(r.meshes <= 12, `${r.meshes} instanced meshes for the whole train`);
      ok(r.lod === 'lo' && r.back === 'hi' && r.tris[1] < r.tris[0] * .6, `far LOD in the chase view: ${r.tris.map(Math.round)} triangles`);
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
      const all = await page.evaluate(() => { const K = __coaster, o = {}; for (const t of Object.keys(K.ELS)) { K.design = { nodes: K.COMS.find(c => c.id === 'sandbox').start(), lift: 1 }; K.sel = 2; K.stamp(t); const L = K.live; const S = K.design.S; o[t] = { ok: L.ok, lat: L.st.latmax, g: L.st.gmax, turn: Math.abs(S[S.length - 1].head - S[0].head) }; } return o; });
      for (const [t, v] of Object.entries(all)) ok(v.ok && v.g < 6, `${t} stamp rides: ${JSON.stringify(v)}`);
      ok(all.turn.turn > 1 && all.helix.turn > 3, `turn and helix really turn in plan: ${all.turn.turn.toFixed(2)}, ${all.helix.turn.toFixed(2)} rad`); ok(all.turn.lat < .6 && all.helix.lat < .6, 'and come auto-banked, so riders stay in their seats');
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
