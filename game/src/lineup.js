// AZZURA HEIST — lineup viewer (fresh rewrite, fix round).
// Renders review shots from real code, no mocks:
//   ?view=buildings  — one hero building per district, in a row.
//   ?view=skyline    — the Downtown Bay Skyline cluster across the bay.
//   ?view=characters — all main characters + crew + police + civilians.
// The same builders (world.js / people.js) become the real game in M1+.
// This page stays a review tool; it is removed from the final entry.
import * as THREE from '../vendor/three.module.min.js';
import {
  DISTRICTS, buildHeroBuilding, goldenSkyTexture, goldenHourLights,
  buildSkylineCluster, SKYLINE_TOWERS, warnLightMat, palm, lampPost,
  fountain, makeWater, sailboat, treeInstanced, lampRow, mergedMesh,
  colored, xform, vertexColorMat, M, TREE_TYPES,
} from './world.js';
import { makeFigure, CAST, CREW, POLICE, CIVILIANS } from './people.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'buildings';
const errors = [];
window.addEventListener('error', (e) => {
  errors.push(String(e.message || e.error));
  const s = document.getElementById('status');
  if (s) { s.textContent = 'ERROR: ' + errors.join(' | '); s.style.background = '#c0392b'; s.style.color = '#fff'; }
});
window.__lineupErrors = errors;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = goldenSkyTexture();
scene.fog = new THREE.Fog(0xf2a35e, 70, 175);
goldenHourLights(scene);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);

// Sun disc in the sky (golden hour). Per-view position: the skyline view
// moves it clear of the heliport tower's top (fix 5).
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
);
sunDisc.position.set(-38, 20, -70);
sunDisc.lookAt(camera.position);
scene.add(sunDisc);

// Ground.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshStandardMaterial({ color: 0xcbb28a, roughness: 1, flatShading: true }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const labels = [];
function addLabel(text, worldPos, cls = '') {
  const el = document.createElement('div');
  el.className = 'lbl ' + cls;
  el.textContent = text;
  document.getElementById('labels').appendChild(el);
  labels.push({ el, worldPos });
}
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  for (const { el, worldPos } of labels) {
    const v = worldPos.clone().project(camera);
    el.style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * h) + 'px';
    el.style.display = v.z < 1 ? 'block' : 'none';
  }
}

const animated = [];
function pad(x, z, color, w = 7.5, d = 7.5) {
  const p = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.25, d),
    new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
  );
  p.position.set(x, 0.12, z);
  p.receiveShadow = true;
  scene.add(p);
  return p;
}
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

if (view === 'buildings') {
  document.title = 'AZZURA HEIST — District lineup';
  document.getElementById('title').textContent = 'AZZURA HEIST · District lineup — one hero building per district';
  const spacing = 7.4;
  const SHORT = ['Villas', 'Marina', 'Old Town', 'Promenade', 'Lighthouse', 'Funicular', 'Countryside', 'Quarry', 'Skyline'];
  // District pads merged into ONE vertex-colored mesh (1 draw call).
  const padGeos = DISTRICTS.map((d, i) => {
    const x = (i - (DISTRICTS.length - 1) / 2) * spacing;
    return colored(xform(new THREE.BoxGeometry(7.0, 0.25, 7.0), x, 0.12, 0), d.pad);
  });
  scene.add(mergedMesh(padGeos, vertexColorMat));
  DISTRICTS.forEach((d, i) => {
    const x = (i - (DISTRICTS.length - 1) / 2) * spacing;
    const b = buildHeroBuilding(d.id);
    b.position.set(x, 0.25, 0);
    scene.add(b);
    const pivot = b.getObjectByName('beamPivot');
    if (pivot) animated.push({ obj: pivot, axis: 'y', speed: 0.5 });
    const sails = b.getObjectByName('sails');
    if (sails) animated.push({ obj: sails, axis: 'z', speed: 0.35 });
    addLabel(`${i + 1} · ${SHORT[i]}`, new THREE.Vector3(x, 0.6, 3.6), 'district');
  });
  // LOD skyline as the backdrop behind the whole row — District 9 visible
  // from every district, softened by fog (same blue/glass, no grey fade).
  const backdrop = buildSkylineCluster('lod');
  backdrop.position.set(0, 0.25, -30);
  backdrop.scale.setScalar(0.85);
  scene.add(backdrop);
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(95, 1.0, 7),
    new THREE.MeshStandardMaterial({ color: 0x4a4a44, roughness: 1, flatShading: true }),
  );
  podium.position.set(0, 0.5, -30);
  podium.receiveShadow = true;
  scene.add(podium);
  // Foreground: waterfront promenade + road, so the bottom of the frame is
  // street and plaza, not empty tan ground.
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.3, 4.5),
    new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 1, flatShading: true }),
  );
  walk.position.set(0, 0.15, 7.5);
  walk.receiveShadow = true;
  scene.add(walk);
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.32, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1, flatShading: true }),
  );
  road.position.set(0, 0.16, 12);
  road.receiveShadow = true;
  scene.add(road);
  // Road dashes merged into one mesh.
  const dashGeos = [];
  for (let x = -34; x <= 34; x += 4) {
    dashGeos.push(xform(new THREE.BoxGeometry(1.6, 0.05, 0.18), x, 0.34, 12));
  }
  scene.add(mergedMesh(dashGeos, M(0xf2f0ea)));
  // Lamp row (2 meshes) + palm row (1 InstancedMesh) along the walk.
  const lampXs = [];
  for (let x = -33; x <= 33; x += 8.25) lampXs.push(x);
  scene.add(lampRow(lampXs, 6.0));
  const walkPalms = lampXs.map((x, i) => ({
    x: x + 4, z: 6.4, s: 0.85 + (i % 3) * 0.12, rot: (i * 1.7) % 6.28, tint: 0xffffff,
  }));
  scene.add(treeInstanced('palm', walkPalms));
  // Plaza strip behind the pads + shader sea, bridging the gap to the skyline.
  const plaza = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.28, 7),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 1, flatShading: true }),
  );
  plaza.position.set(0, 0.14, -7.5);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const sea = makeWater(150, 16, -11, 64, 12);
  sea.position.set(0, 0.1, -19);
  scene.add(sea);
  // Park strip in the near foreground: 4 tree types (round, cypress, palm,
  // umbrella pine) with varied scale / rotation / tint — no identical blobs.
  const park = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.3, 24),
    new THREE.MeshStandardMaterial({ color: 0x7a8b5a, roughness: 1, flatShading: true }),
  );
  park.position.set(0, 0.15, 26);
  park.receiveShadow = true;
  scene.add(park);
  const rnd = seededRandom(20261120);
  const tints = [0xffffff, 0xf2f5e0, 0xe8f0d8, 0xdfe8c8, 0xffffff];
  const byType = { round: [], cypress: [], palm: [], pine: [] };
  for (let i = 0; i < 26; i++) {
    const type = TREE_TYPES[i % 4];
    const x = -34 + rnd() * 68;
    const z = 16 + rnd() * 18;
    const s = type === 'pine' ? 1.1 + rnd() * 0.4 : type === 'cypress' ? 1.0 + rnd() * 0.4 : 0.8 + rnd() * 0.4;
    byType[type].push({ x, z, s, rot: rnd() * Math.PI * 2, tint: tints[Math.floor(rnd() * tints.length)] });
  }
  for (const type of TREE_TYPES) {
    if (byType[type].length) scene.add(treeInstanced(type, byType[type]));
  }
  // A cypress hedge framing the very bottom edge of the frame.
  const hedge = [];
  for (let x = -33; x <= 33; x += 7.4) {
    hedge.push({ x, z: 36.5, s: 1.25 + (Math.abs(x) % 3) * 0.1, rot: (x * 0.7) % 6.28, tint: 0xffffff });
  }
  scene.add(treeInstanced('cypress', hedge));
  // Two real fountains (particle jets + splash), not beige dishes.
  for (const fx of [-14, 14]) {
    const f = fountain(1.0);
    f.position.set(fx, 0.3, 22);
    scene.add(f);
  }
  camera.position.set(0, 12, 50);
  camera.lookAt(0, 6, 0);
}
else if (view === 'skyline') {
  document.title = 'AZZURA HEIST — Downtown Bay Skyline';
  document.getElementById('title').textContent = 'AZZURA HEIST · Downtown Bay Skyline — 12 towers, 20–60 floors';
  // Sun moved clear of the heliport tower's top (fix 5): to the right, above
  // the shorter eastern towers, so no tower crown is washed out.
  sunDisc.position.set(34, 24, -70);
  sunDisc.lookAt(camera.position);
  // Waterfront plinth under the full cluster.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(100, 1.0, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1, flatShading: true }),
  );
  plinth.position.set(0, 0.5, -8);
  plinth.receiveShadow = true;
  scene.add(plinth);
  const cluster = buildSkylineCluster('full');
  cluster.position.set(0, 1.0, -8);
  scene.add(cluster);
  // Bay water: animated shader waves + fresnel + foam at the shore, not a
  // flat plane. Shore line at the plinth edge (z = -9).
  const water = makeWater(170, 70, -9, 96, 48);
  water.position.set(0, 0.1, 26);
  scene.add(water);
  // Sailboats with shaped hulls, cabins and wakes — angled so the hull reads.
  const boats = [
    { x: -30, z: 16, s: 1.6, sail: 0xf2f0ea, rot: 0.55, phase: 0.0 },
    { x: -8, z: 24, s: 1.4, sail: 0xff5c8a, rot: 0.75, phase: 1.3 },
    { x: 12, z: 14, s: 1.5, sail: 0xf2f0ea, rot: 0.45, phase: 2.1 },
    { x: 28, z: 22, s: 1.3, sail: 0x3ed6d6, rot: 0.85, phase: 3.4 },
  ];
  for (const b of boats) {
    const boat = sailboat(b.s, b.sail, b.phase);
    boat.position.set(b.x, 0.1, b.z);
    boat.rotation.y = b.rot;
    scene.add(boat);
  }
  // Tower labels (short names + floors), staggered in height so neighbours
  // never overlap.
  SKYLINE_TOWERS.forEach((t, i) => {
    const ly = t.floors * 0.3 + (i % 2 === 0 ? 2.2 : 4.8);
    addLabel(`${t.name.replace('Torre ', '')} · ${t.floors}f`, new THREE.Vector3(t.x, ly, -8), 'person');
  });
  camera.position.set(0, 4.5, 62);
  camera.lookAt(0, 9, -8);
} else {
  document.title = 'AZZURA HEIST — Character lineup';
  document.getElementById('title').textContent = 'AZZURA HEIST · Character lineup — mains, crews, Harbor Guard, civilians';
  // Front row: 10 mains + 3 police. Back row: 6 crew + 6 civilians.
  // Labels are split into two clean bands: front-row names at the figures'
  // feet, back-row names above their heads, so nothing overlaps.
  const front = [...CAST, ...POLICE];
  const back = [...CREW, ...CIVILIANS];
  const placeRow = (list, z, spacing, labelAt) => {
    list.forEach((c, i) => {
      const x = (i - (list.length - 1) / 2) * spacing;
      pad(x, z, 0xcbb28a, 1.4, 1.4);
      const fig = makeFigure(c.spec);
      fig.position.set(x, 0.25, z);
      scene.add(fig);
      const ly = labelAt === 'feet' ? 0.15 : fig.userData.height + 0.4;
      addLabel(`${c.name}`, new THREE.Vector3(x, ly, z), 'person');
    });
  };
  placeRow(front, 0.6, 1.75, 'feet');
  placeRow(back, -4.0, 1.75, 'head');
  camera.position.set(0, 3.4, 18.5);
  camera.lookAt(0, 1.0, -1.6);
}

// Per-frame tickers: anything with userData.tick (fountains, shader water,
// boats) gets the clock in seconds.
const tickers = [];
scene.traverse((o) => { if (o.userData && o.userData.tick) tickers.push(o); });

let frames = 0, totalMs = 0, lastT = performance.now();
function frame(t) {
  const dt = 0.016;
  for (const a of animated) a.obj.rotation[a.axis] += a.speed * dt;
  for (const tk of tickers) tk.userData.tick(t / 1000);
  // Aircraft warning lights blink (shared material, ~2.9 s period).
  warnLightMat.emissiveIntensity = 1.0 + 1.2 * Math.sin(t * 0.0022);
  renderer.render(scene, camera);
  updateLabels();
  // Perf sampling: average the first 30 rendered frames, then publish the
  // numbers for the Playwright probe (draw calls + triangles included).
  const now = performance.now();
  if (frames < 30) {
    if (frames > 0) totalMs += now - lastT;
    frames++;
    if (frames === 30) {
      const avg = totalMs / 29;
      window.__lineupStats = {
        avgMs: +avg.toFixed(2),
        fps: +(1000 / avg).toFixed(1),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    }
  }
  lastT = now;
  if (!window.__lineupReady) {
    window.__lineupReady = true;
    document.getElementById('status').textContent = 'rendered · ' + view;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  updateLabels();
});
