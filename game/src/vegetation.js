// AZZURA HEIST — vegetation (M2, quick fix 5: fuller palms).
// The M1 palm was one ring of 7 flat boxes — a thin green starburst from
// any distance. This palm has THREE frond layers (drooping / mid / crown),
// each frond built from two segments (base + drooping tip) so the canopy
// reads as a full crown, plus a coconut cluster. Frond count, length and
// tilt vary per palm via the instance scale/rotation; heights vary per
// placement. Procedural only, one merged vertex-colored geometry per palm.
import * as THREE from '../vendor/three.module.min.js';
import { colored, xform, mergeGeometries, vertexColorMat } from './world.js';

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GREENS = [0x3f7a4e, 0x4d8a5c, 0x356b42, 0x5a9455];

// One full palm as a merged vertex-colored geometry (trunk + 3 frond
// layers + coconuts). ~2.6-3.4 m tall before instance scale.
export function palmGeometryFull(seed = 7) {
  const rnd = seeded(seed);
  const parts = [];
  const add = (geo, hex) => parts.push(colored(geo, hex));
  // Trunk: slightly leaning, ringed.
  add(xform(new THREE.CylinderGeometry(0.1, 0.17, 2.7, 7), 0, 1.35, 0, 0, 1, 0.05), 0x8a6a4a);
  for (let i = 0; i < 4; i++) {
    add(xform(new THREE.TorusGeometry(0.13 - i * 0.008, 0.02, 6, 10), 0, 0.7 + i * 0.55, 0, 0, 1, Math.PI / 2), 0x7a5a3a);
  }
  // Three frond layers. Each frond: a base segment reaching out + a tip
  // segment angled further down, so the frond curves instead of lying flat.
  const layers = [
    { n: 9, y: 2.55, tilt: 1.05, len: 1.9, w: 0.26 }, // drooping outer ring
    { n: 8, y: 2.78, tilt: 0.55, len: 1.7, w: 0.24 }, // mid ring
    { n: 6, y: 2.98, tilt: 0.12, len: 1.35, w: 0.2 }, // upright crown
  ];
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const a = (i / L.n) * Math.PI * 2 + rnd() * 0.5;
      const len = L.len * (0.9 + rnd() * 0.25);
      const green = GREENS[(i + (L.n % 3)) % GREENS.length];
      const r = len * 0.5;
      // Base segment: from the crown out, tilted down by L.tilt.
      const base = new THREE.BoxGeometry(L.w, 0.05, len * 0.62);
      add(xform(base, Math.cos(a) * r * 0.62, L.y + 0.06, Math.sin(a) * r * 0.62, -a, 1, L.tilt), green);
      // Tip segment: continues from the base end, drooping further.
      const tip = new THREE.BoxGeometry(L.w * 0.8, 0.04, len * 0.55);
      const tx = Math.cos(a) * (r + len * 0.22);
      const tz = Math.sin(a) * (r + len * 0.22);
      const ty = L.y - Math.sin(L.tilt) * len * 0.42 - 0.12;
      add(xform(tip, tx, ty, tz, -a, 1, L.tilt + 0.55), green);
    }
  }
  // Coconut cluster under the crown.
  add(xform(new THREE.SphereGeometry(0.17, 8, 6), 0.14, 2.5, 0.12), 0x6b4a2a);
  add(xform(new THREE.SphereGeometry(0.15, 8, 6), -0.14, 2.46, -0.1), 0x7a5a34);
  add(xform(new THREE.SphereGeometry(0.13, 8, 6), 0.02, 2.52, -0.16), 0x6b4a2a);
  return mergeGeometries(parts);
}

let palmGeo = null;
function getPalmGeo() {
  if (!palmGeo) palmGeo = palmGeometryFull(11);
  return palmGeo;
}

// One full palm as a single mesh (hero accents).
export function makePalmFull(scale = 1, tint = 0xffffff) {
  const m = new THREE.Mesh(getPalmGeo(), vertexColorMat);
  m.scale.setScalar(scale);
  m.castShadow = true;
  m.receiveShadow = true;
  if (tint !== 0xffffff) {
    m.material = vertexColorMat.clone();
    m.material.color.setHex(tint);
  }
  return m;
}

// Many full palms as a single draw call. placements: {x, z, s, rot, tint}.
// Vary s (0.85–1.5) for varied heights — the geometry is ~3 m tall.
export function palmInstanced(placements) {
  const inst = new THREE.InstancedMesh(getPalmGeo(), vertexColorMat, placements.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  placements.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(0, p.rot || 0, 0));
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.setHex(p.tint || 0xffffff));
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  return inst;
}
