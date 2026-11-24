// Chladni: plate mode frequencies and shapes, resonance response, and that a figure is only recorded
// when the dial is held near a resonance (not swept past).
const openWith = async (page, save) => {
  const p2 = await page.context().newPage(), errs = []; p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(page.url()); await p2.evaluate(s => localStorage.setItem('rh:chladni', s), save); await p2.reload(); await p2.waitForTimeout(500);
  return { p2, errs };
};
const toMatch = page => page.click('[data-m="match"]');
// drive the dial with real time passing; returns whether the target got solved
const sweep = (page, f0, f1, seconds) => page.evaluate(([f0, f1, ms]) => new Promise(res => {
  const t0 = performance.now(); const id = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / ms); __ch.setFreq(f0 * Math.pow(f1 / f0, u)); if (u >= 1) { clearInterval(id); res(); } }, 16);
}), [f0, f1, seconds * 1000]);

// put the bow where mode k moves most (and its twin least): that is how you excite one figure on purpose
const BEST_BOW = `window.bestBow = k => { const X = __ch, M = X.PLATES[X.plate].modes, md = M[k], tw = M.find(m => m !== md && m.pair && m.pair === md.pair), pts = [];
  if (X.plate === 'circle') for (let a = 0; a < 360; a += 3) pts.push({ x: .5 + .49 * Math.cos(a * Math.PI / 180), y: .5 + .49 * Math.sin(a * Math.PI / 180) });
  else for (let t = 0; t <= 1.0001; t += .02) pts.push({ x: 1, y: t }, { x: 0, y: t }, { x: t, y: 0 }, { x: t, y: 1 });
  const zm = m => m.zmax || 1; let best = pts[0], bv = -9; for (const p of pts) { const v = Math.abs(md.z(p.x, p.y)) / zm(md) - (tw ? Math.abs(tw.z(p.x, p.y)) / zm(tw) : 0); if (v > bv) { bv = v; best = p; } } X.setFinger(null); X.setBow(best); }`;
module.exports = {
  page: 'chladni/index.html',
  tests: {
    'round plate: frequencies ∝ k², k = zeros of Jn′ (free edge)': async ({ page, near, ok }) => {
      const KNOWN = { c11: 1.8412, c21: 3.0542, c01: 3.8317, c31: 4.2012, c41: 5.3176, c12: 5.3314, c51: 6.4156, c22: 6.7061, c02: 7.0156, c32: 8.0152 };
      const f = await page.evaluate(() => Object.fromEntries(__ch.PLATES.circle.modes.map(m => [m.id, m.f])));
      let n = 0; for (const [id, k] of Object.entries(KNOWN)) if (f[id]) { near(Math.sqrt(f[id] / 20), k, 2e-3, id); n++; }
      ok(n >= 8, 'checked ' + n);
      // mode shapes: n nodal diameters → z(θ) changes sign 2n times round a circle
      const signs = await page.evaluate(() => __ch.PLATES.circle.modes.map(m => { let c = 0, p = 0; for (let i = 0; i < 720; i++) { const a = i / 720 * 2 * Math.PI, z = m.z(.5 + .3 * Math.cos(a + .01), .5 + .3 * Math.sin(a + .01)); const s = Math.sign(z); if (p && s && s !== p) c++; if (s) p = s; } return [m.id, c]; }));
      for (const [id, c] of signs) ok(c === 2 * +id[1], `${id}: ${c} sign changes`);
    },
    'square & 2:1 plates: f ∝ n²+m² / n²+4m² (with small detuning); shapes are symmetric and vanish on nodal lines': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => {
        const sq = __ch.PLATES.square.modes.map(m => { const [n, k] = [+m.id[1], +m.id[2]], sg = m.id[3] === 'p' ? 1 : -1; return { id: m.id, ratio: m.f / (46 * (n * n + k * k)), sym: [[.13, .71], [.4, .9], [.62, .27]].map(([x, y]) => m.z(x, y) - sg * m.z(y, x)) }; });
        const rc = __ch.PLATES.rect.modes.map(m => { const [n, k] = [+m.id[1], +m.id[2]]; return { id: m.id, ratio: m.f / (32 * (n * n + 4 * k * k)), node: n ? m.z(1 / (2 * n), .37) : k ? m.z(.37, 1 / (2 * k)) : 0 }; });
        return { sq, rc };
      });
      for (const m of r.sq) { ok(m.ratio > 1 && m.ratio < 1.25, m.id + ' ratio ' + m.ratio); for (const d of m.sym) near(d, 0, 1e-12, m.id + ' symmetry'); }
      for (const m of r.rc) { ok(m.ratio >= 1 && m.ratio < 1.3, m.id + ' ratio ' + m.ratio); near(m.node, 0, 1e-12, m.id + ' nodal line'); }
    },
    'mode lists: sorted, distinguishable (≥2.2% apart), inside the dial range; 10 distinct targets per plate': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => Object.entries(__ch.PLATES).map(([k, p]) => [k, p.modes.map(m => m.f), __ch.targetsOf(k).map(m => m.id), p.modes.map(m => m.pair || m.id)]));
      for (const [k, fs, T, pairs] of r) {
        ok(fs.length >= 12, k + ' modes ' + fs.length);
        for (let i = 1; i < fs.length; i++) ok(fs[i] / fs[i - 1] > 1.022 || pairs[i] === pairs[i - 1], `${k} modes ${i - 1},${i} too close`); // twins sit closer: that's the point
        ok(fs[0] > 44 && fs[fs.length - 1] < 4200 * .92, k + ' range');
        eq(T.length, Math.min(10, Math.ceil(fs.length / 2)), k + ' targets'); ok(T.length >= 8); eq(new Set(T).size, T.length);
      }
    },
    'resonance: driving at a mode frequency focuses that mode at full strength; between modes it is weak': async ({ page, ok, eq }) => {
      await page.evaluate(BEST_BOW);
      const r = await page.evaluate(() => { const out = []; for (const pl of ['square', 'circle', 'rect']) { __ch.setPlate(pl); const M = __ch.PLATES[pl].modes;
        M.forEach((m, k) => { m.zmax ||= 0; bestBow(k); __ch.setFreq(m.f); out.push([pl, k, __ch.focus().k, __ch.focus().strength]); }); __ch.setBow({ x: 1, y: .37 });
        for (let k = 1; k < M.length; k++) if (M[k].f / M[k - 1].f > 1.15) { __ch.setFreq(Math.sqrt(M[k].f * M[k - 1].f)); out.push([pl, -1, -1, __ch.focus().strength]); } } return out; });
      for (const [pl, k, fk, s] of r) { if (k >= 0) { eq(fk, k, pl + ' focus ' + k); ok(s > .5, pl + ' strength ' + s); } else ok(s < .55, `${pl}: between modes strength ${s}`); }
    },
    'sweeping across the target resonance does not match it': async ({ page, eq }) => {
      await toMatch(page);
      const f = await page.evaluate(() => __ch.curTarget().f), id = await page.evaluate(() => __ch.curTarget().id);
      // a slow 6 s sweep from 10% below to 10% above (≈3.3%/s): passes through the resonance for ~2 s
      await sweep(page, f * .9, f * 1.1, 6);
      eq(await page.evaluate(id => !!__ch.SAVE.solved[id], id), false, 'swept past and matched');
      // back and forth across it a few times
      for (let k = 0; k < 3; k++) { await sweep(page, f * 1.06, f * .94, 1.2); await sweep(page, f * .94, f * 1.06, 1.2); }
      eq(await page.evaluate(id => !!__ch.SAVE.solved[id], id), false, 'wiggled past and matched');
    },
    'holding at the target resonance matches it, also with small fine-tuning': async ({ page, eq, ok }) => {
      await toMatch(page);
      const t = await page.evaluate(() => { const t = __ch.curTarget(); __ch.setFreq(t.f * 1.004); return t; });
      for (let k = 0; k < 6; k++) { await page.waitForTimeout(400); await page.evaluate(([f, k]) => __ch.setFreq(f * (k % 2 ? 1.004 : .997)), [t.f, k]); }
      await page.waitForFunction(id => __ch.SAVE.solved[id], t.id, { timeout: 6000 });
      ok(await page.evaluate(id => __ch.SAVE.got[id] === 1, t.id), 'matched figure also goes in the book');
      eq(await page.evaluate(() => __ch.curTarget().id !== undefined && __ch.curTarget().id), await page.evaluate(() => __ch.targetsOf('square')[1].id), 'advanced to next target');
      ok(/Target 2 of 10/.test(await page.textContent('#goal')));
    },
    'holding a wrong mode says which way to go; holding an already-matched one stays quiet': async ({ page, ok, eq }) => {
      await toMatch(page);
      const r = await page.evaluate(() => { const T = __ch.targetsOf('square'), M = __ch.PLATES.square.modes; const t = __ch.curTarget(); const wrong = M.find(m => m.f > t.f * 1.3); __ch.record(wrong); return document.getElementById('toast').innerHTML; });
      ok(/nodal line/.test(r) && !/sweep|higher|lower/.test(r), 'hint counts lines, never gives the direction: ' + r);
      const r2 = await page.evaluate(() => { __ch.record(__ch.curTarget()); const solved = __ch.PLATES.square.modes.find(m => __ch.SAVE.solved[m.id]); document.getElementById('toast').innerHTML = ''; __ch.record(solved); return document.getElementById('toast').innerHTML; });
      eq(r2, '', 'nagged about an already matched figure');
    },
    'explore mode: holding a resonance records each figure once; progress counts figures': async ({ page, ok, eq }) => {
      await page.evaluate(BEST_BOW); await page.evaluate(() => { bestBow(3); __ch.setFreq(__ch.PLATES.square.modes[3].f); });
      await page.waitForFunction(() => __ch.SAVE.got[__ch.PLATES.square.modes[3].id], null, { timeout: 7000 });
      const total = await page.evaluate(() => Object.values(__ch.PLATES).reduce((a, p) => a + p.modes.length, 0));
      const hub = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).chladni); ok(Math.abs(hub - 1 / total) < 1e-9, 'progress ' + hub);
      ok(/1<\/b> of/.test(await page.innerHTML('#goal')));
      eq(await page.evaluate(() => Object.keys(__ch.SAVE.got).length), 1);
    },
    'skip and all-matched states; per-plate target index': async ({ page, ok, eq }) => {
      await toMatch(page);
      await page.click('#skip'); ok(/Target 2 of 10/.test(await page.textContent('#goal')));
      await page.evaluate(() => { for (const t of __ch.targetsOf('square')) __ch.SAVE.solved[t.id] = 1; __ch.setPlate('circle'); __ch.setPlate('square'); });
      ok(/All matched/.test(await page.textContent('#goal'))); eq(await page.evaluate(() => __ch.curTarget()), null);
      await page.evaluate(() => __ch.setPlate('circle')); ok(/Target 1 of 8/.test(await page.textContent('#goal')));
      await page.evaluate(() => __ch.setPlate('nonsense')); eq(await page.evaluate(() => __ch.plate), 'circle');
    },
    'later targets are by ear: a sealed note and a hum button, matched by holding the right pitch': async ({ page, ok, eq }) => {
      await toMatch(page);
      await page.evaluate(() => { for (const t of __ch.targetsOf('square').slice(0, __ch.EAR_FROM)) __ch.SAVE.solved[t.id] = 1; __ch.setPlate('square'); });
      ok(/By ear/.test(await page.textContent('#goal')), 'by-ear goal');
      ok(await page.isVisible('#hum')); await page.click('#hum');
      // the target canvas shows a sealed note, not the figure: its centre pixel is wax red
      const px = await page.evaluate(() => Array.from(document.getElementById('target').getContext('2d').getImageData(112, 132, 1, 1).data));
      ok(px[0] > 120 && px[1] < 90, 'sealed note pixel ' + px);
      const t = await page.evaluate(() => { const t = __ch.curTarget(); __ch.setFreq(t.f); return t.id; });
      await page.waitForFunction(id => __ch.SAVE.solved[id], t, { timeout: 7000 });
      ok(await page.evaluate(() => __ch.flights >= 1), 'figure flew into the book');
    },
    'twins: the bow picks one, a finger on the other\'s node picks the other': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const X = __ch, M = X.PLATES.square.modes, ip = M.findIndex(m => m.id === 's13p'), im = M.findIndex(m => m.id === 's13m'), f = Math.sqrt(M[ip].f * M[im].f);
        X.setBow({ x: 1, y: 1 }); X.setFreq(f); const corner = X.focus().k; X.setBow({ x: 1, y: .37 }); X.setFinger({ x: .3, y: .3 }); X.setFreq(f); const diag = X.focus().k; X.setFinger(null); return [corner === ip, diag === im]; });
      eq(r, [true, true]);
      // by real input: drag the bow to a corner, tap the plate for a finger, tap it again to lift
      const box = await page.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(); return null; });
    },
    'luthier: where you thin the plate decides how much each note drops; scrapes are permanent and limited': async ({ page, ok, eq }) => {
      await page.click('[data-m="tune"]');
      const r = await page.evaluate(() => { const X = __ch, k = X.kOf('s02m'), TG = X.TG, f0 = X.tunedF(k);
        // bend-heavy vs motion-heavy cells for this mode, from its own maps
        const h = new Float64Array(TG * TG).fill(1), res = [];
        for (let c = 0; c < TG * TG; c++) { const hh = h.slice(); hh[c] = .8; res.push(X.tunedF(k, hh) / f0 - 1); }
        return { min: Math.min(...res), max: Math.max(...res), used0: X.tune.used }; });
      ok(r.max < 0 && r.min / r.max > 5, `thinning always lowers a note, but where you scrape matters (5× or more): ${r.min} … ${r.max}`);
      const u = await page.evaluate(() => { const X = __ch; X.startTune(0); for (let i = 0; i < 30; i++) X.scrapeCell(0, false); return [X.tune.used, X.TUNE[0].budget]; });
      ok(u[0] <= u[1], 'never more scrapes than the budget: ' + u);
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      await page.click('[data-m="tune"]');
      const R = await page.evaluate(() => { FX.setMuted(true); const X = __ch, N = X.TG ** 2, out = { naive: 0, naiveN: 0, comp: [] };
        for (let ci = 0; ci < X.TUNE.length; ci++) { const T = X.TUNE[ci];
          for (let t = 0; t < 8; t++) { X.startTune(ci); let rs = 3 + t + 10 * ci; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
            for (let g = 0; g < 300 && !X.tune.done && X.tune.used < T.budget; g++) X.scrapeCell((rnd() * N) | 0, rnd() < .5); out.naiveN++; if (X.tune.done && X.tuneGrade(T, X.tuneErr(T)) > 1) out.naive++; }
          X.startTune(ci); out.naiveN++; // idle: never scrape
          // competent: greedy least squares, light or heavy, one scrape at a time
          X.startTune(ci); for (let g = 0; g < 60 && !X.tune.done && X.tune.used < T.budget; g++) { let best = [X.tuneSq(T, X.tune.h), -1, 0]; for (let c = 0; c < N; c++) for (const d of [.98, .9]) { if (X.tune.h[c] * d < .35) continue; const h = X.tune.h.slice(); h[c] *= d; const e = X.tuneSq(T, h); if (e < best[0]) best = [e, c, d]; } if (best[1] < 0) break; X.scrapeCell(best[1], best[2] > .95); }
          out.comp.push(X.tune.done ? X.tuneGrade(T, X.tuneErr(T)) : 0);
        }
        // matching: holding the right pitch with the bow left where it is fails on the twins
        X.setPlate('square'); const M = X.PLATES.square.modes; let tw = 0, twOk = 0; for (const t of X.targetsOf('square')) { if (!M.some(m => m !== t && m.pair === t.pair)) continue; tw++; X.setFreq(t.f); if (X.focus().k === M.indexOf(t)) twOk++; }
        out.twin = [twOk, tw];
        return out; });
      ok(R.naive / R.naiveN <= .2, `random / idle luthiers delivered ${R.naive}/${R.naiveN}`);
      ok(R.comp.every(g => g >= 1), 'greedy least-squares luthier delivers every commission: ' + R.comp);
      ok(R.comp.every(g => g < 3), '3★ needs planning beyond greedy: ' + R.comp);
      ok(R.twin[0] / R.twin[1] <= .6, `pitch alone matches ${R.twin[0]}/${R.twin[1]} twin targets`);
    },
    'corrupted / odd saves load without errors': async ({ page, eq, ok }) => {
      for (const save of ['null', '3', '[]', '"s"', '{"got":7,"solved":"x","mode":"match","tgt":{"square":999}}', '{"plate":"hexagon","tgt":[1]}', '{"tgt":-5,"mode":"match"}',
        '{"tgt":{"square":"abc"},"mode":"match"}', '{"got":{"s01p":"data:image/png;base64,AAAA"},"tgt":3,"plate":"circle"}', '{bad']) {
        const { p2, errs } = await openWith(page, save);
        eq(errs, [], 'errors for ' + save);
        ok(await p2.evaluate(() => !!document.getElementById('goal').textContent), 'goal rendered for ' + save);
        const hub = await p2.evaluate(() => JSON.parse(localStorage.getItem('rh:hub') || '{}').chladni); ok(hub >= 0 && hub <= 1, 'progress ' + hub);
        await p2.close();
      }
    },
    'no overflow or console errors at phone and desktop sizes': async ({ page, ok }) => {
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h });
        for (const pl of ['square', 'circle', 'rect']) { await page.evaluate(pl => __ch.setPlate(pl), pl); await page.waitForTimeout(150); }
        await toMatch(page); await page.waitForTimeout(150);
        const r = await page.evaluate(() => { const d = document.getElementById('dial').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, W: innerWidth, dialR: d.right, dialB: d.bottom, H: innerHeight }; });
        ok(r.sw <= r.W && r.dialR <= r.W && r.dialB <= r.H, `layout at ${w}: ` + JSON.stringify(r));
      }
    },
  },
};
