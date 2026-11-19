// COSTA VERDE Slice 3 — main: loop, third-person camera, input, HUD, menu,
// save, Slice 1 objective, pedestrians, traffic, wanted + police, combat,
// story missions 2–5, side jobs (fares, deliveries, caches), reputation,
// garage upgrades, dialogue, nitro.
// Slice 3 (content): 5-mission story arc, side activities, progression.
// v1.1 kept: closer camera, dense city, busy streets, fixed timestep.

import * as THREE from 'three';
import { CFG, DISTRICTS, SLICE1, PARKED_CARS, MISSIONS, ESCORT, REP_LEVELS, REP_GAIN, UPGRADES } from './config.js';
import { buildWorld } from './world.js';
import { buildPlayer, randomPed, animateWalk, buildHumanoid } from './characters.js';
import {
  buildCar, buildVan, buildDriveable, makeCarState, updateCar, resolveCircle,
  makeTrafficCar, updateTraffic,
} from './vehicles.js';
import { makeWanted, addHeat, updateWanted, makePolice } from './police.js';
import { makePistol, startReload, updatePistol, firePistol } from './combat.js';
import { makeAudio } from './audio.js';
import { makeFx } from './fx.js';
import { createMissionSystem } from './missions.js';
import { createSideJobs } from './side.js';

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
  mode: 'menu', // menu | playing | paused | busted | wasted | dialogue | garage | failed | story
  driving: false,
  step: 0,
  cash: 0,
  rep: 0, // reputation points (Slice 3 progression)
  clockMin: 17 * 60 + 42, // golden hour, 17:42
  speedKmh: 0,
  health: CFG.player.maxHealth,
  maxHealth: CFG.player.maxHealth, // armour upgrade raises it to 150
  nitro: 1, // nitro meter 0..1 (Slice 3 garage upgrade)
  upgrades: { armour: false, nitro: false, engine: false },
  gameTime: 0, // seconds of game time (fixed-step clock, drives police/pistol)
  player: { x: SLICE1.heroSpawn.x, z: SLICE1.heroSpawn.z, heading: SLICE1.heroSpawn.heading, speed: 0 },
  walkPhase: 0,
  camYaw: Math.PI,
  camPitch: CFG.camera.pitch,
  camDist: null, // override for staged shots (null = CFG distance)
  freeCam: null, // Round 5 debug: {x,y,z,tx,ty,tz} — fixed camera for inspection/cover shots
  dragging: false,
  lastX: 0, lastY: 0,
  userOrbit: 0, // seconds since the user last dragged (auto-align pauses)
  helpTimer: 14,
  saved: false,
  shake: 0,
  fleeUntil: 0, // peds flee while gameTime < this
  hitmarkTimer: 0,
  dmgFlash: 0, // Slice 4: damage vignette flash (decays in updateHUD)
  skidCd: 0, // Slice 4: throttle for laying skid marks
  playerRamCd: 0, // cooldown between heat gains from ramming a cruiser
  dialogue: null, // { lines, idx, onDone } while a briefing is open
  staging: false, // true while a screenshot recipe stages a shot (no fare spawns)
};

const wanted = makeWanted();
const pistol = makePistol();
const audio = makeAudio();

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
const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, 0.1, 2200);

const { group: worldGroup, colliders, buildingCount, palmCount, sun: sunLight, hemi: hemiLight, fill: fillLight, layout: cityLayout } = buildWorld(THREE);
scene.add(worldGroup);
const fx = makeFx(scene); // Slice 4 particles (needs the scene — must come after it)

// --- player ------------------------------------------------------------------
const player = buildPlayer();
player.group.position.set(state.player.x, 0, state.player.z);
scene.add(player.group);

// --- driveables: hero GT + stealable parked cars -----------------------------
// Every entry: { group, wheels, car, spec, name, specKey, parked, collider }.
// The GT is Ana's gift (entering it never adds heat); any other parked car
// is a steal (+1 heat). Parked cars carry a collider while parked.
const driveables = [];
function carCollider(x, z, heading) {
  // Footprint 2.4 x 4.8, swapped when the car lies along X.
  const alongX = Math.abs(Math.sin(heading)) > 0.7;
  const hx = alongX ? 2.4 : 1.2, hz = alongX ? 1.2 : 2.4;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}
function parkCollider(e) {
  if (e.collider) return;
  e.collider = carCollider(e.car.x, e.car.z, e.car.heading);
  colliders.push(e.collider);
}
function unparkCollider(e) {
  if (!e.collider) return;
  const i = colliders.indexOf(e.collider);
  if (i >= 0) colliders.splice(i, 1);
  e.collider = null;
}
function addDriveable(specKey, x, z, heading, parked) {
  const e = buildDriveable(specKey);
  e.car.x = x; e.car.z = z; e.car.heading = heading;
  e.group.position.set(x, 0, z);
  e.group.rotation.y = heading;
  e.parked = parked;
  e.collider = null;
  if (parked) parkCollider(e);
  scene.add(e.group);
  driveables.push(e);
  return e;
}
const heroEntry = addDriveable('verdeGT', SLICE1.carSpawn.x, SLICE1.carSpawn.z, SLICE1.carSpawn.heading, false);
const heroCar = heroEntry.car; // kept for the debug API + playtest
let drivingCar = null; // the entry currently driven (null on foot)
for (const p of PARKED_CARS) addDriveable(p.spec, p.x, p.z, p.heading, true);

// --- police (Slice 2) ---------------------------------------------------------
const police = makePolice(scene, colliders);
const policeHooks = {
  ram(dmg) { damagePlayer(dmg); state.shake = Math.min(1, state.shake + 0.4); },
  shot(fromX, fromZ) {
    // A cop fires at the player on foot; the shot may miss.
    if (Math.random() >= CFG.police.shootHitChance) return;
    damagePlayer(CFG.police.shootDamage);
    drawCopTracer(fromX, fromZ);
  },
};

// --- Slice 3 systems: story missions + side jobs -----------------------------
// The world interface the two modules get: everything they need from
// main.js, nothing more. (All of these are function declarations below, so
// hoisting makes them available here.)
const world = {
  scene, colliders,
  get player() { return state.player; },
  get driving() { return state.driving; },
  get drivingCar() { return drivingCar; },
  get gameTime() { return state.gameTime; },
  get rep() { return state.rep; },
  get staging() { return state.staging; },
  toast,
  showDialogue,
  showFailed,
  fade() { fadePulse(); }, // Slice 4: black fade on mission start/finish/fail
  moveBeacon,
  hideBeacon,
  moveSideBeacon,
  hideSideBeacon,
  addHeat(n) { addHeat(wanted, n, state.gameTime); },
  clearHeat() {
    wanted.heat = 0; wanted.wanted = 0; wanted.bustTimer = 0;
    police.clearAll();
    audio.setSiren(0);
  },
  damagePlayer,
  sting(kind) { audio.sting(kind); },
  drawTracer,
  spawnDamageNumber,
  addCash(n) { state.cash += n; },
  addRep(n) { state.rep += n; },
  save: saveGame,
  teleportPlayer(x, z) {
    state.player.x = x; state.player.z = z;
    player.group.position.set(x, 0, z);
  },
  onStoryComplete,
};
const missions = createMissionSystem(world);
const side = createSideJobs(world);

// --- Ana (Slice 1 objective NPC) --------------------------------------------
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

// Second beacon (Slice 3, amber) — the active side-job target (fare drop,
// delivery drop). The story beacon stays green; amber means side money.
const sideBeacon = new THREE.Group();
const sideBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.7, 0.7, 22, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
);
sideBeam.position.y = 11;
const sideDiamond = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.9),
  new THREE.MeshBasicMaterial({ color: 0xf2c14e }),
);
sideDiamond.position.y = 5;
const sideRing = new THREE.Mesh(
  new THREE.RingGeometry(1.8, 2.5, 32),
  new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
);
sideRing.rotation.x = -Math.PI / 2;
sideRing.position.y = 0.15;
sideBeacon.add(sideBeam, sideDiamond, sideRing);
sideBeacon.visible = false;
scene.add(sideBeacon);

// Beacon control (Slice 3): the story beacon follows the active mission
// (Ana while a job waits, the objective while one runs); the amber beacon
// follows the active side job. Called every sub-step from stepGame.
function moveBeacon(x, z) {
  beacon.visible = true;
  beacon.position.set(x, 0, z);
}
function hideBeacon() { beacon.visible = false; }
function moveSideBeacon(x, z) {
  sideBeacon.visible = true;
  sideBeacon.position.set(x, 0, z);
}
function hideSideBeacon() { sideBeacon.visible = false; }
function updateBeacons() {
  // Story beacon.
  let t = null;
  if (missions.missionIdx === 0 && missions.status === 'none') {
    t = state.step === 0 ? SLICE1.anaSpawn : null;
  } else {
    t = missions.beaconTarget();
  }
  if (t) moveBeacon(t.x, t.z);
  else hideBeacon();
  // Side beacon.
  const st = side.sideTarget();
  if (st) moveSideBeacon(st.x, st.z);
  else hideSideBeacon();
}

// --- traffic (18 cars, all roads incl. the boulevard, mixed cars + vans) -----
const traffic = [];
{
  const rnd = mulberry32(77);
  const roadLines = [-185, -111, -37, 37, 111, 185];
  for (let i = 0; i < CFG.traffic.count; i++) {
    const vertical = rnd() < 0.55;
    const line = roadLines[Math.floor(rnd() * roadLines.length)];
    const along = -190 + rnd() * 380;
    const dir = rnd() < 0.5 ? 1 : -1;
    let x, z, h;
    if (vertical) {
      x = line + (dir > 0 ? -3.2 : 3.2); // right-hand lane
      z = along;
      h = dir > 0 ? 0 : Math.PI;
    } else {
      z = line + (dir > 0 ? -3.2 : 3.2);
      x = along;
      h = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const kind = rnd() < 0.3 ? 'van' : 'car';
    const color = CFG.traffic.colors[i % CFG.traffic.colors.length];
    const t = makeTrafficCar(x, z, h, color, kind);
    scene.add(t.group);
    traffic.push(t);
  }
}

// --- pedestrians (32 — crowded sidewalks, biased to Marina / boulevard) --------
const peds = [];
{
  const rnd = mulberry32(1234);
  for (let i = 0; i < CFG.peds.count; i++) {
    const h = randomPed(rnd);
    let x, z;
    if (rnd() < 0.5) {
      x = 140 + rnd() * 60; // 140..200 (Marina + boulevard)
      z = -120 + rnd() * 220; // -120..100
    } else {
      x = -180 + rnd() * 360; z = -180 + rnd() * 360;
    }
    h.group.position.set(x, 0, z);
    scene.add(h.group);
    peds.push({ h, x, z, tx: x, tz: z, heading: rnd() * Math.PI * 2, phase: rnd() * 6, speed: 1.4 + rnd() * 0.8, downUntil: 0 });
  }
}

// --- tracer line (pistol + cop shots) ------------------------------------------
const tracerGeo = new THREE.BufferGeometry();
tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const tracerMat = new THREE.LineBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0 });
const tracer = new THREE.Line(tracerGeo, tracerMat);
tracer.frustumCulled = false;
scene.add(tracer);
let tracerLife = 0;
function drawTracer(from, to) {
  const p = tracerGeo.attributes.position.array;
  p[0] = from.x; p[1] = from.y; p[2] = from.z;
  p[3] = to.x; p[4] = to.y; p[5] = to.z;
  tracerGeo.attributes.position.needsUpdate = true;
  tracerMat.opacity = 0.9;
  tracerLife = 0.09;
}
function drawCopTracer(fromX, fromZ) {
  drawTracer({ x: fromX, y: 1.4, z: fromZ }, { x: state.player.x, y: 1.2, z: state.player.z });
}

// --- HUD ----------------------------------------------------------------------
const hud = {
  missionTitle: $('mission-title'),
  missionText: $('mission-text'),
  missionNext: $('mission-next'),
  missionTimer: $('mission-timer'),
  missionBar: $('mission-bar'),
  escortWrap: $('escort-wrap'),
  escortBar: $('escort-bar'),
  stars: $('stars'),
  cash: $('cash'),
  rep: $('rep'),
  caches: $('caches'),
  clock: $('clock'),
  speed: $('speed'),
  speedUnit: $('speed-unit'),
  vehicle: $('vehicle-name'),
  weapon: $('weapon'),
  nitroWrap: $('nitro-wrap'),
  nitroBar: $('nitro-bar'),
  healthBar: $('health-bar'),
  prompt: $('prompt'),
  toast: $('toast'),
  help: $('help'),
  district: $('district'),
  minimap: $('minimap'),
  policePanel: $('police'),
  policeList: $('police-list'),
  crosshair: $('crosshair'),
  hitmarker: $('hitmarker'),
  dmgLayer: $('dmg-layer'),
  vignette: $('vignette'),
  speedlines: $('speedlines'),
  fadeEl: $('fade'),
  dialogue: $('dialogue'),
  dialogueSpeaker: $('dialogue-speaker'),
  dialogueText: $('dialogue-text'),
};
const mmCtx = hud.minimap.getContext('2d');
let toastTimer = 0;
let lastPoliceHtml = '';
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
  // Objective (Slice 3): the story beacon's green dot on the minimap.
  const objTarget = missions.missionIdx === 0 && missions.status === 'none'
    ? (state.step === 0 ? SLICE1.anaSpawn : null)
    : missions.beaconTarget();
  if (objTarget) {
    mmCtx.fillStyle = '#70e000';
    mmCtx.beginPath(); mmCtx.arc(px(objTarget.x), px(objTarget.z), 6, 0, 7); mmCtx.fill();
  }
  // Side-job target (amber).
  const st = side.sideTarget();
  if (st) {
    mmCtx.fillStyle = '#f2c14e';
    mmCtx.beginPath(); mmCtx.arc(px(st.x), px(st.z), 5, 0, 7); mmCtx.fill();
  }
  // Mission + side-job dots (enemies red, escort teal, hunters orange,
  // fares amber, crates yellow, nearby caches green).
  for (const d of [...missions.minimapDots(), ...side.minimapDots()]) {
    mmCtx.fillStyle = d.color;
    mmCtx.beginPath(); mmCtx.arc(px(d.x), px(d.z), d.r, 0, 7); mmCtx.fill();
  }
  // Police blips (red) + heli (amber).
  for (const u of police.units) {
    mmCtx.fillStyle = '#ff3b30';
    mmCtx.beginPath(); mmCtx.arc(px(u.car.x), px(u.car.z), 4, 0, 7); mmCtx.fill();
  }
  if (police.heli) {
    mmCtx.fillStyle = '#ffc21a';
    mmCtx.beginPath(); mmCtx.arc(px(police.heli.group.position.x), px(police.heli.group.position.z), 4, 0, 7); mmCtx.fill();
  }
  // Current car (lime) — the GT or whatever Leo is driving.
  const cur = drivingCar ? drivingCar.car : heroCar;
  mmCtx.fillStyle = '#70e000';
  mmCtx.fillRect(px(cur.x) - 3, px(cur.z) - 3, 6, 6);
  // Player arrow (car position + heading while driving).
  const p = state.driving ? { x: cur.x, z: cur.z, heading: cur.heading } : state.player;
  mmCtx.save();
  mmCtx.translate(px(p.x), px(p.z));
  mmCtx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI / 2);
  mmCtx.fillStyle = '#ffffff';
  mmCtx.beginPath(); mmCtx.moveTo(0, -7); mmCtx.lineTo(5, 6); mmCtx.lineTo(-5, 6); mmCtx.closePath(); mmCtx.fill();
  mmCtx.restore();
}

function fmtTimer(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// Reputation level for the current rep total (Slice 3 progression).
function repLevel() {
  let lvl = REP_LEVELS[0];
  for (const l of REP_LEVELS) if (state.rep >= l.min) lvl = l;
  const idx = REP_LEVELS.indexOf(lvl);
  const next = REP_LEVELS[idx + 1] || null;
  return { ...lvl, next, progress: next ? state.rep - lvl.min : 0, need: next ? next.min - lvl.min : 0 };
}

// --- screen fade (Slice 4): a black pulse on mission start/finish, BUSTED
// and WASTED — a cheap transition that makes the big moments land.
let fadeTimer = null;
function fadePulse() {
  hud.fadeEl.style.opacity = '1';
  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => { hud.fadeEl.style.opacity = '0'; }, 90);
}

function updateHUD(dt) {
  // Mission panel: Slice 3 story missions (n/5) when the story system owns
  // the objective, otherwise the Slice 1 objective.
  const obj = missions.currentObjective();
  if (obj) {
    hud.missionTitle.textContent = `MISSION ${obj.num}/${obj.total} — ${obj.title}`;
    hud.missionText.textContent = obj.text;
    hud.missionBar.style.width = `${obj.progress * 100}%`;
    hud.missionNext.textContent = obj.next ? `NEXT: ${obj.next}` : '';
    if (obj.timer > 0) {
      hud.missionTimer.classList.remove('hidden');
      hud.missionTimer.textContent = `⏱ ${fmtTimer(obj.timer)}`;
    } else {
      hud.missionTimer.classList.add('hidden');
    }
    if (obj.escortHp >= 0) {
      hud.escortWrap.classList.remove('hidden');
      hud.escortBar.style.width = `${clamp(obj.escortHp, 0, 100)}%`;
      hud.escortBar.style.background = obj.escortHp > 50 ? '#2e7f8f' : obj.escortHp > 25 ? '#f2c14e' : '#ff3b30';
    } else {
      hud.escortWrap.classList.add('hidden');
    }
  } else {
    const step = SLICE1.steps[state.step];
    hud.missionTitle.textContent = `MISSION 1/5 — ${SLICE1.title}`;
    hud.missionText.textContent = step ? step.text : '';
    hud.missionBar.style.width = `${(state.step / (SLICE1.steps.length - 1)) * 100}%`;
    hud.missionNext.textContent = state.step === 0 ? 'NEXT: Take the GT for a spin.' : 'NEXT: Ana will have more work for you.';
    hud.missionTimer.classList.add('hidden');
    hud.escortWrap.classList.add('hidden');
  }
  hud.stars.textContent = '★'.repeat(wanted.wanted) + '☆'.repeat(CFG.wanted.maxStars - wanted.wanted);
  hud.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
  const rl = repLevel();
  hud.rep.textContent = rl.next
    ? `REP · ${rl.name} ${rl.progress}/${rl.need}`
    : `REP · ${rl.name} — MAX`;
  hud.caches.textContent = `◆ CACHES ${side.cachesFound}/${side.cachesTotal}`;
  hud.clock.textContent = fmtClock(state.clockMin);
  // Health bar (green -> red as it drops).
  const hpFrac = clamp(state.health / state.maxHealth, 0, 1);
  hud.healthBar.style.width = `${hpFrac * 100}%`;
  hud.healthBar.style.background = hpFrac > 0.5 ? '#70e000' : hpFrac > 0.25 ? '#f2c14e' : '#ff3b30';
  // District + minimap follow the car while driving, the player on foot.
  const focus = state.driving && drivingCar ? drivingCar.car : state.player;
  hud.district.textContent = districtAt(focus.x, focus.z).name;
  if (state.driving && drivingCar) {
    hud.speed.textContent = String(Math.round(Math.abs(drivingCar.car.speed) * 3.6));
    hud.speedUnit.textContent = 'km/h';
    hud.vehicle.textContent = drivingCar.name;
    hud.weapon.style.opacity = '0';
    // Nitro meter (Slice 3 garage upgrade, GT only).
    if (state.upgrades.nitro && drivingCar === heroEntry) {
      hud.nitroWrap.classList.remove('hidden');
      hud.nitroBar.style.width = `${clamp(state.nitro, 0, 1) * 100}%`;
    } else {
      hud.nitroWrap.classList.add('hidden');
    }
  } else {
    hud.speed.textContent = state.player.speed > 0.5 ? String(Math.round(state.player.speed * 3.6)) : '0';
    hud.speedUnit.textContent = 'km/h';
    hud.vehicle.textContent = 'ON FOOT';
    hud.weapon.textContent = pistol.reloading ? 'PISTOL · RELOADING…' : `PISTOL · ${pistol.ammo}`;
    hud.weapon.style.opacity = '1';
  }
  // Crosshair: only on foot, in play.
  hud.crosshair.style.opacity = (state.mode === 'playing' && !state.driving) ? '1' : '0';
  if (state.hitmarkTimer > 0) {
    state.hitmarkTimer -= dt;
    hud.hitmarker.style.opacity = state.hitmarkTimer > 0 ? '1' : '0';
  }
  // Slice 4: damage vignette — flashes on a hit, lingers while low on health.
  if (state.dmgFlash > 0) state.dmgFlash = Math.max(0, state.dmgFlash - dt * 1.6);
  const lowHp = hpFrac < 0.35 ? 0.45 : 0;
  hud.vignette.style.opacity = String(Math.max(state.dmgFlash * 0.7, lowHp));
  // Slice 4: speed lines follow the car's speed (FOV kick lives in updateCamera).
  const spdFrac = state.driving && drivingCar
    ? Math.abs(drivingCar.car.speed) / drivingCar.car.spec.topSpeed : 0;
  hud.speedlines.style.opacity = spdFrac > 0.65
    ? String(((spdFrac - 0.65) / 0.35) * 0.4) : '0';
  // Police response panel (live list: callsign, distance, status).
  // Distance is measured to the car while driving, the player on foot.
  let html = '';
  for (const u of police.units) {
    const d = Math.round(Math.hypot(u.car.x - focus.x, u.car.z - focus.z));
    html += `<div>${u.callsign} · ${d}m · ${u.status}</div>`;
  }
  if (police.heli) html += `<div>AIR-1 · overhead · Spotlight</div>`;
  if (html !== lastPoliceHtml) {
    lastPoliceHtml = html;
    hud.policeList.innerHTML = html;
    hud.policePanel.classList.toggle('hidden', html === '');
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

// --- camera (v1.1: closer + lower + wider FOV = dramatic) -----------------------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
function updateCamera(dt, t) {
  // Round 5 debug: a free camera for inspection / cover shots. When set,
  // the camera sits exactly there (no follow, no lerp) — used only by the
  // screenshot drivers, never by gameplay.
  if (state.freeCam) {
    camera.position.set(state.freeCam.x, state.freeCam.y, state.freeCam.z);
    camera.lookAt(state.freeCam.tx, state.freeCam.ty, state.freeCam.tz);
    return;
  }
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
  const cur = state.driving && drivingCar ? drivingCar.car : null;
  const focus = cur
    ? { x: cur.x, z: cur.z, y: 1.6, heading: cur.heading }
    : { x: state.player.x, z: state.player.z, y: 1.6, heading: state.player.heading };
  // Auto-align behind the heading when the user is not dragging.
  if (state.userOrbit <= 0) {
    const behind = focus.heading + Math.PI;
    state.camYaw = lerpAngle(state.camYaw, behind, 1 - Math.pow(0.02, dt));
  }
  dist = state.camDist ?? (state.driving ? CFG.camera.driveDist : CFG.camera.footDist);
  pitch = state.camPitch;
  // Slice 4: FOV kick at high speed (driving only) — the world rushes past.
  const spdFrac = cur ? Math.abs(cur.speed) / cur.spec.topSpeed : 0;
  const targetFov = CFG.camera.fov + clamp((spdFrac - 0.6) / 0.4, 0, 1) * 8;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }
  const cx = focus.x + Math.sin(state.camYaw) * Math.cos(pitch) * dist;
  const cz = focus.z + Math.cos(state.camYaw) * Math.cos(pitch) * dist;
  const cy = focus.y + Math.sin(pitch) * dist + 1.2;
  camTarget.set(focus.x, focus.y, focus.z);
  camPos.set(cx, cy, cz);
  camera.position.lerp(camPos, 1 - Math.pow(0.0001, dt));
  // Camera shake (rams, gunfire) — a small random offset that decays.
  if (state.shake > 0.002) {
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.35;
    state.shake = Math.max(0, state.shake - dt * 2.5);
  } else state.shake = 0;
  camera.lookAt(camTarget);
}

// Mouse drag orbits the camera; a still click fires the pistol on foot.
canvas.addEventListener('pointerdown', (e) => {
  state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY;
  state.downX = e.clientX; state.downY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  state.camYaw -= (e.clientX - state.lastX) * 0.006 * (state.camSens || 1);
  state.camPitch = clamp(state.camPitch + (e.clientY - state.lastY) * 0.004, 0.08, 1.1);
  state.lastX = e.clientX; state.lastY = e.clientY;
  state.userOrbit = 3;
});
canvas.addEventListener('pointerup', (e) => {
  state.dragging = false;
  // A click (barely moved) while on foot fires the pistol.
  if (state.downX !== undefined && Math.hypot(e.clientX - state.downX, e.clientY - state.downY) < 6) {
    shootPistol();
  }
});

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
  toast('Slice 1 complete — free roam. Ana has more work for you at the Marina.', 6);
  audio.sting('cash');
  // Slice 3: the next story mission waits at Ana (the mission giver).
  missions.makeAvailable(1);
  saveGame();
}

// --- dialogue (Slice 3 story briefings) ----------------------------------------
// A briefing pauses the game (mode 'dialogue') and shows one line at a
// time with the speaker's name. E / Enter / Space / click advances.
function showDialogue(lines, onDone) {
  state.dialogue = { lines, idx: 0, onDone };
  state.mode = 'dialogue';
  renderDialogueLine();
  hud.dialogue.classList.remove('hidden');
}
function renderDialogueLine() {
  const d = state.dialogue;
  if (!d) return;
  const line = d.lines[d.idx];
  hud.dialogueSpeaker.textContent = line.who.toUpperCase();
  hud.dialogueText.textContent = line.text;
  $('dialogue-hint').textContent = d.idx < d.lines.length - 1
    ? 'E / click — Continue ▸'
    : 'E / click — Begin ▸';
}
function advanceDialogue() {
  const d = state.dialogue;
  if (!d) return;
  d.idx++;
  if (d.idx >= d.lines.length) {
    state.dialogue = null;
    hud.dialogue.classList.add('hidden');
    state.mode = 'playing';
    if (d.onDone) d.onDone();
  } else {
    renderDialogueLine();
  }
}
function skipDialogue() {
  while (state.dialogue) advanceDialogue();
}
$('dialogue').addEventListener('click', advanceDialogue);

// --- mission failed (Slice 3) ----------------------------------------------------
function showFailed(reason) {
  state.mode = 'failed';
  $('failed-reason').textContent = reason;
  $('mission-failed').classList.remove('hidden');
}
function retryMission() {
  $('mission-failed').classList.add('hidden');
  state.mode = 'playing';
  missions.retry();
}
$('btn-retry-mission').addEventListener('click', retryMission);

// --- story complete (Slice 3 finale) ----------------------------------------------
function onStoryComplete(stats) {
  state.mode = 'story';
  $('story-stats').innerHTML =
    `<b>Missions:</b> ${stats.missions}/5 complete &nbsp;·&nbsp; <b>Story earnings:</b> $${stats.cash.toLocaleString('en-US')}<br>` +
    `<b>Reputation:</b> ${repLevel().name} &nbsp;·&nbsp; <b>Caches:</b> ${side.cachesFound}/${side.cachesTotal}<br>` +
    `<b>Cash on hand:</b> $${state.cash.toLocaleString('en-US')}`;
  $('story-complete').classList.remove('hidden');
  audio.sting('cash');
  saveGame();
}
$('btn-story-continue').addEventListener('click', () => {
  $('story-complete').classList.add('hidden');
  state.mode = 'playing';
});

// --- garage (Slice 3 upgrades) ------------------------------------------------------
function garagePrice(key) {
  const lvl = repLevel();
  return Math.round(UPGRADES[key].price * (1 - lvl.discount));
}
function renderShop() {
  $('garage-cash').textContent = `$${state.cash.toLocaleString('en-US')} — standing ${repLevel().name}`;
  const list = $('shop-list');
  list.innerHTML = '';
  for (const key of Object.keys(UPGRADES)) {
    const u = UPGRADES[key];
    const owned = state.upgrades[key];
    const price = garagePrice(key);
    const row = document.createElement('div');
    row.className = 'shop-row' + (owned ? ' owned' : '');
    row.innerHTML = `<div class="shop-info"><b>${u.name}</b> — $${price}<br><span class="shop-desc">${u.desc}</span></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = owned ? 'OWNED' : 'Buy';
    btn.disabled = owned;
    btn.addEventListener('click', () => buyUpgrade(key));
    row.appendChild(btn);
    list.appendChild(row);
  }
}
function buyUpgrade(key) {
  if (state.upgrades[key]) return false;
  const price = garagePrice(key);
  if (state.cash < price) {
    toast(`Not enough cash — ${UPGRADES[key].name} costs $${price}.`, 4);
    return false;
  }
  state.cash -= price;
  state.upgrades[key] = true;
  applyUpgrades();
  audio.sting('cash');
  toast(`${UPGRADES[key].name} installed.`, 4);
  renderShop();
  saveGame();
  return true;
}
function applyUpgrades() {
  state.maxHealth = CFG.player.maxHealth + (state.upgrades.armour ? 50 : 0);
  state.health = Math.min(state.health, state.maxHealth);
  heroCar.spec.topSpeed = CFG.vehicles.verdeGT.topSpeed + (state.upgrades.engine ? 8 : 0);
}
function openGarage() {
  if (state.mode !== 'playing' || state.driving) return;
  state.mode = 'garage';
  renderShop();
  $('garage').classList.remove('hidden');
}
function closeGarage() {
  $('garage').classList.add('hidden');
  if (state.mode === 'garage') state.mode = 'playing';
}
$('btn-garage-close').addEventListener('click', closeGarage);

// --- crimes, health, BUSTED / WASTED -------------------------------------------
function commitCrime(amount, what) {
  addHeat(wanted, amount, state.gameTime);
  state.fleeUntil = state.gameTime + 4; // nearby peds run
  if (what) toast(what, 4);
}
function damagePlayer(dmg) {
  if (state.mode !== 'playing') return;
  state.health = Math.max(0, state.health - dmg);
  state.dmgFlash = 1; // Slice 4: red vignette flash
  if (state.health <= 0) triggerWasted();
}
function triggerBusted() {
  if (state.mode !== 'playing') return;
  state.mode = 'busted';
  police.clearAll();
  wanted.heat = 0; wanted.wanted = 0; wanted.bustTimer = 0;
  audio.setSiren(0);
  audio.sting('busted');
  fadePulse();
  $('busted').classList.remove('hidden');
}
function triggerWasted() {
  if (state.mode !== 'playing') return;
  state.mode = 'wasted';
  police.clearAll();
  wanted.heat = 0; wanted.wanted = 0; wanted.bustTimer = 0;
  audio.setSiren(0);
  audio.sting('wasted');
  fadePulse();
  $('wasted').classList.remove('hidden');
}
function respawn() {
  const fine = Math.min(CFG.wanted.bustFine, state.cash);
  state.cash -= fine;
  state.health = state.maxHealth;
  state.player.x = CFG.safehouse.x;
  state.player.z = CFG.safehouse.z;
  state.player.heading = Math.PI / 2;
  state.player.speed = 0;
  state.driving = false;
  drivingCar = null;
  player.group.visible = true;
  player.group.position.set(state.player.x, 0, state.player.z);
  $('busted').classList.add('hidden');
  $('wasted').classList.add('hidden');
  state.mode = 'playing';
  toast(fine > 0 ? `Back on the street — the cops took $${fine}.` : 'Back on the street.', 5);
  saveGame();
  // Slice 3: going down during a mission blows the job.
  missions.onPlayerDown();
}

// --- pistol ----------------------------------------------------------------------
function shootPistol() {
  if (state.mode !== 'playing' || state.driving) return;
  updatePistol(pistol, state.gameTime);
  // Aim: the crosshair marks a point 30 m out along the camera ray; the
  // shot goes from Leo's shoulder toward that point, clamped to a sane
  // height band. (Slice 2 fired straight from the camera — with the chase
  // camera looking down at Leo, the ray hit the ground metres ahead and
  // distant targets could never be hit. This is what makes the Slice 3
  // shootouts playable.)
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const aim = {
    x: camera.position.x + camDir.x * 30,
    y: clamp(camera.position.y + camDir.y * 30, 0.5, 3.5),
    z: camera.position.z + camDir.z * 30,
  };
  const origin = { x: state.player.x, y: 1.4, z: state.player.z };
  const dl = Math.hypot(aim.x - origin.x, aim.y - origin.y, aim.z - origin.z) || 1;
  const dir = { x: (aim.x - origin.x) / dl, y: (aim.y - origin.y) / dl, z: (aim.z - origin.z) / dl };
  const targets = [];
  for (const u of police.units) {
    targets.push({ x: u.car.x, y: 1.0, z: u.car.z, r: 2.4, kind: 'police', ref: u });
  }
  for (const t of traffic) {
    targets.push({ x: t.car.x, y: 0.9, z: t.car.z, r: 2.4, kind: 'traffic', ref: t });
  }
  for (const p of peds) {
    if (p.downUntil > state.gameTime) continue;
    targets.push({ x: p.x, y: 1.1, z: p.z, r: 0.8, kind: 'ped', ref: p });
  }
  // Slice 3 shootout targets: guards and hunter cars (no heat for these —
  // they are criminals, not the SPD).
  for (const t of missions.getShootTargets()) targets.push(t);
  const res = firePistol(pistol, state.gameTime, origin, dir, targets);
  if (!res.fired) {
    if (res.empty) { toast('Out of ammo — press R to reload.', 3); }
    return;
  }
  audio.gunshot();
  state.shake = Math.min(1, state.shake + 0.12);
  drawTracer(origin, res.point);
  fx.muzzle(origin.x + dir.x * 0.6, origin.y, origin.z + dir.z * 0.6, dir);
  state.fleeUntil = state.gameTime + 4; // the shot scares the street
  if (!res.hit) return;
  fx.sparks(res.point.x, res.point.y, res.point.z);
  state.hitmarkTimer = 0.35;
  spawnDamageNumber(res.point, `-${CFG.pistol.damage}`);
  if (res.hit.kind === 'police') {
    const disabled = police.damageUnit(res.hit.ref, CFG.pistol.damage, state.gameTime);
    commitCrime(CFG.wanted.shootCop, disabled ? `${res.hit.ref.callsign} disabled!` : null);
  } else if (res.hit.kind === 'traffic') {
    commitCrime(CFG.wanted.shootCivilian, null);
  } else if (res.hit.kind === 'ped') {
    const p = res.hit.ref;
    p.downUntil = state.gameTime + 3;
    p.h.group.rotation.x = -Math.PI / 2; // knocked down
    commitCrime(CFG.wanted.shootCivilian, null);
  } else if (res.hit.kind === 'enemy') {
    const down = missions.onEnemyHit(res.hit.ref, CFG.pistol.damage, state.gameTime);
    if (down) toast('Guard down.', 2);
  } else if (res.hit.kind === 'foeCar') {
    const disabled = missions.onFoeHit(res.hit.ref, CFG.pistol.damage);
    if (disabled) toast('Hunter disabled!', 3);
  }
}

function spawnDamageNumber(point, text) {
  const v = new THREE.Vector3(point.x, point.y, point.z).project(camera);
  if (v.z > 1) return;
  const el = document.createElement('div');
  el.className = 'dmg-num';
  el.textContent = text;
  el.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((-v.y + 1) / 2) * innerHeight}px`;
  hud.dmgLayer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// --- save ----------------------------------------------------------------------
// Slice 3: the save covers mission progress, cash, rep, caches, upgrades and
// story completion — not just the Slice 1 step. Old saves (cash/step/x/z
// only) still load: every new field defaults.
function saveGame() {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      cash: state.cash, step: state.step,
      missionIdx: missions.missionIdx,
      storyComplete: missions.storyComplete,
      rep: state.rep,
      cachesTaken: cachesTakenIds(),
      upgrades: { ...state.upgrades },
      x: state.player.x, z: state.player.z,
    }));
    state.saved = true;
    refreshMenuButtons();
  } catch { /* storage unavailable — game still plays */ }
}
function cachesTakenIds() {
  return side.takenCacheIds();
}
function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.cash = s.cash || 0;
    state.step = s.step || 0;
    state.rep = s.rep || 0;
    state.upgrades = { armour: false, nitro: false, engine: false, ...(s.upgrades || {}) };
    state.player.x = s.x ?? SLICE1.heroSpawn.x;
    state.player.z = s.z ?? SLICE1.heroSpawn.z;
    applyUpgrades();
    side.restore(s.cachesTaken || []);
    missions.restore(s.missionIdx || 0, !!s.storyComplete);
    return true;
  } catch { return false; }
}
function clearSave() {
  try { localStorage.removeItem(CFG.saveKey); } catch { /* ignore */ }
  state.saved = false;
  state.cash = 0; state.step = 0;
  state.rep = 0;
  state.upgrades = { armour: false, nitro: false, engine: false };
  state.maxHealth = CFG.player.maxHealth;
  heroCar.spec.topSpeed = CFG.vehicles.verdeGT.topSpeed;
  state.player.x = SLICE1.heroSpawn.x; state.player.z = SLICE1.heroSpawn.z;
  missions.reset();
  side.reset();
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
  audio.setEngine(0, false);
  audio.setSiren(0);
  audio.setRadio(0);
  menuEl.classList.remove('hidden');
  pauseEl.classList.add('hidden');
  refreshMenuButtons();
}
function startGame(fresh) {
  audio.ensure();
  if (fresh) {
    state.cash = 0; state.step = 0;
    state.rep = 0;
    state.upgrades = { armour: false, nitro: false, engine: false };
    state.maxHealth = CFG.player.maxHealth;
    state.nitro = 1;
    heroCar.spec.topSpeed = CFG.vehicles.verdeGT.topSpeed;
    state.health = state.maxHealth;
    wanted.heat = 0; wanted.wanted = 0; wanted.bustTimer = 0;
    police.clearAll();
    missions.reset();
    side.reset();
    hideSideBeacon();
    state.dialogue = null;
    hud.dialogue.classList.add('hidden');
    $('garage').classList.add('hidden');
    $('mission-failed').classList.add('hidden');
    $('story-complete').classList.add('hidden');
    state.staging = false; // a real game, not a staged shot
    state.player.x = SLICE1.heroSpawn.x; state.player.z = SLICE1.heroSpawn.z;
    state.player.heading = SLICE1.heroSpawn.heading;
    heroCar.x = SLICE1.carSpawn.x; heroCar.z = SLICE1.carSpawn.z;
    heroCar.heading = SLICE1.carSpawn.heading; heroCar.speed = 0;
    heroEntry.group.position.set(heroCar.x, 0, heroCar.z);
    heroEntry.group.rotation.y = heroCar.heading;
  } else {
    loadGame();
  }
  state.mode = 'playing';
  state.driving = false;
  drivingCar = null;
  state.helpTimer = 14;
  menuEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  $('busted').classList.add('hidden');
  $('wasted').classList.add('hidden');
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
$('btn-mute').addEventListener('click', () => {
  audio.ensure();
  audio.setMuted(!audio.muted);
  $('btn-mute').textContent = audio.muted ? 'Unmute sound (M)' : 'Mute sound (M)';
});
$('btn-resume').addEventListener('click', () => { state.mode = 'playing'; pauseEl.classList.add('hidden'); });
$('btn-restart').addEventListener('click', () => startGame(true));
$('btn-quit').addEventListener('click', () => { saveGame(); showMenu(); });
$('btn-respawn-busted').addEventListener('click', respawn);
$('btn-respawn-wasted').addEventListener('click', respawn);
state.camSens = 1;

// --- game step (fixed timestep) --------------------------------------------------
function stepGame(dt) {
  // Slice 4: pause freezes EVERYTHING — game time, peds, traffic, beacons,
  // clock, audio. (Before this, the world kept moving behind the pause menu.)
  if (state.mode === 'paused') {
    audio.setEngine(0, false);
    audio.setSiren(0);
    audio.setRadio(0);
    pressed.clear();
    return;
  }
  state.gameTime += dt;
  state.clockMin += dt * 0.12; // slow golden-hour drift
  if (state.userOrbit > 0) state.userOrbit -= dt;
  const now = state.gameTime;
  const playerCar = state.driving && drivingCar ? drivingCar.car : null;

  // Pedestrians: walk to a waypoint, then pick a new one. Flee on crime or
  // gunfire; a hit pedestrian stays down for a few seconds, then runs.
  for (const p of peds) {
    if (p.downUntil > now) {
      p.h.group.position.set(p.x, 0, p.z);
      if (now >= p.downUntil) p.h.group.rotation.x = 0;
      continue;
    }
    const fleeing = now < state.fleeUntil && Math.hypot(p.x - state.player.x, p.z - state.player.z) < 30;
    const dx = p.tx - p.x, dz = p.tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      if (fleeing) {
        // Run away from the player.
        const a = Math.atan2(p.x - state.player.x, p.z - state.player.z);
        p.tx = p.x + Math.sin(a) * 30;
        p.tz = p.z + Math.cos(a) * 30;
      } else if (Math.random() < 0.5) {
        p.tx = 140 + Math.random() * 60;
        p.tz = -120 + Math.random() * 220;
      } else {
        p.tx = -180 + Math.random() * 360;
        p.tz = -180 + Math.random() * 360;
      }
      continue;
    }
    const target = Math.atan2(dx, dz);
    p.heading = lerpAngle(p.heading, target, 1 - Math.pow(0.01, dt));
    const spd = fleeing ? 3.4 : p.speed;
    p.x += Math.sin(p.heading) * spd * dt;
    p.z += Math.cos(p.heading) * spd * dt;
    p.phase += spd * dt * 2.2;
    p.h.group.position.set(p.x, 0, p.z);
    p.h.group.rotation.y = p.heading;
    animateWalk(p.h, p.phase, 1);
  }
  for (const t of traffic) updateTraffic(t, dt, playerCar);

  // Ana idle.
  animateWalk(ana, performance.now() * 0.001, 0);

  // Beacon bob + spin.
  diamond.position.y = 6 + Math.sin(performance.now() * 0.002) * 0.5;
  diamond.rotation.y += dt * 1.5;
  beam.material.opacity = 0.18 + Math.sin(performance.now() * 0.003) * 0.06;
  sideDiamond.position.y = 5 + Math.sin(performance.now() * 0.0025) * 0.4;
  sideDiamond.rotation.y += dt * 1.5;
  // Story + side-job beacons follow the active objectives.
  updateBeacons();

  // Tracer fade.
  if (tracerLife > 0) {
    tracerLife -= dt;
    tracerMat.opacity = Math.max(0, tracerLife / 0.09) * 0.9;
  }

  // Dialogue (Slice 3): the game waits while a briefing is open.
  if (state.mode === 'dialogue') {
    if (pressed.has('KeyE') || pressed.has('Enter') || pressed.has('Space')) advanceDialogue();
    audio.setEngine(0, false);
    audio.setRadio(0);
    pressed.clear();
    return;
  }
  // Garage: Escape closes it.
  if (state.mode === 'garage') {
    if (pressed.has('Escape')) closeGarage();
    audio.setEngine(0, false);
    audio.setRadio(0);
    pressed.clear();
    return;
  }

  if (state.mode !== 'playing') { pressed.clear(); return; }

  if (pressed.has('KeyP') || pressed.has('Escape')) {
    state.mode = 'paused';
    pauseEl.classList.remove('hidden');
    saveGame();
  }
  if (pressed.has('KeyM')) {
    audio.ensure();
    audio.setMuted(!audio.muted);
    $('btn-mute').textContent = audio.muted ? 'Unmute sound (M)' : 'Mute sound (M)';
  }
  if (pressed.has('KeyN')) {
    audio.ensure();
    toast(`Radio: ${audio.nextStation()}`, 3);
  }
  if (pressed.has('KeyR')) startReload(pistol, now);
  if (pressed.has('KeyF')) shootPistol();
  if (pressed.has('KeyG')) openGarage();
  updatePistol(pistol, now);

  // --- Slice 3 systems -----------------------------------------------------------
  missions.update(dt, now);
  side.update(dt, now);

  // --- police + wanted ---------------------------------------------------------
  const playerFocus = {
    x: state.player.x, z: state.player.z,
    speed: state.player.speed, driving: state.driving,
    carX: playerCar ? playerCar.x : state.player.x,
    carZ: playerCar ? playerCar.z : state.player.z,
    carSpeed: playerCar ? playerCar.speed : 0,
    carHeading: playerCar ? playerCar.heading : 0,
  };
  const nearestCop = police.update(dt, now, playerFocus, wanted, policeHooks);
  updateWanted(wanted, dt, now, nearestCop, police.units.length > 0);
  // Siren volume + pitch follow the nearest cruiser (Slice 4: distance).
  audio.setSiren(wanted.wanted > 0 && nearestCop !== null ? clamp(1 - nearestCop / 120, 0.3, 1) : 0, nearestCop);
  // Slice 4: particles — a disabled cruiser burns until it rejoins the chase.
  for (const u of police.units) {
    if (u.state === 'disabled') fx.cruiserSmoke(u.car.x, u.car.z, dt);
  }
  fx.update(dt);

  // Health regen once the heat is gone.
  if (wanted.wanted === 0 && state.health < state.maxHealth) {
    state.health = Math.min(state.maxHealth, state.health + CFG.player.regenPerSec * dt);
  }

  // BUSTED: on foot, nearly still, a cop stopped beside you.
  if (!state.driving && wanted.wanted > 0 && nearestCop !== null && nearestCop < CFG.wanted.bustRadius && state.player.speed < 1.5) {
    wanted.bustTimer += dt;
    if (wanted.bustTimer >= CFG.wanted.bustTime) { triggerBusted(); pressed.clear(); return; }
  } else {
    wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
  }

  if (!state.driving) {
    // --- on foot ---
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = run ? CFG.player.runSpeed : CFG.player.walkSpeed;
    let mx = 0, mz = 0;
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

    // Interaction priority on foot (Slice 3): Ana (mission giver) first,
    // then side jobs (grab a package), then entering a car.
    const anaDist = Math.hypot(state.player.x - SLICE1.anaSpawn.x, state.player.z - SLICE1.anaSpawn.z);
    const sidePrompt = side.promptText();
    let near = null, nearD = 1e9;
    for (const e of driveables) {
      const d = Math.hypot(state.player.x - e.car.x, state.player.z - e.car.z);
      if (d < nearD) { nearD = d; near = e; }
    }
    if (missions.status === 'available' && anaDist < 4) {
      hud.prompt.textContent = 'Press E — Talk to Ana';
      hud.prompt.style.opacity = '1';
      if (pressed.has('KeyE')) {
        hud.prompt.style.opacity = '0';
        fadePulse(); // Slice 4: mission start transition
        missions.startMission(missions.missionIdx);
      }
    } else if (sidePrompt) {
      hud.prompt.textContent = sidePrompt;
      hud.prompt.style.opacity = '1';
      if (pressed.has('KeyE')) {
        if (side.tryInteract()) hud.prompt.style.opacity = '0';
      }
    } else if (near && nearD < 3.2) {
      hud.prompt.textContent = `Press E — Enter the ${near.name}`;
      hud.prompt.style.opacity = '1';
      if (pressed.has('KeyE')) {
        const stolen = near.parked && near !== heroEntry;
        drivingCar = near;
        near.parked = false;
        unparkCollider(near);
        state.driving = true;
        player.group.visible = false;
        hud.prompt.style.opacity = '0';
        if (stolen) {
          commitCrime(CFG.wanted.stealCar, `Stole the ${near.name} — the SPD is coming.`);
        } else {
          toast(`${near.name} — yours now. W/S to drive, Space to handbrake.`, 4);
        }
        if (near === heroEntry) completeSlice1();
      }
    } else if (Math.hypot(state.player.x - CFG.safehouse.x, state.player.z - CFG.safehouse.z) < 15) {
      hud.prompt.textContent = 'Press G — Safehouse garage';
      hud.prompt.style.opacity = '1';
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
    const car = drivingCar.car;
    // Nitro (Slice 3 garage upgrade, GT only): hold Shift while driving
    // and the GT gets +12 m/s top speed while the meter lasts.
    const boosting = state.upgrades.nitro && drivingCar === heroEntry
      && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && state.nitro > 0.02 && throttle > 0;
    // The boost is a temporary override of the GT's own spec — other cars'
    // specs are never touched (they are shared CFG objects). Capture the
    // base first: car.spec IS heroCar.spec while driving the GT, so reading
    // it after the override would return the boosted value.
    const baseTop = heroCar.spec.topSpeed;
    if (boosting) {
      car.spec.topSpeed = baseTop + 12;
      state.nitro = Math.max(0, state.nitro - dt * 0.35);
    } else {
      state.nitro = Math.min(1, state.nitro + dt * 0.08);
    }
    updateCar(car, { throttle, steer, handbrake }, dt, colliders);
    if (boosting) car.spec.topSpeed = baseTop; // restore
    drivingCar.group.position.set(car.x, 0, car.z);
    drivingCar.group.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.36;
    for (const w of drivingCar.wheels) w.rotation.x += spin;
    // Slice 4: tire smoke + skid marks on drift / hard acceleration.
    const fxF = Math.sin(car.heading), fzF = Math.cos(car.heading);
    const lx = Math.cos(car.heading), lz = -Math.sin(car.heading);
    const rx = car.x - fxF * 1.6, rz = car.z - fzF * 1.6;
    const drifting = handbrake || (Math.abs(steer) > 0.5 && Math.abs(car.speed) > 15);
    const hardAccel = throttle > 0 && Math.abs(car.speed) > 0.5 && Math.abs(car.speed) < 6;
    if (drifting || hardAccel) {
      fx.tireSmoke(rx + lx * 0.9, 0.3, rz + lz * 0.9, -fxF * car.speed * 0.3, -fzF * car.speed * 0.3);
      fx.tireSmoke(rx - lx * 0.9, 0.3, rz - lz * 0.9, -fxF * car.speed * 0.3, -fzF * car.speed * 0.3);
    }
    state.skidCd = Math.max(0, state.skidCd - dt);
    if (drifting && state.skidCd <= 0) {
      state.skidCd = 0.12;
      fx.skid(rx + lx * 0.9, rz + lz * 0.9, car.heading);
      fx.skid(rx - lx * 0.9, rz - lz * 0.9, car.heading);
    }
    state.speedKmh = Math.abs(car.speed) * 3.6;
    state.playerRamCd = Math.max(0, state.playerRamCd - dt);

    // Running over a pedestrian is a crime (and the ped goes down).
    for (const p of peds) {
      if (p.downUntil > now) continue;
      const d = Math.hypot(p.x - car.x, p.z - car.z);
      if (d < 1.9 && Math.abs(car.speed) > 5) {
        p.downUntil = now + 3;
        p.h.group.rotation.x = -Math.PI / 2;
        commitCrime(CFG.wanted.hitPed, 'You hit a pedestrian — witnesses called the SPD.');
      }
    }
    // Slice 3 fix: ramming a police cruiser with your car adds heat.
    if (state.playerRamCd <= 0) {
      for (const u of police.units) {
        const d = Math.hypot(u.car.x - car.x, u.car.z - car.z);
        if (d < 3.4 && Math.abs(car.speed) > 8) {
          state.playerRamCd = 2;
          commitCrime(CFG.wanted.ramPolice, 'You rammed a cruiser — the SPD saw that.');
          break;
        }
      }
    }
    // Ramming a hunter car (M4 escort) at speed hurts it.
    for (const f of missions.foes) {
      if (f.state !== 'active') continue;
      const d = Math.hypot(f.car.x - car.x, f.car.z - car.z);
      if (d < 3.5 && Math.abs(car.speed) > 10) {
        if (missions.onPlayerRamFoe(f, now)) toast('Hunter disabled!', 3);
      }
    }
    // Side-job prompt while driving (pick up a fare / grab a package).
    const drivePrompt = side.promptText();
    if (drivePrompt) {
      hud.prompt.textContent = drivePrompt;
      hud.prompt.style.opacity = '1';
    } else {
      hud.prompt.style.opacity = '0';
    }
    if (pressed.has('KeyE')) {
      // Side jobs first (pick up a fare), then exit the car.
      if (side.tryInteract()) {
        hud.prompt.style.opacity = '0';
      } else {
        // Exit beside the car; it stays parked where it stops.
        const sideVec = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
        state.player.x = car.x + sideVec.x * 2.2;
        state.player.z = car.z + sideVec.z * 2.2;
        state.player.heading = car.heading;
        state.driving = false;
        drivingCar.parked = true;
        parkCollider(drivingCar);
        drivingCar = null;
        player.group.visible = true;
        player.group.position.set(state.player.x, 0, state.player.z);
        toast('On foot. The car waits for you.', 3);
      }
    }
  }
  updateHUD(dt);
  // Slice 4: engine hum follows the car's speed; the radio plays while in play.
  const engFrac = state.driving && drivingCar ? Math.abs(drivingCar.car.speed) / drivingCar.car.spec.topSpeed : 0;
  audio.setEngine(engFrac, engFrac > 0.5);
  audio.setRadio(1);
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

// Slice 4: losing focus auto-pauses (alt-tab, phone call, lock screen) so
// the game never runs away while the player is not looking.
function autoPause() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  pauseEl.classList.remove('hidden');
  saveGame();
}
addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

// --- boot -----------------------------------------------------------------------
refreshMenuButtons();
showMenu();
requestAnimationFrame(frame);

// --- debug API (playtest + screenshot drivers) -----------------------------------
window.__costa = {
  state,
  heroCar,
  driveables,
  wanted,
  pistol,
  police,
  missions,
  side,
  CFG,
  MISSIONS,
  ESCORT,
  audio,
  fx,
  layout: cityLayout,
  version: 'slice4',
  // Round 5 debug: fixed camera for inspection / cover shots (gameplay
  // keeps using the follow camera; freeCam only affects the render loop).
  freeCam(x, y, z, tx, ty, tz) { state.freeCam = { x, y, z, tx, ty, tz }; },
  clearCam() { state.freeCam = null; },
  holdHeli(x, y, z) { police.holdHeli(x, y, z); },
  releaseHeli() { police.releaseHeli(); },
  // Slice 4 lighting probe: live light intensities + asphalt colour, so the
  // playtest can prove the road/facade fix actually landed in the scene.
  lighting() {
    return {
      sun: sunLight.intensity, hemi: hemiLight.intensity, fill: fillLight.intensity,
      asphalt: CFG.palette.asphalt,
    };
  },
  fov() { return camera.fov; },
  get drivingCar() { return drivingCar; },
  get health() { return state.health; },
  get rep() { return state.rep; },
  teleport(x, z) { state.player.x = x; state.player.z = z; player.group.position.set(x, 0, z); },
  // Round 5 debug: place the PARKED hero GT (its group only syncs from
  // heroCar while it is the driven car, so setting heroCar.x/z alone
  // leaves a parked GT at its spawn — this moves the group too).
  placeHeroCar(x, z, heading = 0) {
    heroCar.x = x; heroCar.z = z; heroCar.heading = heading; heroCar.speed = 0;
    heroEntry.group.position.set(x, 0, z);
    heroEntry.group.rotation.y = heading;
  },
  enterCar() { drivingCar = heroEntry; state.driving = true; player.group.visible = false; },
  exitCar() { state.driving = false; drivingCar = null; player.group.visible = true; },
  driveTo(x, z) {
    if (!drivingCar) return false;
    drivingCar.car.x = x; drivingCar.car.z = z;
    drivingCar.group.position.set(x, 0, z);
    return true;
  },
  setStep(n) { state.step = n; },
  start(fresh = true) { startGame(fresh); },
  addHeat(n) { addHeat(wanted, n, state.gameTime); },
  damage(n) { damagePlayer(n); },
  heal() { state.health = state.maxHealth; },
  shoot() { shootPistol(); },
  giveCash(n) { state.cash += n; },
  // Aim the crosshair at a world point: swing the camera behind Leo so the
  // line camera -> Leo -> target is straight (the pistol ray goes from
  // Leo's shoulder toward the crosshair point). The camera is snapped, not
  // lerped, so the next shot aims true even at ~3 FPS (SwiftShader).
  aimAt(x, y, z) {
    const dx = x - state.player.x, dz = z - state.player.z;
    state.camYaw = Math.atan2(-dx, -dz);
    state.camPitch = 0.24;
    state.userOrbit = 999; // hold the angle
    const dist = state.camDist ?? CFG.camera.footDist;
    camera.position.set(
      state.player.x + Math.sin(state.camYaw) * Math.cos(state.camPitch) * dist,
      1.6 + Math.sin(state.camPitch) * dist + 1.2,
      state.player.z + Math.cos(state.camYaw) * Math.cos(state.camPitch) * dist,
    );
    camera.lookAt(state.player.x, 1.6, state.player.z);
  },
  advanceDialogue() { advanceDialogue(); },
  skipDialogue() { skipDialogue(); },
  retryMission() { retryMission(); },
  openGarage() { openGarage(); },
  closeGarage() { closeGarage(); },
  buyUpgrade(key) { return buyUpgrade(key); },
  repLevel() { return repLevel(); },
  // Stage extras near the hero car for a shot (traffic + peds on the street).
  stageStreet() {
    const spots = [
      { x: 181.8, z: heroCar.z - 26, h: Math.PI },
      { x: 188.2, z: heroCar.z + 18, h: 0 },
      { x: 181.8, z: heroCar.z + 42, h: Math.PI },
    ];
    for (let i = 0; i < 3 && i < traffic.length; i++) {
      const t = traffic[i];
      t.car.x = spots[i].x; t.car.z = spots[i].z; t.car.heading = spots[i].h;
      t.group.position.set(spots[i].x, 0, spots[i].z);
      t.group.rotation.y = spots[i].h;
    }
    for (let i = 0; i < 4 && i < peds.length; i++) {
      const p = peds[i];
      p.x = 179.5 + (i % 2) * 1.5; p.z = heroCar.z - 12 + i * 8;
      p.tx = p.x; p.tz = p.z + 30;
      p.h.group.position.set(p.x, 0, p.z);
    }
  },
  // Put police units beside the player's car for a chase shot — flanking
  // lanes, nearly level with it. A chase camera cannot see a car hidden
  // straight behind the hero car, so the units sit to the sides instead.
  stageChaseUnits(behind = 6, count = 2) {
    const cur = drivingCar ? drivingCar.car : heroCar;
    for (let i = 0; i < count; i++) {
      const u = police.spawnUnit(cur.x, cur.z, state.gameTime);
      const back = behind + i * 6;
      const side = i % 2 === 0 ? -5 : 5;
      const fx = Math.sin(cur.heading), fz = Math.cos(cur.heading);
      const lx = Math.cos(cur.heading), lz = -Math.sin(cur.heading);
      u.car.x = cur.x - fx * back + lx * side;
      u.car.z = cur.z - fz * back + lz * side;
      u.car.heading = cur.heading;
      u.car.speed = 14;
      u.group.position.set(u.car.x, 0, u.car.z);
      u.group.rotation.y = u.car.heading;
    }
  },
  shots: {
    menu() {
      state.driving = false; drivingCar = null; heroCar.speed = 0; player.group.visible = true;
      state.player.x = SLICE1.heroSpawn.x; state.player.z = SLICE1.heroSpawn.z;
      state.camDist = null; state.userOrbit = 0;
      // Clean slate behind the menu: no chase, no stars, no toast.
      police.clearAll();
      wanted.heat = 0; wanted.wanted = 0; wanted.bustTimer = 0;
      hud.toast.style.opacity = '0'; toastTimer = 0;
      // The HUD freezes in menu mode (updateHUD only runs while playing),
      // so refresh it once here or the chase values would stay on screen.
      showMenu();
      updateHUD(0);
      state.camYaw = Math.PI * 0.9;
    },
    // COVER (Slice 2): police chase — lime GT close on the coastal
    // boulevard at 3 stars, two cruisers right behind, heli overhead,
    // traffic + peds on the street, red blips on the minimap.
    cover() {
      startGame(true);
      state.staging = true; // no fare spawns while the shot is staged
      drivingCar = heroEntry; state.driving = true; player.group.visible = false;
      // Cruise at 12 m/s: the flanking cruisers hold formation for the shot
      // (the 4-city recipe) instead of falling behind the GT.
      heroCar.x = 185; heroCar.z = 55; heroCar.heading = Math.PI; heroCar.speed = 12;
      // Rear three-quarter from the east side, pulled back: a chase camera
      // cannot show cruisers that converge straight behind the hero car,
      // but from the side they stay visible behind it in the frame.
      state.camYaw = Math.PI / 2 - 0.5;
      state.userOrbit = 999; // hold the angle (no auto-align during the shot)
      state.camDist = 13;
      addHeat(wanted, 3.01, state.gameTime);
      window.__costa.stageChaseUnits(6, 2);
      window.__costa.stageStreet();
      hud.toast.style.opacity = '0'; toastTimer = 0; // clean frame, no toast
    },
    driving() {
      startGame(true);
      state.staging = true; // no fare spawns while the shot is staged
      drivingCar = heroEntry; state.driving = true; player.group.visible = false;
      state.camDist = null; state.userOrbit = 0;
      heroCar.x = 185; heroCar.z = 40; heroCar.heading = Math.PI; heroCar.speed = 22;
      state.camYaw = heroCar.heading + Math.PI;
    },
    // Marina on foot: Leo on the boulevard facing Ana + the beacon (clear
    // line of sight down road x=185 — no building between Leo and Ana),
    // peds staged on the boulevard edge beside him.
    marina() {
      startGame(true);
      state.camDist = null; state.userOrbit = 0;
      state.player.x = 185; state.player.z = 8;
      state.player.heading = Math.atan2(178 - 185, -18 - 8);
      state.camYaw = state.player.heading + Math.PI;
      for (let i = 0; i < 4 && i < peds.length; i++) {
        const p = peds[i];
        p.x = 180 + (i % 2) * 2; p.z = -8 + i * 6;
        p.tx = p.x; p.tz = p.z + 20;
        p.h.group.position.set(p.x, 0, p.z);
      }
    },
    onfoot() { startGame(true); state.camDist = null; state.userOrbit = 0; state.player.x = 40; state.player.z = -60; state.player.heading = Math.PI * 0.7; state.camYaw = state.player.heading + Math.PI; },
    // MISSION (Slice 3): LOUD AND CLEAR, clear stage — Leo on the Old Town
    // road facing the warehouse, 4 guards with red markers ahead, the
    // green beacon on the warehouse, Ana's briefing open as a dialogue box.
    // The dialogue pauses the game, so the frame holds still for the shot.
    mission() {
      startGame(true);
      state.staging = true; // no fare spawns while the shot is staged
      missions.debugStage(2, 1);
      state.camDist = 8; state.userOrbit = 999; // hold the angle
      state.player.x = -111; state.player.z = -126;
      state.player.heading = Math.PI; // face north, toward the warehouse
      state.camYaw = 0; // camera south of Leo, looking north at the guards
      player.group.position.set(state.player.x, 0, state.player.z);
      player.group.rotation.y = state.player.heading;
      // The HUD freezes in dialogue mode (updateHUD only runs while
      // playing), so refresh it once here or the panel would still say
      // FIRST LIGHT instead of LOUD AND CLEAR.
      updateHUD(0);
    },
  },
};
