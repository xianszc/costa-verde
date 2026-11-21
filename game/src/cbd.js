// AZZURA HEIST — Stage 1: CBD core (Downtown Bay Skyline), v3 zoning plan.
// 50 towers on a tight 6-unit grid in the CENTRE of the map (x -28..28,
// z -30..18), tallest in the middle, heights falling off toward the edges
// (the corrected radial curve: plateau 60 for r<10, linear 60->15 for
// r 10-45, exponential after; CBD edge 20-40 floors). 4 podium blocks on
// the south edge, an elevated road + monorail through the core, east-west
// above the boulevard (z -6..6). Towers are merged geometry by material
// (glass / concrete / crown / windows) so 50 towers cost a handful of
// draw calls, not one per tower.
//
// STREET GRID (Xian 21 Nov 15:02 — the towers stood packed with no
// visible streets): the towers are NARROW (3.0-3.4 wide on a 6-unit
// pitch) so the streets between them are REAL and CLEAR — 8 north-south
// streets + 4 east-west streets (roads.js), each 2.4 units = 24 m wide,
// no tower footprint overlapping any road (verified by
// game/test/cbd-overlap.mjs, must be 0). The old 4-5-wide towers covered
// the 2-wide streets; the old podiums sat ON the streets.
import * as THREE from '../vendor/three.module.min.js';
import {
  box, mergedMesh, colored, xform, vertexColorMat,
} from './world.js';
// seededRandom lives in roads.js (world.js has an unexported copy).
import { seededRandom } from './roads.js';

// Corrected height curve (zoning-plan.md v3): floors by distance r from
// the CBD centre (0, -6). CBD clamp 20-60.
export function cbdTowerFloors(r, rnd) {
  let f;
  if (r < 10) f = 60;
  else if (r <= 45) f = 60 - ((r - 10) / 35) * 45;
  else f = 14 * Math.exp(-(r - 45) / 30) + 1;
  f *= 0.85 + rnd() * 0.3; // +-15% variation
  return Math.max(20, Math.min(60, Math.round(f)));
}

const COLS = [-24, -18, -12, -6, 0, 6, 12, 18, 24];
const ROWS = [-27, -21, -15, -9, 9, 15]; // boulevard rows (-3, 3) excluded
const PLAZA_SLOTS = [[-24, 15], [24, 15], [-24, -27], [24, -27]]; // 4 corners
// Podium blocks (low retail, 2-3 floors) on the SOUTH edge of the CBD
// (z 20, facing the promenade / marina), clear of every street: 2.8
// wide leaves 0.4 clearance to the north-south streets, 2.5 deep leaves
// 2.0 to the tower row at z 15 and 0.25 to the marina boat sheds at
// z 24. The old 8 podiums (6-7 wide) sat ON the streets — 4 of them
// overlapped the north-south streets at x +/-15 and 4 more blocked the
// east-west streets; there is no clean spot for them in the packed
// grid, so the CBD has 4 podiums now (50 towers + 4 podiums = 54).
const PODIUMS = [
  { x: -27, z: 20, w: 2.8, d: 2.5, h: 7 },
  { x: -24, z: 20, w: 2.8, d: 2.5, h: 6 },
  { x: -12, z: 20, w: 2.8, d: 2.5, h: 8 },
  { x: 0, z: 20, w: 2.8, d: 2.5, h: 6 },
];

export function buildCBD() {
  const rnd = seededRandom(20261121);
  const group = new THREE.Group();
  group.name = 'cbd';
  const colliders = [];
  const tickers = [];
  const FLOOR_H = 2.0; // game units per floor

  const glassGeos = []; // tower bodies (blue-grey glass)
  const concGeos = []; // concrete / stone towers + podiums
  const crownGeos = []; // stepped crowns + spires (terracotta / gold)
  const winGeos = []; // dark window strips (front faces)
  let towerCount = 0;

  const isPlaza = (x, z) => PLAZA_SLOTS.some(([px, pz]) => px === x && pz === z);

  for (const cx of COLS) {
    for (const cz of ROWS) {
      if (isPlaza(cx, cz)) continue;
      const r = Math.hypot(cx - 0, cz - (-6));
      let floors = cbdTowerFloors(r, rnd);
      const isAzzura = cx === 0 && cz === -9; // centre-most slot
      if (isAzzura) floors = 60;
      // NARROW towers (3.0-3.4 on a 6-unit pitch): the gap between
      // neighbours is 2.6-3.0, so the 2.4-wide streets clear them by
      // 0.1-0.3 on each side. The old 4-5-wide towers covered the
      // streets — the gap was 1.0 and the street overlapped the tower
      // base. The Azzura Tower is 3.4 (its faces clear the streets at
      // x +/-3 and z -12 by 0.1).
      const w = 3.0 + rnd() * 0.4;
      const d = 3.0 + rnd() * 0.4;
      const h = floors * FLOOR_H;
      const glass = rnd() > 0.45;
      const body = xform(new THREE.BoxGeometry(w, h, d), cx, h / 2, cz);
      (glass ? glassGeos : concGeos).push(colored(body, 0xffffff));
      // Stepped Art Deco crown.
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.8, 0.8, d * 0.8), cx, h + 0.4, cz), 0xffffff));
      crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.55, 0.8, d * 0.55), cx, h + 1.2, cz), 0xffffff));
      if (isAzzura) {
        // Azzura Tower: stepped spire on top of the crown.
        crownGeos.push(colored(xform(new THREE.ConeGeometry(1.2, 9, 4), cx, h + 6.2, cz), 0xffffff));
      }
      // Window strips on the south face (toward the boulevard) — a tidy
      // grid, mostly dark glass with some warm lit windows in vertical
      // groups (no black-and-white checkerboard).
      const cols = Math.max(2, Math.floor(w / 1.4));
      const rows = Math.min(6, Math.max(2, Math.floor(floors / 8)));
      for (let ri = 0; ri < rows; ri++) {
        for (let ci = 0; ci < cols; ci++) {
          const lit = rnd() < 0.35; // ~35% warm lit
          const wy = 2 + (ri + 0.5) * ((h - 4) / rows);
          const wx = cx + (ci - (cols - 1) / 2) * (w / cols);
          winGeos.push(colored(
            xform(new THREE.BoxGeometry(0.7, 1.1, 0.1), wx, wy, cz + d / 2 + 0.05),
            lit ? 0xffd9a0 : 0x1e2a32,
          ));
        }
      }
      colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, id: 'cbd-tower' });
      towerCount++;
    }
  }

  // Podium blocks (2-4 floors) with shop fronts + rooftop props.
  for (const p of PODIUMS) {
    concGeos.push(colored(xform(new THREE.BoxGeometry(p.w, p.h, p.d), p.x, p.h / 2, p.z), 0xffffff));
    concGeos.push(colored(xform(new THREE.BoxGeometry(p.w * 1.05, 0.4, p.d * 1.05), p.x, p.h + 0.2, p.z), 0xffffff));
    winGeos.push(colored(xform(new THREE.BoxGeometry(p.w * 0.8, 1.4, 0.1), p.x, 1.2, p.z + p.d / 2 + 0.05), 0x9fd4d8));
    colliders.push({ x0: p.x - p.w / 2, z0: p.z - p.d / 2, x1: p.x + p.w / 2, z1: p.z + p.d / 2, id: 'cbd-podium' });
  }

  // Plazas: paved squares with a fountain at the centre of each corner.
  const plazaGeos = [];
  for (const [px, pz] of PLAZA_SLOTS) {
    plazaGeos.push(colored(xform(new THREE.BoxGeometry(5.5, 0.2, 5.5), px, 0.1, pz), 0xffffff));
  }

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x7fa8b8, roughness: 0.35, metalness: 0.25, flatShading: true });
  const concMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9, flatShading: true });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xc65d3b, roughness: 0.7, flatShading: true });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb2, roughness: 0.95, flatShading: true });
  if (glassGeos.length) group.add(mergedMesh(glassGeos, glassMat));
  if (concGeos.length) group.add(mergedMesh(concGeos, concMat));
  if (crownGeos.length) group.add(mergedMesh(crownGeos, crownMat));
  if (winGeos.length) group.add(mergedMesh(winGeos, vertexColorMat));
  if (plazaGeos.length) group.add(mergedMesh(plazaGeos, plazaMat));

  // Elevated road + monorail through the core, east-west above the
  // boulevard (deck y 7, pillars down to the street).
  const deck = new THREE.Group();
  deck.add(box(56, 0.6, 4, 0x8a8580, 0, 7, 0));
  for (let x = -24; x <= 24; x += 6) {
    deck.add(box(0.8, 7, 0.8, 0x9a938a, x, 3.5, 0));
  }
  deck.add(box(56, 0.15, 0.3, 0x3a3a3a, 0, 7.4, -1.2));
  deck.add(box(56, 0.15, 0.3, 0x3a3a3a, 0, 7.4, 1.2));
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
  deck.userData.tick = (t) => { car.position.x = Math.sin(t * 0.12) * 20; };
  tickers.push(deck);

  return {
    group, colliders, tickers,
    towerCount, podiumCount: PODIUMS.length,
    buildingCount: towerCount + PODIUMS.length,
  };
}
