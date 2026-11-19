// COSTA VERDE Slice 2 — combat: pistol hitscan, ammo, reload. The shot is a
// ray from the camera through the crosshair; targets are spheres (police
// cruisers, traffic cars, pedestrians). Visual feedback (tracer, hit marker,
// damage numbers) lives in main.js; this module only decides what was hit.

import { CFG } from './config.js';

export function makePistol() {
  return {
    ammo: CFG.pistol.magSize,
    magSize: CFG.pistol.magSize,
    reloading: false,
    reloadUntil: 0,
    lastShot: -9,
  };
}

export function startReload(p, now) {
  if (p.reloading || p.ammo >= p.magSize) return false;
  p.reloading = true;
  p.reloadUntil = now + CFG.pistol.reloadSec;
  return true;
}

export function updatePistol(p, now) {
  if (p.reloading && now >= p.reloadUntil) {
    p.ammo = p.magSize;
    p.reloading = false;
  }
}

// Ray vs sphere: returns the ray distance to the hit, or Infinity.
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}

// Fire one round. origin/dir are the camera ray. targets: [{x,y,z,r,kind,ref}].
// Returns { fired, empty, hit, point, dist } — point is where the bullet ends
// (the hit, or max range) so the tracer has somewhere to go.
export function firePistol(p, now, origin, dir, targets) {
  if (p.reloading || now - p.lastShot < 0.18) return { fired: false };
  if (p.ammo <= 0) return { fired: false, empty: true };
  p.ammo -= 1;
  p.lastShot = now;
  let best = null, bestT = CFG.pistol.range;
  for (const t of targets) {
    const tt = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, t.x, t.y, t.z, t.r);
    if (tt < bestT) { bestT = tt; best = t; }
  }
  const point = {
    x: origin.x + dir.x * bestT,
    y: origin.y + dir.y * bestT,
    z: origin.z + dir.z * bestT,
  };
  return { fired: true, hit: best, point, dist: bestT };
}
