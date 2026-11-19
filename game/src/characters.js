// COSTA VERDE v1.1 — characters: human-shaped low-poly people (player +
// pedestrians). Built from boxes/capsules with pivoted limbs so they walk
// like people, not boxes. No external models.
// v1.1: more ped variety — slight height variation, occasional straw hats,
// wider shirt/pants palette — so a crowded sidewalk reads as a crowd.
// Exports buildHumanoid(opts) and animateWalk().

import * as THREE from 'three';

const SKINS = [0xe8b88a, 0xc98d64, 0x8a5a3a, 0xf0c8a0];
const SHIRTS = [0xe8e4da, 0x4a7fd8, 0xd84a4a, 0x3aa88f, 0xf2c14e, 0x7a4ad8, 0x2e7f8f, 0xc94a7a, 0x8a8a8a, 0x3a7a4a];
const PANTS = [0x2b2d42, 0x3a3a40, 0x5a4636, 0x26374e, 0x6a3a2a, 0x1d5a6e];
const HATS = [0xe8cf9e, 0x8a5a3a, 0x2b2d42, 0xd84a4a];

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Build one person. opts: shirt, pants, skin, hair color, hat ('straw'|null),
// glasses (bool), scale (height variation, default 1).
// Returns { group, legL, legR, armL, armR, head, height }.
export function buildHumanoid(opts = {}) {
  const shirt = opts.shirt ?? 0xe8604a; // coral-orange default (the player)
  const pants = opts.pants ?? 0x2b2d42;
  const skin = opts.skin ?? SKINS[0];
  const hair = opts.hair ?? 0x2a2018;
  const scale = opts.scale ?? 1;
  const group = new THREE.Group();

  // Legs: pivot groups at the hips so the swing reads as walking.
  const legL = new THREE.Group(); legL.position.set(-0.14, 0.85, 0);
  legL.add(box(0.22, 0.85, 0.24, pants, 0, -0.42, 0));
  const legR = new THREE.Group(); legR.position.set(0.14, 0.85, 0);
  legR.add(box(0.22, 0.85, 0.24, pants, 0, -0.42, 0));
  group.add(legL, legR);

  // Torso + a slightly wider chest so the silhouette reads as a person.
  const torso = box(0.56, 0.62, 0.32, shirt, 0, 1.16, 0);
  const chest = box(0.6, 0.3, 0.36, shirt, 0, 1.38, 0);
  group.add(torso, chest);

  // Arms: pivot groups at the shoulders.
  const armL = new THREE.Group(); armL.position.set(-0.35, 1.44, 0);
  armL.add(box(0.16, 0.62, 0.18, shirt, 0, -0.28, 0));
  armL.add(box(0.15, 0.2, 0.17, skin, 0, -0.62, 0)); // hand
  const armR = new THREE.Group(); armR.position.set(0.35, 1.44, 0);
  armR.add(box(0.16, 0.62, 0.18, shirt, 0, -0.28, 0));
  armR.add(box(0.15, 0.2, 0.17, skin, 0, -0.62, 0));
  group.add(armL, armR);

  // Head: sphere + hair cap. Face looks toward +Z.
  const head = new THREE.Group(); head.position.set(0, 1.72, 0);
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 14, 12),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  skull.castShadow = true;
  head.add(skull);
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshLambertMaterial({ color: hair }),
  );
  hairCap.position.y = 0.03;
  head.add(hairCap);
  if (opts.glasses) {
    const lens = box(0.3, 0.08, 0.05, 0x1a1a1a, 0, 0.02, 0.19);
    head.add(lens);
    head.add(box(0.34, 0.02, 0.02, 0xd8a24a, 0, 0.07, 0.19)); // gold bar
  }
  if (opts.hat === 'straw') {
    const hatColor = opts.hatColor ?? 0xe8cf9e;
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16),
      new THREE.MeshLambertMaterial({ color: hatColor }),
    );
    brim.position.y = 0.16;
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.21, 0.16, 16),
      new THREE.MeshLambertMaterial({ color: hatColor }),
    );
    top.position.y = 0.25;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.215, 0.05, 16),
      new THREE.MeshLambertMaterial({ color: 0x2b2d42 }),
    );
    band.position.y = 0.2;
    head.add(brim, top, band);
  }
  group.add(head);

  group.scale.setScalar(scale);
  return { group, legL, legR, armL, armR, head, height: 1.95 * scale };
}

// Walk cycle: phase advances with distance; amount 0 = idle, 1 = full stride.
export function animateWalk(h, phase, amount) {
  const s = Math.sin(phase);
  const a = amount * 0.65;
  h.legL.rotation.x = s * a;
  h.legR.rotation.x = -s * a;
  h.armL.rotation.x = -s * a * 0.8;
  h.armR.rotation.x = s * a * 0.8;
  h.group.position.y = Math.abs(Math.cos(phase)) * 0.05 * amount;
}

export function randomPed(rnd) {
  return buildHumanoid({
    shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)],
    pants: PANTS[Math.floor(rnd() * PANTS.length)],
    skin: SKINS[Math.floor(rnd() * SKINS.length)],
    hair: [0x2a2018, 0x4a3220, 0x111111, 0x8a6a4a][Math.floor(rnd() * 4)],
    hat: rnd() < 0.25 ? 'straw' : null,
    hatColor: HATS[Math.floor(rnd() * HATS.length)],
    scale: 0.92 + rnd() * 0.16, // 0.92–1.08 — a crowd is not one height
  });
}

// The player: Leo Marín — coral jacket, charcoal pants, straw hat, aviators.
export function buildPlayer() {
  return buildHumanoid({
    shirt: 0xe8604a, pants: 0x2b2d42, skin: 0xe8b88a,
    hair: 0x2a2018, hat: 'straw', glasses: true,
  });
}
