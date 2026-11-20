// AZZURRA — game entry point (Step 0: title screen boot).
// Renders a golden-hour harbor backdrop behind the title card: gradient sky,
// low sun, turquoise sea plane, and the lighthouse beam sweeping the water.
// The playable world (M1+) grows from this boot: same renderer, same lights,
// same district builders from world.js.
import * as THREE from '../vendor/three.module.min.js';
import { goldenSkyTexture, goldenHourLights, buildHeroBuilding } from './world.js';

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
window.__gameErrors = errors;

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
scene.fog = new THREE.Fog(0xf2a35e, 60, 160);
goldenHourLights(scene);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 6, 26);
camera.lookAt(0, 4, 0);

// Sun disc.
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(5, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
);
sunDisc.position.set(-40, 15, -70);
sunDisc.lookAt(camera.position);
scene.add(sunDisc);

// Turquoise sea plane.
const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x2e7f8f, roughness: 0.35, metalness: 0.1, flatShading: true }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -0.4;
sea.receiveShadow = true;
scene.add(sea);

// A strip of harbor: the lighthouse on a stone point + the marina pavilion,
// so the title screen already shows the town's silhouette.
const lh = buildHeroBuilding('lighthouse');
lh.position.set(-9, 0, -6);
lh.scale.setScalar(0.9);
scene.add(lh);
const marina = buildHeroBuilding('marina');
marina.position.set(8, 0, -4);
marina.scale.setScalar(0.8);
scene.add(marina);

// Ground strip between sea and buildings.
const quay = new THREE.Mesh(
  new THREE.BoxGeometry(60, 0.5, 14),
  new THREE.MeshStandardMaterial({ color: 0xcbb28a, roughness: 1, flatShading: true }),
);
quay.position.set(0, 0.1, 2);
quay.receiveShadow = true;
scene.add(quay);

const beamPivot = lh.getObjectByName('beamPivot');
let t = 0;
function frame() {
  t += 0.016;
  if (beamPivot) beamPivot.rotation.y += 0.008;
  // Gentle sea shimmer: tiny vertical bob of the sun's reflection is faked by
  // slowly pulsing the sea color between turquoise and gold.
  sea.material.color.setHSL(0.52 - Math.sin(t * 0.2) * 0.02, 0.55, 0.42);
  renderer.render(scene, camera);
  if (!window.__gameReady) window.__gameReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('title-card').innerHTML =
      '<h1 style="font-size:44px;letter-spacing:6px">THE TOWN AWAITS</h1>' +
      '<p class="tag">M1 — PLAYABLE CORE COMING NEXT · WALK · DRIVE · SAIL</p>';
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
