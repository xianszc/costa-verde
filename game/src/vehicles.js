// COSTA VERDE Slice 2 — vehicles: low-poly wedge cars, a boxy van, a police
// cruiser with a flashing light bar, arcade driving + collision. The hero car
// is an acid-lime wedge supercar; traffic mixes wedge cars and vans; Slice 2
// adds stealable parked cars (taxi, van, cruiser) with their own handling.
// Collision is circle-vs-AABB, shared with the player.

import * as THREE from 'three';
import { CFG } from './config.js';

// Resolve a circle (x, z, radius) out of AABB colliders. Mutates pos in place
// and returns true when a push happened (caller should damp speed).
export function resolveCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const pl = pos.x - c.minX, pr = c.maxX - pos.x;
      const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = c.minX - radius;
      else if (m === pr) pos.x = c.maxX + radius;
      else if (m === pt) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  return hit;
}

function lambert(color, emissive = 0x000000, emissiveIntensity = 1) {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function addWheels(group, wheelGeo, wheelMat, hubMat) {
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, wheelMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tyre, hub);
    w.position.set(wx, 0.36, wz);
    group.add(w);
    wheels.push(w);
  }
  return wheels;
}

// Build a wedge car. Returns { group, wheels[] } (wheels spin with speed).
export function buildCar(color, opts = {}) {
  const group = new THREE.Group();
  const body = lambert(color);
  const glass = lambert(0x1c2836);
  const dark = lambert(0x1a1a1e);
  const isHero = !!opts.hero;

  // Low wide body + sloped nose wedge.
  group.add(box(1.9, 0.5, 4.2, body, 0, 0.48, 0));
  const nose = box(1.86, 0.34, 1.0, body, 0, 0.52, 1.85);
  nose.rotation.x = -0.28;
  group.add(nose);
  // Cabin + windshield.
  group.add(box(1.55, 0.5, 1.9, body, 0, 0.95, -0.25));
  const shield = box(1.5, 0.42, 0.08, glass, 0, 0.95, 0.72);
  shield.rotation.x = -0.35;
  group.add(shield);
  group.add(box(1.5, 0.4, 0.06, glass, 0, 0.95, -1.2));
  // Rear spoiler.
  group.add(box(1.8, 0.07, 0.5, dark, 0, 1.12, -1.95));
  group.add(box(0.1, 0.25, 0.1, dark, -0.6, 0.98, -1.95));
  group.add(box(0.1, 0.25, 0.1, dark, 0.6, 0.98, -1.95));
  // Headlights + taillights (emissive so they read at golden hour).
  group.add(box(0.42, 0.14, 0.06, lambert(0xfff6c8, 0xffe9a0, 1.6), -0.6, 0.55, 2.12));
  group.add(box(0.42, 0.14, 0.06, lambert(0xfff6c8, 0xffe9a0, 1.6), 0.6, 0.55, 2.12));
  group.add(box(0.42, 0.12, 0.06, lambert(0x7a1010, 0xd81f1f, 1.4), -0.6, 0.58, -2.12));
  group.add(box(0.42, 0.12, 0.06, lambert(0x7a1010, 0xd81f1f, 1.4), 0.6, 0.58, -2.12));
  if (isHero) {
    // Lime accent stripe down the centre.
    group.add(box(0.3, 0.03, 4.0, lambert(0x2b2d42), 0, 0.75, 0));
  }
  const wheels = addWheels(
    group,
    new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14),
    lambert(0x141416),
    lambert(0xb8bcc2),
  );
  return { group, wheels };
}

// Build a boxy delivery van / taxi-van — a second traffic silhouette so the
// street does not read as one repeated car. Same footprint as a car.
export function buildVan(color, opts = {}) {
  const group = new THREE.Group();
  const body = lambert(color);
  const glass = lambert(0x1c2836);
  const dark = lambert(0x1a1a1e);
  // Tall boxy cargo body + cab nose.
  group.add(box(1.9, 1.1, 3.4, body, 0, 0.85, -0.4));
  group.add(box(1.85, 0.55, 1.0, body, 0, 0.55, 1.6));
  const shield = box(1.6, 0.5, 0.08, glass, 0, 0.95, 1.15);
  shield.rotation.x = -0.3;
  group.add(shield);
  // Side windows.
  group.add(box(0.06, 0.4, 1.4, glass, -0.96, 1.15, -0.4));
  group.add(box(0.06, 0.4, 1.4, glass, 0.96, 1.15, -0.4));
  // Roof sign (taxi / delivery) when requested.
  if (opts.taxi) {
    group.add(box(0.7, 0.18, 0.3, lambert(0xf2c14e, 0xf2c14e, 0.8), 0, 1.5, 0.4));
  }
  // Headlights + taillights.
  group.add(box(0.4, 0.14, 0.06, lambert(0xfff6c8, 0xffe9a0, 1.6), -0.6, 0.5, 2.12));
  group.add(box(0.4, 0.14, 0.06, lambert(0xfff6c8, 0xffe9a0, 1.6), 0.6, 0.5, 2.12));
  group.add(box(0.4, 0.12, 0.06, lambert(0x7a1010, 0xd81f1f, 1.4), -0.6, 0.55, -2.12));
  group.add(box(0.4, 0.12, 0.06, lambert(0x7a1010, 0xd81f1f, 1.4), 0.6, 0.55, -2.12));
  group.add(box(1.9, 0.08, 0.4, dark, 0, 0.32, -2.1)); // rear bumper
  const wheels = addWheels(
    group,
    new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14),
    lambert(0x141416),
    lambert(0x8a8a8a),
  );
  return { group, wheels };
}

// Build a police cruiser: black body, white doors, "SPD" presence via the
// light bar. Returns { group, wheels, lightL, lightR } — the two light-bar
// lenses flash red/blue in turn (their emissive intensity is animated by
// the police manager). A white door band keeps it readable at a glance.
export function buildPoliceCruiser() {
  const built = buildCar(0x14161c);
  const { group } = built;
  const white = lambert(0xf2f0e8);
  const dark = lambert(0x1a1a1e);
  // White doors on both flanks.
  group.add(box(0.06, 0.42, 2.0, white, -0.96, 0.62, -0.2));
  group.add(box(0.06, 0.42, 2.0, white, 0.96, 0.62, -0.2));
  // Push bar on the nose.
  group.add(box(1.7, 0.16, 0.12, dark, 0, 0.45, 2.2));
  group.add(box(0.12, 0.3, 0.1, dark, -0.7, 0.55, 2.2));
  group.add(box(0.12, 0.3, 0.1, dark, 0.7, 0.55, 2.2));
  // Light bar: red lens left, blue lens right, on a dark base.
  group.add(box(1.2, 0.1, 0.34, dark, 0, 1.24, -0.2));
  const lightL = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x7a1010, emissive: 0xff2020, emissiveIntensity: 2.2 }),
  );
  lightL.position.set(-0.32, 1.34, -0.2);
  const lightR = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x102a7a, emissive: 0x2060ff, emissiveIntensity: 0.25 }),
  );
  lightR.position.set(0.32, 1.34, -0.2);
  group.add(lightL, lightR);
  return { ...built, lightL, lightR };
}

// Build a helicopter: body, tail, main rotor + tail rotor, belly spotlight
// cone. The rotor spins in the police manager; the cone points straight down
// at the player when the heli is on station.
export function buildHeli() {
  const group = new THREE.Group();
  const body = lambert(0x1a1a1e);
  const white = lambert(0xf2f0e8);
  // Cabin + nose.
  group.add(box(2.0, 1.5, 3.2, body, 0, 0, 0));
  group.add(box(1.7, 1.0, 1.2, lambert(0x1c2836), 0, 0.1, 1.9));
  // White belly stripe + tail boom.
  group.add(box(2.02, 0.4, 3.0, white, 0, -0.55, 0));
  group.add(box(0.5, 0.5, 4.2, body, 0, 0.25, -3.4));
  // Tail fin + tail rotor.
  group.add(box(0.14, 1.3, 0.9, body, 0, 0.7, -5.3));
  const tailRotor = new THREE.Group();
  const tr1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.12), lambert(0x333333));
  const tr2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 2.2), lambert(0x333333));
  tailRotor.add(tr1, tr2);
  tailRotor.position.set(0.32, 0.7, -5.3);
  group.add(tailRotor);
  // Main rotor (spins around Y).
  const rotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(9.5, 0.08, 0.5);
  const bladeMat = lambert(0x222222);
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.y = Math.PI / 2;
  rotor.add(b1, b2);
  rotor.position.y = 1.05;
  group.add(rotor);
  // Skids.
  group.add(box(0.12, 0.12, 3.0, lambert(0x333333), -0.9, -0.95, 0));
  group.add(box(0.12, 0.12, 3.0, lambert(0x333333), 0.9, -0.95, 0));
  // Spotlight cone (translucent, points down; the manager aims the heli).
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(6, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -21;
  cone.rotation.x = Math.PI; // apex up at the heli, base down at the street
  group.add(cone);
  return { group, rotor, tailRotor, cone };
}

// Build any vehicle spec from CFG.vehicles into a drivable entity.
// Returns { group, wheels, car, spec, name, lightL?, lightR? }.
export function buildDriveable(specKey) {
  const spec = CFG.vehicles[specKey];
  let built;
  if (spec.kind === 'van') built = buildVan(spec.color, { taxi: !!spec.taxi });
  else if (spec.kind === 'cruiser') built = buildPoliceCruiser();
  else built = buildCar(spec.color, { hero: specKey === 'verdeGT' });
  return {
    ...built,
    car: makeCarState(0, 0, 0, spec),
    spec,
    name: spec.name,
    specKey,
  };
}

// Arcade car state.
export function makeCarState(x, z, heading, spec) {
  return { x, z, heading, speed: 0, spec };
}

// One physics step. input: { throttle (-1..1), steer (-1..1), handbrake }.
// Forward is (sin(heading), cos(heading)) in (x, z).
export function updateCar(car, input, dt, colliders) {
  const s = car.spec;
  if (input.throttle > 0) car.speed += s.accel * input.throttle * dt;
  else if (input.throttle < 0) car.speed += s.brake * input.throttle * dt;
  if (input.handbrake) car.speed *= Math.max(0, 1 - 2.2 * dt);
  // Rolling + aero drag.
  car.speed -= car.speed * 0.35 * dt + car.speed * Math.abs(car.speed) * 0.004 * dt;
  car.speed = Math.max(-s.reverseSpeed, Math.min(s.topSpeed, car.speed));
  if (Math.abs(car.speed) < 0.05 && input.throttle === 0) car.speed = 0;

  const grip = input.handbrake ? 0.55 : 1;
  const steerFactor = Math.max(0.3, Math.min(1, Math.abs(car.speed) / 9));
  car.heading += input.steer * s.steer * grip * steerFactor * dt * Math.sign(car.speed || 1);

  const pos = { x: car.x, z: car.z };
  pos.x += Math.sin(car.heading) * car.speed * dt;
  pos.z += Math.cos(car.heading) * car.speed * dt;
  if (resolveCircle(pos, 1.5, colliders)) {
    car.speed *= 0.45; // scrub speed on a hit
    car.x = pos.x; car.z = pos.z;
  } else {
    car.x = pos.x; car.z = pos.z;
  }
  return car;
}

// Simple traffic: drive straight along one road, wrap at the city edge.
// kind: 'car' | 'van' — mixed silhouettes so the street reads busy.
export function makeTrafficCar(x, z, heading, color, kind = 'car') {
  const built = kind === 'van' ? buildVan(color, { taxi: color === 0xf2c14e }) : buildCar(color);
  const { group, wheels } = built;
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    group, wheels,
    car: makeCarState(x, z, heading, {
      ...CFG.heroCar, topSpeed: CFG.traffic.speed, accel: 10, brake: 20,
    }),
    axis: Math.abs(Math.sin(heading)) > 0.7 ? 'x' : 'z',
    dir: Math.sin(heading) >= 0 ? 1 : -1,
    baseSpeed: CFG.traffic.speed,
  };
}

// Traffic yields: a car stops when the player's car is close ahead of it
// (a simple give-way so chases read — traffic parts around the action).
export function updateTraffic(t, dt, playerCar) {
  const c = t.car;
  let target = t.baseSpeed;
  if (playerCar) {
    const dx = playerCar.x - c.x, dz = playerCar.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 12) {
      // Only yield if the player is roughly ahead of the traffic car.
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      if (dx * fx + dz * fz > 0) target = 0;
    }
  }
  c.speed += (target - c.speed) * Math.min(1, 2.5 * dt);
  c.x += Math.sin(c.heading) * c.speed * dt;
  c.z += Math.cos(c.heading) * c.speed * dt;
  const lim = 205;
  if (t.axis === 'x' && (c.x > lim || c.x < -lim)) c.x = -Math.sign(c.x) * lim;
  if (t.axis === 'z' && (c.z > lim || c.z < -lim)) c.z = -Math.sign(c.z) * lim;
  t.group.position.set(c.x, 0, c.z);
  t.group.rotation.y = c.heading;
  for (const w of t.wheels) w.rotation.x += (c.speed * dt) / 0.36;
}
