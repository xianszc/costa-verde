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
  BOULEVARD, CROSS_X, seededRandom,
} from './roads.js';
import { buildNewDistricts } from './districts.js';
import { buildCBD } from './cbd.js';

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
  const ridge = (color, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
    );
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    return m;
  };
  g.add(ridge(0x9aa88a, -40, -2, -128, 70, 22, 18));
  g.add(ridge(0x8a9a7a, 30, -3, -120, 80, 26, 20));
  g.add(ridge(0x7a8a68, -70, -1, -112, 50, 16, 14));
  g.add(ridge(0x6a7a58, 10, -2, -102, 55, 14, 12));
  g.add(ridge(0x5a6a48, -25, -1, -98, 45, 9, 8));
  // Cypress silhouettes + villa dots on the near ridge, behind the wall.
  const rnd = seededRandom(99);
  for (let i = 0; i < 14; i++) {
    const x = -55 + rnd() * 110;
    const t = makeTree('cypress', 1.6 + rnd() * 1.2);
    t.position.set(x, 4 + rnd() * 2, -90 - rnd() * 6);
    g.add(t);
  }
  for (let i = 0; i < 6; i++) {
    const x = -48 + i * 19 + rnd() * 4;
    const v = new THREE.Group();
    v.add(box(3, 2, 2.5, 0xf5efe2, 0, 1, 0));
    v.add(box(3.3, 0.3, 2.8, 0xb4552d, 0, 2.1, 0));
    v.position.set(x, 4 + rnd() * 2, -92 - rnd() * 4);
    g.add(v);
  }
  return mergeStatic(g);
}

// Plot list for District 4 (validated before building). STAGE 1: the
// casino + the three front-row deco plots that sat in the CBD footprint
// are GONE (casino → promenade part 4, decos → commercial ring part 2),
// so they are not listed any more — the validator only sees plots that
// are actually built.
const PLOTS = [
  { id: 'deco-fareast', x0: 43, z0: -28, x1: 57, z1: -10 },
  { id: 'villa-back-west', x0: -37, z0: -40, x1: -27, z1: -31 },
  { id: 'villa-back-mid', x0: -17, z0: -40, x1: -7, z1: -31 },
  { id: 'villa-back-east', x0: 3, z0: -40, x1: 13, z1: -31 },
  { id: 'park', x0: 23, z0: -40, x1: 37, z1: -30 },
  { id: 'pavilion-quay', x0: 44, z0: -28, x1: 56, z1: -10 },
  { id: 'bell-tower', x0: -48.4, z0: -37.4, x1: -45.6, z1: -34.6 },
];

export function buildDistrict4() {
  const rnd = seededRandom(20261120);
  const group = new THREE.Group();
  group.name = 'district4';
  const colliders = [];
  const tickers = [];

  // --- ground base (dry grass / sand, under everything) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 200),
    new THREE.MeshStandardMaterial({ color: 0xa89a72, roughness: 1, flatShading: true }),
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
  // Deco facades on the front row.
  const decoSpecs = [
    [PLOTS[0], 13, 7, 5, { wall: 0xefe3c8, trim: 0xc65d3b, accent: 0xff5c8a }, 'TERRAZZA HOTEL'],
  ];
  // STAGE 1: the front-row decos that sat in the CBD footprint moved to
  // the commercial ring in part 2 — only the fareast hotel is built here.
  for (const [plot, w, h, d, pal, brand] of decoSpecs) {
    addPlot(plot, () => decoBuilding(rnd, w, h, d, pal, brand));
  }
  // Back-row villas (low, terracotta roofs; varied: chimneys, shutters,
  // one with a taller second story).
  for (const [i, plot] of [PLOTS[1], PLOTS[2], PLOTS[3]].entries()) {
    addPlot(plot, () => {
      const v = new THREE.Group();
      v.add(box(8, 3.2, 5, 0xf5efe2, 0, 1.6, 0));
      v.add(box(8.4, 0.3, 5.4, 0xb4552d, 0, 3.35, 0));
      v.add(box(5, 2.2, 4, 0xf5efe2, 1, 4.4, 0));
      v.add(box(5.4, 0.3, 4.4, 0xb4552d, 1, 5.6, 0));
      v.add(box(0.8, 1.2, 0.1, 0x2e4a5e, -2, 0.9, 2.55));
      v.add(box(0.8, 1.2, 0.1, 0x2e4a5e, 2, 0.9, 2.55));
      // Shutters beside the front windows + a chimney.
      v.add(box(0.3, 1.2, 0.08, 0x3a5a3a, -2.6, 0.9, 2.56));
      v.add(box(0.3, 1.2, 0.08, 0x3a5a3a, 2.6, 0.9, 2.56));
      v.add(box(0.5, 1.2, 0.5, 0x8a4a3a, -3, 4.2, -1));
      if (i === 1) {
        // Middle villa: taller second story + pergola.
        v.add(box(4, 1.8, 3.5, 0xf5efe2, -1.5, 6.4, 0));
        v.add(box(4.4, 0.3, 3.9, 0xb4552d, -1.5, 7.4, 0));
        v.add(box(2.4, 0.12, 2.0, 0x8a6a4a, 2.5, 3.6, 1.5));
      }
      return v;
    });
  }
  // Quay pavilion (marina hero) on the east front row.
  addPlot(PLOTS[5], () => buildHeroBuilding('marina'));
  // Old bell tower (M4 drop point).
  addPlot(PLOTS[6], () => bellTower());
  group.add(mergeStatic(buildings));
  // Animated bits the merge kept whole (the casino fountain) still tick.
  buildings.traverse((o) => { if (o.userData && o.userData.tick) tickers.push(o); });

  // --- park green zone (Block D back): trees ONLY here + planters ---
  const park = new THREE.Group();
  park.add(box(14, 0.24, 10, 0x7a8b5a, 30, 0.12, -35));
  const parkTrees = { round: [], cypress: [], pine: [] };
  const parkPalms = [];
  const prnd = seededRandom(4242);
  for (let i = 0; i < 14; i++) {
    const type = TREE_TYPES[i % 4];
    const spec = {
      x: 24.5 + prnd() * 11, z: -39 + prnd() * 8,
      s: 0.8 + prnd() * 0.5, rot: prnd() * Math.PI * 2, tint: 0xffffff,
    };
    if (type === 'palm') parkPalms.push(spec);
    else parkTrees[type].push(spec);
  }
  for (const type of Object.keys(parkTrees)) {
    if (parkTrees[type].length) park.add(treeInstanced(type, parkTrees[type]));
  }
  // Fuller palms in the park (individual merged meshes, varied heights).
  for (const p of parkPalms) {
    const palmMesh = makePalmFull(2.6 + p.s * 1.6);
    palmMesh.position.set(p.x, 0.24, p.z);
    palmMesh.rotation.y = p.rot;
    park.add(palmMesh);
  }
  const parkFountain = fountain(1.0);
  parkFountain.position.set(30, 0.24, -35);
  park.add(parkFountain);
  tickers.push(parkFountain);
  group.add(park);
  report.treesInGreenZones += 14;
  // Sidewalk planters with fuller palms (green zones on the sidewalk edge).
  // STAGE 1: only the planters OUTSIDE the CBD grid — the two that stood
  // on the north sidewalk in front of tower faces (x -12, 8) are gone;
  // in the CBD the sidewalk runs right against the towers, so street
  // trees belong in the plazas, not in front of tower faces.
  for (const px of [-52, -34, 28, 48]) {
    const palmMesh = makePalmFull(2.8 + (Math.abs(px) % 3) * 0.5);
    palmMesh.position.set(px, 0.24, -7.2);
    palmMesh.rotation.y = px * 0.7;
    group.add(palmMesh);
  }
  report.treesInGreenZones += 4;

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
  // Quay west — the combat staging spot (Elio crouches at -53.5, 11.5).
  barrier(-52.5, 10.5);
  crateStack(-50.5, 12.2, 0.3);
  lowWall(-55.5, 11.2);
  // Quay east + mid-east by the crane.
  barrier(50, 11.0);
  crateStack(53.5, 12.0, -0.2);
  lowWall(33, 11.6);
  // Facade line: STAGE 1 — removed (the old facade line at z -9.6 is
  // inside the new CBD footprint; the towers stand there now). The quay
  // cover props stay.
  group.add(mergeStatic(cover));

  // --- quay details: crates, rope coils, cleats, moored boats, crane ---
  const quayProps = new THREE.Group();
  for (const [qx, qz, c] of [[-52, 11.5, 0x8a6a4a], [-50.5, 11.8, 0x2e7f8f], [52, 11.5, 0x8a6a4a], [18, 11.6, 0xe4572e]]) {
    quayProps.add(box(1.1, 1.1, 1.1, c, qx, 0.85, qz));
    colliders.push({ x0: qx - 0.6, z0: qz - 0.6, x1: qx + 0.6, z1: qz + 0.6, id: 'crate' });
  }
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.09, 8, 16),
    M(0xc9a86a),
  );
  rope.rotation.x = -Math.PI / 2;
  rope.position.set(-46, 0.35, 11.4);
  quayProps.add(rope);
  // Small wooden harbor crane + barrels + fishing nets on the quay.
  quayProps.add(box(0.5, 5.5, 0.5, 0x6a4a2a, 36, 2.75, 11.5));
  quayProps.add(box(0.4, 0.4, 4.5, 0x6a4a2a, 36, 5.4, 11.5));
  quayProps.add(box(0.35, 1.6, 0.35, 0x2b2b2b, 36, 4.6, 13.4));
  quayProps.add(cyl(0.5, 0.5, 1.0, 0x8a6a4a, 38.5, 0.8, 11.5, 10));
  quayProps.add(cyl(0.5, 0.5, 1.0, 0x2e7f8f, 39.6, 0.8, 11.8, 10));
  quayProps.add(box(2.2, 0.15, 1.4, 0x3a5a3a, -30, 0.4, 11.6));
  colliders.push({ x0: 35.7, z0: 11.2, x1: 36.3, z1: 11.8, id: 'crane' });
  group.add(mergeStatic(quayProps));

  // --- bay water + moored boats + skyline across the bay ---
  // Water sits at y 0.3 so its wave troughs never dip under the ground
  // plane (that read as brown patches through the bay).
  const water = makeWater(260, 90, 13, 96, 48);
  water.position.set(0, 0.3, 58);
  water.userData.noMerge = true;
  group.add(water);
  tickers.push(water);
  const boats = [
    { x: -34, z: 22, s: 1.5, sail: 0xf2f0ea, rot: 0.5, phase: 0 },
    { x: -6, z: 30, s: 1.3, sail: 0xff5c8a, rot: 0.8, phase: 1.3 },
    { x: 20, z: 24, s: 1.4, sail: 0x3ed6d6, rot: 0.4, phase: 2.1 },
    { x: 44, z: 32, s: 1.2, sail: 0xf2f0ea, rot: 0.9, phase: 3.4 },
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

  // --- M3 districts (old town now; promenade east + skyline land next) ---
  const nd = buildNewDistricts();
  group.add(nd.group);
  colliders.push(...nd.colliders);
  tickers.push(...nd.tickers);

  // --- STAGE 1: CBD core (v3 plan) — 50 towers in the centre ---
  // The old skyline landmass across the bay (built by buildNewDistricts)
  // goes away in the next step; the CBD is the new skyline.
  const cbd = buildCBD();
  group.add(cbd.group);
  colliders.push(...cbd.colliders);
  tickers.push(...cbd.tickers);

  // --- ground detail for the lower third (title screen + low angles) ---
  // Grass tufts on the quay land (never in the bay — the old z 14..20
  // range sat in the water and read as dark cones poking out of it).
  const detail = new THREE.Group();
  const grassGeos = [];
  const grnd = seededRandom(777);
  for (let i = 0; i < 28; i++) {
    grassGeos.push(colored(xform(
      new THREE.ConeGeometry(0.22, 0.7, 5),
      -58 + grnd() * 116, 0.35, 9.5 + grnd() * 2, 0, 1, 0, 0,
    ), 0x5a7a44));
  }
  detail.add(mergedMesh(grassGeos, vertexColorMat));
  group.add(detail);

  return {
    group, colliders, tickers, roads,
    report,
    lanes: [...trafficLanes(), ...nd.lanes],
    pedPaths: nd.pedPaths,
    minimap: minimapLines(),
    // Spawn points live in anchors.js (one source of truth for every
    // gameplay position) — the district just carries them through.
    spawnPlayer: { x: ANCHORS.player_spawn.x, z: ANCHORS.player_spawn.z, angle: ANCHORS.player_spawn.angle },
    spawnCar: { x: ANCHORS.car_spawn.x, z: ANCHORS.car_spawn.z, angle: ANCHORS.car_spawn.angle },
    setNight(on) {
      windowMat.emissiveIntensity = on ? 1.4 : 0.15;
      for (const k in neonMats) neonMats[k].emissiveIntensity = on ? 2.4 : 1.2;
      roads.setNight(on);
    },
    setWet(v) { roads.setWet(v); },
  };
}
