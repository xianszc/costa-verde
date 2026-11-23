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
  mergedMesh, colored, xform, vertexColorMat, seededRandom,
} from './world.js';
import { cbdGridBlocks, CBD_NS } from './cbd-grid.js';
import { buildSignAtlas, remapUV, SHOP_NAMES } from './commercial.js';

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
  const paveGeos = []; // darker paving: border frames + accent squares
  const parkedGeos = []; // parked cars (vertex colours, one mesh)
  const signGeos = []; // atlas quads (ground-floor shop signs) — 1 mesh
  // The atlas needs a canvas (DOM): in Node (the overlap test) there
  // is none, so the signs are skipped there — the test only checks
  // the colliders, and the shopfront glass / awnings / doors still
  // build. In the browser the atlas is built and the signs merge.
  const atlas = typeof document === 'undefined' ? null : buildSignAtlas(); // shared with the ring (C)
  const AWN_COLORS = [0xc93a6b, 0x1f7a8c, 0xe8a33d, 0x2e5a3a, 0xf7ebd7];
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

  // Dense curtain-wall grid (C): one window per floor, cols every
  // 1.6 — never the sparse dashes. PlaneGeometry (2 tris each),
  // merged into winGeos (1 draw call for all towers). Lit columns
  // (30-40% warm) run vertically, never a checkerboard. A spandrel
  // band every 4 floors + thin vertical fins at the face edges give
  // the facade its mullion / band rhythm.
  function addWindows(cx, cz, w, d, h, floors) {
    const rows = Math.max(2, Math.floor((h - 4) / 2));
    const faces = [
      { rot: 0, off: [0, d / 2 + 0.06], fw: w, flip: false }, // south
      { rot: 0, off: [0, -d / 2 - 0.06], fw: w, flip: true }, // north
      { rot: 1, off: [w / 2 + 0.06, 0], fw: d, flip: false }, // east
      { rot: 1, off: [-w / 2 - 0.06, 0], fw: d, flip: true }, // west
    ];
    for (const f of faces) {
      const cols = Math.max(2, Math.floor(f.fw / 1.6));
      const litCols = new Set();
      for (let c = 0; c < cols; c++) if (rnd() < 0.4) litCols.add(c);
      const place = (geo, along, wy) => {
        if (f.rot) {
          geo.rotateY(f.flip ? -Math.PI / 2 : Math.PI / 2);
          geo.translate(cx + f.off[0], wy, cz + along);
        } else {
          if (f.flip) geo.rotateY(Math.PI);
          geo.translate(cx + along, wy, cz + f.off[1]);
        }
        return geo;
      };
      for (let ri = 0; ri < rows; ri++) {
        for (let ci = 0; ci < cols; ci++) {
          const lit = litCols.has(ci) && ri < rows - 1;
          const wy = 3.5 + ri * 2;
          const along = (ci - (cols - 1) / 2) * (f.fw / cols);
          winGeos.push(colored(place(new THREE.PlaneGeometry(0.9, 1.2), along, wy), lit ? 0xffc46b : 0x1e2a32));
        }
      }
      // Spandrel band every 4 floors (horizontal accent strip).
      for (let ri = 3; ri < rows; ri += 4) {
        const wy = 3.5 + ri * 2 - 1.0;
        winGeos.push(colored(place(new THREE.PlaneGeometry(f.fw * 0.96, 0.35), 0, wy), 0x2e4a5e));
      }
      // Vertical fins at the face's two edges (thin ribs, full height).
      for (const edge of [-1, 1]) {
        const along = edge * (f.fw / 2 - 0.1);
        winGeos.push(colored(place(new THREE.PlaneGeometry(0.18, h - 3), along, 1.5 + h / 2), 0x2e4a5e));
      }
    }
  }

  // Ground floor (C): continuous shop fronts on a tower's podium
  // skirt (or a twin podium's base) — large glass panels, a coloured
  // striped awning above each, a fictional-brand atlas sign above the
  // awning on every face, a dark entrance door on the south face, and
  // a café table + umbrella + two chairs on the south rim. All merged
  // into the existing meshes (winGeos / crownGeos / signGeos /
  // concGeos) — the shopfronts cost 1 extra draw call (the sign mesh).
  function addShopfront(cx, cz, w, d, brand, awnCol) {
    const sw = w + 0.8, sd = d + 0.8; // skirt footprint
    const facePlane = (geo, face, along, wy, out) => {
      if (face === 's') geo.translate(cx + along, wy, cz + out);
      else if (face === 'n') { geo.rotateY(Math.PI); geo.translate(cx + along, wy, cz - out); }
      else if (face === 'e') { geo.rotateY(Math.PI / 2); geo.translate(cx + out, wy, cz + along); }
      else { geo.rotateY(-Math.PI / 2); geo.translate(cx - out, wy, cz + along); }
      return geo;
    };
    for (const face of ['s', 'n', 'e', 'w']) {
      const fw = (face === 's' || face === 'n') ? sw : sd;
      // Large glass storefront on the skirt face.
      winGeos.push(colored(facePlane(new THREE.PlaneGeometry(fw * 0.82, 0.7), face, 0, 0.55, (face === 's' || face === 'n' ? sd : sw) / 2 + 0.06), 0x9fd4d8));
      // Coloured awning above the glass (tilted, projecting 0.6).
      const aOff = (face === 's' || face === 'n' ? sd : sw) / 2 + 0.3;
      if (face === 's') crownGeos.push(colored(xform(new THREE.BoxGeometry(fw * 0.9, 0.08, 0.6), cx, 1.05, cz + aOff, 0, 1, 0.35, 0), awnCol));
      else if (face === 'n') crownGeos.push(colored(xform(new THREE.BoxGeometry(fw * 0.9, 0.08, 0.6), cx, 1.05, cz - aOff, 0, 1, -0.35, 0), awnCol));
      else if (face === 'e') crownGeos.push(colored(xform(new THREE.BoxGeometry(0.6, 0.08, fw * 0.9), cx + aOff, 1.05, cz, 0, 1, 0, -0.35), awnCol));
      else crownGeos.push(colored(xform(new THREE.BoxGeometry(0.6, 0.08, fw * 0.9), cx - aOff, 1.05, cz, 0, 1, 0, 0.35), awnCol));
      // Brand sign above the awning, on the tower body (set back 0.4
      // from the skirt face). Skipped in Node (no atlas — see above).
      if (atlas) {
        const plate = atlas.plates.get(brand);
        const tOut = (face === 's' || face === 'n' ? d : w) / 2 + 0.06;
        signGeos.push(remapUV(facePlane(new THREE.PlaneGeometry(2.2, 0.55), face, 0, 1.75, tOut), plate));
      }
    }
    // Entrance door on the south face, proud of the glass.
    winGeos.push(colored(facePlane(new THREE.PlaneGeometry(0.9, 1.6), 's', 0, 0.8, sd / 2 + 0.08), 0x2b2b2b));
  }

  function addTower(cx, cz, w, d, floors, variant) {
    const h = floors * FLOOR_H;
    const glass = rnd() > 0.45;
    const body = xform(new THREE.BoxGeometry(w, h, d), cx, h / 2, cz);
    (glass ? glassGeos : concGeos).push(colored(body, 0xffffff));
    // Height tint (Xian 21 Nov 16:04 — heights must read in the map
    // shots): a thin roof cap whose colour runs pale stone (20 floors)
    // to deep gold (60 floors), so the tower's height reads from above.
    const tint = Math.max(0, Math.min(1, (floors - 20) / 40));
    const capCol = new THREE.Color(0xd8d2c4).lerp(new THREE.Color(0xc9a227), tint).getHex();
    crownGeos.push(colored(xform(new THREE.BoxGeometry(w * 0.92, 0.25, d * 0.92), cx, h + 0.12, cz), capCol));
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
      // Small central fountain (Xian 21 Nov 16:04): the park's paths
      // cross at the centre, so the fountain sits on the crossing.
      concGeos.push(colored(xform(new THREE.CylinderGeometry(1.0, 1.1, 0.5, 12), b.cx, 0.25, b.cz), 0xffffff));
      winGeos.push(colored(xform(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 12), b.cx, 0.45, b.cz), 0x9fd4d8));
      colliders.push({ x0: b.cx - 1.1, z0: b.cz - 1.1, x1: b.cx + 1.1, z1: b.cz + 1.1, id: 'cbd-fountain' });
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
      // Kiosk on the north edge centre + 3 parked cars (south / east /
      // west edges). The plaza is the only CBD block with room for
      // them: the single-tower blocks' rims are too narrow for a car,
      // and a car in a driving lane would block the traffic AI.
      const kx = b.cx, kz = b.z0 + 0.9;
      concGeos.push(colored(xform(new THREE.BoxGeometry(1.6, 2.2, 1.4), kx, 1.1, kz), 0xffffff));
      crownGeos.push(colored(xform(new THREE.BoxGeometry(1.8, 0.12, 1.0), kx, 2.35, kz + 0.9), 0xc93a6b));
      crownGeos.push(colored(xform(new THREE.BoxGeometry(1.6, 0.5, 0.1), kx, 1.9, kz + 0.75), 0x1e2a32));
      colliders.push({ x0: kx - 0.8, z0: kz - 0.7, x1: kx + 0.8, z1: kz + 0.7, id: 'cbd-kiosk' });
      const parkedCols = [0xd9553a, 0x2e7f8f, 0xe8b93c];
      // The side cars sit 0.8 north of the centre: on the 7.1-wide
      // plaza the three cars' corners met (their colliders overlapped
      // by 0.05) — the shift clears the south car by 0.33.
      const parkedSpots = [
        { x: b.cx, z: b.z1 - 1.0, ry: 0 },
        { x: b.x1 - 1.0, z: b.cz - 0.8, ry: Math.PI / 2 },
        { x: b.x0 + 1.0, z: b.cz - 0.8, ry: -Math.PI / 2 },
      ];
      parkedSpots.forEach((s, i) => {
        const col = parkedCols[i % parkedCols.length];
        parkedGeos.push(colored(xform(new THREE.BoxGeometry(4.2, 0.55, 1.85), s.x, 0.58, s.z, s.ry), col));
        parkedGeos.push(colored(xform(new THREE.BoxGeometry(1.8, 0.55, 1.4), s.x, 1.05, s.z, s.ry), 0x2e4a5e));
        for (const [wx, wz] of [[1.4, 0.85], [1.4, -0.85], [-1.4, 0.85], [-1.4, -0.85]]) {
          // Wheel offsets rotate with the car (rotation about Y).
          const wwx = s.x + wx * Math.cos(s.ry) + wz * Math.sin(s.ry);
          const wwz = s.z - wx * Math.sin(s.ry) + wz * Math.cos(s.ry);
          parkedGeos.push(colored(xform(new THREE.BoxGeometry(0.5, 0.5, 0.3), wwx, 0.25, wwz, s.ry), 0x1a1a1a));
        }
        // The collider is inset 0.3 from the visual car (4.2 long):
        // on the 7.1-wide plaza the three cars' corners met, and the
        // full-size colliders overlapped each other by 0.2 (B) — the
        // side cars sit 0.8 north of the centre (above), so the
        // colliders clear each other and the south car.
        const alongZ = Math.abs(Math.sin(s.ry)) > 0.5;
        colliders.push(alongZ
          ? { x0: s.x - 0.8, z0: s.z - 1.8, x1: s.x + 0.8, z1: s.z + 1.8, id: 'cbd-parked' }
          : { x0: s.x - 1.8, z0: s.z - 0.8, x1: s.x + 1.8, z1: s.z + 0.8, id: 'cbd-parked' });
      });
      continue;
    }
    if (b.kind === 'twin') {
      // Twin pair on a shared podium: low retail slab with shop
      // fronts, two towers rising from it.
      const pw = 7.0, pd = 7.0, ph = 5;
      concGeos.push(colored(xform(new THREE.BoxGeometry(pw, ph, pd), b.cx, ph / 2, b.cz), 0xffffff));
      concGeos.push(colored(xform(new THREE.BoxGeometry(pw * 1.04, 0.4, pd * 1.04), b.cx, ph + 0.2, b.cz), 0xffffff));
      colliders.push({ x0: b.cx - pw / 2, z0: b.cz - pd / 2, x1: b.cx + pw / 2, z1: b.cz + pd / 2, id: 'cbd-podium' });
      podiumCount++;
      // Ground-floor shop fronts on the podium base (C): the podium
      // is 7.0 wide, so the shopfront is called with w/d 6.2 (the
      // skirt becomes 7.0). The old single glass panel is gone —
      // addShopfront provides the glass + awnings + signs + door.
      addShopfront(b.cx, b.cz, 6.2, 6.2, SHOP_NAMES[(towerCount + 3) % SHOP_NAMES.length], AWN_COLORS[(towerCount + 1) % AWN_COLORS.length]);
      // Paved border around the podium (the rim is too narrow for
      // trees or cars — the paving pattern is the fill here).
      const tfw = bw - 0.4, tfd = bd - 0.4;
      paveGeos.push(colored(xform(new THREE.BoxGeometry(tfw, 0.2, 0.5), b.cx, 0.1, b.z0 + 0.45), 0xffffff));
      paveGeos.push(colored(xform(new THREE.BoxGeometry(tfw, 0.2, 0.5), b.cx, 0.1, b.z1 - 0.45), 0xffffff));
      paveGeos.push(colored(xform(new THREE.BoxGeometry(0.5, 0.2, tfd), b.x0 + 0.45, 0.1, b.cz), 0xffffff));
      paveGeos.push(colored(xform(new THREE.BoxGeometry(0.5, 0.2, tfd), b.x1 - 0.45, 0.1, b.cz), 0xffffff));
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
    // Low podium base (B): a 1-unit plinth, slightly wider than the
    // tower, so the tower rises from a base with shop fronts (C)
    // instead of straight from the sidewalk — no canyon feel. (Not
    // counted in podiumCount: that number is the twin shared podiums.)
    concGeos.push(colored(xform(new THREE.BoxGeometry(w + 0.8, 1.0, d + 0.8), b.cx, 0.5, b.cz), 0xffffff));
    colliders.push({ x0: b.cx - (w + 0.8) / 2, z0: b.cz - (d + 0.8) / 2, x1: b.cx + (w + 0.8) / 2, z1: b.cz + (d + 0.8) / 2, id: 'cbd-podium' });
    // Ground-floor shop fronts on the plinth (C) + a café table with
    // an umbrella and two chairs on the south rim (outdoor seating).
    const brand = SHOP_NAMES[towerCount % SHOP_NAMES.length];
    const awnCol = AWN_COLORS[towerCount % AWN_COLORS.length];
    addShopfront(b.cx, b.cz, w, d, brand, awnCol);
    const tx = b.cx - 2.0, tz = b.z1 - 0.6; // west of the south bench; the east corner holds a fill tree
    concGeos.push(colored(xform(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), tx, 0.72, tz), 0xffffff));
    concGeos.push(colored(xform(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), tx, 0.35, tz), 0xffffff));
    concGeos.push(colored(xform(new THREE.BoxGeometry(0.4, 0.08, 0.4), tx - 0.6, 0.45, tz), 0xffffff));
    concGeos.push(colored(xform(new THREE.BoxGeometry(0.4, 0.45, 0.08), tx - 0.6, 0.68, tz - 0.2), 0xffffff));
    concGeos.push(colored(xform(new THREE.BoxGeometry(0.4, 0.08, 0.4), tx + 0.6, 0.45, tz), 0xffffff));
    concGeos.push(colored(xform(new THREE.BoxGeometry(0.4, 0.45, 0.08), tx + 0.6, 0.68, tz - 0.2), 0xffffff));
    crownGeos.push(colored(xform(new THREE.ConeGeometry(0.9, 0.5, 8), tx, 1.65, tz), awnCol));
    // ---- block fill (Xian 21 Nov 16:04): no empty tan ground ----
    // The rim between the tower and the block edge is only ~1.2 wide,
    // so the fill is flat paving + small trees / planters / a bench —
    // all merged (the fill costs 2 draw calls: the paving tone and
    // the parked cars). Kiosks and parked cars live on the plaza
    // block, the only CBD block with room for them.
    const fw = bw - 0.4, fd = bd - 0.4;
    paveGeos.push(colored(xform(new THREE.BoxGeometry(fw, 0.2, 0.5), b.cx, 0.1, b.z0 + 0.45), 0xffffff));
    paveGeos.push(colored(xform(new THREE.BoxGeometry(fw, 0.2, 0.5), b.cx, 0.1, b.z1 - 0.45), 0xffffff));
    paveGeos.push(colored(xform(new THREE.BoxGeometry(0.5, 0.2, fd), b.x0 + 0.45, 0.1, b.cz), 0xffffff));
    paveGeos.push(colored(xform(new THREE.BoxGeometry(0.5, 0.2, fd), b.x1 - 0.45, 0.1, b.cz), 0xffffff));
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      paveGeos.push(colored(xform(new THREE.BoxGeometry(1.0, 0.2, 1.0), b.cx + ax * (fw / 2 - 0.9), 0.1, b.cz + az * (fd / 2 - 0.9)), 0xffffff));
    }
    // Two small trees (north + south rims, small canopies so they
    // never clip the tower) and two low planters (east/west rims).
    const treeAt = (tx, tz) => {
      greenGeos.push(colored(xform(new THREE.CylinderGeometry(0.1, 0.13, 1.0, 6), tx, 0.5, tz), 0x6b4a2a));
      greenGeos.push(colored(xform(new THREE.SphereGeometry(0.5, 8, 6), tx, 1.35, tz), 0x4d8a5c));
      greenGeos.push(colored(xform(new THREE.SphereGeometry(0.35, 8, 6), tx + 0.25, 1.7, tz), 0x5a9a68));
    };
    treeAt(b.cx - 2.0, b.z0 + 0.6);
    treeAt(b.cx + 2.0, b.z1 - 0.6);
    for (const px of [b.x0 + 0.6, b.x1 - 0.6]) {
      concGeos.push(colored(xform(new THREE.BoxGeometry(0.5, 0.4, 1.2), px, 0.2, b.cz), 0xffffff));
      greenGeos.push(colored(xform(new THREE.SphereGeometry(0.3, 8, 6), px, 0.55, b.cz), 0x4d8a5c));
    }
    // One bench on the south rim, facing the street.
    concGeos.push(colored(xform(new THREE.BoxGeometry(1.8, 0.12, 0.5), b.cx, 0.55, b.z1 - 0.7), 0xffffff));
    concGeos.push(colored(xform(new THREE.BoxGeometry(0.12, 0.55, 0.5), b.cx - 0.7, 0.28, b.z1 - 0.7), 0xffffff));
    concGeos.push(colored(xform(new THREE.BoxGeometry(0.12, 0.55, 0.5), b.cx + 0.7, 0.28, b.z1 - 0.7), 0xffffff));
  }

  const glassMat = new THREE.MeshStandardMaterial({ color: 0x7fa8b8, roughness: 0.35, metalness: 0.25, flatShading: true });
  const concMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9, flatShading: true });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0xd8cbb2, roughness: 0.95, flatShading: true });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true, vertexColors: true });
  const paveMat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.95, flatShading: true });
  if (glassGeos.length) group.add(mergedMesh(glassGeos, glassMat));
  if (concGeos.length) group.add(mergedMesh(concGeos, concMat));
  if (crownGeos.length) group.add(mergedMesh(crownGeos, vertexColorMat));
  if (winGeos.length) group.add(mergedMesh(winGeos, vertexColorMat));
  if (signGeos.length) {
    const signMesh = mergedMesh(signGeos, new THREE.MeshBasicMaterial({ map: atlas.texture }));
    signMesh.name = 'cbd-signs';
    group.add(signMesh);
  }
  if (plazaGeos.length) group.add(mergedMesh(plazaGeos, plazaMat));
  if (greenGeos.length) group.add(mergedMesh(greenGeos, greenMat));
  if (paveGeos.length) group.add(mergedMesh(paveGeos, paveMat));
  if (parkedGeos.length) group.add(mergedMesh(parkedGeos, vertexColorMat));

  // Elevated monorail above the boulevard (SLIM guideway, Xian 21 Nov
  // 16:04): a NARROW beam (0.8 wide) on pillars IN the 1.3-wide median
  // — never a wide dark slab, never covering the roads below or sitting
  // in a driving lane. The car straddles the beam. Guideway + car are
  // each one merged mesh (the old deck was 17 draw calls; this is 2).
  // Pillars skip the intersections (the median is gapped there — a
  // pillar at x -12/0/12 would stand in the Lungomare x Corso crossing
  // and the VIA DEL SOLE / DEL MARE crossings).
  const guideGeos = [];
  guideGeos.push(colored(xform(new THREE.BoxGeometry(68, 0.5, 0.8), 0, 7, 0), 0x9a938a));
  for (let x = -30; x <= 30; x += 6) {
    if (CBD_NS.some((s) => Math.abs(x - s.x) < s.w / 2 + 0.35)) continue;
    guideGeos.push(colored(xform(new THREE.BoxGeometry(0.35, 7, 0.35), x, 3.5, 0), 0x9a938a));
  }
  guideGeos.push(colored(xform(new THREE.BoxGeometry(68, 0.12, 0.25), 0, 7.3, -0.25), 0x3a3a3a));
  guideGeos.push(colored(xform(new THREE.BoxGeometry(68, 0.12, 0.25), 0, 7.3, 0.25), 0x3a3a3a));
  const guideway = mergedMesh(guideGeos, vertexColorMat);
  guideway.name = 'monorail-guideway';
  group.add(guideway);
  const carGeos = [];
  carGeos.push(colored(xform(new THREE.BoxGeometry(6, 2, 2.4), 0, 0, 0), 0x2e7f8f));
  carGeos.push(colored(xform(new THREE.BoxGeometry(5.6, 0.9, 2.5), 0, 0.3, 0), 0x1e2a32));
  carGeos.push(colored(xform(new THREE.BoxGeometry(6.2, 0.3, 2.6), 0, -1.1, 0), 0xe8c33d));
  const car = mergedMesh(carGeos, vertexColorMat);
  car.position.set(0, 8.35, 0);
  group.add(car);
  // The monorail car glides on a sine ticker. Tickers must be THREE
  // objects with userData.tick (step() calls tk.userData.tick) — a
  // plain { tick } object crashes the frame loop.
  const monoTicker = new THREE.Group();
  monoTicker.name = 'monorail-ticker';
  monoTicker.userData.tick = (t) => { car.position.x = Math.sin(t * 0.12) * 26; };
  tickers.push(monoTicker);

  return {
    group, colliders, tickers,
    towerCount, podiumCount,
    buildingCount: towerCount + podiumCount,
  };
}
