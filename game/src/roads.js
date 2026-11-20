// AZZURA HEIST — road system (M1, Xian's road spec).
// One source of truth: the road data drives the mesh, the traffic lanes,
// the navigation paths and the minimap lines. Procedural only, no external
// assets. Base asphalt is LIGHT warm grey #8a8580 (never dark) so lane
// markings, shadows, cars and characters stay readable; every district
// gets its own surface in the same light warm family. Markings are worn
// and patchy, never crisp. Roads, sidewalks and ground never z-fight:
// markings sit 0.02 above the asphalt, sidewalks step up 0.12.
// City-system rules apply: roads FIRST, trees ONLY in green zones, no
// building or tree ever on a road or blocking an intersection.
import * as THREE from '../vendor/three.module.min.js';
import { M, mergedMesh, colored, xform, vertexColorMat } from './world.js';

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
  // Bases are deliberately LIGHT: ACES tone mapping + golden-hour light
  // darken the albedo by roughly a third, so the canvas base must sit
  // well above #8a8580 for the road to READ as light warm grey.
  asphalt: { base: '#b3ada2', kind: 'asphalt' },
  cobble: { base: '#b8ae9c', kind: 'cobble' },
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
  // SEAMLESS TILING: every feature that can cross a tile edge is drawn
  // wrapped — at (x, y) and at all 8 neighbours (x±256, y±256) — so a
  // blotch, patch, stain, crack or stone cut by one edge continues on
  // the opposite edge. Without this the road reads as broken segments
  // every tile (~7.5 m on the boulevard).
  const wrap = (fn) => {
    for (const dx of [-256, 0, 256]) {
      for (const dy of [-256, 0, 256]) {
        ctx.save();
        ctx.translate(dx, dy);
        fn();
        ctx.restore();
      }
    }
  };
  if (def.kind === 'asphalt' || def.kind === 'concrete') {
    // Low-frequency noise blotches (±4% lightness — kept subtle so the
    // road stays light; the old ±6% read as dark patches).
    for (let i = 0; i < 46; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 12 + rnd() * 42;
      const f = 0.96 + rnd() * 0.08;
      wrap(() => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, shadeA(def.base, f, 1));
        g.addColorStop(1, shadeA(def.base, f, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
    }
    // Patched repairs: slightly darker/lighter rectangles.
    for (let i = 0; i < 8; i++) {
      const px = rnd() * 200, py = rnd() * 200;
      const pw = 24 + rnd() * 40, ph = 16 + rnd() * 28;
      const col = shade(def.base, 0.94 + rnd() * 0.12);
      wrap(() => {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(px, py, pw, ph);
        ctx.globalAlpha = 1;
      });
    }
    // Fine grain.
    for (let i = 0; i < 2200; i++) {
      const gx = rnd() * 256, gy = rnd() * 256;
      const col = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
      wrap(() => { ctx.fillStyle = col; ctx.fillRect(gx, gy, 1.4, 1.4); });
    }
    // Worn tracks along the lanes (full-width bands — already seamless).
    ctx.fillStyle = 'rgba(40,36,32,0.06)';
    ctx.fillRect(0, 66, 256, 14);
    ctx.fillRect(0, 176, 256, 14);
    // Oil stains.
    for (let i = 0; i < 5; i++) {
      const ox = rnd() * 256, oy = rnd() * 256;
      const rx = 8 + rnd() * 14, ry2 = 5 + rnd() * 8, rot = rnd() * 3;
      wrap(() => {
        ctx.fillStyle = 'rgba(20,18,16,0.08)';
        ctx.beginPath();
        ctx.ellipse(ox, oy, rx, ry2, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (def.kind === 'concrete') {
      // Slab joints (grid at multiples of 64 tiles exactly) + cracks.
      ctx.strokeStyle = 'rgba(60,58,54,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(50,48,44,0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const pts = [];
        let x = rnd() * 256, y = rnd() * 256;
        pts.push([x, y]);
        for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 30; y += rnd() * 18; pts.push([x, y]); }
        wrap(() => {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.stroke();
        });
      }
    }
  } else if (def.kind === 'cobble') {
    // Paver grid: rounded stones, per-stone variation. Each stone is
    // drawn wrapped so the staggered edge stones continue across the tile.
    const s = 32;
    for (let ry = 0; ry < 8; ry++) {
      for (let cx = 0; cx < 8; cx++) {
        const col = shade(def.base, 0.94 + rnd() * 0.14);
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
    // Wooden planks: 6 wide planks per tile, hairline gaps (1px, light),
    // grain curves wrapped so they continue across the edge. The old
    // 2px dark gaps every 32px tiled into a heavy dark grid.
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

// ---------- District 4 (Lungomare) road network ----------
// Boulevard east-west along the waterfront (z -6..6), five cross streets
// north (z -42..6). Sidewalks step up 0.12 beside every road. The quay
// (z 8.5..13) fronts the bay; the skyline sits across the water (z +85).
export const BOULEVARD = { x0: -60, x1: 60, z0: -6, z1: 6 };
export const CROSS_X = [-40, -20, 0, 20, 40];
export const CROSS = { z0: -42, z1: 6, half: 3.5 };
export const QUAY = { x0: -60, x1: 60, z0: 8.5, z1: 13 };
export const WATER_Z = 13;

function rect(x0, z0, x1, z1) { return { x0, z0, x1, z1 }; }
export function roadRects() {
  const r = [rect(BOULEVARD.x0, BOULEVARD.z0, BOULEVARD.x1, BOULEVARD.z1)];
  for (const cx of CROSS_X) r.push(rect(cx - CROSS.half, CROSS.z0, cx + CROSS.half, CROSS.z1));
  return r;
}
function sidewalkRects() {
  const r = [
    rect(BOULEVARD.x0, -8.5, BOULEVARD.x1, -6),
    rect(BOULEVARD.x0, 6, BOULEVARD.x1, 8.5),
  ];
  for (const cx of CROSS_X) {
    r.push(rect(cx - CROSS.half - 2, CROSS.z0, cx - CROSS.half, CROSS.z1));
    r.push(rect(cx + CROSS.half, CROSS.z0, cx + CROSS.half + 2, CROSS.z1));
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
    // West block: boulevard lanes + the x=-40 and x=0 cross streets.
    { name: 'west-block', pts: loopPath(-40, -3.4, 0, 3.4, 3.5), speed: 7 },
    // East cross: up and down the x=20 cross street (12 wide, z -42..6).
    { name: 'east-cross', pts: loopPath(19, -40, 25, 3.4, 2.5), speed: 7 },
  ];
}
export function minimapLines() {
  const lines = [{ x1: BOULEVARD.x0, z1: 0, x2: BOULEVARD.x1, z2: 0, w: 12 }];
  for (const cx of CROSS_X) lines.push({ x1: cx, z1: CROSS.z0, x2: cx, z2: CROSS.z1, w: 7 });
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
  const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 12), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 0);
  road.receiveShadow = true;
  g.add(road);
  const crossTex = roadTexture('asphalt', 23);
  crossTex.repeat.set(2, 10);
  const crossGeos = CROSS_X.map((cx) => xform(
    new THREE.PlaneGeometry(7, 48), cx, 0.02, -18, 0, 1, -Math.PI / 2, 0,
  ));
  // PlaneGeometry rotated flat via xform: rotate -90 about X, then place.
  const crossMesh = mergedMesh(crossGeos, new THREE.MeshStandardMaterial({
    map: crossTex, roughness: 0.92, flatShading: true,
  }));
  crossMesh.receiveShadow = true;
  g.add(crossMesh);

  // Sidewalks: one step lighter than the road, +0.12 height step.
  const walkMat = M(0xb0a89a);
  const walkGeos = [
    xform(new THREE.BoxGeometry(120, 0.24, 2.5), 0, 0.12, -7.25),
    xform(new THREE.BoxGeometry(120, 0.24, 2.5), 0, 0.12, 7.25),
  ];
  for (const cx of CROSS_X) {
    walkGeos.push(xform(new THREE.BoxGeometry(2, 0.24, 48), cx - 4.5, 0.12, -18));
    walkGeos.push(xform(new THREE.BoxGeometry(2, 0.24, 48), cx + 4.5, 0.12, -18));
  }
  g.add(mergedMesh(walkGeos, walkMat));

  // Quay: stone edge fronting the bay.
  const quay = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.3, 4.5),
    M(0xcbb28a),
  );
  quay.position.set(0, 0.15, 10.75);
  quay.receiveShadow = true;
  g.add(quay);

  // ---- markings (merged, 0.02 above asphalt — never z-fighting) ----
  // Worn white dashes down the boulevard centre + yellow edge lines.
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0.62 });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xe8c33d, transparent: true, opacity: 0.8 });
  const dashGeos = [];
  for (let x = -58; x <= 58; x += 4) {
    dashGeos.push(xform(new THREE.PlaneGeometry(1.8, 0.16), x, 0.045, 0, 0, 1, -Math.PI / 2, 0));
  }
  g.add(mergedMesh(dashGeos, whiteMat));
  const edgeGeos = [
    xform(new THREE.PlaneGeometry(120, 0.18), 0, 0.045, -5.7, 0, 1, -Math.PI / 2, 0),
    xform(new THREE.PlaneGeometry(120, 0.18), 0, 0.045, 5.7, 0, 1, -Math.PI / 2, 0),
  ];
  g.add(mergedMesh(edgeGeos, yellowMat));
  // Zebra crosswalks at every cross street + stop lines. Stripes are
  // narrow with real gaps so they read as a crossing, not a white slab.
  const zebraGeos = [];
  const stopGeos = [];
  for (const cx of CROSS_X) {
    for (let dz = -4.4; dz <= 4.4; dz += 1.3) {
      zebraGeos.push(xform(new THREE.PlaneGeometry(5.2, 0.4), cx, 0.045, dz, 0, 1, -Math.PI / 2, 0));
    }
    stopGeos.push(xform(new THREE.PlaneGeometry(3.2, 0.35), cx - 5.4, 0.045, -3.4, 0, 1, -Math.PI / 2, 0));
    stopGeos.push(xform(new THREE.PlaneGeometry(3.2, 0.35), cx + 5.4, 0.045, 3.4, 0, 1, -Math.PI / 2, 0));
  }
  g.add(mergedMesh(zebraGeos, whiteMat));
  g.add(mergedMesh(stopGeos, whiteMat));
  // Turn arrows on the boulevard (simple chevrons, merged).
  const arrowGeos = [];
  for (const ax of [-30, 10, 50]) {
    arrowGeos.push(xform(new THREE.PlaneGeometry(0.5, 1.6), ax - 0.5, 0.045, -3.4, 0.35, 1, -Math.PI / 2, 0));
    arrowGeos.push(xform(new THREE.PlaneGeometry(0.5, 1.6), ax + 0.5, 0.045, -3.4, -0.35, 1, -Math.PI / 2, 0));
  }
  g.add(mergedMesh(arrowGeos, whiteMat));
  // Painted parking bays on the marina stretch (west end, quay side).
  const bayGeos = [];
  for (let i = 0; i < 6; i++) {
    const x = -56 + i * 3.4;
    bayGeos.push(xform(new THREE.PlaneGeometry(0.14, 2.4), x, 0.045, 4.6, 0, 1, -Math.PI / 2, 0));
  }
  bayGeos.push(xform(new THREE.PlaneGeometry(20, 0.14), -46, 0.045, 5.8, 0, 1, -Math.PI / 2, 0));
  g.add(mergedMesh(bayGeos, whiteMat));

  // ---- street furniture (merged by material) ----
  // Lamp posts down the palm median (poles + globes, 2 draw calls).
  const lampXs = [];
  for (let x = -54; x <= 54; x += 12) lampXs.push(x);
  const poles = lampXs.map((x) => xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), x, 1.2, 0));
  const globes = lampXs.map((x) => xform(new THREE.SphereGeometry(0.16, 10, 8), x, 2.5, 0));
  g.add(mergedMesh(poles, M(0x2b2b2b)));
  const globeMat = M(0xffd9a0, { emissive: 0xffc46b, emissiveIntensity: 0.9 });
  g.add(mergedMesh(globes, globeMat));
  // Lamp cones (visible at night only): small, subtle glow cones, not
  // searchlights.
  const lampCones = [];
  for (const x of lampXs) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 2.2, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0, transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    cone.position.set(x, 1.1, 0);
    cone.visible = false;
    g.add(cone);
    lampCones.push(cone);
  }
  // Benches + bins on the north sidewalk (merged, 2 calls).
  const benchGeos = [];
  const binGeos = [];
  for (const bx of [-48, -28, -8, 12, 32, 52]) {
    benchGeos.push(xform(new THREE.BoxGeometry(1.8, 0.08, 0.5), bx, 0.55, -7.2));
    benchGeos.push(xform(new THREE.BoxGeometry(1.8, 0.5, 0.08), bx, 0.3, -7.45));
    benchGeos.push(xform(new THREE.BoxGeometry(0.08, 0.5, 0.45), bx - 0.8, 0.25, -7.2));
    benchGeos.push(xform(new THREE.BoxGeometry(0.08, 0.5, 0.45), bx + 0.8, 0.25, -7.2));
    binGeos.push(xform(new THREE.CylinderGeometry(0.28, 0.24, 0.7, 10), bx + 1.6, 0.35, -7.2));
  }
  g.add(mergedMesh(benchGeos, M(0x8a6a4a)));
  g.add(mergedMesh(binGeos, M(0x2e4a5e)));
  // Bollards along the quay edge (merged, painted teal).
  const bolGeos = [];
  for (let x = -58; x <= 58; x += 4) {
    bolGeos.push(xform(new THREE.CylinderGeometry(0.14, 0.16, 0.7, 8), x, 0.35, 12.6));
  }
  g.add(mergedMesh(bolGeos, M(0x1f7a8c)));
  // Fire hydrants (red, merged) on sidewalk corners.
  const hydGeos = [];
  for (const [hx, hz] of [[-38, -7.2], [2, -7.2], [42, -7.2], [-18, 7.2], [22, 7.2]]) {
    hydGeos.push(xform(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 8), hx, 0.3, hz));
    hydGeos.push(xform(new THREE.SphereGeometry(0.14, 8, 6), hx, 0.68, hz));
  }
  g.add(mergedMesh(hydGeos, M(0xc0392b)));
  // Manhole covers + drain grates on the road (flat, merged, 1 call each).
  const manGeos = [];
  const grateGeos = [];
  for (const mx of [-44, -4, 36]) {
    manGeos.push(xform(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 12), mx, 0.05, 0));
  }
  for (const [gx, gz] of [[-52, -5.6], [8, -5.6], [48, -5.6], [-32, 5.6], [28, 5.6]]) {
    grateGeos.push(xform(new THREE.BoxGeometry(0.9, 0.05, 0.4), gx, 0.05, gz));
  }
  g.add(mergedMesh(manGeos, M(0x3a3a3a)));
  g.add(mergedMesh(grateGeos, M(0x2b2b2b)));
  // Speed bumps (low, drive-over) on the boulevard.
  const bumpGeos = [
    xform(new THREE.BoxGeometry(11.6, 0.09, 0.7), -14, 0.06, -3.4),
    xform(new THREE.BoxGeometry(11.6, 0.09, 0.7), 26, 0.06, 3.4),
  ];
  g.add(mergedMesh(bumpGeos, M(0x6a655e)));
  // Street signs with fictional names at intersections (one plane each).
  const signNames = [
    ['VIA LUNGOMARE', -40, -7.6], ['VIA DEL FARO', -20, -7.6],
    ['VIA DEL PORTO', 0, -7.6], ['VIA SOLMAR', 20, -7.6], ['VIA AZZURA', 40, -7.6],
  ];
  for (const [name, sx, sz] of signNames) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), M(0x2b2b2b));
    pole.position.set(sx, 1.3, sz);
    g.add(pole);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: signTexture(name), transparent: false }),
    );
    panel.position.set(sx, 2.5, sz);
    panel.rotation.y = Math.PI / 4;
    g.add(panel);
  }

  // ---- storm: puddles (hidden until wet) ----
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x8fb8c8, roughness: 0.05, metalness: 0.6, flatShading: true,
  });
  const puddles = [];
  for (const [px, pz, pr] of [[-30, -3.4, 1.6], [6, 3.4, 1.9], [34, -3.4, 1.4], [-12, 3.4, 1.7], [48, 0, 1.5]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(pr, 14), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, 0.06, pz);
    p.visible = false;
    g.add(p);
    puddles.push(p);
  }

  // Wetness / night state.
  let wet = 0;
  function setWet(v) {
    wet = Math.max(0, Math.min(1, v));
    roadMat.roughness = 0.92 - wet * 0.65;
    roadMat.color.setHex(wet > 0.5 ? 0x6a655e : 0xffffff);
    for (const p of puddles) p.visible = wet > 0.5;
  }
  function setNight(on) {
    globeMat.emissiveIntensity = on ? 2.2 : 0.9;
    for (const c of lampCones) c.visible = on;
  }
  return { group: g, roadMat, setWet, setNight, lampCones, puddles };
}

// ---------- road showcase: one road, one district ----------
// Used by ?shot=road&district=X to verify a surface in isolation: a
// 44-long straight road with sidewalks, two flanking buildings in the
// district palette, and the district's furniture. Returns { group, label }.
export function buildRoadShowcase(district) {
  const g = new THREE.Group();
  g.name = 'roadShowcase-' + district;
  const spec = {
    oldtown: { surface: 'cobble', wall: 0xd9b98a, roof: 0xb4552d, accent: 0x4a6741, label: 'Fortress Old Town · cobblestones' },
    marina: { surface: 'asphalt', wall: 0xf2f0ea, roof: 0x1f7a8c, accent: 0xe4572e, label: 'Yacht Marina · asphalt + boardwalk' },
    quarry: { surface: 'concrete', wall: 0x9a9a94, roof: 0x8a4b2e, accent: 0xe8c33d, label: 'Quarry · concrete slabs' },
    promenade: { surface: 'asphalt', wall: 0xf3e6c8, roof: 0xe8a33d, accent: 0xff5c8a, label: 'Promenade · boulevard' },
    countryside: { surface: 'gravel', wall: 0xb7a88e, roof: 0xb4552d, accent: 0x7a8b5a, label: 'Countryside · gravel' },
    skyline: { surface: 'plaza', wall: 0x35566b, roof: 0xd8d2c4, accent: 0x3ed6d6, label: 'Downtown Skyline · plaza' },
  }[district] || { surface: 'asphalt', wall: 0xf3e6c8, roof: 0xe8a33d, accent: 0xff5c8a, label: 'Promenade · boulevard' };
  const tex = roadTexture(spec.surface, district.length * 7 + 3);
  tex.repeat.set(6, 1.4);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 8),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, flatShading: true }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 0);
  road.receiveShadow = true;
  g.add(road);
  // Ground plane so the frame below the road is earth, not empty sky.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 60),
    new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  g.add(ground);
  // Sidewalks (lighter, stepped up).
  const walkGeos = [
    xform(new THREE.BoxGeometry(44, 0.24, 2.2), 0, 0.12, -5.1),
    xform(new THREE.BoxGeometry(44, 0.24, 2.2), 0, 0.12, 5.1),
  ];
  g.add(mergedMesh(walkGeos, M(0xb0a89a)));
  // Markings: dashed centre + zebra at both ends.
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0.62 });
  const dashGeos = [];
  for (let x = -20; x <= 20; x += 4) {
    dashGeos.push(xform(new THREE.PlaneGeometry(1.8, 0.16), x, 0.045, 0, 0, 1, -Math.PI / 2, 0));
  }
  g.add(mergedMesh(dashGeos, whiteMat));
  const zebraGeos = [];
  for (const zx of [-16, 16]) {
    for (let dz = -3.2; dz <= 3.2; dz += 1.3) {
      zebraGeos.push(xform(new THREE.PlaneGeometry(2.2, 0.4), zx, 0.045, dz, 0, 1, -Math.PI / 2, 0));
    }
  }
  g.add(mergedMesh(zebraGeos, whiteMat));
  // Flanking buildings in the district palette: walls, roof, an accent
  // band, and a row of windows so they read as buildings, not blank boxes.
  const bGeos = [];
  const wGeos = [];
  for (const [bx, bz, bw, bh] of [[-12, -9, 9, 5], [10, -9, 11, 7], [-14, 9, 10, 6], [12, 9, 9, 4.5]]) {
    bGeos.push(colored(xform(new THREE.BoxGeometry(bw, bh, 6), bx, bh / 2, bz), spec.wall));
    bGeos.push(colored(xform(new THREE.BoxGeometry(bw + 0.3, 0.3, 6.3), bx, bh + 0.15, bz), spec.roof));
    // Accent band near the top, on the road-facing side, so it never
    // overlaps the window row.
    const bandZ = bz > 0 ? bz - 3.1 : bz + 3.1;
    bGeos.push(colored(xform(new THREE.BoxGeometry(bw * 0.7, 0.5, 0.4), bx, bh * 0.85, bandZ), spec.accent));
    // Windows on the road-facing side, mid-height.
    const faceZ = bz > 0 ? bz - 3.05 : bz + 3.05;
    for (let wx = bx - bw / 2 + 1.2; wx <= bx + bw / 2 - 1.2; wx += 2) {
      wGeos.push(colored(xform(new THREE.BoxGeometry(0.9, 1.1, 0.1), wx, bh * 0.45, faceZ), 0x2e3a4a));
    }
  }
  g.add(mergedMesh(bGeos, vertexColorMat));
  g.add(mergedMesh(wGeos, vertexColorMat));
  // Hazard stripes on the quarry showcase edges.
  if (district === 'quarry') {
    const hz = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 0.5),
      new THREE.MeshBasicMaterial({ map: hazardTexture() }),
    );
    hz.rotation.x = -Math.PI / 2;
    hz.position.set(0, 0.05, -4.1);
    g.add(hz);
  }
  // Marina: the ROAD is asphalt (spec) — the wooden boardwalk is only a
  // strip beside the water (south edge), with painted bollards, a rope
  // rail and cleats on it. The old version paved the whole road in planks.
  if (district === 'marina') {
    const bwTex = roadTexture('boardwalk', 11);
    bwTex.repeat.set(6, 0.6);
    const boardwalk = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 2.4),
      new THREE.MeshStandardMaterial({ map: bwTex, roughness: 0.85, flatShading: true }),
    );
    boardwalk.rotation.x = -Math.PI / 2;
    boardwalk.position.set(0, 0.08, 7.6);
    g.add(boardwalk);
    // Painted bollards (teal body + white cap) along the water edge.
    const bolGeos = [];
    const capGeos = [];
    for (let x = -20; x <= 20; x += 4) {
      bolGeos.push(xform(new THREE.CylinderGeometry(0.14, 0.16, 0.7, 8), x, 0.35, 8.6));
      capGeos.push(xform(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8), x, 0.73, 8.6));
    }
    g.add(mergedMesh(bolGeos, M(0x1f7a8c)));
    g.add(mergedMesh(capGeos, M(0xf2f0ea)));
    // Rope rail between the bollards + mooring cleats on the boardwalk.
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 42, 6),
      new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 1 }),
    );
    rope.rotation.z = Math.PI / 2;
    rope.position.set(0, 0.62, 8.6);
    g.add(rope);
    const cleatGeos = [];
    for (const x of [-18, -10, -2, 6, 14]) {
      cleatGeos.push(xform(new THREE.BoxGeometry(0.5, 0.12, 0.25), x, 0.16, 7.6));
    }
    g.add(mergedMesh(cleatGeos, M(0x3a3a3a)));
  }
  // A lamp row + one hydrant so the furniture reads in the shot.
  const lampXs = [-16, -4, 8, 18];
  const poles = lampXs.map((x) => xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), x, 1.2, -4.6));
  const globes = lampXs.map((x) => xform(new THREE.SphereGeometry(0.16, 10, 8), x, 2.5, -4.6));
  g.add(mergedMesh(poles, M(0x2b2b2b)));
  g.add(mergedMesh(globes, M(0xffd9a0, { emissive: 0xffc46b, emissiveIntensity: 0.9 })));
  return { group: g, label: spec.label };
}
