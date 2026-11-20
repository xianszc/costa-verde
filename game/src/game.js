// AZZURA HEIST — playable core (M1).
// One game object: District 4 (Lungomare) built from city.js, Elio on foot
// and in the Stella roadster, chase camera, traffic + pedestrians on the
// road network's lanes, HUD wired to REAL values, a day/night cycle and a
// storm event. ?shot=title|drive|walk|night|storm|road stages a deterministic
// scene (fixed steps, scripted inputs), paints it twice and sets
// window.__shotReady — the kit's loading pattern.
import * as THREE from '../vendor/three.module.min.js';
import { buildDistrict4, windowMat } from './city.js';
import { makeFigure, CAST, CIVILIANS } from './people.js';
import { buildStella, createCar, stepCar, createTraffic, stepTraffic, collideCircleAABBs } from './vehicles.js';
import { buildRoadShowcase } from './roads.js';
import { skyTexture, skyPhaseForHour } from './water.js';

const STEP = 1 / 60;
const RADIO = [
  { name: 'RADIO LUME', track: 'Notte di Luce — Solmar Five · Italo Disco' },
  { name: 'ONDA AZZURA', track: 'Blue Hour — Marina Quartet · Jazz' },
  { name: 'RADIO CAVA', track: 'Stone and Thunder — The Quarrymen · Rock' },
];
const DIALOGUE = [
  { who: 'ELIO SANTORO', line: 'The ledger\u2019s on the ferry. We go in quiet \u2014 no sirens, no heroes.' },
  { who: 'VI ROMANO', line: 'The Guard changes shift at dusk. That\u2019s your window, Elio.' },
];

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
  // blotches all over the flat roads at the low golden-hour sun angle
  // (the blotches appeared on every surface — asphalt, cobble, concrete —
  // so they were shadows, not the texture).
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
  const elioSpec = CAST[0].spec;
  const playerMesh = makeFigure(elioSpec);
  scene.add(playerMesh);
  const player = {
    mesh: playerMesh,
    x: district.spawnPlayer.x,
    z: district.spawnPlayer.z,
    angle: district.spawnPlayer.angle,
    speed: 0,
    walkPhase: 0,
    radius: 0.5,
  };

  // --- hero car ---
  const stella = buildStella();
  scene.add(stella);
  const car = createCar(stella, {
    x: district.spawnCar.x, z: district.spawnCar.z, angle: district.spawnCar.angle,
  });
  car.mesh.position.set(car.x, 0, car.z);

  // --- traffic: 3 civilian cars + 2 Harbor Guard cruisers ---
  const traffic = createTraffic(district.lanes, [
    { lane: 0, color: 0xf2f0ea, kind: 'sedan' },
    { lane: 0, color: 0x2e7f8f, kind: 'van' },
    { lane: 1, color: 0xe8a33d, kind: 'pickup' },
    { lane: 2, color: 0xc93a6b, kind: 'sedan' },
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
    const path = pedPaths[i % pedPaths.length];
    peds.push({
      mesh: fig, path, t: (i * 0.13) % 1, dir: 1,
      speed: 1.1 + (i % 3) * 0.35, phase: i * 1.7, spec: c,
    });
  });

  // --- rain (storm) ---
  // Rain: a tight volume around the camera so the drops are actually in
  // the frustum (a wide sparse box reads as no rain at all).
  const RAIN_N = 1200;
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 36;
    rainPos[i * 3 + 1] = Math.random() * 14;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0x7e9cc0, size: 0.2, transparent: true, opacity: 0.85, sizeAttenuation: true,
  }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  const rainVel = [];
  for (let i = 0; i < RAIN_N; i++) rainVel.push(14 + Math.random() * 8);
  // Splash particles under the car (storm, while driving).
  const SPLASH_N = 36;
  const splashPos = new Float32Array(SPLASH_N * 3);
  const splashGeo = new THREE.BufferGeometry();
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
  const splash = new THREE.Points(splashGeo, new THREE.PointsMaterial({
    color: 0xdff4f8, size: 0.2, transparent: true, opacity: 0.7, sizeAttenuation: true,
  }));
  splash.frustumCulled = false;
  splash.visible = false;
  scene.add(splash);
  const splashAge = new Float32Array(SPLASH_N).fill(99);

  // --- game state ---
  const state = {
    mode: 'title', // title | play | paused | shot
    onFoot: true,
    time: 18.7, // game hours; 18:42 golden hour
    day: 1,
    storm: false,
    money: 1250,
    wanted: 0,
    wantedTimer: 0,
    health: 100,
    armour: 60,
    xp: 1240,
    xpMax: 2000,
    rank: 'WHEELMAN',
    radio: 0,
    weapon: 1,
    missionStage: 1,
    missionTime: 272, // 04:32
    dialogue: 0,
    dialogueVisible: true,
    showMinimap: true,
  };
  const keys = {};
  const input = { up: false, down: false, left: false, right: false, handbrake: false };
  let showcase = null; // ?shot=road scene

  function readKeys() {
    input.up = !!(keys['KeyW'] || keys['ArrowUp']);
    input.down = !!(keys['KeyS'] || keys['ArrowDown']);
    input.left = !!(keys['KeyA'] || keys['ArrowLeft']);
    input.right = !!(keys['KeyD'] || keys['ArrowRight']);
    input.handbrake = !!keys['Space'];
    // ?shot=drive/night/storm keeps the car rolling after the staged
    // steps, so the capture shows a live speed instead of a coasted stop.
    if (state.scriptedAccel) input.up = true;
  }
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Enter' && state.mode === 'title') startPlay();
    else if (e.code === 'Escape' && state.mode === 'play') setPaused(true);
    else if (e.code === 'Escape' && state.mode === 'paused') setPaused(false);
    else if (e.code === 'KeyE' && state.mode === 'play') toggleCar();
    else if (e.code === 'KeyR' && state.mode === 'play') state.radio = (state.radio + 1) % RADIO.length;
    else if (e.code === 'Space' && state.mode === 'play' && state.onFoot) state.dialogueVisible = false;
    else if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= 5) state.weapon = n - 1;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  function startPlay() {
    state.mode = 'play';
    showHUD();
  }
  function showHUD() {
    const card = document.getElementById('title-card');
    if (card) card.style.display = 'none';
    const hud = document.getElementById('hud-stage');
    if (hud) hud.style.display = 'block';
    // The title-screen topbar and version line duplicate the HUD header —
    // hide them in play mode so nothing overlaps.
    const topbar = document.getElementById('topbar');
    if (topbar) topbar.style.display = 'none';
    const version = document.getElementById('version');
    if (version) version.style.display = 'none';
  }
  function setPaused(on) {
    state.mode = on ? 'paused' : 'play';
    const ov = document.getElementById('pause-overlay');
    if (ov) ov.style.display = on ? 'flex' : 'none';
  }
  function toggleCar() {
    if (state.onFoot) {
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < 4) {
        state.onFoot = false;
        playerMesh.visible = false;
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
    // Sun path: rises 06:00 east, sets 19:00 west; night = moonlight.
    // dayFrac 0..1 across the day; elev peaks at noon, sun low + warm
    // at golden hour. The light comes from the west-southwest at golden
    // hour so the camera-facing facades catch it.
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
      // Cinematic sun placement: it travels west (left) through the day
      // and stays in the upper-left sky, clear of the centred tagline.
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
      target = new THREE.Vector3(car.x - f.x * 9.5, 4.2, car.z - f.z * 9.5);
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
      const speed = run ? 6 : 3.2;
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
      // Bump a pedestrian while running fast: wanted +1 (M1: simple rule).
      if (player.speed > 5) {
        for (const p of peds) {
          if (Math.hypot(p.mesh.position.x - player.x, p.mesh.position.z - player.z) < 1.0) {
            raiseWanted();
          }
        }
      }
    } else {
      stepCar(car, input, dt, colliders);
      state.xp = Math.min(state.xpMax, state.xp + Math.abs(car.speed) * dt * 0.6);
      // Hitting a pedestrian while driving: wanted +1.
      for (const p of peds) {
        if (Math.hypot(p.mesh.position.x - car.x, p.mesh.position.z - car.z) < 1.8 && Math.abs(car.speed) > 3) {
          raiseWanted();
        }
      }
    }
  }
  function raiseWanted() {
    if (state.wantedTimer > 0) return;
    state.wanted = Math.min(3, state.wanted + 1);
    state.wantedTimer = 8;
  }
  function stepPeds(dt) {
    for (const p of peds) {
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
      let y = rainPos[i * 3 + 1] - rainVel[i] * dt;
      if (y < 0) {
        const along = 6 + Math.random() * 18;
        const lat = (Math.random() - 0.5) * 30;
        rainPos[i * 3] = cx + nx * along + lx * lat;
        rainPos[i * 3 + 1] = 4 + Math.random() * 6;
        rainPos[i * 3 + 2] = cz + nz * along + lz * lat;
      } else {
        rainPos[i * 3 + 1] = y;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
    // Splash under the car while driving in the rain.
    const moving = !state.onFoot && Math.abs(car.speed) > 4;
    splash.visible = moving;
    if (moving) {
      for (let i = 0; i < SPLASH_N; i++) {
        splashAge[i] += dt;
        if (splashAge[i] > 0.5) {
          splashAge[i] = 0;
          const w = (i % 4) - 1.5;
          splashPos[i * 3] = car.x + (Math.random() - 0.5) * 1.6;
          splashPos[i * 3 + 1] = 0.1;
          splashPos[i * 3 + 2] = car.z + w * 0.5 + (Math.random() - 0.5) * 0.8;
        }
        splashPos[i * 3 + 1] = 0.1 + splashAge[i] * 1.4;
      }
      splashGeo.attributes.position.needsUpdate = true;
    }
  }
  function stepClock(dt) {
    state.time += dt / 20; // 1 game hour per 20 real seconds
    if (state.time >= 24) { state.time -= 24; state.day += 1; }
    if (state.wantedTimer > 0) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) state.wanted = Math.max(0, state.wanted - 1);
    }
    if (state.missionTime > 0) state.missionTime -= dt;
  }

  // --- HUD (live values) ---
  const $ = (id) => document.getElementById(id);
  let lastHud = 0;
  function updateHUD(now) {
    if (now - lastHud < 100) return;
    lastHud = now;
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
      stars.innerHTML = '<span class="lit">' + '★'.repeat(state.wanted) + '</span>' +
        '<span class="dim">' + '☆'.repeat(5 - state.wanted) + '</span>';
    }
    setText('hud-wanted-status', state.wanted > 0 ? `WANTED · ${state.wanted} STAR${state.wanted > 1 ? 'S' : ''}` : 'CLEAN');
    setText('hud-health-num', String(Math.round(state.health)));
    setText('hud-armour-num', String(Math.round(state.armour)));
    setText('hud-xp-num', `${Math.floor(state.xp).toLocaleString('en-US')} / ${state.xpMax.toLocaleString('en-US')}`);
    setWidth('hud-health-bar', state.health);
    setWidth('hud-armour-bar', state.armour);
    setWidth('hud-xp-bar', (state.xp / state.xpMax) * 100);
    const speedKmh = Math.round(Math.abs(state.onFoot ? player.speed : car.speed) * 3.6);
    // On foot the speed shows the real walk speed; the vehicle name says
    // ON FOOT once (the old code wrote ON FOOT in both slots).
    setText('hud-speed', `${speedKmh} KM/H`);
    setText('hud-vehicle-name', state.onFoot ? 'ON FOOT' : 'STELLA ROADSTER');
    setText('hud-vehicle-sub', state.onFoot ? 'PRESS E NEAR THE CAR' : `FUEL ${Math.round(car.fuel)}% · DAMAGE ${Math.round(car.damage)}%`);
    setText('hud-radio-name', RADIO[state.radio].name);
    setText('hud-radio-track', RADIO[state.radio].track);
    const mm2 = Math.floor(state.missionTime / 60);
    const ss2 = Math.floor(state.missionTime % 60);
    setText('hud-mission-time', `${String(mm2).padStart(2, '0')}:${String(ss2).padStart(2, '0')}`);
    // Mission stage bar.
    for (let i = 1; i <= 3; i++) {
      const el = $(`hud-stage-${i}`);
      if (el) el.className = 'stage' + (i < state.missionStage ? ' done' : i === state.missionStage ? ' active' : '');
    }
    // Police panel: real distances to the two cruisers + the heli.
    const cruisers = traffic.filter((t) => t.police);
    const px = state.onFoot ? player.x : car.x;
    const pz = state.onFoot ? player.z : car.z;
    const d1 = cruisers[0] ? Math.round(Math.hypot(cruisers[0].x - px, cruisers[0].z - pz)) : 320;
    const d2 = cruisers[1] ? Math.round(Math.hypot(cruisers[1].x - px, cruisers[1].z - pz)) : 180;
    setText('hud-police-1-dist', `${d1} m`);
    setText('hud-police-2-dist', `${d2} m`);
    setText('hud-police-3-dist', `${240 + state.wanted * 40} m`);
    const st1 = $('hud-police-1-st');
    if (st1) { st1.textContent = state.wanted >= 3 ? 'INBOUND' : 'PATROL'; st1.className = 'st ' + (state.wanted >= 3 ? 'hot' : 'warm'); }
    const st2 = $('hud-police-2-st');
    if (st2) { st2.textContent = state.wanted >= 1 ? 'IN PURSUIT' : 'PATROL'; st2.className = 'st ' + (state.wanted >= 1 ? 'hot' : 'warm'); }
    // Minimap: player arrow + district / street label.
    const arrow = $('hud-player-arrow');
    if (arrow) {
      const sx = ((px + 60) / 120) * 150;
      const sy = ((pz + 42) / 55) * 150;
      const heading = state.onFoot ? player.angle : car.angle;
      arrow.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)}) rotate(${(-heading * 180 / Math.PI).toFixed(1)})`);
    }
    let street = 'LUNGOMARE';
    let sub = 'VIA DEL FARO · DISTRICT 4';
    if (Math.abs(pz) <= 6) { street = 'LUNGOMARE'; sub = 'BOULEVARD · DISTRICT 4'; }
    else if (pz < -30) { street = 'VIA DEL PORTO'; sub = 'OLD QUARTER · DISTRICT 4'; }
    else if (pz > 8.5) { street = 'QUAY'; sub = 'HARBOR FRONT · DISTRICT 4'; }
    setText('hud-map-district', street);
    setText('hud-map-street', sub);
    // Dialogue box.
    const dlg = $('hud-dialogue');
    if (dlg) {
      dlg.style.display = state.dialogueVisible ? 'flex' : 'none';
      if (state.dialogueVisible) {
        setText('hud-dialogue-who', DIALOGUE[state.dialogue].who);
        setText('hud-dialogue-line', '\u201C' + DIALOGUE[state.dialogue].line + '\u201D');
      }
    }
    // Weapon slots.
    for (let i = 0; i < 5; i++) {
      const el = $(`hud-weapon-${i}`);
      if (el) el.className = 'wslot' + (i === state.weapon ? ' sel' : '');
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
      // Traffic yields to the player's car (or to the player on foot).
      const obstacles = state.onFoot
        ? [{ x: player.x, z: player.z }]
        : [{ x: car.x, z: car.z }];
      stepTraffic(traffic, dt, obstacles);
      stepPeds(dt);
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
      showcase = buildRoadShowcase(params.district || 'oldtown');
      scene.add(showcase.group);
      district.group.visible = false;
      playerMesh.visible = false;
      car.mesh.visible = false;
      for (const t of traffic) t.mesh.visible = false;
      for (const p of peds) p.mesh.visible = false;
      // Clean road view: no title card, no HUD, no topbar/version line.
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
      // Low view down the road itself (camera ON the road, clear of the
      // flanking buildings at z +/-9): surface + markings + both sides.
      camera.position.set(14, 2.6, 0);
      camera.lookAt(-12, 0.9, 0);
      camPos.copy(camera.position);
      camLook.set(-12, 0.9, 0);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
      window.__shotReady = true;
      window.__shotLabel = showcase.label;
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
    acc += Math.min(dtMs / 1000, 0.25);
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
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
  updateLighting();
  updateCamera(1);
  window.__game = { state, car, player, traffic, peds, stageShot, setStorm, startPlay };

  return {
    state, car, player, traffic, peds, renderer, scene, camera,
    stageShot, setStorm, startPlay, district,
    run() { requestAnimationFrame(frame); },
  };
}
