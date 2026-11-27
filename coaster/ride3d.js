// The Coaster Designer: the 3D ride: track frames, the train, the camera. A classic script; all files share one global scope, loaded in order by index.html.
// ================= the 3D ride (three.js) =================
// The track is extruded from the same samples the physics rode: height from the drawing, plan position and heading
// from the turns, roll from the banks. Budgets (phones): < 150 draw calls, < 300k triangles, pixel ratio 0.75-1.25
// adapting to hold the frame rate. Static props are merged, trees, people, cars and the train instanced; the park itself
// is in scenery.js.
// Test and lab flags (URL): ?fast=1 is notex + post=0 + shadows=0 + people=0 + low quality; each can also be given alone
// (?notex=1 ?post=0 ?shadows=0 ?people=0 ?scenery=0 ?q=low|high). ?lab=train|station|tree|crest builds only that piece,
// with the camera at &cam=x,y,z looking at &look=x,y,z. Explicit flags win over the fast preset.
// Perf off-switches, for A/B counts: ?nocull=1 (one instanced mesh per kind instead of spatial chunks), ?nosort=1 (no
// alpha-tested-last opaque sort), ?nofreeze=1 (per-frame matrix walk over the static scenery), ?shadowEvery=1 (shadow map
// re-rendered every frame instead of when the light moves or every other frame on phones).
const FLAGS = (() => { const q = new URLSearchParams(location.search), g = k => q.get(k), fast = g('fast') === '1', on = (k, d) => g(k) == null ? d : g(k) !== '0', v = k => g(k) ? g(k).split(',').map(Number) : null;
  return { fast, notex: on('notex', fast), post: on('post', !fast), shadows: on('shadows', !fast), people: on('people', !fast), scenery: on('scenery', true), nosort: g('nosort') === '1', nocull: g('nocull') === '1', nofreeze: g('nofreeze') === '1', shadowEvery: +(g('shadowEvery') || 0), lab: g('lab'), cam: v('cam'), look: v('look'), q: g('q') || (fast ? 'low' : null) }; })();
const part = k => !FLAGS.lab || FLAGS.lab === k || (Array.isArray(k) && k.includes(FLAGS.lab)); // which pieces a lab builds
const V3 = { on: false, want: true, chase: false, frames: null, key: '', bob: 0, dt: 1 / 60 };
// The design is a side profile, so in 3-D a loop's exit would run straight through its entry (and any part of the ride that
// comes back over itself would cross it). A real loop steps sideways by a track width and some clearance: wherever the track
// would pass within CLEAR of track it has already laid, the later section is moved sideways, eased in over RAMP metres of
// track (a smoothstep in arc length) and banked a little into the move. Visual only: the physics rides the 2-D profile.
const LOOP_W = 2.4, TRACK_W = 1.25; // centreline clearance between sections; rail to rail width
function sideShift(P0, L) {
  const n = P0.length, SEP = Math.round(6 / DS), RAMP = Math.round(20 / DS), C2 = LOOP_W * LOOP_W, o = new Float64Array(n);
  for (let it = 0; it < 5; it++) {
    const px = i => P0[i][0] + L[i][0] * o[i], pz = i => P0[i][2] + L[i][2] * o[i], lev = new Float64Array(n); let run = 0, any = false;
    const cell = new Map(), key = (a, b, c) => a * 73856093 ^ b * 19349663 ^ c * 83492791, cx = i => Math.floor(px(i) / LOOP_W), cy = i => Math.floor(P0[i][1] / LOOP_W), cz = i => Math.floor(pz(i) / LOOP_W);
    for (let i = 0; i < n; i++) { const k = key(cx(i), cy(i), cz(i)); (cell.get(k) || cell.set(k, []).get(k)).push(i); } // a grid, so only near samples are compared
    for (let i = 0; i < n; i++) { let def = 0; const xi = px(i), yi = P0[i][1], zi = pz(i), a = cx(i), b = cy(i), c = cz(i);
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (let dc = -1; dc <= 1; dc++) for (const j of cell.get(key(a + da, b + db, c + dc)) || []) { if (j >= i - SEP) continue;
        const dx = px(j) - xi, dy = P0[j][1] - yi, dz = pz(j) - zi, d2 = dx * dx + dy * dy + dz * dz; if (d2 < C2) def = Math.max(def, LOOP_W - Math.sqrt(d2)); }
      if (def > .01) any = true; run = Math.max(run, o[i] + (def > .01 ? def * 1.08 : 0)); lev[i] = run; }
    if (!any) break;
    for (let i = 0; i < n; i++) { let v = lev[i]; for (let k = i + 1; k <= Math.min(n - 1, i + RAMP); k++) { const h = 1 - (k - i) / RAMP; v = Math.max(v, lev[k] * h * h * (3 - 2 * h)); } o[i] = v; }
    const t = Float64Array.from(o); for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let k = Math.max(0, i - 4); k <= Math.min(n - 1, i + 4); k++) { a += t[k]; c++; } o[i] = Math.max(t[i] * .999, a / c); } // iron out the corners where ramps meet
  }
  return o;
}
function trackFrames(S) { // per sample: position, forward, up (rolled by the bank), side
  const n = S.length, bk = S.map(p => p.bank * Math.sign(p.kh || 0)), B = new Float64Array(n), W = 10;
  const Ls = S.map(p => [-Math.sin(p.head), 0, Math.cos(p.head)]), off = sideShift(S.map(p => [p.X, p.y, p.Z]), Ls);
  for (let i = 1; i < n - 1; i++) bk[i] += Math.atan(clamp((off[i + 1] - 2 * off[i] + off[i - 1]) / (DS * DS) * 12, -.35, .35)); // lean into the sideways step
  // a bank is set per node, so on its own it would snap on at the node: the steel twists into it over ~5 m each side
  for (let i = 0; i < n; i++) { if (S[i].ab) { B[i] = bk[i]; continue; } let a = 0, c = 0; for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) { const wt = W + 1 - Math.abs(k - i); a += bk[k] * wt; c += wt; } B[i] = a / c; } // auto-bank comes smooth from the physics; a manual bank twists in
  const F = S.map((p, i) => {
    const ch = Math.cos(p.head), shh = Math.sin(p.head), ct = Math.cos(p.th), st = Math.sin(p.th);
    const fwd = [ct * ch, st, ct * shh], upE = [-st * ch, ct, -st * shh], L = [-shh, 0, ch];
    const b = B[i], cb = Math.cos(b), sb = Math.sin(b), sh = off[i];
    const up = [upE[0] * cb + L[0] * sb, upE[1] * cb + L[1] * sb, upE[2] * cb + L[2] * sb];
    return { p: [p.X + L[0] * sh, p.y, p.Z + L[2] * sh], fwd, up };
  });
  // forward from the positions themselves (central differences), so the car points along the rails it rides, sideways drift included
  for (let i = 0; i < n; i++) { const a = F[Math.max(0, i - 1)].p, b = F[Math.min(n - 1, i + 1)].p, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
    if (l > 1e-6) F[i].fwd = d.map(v => v / l); const f = F[i].fwd, u = F[i].up, k = u[0] * f[0] + u[1] * f[1] + u[2] * f[2], u2 = [u[0] - f[0] * k, u[1] - f[1] * k, u[2] - f[2] * k], ul = Math.hypot(...u2) || 1;
    F[i].up = u2.map(v => v / ul); const U = F[i].up; F[i].side = [f[1] * U[2] - f[2] * U[1], f[2] * U[0] - f[0] * U[2], f[0] * U[1] - f[1] * U[0]]; }
  return F;
}
// a frame anywhere along the track: u is a fractional sample index; positions and directions interpolate between samples
// the track frame at fractional sample u; before the start the track runs level through the station, past the end it runs on straight,
// so the rows of a train that hang off the ends still sit on rails
function frameAt(u) { const F = V3.frames, n = F.length;
  if (u < 0) { const e = F[0], h = nrm([e.fwd[0], 0, e.fwd[2]]), d = u * DS; return { p: [e.p[0] + h[0] * d, e.p[1], e.p[2] + h[2] * d], fwd: h, up: [0, 1, 0] }; } // the station's level run-in
  if (u > n - 1) { const e = F[n - 1], d = (u - (n - 1)) * DS; return { p: [e.p[0] + e.fwd[0] * d, e.p[1] + e.fwd[1] * d, e.p[2] + e.fwd[2] * d], fwd: e.fwd, up: e.up }; }
  const i = clamp(Math.floor(u), 0, n - 1), j = Math.min(n - 1, i + 1), t = clamp(u - i, 0, 1), L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return { p: L(F[i].p, F[j].p), fwd: nrm(L(F[i].fwd, F[j].fwd)), up: nrm(L(F[i].up, F[j].up)) }; }
const nrm = u => { const l = Math.hypot(u[0], u[1], u[2]) || 1; return [u[0] / l, u[1] / l, u[2] / l]; };

function mergeParts(T, parts) {
  const pos = [], nor = [], col = [], c = new T.Color();
  for (const [g0, colr, m] of parts) {
    let g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m); if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, Nn = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i)); c.set(typeof colr === 'function' ? colr(P.getX(i), P.getY(i), P.getZ(i)) : colr); col.push(c.r, c.g, c.b); }
  }
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return out;
}
const M4 = (T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(s, s, s));
function canvasTex(T, w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }

// ---------- the train: five cars, two rows of two, restraints, wheel assemblies, couplings; riders instanced ----------
// Car frame: x right, y up, −z forward, origin on the track centreline at the car's middle. Gauge 1.1 m (rails at ±0.55),
// car 2.6 m long and 1.4 m wide, seat cushions 0.7 m above the rails, so a seated rider's eyes are 1.5 m up (EYE).
const SEAT_X = .32, ROW_Z = [-TRAIN.row / 2, TRAIN.row / 2], BOGIE = .9;
function carGeometry(T, front) {
  const red = 0xc8382b, dark = 0x7d1a14, gold = 0xe8b84a, cream = 0xf4e8cc, chrome = 0xd8d6cf, seat = 0x3a2418, parts = [];
  // tub: floor and sides, open on top; a sculpted nose on the front car
  parts.push([new T.BoxGeometry(1.4, .14, 2.6), dark, M4(T, 0, .36, 0)]);
  for (const sx of [-.68, .68]) parts.push([new T.BoxGeometry(.06, .5, 2.6), red, M4(T, sx, .64, 0)], [new T.BoxGeometry(.08, .05, 2.62), gold, M4(T, sx, .9, 0)]);
  parts.push([new T.BoxGeometry(1.4, .5, .06), red, M4(T, 0, .64, 1.28)]);
  if (front) { const sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(.5, 0, .72, .2); sh.quadraticCurveTo(.66, .4, .5, .44); sh.lineTo(0, .6); sh.closePath(); // sloping down to the tip so it doesn't fill the front-row view
    const nose = new T.ExtrudeGeometry(sh, { depth: 1.36, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2, curveSegments: 8 }); parts.push([nose, (x, y) => y < .1 ? dark : red, M4(T, -.68, .3, -1.25, 0, Math.PI / 2, 0)]);
    parts.push([new T.CircleGeometry(.16, 16), gold, M4(T, 0, .78, -1.66, -.5)], [new T.CircleGeometry(.1, 16), cream, M4(T, 0, .781, -1.658, -.5)]); }
  else parts.push([new T.BoxGeometry(1.4, .5, .06), red, M4(T, 0, .64, -1.28)]);
  // per row: a padded seat and back with headrests, a lap bar on a post for each rider
  for (const z of ROW_Z) { parts.push([new T.BoxGeometry(1.24, .16, .5), seat, M4(T, 0, .62, z + .05)], [new T.BoxGeometry(1.24, .62, .12), seat, M4(T, 0, 1.0, z + .32, -.12)]);
    for (const sx of [-SEAT_X, SEAT_X]) { parts.push([new T.CylinderGeometry(.13, .13, .14, 10), 0x4a2e1e, M4(T, sx, 1.42, z + .38, Math.PI / 2 - .12)]);
      parts.push([new T.TorusGeometry(.18, .03, 6, 12, Math.PI), chrome, M4(T, sx, .92, z - .2, -Math.PI / 2 + .5)], [new T.CylinderGeometry(.03, .03, .34, 6), chrome, M4(T, sx, .74, z - .34)]); } }
  return mergeParts(T, parts);
}
// a wheel assembly: chassis across both rails, road wheels on top of each rail, side-friction wheels outside it, up-stops below
function bogieGeometry(T) {
  const parts = [[new T.BoxGeometry(1.5, .12, .5), 0x444444, M4(T, 0, .3, 0)]];
  for (const s of [-1, 1]) { parts.push([new T.BoxGeometry(.1, .52, .44), 0x555555, M4(T, s * .72, .08, 0)]);
    for (const z of [-.16, .16]) parts.push([new T.CylinderGeometry(.15, .15, .1, 12), 0x222222, M4(T, s * .55, .225, z, 0, 0, Math.PI / 2)]);
    parts.push([new T.CylinderGeometry(.09, .09, .09, 10), 0x222222, M4(T, s * .55, -.165, 0, 0, 0, Math.PI / 2)], [new T.CylinderGeometry(.08, .08, .09, 10), 0x222222, M4(T, s * .705, 0, 0)]); }
  return mergeParts(T, parts);
}
// a seated rider (torso, head, hair) and their arms (pivoting at the shoulders, raised on drops and in airtime)
function riderGeometry(T) { return mergeParts(T, [[new T.CylinderGeometry(.19, .17, .58, 8), 0xffffff, M4(T, 0, 1.0, .08)], [new T.SphereGeometry(.115, 10, 8), 0xe8c4a0, M4(T, 0, 1.47, .06)], [new T.SphereGeometry(.12, 10, 6, 0, 6.3, 0, 1.4), 0x3a2a1e, M4(T, 0, 1.5, .08)], [new T.BoxGeometry(.32, .14, .42), 0x2e3440, M4(T, 0, .76, -.12)]]); }
function armsGeometry(T) { return mergeParts(T, [-1, 1].map(s => [new T.CylinderGeometry(.05, .045, .6, 6), 0xe8c4a0, M4(T, s * .24, -.3, 0, 0, 0, s * .1)])); }

// ---------- renderer, quality tier, post-processing ----------
// Tiers: phones and small screens 'low' (pixel ratio ≤ 1.25, 1024 shadow map, half-res bloom, a cheap flare, grading only),
// otherwise 'high' (ratio ≤ 2, 2048 soft shadows, god rays, chromatic aberration and zoom blur at speed). ?q=low|high overrides.
function v3Init() {
  const T = window.THREE; if (!T) return false; if (V3.r) return true;
  const mob = V3.mob = innerWidth < 860 || matchMedia('(pointer:coarse)').matches, q = FLAGS.q;
  V3.tier = q === 'low' || q === 'high' ? q : mob ? 'low' : 'high'; const hi = V3.tier === 'high';
  V3.r = new T.WebGLRenderer({ canvas: $('v3'), antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  V3.dprMax = FLAGS.fast ? 1 : Math.min(devicePixelRatio || 1, hi ? 2 : 1.25); V3.dprMin = hi ? 1 : .75; V3.dpr = V3.dprMax; V3.r.setPixelRatio(V3.dpr);
  V3.r.toneMapping = T.ACESFilmicToneMapping; V3.r.outputColorSpace = T.SRGBColorSpace; V3.r.shadowMap.enabled = FLAGS.shadows; V3.r.shadowMap.type = hi ? T.PCFSoftShadowMap : T.PCFShadowMap;
  if (!FLAGS.nosort) V3.r.setOpaqueSort((a, b) => { const ta = a.material.alphaTest > 0, tb = b.material.alphaTest > 0; return (ta - tb) || (a.groupOrder - b.groupOrder) || (a.renderOrder - b.renderOrder) || (!ta && a.material.id !== b.material.id ? a.material.id - b.material.id : a.z - b.z) || (a.id - b.id); });
  // 5. the shadow map is drawn only when asked (see v3Frame), not every frame
  V3.r.shadowMap.autoUpdate = false; V3.shadowRenders = 0; V3.frames3 = 0;
  V3.cam = new T.PerspectiveCamera(72, 1, .08, 2400);
  V3.carGeo = [carGeometry(T, true), carGeometry(T, false)]; V3.bogieGeo = bogieGeometry(T); V3.riderGeo = riderGeometry(T); V3.armGeo = armsGeometry(T);
  V3.tod = SAVE.tod === 'dusk' ? 'dusk' : 'day'; V3.seat = SAVE.seat >= 0 && SAVE.seat < 6 ? SAVE.seat : 0; V3.ft = [];
  // speed streaks ride with the camera
  const n = 40, sp = new Float32Array(n * 6); V3.streak = { n, p: Array.from({ length: n }, () => [0, 0, -40]) };
  const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(sp, 3));
  V3.lines = new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false })); V3.lines.frustumCulled = false; V3.cam.add(V3.lines);
  // the post chain (unless ?post=0) and the HDRI loader stream in after the first frame
  if (window.THREE_X) { if (FLAGS.post) v3Post(); } else addEventListener('three-x', () => { if (FLAGS.post) v3Post(); if (V3.scene) { skyLoad(V3.tod); if (FLAGS.post) v3Build(true); if (V3.on) play ? v3Frame(play) : v3Render(); } }, { once: true });
  return true;
}
const GRADE = { uniforms: { tDiffuse: { value: null }, uVig: { value: .28 }, uSplit: { value: .06 }, uCA: { value: 0 }, uZoom: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSplit, uCA, uZoom; varying vec2 vUv;
    void main(){ vec2 d = vUv - .5; vec3 c;
      if (uZoom > .001) { c = vec3(0.); for (int i = 0; i < 6; i++) { float k = 1. - uZoom * float(i) / 6.; c += texture2D(tDiffuse, .5 + d * k).rgb; } c /= 6.; } else c = texture2D(tDiffuse, vUv).rgb;
      if (uCA > .0001) { c.r = texture2D(tDiffuse, .5 + d * (1. + uCA)).r; c.b = texture2D(tDiffuse, .5 + d * (1. - uCA)).b; }
      float l = dot(c, vec3(.2126, .7152, .0722)); c += uSplit * mix(vec3(-.25, .02, .3), vec3(.35, .1, -.3), smoothstep(.2, .8, l)) * .35; // cool shadows, warm highlights
      c *= 1. - uVig * smoothstep(.35, .95, length(d * vec2(1.25, 1.))); gl_FragColor = vec4(c, 1.); }` };
const RAYS = { uniforms: { tDiffuse: { value: null }, uSun: { value: null }, uAmt: { value: 0 } },
  vertexShader: GRADE.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uAmt; varying vec2 vUv;
    void main(){ vec4 base = texture2D(tDiffuse, vUv); if (uAmt < .001) { gl_FragColor = base; return; }
      vec2 st = (uSun - vUv) / 28.; vec2 p = vUv; vec3 acc = vec3(0.); float w = 1.;
      for (int i = 0; i < 28; i++) { p += st; vec3 s = min(texture2D(tDiffuse, p).rgb, vec3(4.)); acc += max(s - 1.2, 0.) * w; w *= .94; } // only the bright sky between the leaves and the track glows
      gl_FragColor = vec4(base.rgb + acc * uAmt * .012, base.a); }` };
function v3Post() {
  const T = window.THREE, X = window.THREE_X; if (!X || !X.EffectComposer || V3.comp) return;
  const hi = V3.tier === 'high', c = V3.comp = new X.EffectComposer(V3.r); c.setPixelRatio(V3.dpr);
  V3.rp = new X.RenderPass(null, V3.cam); c.addPass(V3.rp);
  V3.bloom = new X.UnrealBloomPass(new T.Vector2(256, 256), hi ? .22 : .16, .45, 1.6); c.addPass(V3.bloom);
  if (hi) { V3.rays = new X.ShaderPass(RAYS); V3.rays.uniforms.uSun.value = new T.Vector2(.5, .5); c.addPass(V3.rays); }
  c.addPass(new X.OutputPass()); V3.grade = new X.ShaderPass(GRADE); c.addPass(V3.grade);
  // lens flare at the sun: occluded by the track and the trees (three.js tests the pixels behind it each frame)
  const glow = canvasTex(T, 128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(.2, 'rgba(255,230,190,.5)'); g.addColorStop(1, 'rgba(255,200,150,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const ring = canvasTex(T, 64, 64, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, w * .3, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(180,220,255,.1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const fl = V3.flare = new X.Lensflare(); fl.addElement(new X.LensflareElement(glow, hi ? 420 : 260, 0, new T.Color(1, .95, .85)));
  if (hi) for (const [s, d] of [[60, .45], [90, .65], [140, .85], [70, 1]]) fl.addElement(new X.LensflareElement(ring, s, d)); else fl.addElement(new X.LensflareElement(ring, 80, .7));
  V3.post = true; v3Size();
}
function v3Size() { if (!V3.r) return; V3.r.setPixelRatio(V3.dpr); V3.r.setSize(innerWidth, innerHeight, false); if (V3.comp) { V3.comp.setPixelRatio(V3.dpr); V3.comp.setSize(innerWidth, innerHeight); } V3.cam.aspect = innerWidth / innerHeight; V3.cam.updateProjectionMatrix(); }
// draw one frame (through the post stack when it has loaded); adapt the pixel ratio to hold the frame rate
function v3Render() {
  if (V3.noRender || !V3.scene) return; const T = window.THREE, cam = V3.cam;
  if (V3.flare && V3.sunDir) { const d = V3.sunDir; V3.flare.position.set(cam.position.x + d[0] * 2000, cam.position.y + d[1] * 2000, cam.position.z + d[2] * 2000); }
  if (V3.rays) { const v = _r3.v || (_r3.v = new T.Vector3()); v.set(...(V3.sunDir || [0, 1, 0])).add(cam.position); v.project(cam); const front = v.z < 1 && Math.abs(v.x) < 1.6 && Math.abs(v.y) < 1.6;
    V3.rays.uniforms.uSun.value.set(v.x * .5 + .5, v.y * .5 + .5); V3.rays.uniforms.uAmt.value = front && V3.skies && V3.skies[V3.tod] && V3.skies[V3.tod].tex ? 1 : 0; }
  V3.r.info.autoReset = false; V3.r.info.reset(); // count every pass of the frame (draw calls and triangles budgets)
  if (V3.comp) { V3.rp.scene = V3.scene; V3.comp.render(); } else V3.r.render(V3.scene, cam);
  V3.stats = { calls: V3.r.info.render.calls, tris: V3.r.info.render.triangles };
  const now = performance.now(); if (V3.lastR) { V3.ft.push(now - V3.lastR); if (V3.ft.length >= 45) { const m = V3.ft.sort((a, b) => a - b)[22]; V3.ft.length = 0;
    const want = m > 21 ? V3.dpr - .15 : m < 15 ? V3.dpr + .1 : V3.dpr, nd = clamp(+want.toFixed(2), V3.dprMin, V3.dprMax); if (nd !== V3.dpr && !V3.fixedDpr) { V3.dpr = nd; v3Size(); } } }
  V3.lastR = now;
}
const _r3 = {};

function v3Build(force) {
  const T = window.THREE, S = design.S || (design.S = geometry(design)), key = enc(design) + '|' + C.id + '|' + V3.tod;
  if (V3.key === key && V3.scene && !force) return; V3.key = key;
  const keep = new Set([V3.lines.geometry, ...V3.carGeo, V3.bogieGeo, V3.riderGeo, V3.armGeo]);
  if (V3.scene) { V3.scene.remove(V3.cam); V3.scene.traverse(o => { if (o === V3.lines || keep.has(o.geometry)) return; if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.map && !m.map.userData.keep) m.map.dispose(); m.dispose(); } }); if (V3.flare) V3.scene.remove(V3.flare); }
  const sc = V3.scene = new T.Scene(), F = V3.frames = trackFrames(S), terr = site.terrain;
  V3.wheel = V3.carousel = V3.crowd = V3.lampMat = null; V3.paths = []; V3.parked = null;
  buildScenery(T, sc, S, F);
  // ---------- the track: PBR steel rails and spine (reflect the sky), ties, supports on concrete footings ----------
  { const tube = (off, rad, sides) => {
      // a ring every 1.5 m on the straights, every 0.5 m where the track bends or twists, so the car never cuts a visible corner
      const pos = [], idx = [], rings = [0], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; for (let i = 1; i < F.length - 1; i++) { const l = F[rings[rings.length - 1]]; if (i - rings[rings.length - 1] >= 3 || dot(l.fwd, F[i].fwd) < .9985 || dot(l.up, F[i].up) < .9985) rings.push(i); } rings.push(F.length - 1);
      rings.forEach((i, r2) => { const f = F[i], c = [f.p[0] + f.side[0] * off[0] + f.up[0] * off[1], f.p[1] + f.side[1] * off[0] + f.up[1] * off[1], f.p[2] + f.side[2] * off[0] + f.up[2] * off[1]];
        for (let s = 0; s < sides; s++) { const a = s / sides * Math.PI * 2, ca = Math.cos(a) * rad, sa = Math.sin(a) * rad; pos.push(c[0] + f.side[0] * ca + f.up[0] * sa, c[1] + f.side[1] * ca + f.up[1] * sa, c[2] + f.side[2] * ca + f.up[2] * sa); }
        if (r2) for (let s = 0; s < sides; s++) { const a = (r2 - 1) * sides + s, b = (r2 - 1) * sides + (s + 1) % sides, c2 = r2 * sides + s, d = r2 * sides + (s + 1) % sides; idx.push(a, c2, b, b, c2, d); } });
      const g2 = new T.BufferGeometry(); g2.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g2.setIndex(idx); g2.computeVertexNormals(); return g2; };
    const sides = V3.tier === 'high' ? 10 : 7, rails = new T.Mesh(mergeParts(T, [[tube([-.55, 0], .075, sides), 0xd8402f], [tube([.55, 0], .075, sides), 0xd8402f]]), new T.MeshStandardMaterial({ vertexColors: true, metalness: .75, roughness: .3 }));
    const spine = new T.Mesh(tube([0, -.4], .19, sides + 2), new T.MeshStandardMaterial({ color: 0xf1e6cf, metalness: .6, roughness: .4 }));
    for (const m of [rails, spine]) { m.castShadow = true; m.receiveShadow = true; sc.add(m); } V3.railMesh = rails; }
  { const n = Math.ceil(F.length / 3), M = new T.InstancedMesh(new T.BoxGeometry(1.35, .1, .24), new T.MeshStandardMaterial({ color: 0x4a3626, roughness: .7, metalness: .2 }), n), m4 = new T.Matrix4(); let k = 0;
    for (let i = 0; i < F.length; i += 3) { const f = F[i]; m4.makeBasis(new T.Vector3(...f.side), new T.Vector3(...f.up), new T.Vector3(...f.fwd)); m4.setPosition(f.p[0] - f.up[0] * .2, f.p[1] - f.up[1] * .2, f.p[2] - f.up[2] * .2); M.setMatrixAt(k++, m4); }
    M.count = k; M.castShadow = true; sc.add(M); }
  // supports: vertical columns from under the spine to the ground, on footings; none where another section of track is in the way
  { const n = Math.ceil(F.length / 8), col = new T.InstancedMesh(new T.CylinderGeometry(.16, .2, 1, 10), new T.MeshStandardMaterial({ color: 0xe9dfc8, metalness: .5, roughness: .45 }), n), foot = new T.InstancedMesh(new T.CylinderGeometry(.55, .65, .5, 10), new T.MeshStandardMaterial({ color: 0xa8a49a, roughness: .95 }), n), m4 = new T.Matrix4(); let k = 0; V3.supports = [];
    for (let i = 4; i < F.length; i += 8) { const f = F[i]; if (f.up[1] < .6) continue; const top = f.p[1] - f.up[1] * .55, gnd = V3.groundAt(f.p[0], f.p[2])[0], hh = top - gnd; if (hh < .6) continue;
      // the envelope: the column must not pass through any other part of the track (or its train's clearance, 2 m) below it
      let blocked = false; for (let j = 0; j < F.length && !blocked; j += 2) { if (Math.abs(j - i) < 12) continue; const g = F[j]; if ((g.p[0] - f.p[0]) ** 2 + (g.p[2] - f.p[2]) ** 2 < 2.2 ** 2 && g.p[1] < top + .5 && g.p[1] > gnd - 1) blocked = true; }
      if (blocked) continue;
      m4.compose(new T.Vector3(f.p[0], gnd + hh / 2, f.p[2]), new T.Quaternion(), new T.Vector3(1, hh, 1)); col.setMatrixAt(k, m4); m4.makeTranslation(f.p[0], gnd + .1, f.p[2]); foot.setMatrixAt(k, m4); V3.supports.push([f.p[0], gnd, f.p[2], top]); k++; }
    col.count = foot.count = k; col.castShadow = true; foot.receiveShadow = true; sc.add(col); sc.add(foot); }
  // the train
  { const nc = TRAIN.cars, mat = new T.MeshPhysicalMaterial({ vertexColors: true, metalness: .1, roughness: .45, clearcoat: 1, clearcoatRoughness: .08 }); // lacquered paint
    V3.trainF = new T.InstancedMesh(V3.carGeo[0], mat, 1); V3.train = V3.trainF; V3.trainR = new T.InstancedMesh(V3.carGeo[1], mat, nc - 1); V3.bogies = new T.InstancedMesh(V3.bogieGeo, new T.MeshStandardMaterial({ vertexColors: true, metalness: .6, roughness: .5 }), nc * 2);
    V3.coup = new T.InstancedMesh(new T.CylinderGeometry(.06, .06, 1, 6).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: 0x333333, metalness: .7, roughness: .4 }), nc - 1);
    const nr = nc * 4; V3.riders = new T.InstancedMesh(V3.riderGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), nr); V3.arms = new T.InstancedMesh(V3.armGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), nr);
    const rr = RH.rng(5), shirt = [0xd8402f, 0x2f6fb8, 0xe8b84a, 0x3c9a5c, 0xf4e8cc, 0x8a4fb8, 0x333333, 0xe07a30]; V3.riderState = [];
    for (let k = 0; k < nr; k++) { V3.riders.setColorAt(k, new T.Color(shirt[(rr() * shirt.length) | 0])); V3.riderState.push({ arm: 0, lean: 0, brave: rr() < .65 }); }
    for (const m of [V3.trainF, V3.trainR, V3.bogies, V3.coup, V3.riders, V3.arms]) { m.frustumCulled = false; m.castShadow = true; sc.add(m); } }
  sc.add(V3.cam); if (V3.flare) sc.add(V3.flare);
  V3.riders.visible = V3.arms.visible = FLAGS.people;
  // a placeholder environment (the painted dome) so every lit program compiles with its env map now; the HDRI swaps in later
  // under the same defines (both PMREMs are 256 px cube-UV), so its arrival compiles nothing
  if (!V3.envFallback) { const s2 = new T.Scene(), d = V3.skyDome.clone(); d.scale.setScalar(.05); s2.add(d); const pm = new T.PMREMGenerator(V3.r); V3.envFallback = pm.fromScene(s2, 0, .1, 100).texture; V3.envFallback.userData.keep = true; pm.dispose(); }
  // static scenery: matrices computed once, the whole static subtree skipped by the per-frame matrix walk
  V3.frozen = 0; if (!FLAGS.nofreeze) { const dyn = new Set([V3.cam, V3.wheel, V3.carousel, V3.flare, V3.sun, V3.sun.target, V3.skyDome].filter(Boolean)), st = new T.Group(); st.name = 'statics';
    for (const o of [...sc.children]) if (!dyn.has(o) && !o.isLight) { st.add(o); o.traverse(q => { q.matrixAutoUpdate = false; q.updateMatrix(); V3.frozen++; }); }
    sc.add(st); st.updateMatrixWorld(true); st.matrixAutoUpdate = false; st.updateMatrixWorld = () => {}; V3.statics = st; }
  if (FLAGS.notex) sc.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) if (m.map || m.roughnessMap) { m.map = m.roughnessMap = null; m.alphaTest = 0; m.needsUpdate = true; if (o === V3.skyDome) m.color.set(0x9cc9e6); } });
  skyLoad(V3.tod); skyApply(); V3.r.shadowMap.needsUpdate = true;
  try { V3.r.compile(sc, V3.cam); } catch (e) { /* compiles lazily instead */ }
}

// ---------- open / close ----------
function v3Open() {
  if (!v3Init()) return false; V3.look.yaw = V3.look.pitch = 0; V3.chaseP = null; V3.chaseD = null; V3.cg = null; v3Build(); v3Size();
  V3.on = true; $('v3').classList.add('on'); $('v3fx').classList.add('on'); document.body.classList.add('ride3'); pv.style.display = 'none'; $('povL').style.display = 'none'; wakeTools();
  if (play) v3Frame(play); else v3Render(); return true;
}
function v3Close() { V3.on = false; $('v3').classList.remove('on'); $('v3fx').classList.remove('on'); document.body.classList.remove('ride3'); if (V3.needFit) { V3.needFit = false; fit(); } }
function toggle3D() { V3.want = !V3.on; if (V3.on) { v3Close(); if (play) { pv.style.display = 'block'; $('povL').style.display = 'block'; } } else v3Open(); renderTools(); kick(); }
// seats the rider can choose: front, middle or back row, left or right
const SEATS = [['Front row', 0, -1], ['Front row', 0, 1], ['Middle', 4, -1], ['Middle', 4, 1], ['Back row', TRAIN.rows.length - 1, -1], ['Back row', TRAIN.rows.length - 1, 1]];
const seatName = i => SEATS[i][0] + (SEATS[i][2] < 0 ? ' left' : ' right');
function cycleSeat() { V3.seat = (V3.seat + 1) % SEATS.length; SAVE.seat = V3.seat; persist(); V3.cg = null; renderTools(); if (play) v3Frame(play); toast(seatName(V3.seat) + ' seat'); }
function setTod(t) { V3.tod = t; SAVE.tod = t; persist(); if (V3.scene) { skyLoad(t); skyApply(); V3.key = ''; v3Build(); if (play) v3Frame(play); else v3Render(); } }
// the ride controls fade away after two seconds so they don't sit on the view; any touch or mouse move brings them back
let toolsT = 0; function wakeTools() { $('tools').classList.remove('idle'); clearTimeout(toolsT); toolsT = setTimeout(() => { if (V3.on) $('tools').classList.add('idle'); }, 2000); }
addEventListener('pointermove', () => V3.on && wakeTools()); addEventListener('pointerdown', () => V3.on && wakeTools());
// pause the 3D view's clock while the tab is hidden (requestAnimationFrame stops too), so it doesn't jump on return
document.addEventListener('visibilitychange', () => { V3.lastR = 0; V3.ft.length = 0; });

// ---------- free look: the rider turns their head (drag, arrows/WASD, or the phone's gyro if switched on) ----------
// Yaw ±120° and pitch ±70° relative to the seat, layered on top of the smoothed seat camera; the seat frame itself is
// untouched. Unless 'look stays' is chosen, the head eases back to forward a moment after you let go.
const LOOK_Y = 120 * Math.PI / 180, LOOK_P = 70 * Math.PI / 180;
V3.look = { yaw: 0, pitch: 0, t: 0, drag: null, keys: new Set(), mode: 0, gyro: null }; // mode 0: returns, 1: stays, 2: gyro
function lookBy(dy, dp) { const L = V3.look; L.yaw = clamp(L.yaw + dy, -LOOK_Y, LOOK_Y); L.pitch = clamp(L.pitch + dp, -LOOK_P, LOOK_P); L.t = 0; }
function lookTick(dt) { const L = V3.look, k = L.keys, r = 1.6 * dt;
  if (k.size) lookBy(((k.has('ArrowLeft') || k.has('a')) - (k.has('ArrowRight') || k.has('d'))) * r, ((k.has('ArrowUp') || k.has('w')) - (k.has('ArrowDown') || k.has('s'))) * r);
  if (L.mode === 2 && L.gyro) { L.yaw = clamp(L.gyro[0], -LOOK_Y, LOOK_Y); L.pitch = clamp(L.gyro[1], -LOOK_P, LOOK_P); return; }
  L.t += dt; if (L.mode === 0 && !L.drag && !k.size && L.t > .8) { const e = Math.exp(-dt * 3); L.yaw *= e; L.pitch *= e; } }
$('v3').addEventListener('pointerdown', e => { if (!V3.on || V3.chase) return; V3.look.drag = [e.clientX, e.clientY, e.pointerId]; try { $('v3').setPointerCapture(e.pointerId); } catch (_) {} });
$('v3').addEventListener('pointermove', e => { const d = V3.look.drag; if (!d || d[2] !== e.pointerId) return; const s = 2.4 / Math.max(innerWidth, innerHeight) * (V3.cam ? V3.cam.fov / 70 : 1); lookBy((e.clientX - d[0]) * s, (e.clientY - d[1]) * s); d[0] = e.clientX; d[1] = e.clientY; if (play && !play.speed) v3Frame(play); });
for (const ev of ['pointerup', 'pointercancel']) $('v3').addEventListener(ev, () => { V3.look.drag = null; V3.look.t = 0; });
addEventListener('keydown', e => { if (!V3.on || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (/^(Arrow(Left|Right|Up|Down)|[wasd])$/.test(k)) { V3.look.keys.add(k); e.preventDefault(); kick(); } });
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; V3.look.keys.delete(k); V3.look.t = 0; });
function cycleLook() { const L = V3.look, gyroOK = 'DeviceOrientationEvent' in window && matchMedia('(pointer:coarse)').matches; L.mode = (L.mode + 1) % (gyroOK ? 3 : 2);
  if (L.mode === 2) { const on = () => { L.base = null; addEventListener('deviceorientation', onGyro); }; const P = DeviceOrientationEvent.requestPermission; if (typeof P === 'function') P().then(r => r === 'granted' ? on() : (L.mode = 0, renderTools())).catch(() => { L.mode = 0; renderTools(); }); else on(); }
  else removeEventListener('deviceorientation', onGyro);
  toast(['Look about: the head turns back to the front', 'Look about: the head stays where you put it', 'Look about with the phone (gyro)'][L.mode]); renderTools(); }
function onGyro(e) { const L = V3.look; if (e.alpha == null) return; const a = e.alpha * Math.PI / 180, b = e.beta * Math.PI / 180; if (!L.base) L.base = [a, b]; let dy = a - L.base[0]; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); L.gyro = [dy, -(b - L.base[1])]; }

// ---------- where the chosen seat is at playback position (sample k plus fraction f), interpolated between samples ----------
// The physics point is the train's middle; a seat `off` metres behind the front row sits (TRAIN.mid − off) ahead of it.
// (The gaze aims at a point a fixed distance down the track, which moves continuously: no sawtooth at the sample rate.)
const LOOK = 4; // metres down the track the rider looks
function seatAt(p, seat = V3.seat || 0) {
  const R = last.r, i0 = R.idx[p.k] ?? 0, i1 = R.idx[Math.min(R.idx.length - 1, p.k + 1)] ?? i0, uc = i0 + (i1 - i0) * p.f, off = TRAIN.rows[SEATS[seat][1]], u = uc + (TRAIN.mid - off) / DS, here = frameAt(u), ah = frameAt(u + LOOK / DS);
  const side = nrm([here.fwd[1] * here.up[2] - here.fwd[2] * here.up[1], here.fwd[2] * here.up[0] - here.fwd[0] * here.up[2], here.fwd[0] * here.up[1] - here.fwd[1] * here.up[0]]), lx = SEATS[seat][2] * SEAT_X;
  const pp = [here.p[0] + side[0] * lx, here.p[1] + side[1] * lx, here.p[2] + side[2] * lx];
  const d = [ah.p[0] + ah.up[0] * EYE - here.p[0] - here.up[0] * EYE, ah.p[1] + ah.up[1] * EYE - here.p[1] - here.up[1] * EYE, ah.p[2] + ah.up[2] * EYE - here.p[2] - here.up[2] * EYE];
  return { p: pp, fwd: Math.hypot(...d) > .5 ? nrm(d) : here.fwd, tfwd: here.fwd, up: here.up, i: clamp(Math.round(u), 0, V3.frames.length - 1), u, uc, off };
}
// a critically damped spring, exact for any frame time: x chases target T without overshoot
function spring(x, v, T, w, dt) { const e = Math.exp(-w * dt); for (let k = 0; k < 3; k++) { const e0 = x[k] - T[k], c2 = v[k] + w * e0; x[k] = T[k] + (e0 + c2 * dt) * e; v[k] = (c2 - w * (e0 + c2 * dt)) * e; } }
// a car body rides the chord between its two wheel assemblies (as a real car does), each assembly sits on the rails
function basis(M, fw, up, p) { // M from forward/up (re-orthogonalised) at p; car −z is forward
  const r0 = fw[1] * up[2] - fw[2] * up[1], r1 = fw[2] * up[0] - fw[0] * up[2], r2 = fw[0] * up[1] - fw[1] * up[0], rl = Math.hypot(r0, r1, r2) || 1, rx = r0 / rl, ry = r1 / rl, rz = r2 / rl;
  const ux = ry * fw[2] - rz * fw[1], uy = rz * fw[0] - rx * fw[2], uz = rx * fw[1] - ry * fw[0];
  M.set(rx, ux, -fw[0], p[0], ry, uy, -fw[1], p[1], rz, uz, -fw[2], p[2], 0, 0, 0, 1); return M; }
function placeTrain(T, uFront, R, p, seatG) {
  const M = _r3.M || (_r3.M = new T.Matrix4()), A = _r3.A || (_r3.A = new T.Matrix4()), cars = []; let rk = 0;
  for (let c = 0; c < TRAIN.cars; c++) { const uc = uFront - (c * TRAIN.pitch + TRAIN.row / 2) / DS, a = frameAt(uc + BOGIE / DS), b = frameAt(uc - BOGIE / DS);
    const mid = [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2, (a.p[2] + b.p[2]) / 2], fw = nrm([a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]]), up = nrm([a.up[0] + b.up[0], a.up[1] + b.up[1], a.up[2] + b.up[2]]);
    basis(M, fw, up, mid); if (c) V3.trainR.setMatrixAt(c - 1, M); else V3.trainF.setMatrixAt(0, M); cars.push([mid, fw, up, a, b]);
    V3.bogies.setMatrixAt(c * 2, basis(A, a.fwd, a.up, a.p)); V3.bogies.setMatrixAt(c * 2 + 1, basis(A, b.fwd, b.up, b.p));
    // riders: torso and head, hidden for the seat the camera is in; arms pivot at the shoulders
    for (let r = 0; r < 2; r++) for (const sd of [-1, 1]) { const st = V3.riderState[rk], row = c * 2 + r, g = seatG[row], lat = seatG.lat[row];
      const tgt = st.brave ? clamp((.85 - g) / .6, 0, 1) : 0, isCam = !V3.chase && SEATS[V3.seat][1] === row && SEATS[V3.seat][2] === sd; st.arm += (tgt - st.arm) * Math.min(1, V3.dt * 4); st.lean += (clamp(-lat * .35, -.35, .35) - st.lean) * Math.min(1, V3.dt * 5);
      const lx = sd * SEAT_X, lz = ROW_Z[r]; A.makeRotationZ(st.lean); A.setPosition(lx, 0, lz); const W = _r3.W || (_r3.W = new T.Matrix4()); W.multiplyMatrices(M, A);
      if (isCam) { const Z = _r3.Z || (_r3.Z = new T.Matrix4().makeScale(0, 0, 0)); V3.riders.setMatrixAt(rk, Z); } else V3.riders.setMatrixAt(rk, W);
      const Ar = _r3.Ar || (_r3.Ar = new T.Matrix4()); Ar.makeRotationX(.35 + st.arm * 2.5); Ar.setPosition(0, 1.28, .08); W.multiply(Ar); V3.arms.setMatrixAt(rk, W); rk++; } }
  for (let c = 0; c + 1 < TRAIN.cars; c++) { const a = cars[c][4].p, b = cars[c + 1][3].p, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + .3, (a[2] + b[2]) / 2], d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], L = Math.hypot(...d) || 1;
    basis(M, [d[0] / L, d[1] / L, d[2] / L], cars[c][2], mid); A.makeScale(1, 1, L); M.multiply(A); V3.coup.setMatrixAt(c, M); }
  for (const m of [V3.trainF, V3.trainR, V3.bogies, V3.coup, V3.riders, V3.arms]) m.instanceMatrix.needsUpdate = true;
  return cars;
}
function v3Frame(p) {
  const T = window.THREE, R = last.r, s = seatAt(p), v = (R.v[p.k] || 0) + ((R.v[p.k + 1] ?? R.v[p.k] ?? 0) - (R.v[p.k] || 0)) * p.f, F = V3.frames, camE = V3.cam, dt = V3.dt;
  // every row's own g (the same speed, its own bit of track): the camera seat's for the bob and the grey-out, every row's for the riders
  const rows = _r3.rows || (_r3.rows = []); rows.lat = rows.lat || []; for (let r = 0; r < TRAIN.rows.length; r++) { const q = seatSeries(R, TRAIN.rows[r]); rows[r] = q.gs[p.k] ?? 1; rows.lat[r] = q.gl[p.k] ?? 0; }
  const gg = rows[SEATS[V3.seat][1]];
  const cars = placeTrain(T, s.uc + TRAIN.mid / DS, R, p, rows);
  // the sun's shadow box follows the train, snapped to whole shadow texels so the edges don't crawl
  { const c = cars[(TRAIN.cars / 2) | 0][0], d = V3.sunDir || [-.5, .72, .48], tx = 2 * V3.sunR / V3.sun.shadow.mapSize.x, X = Math.round(c[0] / tx) * tx, Z = Math.round(c[2] / tx) * tx;
    V3.sun.target.position.set(X, c[1], Z); V3.sun.position.set(X + d[0] * 200, c[1] + d[1] * 200, Z + d[2] * 200); V3.sun.target.updateMatrixWorld(); V3.sun.updateMatrixWorld();
    // the only moving casters are the train and the wheel: redraw the shadow map every frame on the high tier, every other
    // frame on phones, and at once whenever the light box jumps 2 m
    const moved = !V3.shAt || Math.hypot(X - V3.shAt[0], Z - V3.shAt[1]) > 2; V3.frames3++;
    if (moved || FLAGS.shadowEvery === 1 || V3.tier === 'high' || V3.frames3 % 2 === 0) { V3.r.shadowMap.needsUpdate = true; V3.shadowRenders++; if (moved) V3.shAt = [X, Z]; } }
  // floating up off the seat in airtime, pressed down under high g
  const bobT = gg < .4 ? (.4 - gg) * .28 : -Math.max(0, gg - 1.5) * .04; V3.bob += (bobT - V3.bob) * Math.min(1, dt * 8);
  if (!V3.chase) {
    // a rider looks about: the gaze is pulled 40% toward the horizon while the car is upright
    const up0 = _r3.u0 || (_r3.u0 = new T.Vector3()), f0 = _r3.f0 || (_r3.f0 = new T.Vector3()), lv = _r3.lv || (_r3.lv = new T.Vector3()); up0.set(...s.up); f0.set(...s.fwd); lv.set(f0.x, 0, f0.z);
    const w = (camE.aspect < 1 ? .65 : .4) * clamp((up0.y - .3) / .4, 0, 1); // tall phone screens see less to the sides, so look further out
    const want = _r3.want || (_r3.want = new T.Vector3()); if (lv.lengthSq() > 1e-4) want.copy(f0).lerp(lv.normalize(), w).normalize(); else want.copy(f0);
    // the head follows the gaze and the track's up through a critically damped spring: no snaps, no overshoot, ~0.1 s behind
    const wa = _r3.wa || (_r3.wa = [0, 0, 0]); want.toArray(wa);
    if (!V3.cg || (play && play.fast) || dt > .25) { V3.cg = [...wa]; V3.cgv = [0, 0, 0]; V3.cu = [...s.up]; V3.cuv = [0, 0, 0]; }
    else { const sub = Math.ceil(dt / (1 / 120)); for (let q = 0; q < sub; q++) { spring(V3.cg, V3.cgv, wa, 22, dt / sub); spring(V3.cu, V3.cuv, s.up, 22, dt / sub); } }
    const gaze = _r3.gz || (_r3.gz = new T.Vector3()), upS = _r3.us || (_r3.us = new T.Vector3()); gaze.set(...V3.cg).normalize(); upS.set(...V3.cu);
    // a faint rumble at high g: smooth (a few hertz, a centimetre or so), never a random jump per frame
    const sh = Math.max(0, Math.abs(gg - 1) - 1.5) * .006 * (play && play.speed ? 1 : 0), tt = play ? play.simT : 0, j = q => sh * Math.sin(tt * (31 + q * 7) + q * 2.1), e = EYE + V3.bob;
    const fe = .1;
    camE.position.set(s.p[0] + s.up[0] * e + s.tfwd[0] * fe + j(0), s.p[1] + s.up[1] * e + s.tfwd[1] * fe + j(1), s.p[2] + s.up[2] * e + s.tfwd[2] * fe + j(2));
    const right = _r3.rt || (_r3.rt = new T.Vector3()); right.copy(gaze).cross(upS); if (right.lengthSq() < 1e-6) right.copy(gaze).cross(up0); right.normalize(); const up = _r3.up || (_r3.up = new T.Vector3()); up.crossVectors(right, gaze).normalize();
    const B = _r3.B || (_r3.B = new T.Matrix4()), ng = _r3.ng || (_r3.ng = new T.Vector3()); ng.copy(gaze).negate(); camE.quaternion.setFromRotationMatrix(B.makeBasis(right, up, ng));
    // the rider's own head turn, on top of the smoothed seat view: yaw about the seat's up, then pitch about the head's right
    lookTick(dt); const L = V3.look; if (L.yaw || L.pitch) { const qy = _r3.qy || (_r3.qy = new T.Quaternion()), qp = _r3.qp || (_r3.qp = new T.Quaternion()), ax = _r3.ax || (_r3.ax = new T.Vector3());
      qy.setFromAxisAngle(ax.set(0, 1, 0), L.yaw); qp.setFromAxisAngle(ax.set(1, 0, 0), L.pitch); camE.quaternion.multiply(qy).multiply(qp); }
  } else {
    const back = F[Math.max(0, s.i - 30)], dx0 = s.p[0] - back.p[0], dz0 = s.p[2] - back.p[2], hz0 = Math.hypot(dx0, dz0);
    if (hz0 > 3 || !V3.chaseD) V3.chaseD = hz0 > .1 ? [dx0 / hz0, dz0 / hz0] : [Math.cos(design.S[s.i].head), Math.sin(design.S[s.i].head)]; // behind the train's recent travel, so loops don't swing it round
    const [bx, bz] = V3.chaseD, tx = s.p[0] - bx * 22, tz = s.p[2] - bz * 22; V3.chaseP = V3.chaseP || [tx, s.p[1] + 9, tz];
    const k = play && play.fast ? 1 : Math.min(1, dt * 7); V3.chaseP = [V3.chaseP[0] + (tx - V3.chaseP[0]) * k, V3.chaseP[1] + (Math.max(s.p[1] + 9, V3.groundAt(tx, tz)[0] + 3) - V3.chaseP[1]) * k, V3.chaseP[2] + (tz - V3.chaseP[2]) * k];
    const mid = cars[(TRAIN.cars / 2) | 0][0]; camE.position.set(...V3.chaseP); camE.up.set(0, 1, 0); camE.lookAt(mid[0], mid[1] + 1, mid[2]);
  }
  const fov = (64 + Math.min(36, v * 1.15)) * (camE.aspect < 1 ? 1.15 : 1); if (Math.abs(camE.fov - fov) > .2) { camE.fov = fov; camE.updateProjectionMatrix(); }
  if (FLAGS.cam) { camE.position.set(...FLAGS.cam); camE.up.set(0, 1, 0); camE.lookAt(...(FLAGS.look || [0, 0, 0])); }
  V3.skyDome.position.copy(camE.position);
  sceneryTick(play && play.speed === 0 ? 0 : dt);
  // speed streaks: faint lines rushing past once the train is quick
  { const st = V3.streak, a = V3.lines.geometry.attributes.position, sp = clamp((v - 14) / 18, 0, 1), len = .4 + v * .05;
    V3.lines.material.opacity = sp * .3 * (V3.chase ? 0 : 1);
    for (let k = 0; k < st.n; k++) { const q = st.p[k]; q[2] += v * dt * 1.4; if (q[2] > -1.5) { const ang = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 3.5; q[0] = Math.cos(ang) * r; q[1] = Math.sin(ang) * r * .7; q[2] = -18 - Math.random() * 20; }
      a.setXYZ(k * 2, q[0], q[1], q[2]); a.setXYZ(k * 2 + 1, q[0], q[1], q[2] - len); }
    a.needsUpdate = true; }
  // at speed (high tier): a touch of zoom blur and chromatic aberration at the edges
  if (V3.grade) { const sp = V3.tier === 'high' && !V3.chase ? clamp((v - 18) / 20, 0, 1) : 0; V3.grade.uniforms.uZoom.value = sp * .025; V3.grade.uniforms.uCA.value = sp * .006; V3.grade.uniforms.uSplit.value = V3.tod === 'dusk' ? .1 : .06; }
  // grey-out above 4.5 g, a pale flash of float below 0 g
  const dim = clamp((gg - 4.5) / 1.5, 0, 1), fl = gg < 0 ? clamp(-gg, 0, 1) * .25 : 0;
  $('v3fx').style.background = dim > 0 ? `radial-gradient(ellipse at center, rgba(0,0,0,${dim * .55}) ${Math.round(60 - dim * 45)}%, rgba(0,0,0,${.3 + dim * .65}) 100%)` : fl ? `rgba(255,255,255,${fl})` : 'none';
  v3Render();
}
addEventListener('resize', () => v3Size());
