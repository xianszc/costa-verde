// AZZURA HEIST — vehicles (wheels-fix round).
// Procedural cars: the hero Stella roadster + traffic variants. Arcade
// handling (accelerate / brake / steer / handbrake), circle-vs-AABB
// collision against the district's colliders, and traffic AI that follows
// the road network's lane loops and yields to the car ahead.
//
// Wheels: every car uses the ONE shared module in wheels.js — tyre +
// tread + sidewall + rim + spokes + hub cap + brake disc + caliper,
// real wheel arches, flush fit, spin/steer/suspension/body roll, drift
// skid marks + tyre squeal. The old pale-hubcap "eye" wheels are gone:
// hubs are dark metal now.
//
// Bodies (wheels-fix): side windows on every cabin, windshield kept
// INSIDE the roofline (no transparent fin), pickup bed attached to the
// body (floor + walls + tailgate, no floating slab), headlights are
// rectangular lamps (no white round eyes), police cruiser has a white
// side stripe instead of a floating white board, and police wheels use
// the spoked steel spec like the other cars.
import * as THREE from '../vendor/three.module.min.js';
import { M, box, cyl, mergedMesh, colored, xform, vertexColorMat } from './world.js';
import { groundHeightAt } from './districts.js';
import {
  WHEEL_SPECS, buildWheelRig, updateCarWheels,
} from './wheels.js';

// Wheel arches for one car: a dark half-torus lip over each wheel plus a
// dark recess disc on the body side behind each wheel, so the wheel reads
// as sitting INSIDE an arch instead of pasted on a flat slab. Returned
// as vertex-colored parts (2b draw-call cut) so the caller merges them
// into the car's single body mesh — not 2 extra draw calls per car.
function archParts(wheelPos, halfWidth) {
  const parts = [];
  for (const [wx, wz, r] of wheelPos) {
    const side = Math.sign(wz);
    parts.push(colored(
      xform(new THREE.TorusGeometry(r + 0.06, 0.055, 8, 18, Math.PI),
        wx, r, side * (halfWidth + 0.005)),
      0x1c1c1c,
    ));
    // Shadow disc on the body side, just behind the wheel's outer face.
    const disc = new THREE.CircleGeometry(r * 1.15, 18);
    parts.push(colored(
      xform(disc, wx, r, side * (halfWidth - 0.004), side < 0 ? Math.PI : 0, 1, 0, 0),
      0x0d0d0d,
    ));
  }
  return parts;
}

// Soft footprint shadow texture (M3 leftover 1): a radial gradient that
// fades to transparent at the edge, so the shadow under a car reads as a
// soft contact shadow sized to the car footprint — never a black puddle.
let softShadowTex = null;
function getSoftShadowTex() {
  if (softShadowTex) return softShadowTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 32, 4, 64, 32, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  // Ellipse: scale the radial gradient into the footprint shape.
  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(1, 0.5);
  ctx.translate(-64, -64);
  ctx.fillRect(0, 0, 128, 128);
  ctx.restore();
  softShadowTex = new THREE.CanvasTexture(c);
  softShadowTex.colorSpace = THREE.SRGBColorSpace;
  return softShadowTex;
}

// Mount four wheels (shared module) + contact shadow on a car group.
// wheelPos: [[x, z, radius, specName], ...] in car space, front two first.
// Returns { rigs, spins } and stashes them on the car group.
function mountWheels(g, wheelPos, halfWidth) {
  const rigs = [];
  const spins = [];
  for (const [wx, wz, r, specName] of wheelPos) {
    const rig = buildWheelRig(specName);
    rig.position.set(wx, r, wz);
    rig.userData.phase = (wx * 1.7 + wz * 2.3) % (Math.PI * 2);
    g.add(rig);
    rigs.push(rig);
    spins.push(rig.userData.spin);
  }
  // One soft footprint ellipse per car, sized to the wheelbase + body
  // overhang: low opacity, feathered edge, no hard black disc anywhere.
  const maxWx = Math.max(...wheelPos.map(([wx]) => Math.abs(wx)));
  const maxWz = Math.max(...wheelPos.map(([, wz]) => Math.abs(wz)));
  const r0 = wheelPos[0][2];
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(maxWx * 2 + r0 * 2 + 0.5, maxWz * 2 + 0.5),
    new THREE.MeshBasicMaterial({
      map: getSoftShadowTex(), transparent: true, opacity: 0.32, depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.castShadow = false;
  shadow.receiveShadow = false;
  g.add(shadow);
  // 2b draw-call cut: the per-wheel contact blobs are GONE (one merged
  // mesh per car, 21 cars). They were opacity 0.14 dots under each
  // wheel; the footprint ellipse above (opacity 0.32, sized to the
  // wheelbase) carries the whole contact shadow, so the wheels still
  // read planted.
  g.userData.wheelRigs = rigs;
  g.userData.wheels = spins;
  // Rear-wheel local offsets, for drift skid marks.
  g.userData.wheelOffsets = wheelPos.slice(2).map(([wx, wz]) => [wx, wz]);
  return { rigs, spins };
}

// The drivable road surface sits at y 0.2 (roads.js: 0.3-tall slabs
// centered at y 0.05). Cars ride on the road top, so their meshes sit
// at ROAD_Y and their tyres touch the asphalt instead of sinking.
export const ROAD_Y = 0.2;

// Part F2 (23 Nov): Xian 17:28 WIB "Mobilnya masih kegedean bos" —
// CAR_SCALE 0.5 (2,7 lajur) masih terlalu besar, jadi 0.35 (1,9
// lajur). Lihat reports/partF-car-scale.md (F) + partF2 di bawah
// untuk pengukuran + trade-off: pejalan kaki kini ~4x tinggi mobil.
export const CAR_SCALE = 0.35;

// Side glass panels for a cabin block: two thin dark panes on the body
// sides, so the cabin reads as windows instead of a solid slab.
// Item 4 perf: the panes are vertex-colored geometries baked into the
// body mesh (one mesh per car instead of a separate glossy one) — they
// keep their exact dark blue-grey color, only the specular sheen goes
// away; at traffic distances the sheen is invisible.
function sideGlassGeos(x, y, len, halfWidth) {
  return [-1, 1].map((s) => colored(xform(new THREE.BoxGeometry(len, 0.32, 0.04), x, y, s * (halfWidth + 0.01)), 0x1a2e40));
}

// Bake the two REAR brake discs (+calipers) into the body geometry.
// Rear wheels never steer (updateWheelRig passes 0 steer for the rear)
// and the discs never spin, so their transform relative to the car is
// fixed — except the ±0.02 suspension bob, which the baked discs no
// longer follow (a ≤3px offset at close range, invisible in practice).
// Front discs stay as separate meshes: their axis follows the steering.
function bakeRearDiscs(g, rigs, parts) {
  g.updateMatrixWorld(true);
  for (const rig of [rigs[2], rigs[3]]) {
    const sm = rig.userData.staticMesh;
    if (!sm) continue;
    const geo = sm.geometry.clone();
    geo.applyMatrix4(sm.matrixWorld);
    parts.push(geo);
    rig.userData.axle.remove(sm);
  }
}

// ---------- car models ----------
export function buildStella() {
  // Stella roadster — coral hero car, low and long, cream interior.
  // Sports spec: big wheels (r 0.38), low body.
  const g = new THREE.Group();
  g.name = 'stella';
  // Wheels: flush with the body side (half-width 0.95, tyre width 0.30
  // → center at ±0.805, outer face at 0.955), inside real arches.
  // Defined up here so the arch parts merge into the body mesh.
  const r = WHEEL_SPECS.sport.radius;
  const wheelPos = [
    [1.45, 0.805, r, 'sport'], [1.45, -0.805, r, 'sport'],
    [-1.45, 0.805, r, 'sport'], [-1.45, -0.805, r, 'sport'],
  ];
  const body = [
    colored(xform(new THREE.BoxGeometry(4.4, 0.55, 1.9), 0, 0.55, 0), 0xe4572e),
    colored(xform(new THREE.BoxGeometry(2.6, 0.5, 1.7), -0.2, 0.95, 0), 0xe4572e),
    colored(xform(new THREE.BoxGeometry(2.2, 0.42, 1.5), -0.2, 0.85, 0), 0xf7ebd7),
    colored(xform(new THREE.BoxGeometry(1.0, 0.18, 1.6), 1.9, 0.62, 0), 0xf2a541),
    colored(xform(new THREE.BoxGeometry(0.5, 0.3, 1.7), -2.1, 0.6, 0), 0xc0392b),
    ...archParts(wheelPos.map(([x, z, rr]) => [x, z, rr]), 0.95),
  ];
  // Side windows + rear window baked into the body (item 4 perf).
  body.push(...sideGlassGeos(-0.2, 1.0, 1.5, 0.85));
  body.push(colored(xform(new THREE.BoxGeometry(0.06, 0.42, 1.4), -1.52, 1.0, 0), 0x1a2e40));
  // Wheels first: the rear brake discs bake into the body below.
  // (mountWheels adds the spinning rigs + the contact shadow.)
  const { rigs } = mountWheels(g, wheelPos, 0.95);
  bakeRearDiscs(g, rigs, body);
  g.add(mergedMesh(body, vertexColorMat));
  // Windshield: kept INSIDE the roofline (cabin top is y 1.20) — short
  // pane, slight rake, top edge at ~1.19. No transparent fin above it.
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.42, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x9fd4d8, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 }),
  );
  glass.position.set(0.8, 0.98, 0);
  glass.rotation.z = -0.25;
  g.add(glass);
  // Side windows on the cabin block (baked into the body above, item 4).
  // Rectangular headlamps + taillights (2b draw-call cut: each pair in
  // one merged mesh instead of two).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  g.add(mergedMesh([-0.6, 0.6].map((s) => xform(new THREE.BoxGeometry(0.1, 0.16, 0.36), 2.22, 0.62, s)), headMat));
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0xff2a2a, emissiveIntensity: 0.5 });
  g.add(mergedMesh([-0.6, 0.6].map((s) => xform(new THREE.BoxGeometry(0.08, 0.16, 0.3), -2.22, 0.62, s)), tailMat));
  // Rear window baked into the body above (item 4 perf; same dark glass
  // as the side windows) + chrome rear bumper so the car reads from behind.
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 1.9),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.3, metalness: 0.7 }),
  );
  bumper.position.set(-2.24, 0.35, 0);
  g.add(bumper);
  // Wheels already mounted above (mountWheels adds the spinning rigs).
  g.userData.headMat = headMat;
  g.userData.tailMat = tailMat;
  // Part F: scale the whole car group (see CAR_SCALE above).
  g.scale.setScalar(CAR_SCALE);
  return g;
}

export function buildTrafficCar(color, kind = 'sedan', wheelSpec = null, extras = {}) {
  const g = new THREE.Group();
  g.name = 'traffic-' + kind;
  const specName = wheelSpec || (kind === 'pickup' ? 'pickup' : kind === 'van' ? 'van' : 'sedan');
  const spec = WHEEL_SPECS[specName];
  const r = spec.radius;
  // Wheels flush with the body side, inside real arches. Defined up
  // here so the arch parts merge into the body mesh (2b draw-call cut).
  const halfWidth = kind === 'sedan' ? 0.925 : 0.95;
  const wz = halfWidth - spec.width / 2 + 0.005;
  const wheelPos = [
    [1.4, wz, r, specName], [1.4, -wz, r, specName],
    [-1.4, wz, r, specName], [-1.4, -wz, r, specName],
  ];
  const parts = [];
  if (kind === 'van') {
    parts.push(colored(xform(new THREE.BoxGeometry(4.2, 1.5, 1.9), 0, 1.05, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.2, 0.7, 1.7), 1.6, 0.95, 0), 0x2e4a5e));
  } else if (kind === 'pickup') {
    // Tall tires + raised body = ground clearance. The bed is ATTACHED:
    // floor flush with the body top + side walls + tailgate in body
    // color, all sharing the body's edges — no floating slab.
    parts.push(colored(xform(new THREE.BoxGeometry(4.3, 0.6, 1.9), 0, 0.66, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.6, 0.6, 1.7), 1.2, 1.11, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.9, 0.12, 1.7), -1.25, 0.96, 0), 0x5a3d22));
    parts.push(colored(xform(new THREE.BoxGeometry(1.9, 0.24, 0.08), -1.25, 1.06, 0.81), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.9, 0.24, 0.08), -1.25, 1.06, -0.81), color));
    parts.push(colored(xform(new THREE.BoxGeometry(0.08, 0.24, 1.7), -2.16, 1.06, 0), color));
  } else { // sedan
    parts.push(colored(xform(new THREE.BoxGeometry(4.1, 0.55, 1.85), 0, 0.58, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(2.2, 0.5, 1.6), -0.2, 1.0, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.9, 0.4, 1.4), -0.2, 0.95, 0), 0x2e4a5e));
  }
  parts.push(...archParts(wheelPos.map(([x, z, rr]) => [x, z, rr]), halfWidth));
  // Side windows baked into the body (item 4 perf).
  if (kind === 'van') parts.push(...sideGlassGeos(1.6, 1.05, 0.9, 0.85));
  else if (kind === 'pickup') parts.push(...sideGlassGeos(1.2, 1.15, 1.1, 0.85));
  else parts.push(...sideGlassGeos(-0.2, 1.05, 1.5, 0.8));
  // Police side stripe baked into the body (item 4 perf).
  if (extras.stripe) {
    for (const s of [-1, 1]) parts.push(colored(xform(new THREE.BoxGeometry(2.2, 0.16, 0.02), 0.3, 0.55, s * 0.928), extras.stripe));
  }
  // Wheels first: the rear brake discs bake into the body below.
  const { rigs } = mountWheels(g, wheelPos, halfWidth);
  bakeRearDiscs(g, rigs, parts);
  g.add(mergedMesh(parts, vertexColorMat));
  // Rectangular headlamps (no white round eyes). 2b draw-call cut:
  // both lamps in one merged mesh.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  g.add(mergedMesh([-0.55, 0.55].map((s) => xform(new THREE.BoxGeometry(0.1, 0.15, 0.32), 2.1, 0.6, s)), headMat));
  g.userData.headMat = headMat;
  // Part F: scale the whole car group (see CAR_SCALE above). The
  // police light bar (buildPoliceCruiser) is added as a child of this
  // group afterwards, so it inherits the scale too.
  g.scale.setScalar(CAR_SCALE);
  return g;
}

export function buildPoliceCruiser() {
  // Gabbiano Harbor Guard cruiser: navy + white side stripe, light bar.
  // Police wheels use the spoked steel spec like the other cars (the
  // plain dished discs read as flat grey circles). No floating white
  // board on the side — a thin white stripe, flush with the body
  // (baked into the body mesh, item 4 perf).
  const g = buildTrafficCar(0x16324f, 'sedan', 'sedan', { stripe: 0xf4f1ea });
  g.name = 'police-cruiser';
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.14, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 1.4 }),
  );
  bar.position.set(-0.2, 1.32, 0);
  g.add(bar);
  const bar2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.14, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x3ed6d6, emissive: 0x3ed6d6, emissiveIntensity: 1.4 }),
  );
  bar2.position.set(-0.2, 1.32, 0);
  bar2.visible = false;
  g.add(bar2);
  g.userData.lightBar = [bar, bar2];
  return g;
}

// ---------- arcade car physics ----------
export function createCar(mesh, opts = {}) {
  return {
    mesh,
    x: opts.x || 0,
    z: opts.z || 0,
    angle: opts.angle || 0,
    speed: 0,
    maxSpeed: opts.maxSpeed || 26,
    accel: opts.accel || 15,
    brake: opts.brake || 24,
    // Collision radius 0.5 (was 1.7): the avenue lanes are 1.05u wide
    // per direction (3 x 0.35 + 1.3 median = 3.4 carriageway) and the
    // side streets 1.4u wide — a 1.7 radius (3.4u circle) could not
    // fit ANY road, so the player car crept at 0.25 u/s (speed halved
    // on every step by the median/pavilion colliders) and wedged in
    // the marina, timing out M1/M2/M4/M5/M6/M8. The visual car is
    // bigger (4.4 x 1.9) — the circle is a drive-fit compromise, the
    // same scale the traffic lanes are drawn at.
    // Part F: the visual car is now CAR_SCALE (0.5) of that, so the
    // radius scales with it (0.25) — the same proportional compromise
    // against the visual body.
    radius: opts.radius || 0.5 * CAR_SCALE,
    damage: 0,
    fuel: 100,
  };
}

// Circle vs AABB push-out. Returns { x, z, hit, depth, rescued } where
// depth is the deepest pre-push overlap (0 when only grazing) and
// rescued is true when a centre-inside push-out fired. A circle whose
// centre is INSIDE an AABB used to get zero push-out (the nearest
// point IS the centre, dx=dz=0) and was permanently trapped, speed
// halved every step — e.g. a car teleported onto the marina pavilion
// anchor, which sits inside the pavilion's own collider. Push out
// along the minimum-penetration axis instead.
export function collideCircleAABBs(x, z, r, colliders) {
  let hit = false;
  let depth = 0;
  let rescued = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      depth = Math.max(depth, r - d);
      const push = (r - d) / d;
      x += dx * push;
      z += dz * push;
    } else {
      rescued = true;
      const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
      const m = Math.min(pl, pr, pt, pb);
      depth = Math.max(depth, m + r);
      if (m === pl) x = c.x0 - r;
      else if (m === pr) x = c.x1 + r;
      else if (m === pt) z = c.z0 - r;
      else z = c.z1 + r;
    }
  }
  return { x, z, hit, depth, rescued };
}

// input: { up, down, left, right, handbrake } — dt in seconds.
export function stepCar(car, input, dt, colliders, nowSec) {
  const time = nowSec !== undefined ? nowSec : performance.now() / 1000;
  if (input.up && car.fuel > 0) car.speed += car.accel * dt;
  // Brakes always work; reversing is engine work and needs fuel.
  if (input.down) car.speed -= (car.speed > 0.5 ? car.brake : (car.fuel > 0 ? car.accel * 0.5 : 0)) * dt;
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 4 * dt;
  if (input.handbrake) car.speed -= Math.sign(car.speed) * 26 * dt;
  if (Math.abs(car.speed) < 0.05 && !input.up && !input.down) car.speed = 0;
  car.speed = Math.max(-8, Math.min(car.maxSpeed, car.speed));
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 6);
  const turnRate = steer * 1.9 * steerAuthority * (input.handbrake ? 1.6 : 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += turnRate * dt * Math.min(1, Math.abs(car.speed) / 4 + 0.2);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const nz = car.z - Math.sin(car.angle) * car.speed * dt;
  const res = collideCircleAABBs(nx, nz, car.radius, colliders);
  // Impact vs slide (replaces the old graze rule, which halved speed
  // on every overlap): the push-out correction points OUT of the wall,
  // so the closing speed — velocity into the wall — separates a real
  // crash from sliding along a face. A car riding a lane edge grazes
  // the median every step at speed; the old rule dealt damage + halved
  // speed on EVERY graze (53 damage in 15 s of boulevard driving) and
  // the car wrecked itself. A slide has ~zero closing speed: no
  // damage, no cut, the push-out just deflects it. A head-on impact
  // (closing > 2) still damages and cuts speed. A centre-inside rescue
  // (e.g. teleported into a building) is an ejection, not an impact.
  if (res.hit && !res.rescued) {
    const cx = res.x - nx, cz = res.z - nz;
    const clen = Math.hypot(cx, cz);
    let closing = 0;
    if (clen > 1e-9) {
      const vx = Math.cos(car.angle) * car.speed;
      const vz = -Math.sin(car.angle) * car.speed;
      closing = -(vx * cx + vz * cz) / clen;
    }
    if (closing > 2) {
      car.damage = Math.min(100, car.damage + closing * 0.6);
      car.speed *= 0.4;
    } else if (closing > 0.5) {
      // Pushing into a wall: the wall stops the car (scrub speed) but
      // a gentle bump deals NO damage — otherwise a car grinding in
      // a corner at low speed wrecks itself in seconds (25 damage in
      // 2 s) and fails the mission as 'wrecked'.
      car.speed *= 0.4;
    }
  }
  car.x = res.x;
  car.z = res.z;
  // The road surface sits at y 0.2 (roads.js slabs) — the car rides on
  // the road top, not on the ground plane, so the tyres touch the
  // asphalt instead of sinking 0.2 into it.
  car.mesh.position.set(car.x, ROAD_Y + groundHeightAt(car.x, car.z), car.z);
  car.mesh.rotation.y = car.angle;
  // Wheels: spin with speed, front wheels steer, suspension bounce,
  // body roll in corners, drift skid marks + tyre squeal.
  updateCarWheels(car, dt, input, time);
  // Fuel: a full tank lasts ~1000 s at full speed (0.005 per unit of
  // speed per second) — no story mission (cap 480 s) can stall the
  // car, but a long free drive can. On empty the engine is dead:
  // no accel forward or back (the car coasts to a stop).
  if (car.fuel > 0) car.fuel = Math.max(0, car.fuel - Math.abs(car.speed) * dt * 0.005);
  return car;
}

// ---------- traffic AI ----------
// Each car follows one lane loop (waypoints). It yields when another car
// is close ahead in its driving direction.
export function createTraffic(lanes, defs) {
  const cars = [];
  defs.forEach((def, i) => {
    const lane = lanes[def.lane % lanes.length];
    const mesh = def.police ? buildPoliceCruiser() : buildTrafficCar(def.color, def.kind);
    const car = createCar(mesh, { maxSpeed: lane.speed, accel: 8 });
    car.lane = lane;
    car.wp = Math.floor((i / defs.length) * lane.pts.length);
    car.police = !!def.police;
    const p = lane.pts[car.wp];
    car.x = p.x;
    car.z = p.z;
    cars.push(car);
  });
  return cars;
}
export function stepTraffic(cars, dt, obstacles = [], nowSec) {
  const time = nowSec !== undefined ? nowSec : performance.now() / 1000;
  for (const car of cars) {
    const lane = car.lane;
    const target = lane.pts[(car.wp + 1) % lane.pts.length];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) {
      car.wp = (car.wp + 1) % lane.pts.length;
      continue;
    }
    const wantAngle = Math.atan2(-dz, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    // Yield: another car (or the player's car / the player on foot)
    // close ahead in the driving direction.
    let blocked = false;
    const ahead = [...cars, ...obstacles];
    for (const other of ahead) {
      if (other === car) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      const od = Math.hypot(ox, oz);
      if (od < 7 * CAR_SCALE && od > 0.01) {
        const dot = (ox * Math.cos(car.angle) - oz * Math.sin(car.angle)) / od;
        if (dot > 0.6) { blocked = true; break; }
      }
    }
    const targetSpeed = blocked ? 0 : lane.speed;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.z -= Math.sin(car.angle) * car.speed * dt;
    // AUDIT m-38: the ground is FLAT in stage 1 (groundHeightAt
    // returns 0 everywhere — the old skyline landmass is gone), so
    // this is just ROAD_Y; the call stays for stage 2 terrain.
    car.mesh.position.set(car.x, ROAD_Y + groundHeightAt(car.x, car.z), car.z);
    car.mesh.rotation.y = car.angle;
    // Wheels spin with speed; front wheels steer into the turn.
    updateCarWheels(car, dt, {
      left: diff > 0.05, right: diff < -0.05,
      handbrake: false, up: true, down: false,
    }, time);
  }
  return cars;
}
