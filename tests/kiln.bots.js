// Kiln potter bots. They see what a player sees: the client's target (colour swatch, surface, crackle/crystal words),
// the shelf of materials they have, and the likeness each fired test tile scores. None of them reads the commission's ref.
//  - naive: fire the bench as it starts (or the client's recipe), on the starting schedule
//  - random: a handful of random jars in random amounts, on a random schedule
//  - competent: a potter's rules of thumb pick a starting glaze from the target's look (dark -> saturated iron in reduction,
//    pale blue-green -> a little iron in reduction, red -> copper with tin in reduction, crystals -> zinc frit glaze with a
//    hold...), then it adjusts one thing at a time, keeping whatever scores better. Every try costs a test tile.
module.exports.botSrc = `
(K => {
  const lab = h => K.lab(K.hex2lin(h));
  function seed(c, U) {
    const T = c.T, L = lab(T.col), C = Math.hypot(L[1], L[2]), h = Math.atan2(L[2], L[1]), has = m => U.mats.includes(m);
    const lowFire = K.BODIES[c.body].max < 1200;
    let r = { feldspar: 40, silica: 30, whiting: 20, kaolin: 10 }, s = { peak: 1285, ramp: 100, hold: 15, cool: 400, xt: 0, xh: 0, atm: 'ox' }, app = 1;
    if (c.start) r = { ...c.start };
    if (T.craze === 'want' && has('neph')) r = { neph: 50, silica: 15, whiting: 15, kaolin: 20 };
    if (lowFire && has('fritS')) { r = { fritS: 55, kaolin: 12, silica: 15 }; if (has('fritB')) r.fritB = 15; if (has('lithium')) r.lithium = 3; s = { ...s, peak: 1080, ramp: 150 }; }
    if (T.crys && has('zinc')) { r = { fritS: 50, zinc: 25, silica: 20 }; if (has('titanium')) r.titanium = 5; s = { ...s, peak: 1250, ramp: 150, hold: 10, xt: T.crys.r > 5 ? 1100 : 1040, xh: 3 }; }
    if (T.gloss < .45 && !T.crys) { r.kaolin = (r.kaolin || 0) + 12; r.silica = Math.max(0, (r.silica || 0) - 12); r.whiting = (r.whiting || 0) + 6; s.cool = 90; }
    const red = U.gas;
    if (T.oil) { r.iron = 9; s = { ...s, peak: 1300, hold: 0, ramp: 150, atm: red ? 'red' : 'ox' }; }
    else if (T.fur) { r.iron = 9; s = { ...s, peak: 1300, hold: 30, atm: red ? 'red' : 'ox' }; app = 1.2; }
    else if (L[0] < 22 && has('iron')) { r.iron = 9; if (red) s.atm = 'red'; }
    else if (C > 8) {
      const hue = (a, b) => Math.abs(Math.atan2(Math.sin(h - a), Math.cos(h - a))) < b;
      if (hue(.85, .3) && L[0] < 55 && has('iron')) { r.iron = 12; s.cool = 80; if (red) s.atm = 'red'; }
      else if (hue(1.4, .45) && has('iron')) r.iron = C > 30 ? 4 : 2;
      else if (hue(2.85, .5) && L[0] > 65 && C < 25 && has('iron') && red) { r.iron = 1.2; s.atm = 'red'; app = 1.4; }
      else if (hue(2.5, .5) && has('copper')) r.copper = 2.5;
      else if ((hue(-2.8, .5) || hue(2.95, .3)) && has('copper')) r.copper = 3;
      else if (hue(-1.3, .5) && has('cobalt')) r.cobalt = 1;
      else if (hue(-.35, .4) && has('manganese')) r.manganese = 3;
      else if (hue(.4, .4) && L[0] < 45 && has('copper') && red) { r.copper = 1; r.tin = 1; if (has('fritB')) { r.fritB = 20; r.feldspar = 35; r.silica = 25; r.whiting = 15; r.kaolin = 5; } s.atm = 'red'; s.peak = 1270; }
      else if (hue(.2, .5) && has('chrome') && has('tin')) { r.tin = 6; r.chrome = .2; r.whiting = 25; r.silica = 30; r.feldspar = 30; r.kaolin = 15; }
    }
    if (T.var && has('rutile')) { r.rutile = 7; if (has('fritB')) r.fritB = 15; s.cool = 120; if (!r.cobalt && has('cobalt')) r.cobalt = .8; }
    if (T.crys && L[2] < -15 && has('cobalt')) r.cobalt = 1;
    for (const k in r) if (!has(k)) delete r[k];
    if (!U.xhold) { s.xt = 0; s.xh = 0; }
    return { r, s, app };
  }
  const STEP = { peak: 15, ramp: 40, hold: 10, cool: 60, xt: 20, xh: 1, app: .2 };
  const LIM = { peak: [950, 1320], ramp: [50, 300], hold: [0, 120], cool: [50, 400], xt: [950, 1150], xh: [0, 6], app: [.6, 1.6] };
  function competent(c, U, budget = 60) {
    let tiles = 0, cur = seed(c, U), best = null;
    const score = g => { tiles++; const x = K.fire(g.r, g.s, c.body, g.app); return { g, x, j: K.judge(x, c.T) }; };
    best = score(cur);
    let scale = 1, stall = 0;
    while (tiles < budget && !best.j.pass) {
      // candidate moves: each jar up/down, a new jar, each kiln setting, reduction on/off
      const g0 = best.g, moves = [];
      for (const m of Object.keys(g0.r)) { const add = K.M[m].add, st = (add ? Math.max(.25, g0.r[m] * .3) : 6) * scale;
        moves.push(g => { g.r[m] = Math.max(0, g.r[m] + st); }, g => { g.r[m] = Math.max(0, g.r[m] - st); }); }
      for (const m of U.mats) if (!(m in g0.r) && !K.M[m].add) moves.push(g => { g.r[m] = 8 * scale; });
      for (const k of ['peak', 'ramp', 'hold', 'cool', 'xt', 'xh']) { if ((k === 'xt' || k === 'xh') && !U.xhold) continue;
        moves.push(g => { g.s[k] = Math.min(LIM[k][1], g.s[k] + STEP[k] * scale); }, g => { g.s[k] = Math.max(LIM[k][0], g.s[k] - STEP[k] * scale); }); }
      moves.push(g => { g.app = Math.min(1.6, g.app + .2); }, g => { g.app = Math.max(.6, g.app - .2); });
      if (U.gas) moves.push(g => { g.s.atm = g.s.atm === 'red' ? 'ox' : 'red'; });
      // a potter reads the critique: try the moves in an order shuffled by a seeded die, keep the first that helps
      const rnd = K.rngOf(c.id + ':' + tiles); for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
      let improved = false;
      for (const mv of moves) { if (tiles >= budget) break; const g = { r: { ...g0.r }, s: { ...g0.s }, app: g0.app }; mv(g);
        const t = score(g); if (t.j.lik > best.j.lik) { best = t; improved = true; break; } }
      if (!improved) { scale *= .6; if (++stall > 3) break; } else stall = 0;
    }
    return { ok: best.j.pass, lik: best.j.lik, tiles, best: best.g, x: best.x };
  }
  function naive(c) { const x = K.fire(c.start || { feldspar: 40, silica: 30, kaolin: 20, whiting: 10 }, K.SCHED0, c.body, 1); return { ok: K.judge(x, c.T).pass, lik: K.judge(x, c.T).lik }; }
  function random(c, U, rnd) { const r = {}, mats = U.mats; for (let n = 2 + Math.floor(rnd() * 4); n > 0; n--) { const m = mats[Math.floor(rnd() * mats.length)]; r[m] = K.M[m].add ? +(rnd() * 6).toFixed(2) : Math.round(5 + rnd() * 45); }
    if (!Object.keys(r).some(m => !K.M[m].add)) r.feldspar = 50;
    const s = { peak: 5 * Math.round((1000 + rnd() * 320) / 5), ramp: 50 + Math.round(rnd() * 250), hold: Math.round(rnd() * 60), cool: [400, 300, 150, 80][Math.floor(rnd() * 4)], atm: U.gas && rnd() < .5 ? 'red' : 'ox', xt: 0, xh: 0 };
    const x = K.fire(r, s, c.body, .8 + rnd() * .6), j = K.judge(x, c.T); return { ok: j.pass, lik: j.lik }; }
  return { seed, competent, naive, random };
})`;
