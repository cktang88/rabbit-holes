// Every experiment on a phone (390x844) and a small landscape phone (844x390):
//  - no sideways page scroll
//  - the main play surface (largest canvas, or the element marked [data-play]) is at least 45% of the screen area visible,
//    and at most 35% of it is covered by fixed/absolute UI (panels, HUDs, toasts)
//  - buttons are at least 28px in their smaller dimension
const fs = require('fs'), path = require('path');
const GAMES = fs.readdirSync(path.join(__dirname, '..')).filter(d => fs.existsSync(path.join(__dirname, '..', d, 'index.html')) && d !== 'shared');
const measure = () => {
  document.querySelectorAll('.modal-bg').forEach(m => m.remove());
  const W = innerWidth, H = innerHeight;
  const cands = [...document.querySelectorAll('[data-play], canvas')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 50 && r.height > 50 && getComputedStyle(e).visibility !== 'hidden'; });
  const vis = e => { const r = e.getBoundingClientRect(); return Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)); };
  const play = document.querySelector('[data-play]') || cands.sort((a, b) => vis(b) - vis(a))[0];
  const res = { hscroll: document.documentElement.scrollWidth > W + 2, play: 0, covered: 0, small: [] };
  if (play) {
    const r = play.getBoundingClientRect(); res.play = vis(play) / (W * H);
    // sample a grid over the visible play rect and count points where something else is on top
    let n = 0, hit = 0;
    for (let x = Math.max(r.left, 0) + 6; x < Math.min(r.right, W) - 4; x += 18) for (let y = Math.max(r.top, 0) + 6; y < Math.min(r.bottom, H) - 4; y += 18) {
      n++; const el = document.elementFromPoint(x, y); if (el && el !== play && !play.contains(el) && !(el.tagName === 'CANVAS' && el.parentElement === play.parentElement)) hit++;
    }
    res.covered = n ? hit / n : 0;
  }
  res.small = [...document.querySelectorAll('button, [role=button], select, input[type=range]')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.top < H && Math.min(r.width, r.height) < 28; }).map(b => (b.textContent || b.title || b.className || b.tagName).trim().slice(0, 14)).slice(0, 6);
  return res;
};
const tests = {};
for (const g of GAMES) for (const [label, vp] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
  tests[`${g} ${label}`] = async ({ page, ok }) => {
    await page.setViewportSize(vp); await page.goto(new URL(g + '/index.html', page.url()).href); await page.waitForTimeout(1500);
    const m = await page.evaluate(measure);
    const probs = [];
    if (m.hscroll) probs.push('page scrolls sideways');
    if (m.play < .45) probs.push(`play surface only ${(m.play * 100) | 0}% of screen`);
    if (m.covered > .35) probs.push(`UI covers ${(m.covered * 100) | 0}% of play surface`);
    if (m.small.length > 3) probs.push(`tiny buttons: ${m.small.join(' | ')}`);
    ok(!probs.length, probs.join('; '));
  };
}
module.exports = { page: 'index.html', tests, allowPageErrors: true };
