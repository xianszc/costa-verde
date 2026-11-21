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
import { makeFigure, CAST, CIVILIANS } from './people.js';
import {
  buildStella, buildTrafficCar, createCar, stepCar,
  createTraffic, stepTraffic, collideCircleAABBs,
} from './vehicles.js';
import { buildRoadShowcase } from './roads.js';
import { skyTexture, skyPhaseForHour } from './water.js';
import { createRadio, STATIONS } from './radio.js';
import { createSaveSystem } from './save.js';
import { createMissionEngine, MISSIONS, PORTRAITS } from './missions.js';
import { createWanted } from './wanted.js';
import { createCombat, WEAPONS } from './combat.js';
import { createHub } from './hub.js';

const STEP = 1 / 60;
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
  scene.fog = new THREE.Fog(0xf2a35e, 70, 190);

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
    x: district.spawnPlayer.x,
    z: district.spawnPlayer.z,
    angle: district.spawnPlayer.angle,
    speed: 0,
    walkPhase: 0,
    radius: 0.5,
    crouched: false,
  };

  // --- hero car ---
  const stellaMesh = buildStella();
  scene.add(stellaMesh);
  const car = createCar(stellaMesh, {
    x: district.spawnCar.x, z: district.spawnCar.z, angle: district.spawnCar.angle,
  });
  car.mesh.position.set(car.x, 0, car.z);

  // --- traffic: 3 civilian cars + 2 Harbor Guard cruisers on the D4
  // lanes, plus 2 civilian cars on the old-town lanes (M3) so the new
  // district reads as lived-in. Lanes are found by name — the new
  // districts append their lanes after the D4 ones, so indices would
  // shift as districts land.
  const laneIdx = (name) => {
    const i = district.lanes.findIndex((l) => l.name === name);
    return i < 0 ? 0 : i;
  };
  const traffic = createTraffic(district.lanes, [
    { lane: 0, color: 0xf2f0ea, kind: 'sedan' },
    { lane: 0, color: 0x2e7f8f, kind: 'van' },
    { lane: 1, color: 0xe8a33d, kind: 'pickup' },
    { lane: 2, color: 0xc93a6b, kind: 'sedan' },
    { lane: laneIdx('oldtown-main'), color: 0x3e7cb1, kind: 'sedan' },
    { lane: laneIdx('oldtown-plaza'), color: 0xf2f0ea, kind: 'van' },
    { lane: 0, police: true },
    { lane: 1, police: true },
  ]);
  for (const t of traffic) scene.add(t.mesh);

  // --- pedestrians: 8 civilians walking the sidewalks ---
  const peds = [];
  const pedPaths = [
    { a: { x: -56, z: -7.2 }, b: { x: 56, z: -7.2 } },
    { a: { x: -56, z: 7.2 }, b: { x: 56, z: 7.2 } },
    { a: { x: -41.5, z: -40 }, b: { x: -41.5, z: -9 } },
    { a: { x: -18.5, z: -40 }, b: { x: -18.5, z: -9 } },
    { a: { x: 1.5, z: -40 }, b: { x: 1.5, z: -9 } },
    { a: { x: 21.5, z: -40 }, b: { x: 21.5, z: -9 } },
    { a: { x: 38.5, z: -40 }, b: { x: 38.5, z: -9 } },
    { a: { x: -56, z: 7.2 }, b: { x: -20, z: 7.2 } },
  ];
  CIVILIANS.forEach((c, i) => {
    const fig = makeFigure(c.spec);
    scene.add(fig);
    // Pedestrian paths: the D4 sidewalks plus every new district's
    // paths (old town first; promenade + skyline join as they land).
    // Spread the 8 civilians across the whole pool so each district
    // gets walkers instead of all 8 crowding the D4 sidewalks.
    const allPedPaths = [...pedPaths, ...(district.pedPaths || [])];
    const path = allPedPaths[Math.floor((i * allPedPaths.length) / CIVILIANS.length)];
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
      wanted.addHeat(5);
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
  function handleMissionEvent(ev) {
    if (!ev) return;
    if (ev.type === 'stage') {
      const s = ev.mission.stages[ev.stage];
      toast(`STAGE ${ev.stage + 1} — ${s.name}`);
      showNextDialogue();
    } else if (ev.type === 'complete') {
      state.money += ev.reward.money;
      state.xp = Math.min(10000, state.xp + ev.reward.xp);
      toast(`MISSION COMPLETE — ${ev.mission.code} ${ev.mission.title} · +S ${ev.reward.money} · +${ev.reward.xp} XP`);
      dialogueLine = null;
      if (missions.missionId + 1 < MISSIONS.length) {
        missions.start(missions.missionId + 1);
        showNextDialogue();
      } else {
        toast('All story missions complete — more in M3');
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
    showEndOverlay('BUSTED', `The Guard took S ${lost} in fines. Elio walks free — for now.`, 'WALK FREE');
    state.mode = 'paused';
  }
  function doWasted() {
    if (state.wasted || state.mode !== 'play') return;
    state.wasted = true;
    const lost = Math.floor(state.money * 0.2);
    state.money -= lost;
    wanted.reset();
    showEndOverlay('WASTED', `Elio wakes up at the marina clinic. S ${lost} gone to the bill.`, 'GET UP');
    state.mode = 'paused';
  }
  function respawnAfterEnd() {
    const ov = document.getElementById('busted-overlay');
    if (ov) ov.style.display = 'none';
    player.x = district.spawnPlayer.x;
    player.z = district.spawnPlayer.z;
    player.angle = district.spawnPlayer.angle;
    state.onFoot = true;
    playerMesh.visible = true;
    playerMesh.position.set(player.x, 0, player.z);
    state.health = 100;
    state.armour = 60;
    state.busted = false;
    state.wasted = false;
    state.mode = 'play';
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
      rim.intensity = 0.4 + elev * 0.4;
      scene.fog.color.setHex(phase === 'dusk' ? 0xe8836b : 0xf2a35e);
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
        player.x = Math.max(-58, Math.min(58, res.x));
        player.z = Math.max(-41, Math.min(12.4, res.z));
        player.speed = speed;
        player.walkPhase += dt * speed * 2.4;
      } else {
        player.speed = 0;
      }
      playerMesh.position.set(player.x, 0, player.z);
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
      p.mesh.position.set(x, 0, z);
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
    if (Math.abs(pz) <= 6) { street = 'LUNGOMARE'; sub = 'BOULEVARD · DISTRICT 4'; }
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
      stepTraffic(traffic, dt, obstacles);
      stepPeds(dt);
      // Missions: stage transitions from position / wanted / E-key.
      const ev = missions.update(
        state.onFoot ? player.x : car.x,
        state.onFoot ? player.z : car.z,
        wanted.level, dt,
      );
      handleMissionEvent(ev);
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
      car.x = -30; car.z = -3.4; car.angle = 0; car.speed = 0;
      state.time = name === 'night' ? 23.2 : name === 'storm' ? 17.5 : 18.7;
      setStorm(name === 'storm');
      updateLighting();
      run(150, { up: true });
      updateCamera(1);
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
      car.x = 0; car.z = 3.4; car.angle = 0; car.speed = 0;
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
      player.x = -53.5; player.z = 11.5; player.angle = 0;
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
        camera.position.set(-41, 4.5, 19);
        camera.lookAt(-52, 1.0, 11.5);
        camPos.copy(camera.position);
        camLook.set(-52, 1.0, 11.5);
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
      // M1 stage 2 (STEAL) with Vi's dialogue scene at the pavilion.
      state.mode = 'play';
      showHUD();
      state.onFoot = true;
      playerMesh.visible = true;
      // Elio southwest of the pavilion, facing its corner (NE) so the
      // building reads in three dimensions instead of a flat face.
      player.x = 34; player.z = -12; player.angle = Math.PI / 4;
      playerMesh.position.set(player.x, 0, player.z);
      playerMesh.rotation.y = player.angle + Math.PI / 2;
      state.time = 18.7;
      setStorm(false);
      updateLighting();
      missions.start(0);
      missions.advance();
      showNextDialogue();
      run(60, {});
      updateCamera(1);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else { // walk
      state.mode = 'play';
      showHUD();
      state.onFoot = true;
      playerMesh.visible = true;
      // Walk EAST along the south sidewalk (z 7.2): it has no planter
      // palms (the north sidewalk planters sit at z -7.2, right in the
      // chase camera) and it faces the bay, boats and skyline.
      player.x = -30; player.z = 7.2; player.angle = 0;
      camPos.set(-35.5, 3, 7.2);
      camLook.set(-27.5, 1.4, 7.2);
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
      acc += Math.min(dtMs / 1000, 0.25);
      while (acc >= STEP) {
        step(STEP);
        acc -= STEP;
      }
    }
    renderer.render(scene, camera);
    updateHUD(now);
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
    state, car, player, traffic, peds, stageShot, setStorm, startPlay,
    wanted, combat, missions, hub, radio, saveSystem, doSave, doLoad,
    setPaused, respawnAfterEnd, showNextDialogue,
  };

  return {
    state, car, player, traffic, peds, renderer, scene, camera,
    stageShot, setStorm, startPlay, district,
    wanted, combat, missions, hub, radio, saveSystem,
    run() { requestAnimationFrame(frame); },
  };
}
