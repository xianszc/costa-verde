// AZZURRA — district architecture.
// Every hero building is built procedurally from primitives, in its district's
// own visual vocabulary and palette. No generic box-with-windows buildings:
// each district reads by silhouette and color alone from far away.
import * as THREE from '../vendor/three.module.min.js';

// ---------- material + primitive helpers ----------
export function M(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.92, metalness: 0.0, flatShading: true, ...opts,
  });
}
function mesh(geo, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, M(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function box(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, opts);
}
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 14, opts = {}) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, opts);
}
export function cone(r, h, color, x = 0, y = 0, z = 0, seg = 12, opts = {}) {
  return mesh(new THREE.ConeGeometry(r, h, seg), color, x, y, z, opts);
}
export function sph(r, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = mesh(new THREE.SphereGeometry(r, 12, 10), color, x, y, z, opts);
  return m;
}
// Half-cylinder arch top (for arched windows / gates), axis along Z.
export function archTop(r, color, x, y, z, opts = {}) {
  const g = new THREE.CylinderGeometry(r, r, 0.24, 12, 1, false, 0, Math.PI);
  const m = new THREE.Mesh(g, M(color, opts));
  m.rotation.x = Math.PI / 2;
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function roofSlab(w, d, color, x, y, z) {
  return box(w + 0.3, 0.18, d + 0.3, color, x, y, z);
}
function pitchedRoof(w, d, color, x, y, z) {
  // Two sloped slabs meeting at a ridge.
  const g = new THREE.Group();
  const a = box(w / 2 + 0.2, 0.14, d + 0.3, color, -w / 4, 0.28, 0);
  a.rotation.z = 0.42;
  const b = box(w / 2 + 0.2, 0.14, d + 0.3, color, w / 4, 0.28, 0);
  b.rotation.z = -0.42;
  g.add(a, b);
  g.position.set(x, y, z);
  return g;
}
function palm(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.09 * s, 0.14 * s, 2.6 * s, 0x8a6a4a, 0, 1.3 * s, 0, 8));
  for (let i = 0; i < 6; i++) {
    const f = box(0.16 * s, 0.05 * s, 1.3 * s, 0x3f7a4e, 0, 2.65 * s, 0);
    const a = (i / 6) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.55 * s, 2.7 * s, Math.sin(a) * 0.55 * s);
    f.rotation.y = -a;
    f.rotation.x = 0.5;
    g.add(f);
  }
  g.add(sph(0.16 * s, 0x6b4a2a, 0.1 * s, 2.55 * s, 0.1 * s));
  g.position.set(x, 0, z);
  return g;
}
function lampPost(x, z, color = 0x2b2b2b) {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.07, 2.4, color, 0, 1.2, 0, 8));
  g.add(sph(0.16, 0xffd9a0, 0, 2.5, 0, { emissive: 0xffc46b, emissiveIntensity: 0.9 }));
  g.position.set(x, 0, z);
  return g;
}

// ---------- district data ----------
export const DISTRICTS = [
  { id: 'villas', name: 'Cliff Villas', hero: 'Cliff Villa', pad: 0xf5efe2 },
  { id: 'marina', name: 'Yacht Marina', hero: 'Harbormaster Pavilion', pad: 0xa9805a },
  { id: 'oldtown', name: 'Fortress Old Town', hero: 'Bell Tower', pad: 0xd9b98a },
  { id: 'promenade', name: 'Promenade & Casino', hero: 'Casino Azzurra', pad: 0xf3e6c8 },
  { id: 'lighthouse', name: 'Lighthouse Point', hero: 'The Lighthouse', pad: 0x8a8d91 },
  { id: 'funicular', name: 'Funicular Hills', hero: 'Upper Station', pad: 0xf2c49b },
  { id: 'countryside', name: 'Olive-Grove Countryside', hero: 'Windmill', pad: 0xb7a88e },
  { id: 'quarry', name: 'Quarry / Industrial', hero: 'Silo Cluster', pad: 0x9a9a94 },
];

// ---------- 1. Cliff villa ----------
function villa() {
  const g = new THREE.Group();
  // Stacked whitewashed cubes.
  g.add(box(4.2, 2.4, 3.2, 0xf5efe2, 0, 1.2, 0));
  g.add(box(3.0, 2.0, 2.4, 0xf5efe2, -0.4, 3.4, 0.2));
  g.add(box(2.0, 1.6, 2.0, 0xf5efe2, 0.5, 5.2, -0.2));
  g.add(roofSlab(4.2, 3.2, 0xe8dcc4, 0, 2.5, 0));
  g.add(roofSlab(3.0, 2.4, 0xe8dcc4, -0.4, 4.5, 0.2));
  g.add(roofSlab(2.0, 2.0, 0xe8dcc4, 0.5, 6.1, -0.2));
  // Pergola on the top tier: 4 posts + slats.
  for (const [px, pz] of [[-0.3, -0.9], [1.3, -0.9], [-0.3, 0.5], [1.3, 0.5]]) {
    g.add(box(0.12, 0.9, 0.12, 0x8a6a4a, px, 6.65, pz));
  }
  for (let i = 0; i < 5; i++) {
    g.add(box(2.0, 0.08, 0.14, 0xa9805a, 0.5, 7.15, -0.9 + i * 0.35));
  }
  // Blue-shuttered arched windows on the front face.
  for (const wx of [-1.4, 0, 1.4]) {
    g.add(box(0.7, 1.1, 0.1, 0x2e4a5e, wx, 1.3, 1.62));
    g.add(archTop(0.35, 0x2e4a5e, wx, 1.85, 1.62));
    g.add(box(0.22, 1.1, 0.06, 0x3e7cb1, wx - 0.5, 1.3, 1.64));
    g.add(box(0.22, 1.1, 0.06, 0x3e7cb1, wx + 0.5, 1.3, 1.64));
  }
  // Bougainvillea cascades (magenta blobs).
  g.add(sph(0.55, 0xc93a6b, -1.9, 2.2, 1.2));
  g.add(sph(0.4, 0xd94f7e, -2.1, 1.5, 1.4));
  g.add(sph(0.45, 0xc93a6b, 1.9, 3.6, 1.1));
  g.add(sph(0.35, 0xd94f7e, 2.0, 3.0, 1.3));
  // Infinity-pool terrace + glass railing (right side).
  g.add(box(2.6, 0.35, 2.2, 0xe8dcc4, 3.2, 0.18, 0.4));
  g.add(box(2.2, 0.12, 1.8, 0x39b8c4, 3.2, 0.42, 0.4, { roughness: 0.15 }));
  g.add(box(2.6, 0.5, 0.06, 0xbfe3de, 3.2, 0.7, 1.5, { transparent: true, opacity: 0.45 }));
  // Outdoor staircase on the left.
  for (let i = 0; i < 5; i++) {
    g.add(box(0.9, 0.22, 0.5, 0xe8dcc4, -2.5, 0.3 + i * 0.45, -0.6 + i * 0.42));
  }
  return g;
}

// ---------- 2. Yacht marina pavilion ----------
function marina() {
  const g = new THREE.Group();
  // Wooden boardwalk deck.
  g.add(box(7.0, 0.3, 4.6, 0xa9805a, 0, 0.15, 0));
  for (let i = 0; i < 9; i++) {
    g.add(box(0.08, 0.32, 4.6, 0x8a6a4a, -3.2 + i * 0.8, 0.15, 0));
  }
  // Low modern pavilion: posts + overhanging flat roof.
  for (const [px, pz] of [[-2.2, -1.4], [2.2, -1.4], [-2.2, 1.4], [2.2, 1.4]]) {
    g.add(box(0.22, 2.4, 0.22, 0x16324f, px, 1.5, pz));
  }
  g.add(box(5.6, 0.25, 4.0, 0xf2f0ea, 0, 2.8, 0));
  g.add(box(5.6, 0.18, 0.5, 0x1f7a8c, 0, 2.65, 2.0));
  // Glass walls.
  g.add(box(4.6, 1.9, 0.08, 0xbfe3de, 0, 1.25, 1.45, { transparent: true, opacity: 0.4 }));
  // Striped canopy (teal/white) over the front.
  for (let i = 0; i < 6; i++) {
    const c = i % 2 === 0 ? 0x1f7a8c : 0xf2f0ea;
    const s = box(0.85, 0.08, 1.6, c, -2.1 + i * 0.85, 2.35, 2.6);
    s.rotation.x = 0.35;
    g.add(s);
  }
  // Mast + rigging behind.
  g.add(cyl(0.07, 0.1, 5.2, 0x8a6a4a, -2.6, 2.9, -1.6, 8));
  g.add(box(1.6, 0.08, 0.08, 0x8a6a4a, -2.6, 4.6, -1.6));
  const rig = cyl(0.02, 0.02, 4.4, 0x3a3a3a, -1.9, 3.6, -1.6, 6);
  rig.rotation.z = 0.5;
  g.add(rig);
  // Boat shed with big sliding door.
  g.add(box(2.6, 2.2, 2.4, 0xe8e2d4, 3.4, 1.4, -0.8));
  g.add(box(2.0, 1.7, 0.1, 0x16324f, 3.4, 1.15, 0.42));
  g.add(pitchedRoof(2.6, 2.4, 0x1f7a8c, 3.4, 2.5, -0.8));
  // Dock crane (small).
  g.add(box(0.3, 1.8, 0.3, 0xe4572e, -3.0, 1.2, 1.6));
  const jib = box(2.2, 0.18, 0.18, 0xe4572e, -2.0, 2.0, 1.6);
  jib.rotation.z = 0.25;
  g.add(jib);
  g.add(cyl(0.02, 0.02, 1.0, 0x3a3a3a, -1.1, 1.6, 1.6, 6));
  g.add(box(0.25, 0.25, 0.25, 0x3a3a3a, -1.1, 1.0, 1.6));
  // Bollards.
  for (const bx of [-3.0, -1.0, 1.0, 3.0]) {
    g.add(cyl(0.12, 0.14, 0.35, 0x16324f, bx, 0.48, 2.1, 8));
  }
  return g;
}

// ---------- 3. Fortress old town bell tower ----------
function oldtown() {
  const g = new THREE.Group();
  // Thick sandstone base wall with an arched gate.
  g.add(box(6.0, 2.6, 1.0, 0xd9b98a, 0, 1.3, 1.4));
  g.add(box(1.4, 1.9, 0.2, 0x2b2b2b, 0, 0.95, 1.95));
  g.add(archTop(0.7, 0x2b2b2b, 0, 1.9, 1.95));
  g.add(box(6.0, 0.3, 1.2, 0xbfa06e, 0, 2.75, 1.4));
  // Bell tower.
  g.add(box(2.8, 6.4, 2.8, 0xd9b98a, 0, 3.2, -0.6));
  // Crenellations.
  for (let i = 0; i < 4; i++) {
    g.add(box(0.4, 0.5, 0.4, 0xd9b98a, -1.2 + i * 0.8, 6.65, 0.85));
    g.add(box(0.4, 0.5, 0.4, 0xd9b98a, -1.2 + i * 0.8, 6.65, -2.05));
  }
  // Belfry: arched openings + bell.
  for (const bx of [-0.9, 0.9]) {
    g.add(box(0.7, 1.3, 0.15, 0x2b2b2b, bx, 5.6, 0.82));
    g.add(archTop(0.35, 0x2b2b2b, bx, 6.25, 0.82));
  }
  g.add(cone(0.35, 0.5, 0xe8a33d, 0, 5.5, 0.2, 10));
  // Terracotta pyramid cap.
  g.add(cone(2.1, 1.4, 0xb4552d, 0, 7.6, -0.6, 4));
  // Clock face on the tower front.
  g.add(cyl(0.55, 0.55, 0.1, 0xf4f1ea, 0, 4.2, 0.85, 16));
  const hand = box(0.06, 0.4, 0.05, 0x2b2b2b, 0, 4.35, 0.92);
  hand.rotation.z = 0.7;
  g.add(hand);
  // Wrought-iron balcony on the wall.
  g.add(box(1.6, 0.1, 0.5, 0x2b2b2b, -2.2, 2.1, 2.0));
  for (let i = 0; i < 5; i++) {
    g.add(box(0.05, 0.5, 0.05, 0x2b2b2b, -2.9 + i * 0.35, 2.4, 2.2));
  }
  // Laundry line across the alley.
  const line = cyl(0.02, 0.02, 3.2, 0xefe3c8, -2.6, 3.4, 2.6, 6);
  line.rotation.z = Math.PI / 2;
  g.add(line);
  g.add(box(0.4, 0.5, 0.03, 0xc93a6b, -3.2, 3.15, 2.6));
  g.add(box(0.4, 0.5, 0.03, 0xf2f0ea, -2.4, 3.15, 2.6));
  g.add(box(0.4, 0.5, 0.03, 0x3e7cb1, -1.6, 3.15, 2.6));
  return g;
}

// ---------- 4. Promenade casino (Art Deco) ----------
function promenade() {
  const g = new THREE.Group();
  // Main block with a curved corner (cylinder segment).
  g.add(box(5.0, 4.0, 3.0, 0xf3e6c8, -0.4, 2.0, 0));
  g.add(cyl(1.5, 1.5, 4.0, 0xf3e6c8, 2.1, 2.0, 0, 16));
  // Stepped crown (three setbacks, gold trim).
  g.add(box(4.2, 0.9, 2.4, 0xe8a33d, -0.4, 4.45, 0));
  g.add(box(3.2, 0.8, 1.8, 0xf3e6c8, -0.4, 5.3, 0));
  g.add(box(2.2, 0.7, 1.2, 0xe8a33d, -0.4, 6.05, 0));
  g.add(box(0.5, 0.8, 0.5, 0xe8a33d, -0.4, 6.8, 0));
  // Neon signs (emissive).
  g.add(box(0.5, 2.6, 0.2, 0xff5c8a, 2.1, 3.0, 1.55, { emissive: 0xff5c8a, emissiveIntensity: 1.6 }));
  g.add(box(3.4, 0.45, 0.2, 0x3ed6d6, -0.4, 3.4, 1.55, { emissive: 0x3ed6d6, emissiveIntensity: 1.4 }));
  // Entrance canopy + columns.
  g.add(box(2.6, 0.2, 1.2, 0x2e7f8f, -0.4, 2.3, 1.9));
  g.add(cyl(0.09, 0.09, 2.2, 0xe8a33d, -1.5, 1.1, 2.3, 8));
  g.add(cyl(0.09, 0.09, 2.2, 0xe8a33d, 0.7, 1.1, 2.3, 8));
  // Striped awning over the windows.
  for (let i = 0; i < 5; i++) {
    const c = i % 2 === 0 ? 0xff5c8a : 0xf3e6c8;
    const s = box(0.7, 0.08, 0.9, c, -2.2 + i * 0.75, 2.6, 1.7);
    s.rotation.x = 0.4;
    g.add(s);
  }
  // Fountain forecourt.
  g.add(cyl(1.3, 1.4, 0.5, 0xe8dcc4, -0.4, 0.25, 3.6, 16));
  g.add(cyl(1.1, 1.1, 0.1, 0x39b8c4, -0.4, 0.52, 3.6, 16, { roughness: 0.15 }));
  g.add(cyl(0.12, 0.16, 0.9, 0xe8dcc4, -0.4, 0.9, 3.6, 8));
  g.add(sph(0.25, 0x39b8c4, -0.4, 1.45, 3.6, { roughness: 0.15 }));
  // Palms + lamp posts.
  g.add(palm(-3.4, 2.6, 1.1));
  g.add(palm(3.6, 2.8, 0.9));
  g.add(lampPost(-2.8, 3.4));
  g.add(lampPost(2.6, 3.6));
  return g;
}

// ---------- 5. Lighthouse ----------
function lighthouse() {
  const g = new THREE.Group();
  // Striped tower: alternating red/white bands.
  const bands = [0xc0392b, 0xf4f1ea, 0xc0392b, 0xf4f1ea, 0xc0392b];
  for (let i = 0; i < 5; i++) {
    g.add(cyl(0.85 - i * 0.06, 0.95 - i * 0.06, 1.5, bands[i], 0, 0.75 + i * 1.5, 0, 16));
  }
  // Gallery + lamp room + cap.
  g.add(cyl(1.15, 1.15, 0.18, 0x2b2b2b, 0, 7.6, 0, 16));
  g.add(cyl(0.7, 0.7, 1.0, 0xffe9a8, 0, 8.2, 0, 12, { emissive: 0xffd94d, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }));
  g.add(cone(0.85, 0.7, 0x2b2b2b, 0, 9.05, 0, 12));
  // Rotating beam: a pivot at the lamp room so it sweeps around the tower.
  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 8.2, 0);
  beamPivot.name = 'beamPivot';
  const beam = cone(1.1, 5.5, 0xffe9a8, 3.4, 0, 0, 16, { transparent: true, opacity: 0.22, emissive: 0xffd94d, emissiveIntensity: 0.8 });
  beam.rotation.z = -Math.PI / 2;
  beam.name = 'beam';
  beamPivot.add(beam);
  g.add(beamPivot);
  // Keeper's cottage: stone + slate pitched roof + chimney.
  g.add(box(2.6, 1.8, 2.2, 0x8a8d91, -2.6, 0.9, 1.2));
  g.add(pitchedRoof(2.6, 2.2, 0x4a5560, -2.6, 1.8, 1.2));
  g.add(box(0.3, 0.9, 0.3, 0x8a8d91, -1.9, 2.4, 0.8));
  g.add(box(0.6, 0.9, 0.1, 0x2b2b2b, -2.6, 0.7, 2.32));
  // Fishing hut on stilts + nets.
  for (const [px, pz] of [[2.6, 1.8], [3.6, 1.8], [2.6, 2.8], [3.6, 2.8]]) {
    g.add(box(0.12, 1.0, 0.12, 0x8a6a4a, px, 0.5, pz));
  }
  g.add(box(1.6, 1.1, 1.4, 0xc9a86a, 3.1, 1.55, 2.3));
  g.add(pitchedRoof(1.6, 1.4, 0x4a5560, 3.1, 2.1, 2.3));
  g.add(box(1.2, 0.7, 0.05, 0xbfe3de, 2.2, 0.9, 3.2));
  // Breakwater.
  for (let i = 0; i < 5; i++) {
    g.add(box(0.8, 0.5, 0.8, 0x8a8d91, -3.5 + i * 0.9, 0.25, -2.2));
  }
  return g;
}

// ---------- 6. Funicular hills ----------
function funicular() {
  const g = new THREE.Group();
  // Three stepped retaining walls (terraces).
  g.add(box(7.0, 0.8, 1.0, 0xb9a98f, 0, 0.4, 2.6));
  g.add(box(6.0, 0.8, 1.0, 0xb9a98f, 0, 1.2, 1.4));
  g.add(box(5.0, 0.8, 1.0, 0xb9a98f, 0, 2.0, 0.2));
  // Pastel townhouse on the top terrace.
  g.add(box(3.0, 2.8, 2.4, 0xf2c49b, -1.2, 3.8, -1.2));
  g.add(pitchedRoof(3.0, 2.4, 0xb4552d, -1.2, 5.2, -1.2));
  g.add(box(0.6, 1.0, 0.08, 0x2e4a5e, -1.9, 3.9, 0.05));
  g.add(box(0.6, 1.0, 0.08, 0x2e4a5e, -0.5, 3.9, 0.05));
  g.add(box(0.5, 1.0, 0.08, 0xa8cbb0, -1.9, 4.9, 0.05));
  g.add(box(0.5, 1.0, 0.08, 0xa8cbb0, -0.5, 4.9, 0.05));
  // Balcony with iron railing.
  g.add(box(1.8, 0.12, 0.6, 0x2b2b2b, -1.2, 4.35, 0.35));
  for (let i = 0; i < 5; i++) {
    g.add(box(0.05, 0.5, 0.05, 0x2b2b2b, -1.9 + i * 0.35, 4.65, 0.62));
  }
  // Small domed chapel.
  g.add(box(1.6, 1.6, 1.6, 0xf7f3e8, 2.2, 3.2, -1.2));
  const dome = sph(0.85, 0xf2de9b, 2.2, 4.0, -1.2);
  dome.scale.y = 0.75;
  g.add(dome);
  g.add(box(0.08, 0.5, 0.08, 0xe8a33d, 2.2, 4.75, -1.2));
  g.add(box(0.3, 0.08, 0.08, 0xe8a33d, 2.2, 4.75, -1.2));
  // Funicular rails climbing the slope (front, inclined).
  for (const rx of [-0.5, 0.5]) {
    const rail = box(0.12, 0.12, 7.5, 0x8a5a3b, rx, 1.6, 3.4);
    rail.rotation.x = -0.42;
    g.add(rail);
  }
  // Funicular car on the rails.
  const car = new THREE.Group();
  car.add(box(1.4, 1.1, 1.8, 0xe4572e, 0, 0.55, 0));
  car.add(box(1.5, 0.25, 1.9, 0xf2f0ea, 0, 1.2, 0));
  car.add(box(1.2, 0.5, 0.08, 0x2e4a5e, 0, 0.75, 0.92));
  car.add(box(0.08, 0.5, 1.2, 0x2e4a5e, 0.72, 0.75, 0));
  car.position.set(0, 2.6, 4.6);
  car.rotation.x = -0.42;
  g.add(car);
  // Lemon trees in pots on the terraces.
  for (const [lx, lz, ly] of [[-2.9, 2.0, 0.8], [2.9, 2.0, 0.8], [-2.6, 0.8, 1.6]]) {
    g.add(cyl(0.22, 0.16, 0.4, 0xb4552d, lx, ly + 0.2, lz, 8));
    g.add(sph(0.4, 0x3f7a4e, lx, ly + 0.75, lz));
    g.add(sph(0.1, 0xf2de9b, lx + 0.25, ly + 0.6, lz + 0.15));
    g.add(sph(0.1, 0xf2de9b, lx - 0.2, ly + 0.7, lz - 0.15));
  }
  return g;
}

// ---------- 7. Olive-grove countryside (windmill) ----------
function countryside() {
  const g = new THREE.Group();
  // Windmill tower (tapered stone) + white cap.
  g.add(cyl(1.1, 1.6, 5.6, 0xb7a88e, -1.6, 2.8, -0.8, 12));
  g.add(cone(1.25, 1.0, 0xf7f3e8, -1.6, 6.1, -0.8, 12));
  // Four sails on a hub (animated in the lineup).
  const hub = new THREE.Group();
  hub.position.set(-1.6, 5.6, 0.35);
  hub.name = 'sails';
  for (let i = 0; i < 4; i++) {
    const sail = box(0.5, 2.6, 0.06, 0xf7f3e8, 0, 1.5, 0);
    const a = (i / 4) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.z = a;
    pivot.add(sail);
    hub.add(pivot);
  }
  hub.add(cyl(0.18, 0.18, 0.3, 0x8a5a3b, 0, 0, 0, 8));
  g.add(hub);
  // Farmhouse: stone + pitched terracotta roof + chimney.
  g.add(box(3.0, 2.0, 2.4, 0xb7a88e, 1.8, 1.0, 1.0));
  g.add(pitchedRoof(3.0, 2.4, 0xb4552d, 1.8, 2.0, 1.0));
  g.add(box(0.3, 0.9, 0.3, 0xb7a88e, 2.8, 2.6, 0.6));
  g.add(box(0.7, 1.2, 0.1, 0x8a5a3b, 1.8, 0.6, 2.22));
  // Barn: red + big timber door.
  g.add(box(2.4, 2.0, 2.2, 0x9e3b2e, -3.2, 1.0, 1.2));
  g.add(pitchedRoof(2.4, 2.2, 0x8a5a3b, -3.2, 2.0, 1.2));
  g.add(box(1.2, 1.5, 0.1, 0x6b4a2a, -3.2, 0.75, 2.32));
  // Dry-stone fence.
  for (let i = 0; i < 6; i++) {
    g.add(box(0.7, 0.5, 0.3, 0xb7a88e, 0.4 + i * 0.75, 0.25, 2.9));
  }
  // Vineyard rows.
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 5; i++) {
      g.add(box(0.5, 0.5, 0.5, 0x7a8b5a, -3.4 + i * 0.7, 0.45, -2.2 - r * 0.8));
    }
  }
  // Olive trees (grey-green spheres on gnarled trunks).
  for (const [ox, oz] of [[3.4, -1.6], [0.2, -2.6], [-0.6, 1.6]]) {
    g.add(cyl(0.12, 0.2, 1.0, 0x6b4a2a, ox, 0.5, oz, 7));
    g.add(sph(0.7, 0x7a8b5a, ox, 1.35, oz));
    g.add(sph(0.45, 0x8a9b6a, ox + 0.4, 1.1, oz + 0.2));
  }
  // Hay bales.
  g.add(cyl(0.45, 0.45, 0.9, 0xd9b96a, 2.6, 0.45, 2.6, 10));
  g.add(cyl(0.45, 0.45, 0.9, 0xd9b96a, 3.5, 0.45, 2.2, 10));
  return g;
}

// ---------- 8. Quarry / industrial ----------
function quarry() {
  const g = new THREE.Group();
  // Three concrete silos, different heights.
  g.add(cyl(1.0, 1.0, 5.0, 0x9a9a94, -2.4, 2.5, -0.8, 14));
  g.add(cone(1.05, 0.9, 0x8a8a84, -2.4, 5.45, -0.8, 14));
  g.add(cyl(0.9, 0.9, 6.4, 0x9a9a94, -0.4, 3.2, -0.8, 14));
  g.add(cone(0.95, 0.9, 0x8a8a84, -0.4, 6.85, -0.8, 14));
  g.add(cyl(0.8, 0.8, 4.2, 0x9a9a94, 1.5, 2.1, -0.8, 14));
  g.add(cone(0.85, 0.8, 0x8a8a84, 1.5, 4.6, -0.8, 14));
  // Ladder on the tall silo.
  for (let i = 0; i < 8; i++) {
    g.add(box(0.4, 0.06, 0.06, 0x3a3a3a, -0.4, 0.6 + i * 0.7, 0.15));
  }
  // Tower crane.
  g.add(box(0.5, 5.5, 0.5, 0xe8c33d, 2.8, 2.75, -1.2));
  const jib = box(4.2, 0.35, 0.35, 0xe8c33d, 2.8, 5.6, -1.2);
  g.add(jib);
  g.add(box(1.2, 0.4, 0.4, 0x3a3a3a, 1.0, 5.6, -1.2));
  g.add(cyl(0.02, 0.02, 1.6, 0x3a3a3a, 4.4, 4.8, -1.2, 6));
  g.add(box(0.4, 0.4, 0.4, 0x8a4b2e, 4.4, 3.9, -1.2));
  // Conveyor belt on trestles.
  const belt = box(0.9, 0.25, 5.5, 0x3a3a3a, -1.2, 1.8, 2.4);
  belt.rotation.x = 0.35;
  g.add(belt);
  for (const tz of [0.8, 2.4, 4.0]) {
    g.add(box(0.15, 1.2, 0.15, 0x8a4b2e, -1.6, 0.6, tz));
    g.add(box(0.15, 1.2, 0.15, 0x8a4b2e, -0.8, 0.6, tz));
  }
  // Container stacks.
  g.add(box(2.2, 1.0, 1.0, 0x8a4b2e, 2.6, 0.5, 1.6));
  g.add(box(2.2, 1.0, 1.0, 0xd9a441, 2.6, 1.5, 1.6));
  g.add(box(2.2, 1.0, 1.0, 0x2e7f8f, 2.6, 0.5, 2.8));
  g.add(box(2.2, 1.0, 1.0, 0x8a4b2e, 0.4, 0.5, 2.8));
  // Rusty shed with corrugated roof.
  g.add(box(2.6, 1.9, 2.0, 0x8a4b2e, -3.0, 0.95, 2.2));
  const shedRoof = box(2.9, 0.14, 2.3, 0x6b3a24, -3.0, 2.0, 2.2);
  shedRoof.rotation.z = 0.12;
  g.add(shedRoof);
  g.add(box(1.2, 1.4, 0.1, 0x3a3a3a, -3.0, 0.7, 3.22));
  // Gravel piles.
  g.add(cone(1.1, 0.9, 0x9a9a94, 0.6, 0.45, -2.4, 10));
  g.add(cone(0.8, 0.7, 0x8a8a84, 1.8, 0.35, -2.2, 10));
  return g;
}

export const HERO_BUILDERS = {
  villas: villa, marina, oldtown, promenade, lighthouse, funicular, countryside, quarry,
};

export function buildHeroBuilding(id) {
  const fn = HERO_BUILDERS[id];
  if (!fn) throw new Error('unknown district: ' + id);
  return fn();
}

// Golden-hour sky: a vertical gradient texture used as the scene background.
export function goldenSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#7fb2d9');
  grad.addColorStop(0.35, '#f7c98a');
  grad.addColorStop(0.62, '#f2a35e');
  grad.addColorStop(0.8, '#e8836b');
  grad.addColorStop(1.0, '#f7d9a8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function goldenHourLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x8a6a4a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-18, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff9a7a, 0.7);
  rim.position.set(15, 8, -12);
  scene.add(rim);
  return { hemi, sun, rim };
}
