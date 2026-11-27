// The Coaster Designer: commissions, state, share codes, the 2D designer view, editing, elements, riding, results and UI. A classic script; all files share one global scope, loaded in order by index.html.
// ================= sites and commissions =================
const flatSite = () => ({ terrain: () => 0, lake: null });
function siteFrom(seed) { // rolling ground with a lake, from a seed
  const r = RH.rng(seed >>> 0 || 1), a = [r() * 6, r() * 6, r() * 3], f = [.013 + r() * .01, .031 + r() * .02, .07 + r() * .03], ph = [r() * 6, r() * 6, r() * 6];
  const lx = 90 + r() * 120, lake = [lx, lx + 30 + r() * 30];
  const terrain = x => { let y = 0; for (let k = 0; k < 3; k++) y += a[k] * Math.sin(x * f[k] + ph[k]); y += 6; if (x > lake[0] && x < lake[1]) y = Math.min(y, 1); return y; };
  return { terrain, lake, seed };
}
const N = (x, y, o = {}) => ({ x, y, ...o });
const COMS = [
  { id: 'first', n: 'First Ride', site: flatSite, start: () => [N(0, 2), N(40, 32), N(62, 20), N(84, 8), N(104, 9), N(128, 36), N(152, 10), N(186, 3)],
    story: 'The chain lift drags the train up the first hill; after that, <b>gravity is the only engine</b>. Press <b>RIDE</b>. If it stalls, drag the top of the hill where it stopped lower, and ride again.',
    req: { done: 1 } },
  { id: 'loop', n: 'The Loop', site: flatSite, start: () => [N(0, 2), N(44, 34.5), N(54.5, 21), N(86.5, 5), N(103.5, 3), N(118, 4), N(127.5, 13.5), N(118, 23), N(108.5, 13.5), N(118, 4), N(150, 3), N(165, 2.5)],
    story: 'The park wants an inversion. This loop is a perfect <b>circle</b>: fast enough to stay pressed in at the top means a crushing squeeze at the bottom. Keep riders under <b>5 g</b>. Real loops are not circles.',
    req: { done: 1, inv: 1, gmax: 5 } },
  { id: 'family', n: 'Family Coaster', site: flatSite, start: () => [N(0, 2), N(30, 18), N(50, 8), N(70, 3), N(95, 10), N(120, 3), N(150, 3)],
    story: 'For the under-tens: nothing above <b>3.5 g</b>, nothing that throws them out of the seat (a gentle float is fine), but at least <b>0.5 s of airtime</b> on the humps. Budget £350k.',
    req: { done: 1, gmax: 3.5, gmin: -.5, air: .5, cost: 350 } },
  { id: 'turn', n: 'The Narrow Lot', site: flatSite, start: () => [N(0, 2), N(30, 22), N(50, 12), N(70, 5), N(80, 5, { r: 14, bank: 0 }), N(110, 5), N(140, 4)],
    story: 'The lot is only <b>40 m deep</b>, so the ride must turn back on itself. A flat turn throws riders sideways; <b>bank</b> it so the seat takes the push. Select the node before the turn to set its radius and bank.',
    req: { done: 1, lat: 1.2, depth: 40, turn: 1 } },
  { id: 'lake', n: 'Over the Lake', site: () => siteFrom(1937), start: () => [N(0, 8), N(40, 40), N(80, 14), N(130, 16), N(180, 12), N(230, 12)],
    story: 'The site rolls and there is a lake: supports standing in water cost <b>four times</b> as much, and the track may never touch the ground. Under <b>£220k</b>, and still worth queuing for: <b>thrill 35+</b>.',
    req: { done: 1, cost: 220, thrill: 35 } },
  { id: 'thrill', n: 'The Thrill Machine', site: flatSite, start: () => [N(0, 2), N(44, 36), N(66, 20), N(88, 4), N(115, 22), N(140, 5), N(190, 4)],
    story: 'The headline ride: <b>thrill 88+</b> while keeping <b>comfort 55+</b> (that needs two inversions). Speed, airtime, inversions and big drops all count; blackouts and ejections do not.',
    req: { done: 1, thrill: 88, comfort: 55 } },
  { id: 'daily', n: 'Daily Site', daily: 1, site: () => siteFrom(dailySeed()), start: () => dailyStart(siteFrom(dailySeed())),
    story: 'A new plot every day, the same for everyone: rolling ground and a lake. Build the best ride you can: <b>score = thrill + comfort − cost/5</b>. Your best today is kept; share your design.',
    req: { done: 1 } },
  { id: 'sandbox', n: 'Sandbox', free: 1, site: flatSite, start: () => [N(0, 2), N(40, 36), N(84, 6), N(124, 5)],
    story: 'No commission. Build anything, ride it, share it. (Try a loop that is taller than it is wide.)', req: { done: 1 } },
];
// a plain out-and-back that rides on any generated site: a lift, one big drop, then hills riding the ground
function dailyStart(st) { // deterministic: hug the ground, keep every hill well under the lift crest, lift higher until it rides
  const t = st.terrain, xs = [0, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240], hs = [2, 0, 24, 12, 8, 11, 12, 9, 7, 6, 5, 4];
  let maxT = 0; for (let x = 0; x <= 240; x += 2) maxT = Math.max(maxT, t(x));
  const tm = x => { let m = -1e9; for (let u = x - 12; u <= x + 12; u += 2) m = Math.max(m, t(u)); return m; }; // the ground near a node, not just under it (lake banks are steep)
  for (let extra = 0; extra < 40; extra += 4) {
    const crest = maxT + 30 + extra, nodes = xs.map((x, k) => N(x, Math.round((k === 0 ? t(0) + 2 : k === 1 ? crest : Math.min(crest - 10 - k * 1.5, Math.max(tm(x) + 3 + extra / 4, tm(x) + hs[k] * (crest - maxT) / 40))) * 2) / 2));
    if (scores({ nodes, lift: 1 }, st).ok) return nodes;
  }
  return xs.map((x, k) => N(x, t(x) + (k === 1 ? 40 : 4)));
}
function dailySeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function checkReq(c, sc) {
  const q = c.req, rows = [];
  rows.push(['the train reaches the station', sc.ok]);
  if (!c.free) rows.push(['nobody blacks out (≤ 6 g)', sc.st.gmax <= 6]);
  if (q.inv) rows.push([`${q.inv}+ inversion`, sc.st.inv >= q.inv]);
  if (q.gmax) rows.push([`max ${q.gmax} g in the seat`, sc.st.gmax <= q.gmax]);
  if (q.gmin != null) rows.push([`never below ${q.gmin} g`, sc.st.gmin >= q.gmin]);
  if (q.air) rows.push([`${q.air}+ s of airtime`, sc.st.air >= q.air]);
  if (q.cost) rows.push([`cost ≤ £${q.cost}k`, sc.cost <= q.cost]);
  if (q.lat) rows.push([`sideways ≤ ${q.lat} g`, sc.st.latmax <= q.lat]);
  if (q.depth) rows.push([`lot depth ≤ ${q.depth} m`, sc.fp.d <= q.depth]);
  if (q.turn) rows.push(['turns back on itself', Math.abs(sc.r.S[sc.r.S.length - 1].head) > 2.6]);
  if (q.thrill) rows.push([`thrill ≥ ${q.thrill}`, sc.thrill >= q.thrill]);
  if (q.comfort) rows.push([`comfort ≥ ${q.comfort}`, sc.comfort >= q.comfort]);
  return rows;
}
const ROWS_ONLY = c => checkReq(c, { ok: false, st: { inv: 0, gmax: 9, gmin: -9, air: 0, latmax: 9 }, cost: 1e9, fp: { d: 1e9 }, r: { S: [{ head: 0 }] }, thrill: 0, comfort: 0 }).map(r => r[0]);
// Airtime: the seat g drops under AIR (riders float). Over a crest, seat g = (g·cosθ − v²/r)/g, so it needs v² / r > ~0.8 g:
// come over the top fast (a big drop before it) and keep the crest tightly rounded (small r).
const AIR = .2, AIR_TIP = 'Airtime = the moment riders float out of their seats (seat g under 0.2). Get it by cresting a hill fast: speed² ÷ crest radius must beat gravity. A big drop, then a small, tightly rounded hump.';
function crests(S, R) { // each hill top the train goes over upright, with the lowest seat g the prediction gives near it
  const out = [], n = S.length, lift = design.lift ?? 1; if (!R || !R.gs) return out;
  for (let i = 3; i < n - 3; i++) { const p = S[i]; if (S[Math.max(0, i - 6)].seg < lift || Math.cos(p.th) < .3 || !(p.y >= S[i - 1].y && p.y > S[i + 1].y)) continue; if (out.length && i - out[out.length - 1].i < 8) continue;
    let gmin = 9, v = 0, k = 0; for (let j = Math.max(0, i - 6); j <= Math.min(n - 1, i + 6); j++) if (R.gs[j] != null && R.gs[j] < gmin) { gmin = R.gs[j]; v = R.v[j]; k = S[j].kv || 0; }
    if (gmin === 9) continue; // the train never got here
    const need = k < -1e-3 ? Math.sqrt(G * (Math.cos(p.th) - AIR) / -k) : Infinity; out.push({ i, x: p.x, y: p.y, g: gmin, v, need, air: gmin < AIR, close: gmin < .6 }); }
  return out;
}
function crestText(c) { const kmh = v => Math.round(v * 3.6);
  if (c.air) return `Airtime here: ${c.g.toFixed(1)} g at ${kmh(c.v)} km/h.`;
  if (!isFinite(c.need) || c.need > c.v * 1.6) return `No airtime: ${c.g.toFixed(1)} g. Make this crest tighter (a smaller, rounder hump)${isFinite(c.need) ? `: as it is, it needs ${kmh(c.need)} km/h and you have ${kmh(c.v)}` : ''}.`;
  return `No airtime yet (${c.g.toFixed(1)} g): needs ${kmh(c.need)} km/h here, you have ${kmh(c.v)}. Drop further before it, or make it tighter.`; }
const dailyScore = sc => Math.round(sc.thrill + sc.comfort - sc.cost / 5);

// ================= state =================
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const SAVE = (v => isObj(v) ? v : {})(RH.load('coaster', {}));
SAVE.done = isObj(SAVE.done) ? SAVE.done : {}; SAVE.best = isObj(SAVE.best) ? SAVE.best : {}; SAVE.designs = isObj(SAVE.designs) ? SAVE.designs : {};
const persist = () => { for (const k in SAVE.designs) if (!COMS.find(c => c.id === k)) delete SAVE.designs[k]; RH.save('coaster', SAVE); RH.progress('coaster', COMS.filter(c => !c.free && !c.daily && SAVE.done[c.id]).length / COMS.filter(c => !c.free && !c.daily).length); };
let C = COMS[0], site = flatSite(), design = { nodes: [], lift: 1 }, sel = -1, history = [], last = null, play = null, live = null, liveT = 0;
// the design's predicted ride, recomputed as you drag: the track is coloured by seat g before you ever press RIDE
function predict(force) { const now = performance.now(); if (!force && now - liveT < 40) return; liveT = now; try { live = scores(design, site); } catch (e) { live = null; } }

// ================= share codes =================
const enc = d => d.nodes.map(n => [Math.round(n.x * 2), Math.round(n.y * 2), Math.round(n.r || 0), n.ab ? 200 + Math.round(n.bt || 0) : Math.round(n.bank || 0), ...(n.t ? [Math.round(n.t.x * 100), Math.round(n.t.y * 100)] : [])].map(v => v.toString(36)).join('.')).join('_');
const dec = s => ({ nodes: s.split('_').map(t => { const [x, y, r, b, tx, ty] = t.split('.').map(v => parseInt(v, 36) || 0), n = N(x / 2, y / 2, r ? (b >= 150 ? { r, ab: 1, bt: clamp(b - 200, -30, 30), bank: 0 } : { r, bank: b }) : {}); if ((tx || ty) && Math.hypot(tx, ty) > 10) n.t = { x: clamp(tx / 100, -3, 3), y: clamp(ty / 100, -3, 3) }; return n; }).filter(n => isFinite(n.x) && isFinite(n.y)).slice(0, 80), lift: 1 });

// ================= view =================
const cv = $('cv'), g = cv.getContext('2d'); let W = 1, H = 1, dpr = 1, cam = { s: 3, ox: 40, oy: 0 };
function resize() { dpr = FX.fit(cv, 2); W = cv.width; H = cv.height; fit(); }
function playRect() { // the part of the screen the drawing can use
  const b = $('brief').getBoundingClientRect(), t = $('tools').getBoundingClientRect(), mob = innerWidth < 860, land = mob && innerHeight < 520;
  return { l: land || !mob ? b.right + 10 : 8, r: innerWidth - 10, t: land || !mob ? 20 : b.bottom + 10, b: t.top - 24 - stripH() };
}
// the g diagram, docked under the drawing (the drawing is fitted above it, so it never covers the track); tap ▾ to fold it
const stripMin = () => SAVE.stripMin ?? innerHeight < 520; // a landscape phone starts folded
const stripH = () => stripMin() ? 30 : innerHeight < 520 ? 90 : innerWidth < 860 ? 110 : 160;
function stripBox() { const PR = playRect(), b = PR.b + stripH() + 14, h = stripH() - 8; return { l: PR.l + 4, r: PR.r - 4, t: b - h, b, h, ax: stripMin() ? 0 : 34 }; } // CSS px; ax: room for the g labels
function fit() {
  // while the 3D ride covers the screen the brief and toolbar measure 0×0, so fitting now would aim the blueprint at nothing: refit when the ride view closes
  if (V3.on || $('tools').getBoundingClientRect().height === 0) { V3.needFit = true; return; }
  if (!design.nodes.length) return; const R = playRect(), xs = design.nodes.map(n => n.x), ys = design.nodes.map(n => n.y);
  const x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10, y0 = Math.min(0, ...ys) - 4, y1 = Math.max(...ys) + 12;
  // fit the whole ride if it reads well; on a narrow phone keep the track at least half the drawing's height and start at the station (drag to pan)
  const mobFit = innerWidth < 860 && (x1 - x0) < 260; // on a phone the whole commission fits on load; long free rides start at the station
  const sFit = Math.min((R.r - R.l) / (x1 - x0), (R.b - R.t) / (y1 - y0)), sTall = (R.b - R.t) * .36 / (y1 - y0);
  cam.s = Math.max(.6, sFit, mobFit ? 0 : Math.min(sTall, 6)) * dpr;
  const wpx = (x1 - x0) * cam.s; cam.ox = wpx <= (R.r - R.l) * dpr ? R.l * dpr - x0 * cam.s + ((R.r - R.l) * dpr - wpx) / 2 : R.l * dpr - x0 * cam.s;
  cam.oy = R.b * dpr + y0 * cam.s - Math.max(0, ((R.b - R.t) * dpr - (y1 - y0) * cam.s) / 2);
}
const sx = x => cam.ox + x * cam.s, sy = y => cam.oy - y * cam.s, wx = px => (px - cam.ox) / cam.s, wy = py => (cam.oy - py) / cam.s;

function draw() {
  // blueprint paper
  g.fillStyle = '#123a66'; g.fillRect(0, 0, W, H);
  const step = 10 * cam.s; g.lineWidth = 1; g.strokeStyle = 'rgba(207,230,255,.09)';
  if (step > 6) { g.beginPath(); for (let x = ((cam.ox % step) + step) % step; x < W; x += step) { g.moveTo(x, 0); g.lineTo(x, H); } for (let y = ((cam.oy % step) + step) % step; y < H; y += step) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); }
  // ground and lake
  const x0 = wx(0), x1 = wx(W);
  g.beginPath(); g.moveTo(0, H); for (let px = 0; px <= W; px += 4 * dpr) g.lineTo(px, sy(site.terrain(wx(px)))); g.lineTo(W, H); g.closePath();
  g.fillStyle = 'rgba(207,230,255,.10)'; g.fill(); g.strokeStyle = 'rgba(207,230,255,.75)'; g.lineWidth = 1.5 * dpr; g.stroke();
  if (site.lake) { const lx0 = sx(site.lake[0]), lx1 = sx(site.lake[1]); g.fillStyle = 'rgba(90,170,230,.45)'; g.fillRect(lx0, sy(1.2), lx1 - lx0, 1.2 * cam.s + 2);
    g.fillStyle = '#cfe6ff'; g.font = `${12 * dpr}px "Architects Daughter"`; g.textAlign = 'center'; g.fillText('lake', (lx0 + lx1) / 2, sy(1.2) - 4 * dpr); }
  const S = design.S || (design.S = geometry(design));
  // supports
  g.strokeStyle = 'rgba(207,230,255,.22)'; g.lineWidth = 1 * dpr; g.beginPath();
  for (let i = 0; i < S.length; i += 8) { const p = S[i]; if (Math.cos(p.th) < 0) continue; g.moveTo(sx(p.x), sy(p.y)); g.lineTo(sx(p.x), sy(site.terrain(p.x))); } g.stroke();
  // track: rails, colour-coded by seat g after a ride
  const R = (last && last.r) || (!play && live && live.r);
  for (let i = 0; i < S.length - 1; i++) {
    const p = S[i], q = S[i + 1]; let col = '#ffffff';
    if (p.seg < (design.lift ?? 1)) col = '#f2b33d';
    if (R && R.gs[i] != null) { const gg = R.gs[i]; col = gg > 5 ? '#ff4b3a' : gg > 3.5 ? '#ffa25a' : gg < 0 ? '#7cf2ff' : gg < .2 ? '#b8f7ff' : '#ffffff'; }
    if (R && R.stall >= 0 && i >= R.stall) col = 'rgba(255,255,255,.35)';
    g.strokeStyle = col; g.lineWidth = (p.kh ? 4 : 2.6) * dpr; g.beginPath(); g.moveTo(sx(p.x), sy(p.y)); g.lineTo(sx(q.x), sy(q.y)); g.stroke();
  }
  // turns: annotated with the drafter's red pencil
  design.nodes.forEach((n, i) => { if (!n.r || i >= design.nodes.length - 1) return; const m = design.nodes[i + 1];
    g.fillStyle = '#ff6b57'; g.font = `${12 * dpr}px "Architects Daughter"`; g.textAlign = 'center'; g.fillText(`turn ${n.r > 0 ? 'left' : 'right'} ${Math.round(turnAngle(i))}° · R${Math.abs(n.r)} m · bank ${n.ab ? 'auto' + (n.bt ? (n.bt > 0 ? '+' : '') + n.bt : '') : (n.bank || 0) + '°'}`, sx((n.x + m.x) / 2), sy((n.y + m.y) / 2) - 12 * dpr); });
  // stall / crash markers
  { let lab = 0; const mark = (i, t, dy) => { const p = S[i]; g.fillStyle = '#ff6b57'; g.font = `700 ${14 * dpr}px "Courier Prime"`; g.textAlign = 'center'; g.fillText(t, sx(p.x), sy(p.y) + (dy - 18 * lab++) * dpr); };
    if (R && R.gl && !play) { let mi = -1, mv = 1.2; R.gl.forEach((v, k) => { if (Math.abs(v) > mv) { mv = Math.abs(v); mi = R.idx[k]; } }); if (mi >= 0) mark(mi, `SIDEWAYS ${mv.toFixed(1)} g: bank it`, -16); } // riders thrown sideways
    if (R && R.kink >= 0) mark(R.kink, 'KINK', -16); if (R && R.stall >= 0) mark(R.stall, 'STALLED', -16); }
  if (R && R.crash >= 0) { const p = S[R.crash]; g.fillStyle = '#ff6b57'; g.font = `700 ${14 * dpr}px "Courier Prime"`; g.textAlign = 'center'; g.fillText('HITS THE GROUND', sx(p.x), sy(p.y) + 22 * dpr); }
  // hill crests, coloured by the predicted seat g over them: green floats (airtime), yellow nearly, grey no
  if (!play && R) for (const c of crests(S, R)) { const X = sx(c.x), Y = sy(c.y) - 20 * dpr; g.beginPath(); g.arc(X, Y, 7 * dpr, 0, 7); g.fillStyle = c.air ? '#3fd27a' : c.close ? '#f2d03d' : 'rgba(207,230,255,.35)'; g.fill(); g.lineWidth = 1.5 * dpr; g.strokeStyle = '#123a66'; g.stroke();
    if (c.air) { g.fillStyle = '#3fd27a'; g.font = `700 ${11 * dpr}px "Courier Prime"`; g.textAlign = 'center'; g.fillText('air', X, Y - 11 * dpr); } }
  // nodes (drag handles)
  if (!play) design.nodes.forEach((n, i) => {
    const X = sx(n.x), Y = sy(n.y), r = (i === sel ? 13 : 10) * dpr;
    g.beginPath(); g.arc(X, Y, r, 0, 7); g.fillStyle = i === 0 ? '#f2b33d' : i === sel ? '#ff6b57' : 'rgba(18,58,102,.9)'; g.fill(); g.lineWidth = 2 * dpr; g.strokeStyle = '#cfe6ff'; g.stroke();
    if (i === 0) { g.fillStyle = '#cfe6ff'; g.font = `${11 * dpr}px "Architects Daughter"`; g.textAlign = 'center'; g.fillText('station', X, Y + 24 * dpr); }
  });
  // stamped elements: a diamond handle each; the selected node's tangent arms; snap guides
  if (!play) { for (const el of groups()) { const H = handleOf(el); if (!H) continue; const X = H[0], Y = H[1], r = (el.id === selG ? 11 : 9) * dpr;
      g.beginPath(); g.moveTo(X, Y - r); g.lineTo(X + r, Y); g.lineTo(X, Y + r); g.lineTo(X - r, Y); g.closePath(); g.fillStyle = el.id === selG ? '#f2b33d' : 'rgba(242,179,61,.55)'; g.fill(); g.strokeStyle = '#1d1a16'; g.lineWidth = 1.5 * dpr; g.stroke();
      if (el.id === selG) { const E = ELS[el.t]; g.fillStyle = '#f2b33d'; g.font = `${11 * dpr}px "Courier Prime"`; g.textAlign = 'center'; g.fillText(`${E.H[1](el.h)} · ${E.Wd[1](el.w)}`, X, Y - 16 * dpr); } }
    const A = sel >= 0 ? arms(sel) : null;
    if (A) { const n = design.nodes[sel], pin = !!n.t; g.lineWidth = 1.5 * dpr; g.strokeStyle = pin ? '#ff6b57' : 'rgba(207,230,255,.6)'; g.setLineDash(pin ? [] : [4 * dpr, 4 * dpr]);
      g.beginPath(); for (const q of [A.back, A.front]) if (q) { g.moveTo(sx(n.x), sy(n.y)); g.lineTo(sx(q[0]), sy(q[1])); } g.stroke(); g.setLineDash([]);
      for (const q of [A.back, A.front]) if (q) { g.beginPath(); g.arc(sx(q[0]), sy(q[1]), 6 * dpr, 0, 7); g.fillStyle = pin ? '#ff6b57' : '#cfe6ff'; g.fill(); g.strokeStyle = '#123a66'; g.stroke(); } }
    g.strokeStyle = '#f2b33d'; g.fillStyle = '#f2b33d'; g.lineWidth = 1 * dpr; g.setLineDash([6 * dpr, 4 * dpr]); g.font = `${11 * dpr}px "Courier Prime"`; g.textAlign = 'left';
    for (const q of guides) { g.beginPath(); if (q.t === 'h') { g.moveTo(sx(q.x0) - 20 * dpr, sy(q.y)); g.lineTo(sx(q.x1) + 20 * dpr, sy(q.y)); g.stroke(); g.fillText(q.lab, sx(q.x1) + 8 * dpr, sy(q.y) - 4 * dpr); }
      else if (q.t === 'v') { g.moveTo(sx(q.x), sy(q.y1) - 20 * dpr); g.lineTo(sx(q.x), sy(q.y0) + 20 * dpr); g.stroke(); g.fillText(q.lab, sx(q.x) + 6 * dpr, sy(q.y1) - 22 * dpr); }
      else if (sel >= 0) { const n = design.nodes[sel]; g.fillText(q.lab, sx(n.x) + 14 * dpr, sy(n.y) - 14 * dpr); } }
    g.setLineDash([]); }
  // the train during a ride
  if (play) { const p = S[play.i] || S[S.length - 1]; for (let k = 0; k < 3; k++) { const q = S[Math.max(0, play.i - k * 6)] || p; g.save(); g.translate(sx(q.x), sy(q.y)); g.rotate(-q.th); g.fillStyle = k ? '#f4e8cc' : '#e2493b'; g.fillRect(-2.2 * cam.s, -1.6 * cam.s, 4 * cam.s, 1.6 * cam.s); g.restore(); } }
  // live prediction: peak g by the node you are dragging, and what the colours mean
  if (!play && live && live.r) { const PRc = playRect(), L2 = live, tx = (PRc.l + PRc.r) / 2 * dpr, ry = (PRc.t + 30) * dpr; /* top of the drawing area, clear of the node card and the tools */ g.textAlign = 'center'; g.font = `${12 * dpr}px "Courier Prime"`; g.fillStyle = '#cfe6ff';
    g.font = `${(W / dpr < 560 ? 11 : 12) * dpr}px "Courier Prime"`; g.fillText(`${W / dpr < 560 ? '' : 'predicted: '}peak ${L2.st.gmax.toFixed(1)} g · low ${L2.st.gmin.toFixed(1)} g · thrill ${L2.thrill} · £${L2.cost}k${L2.ok ? '' : L2.r.stall >= 0 ? ' · STALLS' : L2.r.kink >= 0 ? ' · KINK' : ' · HITS GROUND'}`, tx, ry - 16 * dpr);
    const lg = [['#ffffff', '< 3.5 g'], ['#ffa25a', '> 3.5 g'], ['#ff4b3a', '> 5 g'], ['#b8f7ff', 'floating']]; g.font = `${11 * dpr}px "Courier Prime"`; g.textAlign = 'right'; let lx = tx + lg.reduce((a, l) => a + g.measureText(l[1]).width + 28 * dpr, 0) / 2;
    for (let i = lg.length - 1; i >= 0; i--) { const w = g.measureText(lg[i][1]).width; g.fillStyle = '#cfe6ff'; g.fillText(lg[i][1], lx, ry); lx -= w + 6 * dpr; g.fillStyle = lg[i][0]; g.fillRect(lx - 14 * dpr, ry - 6 * dpr, 12 * dpr, 4 * dpr); lx -= 22 * dpr; }
    if (dragN >= 0) { const n = design.nodes[dragN]; g.textAlign = 'left'; g.font = `700 ${13 * dpr}px "Courier Prime"`; g.fillStyle = L2.st.gmax > 5 ? '#ff6b57' : '#f2b33d'; g.fillText(`${L2.st.gmax.toFixed(1)} g peak${L2.ok ? '' : ' · ✗'}`, sx(n.x) + 18 * dpr, sy(n.y) + 26 * dpr); } }
  // scale bar and top view
  g.fillStyle = '#cfe6ff'; g.font = `${12 * dpr}px "Courier Prime"`; g.textAlign = 'left'; const bx = W - 140 * dpr, by = (playRect().b - 30) * dpr;
  g.fillRect(bx, by, 10 * cam.s, 2 * dpr); g.fillText('10 m', bx, by - 5 * dpr);
  if (!play && scrubI >= 0 && S[scrubI]) { const p = S[scrubI], X = sx(p.x), Y = sy(p.y); g.strokeStyle = '#f2b33d'; g.lineWidth = 2.5 * dpr; g.beginPath(); g.arc(X, Y, 9 * dpr, 0, 7); g.stroke();
    if (R && R.gs[scrubI] != null) { g.fillStyle = '#f2b33d'; g.font = `700 ${12 * dpr}px "Courier Prime"`; g.textAlign = 'center'; g.fillText(`${R.gs[scrubI].toFixed(1)} g · ${Math.round(R.v[scrubI] * 3.6)} km/h`, X, Y - 16 * dpr); } }
  drawStrip(S, R);
  if (innerWidth >= 860) { const above = innerHeight - stripBox().t + 14; pv.style.bottom = above + 'px'; $('povL').style.bottom = above + 196 + 'px'; } // the front-seat inset sits above the g diagram, not on it
  drawTop(S);
}
function drawStrip(S, R) { // seat g against distance along the track, with the curvature faintly behind; node ticks; the train's place
  const B = stripBox(), L0 = B.l * dpr, l = (B.l + B.ax) * dpr, r = B.r * dpr, b = B.b * dpr, h = B.h * dpr, t = b - h, n = S.length, mini = stripMin();
  g.fillStyle = 'rgba(13,44,82,.9)'; g.fillRect(L0, t - 2 * dpr, r - L0, h + 4 * dpr); g.strokeStyle = 'rgba(207,230,255,.35)'; g.lineWidth = 1 * dpr; g.strokeRect(L0, t - 2 * dpr, r - L0, h + 4 * dpr);
  const lo = -2, hi = 6, gx = i => l + (r - l) * i / Math.max(1, n - 1), gy = v => b - (clamp(v, lo, hi) - lo) / (hi - lo) * h;
  // bands: airtime (green) and what this commission forbids (red)
  g.fillStyle = 'rgba(63,210,122,.16)'; g.fillRect(l, gy(AIR), r - l, b - gy(AIR));
  const q = C.req || {}, top = q.gmax || 5, bot = q.gmin; g.fillStyle = 'rgba(255,75,58,.18)'; g.fillRect(l, t, r - l, gy(top) - t); if (bot != null) g.fillRect(l, gy(bot), r - l, b - gy(bot));
  const fs = mini ? 9 : 11; g.font = `${fs * dpr}px "Courier Prime"`; g.textAlign = 'right';
  for (const [v, c, lab] of [[0, 'rgba(124,242,255,.6)', '0 g'], [1, 'rgba(207,230,255,.3)', '+1 g'], [3.5, 'rgba(255,162,90,.5)', '+3.5'], [5, 'rgba(255,75,58,.6)', '+5 g'], [-1, 'rgba(124,242,255,.3)', '−1 g']]) {
    g.fillStyle = c; g.fillRect(l, gy(v), r - l, 1 * dpr); if (!mini || v === 0) { g.fillStyle = '#cfe6ff'; g.fillText(lab, mini ? l + 26 * dpr : l - 4 * dpr, gy(v) + 4 * dpr); } }
  if (!mini) { g.textAlign = 'left'; g.font = `${10 * dpr}px "Courier Prime"`; g.fillStyle = '#3fd27a'; g.fillText('airtime', l + 4 * dpr, b - 4 * dpr); if (q.gmax) { g.fillStyle = '#ff8a7a'; g.fillText(`over ${q.gmax} g: too much for this ride`, l + 4 * dpr, gy(top) - 4 * dpr); } }
  // node ticks
  g.fillStyle = 'rgba(207,230,255,.5)'; let seg = -1; for (let i = 0; i < n; i++) if (S[i].seg !== seg) { seg = S[i].seg; g.fillRect(gx(i), b - 4 * dpr, 1 * dpr, 4 * dpr); }
  // curvature (faint): |κ| scaled so a 4 m radius fills the strip
  g.strokeStyle = 'rgba(207,230,255,.35)'; g.beginPath(); for (let i = 0; i < n; i += 2) { const y = b - clamp(Math.abs(S[i].k || 0) * 4, 0, 1) * h; i ? g.lineTo(gx(i), y) : g.moveTo(gx(i), y); } g.stroke();
  if (R && R.gs.length) { const lift = design.lift ?? 1; g.fillStyle = 'rgba(63,210,122,.28)'; for (let i = 0; i < R.gs.length; i++) if (R.gs[i] < AIR && S[R.idx[i]].seg >= lift) g.fillRect(gx(R.idx[i]) - 1 * dpr, t, 2 * dpr + (r - l) / n, h); // the moments of airtime
    g.lineWidth = 2 * dpr; for (let i = 1; i < R.gs.length; i++) { const v = R.gs[i]; g.strokeStyle = v > 5 ? '#ff4b3a' : v > 3.5 ? '#ffa25a' : v < .2 ? '#7cf2ff' : '#ffffff'; g.beginPath(); g.moveTo(gx(R.idx[i - 1]), gy(R.gs[i - 1])); g.lineTo(gx(R.idx[i]), gy(v)); g.stroke(); } }
  // the front and back rows, thin, at their own place on the track: the back row is whipped over crests faster
  if (R && R.gs.length && !mini) { for (const [off, col, lab, yy] of [[0, 'rgba(154,208,255,.75)', 'front row', 36], [TRAIN.len, 'rgba(255,207,138,.8)', 'back row', 48]]) { const q = seatSeries(R, off);
      g.strokeStyle = col; g.lineWidth = 1 * dpr; g.beginPath(); q.gs.forEach((v, i) => { const X = gx(q.idx[i]), Y = gy(v); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke();
      g.fillStyle = col; g.textAlign = 'right'; g.font = `${10 * dpr}px "Courier Prime"`; g.fillText(`— ${lab} ${q.air.toFixed(1)} s air`, r - 4 * dpr, t + yy * dpr); } }
  if (R && R.gl && R.gl.some(v => Math.abs(v) > .05)) { g.strokeStyle = '#d58cff'; g.lineWidth = 1.5 * dpr; g.setLineDash([4 * dpr, 3 * dpr]); g.beginPath(); R.gl.forEach((v, i) => { const X = gx(R.idx[i]), Y = gy(Math.abs(v)); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); g.setLineDash([]);
    if (!mini) { g.fillStyle = '#d58cff'; g.textAlign = 'right'; g.font = `${10 * dpr}px "Courier Prime"`; g.fillText('- - sideways g', r - 4 * dpr, t + 24 * dpr); } }
  g.fillStyle = '#cfe6ff'; g.textAlign = 'right'; g.font = `${(mini ? 9 : 11) * dpr}px "Courier Prime"`; g.fillText((R ? 'seat g (middle, judged) · curvature' : 'curvature') + (mini ? '  ▴ g' : '  ▾'), r - 4 * dpr, t + (mini ? 9 : 11) * dpr);
  if (play) { g.fillStyle = '#e2493b'; g.fillRect(gx(play.i) - 1 * dpr, t, 2 * dpr, h); }
  if (!play && scrubI >= 0 && scrubI < n) { g.fillStyle = '#f2b33d'; g.fillRect(gx(scrubI) - 1 * dpr, t, 2 * dpr, h); }
  if (sel >= 0 && !play) { const i0 = S.findIndex(p => p.seg >= sel); if (i0 >= 0) { g.fillStyle = '#ff6b57'; g.fillRect(gx(sel >= design.nodes.length - 1 ? n - 1 : i0) - 1 * dpr, t, 2 * dpr, h); } }
}
function drawTop(S) { // plan view in the corner
  const mob = innerWidth < 860, fp = footprint(S), sz = (mob ? 72 : 110) * dpr, k = Math.min(sz / fp.w, sz / fp.d) * .9; let mx = 1e9, mz = 1e9; for (const p of S) { mx = Math.min(mx, p.X); mz = Math.min(mz, p.Z); }
  // desktop: the top-right corner; phones: bottom-left of the drawing, just above the g diagram (the turns show in plan)
  const ox = mob ? (playRect().l + 8) * dpr : W - sz - 14 * dpr, oy = mob ? (stripBox().t - 16) * dpr - sz - 28 * dpr : 14 * dpr;
  if ($('gauge').style.display === 'block' && !mob) return;
  g.fillStyle = 'rgba(13,44,82,.8)'; g.fillRect(ox - 6 * dpr, oy - 6 * dpr, sz + 12 * dpr, sz + 28 * dpr); g.strokeStyle = 'rgba(207,230,255,.5)'; g.strokeRect(ox - 6 * dpr, oy - 6 * dpr, sz + 12 * dpr, sz + 28 * dpr);
  g.strokeStyle = '#ffffff'; g.lineWidth = 2 * dpr; g.beginPath(); S.forEach((p, i) => { const X = ox + (p.X - mx + 2) * k, Y = oy + (p.Z - mz + 2) * k; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke();
  const at = i => [ox + (S[i].X - mx + 2) * k, oy + (S[i].Z - mz + 2) * k]; { const [a, b] = at(0); g.fillStyle = '#f2b33d'; g.beginPath(); g.arc(a, b, 3.5 * dpr, 0, 7); g.fill(); }
  if (play && S[play.i]) { const [a, b] = at(play.i); g.fillStyle = '#e2493b'; g.beginPath(); g.arc(a, b, 4 * dpr, 0, 7); g.fill(); }
  g.fillStyle = '#cfe6ff'; g.font = `${(mob ? 10 : 11) * dpr}px "Courier Prime"`; g.textAlign = 'left'; g.fillText(`plan ${Math.round(fp.w)}×${Math.round(fp.d)} m`, ox, oy + sz + 16 * dpr);
}

// ================= POV: the front seat =================
const pv = $('pov'), pg = pv.getContext('2d');
function drawPOV(i) {
  const S = design.S, p = S[i]; if (!p) return; const Wp = pv.width, Hp = pv.height;
  const ahead = S[Math.min(S.length - 1, i + 4)], fx = ahead.X - p.X, fz = ahead.Z - p.Z, fy = ahead.y - p.y, fl = Math.hypot(fx, fy, fz) || 1;
  const F = [fx / fl, fy / fl, fz / fl], Rr = [-F[2], 0, F[0]], rl = Math.hypot(Rr[0], Rr[2]) || 1; Rr[0] /= rl; Rr[2] /= rl;
  const U = [Rr[1] * F[2] - Rr[2] * F[1], Rr[2] * F[0] - Rr[0] * F[2], Rr[0] * F[1] - Rr[1] * F[0]];
  if (U[1] < 0 && Math.cos(p.th) > 0) { U[0] *= -1; U[1] *= -1; U[2] *= -1; }
  const roll = -p.bank * Math.sign(p.kh || 0);
  const cam = [p.X, p.y + 1.6, p.Z];
  const proj = (X, Y, Z) => { const d = [X - cam[0], Y - cam[1], Z - cam[2]], z = d[0] * F[0] + d[1] * F[1] + d[2] * F[2]; if (z < .3) return null; let x = d[0] * Rr[0] + d[1] * Rr[1] + d[2] * Rr[2], y = d[0] * U[0] + d[1] * U[1] + d[2] * U[2];
    const c = Math.cos(roll), s = Math.sin(roll); [x, y] = [x * c - y * s, x * s + y * c]; return [Wp / 2 + x / z * Wp * .7, Hp / 2 - y / z * Wp * .7]; };
  // sky and ground split by the horizon
  const hz = proj(cam[0] + F[0] * 1000, cam[1], cam[2] + F[2] * 1000), hy = hz ? clamp(hz[1], -Hp, 2 * Hp) : (F[1] > 0 ? 2 * Hp : -Hp);
  pg.fillStyle = '#8fc7e8'; pg.fillRect(0, 0, Wp, Hp); pg.fillStyle = '#6d9a4c'; pg.fillRect(0, hy, Wp, Hp * 3);
  pg.strokeStyle = '#3a2a1a'; pg.lineWidth = 3;
  for (const side of [-1, 1]) { pg.beginPath(); let on = false; for (let k = i; k < Math.min(S.length, i + 220); k += 2) { const q = S[k], nx = -Math.sin(q.head), nz = Math.cos(q.head);
      const P = proj(q.X + nx * side * .7, q.y, q.Z + nz * side * .7); if (!P) { on = false; continue; } on ? pg.lineTo(P[0], P[1]) : pg.moveTo(P[0], P[1]); on = true; } pg.stroke(); }
  pg.strokeStyle = 'rgba(80,50,20,.6)'; pg.lineWidth = 2; for (let k = i + 2; k < Math.min(S.length, i + 120); k += 4) { const q = S[k], nx = -Math.sin(q.head), nz = Math.cos(q.head), a = proj(q.X - nx, q.y, q.Z - nz), b = proj(q.X + nx, q.y, q.Z + nz); if (a && b) { pg.beginPath(); pg.moveTo(a[0], a[1]); pg.lineTo(b[0], b[1]); pg.stroke(); } }
  // grey-out / black-out vignette
  const gg = play && last.r.gs[i] || 1; const dim = clamp((gg - 4.5) / 1.5, 0, 1); if (dim > 0) { pg.fillStyle = `rgba(0,0,0,${dim * .85})`; pg.fillRect(0, 0, Wp, Hp); }
  if (gg < 0) { pg.fillStyle = 'rgba(255,255,255,.12)'; pg.fillRect(0, 0, Wp, Hp); }
  pg.fillStyle = '#e2493b'; pg.fillRect(0, Hp - 26, Wp, 26); pg.fillStyle = '#f4e8cc'; pg.font = '16px "Courier Prime"'; pg.fillText(`${Math.round(play ? last.r.v[i] * 3.6 : 0)} km/h  ${(gg).toFixed(1)} g`, 10, Hp - 8);
}

// ================= editing =================
function snapshot() { history.push(JSON.stringify(design.nodes)); if (history.length > 50) history.shift(); }
function changed() { design.S = null; design.T = null; last = null; scrubI = -1; if (!play) { $('result').style.display = 'none'; $('gauge').style.display = 'none'; } /* the last ride's verdict no longer describes this track */ predict(true); SAVE.designs[C.id] = enc(design); persist(); renderReq(); renderTools(); kick(); }
const touched = () => { design.S = null; design.T = null; last = null; predict(); kick(); };
const ptrs = new Map(); let dragN = -1, dragA = null, dragH = null, pan = null, pinch = null, selG = 0, guides = [];
const snapOn = () => SAVE.snap !== false;
function hitNode(px, py) { let best = -1, bd = 1e9; design.nodes.forEach((n, i) => { const d = Math.hypot(sx(n.x) - px, sy(n.y) - py); if (d < 24 * dpr && d < bd) { bd = d; best = i; } }); return best; }
// tangent arms of the selected node, drawn like Bézier handles: P ± D·h/3 (h = chord to the neighbour on that side)
function arms(i) {
  const ns = design.nodes; if (i < 0 || i >= ns.length) return null; const T = design.T || (design.T = tangents(ns)), D = T.D[i], P = ns[i];
  const hb = i > 0 ? T.h[i - 1] : 0, hf = i < ns.length - 1 ? T.h[i] : 0;
  return { D, hb, hf, back: hb ? [P.x - D[0] * hb / 3, P.y - D[1] * hb / 3] : null, front: hf ? [P.x + D[0] * hf / 3, P.y + D[1] * hf / 3] : null };
}
function hitArm(px, py) { const A = arms(sel); if (!A) return null; for (const side of ['front', 'back']) { const q = A[side]; if (q && Math.hypot(sx(q[0]) - px, sy(q[1]) - py) < 16 * dpr) return side; } return null; }
// group helpers: a stamped element is a run of nodes tagged with the same group id g; its first node keeps the recipe (el)
const groupOf = id => { const ix = []; design.nodes.forEach((n, i) => { if (n.g === id) ix.push(i); }); return ix; };
const groups = () => design.nodes.filter(n => n.el && n.g).map(n => n.el);
function unGroup(id, quiet) { let any = false; for (const n of design.nodes) if (n.g === id) { delete n.g; delete n.el; any = true; } if (any && !quiet) toast('Converted to plain nodes: shape it point by point.'); if (selG === id) selG = 0; return any; }
function hitHandle(px, py) { for (const el of groups()) { const H = handleOf(el); if (H && Math.hypot(H[0] - px, H[1] - py) < 20 * dpr) return el; } return null; }
let scrubI = -1, scrubbing = false;
function stripAt(cx, cy) { const B = stripBox(); return cx >= B.l && cx <= B.r && cy >= B.t - 4 && cy <= B.b + 4 ? B : null; }
function scrubTo(cx) { const B = stripBox(), S = design.S || (design.S = geometry(design)), i = Math.round(clamp((cx - B.l - B.ax) / (B.r - B.l - B.ax), 0, 1) * (S.length - 1));
  if (play) { const R = last.r, k = R.idx.findIndex(x => x >= i); if (k >= 0) { play.k = k; play.simT = R.t[k]; play.f = 0; play.i = R.idx[k]; V3.cg = null; } } // the ride jumps there
  else { scrubI = i; follow(S[i].x); } kick(); }
cv.addEventListener('pointerdown', e => {
  { const B = stripAt(e.clientX, e.clientY); if (B) { // the g diagram: ▾ folds it; elsewhere a tap (or drag) scrubs to that point of the track
      if (e.clientX > B.r - 70 && e.clientY < B.t + 16) { SAVE.stripMin = !stripMin(); persist(); fit(); kick(); return; }
      scrubbing = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} scrubTo(e.clientX); return; } }
  scrubI = -1;
  if (play) return; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX * dpr, y: e.clientY * dpr });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s, ox: cam.ox, oy: cam.oy, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; dragN = -1; dragA = dragH = null; pan = null; return; }
  const px = e.clientX * dpr, py = e.clientY * dpr, arm = sel >= 0 ? hitArm(px, py) : null;
  if (arm) { dragA = arm; snapshot(); FX.sfx('tick'); kick(); return; }
  const hd = hitHandle(px, py);
  if (hd) { dragH = { el: hd, h0: hd.h, w0: hd.w, x: wx(px), y: wy(py) }; selG = hd.id; sel = -1; snapshot(); renderInsp(); closeDrawer(); FX.sfx('tick'); kick(); return; }
  { const R = (last && last.r) || (live && live.r), c = R && crests(design.S || geometry(design), R).find(c => Math.hypot(sx(c.x) - px, sy(c.y) - 20 * dpr - py) < 11 * dpr); if (c) { toast(crestText(c)); FX.sfx('tick'); kick(); return; } } // a crest's dot: what it needs for airtime
  const h = hitNode(px, py);
  if (h >= 0) { dragN = h; dragN0 = { x: design.nodes[h].x, y: design.nodes[h].y, moved: false }; sel = h; selG = design.nodes[h].g || 0; snapshot(); renderInsp(); closeDrawer(); FX.sfx('tick'); kick(); return; }
  sel = -1; selG = 0; renderInsp(); closeDrawer(); pan = { x: px, y: py, ox: cam.ox, oy: cam.oy }; kick();
});
let dragN0 = null;
// snapping while a node moves: level with a neighbour, the same height as any other node, or halfway between its neighbours
function snapNode(i, x, y) {
  guides = []; if (!snapOn()) return [x, y]; const ns = design.nodes, tol = 9 * dpr / cam.s;
  let by = null, bd = tol;
  ns.forEach((m, k) => { if (k === i) return; const near = Math.abs(k - i) === 1, d = Math.abs(m.y - y) / (near ? 1.4 : 1); if (d < bd) { by = { y: m.y, k, near }; bd = d; } }); // neighbours pull a little harder
  if (by) { y = by.y; guides.push({ t: 'h', y, x0: Math.min(x, ns[by.k].x), x1: Math.max(x, ns[by.k].x), lab: by.near ? 'level' : 'same height' }); }
  if (i > 0 && i < ns.length - 1) { const a = ns[i - 1], b = ns[i + 1], mx = (a.x + b.x) / 2; if (a.x < x && x < b.x && Math.abs(x - mx) < tol) { x = mx; guides.push({ t: 'v', x, y0: Math.min(a.y, b.y, y), y1: Math.max(a.y, b.y, y), lab: 'symmetric' }); } }
  return [x, y];
}
cv.addEventListener('pointermove', e => {
  if (scrubbing) { scrubTo(e.clientX); return; }
  const p = ptrs.get(e.pointerId); if (!p) return; p.x = e.clientX * dpr; p.y = e.clientY * dpr;
  if (pinch && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), s = clamp(pinch.s * d / pinch.d, .4 * dpr, 12 * dpr);
    const wx0 = (pinch.cx - pinch.ox) / pinch.s, wy0 = (pinch.oy - pinch.cy) / pinch.s; cam.s = s; cam.ox = pinch.cx - wx0 * s; cam.oy = pinch.cy + wy0 * s; kick(); return; }
  if (dragA) { dragArm(sel, dragA, wx(p.x), wy(p.y)); touched(); return; }
  if (dragH) { reshape(dragH, wx(p.x), wy(p.y)); touched(); return; }
  if (dragN >= 0) { const n = design.nodes[dragN]; let x = Math.round(wx(p.x) * 2) / 2, y = Math.max(dragN === 0 ? 0 : -2, Math.round(wy(p.y) * 2) / 2);
    if (!dragN0.moved && (Math.abs(x - dragN0.x) + Math.abs(y - dragN0.y)) > 0) { dragN0.moved = true; if (n.g) unGroup(n.g); }
    [x, y] = snapNode(dragN, x, y); n.x = x; n.y = y; if (dragN === 0) n.x = Math.min(n.x, design.nodes[1].x - 4); touched(); return; }
  if (pan) { cam.ox = pan.ox + p.x - pan.x; cam.oy = pan.oy + p.y - pan.y; kick(); }
});
const up = e => { scrubbing = false; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (dragN >= 0 || dragA || dragH) { dragN = -1; dragA = dragH = null; guides = []; changed(); renderInsp(); } pan = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); const s = clamp(cam.s * Math.exp(-e.deltaY * .0015), .4 * dpr, 12 * dpr), px = e.clientX * dpr, py = e.clientY * dpr, x = wx(px), y = wy(py); cam.s = s; cam.ox = px - x * s; cam.oy = py + y * s; kick(); }, { passive: false });
// a tangent arm sets the node's own direction and strength (a pinned tangent); snaps level and plumb
function dragArm(i, side, x, y) {
  const ns = design.nodes, n = ns[i], A = arms(i); if (!A) return; let dx = x - n.x, dy = y - n.y; if (side === 'back') { dx = -dx; dy = -dy; }
  const h = side === 'back' ? A.hb : A.hf; let D = [dx * 3 / h, dy * 3 / h]; const L = Math.max(.25, Math.min(3, Math.hypot(...D)));
  let a = Math.atan2(D[1], D[0]); guides = [];
  if (snapOn()) for (const t of [0, Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI]) if (Math.abs(a - t) < .07) { a = t; guides.push({ t: 'a', lab: Math.abs(t) === Math.PI / 2 ? 'vertical' : 'level' }); }
  if (n.g) unGroup(n.g); n.t = { x: Math.round(Math.cos(a) * L * 100) / 100, y: Math.round(Math.sin(a) * L * 100) / 100 };
}
function addNode() { // a new hump after the selected node (or before the end)
  snapshot(); const i = sel >= 0 && sel < design.nodes.length - 1 ? sel : design.nodes.length - 2, a = design.nodes[i], b = design.nodes[i + 1];
  if (a.g && a.g === b.g) unGroup(a.g, true);
  design.nodes.splice(i + 1, 0, N((a.x + b.x) / 2, Math.max(a.y, b.y) * .7 + 4)); sel = i + 1; selG = 0; changed(); renderInsp(); FX.sfx('place');
}
function delNode() { if (sel <= 0 || sel >= design.nodes.length - 1 || design.nodes.length <= 3) return; snapshot(); const n = design.nodes[sel]; if (n.g) unGroup(n.g, true); design.nodes.splice(sel, 1); sel = -1; changed(); renderInsp(); FX.sfx('pop'); }
function undo() { if (!history.length) return; design.nodes = JSON.parse(history.pop()); sel = -1; selG = 0; changed(); renderInsp(); FX.sfx('click'); }

// ================= elements: stamps with handles =================
// A stamp writes ordinary nodes after the selected node (everything after it slides along) and tags them as a group.
// Its diamond handle re-shapes the whole group with two numbers: drag up/down for h, sideways for w.
// Drag any of its nodes (or press Convert) and it becomes plain nodes you shape point by point.
const ELS = {
  loop:  { n: 'Loop', i: '➰', h: 22, w: .95, H: ['height', v => v.toFixed(0) + ' m'], Wd: ['tightness', v => Math.round(v * 100) + '%'], hr: [10, 45], wr: [0, 1.05], kw: .03 },
  hill:  { n: 'Airtime hill', i: '⌒', h: 10, w: 64, H: ['height', v => v.toFixed(0) + ' m'], Wd: ['length', v => v.toFixed(0) + ' m'], hr: [2, 45], wr: [14, 110], kw: 2 },
  drop:  { n: 'Drop', i: '↘', h: 16, w: 30, H: ['depth', v => v.toFixed(0) + ' m'], Wd: ['length', v => v.toFixed(0) + ' m'], hr: [2, 60], wr: [10, 90], kw: 1, kh: -1 },
  turn:  { n: 'Banked turn', i: '↩', h: 0, w: 14, H: ['bank trim', v => (v > 0 ? '+' : '') + v.toFixed(0) + '°'], Wd: ['radius', v => v.toFixed(0) + ' m'], hr: [-20, 20], wr: [8, 40], kw: 2 / Math.PI, kh: 1 },
  helix: { n: 'Helix', i: '🌀', h: 6, w: 12, H: ['descent', v => v.toFixed(0) + ' m'], Wd: ['radius', v => v.toFixed(0) + ' m'], hr: [0, 24], wr: [8, 30], kw: 1 / Math.PI, kh: -1 },
};
// a clothoid-style loop: curvature grows steadily with the heading turned, up to the top and back down:
// κ(θ) ∝ (1 − m) + m·θ/π. m = 0 is a circle (the classic mistake); m near 1 is a tall teardrop that enters with almost no
// curvature and saves the tight radius for the top, where the train is slow. Integrated, scaled to the height, and sampled at every 60° of heading: seven nodes.
function loopShape(H, w) {
  const m = .9 * w, pts = [], n = 2160; let x = 0, y = 0, top = 0;
  for (let k = 0; k < n; k++) { if (k % (n / 6) === 0) pts.push([x, y]); const th = (k + .5) / n * 2 * Math.PI, tn = Math.min(th, 2 * Math.PI - th) / Math.PI, ds = 2 * Math.PI / n / ((1 - m) + m * tn); x += Math.cos(th) * ds; y += Math.sin(th) * ds; top = Math.max(top, y); }
  pts.push([x, y]); const s = H / top; return pts.map(([a, b]) => [a * s, b * s]);
}
function build(el, a) {
  const E = ELS[el.t], h = el.h, w = el.w, ground = x => site.terrain(x) + 1;
  if (el.t === 'loop') { const P = loopShape(h, w), bx = a.x + Math.max(10, h * .55); // runs in at the anchor's height
    const ns = P.map(([x, y]) => N(Math.round((bx + x) * 2) / 2, Math.round((a.y + y) * 2) / 2)); return { nodes: ns, hd: [ns[3].x, ns[3].y], up: 1 }; }
  if (el.t === 'hill') { const ns = [[.25, .5], [.5, 1], [.75, .5], [1, 0]].map(([u, v]) => N(Math.round((a.x + u * w) * 2) / 2, Math.round((a.y + v * h) * 2) / 2)); return { nodes: ns, hd: [ns[1].x, ns[1].y], up: 1 }; }
  if (el.t === 'drop') { const yb = Math.max(ground(a.x + w), a.y - h), d = a.y - yb; const ns = [[.5, .5], [1, 1], [1.45, 1]].map(([u, v]) => N(Math.round((a.x + u * w) * 2) / 2, Math.round((a.y - v * d) * 2) / 2)); return { nodes: ns, hd: [ns[1].x, ns[1].y], up: -1 }; }
  if (el.t === 'turn') { const x0 = a.x + 6, L = Math.PI * w; return { nodes: [N(x0, a.y, { r: Math.round(w), ab: 1, bt: Math.round(h), bank: 0 }), N(Math.round((x0 + L) * 2) / 2, a.y)], hd: [x0 + L / 2, a.y], up: 1 }; }
  if (el.t === 'helix') { const x0 = a.x + 6, L = 2 * Math.PI * w, yb = Math.max(ground(x0 + L), a.y - h); return { nodes: [N(x0, a.y, { r: Math.round(w), ab: 1, bt: 0, bank: 0 }), N(Math.round((x0 + L) * 2) / 2, Math.round(yb * 2) / 2)], hd: [x0 + L / 2, (a.y + yb) / 2], up: 1 }; }
}
function handleOf(el) { // in screen pixels: a little clear of the element so it never sits on a node
  const ix = groupOf(el.id); if (!ix.length || ix[0] < 1) return null; const B = build(el, design.nodes[ix[0] - 1]); return [sx(B.hd[0]), sy(B.hd[1]) - B.up * 26 * dpr]; }
function place(i, el, fresh) { // (re)write the group after anchor i; the nodes after it slide by the change in length
  const ns = design.nodes, a = ns[i]; let j = i + 1, oldEnd = a.x;
  if (!fresh) { while (j < ns.length && ns[j].g === el.id) j++; oldEnd = ns[j - 1].x; }
  const B = build(el, a); B.nodes.forEach(n => n.g = el.id); B.nodes[0].el = el;
  const delta = B.nodes[B.nodes.length - 1].x - oldEnd; for (let k = j; k < ns.length; k++) ns[k].x += delta;
  ns.splice(i + 1, j - i - 1, ...B.nodes);
}
let gidN = 1;
// an airtime hill sized for where it goes: about 40% of the height the train's speed there can climb, rounded just tightly
// enough over the top for a gentle float (seat g ≈ −0.1). A cosine hump of height h and length w has crest radius w²/(2π²h).
function hillFor(a) {
  const R = live && live.r, S = design.S || geometry(design); let v = 0;
  if (R) { const j = S.findIndex(p => p.x >= a.x); if (j >= 0 && R.v[j] != null) v = R.v[j]; }
  if (v < 4) return {}; // the train never gets here (or barely moves): the plain default
  const E = ELS.hill, h = clamp(.4 * v * v / (2 * G), E.hr[0], 12), vt2 = Math.max(4, (v * v - 2 * G * h) * .9);
  return { h: Math.round(h * 2) / 2, w: Math.round(clamp(Math.sqrt(2 * Math.PI * Math.PI * h * vt2 / (1.1 * G)), E.wr[0], E.wr[1])) };
}
function stamp(t) {
  if (play) return; const ns = design.nodes; let i = sel >= 0 && sel < ns.length - 1 ? sel : ns.length - 2;
  while (i > 0 && ns[i].g && ns[i + 1] && ns[i + 1].g === ns[i].g) i++; // never inside another element: after it
  if (ns[i].g && ns[i + 1] && ns[i + 1].g === ns[i].g) i = ns.length - 2;
  snapshot(); gidN = Math.max(gidN, ...ns.map(n => n.g || 0)) + 1; const E = ELS[t], el = { t, id: gidN, h: E.h, w: E.w };
  if (t === 'hill') Object.assign(el, hillFor(ns[i]));
  place(i, el, true); sel = -1; selG = el.id; closeDrawer(); changed(); renderInsp(); FX.sfx('whoosh');
}
function reshape(D, x, y) { const el = D.el, E = ELS[el.t], ix = groupOf(el.id); if (!ix.length) return;
  el.h = clamp(D.h0 + (y - D.y) * (E.kh || 1), ...E.hr); el.w = clamp(D.w0 + (x - D.x) * E.kw, ...E.wr); place(ix[0] - 1, el, false); }
function delGroup(id) { const ix = groupOf(id); if (!ix.length) return; snapshot(); const ns = design.nodes, a = ns[ix[0] - 1], end = ns[ix[ix.length - 1]].x, delta = end - a.x; ns.splice(ix[0], ix.length); for (let k = ix[0]; k < ns.length; k++) ns[k].x -= delta; selG = 0; sel = -1; changed(); renderInsp(); FX.sfx('pop'); }
// relax curvature: each node moves halfway toward the cubic through its two neighbours on each side (hills keep their shape,
// kinks and dents iron out). Over the selection (±2 nodes) or the whole ride; loops and the lift crest are left alone.
function smooth() {
  if (play) return; const ns = design.nodes, n = ns.length; if (n < 5) return; snapshot();
  const a = sel > 0 ? Math.max(2, sel - 2) : 2, b = sel > 0 ? Math.min(n - 3, sel + 2) : n - 3; let moved = 0;
  for (let it = 0; it < 4; it++) { const Y = ns.map(q => q.y);
    for (let i = a; i <= b; i++) { const ks = [i - 2, i - 1, i + 1, i + 2], X = ns.map(q => q.x); if (!(X[i - 2] < X[i - 1] && X[i - 1] < X[i] && X[i] < X[i + 1] && X[i + 1] < X[i + 2])) continue;
      let t = 0; for (const k of ks) { let l = 1; for (const m of ks) if (m !== k) l *= (X[i] - X[m]) / (X[k] - X[m]); t += l * Y[k]; }
      const ny = Math.max(site.terrain(X[i]) + 1, ns[i].y + .5 * (t - ns[i].y)); if (Math.abs(ny - ns[i].y) > .01) { if (ns[i].g) unGroup(ns[i].g, true); ns[i].y = Math.round(ny * 2) / 2; delete ns[i].t; moved++; } } }
  changed(); toast(moved ? (sel > 0 ? 'Smoothed around the selected node.' : 'Smoothed the whole ride.') : 'Nothing to smooth there (loops are left alone).'); FX.sfx('click');
}
function renderInsp() {
  const el = $('insp');
  if (play) { el.style.display = 'none'; return; }
  const G0 = selG && groups().find(g => g.id === selG);
  if (G0 && sel < 0) { const E = ELS[G0.t]; el.style.display = 'flex';
    el.innerHTML = `<span>${E.i} ${E.n} · ${E.H[0]} <b>${E.H[1](G0.h)}</b> · ${E.Wd[0]} <b>${E.Wd[1](G0.w)}</b><br><small>drag ◆ up/down and sideways</small></span><button class="t" id="iConv" title="Turn it into plain nodes">Convert</button><button class="t" id="iDelG">Delete</button>`;
    $('iConv').onclick = () => { snapshot(); unGroup(G0.id); changed(); renderInsp(); }; $('iDelG').onclick = () => delGroup(G0.id); return; }
  if (sel < 0 || sel >= design.nodes.length) { el.style.display = 'none'; return; }
  const n = design.nodes[sel], lastN = sel >= design.nodes.length - 1; el.style.display = 'flex';
  el.innerHTML = `<span>Node ${sel}${sel === 0 ? ' (station)' : ''}</span>
    <button class="t${n.t ? '' : ' on'}" id="iAuto" title="Auto: the curve sets this node's slope smoothly. Drag the arms to pin your own.">${n.t ? 'Tangent: pinned · Auto' : 'Tangent: auto'}</button>
    ${lastN ? '' : `<label>turn R <input id="iR" type="range" min="0" max="60" step="2" value="${Math.abs(n.r || 0)}"><b id="iRv">${n.r ? Math.abs(n.r) + ' m' : 'straight'}</b></label>
    ${n.r ? `<button class="t" id="iDir" title="Turn the other way">${n.r > 0 ? '↰ left' : '↱ right'}</button><label>turns <input id="iA" type="range" min="15" max="360" step="15" value="${Math.round(turnAngle(sel) / 15) * 15}"><b id="iAv">${Math.round(turnAngle(sel))}°</b></label>
    <button class="t${n.ab ? ' on' : ''}" id="iAuto2" title="Auto: bank each point at atan(v²κ / g) so riders are pushed into the seat, not sideways">${n.ab ? 'Bank: auto' : 'Bank: manual'}</button>
    ${n.ab ? `<label>trim <input id="iT" type="range" min="-20" max="20" step="5" value="${n.bt || 0}"><b id="iTv">${(n.bt || 0) > 0 ? '+' : ''}${n.bt || 0}°</b></label>` : `<label>bank <input id="iB" type="range" min="0" max="80" step="5" value="${n.bank || 0}"><b id="iBv">${n.bank || 0}°</b></label>`}` : ''}`}
    ${sel > 0 && !lastN ? '<button class="t" id="iDel">Delete node</button>' : ''}`;
  $('iAuto').onclick = () => { if (!n.t) { toast('Drag the round arm ends to pin this node\'s slope.'); return; } snapshot(); delete n.t; changed(); renderInsp(); };
  if ($('iR')) { $('iR').oninput = e => { const v = +e.target.value, sg = n.r < 0 ? -1 : 1, was = !!n.r; n.r = v >= 8 ? v * sg : 0; if (n.r && !was) { n.ab = 1; n.bt = 0; } $('iRv').textContent = n.r ? Math.abs(n.r) + ' m' : 'straight'; touched(); };
    $('iR').onchange = () => { if (n.g) unGroup(n.g, true); changed(); renderInsp(); };
    const fin = () => { if (n.g) unGroup(n.g, true); changed(); };
    if ($('iB')) { $('iB').oninput = e => { n.bank = +e.target.value; $('iBv').textContent = n.bank + '°'; touched(); }; $('iB').onchange = fin; }
    if ($('iT')) { $('iT').oninput = e => { n.bt = +e.target.value; $('iTv').textContent = (n.bt > 0 ? '+' : '') + n.bt + '°'; touched(); }; $('iT').onchange = fin; }
    if ($('iDir')) $('iDir').onclick = () => { snapshot(); n.r = -n.r; fin(); renderInsp(); };
    if ($('iAuto2')) $('iAuto2').onclick = () => { snapshot(); if (n.ab) { n.ab = 0; n.bank = Math.round(autoBankDeg(sel) / 5) * 5; } else { n.ab = 1; n.bt = 0; } fin(); renderInsp(); };
    if ($('iA')) { $('iA').oninput = e => { setTurnAngle(sel, +e.target.value); $('iAv').textContent = e.target.value + '°'; touched(); }; $('iA').onchange = fin; } }
  if ($('iDel')) $('iDel').onclick = delNode;
}
// how far a turn node's segment turns, from its ground length and radius; and setting it by sliding what follows
function turnAngle(i) { const ns = design.nodes, n = ns[i]; return n && n.r && ns[i + 1] ? (ns[i + 1].x - n.x) / Math.abs(n.r) * 180 / Math.PI : 0; }
function setTurnAngle(i, deg) { const ns = design.nodes, n = ns[i]; if (!n || !n.r || !ns[i + 1]) return; const want = n.x + deg * Math.PI / 180 * Math.abs(n.r), d = Math.round((want - ns[i + 1].x) * 2) / 2; for (let k = i + 1; k < ns.length; k++) ns[k].x += d; }
function autoBankDeg(i) { const R = live && live.r, S = design.S || geometry(design); let a = 0, c = 0; S.forEach((p, j) => { if (p.seg === i + 1 && R && R.gs[j] != null && p.ab) { a += p.bank; c++; } }); return c ? a / c * 180 / Math.PI : 45; }
// the "+" drawer: every element in one place, plus smoothing and snapping
function openDrawer() { const d = $('drawer'); if (d.style.display === 'flex') { closeDrawer(); return; } d.style.display = 'flex';
  d.innerHTML = Object.entries(ELS).map(([k, E]) => `<button class="t" id="e_${k}" title="Add a ${E.n.toLowerCase()} after the selected node">${E.i}<span class="sl">${E.n.split(' ').pop().replace(/^./, c => c.toUpperCase())}</span></button>`).join('')
    + `<button class="t" id="e_node" title="Add a plain node">•<span class="sl">Node</span></button><i class="sep"></i><button class="t" id="e_smooth" title="Relax the curvature around the selected node, or the whole ride">∿<span class="sl">Smooth</span></button><button class="t${snapOn() ? ' on' : ''}" id="e_snap" title="Snap nodes level, to the same height, and symmetric">⌗<span class="sl">Snap</span></button>`;
  for (const k in ELS) $('e_' + k).onclick = () => stamp(k);
  $('e_node').onclick = () => { closeDrawer(); addNode(); }; $('e_smooth').onclick = smooth;
  $('e_snap').onclick = () => { SAVE.snap = !snapOn(); persist(); $('e_snap').classList.toggle('on', snapOn()); };
  $('tPlus') && $('tPlus').classList.add('on'); }
function closeDrawer() { const d = $('drawer'); if (d) d.style.display = 'none'; $('tPlus') && $('tPlus').classList.remove('on'); }

// ================= riding =================
// The physics is solved once, sample by sample every DS metres (ride()). Playback only moves a clock along it:
// at 2x or 4x each frame walks through every physics sample it passes (substeps), so peaks are never skipped
// and the result is the same at any speed.
const SPEEDS = [1, 2, 4, 0];
function startRide() {
  if (innerWidth < 860 && !$('brief').classList.contains('mini')) { $('brief').classList.add('mini'); requestAnimationFrame(() => { fit(); kick(); }); } // phones: fold the story away once riding
  if (play) return; sel = -1; selG = 0; closeDrawer(); renderInsp(); $('result').style.display = 'none';
  last = scores(design, site); const R = last.r;
  play = { k: 0, f: 0, simT: 0, prev: performance.now(), speed: SPEEDS.includes(SAVE.speed) && SAVE.speed ? SAVE.speed : 1, peak: -9, low: 9, visited: 0, n: R.t.length, i: 0 };
  $('gauge').style.display = 'block';
  if (V3.want && window.THREE) v3Open(); else { pv.style.display = 'block'; $('povL').style.display = 'block'; }
  renderTools(); FX.sfx('click'); kick();
}
// advance a playback clock by dt seconds of ride time, visiting every physics sample on the way
const EYE = 1.5, LIFTX = 2.5; // the chain lift plays back 2.5x faster (playback only: the physics is untouched)
function advance(p, R, dt) {
  if (R.liftK == null) { const lift = design.lift ?? 1; R.liftK = Math.max(0, R.idx.findIndex(i => R.S[i].seg >= lift)); }
  p.simT += dt * (p.k < R.liftK ? LIFTX : 1);
  while (p.k < R.t.length - 1 && R.t[p.k + 1] <= p.simT) { p.k++; p.visited++; const g2 = R.gs[p.k]; if (g2 > p.peak) p.peak = g2; if (g2 < p.low) p.low = g2; }
  const t0 = R.t[p.k], t1 = R.t[Math.min(R.t.length - 1, p.k + 1)]; p.f = t1 > t0 ? clamp((p.simT - t0) / (t1 - t0), 0, 1) : 0;
  p.i = R.idx[p.k] ?? 0; return p.k >= R.t.length - 1;
}
function stepRide(now) {
  const R = last.r, dt = clamp((now - play.prev) / 1000, 0, .1); play.prev = now;
  const end = advance(play, R, play.fast ? 1e9 : dt * play.speed);
  const k = play.k, v = R.v[k] || 0, gg = R.gs[k] ?? 1, gl = R.gl[k] ?? 0;
  $('gV').textContent = Math.round(v * 3.6) + ' km/h'; $('gVb').style.width = clamp(v * 3.6 / 1.3, 0, 100) + '%';
  $('gG').textContent = gg.toFixed(1); $('gGb').style.width = clamp(gg / 7 * 100, 0, 100) + '%'; $('gGb').className = gg > 5 || gg < -1 ? 'hot' : '';
  $('gL').textContent = Math.abs(gl).toFixed(1);
  if (play.speed && !play.fast) {
    if (k < R.liftK) { if ((play.clack = (play.clack || 0) + play.visited - (play.lastV || 0)) >= 2) { play.clack = 0; FX.tone({ f: 1500, f2: 700, type: 'square', dur: .018, vol: .05 }); FX.tone({ f: 160, type: 'triangle', dur: .03, vol: .08 }); } }
    else if (Math.random() < .22) FX.tone({ noise: 1, f: 250 + v * 28, q: .5, dur: .14, vol: Math.min(.14, .01 + v * v / 7000) });
  }
  play.lastV = play.visited; if (V3.on) V3.dt = dt;
  if (end) { endRide(); return; }
  if (V3.on) v3Frame(play); else { follow(design.S[play.i].x); drawPOV(play.i); }
}
function cycleSpeed() { const i = SPEEDS.indexOf(play ? play.speed : 1); const s = SPEEDS[(i + 1) % SPEEDS.length]; if (play) { play.speed = s; play.prev = performance.now(); } if (s) SAVE.speed = s; persist(); renderTools(); FX.sfx('click'); }
function follow(x) { // keep the train (or the trouble spot) in view when the whole ride doesn't fit across the screen
  const Rr = playRect(), X = sx(x) / dpr; if (X < Rr.l + 40 || X > Rr.r - 60) cam.ox += ((Rr.l + (Rr.r - Rr.l) * .4) - X) * dpr;
}
function endRide() {
  const sc = last; play = null; v3Close();
  { const R2 = sc.r, at = R2.kink >= 0 ? R2.kink : R2.stall >= 0 ? R2.stall : R2.crash; if (at >= 0) follow(R2.S[at].x); } pv.style.display = 'none'; $('povL').style.display = 'none'; renderTools();
  if (!sc.ok) { toast(sc.r.kink >= 0 ? 'A kink tighter than 3 m: the steel cannot be bent that sharply. Spread the nodes out.' : sc.r.stall >= 0 ? 'The train stalled and rolled back. Lower that hill or start higher.' : 'The track hits the ground.', 1); FX.sfx('fail'); $('gauge').style.display = 'none'; renderReq(); kick(); return; }
  showResult(sc); kick();
}

function guests(sc) { // what riders say depends on what the ride actually did
  const st = sc.st, out = [], loop = st.inv > 0, low = sc.r.S.length ? 'dip' : 'dip';
  out.push(['Thrill seeker', loop ? (st.air > 1.5 ? 'Upside down AND floating? Again!' : 'The loop was the best bit.') : sc.thrill >= 70 ? 'That drop! Now give me a loop.' : sc.thrill >= 45 ? `Decent speed, ${Math.round(st.vmax * 3.6)} km/h. I want to go upside down.` : 'Yawn. My nan has ridden faster.']);
  out.push(['A family', st.gmax > 6 ? `Dad passed out at the bottom of the ${loop ? 'loop' : low}.` : st.gmax > 4 ? `The little one cried at the bottom of that ${loop ? 'loop' : low}.` : st.air > .8 ? 'The kids screamed with joy on the humps!' : 'Lovely and gentle. Bit dull?']);
  out.push(['The engineer', st.latmax > 1.2 ? `Riders slammed sideways at ${st.latmax.toFixed(1)} g. Bank your turns.` : st.gmax > 5 ? (loop ? `Peak ${st.gmax.toFixed(1)} g: a circle is the wrong shape for a loop. Make it taller than it is wide.` : `Peak ${st.gmax.toFixed(1)} g at the bottom of a dip: spread the nodes so the curve is gentler.`) : `Peak ${st.gmax.toFixed(1)} g, £${sc.cost}k. Tidy work.`]);
  return out;
}
let HIST = {};
function histogram(c) { // the field: 30 other drafters each start from a known good design and polish it for a while (only passing designs kept)
  if (HIST[c.id]) return HIST[c.id];
  const ref = REF[c.id]; if (!ref) return null; const r = RH.rng(7), out = [], s0 = c.site(), metric = sc => c.daily ? -dailyScore(sc) : sc.cost;
  for (let k = 0; k < 30; k++) { let d = { nodes: ref(), lift: 1 }, best = scores(d, s0); if (!checkReq(c, best).every(x => x[1])) continue; let m = metric(best);
    const effort = 4 + (k % 6) * 4; // some drafters stop early, some polish for longer
    for (let it = 0; it < effort; it++) { const nd = d.nodes.map(n => ({ ...n })), q = nd[1 + (r() * (nd.length - 1) | 0)]; q.x = Math.round((q.x + (r() - .5) * 3) * 2) / 2; q.y = Math.max(.5, Math.round((q.y + (r() - .5) * 3) * 2) / 2);
      const t = { nodes: nd, lift: 1 }, sc = scores(t, s0); if (checkReq(c, sc).every(x => x[1]) && metric(sc) <= m) { d = t; m = metric(sc); } }
    out.push(c.daily ? -m : m); }
  return HIST[c.id] = out;
}
function showResult(sc) {
  const rows = checkReq(C, sc), pass = rows.every(r => r[1]), el = $('result');
  let stars = 0, hist = histogram(C), mine = C.daily ? dailyScore(sc) : sc.cost, pct = null;
  if (pass) { stars = 1; if (hist && hist.length) { const better = C.daily ? hist.filter(x => x < mine).length : hist.filter(x => x > mine).length; pct = Math.round(better / hist.length * 100); if (pct >= 50) stars = 2; if (pct >= 85) stars = 3; } else stars = 3;
    SAVE.done[C.id] = Math.max(SAVE.done[C.id] || 0, stars); const b = SAVE.best[C.id]; if (!b || (C.daily ? mine > b : mine < b)) SAVE.best[C.id] = mine;
    if (C.daily) SAVE.dailyKey = dailySeed(); persist(); FX.sfx('win'); FX.shake(.3); }
  else FX.sfx('fail');
  el.style.display = 'block';
  el.innerHTML = `<h3>${pass ? 'Ride approved' : 'Back to the drawing board'}</h3>${pass ? `<div class="stars">${'★'.repeat(stars)}<s>${'★'.repeat(3 - stars)}</s></div>` : ''}
    <div class="scores"><div>thrill<b>${sc.thrill}</b></div><div>comfort<b>${sc.comfort}</b></div><div>cost<b>£${sc.cost}k</b></div><div>plan<b>${Math.round(sc.fp.w)}×${Math.round(sc.fp.d)}</b></div></div>
    <div style="font-family:'Courier Prime';font-size:13px">top ${Math.round(sc.st.vmax * 3.6)} km/h · peak ${sc.st.gmax.toFixed(1)} g · low ${sc.st.gmin.toFixed(1)} g · side ${sc.st.latmax.toFixed(1)} g · airtime ${sc.st.air.toFixed(1)} s · inversions ${sc.st.inv}</div>
    ${(() => { const f = seatSeries(sc.r, 0), b = seatSeries(sc.r, TRAIN.len); return `<div class="seats" style="font-size:12.5px;opacity:.85">Judged in the middle of the train. Front row: ${f.air.toFixed(1)} s airtime, peak ${f.gmax.toFixed(1)} g · back row: ${b.air.toFixed(1)} s, peak ${b.gmax.toFixed(1)} g</div>`; })()}
    <ul class="req">${rows.map(r => `<li class="${r[1] ? 'ok' : 'bad'}">${r[0]}</li>`).join('')}</ul>
    ${C.req.air || sc.st.air > 0 ? `<div class="airline" style="font-size:15px;margin:2px 0">${sc.st.air.toFixed(1)} s of airtime ${C.req.air ? (sc.st.air >= C.req.air ? '✓' : `✗ (needs ${C.req.air} s: the green dots on the drawing show which crests float)`) : '✓'}</div>` : ''}
    ${pass && hist && hist.length ? `<canvas id="hist" width="600" height="110"></canvas><div style="font-size:13px">${C.daily ? 'Score' : 'Cost'} against ${hist.length} designs by other drafters: better than ${pct}%.${C.daily ? ` Today's score: <b>${mine}</b> (best ${SAVE.best[C.id]}).` : ''}</div>` : ''}
    <div class="guests">${guests(sc).map(([w, q]) => `<div>${q}<em>${w}</em></div>`).join('')}</div>
    <div class="row3"><button class="t" id="rShare">Share design</button><button class="t" id="rEdit">Keep drafting</button>${pass && COMS.indexOf(C) < COMS.length - 1 ? '<button class="t ride" id="rNext">Next →</button>' : ''}</div>`;
  if ($('hist')) drawHist($('hist'), hist, mine, C.daily);
  $('rEdit').onclick = () => { el.style.display = 'none'; $('gauge').style.display = 'none'; kick(); };
  $('rShare').onclick = share;
  if ($('rNext')) $('rNext').onclick = () => { el.style.display = 'none'; loadCom(COMS.indexOf(C) + 1); };
  renderReq(); renderSel();
}
function drawHist(c, h, mine, higherBetter) {
  const x = c.getContext('2d'), Wc = c.width, Hc = c.height, lo = Math.min(...h, mine), hi = Math.max(...h, mine) + 1e-6, nb = 16, bins = new Array(nb).fill(0);
  for (const v of h) bins[Math.min(nb - 1, Math.floor((v - lo) / (hi - lo) * nb))]++; const mx = Math.max(...bins);
  x.fillStyle = '#123a66'; x.fillRect(0, 0, Wc, Hc);
  bins.forEach((b, i) => { const bw = Wc / nb; x.fillStyle = '#cfe6ff'; x.fillRect(i * bw + 2, Hc - 18 - b / mx * (Hc - 30), bw - 4, b / mx * (Hc - 30)); });
  const mxp = (mine - lo) / (hi - lo) * Wc; x.fillStyle = '#ff6b57'; x.fillRect(mxp - 2, 6, 4, Hc - 24); x.fillStyle = '#f4e8cc'; x.font = '15px "Courier Prime"';
  x.fillText(higherBetter ? 'score →' : '← cheaper', 6, Hc - 3); x.textAlign = 'right'; x.fillText('you', Math.min(Wc - 4, mxp + 30), 20);
}
function share() { const url = location.href.split('#')[0] + `#c=${C.id}&d=${enc(design)}`; try { window.history.replaceState(null, '', url); } catch (e) {}
  const no = () => toast('Could not copy here: the design link is in the address bar.'); try { navigator.clipboard.writeText(url).then(() => toast('Design link copied to the clipboard.'), no); } catch (e) { no(); } }

// ================= UI =================
function toast(m, bad) { const t = document.createElement('div'); t.className = 'tc' + (bad ? ' bad' : ''); t.innerHTML = m; $('toastC').appendChild(t); setTimeout(() => t.remove(), 3400); while ($('toastC').children.length > 2) $('toastC').firstChild.remove(); }
function renderTools() {
  $('tools').innerHTML = play ? `<button class="t" id="tSpd" title="Ride speed">${play.speed ? play.speed + '×' : '❚❚'}</button><button class="t" id="t3d" title="Switch view">${V3.on ? '📐<span class="lbl"> Blueprint</span>' : '🎢<span class="lbl"> 3D ride</span>'}</button>${V3.on ? `<button class="t" id="tCam" title="Camera">${V3.chase ? '💺<span class="lbl"> Seat view</span>' : '📷<span class="lbl"> Chase</span>'}</button>${V3.chase ? '' : `<button class="t" id="tSeat" title="Choose your seat">🪑<span class="lbl"> ${seatName(V3.seat || 0)}</span></button>`}<button class="t" id="tTod" title="Time of day">${V3.tod === 'dusk' ? '🌇' : '☀️'}</button>` : ''}<button class="t" id="tSkip">Skip ▸▸</button>`
    : `<button class="t ride" id="tRide">🎢 RIDE</button><button class="t" id="tPlus" title="Elements: loop, hill, drop, turn, helix · smooth · snap">＋<span class="lbl"> Elements</span></button>`
    + `<button class="t" id="tUndo" ${history.length ? '' : 'disabled'} title="Undo">↶<span class="lbl"> Undo</span></button><button class="t" id="tFit" title="Fit to screen">⤢<span class="lbl"> Fit</span></button><button class="t" id="tReset" title="Start this commission's drawing again">⟲<span class="lbl"> Reset</span></button>`;
  const on = (id, f) => { if ($(id)) $(id).onclick = f; };
  on('tRide', startRide); on('tPlus', openDrawer); on('tUndo', undo); on('tFit', () => { fit(); kick(); });
  on('tReset', () => { snapshot(); design = { nodes: C.start(), lift: 1 }; sel = -1; changed(); renderInsp(); fit(); });
  on('tSkip', () => { play.fast = 1e6; }); on('tSpd', cycleSpeed); on('t3d', toggle3D); on('tSeat', cycleSeat); on('tTod', () => setTod(V3.tod === 'dusk' ? 'day' : 'dusk')); on('tCam', () => { V3.chase = !V3.chase; V3.chaseP = null; renderTools(); if (play) v3Frame(play); });
}
function renderReq() { $('cReq').innerHTML = (last && last.ok !== undefined && last.r ? checkReq(C, last).map(r => `<li class="${r[1] ? 'ok' : 'bad'}">${r[0]}</li>`) : ROWS_ONLY(C).map(r => `<li>${r}</li>`)).join('') + (C.req.air ? `<li class="tip" id="airTip">${AIR_TIP}</li>` : ''); }
function renderSel() {
  const open = i => i === 0 || COMS[i].free || COMS[i].daily && SAVE.done.first || SAVE.done[COMS[i - 1].id];
  $('comSel').innerHTML = COMS.map((c, i) => `<option value="${i}" ${c === C ? 'selected' : ''} ${open(i) ? '' : 'disabled'}>${c.daily ? '☀ ' : ''}${c.n}${SAVE.done[c.id] ? ' ' + '★'.repeat(SAVE.done[c.id]) : open(i) ? '' : ' 🔒'}</option>`).join('');
}
$('comSel').onchange = () => loadCom(+$('comSel').value);
$('cTitle').onclick = () => { $('brief').classList.toggle('mini'); fit(); kick(); };
function loadCom(i, shared) {
  C = COMS[i]; site = C.site(); SAVE.cur = i; history = []; last = null; play = null; sel = -1;
  design = shared || (SAVE.designs[C.id] ? dec(SAVE.designs[C.id]) : { nodes: C.start(), lift: 1 });
  if (design.nodes.length < 3) design = { nodes: C.start(), lift: 1 };
  $('cTitle').textContent = C.n + (C.daily ? ` · ${dailySeed()}` : ''); $('cStory').innerHTML = C.story; $('brief').classList.remove('mini'); live = null; predict(true);
  $('result').style.display = 'none'; $('gauge').style.display = 'none'; pv.style.display = 'none';
  persist(); renderSel(); renderReq(); renderTools(); renderInsp(); fit(); kick();
}

// ================= reference designs (known solutions, also the "field" for each histogram) =================
const REF = { // found by search under the game's own rules (they are also the "field" for each histogram)
  first: () => [[0, 2], [40, 32], [54, 12.5], [81.5, .5], [110, 4.5], [129.5, 1.5], [157.5, .5]].map(a => N(...a)),
  loop: () => [[0, 2], [44, 34.5], [54.5, 21], [86.5, 4], [103.5, .5], [131, 9.5], [136, 19], [129.5, 28], [120.5, 24.5], [120, 14], [130.5, 5], [157, 1], [165.5, .5]].map(a => N(...a)),
  family: () => [[0, 2], [29.5, 17.5], [44.5, 6.5], [78.5, 4], [91.5, 8.5], [107.5, 2], [119, 3]].map(a => N(...a)),
  turn: () => [N(0, 2), N(30, 22), N(50, 12), N(70, 5), N(80, 5, { r: 14, bank: 50 }), N(126, 5), N(150, 4)],
  lake: () => [[0, 8], [57.5, 16], [87, 12], [137.5, 1.5], [175, 1.5], [179.5, 3]].map(a => N(...a)),
  thrill: () => [[0, 2], [44, 34.5], [54.5, 21], [86.5, 4], [103.5, .5], [131, 9.5], [136, 19], [129.5, 28], [120.5, 24.5], [120, 14], [130.5, 5], [157, 1], [171, .5], [191.5, 5], [198, 14.5], [195.5, 19], [186.5, 17.5], [185, 13], [187.5, 8.5], [201, 2], [212, .5]].map(a => N(...a)),
  daily: () => dailyStart(siteFrom(dailySeed())),
};

