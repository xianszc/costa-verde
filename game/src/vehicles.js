// COSTA VERDE — vehicles: low-poly wedge cars + arcade driving + collision.
// The hero car is an acid-lime wedge supercar; traffic uses the same builder
// with different colours. Collision is circle-vs-AABB, shared with the player.

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
  // Wheels: cylinders with the axis across the car.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14);
  const wheelMat = lambert(0x141416);
  const hubMat = lambert(0xb8bcc2);
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
  return { group, wheels };
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
export function makeTrafficCar(x, z, heading, color) {
  const { group, wheels } = buildCar(color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    group, wheels,
    car: makeCarState(x, z, heading, {
      ...CFG.heroCar, topSpeed: CFG.traffic.speed, accel: 10, brake: 20,
    }),
    axis: Math.abs(Math.sin(heading)) > 0.7 ? 'x' : 'z',
    dir: Math.sin(heading) >= 0 ? 1 : -1,
  };
}

export function updateTraffic(t, dt) {
  const c = t.car;
  c.speed = CFG.traffic.speed;
  c.x += Math.sin(c.heading) * c.speed * dt;
  c.z += Math.cos(c.heading) * c.speed * dt;
  const lim = 205;
  if (t.axis === 'x' && (c.x > lim || c.x < -lim)) c.x = -Math.sign(c.x) * lim;
  if (t.axis === 'z' && (c.z > lim || c.z < -lim)) c.z = -Math.sign(c.z) * lim;
  t.group.position.set(c.x, 0, c.z);
  t.group.rotation.y = c.heading;
  for (const w of t.wheels) w.rotation.x += (c.speed * dt) / 0.36;
}
