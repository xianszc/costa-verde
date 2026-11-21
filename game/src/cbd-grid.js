// AZZURA HEIST — CBD street grid (Xian 21 Nov 15:22 — REPLACES the packed
// tower rows). ONE source of truth: the street list below drives the road
// geometry, sidewalks, medians, markings, furniture, traffic lanes, the
// minimap AND the block test. Towers never stand in touching rows: every
// block holds 1 tower (a few hold a twin pair on a shared podium, never
// more than 2 buildings), every block is surrounded by roads on all four
// sides, towers sit back 8–15 m from the curb with plaza / trees /
// planters around them. Map size is UNCHANGED (2,400 x 1,400 m,
// 1 unit = 10 m).
//
// Geometry (units; 1 unit = 10 m):
//   Main avenues: 3.5 wide (35 m) — 6 lanes x 0.35 (3.5 m), raised
//     median 0.4 (4 m), sidewalks 0.5 (5 m) both sides.
//   Secondary streets: 2.2 wide (22 m) — 4 lanes x 0.3 (3 m), double
//     yellow centre, sidewalks 0.4 both sides.
//   Blocks: ~9.0 x 9.0 (90 m) between streets; the two centre columns
//     are 8.35 wide (the avenue takes the middle).
//   CBD extent: x -34.7..34.7, z -45.9..12.3 — 69.4 x 58.2 = 4,039 units².
//     (Xian's ~3,500 target cannot hold 36 towers on 90 m blocks with
//     22 m streets: 30 blocks x 81 units² of block + ~35% street share
//     needs ~4,000. The tower count (36) is kept; the footprint is
//     ~15% over, stated honestly.)
//   30 blocks: 20 single towers + 8 twin pairs on shared podiums
//     (16 towers) + 2 green blocks (park + plaza) = 36 towers.
//   The ring avenue (z -42) stays as the CBD's northern boundary road
//     WEST and EAST of the CBD; inside the CBD x-range the z -44.8
//     street takes its place. The commercial ring's north-strip south
//     row (z -37.5..-31) is gone — those are CBD blocks now.
import * as THREE from '../vendor/three.module.min.js';
import {
  box, mergedMesh, colored, xform, vertexColorMat, M,
} from './world.js';
import { seededRandom } from './world.js';

// --- the street list (the single source of truth) ---
// axis 'x': a north-south street (constant x, runs along z).
// axis 'z': an east-west street (constant z, runs along x).
// kind 'avenue': 3.5 wide, 6 lanes, median. kind 'street': 2.2 wide,
// 4 lanes, double yellow centre. from/to: the road's extent.
export const CBD_NS = [
  { x: -33.6, w: 2.2, kind: 'street', z0: -45.9, z1: 12.3, name: 'VIA DEL FARO' },
  { x: -22.4, w: 2.2, kind: 'street', z0: -45.9, z1: 12.3, name: 'VIA DELLE VELA' },
  { x: -11.2, w: 2.2, kind: 'street', z0: -45.9, z1: 12.3, name: 'VIA DEL SOLE' },
  { x: 0, w: 3.5, kind: 'avenue', z0: -45.9, z1: 12.3, name: 'CORSO AZZURRA' },
  { x: 11.2, w: 2.2, kind: 'street', z0: -45.9, z1: 12.3, name: 'VIA DEL MARE' },
  { x: 22.4, w: 2.2, kind: 'street', z0: -45.9, z1: 12.3, name: 'VIA DEI LIMONI' },
  { x: 33.6, w: 2.2, kind: 'street', z0: -45.9, z1: 12.3, name: 'VIA DEL PORTO' },
];
export const CBD_EW = [
  { z: -44.8, w: 2.2, kind: 'street', x0: -34.7, x1: 34.7, name: 'VIA DEL NORD' },
  { z: -33.6, w: 2.2, kind: 'street', x0: -34.7, x1: 34.7, name: 'VIA DELLE ROSE' },
  { z: -22.4, w: 2.2, kind: 'street', x0: -34.7, x1: 34.7, name: 'VIA DEL CASTELLO' },
  { z: -11.2, w: 2.2, kind: 'street', x0: -34.7, x1: 34.7, name: 'VIA DEL MERCATO' },
  { z: 0, w: 3.5, kind: 'avenue', x0: -60, x1: 60, name: 'LUNGOMARE' },
  { z: 11.2, w: 2.2, kind: 'street', x0: -34.7, x1: 34.7, name: 'VIA DEL MOLO' },
];
// Sidewalk width beside each road (avenue 0.5 = 5 m, street 0.4 = 4 m).
export function sidewalkW(s) { return s.kind === 'avenue' ? 0.5 : 0.4; }
// Road surface half-width (lanes + median, no sidewalks).
export function roadHalf(s) {
  return s.kind === 'avenue' ? 1.25 : 0.7;
}

// --- blocks (derived from the streets: between consecutive roads) ---
// kind: 'single' | 'twin' | 'park' | 'plaza'. The two centre columns
// are 8.35 wide (avenue in the middle); the rest are 9.0.
const BLOCK_KINDS = [
  // row 0 (north edge, z -43.7..-34.7)
  ['park', 'twin', 'single', 'single', 'twin', 'single'],
  // row 1 (z -32.5..-23.5)
  ['single', 'twin', 'single', 'single', 'twin', 'single'],
  // row 2 (z -21.3..-12.3) — the Azzura Tower is col 3 (east of the avenue)
  ['single', 'single', 'single', 'azzura', 'single', 'twin'],
  // row 3 (z -10.1..-1.75) — the civic plaza faces the boulevard
  ['single', 'twin', 'plaza', 'single', 'single', 'twin'],
  // row 4 (south edge, z 1.75..10.1)
  ['single', 'single', 'twin', 'single', 'single', 'single'],
];

export function cbdGridBlocks() {
  const nsEdges = [];
  for (const s of CBD_NS) nsEdges.push(s.x - s.w / 2, s.x + s.w / 2);
  const ewEdges = [];
  for (const s of CBD_EW) ewEdges.push(s.z - s.w / 2, s.z + s.w / 2);
  // Block columns sit between the roads: right edge of road i .. left
  // edge of road i+1. The outer blocks are bounded by the first/last
  // road on each side (the boundary streets themselves).
  const cols = [];
  for (let i = 0; i < CBD_NS.length - 1; i++) {
    cols.push({ x0: CBD_NS[i].x + CBD_NS[i].w / 2, x1: CBD_NS[i + 1].x - CBD_NS[i + 1].w / 2 });
  }
  const rows = [];
  for (let i = 0; i < CBD_EW.length - 1; i++) {
    rows.push({ z0: CBD_EW[i].z + CBD_EW[i].w / 2, z1: CBD_EW[i + 1].z - CBD_EW[i + 1].w / 2 });
  }
  const blocks = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      blocks.push({
        id: `cbd-${c}-${r}`,
        col: c, row: r,
        x0: cols[c].x0, x1: cols[c].x1,
        z0: rows[r].z0, z1: rows[r].z1,
        cx: (cols[c].x0 + cols[c].x1) / 2,
        cz: (rows[r].z0 + rows[r].z1) / 2,
        kind: BLOCK_KINDS[r][c],
      });
    }
  }
  return blocks;
}

// --- road + sidewalk rects (for the overlap test + plot validation) ---
export function cbdGridRoadRects() {
  const r = [];
  for (const s of CBD_NS) r.push({ x0: s.x - s.w / 2, z0: s.z0, x1: s.x + s.w / 2, z1: s.z1, id: `ns-${s.name}` });
  for (const s of CBD_EW) r.push({ x0: s.x0, z0: s.z - s.w / 2, x1: s.x1, z1: s.z + s.w / 2, id: `ew-${s.name}` });
  return r;
}
export function cbdGridSidewalkRects() {
  const r = [];
  for (const s of CBD_NS) {
    const sw = sidewalkW(s);
    r.push({ x0: s.x - s.w / 2 - sw, z0: s.z0, x1: s.x - s.w / 2, z1: s.z1 });
    r.push({ x0: s.x + s.w / 2, z0: s.z0, x1: s.x + s.w / 2 + sw, z1: s.z1 });
  }
  for (const s of CBD_EW) {
    const sw = sidewalkW(s);
    r.push({ x0: s.x0, z0: s.z - s.w / 2 - sw, x1: s.x1, z1: s.z - s.w / 2 });
    r.push({ x0: s.x0, z0: s.z + s.w / 2, x1: s.x1, z1: s.z + s.w / 2 + sw });
  }
  return r;
}
// Boulevard median segments: the raised median runs along z 0 between
// the north-south streets, with a gap at every intersection. The
// monorail pillars stand ONLY in this median (never in a lane).
export function cbdGridMedianSegments() {
  const bounds = [-60];
  for (const s of CBD_NS) bounds.push(s.x - s.w / 2, s.x + s.w / 2);
  bounds.push(60);
  const segs = [];
  for (let i = 0; i < bounds.length; i += 2) {
    const x0 = bounds[i], x1 = bounds[i + 1];
    if (x1 - x0 > 1) segs.push({ x0, z0: -0.2, x1, z1: 0.2 });
  }
  return segs;
}
// N-S avenue median segments (x 0, between the east-west streets).
export function cbdAvenueMedianSegments() {
  const bounds = [-45.9];
  for (const s of CBD_EW) bounds.push(s.z - s.w / 2, s.z + s.w / 2);
  bounds.push(12.3);
  const segs = [];
  for (let i = 0; i < bounds.length; i += 2) {
    const z0 = bounds[i], z1 = bounds[i + 1];
    if (z1 - z0 > 1) segs.push({ x0: -0.2, z0, x1: 0.2, z1 });
  }
  return segs;
}

// --- traffic lanes (loop paths, same shape as roads.js trafficLanes) ---
// A rectangular loop per street pair, driven on the road centreline
// (slice B replaces these with the graph lanes + turning + signals).
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
export function cbdGridLanes() {
  return [
    // The boulevard loop (the main east-west avenue, both directions
    // on the centreline — slice B splits it into directed lanes).
    { name: 'boulevard', pts: loopPath(-56, -0.7, 56, 0.7, 4), speed: 9 },
    // The N-S avenue loop (Corso Azzurra, x 0).
    { name: 'cbd-avenue', pts: loopPath(-0.7, -44, 0.7, 11, 1.2), speed: 8 },
    // Outer grid loop: the boundary streets (x +/-33.6, z -44.8/11.2).
    { name: 'cbd-outer', pts: loopPath(-33.6, -44.8, 33.6, 11.2, 1.2), speed: 7 },
    // Inner grid loop: the z -22.4 / -11.2 streets + x +/-22.4.
    { name: 'cbd-inner', pts: loopPath(-22.4, -22.4, 22.4, -11.2, 1.2), speed: 7 },
  ];
}
export function cbdGridMinimap() {
  const lines = [];
  for (const s of CBD_NS) lines.push({ x1: s.x, z1: s.z0, x2: s.x, z2: s.z1, w: s.w });
  for (const s of CBD_EW) lines.push({ x1: s.x0, z1: s.z, x2: s.x1, z2: s.z, w: s.w });
  return lines;
}

// --- traffic signals ---
// Every intersection (N-S road x E-W road) has a signal. Phase cycles
// 40 s: NS green 17 s, NS amber 3 s, EW green 17 s, EW amber 3 s.
// Intersections stagger by (ix + iz) % 2 so the grid alternates — a
// green wave down the avenues instead of every light flipping at once.
// Lenses are ONE InstancedMesh per colour (3 draw calls for all 42
// intersections); the ticker recolours the instances each second.
export const SIGNAL_CYCLE = 40;
export function signalPhase(ix, iz, t) {
  const off = ((ix + iz) % 2) * (SIGNAL_CYCLE / 2);
  const p = (((t + off) % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  if (p < 17) return 'NS';
  if (p < 20) return 'NS_AMBER';
  if (p < 37) return 'EW';
  return 'EW_AMBER';
}

// --- geometry: build the whole grid (one merged mesh per material) ---
// Returns { group, tickers }. The road material comes from the caller
// (roads.js owns the asphalt texture) so there is no import cycle.
function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e5a8a'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#f7ebd7'; ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Intervals of [from, to] outside every [g0, g1] gap (for dashes and
// edge lines, which stop at intersections).
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

// A small turn arrow, laid flat (shape points +Y; rotateX(-90) makes
// it point north/-Z; the ry argument then turns it). 1.0 long, 0.25 wide.
function flatArrow(x, z, ry, s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.06, -0.5); sh.lineTo(0.06, -0.5); sh.lineTo(0.06, 0.1);
  sh.lineTo(0.125, 0.1); sh.lineTo(0, 0.5); sh.lineTo(-0.125, 0.1);
  sh.lineTo(-0.06, 0.1); sh.closePath();
  const g = new THREE.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  g.scale(s, 1, s);
  return xform(g, x, 0.22, z, ry);
}

export function buildCBDGrid(opts = {}) {
  const g = new THREE.Group();
  g.name = 'cbdGrid';
  const tickers = [];
  const rnd = seededRandom(20261121);
  const roadMat = opts.roadMat || new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.92, flatShading: true });

  // ---------- road slabs (E-W full length; N-S segmented between them) ----------
  const roadParts = [];
  for (const s of CBD_EW) {
    roadParts.push(colored(xform(new THREE.BoxGeometry(s.x1 - s.x0, 0.3, s.w), (s.x0 + s.x1) / 2, 0.05, s.z), 0xffffff));
  }
  const ewGaps = CBD_EW.map((s) => [s.z - s.w / 2, s.z + s.w / 2]);
  for (const s of CBD_NS) {
    for (const [a, b] of segmentsAlong(s.z0, s.z1, ewGaps)) {
      roadParts.push(colored(xform(new THREE.BoxGeometry(s.w, 0.3, b - a), s.x, 0.05, (a + b) / 2), 0xffffff));
    }
  }
  const roadMesh = mergedMesh(roadParts, roadMat);
  roadMesh.name = 'cbd-roads';
  g.add(roadMesh);

  // ---------- sidewalks (E-W full length; N-S segmented) ----------
  const swMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.95, flatShading: true });
  const swParts = [];
  for (const s of CBD_EW) {
    const sw = sidewalkW(s);
    swParts.push(colored(xform(new THREE.BoxGeometry(s.x1 - s.x0, 0.24, sw), (s.x0 + s.x1) / 2, 0.12, s.z - s.w / 2 - sw / 2), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(s.x1 - s.x0, 0.24, sw), (s.x0 + s.x1) / 2, 0.12, s.z + s.w / 2 + sw / 2), 0xffffff));
  }
  const ewSwGaps = CBD_EW.map((s) => {
    const sw = sidewalkW(s);
    return [s.z - s.w / 2 - sw, s.z + s.w / 2 + sw];
  });
  for (const s of CBD_NS) {
    const sw = sidewalkW(s);
    for (const [a, b] of segmentsAlong(s.z0, s.z1, ewSwGaps)) {
      swParts.push(colored(xform(new THREE.BoxGeometry(sw, 0.24, b - a), s.x - s.w / 2 - sw / 2, 0.12, (a + b) / 2), 0xffffff));
      swParts.push(colored(xform(new THREE.BoxGeometry(sw, 0.24, b - a), s.x + s.w / 2 + sw / 2, 0.12, (a + b) / 2), 0xffffff));
    }
  }
  const swMesh = mergedMesh(swParts, swMat);
  swMesh.name = 'cbd-sidewalks';
  g.add(swMesh);

  // ---------- medians (boulevard + N-S avenue) + planters ----------
  const medMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.95, flatShading: true });
  const medParts = [];
  for (const seg of cbdGridMedianSegments()) {
    medParts.push(colored(xform(new THREE.BoxGeometry(seg.x1 - seg.x0, 0.35, 0.4), (seg.x0 + seg.x1) / 2, 0.175, 0), 0xffffff));
  }
  for (const seg of cbdAvenueMedianSegments()) {
    medParts.push(colored(xform(new THREE.BoxGeometry(0.4, 0.35, seg.z1 - seg.z0), 0, 0.175, (seg.z0 + seg.z1) / 2), 0xffffff));
  }
  const medMesh = mergedMesh(medParts, medMat);
  medMesh.name = 'cbd-medians';
  g.add(medMesh);
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x5a7a4a, roughness: 0.95, flatShading: true });
  const planterParts = [];
  for (const seg of cbdGridMedianSegments()) {
    const len = seg.x1 - seg.x0;
    if (len > 4) planterParts.push(colored(xform(new THREE.BoxGeometry(1.6, 0.5, 0.3), (seg.x0 + seg.x1) / 2, 0.6, 0), 0xffffff));
  }
  for (const seg of cbdAvenueMedianSegments()) {
    const len = seg.z1 - seg.z0;
    if (len > 4) planterParts.push(colored(xform(new THREE.BoxGeometry(0.3, 0.5, 1.6), 0, 0.6, (seg.z0 + seg.z1) / 2), 0xffffff));
  }
  if (planterParts.length) {
    const planterMesh = mergedMesh(planterParts, planterMat);
    planterMesh.name = 'cbd-median-planters';
    g.add(planterMesh);
  }

  // ---------- markings ----------
  // Lane geometry: avenue lanes 0.35 wide (centres +/-0.375/0.725/1.075,
  // dividers at +/-0.55/0.9, edges at +/-1.25, median +/-0.2);
  // street lanes 0.3 wide (centres +/-0.15/0.45, dividers at +/-0.3,
  // double yellow at +/-0.08, edges at +/-0.6).
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.75 });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xe8c33d, transparent: true, opacity: 0.65 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.7 });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x3a9a6a, transparent: true, opacity: 0.55 });
  const dashes = [];
  const yellows = [];
  const whites = [];
  const greens = [];
  // Gaps (intersection spans) along each road, for dashes/edges.
  const nsGapAt = (s) => CBD_EW.map((e) => [e.z - e.w / 2 - 0.6, e.z + e.w / 2 + 0.6]);
  const ewGapAt = (s) => CBD_NS.map((n) => [n.x - n.w / 2 - 0.6, n.x + n.w / 2 + 0.6]);
  for (const s of CBD_NS) {
    const gaps = nsGapAt(s);
    const segs = segmentsAlong(s.z0, s.z1, gaps);
    const divs = s.kind === 'avenue' ? [0.55, 0.9] : [0.3];
    for (const [a, b] of segs) {
      for (const off of divs) {
        for (const side of [-1, 1]) {
          for (let z = a + 1; z <= b - 1; z += 4) {
            dashes.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, 2), s.x + side * off, 0.22, z), 0xffffff));
          }
        }
      }
      // Edge lines (solid white) + double yellow (streets) + bus lane (avenues).
      for (const side of [-1, 1]) {
        const e = s.kind === 'avenue' ? 1.25 : 0.6;
        whites.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, b - a), s.x + side * e, 0.22, (a + b) / 2), 0xffffff));
        if (s.kind === 'avenue') greens.push(colored(xform(new THREE.BoxGeometry(0.08, 0.01, b - a), s.x + side * 1.0, 0.22, (a + b) / 2), 0xffffff));
        else yellows.push(colored(xform(new THREE.BoxGeometry(0.08, 0.01, b - a), s.x + side * 0.08, 0.22, (a + b) / 2), 0xffffff));
      }
    }
  }
  for (const s of CBD_EW) {
    const gaps = ewGapAt(s);
    const segs = segmentsAlong(s.x0, s.x1, gaps);
    const divs = s.kind === 'avenue' ? [0.55, 0.9] : [0.3];
    for (const [a, b] of segs) {
      for (const off of divs) {
        for (const side of [-1, 1]) {
          for (let x = a + 1; x <= b - 1; x += 4) {
            dashes.push(colored(xform(new THREE.BoxGeometry(2, 0.01, 0.12), x, 0.22, s.z + side * off), 0xffffff));
          }
        }
      }
      for (const side of [-1, 1]) {
        const e = s.kind === 'avenue' ? 1.25 : 0.6;
        whites.push(colored(xform(new THREE.BoxGeometry(b - a, 0.01, 0.12), (a + b) / 2, 0.22, s.z + side * e), 0xffffff));
        if (s.kind === 'avenue') greens.push(colored(xform(new THREE.BoxGeometry(b - a, 0.01, 0.08), (a + b) / 2, 0.22, s.z + side * 1.0), 0xffffff));
        else yellows.push(colored(xform(new THREE.BoxGeometry(b - a, 0.01, 0.08), (a + b) / 2, 0.22, s.z + side * 0.08), 0xffffff));
      }
    }
  }
  const dashMesh = mergedMesh(dashes, dashMat);
  dashMesh.name = 'cbd-dashes';
  g.add(dashMesh);
  const yellowMesh = mergedMesh(yellows, yellowMat);
  yellowMesh.name = 'cbd-yellow';
  g.add(yellowMesh);
  const whiteMesh = mergedMesh(whites, whiteMat);
  whiteMesh.name = 'cbd-edges';
  g.add(whiteMesh);
  if (greens.length) {
    const greenMesh = mergedMesh(greens, greenMat);
    greenMesh.name = 'cbd-buslane';
    g.add(greenMesh);
  }

  // ---------- zebras, stop lines, turn arrows, box junctions ----------
  const zebraParts = [];
  const stopParts = [];
  const arrowParts = [];
  const boxParts = [];
  CBD_NS.forEach((ns, ix) => {
    CBD_EW.forEach((ew, iz) => {
      const cx = ns.x, cz = ew.z;
      const hn = ns.w / 2, he = ew.w / 2;
      const ave = ns.kind === 'avenue' || ew.kind === 'avenue';
      // Zebra bars are spaced across the road being crossed (avenues
      // are wider, so their bars spread further apart).
      const eOffs = ew.kind === 'avenue' ? [-0.9, -0.3, 0.3, 0.9] : [-0.45, -0.15, 0.15, 0.45];
      const nOffs = ns.kind === 'avenue' ? [-0.9, -0.3, 0.3, 0.9] : [-0.45, -0.15, 0.15, 0.45];
      // Zebra across the E-W road (bars long in x, spaced in z).
      for (const dz of eOffs) {
        zebraParts.push(colored(xform(new THREE.BoxGeometry(2 * hn + 0.4, 0.01, 0.35), cx, 0.22, cz + dz), 0xffffff));
      }
      // Zebra across the N-S road (bars long in z, spaced in x).
      for (const dx of nOffs) {
        zebraParts.push(colored(xform(new THREE.BoxGeometry(0.35, 0.01, 2 * he + 0.4), cx + dx, 0.22, cz), 0xffffff));
      }
      // Stop lines, one per approach, spanning the approach half.
      const ewHalf = ew.kind === 'avenue' ? 1.25 : 0.7;
      const nsHalf = ns.kind === 'avenue' ? 1.25 : 0.7;
      // E-W road, west approach (eastbound, south half): stop at x = cx - hn - 1.4.
      stopParts.push(colored(xform(new THREE.BoxGeometry(0.4, 0.01, ewHalf - 0.2), cx - hn - 1.4, 0.22, cz + ewHalf / 2 + 0.1), 0xffffff));
      // E-W road, east approach (westbound, north half).
      stopParts.push(colored(xform(new THREE.BoxGeometry(0.4, 0.01, ewHalf - 0.2), cx + hn + 1.4, 0.22, cz - ewHalf / 2 - 0.1), 0xffffff));
      // N-S road, south approach (northbound, east half).
      stopParts.push(colored(xform(new THREE.BoxGeometry(nsHalf - 0.2, 0.01, 0.4), cx + nsHalf / 2 + 0.1, 0.22, cz - he - 1.4), 0xffffff));
      // N-S road, north approach (southbound, west half).
      stopParts.push(colored(xform(new THREE.BoxGeometry(nsHalf - 0.2, 0.01, 0.4), cx - nsHalf / 2 - 0.1, 0.22, cz + he + 1.4), 0xffffff));
      // Turn arrows: flatArrow points north at ry 0; east is -PI/2,
      // west +PI/2, south PI (Three.js +Y rotation). Each approach
      // gets a left arrow in its inner (median-side) lane, a straight
      // arrow in the middle lane (avenues), and a right arrow in its
      // outer lane. Placed 3.5 behind the stop line.
      const lanes = (kind) => (kind === 'avenue' ? [-1.075, -0.725, -0.375, 0.375, 0.725, 1.075] : [-0.45, -0.15, 0.15, 0.45]);
      // Eastbound (south half of the E-W road): left = north, straight
      // = east, right = south.
      const ewL = lanes(ew.kind).filter((v) => v > 0);
      arrowParts.push(flatArrow(cx - hn - 5, cz + ewL[0], 0)); // left -> north
      if (ewL.length > 2) arrowParts.push(flatArrow(cx - hn - 5, cz + ewL[1], -Math.PI / 2)); // straight -> east
      arrowParts.push(flatArrow(cx - hn - 5, cz + ewL[ewL.length - 1], Math.PI)); // right -> south
      // Westbound (north half): left = south, straight = west, right = north.
      const ewLW = lanes(ew.kind).filter((v) => v < 0);
      arrowParts.push(flatArrow(cx + hn + 5, cz + ewLW[ewLW.length - 1], Math.PI)); // left -> south
      if (ewLW.length > 2) arrowParts.push(flatArrow(cx + hn + 5, cz + ewLW[1], Math.PI / 2)); // straight -> west
      arrowParts.push(flatArrow(cx + hn + 5, cz + ewLW[0], 0)); // right -> north
      // Northbound (east half of the N-S road): left = west, straight =
      // north, right = east.
      const nsL = lanes(ns.kind).filter((v) => v > 0);
      arrowParts.push(flatArrow(cx + nsL[0], cz + he + 5, Math.PI / 2)); // left -> west
      if (nsL.length > 2) arrowParts.push(flatArrow(cx + nsL[1], cz + he + 5, 0)); // straight -> north
      arrowParts.push(flatArrow(cx + nsL[nsL.length - 1], cz + he + 5, -Math.PI / 2)); // right -> east
      // Southbound (west half): left = east, straight = south, right = west.
      const nsLW = lanes(ns.kind).filter((v) => v < 0);
      arrowParts.push(flatArrow(cx + nsLW[nsLW.length - 1], cz - he - 5, -Math.PI / 2)); // left -> east
      if (nsLW.length > 2) arrowParts.push(flatArrow(cx + nsLW[1], cz - he - 5, Math.PI)); // straight -> south
      arrowParts.push(flatArrow(cx + nsLW[0], cz - he - 5, Math.PI / 2)); // right -> west
      // Yellow box junction in the intersection centre (avenues only).
      if (ave) {
        const bw = Math.min(2 * hn + 1, 4), bd = Math.min(2 * he + 1, 4);
        boxParts.push(colored(xform(new THREE.BoxGeometry(bw, 0.01, 0.12), cx, 0.22, cz - bd / 2), 0xffffff));
        boxParts.push(colored(xform(new THREE.BoxGeometry(bw, 0.01, 0.12), cx, 0.22, cz + bd / 2), 0xffffff));
        boxParts.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, bd), cx - bw / 2, 0.22, cz), 0xffffff));
        boxParts.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, bd), cx + bw / 2, 0.22, cz), 0xffffff));
      }
    });
  });
  const zebraMesh = mergedMesh(zebraParts, whiteMat);
  zebraMesh.name = 'cbd-zebras';
  g.add(zebraMesh);
  const stopMesh = mergedMesh(stopParts, whiteMat);
  stopMesh.name = 'cbd-stoplines';
  g.add(stopMesh);
  const arrowMesh = mergedMesh(arrowParts, whiteMat);
  arrowMesh.name = 'cbd-arrows';
  g.add(arrowMesh);
  if (boxParts.length) {
    const boxMesh = mergedMesh(boxParts, yellowMat);
    boxMesh.name = 'cbd-boxjunctions';
    g.add(boxMesh);
  }

  // ---------- speed bumps (mid-block on the secondary streets) ----------
  const bumpMat = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95 });
  const bumpParts = [];
  for (const s of CBD_NS) {
    if (s.kind !== 'street') continue;
    bumpParts.push(colored(xform(new THREE.BoxGeometry(1.4, 0.18, 0.6), s.x, 0.28, -28), 0xffffff));
  }
  for (const s of CBD_EW) {
    if (s.kind !== 'street') continue;
    // Mid-block (x -17, between the -22.4 and -11.2 streets) — never on
    // the N-S avenue crossing at x 0.
    bumpParts.push(colored(xform(new THREE.BoxGeometry(0.6, 0.18, 1.4), -17, 0.28, s.z), 0xffffff));
  }
  if (bumpParts.length) {
    const bumpMesh = mergedMesh(bumpParts, bumpMat);
    bumpMesh.name = 'cbd-speedbumps';
    g.add(bumpMesh);
  }

  // ---------- lamp posts (both sidewalks, every ~8 units) ----------
  const lampPoles = [];
  const lampGlobes = [];
  const lampAt = (x, z) => {
    lampPoles.push(xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), x, 1.2, z));
    lampGlobes.push(xform(new THREE.SphereGeometry(0.16, 10, 8), x, 2.5, z));
  };
  for (const s of CBD_NS) {
    const sw = sidewalkW(s);
    for (let z = s.z0 + 4; z <= s.z1 - 4; z += 8) {
      lampAt(s.x - s.w / 2 - sw / 2, z);
      lampAt(s.x + s.w / 2 + sw / 2, z + 4);
    }
  }
  for (const s of CBD_EW) {
    const sw = sidewalkW(s);
    for (let x = s.x0 + 4; x <= s.x1 - 4; x += 8) {
      lampAt(x, s.z - s.w / 2 - sw / 2);
      lampAt(x + 4, s.z + s.w / 2 + sw / 2);
    }
  }
  const lampGroup = new THREE.Group();
  lampGroup.name = 'cbdLamps';
  lampGroup.add(mergedMesh(lampPoles, M(0x2b2b2b)));
  lampGroup.add(mergedMesh(lampGlobes, M(0xffd9a0, { emissive: 0xffc46b, emissiveIntensity: 0.9 })));
  g.add(lampGroup);

  // ---------- traffic lights (every intersection, working cycles) ----------
  const tlParts = [];
  const heads = []; // {x, z, axis, ix, iz}
  CBD_NS.forEach((ns, ix) => {
    CBD_EW.forEach((ew, iz) => {
      const cx = ns.x, cz = ew.z;
      const hn = ns.w / 2 + sidewalkW(ns) + 0.3;
      const he = ew.w / 2 + sidewalkW(ew) + 0.3;
      for (const [dx, dz] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
        const px = cx + dx * hn, pz = cz + dz * he;
        tlParts.push(colored(xform(new THREE.CylinderGeometry(0.08, 0.08, 3.3, 8), px, 1.65, pz), 0xffffff));
        // Two heads per pole: one facing the NS flow, one the EW flow.
        tlParts.push(colored(xform(new THREE.BoxGeometry(0.3, 0.8, 0.3), px, 2.9, pz), 0xffffff));
        heads.push({ x: px, z: pz, axis: 'NS', ix, iz });
        heads.push({ x: px + (dx > 0 ? -0.18 : 0.18), z: pz, axis: 'EW', ix, iz });
      }
    });
  });
  const tlMesh = mergedMesh(tlParts, M(0x1a1a1a));
  tlMesh.name = 'cbd-trafficlights';
  g.add(tlMesh);
  // Lenses: one InstancedMesh per colour (3 draw calls for all lights).
  const lensGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lensY = { red: 3.15, amber: 2.9, green: 2.65 };
  const lensMeshes = {};
  for (const [color, y] of Object.entries(lensY)) {
    const im = new THREE.InstancedMesh(lensGeo, lensMat.clone(), heads.length);
    const m4 = new THREE.Matrix4();
    heads.forEach((h, i) => {
      m4.makeTranslation(h.x, y, h.z);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, new THREE.Color(0x1a1a1a));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.name = `cbd-lens-${color}`;
    lensMeshes[color] = im;
    g.add(im);
  }
  const LIT = { red: new THREE.Color(0xff3b30), amber: new THREE.Color(0xffcc00), green: new THREE.Color(0x34c759) };
  const DARK = { red: new THREE.Color(0x330a08), amber: new THREE.Color(0x332a00), green: new THREE.Color(0x0a2a12) };
  let lastSignalSecond = -1;
  const updateSignals = (t) => {
    const sec = Math.floor(t);
    if (sec === lastSignalSecond) return;
    lastSignalSecond = sec;
    heads.forEach((h, i) => {
      const phase = signalPhase(h.ix, h.iz, t);
      const lit = phase === h.axis ? 'green' : phase === h.axis + '_AMBER' ? 'amber' : 'red';
      for (const c of ['red', 'amber', 'green']) {
        lensMeshes[c].setColorAt(i, lit === c ? LIT[c] : DARK[c]);
      }
    });
    for (const c of ['red', 'amber', 'green']) {
      if (lensMeshes[c].instanceColor) lensMeshes[c].instanceColor.needsUpdate = true;
    }
  };
  updateSignals(0);
  const signalGroup = new THREE.Group();
  signalGroup.name = 'cbdSignals';
  signalGroup.userData.tick = (t) => updateSignals(t);
  tickers.push(signalGroup);

  // ---------- street-name signs (avenue crossings) + bus stops ----------
  const signSpots = [
    { text: 'CORSO AZZURRA', x: -4.4, z: 6.2, ry: Math.PI },
    { text: 'LUNGOMARE', x: 4.4, z: -6.2, ry: 0 },
    { text: 'VIA DEL SOLE', x: -15.6, z: 6.2, ry: Math.PI },
    { text: 'VIA DEL MARE', x: 15.6, z: -6.2, ry: 0 },
    { text: 'VIA DEL FARO', x: -38, z: 6.2, ry: Math.PI },
    { text: 'VIA DEL PORTO', x: 38, z: -6.2, ry: 0 },
  ];
  const signGeo = new THREE.PlaneGeometry(1.5, 0.38);
  for (const sp of signSpots) {
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTexture(sp.text) }));
    sign.position.set(sp.x, 2.35, sp.z);
    sign.rotation.y = sp.ry;
    g.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), M(0x3a3a3a));
    pole.position.set(sp.x, 1.2, sp.z);
    g.add(pole);
  }
  // Bus stops: shelter + bench on the boulevard (south sidewalk) and
  // the N-S avenue (east sidewalk). Posts + roof merge dark, bench wood.
  const busMetal = [];
  const busWood = [];
  const busStops = [
    { x: -20, z: 1.5, ry: 0 }, { x: 20, z: 1.5, ry: 0 },
    { x: 1.5, z: -28, ry: Math.PI / 2 }, { x: 1.5, z: 5, ry: Math.PI / 2 },
  ];
  for (const b of busStops) {
    const cos = Math.cos(b.ry), sin = Math.sin(b.ry);
    const put = (geo, dx, dy, dz) => {
      const px = b.x + dx * cos - dz * sin;
      const pz = b.z + dx * sin + dz * cos;
      return xform(geo, px, dy, pz, b.ry);
    };
    busMetal.push(colored(put(new THREE.BoxGeometry(0.08, 2.2, 0.08), -1.4, 1.1, 0), 0xffffff));
    busMetal.push(colored(put(new THREE.BoxGeometry(0.08, 2.2, 0.08), 1.4, 1.1, 0), 0xffffff));
    busMetal.push(colored(put(new THREE.BoxGeometry(3.2, 0.12, 1.0), 0, 2.25, 0), 0xffffff));
    busWood.push(colored(put(new THREE.BoxGeometry(2.6, 0.12, 0.5), 0, 0.55, 0), 0xffffff));
    busWood.push(colored(put(new THREE.BoxGeometry(0.12, 0.55, 0.5), -1.1, 0.28, 0), 0xffffff));
    busWood.push(colored(put(new THREE.BoxGeometry(0.12, 0.55, 0.5), 1.1, 0.28, 0), 0xffffff));
  }
  const busMetalMesh = mergedMesh(busMetal, M(0x2e4a5e));
  busMetalMesh.name = 'cbd-busstops-metal';
  g.add(busMetalMesh);
  const busWoodMesh = mergedMesh(busWood, M(0x8a6a4a));
  busWoodMesh.name = 'cbd-busstops-wood';
  g.add(busWoodMesh);

  // ---------- manholes, grates, hydrants (merged metal) ----------
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.7 });
  const metalParts = [];
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
  const hydParts = [];
  CBD_NS.forEach((s, i) => {
    if (s.kind !== 'street') return;
    metalParts.push(colored(xform(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12), s.x, 0.22, -28 + (i % 2) * 8), 0xffffff));
    // Hydrant on the east sidewalk (road edge + sidewalk centre).
    hydParts.push(colored(xform(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 8), s.x + 1.3, 0.55, -18), 0xffffff));
    hydParts.push(colored(xform(new THREE.SphereGeometry(0.22, 8, 6), s.x + 1.3, 0.95, -18), 0xffffff));
  });
  CBD_EW.forEach((s, i) => {
    if (s.kind !== 'street') return;
    for (let k = 0; k < 4; k++) {
      metalParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.02, 0.08), -20 + i * 10 + k * 0.2, 0.22, s.z + 0.55), 0xffffff));
    }
  });
  const metalMesh = mergedMesh(metalParts, metalMat);
  metalMesh.name = 'cbd-metal';
  g.add(metalMesh);
  const hydMesh = mergedMesh(hydParts, hydMat);
  hydMesh.name = 'cbd-hydrants';
  g.add(hydMesh);

  // ---------- sidewalk ramps (dropped curbs where zebras meet the sidewalk) ----------
  // One sloped wedge at each corner of every intersection, merged into
  // a single mesh: the zebra crossings are usable, not a 0.24 curb step.
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.95, flatShading: true });
  const rampParts = [];
  CBD_NS.forEach((ns) => {
    CBD_EW.forEach((ew) => {
      const cx = ns.x, cz = ew.z;
      const hn = ns.w / 2 + sidewalkW(ns);
      const he = ew.w / 2 + sidewalkW(ew);
      // North ramp slopes down toward the road (+z edge low), south
      // ramp the reverse; east/west ramps tilt about Z instead.
      const mk = (rx, rz, px, pz) => {
        const wgeo = new THREE.BoxGeometry(1.2, 0.05, 0.7);
        rampParts.push(colored(xform(wgeo, px, 0.22, pz, 0, 1, rx, rz), 0xffffff));
      };
      mk(0.08, 0, cx, cz - he);
      mk(-0.08, 0, cx, cz + he);
      mk(0, 0.08, cx - hn, cz);
      mk(0, -0.08, cx + hn, cz);
    });
  });
  const rampMesh = mergedMesh(rampParts, rampMat);
  rampMesh.name = 'cbd-ramps';
  g.add(rampMesh);

  // ---------- lane-direction signs (pole boards over the approach lanes) ----------
  // A white arrow on blue, drawn with canvas paths (no font glyphs, so
  // it renders everywhere). One board per arrow direction, merged; the
  // poles merge into a single dark mesh. Boards face the oncoming
  // driver: straight over the middle lane, right over the outer lane,
  // on both approaches of both avenues at the main crossing.
  function arrowSignTexture(dir) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1e5a8a'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f7ebd7';
    ctx.save(); ctx.translate(64, 64);
    if (dir === 'left') ctx.rotate(-Math.PI / 2);
    else if (dir === 'right') ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -56); ctx.lineTo(30, -12); ctx.lineTo(12, -12);
    ctx.lineTo(12, 48); ctx.lineTo(-12, 48); ctx.lineTo(-12, -12);
    ctx.lineTo(-30, -12); ctx.closePath(); ctx.fill();
    ctx.restore();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  // {x, z, ry (board facing), dir, y}: eastbound approach faces west
  // (ry -PI/2), westbound faces east, northbound faces south (ry 0),
  // southbound faces north (ry PI). Poles stand on the SIDEWALK at the
  // approach corner — never in a driving lane — with the straight
  // board below the right-turn board.
  const dirBoards = [
    { x: -8, z: 2.05, ry: -Math.PI / 2, dir: 'straight', y: 2.6 },
    { x: -8, z: 2.05, ry: -Math.PI / 2, dir: 'right', y: 3.7 },
    { x: 8, z: -2.05, ry: Math.PI / 2, dir: 'straight', y: 2.6 },
    { x: 8, z: -2.05, ry: Math.PI / 2, dir: 'right', y: 3.7 },
    { x: 2.05, z: 8, ry: 0, dir: 'straight', y: 2.6 },
    { x: 2.05, z: 8, ry: 0, dir: 'right', y: 3.7 },
    { x: -2.05, z: -8, ry: Math.PI, dir: 'straight', y: 2.6 },
    { x: -2.05, z: -8, ry: Math.PI, dir: 'right', y: 3.7 },
  ];
  const boardGeos = { straight: [], right: [] };
  const boardPoles = [];
  const boardPoleSpots = new Set();
  for (const b of dirBoards) {
    boardGeos[b.dir].push(xform(new THREE.PlaneGeometry(0.9, 0.9), b.x, b.y, b.z, b.ry));
    const key = `${b.x},${b.z}`;
    if (!boardPoleSpots.has(key)) {
      boardPoleSpots.add(key);
      boardPoles.push(colored(xform(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 6), b.x, 2.1, b.z), 0xffffff));
    }
  }
  for (const [dir, geos] of Object.entries(boardGeos)) {
    const m = mergedMesh(geos, new THREE.MeshBasicMaterial({ map: arrowSignTexture(dir) }));
    m.name = `cbd-dirsign-${dir}`;
    g.add(m);
  }
  const boardPoleMesh = mergedMesh(boardPoles, M(0x3a3a3a));
  boardPoleMesh.name = 'cbd-dirsign-poles';
  g.add(boardPoleMesh);

  // The grid's lamps are emissive globes (always on) — there are no
  // light cones to toggle, so setNight is a no-op kept so city.js can
  // call grid.setNight(on) next to roads.setNight(on).
  return { group: g, tickers, lampCones: [], setNight() {} };
}
