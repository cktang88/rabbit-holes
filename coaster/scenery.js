// The Coaster Designer: the park around the 3D ride (sky, light, ground, trees, rides, people, car park).
// A classic script; all files share one global scope, loaded in order by index.html. Everything here is built once per
// design (v3Build) and animated by sceneryTick. Real-world scale throughout: metres, people ~1.75 m, trees 7-20 m.

// ---------- sky: a CC0 HDRI from Poly Haven (assets/), which also lights the scene (IBL) and gives the sun's direction ----------
const SKIES = { day: { file: 'assets/sky_day_1k.hdr', sun: 3.2, exp: .95, lamp: 0 }, dusk: { file: 'assets/sky_dusk_1k.hdr', sun: 2.2, exp: 1.25, lamp: 2.5 } };
// the sun is the brightest pixel of the sky; the haze colour is the mean of the sky just above the horizon, bright spots clipped (both in linear light)
function skyAnalyse(T, tex) {
  const im = tex.image, W = im.width, H = im.height, d = im.data, ch = d.length / (W * H), half = d instanceof Uint16Array, rd = half ? i => T.DataUtils.fromHalfFloat(d[i]) : i => d[i];
  let best = -1, br = 0, bc = 0, hz = [0, 0, 0], hn = 0;
  for (let r = 0; r < H / 2; r++) for (let c = 0; c < W; c += 2) { const i = (r * W + c) * ch, R = rd(i), Gg = rd(i + 1), B = rd(i + 2), l = .2126 * R + .7152 * Gg + .0722 * B;
    if (l > best) { best = l; br = r; bc = c; } if (r > H / 2 - H / 40) { const k = Math.min(1, 1.2 / Math.max(l, 1e-6)); hz[0] += R * k; hz[1] += Gg * k; hz[2] += B * k; hn++; } } // the sun itself doesn't tint the haze
  // texture rows run top (sky) to bottom with flipY; three.js maps u = atan2(z, x)/2π + .5, v = asin(y)/π + .5
  const el = (.5 - (br + .5) / H) * Math.PI, ph = ((bc + .5) / W - .5) * Math.PI * 2;
  const i = (br * W + bc) * ch, sc = [rd(i), rd(i + 1), rd(i + 2)], m = Math.max(...sc) || 1;
  // then clip the sun's disc to a bright-but-sane radiance: the directional light carries the sun's real power, and an
  // unclipped disc (thousands at dusk) would bloom across the whole frame and speckle the reflections
  const CAP = 24, wr = half ? (i, x) => { d[i] = T.DataUtils.toHalfFloat(x); } : (i, x) => { d[i] = x; };
  for (let k = 0; k < W * H; k++) { const i = k * ch, R = rd(i), Gg = rd(i + 1), B = rd(i + 2), l = .2126 * R + .7152 * Gg + .0722 * B; if (l > CAP) { const f = CAP / l; wr(i, R * f); wr(i + 1, Gg * f); wr(i + 2, B * f); } }
  tex.needsUpdate = true;
  return { dir: [Math.cos(ph) * Math.cos(el), Math.sin(el), Math.sin(ph) * Math.cos(el)], el, sunCol: sc.map(x => x / m), haze: hz.map(x => x / hn) };
}
function skyLoad(tod) {
  const T = window.THREE, X = window.THREE_X; V3.skies = V3.skies || {};
  if (V3.skies[tod] || !X || !X.RGBELoader || !V3.r) return V3.skies[tod];
  V3.skies[tod] = { loading: true };
  new X.RGBELoader().load(SKIES[tod].file, tex => {
    tex.mapping = T.EquirectangularReflectionMapping; const a = skyAnalyse(T, tex), pm = new T.PMREMGenerator(V3.r);
    const env = pm.fromEquirectangular(tex).texture; pm.dispose(); tex.userData.keep = env.userData.keep = true;
    V3.skies[tod] = { tex, env, ...a }; if (V3.tod === tod && V3.scene) { skyApply(); if (play) v3Frame(play); else if (V3.on) v3Render(); }
  }, undefined, () => { V3.skies[tod] = { failed: true }; });
}
// put the loaded sky on the scene: background, environment light, haze colour, sun direction and colour
function skyApply() {
  const T = window.THREE, sc = V3.scene, k = V3.skies && V3.skies[V3.tod], cfg = SKIES[V3.tod]; if (!sc) return;
  if (!k || !k.tex) { V3.skyDome.visible = true; sc.background = null; sc.environment = null; V3.sunDir = [-.5, .72, .48]; V3.hemi.intensity = 1.1; sc.fog.color.setRGB(.72, .8, .82); V3.sun.color.setRGB(1, .94, .82); V3.sun.intensity = 2.4; V3.r.toneMappingExposure = 1; return; }
  V3.skyDome.visible = false; sc.background = k.tex; sc.environment = k.env; sc.environmentIntensity = .9; sc.backgroundIntensity = 1;
  V3.hemi.intensity = .15; V3.sunDir = k.el > .03 ? k.dir : [k.dir[0], .03, k.dir[2]];
  sc.fog.color.setRGB(...k.haze); V3.sun.color.setRGB(...k.sunCol); V3.sun.intensity = cfg.sun; V3.r.toneMappingExposure = cfg.exp;
  if (V3.lampMat) V3.lampMat.emissiveIntensity = cfg.lamp; if (V3.flare) V3.flare.visible = true;
}

// ---------- small helpers ----------
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), w = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w; }
// lumpy blob: an icosphere pushed in and out by noise (canopies, bushes, rocks)
function blob(T, r, det, rough, seed) { const g = new T.IcosahedronGeometry(r, det), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 1 + rough * (vnoise(x * 1.7 + seed, z * 1.7 + y * 1.3) - .5) * 2; P.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals(); return g; }
function stdMat(T, o = {}) { return new T.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, ...o }); }

// ---------- the park ----------
function buildScenery(T, sc, S, F) {
  const terr = site.terrain, rnd = RH.rng(17), mob = V3.mob, M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), Sc = new T.Vector3(), Yx = new T.Vector3(0, 1, 0);
  // sky dome for before the HDRI arrives (or if it can't): painted clouds, one texture
  { const tex = canvasTex(T, 1024, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f6fb8'); gr.addColorStop(.38, '#7fb2df'); gr.addColorStop(.5, '#e4ece8'); gr.addColorStop(1, '#e4ece8'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      const r = RH.rng(9); for (let k = 0; k < 46; k++) { const cx = r() * w, cy = h * (.3 + r() * .16), s = 14 + r() * 40; for (let j = 0; j < 7; j++) { const px = cx + (r() - .5) * s * 3, py = cy + (r() - .5) * s * .5, rr = s * (.5 + r() * .6);
        for (const ox of [0, -w, w]) { x.save(); x.translate(px + ox, py); x.scale(1, .45); const g2 = x.createRadialGradient(0, 0, 0, 0, 0, rr); g2.addColorStop(0, 'rgba(255,255,255,.6)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.fillRect(-rr, -rr, rr * 2, rr * 2); x.restore(); } } } });
    V3.skyDome = V3.sky = new T.Mesh(new T.SphereGeometry(1000, 18, 12), new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false, depthWrite: false })); V3.skyDome.renderOrder = -1; sc.add(V3.skyDome); }
  // light: a weak sky fill (the HDRI does the real ambient), one shadow-casting sun that follows the train
  V3.hemi = new T.HemisphereLight(0xdcecff, 0x4f6f34, 1.1); sc.add(V3.hemi);
  { const sun = V3.sun = new T.DirectionalLight(0xfff0d2, 2.4), sz = mob ? 1024 : 2048, R = mob ? 30 : 42; sun.castShadow = true; sun.shadow.mapSize.set(sz, sz);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 420 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .08; sun.shadow.camera.updateProjectionMatrix(); V3.sunR = R;
    sc.add(sun); sc.add(sun.target); }
  sc.fog = new T.Fog(0xdde8e6, 120, 900);

  // where things are: the track's footprint (3D frames, so turns and side-steps count), the plaza, the rides, the car park
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const f of F) { x0 = Math.min(x0, f.p[0]); x1 = Math.max(x1, f.p[0]); z0 = Math.min(z0, f.p[2]); z1 = Math.max(z1, f.p[2]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.max(x1 - x0, z1 - z0) / 2 + 170;
  const few = []; for (let i = 0; i < S.length; i += 6) few.push(i);
  const groundAt = (X, Z) => { let ws = 0, hs = 0, lk = 0; for (const i of few) { const d2 = (F[i].p[0] - X) ** 2 + (F[i].p[2] - Z) ** 2 + 4, w = 1 / (d2 * d2); ws += w; hs += w * terr(S[i].x); if (site.lake && S[i].x > site.lake[0] && S[i].x < site.lake[1]) lk += w; } return [hs / ws, lk / ws]; };
  const nearTrack = (X, Z, r) => few.some(i => (F[i].p[0] - X) ** 2 + (F[i].p[2] - Z) ** 2 < r * r);
  const gy = (X, Z) => groundAt(X, Z)[0]; V3.groundAt = groundAt; V3.nearTrack = nearTrack;
  const taken = []; const free = (X, Z, r, trackR = r + 4) => !nearTrack(X, Z, trackR) && groundAt(X, Z)[1] < .4 && taken.every(([a, b, q]) => (a - X) ** 2 + (b - Z) ** 2 > (q + r) ** 2);
  const take = (X, Z, r, tag) => taken.push([X, Z, r, tag]); // tag 'station': beside the track on purpose
  V3.taken = taken;
  const f0 = F[0], h0 = S[0].head, L0 = [-Math.sin(h0), Math.cos(h0)], fw0 = [Math.cos(h0), Math.sin(h0)], stA = -h0;
  // the station platform sits beside the track on the side away from the plaza
  let plaza = null; for (const d of [-22, 22, -32, 32, -44, 44, -58, 58]) { const X = f0.p[0] + L0[0] * d + fw0[0] * 6, Z = f0.p[2] + L0[1] * d + fw0[1] * 6; if (!nearTrack(X, Z, 15)) { plaza = [X, Z, Math.sign(d)]; break; } }
  if (!plaza) plaza = [f0.p[0] - fw0[0] * 34, f0.p[2] - fw0[1] * 34, -1];
  take(f0.p[0] - fw0[0] * 7, f0.p[2] - fw0[1] * 7, 10); take(plaza[0], plaza[1], 15);
  const site2 = (r, tries) => { for (const [a, d] of tries) { const X = plaza[0] + L0[0] * a + fw0[0] * d, Z = plaza[1] + L0[1] * a + fw0[1] * d; if (free(X, Z, r)) { take(X, Z, r); return [X, Z]; } } return null; };
  const s = plaza[2];
  V3.wheelAt = site2(12, [[28 * s, 0], [28 * s, 22], [28 * s, -22], [0, 34], [0, -34], [-28 * s, 30]]);
  const carouselAt = site2(8, [[4 * s, 26], [4 * s, -26], [22 * s, 26], [22 * s, -26], [-6 * s, 30]]);
  const parkAt = site2(22, [[64 * s, 0], [64 * s, 34], [64 * s, -34], [0, 64], [0, -64], [-60 * s, 40], [90 * s, 0]]);
  V3.layout = { plaza, wheel: V3.wheelAt, carousel: carouselAt, park: parkAt, cx, cz, half };

  // ---------- ground: a polar grid, fine near the park and coarser toward the horizon (terrain LOD) ----------
  { const segs = mob ? 96 : 144, rings = [0]; let r = 0; while (r < 1500) { r += r < half ? (mob ? 5 : 3.5) : Math.max(6, r * .12); rings.push(Math.min(r, 1500)); }
    const pos = [], col = [], uv = [], idx = [], c = new T.Color();
    rings.forEach((R, j) => { const n = j ? segs : 1; for (let k = 0; k < n; k++) { const a = k / segs * Math.PI * 2, X = cx + Math.cos(a) * R, Z = cz + Math.sin(a) * R, far = clamp((R - half) / 300, 0, 1);
      const [hh, lk] = groundAt(X, Z), wet = lk > .5, y = (wet ? Math.min(hh, .9) : hh) - far * far * 12; pos.push(X, y, Z); uv.push(X / 9, Z / 9);
      const m = vnoise(X / 40, Z / 40), m2 = vnoise(X / 9 + 7, Z / 9); c.setRGB(.84 + m * .22 - m2 * .06, .9 + m * .14, .78 + m2 * .1); if (wet) c.setRGB(.16, .33, .5); col.push(c.r, c.g, c.b); } });
    for (let k = 0; k < segs; k++) idx.push(0, 1 + (k + 1) % segs, 1 + k);
    for (let j = 1; j < rings.length - 1; j++) { const a0 = 1 + (j - 1) * segs, b0 = 1 + j * segs; for (let k = 0; k < segs; k++) { const k1 = (k + 1) % segs; idx.push(a0 + k, a0 + k1, b0 + k, a0 + k1, b0 + k1, b0 + k); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const mat = stdMat(T, { roughness: 1, color: 0x8fae62 }); if (!V3.grassTex) { V3.grassTex = new T.TextureLoader().load('assets/grass_1k.jpg', () => { if (V3.on && !play) v3Render(); }); const t = V3.grassTex; t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = mob ? 4 : 8; t.userData.keep = true; }
    mat.map = V3.grassTex; const ground = new T.Mesh(g, mat); ground.receiveShadow = true; sc.add(ground); V3.ground = ground; }
  // distant hills, soft and hazy
  { const geo = blob(T, 1, 1, .35, 3), Mh = new T.InstancedMesh(geo, stdMat(T, { vertexColors: false, color: 0x6f8f62, roughness: 1, flatShading: false }), 34);
    for (let k = 0; k < 34; k++) { const a = k / 34 * Math.PI * 2 + rnd() * .2, R2 = Math.max(half + 260, 520) + rnd() * 260, w = 90 + rnd() * 140, hh = 30 + rnd() * 60; V.set(cx + Math.cos(a) * R2, -hh * .25, cz + Math.sin(a) * R2); Q.setFromAxisAngle(Yx, rnd() * 6); Sc.set(w, hh, w * .8); M.compose(V, Q, Sc); Mh.setMatrixAt(k, M); }
    sc.add(Mh); }

  // ---------- static props, merged into one mesh (one draw call): station + queue, plaza, stalls, benches, fences, lamp posts, car park ----------
  const props = [], lamps = [], blobs = [], standing = [];
  // the station stands on the level run-in behind the first point of the track (the train starts in it, nose out toward the lift)
  const SO = [f0.p[0] - fw0[0] * 7, f0.p[2] - fw0[1] * 7], stY = gy(SO[0], SO[1]), tH = Math.max(0, f0.p[1] - stY);
  const st = (geo, colr, x, y, z, ry = 0) => { V.set(x, 0, z).applyAxisAngle(Yx, stA); props.push([geo, colr, M4(T, SO[0] + V.x, stY + y, SO[1] + V.z, 0, stA + ry)]); };
  const stW = (x, z) => { V.set(x, 0, z).applyAxisAngle(Yx, stA); return [SO[0] + V.x, SO[1] + V.z]; };
  { // station: platform both sides, a red roof on cream posts, gold trim, a queue maze on the plaza side (people walk from the plaza into it) with people waiting in it
    const side = s; st(new T.BoxGeometry(18, .35, 7.6), 0xb8302a, 0, tH + 3.6, 0); st(new T.BoxGeometry(18.4, .55, .3), 0xe8b84a, 0, tH + 3.3, 3.8); st(new T.BoxGeometry(18.4, .55, .3), 0xe8b84a, 0, tH + 3.3, -3.8);
    for (const a of [-8.5, -4.25, 0, 4.25, 8.5]) for (const b of [-3.4, 3.4]) st(new T.CylinderGeometry(.16, .2, tH + 3.4, 8), 0xf4e8cc, a, (tH + 3.4) / 2, b);
    st(new T.BoxGeometry(18, tH + .3, 2.6), 0x9c8f7a, 0, (tH + .3) / 2, 2.1 * side); st(new T.BoxGeometry(18, tH + .3, 2.6), 0x9c8f7a, 0, (tH + .3) / 2, -2.1 * side); // platforms level with the car floor
    st(new T.BoxGeometry(18, .06, .25), 0xf2d24a, 0, tH + .33, .9 * side); /* the yellow line */
    for (let r = 0; r < 4; r++) { const z = (4.4 + r * 1.3) * side; st(new T.BoxGeometry(14, .06, .06), 0xd8d6cf, 0, 1.0, z); for (let x = -7; x <= 7; x += 2) st(new T.CylinderGeometry(.04, .04, 1, 5), 0xd8d6cf, x, .5, z);
      for (let k = 0; k < 7; k++) { const [X, Z] = stW(-6 + k * 2 + rnd() * .6, z - .65 * side); standing.push([X, Z, rnd() * 6]); } }
    for (const [x, z] of [[-9, 0], [9, 0]]) { const [X, Z] = stW(x, z); blobs.push([X, Z, 6]); } take(...stW(0, 7 * side), 8, 'station'); }
  { // plaza: paving, a fountain, stalls with striped awnings, benches, bins, lamps
    const [X, Z] = plaza, Y = gy(X, Z); props.push([new T.CylinderGeometry(15, 15.3, .3, 40), (x, y, z) => ((Math.floor(Math.hypot(x, z) / 1.5) % 2) ? 0xd9c49a : 0xcdb88c), M4(T, X, Y - .08, Z)]);
    props.push([new T.CylinderGeometry(3, 3.2, .7, 24), 0xb9b2a4, M4(T, X, Y + .35, Z)], [new T.CylinderGeometry(.3, .4, 2.2, 10), 0xb9b2a4, M4(T, X, Y + 1.1, Z)], [new T.CylinderGeometry(1, .6, .4, 14), 0xb9b2a4, M4(T, X, Y + 2.1, Z)]);
    V3.water = [X, Y + .62, Z];
    const sx0 = SO[0] + L0[0] * 4.5 * s, sz0 = SO[1] + L0[1] * 4.5 * s, dx = X - sx0, dz = Z - sz0, len = Math.hypot(dx, dz);
    props.push([new T.BoxGeometry(3.4, .12, len), 0xd9c49a, new T.Matrix4().compose(new T.Vector3((X + sx0) / 2, gy((X + sx0) / 2, (Z + sz0) / 2) + .02, (Z + sz0) / 2), new T.Quaternion().setFromAxisAngle(Yx, Math.atan2(dx, dz)), new T.Vector3(1, 1, 1))]);
    V3.paths = [[[sx0, sz0], [X - dx / len * 14, Z - dz / len * 14]]];
    const awn = [0xd8402f, 0x2f6fb8, 0xe8b84a, 0x3c9a5c, 0x8a4fb8, 0xe07a30];
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + .35 + Math.atan2(-dz, -dx), R = 13, sx = X + Math.cos(a) * R, sz = Z + Math.sin(a) * R; if (Math.abs(Math.atan2(Math.sin(a - Math.atan2(-dz, -dx)), Math.cos(a - Math.atan2(-dz, -dx)))) < .45) continue;
      const y = gy(sx, sz), ry = -a + Math.PI / 2, m = (dx2, dy, dz2, ry2 = 0) => { const v = new T.Vector3(dx2, 0, dz2).applyAxisAngle(Yx, ry); return M4(T, sx + v.x, y + dy, sz + v.z, 0, ry + ry2); }, c = awn[k % awn.length];
      props.push([new T.BoxGeometry(3, 2.3, 2.2), 0xf4ead6, m(0, 1.15, 0)], [new T.BoxGeometry(3.1, .9, .1), 0x6a4a32, m(0, 1.05, -1.12)]);
      for (let j = 0; j < 6; j++) props.push([new T.BoxGeometry(.52, .08, 1.5), j % 2 ? 0xffffff : c, new T.Matrix4().multiplyMatrices(m(-1.3 + j * .52, 2.55, -.9), new T.Matrix4().makeRotationX(.35))]);
      blobs.push([sx, sz, 4]); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2, bx = X + Math.cos(a) * 7.5, bz = Z + Math.sin(a) * 7.5, y = gy(bx, bz), ry = -a; // benches: seat 0.45 m, back 0.85 m
      const m = (dx2, dy, dz2) => { const v = new T.Vector3(dx2, 0, dz2).applyAxisAngle(Yx, ry); return M4(T, bx + v.x, y + dy, bz + v.z, 0, ry); };
      props.push([new T.BoxGeometry(.45, .06, 1.6), 0x8a5a34, m(0, .45, 0)], [new T.BoxGeometry(.06, .4, 1.6), 0x8a5a34, m(.22, .7, 0)], [new T.BoxGeometry(.4, .45, .06), 0x333333, m(0, .22, -.7)], [new T.BoxGeometry(.4, .45, .06), 0x333333, m(0, .22, .7)]);
      if (k % 2) lamps.push([X + Math.cos(a + .39) * 9.5, Z + Math.sin(a + .39) * 9.5]); }
    for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2, fx = X + Math.cos(a) * 16, fz = Z + Math.sin(a) * 16; if (Math.abs(Math.atan2(Math.sin(a - Math.atan2(-dz, -dx)), Math.cos(a - Math.atan2(-dz, -dx)))) < .2) continue; if (nearTrack(fx, fz, 2)) continue;
      props.push([new T.BoxGeometry(.08, 1, .08), 0xf4e8cc, M4(T, fx, gy(fx, fz) + .5, fz)], [new T.BoxGeometry(.05, .05, 1.6), 0xf4e8cc, M4(T, fx, gy(fx, fz) + .85, fz, 0, -a)]); }
    for (let t = .2; t < 1; t += .3) lamps.push([sx0 + dx * t + dz / len * 2.4, sz0 + dz * t - dx / len * 2.4]); }
  if (parkAt) { // the car park: asphalt with painted bays, cars in about two thirds of them, a path to the plaza
    const [X, Z] = parkAt, Y = gy(X, Z), a = Math.atan2(fw0[1], fw0[0]);
    const tex = canvasTex(T, 512, 256, (x, w, h) => { x.fillStyle = '#4a4a4c'; x.fillRect(0, 0, w, h); const r = RH.rng(5); for (let k = 0; k < 4000; k++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.06)'; x.fillRect(r() * w, r() * h, 2, 2); }
      x.strokeStyle = '#e8e8e0'; x.lineWidth = 3; for (const yy of [0, h - 50]) for (let k = 0; k <= 16; k++) { x.beginPath(); x.moveTo(k * w / 16, yy + 2); x.lineTo(k * w / 16, yy + 48); x.stroke(); } });
    const lot = new T.Mesh(new T.PlaneGeometry(44, 22), new T.MeshStandardMaterial({ map: tex, roughness: .95 })); lot.rotation.set(-Math.PI / 2, 0, -a); lot.position.set(X, Y + .04, Z); lot.receiveShadow = true; sc.add(lot);
    V3.parked = []; const ca = Math.cos(a), sa = Math.sin(a);
    for (const row of [-1, 1]) for (let k = 0; k < 16; k++) { if (rnd() < .3) continue; const u = -22 + (k + .5) * 44 / 16, w = row * (11 - 2.1), px = X + ca * u - sa * w, pz = Z + sa * u + ca * w; V3.parked.push([px, gy(px, pz), pz, -a + Math.PI / 2 * row + (rnd() - .5) * .06]); }
    for (const [u, w] of [[-22, -11], [22, -11], [-22, 11], [22, 11], [0, 0]]) lamps.push([X + ca * u - sa * w, Z + sa * u + ca * w]);
    const dx = plaza[0] - X, dz = plaza[1] - Z, len = Math.hypot(dx, dz); if (len > 30) { const mx = (X + plaza[0]) / 2, mz = (Z + plaza[1]) / 2;
      props.push([new T.BoxGeometry(3, .1, len - 26), 0xcdb88c, new T.Matrix4().compose(new T.Vector3(mx, gy(mx, mz) + .03, mz), new T.Quaternion().setFromAxisAngle(Yx, Math.atan2(dx, dz)), new T.Vector3(1, 1, 1))]);
      V3.paths.push([[X + dx / len * 12, Z + dz / len * 12], [plaza[0] - dx / len * 15, plaza[1] - dz / len * 15]]); } }
  if (C.req.depth) { const r0 = z0 - 3; for (const zz of [r0, r0 + C.req.depth]) for (let X = x0 - 6; X <= x1 + 6; X += 2.5) props.push([new T.BoxGeometry(.1, 1.2, .1), 0xf4e8cc, M4(T, X, gy(X, zz) + .6, zz)]);
    for (const zz of [r0, r0 + C.req.depth]) for (const yy of [.5, 1.05]) props.push([new T.BoxGeometry(x1 - x0 + 12, .06, .06), 0xf4e8cc, M4(T, cx, gy(cx, zz) + yy, zz)]); }
  for (const [X, Z] of lamps) { const y = gy(X, Z); props.push([new T.CylinderGeometry(.07, .1, 4, 6), 0x2c3a36, M4(T, X, y + 2, Z)]); }
  { const m = new T.Mesh(mergeParts(T, props), stdMat(T)); m.castShadow = m.receiveShadow = true; sc.add(m); }
  // lamp heads glow at dusk (their own emissive material)
  if (lamps.length) { V3.lampMat = new T.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffc870, emissiveIntensity: 0, roughness: .4 }); const Ml = new T.InstancedMesh(new T.SphereGeometry(.28, 10, 6), V3.lampMat, lamps.length);
    lamps.forEach(([X, Z], k) => { M.makeTranslation(X, gy(X, Z) + 4.1, Z); Ml.setMatrixAt(k, M); }); sc.add(Ml); }
  if (V3.parked && V3.parked.length) { // parked cars: 4.3 m long, 1.8 m wide, 1.45 m tall
    const geo = mergeParts(T, [[new T.BoxGeometry(1.8, .7, 4.3), 0xffffff, M4(T, 0, .55, 0)], [new T.BoxGeometry(1.6, .55, 2.3), 0xffffff, M4(T, 0, 1.17, .2)], [new T.BoxGeometry(1.62, .45, 2.1), 0x223040, M4(T, 0, 1.17, .2)],
      ...[[-.9, -1.4], [.9, -1.4], [-.9, 1.4], [.9, 1.4]].map(([x, z]) => [new T.CylinderGeometry(.33, .33, .22, 10), 0x1a1a1a, M4(T, x, .33, z, 0, 0, Math.PI / 2)])]);
    const Mc = new T.InstancedMesh(geo, stdMat(T, { roughness: .35, metalness: .4 }), V3.parked.length), cols = [0xb02020, 0x2050a0, 0xe0e0e0, 0x303030, 0x707880, 0x1d6b3a, 0xd8b040];
    V3.parked.forEach(([X, Y, Z, r], k) => { Q.setFromAxisAngle(Yx, r); V.set(X, Y, Z); Sc.set(1, 1, 1); M.compose(V, Q, Sc); Mc.setMatrixAt(k, M); Mc.setColorAt(k, new T.Color(cols[(rnd() * cols.length) | 0])); });
    Mc.castShadow = true; sc.add(Mc); }

  // ---------- rides that move: the Ferris wheel (40 m class: 24 m across) and a carousel ----------
  if (V3.wheelAt) { const [X, Z] = V3.wheelAt, Y = gy(X, Z), hub = 14, a = Math.atan2(L0[1], L0[0]), legs = [];
    for (const sd of [-1.4, 1.4]) for (const t of [-1, 1]) { const bx = X + Math.cos(a + Math.PI / 2) * sd * 2.2 + Math.cos(a) * 6 * t, bz = Z + Math.sin(a + Math.PI / 2) * sd * 2.2 + Math.sin(a) * 6 * t, tx = X + Math.cos(a + Math.PI / 2) * sd, tz = Z + Math.sin(a + Math.PI / 2) * sd;
      const L = Math.hypot(tx - bx, Y + hub - Y, tz - bz), dir = new T.Vector3(tx - bx, hub, tz - bz).normalize(); legs.push([new T.CylinderGeometry(.22, .3, L, 8), 0xf4e8cc, new T.Matrix4().compose(new T.Vector3((bx + tx) / 2, Y + hub / 2, (bz + tz) / 2), new T.Quaternion().setFromUnitVectors(Yx, dir), new T.Vector3(1, 1, 1))]); }
    legs.push([new T.BoxGeometry(6, .4, 4), 0x9c8f7a, M4(T, X, Y + .2, Z, 0, -a)]); const lm = new T.Mesh(mergeParts(T, legs), stdMat(T, { roughness: .5, metalness: .3 })); lm.castShadow = true; sc.add(lm);
    const parts = []; for (const z of [-1.1, 1.1]) parts.push([new T.TorusGeometry(12, .18, 6, 48), 0xf4e8cc, M4(T, 0, 0, z)], [new T.TorusGeometry(6, .1, 4, 32), 0xe8b84a, M4(T, 0, 0, z)]);
    for (let k = 0; k < 16; k++) for (const z of [-1.1, 1.1]) parts.push([new T.BoxGeometry(.1, 12, .1), 0xf4e8cc, M4(T, Math.cos(k / 16 * Math.PI * 2) * 6, Math.sin(k / 16 * Math.PI * 2) * 6, z, 0, 0, k / 16 * Math.PI * 2 + Math.PI / 2)]);
    parts.push([new T.CylinderGeometry(.6, .6, 3, 12), 0x999999, M4(T, 0, 0, 0, Math.PI / 2)]);
    V3.wheel = new T.Mesh(mergeParts(T, parts), stdMat(T, { roughness: .45, metalness: .35 })); V3.wheel.position.set(X, Y + hub, Z); V3.wheel.rotation.y = -a + Math.PI / 2; V3.wheel.castShadow = true; sc.add(V3.wheel);
    // gondolas hang level from the rim (one instanced mesh, placed every frame)
    const gg = mergeParts(T, [[new T.CylinderGeometry(.9, 1.1, 1.4, 10), 0xffffff, M4(T, 0, -1.4, 0)], [new T.ConeGeometry(1.1, .6, 10), 0xffffff, M4(T, 0, -.4, 0)], [new T.CylinderGeometry(.04, .04, 1, 4), 0x999999, M4(T, 0, -.2, 0)]]);
    V3.gond = new T.InstancedMesh(gg, stdMat(T, { roughness: .5 }), 16); const gc = [0xc8382b, 0x2f6fb8, 0xe8b84a, 0x3c9a5c]; for (let k = 0; k < 16; k++) V3.gond.setColorAt(k, new T.Color(gc[k % 4])); V3.gond.castShadow = true; V3.gond.frustumCulled = false; sc.add(V3.gond);
    V3.wheelAng = 0; V3.wheelBase = [X, Y + hub, Z, a]; blobs.push([X, Z, 9]); }
  if (carouselAt) { const [X, Z] = carouselAt, Y = gy(X, Z), parts = [];
    parts.push([new T.CylinderGeometry(7, 7.2, .5, 32), 0xe8d8b8, M4(T, 0, .25, 0)], [new T.CylinderGeometry(.5, .5, 4.6, 12), 0xe8b84a, M4(T, 0, 2.5, 0)]);
    parts.push([new T.ConeGeometry(7.6, 2.4, 24, 1, true), (x, y, z) => (Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 12)) % 2 ? 0xc8382b : 0xf6efe0), M4(T, 0, 5.8, 0)], [new T.CylinderGeometry(7.6, 7.6, .6, 24, 1, true), 0xe8b84a, M4(T, 0, 4.4, 0)], [new T.SphereGeometry(.5, 10, 6), 0xe8b84a, M4(T, 0, 7.2, 0)]);
    V3.carousel = new T.Mesh(mergeParts(T, parts), stdMat(T, { side: T.DoubleSide, roughness: .6 })); V3.carousel.position.set(X, Y, Z); V3.carousel.castShadow = true; sc.add(V3.carousel);
    const horse = mergeParts(T, [[new T.BoxGeometry(.4, .5, 1.4), 0xffffff, M4(T, 0, 0, 0)], [new T.BoxGeometry(.3, .6, .35), 0xffffff, M4(T, 0, .4, -.7, -.5)], [new T.CylinderGeometry(.04, .04, 4, 5), 0xe8b84a, M4(T, 0, .9, 0)],
      ...[[-.14, -.5], [.14, -.5], [-.14, .5], [.14, .5]].map(([x, z]) => [new T.BoxGeometry(.1, .6, .1), 0xffffff, M4(T, x, -.5, z)])]);
    V3.horses = new T.InstancedMesh(horse, stdMat(T, { roughness: .4 }), 12); const hc = [0xffffff, 0x8a5a34, 0x333333, 0xe8d8b8]; for (let k = 0; k < 12; k++) V3.horses.setColorAt(k, new T.Color(hc[k % 4])); V3.horses.frustumCulled = false; sc.add(V3.horses);
    V3.carBase = [X, Y, Z]; V3.carAng = 0; blobs.push([X, Z, 9]); }

  // ---------- trees: broadleaf and pine near the park (full geometry), cross-quad impostors far out ----------
  V3.trees = [];
  { const broad = mergeParts(T, [[new T.CylinderGeometry(.22, .38, 4, 7), 0x6b4a32, M4(T, 0, 2, 0)], [blob(T, 2.6, 1, .25, 1), 0xffffff, M4(T, 0, 5.6, 0)], [blob(T, 2, 1, .3, 2), 0xffffff, M4(T, 1.4, 4.8, .6)], [blob(T, 1.9, 1, .3, 3), 0xffffff, M4(T, -1.2, 5, -.7)], ...(mob ? [] : [[blob(T, 1.6, 1, .3, 4), 0xffffff, M4(T, .2, 7.2, -.3)]])]);
    const pine = mergeParts(T, [[new T.CylinderGeometry(.18, .3, 3, 6), 0x5a3e2a, M4(T, 0, 1.5, 0)], ...[0, 1, 2, 3].map(k => [new T.ConeGeometry(2.4 - k * .5, 3.4, 9), 0xffffff, M4(T, 0, 3.4 + k * 2, 0)])]);
    // trunk colours are baked dark; canopies take the instance tint
    const near = [], farP = [], green = [0x3f6e2e, 0x4c7d34, 0x5a8a3a, 0x355f2a, 0x6b8f3a], autumn = [0xb07a2c, 0x9a4a24], pines = [0x2f5232, 0x284a2c, 0x3a5e38];
    const tryTree = (X, Z, far) => { if (!free(X, Z, far ? 3 : 2.4, far ? 10 : 7)) return; const sc2 = far ? .9 + rnd() * .5 : .85 + rnd() * .6, pine2 = rnd() < .4; take(X, Z, 2.4 * sc2);
      (far ? farP : near).push([X, gy(X, Z), Z, sc2, pine2, rnd() * 6, pine2 ? pines[(rnd() * 3) | 0] : rnd() < .08 ? autumn[(rnd() * 2) | 0] : green[(rnd() * 5) | 0]]); };
    for (let t = 0; t < 2200 && near.length < (mob ? 120 : 190); t++) tryTree(cx + (rnd() - .5) * half * 1.6, cz + (rnd() - .5) * half * 1.6, false);
    for (let t = 0; t < 3000 && farP.length < (mob ? 260 : 420); t++) { const a = rnd() * Math.PI * 2, R2 = half * .85 + rnd() * 140; tryTree(cx + Math.cos(a) * R2, cz + Math.sin(a) * R2, true); }
    for (const [geo, isPine] of [[broad, false], [pine, true]]) { const list = near.filter(t => t[4] === isPine); if (!list.length) continue; const Mt = new T.InstancedMesh(geo, stdMat(T, { roughness: .9 }), list.length);
      list.forEach(([X, Y, Z, s2, , r, c], k) => { V.set(X, Y - .2, Z); Q.setFromAxisAngle(Yx, r); Sc.set(s2, s2 * (.9 + hash2(X, Z) * .3), s2); M.compose(V, Q, Sc); Mt.setMatrixAt(k, M); Mt.setColorAt(k, new T.Color(c)); blobs.push([X, Z, 5 * s2]); });
      Mt.castShadow = true; Mt.receiveShadow = true; sc.add(Mt); V3.trees.push(Mt); }
    // impostors: two crossed quads with a painted tree (alpha-tested), two kinds in one texture
    const tex = canvasTex(T, 256, 256, (x, w, h) => { const paint = (ox, isPine) => { x.fillStyle = '#4a3424'; x.fillRect(ox + 60, 180, 8, 76);
      if (isPine) for (let k = 0; k < 5; k++) { x.fillStyle = k % 2 ? '#2c4a2e' : '#33553a'; x.beginPath(); x.moveTo(ox + 64, 20 + k * 30); x.lineTo(ox + 64 - (22 + k * 9), 80 + k * 34); x.lineTo(ox + 64 + (22 + k * 9), 80 + k * 34); x.fill(); }
      else { const r = RH.rng(ox + 1); for (let k = 0; k < 26; k++) { const px = ox + 64 + (r() - .5) * 56, py = 92 + (r() - .5) * 90, rr = 14 + r() * 13, g2 = x.createRadialGradient(px - 5, py - 6, 2, px, py, rr); g2.addColorStop(0, '#6f9a48'); g2.addColorStop(1, '#3a6128'); x.fillStyle = g2; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); } } };
      paint(0, false); paint(128, true); });
    tex.colorSpace = T.SRGBColorSpace;
    const quad = (u0) => { const g = new T.BufferGeometry(), p = [], uv = [], id = []; for (let q = 0; q < 2; q++) { const a = q * Math.PI / 2, c = Math.cos(a), s2 = Math.sin(a), b = q * 4;
      p.push(-3 * c, 0, -3 * s2, 3 * c, 0, 3 * s2, 3 * c, 12, 3 * s2, -3 * c, 12, -3 * s2); /* 12 m: the painted tree fills ~11 m of it */ uv.push(u0, 0, u0 + .5, 0, u0 + .5, 1, u0, 1); id.push(b, b + 1, b + 2, b, b + 2, b + 3); }
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(id); g.computeVertexNormals(); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); return g; };
    const imat = new T.MeshStandardMaterial({ map: tex, alphaTest: .5, side: T.DoubleSide, roughness: 1 });
    for (const [u0, isPine] of [[0, false], [.5, true]]) { const list = farP.filter(t => t[4] === isPine); if (!list.length) continue; const Mi = new T.InstancedMesh(quad(u0), imat, list.length);
      list.forEach(([X, Y, Z, s2, , r, c], k) => { V.set(X, Y - .3, Z); Q.setFromAxisAngle(Yx, r); Sc.set(s2, s2 * (isPine ? 1.15 : .85), s2); M.compose(V, Q, Sc); Mi.setMatrixAt(k, M); Mi.setColorAt(k, new T.Color(c).lerp(new T.Color(0xffffff), .6)); });
      sc.add(Mi); V3.trees.push(Mi); }
    V3.treeCount = [near.length, farP.length]; }
  // bushes and rocks scattered between the trees
  { const bush = blob(T, 1, 1, .35, 7), rock = blob(T, 1, 0, .4, 9), sp = []; for (let t = 0; t < 1500 && sp.length < (mob ? 110 : 180); t++) { const X = cx + (rnd() - .5) * half * 1.4, Z = cz + (rnd() - .5) * half * 1.4; if (!free(X, Z, 1.2, 5)) continue; sp.push([X, gy(X, Z), Z, rnd() < .7]); take(X, Z, 1.2); }
    for (const [geo, isB, mat] of [[bush, true, stdMat(T, { vertexColors: false, roughness: 1 })], [rock, false, stdMat(T, { vertexColors: false, roughness: .9, flatShading: true })]]) { const list = sp.filter(q => q[3] === isB); if (!list.length) continue; const Mb = new T.InstancedMesh(geo, mat, list.length);
      list.forEach(([X, Y, Z], k) => { const s2 = isB ? .6 + rnd() * .7 : .4 + rnd() * .9; V.set(X, Y + (isB ? s2 * .4 : s2 * .1), Z); Q.setFromEuler(new T.Euler(0, rnd() * 6, 0)); Sc.set(s2 * (1 + rnd() * .5), s2 * (isB ? .8 : .6), s2); M.compose(V, Q, Sc); Mb.setMatrixAt(k, M); Mb.setColorAt(k, new T.Color(isB ? [0x3f6a2c, 0x4f7a34, 0x5d8838][k % 3] : [0x9a9488, 0x857f74, 0xaaa396][k % 3])); });
      Mb.castShadow = true; sc.add(Mb); } }

  // ---------- people: ~1.75 m tall; walkers on the paths and round the plaza, a queue at the station ----------
  { const body = mergeParts(T, [[new T.CylinderGeometry(.2, .17, .62, 6), 0xffffff, M4(T, 0, 1.17, 0)], [new T.CylinderGeometry(.1, .1, .5, 5), 0xffffff, M4(T, -.26, 1.12, 0, 0, 0, .12)], [new T.CylinderGeometry(.1, .1, .5, 5), 0xffffff, M4(T, .26, 1.12, 0, 0, 0, -.12)]]);
    const rest = mergeParts(T, [[new T.CylinderGeometry(.16, .13, .86, 6), 0x2e3440, M4(T, 0, .43, 0)], [new T.SphereGeometry(.12, 7, 5), 0xe8c4a0, M4(T, 0, 1.61, 0)], [new T.SphereGeometry(.125, 7, 3, 0, 6.3, 0, 1.4), 0x3a2a1e, M4(T, 0, 1.64, .01)]]);
    const paths = V3.paths || [], wk = [], [PX, PZ] = plaza;
    for (let k = 0; k < (mob ? 70 : 110); k++) { const kind = rnd(); if (kind < .45 || !paths.length) { const r = 4 + rnd() * 9.5; wk.push({ c: 1, a: rnd() * 6.28, r, w: (rnd() < .5 ? -1 : 1) * (.9 + rnd() * .5) / r }); }
      else { const P = paths[(rnd() * paths.length) | 0]; wk.push({ c: 0, P, t: rnd(), w: (rnd() < .5 ? -1 : 1) * (1.1 + rnd() * .4) / Math.max(1, Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1])), side: (rnd() - .5) * 2.2 }); } }
    const n = wk.length + standing.length, shirt = [0xd8402f, 0x2f6fb8, 0xe8b84a, 0x3c9a5c, 0xf4e8cc, 0x8a4fb8, 0x333333, 0xe07a30, 0x40a0b0];
    V3.crowd = { wk, standing, n, body: new T.InstancedMesh(body, stdMat(T), n), rest: new T.InstancedMesh(rest, stdMat(T), n), plaza: [PX, PZ], gy, s: [] };
    for (let k = 0; k < n; k++) { V3.crowd.body.setColorAt(k, new T.Color(shirt[(rnd() * shirt.length) | 0])); V3.crowd.s.push(.95 + rnd() * .1); }
    for (const m of [V3.crowd.body, V3.crowd.rest]) { m.castShadow = V3.tier === 'high'; m.frustumCulled = false; sc.add(m); }
    crowdTick(0); }
  // contact shadows: soft dark blobs under trees, stalls and rides, baked once (one draw call)
  if (blobs.length) { const tex = canvasTex(T, 64, 64, (x, w) => { const g3 = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g3.addColorStop(0, 'rgba(0,0,0,.42)'); g3.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g3; x.fillRect(0, 0, w, w); });
    const Mb = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), blobs.length);
    blobs.forEach(([X, Z, r], k) => { V.set(X, gy(X, Z) + .05, Z); Q.identity(); Sc.set(r, 1, r); M.compose(V, Q, Sc); Mb.setMatrixAt(k, M); }); Mb.renderOrder = 1; sc.add(Mb); }
}

// ---------- per-frame animation (no allocations: scratch objects are reused) ----------
const _sc = {};
function crowdTick(dt) {
  const T = window.THREE, cr = V3.crowd; if (!cr) return; const M = _sc.M || (_sc.M = new T.Matrix4()), Q = _sc.Q || (_sc.Q = new T.Quaternion()), V = _sc.V || (_sc.V = new T.Vector3()), Sc = _sc.S || (_sc.S = new T.Vector3()), Y = _sc.Y || (_sc.Y = new T.Vector3(0, 1, 0)), t = V3.clock || 0;
  let k = 0; const put = (X, Z, yaw, bob) => { V.set(X, cr.gy(X, Z) + bob, Z); Q.setFromAxisAngle(Y, yaw); const s = cr.s[k]; Sc.set(s, s, s); M.compose(V, Q, Sc); cr.body.setMatrixAt(k, M); cr.rest.setMatrixAt(k, M); k++; };
  for (const w of cr.wk) { let X, Z, yaw;
    if (w.c) { w.a += w.w * dt; X = cr.plaza[0] + Math.cos(w.a) * w.r; Z = cr.plaza[1] + Math.sin(w.a) * w.r; yaw = -w.a + (w.w > 0 ? Math.PI : 0); }
    else { w.t += w.w * dt; if (w.t > 1 || w.t < 0) { w.w = -w.w; w.t = clamp(w.t, 0, 1); } const [a, b] = w.P, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; X = a[0] + dx * w.t - dz / L * w.side * .6; Z = a[1] + dz * w.t + dx / L * w.side * .6; yaw = Math.atan2(dx, dz) * 1 + (w.w > 0 ? 0 : Math.PI) + Math.PI; }
    put(X, Z, yaw, Math.abs(Math.sin(t * 9 + k)) * .04); }
  for (const [X, Z, r] of cr.standing) put(X, Z, r, 0);
  cr.body.instanceMatrix.needsUpdate = cr.rest.instanceMatrix.needsUpdate = true;
}
function sceneryTick(dt) {
  const T = window.THREE; V3.clock = (V3.clock || 0) + dt; const M = _sc.M2 || (_sc.M2 = new T.Matrix4()), V = _sc.V2 || (_sc.V2 = new T.Vector3()), Q = _sc.Q2 || (_sc.Q2 = new T.Quaternion()), Sc = _sc.S2 || (_sc.S2 = new T.Vector3(1, 1, 1)), Y = _sc.Y2 || (_sc.Y2 = new T.Vector3(0, 1, 0));
  if (V3.wheel) { V3.wheelAng += dt * .1; V3.wheel.rotation.z = V3.wheelAng; const [X, Yh, Z, a] = V3.wheelBase, ax = Math.cos(a), az = Math.sin(a);
    for (let k = 0; k < 16; k++) { const t = V3.wheelAng + k / 16 * Math.PI * 2, u = Math.cos(t) * 12, v = Math.sin(t) * 12; V.set(X + ax * u, Yh + v, Z + az * u); Q.setFromAxisAngle(Y, -a); M.compose(V, Q, Sc); V3.gond.setMatrixAt(k, M); }
    V3.gond.instanceMatrix.needsUpdate = true; }
  if (V3.carousel) { V3.carAng += dt * .5; V3.carousel.rotation.y = V3.carAng; const [X, Yb, Z] = V3.carBase;
    for (let k = 0; k < 12; k++) { const t = V3.carAng + k / 12 * Math.PI * 2, r = k % 2 ? 4.6 : 5.9; V.set(X + Math.cos(t) * r, Yb + 1.6 + Math.sin(V3.clock * 2.2 + k * 1.3) * .3, Z - Math.sin(t) * r); Q.setFromAxisAngle(Y, t); M.compose(V, Q, Sc); V3.horses.setMatrixAt(k, M); }
    V3.horses.instanceMatrix.needsUpdate = true; }
  crowdTick(dt);
}
