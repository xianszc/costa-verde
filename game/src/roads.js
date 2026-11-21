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
import { buildTrafficCar, buildPoliceCruiser } from './vehicles.js';
import { makeFigure, CIVILIANS } from './people.js';

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
// V3 (stage 1): a tidy grid. The boulevard runs east-west through the
// CBD (z -6..6). The CBD's north-south streets sit in the gaps between
// tower columns (6-unit pitch, 2-unit = 20 m streets, z -30..18) —
// the old cross streets at x -20/0/20 cut through the tower grid and
// are gone. The ring connectors at x +/-40 (7 wide, z -42..6) link the
// old town and the commercial ring to the boulevard. The quay (z
// 8.5..13) fronts the bay. Sidewalks step up 0.12 beside every road.
export const BOULEVARD = { x0: -60, x1: 60, z0: -6, z1: 6 };
export const CROSS_X = [-40, 40];
export const CROSS = { z0: -42, z1: 6, half: 3.5 };
// CBD north-south streets (in the tower gaps), 2 wide, z -30..18.
export const CBD_STREETS_X = [-21, -15, -9, -3, 3, 9, 15, 21];
export const CBD_STREET = { z0: -30, z1: 18, half: 1 };
// Commercial-ring streets (stage 1 part 3): the east-west avenue at
// z -42 (7 wide, x -60..60) splits the north strip into two block
// rows, and 2-wide side streets split the blocks (north strip z
// -54..-30, east strip z -30..14, west strip z -30..22).
export const RING_AVENUE = { x0: -60, x1: 60, z0: -45.5, z1: -38.5 };
export const RING_STREETS = [
  { x: -19, z0: -54, z1: -30 }, { x: -4, z0: -54, z1: -30 },
  { x: 11, z0: -54, z1: -30 }, { x: 26, z0: -54, z1: -30 },
  { x: 41, z0: -54, z1: -30 }, { x: 44, z0: -30, z1: 14 },
  { x: -44, z0: -30, z1: 22 },
];
export const RING_STREET_HALF = 1;
export const QUAY = { x0: -60, x1: 60, z0: 8.5, z1: 13 };
export const WATER_Z = 13;

function rect(x0, z0, x1, z1) { return { x0, z0, x1, z1 }; }
export function roadRects() {
  const r = [rect(BOULEVARD.x0, BOULEVARD.z0, BOULEVARD.x1, BOULEVARD.z1)];
  for (const cx of CROSS_X) r.push(rect(cx - CROSS.half, CROSS.z0, cx + CROSS.half, CROSS.z1));
  for (const sx of CBD_STREETS_X) r.push(rect(sx - CBD_STREET.half, CBD_STREET.z0, sx + CBD_STREET.half, CBD_STREET.z1));
  r.push(rect(RING_AVENUE.x0, RING_AVENUE.z0, RING_AVENUE.x1, RING_AVENUE.z1));
  for (const s of RING_STREETS) r.push(rect(s.x - RING_STREET_HALF, s.z0, s.x + RING_STREET_HALF, s.z1));
  r.push(rect(QUAY.x0, QUAY.z0, QUAY.x1, QUAY.z1));
  return r;
}
function sidewalkRects() {
  const r = [
    rect(BOULEVARD.x0, -8.5, BOULEVARD.x1, -6),
    rect(BOULEVARD.x0, 6, BOULEVARD.x1, 8.5),
    rect(QUAY.x0, 13, QUAY.x1, 14.2),
    rect(RING_AVENUE.x0, -47.5, RING_AVENUE.x1, -45.5),
    rect(RING_AVENUE.x0, -38.5, RING_AVENUE.x1, -36.5),
  ];
  for (const cx of CROSS_X) {
    r.push(rect(cx - CROSS.half - 2, CROSS.z0, cx - CROSS.half, CROSS.z1));
    r.push(rect(cx + CROSS.half, CROSS.z0, cx + CROSS.half + 2, CROSS.z1));
  }
  for (const sx of CBD_STREETS_X) {
    r.push(rect(sx - CBD_STREET.half - 0.7, CBD_STREET.z0, sx - CBD_STREET.half, CBD_STREET.z1));
    r.push(rect(sx + CBD_STREET.half, CBD_STREET.z0, sx + CBD_STREET.half + 0.7, CBD_STREET.z1));
  }
  for (const s of RING_STREETS) {
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
    { name: 'boulevard', pts: loopPath(-56, -3.4, 56, 3.4, 4), speed: 9 },
    // West block: boulevard lanes + the x=-40 ring connector and the
    // x=-21 tower-gap street (the old x=0 leg cut through the CBD).
    { name: 'west-block', pts: loopPath(-39, -41, -21, 3.4, 1.2), speed: 7 },
    // East block: boulevard lanes + the x=21 tower-gap street and the
    // x=40 ring connector (the old x=20 leg cut through the CBD).
    { name: 'east-block', pts: loopPath(21, -40, 39, 3.4, 1.2), speed: 7 },
    // Ring avenue: east-west along z -42 through the commercial ring.
    { name: 'ring-avenue', pts: loopPath(-56, -44.5, 56, -39.5, 2), speed: 7 },
  ];
}
export function minimapLines() {
  const lines = [{ x1: BOULEVARD.x0, z1: 0, x2: BOULEVARD.x1, z2: 0, w: 12 }];
  for (const cx of CROSS_X) lines.push({ x1: cx, z1: CROSS.z0, x2: cx, z2: CROSS.z1, w: 7 });
  for (const sx of CBD_STREETS_X) lines.push({ x1: sx, z1: CBD_STREET.z0, x2: sx, z2: CBD_STREET.z1, w: 2 });
  lines.push({ x1: RING_AVENUE.x0, z1: -42, x2: RING_AVENUE.x1, z2: -42, w: 7 });
  for (const s of RING_STREETS) lines.push({ x1: s.x, z1: s.z0, x2: s.x, z2: s.z1, w: 2 });
  lines.push({ x1: QUAY.x0, z1: 10.75, x2: QUAY.x1, z2: 10.75, w: 4.5 });
  return lines;
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
  const parts = [];
  // Road slabs (12 wide; 44 x 7.5m tiles).
  for (let x = -60; x < 60; x += 7.5) parts.push(colored(xform(new THREE.BoxGeometry(7.5, 0.3, 12), x + 3.75, 0.05, 0), 0xffffff));
  // Cross streets (7 wide, 42 long) — one box per street, not 9 tiles.
  for (const cx of CROSS_X) parts.push(colored(xform(new THREE.BoxGeometry(7, 0.3, 48), cx, 0.05, -18), 0xffffff));
  // CBD north-south streets (2 wide, 48 long, z -30..18) — one box each.
  for (const sx of CBD_STREETS_X) parts.push(colored(xform(new THREE.BoxGeometry(2, 0.3, 48), sx, 0.05, -6), 0xffffff));
  // Ring avenue (7 wide, 120 long, z -42) + ring side streets (2 wide).
  parts.push(colored(xform(new THREE.BoxGeometry(120, 0.3, 7), 0, 0.05, -42), 0xffffff));
  for (const s of RING_STREETS) {
    const len = s.z1 - s.z0;
    parts.push(colored(xform(new THREE.BoxGeometry(2, 0.3, len), s.x, 0.05, (s.z0 + s.z1) / 2), 0xffffff));
  }
  // Sidewalks (light warm grey, one step lighter than the road) with a
  // physical height step (y 0.12) and visible curbs.
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.95, flatShading: true });
  const swParts = [
    colored(xform(new THREE.BoxGeometry(120, 0.24, 2.5), 0, 0.12, -7.25), 0xffffff),
    colored(xform(new THREE.BoxGeometry(120, 0.24, 2.5), 0, 0.12, 7.25), 0xffffff),
  ];
  for (const cx of CROSS_X) {
    swParts.push(colored(xform(new THREE.BoxGeometry(2, 0.24, 48), cx - CROSS.half - 1, 0.12, -18), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(2, 0.24, 48), cx + CROSS.half + 1, 0.12, -18), 0xffffff));
  }
  // CBD street sidewalks (0.7 wide, beside each 2-wide street).
  for (const sx of CBD_STREETS_X) {
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, 48), sx - CBD_STREET.half - 0.35, 0.12, -6), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, 48), sx + CBD_STREET.half + 0.35, 0.12, -6), 0xffffff));
  }
  // Ring avenue sidewalks + ring street sidewalks.
  swParts.push(colored(xform(new THREE.BoxGeometry(120, 0.24, 2), 0, 0.12, -46.5), 0xffffff));
  swParts.push(colored(xform(new THREE.BoxGeometry(120, 0.24, 2), 0, 0.12, -37.5), 0xffffff));
  for (const s of RING_STREETS) {
    const len = s.z1 - s.z0;
    const zc = (s.z0 + s.z1) / 2;
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, len), s.x - RING_STREET_HALF - 0.35, 0.12, zc), 0xffffff));
    swParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.24, len), s.x + RING_STREET_HALF + 0.35, 0.12, zc), 0xffffff));
  }
  const sw = mergedMesh(swParts, sidewalkMat);
  sw.name = 'sidewalks';
  g.add(sw);
  // Quay (z 8.5..13) — wide paved promenade fronting the bay.
  const quayTex = roadTexture('plaza', 5);
  quayTex.repeat.set(14, 1);
  const quayMat = new THREE.MeshStandardMaterial({ map: quayTex, roughness: 0.95, flatShading: true });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(120, 0.3, 4.5), quayMat);
  quay.position.set(0, 0.06, 10.75);
  quay.name = 'quay';
  g.add(quay);
  const road = mergedMesh(parts, roadMat);
  road.name = 'roads';
  g.add(road);
  // ---------- markings (worn, never crisp) ----------
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.62 });
  const dashes = [];
  for (let x = -56; x <= 56; x += 5) dashes.push(colored(xform(new THREE.BoxGeometry(3, 0.01, 0.22), x, 0.22, 0), 0xffffff));
  for (const cx of CROSS_X) {
    for (let z = -40; z <= 4; z += 5) dashes.push(colored(xform(new THREE.BoxGeometry(0.22, 0.01, 3), cx, 0.22, z), 0xffffff));
  }
  // CBD street centre dashes (single line, the streets are 2 wide).
  for (const sx of CBD_STREETS_X) {
    for (let z = -28; z <= 16; z += 4) dashes.push(colored(xform(new THREE.BoxGeometry(0.15, 0.01, 2), sx, 0.22, z), 0xffffff));
  }
  // Ring avenue dashes + ring street dashes.
  for (let x = -56; x <= 56; x += 5) dashes.push(colored(xform(new THREE.BoxGeometry(3, 0.01, 0.22), x, 0.22, -42), 0xffffff));
  for (const s of RING_STREETS) {
    for (let z = s.z0 + 2; z <= s.z1 - 2; z += 4) dashes.push(colored(xform(new THREE.BoxGeometry(0.15, 0.01, 2), s.x, 0.22, z), 0xffffff));
  }
  const dashMesh = mergedMesh(dashes, dashMat);
  dashMesh.name = 'dashes';
  g.add(dashMesh);
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xe8c33d, transparent: true, opacity: 0.5 });
  const edges = [
    colored(xform(new THREE.BoxGeometry(120, 0.01, 0.3), 0, 0.22, -5.6), 0xffffff),
    colored(xform(new THREE.BoxGeometry(120, 0.01, 0.3), 0, 0.22, 5.6), 0xffffff),
  ];
  for (const cx of CROSS_X) {
    edges.push(colored(xform(new THREE.BoxGeometry(0.3, 0.01, 48), cx - 3.2, 0.22, -18), 0xffffff));
    edges.push(colored(xform(new THREE.BoxGeometry(0.3, 0.01, 48), cx + 3.2, 0.22, -18), 0xffffff));
  }
  // CBD street edges (thin, at the road's edge).
  for (const sx of CBD_STREETS_X) {
    edges.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, 48), sx - 0.85, 0.22, -6), 0xffffff));
    edges.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, 48), sx + 0.85, 0.22, -6), 0xffffff));
  }
  // Ring avenue edges + ring street edges.
  edges.push(colored(xform(new THREE.BoxGeometry(120, 0.01, 0.3), 0, 0.22, -45.2), 0xffffff));
  edges.push(colored(xform(new THREE.BoxGeometry(120, 0.01, 0.3), 0, 0.22, -38.8), 0xffffff));
  for (const s of RING_STREETS) {
    const len = s.z1 - s.z0;
    const zc = (s.z0 + s.z1) / 2;
    edges.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, len), s.x - 0.85, 0.22, zc), 0xffffff));
    edges.push(colored(xform(new THREE.BoxGeometry(0.12, 0.01, len), s.x + 0.85, 0.22, zc), 0xffffff));
  }
  const edgeMesh = mergedMesh(edges, yellowMat);
  edgeMesh.name = 'edges';
  g.add(edgeMesh);
  // Zebra crossings — narrow (3.6 wide), 6 short stripes, only where a
  // cross street meets the boulevard (real intersections), so they read
  // as crossings instead of dominating the whole road.
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.5 });
  const zebras = [];
  for (const cx of [...CROSS_X, ...CBD_STREETS_X]) {
    for (let dz = -4.0; dz <= 4.0; dz += 1.6) {
      zebras.push(colored(xform(new THREE.BoxGeometry(0.28, 0.01, 3.6), cx, 0.22, dz), 0xffffff));
    }
  }
  const zebraMesh = mergedMesh(zebras, zebraMat);
  zebraMesh.name = 'zebras';
  g.add(zebraMesh);
  // Stop lines + turn arrows at intersections (worn).
  const stopMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.55 });
  const stops = [];
  for (const cx of CROSS_X) {
    stops.push(colored(xform(new THREE.BoxGeometry(0.4, 0.01, 2.8), cx - 4.6, 0.22, -3.4), 0xffffff));
    stops.push(colored(xform(new THREE.BoxGeometry(0.4, 0.01, 2.8), cx + 4.6, 0.22, 3.4), 0xffffff));
  }
  // CBD streets: stop lines at the street's edge (the streets are 2 wide).
  for (const sx of CBD_STREETS_X) {
    stops.push(colored(xform(new THREE.BoxGeometry(0.4, 0.01, 2.8), sx - 1.4, 0.22, -3.4), 0xffffff));
    stops.push(colored(xform(new THREE.BoxGeometry(0.4, 0.01, 2.8), sx + 1.4, 0.22, 3.4), 0xffffff));
  }
  const stopMesh = mergedMesh(stops, stopMat);
  stopMesh.name = 'stoplines';
  g.add(stopMesh);
  // Turn arrows (worn triangles).
  const arrowGeo = new THREE.Shape();
  arrowGeo.moveTo(-0.5, 0); arrowGeo.lineTo(0.5, 0); arrowGeo.lineTo(0.5, 1.6);
  arrowGeo.lineTo(1.1, 1.6); arrowGeo.lineTo(0, 2.8); arrowGeo.lineTo(-1.1, 1.6);
  arrowGeo.lineTo(-0.5, 1.6); arrowGeo.closePath();
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.45 });
  const arrowParts = [];
  for (const cx of CROSS_X) {
    const sh1 = new THREE.ShapeGeometry(arrowGeo);
    arrowParts.push(colored(xform(sh1, cx, 0.22, -3.4, 0, Math.PI, 0), 0xffffff));
    const sh2 = new THREE.ShapeGeometry(arrowGeo);
    arrowParts.push(colored(xform(sh2, cx, 0.22, 3.4, 0, 0, 0), 0xffffff));
  }
  const arrowMesh = mergedMesh(arrowParts, arrowMat);
  arrowMesh.name = 'arrows';
  g.add(arrowMesh);
  // Parking bays (white outline, worn) along the boulevard edges.
  const bayMat = new THREE.MeshBasicMaterial({ color: 0xf7ebd7, transparent: true, opacity: 0.4 });
  const bays = [];
  for (const bx of [-48, -38, -28, -18, -8, 2, 12, 22, 32, 42]) {
    bays.push(colored(xform(new THREE.BoxGeometry(6.4, 0.01, 0.12), bx, 0.22, -4.9), 0xffffff));
    bays.push(colored(xform(new THREE.BoxGeometry(6.4, 0.01, 0.12), bx, 0.22, 4.9), 0xffffff));
  }
  const bayMesh = mergedMesh(bays, bayMat);
  bayMesh.name = 'bays';
  g.add(bayMesh);
  // ---------- furniture ----------
  // Curbs: raised lip between road and sidewalk (height step is visible).
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.95 });
  const curbs = [
    colored(xform(new THREE.BoxGeometry(120, 0.34, 0.3), 0, 0.17, -6.05), 0xffffff),
    colored(xform(new THREE.BoxGeometry(120, 0.34, 0.3), 0, 0.17, 6.05), 0xffffff),
  ];
  const curbMesh = mergedMesh(curbs, curbMat);
  curbMesh.name = 'curbs';
  g.add(curbMesh);
  // Manholes + grates.
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.7 });
  const metalParts = [];
  for (const mx of [-32, -8, 18, 44]) metalParts.push(colored(xform(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12), mx, 0.22, -3.4), 0xffffff));
  for (const gx of [-24, 8, 34]) {
    for (let i = 0; i < 4; i++) metalParts.push(colored(xform(new THREE.BoxGeometry(0.7, 0.02, 0.08), gx, 0.22, 5.5 - i * 0.18), 0xffffff));
  }
  const metalMesh = mergedMesh(metalParts, metal);
  metalMesh.name = 'metal';
  g.add(metalMesh);
  // Hydrants, bollards, bins, benches.
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
  const hydParts = [];
  for (const hx of [-24, 8, 34]) {
    hydParts.push(colored(xform(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 8), hx, 0.55, 7.3), 0xffffff));
    hydParts.push(colored(xform(new THREE.SphereGeometry(0.22, 8, 6), hx, 0.95, 7.3), 0xffffff));
  }
  const hydMesh = mergedMesh(hydParts, red);
  hydMesh.name = 'hydrants';
  g.add(hydMesh);
  const teal = new THREE.MeshStandardMaterial({ color: 0x2e7f8f, roughness: 0.6 });
  const bolParts = [];
  for (let x = -54; x <= 54; x += 6) {
    bolParts.push(colored(xform(new THREE.CylinderGeometry(0.14, 0.18, 0.85, 8), x, 0.45, 8.6), 0xffffff));
    bolParts.push(colored(xform(new THREE.SphereGeometry(0.14, 8, 6), x, 0.9, 8.6), 0xffffff));
  }
  const bolMesh = mergedMesh(bolParts, teal);
  bolMesh.name = 'bollards';
  g.add(bolMesh);
  const binMat = new THREE.MeshStandardMaterial({ color: 0x3a4a52, roughness: 0.7 });
  const binParts = [];
  for (const bx of [-44, -14, 14, 44]) binParts.push(colored(xform(new THREE.CylinderGeometry(0.35, 0.3, 0.8, 8), bx, 0.6, 7.3), 0xffffff));
  const binMesh = mergedMesh(binParts, binMat);
  binMesh.name = 'bins';
  g.add(binMesh);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 });
  const benchParts = [];
  for (const bx of [-36, 6, 26]) {
    benchParts.push(colored(xform(new THREE.BoxGeometry(2.2, 0.12, 0.5), bx, 0.55, 7.4), 0xffffff));
    benchParts.push(colored(xform(new THREE.BoxGeometry(0.12, 0.55, 0.5), bx - 0.9, 0.28, 7.4), 0xffffff));
    benchParts.push(colored(xform(new THREE.BoxGeometry(0.12, 0.55, 0.5), bx + 0.9, 0.28, 7.4), 0xffffff));
  }
  const benchMesh = mergedMesh(benchParts, wood);
  benchMesh.name = 'benches';
  g.add(benchMesh);
  // Traffic lights at the two main intersections (red/amber/green) —
  // the boulevard x the x=+/-40 ring connectors.
  const tlMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const tlParts = [];
  const tlLights = [];
  for (const cx of [-40, 40]) {
    tlParts.push(colored(xform(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), cx + 4.4, 1.7, 6.2), 0xffffff));
    tlParts.push(colored(xform(new THREE.BoxGeometry(0.5, 1.0, 0.5), cx + 4.4, 3.6, 6.2), 0xffffff));
    for (let i = 0; i < 3; i++) {
      const col = [0xff3b30, 0xffcc00, 0x34c759][i];
      tlLights.push({ mesh: new THREE.Mesh(
        new THREE.CircleGeometry(0.16, 10),
        new THREE.MeshBasicMaterial({ color: col }),
      ), pos: [cx + 4.4, 3.9 - i * 0.28, 5.93] });
    }
  }
  const tlMesh = mergedMesh(tlParts, tlMat);
  tlMesh.name = 'trafficlights';
  g.add(tlMesh);
  for (const l of tlLights) {
    l.mesh.position.set(l.pos[0], l.pos[1], l.pos[2]);
    g.add(l.mesh);
  }
  // Lamp posts with fictional street names + speed bumps + puddles.
  const { group: lampGroup, cones: lampCones } = lampRow();
  g.add(lampGroup);
  // Lamp posts along the CBD streets (one per street, alternating
  // sides, on the sidewalk edge) — merged, no light cones.
  const cbdLampPoles = [];
  const cbdLampGlobes = [];
  CBD_STREETS_X.forEach((sx, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const lx = sx + side * 1.35;
    cbdLampPoles.push(xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), lx, 1.2, -18));
    cbdLampGlobes.push(xform(new THREE.SphereGeometry(0.16, 10, 8), lx, 2.5, -18));
    const lx2 = sx - side * 1.35;
    cbdLampPoles.push(xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), lx2, 1.2, 6));
    cbdLampGlobes.push(xform(new THREE.SphereGeometry(0.16, 10, 8), lx2, 2.5, 6));
  });
  const cbdLamps = new THREE.Group();
  cbdLamps.name = 'cbdLamps';
  cbdLamps.add(mergedMesh(cbdLampPoles, M(0x2b2b2b)));
  cbdLamps.add(mergedMesh(cbdLampGlobes, M(0xffd9a0, { emissive: 0xffc46b, emissiveIntensity: 0.9 })));
  g.add(cbdLamps);
  const bumpMat = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95 });
  const bumpParts = [];
  for (const bx of [-16, 16]) bumpParts.push(colored(xform(new THREE.BoxGeometry(0.6, 0.18, 11.4), bx, 0.28, 0), 0xffffff));
  const bumpMesh = mergedMesh(bumpParts, bumpMat);
  bumpMesh.name = 'speedbumps';
  g.add(bumpMesh);
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x9fd4d8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.75,
  });
  const puddleParts = [];
  for (const px of [-34, 4, 28]) puddleParts.push(colored(xform(new THREE.CircleGeometry(1.4, 16), px, 0.23, 2.4, -Math.PI / 2, 0, 0), 0xffffff));
  const puddles = mergedMesh(puddleParts, puddleMat);
  puddles.name = 'puddles';
  puddles.visible = false;
  g.add(puddles);
  // Street-name signs (fictional names only). Small (1.5 x 0.38 m) and
  // mounted at 2.35 m on a 2.4 m pole — legible, never dominating the
  // frame the way the old 2.4 m signs at 3.1 m did.
  const signNames = ['VIA DEL SOLE', 'CORSO AZZURRA', 'VIA DELLE VELA', 'LUNGOMARE', 'VIA DEL FARO'];
  // One sign per name: the two ring connectors + three CBD streets.
  const signXs = [-40, -15, 3, 15, 40];
  const signGeo = new THREE.PlaneGeometry(1.5, 0.38);
  signNames.forEach((n, i) => {
    const cx = signXs[i];
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTexture(n) }));
    sign.position.set(cx - 4.4, 2.35, 6.2);
    sign.rotation.y = Math.PI;
    g.add(sign);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), M(0x3a3a3a));
    pole.position.set(cx - 4.4, 1.2, 6.2);
    g.add(pole);
  });
  return {
    group: g, roadMat, wetness: { value: 0 }, puddles, lampCones,
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
