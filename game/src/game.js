// AZZURA HEIST — game core (M2).
// Playable open-world crime game in District 4 (Lungomare): drivable
// car, walkable Elio, chase camera, traffic + pedestrians, day/night
// cycle, storm, and the M2 core systems — wanted 1–5 (cruisers,
// interceptors, heli spotlight, roadblocks, ramming, lose-the-heat,
// busted/wasted), combat (5 weapon slots + cover), the Captain's
// Logbook hub (6 tabs), 3 procedural radio stations, pause menu, 3
// offline save slots, and story missions 1–4 with stages, dialogue
// scenes and rewards. Everything procedural, zero network.
import * as THREE from '../vendor/three.module.min.js';
import { buildDistrict4, windowMat } from './city.js';
import { groundHeightAt } from './districts.js';
import { makeFigure, makeWalker, CAST, CIVILIANS } from './people.js';
import {
  buildStella, buildTrafficCar, createCar, stepCar,
  createTraffic, stepTraffic, collideCircleAABBs, ROAD_Y,
} from './vehicles.js';
import { createCbdTraffic, stepCbdTraffic, placeCbdCar } from './cbd-traffic.js';
import { buildRoadShowcase } from './roads.js';
import { skyTexture, skyPhaseForHour } from './water.js';
import { createRadio, STATIONS } from './radio.js';
import { createSaveSystem } from './save.js';
import { createMissionEngine, MISSIONS, PORTRAITS } from './missions.js';
import { ANCHORS } from './anchors.js';
import { createWanted } from './wanted.js';
import { createCombat, WEAPONS } from './combat.js';
import { createHub } from './hub.js';

const STEP = 1 / 60;
let fastsimFactor = 1; // test-only: ?fastsim=N steps the sim N× faster without rendering (off = 1, normal play identical).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RANKS = [
  { xp: 0, name: 'DRIFTER' }, { xp: 500, name: 'DECKHAND' },
  { xp: 1500, name: 'WHEELMAN' }, { xp: 3000, name: 'FIXER' },
  { xp: 6000, name: 'CAPO' }, { xp: 10000, name: 'KING OF THE RIVIERA' },
];
function rankForXp(xp) {
  let r = RANKS[0].name;
  for (const k of RANKS) if (xp >= k.xp) r = k.name;
  return r;
}

// Find the leg pivots of a makeFigure figure: the two Group children with
// x != 0 and a low y (the arms sit higher). Arms come from userData.arms.
export function findLimbs(figure) {
  const legs = [];
  for (const c of figure.children) {
    if (c.isGroup && Math.abs(c.position.x) > 0.01 && c.position.y < 1.25) legs.push(c);
  }
  return { legs, arms: figure.userData.arms || {} };
}
function animateWalk(figure, phase, speed) {
  const { legs, arms } = findLimbs(figure);
  const amp = Math.min(1, speed / 3) * 0.55;
  legs.forEach((leg, i) => { leg.rotation.x = Math.sin(phase + i * Math.PI) * amp; });
  if (arms.L) arms.L.arm.rotation.x = Math.sin(phase) * amp * 0.7;
  if (arms.R) arms.R.arm.rotation.x = Math.sin(phase + Math.PI) * amp * 0.7;
  figure.position.y = Math.abs(Math.sin(phase)) * 0.05;
}
// Procedural illustrated portrait (SVG) for the dialogue box, per speaker.
function portraitSVG(who) {
  const p = PORTRAITS[who] || PORTRAITS.ELIO;
  return `<svg viewBox="0 0 72 72" aria-label="${who} portrait">
    <rect width="72" height="72" fill="${p.bg}"/>
    <circle cx="56" cy="13" r="6" fill="#fff2c0"/>
    <rect y="52" width="72" height="20" fill="#2e7f8f"/>
    <path d="M8,72 L10,58 Q22,48 36,48 Q50,48 62,58 L64,72 Z" fill="#f2ead8"/>
    <path d="M14,57 Q36,63 58,57 L58,65 Q36,71 14,65 Z" fill="${p.accent}"/>
    <rect x="32" y="42" width="8" height="8" fill="#d9a06f"/>
    <ellipse cx="36" cy="32" rx="11" ry="13" fill="${p.skin}"/>
    <path d="M25,32 Q24,18 36,18 Q48,18 47,32 Q44,24 36,24 Q28,24 25,32 Z" fill="${p.hair}"/>
    <path d="M29,32 h4 M39,32 h4" stroke="#2b2b2b" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M32,40 Q36,43 40,40" stroke="#8a5a3b" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

export function createGame(container) {
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
  window.__gameErrors = errors;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = skyTexture('golden');
  scene.fog = new THREE.Fog(0xf7d9a8, 80, 220);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);

  // Lights (day/night cycle retunes them).
  const hemi = new THREE.HemisphereLight(0xf5e9d5, 0xa8a8a8, 0.9);
  scene.add(hemi);
  // Soft ambient fill: golden-hour sun is low, so horizontal surfaces
  // (roads) get little direct light and their shadows would read black
  // without it. The fill keeps shadowed asphalt readable warm grey.
  const ambient = new THREE.AmbientLight(0xfff0dd, 0.5);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-40, 26, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 220;
  // normalBias kills the self-shadow acne that painted round dark
  // blotches all over the flat roads at the low golden-hour sun angle.
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.06;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff9a7a, 0.7);
  rim.position.set(30, 14, -20);
  scene.add(rim);

  // Sun disc in the sky (position follows the time of day).
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  scene.add(sunDisc);
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8eef7, fog: false }),
  );
  moonDisc.visible = false;
  scene.add(moonDisc);

  // --- the district ---
  const district = buildDistrict4();
  scene.add(district.group);
  const colliders = district.colliders;

  // --- player (Elio) ---
  const playerMesh = makeFigure(CAST[0].spec);
  scene.add(playerMesh);
  const player = {
    mesh: playerMesh,
    x: ANCHORS.player_spawn.x,
    z: ANCHORS.player_spawn.z,
    angle: ANCHORS.player_spawn.angle,
    speed: 0,
    walkPhase: 0,
    radius: 0.5,
    crouched: false,
  };

  // --- hero car ---
  const stellaMesh = buildStella();
  scene.add(stellaMesh);
  const car = createCar(stellaMesh, {
    x: ANCHORS.car_spawn.x, z: ANCHORS.car_spawn.z, angle: ANCHORS.car_spawn.angle,
  });
  car.mesh.position.set(car.x, 0, car.z);

  // --- traffic: 3 civilian cars + 2 Harbor Guard cruisers on the D4
  // lanes, plus 2 civilian cars on the old-town lanes (M3) so the new
  // district reads as lived-in, plus 3 cars on the ring-ext loops
  // (2a). Lanes are found by name — the new districts append their
  // lanes after the D4 ones, so indices would shift as districts land.
  const laneIdx = (name) => {
    const i = district.lanes.findIndex((l) => l.name === name);
    return i < 0 ? 0 : i;
  };
  // GRID REBUILD: the boulevard loop cars are GONE — the CBD graph
  // drives the same avenue in real lanes now (see cbdTraffic below),
  // so the centreline loop would read wrong next to them.
  const traffic = createTraffic(district.lanes, [
    { lane: 1, color: 0xe8a33d, kind: 'pickup' },
    { lane: 2, color: 0xc93a6b, kind: 'sedan' },
    { lane: laneIdx('oldtown-main'), color: 0x3e7cb1, kind: 'sedan' },
    { lane: laneIdx('oldtown-plaza'), color: 0xf2f0ea, kind: 'van' },
    { lane: laneIdx('promenade-boulevard'), color: 0xe8a33d, kind: 'sedan' },
    { lane: laneIdx('promenade-west'), color: 0x3e7cb1, kind: 'van' },
    // NEW PLAN 2a: one car on each ring-ext loop so the new streets
    // read as driven, not empty (9 loop cars total now).
    { lane: laneIdx('ringext-north'), color: 0x2e7f8f, kind: 'sedan' },
    { lane: laneIdx('ringext-east'), color: 0xe8b93c, kind: 'pickup' },
    { lane: laneIdx('ringext-west'), color: 0xd9553a, kind: 'van' },
    // NEW PLAN 2b: one car on each new loop. (The 'promenade-west'
    // van above now drives the new west promenade loop — its name
    // fell back to lane 0 ever since the GRID REBUILD deleted the
    // old boulevard lanes; the 'promenade-boulevard' sedan still does.)
    { lane: laneIdx('promenade-east'), color: 0x3a6fd9, kind: 'sedan' },
    { lane: laneIdx('oldtown-west'), color: 0xf2f0ea, kind: 'van' },
  ]);
  for (const t of traffic) scene.add(t.mesh);

  // --- CBD directed-lane traffic (Xian 21 Nov 15:22) ---
  // 7 cars on the grid's own lanes (5 civilian + 2 police patrol):
  // CORSO AZZURRA both ways (3 cars — the avenue is the busiest
  // street), LUNGOMARE both ways, a patrol on VIA DEL SOLE and one
  // on the z 11.2 street. Total cars in the world: 11 loop + 7 graph
  // = 18 (was 16 before the 2b cars).
  const cbdTraffic = createCbdTraffic([
    { axis: 'NS', index: 3, dir: -1, lane: 0, kind: 'sedan', color: 0xd9553a },
    { axis: 'NS', index: 3, dir: 1, lane: 1, kind: 'van', color: 0x3a6fd9 },
    { axis: 'NS', index: 3, dir: 1, lane: 2, kind: 'sedan', color: 0x2e7f8f },
    { axis: 'EW', index: 2, dir: 1, lane: 0, kind: 'sedan', color: 0xe8b93c },
    { axis: 'EW', index: 2, dir: -1, lane: 1, kind: 'pickup', color: 0x6a8a4a },
    { axis: 'NS', index: 1, dir: 1, lane: 0, police: true },
    { axis: 'EW', index: 3, dir: -1, lane: 0, police: true },
  ]);
  for (const c of cbdTraffic) scene.add(c.mesh);

  // --- pedestrians: 40 walkers on the sidewalks ---
  const peds = [];
  const pedPaths = [
    // Lungomare sidewalks: the avenue road is 4.8 wide (edge |z| 2.4),
    // the 0.7 sidewalks sit at |z| 2.4..3.1 — centre 2.75. The old
    // z +/-2.0 lines were ON the asphalt. The N-S paths run on real
    // sidewalks too: the ring roads' outer sidewalks (x +/-45.35,
    // beside the x +/-44 ring roads) and the grid streets' east
    // sidewalks (x -21.0, 23.8) and CORSO's east sidewalk (x 2.75).
    { a: { x: -56, z: -2.75 }, b: { x: 56, z: -2.75 } },
    { a: { x: -56, z: 2.75 }, b: { x: 56, z: 2.75 } },
    { a: { x: -45.35, z: -37 }, b: { x: -45.35, z: -9 } },
    { a: { x: -21.0, z: -37 }, b: { x: -21.0, z: -9 } },
    { a: { x: 2.75, z: -37 }, b: { x: 2.75, z: -9 } },
    { a: { x: 23.8, z: -37 }, b: { x: 23.8, z: -9 } },
    { a: { x: 45.35, z: -37 }, b: { x: 45.35, z: -9 } },
    { a: { x: -56, z: 2.75 }, b: { x: -20, z: 2.75 } },
    // Crosswalks on the CBD zebras (Xian 21 Nov 15:22): peds cross
    // the boulevard on the zebra at VIA DEL SOLE, and CORSO AZZURRA
    // on the zebra at z -11.2, instead of walking only the sidewalks.
    { a: { x: -11.2, z: -2.2 }, b: { x: -11.2, z: 2.2 } },
    { a: { x: -2.2, z: -11.2 }, b: { x: 2.2, z: -11.2 } },
  ];
  // 40 walkers: the 6 named civilians (full figures) plus 34 generated
  // neighbours (same archetypes, varied tops/bottoms/skins, cheap
  // 7-mesh walkers) so every district's paths get walkers instead of
  // all 6 crowding a few sidewalks.
  const WALKER_TOPS = [0xf2f0ea, 0xff5c8a, 0x7a8b5a, 0x4a5560, 0xb4552d, 0xa8cbb0, 0xe8b88a, 0x3ed6d6, 0xd9b96a, 0x2e7f8f];
  const WALKER_BOTTOMS = [0x2e7f8f, 0xf2de9b, 0x6b4a2a, 0x2b2b2b, 0x2e4a5e, 0x1a1a1a];
  const WALKER_SKINS = [0xe8b88a, 0xf2c9a0, 0xc98d64, 0x8a5a3b];
  const WALKER_HAIR = [0x2b2b2b, 0x6b4a2a, 0xd9b96a, 0xd9d9d9, 0x1a1a1a];
  const walkers = [];
  for (let i = 0; i < 40; i++) {
    const base = CIVILIANS[i % CIVILIANS.length];
    walkers.push({
      ...base,
      name: i < CIVILIANS.length ? base.name : `Walker ${i + 1}`,
      role: 'Civilian · walker',
      spec: {
        archetype: base.spec.archetype,
        skin: WALKER_SKINS[i % WALKER_SKINS.length],
        hairColor: WALKER_HAIR[i % WALKER_HAIR.length],
        top: WALKER_TOPS[i % WALKER_TOPS.length],
        bottom: WALKER_BOTTOMS[i % WALKER_BOTTOMS.length],
        shoes: base.spec.shoes,
        accent: base.spec.accent,
      },
    });
  }
  walkers.forEach((c, i) => {
    const fig = i < CIVILIANS.length ? makeFigure(c.spec) : makeWalker(c.spec);
    scene.add(fig);
    // Pedestrian paths: the CBD sidewalks plus every new district's
    // paths (old town first; promenade + skyline join as they land).
    // Spread the 40 walkers across the whole pool so each district
    // gets walkers instead of all 40 crowding the CBD sidewalks.
    const allPedPaths = [...pedPaths, ...(district.pedPaths || [])];
    const path = allPedPaths[Math.floor((i * allPedPaths.length) / walkers.length)];
    peds.push({
      mesh: fig, path, t: (i * 0.13) % 1, dir: 1,
      speed: 1.1 + (i % 3) * 0.35, phase: i * 1.7, spec: c,
      hp: 50, fallen: false, kind: 'ped',
      damage(d) {
        this.hp -= d;
        this.speed = 3.5; // hit pedestrians flee
        if (this.hp <= 0 && !this.fallen) {
          this.fallen = true;
          this.mesh.rotation.z = Math.PI / 2;
        }
      },
    });
  });

  // --- rain (storm): thin angled streaks (LineSegments) + splash rings ---
  const RAIN_N = 600;
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainSeeds = [];
  for (let i = 0; i < RAIN_N; i++) {
    rainSeeds.push({
      x: (Math.random() - 0.5) * 36, y: Math.random() * 14, z: (Math.random() - 0.5) * 36,
      speed: 22 + Math.random() * 10,
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({
    color: 0x9fd4d8, transparent: true, opacity: 0.5,
  }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const SPLASH_N = 24;
  const splashes = [];
  const splashGeo = new THREE.RingGeometry(0.05, 0.22, 10);
  for (let i = 0; i < SPLASH_N; i++) {
    const s = new THREE.Mesh(splashGeo, new THREE.MeshBasicMaterial({
      color: 0xbfe8ec, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
    }));
    s.rotation.x = -Math.PI / 2;
    s.visible = false;
    scene.add(s);
    splashes.push({ mesh: s, life: 99, max: 0.45 });
  }

  // --- objective beacon (gold pulsing cone + ring at the mission target) ---
  const beacon = new THREE.Group();
  const beaconCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.4, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 }),
  );
  beaconCone.position.y = 2.2;
  beaconCone.rotation.x = Math.PI;
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.7, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.25;
  beacon.add(beaconCone);
  beacon.add(beaconRing);
  scene.add(beacon);
  // Smuggler car (M2 tail stage) — a rust-red sedan on the tail marker.
  const smugglerMesh = buildTrafficCar(0x8a4a3a);
  smugglerMesh.visible = false;
  scene.add(smugglerMesh);

  // --- game state ---
  const state = {
    mode: 'title', // title | play | paused | shot
    onFoot: true,
    time: 18.7, // game hours; 18:42 golden hour
    day: 1,
    storm: false,
    money: 1250,
    health: 100,
    armour: 60,
    xp: 1240,
    xpMax: 2000,
    radio: 0,
    weapon: 1,
    missionTime: 272, // 04:32
    dialogueVisible: true,
    scriptedAccel: false,
    volume: 0.7,
    quality: 'high',
    busted: false,
    wasted: false,
    saveMsg: '',
  };
  const keys = {};
  const input = { up: false, down: false, left: false, right: false, handbrake: false };
  let showcase = null; // ?shot=road scene
  let dialogueLine = null; // {who, line} | null
  let dialogueTimer = 0;
  let toastTimer = 0;
  let toastText = '';
  let stormFromMission = false; // M8 "Storm Warning" owns the storm while active
  let missionFailed = null; // 'busted' | 'wasted' — the current mission failed, restart on respawn
  let wantedForMission = -1; // mission id the wantedAtStart heat was applied for (M9)
  let duelTarget = null; // M12: Aldo's figure on the forecourt, null when no duel is live

  // --- M2 systems ---
  const radio = createRadio();
  const saveSystem = createSaveSystem();
  const missions = createMissionEngine();
  missions.start(0);
  const wanted = createWanted(scene, {
    lanes: district.lanes,
    colliders,
    getPlayer: () => ({
      x: state.onFoot ? player.x : car.x,
      z: state.onFoot ? player.z : car.z,
      angle: state.onFoot ? player.angle : car.angle,
      speed: state.onFoot ? player.speed : car.speed,
      onFoot: state.onFoot,
    }),
    isNight: () => skyPhaseForHour(state.time) === 'night',
    onBusted: () => doBusted(),
    onRam: () => {
      // M9 game fix (21 Nov 21:31 order): during an escape stage the
      // player is laying low — a Guard ram on a hiding player must not
      // add heat, or the heat never decays and the escape can never
      // complete. The ram still damages the car (hull toast).
      const s = missions.stageDef();
      if (!s || s.type !== 'escape') wanted.addHeat(5);
      toast('Guard rammed you — hull damaged');
    },
  });
  const combat = createCombat(scene, camera, {
    colliders,
    getPlayer: () => ({
      x: player.x, z: player.z, angle: player.angle, speed: player.speed,
      onFoot: state.onFoot, crouched: player.crouched,
    }),
    getTargets: () => {
      const list = [];
      for (const u of wanted.units) {
        if (u.dead) continue;
        list.push({
          mesh: u.mesh, kind: 'police',
          damage: (d) => { if (wanted.damageUnit(u, d)) toast('Guard unit fled'); },
        });
      }
      for (const p of peds) {
        if (p.fallen) continue;
        list.push({ mesh: p.mesh, kind: 'ped', damage: (d) => p.damage(d) });
      }
      if (duelTarget && !duelTarget.fallen) {
        list.push({ mesh: duelTarget.mesh, kind: 'duel', damage: (d) => duelTarget.damage(d) });
      }
      return list;
    },
    onCrime: (n) => wanted.addHeat(n),
    onDamage: (dmg) => {
      if (state.armour > 0) {
        const absorbed = Math.min(state.armour, dmg);
        state.armour -= absorbed;
        state.health -= (dmg - absorbed);
      } else {
        state.health -= dmg;
      }
      state.health = Math.max(0, state.health);
      if (state.health <= 0) doWasted();
    },
    onFire: () => { wanted.addHeat(1); },
  });
  const hub = createHub({
    getState: () => ({
      money: state.money, xp: state.xp, xpMax: state.xpMax,
      rank: rankForXp(state.xp),
      missionId: missions.missionId, missionStage: missions.stage,
      missions: MISSIONS.map((m, i) => ({
        id: i, code: m.code, title: m.title, brief: m.brief, reward: m.reward,
        stages: m.stages.length,
        status: i < missions.missionId ? 'COMPLETE' : i === missions.missionId ? 'ACTIVE' : 'LOCKED',
      })),
      radio: radio.index, radioStations: STATIONS,
      volume: state.volume,
      saves: saveSystem.listSaves().map((s) => ({ label: s.label, empty: s.empty })),
      saveMsg: state.saveMsg,
    }),
    save: (i) => doSave(i),
    load: (i) => doLoad(i),
    setRadio: (i) => { radio.setStation(i); state.radio = i; },
    setVolume: (v) => { state.volume = v; radio.setVolume(v); },
  });

  // --- toast + dialogue ---
  function toast(msg) {
    toastText = msg;
    toastTimer = 3;
    const el = document.getElementById('toast');
    if (el) { el.textContent = msg; el.style.opacity = '1'; }
  }
  function showNextDialogue() {
    const d = missions.nextDialogue();
    if (d) {
      dialogueLine = d;
      dialogueTimer = 6;
    } else {
      dialogueLine = null;
    }
  }
  function fmtRaceTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function handleMissionEvent(ev) {
    if (!ev) return;
    if (ev.type === 'stage') {
      const s = ev.mission.stages[ev.stage];
      const doneStage = ev.mission.stages[ev.stage - 1];
      // A stage can raise the heat when it finishes (M11 vault crack,
      // M12 confrontation) — the Guard swarms as the next stage opens.
      if (doneStage && doneStage.heat) wanted.addHeat(doneStage.heat);
      // Leaving a duel clears Aldo; entering one puts him on the
      // forecourt, white suit and falcon cane, 120 hp.
      if (doneStage && doneStage.type === 'duel') clearDuelTarget();
      if (s.type === 'duel') spawnDuelTarget();
      toast(`STAGE ${ev.stage + 1} — ${s.name}`);
      showNextDialogue();
    } else if (ev.type === 'checkpoint') {
      toast(`CHECKPOINT ${ev.done}/${ev.total}`);
    } else if (ev.type === 'fail') {
      const why = ev.reason === 'timeout' ? 'TIME UP'
        : ev.reason === 'wrecked' ? 'CAR WRECKED' : ev.reason.toUpperCase();
      toast(`MISSION FAILED — ${why}. Try again.`);
      if (ev.reason === 'wrecked') { car.damage = 0; car.fuel = 100; }
      wantedForMission = -1;
      clearDuelTarget();
      missions.start(missions.missionId);
      showNextDialogue();
    } else if (ev.type === 'complete') {
      state.money += ev.reward.money;
      state.xp = Math.min(10000, state.xp + ev.reward.xp);
      const race = ev.raceTime != null ? ` · ${fmtRaceTime(ev.raceTime)}` : '';
      toast(`MISSION COMPLETE — ${ev.mission.code} ${ev.mission.title} · +S ${ev.reward.money} · +${ev.reward.xp} XP${race}`);
      dialogueLine = null;
      clearDuelTarget();
      if (missions.missionId + 1 < MISSIONS.length) {
        missions.start(missions.missionId + 1);
        showNextDialogue();
      } else {
        toast('ALL STORY MISSIONS COMPLETE — Azzura is yours, Elio. King of the Riviera.');
      }
    }
  }

  // --- save / load (3 offline slots; refused while wanted) ---
  function snapshot() {
    return {
      version: 2, money: state.money, xp: state.xp, xpMax: state.xpMax,
      health: state.health, armour: state.armour,
      weapon: combat.selected,
      ammo: combat.ammo.map((a) => ({ mag: a.mag, reserve: a.reserve })),
      radio: radio.index, missionId: missions.missionId,
      raceBest: missions.raceBest,
      hour: state.time, day: state.day,
      player: { x: player.x, z: player.z, angle: player.angle, onFoot: state.onFoot },
      car: { x: car.x, z: car.z, angle: car.angle, fuel: car.fuel, damage: car.damage },
    };
  }
  function doSave(i) {
    if (wanted.level > 0) {
      state.saveMsg = 'Cannot save while wanted — lose the Guard first.';
      toast('Cannot save while wanted');
      return false;
    }
    const s = snapshot();
    saveSystem.saveGame(i, s);
    state.saveMsg = `Saved to slot ${i + 1}.`;
    toast(`Saved to slot ${i + 1}`);
    return true;
  }
  function doLoad(i) {
    const s = saveSystem.loadGame(i);
    if (!s) { state.saveMsg = `Slot ${i + 1} is empty.`; return false; }
    state.money = s.money; state.xp = s.xp; state.xpMax = s.xpMax;
    state.health = s.health; state.armour = s.armour;
    state.time = s.hour; state.day = s.day || 1;
    radio.setStation(s.radio || 0);
    state.radio = s.radio || 0;
    combat.select(s.weapon || 1);
    state.weapon = s.weapon || 1;
    if (s.ammo) {
      s.ammo.forEach((a, j) => {
        if (combat.ammo[j]) { combat.ammo[j].mag = a.mag; combat.ammo[j].reserve = a.reserve; }
      });
    }
    missions.start(s.missionId || 0);
    missions.setRaceBest(s.raceBest);
    player.x = s.player.x; player.z = s.player.z; player.angle = s.player.angle;
    state.onFoot = s.player.onFoot;
    car.x = s.car.x; car.z = s.car.z; car.angle = s.car.angle;
    car.fuel = s.car.fuel; car.damage = s.car.damage;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    playerMesh.visible = state.onFoot;
    wanted.reset();
    state.busted = false; state.wasted = false;
    const ov = document.getElementById('busted-overlay');
    if (ov) ov.style.display = 'none';
    state.saveMsg = `Loaded slot ${i + 1}.`;
    toast(`Loaded slot ${i + 1}`);
    return true;
  }

  // --- busted / wasted ---
  function showEndOverlay(title, sub, btn) {
    const ov = document.getElementById('busted-overlay');
    if (!ov) return;
    const t = document.getElementById('busted-title');
    const s = document.getElementById('busted-sub');
    const b = document.getElementById('busted-btn');
    if (t) t.textContent = title;
    if (s) s.textContent = sub;
    if (b) b.textContent = btn;
    ov.style.display = 'flex';
  }
  function doBusted() {
    if (state.busted || state.mode !== 'play') return;
    state.busted = true;
    const lost = Math.floor(state.money * 0.15);
    state.money -= lost;
    wanted.reset();
    // Finale missions declare failOn: getting caught fails the mission,
    // and the respawn restarts it from stage one.
    if ((missions.mission().failOn || []).includes('busted')) missionFailed = 'busted';
    showEndOverlay('BUSTED', `The Guard took S ${lost} in fines. Elio walks free — for now.`, 'WALK FREE');
    state.mode = 'paused';
  }
  function doWasted() {
    if (state.wasted || state.mode !== 'play') return;
    state.wasted = true;
    const lost = Math.floor(state.money * 0.2);
    state.money -= lost;
    wanted.reset();
    if ((missions.mission().failOn || []).includes('wasted')) missionFailed = 'wasted';
    showEndOverlay('WASTED', `Elio wakes up at the marina clinic. S ${lost} gone to the bill.`, 'GET UP');
    state.mode = 'paused';
  }
  function respawnAfterEnd() {
    const ov = document.getElementById('busted-overlay');
    if (ov) ov.style.display = 'none';
    player.x = ANCHORS.player_spawn.x;
    player.z = ANCHORS.player_spawn.z;
    player.angle = ANCHORS.player_spawn.angle;
    state.onFoot = true;
    playerMesh.visible = true;
    playerMesh.position.set(player.x, 0, player.z);
    state.health = 100;
    state.armour = 60;
    state.busted = false;
    state.wasted = false;
    state.mode = 'play';
    // Busted / wasted during a finale mission fails it: restart the
    // mission from its first stage (M9–M12 declare failOn).
    if (missionFailed) {
      const why = missionFailed === 'busted' ? 'BUSTED' : 'WASTED';
      missionFailed = null;
      wantedForMission = -1;
      clearDuelTarget();
      missions.start(missions.missionId);
      toast(`MISSION FAILED — ${why}. Try again.`);
      showNextDialogue();
    }
  }

  // --- M12 duel: Aldo on the casino forecourt ---
  // He stands his ground (no patrol path) and goes down like any
  // pedestrian target: 120 hp, then he falls and the duel stage ends.
  function spawnDuelTarget() {
    if (duelTarget) return;
    const fig = makeFigure(CAST[2].spec); // Aldo Moretti, white suit, falcon cane
    fig.position.set(ANCHORS.casino_forecourt.x, 0, ANCHORS.casino_forecourt.z);
    fig.rotation.y = -Math.PI / 2; // face the player coming up the boulevard
    scene.add(fig);
    duelTarget = {
      mesh: fig, hp: 120, fallen: false, kind: 'duel',
      damage(d) {
        this.hp -= d;
        if (this.hp <= 0 && !this.fallen) {
          this.fallen = true;
          this.mesh.rotation.z = Math.PI / 2;
        }
      },
    };
  }
  function clearDuelTarget() {
    if (!duelTarget) return;
    scene.remove(duelTarget.mesh);
    duelTarget = null;
  }

  // --- input ---
  function readKeys() {
    input.up = !!(keys['KeyW'] || keys['ArrowUp']);
    input.down = !!(keys['KeyS'] || keys['ArrowDown']);
    input.left = !!(keys['KeyA'] || keys['ArrowLeft']);
    input.right = !!(keys['KeyD'] || keys['ArrowRight']);
    // Space is the handbrake in the car — but it advances dialogue first
    // when a dialogue line is showing, so the two never fight.
    input.handbrake = !!keys['Space'] && !dialogueLine;
    if (state.scriptedAccel) input.up = true;
  }
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Enter' && state.mode === 'title') startPlay();
    else if (e.code === 'Enter' && (state.busted || state.wasted)) respawnAfterEnd();
    else if (e.code === 'Escape') {
      if (hub.open) hub.setOpen(false);
      else if (state.mode === 'play') setPaused(true);
      else if (state.mode === 'paused') setPaused(false);
    } else if (e.code === 'Tab' || e.code === 'KeyH') {
      if (state.mode === 'play' || hub.open) { hub.setOpen(!hub.open); e.preventDefault(); }
    } else if (e.code === 'KeyE' && state.mode === 'play' && !hub.open) {
      // Mission interact takes priority over entering the car.
      const ev = missions.interact(state.onFoot ? player.x : car.x, state.onFoot ? player.z : car.z);
      if (ev) handleMissionEvent(ev);
      else toggleCar();
    } else if (e.code === 'KeyR' && state.mode === 'play') {
      radio.next(); state.radio = radio.index;
    } else if (e.code === 'Space' && state.mode === 'play' && dialogueLine) {
      showNextDialogue();
    } else if (e.code === 'KeyC' && state.mode === 'play' && state.onFoot) {
      player.crouched = !player.crouched;
    } else if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= 5 && state.mode === 'play') {
        combat.select(n - 1);
        state.weapon = n - 1;
      }
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('wheel', (e) => {
    if (state.mode !== 'play' || hub.open) return;
    const d = e.deltaY > 0 ? 1 : -1;
    const next = (combat.selected + d + WEAPONS.length) % WEAPONS.length;
    combat.select(next);
    state.weapon = next;
  }, { passive: true });
  addEventListener('mousedown', (e) => {
    if (state.mode !== 'play' || hub.open) return;
    if (e.target !== renderer.domElement) return;
    if (dialogueLine) { showNextDialogue(); return; }
    if (state.onFoot) combat.fire();
  });
  // Pause menu buttons (wired once the DOM exists).
  function wirePauseMenu() {
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    bind('pause-resume', () => setPaused(false));
    bind('pause-save', () => { doSave(0); });
    bind('pause-load', () => { doLoad(0); });
    bind('pause-quit', () => {
      setPaused(false);
      hub.setOpen(false);
      state.mode = 'title';
      const card = document.getElementById('title-card');
      if (card) card.style.display = 'block';
      const hud = document.getElementById('hud-stage');
      if (hud) hud.style.display = 'none';
    });
    const vol = document.getElementById('pause-volume');
    if (vol) vol.addEventListener('input', () => {
      state.volume = vol.value / 100;
      radio.setVolume(state.volume);
    });
    const q = document.getElementById('pause-quality');
    if (q) q.addEventListener('change', () => applyQuality(q.value));
    bind('busted-btn', () => respawnAfterEnd());
  }
  function applyQuality(q) {
    state.quality = q;
    if (q === 'high') {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
    } else if (q === 'medium') {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
    } else {
      renderer.setPixelRatio(0.75);
      renderer.shadowMap.enabled = false;
    }
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  function startPlay() {
    state.mode = 'play';
    showHUD();
    showNextDialogue();
  }
  function showHUD() {
    const card = document.getElementById('title-card');
    if (card) card.style.display = 'none';
    const hud = document.getElementById('hud-stage');
    if (hud) hud.style.display = 'block';
    const topbar = document.getElementById('topbar');
    if (topbar) topbar.style.display = 'none';
    const version = document.getElementById('version');
    if (version) version.style.display = 'none';
  }
  function setPaused(on) {
    if (state.busted || state.wasted) return;
    state.mode = on ? 'paused' : 'play';
    const ov = document.getElementById('pause-overlay');
    if (ov) ov.style.display = on ? 'flex' : 'none';
    if (on && hub.open) hub.setOpen(false);
  }
  function toggleCar() {
    if (state.onFoot) {
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < 4) {
        state.onFoot = false;
        playerMesh.visible = false;
        radio.setVolume(state.volume);
      }
    } else {
      state.onFoot = true;
      const side = { x: Math.cos(car.angle + Math.PI / 2), z: -Math.sin(car.angle + Math.PI / 2) };
      player.x = car.x + side.x * 2.2;
      player.z = car.z + side.z * 2.2;
      player.angle = car.angle;
      playerMesh.visible = true;
      playerMesh.position.set(player.x, 0, player.z);
    }
  }

  // --- day / night ---
  let lastPhase = 'golden';
  function updateLighting() {
    const t = state.time;
    const phase = skyPhaseForHour(t);
    if (phase !== lastPhase) {
      scene.background = skyTexture(phase);
      lastPhase = phase;
    }
    const dayFrac = Math.max(0, Math.min(1, (t - 6) / 12));
    const elev = Math.sin(dayFrac * Math.PI);
    const azim = dayFrac * Math.PI;
    const isDay = t >= 5.5 && t < 19;
    if (isDay) {
      const warm = t < 9 || t > 16.5 ? 1 : 0.6;
      sun.color.setHex(warm ? 0xffd9a0 : 0xfff2d8);
      sun.intensity = 1.4 + elev * 1.2;
      sun.position.set(Math.cos(azim) * 45, Math.max(6, 8 + elev * 30), 18);
      sunDisc.visible = true;
      moonDisc.visible = false;
      const sunX = Math.max(-58, Math.min(40, (1 - dayFrac) * 90 - 55));
      sunDisc.position.set(sunX, 26 + elev * 18, -60);
      sunDisc.lookAt(camera.position);
      sunDisc.material.color.setHex(0xfff2c0);
      hemi.intensity = 1.15 + elev * 0.35;
      // East-facing facades read near-black at golden hour (sun low in
      // the west, rim only 0.4): lift the warm east fill so the
      // promenade + old town east faces keep their colour.
      rim.intensity = 0.75 + elev * 0.4;
      scene.fog.color.setHex(phase === 'dusk' ? 0xe8836b : 0xf7d9a8);
    } else {
      sun.color.setHex(0x8aa8d8);
      sun.intensity = 0.3;
      sun.position.set(20, 30, -10);
      sunDisc.visible = false;
      moonDisc.visible = true;
      moonDisc.position.set(60, 55, -80);
      moonDisc.lookAt(camera.position);
      hemi.intensity = 0.22;
      rim.intensity = 0.15;
      scene.fog.color.setHex(0x1e2a4a);
    }
    const night = phase === 'night' || phase === 'dusk';
    district.setNight(night);
    windowMat.emissiveIntensity = phase === 'night' ? 1.4 : phase === 'dusk' ? 0.8 : 0.15;
    const head = night ? 2.2 : 0.6;
    if (car.mesh.userData.headMat) car.mesh.userData.headMat.emissiveIntensity = head;
    for (const tr of traffic) {
      if (tr.mesh.userData.headMat) tr.mesh.userData.headMat.emissiveIntensity = head;
    }
  }

  // --- storm ---
  function setStorm(on) {
    state.storm = on;
    rain.visible = on;
    district.setWet(on ? 1 : 0);
    if (on) scene.fog.color.setHex(0x5a6a72);
  }

  // --- camera ---
  const camPos = new THREE.Vector3(0, 6, 34);
  const camLook = new THREE.Vector3(0, 5, -10);
  function updateCamera(dt) {
    let target, look;
    if (state.mode === 'title') {
      target = new THREE.Vector3(0, 6, 34);
      look = new THREE.Vector3(0, 5, -12);
    } else if (!state.onFoot) {
      const f = { x: Math.cos(car.angle), z: -Math.sin(car.angle) };
      target = new THREE.Vector3(car.x - f.x * 10.5, 4.6, car.z - f.z * 10.5);
      look = new THREE.Vector3(car.x + f.x * 5, 1.2, car.z + f.z * 5);
    } else {
      const f = { x: Math.cos(player.angle), z: -Math.sin(player.angle) };
      target = new THREE.Vector3(player.x - f.x * 5.5, 3.0, player.z - f.z * 5.5);
      look = new THREE.Vector3(player.x + f.x * 2.5, 1.4, player.z + f.z * 2.5);
    }
    const k = Math.min(1, dt * 4);
    camPos.lerp(target, k);
    camLook.lerp(look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    sun.target.position.copy(state.onFoot ? playerMesh.position : car.mesh.position);
    sun.target.updateMatrixWorld();
  }

  // --- simulation step ---
  function stepPlayer(dt) {
    readKeys();
    if (state.onFoot) {
      const run = keys['ShiftLeft'] || keys['ShiftRight'];
      const speed = player.crouched ? 1.6 : run ? 6 : 3.2;
      // Movement relative to the camera heading (chase camera behind).
      const camAngle = Math.atan2(-(camLook.z - camPos.z), camLook.x - camPos.x);
      let mx = 0, mz = 0;
      if (input.up) { mx += Math.cos(camAngle); mz += -Math.sin(camAngle); }
      if (input.down) { mx -= Math.cos(camAngle); mz -= -Math.sin(camAngle); }
      if (input.left) { mx += Math.cos(camAngle + Math.PI / 2); mz += -Math.sin(camAngle + Math.PI / 2); }
      if (input.right) { mx += Math.cos(camAngle - Math.PI / 2); mz += -Math.sin(camAngle - Math.PI / 2); }
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        player.angle = Math.atan2(-mz, mx);
        const nx = player.x + mx * speed * dt;
        const nz = player.z + mz * speed * dt;
        const res = collideCircleAABBs(nx, nz, player.radius, colliders);
        // M3 (c): the player can walk the whole map north–south now —
        // the old town (z -86) and the skyline landmass (z 104) — the
        // bay-water colliders keep them off the water except on the
        // bridge corridor (x ±4.5).
        player.x = Math.max(-58, Math.min(58, res.x));
        player.z = Math.max(-86, Math.min(104, res.z));
        player.speed = speed;
        player.walkPhase += dt * speed * 2.4;
      } else {
        player.speed = 0;
      }
      // On the skyline landmass / bridge the player stands at its
      // height (M3 (c)); everywhere else the ground is y 0.
      playerMesh.position.set(player.x, groundHeightAt(player.x, player.z), player.z);
      // The figure model faces +z at rotation 0; the movement angle uses
      // forward = (cos a, -sin a), so the mesh needs +90 deg to face it.
      playerMesh.rotation.y = player.angle + Math.PI / 2;
      animateWalk(playerMesh, player.walkPhase, player.speed);
      // Crouch reads as cover-ready (the figure lowers).
      playerMesh.scale.y = player.crouched ? 0.82 : 1;
      // Bump a pedestrian while running fast: wanted +heat (M1 rule, M2 heat).
      if (player.speed > 5) {
        for (const p of peds) {
          if (!p.fallen && Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z) < 1.0) {
            wanted.addHeat(10);
          }
        }
      }
    } else {
      stepCar(car, input, dt, colliders);
      state.xp = Math.min(state.xpMax, state.xp + Math.abs(car.speed) * dt * 0.6);
      // Hitting a pedestrian while driving: wanted +heat.
      for (const p of peds) {
        if (!p.fallen && Math.hypot(p.mesh.position.x - car.x, p.mesh.position.z - car.z) < 1.8 && Math.abs(car.speed) > 3) {
          p.damage(60);
          wanted.addHeat(12);
        }
      }
    }
  }
  function stepPeds(dt) {
    for (const p of peds) {
      if (p.fallen) continue;
      p.t += (p.dir * p.speed * dt) / 60;
      if (p.t >= 1) { p.t = 1; p.dir = -1; }
      if (p.t <= 0) { p.t = 0; p.dir = 1; }
      const x = p.path.a.x + (p.path.b.x - p.path.a.x) * p.t;
      const z = p.path.a.z + (p.path.b.z - p.path.a.z) * p.t;
      const dx = (p.path.b.x - p.path.a.x) * p.dir;
      const dz = (p.path.b.z - p.path.a.z) * p.dir;
      // Pedestrians on the skyline landmass / bridge walk at its height
      // (M3 (c)); everywhere else the ground is y 0.
      p.mesh.position.set(x, groundHeightAt(x, z), z);
      p.mesh.rotation.y = Math.atan2(-dz, dx) + Math.PI / 2;
      p.phase += dt * p.speed * 2.4;
      animateWalk(p.mesh, p.phase, p.speed);
    }
  }
  function stepRain(dt) {
    if (!state.storm) return;
    const cx = camera.position.x, cz = camera.position.z;
    // Spawn drops AHEAD of the moving camera (in its view direction) and
    // low (y 4..10): drops spawned around the camera fall behind it
    // before they ever enter the frame when the car is doing 90+ KM/H.
    const fx = camLook.x - camPos.x, fz = camLook.z - camPos.z;
    const fl = Math.hypot(fx, fz) || 1;
    const nx = fx / fl, nz = fz / fl;
    const lx = -nz, lz = nx;
    for (let i = 0; i < RAIN_N; i++) {
      const s = rainSeeds[i];
      s.y -= s.speed * dt;
      if (s.y < 0) {
        const along = 6 + Math.random() * 18;
        const lat = (Math.random() - 0.5) * 30;
        s.x = cx + nx * along + lx * lat;
        s.y = 4 + Math.random() * 6;
        s.z = cz + nz * along + lz * lat;
      }
      // Streak: top vertex at the drop, bottom vertex 0.9 below and
      // 0.18 to the side (slightly angled, stretched — never a square).
      rainPos[i * 6] = s.x;
      rainPos[i * 6 + 1] = s.y;
      rainPos[i * 6 + 2] = s.z;
      rainPos[i * 6 + 3] = s.x + 0.18;
      rainPos[i * 6 + 4] = s.y - 0.9;
      rainPos[i * 6 + 5] = s.z;
    }
    rainGeo.attributes.position.needsUpdate = true;
    // Splash rings on the ground around the player (storm only).
    const px = state.onFoot ? player.x : car.x;
    const pz = state.onFoot ? player.z : car.z;
    for (const sp of splashes) {
      sp.life += dt;
      if (sp.life > sp.max) {
        sp.life = 0;
        sp.mesh.position.set(px + (Math.random() - 0.5) * 16, 0.24, pz + (Math.random() - 0.5) * 16);
        sp.mesh.visible = true;
      }
      const t = sp.life / sp.max;
      sp.mesh.scale.setScalar(0.5 + t * 1.6);
      sp.mesh.material.opacity = 0.6 * (1 - t);
      if (t >= 1) sp.mesh.visible = false;
    }
  }
  function stepClock(dt) {
    state.time += dt / 20; // 1 game hour per 20 real seconds
    if (state.time >= 24) { state.time -= 24; state.day += 1; }
    if (state.missionTime > 0) state.missionTime -= dt;
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0 && dialogueLine) showNextDialogue();
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) {
        const el = document.getElementById('toast');
        if (el) el.style.opacity = '0';
      }
    }
  }

  // --- HUD (live values) ---
  const $ = (id) => document.getElementById(id);
  let lastHud = 0;
  function updateHUD(now) {
    if (now - lastHud < 100) return;
    lastHud = now;
    // Debug stats (M3 leftover 5): live renderer.info for the page.
    window.__stats = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      mode: state.mode,
      time: state.time,
    };
    const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    const setWidth = (id, pct) => { const el = $(id); if (el) el.style.width = pct + '%'; };
    setText('hud-money', 'S ' + Math.floor(state.money).toLocaleString('en-US'));
    const hh = Math.floor(state.time);
    const mm = Math.floor((state.time - hh) * 60);
    const phase = skyPhaseForHour(state.time);
    const phaseLabel = { golden: 'GOLDEN HOUR', dusk: 'DUSK', night: 'NIGHT', dawn: 'DAWN' }[phase];
    setText('hud-clock', `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    setText('hud-clock-sub', `${phaseLabel} · DAY ${state.day}`);
    const stars = $('hud-wanted-stars');
    if (stars) {
      stars.innerHTML = '<span class="lit">' + '★'.repeat(wanted.level) + '</span>' +
        '<span class="dim">' + '☆'.repeat(5 - wanted.level) + '</span>';
    }
    setText('hud-wanted-status', wanted.status());
    setText('hud-health-num', String(Math.round(state.health)));
    setText('hud-armour-num', String(Math.round(state.armour)));
    setText('hud-xp-num', `${Math.floor(state.xp).toLocaleString('en-US')} / ${state.xpMax.toLocaleString('en-US')}`);
    setWidth('hud-health-bar', state.health);
    setWidth('hud-armour-bar', state.armour);
    setWidth('hud-xp-bar', (state.xp / state.xpMax) * 100);
    const speedKmh = Math.round(Math.abs(state.onFoot ? player.speed : car.speed) * 3.6);
    setText('hud-speed', `${speedKmh} KM/H`);
    setText('hud-vehicle-name', state.onFoot ? 'ON FOOT' : 'STELLA ROADSTER');
    setText('hud-vehicle-sub', state.onFoot ? 'PRESS E NEAR THE CAR' : `FUEL ${Math.round(car.fuel)}% · DAMAGE ${Math.round(car.damage)}%`);
    setText('hud-radio-name', STATIONS[radio.index].name);
    setText('hud-radio-track', STATIONS[radio.index].track);
    const mm2 = Math.floor(state.missionTime / 60);
    const ss2 = Math.floor(state.missionTime % 60);
    setText('hud-mission-time', `${String(mm2).padStart(2, '0')}:${String(ss2).padStart(2, '0')}`);
    // Mission panel: live mission, stage bar, objective text.
    const m = missions.mission();
    const s = missions.stageDef();
    setText('hud-mission-chip', m.code);
    setText('hud-mission-title', m.title);
    setText('hud-mission-brief', m.brief);
    setText('hud-mission-chapter', `Mission · Chapter ${m.chapter}`);
    const stageNames = $('hud-stage-names');
    if (stageNames) {
      stageNames.innerHTML = m.stages.map((st, i) =>
        `<span>${i + 1} · ${st.name}</span>`).join('');
    }
    for (let i = 1; i <= 3; i++) {
      const el = $(`hud-stage-${i}`);
      if (el) el.className = 'stage' + (i - 1 < missions.stage ? ' done' : i - 1 === missions.stage ? ' active' : '');
    }
    setText('hud-mission-objective', s ? s.text : '');
    // Police panel: live dispatch rows from the wanted system.
    const rows = wanted.unitRows();
    rows.forEach((r, i) => {
      setText(`hud-police-${i + 1}-name`, r.name);
      setText(`hud-police-${i + 1}-dist`, `${r.dist} m`);
      const st = $(`hud-police-${i + 1}-st`);
      if (st) {
        st.textContent = r.st;
        st.className = 'st ' + (r.st === 'IN PURSUIT' || r.st === 'INBOUND' ? 'hot' : 'warm');
      }
    });
    // Minimap: player arrow + objective dot + police dots.
    const px = state.onFoot ? player.x : car.x;
    const pz = state.onFoot ? player.z : car.z;
    const arrow = $('hud-player-arrow');
    if (arrow) {
      const sx = ((px + 60) / 120) * 150;
      const sy = ((pz + 42) / 55) * 150;
      const heading = state.onFoot ? player.angle : car.angle;
      arrow.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)}) rotate(${(-heading * 180 / Math.PI).toFixed(1)})`);
    }
    const obj = missions.objective();
    const odot = $('hud-objective-dot');
    if (odot) {
      if (obj && state.mode === 'play') {
        const sx = ((obj.x + 60) / 120) * 150;
        const sy = ((obj.z + 42) / 55) * 150;
        odot.setAttribute('cx', sx.toFixed(1));
        odot.setAttribute('cy', sy.toFixed(1));
        odot.style.display = 'block';
      } else {
        odot.style.display = 'none';
      }
    }
    const pdot = $('hud-police-dot-1');
    if (pdot) {
      if (wanted.units.length) {
        const u = wanted.units[0];
        const sx = ((u.car.x + 60) / 120) * 150;
        const sy = ((u.car.z + 42) / 55) * 150;
        pdot.setAttribute('cx', sx.toFixed(1));
        pdot.setAttribute('cy', sy.toFixed(1));
        pdot.style.display = 'block';
      } else {
        pdot.style.display = 'none';
      }
    }
    let street = 'LUNGOMARE';
    let sub = 'VIA DEL FARO · DISTRICT 4';
    if (pz >= 62) { street = 'BAIA ALTA'; sub = 'SKYLINE · DISTRICT 9'; }
    else if (px > 60) { street = 'LUNGOMARE'; sub = 'PROMENADE · DISTRICT 4'; }
    else if (Math.abs(pz) <= 6) { street = 'LUNGOMARE'; sub = 'BOULEVARD · DISTRICT 4'; }
    else if (pz < -30) { street = 'VIA DEL PORTO'; sub = 'OLD QUARTER · DISTRICT 4'; }
    else if (pz > 8.5) { street = 'QUAY'; sub = 'HARBOR FRONT · DISTRICT 4'; }
    setText('hud-map-district', street);
    setText('hud-map-street', sub);
    // Dialogue box (portrait per speaker).
    const dlg = $('hud-dialogue');
    if (dlg) {
      dlg.style.display = dialogueLine ? 'flex' : 'none';
      if (dialogueLine) {
        const whoName = { ELIO: 'ELIO SANTORO', VI: 'VI ROMANO', LIDIA: 'CAPTAIN LIDIA COSTA', DOM: 'DOM SERRA' }[dialogueLine.who] || dialogueLine.who;
        setText('hud-dialogue-who', whoName);
        setText('hud-dialogue-line', '\u201C' + dialogueLine.line + '\u201D');
        const portrait = $('hud-dialogue-portrait');
        if (portrait) portrait.innerHTML = portraitSVG(dialogueLine.who);
      }
    }
    // Weapon slots (ammo live) + cover indicator + crosshair.
    for (let i = 0; i < 5; i++) {
      const el = $(`hud-weapon-${i}`);
      if (el) el.className = 'wslot' + (i === combat.selected ? ' sel' : '');
      const a = $(`hud-weapon-${i}-ammo`);
      if (a) {
        const am = combat.ammo[i];
        a.textContent = WEAPONS[i].mag === Infinity ? '∞' : `${am.mag} / ${am.reserve}`;
      }
    }
    const cover = $('cover-indicator');
    if (cover) cover.style.display = (state.onFoot && combat.cover) ? 'block' : 'none';
    const cross = $('crosshair');
    if (cross) cross.style.display = (state.mode === 'play' && state.onFoot && !hub.open) ? 'block' : 'none';
    // Beacon follows the current mission objective.
    if (obj && state.mode === 'play' && !missions.done) {
      beacon.visible = true;
      beacon.position.set(obj.x, 0, obj.z);
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
      beacon.scale.setScalar(pulse);
    } else {
      beacon.visible = false;
    }
    // Smuggler car follows the tail marker during the M2 tail stage.
    const tailStage = !missions.done && missions.stageDef() && missions.stageDef().type === 'tail';
    smugglerMesh.visible = !!tailStage;
    if (tailStage) {
      smugglerMesh.position.set(missions.tailPos.x, 0, missions.tailPos.z);
      smugglerMesh.rotation.y = Math.PI / 2;
    }
  }

  // --- one simulation step ---
  function step(dt, scripted) {
    if (scripted) {
      input.up = !!scripted.up;
      input.down = !!scripted.down;
      input.left = !!scripted.left;
      input.right = !!scripted.right;
      input.handbrake = !!scripted.handbrake;
    }
    stepClock(dt);
    updateLighting();
    if (state.mode === 'play' || state.mode === 'shot') {
      stepPlayer(dt);
      const obstacles = state.onFoot
        ? [{ x: player.x, z: player.z }]
        : [{ x: car.x, z: car.z }];
      stepTraffic(traffic, dt, [...obstacles, ...cbdTraffic]);
      // CBD graph cars yield to the loop cars + the player, and the
      // loop cars yield to them — neither system drives through the other.
      stepCbdTraffic(cbdTraffic, dt, [...traffic, ...obstacles]);
      stepPeds(dt);
      // Missions: stage transitions from position / wanted / E-key.
      const ev = missions.update(
        state.onFoot ? player.x : car.x,
        state.onFoot ? player.z : car.z,
        wanted.level, dt, car.damage,
      );
      handleMissionEvent(ev);
      // M8 "Storm Warning": the storm blows while the mission is active
      // and clears when it ends. Only the mission touches the storm
      // here, so ?shot=storm staging (which sets it directly) is
      // unaffected.
      const mm = missions.mission();
      if (mm.storm && !missions.done) {
        if (!state.storm) setStorm(true);
        stormFromMission = true;
      } else if (stormFromMission) {
        setStorm(false);
        stormFromMission = false;
      }
      // M9 "Three-Star Chase": the mission opens hot — apply its wanted
      // level once per mission start.
      if (mm.wantedAtStart && !missions.done && wantedForMission !== missions.missionId) {
        wanted.setLevel(mm.wantedAtStart);
        wantedForMission = missions.missionId;
      }
      // M10 race: the HUD timer shows the race clock, not the default.
      if (mm.timeLimit && !missions.done && missions.stageDef()
        && missions.stageDef().type === 'race') {
        state.missionTime = Math.max(0, mm.timeLimit - missions.elapsed);
      }
      // M12 duel: Aldo falls → the duel stage is over.
      if (!missions.done && missions.stageDef() && missions.stageDef().type === 'duel'
        && duelTarget && duelTarget.fallen) {
        handleMissionEvent(missions.advance());
      }
      // Wanted: pursuit, heli, roadblocks, lose-the-heat, busted.
      wanted.update(dt, performance.now() / 1000);
      // Combat: tracers, reload, police return fire.
      combat.update(dt, wanted.level, wanted.units);
    }
    stepRain(dt);
    for (const tk of district.tickers) tk.userData.tick(performance.now() / 1000);
    updateCamera(dt);
  }

  // --- ?shot staging (the kit's pattern) ---
  function stageShot(name, params = {}) {
    state.mode = 'shot';
    const seed = parseInt(params.seed || '1', 10);
    if (name === 'road') {
      if (showcase) { scene.remove(showcase.group); }
      showcase = buildRoadShowcase();
      scene.add(showcase.group);
      district.group.visible = false;
      playerMesh.visible = false;
      car.mesh.visible = false;
      for (const t of traffic) t.mesh.visible = false;
      for (const c of cbdTraffic) c.mesh.visible = false;
      for (const p of peds) p.mesh.visible = false;
      const card = document.getElementById('title-card');
      if (card) card.style.display = 'none';
      const topbar = document.getElementById('topbar');
      if (topbar) topbar.style.display = 'none';
      const version = document.getElementById('version');
      if (version) version.style.display = 'none';
      if (params.night === '1') state.time = 23.2;
      else state.time = 18.7;
      setStorm(params.storm === '1');
      updateLighting();
      camera.position.set(14, 2.6, 0);
      camera.lookAt(-12, 0.9, 0);
      camPos.copy(camera.position);
      camLook.set(-12, 0.9, 0);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
      window.__shotReady = true;
      window.__ready = true;
      window.__shotLabel = 'road';
      window.__gameStats = {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        mode: name, time: state.time,
      };
      // Debug stats (M3 leftover 5): renderer.info, readable from the
      // page at any time via window.__stats (drive / walk / title).
      window.__stats = {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        mode: name, time: state.time,
      };
      return;
    }
    district.group.visible = true;
    playerMesh.visible = true;
    car.mesh.visible = true;
    for (const t of traffic) t.mesh.visible = true;
    for (const c of cbdTraffic) c.mesh.visible = true;
    for (const p of peds) p.mesh.visible = true;
    if (showcase) { scene.remove(showcase.group); showcase = null; }
    const run = (steps, scripted) => {
      for (let i = 0; i < steps; i++) step(STEP, scripted);
    };
    if (name === 'title') {
      state.mode = 'title';
      state.time = 18.7;
      state.storm = false;
      updateLighting();
      updateCamera(1);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else if (name === 'drive' || name === 'night' || name === 'storm') {
      state.mode = 'play';
      showHUD();
      state.onFoot = false;
      state.scriptedAccel = true;
      playerMesh.visible = false;
      car.x = ANCHORS.race_start_1.x; car.z = ANCHORS.race_start_1.z; car.angle = 0; car.speed = 0;
      state.time = name === 'night' ? 23.2 : name === 'storm' ? 17.5 : 18.7;
      setStorm(name === 'storm');
      updateLighting();
      run(150, { up: true });
      updateCamera(1);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else if (name === 'district') {
      // District showcase (M3): stage the player car in the named
      // district, run the simulation so traffic + pedestrians are live,
      // and frame the district from a fixed elevated vantage.
      // district=oldtown (promenade + skyline get their vantages when
      // they land). The player car holds still; the traffic cars and
      // pedestrians move through the frame.
      const d = params.district || 'oldtown';
      state.mode = 'play';
      showHUD();
      state.onFoot = false;
      playerMesh.visible = false;
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      let camFrom; let camTo;
      if (d === 'oldtown') {
        car.x = ANCHORS.oldtown_main_street.x; car.z = ANCHORS.oldtown_main_street.z; car.angle = 0; car.speed = 0;
        // East end of the main street, above the north sidewalk,
        // looking west down the cobbles: the Stella mid-street, the
        // old-town traffic car, the stair-houses and the plaza beyond.
        camFrom = [ANCHORS.vantage_oldtown_cam.x, ANCHORS.vantage_oldtown_cam.y, ANCHORS.vantage_oldtown_cam.z];
        camTo = [ANCHORS.vantage_oldtown_cam.look.x, ANCHORS.vantage_oldtown_cam.look.y, ANCHORS.vantage_oldtown_cam.look.z];
      } else if (d === 'promenade') {
        // High above the boulevard's west end, looking east-down:
        // the boulevard, the deco row, the Casino Azzura + the hotel
        // tower, the quay + sailboats below. (Lower vantages sat
        // inside the palm rows — the fronds blocked the casino.)
        car.x = ANCHORS.boulevard_east.x; car.z = ANCHORS.boulevard_east.z; car.angle = ANCHORS.boulevard_east.angle; car.speed = 0;
        camFrom = [ANCHORS.vantage_promenade_cam.x, ANCHORS.vantage_promenade_cam.y, ANCHORS.vantage_promenade_cam.z];
        camTo = [ANCHORS.vantage_promenade_cam.look.x, ANCHORS.vantage_promenade_cam.look.y, ANCHORS.vantage_promenade_cam.look.z];
      } else if (d === 'skyline') {
        // M3 (c): high above the quay's east end, looking north-east
        // across the bay — the bridge + monorail in the foreground,
        // the Bay Avenue, the podium row and the 12 towers behind.
        // The player car is staged on the avenue (teleported, not
        // driven — the bridge is pedestrian-only).
        car.x = ANCHORS.skyline_avenue.x; car.z = ANCHORS.skyline_avenue.z; car.angle = ANCHORS.skyline_avenue.angle; car.speed = 0;
        camFrom = [ANCHORS.vantage_skyline_cam.x, ANCHORS.vantage_skyline_cam.y, ANCHORS.vantage_skyline_cam.z];
        camTo = [ANCHORS.vantage_skyline_cam.look.x, ANCHORS.vantage_skyline_cam.look.y, ANCHORS.vantage_skyline_cam.look.z];
      } else {
        car.x = ANCHORS.oldtown_main_street.x; car.z = ANCHORS.oldtown_main_street.z; car.angle = 0; car.speed = 0;
        camFrom = [ANCHORS.vantage_default_cam.x, ANCHORS.vantage_default_cam.y, ANCHORS.vantage_default_cam.z];
        camTo = [ANCHORS.vantage_default_cam.look.x, ANCHORS.vantage_default_cam.look.y, ANCHORS.vantage_default_cam.look.z];
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
      run(150, {});
      // The sim advances the clock past 18:49 — pin it back to golden
      // hour before the render so the moon never shows at 18:49.
      state.time = 18.7;
      updateLighting();
      camera.position.set(camFrom[0], camFrom[1], camFrom[2]);
      camera.lookAt(camTo[0], camTo[1], camTo[2]);
      camPos.copy(camera.position);
      camLook.set(camTo[0], camTo[1], camTo[2]);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else if (name === 'wanted') {
      // 4 stars: cruisers + interceptors converge, heli spotlight,
      // roadblock ahead on the boulevard. The car holds position while
      // the pursuit closes in — the roadblock stays in frame.
      state.mode = 'play';
      showHUD();
      state.onFoot = false;
      playerMesh.visible = false;
      car.x = ANCHORS.boulevard_mid_south.x; car.z = ANCHORS.boulevard_mid_south.z; car.angle = 0; car.speed = 0;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      wanted.addHeat(85);
      run(150, {});
      updateCamera(1);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else if (name === 'combat' || name === 'tracer') {
      // Elio crouched behind a quay crate (cover) with the Tamburo,
      // 2-star Guard closing in and returning fire. The quay gives an
      // open sightline east (no planter palms in the camera lane).
      state.mode = 'play';
      showHUD();
      state.onFoot = true;
      playerMesh.visible = true;
      player.x = ANCHORS.quay_cover_spot.x; player.z = ANCHORS.quay_cover_spot.z; player.angle = 0;
      player.crouched = true;
      playerMesh.position.set(player.x, 0, player.z);
      playerMesh.rotation.y = player.angle + Math.PI / 2;
      combat.select(3);
      state.weapon = 3;
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      wanted.addHeat(35);
      // 120 steps: the Guard closes to ~10 m — in frame, but not yet
      // inside the 2.5 m / 3 s busted window.
      run(120, {});
      updateCamera(1);
      combat.fire();
      if (name === 'tracer') {
        // Side view of the firing line (M3): Elio in profile at the
        // quay, the player tracer running east toward the closing
        // Guard and the enemy tracers coming back — the chase camera
        // foreshortens the tracer to a dot, this angle shows it.
        // Camera south-east, higher up: the firing line runs diagonally
        // across the frame and the water foreground stays out of it.
        camera.position.set(ANCHORS.vantage_tracer_cam.x, ANCHORS.vantage_tracer_cam.y, ANCHORS.vantage_tracer_cam.z);
        camera.lookAt(ANCHORS.vantage_tracer_cam.look.x, ANCHORS.vantage_tracer_cam.look.y, ANCHORS.vantage_tracer_cam.look.z);
        camPos.copy(camera.position);
        camLook.set(ANCHORS.vantage_tracer_cam.look.x, ANCHORS.vantage_tracer_cam.look.y, ANCHORS.vantage_tracer_cam.look.z);
      }
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else if (name === 'hub') {
      state.mode = 'play';
      showHUD();
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      hub.setOpen(true, 'Crew');
      updateHUD(performance.now());
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else if (name === 'mission') {
      // Any mission: ?shot=mission&m=5 stages M5 at its dialogue stage
      // (stage 1, the interact). The player stands 6 m from the stage
      // target toward the map centre, facing the landmark, so it reads
      // in three dimensions. Default m=1 keeps the verified M1 STEAL
      // shot (Elio southwest of the pavilion, facing its corner).
      const mi = Math.max(0, Math.min(MISSIONS.length - 1, (parseInt(params.m || '1', 10) - 1)));
      state.mode = 'play';
      showHUD();
      state.onFoot = true;
      playerMesh.visible = true;
      missions.start(mi);
      // Route the advance through the event handler so stage heat
      // (M11 vault, M12 confrontation) and the duel target (M12) are
      // staged too — the same path real play takes. The handler shows
      // the stage dialogue, so the staging's own showNextDialogue()
      // below is dropped (it would blank it by advancing the queue).
      handleMissionEvent(missions.advance());
      const t = missions.stageDef().target;
      if (mi === 0) {
        player.x = ANCHORS.mission_m1_stage.x; player.z = ANCHORS.mission_m1_stage.z; player.angle = ANCHORS.mission_m1_stage.angle;
      } else {
        const dx = 0 - t.x, dz = 0 - t.z;
        const len = Math.hypot(dx, dz) || 1;
        player.x = t.x + (dx / len) * 6;
        player.z = t.z + (dz / len) * 6;
        player.angle = Math.atan2(-(t.z - player.z), t.x - player.x);
      }
      playerMesh.position.set(player.x, 0, player.z);
      playerMesh.rotation.y = player.angle + Math.PI / 2;
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      run(60, {});
      updateCamera(1);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else if (name === 'cbd') {
      // CBD verification (stage 1): skip the title, load the world
      // directly, and frame the new CBD core. view=street (default):
      // Elio on foot on the boulevard inside the CBD, facing the
      // Azzura Tower; view=bay: from the water looking north at the
      // skyline; view=top: straight down over the CBD grid (ortho);
      // view=oblique: 3/4 oblique map shot, 30-40 deg; view=avenue:
      // street level on CORSO AZZURRA with traffic + peds on the
      // zebra. The test waits for window.__ready before screenshotting.
      const view = params.view || 'street';
      state.mode = 'play';
      showHUD();
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      let shotCamera = camera; // the top view renders with an ortho camera instead
      let restoreTopFog = null; // the top view disables fog (restored after render)
      let restoreTopShadow = null; // the map views widen the shadow camera (restored after render)
      // Long soft shadows for the map shots (Xian 21 Nov 16:04): the
      // default shadow camera (+-70/+-60, 1024) clips the towers'
      // shadows at low sun, so the map views widen it to +-160 at
      // 2048 and use an earlier golden-hour sun (17.0, ~19 deg) whose
      // shadows differentiate tower heights instead of all clipping.
      const widenShadowsForMap = () => {
        const sc = sun.shadow.camera;
        const saved = {
          left: sc.left, right: sc.right, top: sc.top, bottom: sc.bottom,
          mapSize: sun.shadow.mapSize.x,
        };
        sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160;
        sc.updateProjectionMatrix();
        sun.shadow.mapSize.set(2048, 2048);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        restoreTopShadow = () => {
          sc.left = saved.left; sc.right = saved.right;
          sc.top = saved.top; sc.bottom = saved.bottom;
          sc.updateProjectionMatrix();
          sun.shadow.mapSize.set(saved.mapSize, saved.mapSize);
          if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        };
      };
      if (view === 'bay') {
        state.onFoot = false;
        playerMesh.visible = false;
        car.x = ANCHORS.boulevard_mid_south.x; car.z = ANCHORS.boulevard_mid_south.z; car.angle = 0; car.speed = 0;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.angle;
        run(150, {});
        state.time = 18.7;
        updateLighting();
        camera.position.set(ANCHORS.vantage_cbd_bay.x, ANCHORS.vantage_cbd_bay.y, ANCHORS.vantage_cbd_bay.z);
        camera.lookAt(ANCHORS.vantage_cbd_bay.look.x, ANCHORS.vantage_cbd_bay.look.y, ANCHORS.vantage_cbd_bay.look.z);
        camPos.copy(camera.position);
        camLook.set(ANCHORS.vantage_cbd_bay.look.x, ANCHORS.vantage_cbd_bay.look.y, ANCHORS.vantage_cbd_bay.look.z);
      } else if (view === 'top') {
        state.onFoot = false;
        playerMesh.visible = false;
        run(150, {});
        state.time = 17.0;
        updateLighting();
        widenShadowsForMap();
        // TRUE orthographic top-down (Xian 21 Nov 15:22): a perspective
        // camera — even a telephoto fov 18 — still leans the 60-floor
        // towers over the streets. An orthographic camera shows the
        // block grid and the lane markings with no lean at all. The
        // frustum covers the whole CBD extent (x -62..62, z -51.7..18.1
        // at 16:9); screen-up is north (-Z), so the ring avenue is at
        // the top and the bay at the bottom.
        // FOG: the camera sits 420 above the ground but scene fog is
        // opaque past 190 — without this the whole frame renders as
        // solid fog orange (the first capture). Fog is disabled for
        // this shot only (scene fog + the water shader's manual fog),
        // then restored after the renders.
        const savedFog = scene.fog;
        const foggedWater = [];
        scene.traverse((o) => {
          if (o.material && o.material.uniforms && o.material.uniforms.uFogFar) {
            foggedWater.push([o.material.uniforms, o.material.uniforms.uFogFar.value]);
            o.material.uniforms.uFogFar.value = 100000;
          }
        });
        scene.fog = null;
        restoreTopFog = () => {
          scene.fog = savedFog;
          for (const [u, v] of foggedWater) u.uFogFar.value = v;
        };
        const aspect = renderer.domElement.width / renderer.domElement.height;
        const halfW = 62;
        const topCam = new THREE.OrthographicCamera(-halfW, halfW, halfW / aspect, -halfW / aspect, 1, 1000);
        topCam.up.set(0, 0, -1);
        topCam.position.set(0, 420, -16.8);
        topCam.lookAt(0, 0, -16.8);
        topCam.updateProjectionMatrix();
        camPos.copy(topCam.position);
        camLook.set(0, 0, -16.8);
        shotCamera = topCam;
        window.__topCam = topCam; // exposed for the draw-call probe
      } else if (view === 'city') {
        // Whole-city orthographic top-down (NEW PLAN 2a, Xian 21 Nov
        // 17:58): halfW 115 covers x -115..115, z -92..37 at 16:9
        // (centre z -27) — the north ext (z -89), the outer columns
        // (x +/-96) and a strip of the bay (z 30+). Fog disabled for
        // this shot only, shadows widened, same as the CBD top view.
        state.onFoot = false;
        playerMesh.visible = false;
        run(150, {});
        state.time = 17.0;
        updateLighting();
        widenShadowsForMap();
        const savedFog = scene.fog;
        const foggedWater = [];
        scene.traverse((o) => {
          if (o.material && o.material.uniforms && o.material.uniforms.uFogFar) {
            foggedWater.push([o.material.uniforms, o.material.uniforms.uFogFar.value]);
            o.material.uniforms.uFogFar.value = 100000;
          }
        });
        scene.fog = null;
        restoreTopFog = () => {
          scene.fog = savedFog;
          for (const [u, v] of foggedWater) u.uFogFar.value = v;
        };
        const aspect = renderer.domElement.width / renderer.domElement.height;
        const halfW = 115;
        const topCam = new THREE.OrthographicCamera(-halfW, halfW, halfW / aspect, -halfW / aspect, 1, 1000);
        topCam.up.set(0, 0, -1);
        topCam.position.set(0, 420, -27);
        topCam.lookAt(0, 0, -27);
        topCam.updateProjectionMatrix();
        camPos.copy(topCam.position);
        camLook.set(0, 0, -27);
        shotCamera = topCam;
        window.__topCam = topCam;
      } else if (view === 'oblique') {
        // 3/4 oblique map shot (Xian 21 Nov 16:04): 30-40 deg elevation,
        // no distortion — the tower heights read directly in
        // perspective. Camera south-east of the CBD, looking north-west
        // at the centre; the bay sits behind the camera, the skyline
        // rises against the hills.
        state.onFoot = false;
        playerMesh.visible = false;
        run(150, {});
        state.time = 17.0;
        updateLighting();
        widenShadowsForMap();
        camera.position.set(70, 95, 70);
        camera.lookAt(0, 5, -16.8);
        camPos.copy(camera.position);
        camLook.set(0, 5, -16.8);
      } else if (view === 'avenue') {
        // Avenue street-level shot (Xian 21 Nov 15:22): from the middle
        // of CORSO AZZURRA, just north of the boulevard, looking north
        // — traffic in several lanes, peds on the zebra at the
        // z -11.2 crossing, towers on both sides, full HUD. The camera
        // stands NORTH of the boulevard so the monorail pillars (in
        // the boulevard median, z 0) stay behind it, never dead-centre.
        state.onFoot = false;
        playerMesh.visible = false;
        car.x = 0.725; car.z = -22; car.angle = Math.PI / 2; car.speed = 0;
        car.mesh.position.set(car.x, ROAD_Y, car.z);
        car.mesh.rotation.y = car.angle;
        run(120, {});
        state.time = 18.7;
        updateLighting();
        // Stage traffic into the frame AFTER the sim ran: three CBD
        // cars in three different avenue lanes. Stella sits 18 units
        // up the avenue (inner northbound lane), so the northbound
        // inner car goes further up (z ~-30) to leave a gap.
        placeCbdCar(cbdTraffic[0], 'NS', 3, -1, 0, 0, 0.6); // northbound inner, z ~-30
        placeCbdCar(cbdTraffic[2], 'NS', 3, -1, 2, 0, 0.45); // northbound outer, z ~-27
        placeCbdCar(cbdTraffic[1], 'NS', 3, 1, 0, 0, 0.85); // southbound inner, z ~-18, approaching
        // Pin the two police patrols to the z 11.2 cross-street BEHIND
        // the camera: they turn at intersections and otherwise wander
        // onto the avenue right next to the camera, cropped at the
        // frame's edge.
        placeCbdCar(cbdTraffic[5], 'EW', 3, 1, 0, 0, 0.5); // eastbound, z 11.2
        placeCbdCar(cbdTraffic[6], 'EW', 3, -1, 0, 0, 0.5); // westbound, z 11.2
        // Two peds mid-crosswalk on the zebra at z -11.2.
        peds[0].mesh.position.set(0.4, 0, -11.2);
        peds[1].mesh.position.set(-0.6, 0, -11.2);
        // Camera a touch higher than before (y 3.0) so the avenue,
        // the towers and a strip of sky all read, with Stella no
        // longer filling the bottom of the frame.
        camera.position.set(0, 3.0, -4);
        camera.lookAt(0, 2.0, -40);
        camPos.copy(camera.position);
        camLook.set(0, 2.0, -40);
      } else { // street
        state.onFoot = true;
        playerMesh.visible = true;
        player.x = ANCHORS.cbd_street.x; player.z = ANCHORS.cbd_street.z; player.angle = ANCHORS.cbd_street.angle;
        playerMesh.position.set(player.x, 0, player.z);
        playerMesh.rotation.y = player.angle + Math.PI / 2;
        run(120, {});
        state.time = 18.7;
        updateLighting();
        camera.position.set(ANCHORS.vantage_cbd_street.x, ANCHORS.vantage_cbd_street.y, ANCHORS.vantage_cbd_street.z);
        camera.lookAt(ANCHORS.vantage_cbd_street.look.x, ANCHORS.vantage_cbd_street.look.y, ANCHORS.vantage_cbd_street.look.z);
        camPos.copy(camera.position);
        camLook.set(ANCHORS.vantage_cbd_street.look.x, ANCHORS.vantage_cbd_street.look.y, ANCHORS.vantage_cbd_street.look.z);
      }
      renderer.render(scene, shotCamera);
      renderer.render(scene, shotCamera);
      if (restoreTopFog) restoreTopFog();
      if (restoreTopShadow) restoreTopShadow();
    } else if (name === 'ring') {
      // Commercial-ring street shot (Xian 21 Nov 16:04, item 2): from
      // the ring avenue (z -42), looking north-east ALONG the avenue
      // at the north-row shopfronts — shop signs, awnings, balconies,
      // people on the sidewalk, traffic on the avenue, full HUD.
      // Looking across the avenue (north) puts one shop wall in the
      // whole frame; looking along it shows the row receding.
      state.mode = 'play';
      showHUD();
      state.onFoot = false;
      playerMesh.visible = false;
      run(120, {});
      state.time = 18.7;
      updateLighting();
      // Stella staged eastbound on the ring avenue, in frame.
      // (Local forward is +x: angle 0 = east, PI/2 = north.)
      car.x = 45; car.z = -42; car.angle = 0; car.speed = 0;
      car.mesh.position.set(car.x, ROAD_Y, car.z);
      car.mesh.rotation.y = car.angle;
      // Two peds on the avenue's NORTH sidewalk (z -46.5, in frame
      // on the left, in front of the north-row shopfronts) — the old
      // south-sidewalk spots (z -37.5) were behind the camera's
      // look direction and never read.
      peds[0].mesh.position.set(48, 0, -46.5);
      peds[1].mesh.position.set(51, 0, -46.5);
      // Straight east along the avenue's EAST segment (x 34.7..60):
      // the middle segment (x -34.7..34.7) is the CBD's own north
      // street (z -44.8) and its north-row towers face it from
      // z -42 — a camera there stares at a tower's blank north face
      // (the beige wall in the first two captures). The east segment
      // is a real 7-wide avenue: north-row shops on the left, the
      // south-row block on the right, the avenue receding east.
      camera.position.set(36, 4.0, -42);
      camera.lookAt(58, 3.0, -42);
      camPos.copy(camera.position);
      camLook.set(58, 3.0, -42);
      if (params.view === 'top') {
        // Wide orthographic top-down of the whole ring (Xian 21 Nov
        // 16:04, item 2): halfW 78 covers x -72..72, z -68..14 at
        // 16:9 (centre z -27). Fog disabled for this shot only (as
        // in the CBD top view) and restored right after.
        const savedFog = scene.fog;
        const foggedWater = [];
        scene.traverse((o) => {
          if (o.material && o.material.uniforms && o.material.uniforms.uFogFar) {
            foggedWater.push([o.material.uniforms, o.material.uniforms.uFogFar.value]);
            o.material.uniforms.uFogFar.value = 100000;
          }
        });
        scene.fog = null;
        const aspect = renderer.domElement.width / renderer.domElement.height;
        const halfW = 78;
        const topCam = new THREE.OrthographicCamera(-halfW, halfW, halfW / aspect, -halfW / aspect, 1, 1000);
        topCam.up.set(0, 0, -1);
        topCam.position.set(0, 420, -27);
        topCam.lookAt(0, 0, -27);
        topCam.updateProjectionMatrix();
        camPos.copy(topCam.position);
        camLook.set(0, 0, -27);
        window.__topCam = topCam;
        renderer.render(scene, topCam);
        renderer.render(scene, topCam);
        scene.fog = savedFog;
        for (const [u, v] of foggedWater) u.uFogFar.value = v;
      } else {
        renderer.render(scene, camera);
        renderer.render(scene, camera);
      }
    } else if (name === 'ringext') {
      // Ring-extension street shots (NEW PLAN 2a, Xian 21 Nov 17:58):
      // view=north: street level on the new z -79 street, looking east
      // along it at the north-ext shopfronts; view=east: street level
      // on the new x 84 street, looking north along the outer columns.
      // Stella + 2 peds staged in frame, full HUD.
      state.mode = 'play';
      showHUD();
      state.onFoot = false;
      playerMesh.visible = false;
      run(120, {});
      state.time = 18.7;
      updateLighting();
      const view = params.view || 'north';
      if (view === 'east') {
        car.x = 84; car.z = -10; car.angle = Math.PI / 2; car.speed = 0;
        car.mesh.position.set(car.x, ROAD_Y, car.z);
        car.mesh.rotation.y = car.angle;
        peds[0].mesh.position.set(85.2, 0, -8);
        peds[1].mesh.position.set(85.2, 0, -5);
        camera.position.set(84, 4.0, 5);
        camera.lookAt(84, 3.0, -28);
        camPos.copy(camera.position);
        camLook.set(84, 3.0, -28);
      } else { // north
        // Camera high (y 6.5) and pulled back so Stella, the
        // shopfronts and a strip of sky all read — at y 4 the
        // 2-wide street was a tunnel of awnings and blank facades.
        car.x = -40; car.z = -79; car.angle = 0; car.speed = 0;
        car.mesh.position.set(car.x, ROAD_Y, car.z);
        car.mesh.rotation.y = car.angle;
        peds[0].mesh.position.set(-38, 0, -80.2);
        peds[1].mesh.position.set(-35, 0, -80.2);
        camera.position.set(-62, 6.5, -79);
        camera.lookAt(10, 2.5, -79);
        camPos.copy(camera.position);
        camLook.set(10, 2.5, -79);
      }
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else { // walk
      state.mode = 'play';
      showHUD();
      state.onFoot = true;
      playerMesh.visible = true;
      // Walk EAST along the south sidewalk (z 1.5): it faces the bay,
      // boats and skyline.
      player.x = ANCHORS.sidewalk_south.x; player.z = ANCHORS.sidewalk_south.z; player.angle = 0;
      camPos.set(ANCHORS.vantage_walk_cam.x, ANCHORS.vantage_walk_cam.y, ANCHORS.vantage_walk_cam.z);
      camLook.set(ANCHORS.vantage_walk_cam.look.x, ANCHORS.vantage_walk_cam.look.y, ANCHORS.vantage_walk_cam.look.z);
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      run(120, { up: true });
      updateCamera(1);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    }
    // Push the live HUD values into the DOM now, so a ?shot capture
    // shows real numbers even if no animation frame has run yet.
    updateHUD(performance.now());
    window.__shotReady = true;
    window.__ready = true;
    window.__gameStats = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      mode: name,
      time: state.time,
    };
    window.__stats = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      mode: name,
      time: state.time,
    };
  }

  // --- main loop ---
  let last = performance.now();
  let acc = 0;
  let frameCount = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dtMs = now - last;
    last = now;
    if (state.mode === 'title') {
      stepClock(dtMs / 1000);
      updateLighting();
      for (const tk of district.tickers) tk.userData.tick(now / 1000);
      updateCamera(dtMs / 1000);
      renderer.render(scene, camera);
      updateHUD(now);
      return;
    }
    if (state.mode !== 'play') return;
    // Hub open pauses the simulation but the scene keeps rendering.
    if (!hub.open) {
      acc += Math.min(dtMs / 1000, 0.25) * fastsimFactor;
      while (acc >= STEP) {
        step(STEP);
        acc -= STEP;
      }
    }
    // Fast-sim: skip rendering (the driver reads state, not pixels);
    // render + HUD one frame in 30 so the canvas stays alive.
    frameCount++;
    if (fastsimFactor <= 1 || frameCount % 30 === 0) renderer.render(scene, camera);
    if (fastsimFactor <= 1 || frameCount % 30 === 0) updateHUD(now);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // Sun light target must be in the scene for its matrix to update.
  scene.add(sun.target);
  wirePauseMenu();
  updateLighting();
  updateCamera(1);
  window.__game = {
    state, car, player, traffic, cbdTraffic, peds, stageShot, setStorm, startPlay,
    wanted, combat, missions, hub, radio, saveSystem, doSave, doLoad,
    setPaused, respawnAfterEnd, showNextDialogue,
    get duelTarget() { return duelTarget; },
  };

  return {
    state, car, player, traffic, cbdTraffic, peds, renderer, scene, camera,
    stageShot, setStorm, startPlay, district,
    wanted, combat, missions, hub, radio, saveSystem,
    get duelTarget() { return duelTarget; },
    // Test-only fast simulation (see ?fastsim in main.js): steps the
    // game logic at a fixed 1/60 s dt without rendering. The sim is
    // deterministic in game-time (same step() calls, same dt); only
    // wall-clock-keyed cosmetics run slower relative to game time.
    setFastSim(n) { fastsimFactor = Math.max(1, Math.min(8, n | 0)); },
    get __fastsim() { return fastsimFactor; },
    run() { requestAnimationFrame(frame); },
  };
}
