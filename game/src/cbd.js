// AZZURA HEIST — Stage 1: CBD core (Downtown Bay Skyline), GRID rebuild
// (Xian 21 Nov 15:22 — REPLACES the packed 6-unit tower rows).
// Towers live on BLOCKS from cbd-grid.js: 30 blocks, 20 single towers +
// 8 twin pairs on shared podiums (16 towers) + 2 green blocks (park +
// plaza) = 36 towers. One tower per block (never more than 2), every
// block surrounded by roads on all four sides, towers set back 8–15 m
// (0.8–1.5 units) from the curb with plaza / trees / planters around
// them. Height gradient: tallest in the middle blocks, lower toward the
// edge. Silhouettes vary (stepped Art Deco crowns, setbacks, spires,
// antennas, helipads, rooftop machinery) — NO red terracotta boxes on
// skyscraper roofs. Merged geometry per material, like before.
import * as THREE from '../vendor/three.module.min.js';
import {
  box, mergedMesh, colored, xform, vertexColorMat, seededRandom,
} from './world.js';
import { cbdGridBlocks } from './cbd-grid.js';

// Height curve: floors by distance r from the CBD centre (0, -16.8).
// Azzura is forced to 60; the rest fall from ~50 near the centre to
// ~20 at the edge, +-15% variation, clamp 20-60.
export function cbdTowerFloors(r, rnd) {
  let f = 55 - (r / 40) * 35;
  f *= 0.85 + rnd() * 0.3;
  return Math.max(20, Math.min(60, Math.round(f)));
}

const CROWN_COLORS = {
  gold: 0xc9a227, stone: 0xe8dcc0, bronze: 0x4a3f30,
  teal: 0x7fa8b8, pale: 0xd8d2c4, grey: 0x8a8a84,
};

export function buildCBD() {
  const rnd = seededRandom(20261121);
  const group = new THREE.Group();
  group.name = 'cbd';
  const colliders = [];
  const tickers = [];
  const FLOOR_H = 2.0; // game units per floor

  const glassGeos = []; // tower bodies (blue-grey glass)
  const concGeos = []; // concrete / stone towers + podiums
  const crownGeos = []; // varied crowns (vertex colours, no terracotta)
  const winGeos = []; // window quads on all four faces
  const plazaGeos = []; // paving slabs (plaza block + tower forecourts)
  const greenGeos = []; // park lawn, trees, shrubs
  let towerCount = 0;
  let podiumCount = 0;

  const blocks = cbdGridBlocks();
  // Crown variants must differ from the left and upper neighbours, so
  // no two adjacent towers share a silhouette.
  const variantAt = {};
  const pickVariant = (col, row, salt) => {
    let v = (col * 5 + row * 2 + salt) % 6;
    if (variantAt[`${col - 1},${row}`] === v) v = (v + 1) % 6;
    if (variantAt[`${col},${row - 1}`] === v) v = (v + 1) % 6;
    if (variantAt[`${col - 1},${row}`] === v) v = (v + 1) % 6;
    variantAt[`${col},${row}`] = v;
    return v;
  };

  function addCrown(cx, cz, w, d, h, variant) {
    const C = CROWN_COLORS;
    if (variant === 0) { // stepped Art Deco crown
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.8, 0.8, d * 0.8), cx, h + 0.4, cz), C.gold));
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.55, 0.8, d * 0.55), cx, h + 1.2, cz), C.stone));
    } else if (variant === 1) { // setback slab
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.7, 1.2, d * 0.7), cx, h + 0.6, cz), C.stone));
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.72, 0.25, d * 0.72), cx, h + 1.3, cz), C.gold));
    } else if (variant === 2) { // spire
      crownGeos.push(colored(xform(new THREE.ConeGeometry(Math.min(w, d) * 0.42, 7, 4), cx, h + 3.5, cz), C.bronze));
      crownGeos.push(colored(xform(new THREE.SphereGeometry(0.3, 8, 6), cx, h + 7.2, cz), C.gold));
    } else if (variant === 3) { // antenna
      crownGeos.push(colored(xform(new THREE.CylinderGeometry(0.06, 0.09, 6, 6), cx, h + 3, cz), C.grey));
      crownGeos.push(colored(xform(new THREE.SphereGeometry(0.18, 8, 6), cx, h + 6.1, cz), 0xc0392b));
    } else if (variant === 4) { // helipad
      crownGeos.push(colored(xform(new THREE.CylinderGeometry(Math.min(w, d) * 0.45, Math.min(w, d) * 0.45, 0.3, 12), cx, h + 0.15, cz), C.grey));
      crownGeos.push(colored(xform(new THREE.CylinderGeometry(Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, 0.32, 12), cx, h + 0.16, cz), C.pale));
    } else { // rooftop machinery (boxes + vent, never terracotta)
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.3, 0.9, d * 0.3), cx - w * 0.18, h + 0.45, cz), C.grey));
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.22, 0.7, d * 0.22), cx + w * 0.2, h + 0.35, cz - d * 0.15), C.teal));
      crownGeos.push(colored(xform(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 8), cx + w * 0.2, h + 0.55, cz + d * 0.18), C.bronze));
    }
  }

  function addWindows(cx, cz, w, d, h, floors) {
    const rows = Math.min(6, Math.max(2, Math.floor(floors / 8)));
    const cols = Math.max(2, Math.floor(w / 1.6));
    // One lit-column set per face (a vertical run of warm windows).
    const faces = [
      { n: 's', off: [0, d / 2 + 0.05], rot: 0 },
      { n: 'n', off: [0, -d / 2 - 0.05], rot: 0 },
      { n: 'e', off: [w / 2 + 0.05, 0], rot: 1 },
      { n: 'w', off: [-w / 2 - 0.05, 0], rot: 1 },
    ];
    for (const f of faces) {
      const fw = f.rot ? d : w; // face width along its horizontal axis
      const fcols = Math.max(2, Math.floor(fw / 1.6));
      const litCols = new Set();
      for (let c = 0; c < fcols; c++) if (rnd() < 0.4) litCols.add(c);
      for (let ri = 0; ri < rows; ri++) {
        for (let ci = 0; ci < fcols; ci++) {
          const lit = litCols.has(ci) && ri < rows - 1;
          const wy = 2 + (ri + 0.5) * ((h - 4) / rows);
          const along = (ci - (fcols - 1) / 2) * (fw / fcols);
          const wx = f.rot ? cx + f.off[0] : cx + along;
          const wz = f.rot ? cz + along : cz + f.off[1];
          const bw = f.rot ? 0.1 : 0.7;
          const bd = f.rot ? 0.7 : 0.1;
          winGeos.push(colored(
            xform(new THREE.BoxGeometry(bw, 1.1, bd), wx, wy, wz),
            lit ? 0xffd9a0 : 0x1e2a32,
          ));
        }
      }
    }
  }

  function addTower(cx, cz, w, d, floors, variant) {
    const h = floors * FLOOR_H;
    const glass = rnd() > 0.45;
    const body = xform(new THREE.BoxGeometry(w, h, d), cx, h / 2, cz);
    (glass ? glassGeos : concGeos).push(colored(body, 0xffffff));
    addCrown(cx, cz, w, d, h, variant);
    addWindows(cx, cz, w, d, h, floors);
    colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, id: 'cbd-tower' });
    towerCount++;
  }

  for (const b of blocks) {
    const bw = b.x1 - b.x0;
    const bd = b.z1 - b.z0;
    const r = Math.hypot(b.cx - 0, b.cz - (-16.8));
    if (b.kind === 'park') {
      // Green block: lawn, crossing paths, trees, shrubs, one bench.
      greenGeos.push(colored(xform(new THREE.BoxGeometry(bw, 0.2, bd), b.cx, 0.1, b.cz), 0x7a8b5a));
      plazaGeos.push(colored(xform(new THREE.BoxGeometry(bw, 0.22, 1.2), b.cx, 0.11, b.cz), 0xffffff));
      plazaGeos.push(colored(xform(new THREE.BoxGeometry(1.2, 0.22, bd), b.cx, 0.11, b.cz), 0xffffff));
      for (let i = 0; i < 8; i++) {
        const tx = b.x0 + 1.2 + rnd() * (bw - 2.4);
        const tz = b.z0 + 1.2 + rnd() * (bd - 2.4);
        if (Math.abs(tx - b.cx) < 1.2 && Math.abs(tz - b.cz) < 1.2) continue; // keep the paths clear
        greenGeos.push(colored(xform(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 6), tx, 0.7, tz), 0x6b4a2a));
        greenGeos.push(colored(xform(new THREE.SphereGeometry(0.9 + rnd() * 0.5, 8, 6), tx, 2.0, tz), 0x4d8a5c));
        greenGeos.push(colored(xform(new THREE.SphereGeometry(0.6, 8, 6), tx + 0.4, 2.6, tz), 0x5a9a68));
      }
      for (let i = 0; i < 4; i++) {
        const sx = b.x0 + 1 + rnd() * (bw - 2);
        const sz = b.z0 + 1 + rnd() * (bd - 2);
        greenGeos.push(colored(xform(new THREE.SphereGeometry(0.45, 8, 6), sx, 0.35, sz), 0x356b42));
      }
      continue;
    }
    if (b.kind === 'plaza') {
      // Civic plaza: paving, central fountain, planters, benches.
      plazaGeos.push(colored(xform(new THREE.BoxGeometry(bw, 0.2, bd), b.cx, 0.1, b.cz), 0xffffff));
      concGeos.push(colored(xform(new THREE.CylinderGeometry(1.6, 1.7, 0.5, 16), b.cx, 0.25, b.cz), 0xffffff));
      winGeos.push(colored(xform(new THREE.CylinderGeometry(1.4, 1.4, 0.1, 16), b.cx, 0.45, b.cz), 0x9fd4d8));
      concGeos.push(colored(xform(new THREE.CylinderGeometry(0.18, 0.24, 1.0, 8), b.cx, 0.9, b.cz), 0xffffff));
      colliders.push({ x0: b.cx - 1.7, z0: b.cz - 1.7, x1: b.cx + 1.7, z1: b.cz + 1.7, id: 'cbd-fountain' });
      for (const [px, pz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) {
        concGeos.push(colored(xform(new THREE.BoxGeometry(1.4, 0.55, 0.6), b.cx + px, 0.28, b.cz + pz), 0xffffff));
        greenGeos.push(colored(xform(new THREE.SphereGeometry(0.4, 8, 6), b.cx + px, 0.75, b.cz + pz), 0x4d8a5c));
      }
      continue;
    }
    if (b.kind === 'twin') {
      // Twin pair on a shared podium: low retail slab with shop
      // fronts, two towers rising from it.
      const pw = 7.0, pd = 7.0, ph = 5;
      concGeos.push(colored(xform(new THREE.BoxGeometry(pw, ph, pd), b.cx, ph / 2, b.cz), 0xffffff));
      concGeos.push(colored(xform(new THREE.BoxGeometry(pw * 1.04, 0.4, pd * 1.04), b.cx, ph + 0.2, b.cz), 0xffffff));
      winGeos.push(colored(xform(new THREE.BoxGeometry(pw * 0.8, 1.4, 0.1), b.cx, 1.2, b.cz + pd / 2 + 0.05), 0x9fd4d8));
      colliders.push({ x0: b.cx - pw / 2, z0: b.cz - pd / 2, x1: b.cx + pw / 2, z1: b.cz + pd / 2, id: 'cbd-podium' });
      podiumCount++;
      const tw = 2.8, td = 2.8;
      const floors1 = cbdTowerFloors(r, rnd);
      const floors2 = cbdTowerFloors(r, rnd);
      addTower(b.cx - 1.8, b.cz, tw, td, floors1, pickVariant(b.col, b.row, 3));
      addTower(b.cx + 1.8, b.cz, tw, td, floors2, pickVariant(b.col, b.row, 4));
      continue;
    }
    // Single tower (or the Azzura Tower): set back 1.0-1.5 from the
    // block edge (8-15 m), forecourt paving around it.
    const setback = 1.0 + rnd() * 0.5;
    const w = Math.min(bw, bd) - 2 * setback;
    const d = Math.min(bw, bd) - 2 * setback;
    plazaGeos.push(colored(xform(new THREE.BoxGeometry(bw - 0.4, 0.18, bd - 0.4), b.cx, 0.09, b.cz), 0xffffff));
    let floors = cbdTowerFloors(r, rnd);
    let variant = pickVariant(b.col, b.row, 0);
    if (b.kind === 'azzura') {
      floors = 60;
      variant = 2; // the Azzura Tower keeps its spire
    }
    addTower(b.cx, b.cz, w, d, floors, variant);
  }

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x7fa8b8, roughness: 0.35, metalness: 0.25, flatShading: true });
  const concMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9, flatShading: true });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb2, roughness: 0.95, flatShading: true });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true, vertexColors: true });
  if (glassGeos.length) group.add(mergedMesh(glassGeos, glassMat));
  if (concGeos.length) group.add(mergedMesh(concGeos, concMat));
  if (crownGeos.length) group.add(mergedMesh(crownGeos, vertexColorMat));
  if (winGeos.length) group.add(mergedMesh(winGeos, vertexColorMat));
  if (plazaGeos.length) group.add(mergedMesh(plazaGeos, plazaMat));
  if (greenGeos.length) group.add(mergedMesh(greenGeos, greenMat));

  // Elevated road + monorail above the boulevard (deck y 7). Pillars
  // are 0.35 wide so they fit INSIDE the 0.4-wide median (z -0.2..0.2)
  // — never in a driving lane, never in the camera path.
  const deck = new THREE.Group();
  deck.add(box(68, 0.6, 4, 0x8a8580, 0, 7, 0));
  for (let x = -30; x <= 30; x += 6) {
    deck.add(box(0.35, 7, 0.35, 0x9a938a, x, 3.5, 0));
  }
  deck.add(box(68, 0.15, 0.3, 0x3a3a3a, 0, 7.4, -1.2));
  deck.add(box(68, 0.15, 0.3, 0x3a3a3a, 0, 7.4, 1.2));
  const car = new THREE.Group();
  car.add(box(6, 2, 2.4, 0x2e7f8f, 0, 0, 0));
  car.add(box(5.6, 0.9, 2.5, 0x1e2a32, 0, 0.3, 0));
  car.add(box(6.2, 0.3, 2.6, 0xe8c33d, 0, -1.1, 0));
  car.position.set(0, 8.6, 0);
  deck.add(car);
  group.add(deck);
  // The monorail car glides on a sine ticker. Tickers must be THREE
  // objects with userData.tick (step() calls tk.userData.tick) — a
  // plain { tick } object crashes the frame loop.
  deck.userData.tick = (t) => { car.position.x = Math.sin(t * 0.12) * 26; };
  tickers.push(deck);

  return {
    group, colliders, tickers,
    towerCount, podiumCount,
    buildingCount: towerCount + podiumCount,
  };
}
