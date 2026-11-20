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
import {
  WHEEL_SPECS, buildWheelRig, updateCarWheels,
} from './wheels.js';

// Wheel arches for one car: a dark half-torus lip over each wheel plus a
// dark recess disc on the body side behind each wheel, so the wheel reads
// as sitting INSIDE an arch instead of pasted on a flat slab. Both are
// merged into one mesh each per car (2 draw calls per car, not 8).
function buildArches(wheelPos, halfWidth) {
  const lips = [];
  const discs = [];
  for (const [wx, wz, r] of wheelPos) {
    const side = Math.sign(wz);
    lips.push(colored(
      xform(new THREE.TorusGeometry(r + 0.06, 0.055, 8, 18, Math.PI),
        wx, r, side * (halfWidth + 0.005)),
      0x1c1c1c,
    ));
    // Shadow disc on the body side, just behind the wheel's outer face.
    const disc = new THREE.CircleGeometry(r * 1.15, 18);
    discs.push(colored(
      xform(disc, wx, r, side * (halfWidth - 0.004), side < 0 ? Math.PI : 0, 1, 0, 0),
      0x0d0d0d,
    ));
  }
  const group = new THREE.Group();
  group.add(mergedMesh(lips, vertexColorMat));
  group.add(mergedMesh(discs, vertexColorMat));
  return group;
}

// Mount four wheels (shared module) + contact blobs on a car group.
// wheelPos: [[x, z, radius, specName], ...] in car space, front two first.
// Returns { rigs, spins } and stashes them on the car group.
function mountWheels(g, wheelPos, halfWidth) {
  const rigs = [];
  const spins = [];
  const blobGeos = [];
  for (const [wx, wz, r, specName] of wheelPos) {
    const rig = buildWheelRig(specName);
    rig.position.set(wx, r, wz);
    rig.userData.phase = (wx * 1.7 + wz * 2.3) % (Math.PI * 2);
    g.add(rig);
    rigs.push(rig);
    spins.push(rig.userData.spin);
    blobGeos.push(xform(
      new THREE.CircleGeometry(r * 1.2, 14), wx, 0.02, wz, 0, 1, -Math.PI / 2, 0,
    ));
  }
  // One merged contact blob mesh per car (dark ellipses under the wheels).
  const blobMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false,
  });
  const blobs = mergedMesh(blobGeos, blobMat);
  blobs.castShadow = false;
  blobs.receiveShadow = false;
  g.add(blobs);
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

// Side glass panels for a cabin block: two thin dark panes on the body
// sides, so the cabin reads as windows instead of a solid slab.
function sideGlass(g, x, y, len, halfWidth) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a2e40, roughness: 0.15, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(len, 0.32, 0.04), mat);
    p.position.set(x, y, s * (halfWidth + 0.01));
    g.add(p);
  }
}

// Rectangular headlamp: a slim emissive box, not a white sphere.
function headlamp(g, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.16, 0.36),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.6 }),
  );
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// ---------- car models ----------
export function buildStella() {
  // Stella roadster — coral hero car, low and long, cream interior.
  // Sports spec: big wheels (r 0.38), low body.
  const g = new THREE.Group();
  g.name = 'stella';
  const body = [
    colored(xform(new THREE.BoxGeometry(4.4, 0.55, 1.9), 0, 0.55, 0), 0xe4572e),
    colored(xform(new THREE.BoxGeometry(2.6, 0.5, 1.7), -0.2, 0.95, 0), 0xe4572e),
    colored(xform(new THREE.BoxGeometry(2.2, 0.42, 1.5), -0.2, 0.85, 0), 0xf7ebd7),
    colored(xform(new THREE.BoxGeometry(1.0, 0.18, 1.6), 1.9, 0.62, 0), 0xf2a541),
    colored(xform(new THREE.BoxGeometry(0.5, 0.3, 1.7), -2.1, 0.6, 0), 0xc0392b),
  ];
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
  // Side windows on the cabin block.
  sideGlass(g, -0.2, 1.0, 1.5, 0.85);
  // Rectangular headlamps + taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  for (const s of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.36), headMat);
    h.position.set(2.22, 0.62, s);
    g.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0xff2a2a, emissiveIntensity: 0.5 });
  for (const s of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), tailMat);
    t.position.set(-2.22, 0.62, s);
    g.add(t);
  }
  // Rear window + chrome rear bumper so the car reads from behind.
  const rearWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.42, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1a2e40, roughness: 0.15, metalness: 0.3 }),
  );
  rearWindow.position.set(-1.52, 1.0, 0);
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 1.9),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.3, metalness: 0.7 }),
  );
  bumper.position.set(-2.24, 0.35, 0);
  g.add(rearWindow, bumper);
  // Wheels: flush with the body side (half-width 0.95, tyre width 0.30
  // → center at ±0.805, outer face at 0.955), inside real arches.
  const r = WHEEL_SPECS.sport.radius;
  const wheelPos = [
    [1.45, 0.805, r, 'sport'], [1.45, -0.805, r, 'sport'],
    [-1.45, 0.805, r, 'sport'], [-1.45, -0.805, r, 'sport'],
  ];
  g.add(buildArches(wheelPos.map(([x, z, rr]) => [x, z, rr]), 0.95));
  mountWheels(g, wheelPos, 0.95);
  g.userData.headMat = headMat;
  g.userData.tailMat = tailMat;
  return g;
}

export function buildTrafficCar(color, kind = 'sedan', wheelSpec = null) {
  const g = new THREE.Group();
  g.name = 'traffic-' + kind;
  const specName = wheelSpec || (kind === 'pickup' ? 'pickup' : kind === 'van' ? 'van' : 'sedan');
  const spec = WHEEL_SPECS[specName];
  const r = spec.radius;
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
  g.add(mergedMesh(parts, vertexColorMat));
  // Side windows on the cabin.
  if (kind === 'van') sideGlass(g, 1.6, 1.05, 0.9, 0.85);
  else if (kind === 'pickup') sideGlass(g, 1.2, 1.15, 1.1, 0.85);
  else sideGlass(g, -0.2, 1.05, 1.5, 0.8);
  // Rectangular headlamps (no white round eyes).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  for (const s of [-0.55, 0.55]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.32), headMat);
    h.position.set(2.1, 0.6, s);
    g.add(h);
  }
  // Wheels flush with the body side, inside real arches.
  const halfWidth = kind === 'sedan' ? 0.925 : 0.95;
  const wz = halfWidth - spec.width / 2 + 0.005;
  const wheelPos = [
    [1.4, wz, r, specName], [1.4, -wz, r, specName],
    [-1.4, wz, r, specName], [-1.4, -wz, r, specName],
  ];
  g.add(buildArches(wheelPos.map(([x, z, rr]) => [x, z, rr]), halfWidth));
  mountWheels(g, wheelPos, halfWidth);
  g.userData.headMat = headMat;
  return g;
}

export function buildPoliceCruiser() {
  // Gabbiano Harbor Guard cruiser: navy + white side stripe, light bar.
  // Police wheels use the spoked steel spec like the other cars (the
  // plain dished discs read as flat grey circles). No floating white
  // board on the side — a thin white stripe, flush with the body.
  const g = buildTrafficCar(0x16324f, 'sedan', 'sedan');
  g.name = 'police-cruiser';
  const stripeMat = M(0xf4f1ea);
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.02), stripeMat);
    stripe.position.set(0.3, 0.55, s * 0.928);
    g.add(stripe);
  }
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
    radius: opts.radius || 1.7,
    damage: 0,
    fuel: 100,
  };
}

// Circle vs AABB push-out. Returns true when a collision happened.
export function collideCircleAABBs(x, z, r, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(x, c.x1));
    const nz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = (r - d) / d;
      x += dx * push;
      z += dz * push;
    }
  }
  return { x, z, hit };
}

// input: { up, down, left, right, handbrake } — dt in seconds.
export function stepCar(car, input, dt, colliders, nowSec) {
  const time = nowSec !== undefined ? nowSec : performance.now() / 1000;
  if (input.up) car.speed += car.accel * dt;
  if (input.down) car.speed -= (car.speed > 0.5 ? car.brake : car.accel * 0.5) * dt;
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
  if (res.hit && Math.abs(car.speed) > 4) {
    car.damage = Math.min(100, car.damage + Math.abs(car.speed) * 0.6);
    car.speed *= 0.4;
  } else if (res.hit) {
    car.speed *= 0.5;
  }
  car.x = res.x;
  car.z = res.z;
  // The road surface sits at y 0.2 (roads.js slabs) — the car rides on
  // the road top, not on the ground plane, so the tyres touch the
  // asphalt instead of sinking 0.2 into it.
  car.mesh.position.set(car.x, ROAD_Y, car.z);
  car.mesh.rotation.y = car.angle;
  // Wheels: spin with speed, front wheels steer, suspension bounce,
  // body roll in corners, drift skid marks + tyre squeal.
  updateCarWheels(car, dt, input, time);
  if (car.fuel > 0) car.fuel = Math.max(0, car.fuel - Math.abs(car.speed) * dt * 0.02);
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
      if (od < 7 && od > 0.01) {
        const dot = (ox * Math.cos(car.angle) - oz * Math.sin(car.angle)) / od;
        if (dot > 0.6) { blocked = true; break; }
      }
    }
    const targetSpeed = blocked ? 0 : lane.speed;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.z -= Math.sin(car.angle) * car.speed * dt;
    car.mesh.position.set(car.x, ROAD_Y, car.z);
    car.mesh.rotation.y = car.angle;
    // Wheels spin with speed; front wheels steer into the turn.
    updateCarWheels(car, dt, {
      left: diff > 0.05, right: diff < -0.05,
      handbrake: false, up: true, down: false,
    }, time);
  }
  return cars;
}
