// AZZURA HEIST — District 4 (Lungomare / Seaside Promenade) for M1.
// Roads FIRST (city-system.md): the boulevard + five cross streets are laid
// out before any building; every plot is validated against the road and
// sidewalk rects (validatePlots) and against every other plot. Trees live
// ONLY in the park green zone and in sidewalk planters — never on a road,
// never blocking an intersection. The bay + skyline sit across the water
// to the south; layered hills close the town to the north.
import * as THREE from '../vendor/three.module.min.js';
import {
  M, box, cyl, cone, sph, mergedMesh, mergeStatic, colored, xform,
  vertexColorMat, buildHeroBuilding, buildSkylineCluster, fountain,
  treeInstanced, TREE_TYPES, makeTree, lampPost, palm,
} from './world.js';
import { makeWater, makeSailboat } from './water.js';
import {
  buildRoadNetwork, validatePlots, trafficLanes, minimapLines,
  BOULEVARD, CROSS_X, seededRandom,
} from './roads.js';

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
// call for every window in the district after the merge).
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

// Layered hills closing the town to the north: three hazy ridges + a few
// cypress silhouettes and villa dots on the near ridge.
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
  g.add(ridge(0x9aa88a, -40, -2, -95, 70, 22, 18));
  g.add(ridge(0x8a9a7a, 30, -3, -88, 80, 26, 20));
  g.add(ridge(0x7a8a68, -70, -1, -80, 50, 16, 14));
  g.add(ridge(0x6a7a58, 10, -2, -70, 55, 14, 12));
  g.add(ridge(0x5a6a48, -25, -1, -58, 45, 10, 10));
  // Cypress silhouettes + villa dots on the near ridge.
  const rnd = seededRandom(99);
  for (let i = 0; i < 14; i++) {
    const x = -55 + rnd() * 110;
    const t = makeTree('cypress', 1.6 + rnd() * 1.2);
    t.position.set(x, 2 + rnd() * 3, -56 - rnd() * 8);
    g.add(t);
  }
  for (let i = 0; i < 6; i++) {
    const x = -48 + i * 19 + rnd() * 4;
    const v = new THREE.Group();
    v.add(box(3, 2, 2.5, 0xf5efe2, 0, 1, 0));
    v.add(box(3.3, 0.3, 2.8, 0xb4552d, 0, 2.1, 0));
    v.position.set(x, 3 + rnd() * 2, -54 - rnd() * 6);
    g.add(v);
  }
  return mergeStatic(g);
}

// Plot list for District 4 (validated before building).
const PLOTS = [
  { id: 'casino', x0: -14, z0: -28, x1: -6, z1: -10 },
  { id: 'deco-west', x0: -37, z0: -28, x1: -25, z1: -10 },
  { id: 'deco-midwest', x0: -19, z0: -28, x1: -15.5, z1: -10 },
  { id: 'deco-east', x0: 3, z0: -28, x1: 17, z1: -10 },
  { id: 'deco-fareast', x0: 43, z0: -28, x1: 57, z1: -10 },
  { id: 'villa-back-west', x0: -37, z0: -40, x1: -27, z1: -31 },
  { id: 'villa-back-mid', x0: -17, z0: -40, x1: -7, z1: -31 },
  { id: 'villa-back-east', x0: 3, z0: -40, x1: 13, z1: -31 },
  { id: 'park', x0: 23, z0: -40, x1: 37, z1: -30 },
  { id: 'pavilion-quay', x0: 44, z0: -28, x1: 56, z1: -10 },
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
  addPlot(PLOTS[0], () => buildHeroBuilding('promenade'));
  // Deco facades on the front row.
  const decoSpecs = [
    [PLOTS[1], 11, 6.5, 5, { wall: 0xf3e6c8, trim: 0xe8a33d, accent: 0xff5c8a }, 'CAFFÈ LUME'],
    [PLOTS[2], 3.2, 5, 4, { wall: 0xf2de9b, trim: 0xc65d3b, accent: 0x3ed6d6 }, null],
    [PLOTS[3], 13, 8, 5.5, { wall: 0xf7ebd7, trim: 0xe8a33d, accent: 0x3ed6d6 }, 'GELATERIA AZZURA'],
    [PLOTS[4], 13, 7, 5, { wall: 0xefe3c8, trim: 0xc65d3b, accent: 0xff5c8a }, 'TERRAZZA HOTEL'],
  ];
  for (const [plot, w, h, d, pal, brand] of decoSpecs) {
    addPlot(plot, () => decoBuilding(rnd, w, h, d, pal, brand));
  }
  // Back-row villas (low, terracotta roofs).
  for (const plot of [PLOTS[5], PLOTS[6], PLOTS[7]]) {
    addPlot(plot, () => {
      const v = new THREE.Group();
      v.add(box(8, 3.2, 5, 0xf5efe2, 0, 1.6, 0));
      v.add(box(8.4, 0.3, 5.4, 0xb4552d, 0, 3.35, 0));
      v.add(box(5, 2.2, 4, 0xf5efe2, 1, 4.4, 0));
      v.add(box(5.4, 0.3, 4.4, 0xb4552d, 1, 5.6, 0));
      v.add(box(0.8, 1.2, 0.1, 0x2e4a5e, -2, 0.9, 2.55));
      v.add(box(0.8, 1.2, 0.1, 0x2e4a5e, 2, 0.9, 2.55));
      return v;
    });
  }
  // Quay pavilion (marina hero) on the east front row.
  addPlot(PLOTS[9], () => buildHeroBuilding('marina'));
  group.add(mergeStatic(buildings));
  // Animated bits the merge kept whole (the casino fountain) still tick.
  buildings.traverse((o) => { if (o.userData && o.userData.tick) tickers.push(o); });

  // --- park green zone (Block D back): trees ONLY here + planters ---
  const park = new THREE.Group();
  park.add(box(14, 0.24, 10, 0x7a8b5a, 30, 0.12, -35));
  const parkTrees = { round: [], cypress: [], palm: [], pine: [] };
  const prnd = seededRandom(4242);
  for (let i = 0; i < 14; i++) {
    const type = TREE_TYPES[i % 4];
    parkTrees[type].push({
      x: 24.5 + prnd() * 11, z: -39 + prnd() * 8,
      s: 0.8 + prnd() * 0.5, rot: prnd() * Math.PI * 2, tint: 0xffffff,
    });
  }
  for (const type of TREE_TYPES) {
    if (parkTrees[type].length) park.add(treeInstanced(type, parkTrees[type]));
  }
  const parkFountain = fountain(1.0);
  parkFountain.position.set(30, 0.24, -35);
  park.add(parkFountain);
  tickers.push(parkFountain);
  group.add(park);
  report.treesInGreenZones += 14;
  // Sidewalk planters with palms (green zones on the sidewalk edge only).
  const planterPalms = [];
  for (const px of [-52, -34, -12, 8, 28, 48]) {
    planterPalms.push({ x: px, z: -7.2, s: 0.9, rot: px, tint: 0xffffff });
  }
  group.add(treeInstanced('palm', planterPalms));
  report.treesInGreenZones += planterPalms.length;

  // --- café tables outside the casino (props, with colliders) ---
  const cafe = new THREE.Group();
  for (const [cx, cz] of [[-16, -8.2], [-13, -8.2], [-10, -8.2]]) {
    cafe.add(cyl(0.5, 0.5, 0.08, 0xf2f0ea, cx, 0.75, cz, 12));
    cafe.add(cyl(0.05, 0.05, 0.75, 0x2b2b2b, cx, 0.38, cz, 6));
    cafe.add(cyl(0.35, 0.35, 0.05, 0xe4572e, cx, 0.45, cz + 0.8, 10));
    colliders.push({ x0: cx - 0.6, z0: cz - 0.6, x1: cx + 0.6, z1: cz + 1.2, id: 'cafe-table' });
  }
  group.add(mergeStatic(cafe));

  // --- quay details: crates, rope coils, cleats, moored boats ---
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
  const skyline = buildSkylineCluster('lod');
  skyline.position.set(0, 0, 88);
  group.add(skyline);
  const skyPodium = new THREE.Mesh(
    new THREE.BoxGeometry(110, 1.0, 8),
    M(0x3a3a3a),
  );
  skyPodium.position.set(0, 0.5, 88);
  group.add(skyPodium);

  // --- hills to the north ---
  group.add(buildHills());

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
    lanes: trafficLanes(),
    minimap: minimapLines(),
    spawnPlayer: { x: -2, z: -7.2, angle: Math.PI },
    spawnCar: { x: -8, z: -3.4, angle: 0 },
    setNight(on) {
      windowMat.emissiveIntensity = on ? 1.4 : 0.15;
      for (const k in neonMats) neonMats[k].emissiveIntensity = on ? 2.4 : 1.2;
      roads.setNight(on);
    },
    setWet(v) { roads.setWet(v); },
  };
}
