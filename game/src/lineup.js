// AZZURRA — lineup viewer (Step 0 review tool).
// Renders two review shots from real code, no mocks:
//   ?view=buildings  — one hero building per district, in a row.
//   ?view=characters — all main characters + crew + police + civilians.
// The same builders (world.js / people.js) become the real game in M1+.
// This page stays a review tool; it is removed from the final entry.
import * as THREE from '../vendor/three.module.min.js';
import { DISTRICTS, buildHeroBuilding, goldenSkyTexture, goldenHourLights, buildSkylineCluster, SKYLINE_TOWERS, warnLightMat, palm, lampPost } from './world.js';
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
scene.fog = new THREE.Fog(0xf2a35e, 55, 140);
goldenHourLights(scene);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);

// Sun disc in the sky (golden hour).
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

if (view === 'buildings') {
  document.title = 'AZZURRA — District lineup';
  document.getElementById('title').textContent = 'AZZURRA · District lineup — one hero building per district';
  const spacing = 7.4;
  const SHORT = ['Villas', 'Marina', 'Old Town', 'Promenade', 'Lighthouse', 'Funicular', 'Countryside', 'Quarry', 'Skyline'];
  DISTRICTS.forEach((d, i) => {
    const x = (i - (DISTRICTS.length - 1) / 2) * spacing;
    pad(x, 0, d.pad, 7.0, 7.0);
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
  // from every district, softened by fog.
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
  for (let x = -34; x <= 34; x += 4) {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.05, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 1 }),
    );
    dash.position.set(x, 0.34, 12);
    scene.add(dash);
  }
  for (let x = -33; x <= 33; x += 8.25) {
    scene.add(lampPost(x, 6.0));
    scene.add(palm(x + 4, 6.4, 0.9));
  }
  // Plaza strip behind the pads + a sea band, bridging the gap to the skyline.
  const plaza = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.28, 7),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 1, flatShading: true }),
  );
  plaza.position.set(0, 0.14, -7.5);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const sea = new THREE.Mesh(
    new THREE.BoxGeometry(150, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x2e7f8f, roughness: 0.15, metalness: 0.1, flatShading: true }),
  );
  sea.position.set(0, 0.1, -19);
  scene.add(sea);
  // Park strip in the near foreground (trees + fountains) so the bottom of
  // the frame is a park, not empty tan ground.
  const park = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a8b5a, roughness: 1, flatShading: true }),
  );
  park.position.set(0, 0.15, 20);
  park.receiveShadow = true;
  scene.add(park);
  for (let x = -33; x <= 33; x += 7.5) {
    scene.add(palm(x, 18.5, 1.0));
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 1.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1, flatShading: true }),
    );
    trunk.position.y = 0.6;
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x3f7a4e, roughness: 1, flatShading: true }),
    );
    crown.position.y = 1.7;
    tree.add(trunk, crown);
    tree.position.set(x + 3.7, 0.3, 22.5);
    scene.add(tree);
  }
  for (const fx of [-14, 14]) {
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.6, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 1, flatShading: true }),
    );
    basin.position.set(fx, 0.55, 20);
    const jet = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x39b8c4, roughness: 0.15, flatShading: true }),
    );
    jet.position.set(fx, 1.1, 20);
    scene.add(basin, jet);
  }
  camera.position.set(0, 12, 50);
  camera.lookAt(0, 6, 0);
} else if (view === 'skyline') {
  document.title = 'AZZURRA — Downtown Bay Skyline';
  document.getElementById('title').textContent = 'AZZURRA · Downtown Bay Skyline — 12 towers, 20–60 floors';
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
  // Bay water in front of the towers.
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(170, 0.2, 70),
    new THREE.MeshStandardMaterial({ color: 0x2e7f8f, roughness: 0.12, metalness: 0.2, flatShading: true }),
  );
  water.position.set(0, 0.1, 26);
  scene.add(water);
  // Yachts on the bay for scale — white hull, cabin, tall mast, sail.
  for (const [bx, bz, s, sailColor] of [[-30, 16, 1.6, 0xf2f0ea], [-8, 24, 1.4, 0xff5c8a], [12, 14, 1.5, 0xf2f0ea], [28, 22, 1.3, 0x3ed6d6]]) {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3.6 * s, 0.7, 1.3 * s),
      new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6, flatShading: true }),
    );
    hull.position.set(bx, 0.45, bz);
    hull.rotation.y = 0.4;
    scene.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6 * s, 0.7, 0.9 * s),
      new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.6, flatShading: true }),
    );
    cabin.position.set(bx - 0.2 * s, 1.1, bz);
    cabin.rotation.y = 0.4;
    scene.add(cabin);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 4.5 * s, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }),
    );
    mast.position.set(bx, 2.6 * s, bz);
    scene.add(mast);
    const sail = new THREE.Mesh(
      new THREE.ConeGeometry(1.0 * s, 2.6 * s, 4),
      new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.7, flatShading: true, side: THREE.DoubleSide }),
    );
    sail.position.set(bx + 0.7 * s, 2.9 * s, bz);
    sail.scale.z = 0.15;
    sail.rotation.y = Math.PI / 4;
    scene.add(sail);
  }
  // Sun-glitter path on the water under the low sun.
  for (const gz of [6, 12, 18, 24]) {
    const glitter = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.05, 5),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc46b, emissiveIntensity: 0.5, roughness: 0.2 }),
    );
    glitter.position.set(-28, 0.25, gz);
    scene.add(glitter);
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
  document.title = 'AZZURRA — Character lineup';
  document.getElementById('title').textContent = 'AZZURRA · Character lineup — mains, crews, Harbor Guard, civilians';
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

let frames = 0, totalMs = 0, lastT = performance.now();
function frame(t) {
  const dt = 0.016;
  for (const a of animated) a.obj.rotation[a.axis] += a.speed * dt;
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
