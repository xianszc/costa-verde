// AZZURA HEIST — wanted system (M2: 1–5 stars, Guardia del Porto).
// Heat rises with crimes (shooting, hitting pedestrians, ramming Guard
// cars); stars follow heat thresholds. Each star level fields more units:
// cruisers chase and ram, interceptors (3+) cut ahead and ram head-on, a
// helicopter (3+) hovers over the player with a spotlight, roadblocks
// (4+) park across the boulevard ahead. Lose-the-heat: get every unit
// 90 m+ away for 10 s and a star drops. Busted: on foot, a cruiser
// within 2.5 m while the player barely moves for 3 s. Wasted is raised
// by the combat module when health hits zero.
//
// Ground contact (wheels-fix): every ground unit rides on the shared
// ROAD_Y (road top, y 0.2) — police cars in live pursuit used to sit at
// y 0 and sink 0.2 into the asphalt. Dispatch rows carry distinct
// callsigns per unit (no more "Anchor-2" twice) and short statuses so
// the panel text fits without clipping.
import * as THREE from '../vendor/three.module.min.js';
import { M, box, cyl, mergedMesh, colored, xform, vertexColorMat } from './world.js';
import { buildPoliceCruiser, createCar, collideCircleAABBs, ROAD_Y, CAR_SCALE } from './vehicles.js';

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
  let cruiserSeq = 0;
  let interceptorSeq = 0;
  const units = []; // {kind, mesh, car?, angle, speed, fireTimer, ramCooldown, callsign}
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
    const prev = level;
    level = Math.max(0, Math.min(5, l));
    heat = Math.max(heat, THRESHOLDS[level]);
    // AUDIT m-8: on a level drop, cap the heat just below the next
    // threshold — otherwise the leftover heat re-raises the star the
    // moment the decay pauses. (Safe: a drop always lands at level
    // <= 4, so level+1 is in range; level 0 is forced to heat 0 below.)
    if (level < prev) heat = Math.min(heat, THRESHOLDS[level + 1] - 1);
    if (level === 0) heat = 0;
    // AUDIO: game.js passes onLevel — wanted up/down stings.
    if (level !== prev && opts.onLevel) opts.onLevel(level, prev);
  }
  function spawnUnit(kind, x, z) {
    if (kind === 'heli') { heli.active = true; heli.mesh.visible = true; return null; }
    const mesh = buildPoliceCruiser();
    let callsign;
    if (kind === 'interceptor') {
      callsign = 'Vespa-' + (1 + (interceptorSeq++ % 4));
      // Interceptor: gold roof beacon + faster, rams head-on.
      const gold = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.16, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xe8a33d, emissive: 0xe8a33d, emissiveIntensity: 0.8 }),
      );
      gold.position.set(0.4, 1.35, 0);
      mesh.add(gold);
    } else {
      callsign = 'Anchor-' + (2 + (cruiserSeq++ % 4));
    }
    const car = createCar(mesh, { maxSpeed: kind === 'interceptor' ? 30 : 20 + level, accel: 14 });
    car.x = x; car.z = z; car.angle = 0;
    car.mesh.position.set(x, ROAD_Y, z);
    scene.add(mesh);
    const u = { kind, mesh, car, callsign, ramCooldown: 0, fireTimer: 1 + Math.random() * 2 };
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
    g.position.set(px + fx * 18, ROAD_Y, pz + fz * 18);
    g.rotation.y = heading;
    scene.add(g);
    // AUDIT m-20: the roadblock is SOLID — a collider on the shared
    // colliders list, so the player's car (and the pursuing units)
    // cannot drive through the barrier. The barrier's long axis is the
    // group's local z (9u + the two cruisers at +/-2.6); the AABB is
    // the union rotated by the heading (half-extents 1.0 along the
    // road, 4.8 across it).
    const hx = Math.abs(Math.cos(heading)) * 1.0 + Math.abs(Math.sin(heading)) * 4.8;
    const hz = Math.abs(Math.sin(heading)) * 1.0 + Math.abs(Math.cos(heading)) * 4.8;
    const col = {
      x0: g.position.x - hx, z0: g.position.z - hz,
      x1: g.position.x + hx, z1: g.position.z + hz, id: 'roadblock',
    };
    colliders.push(col);
    roadblock = { group: g, cars, x: g.position.x, z: g.position.z, collider: col };
  }
  function clearRoadblock() {
    if (!roadblock) return;
    scene.remove(roadblock.group);
    if (roadblock.collider) {
      const i = colliders.indexOf(roadblock.collider);
      if (i >= 0) colliders.splice(i, 1);
    }
    roadblock = null;
  }
  function desiredUnits() {
    // cruisers, interceptors per star level.
    // AUDIT M-8: level 5 had no entry and fell to [0,0] — no units at
    // 5 stars. The ladder continues the pattern: 5 cruisers, 2
    // interceptors.
    return [
      [1, 0], [2, 0], [2, 1], [3, 2], [4, 2], [5, 2],
    ][level] || [0, 0];
  }
  function nearestUnitDist(px, pz) {
    // AUDIT M-9: only GROUND units count — the heli (pinned at 60)
    // and the static roadblock made "lose the heat at 90 m" impossible
    // at 3+ stars, because neither can ever be 90 m away.
    let d = Infinity;
    for (const u of units) d = Math.min(d, Math.hypot(u.car.x - px, u.car.z - pz));
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
      // AUDIT m-1/m-2: spawns follow the player's HEADING — the
      // interceptor cuts off AHEAD (45u along the heading), the
      // cruiser converges from BEHIND (30-50u back), never on top of
      // the player. The old code spawned both east of the player
      // whatever way they faced. Clamps widened to the land limits
      // (x -58..108, z -86..12.5); units clamp themselves the same
      // way in the pursuit loop below.
      const fx = Math.cos(p.angle || 0), fz = -Math.sin(p.angle || 0);
      const lx = Math.sin(p.angle || 0), lz = Math.cos(p.angle || 0);
      if (haveCruisers < wantCruisers) {
        const back = 30 + Math.random() * 20, lat = (Math.random() - 0.5) * 20;
        spawnUnit('cruiser',
          clampSpawn(px - fx * back + lx * lat, -58, 108),
          clampSpawn(pz - fz * back + lz * lat, -86, 12.5));
      }
      if (haveInterceptors < wantInterceptors) {
        const lat = (Math.random() - 0.5) * 8;
        spawnUnit('interceptor',
          clampSpawn(px + fx * 45 + lx * lat, -58, 108),
          clampSpawn(pz + fz * 45 + lz * lat, -86, 12.5));
      }
      if (level >= 3 && !heli.active) spawnUnit('heli', px, pz);
      if (level < 3 && heli.active) { heli.active = false; heli.mesh.visible = false; }
      if (level >= 4 && !roadblock) spawnRoadblock(px, pz, p.angle || 0);
      if (level < 4 && roadblock) clearRoadblock();
    }
    // Pursuit: steer each ground unit toward the player. On foot the
    // Guard holds a 2 m cordon and aims instead of driving through the
    // player; in a car it rams on contact. All ground units ride on
    // ROAD_Y (the road top), never sunk into the asphalt.
    // Part F: hold was 3 m on foot / 4 m in a car — with half-size
    // cars the cordon is measured from the car centre, so 2 m keeps
    // the same bumper gap as before (~0.95u on foot).
    for (const u of units) {
      const dx = px - u.car.x;
      const dz = pz - u.car.z;
      const dist = Math.hypot(dx, dz) || 0.01;
      const wantAngle = Math.atan2(-dz, dx);
      let diff = wantAngle - u.car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      // Part I: hold scales with CAR_SCALE (0.7) — on foot 3 x 0.7
      // = 2.1, in car 4 x 0.7 = 2.8 (was 1.05 / 1.4 at 0.35-scale).
      // Written as a formula now so the next scale change needs no
      // literal edit.
      const holdDist = p.onFoot ? 3 * CAR_SCALE : 4 * CAR_SCALE;
      const targetSpeed = dist > holdDist ? u.car.maxSpeed : (p.onFoot ? 0 : u.car.maxSpeed * 0.4);
      u.car.speed += (targetSpeed - u.car.speed) * Math.min(1, dt * 1.2);
      const nx = u.car.x + Math.cos(u.car.angle) * u.car.speed * dt;
      const nz = u.car.z - Math.sin(u.car.angle) * u.car.speed * dt;
      const res = collideCircleAABBs(nx, nz, u.car.radius, colliders);
      // Stay on land: never drive into the bay (z > 12.5) — a cruiser
      // straddling the quay edge reads as sunk — except on the skyline
      // bridge / landmass (x -58..58, z 62..104), and never off the map
      // (old town z -86, promenade east x 108).
      const onSkyline = (res.x >= -58 && res.x <= 58 && res.z >= 62 && res.z <= 104)
        || (Math.abs(res.x) <= 4.5 && res.z >= 13 && res.z <= 62);
      u.car.x = Math.max(-58, Math.min(108, res.x));
      u.car.z = onSkyline
        ? Math.max(-86, Math.min(104, res.z))
        : Math.max(-86, Math.min(12.5, res.z));
      u.car.mesh.position.set(u.car.x, ROAD_Y, u.car.z);
      u.car.mesh.rotation.y = u.car.angle;
      const wheels = u.car.mesh.userData.wheels || [];
      // Part F: the manual spin constant 2.4 was tuned for full-size
      // wheels — the visual wheels are CAR_SCALE now, so the rate
      // scales by 1/CAR_SCALE (else the police wheels spin too slow).
      for (const w of wheels) w.rotation.x += u.car.speed * dt * 2.4 / CAR_SCALE;
      // Light bar flash.
      const lb = u.car.mesh.userData.lightBar;
      if (lb) { const on = Math.floor(now * 3) % 2 === 0; lb[0].visible = on; lb[1].visible = !on; }
      // Ramming: close + fast → push + damage the player's car.
      // Only while the player is driving — never onto a pedestrian.
      // Part I: ram trigger 3.2 x CAR_SCALE (0.7) = 2.24.
      u.ramCooldown -= dt;
      if (!p.onFoot && dist < 3.2 * CAR_SCALE && Math.abs(u.car.speed) > 6 && u.ramCooldown <= 0) {
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
    // Busted: on foot, a unit right on top of a nearly-still player.
    // GAME fix (M9 fail-event 22 Nov 06:40): the radius was 3.5 m
    // but units HOLD at 3 m from a walking player, so the hold itself
    // sat inside the bust radius — a player laying low (still, speed
    // < 1) with a unit holding its cordon was busted in 3 s no matter
    // what (M9 LAY LOW: wanted decaying 3->2->1, then BUSTED at the
    // fortress plaza). The bust radius must be INSIDE the hold
    // distance: 1.25 m busts only a unit that closes in past its hold
    // (ramming / walking into the player), never one just holding.
    // Part I: hold is now 2.1 / 2.8, bust 2.5 x CAR_SCALE (0.7)
    // = 1.75 (still inside hold).
    if (level > 0 && p.onFoot) {
      let close = false;
      for (const u of units) {
        if (Math.hypot(u.car.x - px, u.car.z - pz) < 2.5 * CAR_SCALE) { close = true; break; }
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
    // For the HUD dispatch panel: name, distance, short status per unit.
    // Callsigns are distinct per unit (Anchor-2/3/4/5, Vespa-1/2) and
    // statuses are short ('PURSUIT', 'EN ROUTE') so the panel text
    // fits its width without clipping.
    const p = getPlayer();
    const rows = [];
    const seen = new Set();
    for (const u of units) {
      const key = u.callsign + '·' + u.kind;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = Math.round(Math.hypot(u.car.x - p.x, u.car.z - p.z));
      rows.push({ name: u.callsign + ' · ' + (u.kind === 'interceptor' ? 'INTERCEPTOR' : 'CRUISER'), dist: d, st: level >= 1 ? 'PURSUIT' : 'PATROL' });
      if (rows.length >= 2) break;
    }
    if (heli.active) rows.push({ name: 'Gull-1 · HELI', dist: 60, st: 'INBOUND' });
    if (roadblock) rows.push({ name: 'Roadblock · BLVD', dist: Math.round(Math.hypot(roadblock.x - p.x, roadblock.z - p.z)), st: 'SET UP' });
    // AUDIT m-3: the pad rows (Falco-2 / Vespa-1 / Lupo-3) were fake —
    // no such units exist in the world. Only real units are listed;
    // the panel hides the empty rows (game.js updateHUD).
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
    // AUDIT m-34: the reset left the quiet clock and the callsign
    // counters running, so a fresh pursuit started with a stale
    // quietTimer and reused callsigns.
    quietTimer = 0;
    cruiserSeq = 0;
    interceptorSeq = 0;
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
