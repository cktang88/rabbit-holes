// The Coaster Designer: the train, modelled. A classic script; all files share one global scope (index.html loads it
// before ride3d.js, whose mergeParts/M4 it uses at build time).
//
// A modern sit-down train (think B&M/Intamin): five cars, two rows of two. Car frame: x right, y up, −z forward,
// origin on the track centreline at the middle of the car. Rails are tubes of radius 0.075 at x = ±0.55 (gauge 1.1 m),
// the spine a 0.2 m tube 0.42 m below them. Seat cushions are 0.70 m above the rail centres, so a seated rider's eyes
// are 1.5 m up (EYE). Every car has:
//   - a fibreglass shell: sculpted side panels with a rolled lip, a floor pan and bulkheads, and on the front car a
//     rounded nose with headlights and a badge; red clearcoat with a gold stripe and a dark skirt;
//   - contoured bucket seats (cushion, back, side bolsters, headrest) in upholstery;
//   - a padded lap bar per seat on a steel hinge arm, with hand grips; the bars are down while the train moves;
//   - a steel chassis frame under the body with the brake fin, the chain dog and the anti-rollback dog, and grab
//     handles on the seat backs;
//   - two wheel carriers, each with two road wheels on top of each rail, a side guide wheel outside it and an up-stop
//     wheel under it (polyurethane tyres on steel hubs);
//   - an articulated drawbar to the next car.
// Draws: one instanced mesh per material and part (shells front/rear, seats, chassis, carriers, lap bars, drawbars,
// riders' clothes, riders' skin and hair, arms): 10 draws for the whole train. Each part has a full and a far LOD.

const CAR = { len: 2.66, half: 1.33, w: 1.46, seatY: .70, floorY: .43, railX: .55, railR: .075,
  road: { r: .14, w: .1, y: .075 + .14, dz: .15 }, side: { r: .08, h: .08, x: .55 + .075 + .08 }, up: { r: .085, w: .08, y: -.075 - .085 } };

// a shape drawn in the car's side view (u = z along the car, v = y up), extruded across the car (x) between x0 and x1
function sideExtrude(T, pts, x0, x1, bevel, curveSeg) {
  const sh = new T.Shape(); pts.forEach(([u, v, cu, cv], i) => { if (!i) sh.moveTo(u, v); else if (cu != null) sh.quadraticCurveTo(cu, cv, u, v); else sh.lineTo(u, v); }); sh.closePath();
  const b = bevel || 0, g = new T.ExtrudeGeometry(sh, { depth: Math.max(.001, x1 - x0 - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: b ? 2 : 0, curveSegments: curveSeg || 6 });
  g.rotateY(-Math.PI / 2); g.translate(x1 - b, 0, 0); return g; // after the turn: shape u → car z, v → y, depth → x (x0..x1)
}
const RED = 0xc8382b, DARK = 0x5a1410, GOLD = 0xe8b84a, CREAM = 0xf4ead6, STEEL = 0x8d939a, DSTEEL = 0x4c5258, TYRE = 0x2c2d30, UPH = 0x23272f, PIPE = 0x2f6fb8, PAD = 0x17181b, CHROME = 0xd8dade;
// paint by height: dark skirt, red body, a gold stripe, cream nose stripe
const livery = (x, y, z) => y < .44 ? DARK : (y > .6 && y < .665) ? GOLD : (z < -1.33 && Math.abs(x) < .1 && y > .6) ? CREAM : RED;

function shellGeometry(T, front, hi) {
  const P = [], H = CAR.half, seg = hi ? 8 : 3;
  // side panels: the top edge sweeps down at each row's opening and up behind each seat back; rolled lip along it
  const edge = [[-H, .82], [-.95, .86], [-.75, .74], [-.25, .74], [-.05, .9], [.15, .78], [.6, .74], [.85, .92], [H, .98]];
  const prof = [[H, .3], [-H, .3], ...edge.map(([u, v], i) => i ? [u, v, (u + edge[i - 1][0]) / 2, Math.max(v, edge[i - 1][1]) + .02] : [u, v])];
  for (const s of [-1, 1]) { const x0 = s < 0 ? -CAR.w / 2 : CAR.w / 2 - .06; P.push([sideExtrude(T, prof, x0, x0 + .06, hi ? .02 : 0, seg), livery]);
    if (hi) { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, u = -H + t * 2 * H; let v = .3; for (let k = 1; k < edge.length; k++) if (u <= edge[k][0]) { const a = edge[k - 1], b = edge[k], f = (u - a[0]) / (b[0] - a[0]), e = f * f * (3 - 2 * f); v = a[1] + (b[1] - a[1]) * e; break; } pts.push(new T.Vector3(s * (CAR.w / 2 - .03), v, u)); }
      P.push([new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, .035, 6), GOLD]); } }
  // tail bulkhead (rounded), front bulkhead / footwell (the floor pan is with the seats)
  P.push([sideExtrude(T, [[H - .08, .3], [H, .3], [H + .04, .62, H + .06, .5], [H - .04, 1.0, H + .03, .9], [H - .1, 1.0]], -CAR.w / 2 + .02, CAR.w / 2 - .02, hi ? .02 : 0, seg), livery]);
  if (front) { // the nose: a rounded fibreglass cap, fascia with two headlights in chrome rings, the park's badge, a cream stripe
    const n = new T.SphereGeometry(1, hi ? 28 : 12, hi ? 14 : 6, 0, Math.PI * 2, 0, Math.PI * .62); n.rotateX(-Math.PI / 2); n.scale(.72, .34, .5); n.translate(0, .52, -H + .02); P.push([n, livery]);
    P.push([new T.BoxGeometry(CAR.w - .08, .22, .5), DARK, M4(T, 0, .4, -H - .1)]);
    for (const s of [-1, 1]) { P.push([new T.CircleGeometry(.075, hi ? 18 : 8), 0xfff6d8, M4(T, s * .36, .55, -H - .4, -.25, s * -.5)]); if (hi) P.push([new T.TorusGeometry(.08, .014, 6, 18), CHROME, M4(T, s * .36, .55, -H - .4, -.25, s * -.5)]); }
    P.push([new T.CircleGeometry(.12, hi ? 20 : 8), GOLD, M4(T, 0, .8, -H - .26, -1.05)], [new T.CircleGeometry(.08, hi ? 20 : 8), CREAM, M4(T, 0, .801, -H - .257, -1.05)]); }
  else { // the dash in front of the first row: a curved cowl with a padded roll along its top
    P.push([sideExtrude(T, [[-H, .3], [-H + .1, .3], [-H + .15, .7, -H + .17, .5], [-H + .05, .86, -H + .14, .85], [-H, .84]], -CAR.w / 2 + .02, CAR.w / 2 - .02, hi ? .015 : 0, seg), livery]);
    P.push([hi ? new T.CapsuleGeometry(.05, CAR.w - .2, 4, 10).rotateZ(Math.PI / 2) : new T.BoxGeometry(CAR.w - .1, .1, .1), PAD, M4(T, 0, .88, -H + .06)]); }
  return mergeParts(T, P);
}
// bucket seats for both rows (upholstery), with blue piping
function seatGeometry(T, hi) {
  const P = [], seg = hi ? 6 : 2;
  // the floor pan with a ribbed rubber mat (matte, so it sits with the upholstery rather than the lacquered shell)
  P.push([new T.BoxGeometry(CAR.w - .1, .05, CAR.len - .04), 0x34363b, M4(T, 0, CAR.floorY - .025, 0)]); // floor above the road wheels (their tops are at 0.355)
  if (hi) for (let z = -1.1; z < 1.2; z += .12) P.push([new T.BoxGeometry(1.2, .012, .04), 0x1e2024, M4(T, 0, CAR.floorY + .005, z)]);
  for (const z of [-TRAIN.row / 2, TRAIN.row / 2]) for (const sx of [-SEAT_X, SEAT_X]) {
    const x0 = sx - .22, x1 = sx + .22;
    P.push([sideExtrude(T, [[z + .22, CAR.floorY], [z - .28, CAR.floorY], [z - .3, .66, z - .32, .6], [z - .24, .72, z - .28, .72], [z + .2, .68, z, .66]], x0, x1, hi ? .025 : 0, seg), UPH]); // cushion, raised at the knees
    P.push([sideExtrude(T, [[z + .2, .66], [z + .3, .66], [z + .36, 1.3], [z + .27, 1.32, z + .33, 1.34]], x0, x1, hi ? .025 : 0, seg), UPH]); // back, raked 10°
    if (hi) { for (const s of [-1, 1]) P.push([new T.CapsuleGeometry(.05, .42, 3, 8), UPH, M4(T, sx + s * .21, 1.0, z + .24, -.15)]); // side bolsters
      P.push([new T.BoxGeometry(.05, .5, .01), PIPE, M4(T, sx, 1.02, z + .245, -.15)]); }
    P.push([hi ? new T.CapsuleGeometry(.085, .2, 4, 10).rotateZ(Math.PI / 2) : new T.BoxGeometry(.36, .17, .12), UPH, M4(T, sx, 1.42, z + .34, -.1)]); } // headrest
  return mergeParts(T, P);
}
// steel under the body: frame rails, cross members, bogie pivots, the brake fin, chain dog, anti-rollback dog; grab handles
function chassisGeometry(T, hi) {
  const P = [], H = CAR.half;
  for (const s of [-1, 1]) P.push([new T.BoxGeometry(.08, .12, 2.4), STEEL, M4(T, s * .42, .24, 0)]);
  for (const z of [-.9, 0, .9]) P.push([new T.BoxGeometry(.92, .08, .1), STEEL, M4(T, 0, .24, z)]);
  P.push([new T.BoxGeometry(.025, .3, 1.3), DSTEEL, M4(T, 0, .03, 0)]); // brake fin (the magnets or callipers grip it)
  P.push([new T.BoxGeometry(.06, .3, .1), DSTEEL, M4(T, 0, .05, -.55, .5)], [new T.BoxGeometry(.06, .06, .14), DSTEEL, M4(T, 0, -.08, -.62)]); // chain dog
  P.push([new T.BoxGeometry(.06, .3, .1), DSTEEL, M4(T, .07, .05, .55, -.5)], [new T.BoxGeometry(.05, .05, .12), DSTEEL, M4(T, .07, -.08, .62)]); // anti-rollback dog
  for (const z of [-BOGIE, BOGIE]) P.push([new T.CylinderGeometry(.07, .07, .1, hi ? 12 : 6), DSTEEL, M4(T, 0, .21, z)]); // pivots onto the wheel carriers
  if (hi) for (const z of [-TRAIN.row / 2, TRAIN.row / 2]) if (z > 0) for (const sx of [-SEAT_X, SEAT_X]) P.push([new T.TorusGeometry(.07, .014, 6, 12, Math.PI), CHROME, M4(T, sx, 1.08, z - TRAIN.row + .34, 0, Math.PI)]); // handles on the front row's backs for the row behind
  if (hi) for (const s of [-1, 1]) P.push([new T.TorusGeometry(.09, .016, 6, 14, Math.PI), CHROME, M4(T, s * (CAR.w / 2 + .015), .88, .05, Math.PI / 2, 0, s * Math.PI / 2)]); // side grab handles
  return mergeParts(T, P);
}
// a wheel carrier at the track frame: per rail two road wheels on top, a side guide wheel outside, an up-stop beneath
function bogieGeometry(T, hi) {
  const P = [], rs = hi ? 18 : 8, wheel = (r, w, m, axisY) => { P.push([new T.CylinderGeometry(r, r, w, rs), TYRE, axisY ? m : m.clone().multiply(new T.Matrix4().makeRotationZ(Math.PI / 2))]);
    if (hi) P.push([new T.CylinderGeometry(r * .55, r * .55, w + .012, rs), CHROME, axisY ? m : m.clone().multiply(new T.Matrix4().makeRotationZ(Math.PI / 2))], [new T.CylinderGeometry(r * .18, r * .18, w + .03, 6), DSTEEL, axisY ? m : m.clone().multiply(new T.Matrix4().makeRotationZ(Math.PI / 2))]); };
  P.push([new T.BoxGeometry(1.36, .08, .14), STEEL, M4(T, 0, .2, 0)]); // the axle beam the car pivots on, under the floor
  for (const s of [-1, 1]) { const X = s * CAR.railX;
    P.push([new T.BoxGeometry(.04, .46, .12), STEEL, M4(T, X + s * .1, .05, 0)], [new T.BoxGeometry(.04, .07, .5), STEEL, M4(T, X + s * .1, .24, 0)], [new T.BoxGeometry(.16, .05, .1), STEEL, M4(T, X + s * .03, .2, 0)], [new T.BoxGeometry(.16, .05, .14), STEEL, M4(T, X + s * .04, -.23, 0)]); // a slim yoke round the rail: post, top bar holding the road-wheel axles, arm under for the up-stop
    for (const dz of [-CAR.road.dz, CAR.road.dz]) wheel(CAR.road.r, CAR.road.w, M4(T, X, CAR.road.y, dz));
    wheel(CAR.side.r, CAR.side.h, M4(T, s * CAR.side.x, 0, 0), true);
    wheel(CAR.up.r, CAR.up.w, M4(T, X, CAR.up.y, 0)); }
  return mergeParts(T, P);
}
// a lap bar, built about its hinge (at the floor in front of the seat): steel arm, padded black bar, two hand grips
function lapBarGeometry(T, hi) {
  const P = [], d = new T.Vector3(0, .5, .43), L = d.length(), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
  P.push([new T.BoxGeometry(.06, L, .04), STEEL, new T.Matrix4().compose(d.clone().multiplyScalar(.5), q, new T.Vector3(1, 1, 1))]);
  P.push([new T.CylinderGeometry(.04, .04, .12, hi ? 10 : 5), DSTEEL, M4(T, 0, 0, 0, 0, 0, Math.PI / 2)]); // the hinge
  P.push([hi ? new T.CapsuleGeometry(.075, .24, 4, 10).rotateZ(Math.PI / 2) : new T.BoxGeometry(.38, .14, .14), PAD, M4(T, 0, .5, .43)]); // padded bar over the lap
  if (hi) for (const s of [-1, 1]) P.push([new T.CylinderGeometry(.022, .022, .12, 6), PAD, M4(T, s * .13, .56, .36, .6)]);
  return mergeParts(T, P);
}
const LAP_HINGE = [0, .45, -.55]; // relative to the seat (x = seat, z = row centre)
// riders: clothes take the instance colour; skin, hair, trousers and shoes are fixed
function riderGeometry(T, hi) { const s = hi ? 10 : 6; return mergeParts(T, [[new T.CylinderGeometry(.17, .19, .55, s), 0xffffff, M4(T, 0, 1.03, .1, -.1)], [new T.SphereGeometry(.2, s, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff, M4(T, 0, 1.27, .08, 0, 0, 0)]]); }
function riderRestGeometry(T, hi) { const s = hi ? 10 : 6, P = [[new T.SphereGeometry(.115, s, s - 2), 0xe0b896, M4(T, 0, 1.47, .06)], [new T.SphereGeometry(.122, s, 4, 0, Math.PI * 2, 0, 1.5), 0x3a2a1e, M4(T, 0, 1.49, .08, -.3)], [new T.CylinderGeometry(.05, .05, .1, 6), 0xe0b896, M4(T, 0, 1.33, .07)]];
  for (const x of [-.1, .1]) P.push([new T.CylinderGeometry(.075, .07, .46, s - 2), 0x2e3440, M4(T, x, .8, -.17, Math.PI / 2)], [new T.CylinderGeometry(.06, .055, .34, s - 2), 0x2e3440, M4(T, x, .62, -.44, .2)], [new T.BoxGeometry(.1, .08, .22), 0x1d1f24, M4(T, x, .47, -.52)]);
  return mergeParts(T, P); }
function armsGeometry(T, hi) { const s = hi ? 8 : 5; return mergeParts(T, [-1, 1].flatMap(x => [[new T.CylinderGeometry(.055, .05, .3, s), 0x3d4552, M4(T, x * .24, -.15, 0, 0, 0, x * .1)], [new T.CylinderGeometry(.045, .04, .3, s), 0xe0b896, M4(T, x * .255, -.44, 0, 0, 0, x * .1)], [new T.SphereGeometry(.05, s, 4), 0xe0b896, M4(T, x * .27, -.6, 0)]])); }

// build the train's meshes (both LODs made once and kept across scene rebuilds)
function trainBuild(T, sc) {
  const G = V3.trainGeo || (V3.trainGeo = { hi: {}, lo: {} });
  for (const [k, hi] of [['hi', true], ['lo', false]]) if (!G[k].shellF) Object.assign(G[k], { shellF: shellGeometry(T, true, hi), shellR: shellGeometry(T, false, hi), seats: seatGeometry(T, hi), chassis: chassisGeometry(T, hi), bogie: bogieGeometry(T, hi), lap: lapBarGeometry(T, hi), body: riderGeometry(T, hi), rest: riderRestGeometry(T, hi), arms: armsGeometry(T, hi) });
  const nc = TRAIN.cars, ns = nc * 4, h = G.hi, paint = new T.MeshPhysicalMaterial({ vertexColors: true, metalness: .15, roughness: .38, clearcoat: 1, clearcoatRoughness: .06 }); // lacquered fibreglass
  const steel = new T.MeshStandardMaterial({ vertexColors: true, metalness: .75, roughness: .38 }), cloth = new T.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), skin = new T.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
  const I = (geo, mat, n) => { const m = new T.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; sc.add(m); return m; };
  const tr = V3.tr = { shellF: I(h.shellF, paint, 1), shellR: I(h.shellR, paint, nc - 1), seats: I(h.seats, cloth, nc), chassis: I(h.chassis, steel, nc), bogies: I(h.bogie, steel, nc * 2), laps: I(h.lap, steel, ns),
    coup: I(new T.CylinderGeometry(.05, .05, 1, 8).rotateX(Math.PI / 2), steel, nc - 1), body: I(h.body, cloth, ns), rest: I(h.rest, skin, ns), arms: I(h.arms, skin, ns), lod: 'hi', lap: 0 };
  V3.trainF = V3.train = tr.shellF; V3.trainR = tr.shellR; V3.bogies = tr.bogies; V3.coup = tr.coup; V3.riders = tr.body; V3.arms = tr.arms;
  const rr = RH.rng(5), shirt = [0xd8402f, 0x2f6fb8, 0xe8b84a, 0x3c9a5c, 0xf4e8cc, 0x8a4fb8, 0x333333, 0xe07a30, 0x40a0b0, 0xc0c4c8]; V3.riderState = [];
  for (let k = 0; k < ns; k++) { const c = new T.Color(shirt[(rr() * shirt.length) | 0]); tr.body.setColorAt(k, c); V3.riderState.push({ arm: 0, lean: 0, brave: rr() < .65 }); }
  tr.coup.material = new T.MeshStandardMaterial({ color: DSTEEL, metalness: .8, roughness: .35 }); // one colour, no vertex colours
}
// full detail near the camera; the far LOD in the chase view or from more than 40 m
function trainLod(far) { const tr = V3.tr, G = V3.trainGeo, k = far ? 'lo' : 'hi'; if (!tr || tr.lod === k) return; tr.lod = k;
  for (const [m, g] of [[tr.shellF, 'shellF'], [tr.shellR, 'shellR'], [tr.seats, 'seats'], [tr.chassis, 'chassis'], [tr.bogies, 'bogie'], [tr.laps, 'lap'], [tr.body, 'body'], [tr.rest, 'rest'], [tr.arms, 'arms']]) m.geometry = G[k][g]; }
