// AZZURA HEIST — wanted system (M2: 1–5 stars, Guardia del Porto).
// Heat rises with crimes (shooting, hitting pedestrians, ramming Guard
// cars); stars follow heat thresholds. Each star level fields more units:
// cruisers chase and ram, interceptors (3+) cut ahead and ram head-on, a
// helicopter (3+) hovers over the player with a spotlight, roadblocks
// (4+) park across the boulevard ahead. Lose-the-heat: get every unit
// 90 m+ away for 10 s and a star drops. Busted: on foot, a cruiser
// within 2.5 m while the player barely moves for 3 s. Wasted is raised
// by the combat module when health hits zero.
import * as THREE from '../vendor/three.module.min.js';
import { M, box, cyl, mergedMesh, colored, xform, vertexColorMat } from './world.js';
import { buildPoliceCruiser, createCar, collideCircleAABBs } from './vehicles.js';

const THRESHOLDS = [0, 15, 35, 60, 85, 110]; // heat needed per star
const STAR_LABEL = ['CLEAN', 'WANTED · 1 STAR', 'WANTED · 2 STARS', 'WANTED · 3 STARS', 'WANTED · 4 STARS', 'WANTED · 5 STARS'];
// Units spawn on land only (never in the bay, z > 13, or off the map).
function clampSpawn(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Procedural Harbor Guard helicopter: navy body, tail boom, main + tail
// rotors, belly spotlight cone (a translucent mesh, aimed at the player).
function buildHeli() {
  const g = new THREE.Group();
  g.name = 'guard-heli';
  const body = [
    colored(xform(new THREE.BoxGeometry(3.2, 1.2, 1.6), 0, 0, 0), 0x16324f),
    colored(xform(new THREE.BoxGeometry(1.4, 0.9, 1.4), 1.8, 0.1, 0), 0x2e7f8f),
    colored(xform(new THREE.BoxGeometry(2.6, 0.5, 1.2), -2.2, 0.3, 0), 0x16324f),
  ];
  g.add(mergedMesh(body, vertexColorMat));
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.7, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x9fd4d8, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.75 }),
  );
  glass.position.set(1.65, 0.15, 0);
  g.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.06, 0.3), M(0x1a1a1a));
  rotor.position.set(0, 0.85, 0);
  g.add(rotor);
  const rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 7.5), M(0x1a1a1a));
  rotor2.position.set(0, 0.85, 0);
  g.add(rotor2);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), M(0xc0392b));
  tail.position.set(-3.4, 0.3, 0);
  g.add(tail);
  // Spotlight cone: apex at the belly, opening down toward the player.
  // Narrow (3.5) and faint so it reads as a beam, not a solid pyramid.
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 22, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.08,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  spot.position.set(0, -11, 0);
  // ConeGeometry already points apex-up / base-down: the apex sits at
  // the belly and the cone widens toward the ground. No rotation.
  g.add(spot);
  g.userData.rotor = [rotor, rotor2];
  g.userData.spot = spot;
  return g;
}

export function createWanted(scene, opts) {
  const { lanes, colliders, getPlayer, onBusted } = opts;
  let level = 0;
  let heat = 0;
  let quietTimer = 0;
  let coolTimer = 0;
  let bustedTimer = 0;
  let roadblock = null;
  const units = []; // {kind, mesh, car?, angle, speed, fireTimer, ramCooldown}
  const heli = { mesh: buildHeli(), active: false, angle: 0 };
  heli.mesh.visible = false;
  scene.add(heli.mesh);
  // Spotlight pool: a scene-level disc (not a heli child — a child would
  // inherit the heli's rotation and land offset from the player). It
  // tracks the player's world position while the heli is up.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 20),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.3, 0);
  pool.visible = false;
  scene.add(pool);

  function levelForHeat(h) {
    let l = 0;
    for (let i = 1; i <= 5; i++) if (h >= THRESHOLDS[i]) l = i;
    return l;
  }
  function addHeat(n) {
    heat = Math.min(140, heat + n);
    quietTimer = 0;
    const l = levelForHeat(heat);
    if (l !== level) setLevel(l);
  }
  function setLevel(l) {
    level = Math.max(0, Math.min(5, l));
    heat = Math.max(heat, THRESHOLDS[level]);
    if (level === 0) heat = 0;
  }
  function spawnUnit(kind, x, z) {
    if (kind === 'heli') { heli.active = true; heli.mesh.visible = true; return null; }
    const mesh = buildPoliceCruiser();
    if (kind === 'interceptor') {
      // Interceptor: gold roof beacon + faster, rams head-on.
      const gold = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.16, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xe8a33d, emissive: 0xe8a33d, emissiveIntensity: 0.8 }),
      );
      gold.position.set(0.4, 1.35, 0);
      mesh.add(gold);
    }
    const car = createCar(mesh, { maxSpeed: kind === 'interceptor' ? 30 : 20 + level, accel: 14 });
    car.x = x; car.z = z; car.angle = 0;
    car.mesh.position.set(x, 0, z);
    scene.add(mesh);
    const u = { kind, mesh, car, ramCooldown: 0, fireTimer: 1 + Math.random() * 2 };
    units.push(u);
    return u;
  }
  function removeUnit(u) {
    scene.remove(u.mesh);
    const i = units.indexOf(u);
    if (i >= 0) units.splice(i, 1);
  }
  function spawnRoadblock(px, pz, heading) {
    clearRoadblock();
    const g = new THREE.Group();
    g.name = 'roadblock';
    const cars = [];
    for (const s of [-2.6, 2.6]) {
      const m = buildPoliceCruiser();
      m.position.set(0, 0, s);
      m.rotation.y = Math.PI / 2;
      g.add(m);
      cars.push(m);
    }
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.4, 9),
      new THREE.MeshStandardMaterial({ color: 0xe8c33d, emissive: 0xe8c33d, emissiveIntensity: 0.4 }),
    );
    barrier.position.set(0, 0.7, 0);
    g.add(barrier);
    // Red flashing beacons on the barrier so it reads at a distance.
    for (const bz of [-3.5, 3.5]) {
      const beacon = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 1.6 }),
      );
      beacon.position.set(0, 1.65, bz);
      g.add(beacon);
    }
    const fx = Math.cos(heading), fz = -Math.sin(heading);
    g.position.set(px + fx * 18, 0, pz + fz * 18);
    g.rotation.y = heading;
    scene.add(g);
    roadblock = { group: g, cars, x: g.position.x, z: g.position.z };
  }
  function clearRoadblock() {
    if (!roadblock) return;
    scene.remove(roadblock.group);
    roadblock = null;
  }
  function desiredUnits() {
    // cruisers, interceptors per star level.
    return [
      [1, 0], [2, 0], [2, 1], [3, 2], [4, 2],
    ][level] || [0, 0];
  }
  function nearestUnitDist(px, pz) {
    let d = Infinity;
    for (const u of units) d = Math.min(d, Math.hypot(u.car.x - px, u.car.z - pz));
    if (heli.active) d = Math.min(d, 60);
    if (roadblock) d = Math.min(d, Math.hypot(roadblock.x - px, roadblock.z - pz));
    return d;
  }

  function update(dt, now) {
    const p = getPlayer();
    const px = p.x, pz = p.z;
    // Heat decays only while no crime was committed recently.
    quietTimer += dt;
    if (quietTimer > 5 && heat > 0) {
      heat = Math.max(0, heat - dt * 2.5);
      const l = levelForHeat(heat);
      if (l < level) setLevel(l);
    }
    // Maintain the unit roster for the current level.
    const [wantCruisers, wantInterceptors] = desiredUnits();
    const haveCruisers = units.filter((u) => u.kind === 'cruiser').length;
    const haveInterceptors = units.filter((u) => u.kind === 'interceptor').length;
    if (level === 0) {
      for (const u of [...units]) removeUnit(u);
      heli.active = false;
      heli.mesh.visible = false;
      clearRoadblock();
    } else {
      if (haveCruisers < wantCruisers) spawnUnit('cruiser', clampSpawn(px + 30 + Math.random() * 20, -58, 58), clampSpawn(pz + (Math.random() - 0.5) * 20, -40, 12));
      if (haveInterceptors < wantInterceptors) spawnUnit('interceptor', clampSpawn(px - 45, -58, 58), clampSpawn(pz + (Math.random() - 0.5) * 8, -40, 12));
      if (level >= 3 && !heli.active) spawnUnit('heli', px, pz);
      if (level < 3 && heli.active) { heli.active = false; heli.mesh.visible = false; }
      if (level >= 4 && !roadblock) spawnRoadblock(px, pz, p.angle || 0);
      if (level < 4 && roadblock) clearRoadblock();
    }
    // Pursuit: steer each ground unit toward the player, ram on contact.
    for (const u of units) {
      const dx = px - u.car.x;
      const dz = pz - u.car.z;
      const dist = Math.hypot(dx, dz) || 0.01;
      const wantAngle = Math.atan2(-dz, dx);
      let diff = wantAngle - u.car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      const targetSpeed = dist > 4 ? u.car.maxSpeed : u.car.maxSpeed * 0.4;
      u.car.speed += (targetSpeed - u.car.speed) * Math.min(1, dt * 1.2);
      const nx = u.car.x + Math.cos(u.car.angle) * u.car.speed * dt;
      const nz = u.car.z - Math.sin(u.car.angle) * u.car.speed * dt;
      const res = collideCircleAABBs(nx, nz, u.car.radius, colliders);
      u.car.x = res.x;
      u.car.z = res.z;
      u.car.mesh.position.set(u.car.x, 0, u.car.z);
      u.car.mesh.rotation.y = u.car.angle;
      const wheels = u.car.mesh.userData.wheels || [];
      for (const w of wheels) w.rotation.x += u.car.speed * dt * 2.4;
      // Light bar flash.
      const lb = u.car.mesh.userData.lightBar;
      if (lb) { const on = Math.floor(now * 3) % 2 === 0; lb[0].visible = on; lb[1].visible = !on; }
      // Ramming: close + fast → push + damage the player's car.
      u.ramCooldown -= dt;
      if (dist < 3.2 && Math.abs(u.car.speed) > 6 && u.ramCooldown <= 0) {
        u.ramCooldown = 2.5;
        if (opts.onRam) opts.onRam(u, dist);
      }
      u.fireTimer -= dt;
    }
    // Helicopter: hover just above the player, spotlight tracks them.
    if (heli.active) {
      heli.angle += dt * 0.25;
      const hx = px + Math.cos(heli.angle) * 2.5;
      const hz = pz + Math.sin(heli.angle) * 2.5;
      heli.mesh.position.set(hx, 24, hz);
      heli.mesh.rotation.y = -Math.atan2(pz - hz, px - hx) + Math.PI / 2;
      for (const r of heli.mesh.userData.rotor) r.rotation.y += dt * 22;
      const spot = heli.mesh.userData.spot;
      const night = opts.isNight ? opts.isNight() : false;
      spot.material.opacity = night ? 0.16 : 0.08;
      pool.material.opacity = night ? 0.4 : 0.2;
      pool.position.set(px, 0.3, pz);
      pool.visible = true;
    } else {
      pool.visible = false;
    }
    // Lose-the-heat: every unit far away for 10 s → one star drops.
    if (level > 0) {
      const d = nearestUnitDist(px, pz);
      if (d > 90) {
        coolTimer += dt;
        if (coolTimer >= 10) {
          coolTimer = 0;
          setLevel(level - 1);
        }
      } else {
        coolTimer = 0;
      }
    }
    // Busted: on foot, a cruiser right next to a nearly-still player.
    if (level > 0 && p.onFoot) {
      let close = false;
      for (const u of units) {
        if (Math.hypot(u.car.x - px, u.car.z - pz) < 2.5) { close = true; break; }
      }
      if (close && p.speed < 1) {
        bustedTimer += dt;
        if (bustedTimer >= 3 && onBusted) { bustedTimer = 0; onBusted(); }
      } else {
        bustedTimer = 0;
      }
    } else {
      bustedTimer = 0;
    }
    return { level, heat };
  }

  function damageUnit(u, dmg) {
    // A damaged unit flees when its hp hits zero. Returns true if it fled.
    u.hp = (u.hp === undefined ? 100 : u.hp) - dmg;
    if (u.hp <= 0) {
      u.dead = true;
      removeUnit(u);
      addHeat(6);
      return true;
    }
    return false;
  }
  function status() {
    if (level === 0) return 'CLEAN';
    return STAR_LABEL[level];
  }
  function unitRows() {
    // For the HUD dispatch panel: name, distance, status per unit.
    const p = getPlayer();
    const rows = [];
    for (const u of units.slice(0, 2)) {
      const d = Math.round(Math.hypot(u.car.x - p.x, u.car.z - p.z));
      rows.push({ name: u.kind === 'interceptor' ? 'Vespa-1 · INTERCEPTOR' : 'Anchor-2 · CRUISER', dist: d, st: level >= 1 ? 'IN PURSUIT' : 'PATROL' });
    }
    if (heli.active) rows.push({ name: 'Gull-1 · HELI', dist: 60, st: 'INBOUND' });
    if (roadblock) rows.push({ name: 'Roadblock · BOULEVARD', dist: Math.round(Math.hypot(roadblock.x - p.x, roadblock.z - p.z)), st: 'SET UP' });
    while (rows.length < 3) rows.push({ name: 'Beacon-3 · BOAT', dist: 240 + level * 40, st: level >= 1 ? 'RESPONDING' : 'PATROL' });
    return rows.slice(0, 3);
  }
  function reset() {
    for (const u of [...units]) removeUnit(u);
    heli.active = false;
    heli.mesh.visible = false;
    pool.visible = false;
    clearRoadblock();
    level = 0;
    heat = 0;
    coolTimer = 0;
    bustedTimer = 0;
  }
  return {
    get level() { return level; },
    get heat() { return heat; },
    get units() { return units; },
    get heliActive() { return heli.active; },
    addHeat, setLevel, update, status, unitRows, reset, nearestUnitDist, damageUnit,
  };
}
