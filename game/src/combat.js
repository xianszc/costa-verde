// AZZURA HEIST — combat (M3: visible tracers + muzzle flash + impacts).
// All five HUD slots are usable: switching (1–5 / wheel), ammo, fire
// rate, reload. Shooting is a hitscan from the camera through the
// crosshair. Every shot draws a VISIBLE tracer — a glowing additive
// cylinder from the muzzle to the hit point — plus a muzzle-flash
// starburst mesh and a point light; a hit bursts orange impact sparks
// and leaves a dark scorch decal (capped, fading); a miss that reaches
// the road leaves a decal and sparks on the asphalt. Police units
// return fire with their own orange-red tracers from the cruiser roof,
// so a shoot-out reads in both directions. Cover: crouch (C) behind a
// prop or wall within 2 m in front of the player and incoming fire drops
// to a quarter while police accuracy falls. Police units return fire
// while wanted — accuracy falls with distance, with the player's speed,
// and with cover. Armour absorbs damage first.
import * as THREE from '../vendor/three.module.min.js';

export const WEAPONS = [
  { name: 'FISTS', damage: 12, range: 2.2, rate: 2.5, spread: 0, mag: Infinity, reserve: Infinity, auto: false },
  { name: 'LUPO P9', damage: 12, range: 55, rate: 4, spread: 0.012, mag: 12, reserve: 48, auto: false },
  { name: 'DOPPIETTA', damage: 16, range: 22, rate: 1, spread: 0.06, mag: 2, reserve: 8, auto: false, pellets: 6 },
  { name: 'TAMBURO', damage: 8, range: 40, rate: 9, spread: 0.03, mag: 24, reserve: 96, auto: true },
  { name: 'FUCILE', damage: 38, range: 90, rate: 1.5, spread: 0.004, mag: 5, reserve: 20, auto: false },
];

const TRACER_LIFE = 0.12;
const MAX_DECALS = 24;
const MAX_BURSTS = 6;

export function createCombat(scene, camera, opts) {
  const { getPlayer, getTargets, onCrime, onDamage, onFire, audio } = opts;
  const ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
  let selected = 1;
  let cooldown = 0;
  let reloading = 0;
  let flash = null;
  let flashMesh = null;
  let flashTimer = 0;
  // GAME fix (M9 22 Nov 06:55): lay-low clock. Guard return fire
  // pauses while the player is laying low (see update()); the clock
  // tracks game time and the player's last shot.
  let combatTime = 0;
  let lastPlayerShotAt = -1e9;
  const tracers = [];
  const bursts = [];
  const decals = [];
  const ray = new THREE.Raycaster();

  // Shared tracer geometry: a unit cylinder along +Y, scaled to the
  // shot length and aimed with a quaternion. One geometry, one material
  // per colour — the meshes themselves are cheap and pooled by life.
  const tracerGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 6, 1, true);
  const tracerMats = {
    player: new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    enemy: new THREE.MeshBasicMaterial({
      color: 0xff7a4d, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  };
  const up = new THREE.Vector3(0, 1, 0);
  function showTracer(from, to, kind = 'player') {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.1) return;
    const m = new THREE.Mesh(tracerGeo, tracerMats[kind].clone());
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    m.scale.set(1, len, 1);
    m.userData.life = TRACER_LIFE;
    m.userData.kind = kind;
    scene.add(m);
    tracers.push(m);
  }

  // Muzzle flash: a crossed-plane starburst (additive) + a point light.
  // The planes read in a screenshot; the light alone never did.
  function buildFlashMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.22), mat);
      p.rotation.z = (i / 3) * Math.PI;
      g.add(p);
    }
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfff6d8, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    g.add(core);
    return g;
  }
  function muzzleWorld() {
    const p = getPlayer();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // Part N2: the muzzle sits at the player's shoulder — 0.78 x stature
    // (people.js: hip 0.48H + torso 0.32H x 0.92). The old 1.4 was the
    // pre-Part-J shoulder at PED_SCALE 1.0; at 0.30 it floated 0.8u over
    // Elio's head. Height comes from getPlayer (userData.height, 0.576u).
    const shoulderY = (p.height || 0.576) * 0.78;
    return { origin: new THREE.Vector3(p.x, shoulderY, p.z), dir };
  }
  function showFlash(origin, dir) {
    if (!flash) {
      flash = new THREE.PointLight(0xffe9a8, 0, 9);
      scene.add(flash);
    }
    if (!flashMesh) {
      flashMesh = buildFlashMesh();
      scene.add(flashMesh);
    }
    flash.position.copy(origin);
    flash.intensity = 6;
    flashTimer = 0.06;
    flashMesh.position.copy(origin).addScaledVector(dir, 0.35);
    flashMesh.lookAt(origin.clone().addScaledVector(dir, 2));
    flashMesh.visible = true;
    flashMesh.scale.setScalar(0.8 + Math.random() * 0.5);
  }

  // Impact sparks: a short-lived Points burst at the hit point.
  function showSparks(point, normal) {
    if (bursts.length >= MAX_BURSTS) {
      const old = bursts.shift();
      scene.remove(old.points);
      old.points.geometry.dispose();
      old.points.material.dispose();
    }
    const N = 14;
    const pos = new Float32Array(N * 3);
    const vel = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = point.x;
      pos[i * 3 + 1] = point.y;
      pos[i * 3 + 2] = point.z;
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 3.2,
        Math.random() * 2.6 + 0.6,
        (Math.random() - 0.5) * 3.2,
      );
      if (normal) v.addScaledVector(normal, 1.2);
      vel.push(v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffc46b, size: 0.14, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    points.frustumCulled = false;
    scene.add(points);
    bursts.push({ points, vel, life: 0.4, max: 0.4 });
  }

  // Impact decal: a small dark scorch disc on the hit face (or flat on
  // the road for a miss). Capped at 24; the oldest fades out first.
  const decalGeo = new THREE.CircleGeometry(0.18, 12);
  const decalMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false,
  });
  function showDecal(point, normal) {
    if (decals.length >= MAX_DECALS) {
      const old = decals.shift();
      scene.remove(old.mesh);
      // AUDIT m-23: the evicted decal's cloned material leaked — the
      // expiry path in update() disposes it, the cap path did not.
      old.mesh.material.dispose();
    }
    const m = new THREE.Mesh(decalGeo, decalMat.clone());
    m.position.copy(point).addScaledVector(normal, 0.02);
    m.lookAt(point.clone().add(normal));
    m.userData.life = 10;
    scene.add(m);
    decals.push({ mesh: m, life: 10 });
  }

  // AUDIO: ray vs the world colliders (2D AABBs {x0,z0,x1,z1,id}).
  // A collider counts as a ~3u wall; material by id ('glass' → glass,
  // the harbor crane → metal, everything else → wall). Buildings are
  // taller than 3u, so a shot over a low prop is not a wall hit.
  function rayColliderHit(origin, d, range) {
    let bestT = Infinity, bestMat = null;
    for (const c of opts.colliders || []) {
      let tmin = 0, tmax = range;
      for (const [o, dd, lo, hi] of [[origin.x, d.x, c.x0, c.x1], [origin.z, d.z, c.z0, c.z1]]) {
        if (Math.abs(dd) < 1e-8) { if (o < lo || o > hi) { tmin = Infinity; break; } }
        else {
          let t1 = (lo - o) / dd, t2 = (hi - o) / dd;
          if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) { tmin = Infinity; break; }
        }
      }
      if (tmin === Infinity || tmin >= bestT) continue;
      const yAt = origin.y + d.y * tmin;
      if (yAt < 0 || yAt > 3) continue;
      bestT = tmin;
      bestMat = (c.id && String(c.id).includes('glass')) ? 'glass'
        : (c.id === 'crane') ? 'metal' : 'wall';
    }
    return bestT < Infinity ? { t: bestT, material: bestMat } : null;
  }
  function fire() {
    const w = WEAPONS[selected];
    if (cooldown > 0 || reloading > 0) return false;
    if (ammo[selected].mag <= 0) { startReload(); if (audio) audio.emptyClick(); return false; }
    cooldown = 1 / w.rate;
    lastPlayerShotAt = combatTime; // the Guard answers fire (see update())
    if (w.mag !== Infinity) ammo[selected].mag--;
    const { origin, dir } = muzzleWorld();
    showFlash(origin, dir);
    if (audio) audio.gunshot(w.name);
    const pellets = w.pellets || 1;
    let hitAny = false;
    // AUDIT m-24: getTargets() built a fresh array per pellet — hoisted.
    const targets = getTargets();
    const meshes = targets.map((t) => t.mesh);
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.y += (Math.random() - 0.5) * w.spread * 2;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
      ray.set(origin, d);
      ray.far = w.range;
      const hits = ray.intersectObjects(meshes, true);
      let end = origin.clone().addScaledVector(d, w.range);
      let hitPoint = null;
      let hitNormal = null;
      if (hits.length) {
        const h = hits[0];
        end = h.point.clone();
        hitPoint = h.point.clone();
        if (h.face && h.face.normal) {
          const nm = new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld);
          hitNormal = h.face.normal.clone().applyMatrix3(nm).normalize();
        }
        // Find which target owns the hit mesh.
        let owner = null;
        for (const t of targets) {
          let o = h.object;
          while (o) { if (o === t.mesh) { owner = t; break; } o = o.parent; }
          if (owner) break;
        }
        if (owner && owner.damage) {
          owner.damage(w.damage);
          hitAny = true;
          if (audio) audio.impact('body');
          if (owner.kind === 'police' && onCrime) onCrime(8);
          if (owner.kind === 'ped' && onCrime) onCrime(10);
        }
      } else {
        // Miss: wall first (ray vs colliders), else the road.
        const wh = rayColliderHit(origin, d, w.range);
        const gt = d.y < -0.02 ? (0.21 - origin.y) / d.y : Infinity;
        if (wh && wh.t < gt) {
          end = origin.clone().addScaledVector(d, wh.t);
          hitPoint = end.clone();
          if (audio) audio.impact(wh.material);
        } else if (gt > 0 && gt < w.range) {
          const gp = origin.clone().addScaledVector(d, gt);
          showDecal(gp, new THREE.Vector3(0, 1, 0));
          showSparks(gp, new THREE.Vector3(0, 1, 0));
          if (audio) audio.impact('wall');
        }
      }
      showTracer(origin, end, 'player');
      if (hitPoint) {
        showSparks(hitPoint, hitNormal || new THREE.Vector3(0, 1, 0));
        if (hitNormal) showDecal(hitPoint, hitNormal);
      }
    }
    if (onFire) onFire(w, ammo[selected]);
    if (ammo[selected].mag <= 0 && w.mag !== Infinity) startReload();
    return hitAny;
  }
  function startReload() {
    const w = WEAPONS[selected];
    if (w.mag === Infinity || reloading > 0) return;
    if (ammo[selected].reserve <= 0 || ammo[selected].mag === w.mag) return;
    reloading = 1.2;
    if (audio) audio.reload();
  }
  function finishReload() {
    const w = WEAPONS[selected];
    const need = w.mag - ammo[selected].mag;
    const take = Math.min(need, ammo[selected].reserve);
    ammo[selected].mag += take;
    ammo[selected].reserve -= take;
  }
  function select(i) {
    selected = Math.max(0, Math.min(WEAPONS.length - 1, i));
    reloading = 0;
    cooldown = 0;
    return selected;
  }
  // Cover: crouched behind a prop/wall within 2 m in front of the player.
  function inCover() {
    const p = getPlayer();
    if (!p.crouched) return false;
    const fx = Math.cos(p.angle), fz = -Math.sin(p.angle);
    for (const c of opts.colliders || []) {
      const cx = Math.max(c.x0, Math.min(p.x + fx * 1.2, c.x1));
      const cz = Math.max(c.z0, Math.min(p.z + fz * 1.2, c.z1));
      if (Math.hypot(cx - p.x, cz - p.z) < 2.0) return true;
    }
    return false;
  }
  // Police return fire: each unit shoots on its own timer while wanted.
  // Every shot draws an enemy tracer from the cruiser roof to the
  // player (with a miss offset when the shot misses), so return fire is
  // visible instead of silent health loss.
  function update(dt, wantedLevel, units) {
    combatTime += dt;
    cooldown = Math.max(0, cooldown - dt);
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) { reloading = 0; finishReload(); }
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        if (flash) flash.intensity = 0;
        if (flashMesh) flashMesh.visible = false;
      }
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / TRACER_LIFE) * 0.95;
      if (t.userData.life <= 0) {
        scene.remove(t);
        t.material.dispose();
        tracers.splice(i, 1);
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      const pos = b.points.geometry.attributes.position;
      for (let j = 0; j < b.vel.length; j++) {
        const v = b.vel[j];
        v.y -= 9 * dt;
        pos.setXYZ(j,
          pos.getX(j) + v.x * dt,
          Math.max(0.22, pos.getY(j) + v.y * dt),
          pos.getZ(j) + v.z * dt);
      }
      pos.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        bursts.splice(i, 1);
      }
    }
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i];
      d.life -= dt;
      if (d.life < 2) d.mesh.material.opacity = Math.max(0, d.life / 2) * 0.55;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        d.mesh.material.dispose();
        decals.splice(i, 1);
      }
    }
    if (wantedLevel <= 0) return;
    const p = getPlayer();
    const cover = inCover();
    // GAME fix (M9 22 Nov 06:55): lay low. The Guard return fire
    // killed a stationary player in ~15 s while the heat needs ~30 s
    // to decay from level 3, so M9 LAY LOW (wait at the fortress
    // plaza until wanted=0) was unwinnable by waiting — the player
    // was WASTED, not busted (m9-diag: hp 100->0 in 14 s, wasted).
    // While the player is on foot, still, and has not fired in 8 s,
    // the units HOLD their 3 m cordon but do not open fire — they
    // are containing a non-resisting player, not executing them.
    // The risk stays: a unit closing inside 2.5 m of a still player
    // busts them (wanted.js), and the moment the player shoots, runs
    // (speed >= 1) or gets in a car, return fire resumes.
    const layingLow = p.onFoot && (p.speed || 0) < 1 && (combatTime - lastPlayerShotAt) > 8;
    for (const u of units) {
      if (!u.car) continue;
      u.fireTimer -= dt;
      const dist = Math.hypot(u.car.x - p.x, u.car.z - p.z);
      if (u.fireTimer > 0 || dist > 45) continue;
      if (layingLow) continue;
      u.fireTimer = 1.6 + Math.random() * 1.4 - wantedLevel * 0.12;
      const acc = Math.max(0.04, 0.3 - dist * 0.005 - (cover ? 0.16 : 0) - Math.abs(p.speed || 0) * 0.012);
      const hits = Math.random() < acc;
      // Enemy tracer: cruiser roof to the player, offset on a miss.
      // Part N2: roof/chest heights at the Part-J scales (CAR_SCALE 0.33,
      // PED_SCALE 0.30). The old 1.5/1.2 were pre-Part-J heights — the
      // beams started 1.1u over the cruiser roof and ended 0.85u over
      // Elio's head. Roof is 0.40u, chest ~0.36u.
      const from = new THREE.Vector3(u.car.x, 0.50, u.car.z);
      const to = new THREE.Vector3(p.x, 0.36, p.z);
      if (!hits) {
        to.x += (Math.random() - 0.5) * 3;
        to.z += (Math.random() - 0.5) * 3;
      }
      showTracer(from, to, 'enemy');
      if (audio) audio.gunshot('TAMBURO', { quiet: true });
      if (hits && onDamage) {
        const dmg = (6 + wantedLevel * 2) * (cover ? 0.25 : 1);
        onDamage(Math.round(dmg), u);
      }
    }
  }
  return {
    WEAPONS,
    get selected() { return selected; },
    get ammo() { return ammo; },
    get reloading() { return reloading > 0; },
    get cover() { return inCover(); },
    fire, select, startReload, inCover, update,
  };
}
