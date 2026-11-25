// Marbler: ink on a marbling bath, moved by exact, invertible maps of slow Stokes flow (after Jaffer & Lu).
// The maths: determinism, exact un-mixing, commissions solvable and random strokes failing, daily sheets, share links.
// The renderer: the WebGL2 shader agrees with the CPU maths and is deterministic. Phones: taps and strokes land under
// the finger on the turned trough, a pinch zooms without inking. Speed: per-frame cost and the adaptive resolution.
// Headless browsers render WebGL in software, so these tests keep canvases small.
const ready = async (page) => { await page.waitForFunction(() => window.__mb && window.__mb.COM); await page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); window.__mb.paused = true; }); };
module.exports = {
  page: 'marbler/index.html',
  viewport: { width: 640, height: 420 },
  ready,
  tests: {
    'the bath is deterministic: the same moves give the same sheet; daily sheets depend only on the date': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const M = window.__mb.MB; const c = M.COMMISSIONS.find(c => c.id === 'peacock'); const ops = c.ground.concat(c.recipe);
        const a = Array.from(M.sample(ops)).join(''), b = Array.from(M.sample(ops)).join('');
        const d1 = JSON.stringify(M.daily('2026-11-25')), d2 = JSON.stringify(M.daily('2026-11-25')), d3 = JSON.stringify(M.daily('2026-11-26'));
        return { same: a === b, d: d1 === d2, diff: d1 !== d3, inked: Array.from(M.sample(ops)).filter(v => v >= 0).length }; });
      ok(r.same, 'same moves, same sheet'); ok(r.d && r.diff, 'daily stable per date and different across dates'); ok(r.inked > 9000, 'the peacock ground covers the bath: ' + r.inked);
    },
    'raking backwards un-mixes exactly: every point returns to where it started': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const M = window.__mb.MB; const g = M.stripesGround([0, 2, 1, 3]);
        const s = [['k', 300, 200, 0], ['w', 287.5, 200, 6], ['o', 300, 200, -1], ['c', 137.5, 62.5, 3], ['s', 412.5, 150, 21], ['o', 150, 100, 1]];
        const inv = s.slice().reverse().map(M.inverseOf); const a = M.sample(g), b = M.sample(g.concat(s, inv)), mixed = M.sample(g.concat(s));
        // trace single points back through the moves and their inverses
        let worst = 0; const R = M.rng('pts'); for (let k = 0; k < 400; k++) { let x = R() * 600, y = R() * 400; const x0 = x, y0 = y; for (const op of s.concat(inv).reverse()) { const q = M.back(op, x, y); x = q[0]; y = q[1]; } worst = Math.max(worst, Math.hypot(x - x0, y - y0)); }
        return { likeBack: M.likeness(a, b), likeMixed: M.likeness(a, mixed), worst }; });
      eq(r.likeBack, 1, 'the un-mixed bath is the ground again'); ok(r.likeMixed < .6, 'while mixed it was far from it: ' + r.likeMixed); ok(r.worst < 1e-9, 'points return to within ' + r.worst);
    },
    'every commission is solvable by its recipe; the bare ground and random strokes fail': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const M = window.__mb.MB, R = M.rng('random-strokes'); return M.COMMISSIONS.map(c => {
        if (c.judge === 'cover') { const ops = M.stoneGround([0, 1, 2], 'cover', 120); return { id: c.id, sol: M.judge(c, ops).ok, bare: M.judge(c, []).ok, rnd: 0 }; }
        const t = M.sample(M.targetOps(c)); let rp = 0; for (let k = 0; k < 8; k++) { const ops = c.ground.slice(); for (let i = 0; i < c.recipe.length; i++) { const code = 'sckwo'[Math.floor(R() * 5)]; ops.push(code === 'o' ? ['o', M.snapPos(100 + R() * 400), M.snapPos(80 + R() * 240), R() < .5 ? 1 : -1] : [code, M.snapPos(R() * 600), M.snapPos(R() * 400), Math.floor(R() * 24)]); } if (M.judge(c, ops, t).ok) rp++; }
        return { id: c.id, sol: M.judge(c, c.ground.concat(c.recipe), t).ok, bare: M.judge(c, c.ground, t).ok, rnd: rp }; }); });
      for (const c of r) { ok(c.sol, c.id + ' recipe passes'); ok(!c.bare, c.id + ' untouched fails'); ok(c.rnd === 0, c.id + ' random strokes passed ' + c.rnd + '/8'); }
    },
    'the WebGL2 shader agrees with the CPU maths and renders deterministically': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const g = window.__mb, gl = g.gl, M = g.MB; const c = M.COMMISSIONS.find(c => c.id === 'nonpareil'); const ops = c.ground.concat(c.recipe);
        const W = 300, H = 200, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.HALF_FLOAT, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        const read = () => { g.uploadOps(ops); g.inkPass({ fb, w: W, h: H }, [0, H, W / 600, H], ops.length, 1, 0, false); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); const px = new Float32Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return px; };
        const a = read(), b = read(); let same = true; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
        const dens = (rgb) => rgb.map(v => -Math.log(Math.max(.02, v)) * .25); const cand = M.INKS.map(i => dens(i[1])).concat([dens(M.BATH)]);
        let agree = 0, n = 0; for (let j = 5; j < H; j += 13) for (let i = 5; i < W; i += 13) { const o = 4 * (j * W + i), px = [a[o], a[o + 1], a[o + 2]]; let best = -1, bd = 1e9; cand.forEach((cc, k) => { const d = Math.hypot(cc[0] - px[0], cc[1] - px[1], cc[2] - px[2]); if (d < bd) { bd = d; best = k; } });
          const gpu = best === M.INKS.length ? -1 : best; const cpu = M.inkAt(ops, (i + .5) * 600 / W, (H - j - .5) * 400 / H); n++; if (gpu === cpu) agree++; }
        return { same, agree: agree / n, n }; });
      ok(r.same, 'two renders are bit-identical'); ok(r.agree > .95, `GPU and CPU agree on ${(r.agree * 100).toFixed(1)}% of ${r.n} points`);
    },
    'share links round-trip exactly, and the sheet lives in the address bar': async ({ page, eq }) => {
      const a = await page.evaluate(() => { const g = window.__mb, M = g.MB; const c = M.COMMISSIONS.find(c => c.id === 'bouquet'); g.open(c, c.recipe.concat([['d', 123.45, 67.8, 20, 3], ['b', 300, 100, 3, 9, 1]])); const code = M.encode(c.id, g.ops); const m = M.decode(code); return { code, ok: JSON.stringify(m.ops) === JSON.stringify(g.ops), id: m.id, ops: g.ops }; });
      eq(a.ok, true); eq(a.id, 'bouquet');
      await page.goto('about:blank'); await page.goto('http://localhost:8765/marbler/index.html#s=' + a.code); await ready(page);
      const b = await page.evaluate(() => ({ id: window.__mb.COM.id, ops: window.__mb.ops })); eq(b.id, 'bouquet'); eq(b.ops, a.ops);
      eq(await page.evaluate(() => [window.__mb.MB.decode('%%%'), window.__mb.MB.decode(btoa('x;9:1:2'))?.ops.length]), [null, 0]);
    },
    'laying the paper judges the sheet, records the best, saves it and opens the next commission': async ({ page, ok, eq }) => {
      const r = await page.evaluate(async () => { const g = window.__mb, M = g.MB; const c = M.COMMISSIONS.find(c => c.id === 'line'); g.open(c, c.recipe); const open0 = g.comOpen(3);
        g.afterPeel(); await new Promise(r => setTimeout(r, 50)); const txt = document.querySelector('.modal')?.textContent || ''; document.querySelectorAll('.modal-bg').forEach(m => m.remove());
        return { txt, best: g.SAVE.best.line, done: g.SAVE.done.line, sheets: g.SAVE.sheets.length, open0, open1: g.comOpen(3), tools: g.unlocked().tools }; });
      ok(/100% alike in 1 strokes|in <b>1/.test(r.txt) || r.txt.includes('1 strokes') || r.txt.includes('100%'), r.txt.slice(0, 80)); eq(r.best, 1); ok(r.done >= .99); eq(r.sheets, 1); eq([r.open0, r.open1], [false, true]); ok(r.tools.includes('rake'), 'the next tools unlock: ' + r.tools);
    },
    'save export and import round-trip; junk is cleaned': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const g = window.__mb; const s = g.cleanSave({ done: { line: 1, nope: 1 }, best: { line: 3, 'daily:2026-11-25': 4, x: 1 }, sheets: ['abc', 5], daily: { '2026-11-25': '90% in 4', bad: 1 } });
        const back = g.cleanSave(JSON.parse(JSON.stringify(s))); return { s, same: JSON.stringify(s) === JSON.stringify(back) }; });
      eq(r.s.done, { line: 1 }); eq(r.s.best, { line: 3, 'daily:2026-11-25': 4 }); eq(r.s.sheets, ['abc']); eq(r.s.daily, { '2026-11-25': '90% in 4' }); eq(r.same, true);
    },
    'mobile: the trough turns to fill a tall screen; a drop and a stroke land under the finger when zoomed; a pinch inks nothing': async ({ page, ok, eq, near }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
      const r = await page.evaluate(async () => { const g = window.__mb; g.open(g.freeBath()); g.renderNow(1); const rot = g.ROT; g.cam.zoomAt(195, 420, 1.8); const cv = document.getElementById('gl');
        const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1, button: 0, buttons: 1 }));
        g.tool = 'drop'; const want = g.toW(200, 400); ev('pointerdown', 1, 200, 400); ev('pointerup', 1, 200, 400); const drop = g.ops[g.ops.length - 1].slice();
        g.tool = 'stylus'; ev('pointerdown', 2, 150, 300); for (let k = 1; k <= 8; k++) ev('pointermove', 2, 150, 300 + k * 25); ev('pointerup', 2, 150, 500); const st = g.ops[g.ops.length - 1].slice(); const ws = g.toW(150, 300), we = g.toW(150, 500);
        const n0 = g.ops.length, k0 = g.cam.k; ev('pointerdown', 3, 150, 400); ev('pointerdown', 4, 250, 400); ev('pointermove', 3, 100, 400); ev('pointermove', 4, 300, 400); await new Promise(r => setTimeout(r, 60)); ev('pointerup', 3, 100, 400); ev('pointerup', 4, 300, 400);
        return { rot, want, drop, st, ws, we, n0, n1: g.ops.length, k0, k1: g.cam.k, sw: document.documentElement.scrollWidth }; });
      eq(r.rot, true, 'turned for a tall screen'); near(r.drop[1], r.want[0], 1, 'drop x'); near(r.drop[2], r.want[1], 1, 'drop y');
      eq(r.st[0], 's'); const ang = Math.atan2(r.we[1] - r.ws[1], r.we[0] - r.ws[0]); near(r.st[3] * Math.PI / 12, ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), .14, 'stroke direction follows the finger on the turned trough');
      eq(r.n1, r.n0, 'a pinch inks nothing'); ok(r.k1 > r.k0 * 1.2, 'and zooms'); ok(r.sw <= 390, 'no sideways scroll');
    },
    'speed: a frame costs little on the main thread, and the resolution adapts when frames run slow': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const g = window.__mb, M = g.MB; const c = M.COMMISSIONS.find(c => c.id === 'peacock'); g.open(c, c.recipe); g.settle(); g.renderNow(9); g.gl.finish();
        const t0 = performance.now(); for (let i = 0; i < 20; i++) g.renderNow(1); const cpu = (performance.now() - t0) / 20;
        // simulate a slow phone: feed long frames to the loop and watch it lower its resolution
        g.paused = false; const s0 = g.dprScale; let t = performance.now(); for (let i = 0; i < 80; i++) { t += 40; g.frameNow(t); } g.paused = true; return { cpu, s0, s1: g.dprScale, ops: g.ops.length }; });
      ok(r.cpu < 25, `a converged frame took ${r.cpu.toFixed(1)} ms including software GL (budget 25 ms here; ${r.ops} moves)`); ok(r.s1 < r.s0, `slow frames lower the resolution: ${r.s0} → ${r.s1.toFixed(2)}`);
    },
  },
};
