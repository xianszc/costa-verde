// COSTA VERDE Slice 3 — side jobs: taxi fares, courier deliveries, hidden
// "verde" caches. All repeatable, all pay cash + rep. Independent of the
// story missions — they run alongside them and keep paying after the story
// ends. Markers: an amber beacon for the active side-job target, small
// floating diamonds over waiting fares and delivery crates.
// w (world) interface — from main.js:
//   scene, player {x,z}, driving (bool), drivingCar (entry|null), gameTime
//   toast(text, secs), sting(kind), addCash(n), addRep(n), save()
//   moveSideBeacon(x,z), hideSideBeacon(), showPrompt(text)/hidePrompt()
//   randomPed() — buildHumanoid via characters.js (imported here instead)

import * as THREE from 'three';
import { SIDE } from './config.js';
import { randomPed, animateWalk } from './characters.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function markerDiamond(color, size = 0.5) {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(size),
    new THREE.MeshBasicMaterial({ color }),
  );
  m.position.y = 2.6;
  return m;
}

export function createSideJobs(w) {
  const rnd = mulberry32(31337);

  // --- caches: 10 hidden spots, glowing green boxes -------------------------
  const caches = SIDE.cache.spots.map((s, i) => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x70e000, emissive: 0x2a5a00, emissiveIntensity: 0.9 }),
    );
    box.position.y = 0.7;
    box.castShadow = true;
    const glow = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshBasicMaterial({ color: 0xbfff6a }),
    );
    glow.position.y = 1.8;
    group.add(box, glow);
    group.position.set(s.x, 0, s.z);
    w.scene.add(group);
    return { id: i, x: s.x, z: s.z, group, glow, taken: false };
  });
  let cachesFound = 0;

  // --- taxi fares ------------------------------------------------------------
  const fare = {
    state: 'idle', // idle | waiting | riding
    ped: null, marker: null,
    pickup: null, dest: null, timer: 0, pay: 0,
    cooldownUntil: 0,
  };
  function clearFarePed() {
    if (fare.ped) { w.scene.remove(fare.ped.group); fare.ped = null; }
    if (fare.marker) { w.scene.remove(fare.marker); fare.marker = null; }
  }
  function spawnFare() {
    clearFarePed();
    const spots = SIDE.fare.pickups;
    const pickup = spots[Math.floor(rnd() * spots.length)];
    let dest = spots[Math.floor(rnd() * spots.length)];
    while (dest === pickup) dest = spots[Math.floor(rnd() * spots.length)];
    const ped = randomPed(rnd);
    ped.group.position.set(pickup.x, 0, pickup.z);
    w.scene.add(ped.group);
    const marker = markerDiamond(0xf2c14e, 0.45);
    marker.position.set(pickup.x, 2.6, pickup.z);
    w.scene.add(marker);
    fare.ped = ped;
    fare.marker = marker;
    fare.pickup = pickup;
    fare.dest = dest;
    fare.state = 'waiting';
    w.toast('A fare is waiting — drive up and press E to pick them up.', 5);
  }

  // --- courier deliveries ------------------------------------------------------
  // Two pickup crates on the map; grab one on foot or in a car, deliver it.
  const crates = SIDE.delivery.pickups.map((s, i) => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xc98a4b, emissive: 0x5a3410, emissiveIntensity: 0.6 }),
    );
    box.position.y = 0.55;
    box.castShadow = true;
    const glow = markerDiamond(0xffd23f, 0.4);
    glow.position.y = 2.0;
    group.add(box, glow);
    group.position.set(s.x, 0, s.z);
    w.scene.add(group);
    return { id: i, x: s.x, z: s.z, group, glow };
  });
  const delivery = {
    state: 'idle', // idle | carrying
    crate: null, dest: null, timer: 0, cooldownUntil: 0,
  };

  // --- per-frame ----------------------------------------------------------------
  function update(dt, now) {
    // Caches: walk or drive into one and it is yours.
    const fx = w.driving && w.drivingCar ? w.drivingCar.car.x : w.player.x;
    const fz = w.driving && w.drivingCar ? w.drivingCar.car.z : w.player.z;
    for (const c of caches) {
      if (c.taken) continue;
      c.glow.rotation.y += dt * 2;
      c.glow.position.y = 1.8 + Math.sin(now * 2 + c.id) * 0.15;
      if (Math.hypot(fx - c.x, fz - c.z) < 3.5) {
        c.taken = true;
        cachesFound++;
        c.group.visible = false;
        w.addCash(SIDE.cache.pay);
        w.addRep(2);
        w.sting('cash');
        w.toast(`Verde cache ${cachesFound}/10 — +$${SIDE.cache.pay}.`, 4);
        w.save();
      }
    }

    // Fares: one appears once the player has been driving a while.
    // (Not while a screenshot recipe is staging a shot.)
    if (fare.state === 'idle' && w.driving && !w.staging && now >= fare.cooldownUntil) {
      spawnFare();
    }
    if (fare.state === 'waiting' && fare.marker) {
      fare.marker.rotation.y += dt * 2;
      fare.marker.position.y = 2.6 + Math.sin(now * 3) * 0.2;
      if (fare.ped) animateWalk(fare.ped, now * 2, 0);
    }
    if (fare.state === 'riding') {
      fare.timer -= dt;
      if (fare.timer <= 0) {
        fare.state = 'idle';
        fare.cooldownUntil = now + SIDE.fare.cooldownSec;
        w.hideSideBeacon();
        w.toast('Too slow — the fare walked off.', 4);
      } else if (Math.hypot(fx - fare.dest.x, fz - fare.dest.z) < 8) {
        const pay = fare.pay;
        fare.state = 'idle';
        fare.cooldownUntil = now + SIDE.fare.cooldownSec;
        w.hideSideBeacon();
        w.addCash(pay);
        w.addRep(5);
        w.sting('cash');
        w.toast(`Fare delivered — +$${pay}.`, 4);
        w.save();
      }
    }

    // Deliveries: crate glow spins; carrying counts down to the drop.
    for (const c of crates) c.glow.rotation.y += dt * 2;
    if (delivery.state === 'carrying') {
      delivery.timer -= dt;
      if (delivery.timer <= 0) {
        delivery.state = 'idle';
        delivery.cooldownUntil = now + SIDE.delivery.cooldownSec;
        w.hideSideBeacon();
        w.toast('Delivery late — the client cancelled.', 4);
      } else if (Math.hypot(fx - delivery.dest.x, fz - delivery.dest.z) < 8) {
        delivery.state = 'idle';
        delivery.cooldownUntil = now + SIDE.delivery.cooldownSec;
        w.hideSideBeacon();
        w.addCash(SIDE.delivery.pay);
        w.addRep(5);
        w.sting('cash');
        w.toast(`Delivery complete — +$${SIDE.delivery.pay}.`, 4);
        w.save();
      }
    }
  }

  // --- interaction (E key, called from main.js before enter/exit) --------------
  // Returns true when an interaction happened (so E is consumed).
  function tryInteract() {
    const fx = w.driving && w.drivingCar ? w.drivingCar.car.x : w.player.x;
    const fz = w.driving && w.drivingCar ? w.drivingCar.car.z : w.player.z;
    // Pick up a waiting fare (only while driving).
    if (fare.state === 'waiting' && w.driving && fare.pickup) {
      if (Math.hypot(fx - fare.pickup.x, fz - fare.pickup.z) < 8) {
        fare.state = 'riding';
        fare.timer = SIDE.fare.timeLimit;
        const dist = Math.hypot(fare.dest.x - fare.pickup.x, fare.dest.z - fare.pickup.z);
        fare.pay = Math.min(SIDE.fare.maxPay, SIDE.fare.basePay + Math.round(dist * SIDE.fare.perMetre));
        clearFarePed();
        w.moveSideBeacon(fare.dest.x, fare.dest.z);
        w.toast(`Fare on board — drop them off. Worth $${fare.pay}.`, 4);
        return true;
      }
    }
    // Grab a delivery crate (on foot or in a car).
    if (delivery.state === 'idle' && w.gameTime >= delivery.cooldownUntil) {
      for (const c of crates) {
        if (Math.hypot(fx - c.x, fz - c.z) < 4.5) {
          delivery.state = 'carrying';
          delivery.crate = c;
          const dests = SIDE.delivery.dests;
          delivery.dest = dests[Math.floor(rnd() * dests.length)];
          delivery.timer = SIDE.delivery.timeLimit;
          w.moveSideBeacon(delivery.dest.x, delivery.dest.z);
          w.toast('Package grabbed — deliver it before the clock runs out.', 4);
          return true;
        }
      }
    }
    return false;
  }

  // Prompt text for the E key when a side interaction is in range.
  function promptText() {
    const fx = w.driving && w.drivingCar ? w.drivingCar.car.x : w.player.x;
    const fz = w.driving && w.drivingCar ? w.drivingCar.car.z : w.player.z;
    if (fare.state === 'waiting' && w.driving && fare.pickup
      && Math.hypot(fx - fare.pickup.x, fz - fare.pickup.z) < 8) {
      return 'Press E — Pick up the fare';
    }
    if (delivery.state === 'idle' && w.gameTime >= delivery.cooldownUntil) {
      for (const c of crates) {
        if (Math.hypot(fx - c.x, fz - c.z) < 4.5) return 'Press E — Grab the package';
      }
    }
    return null;
  }

  function sideTarget() {
    if (fare.state === 'riding') return fare.dest;
    if (delivery.state === 'carrying') return delivery.dest;
    return null;
  }

  function minimapDots() {
    const dots = [];
    if (fare.state === 'waiting' && fare.pickup) {
      dots.push({ x: fare.pickup.x, z: fare.pickup.z, color: '#f2c14e', r: 4 });
    }
    if (delivery.state === 'idle') {
      for (const c of crates) dots.push({ x: c.x, z: c.z, color: '#ffd23f', r: 3 });
    }
    for (const c of caches) {
      if (c.taken) continue;
      const fx = w.driving && w.drivingCar ? w.drivingCar.car.x : w.player.x;
      const fz = w.driving && w.drivingCar ? w.drivingCar.car.z : w.player.z;
      if (Math.hypot(fx - c.x, fz - c.z) < 45) dots.push({ x: c.x, z: c.z, color: '#70e000', r: 3 });
    }
    return dots;
  }

  function reset() {
    clearFarePed();
    fare.state = 'idle';
    fare.cooldownUntil = 0;
    delivery.state = 'idle';
    delivery.cooldownUntil = 0;
    cachesFound = 0;
    for (const c of caches) { c.taken = false; c.group.visible = true; }
  }

  function restore(takenIds) {
    reset();
    for (const id of takenIds || []) {
      const c = caches[id];
      if (c && !c.taken) { c.taken = true; c.group.visible = false; cachesFound++; }
    }
  }

  function takenCacheIds() {
    return caches.filter((c) => c.taken).map((c) => c.id);
  }

  return {
    get cachesFound() { return cachesFound; },
    get cachesTotal() { return caches.length; },
    get fareState() { return fare.state; },
    get deliveryState() { return delivery.state; },
    get fareTimer() { return fare.timer; },
    get deliveryTimer() { return delivery.timer; },
    get fareDest() { return fare.dest; },
    get deliveryDest() { return delivery.dest; },
    get farePickup() { return fare.pickup; },
    takenCacheIds,
    update, tryInteract, promptText, sideTarget, minimapDots, reset, restore,
  };
}
