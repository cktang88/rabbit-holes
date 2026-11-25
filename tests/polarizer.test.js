// Polarizer: quantum optics on a grid. Physics checked against analytic results; every level solvable,
// unsolved at start, and wins need a deliberate (held) setting, not a sweep past the answer.
const URL_ = 'polarizer/index.html';
// a systematic prober for any grade of sealed box: enumerate every box the label allows, choose each probe by expected
// information (minus a heavy penalty on the chance of detonating a bomb), update on each photon, sign the most likely box
const BAYES_BOT = () => {
  window.bayesBot = (X, grades, seeds, opts = {}) => {
    const SRC = [{ x: 1, y: 4, d: 0, pol: 0 }], catchers = [[6, 0], [7, 0], [8, 0], [6, 8], [7, 8], [8, 8]];
    const probes = [];
    for (const th of [0, 30, 60, 90, 120, 150]) for (const an of [null, 0, 45, 90, 135]) probes.push([...(th ? [['hwp', 3, 4, th / 2, 1]] : []), ...(an == null ? [] : [['pol', 10, 4, an, 1]]), ['det', 12, 4, 0, 1], ...catchers.map(([x, y]) => ['det', x, y, 0, 1])]);
    for (const [inp, bias, an] of [[0, 0], [0, 45], [0, 90], [0, 135], [15, 0], [15, 90], [0, 0, 45], [0, 90, 45]]) probes.push([...(inp ? [['hwp', 2, 4, inp, 1]] : []), ...(an ? [['pol', 11, 2, an, 1]] : []), ['bs', 3, 4, 0, 0], ['mirror', 3, 2, 0, 0], ['mirror', 10, 4, 0, 0], ['bs', 10, 2, 0, 0], ['det', 12, 2, 0, 1], ['det', 10, 0, 0, 1], ...(bias ? [['phase', 5, 2, bias, 1]] : []), ...catchers.map(([x, y]) => ['det', x, y, 0, 1])]);
    for (const an of [0, 45, 90, 135]) probes.push([...[6, 7, 8].flatMap(x => [['pol', x, 1, an, 1], ['pol', x, 7, an, 1]]), ['det', 12, 4, 0, 1], ...catchers.map(([x, y]) => ['det', x, y, 0, 1])]); // analysers above and below the box, for light a mirror sends out of a side port
    const asParts = pr => { let k = 0; return pr.map(([t, x, y, a, m]) => ({ t, x, y, a, m, ...(t === 'det' ? { id: 'P' + ++k } : {}) })); };
    const cache = window.__bbCache ||= {};
    const tables = (g, n) => { const key = g + ':' + n; if (cache[key]) return cache[key];
      const G = X.GRADES[g], H = [], prior = [], picks = G.pick.filter(p => p.length === n);
      const angs = k => k === 'pol' ? [...Array(180 / G.step).keys()].map(i => i * G.step) : k === 'hwp' ? [...Array(90 / G.step).keys()].map(i => i * G.step) : k === 'phase' ? [...Array(360 / G.step - 1).keys()].map(i => (i + 1) * G.step) : [null];
      for (const pk of picks) { let combos = [[]]; for (const k of pk) combos = combos.flatMap(c => angs(k).map(a => [...c, a == null ? { k } : { k, a }])); for (const c of combos) { H.push(c); prior.push(1 / picks.length / combos.length); } }
      const PP = probes.map(asParts), outs = PP.map(pp => [...pp.filter(p => p.t === 'det').map(p => p.id), 'BOMB']), K = outs.map(o => o.length);
      const T = PP.map((_, j) => new Float32Array(H.length * K[j]));
      H.forEach((h, i) => { const lv = { sources: SRC, fixed: X.boxParts({ els: h }) }; PP.forEach((pp, j) => { const hits = X.simulate(lv, pp).hits; outs[j].forEach((id, o) => { T[j][i * K[j] + o] = hits[id] ? hits[id].p : 0; }); }); });
      const cls = new Int32Array(H.length), ids = new Map(); H.forEach((h, i) => { const sg = X.boxSig(h); if (!ids.has(sg)) ids.set(sg, ids.size); cls[i] = ids.get(sg); });
      return cache[key] = { H, prior, T, K, outs, cls }; };
    const lam = opts.lam ?? 30, res = [];
    for (const g of grades) for (const sd of seeds) {
      X.openBox(sd, g); const n = X.box.els.length, { H, prior, T, K, outs, cls } = tables(g, n);
      let w = Float64Array.from(prior), act = [...H.keys()], cur = -1, shots = 0;
      const ent = () => { let s = 0, z = 0; for (const i of act) z += w[i]; for (const i of act) { const p = w[i] / z; if (p > 0) s -= p * Math.log2(p); } return s; };
      const choose = () => { let z = 0; for (const i of act) z += w[i]; let best = -1e9, bj = 0;
        T.forEach((t, j) => { const k = K[j], po = new Float64Array(k + 1); let boom = 0, eig = 0;
          for (const i of act) { const p = w[i] / z; let s = 0; for (let o = 0; o < k; o++) { po[o] += p * t[i * k + o]; s += t[i * k + o]; } po[k] += p * Math.max(0, 1 - s); boom += p * t[i * k + k - 1]; }
          // expected information: H(outcome) − E_h H(outcome | h)
          let Hy = 0; for (const q of po) if (q > 1e-12) Hy -= q * Math.log2(q); let Hc = 0;
          for (const i of act) { const p = w[i] / z; let s = 0, e = 0; for (let o = 0; o < k; o++) { const q = t[i * k + o]; s += q; if (q > 1e-12) e -= q * Math.log2(q); } const r = 1 - s; if (r > 1e-12) e -= r * Math.log2(r); Hc += p * e; }
          eig = Hy - Hc; const v = eig - lam * boom; if (v > best) { best = v; bj = j; } }); return bj; };
      const setup = j => { if (j === cur) return; document.getElementById('rst').click(); for (const p of probes[j]) X.addPart(p[0], p[1], p[2], p[3], p[4]); cur = j; };
      const map = () => { const m = new Map(); let z = 0; for (const i of act) { z += w[i]; m.set(cls[i], (m.get(cls[i]) || 0) + w[i]); } let bc = -1, bm = -1; for (const [c, v] of m) if (v > bm) { bm = v; bc = c; } let bi = -1; for (const i of act) if (cls[i] === bc && (bi < 0 || w[i] > w[bi])) bi = i; return [bi, bm / z]; };
      while (X.bx.left > 0 && !X.bx.destroyed) {
        const [, pm] = map(); if (pm > (opts.conf ?? .95) || shots >= (opts.cap ?? 220)) break;
        if (shots % 5 === 0) setup(choose());
        const before = { ...X.fires }; X.boxFire(1); shots++;
        let o; if (X.bx.destroyed) o = K[cur] - 1; else { const id = Object.keys(X.fires).find(k => (X.fires[k] || 0) > (before[k] || 0)); o = id ? outs[cur].indexOf(id) : K[cur]; }
        const k = K[cur], t = T[cur]; let mx = 0;
        for (const i of act) { let q; if (o < k) q = t[i * k + o]; else { let s = 0; for (let u = 0; u < k; u++) s += t[i * k + u]; q = Math.max(0, 1 - s); } w[i] *= q + 1e-9; if (w[i] > mx) mx = w[i]; }
        for (const i of act) w[i] /= mx; act = act.filter(i => w[i] > 1e-8);
      }
      if (X.bx.destroyed) { res.push({ g, sd, pay: -50, boom: 1, shots }); continue; }
      const [bi, pm] = map(); let ans = H[bi];
      if (pm < .5) { let z = 0; for (const i of act) z += w[i]; ans = H[bi].map((_, l) => { const m = new Map(); for (const i of act) { const e = H[i][l], k = e.k + ':' + (e.a ?? ''); m.set(k, (m.get(k) || 0) + w[i]); } let bk = null, bv = -1; for (const [k, v] of m) if (v > bv) { bv = v; bk = k; } const [k, a] = bk.split(':'); return a === '' ? { k } : { k, a: +a }; }); } // unsure of the whole: answer each line by its own best odds
      ans.forEach((a, i) => { document.querySelector(`[data-ci="${i}"]`).value = a.k; document.querySelector(`[data-ca="${i}"]`).value = a.a == null ? '' : a.a; });
      const c0 = X.bxSave().cash; document.getElementById('bSign').click(); const pay = X.bxSave().cash - c0;
      res.push({ g, sd, pay, shots, pm: +pm.toFixed(2), truth: JSON.stringify(X.box.els), guess: JSON.stringify(ans) });
    }
    return res;
  };
};

// known solutions: [type, x, y, angle, mirrorOrientation]
const SOL = [
  [['pol', 7, 4, 45]],
  [['pol', 3, 4, 15], ['pol', 5, 4, 30], ['pol', 7, 4, 45], ['pol', 9, 4, 60], ['pol', 11, 4, 75]],
  [['hwp', 6, 4, 45]],
  [['pbs', 7, 4, 0, 1]],
  [['phase', 6, 2, 180]],
  [['hwp', 6, 2, 45]],
  [['pol', 11, 6, 45], ['pol', 10, 7, 45]],
  null, // the bomb crate is played, not placed
  [['pol', 3, 4, 22], ['pol', 6, 4, 45], ['pol', 9, 4, 68]],
  [['hwp', 4, 4, 38], ['pbs', 7, 4, 0, 1]],
];
const sim = (page, lvIdx, parts, patch) => page.evaluate(([i, parts, patch]) => {
  const X = window.__pz, lv = Object.assign({}, X.LV[i], patch || {});
  const P = parts.map(([t, x, y, a = 0, m = 1]) => ({ t, x, y, a, m }));
  const h = X.simulate(lv, P).hits, out = {}; for (const k in h) out[k] = h[k].p; return out;
}, [lvIdx, parts, patch]);
// a bare test bench: source at (1,4) polarised at `pol`, detector at (13,4)
const bench = (page, pol, parts) => sim(page, 0, parts, { sources: [{ x: 1, y: 4, d: 0, pol }], fixed: [{ t: 'det', x: 13, y: 4, id: 'D' }] });
const sel = async (page, part) => page.evaluate(p => { const X = window.__pz; X.select(X.parts.find(q => q.x === p[1] && q.y === p[2])); }, part);
const sliderAt = async (page, frac) => { const b = await page.locator('#selR').boundingBox(); return [b.x + 8 + (b.width - 16) * frac, b.y + b.height / 2]; };
const openWith = async (page, save) => { // a second page in the same context: the harness only clears storage on the first
  const p2 = await page.context().newPage(), errs = []; p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(page.url()); await p2.evaluate(s => localStorage.setItem('rh:polarizer', s), save); await p2.reload(); await p2.waitForTimeout(300);
  return { p2, errs };
};

module.exports = {
  page: URL_,
  tests: {
    "Malus's law: one polariser passes cos²θ": async ({ page, near }) => {
      for (const th of [0, 15, 30, 45, 60, 75, 90, 120, 180]) {
        const h = await bench(page, 0, [['pol', 6, 4, th]]);
        near(h.D || 0, Math.cos(th * Math.PI / 180) ** 2, 1e-9, `θ=${th}`);
      }
      // and relative to the source's own angle
      near((await bench(page, 30, [['pol', 6, 4, 75]])).D, Math.cos(45 * Math.PI / 180) ** 2, 1e-9);
    },
    'three polarisers: 0°, 45°, 90° pass 1/4 of polarised and 1/8 of unpolarised light': async ({ page, near }) => {
      const parts = [['pol', 3, 4, 0], ['pol', 6, 4, 45], ['pol', 9, 4, 90]];
      const H = (await bench(page, 0, parts)).D || 0, V = (await bench(page, 90, parts)).D || 0;
      near(H, 1 / 4, 1e-9, 'H light: 1 · cos²45 · cos²45');
      near(V, 0, 1e-12, 'V light is stopped by the 0° filter');
      near((H + V) / 2, 1 / 8, 1e-9, 'unpolarised = incoherent 50:50 mix of H and V');
      near((await bench(page, 0, [['pol', 3, 4, 0], ['pol', 9, 4, 90]])).D || 0, 0, 1e-12, 'crossed filters block all');
      // N filters stepping 90°/N: cos²(90/N)^N → 1
      let prev = -1; for (const N of [1, 2, 3, 5, 9]) { const ps = []; for (let k = 1; k <= N; k++) ps.push(['pol', 1 + k, 4, 90 * k / N]); const p = (await bench(page, 0, ps)).D || 0; near(p, Math.cos(Math.PI / 2 / N) ** (2 * N), 1e-9, 'N=' + N); near(p > prev ? 1 : 0, 1, 0); prev = p; }
    },
    'half-wave plate rotates polarisation by 2θ and absorbs nothing': async ({ page, near }) => {
      for (const th of [0, 10, 22.5, 45, 70]) {
        const h = await bench(page, 0, [['hwp', 4, 4, th], ['pol', 8, 4, 2 * th]]);
        near(h.D, 1, 1e-9, `θ=${th}`);
        near((await bench(page, 0, [['hwp', 4, 4, th]])).D, 1, 1e-9);
      }
    },
    'Mach–Zehnder: all to D1, phase φ sends sin²(φ/2) to D2, probability conserved': async ({ page, near }) => {
      for (const ph of [0, 45, 90, 135, 180, 270, 360]) {
        const h = await sim(page, 4, [['phase', 6, 2, ph]]);
        near(h.D2 || 0, Math.sin(ph * Math.PI / 360) ** 2, 1e-9, `φ=${ph}`);
        near((h.D1 || 0) + (h.D2 || 0), 1, 1e-9);
      }
      // the phase plate works in either arm (with the sign of the phase flipped)
      near((await sim(page, 4, [['phase', 3, 4, 180]])).D2, 1, 1e-9);
    },
    'which-path label kills interference; diagonal filters erase it': async ({ page, near }) => {
      const h = await sim(page, 5, [['hwp', 6, 2, 45]]); near(h.D1, .5, 1e-9); near(h.D2, .5, 1e-9);
      const e = await sim(page, 6, []); near(e.D1, .5, 1e-9); near(e.D2, .5, 1e-9);
      const er = await sim(page, 6, [['pol', 11, 6, 45], ['pol', 10, 7, 45]]); near(er.D2, 0, 1e-9); near(er.D1, .5, 1e-9);
    },
    'Elitzur–Vaidman bomb tester: 1/4 detect, 1/4 D1, 1/2 explode (either arm)': async ({ page, near }) => {
      for (const at of [[6, 2], [3, 4], [7, 6]]) {
        const h = await sim(page, 4, [['bomb', ...at, 0]]);
        const boom = Object.entries(h).filter(([k]) => k !== 'D1' && k !== 'D2').reduce((a, [, v]) => a + v, 0);
        near(h.D2, .25, 1e-9, 'D2 (bomb detected unexploded) ' + at); near(h.D1, .25, 1e-9); near(boom, .5, 1e-9);
      }
    },
    'every level: unsolved at start, solved by its known solution, wrong answers fail': async ({ page, ok }) => {
      const res = await page.evaluate(SOL => {
        const X = window.__pz, out = [];
        const H = (i, parts) => { const h = X.simulate(X.LV[i], parts.map(([t, x, y, a = 0, m = 1]) => ({ t, x, y, a, m }))).hits, o = {}; for (const k in h) o[k] = h[k].p; return o; };
        X.LV.forEach((lv, i) => {
          if (lv.free || lv.crate || lv.box) return;
          const atStart = lv.test(H(i, []), {}), sol = SOL[i];
          let solved;
          if (lv.boomBudget) { const h = H(i, sol); solved = h.D2 > .2; } // the bomb level is won by firing; checked below
          else solved = lv.test(H(i, sol), {});
          // wrong: every angle in the solution turned to 0 (a freshly placed part)
          const wrong = lv.boomBudget ? false : lv.test(H(i, sol.map(([t, x, y, a, m]) => t === 'pbs' ? [t, x, y, 0, 0] : [t, x, y, t === 'phase' ? 90 : 0, m])), {}); // fresh angles / flipped splitter
          // tray limits respected
          const counts = {}; for (const [t] of sol) counts[t] = (counts[t] || 0) + 1;
          const fits = Object.entries(counts).every(([t, n]) => (lv.tray[t] || 0) >= n);
          out.push([i, atStart, solved, wrong, fits]);
        });
        return out;
      }, SOL);
      for (const [i, atStart, solved, wrong, fits] of res) { ok(!atStart, `level ${i} solved at start`); ok(solved, `level ${i} not solved by known solution`); ok(!wrong, `level ${i} solved by default angles`); ok(fits, `level ${i} solution exceeds tray`); }
      ok(res.length === 9);
    },
    'staircase: 4 filters at 5° steps cannot reach 60%, 5 can': async ({ page, ok }) => {
      const four = await sim(page, 1, [['pol', 3, 4, 20], ['pol', 5, 4, 35], ['pol', 7, 4, 55], ['pol', 9, 4, 70]]);
      ok(four.D < .6, 'four filters ' + four.D);
      const five = await sim(page, 1, SOL[1]); ok(five.D >= .6, 'five ' + five.D);
    },
    'sweeping the slider past the answer does not win; holding it does': async ({ page, ok, eq }) => {
      await page.evaluate(() => __pz.load(0));
      await page.evaluate(() => __pz.addPart('pol', 7, 4, 0)); await sel(page, ['pol', 7, 4]);
      eq(await page.evaluate(() => __pz.won), false);
      // drag right through 45° to 180° in one go and let go
      let [x0, y] = await sliderAt(page, 0), [x1] = await sliderAt(page, 1);
      await page.mouse.move(x0, y); await page.mouse.down();
      for (let k = 1; k <= 20; k++) { await page.mouse.move(x0 + (x1 - x0) * k / 20, y); await page.waitForTimeout(40); }
      await page.mouse.up(); await page.waitForTimeout(1500);
      eq(await page.evaluate(() => __pz.won), false, 'won by sweeping');
      // drag to 45° and keep holding the mouse: still not won
      let [xm] = await sliderAt(page, .25);
      await page.mouse.move(x1, y); await page.mouse.down(); await page.mouse.move(xm, y, { steps: 5 });
      for (let k = 0; k < 30; k++) { const a = await page.evaluate(() => __pz.parts[0].a); if (a === 45) break; xm += a > 45 ? -1 : 1; await page.mouse.move(xm, y); }
      ok(await page.evaluate(() => __pz.parts[0].a === 45), 'slider at 45');
      ok(await page.evaluate(() => __pz.holding), 'hold hint shown');
      await page.waitForTimeout(1500);
      eq(await page.evaluate(() => __pz.won), false, 'won while slider still held');
      await page.mouse.up(); await page.waitForTimeout(500);
      eq(await page.evaluate(() => __pz.won), false, 'won before settling');
      await page.waitForTimeout(800);
      eq(await page.evaluate(() => __pz.won), true, 'held setting should win');
      ok(await page.$eval('#goal', e => e.className === 'ok'), 'goal marked done, hold hint gone');
    },
    'arrow keys stepping past the answer do not win': async ({ page, eq }) => {
      await page.evaluate(() => __pz.load(0));
      await page.evaluate(() => __pz.addPart('pol', 7, 4, 0)); await sel(page, ['pol', 7, 4]);
      await page.locator('#cv').focus().catch(() => {}); await page.evaluate(() => document.activeElement && document.activeElement.blur());
      for (let k = 0; k < 18; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
      eq(await page.evaluate(() => __pz.parts[0].a), 90);
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), false);
      for (let k = 0; k < 9; k++) await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), true);
    },
    'Mach–Zehnder phase dial swept 0→360 does not win': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); }); // locked levels are refused
      eq(await page.evaluate(() => __pz.LV.indexOf(__pz.LV.find(l => l.n === document.getElementById('title').textContent))), 0);
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 4; i++) S.done[i] = 1; __pz.load(4); __pz.addPart('phase', 6, 2, 90); });
      await sel(page, ['phase', 6, 2]);
      for (let a = 90; a <= 360; a += 5) await page.evaluate(a => __pz.setAngleUI(a), a);
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), false);
      await page.evaluate(() => __pz.setAngleUI(180)); await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), true);
    },
    'removing a part re-checks; level change cancels a pending hold': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 0); __pz.select(__pz.parts[0]); __pz.setAngleUI(45); });
      eq(await page.evaluate(() => __pz.holding), true);
      await page.evaluate(() => __pz.load(0)); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => __pz.won), false, 'stale hold won the reloaded level');
      eq(await page.$eval('#goal', e => e.classList.contains('hold')), false);
    },
    'bomb crate: certify, stamp, score; stars from the crate score; a bad crate is rejected': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { FX.setMuted(true); const X = __pz; for (let i = 0; i < 7; i++) X.SAVE.done[i] = 1; X.crateSeed(5); X.load(7); const C = X.crate, o = { dudD1: true };
        while (!C.done) X.crateStamp(false); o.rejected = [X.won, C.score];
        X.crateSeed(5); X.load(7); const D = X.crate; let s = 9; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
        while (!D.done) { D.R = .2; const c = D.cur || []; if (c.includes('D2')) X.crateStamp(true); else if (c.length >= 6) X.crateStamp(false); else { const wasLive = D.live[D.i], res = X.crateFire(); if (!wasLive && res !== 'D1') o.dudD1 = false; } }
        o.careful = [X.won, D.score, X.SAVE.stars[7] || 0]; return o; });
      eq(r.rejected[0], false, 'stamping everything DUD ships mislabelled live bombs');
      ok(r.dudD1, 'a dud only ever gives D1');
      ok(r.careful[0] && r.careful[2] >= 1, 'a careful sorter passes: ' + r.careful);
    },
    'zeno crate: more passes are safer but the loop time is shared': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { FX.setMuted(true); const X = __pz; for (let i = 0; i < 10; i++) X.SAVE.done[i] = 1; const surv = {};
        for (const N of [1, 3, 6, 12]) { let k = 0, n = 0; for (let t = 0; t < 300; t++) { X.crateSeed(t); X.load(10); const C = X.crate; C.live.fill(true); C.N = N; C.cyclesLeft = 99; const o = X.crateFire(); n++; if (o === 'D2') k++; } surv[N] = k / n; }
        X.crateSeed(1); X.load(10); const C = X.crate; C.N = 12; let fired = 0; for (let k = 0; k < 10 && !C.done; k++) { if (X.crateFire() !== null) fired++; if (!C.done && (C.cur || []).length) X.crateStamp(true); }
        return { surv, fired, left: C.cyclesLeft }; });
      near(r.surv[1], 0, .02); ok(r.surv[3] > .3 && r.surv[3] < .6, 'N=3 ' + r.surv[3]); ok(r.surv[12] > .75, 'N=12 ' + r.surv[12]); ok(r.surv[12] > r.surv[6] && r.surv[6] > r.surv[3]);
      ok(r.fired <= 6 && r.left < 12, 'loop time runs out: ' + JSON.stringify(r));
    },
    'graded puzzles: stars improve with a better setting, never get worse': async ({ page, eq }) => {
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 8; i++) S.done[i] = 1; __pz.load(8); for (const [x, a] of [[3, 0], [6, 45], [9, 65]]) __pz.addPart('pol', x, 4, a); });
      await page.evaluate(() => { __pz.select(__pz.parts[0]); __pz.setAngleUI(35); }); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => [__pz.won, __pz.SAVE.stars[8]]), [true, 1]);
      await page.evaluate(() => { __pz.setAngleUI(22); __pz.select(__pz.parts[1]); __pz.setAngleUI(45); __pz.select(__pz.parts[2]); __pz.setAngleUI(68); }); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => __pz.SAVE.stars[8]), 3);
      await page.evaluate(() => { __pz.select(__pz.parts[2]); __pz.setAngleUI(60); }); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => __pz.SAVE.stars[8]), 3);
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const R = await page.evaluate(() => { FX.setMuted(true); const X = __pz, out = { naive: 0, naiveN: 0, comp: [] }; for (let i = 0; i < 11; i++) X.SAVE.done[i] = 1;
        const H = (i, parts) => { const h = X.simulate(X.LV[i], parts.map(([t, x, y, a = 0, m = 1]) => ({ t, x, y, a, m }))).hits, o = {}; for (const k in h) o[k] = h[k].p; return o; };
        const gradeP = (i, parts) => { const L = X.LV[i], h = H(i, parts); return L.test(h, {}) ? L.grade(h) : 0; };
        let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, snap = a => Math.round(a / 5) * 5;
        for (let t = 0; t < 10; t++) { out.naiveN += 2; if (gradeP(8, [['pol', 3, 4, snap(rnd() * 180)], ['pol', 6, 4, snap(rnd() * 180)], ['pol', 9, 4, snap(rnd() * 180)]]) > 1) out.naive++; if (gradeP(9, [['hwp', 4, 4, snap(rnd() * 180)], ['pbs', 7, 4, 0, 1]]) > 1) out.naive++; }
        out.naiveN += 4; if (gradeP(8, [['pol', 3, 4, 45], ['pol', 6, 4, 45], ['pol', 9, 4, 45]]) > 1) out.naive++; if (gradeP(9, [['hwp', 4, 4, 45], ['pbs', 7, 4, 0, 1]]) > 1) out.naive++; if (gradeP(8, []) > 1) out.naive++; if (gradeP(9, []) > 1) out.naive++;
        out.comp.push(gradeP(8, [['pol', 3, 4, 25], ['pol', 6, 4, 45], ['pol', 9, 4, 65]]), gradeP(9, [['hwp', 4, 4, 35], ['pbs', 7, 4, 0, 1]]));
        const crate = (lv, policy, seed) => { X.crateSeed(seed); X.load(lv); const C = X.crate; let s2 = seed * 7 + 1; Math.random = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647; let g = 0; while (!C.done && g++ < 3000) policy(C); const fr = C.score / C.live.reduce((a, v) => a + (v ? 3 : 1), 0), S = X.LV[lv].crate.stars; return fr >= S[2] ? 3 : fr >= S[1] ? 2 : fr >= S[0] ? 1 : 0; };
        const once = C => { if (!(C.cur || []).length) { if (X.crateFire() === 'boom' || C.done) return; } X.crateStamp((C.cur || []).includes('D2')); };
        const plan = C => { const left = C.live.length - C.i; C.N = Math.max(1, Math.floor(C.cyclesLeft / left)); const c = C.cur || []; if (c.length) return X.crateStamp(c.includes('D2')); if (C.cyclesLeft < 1) return X.crateStamp(false); X.crateFire(); };
        const zc = []; for (let t = 0; t < 10; t++) { out.naiveN += 2; if (crate(10, C => X.crateStamp(true), 100 + t) > 1) out.naive++; if (crate(10, once, 200 + t) > 1) out.naive++; zc.push(crate(10, plan, 300 + t)); }
        out.zenoPass = zc.filter(g => g >= 1).length / zc.length; out.zeno3 = zc.filter(g => g === 3).length / zc.length;
        return out; });
      ok(R.naive / R.naiveN <= .2, `naive play earned 2★+ on ${R.naive}/${R.naiveN} late tries`);
      ok(R.comp.every(g => g >= 1) && R.zenoPass >= .8, 'competent play passes: ' + JSON.stringify(R));
      ok(R.comp.every(g => g < 3) && R.zeno3 <= .3, '3★ needs better than the simple competent play: ' + JSON.stringify(R));
    },
    'tactile bench: drag an optic from the drawer onto a hole, twist it by its ring, hold to win': async ({ page, ok, eq }) => {
      await page.evaluate(() => __pz.load(0));
      const tray = await page.locator('#tray [data-t="pol"]').boundingBox();
      const [hx, hy, c] = await page.evaluate(() => __pz.screenOf(7, 4));
      await page.mouse.move(tray.x + tray.width / 2, tray.y + tray.height / 2); await page.mouse.down();
      await page.mouse.move(hx, hy, { steps: 12 }); await page.mouse.up();
      eq(await page.evaluate(() => __pz.parts.map(p => [p.t, p.x, p.y, p.a])), [['pol', 7, 4, 0]], 'dropped into the hole');
      eq(await page.$eval('#tray [data-t="pol"] i', e => e.textContent), '0', 'drawer count');
      // grab the ring at 3 o'clock and turn it anticlockwise by 45°
      const r = c * .38;
      await page.mouse.move(hx + r, hy); await page.mouse.down();
      for (let k = 1; k <= 9; k++) { const a = k / 9 * Math.PI / 4; await page.mouse.move(hx + r * Math.cos(a), hy - r * Math.sin(a)); }
      eq(await page.evaluate(() => __pz.parts[0].a), 45, 'twisted to 45');
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), false, 'won while still gripping the ring');
      await page.mouse.up(); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => __pz.won), true, 'released at 45 and held');
      ok(await page.evaluate(() => __pz.celeb > 0), 'signature light pulse started');
    },
    'twisting the ring past the answer and on does not win': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 0); });
      const [hx, hy, c] = await page.evaluate(() => __pz.screenOf(7, 4)), r = c * .38;
      await page.mouse.move(hx + r, hy); await page.mouse.down();
      for (let k = 1; k <= 18; k++) { const a = k / 18 * Math.PI / 2; await page.mouse.move(hx + r * Math.cos(a), hy - r * Math.sin(a)); await page.waitForTimeout(30); }
      await page.mouse.up(); await page.waitForTimeout(1400);
      eq(await page.evaluate(() => __pz.parts[0].a), 90); eq(await page.evaluate(() => __pz.won), false);
    },
    'carry a mount to another hole, tap a mirror twice to flip it, drag off the board to remove': async ({ page, eq }) => {
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 11; i++) S.done[i] = 1; __pz.load(11); __pz.addPart('mirror', 5, 4, 0, 1); __pz.addPart('pol', 3, 4, 30); });
      let [hx, hy] = await page.evaluate(() => __pz.screenOf(3, 4)); const [tx, ty] = await page.evaluate(() => __pz.screenOf(3, 6));
      await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(tx, ty, { steps: 8 }); await page.mouse.up();
      eq(await page.evaluate(() => { const p = __pz.parts.find(p => p.t === 'pol'); return [p.x, p.y, p.a]; }), [3, 6, 30]);
      // can't drop onto an occupied hole
      [hx, hy] = await page.evaluate(() => __pz.screenOf(3, 6)); const [mx, my] = await page.evaluate(() => __pz.screenOf(5, 4));
      await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(mx, my, { steps: 8 }); await page.mouse.up();
      eq(await page.evaluate(() => { const p = __pz.parts.find(p => p.t === 'pol'); return [p.x, p.y]; }), [3, 6], 'landed on top of the mirror');
      await page.mouse.click(mx, my); await page.mouse.click(mx, my);
      eq(await page.evaluate(() => __pz.parts.find(p => p.t === 'mirror').m), 0, 'second tap flips the mirror');
      await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx, 4, { steps: 10 }); await page.mouse.up();
      eq(await page.evaluate(() => __pz.parts.map(p => p.t)), ['pol'], 'dragged off the board goes back in the drawer');
    },
    'pan and zoom: drop and tap-place land under the finger when zoomed; pinch places nothing; drag on empty space pans; Fit restores': async ({ page, ok, eq, near }) => {
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 11; i++) S.done[i] = 1; __pz.load(11); });
      const k0 = await page.evaluate(() => __pz.cam.k);
      await page.click('.pz-in'); await page.click('.pz-in'); ok(await page.evaluate(() => __pz.cam.k) > k0 * 1.8, 'zoomed in');
      // drag a polariser from the drawer onto hole (6,3) at its zoomed position
      let [hx, hy] = await page.evaluate(() => __pz.screenOf(6, 3)); const tray = await page.locator('#tray [data-t="pol"]').boundingBox();
      await page.mouse.move(tray.x + tray.width / 2, tray.y + tray.height / 2); await page.mouse.down(); await page.mouse.move(hx + 3, hy - 2, { steps: 10 }); await page.mouse.up();
      eq(await page.evaluate(() => __pz.parts.map(p => [p.t, p.x, p.y])), [['pol', 6, 3]], 'dropped where the pointer was');
      // a mouse wheel zoom around a point keeps the hole under the cursor
      await page.mouse.move(hx, hy); await page.mouse.wheel(0, -300); await page.waitForTimeout(50);
      const [hx2, hy2] = await page.evaluate(() => __pz.screenOf(6, 3)); near(hx2, hx, 1.5); near(hy2, hy, 1.5);
      // pick the mirror tool and tap a zoomed hole
      await page.click('#tray [data-t="mirror"]'); const [mx, my] = await page.evaluate(() => __pz.screenOf(7, 4));
      await page.mouse.click(mx, my); ok(await page.evaluate(() => __pz.parts.some(p => p.t === 'mirror' && p.x === 7 && p.y === 4)), 'tap placed a mirror at the zoomed hole');
      // a two-finger pinch on empty holes with a tool armed places nothing, and zooms
      await page.click('#tray [data-t="mirror"]').catch(() => {}); await page.evaluate(() => { if (!__pz.tool) __pz.setTool('mirror'); });
      const r = await page.evaluate(() => { const el = document.getElementById('cv'), [ax, ay] = __pz.screenOf(9, 2), [bx, by] = __pz.screenOf(11, 2), n = __pz.parts.length, k = __pz.cam.k;
        const ev = (t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
        ev('pointerdown', 1, ax, ay); ev('pointerdown', 2, bx, by); ev('pointermove', 1, ax - 30, ay); ev('pointermove', 2, bx + 30, by); ev('pointerup', 1, ax - 30, ay); ev('pointerup', 2, bx + 30, by);
        return { added: __pz.parts.length - n, zoom: __pz.cam.k / k, tool: __pz.tool }; });
      eq(r.added, 0, 'pinch placed a part'); ok(r.zoom > 1.1, 'pinch zoomed ' + r.zoom);
      // dragging a placed part still moves it (it does not pan)
      const cx0 = await page.evaluate(() => __pz.cam.x); [hx, hy] = await page.evaluate(() => __pz.screenOf(6, 3)); const [tx, ty] = await page.evaluate(() => __pz.screenOf(6, 5));
      await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(tx, ty, { steps: 8 }); await page.mouse.up();
      ok(await page.evaluate(() => __pz.parts.some(p => p.t === 'pol' && p.x === 6 && p.y === 5)), 'carried the polariser'); eq(await page.evaluate(() => __pz.cam.x), cx0, 'moving a part does not pan');
      // dragging an empty hole pans and places nothing
      const n0 = await page.evaluate(() => __pz.parts.length), [ex, ey] = await page.evaluate(() => __pz.screenOf(3, 7));
      await page.mouse.move(ex, ey); await page.mouse.down(); await page.mouse.move(ex + 60, ey, { steps: 6 }); await page.mouse.up();
      near(await page.evaluate(() => __pz.cam.x) - cx0, 60, 2, 'empty-space drag pans'); eq(await page.evaluate(() => __pz.parts.length), n0, 'pan placed nothing');
      await page.click('.pz-fit'); await page.waitForTimeout(450);
      eq(await page.evaluate(() => [__pz.cam.k, __pz.cam.x, __pz.cam.y]), [1, 0, 0], 'Fit returns to the fitted board');
    },
    'sealed boxes: generated per seed; hidden parts are real optics on the bench; nothing inside is drawn': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const X = __pz, o = { det: true, n: 0, kinds: {} };
        for (let g = 1; g <= 7; g++) for (let sd = 1; sd <= 10; sd++) { const a = X.genBox(sd, g), b = X.genBox(sd, g); if (JSON.stringify(a) !== JSON.stringify(b)) o.det = false; o.n++; for (const e of a.els) o.kinds[e.k] = 1; }
        o.differ = JSON.stringify(X.genBox(1, 3)) !== JSON.stringify(X.genBox(2, 3));
        // a box with one filter at 60° passes cos² of the laser's light, exactly as the physics says
        const B = { seed: 0, grade: 1, els: [{ k: 'pol', a: 60 }] }, lv = { sources: [{ x: 1, y: 4, d: 0, pol: 0 }], fixed: X.boxParts(B) };
        const h = X.simulate(lv, [{ t: 'det', x: 12, y: 4, id: 'P1', a: 0, m: 1 }]).hits; o.malus = h.P1.p;
        const hl = X.simulate({ ...lv, fixed: X.boxParts({ els: [{ k: 'live' }] }) }, [{ t: 'det', x: 12, y: 4, id: 'P1', a: 0, m: 1 }]).hits; o.live = [hl.BOMB && hl.BOMB.p, hl.P1 ? hl.P1.p : 0];
        const hd = X.simulate({ ...lv, fixed: X.boxParts({ els: [{ k: 'dud' }] }) }, [{ t: 'det', x: 12, y: 4, id: 'P1', a: 0, m: 1 }]).hits; o.dud = hd.P1.p;
        return o; });
      ok(r.det && r.differ, 'same seed, same box'); ok(['pol', 'hwp', 'phase', 'live', 'dud', 'up', 'down'].every(k => r.kinds[k]), 'every kind of content turns up: ' + Object.keys(r.kinds));
      ok(Math.abs(r.malus - .25) < 1e-9, 'filter at 60°: ' + r.malus); eq(r.live, [1, 0], 'a live bomb takes every photon'); ok(Math.abs(r.dud - 1) < 1e-9, 'a dud lets it all through');
      // in the box level no beam is drawn and detectors show counts, not probabilities
      await page.evaluate(() => { for (let i = 0; i < 4; i++) __pz.SAVE.done[i] = 1; __pz.openBox(3, 1); });
      eq(await page.evaluate(() => __pz.parts.map(p => [p.t, p.x, p.y])), [['det', 12, 4]], 'the first box comes with a detector in place');
      await page.click('#bf1'); ok(await page.evaluate(() => __pz.bx.shots === 1 && __pz.bx.left === __pz.box.budget - 1), 'Fire 1 spends one photon');
    },
    'sealed boxes, difficulty: a careful prober profits; firing straight through and guessing loses money': async ({ page, ok }) => {
      const r = await page.evaluate(() => { FX.setMuted(true); const X = __pz; for (let i = 0; i < 4; i++) X.SAVE.done[i] = 1; const rnd = RH.rng(11); Math.random = RH.rng(12);
        const sign = ans => { ans.forEach((a, i) => { document.querySelector(`[data-ci="${i}"]`).value = a.k; document.querySelector(`[data-ca="${i}"]`).value = a.a == null ? '' : a.a; }); const c0 = X.bxSave().cash; document.getElementById('bSign').click(); return X.bxSave().cash - c0; };
        // careful: transmission with no analyser, an analyser sweep fitted to cos², and (for grade 2) vertical light in: a filter blocks some, a wave plate never absorbs
        const careful = (sd, g) => { X.openBox(sd, g); if (!X.parts.some(p => p.t === 'det')) X.addPart('det', 12, 4); X.boxFire(40); const T0 = X.bx.log[Object.keys(X.bx.log)[0]], t0 = (T0.clicks.P1 || 0) / T0.shots;
          const an = X.addPart('pol', 10, 4, 0); for (const a of [0, 45, 90, 135]) { X.setAngle(an, a); X.boxFire(25); } const f = X.cosFit(X.evidence()), r15 = v => ((Math.round(v / 15) * 15) % 180 + 180) % 180;
          // a filter at θ passes cos²θ of the laser: that fixes |θ|; the analyser sweep picks the sign
          const polAngle = () => { const m = Math.acos(Math.sqrt(Math.min(1, Math.max(0, t0)))) * 180 / Math.PI, E = X.evidence(), err = th => E.reduce((s2, q) => s2 + q.w * (q.y - t0 * Math.cos((q.a - th) * Math.PI / 180) ** 2) ** 2, 0); return r15(err(m) <= err(180 - m) ? m : 180 - m); };
          if (g === 1) return sign([{ k: 'pol', a: polAngle() }]);
          X.parts.splice(X.parts.indexOf(an), 1); const pre = X.addPart('pol', 4, 4, 90); const n0 = X.bx.shots; X.boxFire(20); const tv = Object.values(X.bx.log).slice(-1)[0], v = (tv.clicks.P1 || 0) / tv.shots;
          return sign(t0 > .7 && v > .7 ? [{ k: 'hwp', a: r15(f.ph / 2) % 90 }] : [{ k: 'pol', a: polAngle() }]); };
        const naive = (sd, g) => { X.openBox(sd, g); if (!X.parts.some(p => p.t === 'det')) X.addPart('det', 12, 4); X.boxFire(20); const k = g === 1 || rnd() < .5 ? 'pol' : 'hwp'; return sign([{ k, a: Math.floor(rnd() * 12) * 15 }]); };
        const o = { care: [], naive: [] }; for (const g of [1, 2]) for (let sd = 40; sd < 48; sd++) { o.care.push(careful(sd, g)); o.naive.push(naive(sd + 100, g)); }
        const sum = a => a.reduce((x, v) => x + v, 0); o.careSum = sum(o.care); o.naiveSum = sum(o.naive); o.carePerfect = o.care.filter(v => v > 60).length; return o; });
      ok(r.careSum > 0 && r.carePerfect >= 12, 'careful probing pays: ' + JSON.stringify(r)); ok(r.naiveSum < 0, 'guessing loses money: ' + JSON.stringify(r));
    },
    'sealed boxes: a live bomb hit by a photon destroys the box; an interferometer can certify it untouched; the shop stocks the drawer': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { FX.setMuted(true); const X = __pz; for (let i = 0; i < 4; i++) X.SAVE.done[i] = 1; const o = {};
        Math.random = RH.rng(77);
        // straight through: the first photon on a live bomb ends it
        const live = X.genBox(1, 4).els[0].k === 'live' ? 1 : [2, 3, 4, 5, 6, 7, 8].find(sd => X.genBox(sd, 4).els[0].k === 'live'); X.openBox(live, 4); X.boxFire(5); o.direct = [X.bx.destroyed, X.bx.shots];
        // Elitzur–Vaidman round the box: half mirror at C5 up to C3, mirror at K5 up to K3, mirror C3 across, half mirror K3; detectors right of and above K3
        let cert = 0, lost = 0; for (let t = 0; t < 24; t++) { X.openBox(live, 4); X.addPart('bs', 2, 4, 0, 0); X.addPart('mirror', 2, 2, 0, 0); X.addPart('mirror', 10, 4, 0, 0); X.addPart('bs', 10, 2, 0, 0); X.addPart('det', 12, 2); X.addPart('det', 10, 0);
          const hd = X.simulate({ sources: [{ x: 1, y: 4, d: 0, pol: 0 }], fixed: X.boxParts({ els: [{ k: 'dud' }] }) }, X.parts).hits, dark = ['P1', 'P2'].find(k => !hd[k] || hd[k].p < 1e-9); o.dark = dark;
          while (!X.bx.destroyed && X.bx.left > 0) { X.boxFire(1); if (X.fires[dark]) break; } if (X.bx.destroyed) lost++; else cert++; }
        o.ev = [cert, lost];
        X.SAVE.bx.cash = 200; const c0 = X.bxSave().cash; document.getElementById('bShop').click(); const btn = document.querySelector('[data-buy="pol"]'); btn.click(); o.shop = [c0 - X.bxSave().cash, X.bxSave().own.pol, X.LV[12].n];
        o.tray = [...document.querySelectorAll('#tray [data-t]')].map(b => b.dataset.t); return o; });
      eq(r.direct, [true, 1], 'the first photon straight through detonates a live bomb');
      ok(r.ev[0] >= 4 && r.ev[1] >= 8, 'an interferometer certifies some live bombs untouched (and loses some): ' + r.ev);
      eq(r.shop.slice(0, 2), [30, 2], 'bought a second filter'); ok(r.tray.includes('pol') && !r.tray.includes('bs') || r.tray.length >= 1, 'drawer shows what you own');
    },
    'sealed boxes, grades 3, 5 and 7: a systematic prober certifies most boxes and profits; guessing loses money': async ({ page, ok }) => {
      await page.evaluate(BAYES_BOT);
      const r = await page.evaluate(() => { FX.setMuted(true); const X = __pz; let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; Math.random = rnd;
        const o = { care: bayesBot(X, [3, 5, 7], [40, 41, 42, 43, 44, 45, 46, 47]), naive: [] };
        for (const g of [3, 5, 7]) for (let sd = 140; sd < 148; sd++) { X.openBox(sd, g); const n = X.box.els.length, picks = X.GRADES[g].pick.filter(p => p.length === n), G = X.GRADES[g];
          X.addPart('det', 12, 4); X.boxFire(20); if (X.bx.destroyed) { o.naive.push({ g, pay: -50 }); continue; }
          const pk = picks[Math.floor(rnd() * picks.length)];
          pk.forEach((k, i) => { document.querySelector(`[data-ci="${i}"]`).value = k; document.querySelector(`[data-ca="${i}"]`).value = k === 'pol' ? Math.floor(rnd() * 180 / G.step) * G.step : k === 'hwp' ? Math.floor(rnd() * 90 / G.step) * G.step : k === 'phase' ? (1 + Math.floor(rnd() * (360 / G.step - 1))) * G.step : ''; });
          const c0 = X.bxSave().cash; document.getElementById('bSign').click(); o.naive.push({ g, pay: X.bxSave().cash - c0 }); }
        const sum = a => a.reduce((x, v) => x + v.pay, 0), by = (a, g) => a.filter(v => v.g === g);
        return { per: [3, 5, 7].map(g => [g, sum(by(o.care, g)), by(o.care, g).filter(v => v.pay > 100).length, sum(by(o.naive, g))]), booms: o.care.filter(v => v.boom).length }; });
      for (const [g, care, perfect, naive] of r.per) { ok(care > 0 && naive < 0, `grade ${g}: careful +$${care}, guessing $${naive}`); ok(perfect >= 5, `grade ${g}: careful prober certified ${perfect}/8`); }
      ok(r.booms <= 2, 'the careful prober rarely blows up a box: ' + r.booms); console.log('      boxes, grades 3/5/7 [grade, careful $, certified/8, guessing $]: ' + JSON.stringify(r.per));
    },
    'sealed boxes: a card describing a physically identical box is accepted; a certified card opens the next grade': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { FX.setMuted(true); const X = __pz, o = {};
        // two half-wave plates only rotate by twice their difference: (75°, 60°) and (15°, 0°) are the same box
        const sd = [...Array(400).keys()].find(k => { const e = X.genBox(k, 3).els; return e[0].k === 'hwp' && e[1].k === 'hwp' && e[0].a >= 15 && e[1].a >= 15; });
        X.openBox(sd, 3); const e = X.box.els; o.truth = e;
        const sign = ans => { ans.forEach((a, i) => { document.querySelector(`[data-ci="${i}"]`).value = a.k; document.querySelector(`[data-ca="${i}"]`).value = a.a; }); const c0 = X.bxSave().cash; document.getElementById('bSign').click(); return X.bxSave().cash - c0; };
        o.same = X.boxSig(e) === X.boxSig([{ k: 'hwp', a: e[0].a - 15 }, { k: 'hwp', a: e[1].a - 15 }]);
        o.pay = sign([{ k: 'hwp', a: e[0].a - 15 }, { k: 'hwp', a: e[1].a - 15 }]); o.grade = X.bxSave().grade;
        X.openBox(sd, 3); o.wrong = sign([{ k: 'hwp', a: (e[0].a + 15) % 90 }, { k: 'hwp', a: e[1].a }]);
        // a live bomb hides whatever is in front of it: the filter's angle in front of it can't be known, so it is not marked down
        o.shadow = X.boxSig([{ k: 'pol', a: 30 }, { k: 'live' }]) === X.boxSig([{ k: 'pol', a: 120 }, { k: 'live' }]) && X.boxSig([{ k: 'pol', a: 30 }, { k: 'live' }]) !== X.boxSig([{ k: 'pol', a: 30 }, { k: 'dud' }]);
        return o; });
      ok(r.same, 'same signature'); ok(r.pay > 100, 'equivalent card certified: ' + r.pay + ' ' + JSON.stringify(r.truth)); eq(r.grade, 4, 'certifying a grade-3 box opens grade 4');
      ok(r.wrong < 100, 'a genuinely different card is not certified: ' + r.wrong); ok(r.shadow, 'parts in a live bomb\'s shadow are free; live vs dud is not');
    },
    'sealed boxes on a phone: the trigger and the spec card sit in a bottom sheet, reachable without scrolling; signing works from it': async ({ page, ok, eq }) => {
      for (const [w, h] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width: w, height: h }); await page.evaluate(() => { localStorage.clear(); document.getElementById('toast').classList.remove('on'); __pz.openBox(5, 1); }); await page.waitForTimeout(200);
        const vis = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return r.width > 0 && y > 0 && y < innerHeight && x > 0 && x < innerWidth && (document.elementFromPoint(x, y) === e || e.contains(document.elementFromPoint(x, y))); }, sel);
        ok(await vis('#sheet #bf10') && await vis('#sheet #bSign'), `${w}: Fire and Sign are on screen`);
        await page.click('#sheet #bf10'); ok(await page.evaluate(() => __pz.bx.shots === 10), `${w}: fired from the sheet`);
        if (await page.getAttribute('#sheet #shT', 'aria-expanded') !== 'true') await page.click('#sheet #shT'); ok(await vis('#sheet [data-ci="0"]'), `${w}: the card opens in the sheet, no scrolling`);
        const truth = await page.evaluate(() => __pz.box.els[0]);
        await page.selectOption('#sheet [data-ci="0"]', truth.k); await page.fill('#sheet [data-ca="0"]', String(truth.a));
        const c0 = await page.evaluate(() => __pz.bxSave().cash); await page.click('#sheet #bSign'); ok(await page.evaluate(c0 => __pz.bxSave().cash > c0 + 50, c0), `${w}: signed and paid`);
        const board = await page.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(); return r.top; });
        ok(board > h * .45, `${w}: the sheet stays low (${board})`);
        await page.evaluate(() => __pz.load(0)); eq(await page.evaluate(() => document.getElementById('sheet').classList.contains('on')), false, `${w}: no sheet in the lessons`);
      }
      await page.setViewportSize({ width: 1280, height: 800 });
    },
    'progress and locked levels': async ({ page, eq, ok }) => {
      eq(await page.textContent('#title'), 'Sealed Boxes', 'a new player lands on the workbench');
      const locked = await page.$$eval('#levels .lv.lock', els => els.map(e => +e.dataset.i));
      eq(locked, [], 'every lesson is open: they are optional');
      eq(await page.$$eval('#levels .lv', els => els.map(e => +e.dataset.i)).then(a => a[0]), 12, 'the workbench is listed first');
      await page.evaluate(() => __pz.load(5)); eq(await page.textContent('#title'), 'Which Path?', 'any lesson can be opened');
      await page.evaluate(() => __pz.load(11)); eq(await page.textContent('#title'), 'Lab Sandbox', 'sandbox is always open');
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 45); });
      eq(await page.evaluate(() => __pz.won), true);
      const hub = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).polarizer); ok(Math.abs(hub - 1 / 11) < 1e-9, 'progress ' + hub);
      // replay: winning again does not change progress
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 45); });
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).polarizer), hub);
    },
    'corrupted / odd saves load without errors': async ({ page, eq, ok }) => {
      const SB = 'Sealed Boxes';
      for (const [save, title] of [['null', SB], ['5', SB], ['"x"', SB], ['[1,2]', SB],
        ['{"done":"zz","stars":7,"cur":-3}', SB], ['{"cur":6}', 'Quantum Eraser'], ['{"cur":"abc"}', SB],
        ['{"done":{"0":1,"1":1},"cur":2}', 'A Better Way'], ['{"cur":11}', 'Lab Sandbox'], ['{"done":{"0":1,"99":1,"-1":1},"cur":1}', 'The Staircase'], ['{not json', SB]]) {
        const { p2, errs } = await openWith(page, save);
        eq(errs, [], 'errors for ' + save); eq(await p2.textContent('#title'), title, 'level for ' + save);
        const hub = await p2.evaluate(() => JSON.parse(localStorage.getItem('rh:hub') || '{}').polarizer);
        ok(hub == null || (hub >= 0 && hub <= 1), 'progress in range ' + hub);
        await p2.close();
      }
    },
    'save round trip': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 45); __pz.load(1); });
      const { p2 } = await openWith(page, await page.evaluate(() => localStorage.getItem('rh:polarizer')));
      eq(await p2.textContent('#title'), 'The Staircase');
      eq(await p2.evaluate(() => __pz.SAVE.done), { 0: 1 });
    },
    'no console errors at phone and desktop sizes; panels do not overlap the table': async ({ page, ok }) => {
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
        for (let i = 0; i < 13; i++) await page.evaluate(i => { __pz.SAVE.done[i] = 1; __pz.load(i); }, i);
        const r = await page.evaluate(() => { const hud = document.getElementById('hud').getBoundingClientRect(), tray = document.getElementById('tray').getBoundingClientRect(); return { hudB: hud.bottom, trayT: tray.top, trayR: tray.right, W: innerWidth, sw: document.documentElement.scrollWidth }; });
        ok(r.trayR <= r.W + 1 && r.sw <= r.W, `horizontal overflow at ${w}`);
        ok(r.hudB < r.trayT, `hud overlaps tray at ${w}`);
      }
    },
  },
};
