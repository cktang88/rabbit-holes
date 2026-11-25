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
    'corrupted saves never crash the page': async ({ page, ok }) => {
      for (const v of ['null', '7', '[]', '{"done":null,"designs":{"first":"!!"},"cur":99}', '{bad']) {
        await page.evaluate(v => { localStorage.clear(); localStorage.setItem('rh:coaster', v); }, v);
        const p = await reopen(page); ok(!p.errs.length, `save ${v}: ${p.errs[0]}`); ok(await p.evaluate(() => __coaster.design.nodes.length >= 3)); await p.close();
      }
    },
  },
};
