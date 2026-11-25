// shared/panzoom.js: fit, cursor-anchored zoom, limits, pinch, empty-space drag pan, buttons, resize behaviour.
module.exports = {
  page: 'tests/fixtures/panzoom.html',
  tests: {
    'fit frames the world and toWorld/toScreen are inverse': async ({ page, near }) => {
      const r = await page.evaluate(() => { const [sx, sy] = cam.toScreen(50, 25); return { k: cam.k, sx, sy, back: cam.toWorld(sx, sy) }; });
      near(r.k, 4, 1e-6); near(r.sx, 200, 1e-6); near(r.sy, 150, 1e-6); near(r.back[0], 50, 1e-6); near(r.back[1], 25, 1e-6);
    },
    'zoom keeps the point under the cursor fixed and respects limits': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => { cam.fit(); const before = cam.toWorld(100, 80); cam.zoomAt(100, 80, 2); const after = cam.toWorld(100, 80);
        for (let i = 0; i < 50; i++) cam.zoomAt(100, 80, 2); const kmax = cam.k; for (let i = 0; i < 80; i++) cam.zoomAt(100, 80, .5); return { before, after, kmax, kmin: cam.k, base: cam.base }; });
      near(r.after[0], r.before[0], 1e-6); near(r.after[1], r.before[1], 1e-6); near(r.kmax, r.base * 12, 1e-6); near(r.kmin, r.base * .25, 1e-6);
    },
    'wheel zooms, mouse drag on empty space pans, drag elsewhere does not': async ({ page, ok, near }) => {
      await page.evaluate(() => cam.fit()); const k0 = await page.evaluate(() => cam.k);
      await page.mouse.move(100, 100); await page.mouse.wheel(0, -200); await page.waitForTimeout(50);
      ok(await page.evaluate(() => cam.k) > k0, 'wheel up zooms in');
      const x0 = await page.evaluate(() => cam.x); await page.mouse.move(100, 100); await page.mouse.down(); await page.mouse.move(140, 100, { steps: 4 }); await page.mouse.up();
      near(await page.evaluate(() => cam.x) - x0, 40, 1.5, 'empty-space drag pans');
      const x1 = await page.evaluate(() => cam.x); await page.mouse.move(300, 100); await page.mouse.down(); await page.mouse.move(340, 100, { steps: 4 }); await page.mouse.up();
      near(await page.evaluate(() => cam.x), x1, 1e-6, 'drag on content does not pan');
    },
    'two-finger pinch zooms around the midpoint': async ({ page, ok }) => {
      const r = await page.evaluate(() => { cam.fit(); const el = document.getElementById('cv'), k0 = cam.k, mid = cam.toWorld(300, 150);
        const ev = (t, id, x, y) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
        ev('pointerdown', 1, 280, 150); ev('pointerdown', 2, 320, 150); const g = cam.gesturing; ev('pointermove', 1, 260, 150); ev('pointermove', 2, 340, 150); ev('pointerup', 1, 260, 150); ev('pointerup', 2, 340, 150);
        const m2 = cam.toWorld(300, 150); return { ratio: cam.k / k0, g, drift: Math.hypot(m2[0] - mid[0], m2[1] - mid[1]) }; });
      ok(r.g, 'gesturing during pinch'); ok(r.ratio > 1.8 && r.ratio < 2.2, 'pinch to twice the distance doubles zoom: ' + r.ratio); ok(r.drift < .5, 'midpoint stays put: ' + r.drift);
    },
    'buttons zoom and fit; resizes refit only until the player moves the view': async ({ page, near, ok }) => {
      await page.evaluate(() => cam.fit()); const k0 = await page.evaluate(() => cam.k);
      await page.click('.pz-in'); ok(await page.evaluate(() => cam.k) > k0 * 1.3, '+ zooms in'); await page.click('.pz-fit'); await page.waitForTimeout(400);
      near(await page.evaluate(() => cam.k), k0, 1e-6, 'fit restores');
      await page.evaluate(() => { const c = document.getElementById('cv'); c.style.width = '200px'; }); await page.waitForTimeout(100);
      near(await page.evaluate(() => cam.k), 2, 1e-6, 'untouched view refits on resize');
      await page.evaluate(() => { cam.zoomAt(50, 50, 1.5); document.getElementById('cv').style.width = '400px'; }); await page.waitForTimeout(100);
      near(await page.evaluate(() => cam.k), 3, 1e-6, 'a moved view is kept on resize');
    },
  },
};
