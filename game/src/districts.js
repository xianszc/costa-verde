// AZZURA HEIST — M3 districts (old town, promenade east).
// Each district is built in its own vocabulary from GAME_BIBLE.md and
// added to the map by city.js (buildDistrict4 merges the result). All
// zones share the same rules as District 4: roads FIRST, plots
// validated against road/sidewalk rects, trees only in green zones,
// colliders for every solid prop, traffic lanes + pedestrian paths per
// district. The map grows north (old town, z -44..-86) and east
// (promenade extension, x 60..108); the old skyline across the bay was
// removed in stage 1 (the CBD core is the downtown now).
import * as THREE from '../vendor/three.module.min.js';
import {
  M, box, cyl, cone, sph, archTop, mergedMesh, mergeStatic, colored,
  xform, vertexColorMat, fountain, lampRow, treeInstanced, sailboat,
} from './world.js';
import { roadTexture, seededRandom } from './roads.js';
import { palmInstanced } from './vegetation.js';

// Ground height for the player / pedestrians.
// STAGE 1: the ground is FLAT everywhere (y 0). The old skyline
// landmass across the bay and its bridge are removed — the bay is open
// water now, and the terrain grading comes in stage 2.
export function groundHeightAt(x, z) {
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
// Fortress wall segment running north-south (the old town's west wall).
function fortressWallNS(z0, z1, x) {
  const g = new THREE.Group();
  const w = z1 - z0;
  g.add(box(1.2, 5, w, OT.stone, x, 2.5, (z0 + z1) / 2));
  g.add(box(1.6, 0.4, w, OT.stoneDark, x, 5.2, (z0 + z1) / 2));
  for (let z = z0 + 0.8; z <= z1 - 0.5; z += 1.6) {
    g.add(box(1.3, 0.7, 0.6, OT.stone, x, 5.75, z));
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
  // STAGE 1 part 4: the old town is a compact historic pocket on the
  // commercial ring (x -60..-34, z -52..-26) — the old quarter
  // (z -44..-86, 9 buildings spread over 56x44) was too big, too far
  // north, and sat in the hills / stage-2 land. The pocket keeps the
  // same vocabulary (cobble streets, arcaded houses, stair-streets,
  // laundry lines, chapel, palazzo, fortress wall + bastions) at a
  // denser grain: narrow streets, continuous frontage. The bell tower
  // (city.js, at (-47,-36)) is the pocket's south gate.
  const rnd = seededRandom(20261121);
  const group = new THREE.Group();
  group.name = 'oldTown';
  const colliders = [];
  const tickers = [];

  // --- cobble streets: main street east-west + 4 cross streets ---
  // ITEM 2 (D): the pocket grows west to x -72, so the main street
  // runs x -70..-36. The cross streets (2 wide, narrow alleys) sit
  // IN the gaps between the house columns (columns 5 apart, houses
  // 3 wide) so no house stands on a street — the first version put
  // 3-wide streets on top of 3-wide house columns.
  const cobTex = roadTexture('cobble', 31);
  cobTex.repeat.set(6, 1);
  const cobMat = new THREE.MeshStandardMaterial({ map: cobTex, roughness: 0.95, flatShading: true });
  const main = new THREE.Mesh(new THREE.BoxGeometry(36, 0.3, 7), cobMat);
  main.position.set(-53, 0.06, -39);
  group.add(main);
  const crossTex = roadTexture('cobble', 32);
  crossTex.repeat.set(1, 3);
  const crossMat = new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.95, flatShading: true });
  for (const cx of [-67.5, -57.5, -47.5, -37.5]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 22), crossMat);
    s.position.set(cx, 0.05, -39);
    group.add(s);
  }
  // Plaza (light pavers) with the fountain, on the main street.
  const plazaTex = roadTexture('plaza', 33);
  plazaTex.repeat.set(2, 2);
  const plazaMat = new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.95, flatShading: true });
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 8), plazaMat);
  plaza.position.set(-47, 0.055, -39);
  group.add(plaza);
  const pf = fountain(1.1);
  pf.position.set(-47, 0.2, -39);
  group.add(pf);
  tickers.push(pf);
  // Sidewalks along the main street.
  const swMat = new THREE.MeshStandardMaterial({ color: 0xc9bfa8, roughness: 0.95, flatShading: true });
  for (const sz of [-43.5, -34.5]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(36, 0.24, 2), swMat);
    sw.position.set(-53, 0.12, sz);
    group.add(sw);
  }
  // Stair-street: shallow steps from the main street up to the wall
  // walk (north), at the middle of the pocket.
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xbfa06e, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.0), stepMat);
    st.position.set(-47, 0.08 + i * 0.16, -42.5 - i * 1.0);
    group.add(st);
  }

  // --- buildings (merged, one draw call per material) ---
  // ITEM 2 (D): the pocket grows west to x -72 (empty land between
  // the old town and the west boundary — no commercial block is
  // taken) and the houses shrink to 3x3 on a tight grid (11 columns
  // x 5 rows, 3.5 apart, narrow alleys between them) so the old
  // town reads as a dense historic quarter instead of 14 scattered
  // plots. Reserved rects (palazzo, chapel, plaza, bell tower) are
  // never built on; the bell tower at (-47,-36) is an M4 drop point.
  const buildings = new THREE.Group();
  const collidersLocal = [];
  const addPlot = (x, z, w, d, builder, ry = 0) => {
    const b = builder();
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    buildings.add(b);
    collidersLocal.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, id: 'oldtown' });
  };
  // Palazzo (hero) at the west end of the main street, facing east
  // toward the plaza; chapel north of the plaza, facing south.
  addPlot(-68, -39, 8, 10, () => palazzo(8, 10), Math.PI / 2);
  addPlot(-47, -48, 8, 6, () => chapel(8, 6), Math.PI);
  // Reserved rects (x0,z0,x1,z1) — no house may intersect them.
  const reserved = [
    { x0: -72, z0: -44, x1: -64, z1: -34 }, // palazzo
    { x0: -51, z0: -51, x1: -43, z1: -45 }, // chapel
    { x0: -52, z0: -43, x1: -42, z1: -35 }, // plaza + fountain
    { x0: -49, z0: -38, x1: -45, z1: -34 }, // bell tower (M4)
  ];
  const overlapsReserved = (x, z, w, d) => reserved.some((r) =>
    x - w / 2 < r.x1 && x + w / 2 > r.x0 && z - d / 2 < r.z1 && z + d / 2 > r.z0);
  // Houses: a tight grid (3x3, columns 5 apart so the 2-wide cross
  // streets fit in the gaps) in 5 rows — two north of the main
  // street (z -49, -45), three south (z -35, -31, -27). North rows
  // face south (toward the main street), south rows face north.
  // SETBACK (step B): the south row is 3x2 at z -28.5 (see the loop
  // below) — its old 3x3 plots at z -27 sat ON the ring road (z -26)
  // and blocked the car route to the old town.
  const houseBuilders = [
    () => arcadeHouse(3, 3, 5.5), () => townhouse(3, 3, 5),
    () => stairHouse(3, 3, 5), () => arcadeHouse(3, 3, 6),
  ];
  const pick = (i) => houseBuilders[(i + Math.floor(rnd() * 2)) % houseBuilders.length];
  // South-row builders (setback, step B): 3 wide x 2 deep, arcade /
  // townhouse only — the stairHouse's front steps project 2u and
  // would clip into the row behind (the rows are flush here).
  const southBuilders = [
    () => arcadeHouse(3, 2, 5.5), () => townhouse(3, 2, 5),
    () => arcadeHouse(3, 2, 6),
  ];
  const pickSouth = (i) => southBuilders[(i + Math.floor(rnd() * 2)) % southBuilders.length];
  let hi = 0;
  let si = 0;
  for (const hz of [-49, -45, -35, -31, -27]) {
    for (let hx = -70; hx <= -35; hx += 5) {
      // SETBACK (step B): the south row (hz -27) straddled the ring
      // road (z -26) — its 3x3 plots sat ON the road centreline (the
      // phantom road) and left no sidewalk; the car wedged at the
      // (-44,-25) junction because the house at x -46.5..-43.5,
      // z -28.5..-25.5 left only a 0.04u slot (routes.mjs 9/10).
      // The row moves back to z -28.5 as 3x2 houses (south face
      // -27.5, a 0.5 sidewalk to the road's north edge -27); the -31
      // row stays, so the rows are flush (attached terrace houses,
      // authentic for a dense old town). Three 3-deep rows cannot
      // fit the 8.5u south block with any setback, so the south row
      // is the one that shrinks.
      const isSouth = hz === -27;
      const depth = isSouth ? 2 : 3;
      const z = isSouth ? -28.5 : hz;
      if (overlapsReserved(hx, z, 3, depth)) continue;
      const builder = isSouth ? pickSouth(si++) : pick(hi++);
      // GAME fix (M10 race, 22 Nov ~08:20): the (-35,-45) house stood
      // ON the VIA DEL NORD / ring-avenue junction — its 3x3 plot
      // (x -36.5..-33.5, z -46.5..-43.5) covered the exact corner
      // where the minimap graph joins the two streets, so the race
      // car driving west stalled at (-33,-44.8) against its east
      // face (ejection scan + top-down shot proved it). The corner
      // stays open so the streets really connect. The builder is
      // picked before the skip so the seeded sequence for the
      // remaining houses is unchanged.
      if (hx === -35 && hz === -45) continue;
      // The wall row and the two north rows face the main street
      // (south); the three south rows face it too (north).
      addPlot(hx, z, 3, depth, builder, hz < -39 ? 0 : Math.PI);
    }
  }
  group.add(mergeStatic(buildings, [], { unifyStandard: true }));
  colliders.push(...collidersLocal);

  // --- fortress wall + bastions along the north edge (z -52) ---
  // Gaps at the cross streets (x -67.5, -57.5, -47.5, -37.5) are the
  // north doors. ITEM 2 (D): the wall runs the full expanded pocket
  // (x -72..-34); the bastions stay at x -59 / -35 (the west corner
  // is too close to the ring's west boundary street for a bastion).
  const wall = new THREE.Group();
  wall.add(fortressWall(-72, -68.5, -52));
  wall.add(fortressWall(-66.5, -58.5, -52));
  wall.add(fortressWall(-56.5, -48.5, -52));
  wall.add(fortressWall(-46.5, -38.5, -52));
  wall.add(fortressWall(-36.5, -34, -52));
  wall.add(bastion(-59, -52));
  wall.add(bastion(-35, -52));
  group.add(mergeStatic(wall, [], { unifyStandard: true }));
  colliders.push({ x0: -72, z0: -53.4, x1: -68.5, z1: -50.6, id: 'fortress-wall' });
  colliders.push({ x0: -66.5, z0: -53.4, x1: -58.5, z1: -50.6, id: 'fortress-wall' });
  colliders.push({ x0: -56.5, z0: -53.4, x1: -48.5, z1: -50.6, id: 'fortress-wall' });
  colliders.push({ x0: -46.5, z0: -53.4, x1: -38.5, z1: -50.6, id: 'fortress-wall' });
  colliders.push({ x0: -36.5, z0: -53.4, x1: -34, z1: -50.6, id: 'fortress-wall' });
  colliders.push({ x0: -61.8, z0: -54.8, x1: -56.2, z1: -49.2, id: 'bastion' });
  colliders.push({ x0: -37.8, z0: -54.8, x1: -32.2, z1: -49.2, id: 'bastion' });

  // --- laundry lines across the alleys + iron lamps ---
  const lines = new THREE.Group();
  lines.add(laundryLine(-50, -44, -44, -44, 3.4));
  lines.add(laundryLine(-50, -34, -44, -34, 3.2));
  lines.add(laundryLine(-56, -36, -56, -30, 3.0));
  lines.add(laundryLine(-38, -36, -38, -30, 3.2));
  lines.add(laundryLine(-68, -44, -62, -44, 3.4));
  lines.add(laundryLine(-68, -34, -62, -34, 3.2));
  // 2b draw-call cut: the lines are static — merge them by material
  // instead of one group per line.
  group.add(mergeStatic(lines, [], { unifyStandard: true }));
  // 2b draw-call cut (Xian 21 Nov 18:41): lampRow merges a whole row
  // into 2 meshes (poles + globes) instead of 2 meshes per lamp post.
  group.add(lampRow([-70, -60, -50, -40], -43.5));
  group.add(lampRow([-68, -58, -48, -38], -34.5));
  // Cypress trees in the wall's green strip (never on a road).
  // 2b draw-call cut: one InstancedMesh for the whole row.
  const cypressSpots = [];
  for (let i = 0; i < 6; i++) {
    cypressSpots.push({ x: -70 + i * 7 + rnd() * 2, z: -50.5, s: 1.4 + rnd() * 0.8, rot: rnd() * Math.PI * 2 });
  }
  group.add(treeInstanced('cypress', cypressSpots));

  // --- 2b (Xian 21 Nov 17:58): the old town grows west (x -96..-72,
  // z -80..-30) — the generator builds the terraced houses; this is
  // the fortress wall around the new quarter + its cobbled alleys.
  // North wall (z -80) with doors at the N-S alleys (x -95, -84, -73);
  // west wall (x -96) with a west gate at the main alley (z -42).
  // The E-W alleys run to x -70 so they join the pocket's main street.
  const wallW = new THREE.Group();
  wallW.add(fortressWall(-94, -85, -80));
  wallW.add(fortressWall(-83, -74, -80));
  wallW.add(fortressWallNS(-80, -43, -96));
  wallW.add(fortressWallNS(-41, -30, -96));
  wallW.add(bastion(-96, -80));
  wallW.add(bastion(-72, -80));
  group.add(mergeStatic(wallW, [], { unifyStandard: true }));
  colliders.push({ x0: -94, z0: -81.4, x1: -85, z1: -78.6, id: 'fortress-wall' });
  colliders.push({ x0: -83, z0: -81.4, x1: -74, z1: -78.6, id: 'fortress-wall' });
  colliders.push({ x0: -97.4, z0: -80, x1: -94.6, z1: -43, id: 'fortress-wall' });
  colliders.push({ x0: -97.4, z0: -41, x1: -94.6, z1: -30, id: 'fortress-wall' });
  colliders.push({ x0: -98.8, z0: -82.8, x1: -93.2, z1: -77.2, id: 'bastion' });
  colliders.push({ x0: -74.8, z0: -82.8, x1: -69.2, z1: -77.2, id: 'bastion' });
  // Cobble alleys: E-W along every block row, N-S along every column.
  const cobTexW = roadTexture('cobble', 34);
  cobTexW.repeat.set(12, 1);
  const cobEwMat = new THREE.MeshStandardMaterial({ map: cobTexW, roughness: 0.95, flatShading: true });
  const cobTexW2 = roadTexture('cobble', 35);
  cobTexW2.repeat.set(1, 25);
  const cobNsMat = new THREE.MeshStandardMaterial({ map: cobTexW2, roughness: 0.95, flatShading: true });
  for (const az of [-79, -70, -61, -52, -43, -34]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 2), cobEwMat);
    s.position.set(-83, 0.05, az);
    group.add(s);
  }
  for (const ax of [-95, -84, -73]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 50), cobNsMat);
    s.position.set(ax, 0.05, -55);
    group.add(s);
  }

  // --- traffic lanes + pedestrian paths ---
  const lanes = [
    { name: 'oldtown-main', pts: loopPath(-70, -41.5, -37, -36.5, 2), speed: 6 },
    { name: 'oldtown-plaza', pts: loopPath(-51, -42, -43, -36, 2), speed: 5 },
  ];
  const pedPaths = [
    // EW path on the ring avenue / old-town corridor's SOUTH sidewalk
    // (z -34.5, centre of the -35.5..-33.5 strip — the corridor's ONLY
    // real sidewalk). The old z -37.5 line ran on the main street
    // (road z -42.5..-35.5); the first fix moved it to z -43.5, but
    // that is ON the ring avenue (road z -45.5..-38.5) — the audit
    // still flagged it at 0.85. Same line as the path below; the pool
    // keeps both so peds distribute along the one real sidewalk.
    { a: { x: -70, z: -34.5 }, b: { x: -36, z: -34.5 } },
    { a: { x: -70, z: -34.5 }, b: { x: -36, z: -34.5 } },
    // STREET CLEANUP (22 Nov): the N-S cross-street paths below ran
    // down the cobble alleys (x -67.5/-57.5/-47.5/-35.5/-47) — the audit
    // counts the minimap alley lines as roads, so the paths read as
    // "on asphalt". Rerouted onto the south sidewalk (z -34.5, the
    // corridor's only real sidewalk); the alleys keep their cobble
    // slabs but no assigned ped path.
    { a: { x: -70, z: -34.5 }, b: { x: -36, z: -34.5 } },
    { a: { x: -70, z: -34.5 }, b: { x: -36, z: -34.5 } },
    { a: { x: -70, z: -34.5 }, b: { x: -36, z: -34.5 } },
    // NS paths on the ring connector's sidewalks: the old x -37.5 /
    // -42 lines ran ON the connector road (x -43.5..-36.5) — west
    // sidewalk centre -44.5, east sidewalk centre -35.5.
    { a: { x: -70, z: -34.5 }, b: { x: -36, z: -34.5 } },
    { a: { x: -52, z: -50 }, b: { x: -52, z: -28 } },
    { a: { x: -70, z: -34.5 }, b: { x: -36, z: -34.5 } },
    { a: { x: -44.5, z: -50 }, b: { x: -44.5, z: -28 } },
    { a: { x: -51, z: -37.5 }, b: { x: -43, z: -37.5 } },
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
  // STAGE 1 part 5: the promenade + casino + marina are rebuilt on the
  // v3 waterfront (x -30..60, z 14..35). The old promenade (x 60..108,
  // z -40..13 — the M3(b) extension east of District 4) is gone: its
  // boulevard extension, esplanade and quay are outside the v3 map,
  // and the Casino Azzura + Grand Hotel Azzura now stand on the
  // promenade row facing the bay, between the marina and the CBD.
  // Layout (all facing the bay, +z):
  //   casino row (z 14..28): 2 deco facades, Casino Azzura (35),
  //     Grand Hotel Azzura (52); the casino forecourt + fountain and
  //     the hotel forecourt + fountain on the walkway (z 28..31);
  //   promenade walkway (z 27..31, light pavers) + quay boardwalk
  //     (z 31..35, bollards + cleats + moored sailboats);
  //   marina (x -30..8): 3 piers into the water (z 30..38), boat sheds
  //     on the land side (z 22..26), the harbormaster pavilion at the
  //     marina's east end (2, 26).
  // The bay water starts at z 35 now (city.js moves the water plane);
  // the water collider in buildNewDistricts is split around the piers
  // so the pier corridors stay walkable.
  const rnd = seededRandom(20261121);
  const group = new THREE.Group();
  group.name = 'promenade';
  const colliders = [];
  const tickers = [];

  // --- surfaces: promenade walkway + quay boardwalk + marina apron ---
  const surf = (texName, seed, w, d, x, z, y, rx, rz) => {
    const tex = roadTexture(texName, seed);
    tex.repeat.set(rx, rz);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, flatShading: true });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), mat);
    m.position.set(x, y, z);
    group.add(m);
  };
  // Promenade walkway (light pavers, x -96..108, z 27..31) + quay
  // boardwalk (x -96..108, z 31..35) + marina apron / harbor road
  // (asphalt, x -36..8, z 22..27). ITEM 2 (D): the walkway + quay
  // extend east to x 72 with the promenade's east extension. 2b: the
  // walkway + quay run the whole waterfront (x -96..108) with the
  // promenade's east + west extensions; the apron extends west to
  // x -36 for the new boat shed at (-33, 24).
  surf('plaza', 42, 204, 4, 6, 29, 0.12, 26, 1);
  surf('boardwalk', 43, 204, 4, 6, 33, 0.05, 20, 1);
  surf('asphalt', 44, 44, 5, -14, 24.5, 0.05, 5, 1);

  // --- buildings (merged, one draw call per material) ---
  const buildings = new THREE.Group();
  const collidersLocal = [];
  const addPlot = (x, z, w, d, builder) => {
    const b = builder();
    b.position.set(x, 0, z);
    buildings.add(b);
    collidersLocal.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, id: 'promenade' });
  };
  // Casino row (facing the bay): two rows of small deco shops
  // (4 wide, 7 deep) with the Casino Azzura + Grand Hotel Azzura as
  // heroes spanning both rows. ITEM 2 (D): the old row was 4 big
  // buildings (8-12 wide) — too few for the 40 target. The row
  // extends east to x 72 (empty land east of the promenade) and the
  // walkway gets 4 kiosks.
  const decoAccents = [PR.pink, PR.cyan, PR.gold, PR.mint, PR.peach];
  let di = 0;
  for (const dz of [17.5, 24.5]) {
    for (let dx = 10; dx <= 70; dx += 4.5) {
      // Skip the heroes' footprints (casino x 29..41, hotel x 47..57).
      if (dx + 2 > 29 && dx - 2 < 41) continue;
      if (dx + 2 > 47 && dx - 2 < 57) continue;
      addPlot(dx, dz, 4, 7, () => decoFacade(4, 7, 5 + Math.floor(rnd() * 3), decoAccents[di++ % decoAccents.length]));
    }
  }
  addPlot(35, 21, 12, 14, () => casinoAzzura());
  addPlot(52, 21, 10, 14, () => hotelAzzura());
  // Walkway kiosks (ice cream, souvenirs, café, bait) on the
  // promenade walkway (z 29), between the palms.
  for (const [kx, kcol] of [[16, PR.pink], [30, PR.cyan], [44, PR.gold], [64, PR.mint]]) {
    addPlot(kx, 29, 3, 2.5, () => decoVilla(3, 2.5, 3, kcol));
  }
  // Marina boat sheds (facing the water).
  addPlot(-28, 24, 5, 5, () => decoVilla(5, 5, 3.5, PR.peach));
  addPlot(-19, 24, 5, 5, () => decoVilla(5, 5, 3.5, PR.mint));
  addPlot(-9, 24, 5, 5, () => decoVilla(5, 5, 3.5, PR.peach));
  addPlot(-24, 24, 6, 5, () => decoVilla(6, 5, 3.5, PR.peach));
  addPlot(-14, 24, 6, 5, () => decoVilla(6, 5, 3.5, PR.mint));
  // GAME fix (M11, 22 Nov): the shed at (-4, 24) is REMOVED — the
  // marina shed row (z 21.5..26.5) ran unbroken from x -35.5 to 3.5, so
  // a player on foot could never walk from the promenade to the quay;
  // the M11 escape stuck at (-6.7, 20.4), 14.2u from the quay. The gap
  // x -6.5..-1.5 (5u = 50 m) is the walkable path from the quay street
  // to the walkway and quay. The objective sits next to it.
  addPlot(1, 24, 5, 5, () => decoVilla(5, 5, 3.5, PR.mint));
  // 2b: one more shed west on the extended apron (-33, 24).
  addPlot(-33, 24, 5, 5, () => decoVilla(5, 5, 3.5, PR.mint));
  group.add(mergeStatic(buildings, [], { unifyStandard: true }));
  colliders.push(...collidersLocal);

  // --- fountains: casino forecourt (hero) + hotel forecourt ---
  // On the promenade walkway, in front of the casino / hotel fronts.
  const f1 = fountain(1.4);
  f1.position.set(35, 0.24, 30);
  group.add(f1);
  tickers.push(f1);
  const f2 = fountain(0.9);
  f2.position.set(52, 0.24, 30);
  group.add(f2);
  tickers.push(f2);
  colliders.push({ x0: 33.8, z0: 28.8, x1: 36.2, z1: 31.2, id: 'casino-fountain' });
  colliders.push({ x0: 51.1, z0: 29.1, x1: 52.9, z1: 30.9, id: 'hotel-fountain' });

  // --- palms (fuller makePalmFull, not the starburst classic) along
  // the walkway + the quay + the marina; lamps on both walks. Palms are
  // kept modest (scale ~1.4, was ~2.2) — the ~2.2 scale read as giant
  // green slabs with 6-8u canopies, 4-6x the street width (round-9
  // part C, Xian 23 Nov: palms ~0.7x). ---
  // 2b draw-call cut: one InstancedMesh for all 12 palms (static).
  const palmSpots = [
    [10, 28, 1.2], [20, 28, 1.0], [28, 28, 1.3], [44, 28, 1.1], [58, 28, 1.2],
    [12, 34, 1.1], [24, 34, 1.25], [40, 34, 1.0], [56, 34, 1.2],
    [-26, 28, 1.1], [-16, 28, 1.0], [-6, 28, 1.2],
  ];
  group.add(palmInstanced(palmSpots.map(([px, pz, s]) => ({ x: px, z: pz, s: 1.1 + s * 0.3, rot: rnd() * Math.PI * 2 }))));
  // 2b draw-call cut: lampRow merges each walk's lamps into 2 meshes.
  group.add(lampRow([12, 24, 36, 48, 58], 27.5));
  group.add(lampRow([-26, -14, -2, 10, 22, 34, 46, 58], 34.5));

  // --- marina piers (walkable, into the water) + quay props ---
  // The piers are wooden walkways on posts (top y 0.65, above the
  // water's wave crest at ~0.58); the water collider in
  // buildNewDistricts is split around them. The engine has no ground
  // height, so a walking player clips the pier edge visually — the
  // piers read as a walkway, not a wall. ITEM 2 (D): 6 piers now
  // (was 3) so the marina reads as a working harbour.
  const piers = new THREE.Group();
  for (const px of [-33, -28, -24, -19, -14, -9, -4, 2, 7]) {
    piers.add(box(2, 0.3, 8, 0x8a6a4a, px, 0.5, 34));
    piers.add(cyl(0.15, 0.18, 0.6, PR.sea, px - 0.7, 0.7, 37.5, 8));
    piers.add(cyl(0.15, 0.18, 0.6, PR.sea, px + 0.7, 0.7, 37.5, 8));
  }
  group.add(mergeStatic(piers, [], { unifyStandard: true }));
  // Quay bollards + cleats along the whole shore (x -96..108, 2b).
  const quayProps = new THREE.Group();
  for (let x = -96; x <= 108; x += 4) {
    quayProps.add(cyl(0.18, 0.22, 0.7, PR.sea, x, 0.35, 34.6, 8));
  }
  for (const cx of [-80, -60, -40, -20, 0, 20, 40, 60, 80, 92, 104]) {
    quayProps.add(box(0.9, 0.25, 0.4, PR.ink, cx, 0.3, 34.6));
  }
  group.add(mergeStatic(quayProps, [], { unifyStandard: true }));
  // Moored sailboats on the water (beyond the quay, z > 35). 2b: 13
  // boats now (was 7) so the harbour reads busy along the whole shore.
  const boatSpots = [[-33, 42, 1.0], [-26, 42, 1.0], [-20, 42, 1.0], [-10, 44, 1.2], [0, 42, 1.0], [10, 44, 1.2], [20, 42, 1.0], [30, 44, 1.1], [44, 42, 1.0], [52, 42, 1.0], [60, 44, 1.1], [70, 44, 1.0], [76, 42, 1.0]];
  for (const [sx, sz, sc] of boatSpots) {
    const boat = sailboat(sc, 0xf2f0ea, sx);
    boat.position.set(sx, 0, sz);
    group.add(boat);
  }
  // --- SW waterfront (x -60..-30, z 15..21): fishermen's cottages
  // + a fish market, facing the water. ITEM 2 (D): this strip was
  // empty green; it is the marina's west arm.
  const sw = new THREE.Group();
  const swColliders = [];
  const swAdd = (x, z, w, d, builder) => {
    const b = builder();
    b.position.set(x, 0, z);
    sw.add(b);
    swColliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, id: 'marina' });
  };
  for (const [cx, ccol] of [[-60, PR.peach], [-56, PR.peach], [-52, PR.mint], [-48, PR.mint], [-40, PR.peach], [-37, PR.mint], [-34, PR.mint], [-30, PR.peach]]) {
    swAdd(cx, 18, 4, 5, () => decoVilla(4, 5, 3.5, ccol));
  }
  swAdd(-44, 18, 8, 6, () => decoVilla(8, 6, 4, PR.cream)); // fish market
  group.add(mergeStatic(sw, [], { unifyStandard: true }));
  colliders.push(...swColliders);

  // --- traffic lanes + pedestrian paths ---
  const lanes = [
    { name: 'promenade-walk', pts: loopPath(10, 28.5, 58, 30.5, 2), speed: 6 },
    { name: 'marina-road', pts: loopPath(-28, 22.5, 6, 26.5, 2), speed: 6 },
  ];
  const pedPaths = [
    { a: { x: 8, z: 29 }, b: { x: 72, z: 29 } },
    { a: { x: -30, z: 29 }, b: { x: 8, z: 29 } },
    { a: { x: -30, z: 33 }, b: { x: 72, z: 33 } },
    { a: { x: -28, z: 30 }, b: { x: -28, z: 38 } },
    { a: { x: -24, z: 30 }, b: { x: -24, z: 38 } },
    { a: { x: -19, z: 30 }, b: { x: -19, z: 38 } },
    { a: { x: -14, z: 30 }, b: { x: -14, z: 38 } },
    { a: { x: -9, z: 30 }, b: { x: -9, z: 38 } },
    { a: { x: -4, z: 30 }, b: { x: -4, z: 38 } },
    { a: { x: 35, z: 14 }, b: { x: 35, z: 28 } },
    { a: { x: 52, z: 14 }, b: { x: 52, z: 28 } },
    { a: { x: -56, z: 15 }, b: { x: -32, z: 15 } },
  ];
  return { group, colliders, lanes, pedPaths, tickers };
}

// ---------- (c) Downtown Bay Skyline — REMOVED in stage 1 ----------
// The old 12-tower landmass across the bay + its bridge are gone; the
// CBD core (game/src/cbd.js) is the downtown now. buildSkyline(),
// the SK palette and podiumBlock() were deleted with it. The bay is
// open water (see the bay-water collider in buildNewDistricts).

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
  // STAGE 1 part 5: the bay water starts at z 35 now (the promenade +
  // marina fill z 14..35; city.js moves the water plane). The collider
  // is split around the 9 marina piers (x -33, -28, -24, -19, -14,
  // -9, -4, 2, 7; 2 wide, to z 38) so the pier corridors stay
  // walkable. 2b: 3 piers added (-33, 2, 7).
  colliders.push({ x0: -130, z0: 38, x1: 130, z1: 103, id: 'bay-water' });
  colliders.push({ x0: -130, z0: 35, x1: -34, z1: 38, id: 'bay-water' });
  colliders.push({ x0: -32, z0: 35, x1: -29, z1: 38, id: 'bay-water' });
  colliders.push({ x0: -27, z0: 35, x1: -25, z1: 38, id: 'bay-water' });
  colliders.push({ x0: -23, z0: 35, x1: -20, z1: 38, id: 'bay-water' });
  colliders.push({ x0: -18, z0: 35, x1: -15, z1: 38, id: 'bay-water' });
  colliders.push({ x0: -13, z0: 35, x1: -10, z1: 38, id: 'bay-water' });
  colliders.push({ x0: -8, z0: 35, x1: -5, z1: 38, id: 'bay-water' });
  colliders.push({ x0: -3, z0: 35, x1: 1, z1: 38, id: 'bay-water' });
  colliders.push({ x0: 3, z0: 35, x1: 6, z1: 38, id: 'bay-water' });
  colliders.push({ x0: 8, z0: 35, x1: 130, z1: 38, id: 'bay-water' });
  return { group, colliders, lanes, pedPaths, tickers };
}
