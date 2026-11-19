// COSTA VERDE Slice 2 — police: wanted heat, patrol-car pursuit, helicopter,
// BUSTED / WASTED triggers. All tuning lives in CFG.wanted / CFG.police.
// The manager owns the patrol units and the heli; main.js owns the player,
// the HUD and the overlays — this module reports events back through hooks.

import * as THREE from 'three';
import { CFG } from './config.js';
import { buildPoliceCruiser, buildHeli, makeCarState, updateCar } from './vehicles.js';

const ROAD_LINES = [-185, -111, -37, 37, 111, 185];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// --- wanted heat ------------------------------------------------------------
// heat is a float; wanted stars track it with hysteresis (a star only drops
// once heat has fallen half a star below it). Crimes push heat up and reset
// the grace timer; while no cop can see the player and the grace has passed,
// heat bleeds off. 1 star of heat = 1 star on the HUD.
export function makeWanted() {
  return { heat: 0, wanted: 0, lastCrimeAt: -99, bustTimer: 0, seen: false };
}
export function addHeat(w, amount, now) {
  w.heat = clamp(w.heat + amount, 0, CFG.wanted.maxStars + 0.99);
  w.lastCrimeAt = now;
  w.wanted = Math.floor(w.heat);
}
// Heat bleeds off only once the cops have actually responded (at least one
// unit on the street) and no cop can see the player, after a short grace.
// Without the copsOnStreet guard, a fresh crime would decay away before the
// first patrol car even arrived — the player would never be chased. Once the
// wanted level itself is 0, leftover heat still bleeds to zero so nothing
// lingers unseen.
export function updateWanted(w, dt, now, nearestCopDist, copsOnStreet) {
  w.seen = nearestCopDist !== null && nearestCopDist < CFG.wanted.seenRadius;
  const shouldDecay = !w.seen && now - w.lastCrimeAt > CFG.wanted.graceSec && w.heat > 0
    && (copsOnStreet || w.wanted === 0);
  if (shouldDecay) {
    w.heat = Math.max(0, w.heat - CFG.wanted.decayPerSec * dt);
  }
  // Hysteresis: a star only drops once heat has fallen half a star below it,
  // so a tiny decay just under an integer boundary never kills a live chase.
  let stars = w.wanted;
  if (w.heat >= w.wanted + 1) stars = Math.floor(w.heat);
  else if (w.heat < w.wanted - 0.5) stars = Math.floor(w.heat);
  const changed = stars !== w.wanted;
  w.wanted = stars;
  return changed;
}

// --- police manager ----------------------------------------------------------
export function makePolice(scene, colliders) {
  const mgr = {
    units: [], // { group, wheels, lightL, lightR, car, callsign, hp, state, ramCd, shootCd, disabledUntil, stuckAt, lastX, lastZ, status }
    heli: null,
    nextCallsign: 1,
    spawnCd: 0,
    flashT: 0,
  };

  function spawnPointNear(px, pz) {
    // Pick the road line nearest the player, drop the unit on it spawnDist
    // away along the road. The spawn is never farther than ~53 m out (inside
    // the 60 m seen radius) and the unit has a clear run at the player —
    // a random far line used to leave it grinding on buildings instead.
    const vertical = Math.random() < 0.5;
    const nearestLine = (v) => ROAD_LINES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const along = (Math.random() < 0.5 ? -1 : 1) * CFG.police.spawnDist;
    let x, z;
    if (vertical) { x = nearestLine(px); z = clamp(pz + along, -200, 200); }
    else { z = nearestLine(pz); x = clamp(px + along, -200, 200); }
    return { x, z };
  }

  function spawnUnit(px, pz, now = 0) {
    const built = buildPoliceCruiser();
    const spec = {
      topSpeed: CFG.police.topSpeed, accel: CFG.police.accel,
      brake: CFG.police.brake, reverseSpeed: CFG.police.reverseSpeed,
      steer: CFG.police.steer, grip: CFG.police.grip,
    };
    const p = spawnPointNear(px, pz);
    const car = makeCarState(p.x, p.z, Math.atan2(px - p.x, pz - p.z), spec);
    built.group.position.set(p.x, 0, p.z);
    built.group.rotation.y = car.heading;
    scene.add(built.group);
    const unit = {
      ...built,
      car,
      callsign: `SPD-${mgr.nextCallsign++}`,
      hp: 100,
      state: 'pursue', // pursue | disabled | leaving
      ramCd: 0,
      shootCd: 0,
      disabledUntil: 0,
      // Progress baseline: distance at spawn + spawn time, so the first
      // no-progress check (1.5 s later) measures real movement, not the
      // spawn itself.
      lastDist: Math.hypot(px - p.x, pz - p.z), lastProgressAt: now,
      status: 'Pursuing',
    };
    mgr.units.push(unit);
    return unit;
  }

  function spawnHeli(px, pz) {
    const built = buildHeli();
    built.group.position.set(px + 30, CFG.heli.height, pz - 30);
    scene.add(built.group);
    mgr.heli = { ...built, active: true, leaving: false };
  }

  function removeUnit(u) {
    scene.remove(u.group);
    const i = mgr.units.indexOf(u);
    if (i >= 0) mgr.units.splice(i, 1);
  }

  // hooks: { ram(dmg, fromX, fromZ), shot(dmg), busted(), disabled(callsign) }
  // player: { x, z, speed, driving, carX, carZ, carSpeed, carHeading }
  function update(dt, now, player, wanted, hooks) {
    mgr.flashT += dt;
    const flash = Math.floor(mgr.flashT * 4) % 2 === 0;

    // --- desired force -------------------------------------------------------
    // Spawn near the player's car while driving — the on-foot position goes
    // stale the moment Leo gets in, and units must answer the car, not it.
    const fx0 = player.driving ? player.carX : player.x;
    const fz0 = player.driving ? player.carZ : player.z;
    const wantCount = Math.min(wanted.wanted, CFG.wanted.maxPolice);
    mgr.spawnCd -= dt;
    if (mgr.units.filter((u) => u.state !== 'leaving').length < wantCount && mgr.spawnCd <= 0) {
      spawnUnit(fx0, fz0, now);
      mgr.spawnCd = 1.5;
    }
    // Helicopter joins at 3 stars.
    if (wanted.wanted >= CFG.wanted.heliAtStars && !mgr.heli) spawnHeli(fx0, fz0);
    if (mgr.heli && wanted.wanted < CFG.wanted.heliAtStars) mgr.heli.leaving = true;

    // --- helicopter ----------------------------------------------------------
    if (mgr.heli) {
      const h = mgr.heli;
      h.rotor.rotation.y += dt * 22;
      h.tailRotor.rotation.x += dt * 30;
      // Hold station ahead of the car (spotlighting the road ahead, visible
      // in the chase camera's frame) or just off the player on foot.
      let tx, tz;
      if (player.driving) {
        tx = player.carX + Math.sin(player.carHeading) * 35;
        tz = player.carZ + Math.cos(player.carHeading) * 35;
      } else {
        tx = player.x - 10; tz = player.z - 10;
      }
      if (h.leaving) {
        h.group.position.y += dt * 12;
        h.group.position.x += (player.x + 220 - h.group.position.x) * 0.2 * dt;
        h.group.position.z += (player.z - 220 - h.group.position.z) * 0.2 * dt;
        if (h.group.position.y > 120) { scene.remove(h.group); mgr.heli = null; }
      } else {
        h.group.position.x += (tx - h.group.position.x) * Math.min(1, (CFG.heli.speed / 60) * dt * 3);
        h.group.position.z += (tz - h.group.position.z) * Math.min(1, (CFG.heli.speed / 60) * dt * 3);
        h.group.position.y += (CFG.heli.height - h.group.position.y) * Math.min(1, 2 * dt);
        h.cone.material.opacity = 0.08 + Math.sin(now * 6) * 0.03;
      }
    }

    // --- patrol units --------------------------------------------------------
    let nearest = null;
    for (const u of [...mgr.units]) {
      // Light bar flashes red/blue in turn.
      u.lightL.material.emissiveIntensity = flash ? 2.4 : 0.25;
      u.lightR.material.emissiveIntensity = flash ? 0.25 : 2.4;
      u.ramCd -= dt;
      u.shootCd -= dt;

      // Distances are measured to the player's car while driving (the
      // on-foot position goes stale the moment Leo gets in).
      const fx = player.driving ? player.carX : player.x;
      const fz = player.driving ? player.carZ : player.z;
      const dx = fx - u.car.x, dz = fz - u.car.z;
      const dist = Math.hypot(dx, dz);
      if (nearest === null || dist < nearest) nearest = dist;

      if (u.state === 'disabled') {
        u.status = 'Disabled';
        if (now >= u.disabledUntil) { u.state = 'pursue'; u.hp = 100; }
        u.group.position.set(u.car.x, 0, u.car.z);
        continue;
      }
      if (u.state === 'leaving') {
        // Drive away from the player, despawn far out.
        const away = Math.atan2(u.car.x - fx, u.car.z - fz);
        const input = { throttle: 1, steer: clamp(angleDiff(u.car.heading, away) * 1.5, -1, 1), handbrake: false };
        updateCar(u.car, input, dt, colliders);
        u.group.position.set(u.car.x, 0, u.car.z);
        u.group.rotation.y = u.car.heading;
        if (dist > CFG.police.despawnDist) removeUnit(u);
        continue;
      }

      // Pursuit: steer at the player, speed scales with the heat.
      const targetSpeed = Math.min(48, CFG.police.topSpeed + wanted.wanted * CFG.police.topSpeedPerStar);
      u.car.spec.topSpeed = targetSpeed;
      let input;
      if (!player.driving && dist < 8) {
        // On foot, close in: stop beside the player (sets up a BUSTED).
        input = { throttle: 0, steer: 0, handbrake: true };
        u.status = 'On foot — closing in';
      } else {
        const wantHeading = Math.atan2(dx, dz);
        // Slow down as the gap closes so the cruiser can actually turn onto
        // the player instead of orbiting it at full speed (turning circle
        // at 40 m/s is ~20 m — it could never touch a still target).
        const desired = clamp(dist * 0.9, 8, targetSpeed);
        const throttle = clamp((desired - u.car.speed) / 6, -1, 1);
        input = { throttle, steer: clamp(angleDiff(u.car.heading, wantHeading) * 2, -1, 1), handbrake: false };
        u.status = dist < 20 ? 'Ramming' : 'Pursuing';
      }
      updateCar(u.car, input, dt, colliders);
      u.group.position.set(u.car.x, 0, u.car.z);
      u.group.rotation.y = u.car.heading;
      for (const w of u.wheels) w.rotation.x += (u.car.speed * dt) / 0.36;

      // No progress toward the player (grinding on a building wall)? The
      // dispatcher drops the unit on a fresh road line for a new angle.
      // A free cruiser closes tens of metres a second, so 1.5 s with
      // under 1.5 m of progress is a certain stall. Only inside 100 m,
      // though: farther out the unit is still in transit, and teleporting
      // it next to the player would cheat an escape the player has earned.
      if (dist > 15 && dist < 100) {
        if (now - u.lastProgressAt > 1.5) {
          if (u.lastDist - dist < 1.5) {
            const p = spawnPointNear(fx, fz);
            u.car.x = p.x; u.car.z = p.z;
            u.car.heading = Math.atan2(fx - p.x, fz - p.z);
            u.car.speed = 0;
          }
          u.lastDist = dist; u.lastProgressAt = now;
        }
      } else {
        u.lastDist = dist; u.lastProgressAt = now;
      }

      // Ram: contact with the player's car or body hurts.
      if (dist < 3.4 && u.ramCd <= 0) {
        u.ramCd = CFG.police.ramCooldown;
        hooks.ram(CFG.police.ramDamage, u.car.x, u.car.z);
      }
      // Shoot: on foot, in range, 2+ stars — inaccurate, forgiving.
      if (!player.driving && wanted.wanted >= 2 && dist < CFG.police.shootRange && u.shootCd <= 0) {
        u.shootCd = CFG.police.shootInterval;
        hooks.shot(u.car.x, u.car.z);
      }
    }

    // All heat gone: units leave, heli flies off.
    if (wanted.wanted === 0) {
      for (const u of mgr.units) if (u.state === 'pursue') { u.state = 'leaving'; u.status = 'Lost you'; }
    }
    return nearest;
  }

  function damageUnit(u, dmg, now) {
    u.hp -= dmg;
    if (u.hp <= 0 && u.state === 'pursue') {
      u.state = 'disabled';
      u.disabledUntil = now + CFG.wanted.disabledSec;
      u.status = 'Disabled';
      return true;
    }
    return false;
  }

  function clearAll() {
    for (const u of [...mgr.units]) removeUnit(u);
    if (mgr.heli) { scene.remove(mgr.heli.group); mgr.heli = null; }
  }

  return { units: mgr.units, get heli() { return mgr.heli; }, update, damageUnit, clearAll, spawnUnit };
}
