// AZZURA HEIST — M3 districts (old town, promenade east, skyline).
// Each district is built in its own vocabulary from GAME_BIBLE.md and
// added to the map by city.js (buildDistrict4 merges the result). All
// three zones share the same rules as District 4: roads FIRST, plots
// validated against road/sidewalk rects, trees only in green zones,
// colliders for every solid prop, traffic lanes + pedestrian paths per
// district. The map grows north (old town, z -44..-86), east (promenade
// extension, x 60..108) and across the bay (skyline, z 62..104, reached
// by a pedestrian bridge from the quay).
import * as THREE from '../vendor/three.module.min.js';
import {
  M, box, cyl, cone, sph, archTop, mergedMesh, mergeStatic, colored,
  xform, vertexColorMat, fountain, lampPost, makeTree,
} from './world.js';
import { roadTexture, seededRandom } from './roads.js';
import { makePalmFull } from './vegetation.js';

// Ground height for the player / pedestrians: the skyline landmass and
// its bridge sit 0.75 above the roads (above the bay waves); everywhere
// else the walkable ground is y 0. Cars never go there (the bridge is
// pedestrian-only, blocked by bollards at the quay end).
export function groundHeightAt(x, z) {
  if (x >= -58 && x <= 58 && z >= 62 && z <= 104) return 0.75;
  if (Math.abs(x) <= 4.5 && z >= 13 && z <= 62) {
    return z < 20 ? 0.75 * ((z - 13) / 7) : 0.75;
  }
  return 0;
}

// Rounded-rectangle loop path (waypoints every ~2 units) for traffic.
// Same shape as roads.js loopPath (kept local: that helper is not exported).
function loopPath(x0, z0, x1, z1, r = 4) {
  const pts = [];
  const push = (x, z) => pts.push({ x, z });
  for (let x = x0 + r; x <= x1 - r; x += 2) push(x, z0);
  for (let a = -Math.PI / 2; a <= 0; a += 0.25) push(x1 - r + Math.cos(a) * r, z0 + r + Math.sin(a) * r);
  for (let z = z0 + r; z <= z1 - r; z += 2) push(x1, z);
  for (let a = 0; a <= Math.PI / 2; a += 0.25) push(x1 - r + Math.cos(a) * r, z1 - r + Math.sin(a) * r);
  for (let x = x1 - r; x >= x0 + r; x -= 2) push(x, z1);
  for (let a = Math.PI / 2; a <= Math.PI; a += 0.25) push(x0 + r + Math.cos(a) * r, z1 - r + Math.sin(a) * r);
  for (let z = z1 - r; z >= z0 + r; z -= 2) push(x0, z);
  for (let a = Math.PI; a <= Math.PI * 1.5; a += 0.25) push(x0 + r + Math.cos(a) * r, z0 + r + Math.sin(a) * r);
  return pts;
}

// Two sloped slabs meeting at a ridge (pitched terracotta roof).
function pitchedRoof(w, d, color, x, y, z) {
  const g = new THREE.Group();
  const a = box(w / 2 + 0.2, 0.14, d + 0.3, color, -w / 4, 0.28, 0);
  a.rotation.z = 0.42;
  const b = box(w / 2 + 0.2, 0.14, d + 0.3, color, w / 4, 0.28, 0);
  b.rotation.z = -0.42;
  g.add(a, b);
  g.position.set(x, y, z);
  return g;
}

// ---------- (a) Fortress Old Town ----------
// Sandstone #D9B98A, deep terracotta #B4552D, iron black #2B2B2B, plaster
// cream #EFE3C8, shutter green #4A6741. Cobble streets, arcaded ground
// floors, stair-streets, laundry lines, a plaza fountain, a domed
// chapel, the arcaded Palazzo del Podestà, and the fortress wall with
// bastions along the north edge. The old bell tower (already in
// District 4 at (-47,-36)) stands at the south gate of the quarter.
const OT = {
  stone: 0xd9b98a, stoneDark: 0xbfa06e, terra: 0xb4552d,
  iron: 0x2b2b2b, plaster: 0xefe3c8, shutter: 0x4a6741,
};

function arcadeHouse(w, d, h) {
  const g = new THREE.Group();
  // Ground floor with a 3-arch arcade on the front face.
  g.add(box(w, 2.6, d, OT.stone, 0, 1.3, 0));
  for (let i = -1; i <= 1; i++) {
    const ax = (i * w) / 3;
    g.add(box(0.35, 2.6, 0.35, OT.stoneDark, ax - w / 6, 1.3, d / 2 + 0.1));
    g.add(box(0.35, 2.6, 0.35, OT.stoneDark, ax + w / 6, 1.3, d / 2 + 0.1));
    g.add(archTop(w / 6 - 0.1, OT.iron, ax, 2.0, d / 2 + 0.12));
    g.add(box(w / 3 - 0.4, 1.7, 0.1, OT.iron, ax, 0.85, d / 2 + 0.08));
  }
  g.add(box(w + 0.2, 0.3, d + 0.2, OT.stoneDark, 0, 2.75, 0));
  // Upper floor: plaster, shuttered windows, iron balcony.
  g.add(box(w, h - 2.6, d * 0.92, OT.plaster, 0, 2.6 + (h - 2.6) / 2, -d * 0.02));
  const rows = h >= 6 ? 2 : 1;
  for (let r = 0; r < rows; r++) {
    for (let i = -1; i <= 1; i++) {
      const wx = (i * w) / 3;
      const wy = 3.4 + r * 1.6;
      g.add(box(0.7, 1.1, 0.1, OT.iron, wx, wy, d * 0.46 + 0.02));
      g.add(box(0.24, 1.1, 0.06, OT.shutter, wx - 0.5, wy, d * 0.46 + 0.04));
      g.add(box(0.24, 1.1, 0.06, OT.shutter, wx + 0.5, wy, d * 0.46 + 0.04));
    }
  }
  g.add(box(w * 0.5, 0.12, 0.9, OT.iron, 0, 4.0, d * 0.46 + 0.45));
  for (let i = 0; i < 6; i++) {
    g.add(box(0.05, 0.5, 0.05, OT.iron, -w * 0.22 + i * w * 0.088, 4.3, d * 0.46 + 0.85));
  }
  g.add(pitchedRoof(w, d, OT.terra, 0, h, 0));
  // Chimney + rooftop water tank.
  g.add(box(0.5, 1.0, 0.5, 0x8a4a3a, w * 0.3, h + 0.9, -d * 0.2));
  g.add(cyl(0.5, 0.5, 1.0, 0x6a4a2a, -w * 0.3, h + 0.9, -d * 0.2, 8));
  return g;
}

function stairHouse(w, d, h) {
  const g = new THREE.Group();
  // Stepped stone base rising toward the front door (a stair-street in
  // miniature): three shallow steps up to the ground floor.
  for (let i = 0; i < 3; i++) {
    g.add(box(w, 0.3, 0.8, OT.stoneDark, 0, 0.15 + i * 0.3, d / 2 + 0.4 + i * 0.8));
  }
  g.add(box(w, h, d, OT.stone, 0, h / 2 + 0.6, 0));
  g.add(box(w + 0.2, 0.3, d + 0.2, OT.stoneDark, 0, h + 0.75, 0));
  // External staircase up the side to the upper door.
  for (let i = 0; i < 5; i++) {
    g.add(box(0.9, 0.22, 0.5, OT.stoneDark, w / 2 + 0.45, 0.3 + i * 0.45, -d / 2 + 0.6 + i * 0.7));
  }
  g.add(box(0.7, 1.6, 0.1, OT.iron, 0, 1.6, d / 2 + 0.04));
  g.add(archTop(0.35, OT.iron, 0, 2.4, d / 2 + 0.04));
  for (const wy of [3.6, 5.0]) {
    for (const wx of [-w / 4, w / 4]) {
      g.add(box(0.7, 1.0, 0.1, OT.iron, wx, wy, d / 2 + 0.04));
      g.add(box(0.24, 1.0, 0.06, OT.shutter, wx - 0.48, wy, d / 2 + 0.06));
      g.add(box(0.24, 1.0, 0.06, OT.shutter, wx + 0.48, wy, d / 2 + 0.06));
    }
  }
  g.add(pitchedRoof(w, d, OT.terra, 0, h + 0.6, 0));
  return g;
}

function townhouse(w, d, h) {
  const g = new THREE.Group();
  g.add(box(w, h, d, OT.plaster, 0, h / 2, 0));
  g.add(box(w + 0.2, 0.25, d + 0.2, OT.stoneDark, 0, h + 0.1, 0));
  for (let r = 0; r < 2; r++) {
    for (const wx of [-w / 4, w / 4]) {
      const wy = 1.4 + r * 1.9;
      g.add(box(0.7, 1.1, 0.1, OT.iron, wx, wy, d / 2 + 0.04));
      g.add(box(0.24, 1.1, 0.06, OT.shutter, wx - 0.48, wy, d / 2 + 0.06));
      g.add(box(0.24, 1.1, 0.06, OT.shutter, wx + 0.48, wy, d / 2 + 0.06));
    }
  }
  // Wrought-iron balcony on the upper floor.
  g.add(box(w * 0.55, 0.12, 0.9, OT.iron, 0, 3.1, d / 2 + 0.45));
  for (let i = 0; i < 7; i++) {
    g.add(box(0.05, 0.55, 0.05, OT.iron, -w * 0.25 + i * w * 0.083, 3.4, d / 2 + 0.85));
  }
  g.add(box(0.8, 1.9, 0.12, OT.iron, 0, 0.95, d / 2 + 0.04));
  g.add(pitchedRoof(w, d, OT.terra, 0, h + 0.2, 0));
  return g;
}

function chapel(w, d) {
  const g = new THREE.Group();
  g.add(box(w, 3.4, d, 0xf7f3e8, 0, 1.7, 0));
  g.add(box(w + 0.3, 0.3, d + 0.3, OT.stoneDark, 0, 3.55, 0));
  const dome = sph(1.4, OT.terra, 0, 3.7, 0);
  dome.scale.y = 0.8;
  g.add(dome);
  g.add(box(0.1, 0.7, 0.1, 0xe8a33d, 0, 5.1, 0));
  g.add(box(0.4, 0.1, 0.1, 0xe8a33d, 0, 5.1, 0));
  g.add(box(1.1, 2.0, 0.15, OT.iron, 0, 1.0, d / 2 + 0.04));
  g.add(archTop(0.55, OT.iron, 0, 2.0, d / 2 + 0.04));
  const rose = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 14),
    new THREE.MeshStandardMaterial({ color: 0x3e7cb1, roughness: 0.4, emissive: 0x3e7cb1, emissiveIntensity: 0.3 }),
  );
  rose.position.set(0, 2.9, d / 2 + 0.05);
  g.add(rose);
  g.add(box(0.5, 1.0, 0.1, 0x2e4a5e, -w / 4, 1.4, d / 2 + 0.04));
  g.add(box(0.5, 1.0, 0.1, 0x2e4a5e, w / 4, 1.4, d / 2 + 0.04));
  return g;
}

// Palazzo del Podestà — the old town's hero: arcaded loggia, two
// floors, crenellated parapet, terracotta roof behind it.
function palazzo(w, d) {
  const g = new THREE.Group();
  g.add(box(w, 3.0, d, OT.stone, 0, 1.5, 0));
  for (let i = -2; i <= 2; i++) {
    const ax = (i * w) / 5;
    g.add(box(0.4, 3.0, 0.4, OT.stoneDark, ax - w / 10, 1.5, d / 2 + 0.1));
    g.add(box(0.4, 3.0, 0.4, OT.stoneDark, ax + w / 10, 1.5, d / 2 + 0.1));
    g.add(archTop(w / 10 - 0.08, OT.iron, ax, 2.3, d / 2 + 0.12));
    g.add(box(w / 5 - 0.5, 1.9, 0.1, OT.iron, ax, 0.95, d / 2 + 0.08));
  }
  g.add(box(w + 0.2, 0.35, d + 0.2, OT.stoneDark, 0, 3.15, 0));
  g.add(box(w, 2.6, d * 0.94, OT.plaster, 0, 4.6, 0));
  for (let i = -2; i <= 2; i++) {
    const wx = (i * w) / 5;
    g.add(box(0.7, 1.2, 0.1, OT.iron, wx, 4.6, d * 0.47 + 0.02));
    g.add(box(0.24, 1.2, 0.06, OT.shutter, wx - 0.5, 4.6, d * 0.47 + 0.04));
    g.add(box(0.24, 1.2, 0.06, OT.shutter, wx + 0.5, 4.6, d * 0.47 + 0.04));
    g.add(box(1.4, 0.12, 0.8, OT.iron, wx, 3.85, d * 0.47 + 0.4));
  }
  // Crenellated parapet.
  g.add(box(w + 0.2, 0.3, d + 0.2, OT.stoneDark, 0, 6.05, 0));
  for (let i = 0; i < 8; i++) {
    g.add(box(0.45, 0.5, 0.45, OT.stone, -w / 2 + 0.4 + i * (w - 0.8) / 7, 6.45, d / 2 + 0.05));
  }
  g.add(pitchedRoof(w * 0.8, d * 0.8, OT.terra, 0, 6.2, 0));
  // The Podestà's banner: terracotta flag on a pole.
  g.add(cyl(0.05, 0.05, 2.2, OT.iron, w * 0.3, 7.3, 0, 6));
  g.add(box(0.9, 0.55, 0.04, OT.terra, w * 0.3 + 0.45, 8.0, 0));
  return g;
}

// Fortress wall segment with crenellations + a bastion tower.
function fortressWall(x0, x1, z) {
  const g = new THREE.Group();
  const w = x1 - x0;
  g.add(box(w, 5, 1.2, OT.stone, (x0 + x1) / 2, 2.5, z));
  g.add(box(w, 0.4, 1.6, OT.stoneDark, (x0 + x1) / 2, 5.2, z));
  for (let x = x0 + 0.8; x <= x1 - 0.5; x += 1.6) {
    g.add(box(0.6, 0.7, 1.3, OT.stone, x, 5.75, z));
  }
  return g;
}
function bastion(x, z) {
  const g = new THREE.Group();
  g.add(cyl(2.5, 2.8, 7, OT.stone, x, 3.5, z, 14));
  g.add(cyl(2.7, 2.7, 0.5, OT.stoneDark, x, 7.2, z, 14));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.5, 0.6, 0.5, OT.stone, x + Math.cos(a) * 2.5, 7.7, z + Math.sin(a) * 2.5));
  }
  g.add(box(0.8, 1.0, 0.15, OT.iron, x, 2.0, z + 2.55));
  g.add(cone(0.5, 0.8, 0xe8a33d, x, 5.5, z + 2.5, 8));
  return g;
}

// Laundry line strung across an alley: rope + three cloth pieces.
function laundryLine(x0, z0, x1, z1, y) {
  const g = new THREE.Group();
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const rope = cyl(0.02, 0.02, len, 0xefe3c8, (x0 + x1) / 2, y, (z0 + z1) / 2, 6);
  rope.rotation.z = Math.PI / 2;
  rope.rotation.y = -Math.atan2(dz, dx);
  g.add(rope);
  const cols = [0xc93a6b, 0xf2f0ea, 0x3e7cb1];
  for (let i = 0; i < 3; i++) {
    const t = 0.25 + i * 0.25;
    const cx = x0 + dx * t, cz = z0 + dz * t;
    const cloth = box(0.4, 0.55, 0.03, cols[i], cx, y - 0.28, cz);
    cloth.rotation.y = -Math.atan2(dz, dx);
    g.add(cloth);
  }
  return g;
}

export function buildOldTown() {
  const rnd = seededRandom(20261121);
  const group = new THREE.Group();
  group.name = 'oldTown';
  const colliders = [];
  const tickers = [];

  // --- cobble streets (main street + two cross streets north) ---
  const cobTex = roadTexture('cobble', 31);
  cobTex.repeat.set(8, 1);
  const cobMat = new THREE.MeshStandardMaterial({ map: cobTex, roughness: 0.95, flatShading: true });
  const main = new THREE.Mesh(new THREE.BoxGeometry(58, 0.3, 7), cobMat);
  main.position.set(-29, 0.06, -56); // top y 0.21 — a hair above the cross streets, no z-fight
  group.add(main);
  const crossTex = roadTexture('cobble', 32);
  crossTex.repeat.set(1, 6);
  const crossMat = new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.95, flatShading: true });
  for (const cx of [-40, -20]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 44), crossMat);
    s.position.set(cx, 0.05, -64); // z -86..-42, meets the D4 cross streets at -42
    group.add(s);
  }
  // Plaza (light pavers) with the fountain.
  const plazaTex = roadTexture('plaza', 33);
  plazaTex.repeat.set(2, 2);
  const plazaMat = new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.95, flatShading: true });
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 12), plazaMat);
  plaza.position.set(-29, 0.055, -70);
  group.add(plaza);
  const pf = fountain(1.1);
  pf.position.set(-29, 0.2, -70);
  group.add(pf);
  tickers.push(pf);
  // Sidewalks along the main street.
  const swMat = new THREE.MeshStandardMaterial({ color: 0xc9bfa8, roughness: 0.95, flatShading: true });
  for (const sz of [-60.5, -51.5]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(58, 0.24, 2), swMat);
    sw.position.set(-29, 0.12, sz);
    group.add(sw);
  }
  // Stair-streets: shallow steps from the main street up to the plaza.
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xbfa06e, roughness: 0.95, flatShading: true });
  for (const sx of [-32, -8]) {
    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.0), stepMat);
      st.position.set(sx, 0.08 + i * 0.16, -59.5 - i * 1.0);
      group.add(st);
    }
  }

  // --- buildings (merged, one draw call per material) ---
  const buildings = new THREE.Group();
  const collidersLocal = [];
  const addPlot = (x, z, w, d, builder, ry = 0) => {
    const b = builder();
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    buildings.add(b);
    collidersLocal.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, id: 'oldtown' });
  };
  // Palazzo (hero) west of the plaza; chapel north of it.
  addPlot(-45, -70, 8, 12, () => palazzo(8, 12));
  addPlot(-29, -81, 8, 6, () => chapel(8, 6));
  // North row: arcade houses + townhouse.
  addPlot(-52, -80, 8, 6, () => arcadeHouse(8, 6, 6.5));
  addPlot(-12, -80, 10, 6, () => arcadeHouse(10, 6, 6));
  addPlot(-12, -70, 6, 10, () => townhouse(6, 10, 5.5));
  // West block townhouse; south row stair-houses.
  addPlot(-52, -66, 8, 8, () => townhouse(8, 8, 5.5));
  addPlot(-52, -47, 8, 6, () => stairHouse(8, 6, 5.5));
  addPlot(-30, -47, 8, 6, () => stairHouse(8, 6, 6));
  addPlot(-8, -47, 8, 6, () => stairHouse(8, 6, 5.5));
  group.add(mergeStatic(buildings));
  colliders.push(...collidersLocal);

  // --- fortress wall + bastions along the north edge ---
  const wall = new THREE.Group();
  wall.add(fortressWall(-58, -2, -86));
  wall.add(bastion(-56, -86));
  wall.add(bastion(-2, -86));
  group.add(mergeStatic(wall));
  colliders.push({ x0: -58, z0: -87.4, x1: 0, z1: -84.6, id: 'fortress-wall' });
  colliders.push({ x0: -58.8, z0: -88.8, x1: -53.2, z1: -83.2, id: 'bastion' });
  colliders.push({ x0: -4.8, z0: -88.8, x1: 0.8, z1: -83.2, id: 'bastion' });

  // --- laundry lines across the alleys + iron lamps ---
  const lines = new THREE.Group();
  lines.add(laundryLine(-37, -66, -21, -66, 3.4));
  lines.add(laundryLine(-37, -74, -21, -74, 3.2));
  lines.add(laundryLine(-48, -73, -40, -73, 3.0));
  lines.add(laundryLine(-17, -73, -9, -73, 3.2));
  group.add(lines);
  for (const lx of [-54, -36, -18, -6]) {
    const lamp = lampPost(lx, -60.8);
    group.add(lamp);
    const lamp2 = lampPost(lx + 4, -51.2);
    group.add(lamp2);
  }
  // Cypress trees in the wall's green strip (never on a road).
  const cypress = [];
  for (let i = 0; i < 6; i++) {
    const t = makeTree('cypress', 1.4 + rnd() * 0.8);
    t.position.set(-54 + i * 10 + rnd() * 2, 0, -84.5);
    group.add(t);
  }

  // --- traffic lanes + pedestrian paths ---
  const lanes = [
    { name: 'oldtown-main', pts: loopPath(-56, -58.5, -2, -53.5, 2), speed: 6 },
    { name: 'oldtown-plaza', pts: loopPath(-36, -75, -22, -65, 2), speed: 5 },
  ];
  const pedPaths = [
    { a: { x: -56, z: -51.5 }, b: { x: -4, z: -51.5 } },
    { a: { x: -56, z: -60.5 }, b: { x: -4, z: -60.5 } },
    { a: { x: -40, z: -84 }, b: { x: -40, z: -46 } },
    { a: { x: -20, z: -84 }, b: { x: -20, z: -46 } },
    { a: { x: -36, z: -77 }, b: { x: -22, z: -77 } },
    { a: { x: -36, z: -63 }, b: { x: -22, z: -63 } },
  ];
  return { group, colliders, lanes, pedPaths, tickers };
}

// ---------- (b) Seaside Promenade & Casino ----------
// Cream #F3E6C8, deco gold #E8A33D, neon pink #FF5C8A, neon cyan
// #3ED6D6, palm green #3F7A4E, sea blue #2E7F8F. Art Deco facades with
// stepped crowns, curved corners, neon signs, striped awnings; a wide
// palm-lined esplanade; the Casino Azzura hero with a fountain
// forecourt; the Grand Hotel Azzura tower at the east end. The
// boulevard + quay continue east from District 4 (x 60..108).
const PR = {
  cream: 0xf3e6c8, gold: 0xe8a33d, pink: 0xff5c8a, cyan: 0x3ed6d6,
  palm: 0x3f7a4e, sea: 0x2e7f8f, ink: 0x2b2b2b, white: 0xf7f3e8,
  peach: 0xf2c49b, mint: 0xa8cbb0,
};

// Emissive neon bar (a sign, no text geometry in this engine).
function neonBar(w, h, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.15),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.9, roughness: 0.4 }),
  );
  m.position.set(x, y, z);
  return m;
}

// Art Deco facade: cream slab, stepped gold crown, gold fins, dark
// glass window grid, neon sign bar, striped awning over the ground
// floor. Built facing +z (toward the boulevard / the water).
function decoFacade(w, d, h, accent) {
  const g = new THREE.Group();
  g.add(box(w, h, d, PR.cream, 0, h / 2, 0));
  g.add(box(w * 0.8, 0.8, d * 0.8, PR.gold, 0, h + 0.4, 0));
  g.add(box(w * 0.55, 0.7, d * 0.55, PR.cream, 0, h + 1.15, 0));
  for (const fx of [-w / 4, 0, w / 4]) {
    g.add(box(0.25, h * 0.7, 0.12, PR.gold, fx, h * 0.35 + 0.6, d / 2 + 0.04));
  }
  for (let r = 0; r < 2; r++) {
    for (let i = -1; i <= 1; i++) {
      g.add(box(0.9, 1.2, 0.08, PR.ink, (i * w) / 3, 1.8 + r * (h / 2.4), d / 2 + 0.03));
    }
  }
  g.add(neonBar(w * 0.6, 0.4, accent, 0, h - 0.9, d / 2 + 0.08));
  for (let i = 0; i < 5; i++) {
    const c = i % 2 === 0 ? PR.pink : PR.cream;
    const s = box(w / 5, 0.08, 1.1, c, -w / 2 + (i + 0.5) * (w / 5), 2.6, d / 2 + 0.55);
    s.rotation.x = 0.35;
    g.add(s);
  }
  g.add(box(w * 0.5, 0.5, 0.1, PR.gold, 0, 3.3, d / 2 + 0.06));
  return g;
}

// Casino Azzura — the promenade hero: 12 m hall with a curved corner
// tower, stepped gold crown, pink neon vertical sign + cyan band,
// striped awning over the entrance, fountain forecourt in front.
function casinoAzzura() {
  const g = new THREE.Group();
  g.add(box(12, 6, 14, PR.cream, 0, 3, 0));
  g.add(cyl(3.0, 3.0, 9, PR.cream, 5.2, 4.5, 5.5, 20));
  g.add(box(10, 0.9, 12, PR.gold, 0, 6.45, 0));
  g.add(box(7, 0.8, 9, PR.cream, 0, 7.3, 0));
  g.add(box(4, 0.7, 6, PR.gold, 0, 8.05, 0));
  // Pink neon vertical sign on the tower's south face + cyan band.
  g.add(neonBar(0.5, 4.2, PR.pink, 5.2, 6.5, 8.6));
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(3.15, 3.15, 0.5, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: PR.cyan, emissive: PR.cyan, emissiveIntensity: 1.8, roughness: 0.4, side: THREE.DoubleSide }),
  );
  band.position.set(5.2, 7.8, 5.5);
  g.add(band);
  // Window grid on the hall front + gold fins.
  for (let i = -2; i <= 2; i++) {
    if (i === 2) continue; // the tower owns the east corner
    g.add(box(0.9, 1.6, 0.08, PR.ink, i * 2.2, 2.2, 7.03));
    g.add(box(0.9, 1.2, 0.08, PR.ink, i * 2.2, 4.4, 7.03));
  }
  for (const fx of [-4.4, -2.2, 0, 2.2]) {
    g.add(box(0.25, 4.2, 0.12, PR.gold, fx, 3.0, 7.04));
  }
  // Striped awning over the entrance.
  for (let i = 0; i < 6; i++) {
    const c = i % 2 === 0 ? PR.pink : PR.cream;
    const s = box(1.6, 0.08, 1.4, c, -4 + i * 1.6, 2.7, 7.7);
    s.rotation.x = 0.35;
    g.add(s);
  }
  // Entrance doors + gold brand plate.
  g.add(box(2.2, 2.4, 0.12, PR.ink, 0, 1.2, 7.05));
  g.add(box(4.5, 0.5, 0.1, PR.gold, 0, 3.4, 7.08));
  return g;
}

// Grand Hotel Azzura — tall stepped deco tower at the east end.
function hotelAzzura() {
  const g = new THREE.Group();
  g.add(box(10, 6, 14, PR.cream, 0, 3, 0));
  g.add(box(8, 4, 11, PR.white, 0, 8, 0));
  g.add(box(6, 3.5, 8, PR.cream, 0, 11.75, 0));
  g.add(box(4, 0.8, 5, PR.gold, 0, 13.9, 0));
  // Gold fins + window grid on every tier.
  for (const fx of [-3.5, 0, 3.5]) {
    g.add(box(0.25, 4.5, 0.12, PR.gold, fx, 3.2, 7.04));
  }
  for (let r = 0; r < 2; r++) {
    for (let i = -1; i <= 1; i++) {
      g.add(box(0.9, 1.2, 0.08, PR.ink, i * 3, 2.0 + r * 2.2, 7.03));
    }
  }
  for (let r = 0; r < 2; r++) {
    for (let i = -1; i <= 1; i++) {
      g.add(box(0.8, 1.1, 0.08, PR.ink, i * 2.5, 7.2 + r * 2.0, 5.53));
    }
  }
  // Neon crown: pink bar + cyan bar on the top tier.
  g.add(neonBar(3.2, 0.45, PR.pink, 0, 12.6, 4.06));
  g.add(neonBar(2.4, 0.4, PR.cyan, 0, 13.4, 2.56));
  // Striped awning + entrance.
  for (let i = 0; i < 5; i++) {
    const c = i % 2 === 0 ? PR.cyan : PR.cream;
    const s = box(1.8, 0.08, 1.3, c, -3.6 + i * 1.8, 2.6, 7.65);
    s.rotation.x = 0.35;
    g.add(s);
  }
  g.add(box(2.0, 2.4, 0.12, PR.ink, 0, 1.2, 7.05));
  return g;
}

// Pastel deco villa for the back row: flat roof, rounded corner,
// gold trim, small neon bar.
function decoVilla(w, d, h, color) {
  const g = new THREE.Group();
  g.add(box(w, h, d, color, 0, h / 2, 0));
  g.add(cyl(1.6, 1.6, h, color, w / 2 - 0.4, h / 2, d / 2 - 0.4, 14));
  g.add(box(w + 0.3, 0.35, d + 0.3, PR.gold, 0, h + 0.15, 0));
  for (const wx of [-w / 4, w / 4]) {
    g.add(box(0.8, 1.2, 0.08, PR.ink, wx, 1.8, d / 2 + 0.03));
    g.add(box(0.8, 1.0, 0.08, PR.ink, wx, 3.4, d / 2 + 0.03));
  }
  g.add(neonBar(w * 0.5, 0.35, PR.cyan, 0, h - 0.6, d / 2 + 0.08));
  return g;
}

export function buildPromenade() {
  const rnd = seededRandom(20261121);
  const group = new THREE.Group();
  group.name = 'promenade';
  const colliders = [];
  const tickers = [];

  // --- road surfaces (the D4 network stops at x 60; the promenade
  // lays its own, like the old town did) ---
  const surf = (texName, seed, w, d, x, z, y, rx, rz) => {
    const tex = roadTexture(texName, seed);
    tex.repeat.set(rx, rz);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, flatShading: true });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), mat);
    m.position.set(x, y, z);
    group.add(m);
  };
  // Boulevard extension (asphalt) + esplanade + south walkway (light
  // pavers) + quay boardwalk at the water edge.
  surf('asphalt', 41, 48, 12, 84, 0, 0.05, 6, 2);
  surf('plaza', 42, 48, 8, 84, -10, 0.12, 6, 1);
  surf('plaza', 44, 48, 2.5, 84, 7.25, 0.12, 6, 1);
  surf('boardwalk', 43, 48, 4.5, 84, 10.75, 0.05, 6, 1);

  // --- buildings (merged, one draw call per material) ---
  const buildings = new THREE.Group();
  const collidersLocal = [];
  const addPlot = (x, z, w, d, builder) => {
    const b = builder();
    b.position.set(x, 0, z);
    buildings.add(b);
    collidersLocal.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, id: 'promenade' });
  };
  // Front row (z -28..-14): deco row, Casino Azzura hero, hotel tower.
  addPlot(66, -21, 8, 14, () => decoFacade(8, 14, 7, PR.pink));
  addPlot(76, -21, 8, 14, () => decoFacade(8, 14, 8, PR.cyan));
  addPlot(88, -21, 12, 14, () => casinoAzzura());
  addPlot(101, -21, 10, 14, () => hotelAzzura());
  // Back row (z -40..-31): pastel deco villas.
  addPlot(68, -35.5, 8, 9, () => decoVilla(8, 9, 5, PR.peach));
  addPlot(100, -35.5, 8, 9, () => decoVilla(8, 9, 5.5, PR.mint));
  group.add(mergeStatic(buildings));
  colliders.push(...collidersLocal);

  // --- fountains: casino forecourt (hero) + hotel forecourt ---
  const f1 = fountain(1.4);
  f1.position.set(88, 0.24, -10);
  group.add(f1);
  tickers.push(f1);
  const f2 = fountain(0.9);
  f2.position.set(101, 0.24, -10);
  group.add(f2);
  tickers.push(f2);
  colliders.push({ x0: 86.8, z0: -11.2, x1: 89.2, z1: -8.8, id: 'casino-fountain' });
  colliders.push({ x0: 100.1, z0: -10.9, x1: 101.9, z1: -9.1, id: 'hotel-fountain' });

  // --- palms (fuller makePalmFull, not the starburst classic) along
  // the esplanade + the quay; lamps on both walks ---
  for (const [px, pz, s] of [
    [64, -8, 1.2], [76, -8, 1.0], [94, -8, 1.3], [104, -8, 1.1],
    [66, 12, 1.1], [78, 12, 1.25], [90, 12, 1.0], [102, 12, 1.2],
  ]) {
    const p = makePalmFull(2.2 + s * 1.2);
    p.position.set(px, 0.24, pz);
    p.rotation.y = rnd() * Math.PI * 2;
    group.add(p);
  }
  for (const lx of [68, 80, 92, 104]) {
    group.add(lampPost(lx, -7));
  }
  for (const lx of [62, 74, 86, 98, 106]) {
    group.add(lampPost(lx, 11.5));
  }

  // --- quay: bollards + cleats + moored sailboats on the water ---
  const quayProps = new THREE.Group();
  for (let x = 62; x <= 106; x += 4) {
    quayProps.add(cyl(0.18, 0.22, 0.7, PR.sea, x, 0.35, 12.6, 8));
  }
  for (const cx of [66, 82, 98]) {
    quayProps.add(box(0.9, 0.25, 0.4, PR.ink, cx, 0.3, 12.6));
  }
  group.add(mergeStatic(quayProps));
  for (const [sx, sz, sc] of [[70, 18, 1.0], [98, 18, 1.2]]) {
    const boat = sailboat(sc, 0xf2f0ea, sx);
    boat.position.set(sx, 0, sz);
    group.add(boat);
  }

  // --- traffic lanes + pedestrian paths ---
  const lanes = [
    { name: 'promenade-boulevard', pts: loopPath(62, -4, 106, 4, 2), speed: 7 },
    { name: 'promenade-west', pts: loopPath(62, -4, 84, 4, 2), speed: 6 },
  ];
  const pedPaths = [
    { a: { x: 62, z: -8 }, b: { x: 106, z: -8 } },
    { a: { x: 62, z: 7.2 }, b: { x: 106, z: 7.2 } },
    { a: { x: 62, z: 11 }, b: { x: 106, z: 11 } },
    { a: { x: 88, z: -28 }, b: { x: 88, z: -7 } },
    { a: { x: 70, z: -28 }, b: { x: 70, z: -7 } },
    { a: { x: 101, z: -28 }, b: { x: 101, z: -7 } },
  ];
  return { group, colliders, lanes, pedPaths, tickers };
}

// ---------- combined builder (grows as districts land) ----------
export function buildNewDistricts() {
  const group = new THREE.Group();
  group.name = 'newDistricts';
  const colliders = [];
  const lanes = [];
  const pedPaths = [];
  const tickers = [];
  const ot = buildOldTown();
  group.add(ot.group);
  colliders.push(...ot.colliders);
  lanes.push(...ot.lanes);
  pedPaths.push(...ot.pedPaths);
  tickers.push(...ot.tickers);
  const pr = buildPromenade();
  group.add(pr.group);
  colliders.push(...pr.colliders);
  lanes.push(...pr.lanes);
  pedPaths.push(...pr.pedPaths);
  tickers.push(...pr.tickers);
  return { group, colliders, lanes, pedPaths, tickers };
}
