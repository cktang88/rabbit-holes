// Floatees: the real Earth runs on measured data (NOAA GDP drifter currents, CCMP winds, US Coast Guard leeway classes,
// Natural Earth 10m coasts), validated against documented drifts (the 1992 bath toys, the 1990 Nike shoes, current speeds,
// the five garbage patches); the idealised Stommel model remains for Earth with its spin changed and for generated worlds.
// Every voyage solvable / not solved at start / cheap tricks refused, bets locked during a run, saves.
const SEED = `(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()`;
const ready = page => page.waitForFunction(() => window.__fl && __fl.ready2 && (__fl.ED.ready || __fl.ED.failed), null, { timeout: 60000 });
const unlock = page => page.evaluate(() => { for (let i = 0; i < __fl.LV.length - 1; i++) __fl.SAVE.done[i] = 1; });
const spin = (page, r) => page.evaluate(async r => { if (__fl.rot !== r) __fl.setSpin(r, true); while (!__fl.ready2) await new Promise(res => setTimeout(res, 100)); }, r);
// run a voyage to the end in fixed steps, judging it like the game does
const voyage = (page, lv, lat, lon, opts = {}) => page.evaluate(async ([lv, lat, lon, seed, rot]) => {
  eval(seed); const X = __fl; X.load(lv);
  if (rot != null && rot !== X.rot) { X.setSpin(rot, true); while (!X.ready2) await new Promise(r => setTimeout(r, 100)); }
  const ok = lat == null ? (X.drop(...X.LV[lv].drop, 120), true) : X.dropAt(lat, lon); if (!ok) return { rejected: true };
  const L = X.level; let won = false;
  for (let t = 0; t < L.years && !X.won && !X.resolved; t += .02) { X.step(.02); X.simT = Math.min(L.years, X.simT); X.check(); }
  const S = X.stats(); return { won: X.won, resolved: X.resolved, S: { uk: S.regions.uk, eu: S.regions.europe + S.regions.uk, patch: S.patch, lap: S.maxLap, first: S.first } };
}, [lv, lat, lon, SEED, opts.rot]);

// Uncharted Seas players: an oracle (the true answer), a drifter probe (spend a drifter at the raft), a careful chart reader
// (spread the drifters, learn the currents from their monthly fixes, follow them from the raft), and a naive guess (nearest coast, next month)
const SEA_BOTS = () => { window.seaBots = (X, seeds, rung) => {
  const res = [];
  for (const sd of seeds) {
    const W = X.genWorld(sd, rung); if (!W) { res.push(null); continue; }
    const o = { sd, calls: W.calls.length, oracle: 0, careful: 0, naive: 0, drift: 0 };
    X.withWorld(W, () => {
      // careful: spread the drifters over the open sea, learn velocities from their monthly fixes
      const samp = [], spots = []; const r = RH.rng(sd);
      for (let t = 0; t < 400 && spots.length < W.drifters - 1; t++) { const la = (r() - .5) * 110, lo = r() * 360 - 180; if (X.isLand(la, lo) || spots.some(s => Math.hypot(s[0] - la, (s[1] - lo) * .7) < 25)) continue; spots.push([la, lo]); }
      spots.forEach((s, i) => { const d = X.driftPath(s[0], s[1], 4, 3, W.seed * 131 + i * 17 + 1); for (let k = 1; k < d.path.length; k++) { const [t0, a0, b0] = d.path[k - 1], [t1, a1, b1] = d.path[k], dt = t1 - t0; if (dt <= 0) continue; const db = ((b1 - b0 + 540) % 360) - 180; samp.push([(a0 + a1) / 2, b0 + db / 2, db * Math.cos((a0 + a1) / 2 * Math.PI / 180) / dt, (a1 - a0) / dt]); } });
      const est = (la, lo) => { const c = Math.cos(la * Math.PI / 180), near = samp.map(s => [Math.hypot(s[0] - la, (((s[1] - lo + 540) % 360) - 180) * c), s]).sort((p, q) => p[0] - q[0]).slice(0, 4); let u = 0, v = 0, w = 0; for (const [d, s] of near) { const k = 1 / (d + 1); u += s[2] * k; v += s[3] * k; w += k; } return w ? [u / w, v / w] : [0, 0]; };
      const predict = (c) => { let la = c.at[0], lo = c.at[1]; for (let t = 0; t < 3; t += 1 / 48) { const [u, v] = est(la, lo); la += v / 48; lo += u / 48 / Math.max(.2, Math.cos(la * Math.PI / 180)); lo = ((lo + 540) % 360) - 180; if (X.isLand(la, lo) || Math.abs(la) > 82) return { at: [la, lo], t }; } return { at: nearestCoast({ at: [la, lo] }), t: 2 }; };
      const nearestCoast = c => { for (let d = 1; d < 60; d++) for (let a = 0; a < 16; a++) { const la = c.at[0] + d * Math.sin(a / 16 * 6.283), lo = c.at[1] + d * Math.cos(a / 16 * 6.283) / Math.max(.3, Math.cos(c.at[0] * Math.PI / 180)); if (X.isLand(la, lo)) return [la, lo]; } return c.at; };
      for (const c of W.calls) { const ens = X.ensemble(W, c); o.oracle += X.savedBy(ens, c.best.at, c.best.t);
        const p = predict(c); if (p) o.careful += X.savedBy(ens, p.at, Math.max(1, Math.round(p.t * 12)) / 12);
        o.naive += X.savedBy(ens, nearestCoast(c), 1);
        const d = X.driftPath(c.at[0], c.at[1], 3, c.w, 999 + c.i); if (d.land) o.drift += X.savedBy(ens, [d.land.lat, d.land.lon], Math.max(1, Math.round(d.land.t * 12)) / 12); }
    });
    res.push(o);
  }
  return res; }; };

// In-page drift on the real data: n objects from (lat, lon), starting at time of year ph0 (fraction from 1 January),
// followed for `days`; returns each object's end { t (days), lat, lon, hit (washed up) }. Seeded, so the numbers are fixed.
const DRIFT = `window.drift = (lat, lon, ph0, cg, n, days, seed = 99) => { const F = __fl.phys, P = [0, 0], res = []; let a = seed;
  const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let k = 0; k < n; k++) { P[0] = lat + (rnd() - .5) * .5; P[1] = lon + (rnd() - .5) * .5; const side = rnd() < .5 ? -1 : 1; let t = 0, hit = 0;
    while (t < days) { t += F.advance(P, side, cg, days - t, ph0 + t / 365.2425, rnd, t); hit = F.HIT; if (hit || Math.abs(P[0]) > 84) break; }
    res.push({ t, lat: P[0], lon: P[1], hit }); }
  return res; }; window.qtile = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };`;

module.exports = {
  page: 'floatees/index.html',
  ready,
  tests: {
    'real Gulf Stream hugs the west; the model with reversed spin moves it east; no spin weakens it; field is finite (m/s)': async ({ page, ok, near }) => {
      ok(await page.evaluate(() => __fl.ED.ready && __fl.phys.REAL), 'the real data loaded and drives Earth');
      const prof = async () => page.evaluate(() => { let best = 0, at = 0; for (let lat = 26; lat <= 40; lat += 2) for (let lon = -80; lon <= -12; lon += .5) { const v = __fl.vel(lat, lon), s = Math.hypot(v[0], v[1]); if (s > best) { best = s; at = lon; } } return [best, at]; });
      // the game's own measurement box off the US coast (where the Gulf Stream runs)
      const box = () => page.evaluate(() => { let best = 0; for (let lat = 26; lat <= 44; lat += 1) for (let lon = -81; lon <= -63; lon += .5) { const v = __fl.vel(lat, lon); best = Math.max(best, Math.hypot(v[0], v[1])); } return best; });
      const [s1, lon1] = await prof(), b1 = await box(); ok(lon1 < -60, 'normal spin: fastest at ' + lon1);
      await spin(page, -1); const [sr, lonr] = await prof(); ok(lonr > -35, 'reversed spin: fastest at ' + lonr);
      await spin(page, 0); const b0 = await box(); ok(b1 > 1.25 * b0, `no spin should have no Gulf Stream: ${b1} vs ${b0}`);
      await spin(page, 1);
      // velocity field: finite everywhere, continuous across the date line
      const r = await page.evaluate(() => { let bad = 0; for (let lat = -84; lat <= 84; lat += 3) for (let lon = -180; lon <= 180; lon += 3) { const v = __fl.vel(lat, lon); if (!isFinite(v[0]) || !isFinite(v[1])) bad++; }
        const a = Array.from(__fl.vel(10, 179.999)), b = Array.from(__fl.vel(10, -179.999)); return { bad, a, b }; });
      ok(r.bad === 0, 'non-finite velocities: ' + r.bad); near(r.a[0], r.b[0], .05); near(r.a[1], r.b[1], .05);
    },
    // ---- validation of the real-data drift against documented events (figures and sources in index.html and DATA-NOTICE.txt) ----
    'real data, Friendly Floatees: toys lost 10 Jan 1992 at 44.7°N 178.1°E reach south-east Alaska Aug-Nov 1992': async ({ page, ok }) => {
      // Ebbesmeyer & Ingraham 1994 (Eos 75, 425): toys near Sitka ten months after the spill (Nov 1992); Ebbesmeyer et al. 2007
      // (Eos 88(1)): "During August-September 1992, thousands of these items beached near Sitka". Spill to Sitka ~3,200 km.
      await page.evaluate(DRIFT);
      const r = await page.evaluate(() => { const res = drift(44.7, 178.1, 9 / 365.2425, __fl.phys.CARGO[22], 400, 730), mo = d => d.t / 30.44;
        const ak = res.filter(d => d.hit && d.lat > 54 && d.lat < 61 && d.lon > -141 && d.lon < -130).map(mo);
        return { n: ak.length, first: Math.min(...ak), median: qtile(ak, .5) }; });
      console.log('      floatees → SE Alaska: ' + JSON.stringify(r) + ' (documented: Aug-Nov 1992 = months 7-10)');
      ok(r.n >= 20, 'toys reaching SE Alaska: ' + r.n);
      ok(r.first >= 5.5 && r.first <= 10, 'first SE Alaska landfall at month ' + r.first.toFixed(1));
      ok(r.median >= 6.5 && r.median <= 11, 'median SE Alaska landfall at month ' + r.median.toFixed(1));
    },
    'real data, Hansa Carrier: Nike shoes lost 27 May 1990 at 48°N 161°W land in BC, Washington, Oregon from Nov 1990 into 1991': async ({ page, ok }) => {
      // Ebbesmeyer & Ingraham 1992 (Eos 73, 361): ~80,000 shoes lost 27 May 1990, 48°N 161°W; six months to a year later they
      // washed ashore from southern Oregon to the Queen Charlotte Islands; the first reached northern Washington around Thanksgiving 1990.
      await page.evaluate(DRIFT);
      const r = await page.evaluate(() => { const res = drift(48, -161, (4 + 26 / 31) / 12, __fl.phys.CARGO[6], 400, 550), mo = d => d.t / 30.44;
        const nw = res.filter(d => d.hit && d.lat > 41 && d.lat < 55 && d.lon > -134 && d.lon < -122);
        return { n: nw.length, first: Math.min(...nw.map(mo)), median: qtile(nw.map(mo), .5), q90: qtile(nw.map(mo), .9), south: Math.min(...nw.map(d => d.lat)), north: Math.max(...nw.map(d => d.lat)) }; });
      console.log('      shoes → BC/WA/OR: ' + JSON.stringify(r) + ' (documented: Nov 1990-spring 1991 = months 6-12)');
      ok(r.n >= 60, 'shoes landing on BC/WA/OR: ' + r.n);
      ok(r.first >= 5 && r.first <= 7.5, 'first landfall at month ' + r.first.toFixed(1));
      ok(r.q90 <= 12.5, '90% landed by month ' + r.q90.toFixed(1));
      ok(r.south < 49 && r.north > 52, `spread along the coast ${r.south.toFixed(1)}-${r.north.toFixed(1)}°N`);
    },
    'real data: western boundary currents run 1-2 m/s, the Circumpolar Current flows east, the Somali Current reverses with the monsoon': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __fl, F = X.phys, V = [0, 0];
        const mx = (la0, la1, lo0, lo1) => { let m = 0; for (let mo = 0; mo < 12; mo++) { F.setPhase((mo + .5) / 12); for (let la = la0; la <= la1; la += .25) for (let lo = lo0; lo <= lo1; lo += .25) { F.curReal(la, lo, V); m = Math.max(m, Math.hypot(V[0], V[1])); } } return m; };
        let acc = 0, n = 0; F.setPhase(.5); for (let lo = -180; lo < 180; lo += 2) for (let la = -60; la <= -45; la++) { if (X.isLand(la, lo)) continue; F.curReal(la, lo, V); acc += V[0]; n++; }
        const som = m => { F.setPhase((m + .5) / 12); let v = 0, k = 0; for (let la = 2; la <= 9; la += .5) for (let lo = 46; lo <= 53; lo += .5) { if (X.isLand(la, lo)) continue; F.curReal(la, lo, V); v += V[1]; k++; } return v / k; };
        return { gs: mx(25, 42, -81, -60), ku: mx(25, 38, 122, 145), acc: acc / n, somJan: som(0), somJul: som(6) }; });
      console.log('      speeds m/s: ' + JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(3)]))));
      ok(r.gs >= 1 && r.gs <= 2.2, 'Gulf Stream core ' + r.gs); ok(r.ku >= .9 && r.ku <= 2.2, 'Kuroshio core ' + r.ku);
      ok(r.acc > .05, 'Antarctic Circumpolar Current (45-60°S) mean eastward ' + r.acc);
      ok(r.somJul > .15 && r.somJan < .05, `Somali Current: Jul ${r.somJul} northward, Jan ${r.somJan}`);
    },
    'real data: drifters released everywhere gather in the five subtropical gyres within 10 years (van Sebille 2012, Maximenko 2012)': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __fl, F = X.phys; F.BEACH.on = false; let a = 5;
        const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
        const cg = { dw: 0, cw: 0 }, P = [0, 0], fin = [], all = [];
        for (let la = -60; la <= 60; la += 3) for (let lo = -180; lo < 180; lo += 3) { if (X.isLand(la, lo)) continue; all.push([la, lo]); P[0] = la; P[1] = lo; let t = 0; const days = 3652;
          while (t < days) { t += F.advance(P, 1, cg, days - t, t / 365.2425, rnd); if (Math.abs(P[0]) > 84) break; } fin.push([P[0], P[1]]); }
        F.BEACH.on = true;
        const box = { NPac: [22, 40, -165, -125], SPac: [-40, -20, -125, -85], NAtl: [20, 38, -70, -35], SAtl: [-38, -22, -35, 5], IndO: [-38, -22, 60, 105] }, inb = (b, [la, lo]) => la >= b[0] && la <= b[1] && lo >= b[2] && lo <= b[3];
        const en = {}; for (const k in box) en[k] = (fin.filter(p => inb(box[k], p)).length / fin.length) / (all.filter(p => inb(box[k], p)).length / all.length);
        let best = 0, at = null; for (let la = 10; la <= 50; la += 2) for (let lo = 140; lo <= 240; lo += 2) { const n = fin.filter(([q, o]) => q >= la && q < la + 6 && ((o + 360) % 360) >= lo && ((o + 360) % 360) < lo + 6).length; if (n > best) { best = n; at = [la + 3, lo + 3 - 360]; } }
        return { en, at }; });
      console.log('      garbage patches, concentration vs uniform: ' + JSON.stringify(Object.fromEntries(Object.entries(r.en).map(([k, v]) => [k, +v.toFixed(1)]))) + ', densest N Pacific box at ' + r.at);
      for (const k in r.en) ok(r.en[k] > 1.5, `${k} gyre gathers debris: ×${r.en[k].toFixed(2)}`);
      ok(Math.hypot(r.at[0] - 32, (r.at[1] + 145) * .85) < 10, 'the Great Pacific Garbage Patch near 32°N 145°W: ' + r.at);
    },
    'real data: leeway from the Coast Guard classes, eddy diffusivity 10^3-10^4 m²/s from drifter statistics, 0.25° coasts': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const F = __fl.phys, K = []; for (let la = -60; la <= 60; la += 5) for (let lo = -180; lo < 180; lo += 5) if (!__fl.isLand(la, lo)) K.push(F.kEddy(la, lo)); K.sort((a, b) => a - b);
        return { duck: F.CARGO[22].dw, shoe: F.CARGO[6].dw, k10: K[Math.floor(K.length * .1)], k50: K[K.length >> 1], k90: K[Math.floor(K.length * .9)], gs: F.kEddy(37, -65), gyre: F.kEddy(25, -40),
          // 0.25° coastline: Long Island, Oahu and Kauai are land; Long Island Sound and the Strait of Gibraltar are sea
          coast: [__fl.isLand(40.85, -72.9), __fl.isLand(21.45, -157.95), __fl.isLand(22.05, -159.5), !__fl.isLand(41.1, -72.9), !__fl.isLand(35.95, -5.6)] }; });
      console.log('      leeway & K: ' + JSON.stringify(r));
      ok(r.duck >= .01 && r.duck <= .04 && r.shoe < .01, 'leeway fractions: toys ' + r.duck + ', shoes ' + r.shoe);
      ok(r.k10 > 500 && r.k90 < 2e4 && r.k50 > 1000 && r.k50 < 1e4, `K percentiles ${r.k10} / ${r.k50} / ${r.k90}`);
      ok(r.gs > 2 * r.gyre, `eddies stir the Gulf Stream (${r.gs.toFixed(0)}) harder than the gyre interior (${r.gyre.toFixed(0)})`);
      ok(r.coast.every(Boolean), 'fine coastline: ' + r.coast);
    },
    'no voyage is won before any drop; every voyage is solvable with a sensible drop': async ({ page, ok }) => {
      await unlock(page);
      const st = await page.evaluate(() => __fl.LV.map((l, i) => { __fl.load(i); return !!(l.win && l.win(__fl.stats())); }));
      ok(st.every(x => !x), 'won at start: ' + JSON.stringify(st));
      await page.evaluate(() => { __fl.load(0); __fl.bet = 'nawest'; });
      const v0 = await page.evaluate(async seed => { eval(seed); const X = __fl; X.load(0); X.bet = 'nawest'; X.drop(...X.LV[0].drop, 120); for (let t = 0; t < 2 && !X.won && !X.resolved; t += .02) { X.step(.02); X.check(); } return [X.won, X.stats().first]; }, SEED);
      ok(v0[0], 'bet on North America: first ashore was ' + v0[1]);
      const cases = [[1, 37, -72], [2, 35, -170], [4, 25, -70, -1], [5, -55, -60]];
      for (const [lv, lat, lon, rot] of cases) { const r = await voyage(page, lv, lat, lon, { rot }); ok(r.won, `voyage ${lv} not won: ` + JSON.stringify(r)); }
      // Why the West: measure with spin on, then off
      const m = await page.evaluate(async seed => { eval(seed); const X = __fl; X.load(3);
        const run = async r => { if (X.rot !== r) { X.setSpin(r, true); while (!X.ready2) await new Promise(res => setTimeout(res, 100)); } X.dropAt(33, -77); for (let t = 0; t < 1 && !X.won; t += .02) { X.step(.02); X.check(); } };
        await run(1); const after1 = X.won; await run(0); const S = X.stats(); X.setSpin(1, true); return [after1, X.won, S.meas[1], S.meas[0]]; }, SEED);
      ok(!m[0] && m[1], 'measure level: ' + JSON.stringify(m));
    },
    'cheap tricks are refused; a miss explains how close it was': async ({ page, ok, eq }) => {
      await unlock(page);
      // a drop right inside the garbage patch, or next to Europe on the backwards planet, or off Europe for the bottle
      eq((await voyage(page, 2, 33, -147)).rejected, true, 'drop inside the patch');
      eq((await voyage(page, 2, 25, -150)).rejected, true, 'drop inside the patch ring edge');
      eq((await voyage(page, 4, 45, -20, { rot: -1 })).rejected, true, 'drop next to Europe');
      eq((await voyage(page, 1, 50, -20)).rejected, true, 'bottle dropped mid-Atlantic');
      eq((await voyage(page, 1, 40, 10)).rejected, true, 'land / Mediterranean');
      // the Backwards Planet needs the planet reversed
      const n = await voyage(page, 4, 25, -70, { rot: 1 }); ok(!n.won, 'won with normal spin');
      await spin(page, 1);
      // the 1992 spill can't be moved
      await page.evaluate(() => __fl.load(0)); eq(await page.evaluate(() => __fl.dropAt(30, -140)), false);
      // and a miss explains how close it was
      
      const r = await voyage(page, 1, 25, -95); // Gulf of Mexico: few reach Britain
      ok(r.resolved && !r.won, JSON.stringify(r));
      const t = await page.textContent('#toast'); ok(/need 15/.test(t) && /Britain/.test(t), t);
        },
    'the bet cannot be changed while ducks are at sea': async ({ page, eq, ok }) => {
      await page.click('#bets [data-k="japan"]');
      await page.click('#rel');
      ok(await page.$eval('#bets [data-k="nawest"]', b => b.disabled), 'bet buttons still enabled during the run');
      await page.evaluate(() => document.querySelector('#bets [data-k="nawest"]').click());
      eq(await page.evaluate(() => __fl.stats().bet), 'japan');
      // once resolved, betting opens again
      await page.evaluate(async seed => { eval(seed); const X = __fl; for (let t = 0; t < 2 && !X.won && !X.resolved; t += .02) { X.step(.02); X.check(); } }, SEED);
      eq(await page.evaluate(() => __fl.resolved), true);
      eq(await page.$eval('#bets [data-k="nawest"]', b => b.disabled), false);
      await page.click('#bets [data-k="nawest"]'); eq(await page.evaluate(() => __fl.stats().bet), 'nawest');
      eq(await page.evaluate(() => __fl.won), false, 'changing the bet after the result must not win');
    },
    'playback: slow by default (½× 1× 4× 12×, remembered), eased after a drop, skip to result; levels and locks': async ({ page, eq, ok }) => {
      eq(await page.evaluate(() => __fl.speed), 1);
      await unlock(page); await page.evaluate(() => __fl.load(2)); eq(await page.evaluate(() => __fl.speed), 1, 'no automatic fast-forward');
      eq(await page.$$eval('#ctrl [data-s]', bs => bs.map(b => b.textContent)), ['½×', '1×', '4×', '12×']);
      await page.click('#ctrl [data-s="4"]'); await page.evaluate(() => __fl.load(1)); eq(await page.evaluate(() => __fl.speed), 4, 'speed remembered');
      await page.click('#ctrl [data-s="1"]');
      // 1× is about two weeks of drift a second, and starts gently after a drop
      const pb = await page.evaluate(async () => { __fl.dropAt(30, -78); const t0 = __fl.simT; await new Promise(res => setTimeout(res, 1000)); const a = __fl.simT - t0; await new Promise(res => setTimeout(res, 2500)); const t1 = __fl.simT; await new Promise(res => setTimeout(res, 1000)); return [a, __fl.simT - t1]; });
      ok(pb[0] < pb[1], 'eased in after the drop: ' + pb); ok(pb[1] <= .045, 'about two weeks per second at 1×: ' + pb);
      ok(await page.isVisible('#skipB')); await page.click('#skipB');
      const end = await page.evaluate(() => [__fl.simT, __fl.won || __fl.resolved]); ok(end[1], 'skip runs the voyage to a verdict: ' + end);
      await page.evaluate(() => { __fl.SAVE.done = {}; });
      await page.evaluate(() => __fl.load(4)); eq(await page.evaluate(() => __fl.SAVE.cur), 0, 'locked voyage opened');
      await page.evaluate(() => __fl.load(9)); eq(await page.evaluate(() => __fl.SAVE.cur), 9, 'sandbox always open');
      const r = await voyage(page, 0, null); // the spill with no bet placed: release is a no-op in the UI, but the debug drop runs
      const p = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).floatees); ok(p >= 0 && p <= 1);
    },
    'stars reward a better drop; postcards arrive for new coasts; the success is a stamped beachcomber report': async ({ page, ok, eq }) => {
      await unlock(page);
      const r = await page.evaluate(async seed => { eval(seed); const X = __fl; X.load(1); X.dropAt(37, -72); let wonAt = -1;
        for (let t = 0; t < 3 && !X.resolved; t += .02) { X.step(.02); X.simT = Math.min(3, X.simT); X.check(); if (X.won && wonAt < 0) wonAt = X.simT; }
        return { wonAt, resolved: X.resolved, stars: X.SAVE.stars[1], cards: Object.keys(X.SAVE.cards), att: X.attempts, report: X.reportOn, uk: X.stats().regions.uk }; }, SEED);
      ok(r.wonAt > 0 && r.wonAt < 3, 'goal reached mid-voyage at ' + r.wonAt);
      ok(r.resolved, 'voyage ran to the end and was graded');
      eq(r.stars, r.uk >= 27 ? 3 : r.uk >= 22 ? 2 : 1, 'stars match the final count ' + r.uk);
      ok(r.cards.includes('uk'), 'a postcard from Britain: ' + r.cards);
      ok(r.report, 'beachcomber report shown');
      ok(/CONFIRMED/.test(await page.textContent('#report')));
      eq(r.att.length, 1); ok(/37°N 72°W/.test(await page.textContent('#tally')), 'logbook shows the drop');
      // stars never go down on a worse replay
      const r2 = await page.evaluate(async seed => { eval(seed); const X = __fl; document.getElementById('rclose').click(); X.load(1); X.dropAt(25, -95);
        for (let t = 0; t < 3 && !X.resolved; t += .02) { X.step(.02); X.simT = Math.min(3, X.simT); X.check(); } return X.SAVE.stars[1]; }, SEED);
      eq(r2, r.stars);
      eq(await page.evaluate(() => __fl.grade({ t: 3, regions: { uk: 50 }, maxLap: 0 })), 3);
    },
    'forensic cases: the logbook comes from the model, the true spill reproduces it, hindcasts cost computer time': async ({ page, ok, eq }) => {
      await unlock(page);
      const r = await page.evaluate(() => { const X = __fl, o = {};
        for (const lv of [6, 7, 8]) { X.load(lv); const C = X.level.case, log = X.caseLog(); X.caseState.month = C.truthMonth || 0;
          o[lv] = { n: log.length, self: X.caseTry(...C.truth).mis, off: X.caseTry(C.truth[0] + 8, C.truth[1] + 10).mis, budget: X.caseState.left }; }
        return o; });
      for (const lv of [6, 7, 8]) { ok(r[lv].n >= 2, `case ${lv} has a logbook (${r[lv].n})`); eq(r[lv].self, 0, `case ${lv}: the truth fits exactly`); ok(r[lv].off > 3, `case ${lv}: 8° off fails (${r[lv].off})`); }
      // play it through the UI path: a wrong hindcast uses one run and shows residuals; the truth closes the case with a report
      const v = await page.evaluate(() => { const X = __fl; X.load(6); const C = X.level.case;
        const run = (la, lo) => { X.dropAt(la, lo); for (let t = 0; t < X.level.years; t += .05) X.step(.05); X.simT = X.level.years; X.check(); };
        run(20, -40); const a = [X.caseState.left, X.won, X.resolved, document.querySelector('.logb').textContent.includes('mo')];
        run(...C.truth); return [...a, X.caseState.left, X.won, X.SAVE.stars[6], X.reportOn, document.getElementById('report').textContent.includes('Case closed')]; });
      eq(v, [11, false, true, true, 10, true, 3, true, true]);
      // out of computer time: further hindcasts are refused until the case is reopened
      const w = await page.evaluate(() => { const X = __fl; X.load(7); X.caseState.left = 0; return [X.dropAt(30, -60), X.caseState.left]; });
      eq(w, [false, 0]);
      eq(await page.evaluate(() => { __fl.load(7); return __fl.dropAt(10, 150); }), false, 'a drop in the wrong ocean is refused');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      await unlock(page);
      const R = await page.evaluate(() => { const X = __fl, out = { naive: 0, naiveN: 0, comp: [], compMis: [] };
        for (const lv of [6, 7, 8]) {
          X.load(lv); const C = X.level.case, lim = 3, log = X.caseLog(), B = C.budget, A = C.area;
          const f = (la, lo, m = 0) => { X.caseState.month = m; return X.caseTry(la, lo); };
          let rs = 11 + lv; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
          for (let k = 0; k < 6; k++) { // random hindcasts anywhere in the basin (random month too)
            let best = 99; for (let j = 0; j < B; j++) best = Math.min(best, f(A[0] + rnd() * (A[1] - A[0]), A[2] + rnd() * (A[3] - A[2]), (rnd() * 12) | 0).mis); out.naiveN++; if (best <= lim) out.naive++; }
          for (let k = 0; k < 3; k++) { // the obvious guess: just offshore from the first sighting
            let best = 99; for (let j = 0; j < B; j++) { const q = log[0].at; best = Math.min(best, f(q[0] + (rnd() - .5) * 6, q[1] + (rnd() - .5) * 6 - 4).mis); } out.naiveN++; if (best <= lim) out.naive++; }
          out.naiveN++; // idling: no hindcast, no answer
          // competent: survey the basin with 6 probes, then a local pattern search; refit the month from the residuals
          let m = 0, n = 0, best = { mis: 99 };
          const refit = r => { const d = r.rows.filter(x => x.dt != null).map(x => x.dt).sort((a, b) => a - b); return d.length ? Math.max(0, Math.min(11, m - d[d.length >> 1])) : m; };
          const tryP = q => { if (n >= B) return; let r2 = f(q[0], q[1], m); n++; if (C.unknownDate) { const m2 = refit(r2); if (m2 !== m && n < B) { m = m2; r2 = f(q[0], q[1], m); n++; } } if (r2.mis < best.mis) best = { ...r2, pt: q }; };
          for (const fy of [.3, .7]) for (const fx of [.15, .45, .75]) tryP([A[0] + (A[1] - A[0]) * fy, A[2] + (A[3] - A[2]) * fx]);
          for (const st of [6, 3]) for (const [dl, dn] of [[st, 0], [-st, 0], [0, st], [0, -st]]) { if (best.mis <= lim * .7) break; tryP([best.pt[0] + dl, best.pt[1] + dn]); }
          out.comp.push(best.mis <= lim); out.compMis.push(+best.mis.toFixed(2));
        }
        return out; });
      ok(R.naive / R.naiveN <= .2, `naive bots solved ${R.naive}/${R.naiveN} late cases`);
      ok(R.comp.every(Boolean), 'competent survey-and-refine solves every case: ' + R.compMis);
      ok(R.compMis.every(m => m > 1.2), '3★ (≤1.2 months) needs better than the simple competent search: ' + R.compMis);
    },
    'touch: no hover tooltip left behind after a finger drag; jittery taps still drop': async ({ page, eq, ok }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), p2 = await ctx.newPage();
      await p2.goto(page.url()); await p2.waitForFunction(() => window.__fl && __fl.ready2, null, { timeout: 60000 });
      await p2.evaluate(() => { for (let i = 0; i < 9; i++) __fl.SAVE.done[i] = 1; __fl.load(9); });
      const cdp = await ctx.newCDPSession(p2), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', 195, 420); for (let k = 1; k <= 6; k++) await touch('touchMove', 195 - k * 15, 420 - k * 4); await touch('touchEnd');
      await p2.waitForTimeout(100);
      eq(await p2.$eval('#tip', t => t.style.display), 'none', 'tooltip stuck after a drag');
      const [x, y, vis] = await p2.evaluate(() => __fl.screenOf(0, -150));
      if (vis) { await touch('touchStart', x, y); await touch('touchMove', x + 9, y + 3); await touch('touchEnd'); await p2.waitForTimeout(100); ok(await p2.evaluate(() => __fl.ducks.length === 100), 'a 9 px finger jitter should still drop'); }
      await ctx.close();
    },
    'case files: generated per seed, crackable by the scripted detective, not by random hindcasts; runs score and climb': async ({ page, eq, ok }) => {
      await unlock(page);
      const r = await page.evaluate(() => { const X = __fl, o = {}; X.load(9);
        const a = X.genCase(77, 3), b = X.genCase(77, 3), c = X.genCase(78, 3); o.det = JSON.stringify([a.truth, a.windage, a.truthMonth]) === JSON.stringify([b.truth, b.windage, b.truthMonth]); o.differ = JSON.stringify(a.truth) !== JSON.stringify(c.truth);
        o.solved = [X.detective(a).solved, X.detective(c).solved];
        // random detectives: twelve hindcasts anywhere, random month and cargo
        let rs = 5, wins = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
        const pool = [a, c, ...[79, 80, 81, 82].map(sd => X.genCase(sd, 3))]; o.basins = pool.map(C => C.basin); for (const C of pool) for (let k = 0; k < 2; k++) { let best = 99; for (let j = 0; j < C.budget; j++) { const A = C.area, sim = X.sightingsOf(X.hindcast(A[0] + rnd() * (A[1] - A[0]), A[2] + rnd() * (A[3] - A[2]), C.years || 5, rnd() < .5 ? 6 : 22, 400, 7)).map(q => ({ ...q, t: q.t + Math.floor(rnd() * 12) / 12 })); best = Math.min(best, X.misfit(C.log, sim)); } if (best <= 3) wins++; }
        o.naive = wins;
        // play a run: the true answer solves case 1, scores, and the next file is harder
        X.load(10); X.startCaseFile(501, 1); const C1 = X.level.case; X.caseState.left = C1.budget; X.caseState.month = C1.truthMonth; X.caseState.wnd = C1.windage;
        X.dropAt(...C1.truth); for (let t = 0; t < 5; t += .05) X.step(.05); X.simT = 5; X.check();
        o.run = [X.run.n, X.run.score > 0, X.SAVE.runBest > 0, X.reportOn];
        document.getElementById('tnext').click(); o.next = [X.level.case.rung, X.level.case.seed, location.hash];
        return o; });
      ok(r.det && r.differ, 'deterministic per seed, different across seeds');
      eq(r.solved, [true, true]);
      ok(r.naive <= 2, 'random hindcasting cracked ' + r.naive + '/12 in ' + r.basins); // about 1 in 18 tries by chance, across all three basins
      eq(r.run, [1, true, true, true]); eq(r.next, [2, 502, '#case=502-2']);
    },
    'globe view: + and − dolly, drag turns the globe, wheel zooms, reset returns to the voyage view': async ({ page, ok, near }) => {
      await page.evaluate(() => __fl.load(0)); await page.waitForTimeout(200);
      const home = await page.evaluate(() => __fl.camPos), d0 = await page.evaluate(() => __fl.camDist);
      await page.click('#vIn'); await page.waitForFunction(() => !__fl.viewTo, null, { timeout: 15000 }); const d1 = await page.evaluate(() => __fl.camDist); ok(d1 < d0 * .85, `zoomed in ${d0} → ${d1}`);
      await page.click('#vOut'); await page.waitForFunction(() => !__fl.viewTo, null, { timeout: 15000 }); await page.click('#vOut'); await page.waitForFunction(() => !__fl.viewTo, null, { timeout: 15000 }); ok(await page.evaluate(() => __fl.camDist) > d1 * 1.4, 'zoomed out');
      const vp = page.viewportSize(); await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.wheel(0, -400); await page.waitForTimeout(600);
      ok(await page.evaluate(() => __fl.camDist) < await page.evaluate(() => 9), 'wheel zoom stays in range');
      const before = await page.evaluate(() => __fl.camPos);
      await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.down(); await page.mouse.move(vp.width / 2 + 160, vp.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(500);
      const after = await page.evaluate(() => __fl.camPos); ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > .3, 'drag turned the view');
      await page.click('#vReset'); await page.waitForFunction(() => !__fl.viewTo, null, { timeout: 15000 }); await page.waitForTimeout(100); // eased by frames, so wait for the move itself, not a fixed time
      const back = await page.evaluate(() => __fl.camPos); for (let i = 0; i < 3; i++) near(back[i], home[i], .1, 'reset axis ' + i);
      ok((await page.evaluate(() => __fl.ducks.length)) === 0, 'view controls drop nothing');
    },
    'case files run survives a reload: hindcasts spent stay spent, score and case kept; a fresh open resumes; dates follow the spill': async ({ page, eq, ok }) => {
      await unlock(page);
      const a = await page.evaluate(() => { const X = __fl; X.load(10); X.startCaseFile(612, 2); X.load(10); const C = X.level.case;
        const A = C.area, lat = (A[0] + A[1]) / 2, lon = (((A[2] + A[3]) / 2 + 540) % 360) - 180; X.dropAt(lat, lon); const Y = X.level.years; for (let t = 0; t < Y; t += .05) X.step(.05); X.simT = Y; X.check();
        X.caseState.month = 3; document.getElementById('cmonth') && document.getElementById('cmonth').onchange({ target: { value: 3 } });
        return { seed: C.seed, rung: C.rung, left: X.caseState.left, budget: C.budget, n: X.caseState.results.length, start: C.start }; });
      ok(a.left === a.budget - 1, 'one hindcast spent ' + JSON.stringify(a));
      await page.evaluate(() => { history.replaceState(null, '', location.pathname); }); await page.reload(); await ready(page);
      const b = await page.evaluate(() => { const X = __fl; return { lvl: !!X.level.endless, seed: X.level.case.seed, rung: X.level.case.rung, left: X.caseState.left, n: X.caseState.results.length, month: X.caseState.month, txt: document.getElementById('goal').textContent }; });
      eq([b.lvl, b.seed, b.rung, b.left, b.n, b.month], [true, a.seed, a.rung, a.left, 1, 3], 'reload with no hash resumes the run');
      ok(/hindcasts left: \d+/i.test(b.txt) && b.txt.includes('' + a.left), 'table shows the spent budget');
      // postcards and the clock never pre-date the spill
      const d = await page.evaluate(() => { const X = __fl, st = X.level.case.start; return [X.dateOf(0), X.dateOf(1.5), st[0]]; });
      ok(+d[0].split(' ')[1] >= d[2] && +d[1].split(' ')[1] >= d[2], 'card dates ' + d);
      ok(/APR/.test(d[0]), 'the chosen spill month dates the cards: ' + d[0]);
    },
    'uncharted seas: worlds are generated per seed from the same physics; western intensification follows each world\'s spin': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __fl, o = { same: true, differ: true, west: [], east: [] };
        const key = W => W.lm.reduce((a, v, k) => (a * 31 + v * (k % 97 + 1)) % 1000000007, 7) + ':' + W.st.vmax.toFixed(6) + ':' + JSON.stringify(W.calls.map(c => c.at)) + W.rot + W.names;
        const k1 = key(X.genWorld(4242, 3)); o.same = k1 === key(X.genWorld(4242, 3)); o.differ = k1 !== key(X.genWorld(4243, 3));
        // where in each basin is the water fastest? fraction of the way across, from its western shore, weighted by speed
        for (let sd = 1; o.west.length < 3 || o.east.length < 3; sd++) { if (sd > 60) break; const W = X.genWorld(sd * 37, 2); if (!W) continue;
          const f = X.withWorld(W, () => { let num = 0, den = 0; const V = [0, 0];
            for (let la = -50; la <= 50; la += 2) { if (Math.abs(la) < 12) continue; const row = []; for (let lo = -180; lo < 180; lo += 1) row.push(X.isLand(la, lo));
              for (let i = 0; i < 360; i++) { if (row[i]) continue; let w = 0, e = 0; while (w < 360 && !row[(i - w - 1 + 720) % 360]) w++; while (e < 360 && !row[(i + e + 1) % 360]) e++; if (w + e > 300 || w + e < 20) continue; X.vel(la, -180 + i, V); const sp = Math.hypot(V[0], V[1]) ** 2; num += sp * w / (w + e); den += sp; } }
            return num / den; });
          (W.spin > 0 ? o.west : o.east).push(+f.toFixed(3)); }
        return o; });
      ok(r.same && r.differ, 'same seed, same world; another seed, another world');
      ok(r.west.every(f => f < .45), 'spinning like Earth: the fast water hugs the western shores ' + r.west);
      ok(r.east.every(f => f > .55), 'spinning backwards: it hugs the eastern shores ' + r.east);
    },
    'uncharted seas, difficulty: the true answer beats a drifter probe, which beats a careful chart reader, who beats a guess': async ({ page, ok }) => {
      await page.evaluate(SEA_BOTS);
      const r = await page.evaluate(() => [1, 3].map(rg => { const res = seaBots(__fl, [11, 22, 33, 44], rg), sum = k => res.reduce((a, x) => a + (x ? x[k] : 0), 0); return { rg, n: sum('calls') * 40, oracle: sum('oracle'), probe: sum('drift'), careful: sum('careful'), naive: sum('naive'), ok: res.every(Boolean) }; }));
      for (const x of r) { ok(x.ok, 'every world generated');
        ok(x.oracle > .5 * x.n, `rung ${x.rg}: a perfect answer finds most crews (${(x.oracle / x.n * 100).toFixed(0)}%)`);
        ok(x.oracle > x.probe && x.probe > x.careful && x.careful > 1.8 * x.naive, `rung ${x.rg}: oracle ${x.oracle.toFixed(0)} > probe ${x.probe.toFixed(0)} > careful ${x.careful.toFixed(0)} > naive ${x.naive.toFixed(0)}`); }
      console.log('      seas, crew found per 100 [rung, oracle, probe, careful, naive]: ' + JSON.stringify(r.map(x => [x.rg, ...['oracle', 'probe', 'careful', 'naive'].map(k => Math.round(x[k] / x.n * 100))])));
    },
    'uncharted seas: a chart is scored against the true flow (along it scores high, against it and at random score low)': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __fl, W = X.genWorld(9090, 2);
        const along = X.withWorld(W, () => { const out = [], V = [0, 0]; for (let la = -54; la <= 54; la += 12) for (let lo = -174; lo < 180; lo += 24) { if (X.isLand(la, lo)) continue; let a = la, o = lo; const st = [[a, o]]; for (let k = 0; k < 10; k++) { X.vel(a, o, V); const sp = Math.hypot(V[0], V[1]); if (sp < .0035) break; /* 1°/year, in m/s */ a += V[1] / sp * 1.6; o += V[0] / sp * 1.6 / Math.cos(a * Math.PI / 180); if (X.isLand(a, o)) break; st.push([a, o]); } if (st.length > 3) out.push(st); } return out; });
        let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const random = along.map(st => { const a = (rnd() - .5) * 100, o = rnd() * 360 - 180, h = rnd() * 6.28; return Array.from({ length: 8 }, (_, k) => [a + Math.sin(h) * k * 1.6, o + Math.cos(h) * k * 1.6]); });
        return { along: X.chartScore(W, along), against: X.chartScore(W, along.map(st => st.slice().reverse())), random: X.chartScore(W, random), none: X.chartScore(W, []) }; });
      ok(r.along.pts >= 80 && r.along.acc > .9, 'along the currents: ' + JSON.stringify(r.along)); ok(r.against.pts === 0, 'against them: ' + r.against.pts);
      ok(r.random.pts < 30, 'random arrows: ' + r.random.pts); ok(r.none.pts === 0, 'no chart: 0');
    },
    'uncharted seas, played with the mouse: drop drifters, draw an arrow, answer every call, see the truth; reload resumes; leaving restores Earth': async ({ page, ok, eq }) => {
      const gulf = () => page.evaluate(() => { const v = __fl.vel(36, -72); return Math.hypot(v[0], v[1]); }); const g0 = await gulf();
      await page.evaluate(() => { localStorage.removeItem('rh:floatees'); __fl.seaStart(2024, 1, false); __fl.load(__fl.LV.findIndex(l => l.seas)); });
      const W0 = await page.evaluate(() => [__fl.W.seed, __fl.W.rung]); eq(W0, [2024, 1], 'the world on the globe');
      // a click on open sea at the screen centre drops a drifter (find a sea pixel near the centre)
      const spot = await page.evaluate(() => { for (let r = 0; r < 200; r += 10) for (let a = 0; a < 6.28; a += .5) { const x = innerWidth / 2 + r * Math.cos(a), y = innerHeight / 2 + r * Math.sin(a), e = { clientX: x, clientY: y }; const ll = __fl.latLonAtXY(x, y); if (ll && !__fl.isLand(ll[0], ll[1]) && !__fl.isLand(ll[0] + 4, ll[1]) && !__fl.isLand(ll[0], ll[1] + 4)) return [x, y]; } return null; });
      ok(spot, 'found open sea on screen'); await page.mouse.click(spot[0], spot[1]); eq(await page.evaluate(() => __fl.sea.dr.length), 1, 'a click drops a drifter');
      await page.waitForTimeout(800); ok(await page.evaluate(() => __fl.sea.dr[0].shown > 3), 'the drifter reports in, month by month');
      // draw: the globe must not turn while you draw
      await page.click('#sDraw'); const cam0 = await page.evaluate(() => __fl.camPos);
      await page.mouse.move(spot[0] - 40, spot[1]); await page.mouse.down(); for (let k = 1; k <= 10; k++) await page.mouse.move(spot[0] - 40 + k * 8, spot[1] - k * 2); await page.mouse.up();
      eq(await page.evaluate(() => __fl.sea.chart.length), 1, 'a drag in draw mode makes an arrow'); eq(await page.evaluate(() => __fl.camPos), cam0, 'and does not turn the globe');
      await page.click('#sDraw'); await page.click('#sRadio'); eq(await page.evaluate(() => __fl.sea.phase), 'calls', 'the radio opens');
      // reload mid-voyage: same world, same drifter, same arrow, same call
      await page.evaluate(() => { history.replaceState(null, '', location.pathname); }); await page.reload(); await page.waitForFunction(() => window.__fl && __fl.ready2 && __fl.W, null, { timeout: 60000 });
      eq(await page.evaluate(() => [__fl.W.seed, __fl.sea.dr.length, __fl.sea.chart.length, __fl.sea.phase, __fl.sea.ci]), [2024, 1, 1, 'calls', 0], 'a reload resumes the world');
      for (let i = 0; i < 3; i++) {
        const c = await page.evaluate(() => { const c = __fl.W.calls[__fl.sea.ci]; return __fl.screenOf(c.best.at[0], c.best.at[1]); });
        await page.evaluate(() => { const c = __fl.W.calls[__fl.sea.ci]; __fl.lookAt(c.best.at[0], c.best.at[1]); }); await page.waitForFunction(() => !__fl.viewTo, null, { timeout: 20000 }); await page.waitForTimeout(300);
        const xy = await page.evaluate(() => { const c = __fl.W.calls[__fl.sea.ci]; return __fl.screenOf(c.best.at[0], c.best.at[1]); });
        await page.mouse.click(xy[0], xy[1]); ok(await page.evaluate(() => !!__fl.sea.pick), 'a click picks where the ship waits');
        await page.selectOption('#sMonth', String(await page.evaluate(() => Math.max(1, Math.round(__fl.W.calls[__fl.sea.ci].best.t * 12)))));
        await page.click('#sSend'); ok(await page.evaluate(i => __fl.sea.answers[i] && __fl.sea.answers[i].saved >= 3, i), 'a good answer rescues crew: ' + await page.evaluate(i => JSON.stringify(__fl.sea.answers[i]), i));
        await page.click('#sNextC');
      }
      const end = await page.evaluate(() => ({ ph: __fl.sea.phase, sc: __fl.sea.score, rev: __fl.W.revealed, n: __fl.sea.n }));
      eq([end.ph, end.rev, end.n], ['done', true, 1], 'the voyage ends with the truth shown'); ok(end.sc.total > 0 && end.sc.crew >= 9, 'scored: ' + JSON.stringify(end.sc));
      await page.click('#snext'); eq(await page.evaluate(() => [__fl.W.seed, __fl.W.rung, __fl.sea.phase]), [2025, 2, 'survey'], 'a good voyage moves on to a harder world');
      await page.evaluate(() => __fl.load(1)); eq(await page.evaluate(() => __fl.SEA), null, 'leaving: Earth is back'); const g1 = await gulf(); ok(Math.abs(g1 - g0) < 1e-9, `the Gulf Stream is Earth's again (${g0} vs ${g1})`);
    },
    'corrupted / odd saves load without errors': async ({ page, eq }) => {
      const u = page.url(); await page.goto('about:blank'); // stop the first globe rendering while the others load
      for (const [save, cur] of [['null', 0], ['{"done":{"0":1,"9":1,"x":1},"stars":"q","cards":7,"cur":3}', 1]]) {
        const p2 = await page.context().newPage(), errs = []; p2.on('pageerror', e => errs.push(e.message));
        await p2.goto(u); await p2.evaluate(s => localStorage.setItem('rh:floatees', s), save); await p2.reload(); await p2.waitForFunction(() => window.__fl, null, { timeout: 30000 });
        eq(errs, [], 'errors for ' + save); eq(await p2.evaluate(() => __fl.SAVE.cur), cur, 'voyage for ' + save);
        await p2.close();
      }
    },
    'no overflow or console errors at phone and desktop sizes': async ({ page, ok }) => {
      await unlock(page);
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h });
        for (const i of [0, 3, 6, 9]) { await page.evaluate(i => __fl.load(i), i); await page.waitForTimeout(120); }
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + w);
      }
    },
  },
};
