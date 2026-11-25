// Lawmaker: the laws are the puzzle. A seed pattern, a behaviour it must show, and a starting rule; the player
// flips birth/survival switches until the seed obeys. Checked by simulation on a small torus. Node and page.
(function (root) {
  'use strict';
  const G = 48, NN = G * G;                         // the puzzle dish: 48x48, wrapping
  const LUT = new Uint8Array(18); let lk = -1;
  function step(src, dst, r) { const key = r.b * 512 + r.s; if (key !== lk) { for (let n = 0; n < 9; n++) { LUT[n] = (r.b >> n) & 1; LUT[9 + n] = (r.s >> n) & 1; } lk = key; }
    for (let y = 0; y < G; y++) { const ym = ((y + G - 1) % G) * G, y0 = y * G, yp = ((y + 1) % G) * G;
      for (let x = 0; x < G; x++) { const xm = (x + G - 1) % G, xp = (x + 1) % G; const n = src[ym + xm] + src[ym + x] + src[ym + xp] + src[y0 + xm] + src[y0 + xp] + src[yp + xm] + src[yp + x] + src[yp + xp]; dst[y0 + x] = LUT[src[y0 + x] * 9 + n]; } } }
  const bits = (r) => { let n = 0; for (let i = 0; i < 9; i++) n += ((r.b >> i) & 1) + ((r.s >> i) & 1); return n; };
  const dist = (a, b) => bits({ b: a.b ^ b.b, s: a.s ^ b.s });
  const ruleStr = (r) => 'B' + [...Array(9)].map((_, i) => (r.b >> i) & 1 ? i : '').join('') + '/S' + [...Array(9)].map((_, i) => (r.s >> i) & 1 ? i : '').join('');
  const parse = (t) => { const m = String(t).toUpperCase().match(/^B([0-8]*)\/S([0-8]*)$/); if (!m) return null; let b = 0, s = 0; for (const c of m[1]) b |= 1 << +c; for (const c of m[2]) s |= 1 << +c; return { b: b & ~1, s }; };
  function place(cells) { const g = new Uint8Array(NN); let mx = 0, my = 0; for (const [x, y] of cells) { mx = Math.max(mx, x); my = Math.max(my, y); } const ox = (G - mx - 1) >> 1, oy = (G - my - 1) >> 1; for (const [x, y] of cells) g[(oy + y) * G + ox + x] = 1; return g; }
  // the history of the seed under a rule: an array of generations (stops early if it explodes)
  function run(seed, rule, gens) { let a = place(seed), b = new Uint8Array(NN); const h = [a.slice()]; for (let t = 0; t < gens; t++) { step(a, b, rule); [a, b] = [b, a]; h.push(a.slice()); let p = 0; for (let i = 0; i < NN; i++) p += a[i]; if (p > NN * .45) break; } return h; }
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
    count: (h, n) => { for (let t = 1; t < h.length; t++) if (pop(h[t]) === n) { if (t + 1 < h.length && same(h[t], h[t + 1])) return { gen: t }; } return null; },
  };
  function check(pz, rule) { const h = run(pz.seed, rule, pz.gens); const r = T[pz.target](h, pz.arg); return r ? { ...r, flips: dist(rule, parse(pz.start)), laws: bits(rule) } : null; }
  // every rule within d switches of the start, for par and the score histograms
  function search(pz, d = 3) { const st = parse(pz.start), out = []; const sw = []; for (let i = 1; i < 9; i++) sw.push(['b', i]); for (let i = 0; i < 9; i++) sw.push(['s', i]);
    const rec = (from, k, r) => { if (k > 0) { const c = check(pz, r); if (c) out.push({ r: ruleStr(r), ...c }); } if (k === d) return; for (let j = from; j < sw.length; j++) { const [q, i] = sw[j]; const n = { ...r }; n[q] ^= 1 << i; rec(j + 1, k + 1, n); } };
    rec(0, 0, st); return out; }
  const api = { G, NN, step, run, check, search, bits, dist, ruleStr, parse, place, pop, T };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LAW = api;
})(typeof window !== 'undefined' ? window : this);
