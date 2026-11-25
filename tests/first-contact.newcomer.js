// A scripted newcomer: knows nothing about the language, reads only the GOAL bar, the highlighted frames and the pictures,
// and does what it says. Counting dots = counting the circles drawn in a picture. Returns the number of actions it took.
async function newcomer(p, tap) {
  const goal = () => p.locator('#goal').textContent();
  const dots = loc => loc.locator('svg circle').count();
  const isTut = () => p.evaluate(() => window.__fc.tutOn());
  const step = () => p.evaluate(() => window.__fc.S.tut);
  const closeLex = async () => { if (await p.evaluate(() => document.body.classList.contains('lex'))) await tap(p.locator('#nbClose')); };
  const pencil = async (w, text) => { const inp = p.locator(`.nbRow[data-w="${w}"] input`); await inp.fill(text); await inp.press('Enter'); await closeLex(); };
  let actions = 0;
  for (let guard = 0; guard < 80 && await isTut(); guard++) {
    const st = await step(); const g = await goal(); actions++;
    if (st === 0) { await tap(p.locator('#feed .tx.coach .sentence .g').first()); continue; }
    if (st === 1) { const f = p.locator('#feed .tx.coach').first(); const n = await dots(f.locator('.pic')); const w = await f.locator('.sentence .g').first().getAttribute('data-w'); await pencil(w, String(n)); continue; }
    if (st === 2) { const f = p.locator('#feed .tx.coach').first(); await f.scrollIntoViewIfNeeded(); const n = await dots(f.locator('.pic')); const gl = f.locator('.sentence .g').first(); await tap(gl); await pencil(await gl.getAttribute('data-w'), String(n)); continue; }
    if (st === 3) { await tap(p.locator('#coachBtn')); continue; }
    // replies: count bundles (boxes) and loose dots in the question picture, then spell it with the symbols it has named
    const q = p.locator('#feed .q.coach').first(); await q.scrollIntoViewIfNeeded();
    const names = await p.evaluate(() => Object.fromEntries(Object.entries(window.__fc.S.notes).map(([w, v]) => [v, w])));
    let digits;
    if (st === 6) { // "which number first needs two symbols?": copy the first frame that shows two symbols
      digits = await p.evaluate(() => { const f = [...document.querySelectorAll('#feed .tx')].find(t => t.querySelectorAll('.sentence .g').length === 2); return [...f.querySelectorAll('.sentence .g')].map(e => e.dataset.w); });
    } else {
      const boxes = await q.locator('.qpic svg rect').count(), loose = await dots(q.locator('.qpic')) - boxes * Number(Object.keys(names).length);
      digits = (boxes ? [names[String(boxes)]] : []).concat([names[String(loose)]]);
    }
    for (const w of digits) { await tap(q.locator(`[data-pw="${w}"]`)); actions++; }
    await tap(q.locator('[data-send]'));
    await p.waitForTimeout(150);
  }
  return { actions, done: await p.evaluate(() => [0, 1, 2].every(k => window.__fc.S.solved['0:' + k])), tut: await step() };
}
module.exports = { newcomer };
