// AZZURA HEIST — generic block generator (Xian 21 Nov 17:58, NEW PLAN step 1).
// A zone definition (block size, street spec, building types, height
// range, facade style, density, setbacks, park/plaza ratio) produces
// blocks, roads, buildings, traffic lanes, ped paths and minimap lines.
// Data-driven: zones are tuned by data, not by new code per zone.
//
// Pattern (from cbd-grid.js): streets are the single source of truth —
// blocks are derived from the gaps between consecutive streets, so
// every block is bounded by roads on all four sides by construction.
// Buildings fill each block along its perimeter (commercial) or as
// continuous terraced rows (residential townhouses), facing OUTWARD
// toward the street. All geometry goes into SHARED pools: city.js
// merges each pool ONCE, so the whole new city costs ~8 draw calls
// no matter how many buildings it holds.
//
// Map (units; 1 unit = 10 m; land x -120..120, z -105..35; bay z > 35):
//   z 12..35   promenade / marina (existing)
//   z -46..12  CBD (existing, 36 towers)
//   z -67..-46 commercial north band (existing)
//   z -88..-67 commercial north extension (2a)
//   z -101..-88 residential north (2c)
//   z -118..-101 hills + cliff villas, terraced (2d)
//   x 35..96 / -96..-35 commercial east/west bands (existing + 2a outer)
//   x 96..118 / -118..-96 residential east/west strips (2c)
//   outer zones: quarry east, countryside west, lighthouse headland (2e)
import * as THREE from '../vendor/three.module.min.js';
import {
  box, mergedMesh, colored, coloredKerb, xform, vertexColorMat, M, treeInstanced,
} from './world.js';
import { seededRandom, roadRects } from './roads.js';
import { buildSignAtlas, remapUV, SHOP_NAMES } from './commercial.js';
import {
  createMarkings, zebraApproach, stopForApproach,
  arrowsForApproach, boxJunction, allCrossingGaps, stopSpansFor, dashBlockedBy,
} from './markings.js';

// --- shared pools ---
// Every new zone appends geometries here; city.js merges each pool
// ONCE into a single mesh. Trees are placements, merged into one
// InstancedMesh per type at the end.
export function createPools() {
  return {
    concrete: [], glass: [], signs: [], neons: [],
    roads: [], sidewalks: [], markingsW: [], markingsY: [],
    lampPoles: [], lampGlobes: [],
    trees: { pine: [], round: [], cypress: [] },
  };
}

export function mergePools(pools, atlas, roadMat) {
  const group = new THREE.Group();
  group.name = 'newCity';
  const add = (geos, mat, name, castShadow = true) => {
    if (!geos.length) return null;
    const m = mergedMesh(geos, mat);
    m.name = name;
    m.castShadow = castShadow;
    group.add(m);
    return m;
  };
  add(pools.concrete, vertexColorMat, 'zones-concrete');
  add(pools.glass, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.25, metalness: 0.4,
    emissive: 0xffffff, emissiveIntensity: 0.08,
  }), 'zones-glass');
  if (pools.signs.length && atlas) {
    add(pools.signs, new THREE.MeshBasicMaterial({ map: atlas.texture }), 'zones-signs', false);
  }
  add(pools.neons, new THREE.MeshBasicMaterial({ vertexColors: true }), 'zones-neon', false);
  add(pools.roads, roadMat || new THREE.MeshStandardMaterial({ color: 0x6e6a67, roughness: 0.92, flatShading: true }), 'zones-roads', false);
  add(pools.sidewalks, new THREE.MeshStandardMaterial({ color: 0xdccfb8, roughness: 0.95, flatShading: true }), 'zones-sidewalks', false);
  // Zone markings live in the shared registry (pools.markings), built
  // here as zone-*: the old markingsW/markingsY pools are retired.
  if (pools.markings) pools.markings.build(group, 'zone');
  add(pools.lampPoles, M(0x2b2b2b), 'zones-lamps-pole');
  add(pools.lampGlobes, M(0xffd9a0, { emissive: 0xffc46b, emissiveIntensity: 0.9 }), 'zones-lamps-globe', false);
  for (const [type, list] of Object.entries(pools.trees)) {
    if (list.length) group.add(treeInstanced(type, list));
  }
  return group;
}

// --- streets -> blocks (generic cbdGridBlocks) ---
// ns: [{x, w}] north-south streets; ew: [{z, w}] east-west streets.
// Blocks sit between consecutive streets, clipped to rect.
// Every block is bounded by a road on all four sides by construction.
export function deriveBlocks(ns, ew, rect) {
  const cols = [];
  for (let i = 0; i < ns.length - 1; i++) {
    const x0 = Math.max(rect.x0, ns[i].x + ns[i].w / 2);
    const x1 = Math.min(rect.x1, ns[i + 1].x - ns[i + 1].w / 2);
    if (x1 - x0 > 1) cols.push({ x0, x1 });
  }
  const rows = [];
  for (let i = 0; i < ew.length - 1; i++) {
    const z0 = Math.max(rect.z0, ew[i].z + ew[i].w / 2);
    const z1 = Math.min(rect.z1, ew[i + 1].z - ew[i + 1].w / 2);
    if (z1 - z0 > 1) rows.push({ z0, z1 });
  }
  const blocks = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      blocks.push({
        id: `zone-${c}-${r}`,
        col: c, row: r,
        x0: cols[c].x0, x1: cols[c].x1,
        z0: rows[r].z0, z1: rows[r].z1,
        cx: (cols[c].x0 + cols[c].x1) / 2,
        cz: (rows[r].z0 + rows[r].z1) / 2,
        kind: 'block',
      });
    }
  }
  return blocks;
}

// Intervals of [from, to] outside every [g0, g1] gap.
function segmentsAlong(from, to, gaps) {
  const gs = gaps.slice().sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = from;
  for (const [g0, g1] of gs) {
    if (g1 <= cur) continue;
    if (g0 > cur) out.push([cur, Math.min(g0, to)]);
    cur = Math.max(cur, g1);
    if (cur >= to) break;
  }
  if (cur < to) out.push([cur, to]);
  return out.filter(([a, b]) => b - a > 0.5);
}

// Rounded-rectangle loop path (waypoints every ~2 units) for traffic.
export function loopPath(x0, z0, x1, z1, r = 4) {
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

// --- road geometry for a zone's streets (into the shared pools) ---
// ns/ew carry {x|z, w, kind: 'avenue'|'street', from/to}. Avenues get
// the 4.8 m spec (6 lanes, median); streets the 2.2 m spec (4 lanes,
// double yellow). Lamps on ONE side only (B rule). Zebras only where
// an avenue crosses a street. Only the zone's OWN streets are built
// here — streets roads.js already builds are never duplicated.
export function zoneRoadsInto(ns, ew, pools, opts = {}) {
  // gaps: streets built elsewhere (roads.js) that cross this zone's
  // streets — used ONLY for segmentation, never rebuilt, so no slab
  // is ever duplicated (duplicates z-fight).
  // The zone defs list some streets twice (residential + outer share
  // their E-W streets) — dedup by position + width first, or the
  // slabs, sidewalks, lamps AND markings are all built twice.
  const dedup = (list, key) => {
    const seen = new Set();
    return list.filter((s) => {
      const k = key(s);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  ns = dedup(ns, (s) => s.x + ':' + s.w);
  ew = dedup(ew, (s) => s.z + ':' + s.w);
  const gapNs = dedup(opts.gaps?.ns || [], (s) => s.x + ':' + s.w);
  const gapEw = dedup(opts.gaps?.ew || [], (s) => s.z + ':' + s.w);
  const allNs = [...ns, ...gapNs];
  const allEw = [...ew, ...gapEw];
  const sidewalkW = (s) => (s.kind === 'avenue' ? 0.7 : 0.5);
  // Road slabs: E-W full length, N-S segmented between them.
  for (const s of ew) {
    pools.roads.push(colored(xform(new THREE.BoxGeometry(s.x1 - s.x0, 0.3, s.w), (s.x0 + s.x1) / 2, 0.05, s.z), 0xffffff));
  }
  const ewGaps = allEw.map((s) => [s.z - s.w / 2, s.z + s.w / 2]);
  for (const s of ns) {
    for (const [a, b] of segmentsAlong(s.z0, s.z1, ewGaps)) {
      pools.roads.push(colored(xform(new THREE.BoxGeometry(s.w, 0.3, b - a), s.x, 0.05, (a + b) / 2), 0xffffff));
    }
  }
  // Sidewalks: E-W full length, N-S segmented.
  for (const s of ew) {
    const sw = sidewalkW(s);
    pools.sidewalks.push(coloredKerb(xform(new THREE.BoxGeometry(s.x1 - s.x0, 0.24, sw), (s.x0 + s.x1) / 2, 0.12, s.z - s.w / 2 - sw / 2)));
    pools.sidewalks.push(coloredKerb(xform(new THREE.BoxGeometry(s.x1 - s.x0, 0.24, sw), (s.x0 + s.x1) / 2, 0.12, s.z + s.w / 2 + sw / 2)));
  }
  const ewSwGaps = allEw.map((s) => {
    const sw = sidewalkW(s);
    return [s.z - s.w / 2 - sw, s.z + s.w / 2 + sw];
  });
  for (const s of ns) {
    const sw = sidewalkW(s);
    for (const [a, b] of segmentsAlong(s.z0, s.z1, ewSwGaps)) {
      pools.sidewalks.push(coloredKerb(xform(new THREE.BoxGeometry(sw, 0.24, b - a), s.x - s.w / 2 - sw / 2, 0.12, (a + b) / 2)));
      pools.sidewalks.push(coloredKerb(xform(new THREE.BoxGeometry(sw, 0.24, b - a), s.x + s.w / 2 + sw / 2, 0.12, (a + b) / 2)));
    }
  }
  // Markings (registry — the shared one on pools, built once in
  // mergePools as zone-*: one zebra per approach outside the box, a
  // stop line 1.0 behind it, arrows where they fit, dashes cut at
  // intersections + zebra bands and skipped at stop lines).
  const reg = pools.markings || (pools.markings = createMarkings());
  const edgeOf = (s) => (s.kind === 'avenue' ? 1.7 : 0.6);
  const crossingsNS = allEw.map((e) => ({ c: e.z, h: e.w / 2 }));
  const crossingsEW = allNs.map((n) => ({ c: n.x, h: n.w / 2 }));
  for (const s of ns) {
    const segs = segmentsAlong(s.z0, s.z1, allCrossingGaps(crossingsNS));
    const stops = stopSpansFor(crossingsNS, false);
    const divs = s.kind === 'avenue' ? [1.0, 1.35] : [0.3];
    for (const [a, b] of segs) {
      for (const off of (s.kind === 'avenue' ? divs : [])) {
        for (const side of [-1, 1]) {
          for (let z = a + 0.15; z <= b - 0.15; z += 1.2) {
            if (dashBlockedBy(z, side, off, stops, s.kind)) continue;
            reg.box('dash', s.x + side * off, z, 0.012, 0.3);
          }
        }
      }
      for (const side of [-1, 1]) {
        const e = edgeOf(s);
        reg.box('edge', s.x + side * e, (a + b) / 2, 0.012, b - a);
        if (s.kind !== 'avenue') reg.box('yellow', s.x + side * 0.01, (a + b) / 2, 0.01, b - a);
        else reg.box('bus', s.x + side * 1.45, (a + b) / 2, 0.012, b - a);
      }
    }
  }
  for (const s of ew) {
    const segs = segmentsAlong(s.x0, s.x1, allCrossingGaps(crossingsEW));
    const stops = stopSpansFor(crossingsEW, true);
    const divs = s.kind === 'avenue' ? [1.0, 1.35] : [0.3];
    for (const [a, b] of segs) {
      for (const off of (s.kind === 'avenue' ? divs : [])) {
        for (const side of [-1, 1]) {
          for (let x = a + 0.15; x <= b - 0.15; x += 1.2) {
            if (dashBlockedBy(x, side, off, stops, s.kind)) continue;
            reg.box('dash', x, s.z + side * off, 0.3, 0.012);
          }
        }
      }
      for (const side of [-1, 1]) {
        const e = edgeOf(s);
        reg.box('edge', (a + b) / 2, s.z + side * e, b - a, 0.012);
        if (s.kind !== 'avenue') reg.box('yellow', (a + b) / 2, s.z + side * 0.01, b - a, 0.01);
        else reg.box('bus', (a + b) / 2, s.z + side * 1.45, b - a, 0.012);
      }
    }
  }
  // Zebras + stops + arrows at EVERY crossing (not just avenues), and
  // the box junction where an avenue meets. Arrows go in a second pass
  // (shapeIfFree must see the boxes of later crossings too).
  const zoneLegs = [];
  for (const n of ns) {
    for (const e of ew) {
      const cx = n.x, cz = e.z, hn = n.w / 2, he = e.w / 2;
      const ave = n.kind === 'avenue' || e.kind === 'avenue';
      for (const leg of ['W', 'E']) {
        const band = zebraApproach(reg, cx, cz, leg, he, hn, edgeOf(e));
        const stop = stopForApproach(reg, band, leg, e.kind);
        zoneLegs.push({ stop, leg, kind: e.kind });
      }
      for (const leg of ['S', 'N']) {
        const band = zebraApproach(reg, cx, cz, leg, hn, he, edgeOf(n));
        const stop = stopForApproach(reg, band, leg, n.kind);
        zoneLegs.push({ stop, leg, kind: n.kind });
      }
      if (ave) boxJunction(reg, cx, cz, hn, he);
    }
  }
  for (const { stop, leg, kind } of zoneLegs) arrowsForApproach(reg, stop, leg, kind);
  // Lamps, one side only — in the furniture strip next to the kerb
  // (0.12 out from the road edge: the pole base radius is 0.07, so
  // its footprint clears the asphalt by 0.05), never in the middle of
  // the sidewalk and never at a crossing (a lamp in a crossing stands
  // on the crossing road's asphalt — skip within its half-width + 0.15).
  const lampAt = (x, z) => {
    pools.lampPoles.push(xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), x, 1.2, z));
    pools.lampGlobes.push(xform(new THREE.SphereGeometry(0.16, 10, 8), x, 2.5, z));
  };
  // A lamp is placed only where its base footprint (r 0.07) clears
  // EVERY road rect in the game — its own zone's, every other zone
  // def's, and the ring/CBD rects. Adjacent zones build streets 2
  // apart (e.g. residential x=119, outer x=121) with no sidewalk
  // between them, so a lamp on the shared edge would stand on the
  // neighbour's asphalt; the same holds at crossings. A lamp that
  // clears nowhere is skipped (those streets are lit by neighbours).
  // The quay (z 12.7..14.5) is a pedestrian walkway, not a road —
  // excluded here exactly as the audit excludes it.
  const lampClear = (x, z) => {
    const r = 0.07;
    const hit = (rc) => x - r < rc.x1 && x + r > rc.x0 && z - r < rc.z1 && z + r > rc.z0;
    const nsRect = (n) => ({ x0: n.x - n.w / 2, x1: n.x + n.w / 2, z0: n.z0, z1: n.z1 });
    const ewRect = (e) => ({ x0: e.x0, x1: e.x1, z0: e.z - e.w / 2, z1: e.z + e.w / 2 });
    for (const n of allNs) if (hit(nsRect(n))) return false;
    for (const e of allEw) if (hit(ewRect(e))) return false;
    for (const def of [RING_EXT_DEF, OLD_TOWN_EXT_DEF, PROMENADE_EXT_DEF, RESIDENTIAL_DEF, OUTER_DEF]) {
      for (const s of (def.roadsNs || [])) if (hit(nsRect(s))) return false;
      for (const s of (def.roadsEw || [])) if (hit(ewRect(s))) return false;
    }
    for (const rc of roadRects()) {
      if (rc.z0 >= 11.7 && rc.z1 <= 14.5) continue; // quay walkway
      if (hit(rc)) return false;
    }
    return true;
  };
  for (const s of ns) {
    for (let z = s.z0 + 4; z <= s.z1 - 4; z += 8) {
      const x = s.x + s.w / 2 + 0.12;
      if (lampClear(x, z)) lampAt(x, z);
    }
  }
  for (const s of ew) {
    for (let x = s.x0 + 4; x <= s.x1 - 4; x += 8) {
      const z = s.z - s.w / 2 - 0.12;
      if (lampClear(x, z)) lampAt(x, z);
    }
  }
  void opts;
}

// --- palettes ---
export const PALETTE_COMMERCIAL = [
  0xefe3c8, 0xe8c98a, 0xd8a05a, 0xc96a4a, 0x7a9a8a, 0x8fa8b8,
  0xb88a6a, 0xd8b8a8, 0xe8d8b8, 0xa8b89a, 0xc9a86a, 0x9a8a7a,
];
export const PALETTE_TOWNHOUSE = [
  0xf5efe2, 0xefe3c8, 0xe8d8b8, 0xf2d8c8, 0xe8c98a, 0xd8b8a8,
  0xf7e8d8, 0xe8dcc0, 0xd8c8a8, 0xf0e0c0, 0xe0c8a0, 0xd8a878,
];
export const PALETTE_VILLA = [
  0xf5efe2, 0xf7f2e8, 0xefe8d8, 0xf2e8dc, 0xe8ddc8, 0xf5e8d8,
];

// --- windows: tidy grid, dark glass, 30-40% warm-lit in vertical groups ---
function windowsForFace(face, w, h, d, rnd) {
  const quads = [];
  const cols = Math.max(2, Math.floor(w / 1.6));
  const rows = Math.max(2, Math.floor((h - 4) / 2));
  const litCols = new Set();
  for (let c = 0; c < cols; c++) if (rnd() < 0.4) litCols.add(c);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = litCols.has(c) && r < rows - 1;
      const col = lit ? 0xffc46b : 0x1e2a32;
      const wx = (c - (cols - 1) / 2) * (w / cols);
      const wy = 4.5 + r * 2;
      const q = new THREE.PlaneGeometry(0.7, 1.0);
      if (face === 'front') q.translate(wx, wy, d / 2 + 0.06);
      else if (face === 'back') { q.rotateY(Math.PI); q.translate(wx, wy, -d / 2 - 0.06); }
      else if (face === 'left') { q.rotateY(-Math.PI / 2); q.translate(-w / 2 - 0.06, wy, wx); }
      else { q.rotateY(Math.PI / 2); q.translate(w / 2 + 0.06, wy, wx); }
      quads.push(colored(q, col));
    }
  }
  return quads;
}

// --- building factory ---
// style 'commercial': flat roof + cornice + parapet + rooftop props +
// shopfront (awning + glass). style 'townhouse': pastel wall + pitched
// terracotta roof + balcony + door. style 'villa': whitewashed +
// terracotta pyramid roof + garden wall. All parts are plain boxes /
// cones merged into the shared pools — no per-building meshes.
function zoneBuilding(rnd, style, floors, w, d, color, isCorner) {
  const h = floors * 2;
  const g = new THREE.Group();
  if (style === 'townhouse' || style === 'villa') {
    g.add(box(w, h, d, color, 0, h / 2, 0));
    // Pitched terracotta roof: a 4-sided cone scaled to the footprint.
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.72, 1.2 + rnd() * 0.6, 4),
      new THREE.MeshStandardMaterial({ color: 0xb4552d, roughness: 0.9, flatShading: true }),
    );
    roof.position.set(0, h + 0.6, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, d / Math.max(w, d));
    g.add(roof);
    // Door + balcony on the front face.
    g.add(box(0.9, 1.8, 0.1, 0x2b2b2b, 0, 0.9, d / 2 + 0.04));
    if (floors >= 3) {
      g.add(box(w * 0.5, 0.14, 0.9, 0x8a6a4a, w * 0.15, h - 1.8, d / 2 + 0.45));
      g.add(box(w * 0.5, 0.55, 0.06, 0x1e2a32, w * 0.15, h - 1.45, d / 2 + 0.85));
    }
    if (style === 'villa') {
      // Garden wall around the plot front + a cypress beside the door
      // (the caller adds the tree placement; the wall is geometry).
      g.add(box(w + 0.6, 0.7, 0.25, 0xd8cbb2, 0, 0.35, d / 2 + 1.2));
    }
    // Rooftop props: chimney + AC box.
    g.add(box(0.4, 0.9, 0.4, 0x8a4a3a, w / 4, h + 1.0, -d / 4));
    g.add(box(0.7, 0.5, 0.7, 0x9a9a9a, -w / 4, h + 0.9, d / 4));
    return { group: g, height: h + 1.2 };
  }
  // Commercial (same vocabulary as commercial.js). The roof cap is a
  // separate slab in a roof color (grey / terracotta / dark) so the
  // roofs read as roofs from above instead of one orange mass — the
  // top-down barcode the D shots showed. The awning is shallower
  // (0.6) so the awnings on a 2-wide street leave open sky instead
  // of meeting overhead as a tunnel.
  g.add(box(w, h, d, color, 0, h / 2, 0));
  const roofColors = [0x8a8a8a, 0x9a8a7a, 0x4a4a4a, 0xb4552d, 0x7a7a72];
  g.add(box(w, 0.15, d, roofColors[Math.floor(rnd() * roofColors.length)], 0, h + 0.07, 0));
  g.add(box(w + 0.3, 0.35, d + 0.3, 0x8a7a5a, 0, h + 0.17, 0));
  g.add(box(w * 0.7, 0.4, d * 0.7, color, 0, h + 0.5, 0));
  g.add(box(0.9, 0.7, 0.9, 0x9a9a9a, -w / 4, h + 1.0, -d / 4));
  g.add(box(0.5, 1.1, 0.5, 0x8a4a3a, w / 4, h + 1.0, d / 4));
  if (rnd() < 0.5) g.add(box(0.7, 0.7, 0.7, 0x6a4a2a, w / 4, h + 0.9, -d / 4));
  if (isCorner) {
    g.add(box(w + 0.1, 2, d + 0.1, color, 0, h + 1.4, 0));
    g.add(box(w + 0.4, 0.25, d + 0.4, 0xe8a33d, 0, h + 2.5, 0));
  }
  const awnColors = [0xf7ebd7, 0xc93a6b, 0x2e7f8f, 0x7a8a4a, 0xd9553a];
  const awn = awnColors[Math.floor(rnd() * awnColors.length)];
  g.add(box(w * 0.9, 0.12, 0.6, awn, 0, 2.6, d / 2 + 0.3));
  g.add(box(w * 0.9, 1.8, 0.1, 0x1e2a32, 0, 1.2, d / 2 + 0.05));
  g.add(box(w * 0.9, 0.5, 0.12, 0x2e4a5e, 0, 2.3, d / 2 + 0.06));
  return { group: g, height: h + (isCorner ? 2.6 : 0.7) };
}

// Bake one placed building into the shared pools + its collider.
function bakeBuilding(bg, s, w, d, floors, rnd, pools, atlas, state, def) {
  bg.updateMatrixWorld(true);
  bg.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      const hex = (o.material && o.material.color) ? o.material.color.getHex() : 0xffffff;
      pools.concrete.push(colored(geo, hex));
    }
  });
  for (const f of ['front', 'left', 'right']) {
    for (const q of windowsForFace(f, w, floors * 2, d, rnd)) {
      const g2 = q.clone();
      const m = new THREE.Matrix4().makeRotationY(s.ry);
      m.setPosition(s.x, 0, s.z);
      g2.applyMatrix4(m);
      pools.glass.push(g2);
    }
  }
  if (def.shopfronts && s.shopName && atlas) {
    const plate = atlas.plates.get(s.shopName);
    const sq = remapUV(new THREE.PlaneGeometry(Math.min(w * 0.85, 4.2), 0.9), plate);
    sq.translate(0, 3.4, d / 2 + 0.08);
    const m = new THREE.Matrix4().makeRotationY(s.ry);
    m.setPosition(s.x, 0, s.z);
    sq.applyMatrix4(m);
    pools.signs.push(sq);
  }
  state.colliders.push({
    x0: s.x - (Math.abs(s.ry) === Math.PI / 2 ? d : w) / 2,
    z0: s.z - (Math.abs(s.ry) === Math.PI / 2 ? w : d) / 2,
    x1: s.x + (Math.abs(s.ry) === Math.PI / 2 ? d : w) / 2,
    z1: s.z + (Math.abs(s.ry) === Math.PI / 2 ? w : d) / 2,
    id: `${def.idPrefix}-${state.count}`,
  });
  state.count += 1;
}

// --- perimeter fill: buildings along the block edges, facing OUTWARD ---
function fillBlockPerimeter(b, def, rnd, pools, atlas, state) {
  const bw = b.x1 - b.x0;
  const bd = b.z1 - b.z0;
  const spacing = def.spacing || 3.5;
  const spots = [];
  const nX = Math.max(1, Math.floor(bw / spacing));
  const twoRows = bd >= 7.5;
  // -0.1 margin: without it, back-to-back rows on an 8-deep block
  // abut EXACTLY (dRow = (bd-0.4)/2 forces d = dRow), and float
  // error turns the shared edge into a false overlap.
  // SETBACK (step B): rows sit 1.0 inside the block edge (was 0.2)
  // and dRow is sized to the 1.0 insets, so the facade is 1.0 back
  // and the 0.6 awning stops 0.4 inside the block edge.
  const dRow = twoRows ? Math.min(4.4, (bd - 2.0) / 2) - 0.1 : Math.min(5, bd - 2.0);
  if (twoRows) {
    for (let i = 0; i < nX; i++) {
      const x = b.x0 + (i + 0.5) * (bw / nX);
      spots.push({ x, z: b.z0 + dRow / 2 + 1.0, ry: Math.PI, edge: 'north', main: true });
      spots.push({ x, z: b.z1 - dRow / 2 - 1.0, ry: 0, edge: 'south', main: true });
    }
  } else {
    const zc = (b.z0 + b.z1) / 2;
    for (let i = 0; i < nX; i++) {
      const x = b.x0 + (i + 0.5) * (bw / nX);
      spots.push({ x, z: zc, ry: i % 2 ? 0 : Math.PI, edge: i % 2 ? 'south' : 'north', main: true });
    }
  }
  // Side buildings fill the block's middle (east/west edges) — but
  // only on blocks wide enough: the two side buildings sit at
  // x0+2.8 and x1-2.8 with ~4.2 of depth along X when rotated, so on
  // a block narrower than 10 they overlap each other (the promenade
  // sliver, 6 wide, hit this). Narrow blocks keep just the two rows.
  // (Setback, step B: 2.8 not 2.2, so the 0.6 awning stays inside
  // the block edge.)
  const nZ = (bd >= 13 && bw >= 10) ? Math.max(1, Math.floor((bd - 8.8) / 5)) : 0;
  for (let i = 0; i < nZ; i++) {
    const z = b.z0 + (i + 1) * (bd / (nZ + 1));
    spots.push({ x: b.x0 + 2.8, z, ry: -Math.PI / 2, edge: 'west', main: false });
    spots.push({ x: b.x1 - 2.8, z, ry: Math.PI / 2, edge: 'east', main: false });
  }
  for (const [i, s] of spots.entries()) {
    const isCorner = i === 0 || i === 1;
    const floors = def.floors[0] + Math.floor(rnd() * (def.floors[1] - def.floors[0] + 1));
    const w = Math.min(3.2 + rnd() * 0.8, bw / nX - 0.2);
    const d = Math.min(4 + rnd() * 1.5, dRow);
    const color = def.palette[Math.floor(rnd() * def.palette.length)];
    if (s.main && def.shopfronts) {
      s.shopName = SHOP_NAMES[state.shopIdx % SHOP_NAMES.length];
      state.shopIdx += 1;
    }
    const { group: bg } = zoneBuilding(rnd, def.style, floors, w, d, color, isCorner);
    bg.position.set(s.x, 0, s.z);
    bg.rotation.y = s.ry;
    bakeBuilding(bg, s, w, d, floors, rnd, pools, atlas, state, def);
  }
}

// --- terraced-row fill (residential): continuous rows sharing walls ---
function fillBlockRows(b, def, rnd, pools, atlas, state) {
  const bw = b.x1 - b.x0;
  const bd = b.z1 - b.z0;
  // def.depth caps the house depth so shallow blocks (old town) get
  // two tight rows instead of one deep row; def.houseW [min,max]
  // narrows the terraced houses. Row centers sit dMax/2 + 0.2 inside
  // the block edge so no house overhangs its block.
  const dMax = def.depth || 4.4;
  const twoRows = bd >= 7;
  const rows = twoRows
    ? [{ z: b.z0 + dMax / 2 + 0.2, ry: Math.PI }, { z: b.z1 - dMax / 2 - 0.2, ry: 0 }]
    : [{ z: (b.z0 + b.z1) / 2, ry: 0 }];
  for (const row of rows) {
    let x = b.x0 + 0.2;
    while (x < b.x1 - 2.2) {
      let w = def.houseW
        ? def.houseW[0] + rnd() * (def.houseW[1] - def.houseW[0])
        : 2.5 + rnd() * 1.2;
      // Never let a house overhang its block: cap the width at the
      // remaining space, and stop the row if less than a narrow
      // house fits (a wide draw at the row's end used to escape).
      w = Math.min(w, b.x1 - 0.2 - x);
      if (w < 2.0) break;
      const d = Math.min(3.6 + rnd() * 0.8, dMax);
      const floors = def.floors[0] + Math.floor(rnd() * (def.floors[1] - def.floors[0] + 1));
      const color = def.palette[Math.floor(rnd() * def.palette.length)];
      const s = { x: x + w / 2, z: row.z, ry: row.ry, edge: row.ry === 0 ? 'south' : 'north', main: true };
      const { group: bg } = zoneBuilding(rnd, def.style, floors, w, d, color, false);
      bg.position.set(s.x, 0, s.z);
      bg.rotation.y = s.ry;
      bakeBuilding(bg, s, w, d, floors, rnd, pools, atlas, state, def);
      x += w + 0.15;
    }
  }
}

// --- park / plaza fill: lawn + trees + benches (+ fountain ticker) ---
function fillBlockPark(b, def, rnd, pools, state) {
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const bw = b.x1 - b.x0;
  const bd = b.z1 - b.z0;
  pools.concrete.push(colored(xform(new THREE.BoxGeometry(bw - 0.6, 0.24, bd - 0.6), cx, 0.12, cz), 0x7a9a5a));
  pools.concrete.push(colored(xform(new THREE.BoxGeometry(bw - 2, 0.26, 1.2), cx, 0.13, cz), 0xd8cbb2));
  pools.concrete.push(colored(xform(new THREE.BoxGeometry(1.2, 0.26, bd - 2), cx, 0.13, cz), 0xd8cbb2));
  const nT = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < nT; i++) {
    const x = b.x0 + 1.5 + rnd() * (bw - 3);
    const z = b.z0 + 1.5 + rnd() * (bd - 3);
    if (Math.abs(x - cx) < 1.6 && Math.abs(z - cz) < 1.6) continue;
    const type = rnd() < 0.5 ? 'round' : (rnd() < 0.5 ? 'pine' : 'cypress');
    pools.trees[type].push({ x, z, s: 0.9 + rnd() * 0.5, rot: rnd() * Math.PI * 2, tint: 0xffffff });
  }
  for (const [bx, bz] of [[-bw / 4, -bd / 4], [bw / 4, bd / 4]]) {
    pools.concrete.push(colored(xform(new THREE.BoxGeometry(1.6, 0.45, 0.5), cx + bx, 0.22, cz + bz), 0x8a6a4a));
  }
  state.parks = (state.parks || 0) + 1;
}

// --- the zone builder ---
// def: { id, seed, style, floors:[min,max], palette, shopfronts,
//   spacing, idPrefix, rects:[{x0,z0,x1,z1,ns,ew}], blocks?, parks:[idx],
//   parkEvery, roadsNs, roadsEw, lanes, pedPaths, fill:'perimeter'|'rows' }
// ns/ew entries: {x|z, w, kind:'avenue'|'street', z0,z1|x0,x1}.
// roadsNs/roadsEw: ONLY the streets this zone builds (roads.js streets
// are never rebuilt). Returns {count, blocks, colliders, tickers, lanes,
// pedPaths, minimap}.
export function buildZoneInto(def, pools, atlas) {
  const rnd = seededRandom(def.seed);
  const state = { count: 0, shopIdx: 0, colliders: [], parks: 0 };
  const tickers = [];
  let blocks = def.blocks || [];
  if (!blocks.length) {
    for (const r of def.rects) {
      const bs = deriveBlocks(r.ns, r.ew, r);
      bs.forEach((b, i) => { b.id = `${def.id}-${blocks.length + i}`; });
      blocks = blocks.concat(bs);
    }
  }
  const parkSet = new Set(def.parks || []);
  blocks.forEach((b, i) => {
    const isPark = parkSet.has(i) || (def.parkEvery && i % def.parkEvery === def.parkEvery - 1);
    if (isPark) { fillBlockPark(b, def, rnd, pools, state); return; }
    if (def.fill === 'rows') fillBlockRows(b, def, rnd, pools, atlas, state);
    else fillBlockPerimeter(b, def, rnd, pools, atlas, state);
  });
  if (def.roadsNs || def.roadsEw) zoneRoadsInto(def.roadsNs || [], def.roadsEw || [], pools, { gaps: def.gaps });
  const reg = pools.markings || (pools.markings = createMarkings());
  // Old town: no roadsNs/roadsEw (the cobble alleys are hand-built) —
  // basic markings are zebras + stops at the alley crossings (2-wide
  // streets, 9 apart — the bands fit, the arrows are skipped where
  // they would collide with the neighbour's zebra).
  if (def.allNs && def.allEw) {
    const legs = [];
    for (const n of def.allNs) {
      for (const e of def.allEw) {
        const cx = n.x, cz = e.z;
        for (const leg of ['W', 'E']) {
          const band = zebraApproach(reg, cx, cz, leg, e.w / 2, n.w / 2, 0.6);
          const stop = stopForApproach(reg, band, leg, 'street');
          legs.push({ stop, leg, kind: 'street' });
        }
        for (const leg of ['S', 'N']) {
          const band = zebraApproach(reg, cx, cz, leg, n.w / 2, e.w / 2, 0.6);
          const stop = stopForApproach(reg, band, leg, 'street');
          legs.push({ stop, leg, kind: 'street' });
        }
      }
    }
    for (const { stop, leg, kind } of legs) arrowsForApproach(reg, stop, leg, kind);
  }
  // Promenade: zebras across the quay (z 12.7..14.5) at each N-S
  // street — peds crossing from the shop rows to the waterfront.
  if (def.id === 'promenade-ext') {
    for (const r of def.rects) {
      for (const s of r.ns) {
        for (const dx of [-1.4, -0.7, 0, 0.7, 1.4]) reg.flat('zebra', s.x + dx, 13.6, 0.35, 1.8);
      }
    }
  }
  const lanes = (def.lanes || []).map((l) => ({
    name: l.name, speed: l.speed || 7,
    pts: loopPath(l.x0, l.z0, l.x1, l.z1, l.r || 2),
  }));
  const minimap = [];
  for (const s of [...(def.roadsNs || []), ...(def.allNs || [])]) minimap.push({ x1: s.x, z1: s.z0, x2: s.x, z2: s.z1, w: s.w });
  for (const s of [...(def.roadsEw || []), ...(def.allEw || [])]) minimap.push({ x1: s.x0, z1: s.z, x2: s.x1, z2: s.z, w: s.w });
  return {
    count: state.count, blocks: blocks.length, parks: state.parks,
    colliders: state.colliders, tickers, lanes,
    pedPaths: def.pedPaths || [], minimap,
  };
}

// --- zone definitions: 2a commercial ring extension (Xian 21 Nov 17:58) ---
// North: 2 rows x 13 columns (z -78..-69 + -88..-80) between the
// existing z -68 boundary street and the new z -79 / -89 streets.
// East/west outer: 2 columns x 4 rows (x 73.5..83 + 85..94), same rows
// as the existing east/west bands. The inner street is the existing
// boundary street (x +/-72.5); only x +/-84 and +/-95 are built here.
// Spacing 3.2 (denser than D's 3.5) so the blocks hold 6 buildings
// each. 2 park blocks in the north rows.
const RING_EXT_NS_NORTH = [-72.5, -60.5, -47, -34, -24, -14, -4, 6, 16, 26, 36, 46, 60.5, 72.5]
  .map((x) => ({ x, w: 2, kind: 'street' }));
const RING_EXT_EW_NORTH = [{ z: -89, w: 2 }, { z: -79, w: 2 }, { z: -68, w: 2 }]
  .map((s) => ({ ...s, kind: 'street' }));
export const RING_EXT_DEF = {
  id: 'ring-ext', seed: 20261121, style: 'commercial', floors: [6, 15],
  palette: PALETTE_COMMERCIAL, shopfronts: true, spacing: 3.2,
  idPrefix: 'ringext', fill: 'perimeter',
  rects: [
    { x0: -72, z0: -88, x1: 72, z1: -68, ns: RING_EXT_NS_NORTH, ew: RING_EXT_EW_NORTH },
    {
      x0: 73.5, z0: -31, x1: 96, z1: 12,
      ns: [{ x: 72.5, w: 2 }, { x: 84, w: 2 }, { x: 95, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [{ z: -30.9, w: 2 }, { z: -20, w: 2 }, { z: -10, w: 2 }, { z: 0, w: 2 }, { z: 12.7, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
    {
      x0: -96, z0: -26, x1: -73.5, z1: 12,
      ns: [{ x: -95, w: 2 }, { x: -84, w: 2 }, { x: -72.5, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [{ z: -26, w: 2 }, { z: -16, w: 2 }, { z: -6, w: 2 }, { z: 4, w: 2 }, { z: 12.7, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
  ],
  parks: [6, 19],
  roadsNs: [
    ...[-60.5, -47, -34, -24, -14, -4, 6, 16, 26, 36, 46].map((x) => ({ x, w: 2, kind: 'street', z0: -89, z1: -68 })),
    // The outer columns' INNER street is the existing boundary street
    // (x +/-72.5, built by roads.js) — the columns' blocks start at
    // x +/-73.5. Only the middle (x +/-84) and outer (x +/-95)
    // streets are built here.
    { x: 84, w: 2, kind: 'street', z0: -31, z1: 12 },
    { x: 95, w: 2, kind: 'street', z0: -31, z1: 12 },
    { x: -84, w: 2, kind: 'street', z0: -26, z1: 12 },
    { x: -95, w: 2, kind: 'street', z0: -26, z1: 12 },
  ],
  roadsEw: [
    { z: -79, w: 2, kind: 'street', x0: -72, x1: 72 },
    { z: -89, w: 2, kind: 'street', x0: -72, x1: 72 },
  ],
  // Streets roads.js already builds, crossing this zone's streets:
  // used ONLY to segment this zone's slabs (never rebuilt).
  gaps: {
    ew: [
      { z: -68, w: 2 }, { z: -30.9, w: 2 }, { z: -20, w: 2 }, { z: -10, w: 2 },
      { z: 0, w: 2 }, { z: -26, w: 2 }, { z: -16, w: 2 }, { z: -6, w: 2 },
      { z: 4, w: 2 }, { z: 12.7, w: 2 },
    ],
    ns: [{ x: -72.5, w: 2 }, { x: 72.5, w: 2 }],
  },
  lanes: [
    // Loops run ON streets: north on the +/-72.5 boundary streets,
    // the z -89 / -68 streets; outer columns on their own streets.
    { name: 'ringext-north', x0: -72.5, z0: -89, x1: 72.5, z1: -68, speed: 7 },
    { name: 'ringext-east', x0: 72.5, z0: -30.9, x1: 95, z1: 0, speed: 7 },
    { name: 'ringext-west', x0: -95, z0: -26, x1: -72.5, z1: 4, speed: 7 },
  ],
  pedPaths: [
    // Sidewalk centers: the -79 / -89 streets' sidewalks sit at
    // +/-1.2 from their centerlines; the +/-84 streets' at +/-1.2.
    { a: { x: -70, z: -77.8 }, b: { x: 70, z: -77.8 } },
    { a: { x: -70, z: -87.8 }, b: { x: 70, z: -87.8 } },
    { a: { x: 85.2, z: -29 }, b: { x: 85.2, z: 10 } },
    { a: { x: -85.2, z: -24 }, b: { x: -85.2, z: 10 } },
  ],
};

// --- zone definitions: 2b old town west + promenade east/west (Xian 21 Nov 17:58) ---
// OLD TOWN WEST: the empty strip x -96..-72, z -80..-30 (west of the
// pocket, north of the west outer columns). Terraced townhouse rows
// (depth 3.0, width 2.2-3.0, 2-4 floors) on a 2 x 5 block grid;
// alleys are cobbled by hand in districts.js (no asphalt here), so
// no roadsNs/roadsEw — the alley lines are minimap-only (allNs/allEw).
// 10 blocks, 1 park -> 9 x 6 = 54 houses; old town 32 -> 86.
export const OLD_TOWN_EXT_DEF = {
  id: 'oldtown-ext', seed: 20261121, style: 'townhouse', floors: [2, 4],
  palette: PALETTE_TOWNHOUSE, shopfronts: false, spacing: 3.2,
  idPrefix: 'otx', fill: 'rows', depth: 3.0, houseW: [2.2, 3.0],
  rects: [
    {
      x0: -96, z0: -80, x1: -72, z1: -30,
      ns: [{ x: -95, w: 2 }, { x: -84, w: 2 }, { x: -73, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [{ z: -79, w: 2 }, { z: -70, w: 2 }, { z: -61, w: 2 }, { z: -52, w: 2 }, { z: -43, w: 2 }, { z: -34, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
  ],
  parks: [4],
  // Alley lines, minimap only (the cobble slabs are hand-built).
  allNs: [
    { x: -95, w: 2, z0: -80, z1: -30 }, { x: -84, w: 2, z0: -80, z1: -30 },
    { x: -73, w: 2, z0: -80, z1: -30 },
  ],
  allEw: [
    { z: -79, w: 2, x0: -96, x1: -72 }, { z: -70, w: 2, x0: -96, x1: -72 },
    { z: -61, w: 2, x0: -96, x1: -72 }, { z: -52, w: 2, x0: -96, x1: -72 },
    { z: -43, w: 2, x0: -96, x1: -72 }, { z: -34, w: 2, x0: -96, x1: -72 },
  ],
  lanes: [
    { name: 'oldtown-west', x0: -95, z0: -79, x1: -74, z1: -31, speed: 6 },
  ],
  pedPaths: [
    // STREET CLEANUP (22 Nov): the two paths below ran on the cobble
    // alley lines (x -84 N-S, z -42 E-W) — the audit counts the minimap
    // alley lines as roads. Rerouted to E-W streets between the lines
    // (z -57 and z -66 sit between the -52/-61 and -61/-70 lines).
    { a: { x: -95, z: -57 }, b: { x: -73, z: -57 } },
    { a: { x: -95, z: -66 }, b: { x: -73, z: -66 } },
    { a: { x: -95, z: -57 }, b: { x: -73, z: -57 } },
  ],
};

// PROMENADE EXTENSION: the waterfront strip east (x 72..108) and west
// (x -97..-63) of the existing promenade, z 14..30. One wide block
// per side, two rows of commercial shopfront buildings (3-5 floors)
// facing the quay (north row) and the walkway/bay (south row). No
// roads built — the quay street (z 12.7) and the walkway (z 29) are
// the circulation. The west strip is SPLIT by the west boundary road
// (x -72.5, z -68..22, roads.js) — the block west of it (x -96..-75)
// and the sliver east of it (x -70..-64) are separate rects, so no
// building ever stands on that road. East 20 + west 12 + sliver 2
// = +34 -> promenade 27 -> 61.
export const PROMENADE_EXT_DEF = {
  id: 'promenade-ext', seed: 20261121, style: 'commercial', floors: [3, 5],
  palette: PALETTE_COMMERCIAL, shopfronts: true, spacing: 3.2,
  idPrefix: 'promext', fill: 'perimeter',
  rects: [
    {
      x0: 72, z0: 14, x1: 108, z1: 30,
      ns: [{ x: 72.5, w: 2 }, { x: 108, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [{ z: 12.7, w: 2 }, { z: 29, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
    {
      x0: -97, z0: 14, x1: -74, z1: 30,
      ns: [{ x: -97, w: 2 }, { x: -74, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [{ z: 12.7, w: 2 }, { z: 29, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
    {
      x0: -71, z0: 14, x1: -63, z1: 30,
      ns: [{ x: -71, w: 2 }, { x: -63, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [{ z: 12.7, w: 2 }, { z: 29, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
  ],
  lanes: [
    { name: 'promenade-east', x0: 73, z0: 28.5, x1: 107, z1: 30.5, speed: 6 },
    { name: 'promenade-west', x0: -95, z0: 28.5, x1: -64, z1: 30.5, speed: 6 },
  ],
  pedPaths: [
    { a: { x: 73, z: 29 }, b: { x: 107, z: 29 } },
    { a: { x: -95, z: 29 }, b: { x: -64, z: 29 } },
    { a: { x: 73, z: 33 }, b: { x: 107, z: 33 } },
    { a: { x: -95, z: 33 }, b: { x: -64, z: 33 } },
  ],
};

// --- zone definitions: 2c residential ring, east + west (Xian 21 Nov 17:58) ---
// Apartments + townhouses 2-6 floors, terraced rows (depth 3.0,
// width 2.2-2.8), courtyards in the block middles, small parks.
// Wide blocks (20, one column per strip) and shallow blocks (7 deep,
// E-W streets every 9) so every block holds two rows — the densest
// the generator does. East x 96..120, z -88..12 (11 blocks); west
// x -120..-96, z -88..35 (14 blocks); 2 park blocks.
// 2d NORTH (z -105..-90): added after the ridges moved north — the
// whole north strip (x -96..96) is clear ground now. Three rects:
// west (x -96..-70), middle (x -70..65, N-S streets every ~19),
// east (x 65..96). The z -89 street segments (x -96..-72, 72..96)
// are built here so the ring-ext's z -89 (x -72..72) runs continuous
// across the whole north edge. The east rect ends at z 12 so its last
// block stays clear of the quay (z 12.7, x -96..108). No roads.js
// street crosses these rects, so no gaps.
export const RESIDENTIAL_DEF = {
  id: 'residential', seed: 20261121, style: 'townhouse', floors: [2, 6],
  palette: PALETTE_TOWNHOUSE, shopfronts: false, spacing: 3.2,
  idPrefix: 'res', fill: 'rows', depth: 3.0, houseW: [2.2, 2.8],
  rects: [
    {
      x0: 96, z0: -88, x1: 120, z1: 12,
      ns: [{ x: 97, w: 2 }, { x: 119, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3].map((z) => ({ z, w: 2, kind: 'street' })),
    },
    {
      x0: -120, z0: -88, x1: -96, z1: 35,
      ns: [{ x: -119, w: 2 }, { x: -97, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3, 12, 21, 30].map((z) => ({ z, w: 2, kind: 'street' })),
    },
    {
      x0: -96, z0: -105, x1: -70, z1: -90,
      ns: [{ x: -95, w: 2 }, { x: -71, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      // z -89 is the ring-ext street (already built) — listed here only
      // so deriveBlocks makes the second row (z -94..-90); the road
      // itself is NOT rebuilt (it is in roadsEw only as the outer
      // segments x -96..-72 / 72..96).
      ew: [{ z: -104, w: 2 }, { z: -95, w: 2 }, { z: -89, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
    {
      x0: -70, z0: -105, x1: 65, z1: -90,
      ns: [-69, -50, -31, -12, 7, 26, 45, 64].map((x) => ({ x, w: 2, kind: 'street' })),
      ew: [{ z: -104, w: 2 }, { z: -95, w: 2 }, { z: -89, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
    {
      x0: 65, z0: -105, x1: 96, z1: -90,
      ns: [{ x: 66, w: 2 }, { x: 95, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [{ z: -104, w: 2 }, { z: -95, w: 2 }, { z: -89, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
    },
  ],
  parks: [4, 15, 33],
  roadsNs: [
    { x: 97, w: 2, kind: 'street', z0: -87, z1: 3 },
    { x: 119, w: 2, kind: 'street', z0: -87, z1: 3 },
    { x: -119, w: 2, kind: 'street', z0: -87, z1: 30 },
    { x: -97, w: 2, kind: 'street', z0: -87, z1: 30 },
    // HILLS LINK (GAME fix, Xian 21 Nov 23:04): the hills street grid
    // (z -104..-95) was an island — every N-S stub ended at z=-95,
    // 6u short of the z=-89 ring street. The x=+/-95 stubs run on the
    // north strip's outer edges, so extending them to z=-89 joins the
    // hills to the main network without touching a building (houses
    // sit >=0.2 inside their blocks, clear of the road edge).
    { x: -95, w: 2, kind: 'street', z0: -104, z1: -89 },
    { x: -71, w: 2, kind: 'street', z0: -104, z1: -95 },
    ...[-69, -50, -31, -12, 7, 26, 45, 64].map((x) => ({ x, w: 2, kind: 'street', z0: -104, z1: -95 })),
    { x: 66, w: 2, kind: 'street', z0: -104, z1: -95 },
    { x: 95, w: 2, kind: 'street', z0: -104, z1: -89 },
  ],
  roadsEw: [
    ...[-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3].map((z) => ({ z, w: 2, kind: 'street', x0: 96, x1: 120 })),
    ...[-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3, 12, 21, 30].map((z) => ({ z, w: 2, kind: 'street', x0: -120, x1: -96 })),
    { z: -104, w: 2, kind: 'street', x0: -96, x1: 96 },
    { z: -95, w: 2, kind: 'street', x0: -96, x1: 96 },
    // z -89 segments so the ring-ext's z -89 (x -72..72) runs continuous.
    { z: -89, w: 2, kind: 'street', x0: -96, x1: -72 },
    { z: -89, w: 2, kind: 'street', x0: 72, x1: 96 },
  ],
  lanes: [
    { name: 'res-east', x0: 97, z0: -87, x1: 119, z1: 3, speed: 6 },
    { name: 'res-west', x0: -119, z0: -87, x1: -97, z1: 30, speed: 6 },
    { name: 'res-north', x0: -95, z0: -104, x1: 95, z1: -89, speed: 6 },
  ],
  pedPaths: [
    { a: { x: 98.2, z: -87 }, b: { x: 98.2, z: 3 } },
    { a: { x: 117.8, z: -87 }, b: { x: 117.8, z: 3 } },
    { a: { x: -117.8, z: -87 }, b: { x: -117.8, z: 30 } },
    { a: { x: -98.2, z: -87 }, b: { x: -98.2, z: 30 } },
    // EW paths on the z -42 street's SOUTH sidewalk (centre -40.75:
    // road -43..-41, sidewalk -41..-40.5) — the old z -42 line ran
    // mid-street.
    { a: { x: 97, z: -40.75 }, b: { x: 119, z: -40.75 } },
    { a: { x: -119, z: -40.75 }, b: { x: -97, z: -40.75 } },
    { a: { x: -95, z: -102.8 }, b: { x: 95, z: -102.8 } },
    { a: { x: -95, z: -93.8 }, b: { x: 95, z: -93.8 } },
  ],
};

// --- zone definitions: 2e outer countryside (Xian 21 Nov 17:58) ---
// Farmhouses on the ground aprons (x +/-120..128), west + east of the
// residential ring. Low (1-2 floors), sparse: narrow 5-wide blocks,
// one row per block, dirt tracks (not asphalt) — the roads are built
// here (dirt, same slabs) so the farmhouses are reachable. The
// quarry (northeast) + lighthouse headland (southwest) are hand-built
// in city.js (buildOuterZones) — they are special forms, not rows.
// West x -128..-120, z -88..35 (13 blocks); east x 120..128,
// z -88..12 (11 blocks). The dressing trees/rocks already on the
// apron stay — farmhouses sit among them (rural).
export const OUTER_DEF = {
  id: 'outer', seed: 20261121, style: 'townhouse', floors: [1, 2],
  palette: PALETTE_TOWNHOUSE, shopfronts: false, spacing: 3.2,
  idPrefix: 'out', fill: 'rows', depth: 3.0, houseW: [2.5, 3.5],
  rects: [
    {
      x0: -128, z0: -88, x1: -120, z1: 35,
      ns: [{ x: -127, w: 2 }, { x: -121, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3, 12, 21, 30].map((z) => ({ z, w: 2, kind: 'street' })),
    },
    {
      x0: 120, z0: -88, x1: 128, z1: 35,
      ns: [{ x: 121, w: 2 }, { x: 127, w: 2 }].map((s) => ({ ...s, kind: 'street' })),
      ew: [-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3, 12, 21, 30].map((z) => ({ z, w: 2, kind: 'street' })),
    },
  ],
  parks: [],
  roadsNs: [
    { x: -127, w: 2, kind: 'street', z0: -87, z1: 30 },
    { x: -121, w: 2, kind: 'street', z0: -87, z1: 30 },
    { x: 121, w: 2, kind: 'street', z0: -87, z1: 30 },
    { x: 127, w: 2, kind: 'street', z0: -87, z1: 30 },
  ],
  roadsEw: [
    ...[-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3, 12, 21, 30].map((z) => ({ z, w: 2, kind: 'street', x0: -128, x1: -120 })),
    ...[-87, -78, -69, -60, -51, -42, -33, -24, -15, -6, 3, 12, 21, 30].map((z) => ({ z, w: 2, kind: 'street', x0: 120, x1: 128 })),
  ],
  lanes: [
    { name: 'outer-west', x0: -127, z0: -87, x1: -121, z1: 30, speed: 6 },
    { name: 'outer-east', x0: 121, z0: -87, x1: 127, z1: 30, speed: 6 },
  ],
  pedPaths: [
    { a: { x: -124, z: -87 }, b: { x: -124, z: 30 } },
    { a: { x: 124, z: -87 }, b: { x: 124, z: 30 } },
  ],
};
