// AZZURA HEIST — commercial ring (stage 1 part 3).
// The general-commercial ring around the CBD: mid-rise 6–15 floors,
// shop fronts at street level, hotels, offices, a market hall and a
// parking garage. Dense — building fronts continuous along the street,
// 6–8 buildings per block, no empty lots. Data-driven: BLOCKS lists
// the ring's blocks (fitted between the boulevard, the ring avenue at
// z -42, the ring side streets and the old-town / promenade / marina
// edges); each block is filled along its perimeter, courtyard in the
// middle. Merged geometry per material, like cbd.js.
import * as THREE from '../vendor/three.module.min.js';
import {
  box, mergedMesh, colored, xform, vertexColorMat, M,
} from './world.js';
import { seededRandom } from './roads.js';

// --- blocks (x0,z0,x1,z1, kind) ---
// ITEM 2 (D, Xian 21 Nov 16:04): the ring is rebuilt as small blocks
// (7–12 wide, 8–12 deep) bounded by streets on all four sides, so the
// perimeter fill gives ~4–6 buildings per block instead of the old
// 13 big blocks' overlapping pairs. North band: two deep rows
// (z -67..-58 + z -56..-47.5, the second only east of the old town
// at x -34 — the old town x -60..-34, z -52..-26 covers the west).
// East band: 4 rows x 3 columns (x 44..72). West band: 4 rows x 3
// columns (x -72..-44). South row: only the x 45..59 block survives
// (the west blocks are old-town land). The old town (x -60..-34,
// z -52..-26), promenade (x 8..60, z 14..30) and marina (x -30..8,
// z 22..30) are NOT blocks here — parts 4 and 5 build them.
const BLOCKS = [
  // North band, row 1 (z -67..-58 east of x -34, z -67..-55.2 west).
  { x0: -71.5, z0: -67, x1: -61.5, z1: -55.2, kind: 'commercial' },
  { x0: -59.5, z0: -67, x1: -48, z1: -55.2, kind: 'commercial' },
  { x0: -46, z0: -67, x1: -35, z1: -55.2, kind: 'commercial' },
  { x0: -33, z0: -67, x1: -25, z1: -58, kind: 'commercial' },
  { x0: -23, z0: -67, x1: -15, z1: -58, kind: 'commercial' },
  { x0: -13, z0: -67, x1: -5, z1: -58, kind: 'commercial' },
  { x0: -3, z0: -67, x1: 5, z1: -58, kind: 'commercial' },
  { x0: 7, z0: -67, x1: 15, z1: -58, kind: 'commercial' },
  { x0: 17, z0: -67, x1: 25, z1: -58, kind: 'commercial' },
  { x0: 27, z0: -67, x1: 35, z1: -58, kind: 'commercial' },
  { x0: 37, z0: -67, x1: 45, z1: -58, kind: 'commercial' },
  { x0: 47, z0: -67, x1: 59.5, z1: -58, kind: 'commercial' },
  { x0: 61.5, z0: -67, x1: 71.5, z1: -58, kind: 'commercial' },
  // North band, row 2 (z -56..-47.5, east of the old town only).
  { x0: -33, z0: -56, x1: -25, z1: -47.5, kind: 'commercial' },
  { x0: -23, z0: -56, x1: -15, z1: -47.5, kind: 'commercial' },
  { x0: -13, z0: -56, x1: -5, z1: -47.5, kind: 'commercial' },
  { x0: -3, z0: -56, x1: 5, z1: -47.5, kind: 'hotel' },
  { x0: 7, z0: -56, x1: 15, z1: -47.5, kind: 'commercial' },
  { x0: 17, z0: -56, x1: 25, z1: -47.5, kind: 'commercial' },
  { x0: 27, z0: -56, x1: 35, z1: -47.5, kind: 'commercial' },
  { x0: 37, z0: -56, x1: 45, z1: -47.5, kind: 'commercial' },
  { x0: 47, z0: -56, x1: 59.5, z1: -47.5, kind: 'market' },
  { x0: 61.5, z0: -56, x1: 71.5, z1: -47.5, kind: 'commercial' },
  // North strip, south row (z -38.5..-32) — only the x 45..59 block
  // survives; the west blocks are old-town land.
  { x0: 45, z0: -38.5, x1: 59, z1: -32, kind: 'commercial' },
  // East band (x 44..72, z -31..13) — 4 rows x 3 columns.
  { x0: 45, z0: -29.9, x1: 52, z1: -21, kind: 'commercial' },
  { x0: 54, z0: -29.9, x1: 61, z1: -21, kind: 'commercial' },
  { x0: 63, z0: -29.9, x1: 71.5, z1: -21, kind: 'commercial' },
  { x0: 45, z0: -19, x1: 52, z1: -11, kind: 'commercial' },
  { x0: 54, z0: -19, x1: 61, z1: -11, kind: 'commercial' },
  { x0: 63, z0: -19, x1: 71.5, z1: -11, kind: 'commercial' },
  { x0: 45, z0: -9, x1: 52, z1: -1, kind: 'commercial' },
  { x0: 54, z0: -9, x1: 61, z1: -1, kind: 'commercial' },
  { x0: 63, z0: -9, x1: 71.5, z1: -1, kind: 'commercial' },
  { x0: 45, z0: 1, x1: 52, z1: 11.7, kind: 'commercial' },
  { x0: 54, z0: 1, x1: 61, z1: 11.7, kind: 'commercial' },
  { x0: 63, z0: 1, x1: 71.5, z1: 11.7, kind: 'commercial' },
  // West band (x -72..-44, z -26..12.7) — 4 rows x 3 columns.
  { x0: -71.5, z0: -25, x1: -64, z1: -17, kind: 'commercial' },
  { x0: -62, z0: -25, x1: -55, z1: -17, kind: 'commercial' },
  { x0: -53, z0: -25, x1: -45, z1: -17, kind: 'commercial' },
  { x0: -71.5, z0: -15, x1: -64, z1: -7, kind: 'commercial' },
  { x0: -62, z0: -15, x1: -55, z1: -7, kind: 'commercial' },
  { x0: -53, z0: -15, x1: -45, z1: -7, kind: 'commercial' },
  { x0: -71.5, z0: -5, x1: -64, z1: 3, kind: 'commercial' },
  { x0: -62, z0: -5, x1: -55, z1: 3, kind: 'commercial' },
  { x0: -53, z0: -5, x1: -45, z1: 3, kind: 'commercial' },
  { x0: -71.5, z0: 5, x1: -64, z1: 11.7, kind: 'commercial' },
  { x0: -62, z0: 5, x1: -55, z1: 11.7, kind: 'commercial' },
  { x0: -53, z0: 5, x1: -45, z1: 11.7, kind: 'commercial' },
];

const PALETTE = [
  0xefe3c8, 0xe8c98a, 0xd8a05a, 0xc96a4a, 0x7a9a8a, 0x8fa8b8,
  0xb88a6a, 0xd8b8a8, 0xe8d8b8, 0xa8b89a, 0xc9a86a, 0x9a8a7a,
];
// Exported for cbd.js (C): the CBD towers' ground-floor shop signs
// use the same atlas + plates, so all signs in the city share one
// texture and one merged mesh per module.
export const SHOP_NAMES = [
  'CAFÉ LUME', 'FORNO AZZURRO', 'PESCHERIA', 'GELATO SOL',
  'BAR VERDE', 'TABACCHI', 'FARMACIA', 'PANETTERIA',
  'MACELLERIA', 'FIORI', 'LIBRERIA', 'OROLOGERIA',
];
const SHOP_COLORS = ['#1e2a32', '#7a2e2e', '#1f7a8c', '#c98a3a', '#2e5a3a', '#5a3a6a'];

// --- sign atlas (Xian 21 Nov 16:04, item 2) ---
// Every named sign used to be its own canvas texture + its own mesh —
// ~37 shop signs + 4 billboards + 6 neons = ~47 draw calls, and the
// top view was already at 590/600. Now all 16 name plates (12 shops +
// 4 billboards) live on ONE 1024x256 canvas (4x4 cells of 256x64) with
// ONE texture, and every sign quad is merged into ONE mesh (1 draw
// call). Neons merge the same way (vertex colours, 1 draw call).
// A plate is drawn exactly like the old per-sign canvas (bg + text),
// so the signs look identical — only the draw-call cost changes.
const ATLAS_COLS = 4;
const ATLAS_ROWS = 4;
const ATLAS_PLATES = [
  ...SHOP_NAMES.map((text, i) => ({ text, bg: SHOP_COLORS[i % SHOP_COLORS.length], fg: '#f7ebd7' })),
  { text: 'AZZURA', bg: '#1e2a32', fg: '#ffd9a0' },
  { text: 'SOL', bg: '#c93a6b', fg: '#f7ebd7' },
  { text: 'VELA', bg: '#1f7a8c', fg: '#f7ebd7' },
  { text: 'PORTO', bg: '#7a2e2e', fg: '#f7ebd7' },
];
export function buildSignAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  const plates = new Map();
  ATLAS_PLATES.forEach((p, i) => {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const x = col * 256;
    const y = row * 64;
    ctx.fillStyle = p.bg; ctx.fillRect(x, y, 256, 64);
    ctx.fillStyle = p.fg; ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.text, x + 128, y + 34);
    // Canvas row 0 is the TOP; texture v runs bottom-up.
    plates.set(p.text, {
      u0: col / ATLAS_COLS, u1: (col + 1) / ATLAS_COLS,
      v0: 1 - (row + 1) / ATLAS_ROWS, v1: 1 - row / ATLAS_ROWS,
    });
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { texture: tex, plates };
}
// Remap a plane's UVs into one atlas cell.
export function remapUV(geo, plate) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i,
      plate.u0 + uv.getX(i) * (plate.u1 - plate.u0),
      plate.v0 + uv.getY(i) * (plate.v1 - plate.v0));
  }
  return geo;
}

// A mid-rise building (6–15 floors = 12–30 units tall). The shopfront
// (awning + glass) faces the street (outward normal `facing`, in
// radians — the front face is at local +z after rotation). The named
// sign is NOT built here: the caller adds one atlas quad per named shop
// (see buildCommercialRing) so all signs merge into a single mesh.
function commercialBuilding(rnd, floors, w, d, color, isCorner) {
  const h = floors * 2;
  const g = new THREE.Group();
  // Main volume + cornice + parapet.
  g.add(box(w, h, d, color, 0, h / 2, 0));
  g.add(box(w + 0.3, 0.35, d + 0.3, 0x8a7a5a, 0, h + 0.17, 0));
  g.add(box(w * 0.7, 0.4, d * 0.7, color, 0, h + 0.5, 0));
  // Rooftop props: AC box + water tank + chimney (varied).
  g.add(box(0.9, 0.7, 0.9, 0x9a9a9a, -w / 4, h + 1.0, -d / 4));
  g.add(box(0.5, 1.1, 0.5, 0x8a4a3a, w / 4, h + 1.0, d / 4));
  if (rnd() < 0.5) g.add(box(0.7, 0.7, 0.7, 0x6a4a2a, w / 4, h + 0.9, -d / 4));
  // Corner buildings are distinct: one floor taller + a gold trim band.
  if (isCorner) {
    g.add(box(w + 0.1, 2, d + 0.1, color, 0, h + 1.4, 0));
    g.add(box(w + 0.4, 0.25, d + 0.4, 0xe8a33d, 0, h + 2.5, 0));
  }
  // Shopfront on the front face (local +z): glass storefront, striped
  // awning, sign band above the awning.
  const awn = rnd() < 0.5 ? 0xf7ebd7 : 0xc93a6b;
  g.add(box(w * 0.9, 0.12, 1.0, awn, 0, 2.6, d / 2 + 0.5));
  g.add(box(w * 0.9, 1.8, 0.1, 0x1e2a32, 0, 1.2, d / 2 + 0.05));
  g.add(box(w * 0.9, 0.5, 0.12, 0x2e4a5e, 0, 2.3, d / 2 + 0.06));
  return { group: g, height: h + (isCorner ? 2.6 : 0.7) };
}

// Window quads (vertex-coloured) for one building face, merged into the
// shared glass mesh. Windows are a tidy grid, dark glass with 30–40%
// warm-lit in vertical groups — never a checkerboard.
function windowsFor(face, w, h, d, rnd) {
  // face: 'front' (+z), 'back' (-z), 'left' (-x), 'right' (+x).
  const quads = [];
  const cols = Math.max(2, Math.floor(w / 1.6));
  const rows = Math.max(2, Math.floor((h - 4) / 2));
  // One lit-group per column (a vertical run of lit windows).
  const litCols = new Set();
  for (let c = 0; c < cols; c++) if (rnd() < 0.4) litCols.add(c);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = litCols.has(c) && r < rows - 1;
      const col = lit ? 0xffc46b : 0x1e2a32;
      const wx = (c - (cols - 1) / 2) * (w / cols);
      const wy = 4.5 + r * 2;
      const q = new THREE.PlaneGeometry(0.9, 1.2);
      if (face === 'front') q.translate(wx, wy, d / 2 + 0.06);
      else if (face === 'back') { q.rotateY(Math.PI); q.translate(wx, wy, -d / 2 - 0.06); }
      else if (face === 'left') { q.rotateY(-Math.PI / 2); q.translate(-w / 2 - 0.06, wy, wx); }
      else { q.rotateY(Math.PI / 2); q.translate(w / 2 + 0.06, wy, wx); }
      quads.push(colored(q, col));
    }
  }
  return quads;
}

export function buildCommercialRing() {
  const rnd = seededRandom(20261121);
  const atlas = buildSignAtlas();
  const group = new THREE.Group();
  group.name = 'commercialRing';
  const colliders = [];
  const tickers = [];
  const lanes = [];
  const pedPaths = [];
  const concrete = [];
  const glass = [];
  const signGeos = []; // atlas quads (shop signs + billboards) — 1 mesh
  const neonGeos = []; // vertex-coloured neon quads — 1 mesh
  let buildingCount = 0;
  let shopIdx = 0;

  // --- fill each block along its perimeter ---
  // ITEM 2 (D): the old fill stacked a north AND a south row in blocks
  // only 5.5 deep — the two rows (each ~4.5 deep) overlapped almost
  // completely, so the ring read as one continuous mass. Shallow
  // blocks (bd < 7.5) now get ONE row down the middle, alternating
  // facing north/south so both streets get shopfronts; deep blocks
  // get two rows placed by their actual depth (dRow), so no row
  // overhangs the block edge. Side buildings only fit when the gap
  // between the two rows is >= 4 (bd >= 13) — none of the D blocks
  // are that deep, so nZ is 0 here (kept for future deeper blocks).
  for (const b of BLOCKS) {
    const bw = b.x1 - b.x0;
    const bd = b.z1 - b.z0;
    // Buildings along the north + south edges (spacing ~3.5, 3–4 wide).
    // They face OUTWARD, toward the street — shop fronts, awnings and
    // signs on the street side, not the courtyard. (The original fill
    // faced them inward, so the avenue saw only blank backs.)
    const spots = [];
    const nX = Math.max(1, Math.floor(bw / 3.5));
    const twoRows = bd >= 7.5;
    const dRow = twoRows ? Math.min(4.4, (bd - 0.4) / 2) : Math.min(5, bd - 0.4);
    if (twoRows) {
      for (let i = 0; i < nX; i++) {
        const x = b.x0 + (i + 0.5) * (bw / nX);
        spots.push({ x, z: b.z0 + dRow / 2 + 0.2, ry: Math.PI, edge: 'north' });
        spots.push({ x, z: b.z1 - dRow / 2 - 0.2, ry: 0, edge: 'south' });
      }
    } else {
      const zc = (b.z0 + b.z1) / 2;
      for (let i = 0; i < nX; i++) {
        const x = b.x0 + (i + 0.5) * (bw / nX);
        spots.push({ x, z: zc, ry: i % 2 ? 0 : Math.PI, edge: i % 2 ? 'south' : 'north' });
      }
    }
    // Buildings along the east + west edges (only when the middle gap
    // between the two rows is wide enough for a building).
    const nZ = bd >= 13 ? Math.max(1, Math.floor((bd - 8.8) / 5)) : 0;
    for (let i = 0; i < nZ; i++) {
      const z = b.z0 + (i + 1) * (bd / (nZ + 1));
      spots.push({ x: b.x0 + 2.2, z, ry: -Math.PI / 2, edge: 'west' });
      spots.push({ x: b.x1 - 2.2, z, ry: Math.PI / 2, edge: 'east' });
    }
    // The market hall + the garage replace the perimeter fill.
    if (b.kind === 'market') {
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const hall = new THREE.Group();
      hall.add(box(bw - 1, 0.4, bd - 1, 0x8a7a5a, 0, 4.6, 0));
      hall.add(box(bw - 1, 0.2, bd - 1, 0xb4552d, 0, 4.9, 0));
      for (const px of [-bw / 4, 0, bw / 4]) {
        for (const pz of [-bd / 4, bd / 4]) hall.add(box(0.4, 4.6, 0.4, 0x6e6a64, px, 2.3, pz));
      }
      for (let i = 0; i < 6; i++) {
        const sx = -bw / 2 + 2 + (i % 3) * (bw / 3);
        const sz = -bd / 4 + Math.floor(i / 3) * (bd / 2);
        hall.add(box(2.2, 1.0, 1.2, 0x8a6a4a, sx, 0.5, sz));
        hall.add(box(2.2, 0.1, 1.4, i % 2 ? 0xf7ebd7 : 0xc93a6b, sx, 1.6, sz));
      }
      hall.position.set(cx, 0, cz);
      group.add(hall);
      colliders.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, id: 'market-hall' });
      buildingCount += 1;
      continue;
    }
    if (b.kind === 'garage') {
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const gar = new THREE.Group();
      for (let level = 0; level < 3; level++) {
        gar.add(box(bw - 1, 0.4, bd - 1, 0x8f8880, 0, level * 3 + 0.2, 0));
        for (let i = 0; i < 3; i++) {
          const car = box(1.8, 0.7, 4.2, [0xe4572e, 0x2e7f8f, 0xe8c33d][i], -bw / 4 + i * (bw / 4), level * 3 + 0.8, 0);
          gar.add(car);
        }
      }
      for (const px of [-bw / 2 + 0.5, bw / 2 - 0.5]) {
        for (const pz of [-bd / 2 + 0.5, bd / 2 - 0.5]) gar.add(box(0.5, 9.4, 0.5, 0x6e6a64, px, 4.7, pz));
      }
      gar.position.set(cx, 0, cz);
      group.add(gar);
      colliders.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, id: 'parking-garage' });
      buildingCount += 1;
      continue;
    }
    // Perimeter buildings. Width fits the column (bw/nX) with a
    // 0.2 gap so neighbours never intersect; depth fits the row
    // (dRow) so no building overhangs the block edge. (Side
    // buildings, when nZ > 0, use the same w — their width runs
    // along z, so a future deeper block should clamp w to the side
    // spacing instead.)
    for (const [i, s] of spots.entries()) {
      const isCorner = i === 0 || i === 1;
      const floors = b.kind === 'hotel' ? 15 : 6 + Math.floor(rnd() * 10);
      const w = Math.min(3.2 + rnd() * 0.8, bw / nX - 0.2);
      const d = Math.min(4 + rnd() * 1.5, dRow);
      const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
      // Named signs only on the north/south edges (the buildings facing
      // the main east-west streets); side-street shops keep awning +
      // glass, no sign (draw-call budget).
      const onMainStreet = s.edge === 'north' || s.edge === 'south';
      const shopName = onMainStreet ? SHOP_NAMES[shopIdx % SHOP_NAMES.length] : null;
      if (onMainStreet) shopIdx += 1;
      const { group: bg, height } = commercialBuilding(rnd, floors, w, d, color, isCorner);
      bg.position.set(s.x, 0, s.z);
      bg.rotation.y = s.ry;
      // The building's parts are already positioned in local space;
      // bake each mesh into world space and merge it into the shared
      // concrete mesh, keeping the mesh's own material colour as the
      // vertex colour.
      bg.updateMatrixWorld(true);
      bg.traverse((o) => {
        if (o.isMesh && o.geometry) {
          const geo = o.geometry.clone();
          geo.applyMatrix4(o.matrixWorld);
          const hex = (o.material && o.material.color) ? o.material.color.getHex() : 0xffffff;
          concrete.push(colored(geo, hex));
        }
      });
      // Windows on the street-facing + side faces (merged glass).
      const winFaces = ['front', 'left', 'right'];
      for (const f of winFaces) {
        const quads = windowsFor(f, w, floors * 2, d, rnd);
        for (const q of quads) {
          // Rotate the window quad into world space (building rotation).
          const g2 = q.clone();
          const m = new THREE.Matrix4().makeRotationY(s.ry);
          m.setPosition(s.x, 0, s.z);
          g2.applyMatrix4(m);
          glass.push(g2);
        }
      }
      // The shop sign: one atlas quad, merged with all the other
      // signs (1 draw call for every sign in the ring). Same position
      // the old single-mesh sign had: (0, 3.4, d/2 + 0.08) local,
      // rotated by the building's facing, at the building's spot.
      if (shopName) {
        const plate = atlas.plates.get(shopName);
        const sq = remapUV(new THREE.PlaneGeometry(Math.min(w * 0.85, 4.2), 0.9), plate);
        sq.translate(0, 3.4, d / 2 + 0.08);
        const m = new THREE.Matrix4().makeRotationY(s.ry);
        m.setPosition(s.x, 0, s.z);
        sq.applyMatrix4(m);
        signGeos.push(sq);
      }
      colliders.push({
        // Side-edge buildings are rotated 90 deg, so their width runs
        // along z and their depth along x — swap w/d in the collider.
        x0: s.x - (Math.abs(s.ry) === Math.PI / 2 ? d : w) / 2,
        z0: s.z - (Math.abs(s.ry) === Math.PI / 2 ? w : d) / 2,
        x1: s.x + (Math.abs(s.ry) === Math.PI / 2 ? d : w) / 2,
        z1: s.z + (Math.abs(s.ry) === Math.PI / 2 ? w : d) / 2,
        id: `commercial-${buildingCount}`,
      });
      buildingCount += 1;
      void height;
    }
  }

  // --- merged meshes ---
  const concreteMesh = mergedMesh(concrete, vertexColorMat);
  concreteMesh.name = 'commercial-concrete';
  group.add(concreteMesh);
  const glassMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.25, metalness: 0.4,
    emissive: 0xffffff, emissiveIntensity: 0.25,
  });
  const glassMesh = mergedMesh(glass, glassMat);
  glassMesh.name = 'commercial-glass';
  group.add(glassMesh);

  // --- billboards on 2 fixed-height rooftops (fictional ads, atlas plates) ---
  // They sit on the market hall (5 tall) and the hotel (30 tall) so
  // they are never buried inside a random-height building — the old
  // spots (x 51/-51, z -18) sat inside 12–30-tall buildings.
  const billboards = [
    { x: 50, z: -51.75, y: 7, ry: Math.PI / 2, text: 'SOL' },
    { x: 56, z: -51.75, y: 7, ry: -Math.PI / 2, text: 'VELA' },
    { x: 1, z: -51.75, y: 32, ry: 0, text: 'AZZURA' },
    { x: 1, z: -51.75, y: 32, ry: Math.PI, text: 'PORTO' },
  ];
  for (const bb of billboards) {
    const plate = atlas.plates.get(bb.text);
    const sq = remapUV(new THREE.PlaneGeometry(6, 2.4), plate);
    sq.rotateY(bb.ry);
    sq.translate(bb.x, bb.y, bb.z);
    signGeos.push(sq);
    const post = colored(xform(new THREE.BoxGeometry(0.3, 2, 0.3), bb.x, bb.y - 1, bb.z), 0x2b2b2b);
    concrete.push(post);
  }

  // --- neon signs on 6 shopfronts (merged, vertex colours) ---
  // The text is dropped (a merged mesh cannot carry 6 different
  // canvas textures) — the neon is a glowing colour bar, the shop's
  // name already sits on its sign band above the awning.
  const neons = [
    { x: -27, z: -46.5, color: 0xff5c8a },
    { x: 3.5, z: -46.5, color: 0x3ed6d6 },
    { x: 52, z: -36, color: 0xffc46b },
    { x: 50, z: -7.5, color: 0xff5c8a },
    { x: -51, z: -7.5, color: 0x3ed6d6 },
    { x: -51, z: 21.5, color: 0xffc46b },
  ];
  for (const n of neons) {
    const q = colored(new THREE.PlaneGeometry(3.2, 0.8), n.color);
    q.translate(n.x, 4.2, n.z);
    neonGeos.push(q);
  }
  if (neonGeos.length) {
    const neonMesh = mergedMesh(neonGeos, new THREE.MeshBasicMaterial({ vertexColors: true }));
    neonMesh.name = 'commercial-neon';
    neonMesh.castShadow = false;
    group.add(neonMesh);
  }
  if (signGeos.length) {
    const signMesh = mergedMesh(signGeos, new THREE.MeshBasicMaterial({ map: atlas.texture }));
    signMesh.name = 'commercial-signs';
    signMesh.castShadow = false;
    group.add(signMesh);
  }

  // --- pedestrian paths along the ring avenue + the boulevard ---
  // GRID REBUILD: the z -37.5 path ran through CBD blocks (the north
  // strip's south row is gone); the boulevard path moves to the south
  // sidewalk (z 1.5) of the narrowed boulevard (sidewalks to z 2.25).
  pedPaths.push(
    { a: { x: -56, z: -46.5 }, b: { x: 56, z: -46.5 } },
    { a: { x: -56, z: 1.5 }, b: { x: 56, z: 1.5 } },
  );

  return {
    group, colliders, tickers, lanes, pedPaths,
    count: buildingCount, blocks: BLOCKS.length,
  };
}
