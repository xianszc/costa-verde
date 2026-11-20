// AZZURRA — lineup viewer (Step 0 review tool).
// Renders two review shots from real code, no mocks:
//   ?view=buildings  — one hero building per district, in a row.
//   ?view=characters — all main characters + crew + police + civilians.
// The same builders (world.js / people.js) become the real game in M1+.
// This page stays a review tool; it is removed from the final entry.
import * as THREE from '../vendor/three.module.min.js';
import { DISTRICTS, buildHeroBuilding, goldenSkyTexture, goldenHourLights } from './world.js';
import { makeFigure, CAST, CREW, POLICE, CIVILIANS } from './people.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'buildings';
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
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
  new THREE.CircleGeometry(4.5, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
);
sunDisc.position.set(-34, 16, -60);
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
  const spacing = 8.2;
  DISTRICTS.forEach((d, i) => {
    const x = (i - 3.5) * spacing;
    pad(x, 0, d.pad);
    const b = buildHeroBuilding(d.id);
    b.position.set(x, 0.25, 0);
    scene.add(b);
    const pivot = b.getObjectByName('beamPivot');
    if (pivot) animated.push({ obj: pivot, axis: 'y', speed: 0.5 });
    const sails = b.getObjectByName('sails');
    if (sails) animated.push({ obj: sails, axis: 'z', speed: 0.35 });
    addLabel(`${i + 1} · ${d.name} — ${d.hero}`, new THREE.Vector3(x, 0.6, 3.6), 'district');
  });
  camera.position.set(0, 8.5, 50);
  camera.lookAt(0, 3.6, 0);
} else {
  document.title = 'AZZURRA — Character lineup';
  document.getElementById('title').textContent = 'AZZURRA · Character lineup — mains, crews, Harbor Guard, civilians';
  // Front row: 10 mains + 3 police. Back row: 6 crew + 6 civilians.
  const front = [...CAST, ...POLICE];
  const back = [...CREW, ...CIVILIANS];
  const placeRow = (list, z, spacing) => {
    list.forEach((c, i) => {
      const x = (i - (list.length - 1) / 2) * spacing;
      pad(x, z, 0x8a6a4a, 1.5, 1.5);
      const fig = makeFigure(c.spec);
      fig.position.set(x, 0.25, z);
      scene.add(fig);
      addLabel(`${c.name}`, new THREE.Vector3(x, fig.userData.height + 0.55, z), 'person');
      addLabel(`${c.role}`, new THREE.Vector3(x, fig.userData.height + 0.25, z), 'role');
    });
  };
  placeRow(front, 0.6, 1.65);
  placeRow(back, -2.4, 1.65);
  camera.position.set(0, 2.4, 16.5);
  camera.lookAt(0, 1.15, -0.9);
}

function frame(t) {
  const dt = 0.016;
  for (const a of animated) a.obj.rotation[a.axis] += a.speed * dt;
  renderer.render(scene, camera);
  updateLabels();
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
