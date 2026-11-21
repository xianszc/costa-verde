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
// North strip (z -54..-30), split by the ring avenue (z -45.5..-38.5)
// into two rows. East strip (x 28..60, z -30..14) and west strip
// (x -60..-28, z -30..22), split by the boulevard (z -6..6) and the
// x +/-44 side streets. The old town (x -60..-34, z -52..-26) and the
// promenade (x 8..60, z 14..30) / marina (x -30..8, z 22..30) are NOT
// blocks here — parts 4 and 5 build them.
const BLOCKS = [
  // North strip, north row (z -53..-47.5).
  { x0: -33, z0: -53, x1: -21, z1: -47.5, kind: 'commercial' },
  { x0: -17, z0: -53, x1: -6, z1: -47.5, kind: 'commercial' },
  { x0: -2, z0: -53, x1: 9, z1: -47.5, kind: 'hotel' },
  { x0: 13, z0: -53, x1: 24, z1: -47.5, kind: 'commercial' },
  { x0: 28, z0: -53, x1: 39, z1: -47.5, kind: 'commercial' },
  { x0: 43, z0: -53, x1: 59, z1: -47.5, kind: 'market' },
  // North strip, south row (z -37.5..-31) — the x 40 ring connector
  // (36.5..43.5) cuts through, so the two blocks beside it stop short.
  { x0: -33, z0: -37.5, x1: -21, z1: -31, kind: 'commercial' },
  { x0: -17, z0: -37.5, x1: -6, z1: -31, kind: 'commercial' },
  { x0: -2, z0: -37.5, x1: 9, z1: -31, kind: 'commercial' },
  { x0: 13, z0: -37.5, x1: 22, z1: -31, kind: 'garage' },
  // (The block x 28..35 in this row is the PARK — a planned green
  // zone, not a building block; the block x 46..59 in the east strip
  // is the harbormaster pavilion's block — M1/M2/M4/M8/M12 stage there
  // until the marina moves in part 5. Both are left open here.)
  { x0: 45, z0: -37.5, x1: 59, z1: -31, kind: 'commercial' },
  // East strip (x 28..60, z -30..14).
  { x0: 29, z0: -29, x1: 43, z1: -7, kind: 'commercial' },
  { x0: 29, z0: 7, x1: 43, z1: 13, kind: 'commercial' },
  { x0: 46, z0: 7, x1: 59, z1: 13, kind: 'commercial' },
  // West strip (x -60..-28, z -30..22).
  { x0: -59, z0: -29, x1: -45, z1: -7, kind: 'commercial' },
  { x0: -43, z0: -29, x1: -29, z1: -7, kind: 'commercial' },
  { x0: -59, z0: 7, x1: -45, z1: 21, kind: 'commercial' },
  { x0: -43, z0: 7, x1: -29, z1: 21, kind: 'commercial' },
];

const PALETTE = [
  0xefe3c8, 0xe8c98a, 0xd8a05a, 0xc96a4a, 0x7a9a8a, 0x8fa8b8,
  0xb88a6a, 0xd8b8a8, 0xe8d8b8, 0xa8b89a, 0xc9a86a, 0x9a8a7a,
];
const SHOP_NAMES = [
  'CAFÉ LUME', 'FORNO AZZURRO', 'PESCHERIA', 'GELATO SOL',
  'BAR VERDE', 'TABACCHI', 'FARMACIA', 'PANETTERIA',
  'MACELLERIA', 'FIORI', 'LIBRERIA', 'OROLOGERIA',
];
const SHOP_COLORS = ['#1e2a32', '#7a2e2e', '#1f7a8c', '#c98a3a', '#2e5a3a', '#5a3a6a'];

// Canvas sign texture (fictional shop name, like the showcase signs).
function shopTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg; ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A mid-rise building (6–15 floors = 12–30 units tall). The shopfront
// (awning + glass) faces the street (outward normal `facing`, in
// radians — the front face is at local +z after rotation). The named
// sign is only on the buildings that face the main east-west streets
// (boulevard / ring avenue) — one sign per building would be ~140
// draw calls; the side-street shops keep the awning + glass.
function commercialBuilding(rnd, floors, w, d, color, shopName, shopColor, isCorner) {
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
  if (shopName) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.85, 4.2), 0.9),
      new THREE.MeshBasicMaterial({ map: shopTexture(shopName, shopColor, '#f7ebd7') }),
    );
    sign.position.set(0, 3.4, d / 2 + 0.08);
    g.add(sign);
  }
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
  const group = new THREE.Group();
  group.name = 'commercialRing';
  const colliders = [];
  const tickers = [];
  const lanes = [];
  const pedPaths = [];
  const concrete = [];
  const glass = [];
  let buildingCount = 0;
  let shopIdx = 0;

  // --- fill each block along its perimeter ---
  for (const b of BLOCKS) {
    const bw = b.x1 - b.x0;
    const bd = b.z1 - b.z0;
    // Buildings along the north + south edges (spacing ~5, 4–5 wide).
    const spots = [];
    const nX = Math.max(2, Math.floor(bw / 5));
    for (let i = 0; i < nX; i++) {
      const x = b.x0 + (i + 0.5) * (bw / nX);
      spots.push({ x, z: b.z0 + 2.2, ry: 0, edge: 'north' });
      spots.push({ x, z: b.z1 - 2.2, ry: Math.PI, edge: 'south' });
    }
    // Buildings along the east + west edges (skip the corners).
    const nZ = Math.max(1, Math.floor(bd / 5) - 1);
    for (let i = 0; i < nZ; i++) {
      const z = b.z0 + (i + 1) * (bd / (nZ + 1));
      spots.push({ x: b.x0 + 2.2, z, ry: Math.PI / 2, edge: 'west' });
      spots.push({ x: b.x1 - 2.2, z, ry: -Math.PI / 2, edge: 'east' });
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
    // Perimeter buildings.
    for (const [i, s] of spots.entries()) {
      const isCorner = i === 0 || i === 1;
      const floors = b.kind === 'hotel' ? 15 : 6 + Math.floor(rnd() * 10);
      const w = 4 + rnd() * 1;
      const d = 4 + rnd() * 1.5;
      const color = PALETTE[Math.floor(rnd() * PALETTE.length)];
      // Named signs only on the north/south edges (the buildings facing
      // the main east-west streets); side-street shops keep awning +
      // glass, no sign (draw-call budget).
      const onMainStreet = s.edge === 'north' || s.edge === 'south';
      const shopName = onMainStreet ? SHOP_NAMES[shopIdx % SHOP_NAMES.length] : null;
      const shopColor = onMainStreet ? SHOP_COLORS[shopIdx % SHOP_COLORS.length] : null;
      if (onMainStreet) shopIdx += 1;
      const { group: bg, height } = commercialBuilding(rnd, floors, w, d, color, shopName, shopColor, isCorner);
      bg.position.set(s.x, 0, s.z);
      bg.rotation.y = s.ry;
      // The building's parts are already positioned in local space;
      // bake each mesh into world space and merge it into the shared
      // concrete mesh, keeping the mesh's own material colour as the
      // vertex colour. Signs (material.map) are skipped — they are
      // added as single meshes below.
      bg.updateMatrixWorld(true);
      let signMesh = null;
      bg.traverse((o) => {
        if (o.isMesh && o.geometry) {
          if (o.material && o.material.map) { signMesh = o; return; }
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
      // The shop sign (own texture) as a single mesh in world space.
      if (signMesh) {
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        signMesh.getWorldPosition(pos);
        signMesh.getWorldQuaternion(quat);
        const sm = new THREE.Mesh(signMesh.geometry, signMesh.material);
        sm.position.copy(pos);
        sm.quaternion.copy(quat);
        group.add(sm);
      }
      colliders.push({
        x0: s.x - w / 2, z0: s.z - d / 2, x1: s.x + w / 2, z1: s.z + d / 2,
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

  // --- billboards on 4 rooftops (fictional ads) ---
  const billboards = [
    { x: 3.5, z: -50, text: 'AZZURA', bg: '#1e2a32', fg: '#ffd9a0' },
    { x: 52, z: -50, text: 'SOL', bg: '#c93a6b', fg: '#f7ebd7' },
    { x: 36, z: -18, text: 'VELA', bg: '#1f7a8c', fg: '#f7ebd7' },
    { x: -51, z: -18, text: 'PORTO', bg: '#7a2e2e', fg: '#f7ebd7' },
  ];
  for (const bb of billboards) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 2.4),
      new THREE.MeshBasicMaterial({ map: shopTexture(bb.text, bb.bg, bb.fg) }),
    );
    sign.position.set(bb.x, 26, bb.z);
    sign.rotation.y = bb.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(sign);
    const post = box(0.3, 4, 0.3, 0x2b2b2b, bb.x, 22, bb.z);
    group.add(post);
  }

  // --- neon signs on 6 shopfronts (emissive, static) ---
  const neons = [
    { x: -27, z: -46.5, text: 'BAR', color: 0xff5c8a },
    { x: 3.5, z: -46.5, text: 'HOTEL', color: 0x3ed6d6 },
    { x: 52, z: -36, text: 'CINEMA', color: 0xffc46b },
    { x: 36, z: -7.5, text: 'DISCO', color: 0xff5c8a },
    { x: -51, z: -7.5, text: 'PIZZA', color: 0x3ed6d6 },
    { x: -36, z: 14, text: 'MERCATO', color: 0xffc46b },
  ];
  for (const n of neons) {
    const neon = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.8),
      new THREE.MeshBasicMaterial({ color: n.color }),
    );
    neon.position.set(n.x, 4.2, n.z);
    group.add(neon);
  }

  // --- pedestrian paths along the ring avenue + the boulevard ---
  pedPaths.push(
    { a: { x: -56, z: -46.5 }, b: { x: 56, z: -46.5 } },
    { a: { x: -56, z: -37.5 }, b: { x: 56, z: -37.5 } },
    { a: { x: -56, z: 7.25 }, b: { x: 56, z: 7.25 } },
  );

  return {
    group, colliders, tickers, lanes, pedPaths,
    count: buildingCount, blocks: BLOCKS.length,
  };
}
