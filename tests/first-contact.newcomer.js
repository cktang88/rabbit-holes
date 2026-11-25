// A scripted newcomer: knows nothing about the language. It reads only the GOAL bar, the highlighted frames and the pictures,
// and does what they say. Counting dots = counting the circles drawn in a picture (boxes are bundles of the base).
// newcomer(p, tap, upTo): plays the tutorial transmission, then (upTo >= 2) the arithmetic one. Returns the number of actions.
async function newcomer(p, tap, upTo = 1) {
  const dots = loc => loc.locator('svg circle').count();
  const S = expr => p.evaluate(expr);
  const closeLex = async () => { if (await S(() => document.body.classList.contains('lex'))) await tap(p.locator('#nbClose')); };
  const pencil = async (w, text) => { const inp = p.locator(`.nbRow[data-w="${w}"] input`); await inp.fill(text); await inp.press('Enter'); await closeLex(); };
  const chart = async (q, n) => { await tap(q.locator(`.chart [data-num="${n}"]`)); await p.waitForTimeout(120); };
  // the dots after the arrow in an arithmetic picture are the result
  const resultDots = q => q.locator('.qpic svg circle').evaluateAll(cs => cs.filter(c => +c.getAttribute('cx') >= 120).length);
  let actions = 0;
  for (let guard = 0; guard < 60 && await S(() => window.__fc.tutOn()); guard++) {
    const st = await S(() => window.__fc.S.tut); actions++;
    if (st !== 1) await closeLex(); // a person closes the lexicon before tapping the printout again
    if (st === 0) { await tap(p.locator('#feed .tx.coach .sentence .g').first()); continue; }
    if (st === 1 || st === 2) { const f = p.locator('#feed .tx.coach').first(); await f.scrollIntoViewIfNeeded(); const n = await dots(f.locator('.pic')); const gl = f.locator('.sentence .g').first();
      if (st === 2) { await tap(gl); } await pencil(await gl.getAttribute('data-w'), String(n)); continue; }
    if (st === 3) { await tap(p.locator('#coachBtn')); continue; }
    const q = p.locator('#feed .q.coach').first(); await q.scrollIntoViewIfNeeded();
    if (st === 6) { // "which number first needs two symbols?": the first counting frame with two symbols
      const n = await S(() => [...document.querySelectorAll('#feed .tx')].findIndex(t => t.querySelectorAll('.sentence .g').length === 2)); await chart(q, n); continue; }
    const b = await S(() => window.__fc.LANG.base), boxes = await q.locator('.qpic svg rect').count(), all = await dots(q.locator('.qpic'));
    await chart(q, all); // bundles and loose dots together are just the number of dots
  }
  if (upTo < 2) return { actions };
  // transmission 2: the goal bar sends us on; each reply has a dot picture
  await tap(p.locator('#nextCh')); actions++; await p.waitForTimeout(300);
  for (let k = 0; k < 3; k++) {
    const q = p.locator(`#feed .q[data-q="${k}"]`); await q.scrollIntoViewIfNeeded(); actions++;
    if (await q.locator('.chart').count()) { await chart(q, await resultDots(q)); continue; }
    // a yes/no reply: learn which end-mark means "wrong" from the frame whose sum disagrees with its picture
    const verdict = await S(() => { const fc = window.__fc, names = Object.fromEntries(Object.entries(fc.S.notes).map(([w, v]) => [w, +v])), b = fc.LANG.base;
      const value = ws => { let v = 0; for (const w of ws) v = v * b + names[w]; return v; };
      const trailing = ws => { const out = []; for (let i = ws.length - 1; i >= 0 && ws[i] in names; i--) out.unshift(ws[i]); return out; };
      const marks = {}; [...document.querySelectorAll('#feed .tx')].forEach(t => { const pic = t.querySelector('.pic svg'); if (!pic) return; const res = [...pic.querySelectorAll('circle')].filter(c => +c.getAttribute('cx') >= 120).length;
        const ws = [...t.querySelectorAll('.sentence .g')].map(e => e.dataset.w), mark = ws[ws.length - 1], said = value(trailing(ws.slice(0, -1))); marks[res === said ? 'yes' : 'no'] = mark; });
      return marks; });
    const truth = await resultDots(q);
    const said = await q.evaluate((el, notes) => { const ws = [...el.querySelectorAll(':scope > .sentence .g')].map(e => e.dataset.w); const names = Object.fromEntries(Object.entries(notes).map(([w, v]) => [w, +v])); const b = window.__fc.LANG.base; const out = []; for (let i = ws.length - 1; i >= 0 && ws[i] in names; i--) out.unshift(ws[i]); return out.reduce((v, w) => v * b + names[w], 0); }, await S(() => window.__fc.S.notes));
    await tap(q.locator(`[data-pw="${truth === said ? verdict.yes : verdict.no}"]`)); await tap(q.locator('[data-send]')); actions += 2; await p.waitForTimeout(150);
  }
  return { actions };
}
module.exports = { newcomer };
