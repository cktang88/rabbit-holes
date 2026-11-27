// The Coaster Designer: ride physics (energy, friction, drag, g in the banked seat) and scoring. A classic script; all files share one global scope, loaded in order by index.html.
// ================= ride physics =================
// Energy along the track: d(v²)/ds = −2g·sinθ − 2μ·|N|/m − 2c·v². Seat g = (v²κ + g cosθ)/g in the vertical plane;
// a flat turn adds v²/r sideways, part of it taken into the seat by the bank angle.
// The train: five cars of two rows (two riders a row). Rows sit ROWS metres behind the front row; the physics point is the
// train's centre (its centre of mass), TRAIN.mid metres behind the front row. Gravity acts on every row where it is on the
// track, so a long train is dragged over a crest by the cars already going down, and the chain holds the whole train
// until its last row is off the lift.
const TRAIN = { cars: 5, pitch: 2.9, row: .9, carLen: 2.66 }; // a 0.9 m seat pitch, as on modern sit-down trains
TRAIN.rows = []; for (let c = 0; c < TRAIN.cars; c++) TRAIN.rows.push(c * TRAIN.pitch, c * TRAIN.pitch + TRAIN.row);
TRAIN.mid = TRAIN.rows[TRAIN.rows.length - 1] / 2; TRAIN.len = TRAIN.rows[TRAIN.rows.length - 1];
function ride(design, opt = {}) {
  const S = design.S || geometry(design), mu = opt.mu ?? MU, drag = opt.drag ?? DRAG, terrain = opt.terrain || (() => -1e9), lift = design.lift ?? 1;
  const out = { S, t: [], v: [], gs: [], gl: [], idx: [], stall: -1, crash: -1, done: false, lift };
  let v = opt.v0 ?? 2, t = 0, prevG = 1;
  const stats = { vmax: 0, gmax: -9, gmin: 9, latmax: 0, air: 0, inv: 0, jerks: 0, drop: 0, len: (S.length - 1) * DS, time: 0 };
  let inverted = false, lastPeak = S[0].y;
  const n1 = S.length - 1, rowN = opt.point ? [0] : TRAIN.rows.map(o => Math.round((TRAIN.mid - o) / DS)), rearN = opt.point ? 0 : Math.round(TRAIN.mid / DS);
  for (let i = 0; i < S.length - 1; i++) {
    const p = S[i], q = S[i + 1], th = p.th, rear = S[Math.max(0, i - rearN)], onLift = p.seg < lift || rear.seg < lift;
    let sinA = 0; for (const o of rowN) sinA += i + o < 0 ? 0 : Math.sin(S[Math.min(i + o, n1)].th); /* rows still in the level station: no pull */ sinA /= rowN.length; // the whole train's weight along the track
    const gv = (v * v * (p.kv || 0) + G * Math.cos(th)) / G, ah = v * v * p.kh;
    // auto-bank: tilt so the seat takes the whole push, tan b = (v²κh/g) / (vertical g); then any over/under-bank trim
    if (p.ab) p.bank = clamp((Math.abs(ah) > 1e-6 ? Math.atan2(Math.abs(ah), G * Math.max(.25, gv)) : 0) + p.bt, 0, 1.45);
    const bs = p.bank * Math.sign(p.kh || 0); // banked into the turn, left or right
    const seat = gv * Math.cos(bs) + (ah / G) * Math.sin(bs), lat = (ah / G) * Math.cos(bs) - gv * Math.sin(bs);
    const N = G * Math.hypot(seat, lat);
    let v2 = v * v + 2 * DS * (-G * sinA - mu * N - drag * v * v);
    if (onLift) v2 = Math.max(v2, CHAIN * CHAIN);
    if (v2 <= 0) { out.stall = i; break; }
    const vn = Math.sqrt(v2), dt = DS / ((v + vn) / 2); t += dt; v = vn;
    if (p.y < terrain(p.x) + .3 && out.crash < 0) out.crash = i;
    out.t.push(t); out.v.push(v); out.gs.push(seat); out.gl.push(lat); out.idx.push(i);
    if (p.seg >= lift) { // judged once the train's middle is off the chain
      stats.vmax = Math.max(stats.vmax, v); stats.gmax = Math.max(stats.gmax, seat); stats.gmin = Math.min(stats.gmin, seat); stats.latmax = Math.max(stats.latmax, Math.abs(lat));
      if (seat < .2) stats.air += dt;
      if (Math.abs((seat - prevG) / dt) > 18) stats.jerks++;
    }
    prevG = seat;
    const up = Math.cos(th) < -.2; if (up && !inverted) stats.inv++; inverted = up;
    if (q.y > p.y && p.y <= lastPeak) { /* climbing */ } if (S[i + 1] && i > 0 && p.y > S[i - 1].y && p.y >= q.y) lastPeak = p.y;
    stats.drop = Math.max(stats.drop, lastPeak - q.y);
  }
  stats.time = t; stats.seat = 'middle of the train'; out.done = out.stall < 0 && out.crash < 0; out.stats = stats; out.vEnd = v; if (S.kink >= 0) { out.kink = S.kink; out.done = false; }
  return out;
}

// g at any seat: the seat `off` metres behind the front row rides the same speed as the train, on its own bit of track.
// Returns that seat's seat and sideways g per step and its airtime and peaks (the judged numbers are the train's middle).
function seatSeries(R, off) {
  R.seats = R.seats || {}; const key = off.toFixed(2); if (R.seats[key]) return R.seats[key];
  const S = R.S, n1 = S.length - 1, d = (TRAIN.mid - off) / DS, gs = [], gl = [], idx = [], o = { gs, gl, idx, air: 0, gmax: -9, gmin: 9, latmax: 0, off }, lift = R.lift ?? 1;
  for (let k = 0; k < R.v.length; k++) { const u = clamp(R.idx[k] + d, 0, n1), j = Math.round(u), p = S[j], v = R.v[k];
    const gv = (v * v * (p.kv || 0) + G * Math.cos(p.th)) / G, ah = v * v * (p.kh || 0), bs = (p.bank || 0) * Math.sign(p.kh || 0);
    const seat = gv * Math.cos(bs) + (ah / G) * Math.sin(bs), lat = (ah / G) * Math.cos(bs) - gv * Math.sin(bs); gs.push(seat); gl.push(lat); idx.push(j);
    if (p.seg >= lift) { const dt = R.t[k] - (R.t[k - 1] || 0); if (seat < .2) o.air += dt; o.gmax = Math.max(o.gmax, seat); o.gmin = Math.min(o.gmin, seat); o.latmax = Math.max(o.latmax, Math.abs(lat)); } }
  return R.seats[key] = o;
}

// ================= scoring =================
function footprint(S) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of S) { x0 = Math.min(x0, p.X); x1 = Math.max(x1, p.X); z0 = Math.min(z0, p.Z); z1 = Math.max(z1, p.Z); } return { w: x1 - x0 + 4, d: z1 - z0 + 4, area: (x1 - x0 + 4) * (z1 - z0 + 4) }; }
function costOf(S, terrain, lake) {
  let support = 0; for (const p of S) { const h = Math.max(0, p.y - terrain(p.x)); support += h * DS * (lake && p.x > lake[0] && p.x < lake[1] ? 4 : 1); }
  const len = (S.length - 1) * DS; return Math.round(len * .8 + support * .06 + S.filter(p => Math.abs(p.bank) > .05).length * DS * .3); // £k
}
function scores(design, site) {
  const S = design.S = geometry(design), r = ride(design, { terrain: site.terrain }), st = r.stats, fp = footprint(S);
  const thrill = Math.round(22 * Math.min(1, st.vmax / 28) + 22 * Math.min(1, st.air / 3) + 20 * Math.min(1, st.inv / 2) + 16 * Math.min(1, (st.gmax - st.gmin) / 4.5) + 20 * Math.min(1, st.drop / 40));
  let comfort = 100; comfort -= Math.max(0, st.gmax - 3.5) * 22; comfort -= Math.max(0, -1 - st.gmin) * 40; comfort -= Math.max(0, st.latmax - 1) * 35; comfort -= st.jerks * 2;
  comfort = Math.round(clamp(comfort, 0, 100));
  return { r, st, thrill, comfort, cost: costOf(S, site.terrain, site.lake), fp, ok: r.done, black: st.gmax > 6, grey: st.gmax > 5, eject: st.gmin < -1.5 };
}

