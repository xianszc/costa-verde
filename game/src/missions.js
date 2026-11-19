// COSTA VERDE Slice 3 — story missions: a real arc for Leo Marín + fixer
// Ana Ruiz, with a payoff for the tagline's hook ("find out what Ana
// really wants from Leo"). Missions are data (MISSIONS in config.js) — the
// manager reads them, nothing about a mission's flow is hard-coded into
// the render loop. Missions start at Ana (the mission giver): finish one,
// return to her for the next. Each mission has briefing dialogue, objective
// marker + waypoint, success AND failure states, and a cash reward.
// The manager owns armed enemies (shootout stages) and the escort job
// (M4: a contact's car + hunter cars). main.js owns the player, HUD,
// police and save — this module reports through the world hooks.

import * as THREE from 'three';
import { CFG, MISSIONS, ENEMIES, ESCORT, SLICE1 } from './config.js';
import { buildHumanoid, animateWalk } from './characters.js';
import { buildCar, makeCarState, updateCar, resolveCircle } from './vehicles.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Cheap line of sight: sample points along the segment; blocked if any
// lands inside a building collider. (Tracers through walls read as a bug,
// so enemies only shoot when they can actually see Leo.)
function hasLineOfSight(x1, z1, x2, z2, colliders) {
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
    for (const c of colliders) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return false;
    }
  }
  return true;
}

// w (world) interface — everything the manager needs from main.js:
//   scene, colliders
//   player {x,z}, driving (bool), drivingCar (entry|null), gameTime
//   toast(text, secs), showDialogue(lines, onDone), showFailed(reason)
//   moveBeacon(x,z), hideBeacon(), addHeat(n), clearHeat()
//   damagePlayer(n), sting(kind), drawTracer(from, to)
//   spawnDamageNumber(point, text), addCash(n), addRep(n), save()
//   teleportPlayer(x,z), onStoryComplete(stats)
export function createMissionSystem(w) {
  const sys = {
    missionIdx: 0, // 0 = First Light (Slice 1 flow in main.js); 1..4 = story
    status: 'none', // none | available | active | failed | complete
    stageIdx: 0,
    timerLeft: 0,
    enemies: [], // { h, x, z, hp, shootCd, state, downUntil, phase }
    escort: null, // { group, wheels, car, hp, wps, wpIdx, farTimer }
    foes: [], // { group, wheels, car, hp, ramCd, hitCd, state }
    storyComplete: false,
    missionCash: 0,
    failReason: '',
  };

  function mission() { return MISSIONS[sys.missionIdx]; }
  function step() { return mission().steps[sys.stageIdx]; }

  function spawnEnemies(center) {
    clearEnemies();
    const offsets = [[0, 0], [9, 7], [-7, 9], [5, -9], [-9, -6]];
    for (let i = 0; i < ENEMIES.count; i++) {
      const [ox, oz] = offsets[i % offsets.length];
      const h = buildHumanoid({
        shirt: 0x1a1a1e, pants: 0x1a1a1e, skin: [0xe8b88a, 0xc98d64, 0x8a5a3a][i % 3],
        hair: 0x111111, scale: 0.95 + (i % 3) * 0.05,
      });
      const x = center.x + ox, z = center.z + oz;
      h.group.position.set(x, 0, z);
      // Red marker diamond above the head — guards read as targets.
      const mark = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35),
        new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
      );
      mark.position.y = 2.4;
      h.group.add(mark);
      w.scene.add(h.group);
      sys.enemies.push({ h, mark, x, z, hp: ENEMIES.hp, shootCd: 1 + i * 0.4, state: 'alive', downUntil: 0, phase: i * 1.7, strafeDir: 1, strafing: false, cycleT: 0.5 + i * 0.3 });
    }
  }
  function clearEnemies() {
    for (const e of sys.enemies) w.scene.remove(e.h.group);
    sys.enemies = [];
  }

  function spawnEscort() {
    clearEscort();
    const built = buildCar(ESCORT.color);
    const car = makeCarState(ESCORT.start.x, ESCORT.start.z, 0, {
      topSpeed: ESCORT.speed, accel: 14, brake: 30, reverseSpeed: 8, steer: 1.8, grip: 8,
    });
    built.group.position.set(car.x, 0, car.z);
    w.scene.add(built.group);
    sys.escort = {
      ...built, car, hp: ESCORT.hp,
      wps: ESCORT.waypoints, wpIdx: 0, farTimer: 0,
    };
    // Hunters: red wedges that chase the contact's car and ram it.
    for (let i = 0; i < ESCORT.foes; i++) {
      const f = buildCar(0xd84a4a);
      const fx = ESCORT.start.x + (i === 0 ? -14 : 14), fz = ESCORT.start.z + 20;
      const fcar = makeCarState(fx, fz, Math.PI, {
        topSpeed: ESCORT.foeSpeed, accel: 26, brake: 40, reverseSpeed: 10, steer: 2.0, grip: 9,
      });
      f.group.position.set(fx, 0, fz);
      w.scene.add(f.group);
      sys.foes.push({ ...f, car: fcar, hp: ESCORT.foeHp, ramCd: 0, hitCd: 0, state: 'active' });
    }
  }
  function clearEscort() {
    if (sys.escort) w.scene.remove(sys.escort.group);
    sys.escort = null;
    for (const f of sys.foes) w.scene.remove(f.group);
    sys.foes = [];
  }

  function enterStage() {
    const s = step();
    if (!s) return;
    if (s.clear) spawnEnemies(s.center);
    if (s.escort) spawnEscort();
    if (s.heat) w.addHeat(s.heat);
  }

  function advanceStage() {
    sys.stageIdx++;
    if (sys.stageIdx >= mission().steps.length) { completeMission(); return; }
    enterStage();
  }

  function completeMission() {
    const m = mission();
    w.addCash(m.reward);
    w.addRep(15);
    sys.missionCash += m.reward;
    w.sting('cash');
    w.fade();
    clearEnemies();
    clearEscort();
    w.save();
    if (sys.missionIdx >= MISSIONS.length - 1) {
      sys.status = 'complete';
      sys.storyComplete = true;
      w.hideBeacon();
      w.onStoryComplete({
        cash: sys.missionCash, rep: w.rep || 0,
        missions: MISSIONS.length,
      });
      return;
    }
    sys.missionIdx++;
    sys.status = 'available';
    sys.stageIdx = 0;
    w.toast(`Mission complete — +$${m.reward}. Ana has more work. Meet her at the Marina.`, 6);
  }

  function fail(reason) {
    if (sys.status !== 'active') return;
    sys.failReason = reason;
    sys.status = 'failed';
    w.fade();
    clearEnemies();
    clearEscort();
    w.hideBeacon();
    w.showFailed(reason);
  }

  // --- public API -----------------------------------------------------------
  function makeAvailable(idx) {
    sys.missionIdx = idx;
    sys.status = 'available';
    sys.stageIdx = 0;
    sys.timerLeft = 0;
  }

  function startMission(idx) {
    sys.missionIdx = idx;
    sys.stageIdx = 0;
    sys.timerLeft = mission().timeLimit || 0;
    const lines = mission().briefing || [];
    const activate = () => {
      sys.status = 'active';
      enterStage();
    };
    if (lines.length > 0) w.showDialogue(lines, activate);
    else activate();
  }

  function retry() {
    w.clearHeat();
    w.teleportPlayer(SLICE1.anaSpawn.x, SLICE1.anaSpawn.z);
    startMission(sys.missionIdx);
  }

  // BUSTED / WASTED while a mission is active fails it (the job is blown).
  function onPlayerDown() {
    if (sys.status === 'active') fail('You went down — the job is blown.');
  }

  function reset() {
    clearEnemies();
    clearEscort();
    sys.missionIdx = 0;
    sys.status = 'none';
    sys.stageIdx = 0;
    sys.timerLeft = 0;
    sys.storyComplete = false;
    sys.missionCash = 0;
  }

  // Restore from a save: the next mission waits at Ana (no auto-start).
  function restore(idx, complete) {
    reset();
    if (complete) {
      sys.missionIdx = MISSIONS.length - 1;
      sys.status = 'complete';
      sys.storyComplete = true;
    } else if (idx > 0) {
      makeAvailable(idx);
    }
  }

  // Debug / screenshot helper: jump straight into a mission stage.
  function debugStage(idx, stageIdx) {
    clearEnemies();
    clearEscort();
    sys.missionIdx = idx;
    sys.stageIdx = stageIdx;
    sys.status = 'active';
    sys.timerLeft = mission().timeLimit || 0;
    enterStage();
    const lines = mission().briefing || [];
    if (lines.length > 0) w.showDialogue(lines, () => {});
  }

  // --- per-frame --------------------------------------------------------------
  function update(dt, now) {
    if (sys.status !== 'active') return;
    const m = mission();
    const s = step();
    if (!s) return;

    // Timed missions (M2): the clock runs out and the job fails.
    if (m.timeLimit) {
      sys.timerLeft -= dt;
      if (sys.timerLeft <= 0) { fail('Out of time — the drop went cold.'); return; }
    }

    // Target steps: player (or their car) enters the radius.
    if (s.target) {
      const fx = w.driving && w.drivingCar ? w.drivingCar.car.x : w.player.x;
      const fz = w.driving && w.drivingCar ? w.drivingCar.car.z : w.player.z;
      if (Math.hypot(fx - s.target.x, fz - s.target.z) < s.radius) {
        if (s.id === 'grab') w.toast('Package secured.', 4);
        advanceStage();
        return;
      }
    }

    // Clear steps: every guard down.
    if (s.clear) {
      updateEnemies(dt, now);
      if (sys.enemies.length > 0 && sys.enemies.every((e) => e.state === 'down')) {
        advanceStage();
        return;
      }
    }

    // Escort steps: drive the contact home, keep the hunters off him.
    if (s.escort) updateEscort(dt, now);
  }

  function updateEnemies(dt, now) {
    const px = w.player.x, pz = w.player.z;
    for (const e of [...sys.enemies]) {
      if (e.state === 'down') {
        if (now >= e.downUntil) {
          w.scene.remove(e.h.group);
          sys.enemies.splice(sys.enemies.indexOf(e), 1);
        }
        continue;
      }
      const dx = px - e.x, dz = pz - e.z;
      const dist = Math.hypot(dx, dz);
      // Walk toward Leo when far; hold and shoot when close.
      if (dist > 24) {
        const heading = Math.atan2(dx, dz);
        const pos = { x: e.x, z: e.z };
        pos.x += Math.sin(heading) * 2.2 * dt;
        pos.z += Math.cos(heading) * 2.2 * dt;
        resolveCircle(pos, 0.5, w.colliders);
        e.x = pos.x; e.z = pos.z;
        e.phase += dt * 4;
        e.h.group.position.set(e.x, 0, e.z);
        e.h.group.rotation.y = heading;
        animateWalk(e.h, e.phase, 0.8);
      } else {
        // Slice 4: guards reposition between shots instead of standing
        // still — they strafe sideways for a second, then hold still to
        // shoot. The hold phase is the player's window to hit them:
        // constant strafing at 5 m was unhittable (the M5 playtest
        // proved it — the heist could not be finished).
        e.cycleT -= dt;
        if (e.cycleT <= 0) {
          e.strafing = !e.strafing;
          e.cycleT = e.strafing ? 1.0 : 1.4;
          if (e.strafing) e.strafeDir *= -1;
        }
        const heading = Math.atan2(dx, dz);
        if (e.strafing) {
          const perp = heading + Math.PI / 2;
          const pos = { x: e.x, z: e.z };
          pos.x += Math.sin(perp) * e.strafeDir * 1.1 * dt;
          pos.z += Math.cos(perp) * e.strafeDir * 1.1 * dt;
          resolveCircle(pos, 0.5, w.colliders);
          e.x = pos.x; e.z = pos.z;
          e.h.group.position.set(e.x, 0, e.z);
          e.phase += dt * 3;
          animateWalk(e.h, e.phase, 0.6);
        } else {
          animateWalk(e.h, e.phase, 0);
        }
        e.h.group.rotation.y = heading;
      }
      e.mark.rotation.y += dt * 2;
      // Shoot: only on foot, in range, with line of sight — and only
      // while holding still (the strafe phase is the guard moving, not
      // shooting). Guards hold fire while Leo is in a car (they take cover, not potshots).
      if (!w.driving && dist < ENEMIES.shootRange && !e.strafing) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = ENEMIES.shootInterval;
          if (hasLineOfSight(e.x, e.z, px, pz, w.colliders)) {
            w.drawTracer({ x: e.x, y: 1.4, z: e.z }, { x: px, y: 1.2, z: pz });
            if (Math.random() < ENEMIES.hitChance) w.damagePlayer(ENEMIES.damage);
          }
        }
      }
    }
  }

  function updateEscort(dt, now) {
    const esc = sys.escort;
    if (!esc) return;
    // Drive the route.
    const wp = esc.wps[esc.wpIdx];
    const dx = wp.x - esc.car.x, dz = wp.z - esc.car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 6) {
      esc.wpIdx++;
      if (esc.wpIdx >= esc.wps.length) { advanceStage(); return; }
    } else {
      const wantHeading = Math.atan2(dx, dz);
      const desired = clamp(dist * 0.9, 6, ESCORT.speed);
      const throttle = clamp((desired - esc.car.speed) / 6, -1, 1);
      updateCar(esc.car, {
        throttle, steer: clamp(angleDiff(esc.car.heading, wantHeading) * 2, -1, 1), handbrake: false,
      }, dt, w.colliders);
      esc.group.position.set(esc.car.x, 0, esc.car.z);
      esc.group.rotation.y = esc.car.heading;
      for (const wh of esc.wheels) wh.rotation.x += (esc.car.speed * dt) / 0.36;
    }
    // Stay close or the job fails.
    const fx = w.driving && w.drivingCar ? w.drivingCar.car.x : w.player.x;
    const fz = w.driving && w.drivingCar ? w.drivingCar.car.z : w.player.z;
    const far = Math.hypot(fx - esc.car.x, fz - esc.car.z);
    if (far > ESCORT.maxDist) {
      esc.farTimer += dt;
      if (esc.farTimer > 3 && esc.farTimer - dt <= 3) w.toast('TOO FAR — get back to the contact!', 4);
      // Slice 4: a second, louder warning before the job actually fails.
      if (esc.farTimer > 7 && esc.farTimer - dt <= 7) w.toast('The contact is slipping away — get back NOW!', 4);
      if (esc.farTimer > ESCORT.farTime) { fail('You lost the contact.'); return; }
    } else esc.farTimer = 0;
    if (esc.hp <= 0) { fail("The contact's car was destroyed."); return; }

    // Hunters chase the contact's car and ram it.
    for (const f of sys.foes) {
      f.ramCd -= dt;
      f.hitCd -= dt;
      if (f.state === 'disabled') continue;
      const fdx = esc.car.x - f.car.x, fdz = esc.car.z - f.car.z;
      const fdist = Math.hypot(fdx, fdz);
      const wantHeading = Math.atan2(fdx, fdz);
      const desired = clamp(fdist * 0.9, 8, ESCORT.foeSpeed);
      const throttle = clamp((desired - f.car.speed) / 6, -1, 1);
      updateCar(f.car, {
        throttle, steer: clamp(angleDiff(f.car.heading, wantHeading) * 2, -1, 1), handbrake: false,
      }, dt, w.colliders);
      f.group.position.set(f.car.x, 0, f.car.z);
      f.group.rotation.y = f.car.heading;
      for (const wh of f.wheels) wh.rotation.x += (f.car.speed * dt) / 0.36;
      if (fdist < 3.5 && f.ramCd <= 0) {
        f.ramCd = 1.2;
        esc.hp -= ESCORT.foeRamDamage;
        f.car.speed *= 0.4;
        w.toast("The hunters are ramming the contact's car!", 3);
      }
    }
  }

  // --- combat hooks (called from main.js) ------------------------------------
  function onEnemyHit(enemy, dmg, now) {
    enemy.hp -= dmg;
    if (enemy.hp <= 0 && enemy.state === 'alive') {
      enemy.state = 'down';
      enemy.downUntil = now + 4;
      enemy.h.group.rotation.x = -Math.PI / 2;
      return true;
    }
    return false;
  }
  function onFoeHit(foe, dmg) {
    if (foe.state !== 'active') return false;
    foe.hp -= dmg;
    if (foe.hp <= 0) {
      foe.state = 'disabled';
      foe.car.speed = 0;
      return true;
    }
    return false;
  }
  // Ramming a hunter at speed hurts it (and knocks it off the contact).
  function onPlayerRamFoe(foe, now) {
    if (foe.state !== 'active' || foe.hitCd > 0) return false;
    foe.hitCd = 1.5;
    foe.car.speed *= 0.3;
    return onFoeHit(foe, ESCORT.playerRamDamage);
  }

  // Targets for the pistol ray (enemies + hunter cars).
  function getShootTargets() {
    const out = [];
    for (const e of sys.enemies) {
      if (e.state !== 'alive') continue;
      out.push({ x: e.x, y: 1.1, z: e.z, r: 0.9, kind: 'enemy', ref: e });
    }
    for (const f of sys.foes) {
      if (f.state !== 'active') continue;
      out.push({ x: f.car.x, y: 1.0, z: f.car.z, r: 2.4, kind: 'foeCar', ref: f });
    }
    return out;
  }

  // --- HUD / minimap data ------------------------------------------------------
  function currentObjective() {
    if (sys.missionIdx === 0 && sys.status === 'none') return null; // M1: main.js HUD
    if (sys.status === 'available') {
      const m = mission();
      return {
        num: sys.missionIdx + 1, total: MISSIONS.length, title: m.title,
        text: 'Talk to Ana at the Marina — new job',
        progress: 0, next: 'Press E near Ana to start.',
        timer: 0, escortHp: -1,
      };
    }
    if (sys.status === 'complete') {
      return {
        num: MISSIONS.length, total: MISSIONS.length, title: 'STORY COMPLETE',
        text: 'The ledger is ours. Costa Verde is yours, Leo.',
        progress: 1, next: 'Free roam — side jobs still pay.',
        timer: 0, escortHp: -1,
      };
    }
    const m = mission();
    const s = step() || m.steps[m.steps.length - 1];
    let frac = 0;
    if (s.clear && sys.enemies.length > 0) {
      frac = sys.enemies.filter((e) => e.state === 'down').length / sys.enemies.length;
    } else if (s.escort && sys.escort) {
      frac = sys.escort.wpIdx / sys.escort.wps.length;
    }
    return {
      num: sys.missionIdx + 1, total: MISSIONS.length, title: m.title,
      text: s.text,
      progress: clamp((sys.stageIdx + frac) / m.steps.length, 0, 1),
      next: m.next || '',
      timer: sys.timerLeft,
      escortHp: sys.escort ? sys.escort.hp : -1,
    };
  }

  function beaconTarget() {
    if (sys.status === 'available') return { x: SLICE1.anaSpawn.x, z: SLICE1.anaSpawn.z };
    if (sys.status !== 'active') return null;
    const s = step();
    if (!s) return null;
    if (s.target) return s.target;
    if (s.clear) return s.center;
    if (s.escort) return sys.escort ? { x: sys.escort.car.x, z: sys.escort.car.z } : ESCORT.start;
    return null;
  }

  function minimapDots() {
    const dots = [];
    for (const e of sys.enemies) {
      if (e.state === 'alive') dots.push({ x: e.x, z: e.z, color: '#ff3b30', r: 4 });
    }
    if (sys.escort) dots.push({ x: sys.escort.car.x, z: sys.escort.car.z, color: '#2e7f8f', r: 5 });
    for (const f of sys.foes) {
      if (f.state === 'active') dots.push({ x: f.car.x, z: f.car.z, color: '#ff9a3d', r: 4 });
    }
    return dots;
  }

  return {
    get missionIdx() { return sys.missionIdx; },
    get status() { return sys.status; },
    get stageIdx() { return sys.stageIdx; },
    get timerLeft() { return sys.timerLeft; },
    get enemies() { return sys.enemies; },
    get escort() { return sys.escort; },
    get foes() { return sys.foes; },
    get storyComplete() { return sys.storyComplete; },
    get failReason() { return sys.failReason; },
    makeAvailable, startMission, retry, onPlayerDown, reset, restore, debugStage,
    update, currentObjective, beaconTarget, minimapDots, getShootTargets,
    onEnemyHit, onFoeHit, onPlayerRamFoe,
  };
}
