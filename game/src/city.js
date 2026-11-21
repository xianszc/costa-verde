// AZZURA HEIST — District 4 (Lungomare / Seaside Promenade) for M2.
// Roads FIRST (city-system.md): the boulevard + five cross streets are laid
// out before any building; every plot is validated against the road and
// sidewalk rects (validatePlots) and against every other plot. Trees live
// ONLY in the park green zone and in sidewalk planters — never on a road,
// never blocking an intersection. The bay + skyline sit across the water
// to the south; layered hills close the town to the north.
//
// M2 changes: palms are the fuller layered palms (vegetation.js) in the
// park and planters; facades are varied (balconies, rooftop props, shop
// fronts) so the marina and old-town shots read as a lived-in town; the
// old bell tower stands at (-47, -36) — the M4 drop point.
import * as THREE from '../vendor/three.module.min.js';
import {
  M, box, cyl, cone, sph, mergedMesh, mergeStatic, colored, xform,
  vertexColorMat, buildHeroBuilding, buildSkylineCluster, fountain,
  treeInstanced, TREE_TYPES, makeTree, lampPost,
} from './world.js';
import { makePalmFull } from './vegetation.js';
import { makeWater, makeSailboat } from './water.js';
import { ANCHORS } from './anchors.js';
import {
  buildRoadNetwork, validatePlots, trafficLanes, minimapLines,
  BOULEVARD, CROSS_X, seededRandom, boulevardMedianSegments,
} from './roads.js';
import { buildNewDistricts } from './districts.js';
import { buildCBD } from './cbd.js';
import { buildCBDGrid } from './cbd-grid.js';
import { buildCommercialRing, buildSignAtlas } from './commercial.js';
import { createPools, mergePools, buildZoneInto, RING_EXT_DEF, OLD_TOWN_EXT_DEF, PROMENADE_EXT_DEF, RESIDENTIAL_DEF } from './blocks.js';

// Shared window material for the deco facades: emissive intensity is
// raised at night by the game (windows light up at dusk).
export const windowMat = new THREE.MeshStandardMaterial({
  color: 0x2e4a5e, emissive: 0xffd9a0, emissiveIntensity: 0.15,
  roughness: 0.4, flatShading: true,
});
const neonMats = {};
function neonMat(color) {
  if (!neonMats[color]) {
    neonMats[color] = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.2, roughness: 0.4,
    });
  }
  return neonMats[color];
}
function brandTexture(text, bg = '#1e2a32', fg = '#ffd9a0') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg; ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One procedural Art Deco facade: stepped crown, arched windows, striped
// awning, a small neon brand sign. All windows share windowMat (one draw
// call for every window in the district after the merge). M2: taller
// facades get a balcony + rail, every roof carries props (AC box, water
// tank, chimney), and branded shops get a glass shop front.
function decoBuilding(rnd, w, h, d, palette, brand) {
  const g = new THREE.Group();
  g.add(box(w, h, d, palette.wall, 0, h / 2, 0));
  // Stepped crown.
  g.add(box(w * 0.8, 0.5, d * 0.8, palette.trim, 0, h + 0.25, 0));
  g.add(box(w * 0.55, 0.5, d * 0.55, palette.wall, 0, h + 0.75, 0));
  g.add(box(w * 0.3, 0.4, d * 0.3, palette.trim, 0, h + 1.2, 0));
  // Curved corner for some facades.
  if (rnd() > 0.5) {
    g.add(cyl(w * 0.18, w * 0.18, h, palette.wall, w / 2, h / 2, d / 2, 12));
  }
  // Window grid (front face, facing the boulevard / +z).
  const cols = Math.max(2, Math.floor(w / 1.6));
  const rows = Math.max(2, Math.floor(h / 1.8));
  const winGeos = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      winGeos.push(xform(
        new THREE.BoxGeometry(0.7, 1.0, 0.08),
        (c - (cols - 1) / 2) * (w / cols), 1.1 + r * (h - 2) / Math.max(1, rows - 1), d / 2 + 0.04,
      ));
    }
  }
  g.add(mergedMesh(winGeos, windowMat));
  // Door + striped awning.
  g.add(box(1.1, 1.9, 0.1, 0x2b2b2b, 0, 0.95, d / 2 + 0.04));
  for (let i = 0; i < 5; i++) {
    const aw = box(w * 0.16, 0.07, 0.9, i % 2 === 0 ? palette.accent : 0xf3e6c8, -w * 0.32 + i * w * 0.16, 2.35, d / 2 + 0.45);
    aw.rotation.x = 0.35;
    g.add(aw);
  }
  // Glass shop front flanking the door (branded shops only).
  if (brand) {
    g.add(box(1.6, 1.4, 0.08, 0x9fd4d8, -w * 0.28, 1.0, d / 2 + 0.05));
    g.add(box(1.6, 1.4, 0.08, 0x9fd4d8, w * 0.28, 1.0, d / 2 + 0.05));
  }
  // Balcony + rail on the top floor (taller facades).
  if (h >= 6.5) {
    g.add(box(w * 0.4, 0.15, 1.0, 0x8a6a4a, w * 0.18, h - 1.6, d / 2 + 0.5));
    g.add(box(w * 0.4, 0.6, 0.06, 0x1e2a32, w * 0.18, h - 1.25, d / 2 + 0.95));
    g.add(box(0.7, 1.6, 0.1, 0x2e4a5e, w * 0.18, h - 1.2, d / 2 + 0.04));
  }
  // Rooftop props: AC box, water tank, chimney.
  g.add(box(0.9, 0.7, 0.9, 0x9a9a9a, -w * 0.3, h + 1.75, 0));
  g.add(cyl(0.55, 0.55, 1.1, 0x6a4a2a, w * 0.28, h + 1.95, -0.4, 8));
  g.add(box(0.5, 1.1, 0.5, 0x8a4a3a, w * 0.1, h + 1.95, -d / 4));
  // Neon brand sign.
  if (brand) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.6, 0.12),
      new THREE.MeshStandardMaterial({
        map: brandTexture(brand), emissiveMap: brandTexture(brand),
        emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.4,
      }),
    );
    sign.position.set(0, h - 0.4, d / 2 + 0.08);
    g.add(sign);
  }
  return g;
}

// The old bell tower (M4 drop point): stone base, arched belfry with a
// bronze bell, clock face, pyramidal roof. Stands at (-47, -36), clear of
// the x=-40 cross street.
function bellTower() {
  const g = new THREE.Group();
  g.add(box(2.4, 9, 2.4, 0xd8cbb2, 0, 4.5, 0));
  g.add(box(2.8, 0.5, 2.8, 0x8a6a4a, 0, 9.2, 0));
  // Belfry: four columns + dark inset + bronze bell.
  for (const [cx, cz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    g.add(box(0.35, 2.0, 0.35, 0xd8cbb2, cx, 10.4, cz));
  }
  g.add(box(1.6, 1.8, 1.6, 0x2b2b2b, 0, 10.4, 0));
  const bell = sph(0.55, 0xb08a3a, 0, 10.1, 0);
  bell.scale.y = 1.2;
  g.add(bell);
  // Clock face (south side, toward the boulevard).
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshStandardMaterial({ color: 0xf7ebd7, roughness: 0.5 }),
  );
  face.position.set(0, 7.6, 1.22);
  g.add(face);
  const hand = box(0.08, 0.5, 0.02, 0x1e2a32, 0, 7.7, 1.24);
  hand.rotation.z = -0.6;
  g.add(hand);
  // Pyramidal roof.
  g.add(cone(1.9, 1.8, 0xb4552d, 0, 12.3, 0, 4));
  return g;
}

// Layered hills closing the town to the north: three hazy ridges + a few
// cypress silhouettes and villa dots on the near ridge. M3: the ridges
// sit BEHIND the old-town fortress wall (z -90 and beyond) so the old
// town quarter (z -44..-86) is clear ground, not inside a hill.
function buildHills() {
  const g = new THREE.Group();
  g.name = 'hills';
  // 2b draw-call cut: ridges + villas are vertex-colored now, so
  // mergeStatic folds the whole ridge line (7 ridges, 22 cypress,
  // 8 villas) into ONE mesh (was 8, one per material). The cypress
  // keep their y — they sit on the ridge slope, not at ground level.
  // The seeded rnd() order is unchanged, so the layout is identical.
  const parts = [];
  const ridge = (color, x, y, z, sx, sy, sz) => {
    const geo = new THREE.SphereGeometry(1, 24, 12);
    geo.scale(sx, sy, sz);
    geo.translate(x, y, z);
    parts.push(colored(geo, color));
  };
  ridge(0x8fa05e, -40, -2, -128, 70, 22, 18);
  ridge(0x7f9052, 30, -3, -120, 80, 26, 20);
  ridge(0x6f8048, -70, -1, -112, 50, 16, 14);
  ridge(0x5f703e, 10, -2, -102, 55, 14, 12);
  ridge(0x4f6034, -25, -1, -98, 45, 9, 8);
  // Side ridges so the horizon is not flat on the east / west (A).
  ridge(0x7f9052, -118, -2, -108, 45, 18, 16);
  ridge(0x7f9052, 118, -2, -108, 45, 18, 16);
  // Cypress silhouettes + villa dots on the near ridge, behind the wall.
  const rnd = seededRandom(99);
  for (let i = 0; i < 22; i++) {
    const x = -55 + rnd() * 110;
    const t = makeTree('cypress', 1.6 + rnd() * 1.2);
    t.position.set(x, 4 + rnd() * 2, -90 - rnd() * 6);
    g.add(t);
  }
  for (let i = 0; i < 8; i++) {
    const x = -48 + i * 19 + rnd() * 4;
    const y = 4 + rnd() * 2;
    const z = -92 - rnd() * 4;
    parts.push(colored(xform(new THREE.BoxGeometry(3, 2, 2.5), x, y + 1, z), 0xf5efe2));
    parts.push(colored(xform(new THREE.BoxGeometry(3.3, 0.3, 2.8), x, y + 2.1, z), 0xb4552d));
  }
  g.add(mergedMesh(parts, vertexColorMat));
  return mergeStatic(g);
}

// ---------- Mediterranean ground + terrain dressing (A, Xian 21 Nov 16:48) ----------
// The flat tan ground plane read as an empty orange dune in the oblique /
// bay shots. A canvas texture mottles it into olive-green grass + ochre
// dry grass + dirt patches, and the dressing scatters stone pines, olive
// rows, cypress and rocks on the land OUTSIDE the city footprint
// (x -72..72, z -68..35) plus terraced retaining walls behind the city,
// in front of the hills.
function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const rnd = seededRandom(20261121);
  ctx.fillStyle = '#8a9a5a'; ctx.fillRect(0, 0, 512, 512);
  const blob = (color, n, rMin, rMax) => {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = rnd() * 512, y = rnd() * 512, r = rMin + rnd() * (rMax - rMin);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  blob('#a89a5e', 60, 12, 42); // ochre dry grass
  blob('#7a8a4e', 50, 10, 36); // deeper green
  blob('#6a7a44', 30, 8, 26);  // dark green
  blob('#9a7a4a', 26, 8, 24);  // dirt patches
  blob('#b8a86a', 24, 6, 18);  // pale dry grass
  // Fine speckle so the ground is not flat at street level.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(60,70,35,0.16)' : 'rgba(240,230,190,0.14)';
    ctx.fillRect(rnd() * 512, rnd() * 512, 1.6, 1.6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 5);
  return tex;
}

function buildTerrainDressing() {
  const g = new THREE.Group();
  g.name = 'terrain-dressing';
  const colliders = [];
  const rnd = seededRandom(20261121);
  // NOTE (2a, 21 Nov): the terrace retaining walls (z -72/-78/-84) +
  // olive rows + hills-apron trees that stood in the north strip are
  // REMOVED — the north-ext commercial zone now fills z -88..-68.
  // They return with the hills zone (2d), when the near hills ridges
  // move north and the terraces are rebuilt at the hills front.
  // Trees + rocks — ground apron ONLY (x +/-120..128), outside the
  // city footprint: the outer commercial columns take x 74..96 and
  // the future residential ring takes the rest of x +/-76..120.
  const pines = [], olives = [], cypress = [];
  const push = (arr, x, z, sMin, sMax) => arr.push({
    x, z, s: sMin + rnd() * (sMax - sMin), rot: rnd() * Math.PI * 2, tint: 0xffffff,
  });
  // Ground-apron strips: mixed pines, olives, cypress.
  for (let i = 0; i < 40; i++) {
    const side = rnd() > 0.5 ? 1 : -1;
    const x = side * (120 + rnd() * 8);
    const z = -64 + rnd() * 92;
    const r = rnd();
    if (r < 0.45) push(pines, x, z, 1.0, 1.6);
    else if (r < 0.8) push(olives, x, z, 0.9, 1.4);
    else push(cypress, x, z, 1.0, 1.5);
  }
  // Olive tint: silver-green (multiplies the round tree's greens).
  for (const o of olives) o.tint = 0xa8b078;
  g.add(treeInstanced('pine', pines));
  g.add(treeInstanced('round', olives));
  g.add(treeInstanced('cypress', cypress));
  // Rocks: flattened grey-tan boulders, merged into one mesh.
  const rockGeos = [];
  for (let i = 0; i < 10; i++) {
    const side = rnd() > 0.5 ? 1 : -1;
    const x = side * (120 + rnd() * 7);
    const z = -64 + rnd() * 92;
    const s = 0.5 + rnd() * 1.1;
    rockGeos.push(colored(
      xform(new THREE.DodecahedronGeometry(s, 0), x, s * 0.35, z, rnd() * Math.PI, rnd() * Math.PI, 0),
      0x9a8a72));
  }
  g.add(mergedMesh(rockGeos, vertexColorMat));
  return { group: g, colliders };
}

// Plot list for District 4 (validated before building). STAGE 1: the
// casino + the front-row decos + the back-row villas are GONE (the
// commercial ring occupies their blocks now — the villas' blocks are
// ring blocks, the TERRAZZA HOTEL's block is the harbormaster
// pavilion's block). GRID REBUILD: the park is gone too (its plot is
// inside the new CBD; the CBD's own park block replaces it). Only the
// pavilion (mission-critical: M1/M2/M4/M8/M12 stage there) and the
// bell tower are still built from this list.
const PLOTS = [
  // STAGE 1 part 5: the harbormaster pavilion moves to the marina
  // strip (v3 plan) — the east end of the marina, on the promenade
  // walkway, where M1/M2/M4/M8/M12 stage. Its old block (x 45..56,
  // z -28..-10) is a commercial-ring block now.
  { id: 'pavilion-quay', x0: -1, z0: 22, x1: 8, z1: 30 },
  { id: 'bell-tower', x0: -48.4, z0: -37.4, x1: -45.6, z1: -34.6 },
];

export function buildDistrict4() {
  const rnd = seededRandom(20261120);
  const group = new THREE.Group();
  group.name = 'district4';
  const colliders = [];
  const tickers = [];

  // --- ground base (Mediterranean grass / dry grass / dirt, A) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 200),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -20);
  ground.receiveShadow = true;
  group.add(ground);

  // --- validation report (city-system.md §6) ---
  const violations = validatePlots(PLOTS);
  const report = { plots: PLOTS.length, violations, treesInGreenZones: 0, treesOnRoads: 0 };
  if (violations.length) console.warn('[city] plot violations:', violations);

  // --- roads (the network module) ---
  const roads = buildRoadNetwork();
  group.add(roads.group);
  // The connector signal ticker (working cycles) is stepped with the
  // district tickers, next to the grid's own signal ticker.
  if (roads.tickers) tickers.push(...roads.tickers);
  // Boulevard median colliders (the divided avenue): cars and
  // pedestrians cross only at the intersections, where the median has
  // gaps. Without these the median is a visual the car drives through.
  for (const seg of boulevardMedianSegments()) {
    colliders.push({ x0: seg.x0, z0: seg.z0, x1: seg.x1, z1: seg.z1, id: 'boulevard-median' });
  }

  // --- buildings (merged into a few draw calls) ---
  const buildings = new THREE.Group();
  const addPlot = (plot, builder) => {
    const b = builder();
    const cx = (plot.x0 + plot.x1) / 2;
    const cz = (plot.z0 + plot.z1) / 2;
    b.position.set(cx, 0, cz);
    buildings.add(b);
    colliders.push({ x0: plot.x0, z0: plot.z0, x1: plot.x1, z1: plot.z1, id: plot.id });
  };
  // Casino hero (world.js promenade builder, faces the boulevard).
  // STAGE 1: the casino moves to the promenade (part 4) — the old plot
  // (x -14..-6, z -28..-10) is inside the new CBD footprint, so the
  // hero is NOT built here any more. (M6 stages from the new casino
  // anchor once the anchors are re-linked at the end of stage 1.)
  // STAGE 1 part 3: the front-row decos + the back-row villas are GONE
  // — the commercial ring occupies their blocks now (the TERRAZZA
  // HOTEL's block is the harbormaster pavilion's block, the villas'
  // blocks are ring blocks). The ring has its own hotels.
  // Quay pavilion (marina hero) at the marina's east end, on the
  // promenade walkway (STAGE 1 part 5 — moved from the ring's east strip).
  addPlot(PLOTS[0], () => buildHeroBuilding('marina'));
  // Old bell tower (M4 drop point).
  addPlot(PLOTS[1], () => bellTower());
  group.add(mergeStatic(buildings));
  // Animated bits the merge kept whole (the casino fountain) still tick.
  buildings.traverse((o) => { if (o.userData && o.userData.tick) tickers.push(o); });

  // --- park green zone: DELETED in the GRID REBUILD (Xian 21 Nov
  // 15:22) — the old park plot (x 27.7..35.8, z -38..-30) is inside the
  // new CBD (blocks col 5, rows 0-1). The CBD has its own green block
  // (park, col 0 row 0) with lawn + trees + paths, built by buildCBD().

  // --- café tables: STAGE 1 — removed with the casino (they stood at
  // x -16..-10, z -8.2, inside the new CBD footprint; the casino moves
  // to the promenade in part 4, the tables come back with it) ---

  // --- cover props (M3 leftover 3): solid barriers, crates, low walls
  // and planters at the shoot-out spots, wired into the cover system via
  // colliders. Every prop is built from varied parts (hazard stripes,
  // cap stones, frame edges, shrubs) — never a plain tan box. Placed
  // off the pedestrian paths (quay + facade line) so peds never clip.
  const cover = new THREE.Group();
  function barrier(x, z, ry = 0) {
    const b = new THREE.Group();
    b.add(box(2.2, 0.85, 0.55, 0xd8d2c4, 0, 0.43, 0));
    b.add(box(2.24, 0.18, 0.57, 0xe8c33d, 0, 0.78, 0));
    b.add(box(0.18, 0.85, 0.57, 0xc0392b, -1.05, 0.43, 0));
    b.add(box(0.18, 0.85, 0.57, 0xc0392b, 1.05, 0.43, 0));
    b.add(box(2.0, 0.1, 0.4, 0x8a8a84, 0, 0.05, 0));
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    cover.add(b);
    colliders.push({ x0: x - 1.1, z0: z - 0.3, x1: x + 1.1, z1: z + 0.3, id: 'cover-barrier' });
  }
  function crateStack(x, z, ry = 0) {
    const c = new THREE.Group();
    c.add(box(1.1, 1.1, 1.1, 0x8a6a4a, 0, 0.55, 0));
    c.add(box(1.14, 0.12, 1.14, 0x6b4a2a, 0, 1.06, 0));
    c.add(box(1.14, 0.12, 1.14, 0x6b4a2a, 0, 0.08, 0));
    for (const [ex, ez] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      c.add(box(0.1, 1.1, 0.1, 0x5a3d22, ex, 0.55, ez));
    }
    const top = new THREE.Group();
    top.add(box(0.9, 0.9, 0.9, 0x7a5a34, 0, 0.45, 0));
    top.add(box(0.94, 0.1, 0.94, 0x5a3d22, 0, 0.86, 0));
    top.position.set(0.1, 1.1, -0.05);
    top.rotation.y = 0.4;
    c.add(top);
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    cover.add(c);
    colliders.push({ x0: x - 0.6, z0: z - 0.6, x1: x + 0.6, z1: z + 0.6, id: 'cover-crates' });
  }
  function lowWall(x, z, ry = 0) {
    const w = new THREE.Group();
    w.add(box(2.4, 0.8, 0.5, 0xd9b98a, 0, 0.4, 0));
    w.add(box(2.6, 0.14, 0.62, 0xefe3c8, 0, 0.87, 0));
    w.add(box(2.4, 0.18, 0.52, 0x8a6a4a, 0, 0.09, 0));
    w.add(box(0.3, 0.5, 0.54, 0xb4552d, -0.9, 0.55, 0));
    w.add(box(0.3, 0.5, 0.54, 0xb4552d, 0.9, 0.55, 0));
    w.position.set(x, 0, z);
    w.rotation.y = ry;
    cover.add(w);
    colliders.push({ x0: x - 1.3, z0: z - 0.31, x1: x + 1.3, z1: z + 0.31, id: 'cover-wall' });
  }
  function planter(x, z, ry = 0) {
    const p = new THREE.Group();
    p.add(box(1.5, 0.55, 0.6, 0xb4552d, 0, 0.28, 0));
    p.add(box(1.56, 0.1, 0.66, 0x8a4a3a, 0, 0.6, 0));
    p.add(box(1.4, 0.08, 0.5, 0x3a2a1a, 0, 0.56, 0));
    for (const [sx, s, c] of [[-0.45, 0.32, 0x3f7a4e], [0, 0.4, 0x4d8a5c], [0.45, 0.3, 0x356b42]]) {
      const s1 = sph(s, c, sx, 0.75, 0);
      s1.scale.y = 0.8;
      p.add(s1);
    }
    p.add(sph(0.12, 0xff5c8a, -0.3, 0.95, 0.1));
    p.add(sph(0.12, 0xff5c8a, 0.35, 0.9, -0.08));
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    cover.add(p);
    colliders.push({ x0: x - 0.75, z0: z - 0.3, x1: x + 0.75, z1: z + 0.3, id: 'cover-planter' });
  }
  // Quay west — the combat staging spot (Elio crouches at -53.5, 13.5
  // on the quay; the old z 11.5 spot is the CBD's south street now).
  barrier(-52.5, 13.5);
  crateStack(-50.5, 13.5, 0.3);
  lowWall(-55.5, 13.5);
  // Quay east + mid-east by the crane.
  barrier(50, 13.5);
  crateStack(53.5, 13.5, -0.2);
  lowWall(33, 13.5);
  // Facade line: STAGE 1 — removed (the old facade line at z -9.6 is
  // inside the new CBD footprint; the towers stand there now). The quay
  // cover props stay.
  group.add(mergeStatic(cover));

  // --- quay details: crates, rope coils, cleats, moored boats, crane ---
  // GRID REBUILD: everything on the quay sits at z 13.5 (the quay strip
  // is z 12.7..14.5 now); the old z 11.5 spots are the CBD's south
  // street (z 10.1..12.3) and would block traffic.
  const quayProps = new THREE.Group();
  for (const [qx, qz, c] of [[-52, 13.5, 0x8a6a4a], [-50.5, 13.5, 0x2e7f8f], [52, 13.5, 0x8a6a4a], [18, 13.5, 0xe4572e]]) {
    quayProps.add(box(1.1, 1.1, 1.1, c, qx, 0.85, qz));
    colliders.push({ x0: qx - 0.6, z0: qz - 0.6, x1: qx + 0.6, z1: qz + 0.6, id: 'crate' });
  }
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.09, 8, 16),
    M(0xc9a86a),
  );
  rope.rotation.x = -Math.PI / 2;
  rope.position.set(-46, 0.35, 13.5);
  quayProps.add(rope);
  // Small wooden harbor crane + barrels + fishing nets on the quay.
  quayProps.add(box(0.5, 5.5, 0.5, 0x6a4a2a, 36, 2.75, 13.5));
  quayProps.add(box(0.4, 0.4, 4.5, 0x6a4a2a, 36, 5.4, 13.5));
  quayProps.add(box(0.35, 1.6, 0.35, 0x2b2b2b, 36, 4.6, 13.4));
  quayProps.add(cyl(0.5, 0.5, 1.0, 0x8a6a4a, 38.5, 0.8, 13.5, 10));
  quayProps.add(cyl(0.5, 0.5, 1.0, 0x2e7f8f, 39.6, 0.8, 13.5, 10));
  quayProps.add(box(2.2, 0.15, 1.4, 0x3a5a3a, -30, 0.4, 13.5));
  colliders.push({ x0: 35.7, z0: 13.2, x1: 36.3, z1: 13.8, id: 'crane' });
  group.add(mergeStatic(quayProps));

  // --- bay water + moored boats + skyline across the bay ---
  // Water sits at y 0.3 so its wave troughs never dip under the ground
  // plane (that read as brown patches through the bay).
  // STAGE 1 part 5: the water's edge moves north to z 35 — the
  // promenade + marina fill z 14..35 now, so the bay starts beyond the
  // quay. The plane (260x90) is centred at z 80, spanning z 35..125,
  // and the shoreZ shader uniform moves with it.
  const water = makeWater(260, 90, 35, 96, 48);
  water.position.set(0, 0.3, 80);
  water.userData.noMerge = true;
  group.add(water);
  tickers.push(water);
  // STAGE 1 part 5: the moored boats move into the new bay (z > 35) —
  // their old spots (z 22..32) are the promenade + marina now.
  const boats = [
    { x: -34, z: 48, s: 1.5, sail: 0xf2f0ea, rot: 0.5, phase: 0 },
    { x: -6, z: 55, s: 1.3, sail: 0xff5c8a, rot: 0.8, phase: 1.3 },
    { x: 20, z: 48, s: 1.4, sail: 0x3ed6d6, rot: 0.4, phase: 2.1 },
    { x: 44, z: 58, s: 1.2, sail: 0xf2f0ea, rot: 0.9, phase: 3.4 },
  ];
  for (const b of boats) {
    const boat = makeSailboat(b.s, b.sail, b.phase);
    boat.position.set(b.x, 0.3, b.z);
    boat.rotation.y = b.rot;
    boat.userData.noMerge = true;
    group.add(boat);
    tickers.push(boat);
  }
  // --- bay water + moored boats (the skyline across the bay is the
  // REAL District 9 now — the LOD cluster + podium were removed in M3
  // (c); the full tower cluster stands on the skyline landmass) ---

  // --- hills to the north (moved behind the old-town wall, z -90+) ---
  group.add(buildHills());

  // --- terrain dressing (A): terraces + trees + rocks outside the city ---
  const dressing = buildTerrainDressing();
  group.add(dressing.group);
  colliders.push(...dressing.colliders);

  // --- M3 districts (old town now; promenade east + skyline land next) ---
  const nd = buildNewDistricts();
  group.add(nd.group);
  colliders.push(...nd.colliders);
  tickers.push(...nd.tickers);

  // --- STAGE 1: CBD core (GRID REBUILD, Xian 21 Nov 15:22) ---
  // The road grid (avenues + streets, markings, lamps, signals) is
  // built first — the towers stand on its blocks — then the towers.
  const grid = buildCBDGrid({ roadMat: roads.roadMat });
  group.add(grid.group);
  tickers.push(...grid.tickers);
  const cbd = buildCBD();
  group.add(cbd.group);
  colliders.push(...cbd.colliders);
  tickers.push(...cbd.tickers);

  // --- STAGE 1 part 3: commercial ring around the CBD ---
  // Mid-rise 6–15 floors, shop fronts at street level, hotels, a
  // market hall and a parking garage; 20 blocks, ~140 buildings.
  const ring = buildCommercialRing();
  group.add(ring.group);
  colliders.push(...ring.colliders);
  tickers.push(...ring.tickers);

  // --- NEW PLAN 2a (Xian 21 Nov 17:58): commercial ring extension ---
  // Generic block generator (blocks.js): north third row x2 (z -88..-68),
  // east/west outer columns x +/-84 (x 74..96), 42 blocks, 2 park blocks.
  // One shared sign atlas for all zones built by the generator.
  const zonePools = createPools();
  const zoneAtlas = buildSignAtlas();
  const ringExt = buildZoneInto(RING_EXT_DEF, zonePools, zoneAtlas);
  // --- NEW PLAN 2b: promenade extension + old town west (same pools) ---
  const promExt = buildZoneInto(PROMENADE_EXT_DEF, zonePools, zoneAtlas);
  const otExt = buildZoneInto(OLD_TOWN_EXT_DEF, zonePools, zoneAtlas);
  // --- NEW PLAN 2c: residential ring, east + west (same pools) ---
  // North residential deferred to 2d (the ridges sit on that land).
  const res = buildZoneInto(RESIDENTIAL_DEF, zonePools, zoneAtlas);
  const ringExtGroup = mergePools(zonePools, zoneAtlas, roads.roadMat);
  group.add(ringExtGroup);
  colliders.push(...ringExt.colliders, ...promExt.colliders, ...otExt.colliders, ...res.colliders);
  tickers.push(...ringExt.tickers, ...promExt.tickers, ...otExt.tickers, ...res.tickers);

  // --- ground detail: DELETED in the GRID REBUILD — the grass tufts
  // stood at z 9.5..11.5, which is CBD block row 4 + the south street
  // now (the quay is paved). The title screen reads from the CBD, the
  // ring and the water instead.

  return {
    group, colliders, tickers, roads,
    report,
    lanes: [...trafficLanes(), ...nd.lanes, ...ring.lanes, ...ringExt.lanes, ...promExt.lanes, ...otExt.lanes, ...res.lanes],
    pedPaths: [...nd.pedPaths, ...ring.pedPaths, ...ringExt.pedPaths, ...promExt.pedPaths, ...otExt.pedPaths, ...res.pedPaths],
    minimap: [...minimapLines(), ...ringExt.minimap, ...promExt.minimap, ...otExt.minimap, ...res.minimap],
    ringExt, promExt, otExt, res,
    // Spawn points live in anchors.js (one source of truth for every
    // gameplay position) — the district just carries them through.
    spawnPlayer: { x: ANCHORS.player_spawn.x, z: ANCHORS.player_spawn.z, angle: ANCHORS.player_spawn.angle },
    spawnCar: { x: ANCHORS.car_spawn.x, z: ANCHORS.car_spawn.z, angle: ANCHORS.car_spawn.angle },
    setNight(on) {
      windowMat.emissiveIntensity = on ? 1.4 : 0.15;
      for (const k in neonMats) neonMats[k].emissiveIntensity = on ? 2.4 : 1.2;
      roads.setNight(on);
      grid.setNight(on);
    },
    setWet(v) { roads.setWet(v); },
  };
}
