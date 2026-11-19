// COSTA VERDE — main: loop, third-person camera, input, HUD, menu, save,
// Slice 1 objective, pedestrians, traffic, debug API (window.__costa).

import * as THREE from 'three';
import { CFG, DISTRICTS, SLICE1 } from './config.js';
import { buildWorld } from './world.js';
import { buildPlayer, randomPed, animateWalk } from './characters.js';
import { buildCar, makeCarState, updateCar, resolveCircle, makeTrafficCar, updateTraffic } from './vehicles.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- state ------------------------------------------------------------------
const state = {
  mode: 'menu', // menu | playing | paused
  driving: false,
  step: 0,
  cash: 0,
  clockMin: 17 * 60 + 42, // golden hour, 17:42
  speedKmh: 0,
  player: { x: SLICE1.heroSpawn.x, z: SLICE1.heroSpawn.z, heading: SLICE1.heroSpawn.heading, speed: 0 },
  walkPhase: 0,
  camYaw: Math.PI, // behind the player (player faces +Z at heading PI/2... see below)
  camPitch: 0.32,
  dragging: false,
  lastX: 0, lastY: 0,
  userOrbit: 0, // seconds since the user last dragged (auto-align pauses)
  helpTimer: 14,
  saved: false,
};

const keys = new Set();
let pressed = new Set();
function keyDown(e) {
  if (e.repeat) return;
  keys.add(e.code);
  pressed.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
}
function keyUp(e) { keys.delete(e.code); }
addEventListener('keydown', keyDown);
addEventListener('keyup', keyUp);

// --- renderer / scene --------------------------------------------------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CFG.sun.fogColor, CFG.sun.fogNear, CFG.sun.fogFar);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2200);

const { group: worldGroup, colliders, buildingCount, palmCount } = buildWorld(THREE);
scene.add(worldGroup);

// --- player ------------------------------------------------------------------
const player = buildPlayer();
player.group.position.set(state.player.x, 0, state.player.z);
scene.add(player.group);

// --- hero car ----------------------------------------------------------------
const hero = buildCar(CFG.heroCar.color, { hero: true });
const heroCar = makeCarState(SLICE1.carSpawn.x, SLICE1.carSpawn.z, SLICE1.carSpawn.heading, CFG.heroCar);
hero.group.position.set(heroCar.x, 0, heroCar.z);
hero.group.rotation.y = heroCar.heading;
scene.add(hero.group);

// --- Ana (Slice 1 objective NPC) --------------------------------------------
import { buildHumanoid } from './characters.js';
const ana = buildHumanoid({ shirt: 0x2e7f8f, pants: 0xe8e4da, skin: 0xf0c8a0, hair: 0x4a3220 });
ana.group.position.set(SLICE1.anaSpawn.x, 0, SLICE1.anaSpawn.z);
ana.group.rotation.y = Math.PI * 0.75;
scene.add(ana.group);

// Objective beacon (glowing pillar + floating diamond + ground ring).
const beacon = new THREE.Group();
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.9, 0.9, 26, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x70e000, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
);
beam.position.y = 13;
const diamond = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.1),
  new THREE.MeshBasicMaterial({ color: 0x70e000 }),
);
diamond.position.y = 6;
const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 3.0, 32),
  new THREE.MeshBasicMaterial({ color: 0x70e000, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.15;
beacon.add(beam, diamond, ring);
beacon.position.set(SLICE1.anaSpawn.x, 0, SLICE1.anaSpawn.z);
scene.add(beacon);

// --- traffic + pedestrians ----------------------------------------------------
const traffic = [];
{
  const spots = [
    [0, -185, 0], [0, -37, Math.PI], [0, 111, 0], [0, 37, Math.PI],
    [-185, 0, Math.PI / 2], [111, 0, -Math.PI / 2], [37, 0, Math.PI / 2],
  ];
  const rnd = mulberry32(77);
  for (let i = 0; i < CFG.traffic.count; i++) {
    const [x, z, h] = spots[i % spots.length];
    const t = makeTrafficCar(x, z + (rnd() - 0.5) * 8, h, CFG.traffic.colors[i % CFG.traffic.colors.length]);
    scene.add(t.group);
    traffic.push(t);
  }
}
const peds = [];
{
  const rnd = mulberry32(1234);
  for (let i = 0; i < CFG.peds.count; i++) {
    const h = randomPed(rnd);
    const x = -180 + rnd() * 360, z = -180 + rnd() * 360;
    h.group.position.set(x, 0, z);
    scene.add(h.group);
    peds.push({ h, x, z, tx: x, tz: z, heading: rnd() * Math.PI * 2, phase: rnd() * 6, speed: 1.4 + rnd() * 0.8 });
  }
}

// --- HUD ----------------------------------------------------------------------
const hud = {
  missionTitle: $('mission-title'),
  missionText: $('mission-text'),
  missionBar: $('mission-bar'),
  stars: $('stars'),
  cash: $('cash'),
  clock: $('clock'),
  speed: $('speed'),
  speedUnit: $('speed-unit'),
  vehicle: $('vehicle-name'),
  prompt: $('prompt'),
  toast: $('toast'),
  help: $('help'),
  district: $('district'),
  minimap: $('minimap'),
};
const mmCtx = hud.minimap.getContext('2d');
let toastTimer = 0;
function toast(text, secs = 5) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  toastTimer = secs;
}
function fmtClock(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function districtAt(x, z) {
  let best = DISTRICTS[0], bd = 1e9;
  for (const d of DISTRICTS) {
    const dd = (x - d.cx) ** 2 + (z - d.cz) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

function drawMinimap() {
  const S = 180, W = 560;
  const px = (v) => ((v + W / 2) / W) * S;
  mmCtx.clearRect(0, 0, S, S);
  mmCtx.fillStyle = '#16202b';
  mmCtx.fillRect(0, 0, S, S);
  // Sea.
  mmCtx.fillStyle = '#2e7f8f';
  mmCtx.fillRect(px(236), 0, S - px(236), S);
  // Buildings (from colliders, small city rects only).
  mmCtx.fillStyle = '#5a6f8f';
  for (const c of colliders) {
    const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
    if (w > 60 || d > 60 || w < 2 || d < 2) continue;
    if (c.minX > 210 || c.maxX < -240) continue;
    mmCtx.fillRect(px(c.minX), px(c.minZ), Math.max(2, px(w) - px(0)), Math.max(2, px(d) - px(0)));
  }
  // Roads.
  mmCtx.strokeStyle = '#3a3a40';
  mmCtx.lineWidth = 4;
  for (const x of [-185, -111, -37, 37, 111, 185]) {
    mmCtx.beginPath(); mmCtx.moveTo(px(x), 0); mmCtx.lineTo(px(x), S); mmCtx.stroke();
    mmCtx.beginPath(); mmCtx.moveTo(0, px(x)); mmCtx.lineTo(S, px(x)); mmCtx.stroke();
  }
  // Objective.
  if (state.step === 0) {
    mmCtx.fillStyle = '#70e000';
    mmCtx.beginPath(); mmCtx.arc(px(SLICE1.anaSpawn.x), px(SLICE1.anaSpawn.z), 6, 0, 7); mmCtx.fill();
  }
  // Hero car.
  mmCtx.fillStyle = '#70e000';
  mmCtx.fillRect(px(heroCar.x) - 3, px(heroCar.z) - 3, 6, 6);
  // Player arrow (car position + heading while driving).
  const p = state.driving ? { x: heroCar.x, z: heroCar.z, heading: heroCar.heading } : state.player;
  mmCtx.save();
  mmCtx.translate(px(p.x), px(p.z));
  mmCtx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI / 2);
  mmCtx.fillStyle = '#ffffff';
  mmCtx.beginPath(); mmCtx.moveTo(0, -7); mmCtx.lineTo(5, 6); mmCtx.lineTo(-5, 6); mmCtx.closePath(); mmCtx.fill();
  mmCtx.restore();
}

function updateHUD(dt) {
  const step = SLICE1.steps[state.step];
  hud.missionTitle.textContent = `MISSION 1/1 — ${SLICE1.title}`;
  hud.missionText.textContent = step ? step.text : '';
  hud.missionBar.style.width = `${(state.step / (SLICE1.steps.length - 1)) * 100}%`;
  hud.stars.textContent = '☆☆☆☆☆';
  hud.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
  hud.clock.textContent = fmtClock(state.clockMin);
  // District + minimap follow the car while driving, the player on foot.
  const focus = state.driving ? heroCar : state.player;
  hud.district.textContent = districtAt(focus.x, focus.z).name;
  if (state.driving) {
    hud.speed.textContent = String(Math.round(Math.abs(heroCar.speed) * 3.6));
    hud.speedUnit.textContent = 'km/h';
    hud.vehicle.textContent = CFG.heroCar.name;
  } else {
    hud.speed.textContent = state.player.speed > 0.5 ? String(Math.round(state.player.speed * 3.6)) : '0';
    hud.speedUnit.textContent = 'km/h';
    hud.vehicle.textContent = 'ON FOOT';
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) hud.toast.style.opacity = '0';
  }
  if (state.helpTimer > 0) {
    state.helpTimer -= dt;
    if (state.helpTimer <= 0) hud.help.style.opacity = '0.35';
  }
  drawMinimap();
}

// --- camera -------------------------------------------------------------------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
function updateCamera(dt, t) {
  let tx, tz, ty, dist, pitch;
  if (state.mode === 'menu') {
    // Slow orbit around the city centre behind the menu.
    const a = t * 0.05;
    tx = 0; tz = 0; ty = 0;
    camTarget.set(0, 12, 0);
    camPos.set(Math.sin(a) * 150, 55, Math.cos(a) * 150);
    camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    camera.lookAt(camTarget);
    return;
  }
  const focus = state.driving
    ? { x: heroCar.x, z: heroCar.z, y: 1.6, heading: heroCar.heading }
    : { x: state.player.x, z: state.player.z, y: 1.6, heading: state.player.heading };
  // Auto-align behind the heading when the user is not dragging.
  if (state.userOrbit <= 0) {
    const behind = focus.heading + Math.PI;
    state.camYaw = lerpAngle(state.camYaw, behind, 1 - Math.pow(0.02, dt));
  }
  dist = state.driving ? 11 : 7.5;
  pitch = state.camPitch;
  const cx = focus.x + Math.sin(state.camYaw) * Math.cos(pitch) * dist;
  const cz = focus.z + Math.cos(state.camYaw) * Math.cos(pitch) * dist;
  const cy = focus.y + Math.sin(pitch) * dist + 1.2;
  camTarget.set(focus.x, focus.y, focus.z);
  camPos.set(cx, cy, cz);
  camera.position.lerp(camPos, 1 - Math.pow(0.0001, dt));
  camera.lookAt(camTarget);
}

// Mouse drag orbits the camera.
canvas.addEventListener('pointerdown', (e) => {
  state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  state.camYaw -= (e.clientX - state.lastX) * 0.006;
  state.camPitch = clamp(state.camPitch + (e.clientY - state.lastY) * 0.004, 0.08, 1.1);
  state.lastX = e.clientX; state.lastY = e.clientY;
  state.userOrbit = 3;
});
canvas.addEventListener('pointerup', () => { state.dragging = false; });

// --- objective -----------------------------------------------------------------
function checkObjective() {
  if (state.step === 0) {
    const t = SLICE1.steps[0].target;
    const d = Math.hypot(state.player.x - t.x, state.player.z - t.z);
    if (d < SLICE1.steps[0].radius) {
      state.step = 1;
      toast('Ana: "Leo! The Verde GT is yours — take it for a spin. Lose yourself in the city."', 6);
      saveGame();
    }
  }
}
function completeSlice1() {
  if (state.step !== 1) return;
  state.step = 2;
  state.cash += 500;
  toast('Slice 1 complete — free roam. The city is yours, Leo.', 6);
  saveGame();
}

// --- save ----------------------------------------------------------------------
function saveGame() {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      cash: state.cash, step: state.step,
      x: state.player.x, z: state.player.z,
    }));
    state.saved = true;
    refreshMenuButtons();
  } catch { /* storage unavailable — game still plays */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.cash = s.cash || 0;
    state.step = s.step || 0;
    state.player.x = s.x ?? SLICE1.heroSpawn.x;
    state.player.z = s.z ?? SLICE1.heroSpawn.z;
    return true;
  } catch { return false; }
}
function clearSave() {
  try { localStorage.removeItem(CFG.saveKey); } catch { /* ignore */ }
  state.saved = false;
  state.cash = 0; state.step = 0;
  state.player.x = SLICE1.heroSpawn.x; state.player.z = SLICE1.heroSpawn.z;
  refreshMenuButtons();
}

// --- menu -----------------------------------------------------------------------
const menuEl = $('menu'), pauseEl = $('pause');
function refreshMenuButtons() {
  const has = (() => { try { return !!localStorage.getItem(CFG.saveKey); } catch { return state.saved; } })();
  $('btn-continue').disabled = !has;
  $('btn-continue').textContent = has ? 'Continue' : 'Continue — No saved game yet';
}
function showMenu() {
  state.mode = 'menu';
  menuEl.classList.remove('hidden');
  pauseEl.classList.add('hidden');
  refreshMenuButtons();
}
function startGame(fresh) {
  if (fresh) {
    state.cash = 0; state.step = 0;
    state.player.x = SLICE1.heroSpawn.x; state.player.z = SLICE1.heroSpawn.z;
    state.player.heading = SLICE1.heroSpawn.heading;
    heroCar.x = SLICE1.carSpawn.x; heroCar.z = SLICE1.carSpawn.z;
    heroCar.heading = SLICE1.carSpawn.heading; heroCar.speed = 0;
  } else {
    loadGame();
  }
  state.mode = 'playing';
  state.driving = false;
  state.helpTimer = 14;
  menuEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  player.group.visible = true;
  toast(fresh ? 'Costa Verde, 17:42. Golden hour. Find Ana at the Marina.' : 'Welcome back, Leo.', 5);
}
$('btn-new').addEventListener('click', () => startGame(true));
$('btn-continue').addEventListener('click', () => startGame(false));
$('btn-controls').addEventListener('click', () => { $('panel-controls').classList.toggle('hidden'); });
$('btn-settings').addEventListener('click', () => { $('panel-settings').classList.toggle('hidden'); });
$('btn-credits').addEventListener('click', () => { $('panel-credits').classList.toggle('hidden'); });
$('btn-reset-save').addEventListener('click', () => { clearSave(); toast('Save cleared.', 3); });
$('cam-sens').addEventListener('input', (e) => { state.camSens = Number(e.target.value); });
$('btn-resume').addEventListener('click', () => { state.mode = 'playing'; pauseEl.classList.add('hidden'); });
$('btn-restart').addEventListener('click', () => startGame(true));
$('btn-quit').addEventListener('click', () => { saveGame(); showMenu(); });
state.camSens = 1;

// --- game step (fixed timestep) --------------------------------------------------
function stepGame(dt) {
  state.clockMin += dt * 0.12; // slow golden-hour drift
  if (state.userOrbit > 0) state.userOrbit -= dt;

  // Pedestrians: walk to a waypoint, then pick a new one.
  for (const p of peds) {
    const dx = p.tx - p.x, dz = p.tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      p.tx = -180 + Math.random() * 360;
      p.tz = -180 + Math.random() * 360;
      continue;
    }
    const target = Math.atan2(dx, dz);
    p.heading = lerpAngle(p.heading, target, 1 - Math.pow(0.01, dt));
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.phase += p.speed * dt * 2.2;
    p.h.group.position.set(p.x, 0, p.z);
    p.h.group.rotation.y = p.heading;
    animateWalk(p.h, p.phase, 1);
  }
  for (const t of traffic) updateTraffic(t, dt);

  // Ana idle.
  animateWalk(ana, performance.now() * 0.001, 0);

  // Beacon bob + spin.
  diamond.position.y = 6 + Math.sin(performance.now() * 0.002) * 0.5;
  diamond.rotation.y += dt * 1.5;
  beam.material.opacity = 0.18 + Math.sin(performance.now() * 0.003) * 0.06;

  if (state.mode !== 'playing') { pressed.clear(); return; }

  if (pressed.has('KeyP') || pressed.has('Escape')) {
    state.mode = 'paused';
    pauseEl.classList.remove('hidden');
    saveGame();
  }

  if (!state.driving) {
    // --- on foot ---
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = run ? CFG.player.runSpeed : CFG.player.walkSpeed;
    let mx = 0, mz = 0;
    // Movement relative to the camera yaw.
    const fwd = { x: -Math.sin(state.camYaw), z: -Math.cos(state.camYaw) };
    const right = { x: -fwd.z, z: fwd.x };
    if (keys.has('KeyW') || keys.has('ArrowUp')) { mx += fwd.x; mz += fwd.z; }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { mx -= fwd.x; mz -= fwd.z; }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= right.x; mz -= right.z; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += right.x; mz += right.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      state.player.heading = lerpAngle(state.player.heading, targetHeading, 1 - Math.pow(0.001, dt));
      state.player.speed += (speed - state.player.speed) * Math.min(1, CFG.player.accel * dt / speed);
      const pos = { x: state.player.x, z: state.player.z };
      pos.x += mx * state.player.speed * dt;
      pos.z += mz * state.player.speed * dt;
      resolveCircle(pos, CFG.player.radius, colliders);
      state.player.x = pos.x; state.player.z = pos.z;
      state.walkPhase += state.player.speed * dt * 1.6;
    } else {
      state.player.speed = Math.max(0, state.player.speed - 30 * dt);
    }
    player.group.position.set(state.player.x, 0, state.player.z);
    player.group.rotation.y = state.player.heading;
    animateWalk(player, state.walkPhase, clamp(state.player.speed / CFG.player.runSpeed, 0, 1));

    // Near the hero car? Show the prompt / enter on E.
    const cd = Math.hypot(state.player.x - heroCar.x, state.player.z - heroCar.z);
    if (cd < 3.2) {
      hud.prompt.textContent = 'Press E — Enter the Verde GT';
      hud.prompt.style.opacity = '1';
      if (pressed.has('KeyE')) {
        state.driving = true;
        player.group.visible = false;
        hud.prompt.style.opacity = '0';
        toast('Verde GT — yours now. W/S to drive, Space to handbrake.', 4);
        completeSlice1();
      }
    } else {
      hud.prompt.style.opacity = '0';
    }
    checkObjective();
  } else {
    // --- driving ---
    const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
      + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0);
    const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0)
      + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    const handbrake = keys.has('Space');
    updateCar(heroCar, { throttle, steer, handbrake }, dt, colliders);
    hero.group.position.set(heroCar.x, 0, heroCar.z);
    hero.group.rotation.y = heroCar.heading;
    const spin = (heroCar.speed * dt) / 0.36;
    for (const w of hero.wheels) w.rotation.x += spin;
    state.speedKmh = Math.abs(heroCar.speed) * 3.6;
    if (pressed.has('KeyE')) {
      // Exit beside the car.
      state.driving = false;
      const side = { x: Math.cos(heroCar.heading), z: -Math.sin(heroCar.heading) };
      state.player.x = heroCar.x + side.x * 2.2;
      state.player.z = heroCar.z + side.z * 2.2;
      state.player.heading = heroCar.heading;
      player.group.visible = true;
      player.group.position.set(state.player.x, 0, state.player.z);
      toast('On foot. The GT waits for you.', 3);
    }
  }
  updateHUD(dt);
  pressed.clear(); // consume edge-triggered keys once per sub-step
}

// --- main loop (fixed timestep so game-time stays real at low FPS) ---------------
const STEP = 1 / 60;
let last = performance.now() / 1000;
let acc = 0;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  let dt = Math.min(now - last, 0.5); // 0.5s cap: keeps game-time real even at ~3 FPS (SwiftShader)
  last = now;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 20) {
    stepGame(STEP);
    acc -= STEP;
    n++;
  }
  if (n === 20) acc = 0; // drop backlog rather than spiral
  updateCamera(dt, now);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- boot -----------------------------------------------------------------------
refreshMenuButtons();
showMenu();
requestAnimationFrame(frame);

// --- debug API (playtest + screenshot drivers) -----------------------------------
window.__costa = {
  state,
  heroCar,
  version: 'slice1',
  teleport(x, z) { state.player.x = x; state.player.z = z; player.group.position.set(x, 0, z); },
  enterCar() { state.driving = true; player.group.visible = false; },
  exitCar() { state.driving = false; player.group.visible = true; },
  setStep(n) { state.step = n; },
  start(fresh = true) { startGame(fresh); },
  shots: {
    menu() {
      // Clean menu state: stop the car, show the title over the orbiting city.
      state.driving = false; heroCar.speed = 0; player.group.visible = true;
      state.player.x = SLICE1.heroSpawn.x; state.player.z = SLICE1.heroSpawn.z;
      showMenu(); state.camYaw = Math.PI * 0.9;
    },
    onfoot() { startGame(true); state.player.x = 40; state.player.z = -60; state.player.heading = Math.PI * 0.7; state.camYaw = state.player.heading + Math.PI; },
    driving() {
      startGame(true);
      state.driving = true; player.group.visible = false;
      heroCar.x = 185; heroCar.z = 40; heroCar.heading = Math.PI; heroCar.speed = 22;
      state.camYaw = heroCar.heading + Math.PI;
    },
    marina() {
      startGame(true);
      state.player.x = 150; state.player.z = -30; state.player.heading = Math.PI * 0.6;
      state.camYaw = state.player.heading + Math.PI;
    },
  },
};
