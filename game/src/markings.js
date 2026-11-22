// Markings — ONE source of truth for every road marking in the game.
// All three marking systems (CBD grid, ring/connectors, generator zones)
// record their markings here: one registry, one fixed layer order, one
// audit. Placement rules (Xian 22 Nov 01:16 brief, item 2):
//   - one zebra per approach, OUTSIDE the intersection box (bars 0.3
//     long parallel to traffic, 0.04 wide, spaced 0.08 across the road
//     width — realistic 0.40 m markings at 1u = 10 m, item 3b);
//   - stop line 1.0 m behind the zebra (approach side), spanning the
//     approach lanes but NOT the bus lane strip, NOT the edge line and
//     NOT the double yellow;
//   - nothing else inside the intersection box (box junction only);
//   - dashes / edges / bus lane are gapped at intersections and at
//     zebra bands; each dash is skipped when it would land on a stop
//     line; turn arrows are placed 3.5 behind the stop only where
//     they fit (shapeIfFree) — the 11.2 grid spacing leaves no room
//     for them on the short blocks. No two markings share an area.
// Layer order (y, lower = under): box < bus < dash < edge/yellow <
// zebra < stop < arrow. Any residual overlap renders deterministically.
import * as THREE from '../vendor/three.module.min.js';
import { colored, xform, mergedMesh } from './world.js';

export const MARK_Y = {
  box: 0.210, bus: 0.214, dash: 0.218,
  edge: 0.221, yellow: 0.221, zebra: 0.226, stop: 0.23, arrow: 0.234,
};

const MAT_PROPS = {
  // Road look fix (Xian 22 Nov 11:48 brief, item 3b): realistic marking
  // widths (1u = 10 m) and the #e8e6e0 marking colour at 0.9 opacity.
  // Yellow (centre line / box junction) and the green bus lane keep
  // their semantic colours.
  dash: { color: 0xe8e6e0, opacity: 0.9 },
  edge: { color: 0xe8e6e0, opacity: 0.9 },
  yellow: { color: 0xe8c33d, opacity: 0.9 },
  bus: { color: 0x3a9a6a, opacity: 0.9 },
  zebra: { color: 0xe8e6e0, opacity: 0.9 },
  stop: { color: 0xe8e6e0, opacity: 0.9 },
  arrow: { color: 0xe8e6e0, opacity: 0.9 },
  box: { color: 0xe8c33d, opacity: 0.9 },
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

// --- Global placement guard (all registries share it) -----------------
// The CBD, the ring and the zones are built by three registries, but
// their roads meet at the boundaries — a zone zebra can land on a ring
// stop, a ring edge on a CBD zebra. A marking is recorded ONLY when
// its rect overlaps nothing placed by ANY registry so far (epsilon
// 0.001, touching edges do not count). The first system to claim an
// area keeps it (CBD, then ring, then zones). Skipped markings are
// counted per registry (audit().skipped); the audit stays at 0 by
// construction, and the page audit verifies it independently.
const GLOBAL_CELL = 4, GLOBAL_EPS = 0.001;
const globalGrid = new Map();
function globalOverlaps(x0, z0, x1, z1) {
  for (let cx = Math.floor(x0 / GLOBAL_CELL); cx <= Math.floor(x1 / GLOBAL_CELL); cx++) {
    for (let cz = Math.floor(z0 / GLOBAL_CELL); cz <= Math.floor(z1 / GLOBAL_CELL); cz++) {
      const list = globalGrid.get(cx + ',' + cz);
      if (!list) continue;
      for (const it of list) {
        if (x0 < it.x1 - GLOBAL_EPS && x1 > it.x0 + GLOBAL_EPS && z0 < it.z1 - GLOBAL_EPS && z1 > it.z0 + GLOBAL_EPS) return true;
      }
    }
  }
  return false;
}
function globalClaim(it) {
  for (let cx = Math.floor(it.x0 / GLOBAL_CELL); cx <= Math.floor(it.x1 / GLOBAL_CELL); cx++) {
    for (let cz = Math.floor(it.z0 / GLOBAL_CELL); cz <= Math.floor(it.z1 / GLOBAL_CELL); cz++) {
      const k = cx + ',' + cz;
      if (!globalGrid.has(k)) globalGrid.set(k, []);
      globalGrid.get(k).push(it);
    }
  }
}

export function createMarkings() {
  const items = []; // {type, x0, z0, x1, z1}
  const parts = { dash: [], edge: [], yellow: [], bus: [], zebra: [], stop: [], arrow: [], box: [] };
  const seenRects = new Set();
  let deduped = 0;
  let skipped = 0;
  function add(type, geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const it = { type, x0: +bb.min.x.toFixed(3), z0: +bb.min.z.toFixed(3), x1: +bb.max.x.toFixed(3), z1: +bb.max.z.toFixed(3) };
    // Identical rects (the same crossing built by two districts — the
    // zone defs list some streets twice) are recorded once: a duplicate
    // would z-fight in the merged mesh and count as an overlap.
    const key = it.type + '|' + it.x0 + '|' + it.z0 + '|' + it.x1 + '|' + it.z1;
    if (seenRects.has(key)) { deduped++; return geo; }
    seenRects.add(key);
    // Cross-system guard: skip a marking that would overlap anything
    // placed by any registry so far (see above).
    if (globalOverlaps(it.x0, it.z0, it.x1, it.z1)) { skipped++; return geo; }
    globalClaim(it);
    items.push(it);
    parts[type].push(geo);
    return geo;
  }
  // Axis-aligned box marking, centred (cx, cz), size w (x) by d (z).
  function box(type, cx, cz, w, d) {
    return add(type, colored(xform(new THREE.BoxGeometry(w, 0.01, d), cx, MARK_Y[type], cz), 0xffffff));
  }
  // Flat quad marking, centred (cx, cz), size w (x) by d (z) — same
  // footprint as box() but 2 triangles instead of 12. For zebra bars
  // (item 4: 23,937 bars = 287,244 tris as boxes, ~48k as quads); the
  // top face is all a driver ever sees of a painted marking, and the
  // 0.01-high box sides are invisible at this scale. Single-sided
  // (normal +Y after the -90 deg flatten) — correct for a road marking.
  function flat(type, cx, cz, w, d) {
    return add(type, colored(xform(new THREE.PlaneGeometry(w, d), cx, MARK_Y[type], cz, 0, 1, -Math.PI / 2), 0xffffff));
  }
  // Flat shape marking (turn arrows): geo is a ShapeGeometry in the XY
  // plane; xform flattens it (rx -90) and rotates it (ry).
  function shape(type, geo, cx, cz, ry) {
    return add(type, colored(xform(geo, cx, MARK_Y[type], cz, ry, 1, -Math.PI / 2), 0xffffff));
  }
  // Shape, placed ONLY when its rect overlaps nothing already recorded
  // anywhere (same global guard as add() — the 11.2 grid spacing
  // leaves no room for turn arrows on the short blocks, so they appear
  // wherever the approach geometry allows and are skipped where they
  // would collide with a neighbour's zebra/stop/box). Returns true
  // when placed.
  function shapeIfFree(type, geo, cx, cz, ry) {
    const g = colored(xform(geo, cx, MARK_Y[type], cz, ry, 1, -Math.PI / 2), 0xffffff);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const it = { type, x0: +bb.min.x.toFixed(3), z0: +bb.min.z.toFixed(3), x1: +bb.max.x.toFixed(3), z1: +bb.max.z.toFixed(3) };
    if (globalOverlaps(it.x0, it.z0, it.x1, it.z1)) { skipped++; return false; }
    globalClaim(it);
    items.push(it);
    parts[type].push(g);
    return true;
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
    return { total, byPair, samples, count: items.length, skipped, deduped };
  }
  // Merged meshes, one per type, named mark-<type> (the page audit
  // collects them by name). The registry rects are also exposed on
  // window for the audit when the world runs in a browser — appended
  // to window.__markingAudits (one entry per registry: the CBD grid
  // and the zones each have their own), so no registry overwrites
  // another's audit.
  function build(group, prefix = 'mark') {
    for (const type of Object.keys(parts)) {
      if (!parts[type].length) continue;
      const p = MAT_PROPS[type];
      const mesh = mergedMesh(parts[type], new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: p.opacity }));
      mesh.name = prefix + '-' + type;
      group.add(mesh);
    }
    if (typeof window !== 'undefined') {
      window.__markingAudits = window.__markingAudits || [];
      window.__markingAudits.push({ items, audit: audit() });
      window.__markingAudit = { items, audit: audit() };
    }
    return group;
  }
  return { items, parts, add, box, flat, shape, shapeIfFree, audit, build };
}

// --- Shared longitudinal-gap helpers (ring + zones) -------------------
// Gaps along a road per crossing (centre c, half h): the intersection
// box (+0.6) and the zebra bands on both legs ([c +/- (h+0.4),
// c +/- (h+BAR_LEN+0.4)]). Dashes and strips are cut there; each dash
// is additionally skipped when it would land on a stop line.
export function crossingGaps(c, h) {
  const gaps = [[c - h - 0.6, c + h + 0.6]];
  for (const s of [-1, 1]) gaps.push([c + s * (h + 0.4), c + s * (h + ZEBRA_BAR_LEN + 0.4)]);
  return gaps.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((p, q) => p[0] - q[0]);
}
export function allCrossingGaps(crossings) {
  return crossings.flatMap(({ c, h }) => crossingGaps(c, h)).sort((p, q) => p[0] - q[0]);
}
// Stop lines on a road, for the dash skip. `swap` is true for E-W
// roads (right-hand traffic: the -leg stop is on the +offset half).
export function stopSpansFor(crossings, swap) {
  const d = ZEBRA_BAR_LEN + 0.6 + STOP_GAP;
  return crossings.flatMap(({ c, h }) => [
    { p: c - (h + d), side: swap ? 1 : -1 },
    { p: c + (h + d), side: swap ? -1 : 1 },
  ]);
}
export function dashBlockedBy(p, side, off, stops, kind) {
  const [lo, hi] = kind === 'avenue' ? [0.7, 1.35] : [0.15, 0.5];
  if (off < lo - 0.06 || off > hi + 0.06) return false;
  return stops.some((st) => st.side === side && Math.abs(p - st.p) < 0.7);
}

// --- Placement rules (shared by the three systems) --------------------
// Intersection box for a crossing at (cx, cz): N-S road half-width hn,
// E-W road half-width he. Box: x [cx-hn, cx+hn], z [cz-he, cz+he].
// A leg zebra crosses ONE road, on ONE leg, outside the box. Its bars
// are long in the road's direction (parallel to traffic, 0.3 long —
// one crosswalk width) and spaced across the road's width (0.08 step,
// 0.04 wide bars with 0.04 gaps — realistic 0.40 m markings at
// 1u = 10 m). The band centre sits (boxHalf + BAR_LEN/2 + 0.4) out from
// the intersection centre along the leg.
// The stop line belongs to the traffic ENTERING the intersection on
// that leg: 1.5 m before the zebra (further out), spanning the inbound
// lanes only — NOT the bus lane strip, NOT the edge line (avenue:
// 0.7..1.35, centre 1.025, len 0.65; street: 0.05..0.55, centre 0.3,
// len 0.5 — the street stop ends before the edge line at 0.6).
// inbound general lane (never in the bus lane).
export const ZEBRA_BAR_LEN = 0.3;
export const ZEBRA_MARGIN = 0.4;
export const STOP_GAP = 1.0;
export const ARROW_BEHIND = 3.5;

export function zebraOffsets(crossHalf, edge) {
  // Symmetric offsets, no centre bar (the centre holds the median on
  // avenues and the double yellow on streets — a stripe must not cover
  // either), step 0.08 (0.04 bar + 0.04 gap), capped so the outermost
  // stripe ends 0.05 clear of the edge line. `edge` is the edge line's
  // offset from the centreline (avenue 1.7, street 0.6, connector 3.2).
  const maxOff = (edge === undefined ? crossHalf - 0.5 : edge) - 0.07;
  const offs = [];
  for (let o = 0.04; o <= maxOff + 0.001; o += 0.08) offs.push(-+o.toFixed(2), +o.toFixed(2));
  return offs.length ? offs.sort((a, b) => a - b) : [0];
}

// One zebra per approach, OUTSIDE the box. leg: 'W' | 'E' (crosses the
// E-W road, on the west/east leg) or 'S' | 'N' (crosses the N-S road).
// crossHalf: half-width of the road being crossed (sets the bar
// spacing across it). boxHalf: half-width of the road the zebra sits
// ALONG (the intersection box's extent along the leg — the band must
// clear it). Returns the band centre {x, z} (for the stop line +
// arrows, further out on the leg).
export function zebraApproach(m, cx, cz, leg, crossHalf, boxHalf, edge) {
  const offs = zebraOffsets(crossHalf, edge);
  const d = (boxHalf === undefined ? crossHalf : boxHalf) + ZEBRA_BAR_LEN / 2 + ZEBRA_MARGIN;
  let bx, bz;
  if (leg === 'W') { bx = cx - d; bz = cz; }
  if (leg === 'E') { bx = cx + d; bz = cz; }
  if (leg === 'S') { bx = cx; bz = cz - d; }
  if (leg === 'N') { bx = cx; bz = cz + d; }
  if (leg === 'W' || leg === 'E') {
    // Bars long in x (parallel to E-W traffic), spaced in z across the road.
    for (const dz of offs) m.flat('zebra', bx, bz + dz, ZEBRA_BAR_LEN, 0.04);
  } else {
    for (const dx of offs) m.flat('zebra', bx + dx, bz, 0.04, ZEBRA_BAR_LEN);
  }
  return { x: bx, z: bz };
}

// Stop line 1.5 m before the zebra on the same leg (further from the
// intersection). `lane` is {len, c} — the inbound-lane span, signed
// from the road centreline. Right-hand traffic: the W leg (eastbound)
// is on the south half (z + c), the E leg (westbound) on the north
// half (z - c); the S leg (southbound, z < cz) on the west half
// (x - c), the N leg (northbound, z > cz) on the east half (x + c).
// `lane` overrides the kind default (avenue 0.7..1.35, street 0.05..0.55
// — the street stop must end before the edge line at 0.6)
// — e.g. the 7-wide ring connector: {len: 2.8, c: 1.6}.
// Returns the stop centre {x, z} (for the arrows, 3.5 m behind it).
export function stopForApproach(m, bandCentre, leg, kind, laneOverride) {
  const lane = laneOverride || (kind === 'avenue' ? { len: 0.65, c: 1.025 } : { len: 0.35, c: 0.325 });
  const d = ZEBRA_BAR_LEN / 2 + STOP_GAP + 0.2;
  let sx = bandCentre.x, sz = bandCentre.z;
  if (leg === 'W') { sx -= d; m.box('stop', sx, bandCentre.z + lane.c, 0.04, lane.len); }
  if (leg === 'E') { sx += d; m.box('stop', sx, bandCentre.z - lane.c, 0.04, lane.len); }
  if (leg === 'S') { sz -= d; m.box('stop', bandCentre.x - lane.c, sz, lane.len, 0.04); }
  if (leg === 'N') { sz += d; m.box('stop', bandCentre.x + lane.c, sz, lane.len, 0.04); }
  return { x: sx, z: sz, lane };
}

// Turn arrows 3.5 m behind the stop line, one per inbound GENERAL lane
// (never in the bus lane). `stop` is the stop centre from
// stopForApproach. Lanes (from the centreline): avenue left 0.825 +
// straight 1.175 (the 1.525 lane is the bus lane — no arrow); street
// left 0.15 + right 0.45. `lanesOverride` is [{off, ry}] — e.g. the
// 7-wide ring connector (one lane per direction): [{off: 1.6, ry}].
// ry: north 0, east -PI/2, south PI, west PI/2.
// Arrows are placed with shapeIfFree: on the 11.2 grid the approach
// zones of adjacent intersections overlap, so an arrow that would
// collide with a neighbour's zebra/stop/box is skipped (the registry
// counts it). Returns the number placed.
export function arrowsForApproach(m, stop, leg, kind, lanesOverride) {
  const d = ARROW_BEHIND;
  const lanes = lanesOverride || (kind === 'avenue'
    ? [{ off: 0.825, ry: null }, { off: 1.175, ry: null }]
    : [{ off: 0.15, ry: null }, { off: 0.45, ry: null }]);
  // ry per lane: [inner (left turn), outer (straight / right turn)].
  const rys = {
    W: [0, -Math.PI / 2], // eastbound: left -> north, straight -> east
    E: [Math.PI, Math.PI / 2], // westbound: left -> south, straight -> west
    S: [-Math.PI / 2, Math.PI], // southbound: left -> east, straight -> south
    N: [Math.PI / 2, 0], // northbound: left -> west, straight -> north
  }[leg];
  if (kind === 'street' && !lanesOverride) rys[1] = { W: Math.PI, E: 0, S: Math.PI / 2, N: -Math.PI / 2 }[leg]; // right turn
  const geo = arrowGeometry();
  let placed = 0;
  const put = (x, z, ry) => { if (m.shapeIfFree('arrow', geo, x, z, ry)) placed++; };
  if (lanesOverride) {
    // One straight arrow per approach (the override carries its ry).
    lanes.forEach((L) => {
      if (leg === 'W') put(stop.x - d, stop.z + L.off, L.ry);
      if (leg === 'E') put(stop.x + d, stop.z - L.off, L.ry);
      if (leg === 'S') put(stop.x - L.off, stop.z - d, L.ry);
      if (leg === 'N') put(stop.x + L.off, stop.z + d, L.ry);
    });
    return placed;
  }
  lanes.forEach((L, i) => {
    const ry = rys[i];
    if (leg === 'W') put(stop.x - d, stop.z + L.off, ry);
    if (leg === 'E') put(stop.x + d, stop.z - L.off, ry);
    if (leg === 'S') put(stop.x - L.off, stop.z - d, ry);
    if (leg === 'N') put(stop.x + L.off, stop.z + d, ry);
  });
  return placed;
}

// A small turn arrow (0.7 long, 0.112 wide — 70% of the old 1.0 x 0.16,
// road look fix item 3b), pointing north (+Y) in the
// shape's own plane at ry 0 — the registry's shape() flattens it
// (rotateX -PI/2) and turns it, so this geometry must stay UNROTATED
// (rotating it here would stand it upright again). 0.112 wide so it
// sits inside one lane without touching the lane dividers (avenue
// dividers at +/-1.0/1.35, street divider at +/-0.3).
export function arrowGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(-0.028, -0.35); sh.lineTo(0.028, -0.35); sh.lineTo(0.028, 0.07);
  sh.lineTo(0.056, 0.07); sh.lineTo(0, 0.35); sh.lineTo(-0.056, 0.07);
  sh.lineTo(-0.028, 0.07); sh.closePath();
  return new THREE.ShapeGeometry(sh);
}

// Yellow box junction in the intersection centre (avenues only). Bars
// butt-jointed: the horizontal bars are inset by the vertical bars'
// half-width so the corners do not overlap. The box spans the
// intersection exactly (never wider — a wider box would run into the
// zebra bands, which start 0.4 outside the box).
export function boxJunction(m, cx, cz, hn, he) {
  const bw = Math.min(2 * hn, 4), bd = Math.min(2 * he, 4);
  m.box('box', cx, cz - bd / 2, bw - 0.12, 0.12);
  m.box('box', cx, cz + bd / 2, bw - 0.12, 0.12);
  m.box('box', cx - bw / 2, cz, 0.12, bd);
  m.box('box', cx + bw / 2, cz, 0.12, bd);
}
