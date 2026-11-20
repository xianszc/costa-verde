// AZZURA HEIST — vehicles (M1).
// Procedural cars: the hero Stella roadster + traffic variants. Arcade
// handling (accelerate / brake / steer / handbrake), circle-vs-AABB
// collision against the district's colliders, and traffic AI that follows
// the road network's lane loops and yields to the car ahead.
import * as THREE from '../vendor/three.module.min.js';
import { M, box, cyl, mergedMesh, colored, xform, vertexColorMat } from './world.js';

function wheel(r = 0.34) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.24, 14),
    M(0x1a1a1a, { roughness: 0.9 }),
  );
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.26, 10),
    M(0xd8d2c4, { metalness: 0.5, roughness: 0.35 }),
  );
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  return g;
}

// ---------- car models ----------
export function buildStella() {
  // Stella roadster — coral hero car, low and long, cream interior.
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
  // Windshield + side glass.
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.55, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x9fd4d8, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 }),
  );
  glass.position.set(0.85, 1.15, 0);
  glass.rotation.z = -0.35;
  g.add(glass);
  // Headlights (emissive — bright at night) + taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  for (const s of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), headMat);
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
  const wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const w = wheel();
    w.position.set(wx, 0.34, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.headMat = headMat;
  g.userData.tailMat = tailMat;
  return g;
}

export function buildTrafficCar(color, kind = 'sedan') {
  const g = new THREE.Group();
  g.name = 'traffic-' + kind;
  const parts = [];
  if (kind === 'van') {
    parts.push(colored(xform(new THREE.BoxGeometry(4.2, 1.5, 1.9), 0, 1.05, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.2, 0.7, 1.7), 1.6, 0.95, 0), 0x2e4a5e));
  } else if (kind === 'pickup') {
    parts.push(colored(xform(new THREE.BoxGeometry(4.3, 0.6, 1.9), 0, 0.6, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.6, 0.6, 1.7), 1.2, 1.05, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.8, 0.4, 1.6), -1.2, 0.85, 0), 0x6b4a2a));
  } else { // sedan
    parts.push(colored(xform(new THREE.BoxGeometry(4.1, 0.55, 1.85), 0, 0.58, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(2.2, 0.5, 1.6), -0.2, 1.0, 0), color));
    parts.push(colored(xform(new THREE.BoxGeometry(1.9, 0.4, 1.4), -0.2, 0.95, 0), 0x2e4a5e));
  }
  g.add(mergedMesh(parts, vertexColorMat));
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 0.6 });
  for (const s of [-0.55, 0.55]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), headMat);
    h.position.set(2.1, 0.6, s);
    g.add(h);
  }
  const wheels = [];
  for (const [wx, wz] of [[1.4, 0.9], [1.4, -0.9], [-1.4, 0.9], [-1.4, -0.9]]) {
    const w = wheel(0.32);
    w.position.set(wx, 0.32, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.headMat = headMat;
  return g;
}

export function buildPoliceCruiser() {
  // Gabbiano Harbor Guard cruiser: navy + white doors, light bar.
  const g = buildTrafficCar(0x16324f, 'sedan');
  g.name = 'police-cruiser';
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.4, 0.02),
    M(0xf4f1ea),
  );
  door.position.set(0.3, 0.85, 0.94);
  g.add(door);
  const door2 = door.clone();
  door2.position.z = -0.94;
  g.add(door2);
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
export function stepCar(car, input, dt, colliders) {
  const forward = { x: Math.cos(car.angle), z: -Math.sin(car.angle) };
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
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  // Wheels spin with speed; front wheels yaw with steering.
  const wheels = car.mesh.userData.wheels || [];
  wheels.forEach((w, i) => {
    w.rotation.x += car.speed * dt * 2.4;
    if (i < 2) w.rotation.y = steer * 0.35;
  });
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
export function stepTraffic(cars, dt, obstacles = []) {
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
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    const wheels = car.mesh.userData.wheels || [];
    for (const w of wheels) w.rotation.x += car.speed * dt * 2.4;
  }
  return cars;
}
