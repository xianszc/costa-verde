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
  splitSegmentsAtJunctions,
  BOULEVARD, CROSS_X, seededRandom,
} from './roads.js';
import { buildNewDistricts } from './districts.js';
import { buildCBD } from './cbd.js';
import { buildCBDGrid } from './cbd-grid.js';
import { buildCommercialRing, buildSignAtlas } from './commercial.js';
import { createPools, mergePools, buildZoneInto, RING_EXT_DEF, OLD_TOWN_EXT_DEF, PROMENADE_EXT_DEF, RESIDENTIAL_DEF, OUTER_DEF } from './blocks.js';

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
  // 2d: the ridges moved NORTH (~12-16) so the north residential ring
  // (z -105..-90) sits on clear ground, not on the hillside. Every
  // ridge's south edge is now at z <= -106. The far ridge is untouched
  // (its south edge was already -110).
  ridge(0x8fa05e, -40, -2, -128, 70, 22, 18);
  ridge(0x7f9052, 30, -3, -132, 80, 26, 20);
  ridge(0x6f8048, -70, -1, -124, 50, 16, 14);
  ridge(0x5f703e, 10, -2, -120, 55, 14, 12);
  ridge(0x4f6034, -25, -1, -116, 45, 9, 8);
  // Side ridges so the horizon is not flat on the east / west (A).
  ridge(0x7f9052, -118, -2, -124, 45, 18, 16);
  ridge(0x7f9052, 118, -2, -124, 45, 18, 16);
  // Cypress silhouettes + villa dots on the near ridge, behind the wall.
  // 2d: moved north with the near ridge (z -106..-112, was -90..-96).
  const rnd = seededRandom(99);
  for (let i = 0; i < 22; i++) {
    const x = -55 + rnd() * 110;
    const t = makeTree('cypress', 1.6 + rnd() * 1.2);
    t.position.set(x, 4 + rnd() * 2, -106 - rnd() * 6);
    g.add(t);
  }
  for (let i = 0; i < 8; i++) {
    const x = -48 + i * 19 + rnd() * 4;
    const y = 4 + rnd() * 2;
    const z = -108 - rnd() * 4;
    parts.push(colored(xform(new THREE.BoxGeometry(3, 2, 2.5), x, y + 1, z), 0xf5efe2));
    parts.push(colored(xform(new THREE.BoxGeometry(3.3, 0.3, 2.8), x, y + 2.1, z), 0xb4552d));
  }
  g.add(mergedMesh(parts, vertexColorMat));
  return mergeStatic(g);
}

// ---------- Hills terraces + cliff villas + funicular (2d, Xian 21 Nov 17:58) ----------
// Four stepped terrace platforms climbing the ridge front (z -106..-130),
// each a solid stone fill with a flat top, split into west/east segments
// around a 4-wide funicular slot at x -2..2. Villas (2-3 floors, warm
// walls + terracotta roofs) stand on each terrace's exposed strip —
// 120 in total, all merged into ONE vertex-colored mesh (1 draw call).
// The funicular climbs the slot on a straight incline from the north
// residential (z -105, y 0) to the hilltop (z -130, y 8); its car is a
// ticker. A hilltop chapel + viewpoint crowns T4. The terraces return
// the retaining walls + olive rows removed in 2a (they stood in the
// north-ext footprint); the olive rows are replanted along T1/T2 here.
function buildHillsTerraces() {
  const g = new THREE.Group();
  g.name = 'hills-terraces';
  const parts = [];
  const rnd = seededRandom(20261121);
  const WALL_COLORS = [0xf5efe2, 0xe8dcc0, 0xdfc9a8, 0xf0e0c8];
  const ROOF_COLORS = [0xb4552d, 0x9a4a28, 0xc06a3a, 0x8a3f22];
  // Terrace levels: [topY, zSouth, zNorth]. Each platform is a solid
  // fill from y 0 to topY, so it reads as a built terrace (retaining
  // wall on the south face, flat top), not a floating slab.
  const LEVELS = [
    { y: 2, z0: -106, z1: -118 },
    { y: 4, z0: -112, z1: -124 },
    { y: 6, z0: -118, z1: -130 },
    { y: 8, z0: -124, z1: -136 },
  ];
  for (const L of LEVELS) {
    const depth = L.z1 - L.z0;
    const cz = (L.z0 + L.z1) / 2;
    // Platform fill (stone), west + east of the funicular slot.
    for (const [x0, x1] of [[-80, -2], [2, 80]]) {
      const w = x1 - x0;
      const cx = (x0 + x1) / 2;
      parts.push(colored(xform(new THREE.BoxGeometry(w, L.y, depth), cx, L.y / 2, cz), 0x9a8a72));
      // Flat top (dry grass / earth) so the villas sit on soil, not stone.
      parts.push(colored(xform(new THREE.BoxGeometry(w, 0.15, depth), cx, L.y + 0.07, cz), 0x8fa05e));
    }
    // Retaining wall face (lighter stone) on the south edge, west + east.
    for (const [x0, x1] of [[-80, -2], [2, 80]]) {
      const w = x1 - x0;
      const cx = (x0 + x1) / 2;
      parts.push(colored(xform(new THREE.BoxGeometry(w, L.y, 0.4), cx, L.y / 2, L.z0 + 0.2), 0xcbb894));
    }
  }
  // Villas on each terrace's exposed strip (south of the next level's
  // south edge), ~30 per terrace. A villa: walls + terracotta roof.
  let villaCount = 0;
  for (let li = 0; li < LEVELS.length; li++) {
    const L = LEVELS[li];
    const nextZ0 = li + 1 < LEVELS.length ? LEVELS[li + 1].z0 : L.z1;
    const stripZ0 = L.z0 + 1;
    const stripZ1 = nextZ0 - 1;
    const stripCz = (stripZ0 + stripZ1) / 2;
    for (let x = -78; x <= 78; x += 5.0) {
      if (x > -6 && x < 6) continue; // funicular slot
      const jx = x + (rnd() - 0.5) * 1.6;
      const jz = stripCz + (rnd() - 0.5) * 1.2;
      const w = 2.6 + rnd() * 0.8;
      const d = 2.6 + rnd() * 0.8;
      const h = 2.2 + rnd() * 1.4; // 2-3 floors
      const wall = WALL_COLORS[Math.floor(rnd() * WALL_COLORS.length)];
      const roof = ROOF_COLORS[Math.floor(rnd() * ROOF_COLORS.length)];
      parts.push(colored(xform(new THREE.BoxGeometry(w, h, d), jx, L.y + h / 2, jz), wall));
      parts.push(colored(xform(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4), jx, L.y + h + 0.17, jz), roof));
      villaCount++;
    }
  }
  // Olive rows along T1/T2 (the 2a removal, replanted at the hills front).
  const olives = [];
  for (let i = 0; i < 24; i++) {
    const x = -78 + rnd() * 156;
    if (x > -6 && x < 6) continue;
    olives.push({ x, z: -108 - rnd() * 8, s: 0.9 + rnd() * 0.5, rot: rnd() * Math.PI * 2, tint: 0xa8b078 });
  }
  g.add(mergedMesh(parts, vertexColorMat));
  g.add(treeInstanced('round', olives));
  // Hilltop chapel + viewpoint on T4 (landmark): white chapel, bell
  // tower, and a stone viewpoint platform with a low parapet.
  const chapel = [];
  chapel.push(colored(xform(new THREE.BoxGeometry(5, 3.5, 4), -14, 8 + 1.75, -132), 0xf5efe2));
  chapel.push(colored(xform(new THREE.BoxGeometry(5.6, 0.4, 4.6), -14, 8 + 3.7, -132), 0xb4552d));
  chapel.push(colored(xform(new THREE.BoxGeometry(1.4, 6, 1.4), -10.5, 8 + 3, -132), 0xf5efe2));
  chapel.push(colored(xform(new THREE.ConeGeometry(1.2, 1.6, 4), -10.5, 8 + 6.8, -132), 0x8a3f22));
  chapel.push(colored(xform(new THREE.BoxGeometry(8, 0.4, 6), 8, 8 + 0.2, -131), 0xcbb894));
  chapel.push(colored(xform(new THREE.BoxGeometry(8, 0.8, 0.4), 8, 8 + 0.4, -128.2), 0x9a8a72));
  g.add(mergedMesh(chapel, vertexColorMat));
  // Funicular: straight incline in the slot, from the north residential
  // (0, 0, -105) to the hilltop (0, 8, -130). Two rails + trestle posts
  // + a car that shuttles (ticker). Stations are small shelters.
  const fun = new THREE.Group();
  fun.name = 'funicular';
  const run = Math.hypot(25, 8); // dz 25, dy 8
  const ang = Math.atan2(8, 25);
  const railGeos = [];
  for (const s of [-0.7, 0.7]) {
    const rail = new THREE.BoxGeometry(0.12, 0.12, run);
    rail.rotateX(-ang);
    rail.translate(s, 4.2, -117.5);
    railGeos.push(colored(rail, 0x3a3a3a));
  }
  // Trestle posts under the track every ~5 units.
  for (let t = 0; t <= 5; t++) {
    const z = -105 - t * 5;
    const y = (t * 5 / 25) * 8;
    railGeos.push(colored(xform(new THREE.BoxGeometry(0.25, y + 0.4, 0.25), 0, (y + 0.4) / 2, z), 0x6a5a42));
  }
  fun.add(mergedMesh(railGeos, vertexColorMat));
  // Stations: bottom (north residential edge) + top (T4).
  const stGeos = [];
  stGeos.push(colored(xform(new THREE.BoxGeometry(4, 0.3, 3), 0, 0.15, -104), 0xcbb894));
  stGeos.push(colored(xform(new THREE.BoxGeometry(4, 2.2, 0.25), 0, 1.1, -105.4), 0xf5efe2));
  stGeos.push(colored(xform(new THREE.BoxGeometry(4.4, 0.25, 3.4), 0, 2.3, -104), 0xb4552d));
  stGeos.push(colored(xform(new THREE.BoxGeometry(4, 0.3, 3), 0, 8.15, -130.5), 0xcbb894));
  stGeos.push(colored(xform(new THREE.BoxGeometry(4, 2.2, 0.25), 0, 9.1, -131.9), 0xf5efe2));
  stGeos.push(colored(xform(new THREE.BoxGeometry(4.4, 0.25, 3.4), 0, 10.3, -130.5), 0xb4552d));
  fun.add(mergedMesh(stGeos, vertexColorMat));
  // Car: red cabin that shuttles between the stations (ticker).
  const car = new THREE.Group();
  car.name = 'funicular-car';
  const carBody = colored(xform(new THREE.BoxGeometry(1.8, 1.6, 2.4), 0, 0.9, 0), 0xc0392b);
  const carRoof = colored(xform(new THREE.BoxGeometry(2.0, 0.2, 2.6), 0, 1.8, 0), 0xf5efe2);
  const carGlass = colored(xform(new THREE.BoxGeometry(1.9, 0.7, 2.5), 0, 1.2, 0), 0x2a4a5a);
  car.add(mergedMesh([carBody, carRoof, carGlass], vertexColorMat));
  car.rotation.x = -ang;
  car.position.set(0, 0.4, -105);
  fun.add(car);
  fun.userData.tick = (t) => {
    // 40 s round trip: up 18 s, dwell 2 s, down 18 s, dwell 2 s.
    const cyc = (t % 40) / 40;
    let u;
    if (cyc < 0.45) u = cyc / 0.45;
    else if (cyc < 0.5) u = 1;
    else if (cyc < 0.95) u = 1 - (cyc - 0.5) / 0.45;
    else u = 0;
    car.position.set(0, 0.4 + u * 8, -105 - u * 25);
  };
  g.add(fun);
  g.userData.villaCount = villaCount;
  return { group: g, tickers: [fun], villaCount };
}

// ---------- Outer zones: quarry + lighthouse headland (2e, Xian 21 Nov 17:58) ----------
// Quarry (northeast, x 96..128, z -105..-88): a walled excavation —
// a dusty floor, terraced rock walls stepping up around it, industrial
// sheds, a crusher tower, a conveyor to a rubble pile. Lighthouse
// headland (southwest, x -128..-118, z 35..48): a rocky point jutting
// into the bay, a striped lighthouse tower with a rotating beam
// (ticker) + keeper's cottage. All merged into ONE vertex-colored
// mesh (1 draw call) except the beam (rotates, so it stays separate).
function buildOuterZones() {
  const g = new THREE.Group();
  g.name = 'outer-zones';
  const parts = [];
  const rnd = seededRandom(20261121);
  // --- Quarry pit (x 100..124, z -103..-90): dusty floor + terraced walls.
  parts.push(colored(xform(new THREE.BoxGeometry(24, 0.2, 13), 112, 0.1, -96.5), 0xcbb894));
  // Terraced rock walls: 3 steps rising around the pit (south + east +
  // west faces; the north face is the hillside).
  const wallSteps = [
    { y: 1.5, z0: -90, z1: -88, x0: 100, x1: 124 },
    { y: 3, z0: -90, z1: -89, x0: 100, x1: 124 },
    { y: 1.5, z0: -103, z1: -101, x0: 100, x1: 124 },
    { y: 3, z0: -103, z1: -102, x0: 100, x1: 124 },
    { y: 1.5, z0: -103, z1: -90, x0: 100, x1: 102 },
    { y: 3, z0: -103, z1: -90, x0: 100, x1: 101 },
    { y: 1.5, z0: -103, z1: -90, x0: 122, x1: 124 },
    { y: 3, z0: -103, z1: -90, x0: 123, x1: 124 },
  ];
  for (const s of wallSteps) {
    const w = s.x1 - s.x0;
    const d = s.z1 - s.z0;
    parts.push(colored(
      xform(new THREE.BoxGeometry(w, s.y, d), (s.x0 + s.x1) / 2, s.y / 2, (s.z0 + s.z1) / 2),
      0x9a8a72));
  }
  // Rubble piles (cones) inside the pit.
  for (const [px, pz, pr] of [[106, -94, 2.2], [110, -99, 1.8], [118, -95, 2.6]]) {
    parts.push(colored(xform(new THREE.ConeGeometry(pr, pr * 0.9, 8), px, pr * 0.45, pz), 0x8a7a62));
  }
  // Industrial sheds (grey/blue boxes + pitched roofs) + crusher + office.
  const SHED_COLORS = [0x8a8d91, 0x7a7d82, 0x6a7a8a, 0x9a8d7a];
  let shedCount = 0;
  for (const [sx, sz, sw, sd, sh] of [
    [102, -92, 4, 3, 2.5], [108, -92, 5, 3, 3], [116, -92, 4, 3, 2.5],
    [121, -98, 4, 3, 2.5], [103, -100, 5, 3, 3], [119, -101, 4, 3, 2.5],
  ]) {
    const c = SHED_COLORS[shedCount % SHED_COLORS.length];
    parts.push(colored(xform(new THREE.BoxGeometry(sw, sh, sd), sx, sh / 2, sz), c));
    parts.push(colored(xform(new THREE.BoxGeometry(sw + 0.3, 0.3, sd + 0.3), sx, sh + 0.15, sz), 0x5a5d61));
    shedCount++;
  }
  // Crusher tower (tall, with a hopper) + conveyor to the rubble pile.
  parts.push(colored(xform(new THREE.BoxGeometry(3, 6, 3), 112, 3, -100), 0x7a7d82));
  parts.push(colored(xform(new THREE.BoxGeometry(3.6, 0.8, 3.6), 112, 6.4, -100), 0x5a5d61));
  const conv = new THREE.BoxGeometry(0.8, 0.4, 9);
  conv.rotateX(0.5);
  conv.translate(114, 2.5, -96);
  parts.push(colored(conv, 0x3a3a3a));
  // Office (small, white + blue roof) by the south gate.
  parts.push(colored(xform(new THREE.BoxGeometry(3, 2.2, 2.5), 104, 1.1, -89.5), 0xf5efe2));
  parts.push(colored(xform(new THREE.BoxGeometry(3.4, 0.3, 2.9), 104, 2.35, -89.5), 0x2a4a6a));
  // --- Lighthouse headland (x -128..-118, z 35..48): rocks + tower + cottage.
  // Rocky outcrop: large flattened boulders rising from the water.
  for (const [rx, rz, rs] of [[-123, 38, 4], [-121, 42, 5], [-125, 44, 4.5], [-119, 40, 3.5], [-122, 46, 3]]) {
    const rock = new THREE.DodecahedronGeometry(rs, 0);
    rock.scale(1, 0.45, 1);
    rock.translate(rx, rs * 0.2, rz);
    parts.push(colored(rock, 0x8a8d91));
  }
  // Lighthouse tower (striped white/red bands), on the highest rock.
  const lx = -121, lz = 42;
  const bandH = 1.6;
  for (let i = 0; i < 6; i++) {
    const y0 = 2 + i * bandH;
    parts.push(colored(
      xform(new THREE.CylinderGeometry(1.1 - i * 0.06, 1.2 - i * 0.06, bandH, 10), lx, y0 + bandH / 2, lz),
      i % 2 === 0 ? 0xf5efe2 : 0xc0392b));
  }
  // Light room (glass + cap) + keeper's cottage.
  parts.push(colored(xform(new THREE.CylinderGeometry(1.0, 1.0, 1.2, 10), lx, 2 + 6 * bandH + 0.6, lz), 0x2a4a5a));
  parts.push(colored(xform(new THREE.ConeGeometry(1.3, 1.0, 10), lx, 2 + 6 * bandH + 1.7, lz), 0x3a3a3a));
  parts.push(colored(xform(new THREE.BoxGeometry(3.5, 2.2, 3), -125, 1.1, 38), 0xf5efe2));
  parts.push(colored(xform(new THREE.BoxGeometry(3.9, 0.3, 3.4), -125, 2.35, 38), 0xb4552d));
  g.add(mergedMesh(parts, vertexColorMat));
  // Rotating beam (separate mesh — it spins). A long thin translucent
  // box from the light room, sweeping the bay. The geometry is offset
  // +9 in z so it extends outward from the pivot at the tower top.
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 18),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  beam.geometry.translate(0, 0, 9);
  const beamPivot = new THREE.Group();
  beamPivot.name = 'lighthouse-beam';
  beamPivot.add(beam);
  beamPivot.position.set(lx, 2 + 6 * bandH + 0.6, lz);
  g.add(beamPivot);
  beamPivot.userData.tick = (t) => { beamPivot.rotation.y = t * 0.5; };
  return { group: g, tickers: [beamPivot], quarrySheds: shedCount + 2, lighthouse: 1 };
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
  // 2d: extended north to z -150 (was -120) so the ground covers the
  // ridges after they move north for the north residential ring.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 240),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -30);
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
  // GAME fix (22 Nov): the boulevard median is visual only — NO
  // colliders. The median strips sit on the road centreline (z 0), so a
  // car driving along the boulevard wedged on the median nose at
  // (-34.7, 0) in every M10 run (runs 7-11) before the race was cut.
  // The tail, the escapes and the side races all drive along the
  // boulevard, so the whole avenue must be drivable end-to-end. The low
  // stone strip (0.35 high) reads as a mountable divider; crossings at
  // the intersections are unchanged.

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

  // --- hills terraces + cliff villas + funicular (2d) ---
  const terraces = buildHillsTerraces();
  group.add(terraces.group);
  tickers.push(...terraces.tickers);
  report.hillsVillas = terraces.villaCount;

  // --- outer zones: quarry + lighthouse headland (2e) ---
  const outerZones = buildOuterZones();
  group.add(outerZones.group);
  tickers.push(...outerZones.tickers);
  report.outerQuarry = outerZones.quarrySheds;
  report.outerLighthouse = outerZones.lighthouse;

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
  // --- NEW PLAN 2e: outer countryside, west + east aprons (same pools) ---
  const outer = buildZoneInto(OUTER_DEF, zonePools, zoneAtlas);
  const ringExtGroup = mergePools(zonePools, zoneAtlas, roads.roadMat);
  group.add(ringExtGroup);
  colliders.push(...ringExt.colliders, ...promExt.colliders, ...otExt.colliders, ...res.colliders, ...outer.colliders);
  tickers.push(...ringExt.tickers, ...promExt.tickers, ...otExt.tickers, ...res.tickers, ...outer.tickers);

  // --- ground detail: DELETED in the GRID REBUILD — the grass tufts
  // stood at z 9.5..11.5, which is CBD block row 4 + the south street
  // now (the quay is paved). The title screen reads from the CBD, the
  // ring and the water instead.

  return {
    group, colliders, tickers, roads,
    report,
    lanes: [...trafficLanes(), ...nd.lanes, ...ring.lanes, ...ringExt.lanes, ...promExt.lanes, ...otExt.lanes, ...res.lanes, ...outer.lanes],
    pedPaths: [...nd.pedPaths, ...ring.pedPaths, ...ringExt.pedPaths, ...promExt.pedPaths, ...otExt.pedPaths, ...res.pedPaths, ...outer.pedPaths],
    // The published minimap is junction-split (GAME fix 21 Nov 23:04):
    // every T/X junction becomes a shared endpoint, so the road graph
    // built from these centerlines is one connected component. The
    // raw street lists stay the single source of truth for geometry.
    minimap: splitSegmentsAtJunctions([...minimapLines(), ...ringExt.minimap, ...promExt.minimap, ...otExt.minimap, ...res.minimap, ...outer.minimap]),
    ringExt, promExt, otExt, res, outer,
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
