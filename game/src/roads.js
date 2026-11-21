// AZZURA HEIST — road system (M2, Xian's road spec).
// One source of truth: the road data drives the mesh, the traffic lanes,
// the navigation paths and the minimap lines. Procedural only, no external
// assets. Base asphalt is LIGHT warm grey #8a8580 (never dark) so lane
// markings, shadows, cars and characters stay readable; every district
// gets its own surface in the same light warm family. Markings are worn
// and patchy, never crisp. Roads, sidewalks and ground never z-fight:
// markings sit 0.02 above the asphalt, sidewalks step up 0.12.
// City-system rules apply: roads FIRST, trees ONLY in green zones, no
// building or tree ever on a road or blocking an intersection.
//
// M2 changes: asphalt base cooled toward neutral grey (the golden-hour
// sun warms everything, so the canvas base must lean cool for the road
// to READ as #8a8580); crosswalks narrower + less dominant; the road
// showcase now has traffic, pedestrians, varied facades and a non-flat
// horizon (hills + skyline).
import * as THREE from '../vendor/three.module.min.js';
import { M, mergedMesh, colored, xform, vertexColorMat, buildSkylineCluster } from './world.js';
import {
  createMarkings, segmentsAlong, zebraApproach, stopForApproach,
  arrowsForApproach, boxJunction, allCrossingGaps,
} from './markings.js';
import { buildTrafficCar, buildPoliceCruiser } from './vehicles.js';
import { makeFigure, CIVILIANS } from './people.js';
import {
  cbdGridRoadRects, cbdGridSidewalkRects, cbdGridMedianSegments,
  cbdGridLanes, cbdGridMinimap,
} from './cbd-grid.js';
// The boulevard median lives in the grid module now (cbd-grid.js).
export { cbdGridMedianSegments as boulevardMedianSegments };

export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- surfaces ----------
// Every surface is a 256x256 canvas texture, tiled along the road.
// asphalt: light warm grey, noise blotches +-6%, patched repairs, fine
// grain, worn lane tracks, oil stains, tire marks at intersections.
// cobble: paver grid with per-stone variation. boardwalk: wooden planks.
// gravel: speckled dirt with tire ruts. concrete: slabs + cracks, optional
// hazard stripes. plaza: large light pavers.
export const SURFACES = {
  // Bases are deliberately LIGHT and slightly COOL/BLUE: ACES tone
  // mapping + the warm golden-hour sun darken and warm the albedo by
  // roughly a third, so the canvas base must sit well above #8a8580 and
  // lean blue for the road to READ as light warm grey, not tan.
  asphalt: { base: '#9aa0a4', kind: 'asphalt' },
  cobble: { base: '#a8a9a8', kind: 'cobble' },
  boardwalk: { base: '#a9805a', kind: 'boardwalk' },
  gravel: { base: '#b5a888', kind: 'gravel' },
  concrete: { base: '#b8b8b2', kind: 'concrete' },
  plaza: { base: '#d8d2c4', kind: 'plaza' },
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

// Same shade with an alpha channel — used for gradient stops so the fade
// goes to transparent SHADE, never to transparent BLACK (a fade to
// rgba(0,0,0,0) darkens the mid-tones by up to 25% and paints the round
// dark blotches the road showed).
function shadeA(hex, f, a) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgba(${r},${g},${b},${a})`;
}

const texCache = {};
export function roadTexture(surface, seed = 7) {
  const key = surface + ':' + seed;
  if (texCache[key]) return texCache[key];
  const def = SURFACES[surface] || SURFACES.asphalt;
  const rnd = seededRandom(seed * 7919 + surface.length * 131);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = def.base;
  ctx.fillRect(0, 0, 256, 256);
  // Draw a feature wrapped across all 9 tile offsets so it continues
  // over the tile edge — nothing is ever cut at the edge, so the road
  // reads as one continuous surface, never as separate blocks.
  const wrap = (fn) => {
    for (const ox of [-256, 0, 256]) {
      for (const oy of [-256, 0, 256]) {
        ctx.save();
        ctx.translate(ox, oy);
        fn();
        ctx.restore();
      }
    }
  };
  if (def.kind === 'asphalt' || def.kind === 'concrete') {
    // Low-frequency noise blotches (+-6% lightness).
    for (let i = 0; i < 46; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 12 + rnd() * 42;
      const f = 0.94 + rnd() * 0.12;
      wrap(() => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, shade(def.base, f));
        g.addColorStop(1, shadeA(def.base, f, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
    }
    // Patched repairs: slightly darker/lighter rectangles.
    for (let i = 0; i < 8; i++) {
      const px = rnd() * 200, py = rnd() * 200, pw = 24 + rnd() * 40, ph = 16 + rnd() * 28;
      const col = shade(def.base, 0.9 + rnd() * 0.2);
      wrap(() => {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(px, py, pw, ph);
        ctx.globalAlpha = 1;
      });
    }
    // Fine grain (1.4px dots — invisible if cut, so no wrap needed).
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(rnd() * 256, rnd() * 256, 1.4, 1.4);
    }
    // Worn tracks along the lanes (two darker bands, full-width).
    ctx.fillStyle = 'rgba(40,36,32,0.10)';
    ctx.fillRect(0, 66, 256, 14);
    ctx.fillRect(0, 176, 256, 14);
    // Oil stains.
    for (let i = 0; i < 5; i++) {
      const ox = rnd() * 256, oy = rnd() * 256, rx = 8 + rnd() * 14, ry = 5 + rnd() * 8;
      wrap(() => {
        ctx.fillStyle = 'rgba(20,18,16,0.16)';
        ctx.beginPath();
        ctx.ellipse(ox, oy, rx, ry, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (def.kind === 'concrete') {
      // Slab joints + cracks (joints sit on the 64px grid, so they tile).
      ctx.strokeStyle = 'rgba(60,58,54,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(50,48,44,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const sx = rnd() * 256, sy = rnd() * 256;
        wrap(() => {
          let x = sx, y = sy;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 30; y += rnd() * 18; ctx.lineTo(x, y); }
          ctx.stroke();
        });
      }
    }
  } else if (def.kind === 'cobble') {
    // Paver grid: rounded stones, per-stone variation, dark joints.
    // Each stone is drawn wrapped so the offset rows never cut at the edge.
    const s = 32;
    for (let ry = 0; ry < 8; ry++) {
      for (let cx = 0; cx < 8; cx++) {
        const col = shade(def.base, 0.9 + rnd() * 0.22);
        const off = (ry % 2) * s / 2;
        const sx = cx * s + off - s / 2 + 2, sy = ry * s + 2;
        wrap(() => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.roundRect(sx, sy, s - 4, s - 4, 6);
          ctx.fill();
        });
      }
    }
  } else if (def.kind === 'boardwalk') {
    // Wooden planks with grain lines and hairline gaps (6 rows).
    for (let ry = 0; ry < 6; ry++) {
      const y0 = ry * 256 / 6;
      ctx.fillStyle = shade(def.base, 0.9 + rnd() * 0.2);
      ctx.fillRect(0, y0 + 1, 256, 256 / 6 - 1);
      ctx.strokeStyle = 'rgba(90,60,35,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y = y0 + 8 + rnd() * 26;
        wrap(() => {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(80, y + 2, 170, y - 2, 256, y);
          ctx.stroke();
        });
      }
      ctx.fillStyle = 'rgba(60,40,25,0.4)';
      ctx.fillRect(0, y0, 256, 1);
    }
  } else if (def.kind === 'gravel') {
    for (let i = 0; i < 3200; i++) {
      const gx = rnd() * 256, gy = rnd() * 256;
      const col = shade(def.base, 0.8 + rnd() * 0.45);
      wrap(() => { ctx.fillStyle = col; ctx.fillRect(gx, gy, 2.2, 2.2); });
    }
    // Tire ruts: two darker parallel bands (full-width — seamless).
    ctx.fillStyle = 'rgba(70,60,45,0.18)';
    ctx.fillRect(0, 62, 256, 18);
    ctx.fillRect(0, 176, 256, 18);
  } else { // plaza: large light pavers (64px grid tiles exactly)
    const s = 64;
    for (let ry = 0; ry < 4; ry++) {
      for (let cx = 0; cx < 4; cx++) {
        ctx.fillStyle = shade(def.base, 0.94 + rnd() * 0.12);
        ctx.fillRect(cx * s + 2, ry * s + 2, s - 4, s - 4);
      }
    }
    ctx.strokeStyle = 'rgba(120,112,96,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(256, i * s); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache[key] = tex;
  return tex;
}

// Hazard stripe texture (yellow/black diagonal) for quarry edges.
const hazardCache = {};
export function hazardTexture() {
  if (hazardCache.t) return hazardCache.t;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8c33d'; ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#1a1a1a';
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 32); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 16, 32);
    ctx.closePath(); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  hazardCache.t = tex;
  return tex;
}

// Street-name sign texture (fictional names only).
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

// Shop-front sign texture (fictional brands only).
function shopTexture(text, bg = '#1e2a32', fg = '#ffd9a0') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg; ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A row of lamp posts along the north sidewalk (z -7.2), merged into
// two meshes, with light cones that switch on at night (setNight).
// Returns { group, cones }.
function lampRow() {
  const xs = [-54, -44, -34, -24, -14, -4, 6, 16, 26, 36, 46, 54];
  const z = -7.2;
  const g = new THREE.Group();
  g.name = 'lampRow';
  const poles = xs.map((x) => xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), x, 1.2, z));
  const globes = xs.map((x) => xform(new THREE.SphereGeometry(0.16, 10, 8), x, 2.5, z));
  g.add(mergedMesh(poles, M(0x2b2b2b)));
  g.add(mergedMesh(globes, M(0xffd9a0, { emissive: 0xffc46b, emissiveIntensity: 0.9 })));
  const cones = [];
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.12,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  for (const x of xs) {
    // ConeGeometry: apex at the top (+Y), base at the bottom — a lamp
    // cone is already the right way up with no rotation.
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 12, 1, true), coneMat);
    cone.position.set(x, 1.25, z);
    cone.visible = false;
    g.add(cone);
    cones.push(cone);
  }
  return { group: g, cones };
}

// ---------- District 4 (Lungomare) road network ----------
// GRID REBUILD (Xian 21 Nov 15:22): the CBD streets now live in
// cbd-grid.js — the single source of truth for the CBD grid (avenues +
// streets, blocks, medians, markings, lamps, signals). This module keeps
// the roads OUTSIDE the CBD: the ring avenue (split west/east of the
// CBD — inside the CBD x-range the z -44.8 grid street takes its place),
// the ring side streets, the x +/-40 connectors, and the quay.
// The boulevard (z 0, 3.5 wide) and the N-S avenue (x 0) are grid
// roads now; the grid module builds their slabs, sidewalks and markings
// for the full x -60..60 / z -45.9..12.3 extent.
export const BOULEVARD = { x0: -60, x1: 60, z0: -1.75, z1: 1.75 };
export const CROSS_X = [-40, 40];
export const CROSS = { z0: -42, z1: 6, half: 3.5 };
// Ring avenue (z -42, 7 wide): split into west/east segments outside
// the CBD (x -34.7..34.7 is the grid's z -44.8 street now).
export const RING_AVENUE_W = { x0: -60, x1: -34.7, z0: -45.5, z1: -38.5 };
export const RING_AVENUE_E = { x0: 34.7, x1: 60, z0: -45.5, z1: -38.5 };
export const RING_AVENUE = { x0: -60, x1: 60, z0: -45.5, z1: -38.5 };
export const RING_STREETS = [
  // GRID REBUILD: the four streets inside the CBD x-range end at the
  // CBD's north edge (z -45.9) — the old z -30 ends cut straight
  // through the CBD's north tower rows (the overlap test caught 7
  // tower-vs-road overlaps). They still split the north-strip north
  // row (z -53..-47.5). The x 41 street (east of the CBD) keeps its
  // full length; x -44 keeps its (west of the CBD).
  // ITEM 2 (D): smaller blocks for the 247+ target — the north band
  // is split by x -24/-4/16/36 (all ~8-10 apart, no slivers) into
  // 13 columns; the east band gets a third column (x 53, 62) and the
  // west band a third column (x -63, -54). The north band's N-S
  // streets run z -68..-45.5 (to the ring avenue); x -47/-34 end at
  // z -54 (the old town's north edge — they do not cut into it).
  { x: -24, z0: -68, z1: -45.5 }, { x: -14, z0: -68, z1: -45.5 },
  { x: -4, z0: -68, z1: -45.5 }, { x: 6, z0: -68, z1: -45.5 },
  { x: 16, z0: -68, z1: -45.5 }, { x: 26, z0: -68, z1: -45.5 },
  { x: 36, z0: -68, z1: -45.5 }, { x: 46, z0: -68, z1: -45.5 },
  { x: -47, z0: -68, z1: -54 }, { x: -34, z0: -68, z1: -54 },
  { x: 41, z0: -54, z1: -30 }, { x: 44, z0: -30, z1: 14 },
  { x: -44, z0: -30, z1: 22 },
  { x: 53, z0: -31, z1: 14 }, { x: 62, z0: -31, z1: 14 },
  { x: -63, z0: -26, z1: 12 }, { x: -54, z0: -26, z1: 12 },
];
export const RING_STREET_HALF = 1;
// Ring boundary streets (Xian 21 Nov 15:22 — every ring block must be
// bounded by streets on all four sides, 6–8 buildings per block).
// E-W boundary streets { z, x0, x1 } (2 wide): the north boundary
// (the north row's north side), the east stub (between the south-row
// block and the east block), the east-block split (the 12-building
// block becomes two ~8-building blocks).
// ITEM 2 (D): deep rows so the perimeter fill fits two rows of
// buildings without the north/south pairs overlapping (the old
// 5.5-deep blocks stacked both rows on top of each other). The north
// band is two deep rows (z -67..-58 + z -56..-47.5, the second only
// east of the old town at x -34); the east band is 4 deep rows
// (z -31..13); the west band is 4 deep rows (z -26..12.7, bounded
// south by the quay). z -57 splits the north rows (east of the old
// town); z -54.2 bounds the old town's north side.
export const RING_STREETS_EW = [
  // EAST/WEST BRIDGES (GAME fix, Xian 21 Nov 23:04): the east/west
  // outer-column streets (x +/-84, RING_EXT_DEF) were islands — the
  // ring E-W streets ended at x +/-72 and the residential E-W streets
  // start at x +/-96, so the columns crossed nothing. These streets
  // now run to x +/-97, touching the residential x +/-97 lines: the
  // ring, the outer columns and the residential ring join. The slabs
  // run on the outer columns' own E-W lines (their blocks already
  // leave the gap), so no building stands on them.
  { z: -68, x0: -72, x1: 72 },
  { z: -57, x0: -34, x1: 72 },
  { z: -54.2, x0: -72, x1: -34 },
  { z: -30.9, x0: 34.7, x1: 72 },
  { z: -20, x0: 43.5, x1: 97 },
  { z: -10, x0: 43.5, x1: 97 },
  { z: 0, x0: 43.5, x1: 97 },
  { z: -26, x0: -97, x1: -45 },
  { z: -16, x0: -97, x1: -45 },
  { z: -6, x0: -97, x1: -45 },
  { z: 4, x0: -97, x1: -45 },
];
// N-S boundary streets { x, z0, z1 } (2 wide): the west boundary
// (the west strip's west side) and the east boundary (the east
// strip's east side). ITEM 2 (D): outer boundaries move to x +/-72.5
// and run the full north band (z -68).
export const RING_BOUNDARY_NS = [
  { x: -72.5, z0: -68, z1: 22 },
  { x: -60.5, z0: -68, z1: 22 },
  { x: 60.5, z0: -68, z1: 14 },
  { x: 72.5, z0: -68, z1: 14 },
];
// The quay (the waterfront walkway, z 12.7..14.5): south of the CBD's
// south street (z 11.2, sidewalks to 12.7), north of the promenade
// (z 14..35). The old strip (z 8.5..13) sat under the new south street.
export const QUAY = { x0: -60, x1: 60, z0: 12.7, z1: 14.5 };
export const WATER_Z = 14.5;

function rect(x0, z0, x1, z1) { return { x0, z0, x1, z1 }; }
export function roadRects() {
  // The CBD grid roads come from cbd-grid.js (the single source of
  // truth); this module adds the ring roads around them.
  const r = cbdGridRoadRects();
  r.push(
    rect(RING_AVENUE_W.x0, RING_AVENUE_W.z0, RING_AVENUE_W.x1, RING_AVENUE_W.z1),
    rect(RING_AVENUE_E.x0, RING_AVENUE_E.z0, RING_AVENUE_E.x1, RING_AVENUE_E.z1),
  );
  for (const cx of CROSS_X) r.push(rect(cx - CROSS.half, CROSS.z0, cx + CROSS.half, CROSS.z1));
  for (const s of RING_STREETS) r.push(rect(s.x - RING_STREET_HALF, s.z0, s.x + RING_STREET_HALF, s.z1));
  for (const s of RING_STREETS_EW) r.push(rect(s.x0, s.z - RING_STREET_HALF, s.x1, s.z + RING_STREET_HALF));
  for (const s of RING_BOUNDARY_NS) r.push(rect(s.x - RING_STREET_HALF, s.z0, s.x + RING_STREET_HALF, s.z1));
  r.push(rect(QUAY.x0, QUAY.z0, QUAY.x1, QUAY.z1));
  return r;
}
function sidewalkRects() {
  const r = cbdGridSidewalkRects();
  r.push(
    rect(QUAY.x0, 14.5, QUAY.x1, 15.7),
    rect(RING_AVENUE_W.x0, -47.5, RING_AVENUE_W.x1, -45.5),
    rect(RING_AVENUE_W.x0, -38.5, RING_AVENUE_W.x1, -36.5),
    rect(RING_AVENUE_E.x0, -47.5, RING_AVENUE_E.x1, -45.5),
    rect(RING_AVENUE_E.x0, -38.5, RING_AVENUE_E.x1, -36.5),
  );
  for (const cx of CROSS_X) {
    r.push(rect(cx - CROSS.half - 2, CROSS.z0, cx - CROSS.half, CROSS.z1));
    r.push(rect(cx + CROSS.half, CROSS.z0, cx + CROSS.half + 2, CROSS.z1));
  }
  for (const s of RING_STREETS) {
    r.push(rect(s.x - RING_STREET_HALF - 0.7, s.z0, s.x - RING_STREET_HALF, s.z1));
    r.push(rect(s.x + RING_STREET_HALF, s.z0, s.x + RING_STREET_HALF + 0.7, s.z1));
  }
  for (const s of RING_STREETS_EW) {
    r.push(rect(s.x0, s.z - RING_STREET_HALF - 0.7, s.x1, s.z - RING_STREET_HALF));
    r.push(rect(s.x0, s.z + RING_STREET_HALF, s.x1, s.z + RING_STREET_HALF + 0.7));
  }
  for (const s of RING_BOUNDARY_NS) {
    r.push(rect(s.x - RING_STREET_HALF - 0.7, s.z0, s.x - RING_STREET_HALF, s.z1));
    r.push(rect(s.x + RING_STREET_HALF, s.z0, s.x + RING_STREET_HALF + 0.7, s.z1));
  }
  return r;
}
function overlaps(a, b, margin = 0) {
  return a.x0 < b.x1 + margin && a.x1 > b.x0 - margin && a.z0 < b.z1 + margin && a.z1 > b.z0 - margin;
}
// Placement validator (city-system.md §6): a plot is rejected when it
// touches a road rect, a sidewalk rect, or another plot. Returns the
// violations; an empty list means the plot is legal.
export function validatePlots(plots) {
  const roads = roadRects();
  const walks = sidewalkRects();
  const violations = [];
  plots.forEach((p, i) => {
    for (const r of roads) {
      if (overlaps(p, r, 0.5)) violations.push(`${p.id}: overlaps road (${r.x0},${r.z0})-(${r.x1},${r.z1})`);
    }
    for (const r of walks) {
      if (overlaps(p, r, 0.2)) violations.push(`${p.id}: overlaps sidewalk`);
    }
    for (let j = 0; j < i; j++) {
      if (overlaps(p, plots[j], 0.3)) violations.push(`${p.id}: overlaps plot ${plots[j].id}`);
    }
  });
  return violations;
}

// Rounded-rectangle loop path (waypoints every ~2 units) for traffic.
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
export function trafficLanes() {
  return [
    // Boulevard loop (the main east-west avenue, lanes at z +/-0.7).
    { name: 'boulevard', pts: loopPath(-56, -0.7, 56, 0.7, 4), speed: 9 },
    // West block: boulevard lanes + the x=-40 ring connector and the
    // x=-22.4 grid street (the old x=-21 leg cut through the CBD).
    { name: 'west-block', pts: loopPath(-39, -41, -22.4, 0.7, 1.2), speed: 7 },
    // East block: boulevard lanes + the x=22.4 grid street and the
    // x=40 ring connector.
    { name: 'east-block', pts: loopPath(22.4, -40, 39, 0.7, 1.2), speed: 7 },
    // Ring avenue, split west/east of the CBD (the grid's z -44.8
    // street takes its place inside the CBD x-range).
    { name: 'ring-avenue-west', pts: loopPath(-56, -44.5, -36, -39.5, 2), speed: 7 },
    { name: 'ring-avenue-east', pts: loopPath(36, -44.5, 56, -39.5, 2), speed: 7 },
    // The CBD grid loops (cbd-grid.js) — traffic actually uses the new
    // grid now, not just the boulevard.
    ...cbdGridLanes(),
  ];
}
export function minimapLines() {
  const lines = [{ x1: BOULEVARD.x0, z1: 0, x2: BOULEVARD.x1, z2: 0, w: 3.5 }];
  for (const cx of CROSS_X) lines.push({ x1: cx, z1: CROSS.z0, x2: cx, z2: CROSS.z1, w: 7 });
  lines.push(...cbdGridMinimap());
  lines.push({ x1: RING_AVENUE_W.x0, z1: -42, x2: RING_AVENUE_W.x1, z2: -42, w: 7 });
  lines.push({ x1: RING_AVENUE_E.x0, z1: -42, x2: RING_AVENUE_E.x1, z2: -42, w: 7 });
  for (const s of RING_STREETS) lines.push({ x1: s.x, z1: s.z0, x2: s.x, z2: s.z1, w: 2 });
  for (const s of RING_STREETS_EW) lines.push({ x1: s.x0, z1: s.z, x2: s.x1, z2: s.z, w: 2 });
  for (const s of RING_BOUNDARY_NS) lines.push({ x1: s.x, z1: s.z0, x2: s.x, z2: s.z1, w: 2 });
  lines.push({ x1: QUAY.x0, z1: 13.6, x2: QUAY.x1, z2: 13.6, w: 1.8 });
  return lines;
}

// --- junction-split minimap centerlines (GAME fix, Xian 21 Nov 23:04) ---
// The road graph (minimap display, BFS routing, traffic AI, police)
// is built from these centerlines by clustering segment ENDPOINTS.
// A street that ends in the MIDDLE of another street (a T junction)
// or crosses it (an X junction) never shares an endpoint, so the
// graph shatters: 154 segments became 67 components at baseline and
// no BFS route could leave the harbor. This splits every segment at
// every point where another segment crosses or touches it, so
// junctions become shared endpoints and the published minimap is a
// proper planar graph. The raw street lists stay the single source of
// truth for geometry; only the published list is split. Exact
// duplicates (the boulevard line is also the Lungomare line) merge
// into one segment, keeping the wider width.
export function splitSegmentsAtJunctions(segments) {
  const TOL = 1e-6;
  const round4 = (v) => Math.round(v * 10000) / 10000;
  // Split parameters t in [0,1] per segment, from pairwise intersections.
  const splits = segments.map(() => [0, 1]);
  // Distance from (px,pz) to segment s; returns t if on it, else -1.
  const pointOn = (px, pz, s) => {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
    const len2 = dx * dx + dz * dz;
    if (len2 === 0) return Math.hypot(px - s.x1, pz - s.z1) <= TOL ? 0 : -1;
    const t = ((px - s.x1) * dx + (pz - s.z1) * dz) / len2;
    if (t < -1e-9 || t > 1 + 1e-9) return -1;
    const cx = s.x1 + t * dx, cz = s.z1 + t * dz;
    return Math.hypot(px - cx, pz - cz) <= TOL ? Math.max(0, Math.min(1, t)) : -1;
  };
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i], b = segments[j];
      const dax = a.x2 - a.x1, daz = a.z2 - a.z1;
      const dbx = b.x2 - b.x1, dbz = b.z2 - b.z1;
      const den = dax * dbz - daz * dbx;
      if (Math.abs(den) > 1e-12) {
        // Proper crossing (X): solve a + t*da = b + u*db.
        const t = ((b.x1 - a.x1) * dbz - (b.z1 - a.z1) * dbx) / den;
        const u = ((b.x1 - a.x1) * daz - (b.z1 - a.z1) * dax) / den;
        if (t > 0 && t < 1 && u > 0 && u < 1) { splits[i].push(t); splits[j].push(u); }
      }
      // Endpoint-on-segment touches (T junctions, shared endpoints,
      // collinear overlaps): an endpoint of one segment lying on the
      // other splits the other at that point.
      for (const [s, si, o] of [[a, i, b], [b, j, a]]) {
        for (const [px, pz] of [[o.x1, o.z1], [o.x2, o.z2]]) {
          const t = pointOn(px, pz, s);
          if (t > 0 && t < 1) splits[si].push(t);
        }
      }
    }
  }
  const out = [];
  segments.forEach((s, i) => {
    const ts = [...new Set(splits[i].map((t) => Math.round(t * 1e9) / 1e9))].sort((p, q) => p - q);
    for (let k = 0; k + 1 < ts.length; k++) {
      const t0 = ts[k], t1 = ts[k + 1];
      if (t1 - t0 < 1e-9) continue;
      const x1 = round4(s.x1 + (s.x2 - s.x1) * t0), z1 = round4(s.z1 + (s.z2 - s.z1) * t0);
      const x2 = round4(s.x1 + (s.x2 - s.x1) * t1), z2 = round4(s.z1 + (s.z2 - s.z1) * t1);
      if (Math.hypot(x2 - x1, z2 - z1) < 1e-6) continue;
      out.push({ x1, z1, x2, z2, w: s.w });
    }
  });
  // Merge exact duplicates (same endpoints either way), keeping the
  // wider width.
  const seen = new Map();
  for (const s of out) {
    const key = [[s.x1, s.z1], [s.x2, s.z2]].map((p) => p.join(',')).sort().join('|');
    const prev = seen.get(key);
    if (!prev || s.w > prev.w) seen.set(key, s);
  }
  return [...seen.values()];
}

// ---------- build the network mesh ----------
// Returns { group, roadMat, wetness, puddles, lampCones, setWet, setNight }.
export function buildRoadNetwork() {
  const g = new THREE.Group();
  g.name = 'roadNetwork';
  const tex = roadTexture('asphalt', 11);
  tex.repeat.set(16, 2);
  const roadMat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.92, metalness: 0.0, flatShading: true,
  });
  // GRID REBUILD (Xian 21 Nov 15:22): the boulevard + CBD streets are
  // built by cbd-grid.js (the single source of truth) — this module
  // builds ONLY the roads outside the CBD: the x +/-40 connectors, the
  // ring avenue (split west/east of the CBD) and the ring side streets.
  const parts = [];
  // Cross streets (7 wide, 42 long) — one box per street, not 9 tiles.
  for (const cx of CROSS_X) parts.push(colored(xform(new THREE.BoxGeometry(7, 0.3, 48), cx, 0.05, -18), 0xffffff));
  // Ring avenue (7 wide, z -42) — split west/east of the CBD.
  parts.push(colored(xform(new THREE.BoxGeometry(RING_AVENUE_W.x1 - RING_AVENUE_W.x0, 0.3, 7), (RING_AVENUE_W.x0 + RING_AVENUE_W.x1) / 2, 0.05, -42), 0xffffff));
  parts.push(colored(xform(new THREE.BoxGeometry(RING_AVENUE_E.x1 - RING_AVENUE_E.x0, 0.3, 7), (RING_AVENUE_E.x0 + RING_AVENUE_E.x1) / 2, 0.05, -42), 0xffffff));
  for (const s of RING_STREETS) {
    const len = s.z1 - s.z0;
    parts.push(colored(xform(new THREE.BoxGeometry(2, 0.3, len), s.x, 0.05, (s.z0 + s.z1) / 2), 0xffffff));
  }
  // Ring boundary streets (Xian 21 Nov 15:22): E-W slabs + N-S slabs.
  for (const s of RING_STREETS_EW) {
    const len = s.x1 - s.x0;
    parts.push(colored(xform(new THREE.BoxGeometry(len, 0.3, 2), (s.x0 + s.x1) / 2, 0.05, s.z), 0xffffff));
  }
  for (const s of RING_BOUNDARY_NS) {
    const len = s.z1 - s.z0;
    parts.push(colored(xform(new THREE.BoxGeometry(2, 0.3, len), s.x, 0.05, (s.z0 + s.z1) / 2), 0xffffff));
  }
  // Sidewalks (light warm grey, one step lighter than the road) with a
  // physical height step (y 0.12) and visible curbs.
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.95, flatShading: true });
  const swParts = [];
  for (const cx of CROSS_X) {
    swParts.push(colored(xform(new THREE.BoxGeometry(2, 0.24, 48), cx - CROSS.half - 1, 0.12, -18), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(2, 0.24, 48), cx + CROSS.half + 1, 0.12, -18), 0xffffff));
  }
  // Ring avenue sidewalks + ring street sidewalks.
  swParts.push(colored(xform(new THREE.BoxGeometry(RING_AVENUE_W.x1 - RING_AVENUE_W.x0, 0.24, 2), (RING_AVENUE_W.x0 + RING_AVENUE_W.x1) / 2, 0.12, -46.5), 0xffffff));
  swParts.push(colored(xform(new THREE.BoxGeometry(RING_AVENUE_W.x1 - RING_AVENUE_W.x0, 0.24, 2), (RING_AVENUE_W.x0 + RING_AVENUE_W.x1) / 2, 0.12, -37.5), 0xffffff));
  swParts.push(colored(xform(new THREE.BoxGeometry(RING_AVENUE_E.x1 - RING_AVENUE_E.x0, 0.24, 2), (RING_AVENUE_E.x0 + RING_AVENUE_E.x1) / 2, 0.12, -46.5), 0xffffff));
  swParts.push(colored(xform(new THREE.BoxGeometry(RING_AVENUE_E.x1 - RING_AVENUE_E.x0, 0.24, 2), (RING_AVENUE_E.x0 + RING_AVENUE_E.x1) / 2, 0.12, -37.5), 0xffffff));
  for (const s of RING_STREETS) {
    const len = s.z1 - s.z0;
    const zc = (s.z0 + s.z1) / 2;
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, len), s.x - RING_STREET_HALF - 0.35, 0.12, zc), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, len), s.x + RING_STREET_HALF + 0.35, 0.12, zc), 0xffffff));
  }
  // Ring boundary street sidewalks.
  for (const s of RING_STREETS_EW) {
    const len = s.x1 - s.x0;
    const xc = (s.x0 + s.x1) / 2;
    swParts.push(colored(xform(new THREE.BoxGeometry(len, 0.24, 0.7), xc, 0.12, s.z - RING_STREET_HALF - 0.35), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(len, 0.24, 0.7), xc, 0.12, s.z + RING_STREET_HALF + 0.35), 0xffffff));
  }
  for (const s of RING_BOUNDARY_NS) {
    const len = s.z1 - s.z0;
    const zc = (s.z0 + s.z1) / 2;
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, len), s.x - RING_STREET_HALF - 0.35, 0.12, zc), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, len), s.x + RING_STREET_HALF + 0.35, 0.12, zc), 0xffffff));
  }
  const sw = mergedMesh(swParts, sidewalkMat);
  sw.name = 'sidewalks';
  g.add(sw);
  // Quay (z 12.7..14.5) — the waterfront walkway south of the CBD's
  // south street, north of the promenade (z 14..35).
  const quayTex = roadTexture('plaza', 5);
  quayTex.repeat.set(14, 1);
  const quayMat = new THREE.MeshStandardMaterial({ map: quayTex, roughness: 0.95, flatShading: true });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(120, 0.3, 1.8), quayMat);
  quay.position.set(0, 0.06, 13.6);
  quay.name = 'quay';
  g.add(quay);
  const road = mergedMesh(parts, roadMat);
  road.name = 'roads';
  g.add(road);
  // ---------- boulevard median ----------
  // Built by cbd-grid.js now (median + planters along the boulevard,
  // with gaps at every intersection). Nothing to add here.
  // ---------- markings (registry) ----------
  // The CBD grid owns the boulevard (z 0) markings, including its
  // crossings with the ring connectors (x +/-40) — this module draws
  // NO boulevard zebras/stops/arrows. It owns the ring roads, the
  // connectors and the ring avenue x connector intersections.
  const m = createMarkings();
  const WIDE_LANE = { len: 2.8, c: 1.6 }; // 7-wide roads, 1 lane per direction
  const wideArrowRy = { W: -Math.PI / 2, E: Math.PI / 2, S: Math.PI, N: 0 };
  // Centre dash (0.12 x 1.0, every 2.5) + edges for one road, cut at
  // the crossings. `road` is {axis:'x'|'z', at, from, to, kind} and
  // `crossings` is [{c, h}] along the road. Centre dashes sit on the
  // centreline, so stops (which span the lanes) never touch them.
  const centreDashRoad = (road, crossings) => {
    const segs = segmentsAlong(road.from, road.to, allCrossingGaps(crossings));
    for (const [a, b] of segs) {
      if (road.axis === 'z') {
        for (let p = a + 0.5; p <= b - 0.5; p += 2.5) m.box('dash', road.at, p, 0.12, 1);
        for (const side of [-1, 1]) m.box('edge', road.at + side * 0.85, (a + b) / 2, 0.12, b - a);
      } else {
        for (let p = a + 0.5; p <= b - 0.5; p += 2.5) m.box('dash', p, road.at, 1, 0.12);
        for (const side of [-1, 1]) m.box('edge', (a + b) / 2, road.at + side * 0.85, b - a, 0.12);
      }
    }
  };
  // --- connectors (N-S, x +/-40, 7 wide, z -42..6) ---
  // Crossings: the ring avenue (z -42, half 3.5) + the boulevard (z 0,
  // half 2.4 — the grid's intersection; the dashes/edges are gapped
  // there even though the grid draws the crossing furniture).
  for (const cx of CROSS_X) {
    const crossings = [{ c: -42, h: 3.5 }, { c: 0, h: 2.4 }];
    const segs = segmentsAlong(CROSS.z0, CROSS.z1, allCrossingGaps(crossings));
    for (const [a, b] of segs) {
      for (let z = a + 0.5; z <= b - 0.5; z += 2.5) m.box('dash', cx, z, 0.12, 1);
      for (const side of [-1, 1]) m.box('edge', cx + side * 3.2, (a + b) / 2, 0.12, b - a);
    }
  }
  // --- ring avenue (E-W, z -42, 7 wide) ---
  // Crossings: the connectors (x +/-40, half 3.5). The middle (x
  // -34.7..34.7) is the grid's VIA DEL NORD — no ring markings there.
  for (const seg of [RING_AVENUE_W, RING_AVENUE_E]) {
    const crossings = CROSS_X.map((cx) => ({ c: cx, h: 3.5 })).filter(({ c }) => c >= seg.x0 && c <= seg.x1);
    const segs = segmentsAlong(seg.x0, seg.x1, allCrossingGaps(crossings));
    for (const [a, b] of segs) {
      for (let x = a + 0.5; x <= b - 0.5; x += 2.5) m.box('dash', x, -42, 1, 0.12);
      for (const side of [-1, 1]) m.box('edge', (a + b) / 2, -42 + side * 3.2, b - a, 0.12);
    }
  }
  // --- ring streets (N-S + E-W + boundary, 2 wide) ---
  // Crossings: every perpendicular street whose range overlaps, plus
  // the ring avenue (z -42), the boulevard (z 0) and the quay (z 12.7,
  // a walkway — the streets end there, no crossing furniture).
  const ewCrossForNS = (s) => {
    const out = [];
    for (const e of RING_STREETS_EW) if (s.x >= e.x0 && s.x <= e.x1) out.push({ c: e.z, h: 1 });
    if (s.z0 <= -42 && s.z1 >= -42) out.push({ c: -42, h: 3.5 });
    if (s.z0 <= 0 && s.z1 >= 0) out.push({ c: 0, h: 2.4 });
    if (s.z1 >= 12.7) out.push({ c: 12.7, h: 0.9 });
    return out.sort((p, q) => p.c - q.c);
  };
  const nsCrossForEW = (s) => {
    const out = [];
    for (const n of [...RING_STREETS, ...RING_BOUNDARY_NS]) if (n.x >= s.x0 && n.x <= s.x1) out.push({ c: n.x, h: 1 });
    for (const cx of CROSS_X) if (cx >= s.x0 && cx <= s.x1) out.push({ c: cx, h: 3.5 });
    return out.sort((p, q) => p.c - q.c);
  };
  for (const s of [...RING_STREETS, ...RING_BOUNDARY_NS]) {
    centreDashRoad({ axis: 'z', at: s.x, from: s.z0, to: s.z1, kind: 'street' }, ewCrossForNS(s));
  }
  for (const s of RING_STREETS_EW) {
    centreDashRoad({ axis: 'x', at: s.z, from: s.x0, to: s.x1, kind: 'street' }, nsCrossForEW(s));
  }
  // --- ring avenue x connector intersections (x +/-40, z -42) ---
  // Both roads are 7 wide, one lane per direction: one zebra per leg,
  // a stop spanning the inbound lane, one straight arrow, box junction.
  const allLegs = [];
  for (const cx of CROSS_X) {
    const cz = -42, hn = 3.5, he = 3.5;
    for (const leg of ['W', 'E']) {
      const band = zebraApproach(m, cx, cz, leg, he, hn, 3.2);
      const stop = stopForApproach(m, band, leg, 'street', WIDE_LANE);
      allLegs.push({ stop, leg, wide: true });
    }
    for (const leg of ['S', 'N']) {
      const band = zebraApproach(m, cx, cz, leg, hn, he, 3.2);
      const stop = stopForApproach(m, band, leg, 'street', WIDE_LANE);
      allLegs.push({ stop, leg, wide: true });
    }
    boxJunction(m, cx, cz, hn, he);
  }
  for (const { stop, leg } of allLegs) {
    arrowsForApproach(m, stop, leg, 'street', [{ off: 1.6, ry: wideArrowRy[leg] }]);
  }
  m.build(g, 'ring');
  // ---------- furniture ----------
  // GRID REBUILD: the boulevard curbs, manholes, hydrants, lamps and
  // signs now live in cbd-grid.js. What stays here is the QUAY
  // furniture (the quay strip moved to z 12.7..14.5) and the traffic
  // lights at the x +/-40 connectors (the grid's lights cover only its
  // own 42 intersections).
  // Hydrants, bins, benches on the quay paving (z 13.5).
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
  const hydParts = [];
  for (const hx of [-24, 8, 34]) {
    hydParts.push(colored(xform(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 8), hx, 0.55, 13.5), 0xffffff));
    hydParts.push(colored(xform(new THREE.SphereGeometry(0.22, 8, 6), hx, 0.95, 13.5), 0xffffff));
  }
  const hydMesh = mergedMesh(hydParts, red);
  hydMesh.name = 'hydrants';
  g.add(hydMesh);
  const teal = new THREE.MeshStandardMaterial({ color: 0x2e7f8f, roughness: 0.6 });
  const bolParts = [];
  for (let x = -54; x <= 54; x += 6) {
    bolParts.push(colored(xform(new THREE.CylinderGeometry(0.14, 0.18, 0.85, 8), x, 0.45, 12.9), 0xffffff));
    bolParts.push(colored(xform(new THREE.SphereGeometry(0.14, 8, 6), x, 0.9, 12.9), 0xffffff));
  }
  const bolMesh = mergedMesh(bolParts, teal);
  bolMesh.name = 'bollards';
  g.add(bolMesh);
  const binMat = new THREE.MeshStandardMaterial({ color: 0x3a4a52, roughness: 0.7 });
  const binParts = [];
  for (const bx of [-44, -14, 14, 44]) binParts.push(colored(xform(new THREE.CylinderGeometry(0.35, 0.3, 0.8, 8), bx, 0.6, 13.5), 0xffffff));
  const binMesh = mergedMesh(binParts, binMat);
  binMesh.name = 'bins';
  g.add(binMesh);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 });
  const benchParts = [];
  for (const bx of [-36, 6, 26]) {
    benchParts.push(colored(xform(new THREE.BoxGeometry(2.2, 0.12, 0.5), bx, 0.55, 13.5), 0xffffff));
    benchParts.push(colored(xform(new THREE.BoxGeometry(0.12, 0.55, 0.5), bx - 0.9, 0.28, 13.5), 0xffffff));
    benchParts.push(colored(xform(new THREE.BoxGeometry(0.12, 0.55, 0.5), bx + 0.9, 0.28, 13.5), 0xffffff));
  }
  const benchMesh = mergedMesh(benchParts, wood);
  benchMesh.name = 'benches';
  g.add(benchMesh);
  // Traffic lights at the two main intersections (red/amber/green) —
  // the boulevard x the x=+/-40 ring connectors. The pole stands in the
  // furniture strip on the boulevard's south sidewalk (z 2.44: the
  // road edge is 2.4, the strip is 0.08 wide) — never on the asphalt.
  // The lenses face the boulevard traffic (west for the x=-40 light,
  // east for x=+40). WORKING CYCLES (Xian 21 Nov 15:22): the lenses
  // cycle on the same 40 s rhythm as the grid signals — EW green
  // [20,37), EW amber [37,40), red [0,20) — exactly one lens bright
  // at a time.
  const tlMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const tlParts = [];
  const tlLights = [];
  for (const cx of [-40, 40]) {
    tlParts.push(colored(xform(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), cx + 4.4, 1.7, 2.44), 0xffffff));
    tlParts.push(colored(xform(new THREE.BoxGeometry(0.5, 1.0, 0.5), cx + 4.4, 3.6, 2.44), 0xffffff));
    const faceX = cx < 0 ? -1 : 1; // lens side: west face / east face
    const faceRy = cx < 0 ? -Math.PI / 2 : Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const col = [0xff3b30, 0xffcc00, 0x34c759][i];
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.16, 10),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      mesh.position.set(cx + 4.4 + faceX * 0.28, 3.9 - i * 0.28, 2.0);
      mesh.rotation.y = faceRy;
      tlLights.push({ mesh, bright: col, role: i }); // 0 red, 1 amber, 2 green
    }
  }
  const tlMesh = mergedMesh(tlParts, tlMat);
  tlMesh.name = 'trafficlights';
  g.add(tlMesh);
  for (const l of tlLights) g.add(l.mesh);
  // Cycle ticker (stepped by city.js): one lit lens per head.
  const tlTicker = new THREE.Group();
  tlTicker.name = 'connector-signal-ticker';
  tlTicker.userData.tick = () => {
    const phase = (performance.now() / 1000) % 40;
    const lit = phase < 20 ? 0 : phase < 37 ? 2 : 1; // red / green / amber
    for (const l of tlLights) {
      l.mesh.material.color.setHex(l.role === lit ? l.bright : 0x1c1c1c);
    }
  };
  g.add(tlTicker);
  // Lamp posts, CBD lamps and speed bumps now live in cbd-grid.js
  // (lamps along every grid street, bumps on the streets). The lamp
  // cones here are empty — the grid's cones are wired through city.js.
  const lampCones = [];
  // Puddles on the boulevard lanes (storm only): the old z 2.4 spots
  // are inside a CBD block now, so they sit in the driving lanes.
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x9fd4d8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.75,
  });
  const puddleParts = [];
  for (const [px, pz] of [[-34, 0.7], [4, -0.7], [28, 0.7]]) puddleParts.push(colored(xform(new THREE.CircleGeometry(1.4, 16), px, 0.23, pz, 0, 1, -Math.PI / 2), 0xffffff));
  const puddles = mergedMesh(puddleParts, puddleMat);
  puddles.name = 'puddles';
  puddles.visible = false;
  g.add(puddles);
  // Street-name signs (fictional names only). Small (1.5 x 0.38 m) and
  // mounted at 2.35 m on a 2.4 m pole — legible, never dominating the
  // frame the way the old 2.4 m signs at 3.1 m did. The CBD signs live
  // in cbd-grid.js; these two mark the ring connectors at the ring
  // avenue corners.
  const signNames = ['VIA DEL FARO', 'VIA DEL PORTO'];
  const signSpots = [[-44.4, -37.5], [35.6, -37.5]];
  const signGeo = new THREE.PlaneGeometry(1.5, 0.38);
  signNames.forEach((n, i) => {
    const [sx, sz] = signSpots[i];
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTexture(n) }));
    sign.position.set(sx, 2.35, sz);
    sign.rotation.y = Math.PI;
    g.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), M(0x3a3a3a));
    pole.position.set(sx, 1.2, sz);
    g.add(pole);
  });
  return {
    group: g, roadMat, wetness: { value: 0 }, puddles, lampCones,
    tickers: [tlTicker],
    setWet(v) { roadMat.roughness = 0.92 - v * 0.62; puddles.visible = v > 0.4; },
    setNight(on) { lampCones.forEach((c) => { c.visible = on; }); },
  };
}

// ---------- Road showcase (kit check / ?shot=road) ----------
// One 44-long road showing all six surfaces: asphalt (west), marina
// boardwalk strip by the water, old-town cobble (east), quarry concrete
// with hazard stripes, countryside gravel, skyline plaza. M2: the shot
// now has traffic + pedestrians, varied facades (awnings, balconies,
// rooftop props, shop fronts) and a non-flat horizon (hills + skyline).
export function buildRoadShowcase() {
  const g = new THREE.Group();
  g.name = 'roadShowcase';
  const tex = roadTexture('asphalt', 21);
  tex.repeat.set(6, 1.6);
  const roadMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, flatShading: true });
  const parts = [colored(xform(new THREE.BoxGeometry(44, 0.3, 11.4), 0, 0.05, 0), 0xffffff)];
  const cobTex = roadTexture('cobble', 22);
  cobTex.repeat.set(1.2, 1.4);
  const cobMat = new THREE.MeshStandardMaterial({ map: cobTex, roughness: 0.95, flatShading: true });
  const cob = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 11.4), cobMat);
  cob.position.set(20, 0.05, 0);
  g.add(cob);
  const swMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.95, flatShading: true });
  const sw = mergedMesh([
    colored(xform(new THREE.BoxGeometry(44, 0.24, 2.4), 0, 0.12, -6.9), 0xffffff),
    colored(xform(new THREE.BoxGeometry(44, 0.24, 2.4), 0, 0.12, 6.9), 0xffffff),
  ], swMat);
  g.add(sw);
  const road = mergedMesh(parts, roadMat);
  g.add(road);
  // Markings: dashed center, yellow edges, ONE narrow zebra (3 stripes)
  // at the single cross street, worn and patchy.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.62 });
  const dashes = [];
  for (let x = -20; x <= 20; x += 5) dashes.push(colored(xform(new THREE.BoxGeometry(3, 0.01, 0.22), x, 0.22, 0), 0xffffff));
  g.add(mergedMesh(dashes, dashMat));
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xe8c33d, transparent: true, opacity: 0.5 });
  const edges = [
    colored(xform(new THREE.BoxGeometry(44, 0.01, 0.3), 0, 0.22, -5.3), 0xffffff),
    colored(xform(new THREE.BoxGeometry(44, 0.01, 0.3), 0, 0.22, 5.3), 0xffffff),
  ];
  g.add(mergedMesh(edges, yellowMat));
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.5 });
  const zebras = [];
  for (let dz = -3.2; dz <= 3.2; dz += 1.6) {
    zebras.push(colored(xform(new THREE.BoxGeometry(0.3, 0.01, 1.8), -16, 0.22, dz), 0xffffff));
  }
  g.add(mergedMesh(zebras, zebraMat));
  // Marina boardwalk strip by the water (hairline gaps, 6 wide planks),
  // teal bollards + rope + cleats along the quay edge.
  const bwTex = roadTexture('boardwalk', 23);
  bwTex.repeat.set(6, 1);
  const bwMat = new THREE.MeshStandardMaterial({ map: bwTex, roughness: 0.85, flatShading: true });
  const bw = new THREE.Mesh(new THREE.BoxGeometry(44, 0.3, 2.4), bwMat);
  bw.position.set(0, 0.06, 9.4);
  g.add(bw);
  const teal = new THREE.MeshStandardMaterial({ color: 0x2e7f8f, roughness: 0.6 });
  const bolParts = [];
  for (let x = -20; x <= 20; x += 4) bolParts.push(colored(xform(new THREE.CylinderGeometry(0.14, 0.18, 0.85, 8), x, 0.45, 10.4), 0xffffff));
  g.add(mergedMesh(bolParts, teal));
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.9 });
  const ropeParts = [];
  for (let x = -20; x < 20; x += 4) {
    ropeParts.push(colored(xform(new THREE.BoxGeometry(4, 0.06, 0.06), x + 2, 0.75, 10.4), 0xffffff));
  }
  g.add(mergedMesh(ropeParts, ropeMat));
  // Quarry concrete slab + hazard stripes; gravel patch; plaza strip.
  const conTex = roadTexture('concrete', 24);
  conTex.repeat.set(1, 1);
  const conMat = new THREE.MeshStandardMaterial({ map: conTex, roughness: 0.95, flatShading: true });
  const con = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 11.4), conMat);
  con.position.set(-26, 0.05, 0);
  g.add(con);
  const haz = hazardTexture();
  haz.repeat.set(2, 1);
  const hazMat = new THREE.MeshBasicMaterial({ map: haz });
  const hazMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), hazMat);
  hazMesh.rotation.x = -Math.PI / 2;
  hazMesh.position.set(-26, 0.23, -5.6);
  g.add(hazMesh);
  const gravTex = roadTexture('gravel', 25);
  gravTex.repeat.set(1.4, 1.4);
  const gravMat = new THREE.MeshStandardMaterial({ map: gravTex, roughness: 1.0, flatShading: true });
  const grav = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 11.4), gravMat);
  grav.position.set(26, 0.05, 0);
  g.add(grav);
  const plazaTex = roadTexture('plaza', 26);
  plazaTex.repeat.set(1, 1);
  const plazaMat = new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.95, flatShading: true });
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 11.4), plazaMat);
  plaza.position.set(32, 0.05, 0);
  g.add(plaza);
  // Lamp row along the north sidewalk (the row is already at z -7.2).
  const { group: lampGroup } = lampRow();
  g.add(lampGroup);
  // ---------- varied facades (north + south rows) ----------
  const facadeColors = [0xd8a05a, 0xc96a4a, 0xe8c98a, 0x7a9a8a, 0xb88a6a, 0xd8b8a8];
  const shopDefs = [
    { name: 'CAFÉ LUME', bg: '#1e2a32', fg: '#ffd9a0' },
    { name: 'FORNO AZZURRO', bg: '#7a2e2e', fg: '#f7ebd7' },
    { name: 'PESCHERIA', bg: '#1f7a8c', fg: '#f7ebd7' },
    { name: 'GELATO SOL', bg: '#c98a3a', fg: '#1e2a32' },
  ];
  const facadeParts = [];
  const awningParts = [];
  const signMeshes = [];
  for (let i = 0; i < 4; i++) {
    const x = -16 + i * 10;
    const h = 4.5 + (i % 2) * 1.5;
    const col = facadeColors[i % facadeColors.length];
    // Main volume + upper floor + parapet (varied heights + colors).
    facadeParts.push(colored(xform(new THREE.BoxGeometry(7.5, h, 2.5), x, h / 2, -9.5), col));
    facadeParts.push(colored(xform(new THREE.BoxGeometry(7.5, 0.4, 2.8), x, h + 0.2, -9.5), col));
    // Windows: two rows, shutters on the upper row.
    for (const wy of [1.6, 3.2]) {
      for (const wx of [-2.2, 0, 2.2]) {
        facadeParts.push(colored(xform(new THREE.BoxGeometry(1.0, 1.2, 0.1), x + wx, wy, -8.2), 0x1e2a32));
        if (wy > 3) facadeParts.push(colored(xform(new THREE.BoxGeometry(0.3, 1.2, 0.1), x + wx - 0.7, wy, -8.2), 0x3a5a3a));
      }
    }
    // Striped awning over the shop front + sign.
    const stripe = i % 2 ? 0xf7ebd7 : 0xc93a6b;
    awningParts.push(colored(xform(new THREE.BoxGeometry(7.5, 0.15, 1.6), x, 2.6, -8.0), stripe));
    const sd = shopDefs[i % shopDefs.length];
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.0),
      new THREE.MeshBasicMaterial({ map: shopTexture(sd.name, sd.bg, sd.fg) }),
    );
    sign.position.set(x, 2.0, -8.15);
    signMeshes.push(sign);
    // Balcony + rail on the upper floor (two of the four buildings).
    if (i % 2 === 0) {
      facadeParts.push(colored(xform(new THREE.BoxGeometry(3.4, 0.15, 1.0), x + 1.4, 3.9, -8.4), 0x8a6a4a));
      facadeParts.push(colored(xform(new THREE.BoxGeometry(3.4, 0.7, 0.08), x + 1.4, 4.35, -8.9), 0x1e2a32));
    }
    // Rooftop props: AC box + water tank + chimney (varied per building).
    facadeParts.push(colored(xform(new THREE.BoxGeometry(0.9, 0.7, 0.9), x - 2.2, h + 0.8, -9.5), 0x9a9a9a));
    facadeParts.push(colored(xform(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 8), x + 2.0, h + 1.0, -9.8), 0x6a4a2a));
    facadeParts.push(colored(xform(new THREE.BoxGeometry(0.5, 1.1, 0.5), x + 0.4, h + 1.0, -10.2), 0x8a4a3a));
  }
  g.add(mergedMesh(facadeParts, vertexColorMat));
  g.add(mergedMesh(awningParts, vertexColorMat));
  for (const s of signMeshes) g.add(s);
  // ---------- traffic + pedestrians on the showcase road ----------
  const carA = buildTrafficCar(0xe4572e);
  carA.position.set(-10, 0, -2.2);
  carA.rotation.y = Math.PI / 2;
  g.add(carA);
  const carB = buildTrafficCar(0x2e7f8f);
  carB.position.set(6, 0, 2.4);
  carB.rotation.y = -Math.PI / 2;
  g.add(carB);
  const cruiser = buildPoliceCruiser();
  cruiser.position.set(14, 0, -2.2);
  cruiser.rotation.y = Math.PI / 2;
  g.add(cruiser);
  const pedDefs = [
    { x: -6, z: -6.2, y: Math.PI / 2 },
    { x: 2, z: 6.2, y: -Math.PI / 2 },
    { x: 12, z: -6.2, y: Math.PI / 2 },
  ];
  pedDefs.forEach((p, i) => {
    const fig = makeFigure(CIVILIANS[i % CIVILIANS.length].spec);
    fig.position.set(p.x, 0.12, p.z);
    fig.rotation.y = p.y;
    g.add(fig);
  });
  // ---------- non-flat horizon: layered hills + skyline across the bay ----------
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x8a9a6a, roughness: 1, flatShading: true });
  const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x6a8a7a, roughness: 1, flatShading: true });
  const hills = [
    { x: -52, y: -1.5, z: -28, r: 16, m: hillMat },
    { x: -58, y: -2.5, z: 6, r: 20, m: hillMat2 },
    { x: -50, y: -1, z: 34, r: 14, m: hillMat },
    { x: -66, y: -3, z: -8, r: 22, m: hillMat2 },
  ];
  for (const h of hills) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(h.r, 12, 8), h.m);
    s.scale.y = 0.32;
    s.position.set(h.x, h.y, h.z);
    g.add(s);
  }
  const skyline = buildSkylineCluster('lod');
  skyline.position.set(-56, 0, -2);
  skyline.scale.set(0.55, 0.55, 0.55);
  g.add(skyline);
  return { group: g, roadMat };
}
