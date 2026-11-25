// Lawmaker: the laws are the puzzle. A seed pattern, a behaviour it must show, and a starting rule; the player
// flips birth/survival switches until the seed obeys. Checked by simulation on a small torus. Node and page.
(function (root) {
  'use strict';
  const G = 48, NN = G * G;                         // the puzzle dish: 48x48, wrapping
  const LUT = new Uint8Array(18); let lk = -1;
  function step(src, dst, r) { const key = r.b * 512 + r.s; if (key !== lk) { for (let n = 0; n < 9; n++) { LUT[n] = (r.b >> n) & 1; LUT[9 + n] = (r.s >> n) & 1; } lk = key; }
    const cs = CS; for (let y = 0; y < G; y++) { const ym = ((y + G - 1) % G) * G, y0 = y * G, yp = ((y + 1) % G) * G;   // column sums, then a sliding window
      for (let x = 0; x < G; x++) cs[x] = src[ym + x] + src[y0 + x] + src[yp + x];
      let l = cs[G - 1], m = cs[0]; for (let x = 0; x < G; x++) { const r = x + 1 < G ? cs[x + 1] : cs[0], c = src[y0 + x]; dst[y0 + x] = LUT[c * 9 + l + m + r - c]; l = m; m = r; } } }
  const CS = new Uint8Array(G);
  const bits = (r) => { let n = 0; for (let i = 0; i < 9; i++) n += ((r.b >> i) & 1) + ((r.s >> i) & 1); return n; };
  const dist = (a, b) => bits({ b: a.b ^ b.b, s: a.s ^ b.s });
  const ruleStr = (r) => 'B' + [...Array(9)].map((_, i) => (r.b >> i) & 1 ? i : '').join('') + '/S' + [...Array(9)].map((_, i) => (r.s >> i) & 1 ? i : '').join('');
  const parse = (t) => { const m = String(t).toUpperCase().match(/^B([0-8]*)\/S([0-8]*)$/); if (!m) return null; let b = 0, s = 0; for (const c of m[1]) b |= 1 << +c; for (const c of m[2]) s |= 1 << +c; return { b: b & ~1, s }; };
  const cellsOf = (c) => typeof c === 'string' ? c.split(' ').map(p => p.split(',').map(Number)) : c;
  function place(cells) { cells = cellsOf(cells); const g = new Uint8Array(NN); let mx = 0, my = 0; for (const [x, y] of cells) { mx = Math.max(mx, x); my = Math.max(my, y); } const ox = (G - mx - 1) >> 1, oy = (G - my - 1) >> 1; for (const [x, y] of cells) g[(oy + y) * G + ox + x] = 1; return g; }
  // the history of the seed under a rule: an array of generations (stops early if it explodes)
  function run(seed, rule, gens, cap = NN * .45) { let a = place(seed), b = new Uint8Array(NN); const h = [a.slice()]; for (let t = 0; t < gens; t++) { step(a, b, rule); [a, b] = [b, a]; h.push(a.slice()); let p = 0; for (let i = 0; i < NN; i++) p += a[i]; if (p > cap || !p) { if (!p) h.push(a.slice()); break; } } return h; }
  const pop = (g) => { let p = 0; for (let i = 0; i < NN; i++) p += g[i]; return p; };
  const same = (a, b) => { for (let i = 0; i < NN; i++) if (a[i] !== b[i]) return false; return true; };
  function bbox(g) { let x0 = G, y0 = G, x1 = -1, y1 = -1; for (let i = 0; i < NN; i++) if (g[i]) { const x = i % G, y = (i / G) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; }
  function key(g) { const b = bbox(g); if (b.x1 < 0) return ''; let k = (b.x1 - b.x0) + ',' + (b.y1 - b.y0) + ':'; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) k += g[y * G + x]; return k; }
  const nearEdge = (g) => { const b = bbox(g); return b.x0 < 2 || b.y0 < 2 || b.x1 > G - 3 || b.y1 > G - 3; };
  // targets: each returns null (not met) or { gen } (met at that generation), from a history
  const T = {
    vanish: (h) => { for (let t = 1; t < h.length; t++) if (!pop(h[t])) return { gen: t }; return null; },
    still: (h) => { for (let t = 1; t + 1 < h.length; t++) if (pop(h[t]) && same(h[t], h[t + 1])) return { gen: t }; return null; },
    osc: (h, p) => { for (let t = 1; t + p < h.length; t++) { if (!pop(h[t]) || !same(h[t], h[t + p])) continue; let lower = false; for (let q = 1; q < p; q++) if (same(h[t], h[t + q])) lower = true; if (!lower) return { gen: t }; } return null; },
    ship: (h) => { for (let t = 1; t + 1 < h.length; t++) { const p0 = pop(h[t]); if (!p0 || p0 > 60 || nearEdge(h[t])) continue; const k = key(h[t]), b = bbox(h[t]);
        for (let p = 1; p <= 8 && t + p < h.length; p++) { if (key(h[t + p]) === k) { const c = bbox(h[t + p]); if (c.x0 !== b.x0 || c.y0 !== b.y0) return { gen: t, p }; break; } } } return null; },
    box: (h, r) => { const c = G >> 1; for (let t = 0; t < h.length; t++) { const b = bbox(h[t]); if (b.x1 < 0) return null; if (b.x0 < c - r || b.y0 < c - r || b.x1 > c + r || b.y1 > c + r) return null; } return h.length > 120 ? { gen: h.length - 1 } : null; },
    // settles into exactly two separate objects (still or blinking), e.g. two gliders that collide and leave a pair
    pair: (h) => { for (let t = 1; t + 2 < h.length; t++) { if (!pop(h[t]) || !(same(h[t], h[t + 1]) || same(h[t], h[t + 2]))) continue; return parts(h[t]) === 2 ? { gen: t } : null; } return null; },
    // any oscillator with a period of at least p
    beat: (h, p) => { for (let q = p; q <= 15; q++) { const r = T.osc(h, q); if (r) return { ...r, p: q }; } return null; },
    count: (h, n) => { for (let t = 1; t < h.length; t++) if (pop(h[t]) === n) { if (t + 1 < h.length && same(h[t], h[t + 1])) return { gen: t }; } return null; },
  };
  function parts(g) { const seen = new Uint8Array(NN); let n = 0; for (let i = 0; i < NN; i++) { if (!g[i] || seen[i]) continue; n++; const st = [i]; seen[i] = 1;
      while (st.length) { const j = st.pop(), x = j % G, y = (j / G) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = ((y + dy + G) % G) * G + (x + dx + G) % G; if (g[k] && !seen[k]) { seen[k] = 1; st.push(k); } } } } return n; }
  function check(pz, rule) { const h = run(pz.seed, rule, pz.gens); const r = T[pz.target](h, pz.arg); return r ? { ...r, flips: dist(rule, parse(pz.start)), laws: bits(rule) } : null; }
  // is there any rule within d switches of the start that obeys? (stops at the first one: used to prove par)
  function exists(pz, d) { const st = parse(pz.start), sw = []; for (let i = 1; i < 9; i++) sw.push(['b', i]); for (let i = 0; i < 9; i++) sw.push(['s', i]);
    for (let k = 1; k <= d; k++) { const rec = (from, left, r) => { if (!left) return !!check(pz, r); for (let j = from; j < sw.length; j++) { const [q, i] = sw[j]; const n = { ...r }; n[q] ^= 1 << i; if (rec(j + 1, left - 1, n)) return true; } return false; }; if (rec(0, k, st)) return true; } return false; }
  // every rule within d switches of the start, for par and the score histograms
  function search(pz, d = 3) { const st = parse(pz.start), out = []; const sw = []; for (let i = 1; i < 9; i++) sw.push(['b', i]); for (let i = 0; i < 9; i++) sw.push(['s', i]);
    const rec = (from, k, r) => { if (k > 0) { const c = check(pz, r); if (c) out.push({ r: ruleStr(r), ...c }); } if (k === d) return; for (let j = from; j < sw.length; j++) { const [q, i] = sw[j]; const n = { ...r }; n[q] ^= 1 << i; rec(j + 1, k + 1, n); } };
    rec(0, 0, st); return out; }

  // today's law: a seed, a behaviour and a starting rule made from the date (same for everyone), two switches from a solution
  function rng(seed) { let a = 0; for (const c of String(seed)) a = (a * 31 + c.charCodeAt(0)) | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const SW = []; for (let i = 1; i < 9; i++) SW.push(['b', i]); for (let i = 0; i < 9; i++) SW.push(['s', i]);
  function make(spec, R) { const pz = { seed: spec.cells, target: spec.target, arg: spec.arg, gens: spec.gens }; const homes = [];
    for (let n = 0; n < (spec.budget || 1500) && homes.length < 3; n++) { const r = { b: 0, s: 0 }; for (const [k, i] of SW) if (R() < .3) r[k] |= 1 << i; if (!r.b) continue; const l = bits(r); if (l < 3 || l > 8) continue; if (T[pz.target](run(pz.seed, r, pz.gens), pz.arg)) homes.push(r); }
    for (const home of homes) for (let tries = 0; tries < 12; tries++) { const st = { ...home }, used = new Set(); while (used.size < spec.k) { const j = Math.floor(R() * SW.length); if (used.has(j)) continue; used.add(j); st[SW[j][0]] ^= 1 << SW[j][1]; } if (!st.b) continue;
      const q = { ...pz, start: ruleStr(st) }; if (check(q, st) || exists(q, spec.k - 1)) continue; const sols = search(q, spec.k >= 3 ? spec.k : spec.k + 1); if (!sols.length) continue; const par = Math.min(...sols.map(s => s.flips)); if (par !== spec.k) continue;
      const ghost = sols.filter(s => s.flips === par).sort((a, b) => a.gen - b.gen)[0]; const hist = { flips: {}, laws: {}, gen: {} }; for (const s of sols) { hist.flips[s.flips] = (hist.flips[s.flips] || 0) + 1; hist.laws[s.laws] = (hist.laws[s.laws] || 0) + 1; hist.gen[s.gen] = (hist.gen[s.gen] || 0) + 1; }
      return { seed: spec.cells.map(c => c.join(',')).join(' '), target: spec.target, arg: spec.arg, gens: spec.gens, start: q.start, par, ghost: ghost.r, n: sols.length, hist, kind: spec.kind }; }
    return null; }
  function daily(day) { const R = rng('law:' + day); const kinds = [['vanish', 0, 60], ['still', 0, 60], ['osc', 2, 60], ['osc', 3, 80], ['box', 7, 150]];
    for (let attempt = 0; attempt < 6; attempt++) { const cells = []; const want = 4 + Math.floor(R() * 3); while (cells.length < want) { const c = [Math.floor(R() * 3), Math.floor(R() * 3)]; if (!cells.some(d => d[0] === c[0] && d[1] === c[1])) cells.push(c); }
      const [target, arg, gens] = kinds[Math.floor(R() * kinds.length)]; const pz = make({ cells, target, arg, gens, k: 2 }, R); if (pz) return pz; }
    return null; }
  // The endless ladder after the hand-made laws: law n is made from its number, par rising 2 -> 3 -> 4, with
  // composite seeds (two gliders on a collision course, a glider and a block) and the harder targets mixed in.
  const SHAPES = { glider: '1,0 2,1 0,2 1,2 2,2', gliderW: '1,0 0,1 0,2 1,2 2,2', block: '0,0 1,0 0,1 1,1', blinker: '0,0 1,0 2,0', rpent: '1,0 2,0 0,1 1,1 1,2', tee: '0,0 1,0 2,0 1,1', ell: '0,0 0,1 0,2 1,2' };
  const cellsOf2 = (s, dx = 0, dy = 0) => s.split(' ').map(p => { const [x, y] = p.split(',').map(Number); return [x + dx, y + dy]; });
  function ladderSeed(R) { const k = Math.floor(R() * 6);
    if (k === 0) return { cells: [...cellsOf2(SHAPES.glider), ...cellsOf2(SHAPES.gliderW, 6 + Math.floor(R() * 3))], kind: 'two gliders' };
    if (k === 1) return { cells: [...cellsOf2(SHAPES.glider), ...cellsOf2(SHAPES.block, 5 + Math.floor(R() * 2), 5 + Math.floor(R() * 2))], kind: 'a glider and a block' };
    if (k === 2) { const names = ['blinker', 'rpent', 'tee', 'ell']; const a = names[Math.floor(R() * 4)], b = names[Math.floor(R() * 4)]; return { cells: [...cellsOf2(SHAPES[a]), ...cellsOf2(SHAPES[b], 5, Math.floor(R() * 3))], kind: 'two shapes' }; }
    const cells = []; const want = 4 + Math.floor(R() * 4), box = want > 5 ? 4 : 3; while (cells.length < want) { const c = [Math.floor(R() * box), Math.floor(R() * box)]; if (!cells.some(d => d[0] === c[0] && d[1] === c[1])) cells.push(c); } return { cells, kind: 'a seed' }; }
  function ladder(n) { const R = rng('ladder:' + n); const k = n < 6 ? 2 : n < 16 ? 3 : 4;
    const kinds = [['vanish', 0, 80], ['still', 0, 80], ['pair', 0, 100], ['osc', 2, 80], ['beat', 3, 120], ['box', 8, 150], ['still', 0, 80], ['pair', 0, 100]];
    for (let attempt = 0; attempt < 12; attempt++) { const sd = ladderSeed(R); const [target, arg, gens] = kinds[Math.floor(R() * kinds.length)]; const pz = make({ cells: sd.cells, target, arg, gens, k, kind: sd.kind, budget: 900 }, R); if (pz) { pz.id = 'L' + n; pz.n0 = n; return pz; } }
    return null; }
  const api = { G, daily, make, ladder, parts, exists, NN, step, run, check, search, bits, dist, ruleStr, parse, place, pop, T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LAW = api;
})(typeof window !== 'undefined' ? window : this);
