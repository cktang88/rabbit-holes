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
      for (const [id, c] of signs) ok(c === 2 * +id[1] || Math.abs(c - 2 * +id[1]) <= 1 && false || c === 2 * +id[1], `${id}: ${c} sign changes`);
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
      const r = await page.evaluate(() => Object.entries(__ch.PLATES).map(([k, p]) => [k, p.modes.map(m => m.f), __ch.targetsOf(k).map(m => m.id)]));
      for (const [k, fs, T] of r) {
        ok(fs.length >= 12, k + ' modes ' + fs.length);
        for (let i = 1; i < fs.length; i++) ok(fs[i] / fs[i - 1] > 1.022, `${k} modes ${i - 1},${i} too close`);
        ok(fs[0] > 44 && fs[fs.length - 1] < 4200 * .92, k + ' range');
        eq(T.length, 10, k + ' targets'); eq(new Set(T).size, 10);
      }
    },
    'resonance: driving at a mode frequency focuses that mode at full strength; between modes it is weak': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const out = []; for (const pl of ['square', 'circle', 'rect']) { __ch.setPlate(pl); const M = __ch.PLATES[pl].modes;
        M.forEach((m, k) => { __ch.setFreq(m.f); out.push([pl, k, __ch.focus().k, __ch.focus().strength]); });
        for (let k = 1; k < M.length; k++) { __ch.setFreq(Math.sqrt(M[k].f * M[k - 1].f)); out.push([pl, -1, -1, __ch.focus().strength]); } } return out; });
      for (const [pl, k, fk, s] of r) { if (k >= 0) { eq(fk, k, pl + ' focus'); ok(s === 1, pl + ' strength ' + s); } else ok(s < .55, `${pl}: between modes strength ${s}`); }
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
      for (let k = 0; k < 6; k++) { await page.waitForTimeout(400); await page.evaluate(f => __ch.setFreq(f * (k % 2 ? 1.004 : .997)), t.f); }
      await page.waitForFunction(id => __ch.SAVE.solved[id], t.id, { timeout: 6000 });
      ok(await page.evaluate(id => __ch.SAVE.got[id] === 1, t.id), 'matched figure also goes in the book');
      eq(await page.evaluate(() => __ch.curTarget().id !== undefined && __ch.curTarget().id), await page.evaluate(() => __ch.targetsOf('square')[1].id), 'advanced to next target');
      ok(/Target 2 of 10/.test(await page.textContent('#goal')));
    },
    'holding a wrong mode says which way to go; holding an already-matched one stays quiet': async ({ page, ok, eq }) => {
      await toMatch(page);
      const r = await page.evaluate(() => { const T = __ch.targetsOf('square'), M = __ch.PLATES.square.modes; const t = __ch.curTarget(); const wrong = M.find(m => m.f > t.f * 1.3); __ch.record(wrong); return document.getElementById('toast').innerHTML; });
      ok(/lower/.test(r), 'hint says lower: ' + r);
      const r2 = await page.evaluate(() => { __ch.record(__ch.curTarget()); const solved = __ch.PLATES.square.modes.find(m => __ch.SAVE.solved[m.id]); document.getElementById('toast').innerHTML = ''; __ch.record(solved); return document.getElementById('toast').innerHTML; });
      eq(r2, '', 'nagged about an already matched figure');
    },
    'explore mode: holding a resonance records each figure once; progress counts figures': async ({ page, ok, eq }) => {
      const m = await page.evaluate(() => __ch.PLATES.square.modes[3]);
      await page.evaluate(() => __ch.setFreq(__ch.PLATES.square.modes[3].f));
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
      await page.evaluate(() => __ch.setPlate('circle')); ok(/Target 1 of 10/.test(await page.textContent('#goal')));
      await page.evaluate(() => __ch.setPlate('nonsense')); eq(await page.evaluate(() => __ch.plate), 'circle');
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
