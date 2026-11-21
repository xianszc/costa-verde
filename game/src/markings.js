// Markings — ONE source of truth for every road marking in the game.
// All three marking systems (CBD grid, ring/connectors, generator zones)
// record their markings here: one registry, one fixed layer order, one
// audit. Placement rules (Xian 22 Nov 01:16 brief, item 2):
//   - one zebra per approach, OUTSIDE the intersection box;
//   - stop line 1.5 m before the zebra (approach side), spanning the
//     approach lanes but NOT the bus lane strip and NOT the edge line;
//   - nothing else inside the intersection box (box junction only);
//   - dashes / edges / bus lane are gapped at intersections, at stop
//     lines and at turn arrows — no two markings share an area.
// Layer order (y, lower = under): box < bus < dash < edge/yellow <
// zebra < stop < arrow. Any residual overlap renders deterministically.
import * as THREE from '../vendor/three.module.min.js';
import { colored, xform, mergedMesh } from './world.js';

export const MARK_Y = {
  box: 0.210, bus: 0.214, dash: 0.218,
  edge: 0.221, yellow: 0.221, zebra: 0.226, stop: 0.23, arrow: 0.234,
};

const MAT_PROPS = {
  dash: { color: 0xf7ebd7, opacity: 0.75 },
  edge: { color: 0xf7ebd7, opacity: 0.7 },
  yellow: { color: 0xe8c33d, opacity: 0.65 },
  bus: { color: 0x3a9a6a, opacity: 0.55 },
  zebra: { color: 0xf7ebd7, opacity: 0.7 },
  stop: { color: 0xf7ebd7, opacity: 0.55 },
  arrow: { color: 0xf7ebd7, opacity: 0.45 },
  box: { color: 0xe8c33d, opacity: 0.65 },
};

// [a,b] minus gap windows (each [g0,g1]) — shared by all three systems.
export function segmentsAlong(a, b, gaps) {
  const out = [];
  let cur = a;
  const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
  for (const [g0, g1] of sorted) {
    if (g1 <= cur) continue;
    if (g0 >= b) break;
    if (g0 > cur) out.push([cur, Math.min(g0, b)]);
    cur = Math.max(cur, g1);
    if (cur >= b) break;
  }
  if (cur < b) out.push([cur, b]);
  return out.filter(([s, e]) => e - s > 0.05);
}

export function createMarkings() {
  const items = []; // {type, x0, z0, x1, z1}
  const parts = { dash: [], edge: [], yellow: [], bus: [], zebra: [], stop: [], arrow: [], box: [] };
  function add(type, geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    items.push({ type, x0: +bb.min.x.toFixed(3), z0: +bb.min.z.toFixed(3), x1: +bb.max.x.toFixed(3), z1: +bb.max.z.toFixed(3) });
    parts[type].push(geo);
    return geo;
  }
  // Axis-aligned box marking, centred (cx, cz), size w (x) by d (z).
  function box(type, cx, cz, w, d) {
    return add(type, colored(xform(new THREE.BoxGeometry(w, 0.01, d), cx, MARK_Y[type], cz), 0xffffff));
  }
  // Flat shape marking (turn arrows): geo is a ShapeGeometry in the XY
  // plane; xform flattens it (rx -90) and rotates it (ry).
  function shape(type, geo, cx, cz, ry) {
    return add(type, colored(xform(geo, cx, MARK_Y[type], cz, ry, 1, -Math.PI / 2), 0xffffff));
  }
  // Overlap audit over the recorded rects (exact AABB, epsilon 0.001 —
  // touching edges do not count). Spatial hash, same method as the
  // page audit (game/test/markings-audit.mjs), so the two agree.
  function audit() {
    const CELL = 4, EPS = 0.001;
    const grid = new Map();
    items.forEach((it, i) => {
      for (let cx = Math.floor(it.x0 / CELL); cx <= Math.floor(it.x1 / CELL); cx++) {
        for (let cz = Math.floor(it.z0 / CELL); cz <= Math.floor(it.z1 / CELL); cz++) {
          const k = cx + ',' + cz;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(i);
        }
      }
    });
    const seen = new Set();
    const byPair = {};
    const samples = {};
    for (const idxs of grid.values()) {
      for (let a = 0; a < idxs.length; a++) {
        for (let c = a + 1; c < idxs.length; c++) {
          const i = idxs[a], j = idxs[c];
          const pk = i < j ? i + ':' + j : j + ':' + i;
          if (seen.has(pk)) continue;
          seen.add(pk);
          const A = items[i], B = items[j];
          if (A.x0 < B.x1 - EPS && A.x1 > B.x0 + EPS && A.z0 < B.z1 - EPS && A.z1 > B.z0 + EPS) {
            const t = [A.type, B.type].sort().join('x');
            byPair[t] = (byPair[t] || 0) + 1;
            if (!samples[t]) samples[t] = [];
            if (samples[t].length < 5) samples[t].push({ a: [A.type, A.x0, A.z0, A.x1, A.z1], b: [B.type, B.x0, B.z0, B.x1, B.z1] });
          }
        }
      }
    }
    const total = Object.values(byPair).reduce((s, v) => s + v, 0);
    return { total, byPair, samples, count: items.length };
  }
  // Merged meshes, one per type, named mark-<type> (the page audit
  // collects them by name). The registry rects are also exposed on
  // window for the audit when the world runs in a browser.
  function build(group, prefix = 'mark') {
    for (const type of Object.keys(parts)) {
      if (!parts[type].length) continue;
      const p = MAT_PROPS[type];
      const mesh = mergedMesh(parts[type], new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: p.opacity }));
      mesh.name = prefix + '-' + type;
      group.add(mesh);
    }
    if (typeof window !== 'undefined') window.__markingAudit = { items, audit: audit() };
    return group;
  }
  return { items, parts, add, box, shape, audit, build };
}

// --- Placement rules (shared by the three systems) --------------------
// Intersection box for a crossing at (cx, cz): N-S road half-width hn,
// E-W road half-width he. Box: x [cx-hn, cx+hn], z [cz-he, cz+he].
// A leg zebra crosses ONE road, on ONE leg, outside the box. Its bars
// are long in the road's direction (parallel to traffic, 3.0 long —
// one crosswalk width) and spaced across the road's width (0.7 step).
// The band centre sits (crossHalf + 1.5 + 0.4) out from the
// intersection centre along the leg.
// The stop line belongs to the traffic ENTERING the intersection on
// that leg: 1.5 m before the zebra (further out), spanning the inbound
// lanes only — NOT the bus lane strip, NOT the edge line (avenue:
// 0.7..1.35, centre 1.025, len 0.65; street: 0.2..0.7, centre 0.45,
// len 0.5). Turn arrows sit 3.5 m behind the stop line, one per
// inbound general lane (never in the bus lane).
export const ZEBRA_BAR_LEN = 3.0;
export const ZEBRA_MARGIN = 0.4;
export const STOP_GAP = 1.5;
export const ARROW_BEHIND = 3.5;

export function zebraOffsets(crossHalf) {
  const offs = [];
  for (let o = -crossHalf + 0.35; o <= crossHalf - 0.3; o += 0.7) offs.push(+o.toFixed(2));
  return offs.length ? offs : [0];
}

// One zebra per approach, OUTSIDE the box. leg: 'W' | 'E' (crosses the
// E-W road, on the west/east leg) or 'S' | 'N' (crosses the N-S road).
// crossHalf: half-width of the road being crossed. Returns the band
// centre {x, z} (for the stop line + arrows, further out on the leg).
export function zebraApproach(m, cx, cz, leg, crossHalf) {
  const offs = zebraOffsets(crossHalf);
  let bx, bz;
  if (leg === 'W') { bx = cx - (crossHalf + 1.5 + ZEBRA_MARGIN); bz = cz; }
  if (leg === 'E') { bx = cx + (crossHalf + 1.5 + ZEBRA_MARGIN); bz = cz; }
  if (leg === 'S') { bx = cx; bz = cz - (crossHalf + 1.5 + ZEBRA_MARGIN); }
  if (leg === 'N') { bx = cx; bz = cz + (crossHalf + 1.5 + ZEBRA_MARGIN); }
  if (leg === 'W' || leg === 'E') {
    // Bars long in x (parallel to E-W traffic), spaced in z across the road.
    for (const dz of offs) m.box('zebra', bx, bz + dz, ZEBRA_BAR_LEN, 0.35);
  } else {
    for (const dx of offs) m.box('zebra', bx + dx, bz, 0.35, ZEBRA_BAR_LEN);
  }
  return { x: bx, z: bz };
}

// Stop line 1.5 m before the zebra on the same leg (further from the
// intersection). `lane` is {len, c} — the inbound-lane span, signed
// from the road centreline (positive = the leg's inbound half).
// Returns the stop centre {x, z} (for the arrows, 3.5 m behind it).
export function stopForApproach(m, bandCentre, leg, kind) {
  const lane = kind === 'avenue' ? { len: 0.65, c: 1.025 } : { len: 0.5, c: 0.45 };
  const d = ZEBRA_BAR_LEN / 2 + STOP_GAP + 0.2;
  let sx = bandCentre.x, sz = bandCentre.z;
  if (leg === 'W') { sx -= d; m.box('stop', sx, bandCentre.z + lane.c, 0.4, lane.len); }
  if (leg === 'E') { sx += d; m.box('stop', sx, bandCentre.z - lane.c, 0.4, lane.len); }
  if (leg === 'S') { sz -= d; m.box('stop', bandCentre.x + lane.c, sz, lane.len, 0.4); }
  if (leg === 'N') { sz += d; m.box('stop', bandCentre.x - lane.c, sz, lane.len, 0.4); }
  return { x: sx, z: sz, lane };
}

// Yellow box junction in the intersection centre (avenues only). Bars
// butt-jointed: the horizontal bars are inset by the vertical bars'
// half-width so the corners do not overlap.
export function boxJunction(m, cx, cz, hn, he) {
  const bw = Math.min(2 * hn + 1, 4), bd = Math.min(2 * he + 1, 4);
  m.box('box', cx, cz - bd / 2, bw - 0.12, 0.12);
  m.box('box', cx, cz + bd / 2, bw - 0.12, 0.12);
  m.box('box', cx - bw / 2, cz, 0.12, bd);
  m.box('box', cx + bw / 2, cz, 0.12, bd);
}
