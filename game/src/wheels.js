// AZZURA HEIST — one shared wheel module for EVERY vehicle.
// All cars (player Stella, traffic sedan/pickup/van, police cruiser) get
// their wheels from here, so a wheel fix lands everywhere at once.
//
// Wheel anatomy (local frame: axle = local X, rolling direction = +Z
// after the axle frame's fixed 90° yaw; the car sees the axle along its
// lateral axis):
//   pivot (at the wheel mount, rotation.y = steering)
//     axle (fixed rotation.y = PI/2, maps local X onto the car lateral axis)
//       spin (rotation.x = spin angle — ALSO what the old
//             `userData.wheels` code drives, so wanted.js keeps working)
//         spinMesh: ONE merged mesh — tyre + tread blocks + sidewall +
//                   rim face + spokes + hub cap (vertex colors, shared
//                   geometry per spec, cloned across all cars)
//       staticMesh: brake disc + caliper (child of the axle, never spins)
// Contact blobs (dark ellipses under each wheel) are separate meshes the
// car builder adds to the car group, so they stay on the ground while the
// wheel bounces on its suspension.
//
// Geometry is built ONCE per wheel spec and shared (cloned meshes share
// one geometry + one material), so every wheel of every car costs 2 draw
// calls and almost no extra memory.
import * as THREE from '../vendor/three.module.min.js';
import { colored, xform, mergedMesh } from './world.js';

// Shared materials: one per part family, reused by every wheel.
const spinMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.55, metalness: 0.35, flatShading: true,
});
const staticMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.4, metalness: 0.6, flatShading: true,
});
const blobMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false,
});

// Wheel specs per vehicle type. Radius/width match the body; the sports
// car gets big low-profile wheels, the pickup tall treaded tires, the
// police cruiser a dished steel wheel with a small dark cap, the van
// small plain wheels.
export const WHEEL_SPECS = {
  sport: { radius: 0.38, width: 0.30, spokes: 6, rim: 'sport', tread: 'low', caliper: true },
  sedan: { radius: 0.33, width: 0.24, spokes: 5, rim: 'steel', tread: 'normal', caliper: false },
  pickup: { radius: 0.42, width: 0.32, spokes: 5, rim: 'steel', tread: 'tall', caliper: true },
  police: { radius: 0.33, width: 0.24, spokes: 0, rim: 'dished', tread: 'normal', caliper: true },
  van: { radius: 0.30, width: 0.24, spokes: 5, rim: 'steel', tread: 'normal', caliper: false },
};

const spinGeoCache = {};
const staticGeoCache = {};
const blobGeoCache = {};

// The spinning part: tyre + tread + sidewalls + rim + spokes + hub cap,
// all merged into ONE geometry (vertex colors). Built in wheel-local
// space where the axle is the X axis (cylinders are rotated z = PI/2).
function buildSpinGeometry(spec) {
  const r = spec.radius;
  const w = spec.width;
  const parts = [];
  // Tyre: dark rubber cylinder, axis along X.
  parts.push(colored(
    xform(new THREE.CylinderGeometry(r, r, w, 20), 0, 0, 0, 0, 1, 0, Math.PI / 2),
    0x161616,
  ));
  // Sidewalls: slightly lighter rubber rings on both faces, just proud
  // of the tyre so the rim reads against them.
  for (const s of [-1, 1]) {
    parts.push(colored(
      xform(new THREE.CylinderGeometry(r * 0.93, r * 0.93, 0.02, 20),
        s * (w / 2 + 0.004), 0, 0, 0, 1, 0, Math.PI / 2),
      0x2b2b2b,
    ));
  }
  // Tread blocks around the circumference — these make the spin VISIBLE
  // (a plain disc never shows rotation) and read as tread from the side.
  const treadH = spec.tread === 'tall' ? 0.08 : spec.tread === 'low' ? 0.035 : 0.05;
  const treadD = spec.tread === 'tall' ? 0.2 : 0.16;
  const n = spec.tread === 'tall' ? 12 : 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(colored(
      xform(new THREE.BoxGeometry(w * 0.98, treadH, treadD),
        0, Math.cos(a) * (r + treadH / 2 - 0.01), Math.sin(a) * (r + treadH / 2 - 0.01),
        0, 1, a, 0),
      0x1e1e1e,
    ));
  }
  // Rim face on both sides + spokes + hub cap. No white or colored
  // hubcaps: the cap is dark metal, the rim is silver steel.
  const rimColor = spec.rim === 'sport' ? 0xb8bcc2 : spec.rim === 'dished' ? 0x6f7478 : 0x8a8f94;
  const spokeColor = spec.rim === 'sport' ? 0xd8dbe0 : 0x9a9fa4;
  for (const s of [-1, 1]) {
    const fx = s * (w / 2 + 0.015);
    parts.push(colored(
      xform(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.03, 20),
        fx, 0, 0, 0, 1, 0, Math.PI / 2),
      rimColor,
    ));
    if (spec.spokes > 0) {
      for (let i = 0; i < spec.spokes; i++) {
        const a = (i / spec.spokes) * Math.PI * 2;
        parts.push(colored(
          xform(new THREE.BoxGeometry(0.02, r * 0.56, 0.09),
            s * (w / 2 + 0.035), Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3,
            0, 1, a, 0),
          spokeColor,
        ));
      }
    }
    // Hub cap: small dark metal disc in the center — never white.
    parts.push(colored(
      xform(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.04, 12),
        s * (w / 2 + 0.045), 0, 0, 0, 1, 0, Math.PI / 2),
      0x2a2d30,
    ));
  }
  return mergedMesh(parts, spinMat).geometry;
}

// The static part: brake disc + caliper. Never spins; the caliper shows
// through the gaps between the spokes.
function buildStaticGeometry(spec) {
  const r = spec.radius;
  const parts = [];
  parts.push(colored(
    xform(new THREE.CylinderGeometry(r * 0.48, r * 0.48, 0.03, 18), 0, 0, 0, 0, 1, 0, Math.PI / 2),
    0x9aa0a4,
  ));
  if (spec.caliper) {
    parts.push(colored(
      xform(new THREE.BoxGeometry(0.07, r * 0.24, r * 0.15), 0, r * 0.38, 0),
      0xc0392b,
    ));
  }
  return mergedMesh(parts, staticMat).geometry;
}

function spinGeometry(specName) {
  if (!spinGeoCache[specName]) {
    spinGeoCache[specName] = buildSpinGeometry(WHEEL_SPECS[specName]);
  }
  return spinGeoCache[specName];
}
function staticGeometry(specName) {
  if (!staticGeoCache[specName]) {
    staticGeoCache[specName] = buildStaticGeometry(WHEEL_SPECS[specName]);
  }
  return staticGeoCache[specName];
}

// Build one wheel rig. Returns the pivot group; the rig's spin group is
// pivot.userData.spin and the spec is pivot.userData.spec. The caller
// positions the pivot at (wx, radius, wz) in car space.
export function buildWheelRig(specName) {
  const spec = WHEEL_SPECS[specName] || WHEEL_SPECS.sedan;
  const pivot = new THREE.Group();
  pivot.userData.spec = spec;
  pivot.userData.specName = specName;
  const axle = new THREE.Group();
  axle.rotation.y = Math.PI / 2;
  pivot.add(axle);
  const spin = new THREE.Group();
  const spinMesh = new THREE.Mesh(spinGeometry(specName), spinMat);
  spinMesh.castShadow = true;
  spin.add(spinMesh);
  axle.add(spin);
  const staticMesh = new THREE.Mesh(staticGeometry(specName), staticMat);
  axle.add(staticMesh);
  pivot.userData.spin = spin;
  pivot.userData.axle = axle;
  return pivot;
}

// Dark contact blob under one wheel (stays on the ground while the wheel
// bounces). The caller adds it to the car group at (wx, 0.02, wz).
export function buildContactBlob(radius) {
  if (!blobGeoCache[radius]) {
    blobGeoCache[radius] = new THREE.CircleGeometry(radius * 1.2, 14);
  }
  const m = new THREE.Mesh(blobGeoCache[radius], blobMat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

// Pose one rig directly (shot staging): spin angle in radians, steer in
// radians. Used by ?shot=wheels so the spokes read at a visible angle.
export function poseWheelRig(rig, spinAngle, steerAngle) {
  rig.userData.spin.rotation.x = spinAngle;
  rig.rotation.y = steerAngle || 0;
}

// Per-frame update for one rig.
export function updateWheelRig(rig, o) {
  const spec = rig.userData.spec;
  // Spin: rolling speed / radius. Sign checked against the motion shot.
  rig.userData.spin.rotation.x += (o.speed * o.dt) / spec.radius;
  // Steering (front wheels only — the caller passes 0 for the rear).
  rig.rotation.y = o.steer || 0;
  // Suspension bounce: small vertical travel, scaled by speed.
  const sf = Math.min(1, Math.abs(o.speed) / 10);
  rig.position.y = spec.radius
    + Math.sin(o.time * 9 + (rig.userData.phase || 0)) * 0.02 * sf;
}

// --- skid marks + tyre squeal (shared pool, one per scene) ---
const skidPools = new WeakMap();
function getSkidPool(scene) {
  if (!skidPools.has(scene)) {
    const group = new THREE.Group();
    group.name = 'skid-marks';
    const geo = new THREE.PlaneGeometry(0.55, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0a0a0a, transparent: true, opacity: 0.55, depthWrite: false,
    });
    const marks = [];
    for (let i = 0; i < 80; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      group.add(m);
      marks.push({ mesh: m, age: 1e9 });
    }
    scene.add(group);
    skidPools.set(scene, { group, marks, next: 0, squeal: null });
  }
  return skidPools.get(scene);
}

// One skid mark at world (x, z), laid along heading `angle`.
export function addSkidMark(scene, x, z, angle) {
  const pool = getSkidPool(scene);
  const slot = pool.marks[pool.next];
  pool.next = (pool.next + 1) % pool.marks.length;
  slot.mesh.position.set(x, 0.03, z);
  slot.mesh.rotation.z = -angle;
  slot.mesh.material.opacity = 0.55;
  slot.mesh.visible = true;
  slot.age = 0;
}

function skidUpdate(pool, dt) {
  for (const s of pool.marks) {
    if (!s.mesh.visible) continue;
    s.age += dt;
    if (s.age > 6) { s.mesh.visible = false; continue; }
    s.mesh.material.opacity = 0.55 * (1 - s.age / 6);
  }
}

// Tyre squeal: a looping band-passed noise whose gain follows the drift.
// Lazily created on the first drift; never throws (no gesture in a
// headless shot run means the context simply stays suspended).
function squealSet(pool, on) {
  try {
    if (on && !pool.squeal) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const src = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      src.buffer = buf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start();
      pool.squeal = { ctx, gain: g };
    }
    if (pool.squeal) {
      if (pool.squeal.ctx.state === 'suspended') pool.squeal.ctx.resume().catch(() => {});
      pool.squeal.gain.gain.value = on ? 0.05 : 0;
    }
  } catch (e) { /* audio is optional — never break the game */ }
}

// Drive all four rigs of one car for a frame. `car` is a vehicles.js car
// object; `input` is { left, right, handbrake, up, down }; `time` is
// seconds. The car's mesh must carry userData.wheelRigs [FL, FR, RL, RR]
// and userData.wheelOffsets (local rear-wheel x/z for skid marks).
export function updateCarWheels(car, dt, input, time) {
  const rigs = car.mesh.userData.wheelRigs || [];
  if (!rigs.length) return;
  const steer = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * 0.38;
  const drifting = !!input.handbrake && Math.abs(car.speed) > 6;
  rigs.forEach((rig, i) => {
    updateWheelRig(rig, {
      speed: car.speed,
      steer: i < 2 ? steer : 0,
      dt,
      time,
    });
  });
  // Body roll in corners + pitch on accel/brake (small angles; heading
  // stays on rotation.y).
  const sf = Math.min(1, Math.abs(car.speed) / 12);
  car.mesh.rotation.z = -steer * sf * 0.05;
  car.mesh.rotation.x = (input.up ? -0.012 : input.down ? 0.018 : 0);
  // Drift: skid marks at the rear wheels + squeal.
  const scene = car.mesh.parent;
  if (scene) {
    const pool = getSkidPool(scene);
    skidUpdate(pool, dt);
    if (drifting) {
      const offs = car.mesh.userData.wheelOffsets || [];
      for (const [lx, lz] of offs) {
        const wx = car.x + lx * Math.cos(car.angle) + lz * Math.sin(car.angle);
        const wz = car.z - lx * Math.sin(car.angle) + lz * Math.cos(car.angle);
        addSkidMark(scene, wx, wz, car.angle);
      }
      squealSet(pool, true);
    } else {
      squealSet(pool, false);
    }
  }
}
