// AZZURA — characters.
// Part N (23 Nov 2026, Xian 21:09): REALISTIC human proportions.
// The old build was fashion-illustration (legs 52%H, chest 0.15H
// wide, head H/8.6) — a stick next to the buildings. Now: legs
// 48%H, chest 0.22H wide, head H/7.5, thicker limbs, longer arms.
// Total height UNCHANGED (Elio still 0.58u = 1.73 m at PED_SCALE
// 0.30); only the shape INSIDE the height changed. Flat color
// blocks + one accent color. Limbs are built as pivoted groups
// (shoulder / hip / elbow) so walk, run, drive, aim, fight and
// idle animations can drive them later.
import * as THREE from '../vendor/three.module.min.js';
import { mergedMesh, colored, xform, vertexColorMat } from './world.js';

// Part I (23 Nov 2026, Xian 18:48): PED_SCALE 0.6 — paired with
// Part J (23 Nov 2026, Xian 19:15): PED_SCALE 0.30 — paired with
// CAR_SCALE 0.33 so people AND cars both live at the world scale
// (1u = 3 m): player Elio 1.92u x 0.30 = 0.58u (1.73 m) vs Stella
// 1.20u x 0.33 = 0.40u (1.19 m) -> 1.45x (real 1.7 m vs 1.2 m =
// 1.42x); person 0.58x one floor (real 0.57x). Part I used 0.6,
// which made people proportional to cars but both too big vs
// buildings + roads. Applied at the figure root in makeFigure +
// makeWalker, so the player, all NPCs, all walkers and mission
// figures share ONE scale. See reports/partJ-scale.md.
export const PED_SCALE = 0.30;

export const ARCHETYPES = {
  lean:    { h: 1.92, girth: 0.86, stoop: 0.00 },
  broad:   { h: 1.82, girth: 1.24, stoop: 0.00 },
  tall:    { h: 2.06, girth: 0.96, stoop: 0.00 },
  short:   { h: 1.56, girth: 0.90, stoop: 0.00 },
  heavy:   { h: 1.76, girth: 1.42, stoop: 0.03 },
  elderly: { h: 1.66, girth: 0.96, stoop: 0.13 },
};

function M(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0.0, flatShading: true, ...opts,
  });
}
function part(geo, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geo, M(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// spec: { archetype, skin, hair, hairColor, top, bottom, shoes, accent,
//         hat, item, scarf, apron, glasses, headphones, pose }
export function makeFigure(spec) {
  const a = ARCHETYPES[spec.archetype || 'lean'];
  const H = a.h;
  const g = a.girth;
  const legLen = H * 0.48; // real: hip height ~48% of stature
  const torsoH = H * 0.32;
  const torsoW = 0.48 * g; // real chest width ~0.22H (was 0.34g = 0.15H)
  const headR = H * 0.067; // real head = H/7.5 (was H/8.6, too small)
  const skin = spec.skin || 0xe8b88a;
  const root = new THREE.Group();
  root.name = 'figure';

  // ---- legs (hip pivots) ----
  const hipY = legLen;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * torsoW * 0.28, hipY, 0);
    leg.add(part(new THREE.CylinderGeometry(0.10 * g, 0.085 * g, legLen, 8),
      spec.bottom || 0x2b2b2b, 0, -legLen / 2, 0));
    leg.add(part(new THREE.BoxGeometry(0.13 * g, 0.07, 0.28),
      spec.shoes || 0x2b2b2b, 0, -legLen + 0.035, 0.06));
    root.add(leg);
  }

  // ---- torso (slight stoop for the elderly) ----
  const torso = new THREE.Group();
  torso.position.set(0, hipY, 0);
  torso.rotation.x = a.stoop;
  const chest = part(new THREE.BoxGeometry(torsoW, torsoH, 0.28 * g),
    spec.top || 0xf2f0ea, 0, torsoH / 2, 0);
  torso.add(chest);
  // Accent stripe / shirt front.
  torso.add(part(new THREE.BoxGeometry(torsoW * 0.4, torsoH * 0.82, 0.02),
    spec.accent || 0xc93a6b, 0, torsoH / 2, 0.15 * g));
  // Apron (farm crew / shopkeepers).
  if (spec.apron) {
    torso.add(part(new THREE.BoxGeometry(torsoW * 0.7, torsoH * 0.9, 0.03),
      spec.apron, 0, torsoH / 2 - 0.02, 0.15 * g));
  }
  // Scarf (accent ring at the neck).
  if (spec.scarf) {
    const scarf = part(new THREE.TorusGeometry(0.13 * g, 0.04, 8, 14), spec.scarf, 0, torsoH + 0.02, 0);
    scarf.rotation.x = Math.PI / 2;
    torso.add(scarf);
  }
  root.add(torso);

  // ---- arms (shoulder pivots, slight bend) ----
  const shoulderY = hipY + torsoH * 0.92;
  const arms = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * torsoW * 0.58, shoulderY, 0);
    arm.rotation.z = side * 0.14; // relaxed A-pose
    const upper = part(new THREE.CylinderGeometry(0.065 * g, 0.058 * g, H * 0.19, 8),
      spec.top || 0xf2f0ea, 0, -H * 0.095, 0);
    arm.add(upper);
    const elbow = new THREE.Group();
    elbow.position.set(0, -H * 0.19, 0);
    elbow.rotation.x = -0.25;
    elbow.add(part(new THREE.CylinderGeometry(0.058 * g, 0.052 * g, H * 0.18, 8),
      spec.skinTop || spec.top || 0xf2f0ea, 0, -H * 0.09, 0));
    elbow.add(part(new THREE.SphereGeometry(0.055 * g, 8, 8), skin, 0, -H * 0.19, 0));
    arm.add(elbow);
    root.add(arm);
    arms[side < 0 ? 'L' : 'R'] = { arm, elbow };
  }

  // ---- head (small) ----
  const head = new THREE.Group();
  head.position.set(0, shoulderY + headR * 1.5, 0);
  head.add(part(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 8), skin, 0, -headR * 0.4, 0));
  head.add(part(new THREE.SphereGeometry(headR, 14, 12), skin, 0, headR * 0.55, 0));
  // Hair: a flattened half-sphere cap.
  const hair = part(new THREE.SphereGeometry(headR * 1.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    spec.hairColor || 0x2b2b2b, 0, headR * 0.62, -headR * 0.08);
  head.add(hair);
  if (spec.glasses) {
    head.add(part(new THREE.BoxGeometry(headR * 1.5, headR * 0.32, 0.03), 0x1a1a1a, 0, headR * 0.6, headR * 0.92));
  }
  root.add(head);

  // ---- hats & head items ----
  if (spec.hat === 'captain') {
    head.add(part(new THREE.CylinderGeometry(headR * 1.15, headR * 1.2, headR * 0.7, 12), 0x1f7a8c, 0, headR * 1.35, 0));
    head.add(part(new THREE.BoxGeometry(headR * 2.0, 0.03, headR * 1.1), 0x16324f, 0, headR * 1.05, headR * 0.7));
  } else if (spec.hat === 'straw') {
    head.add(part(new THREE.CylinderGeometry(headR * 1.9, headR * 1.9, 0.03, 14), 0xd9b96a, 0, headR * 1.15, 0));
    head.add(part(new THREE.CylinderGeometry(headR * 0.9, headR * 1.0, headR * 0.6, 12), 0xd9b96a, 0, headR * 1.4, 0));
  } else if (spec.hat === 'peaked') {
    head.add(part(new THREE.CylinderGeometry(headR * 1.1, headR * 1.15, headR * 0.65, 12), 0x16324f, 0, headR * 1.35, 0));
    head.add(part(new THREE.BoxGeometry(headR * 1.9, 0.03, headR * 1.0), 0x0f1e2e, 0, headR * 1.05, headR * 0.65));
  } else if (spec.hat === 'flatcap') {
    head.add(part(new THREE.CylinderGeometry(headR * 1.15, headR * 1.25, headR * 0.5, 12), 0x16324f, 0, headR * 1.3, 0));
    head.add(part(new THREE.BoxGeometry(headR * 1.2, 0.03, headR * 0.9), 0x16324f, 0, headR * 1.1, headR * 0.7));
  } else if (spec.hat === 'helmet') {
    head.add(part(new THREE.SphereGeometry(headR * 1.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0xf4f1ea, 0, headR * 0.7, 0));
  } else if (spec.hat === 'fishcap') {
    head.add(part(new THREE.CylinderGeometry(headR * 1.05, headR * 1.1, headR * 0.5, 10), 0x4a6741, 0, headR * 1.3, 0));
  } else if (spec.hat === 'bandana') {
    head.add(part(new THREE.CylinderGeometry(headR * 1.08, headR * 1.12, headR * 0.55, 12), 0xc0392b, 0, headR * 1.25, 0));
  } else if (spec.hat === 'shawl') {
    const sh = part(new THREE.ConeGeometry(headR * 1.7, headR * 2.2, 10), 0x1a1a1a, 0, headR * 0.9, -headR * 0.2);
    head.add(sh);
  }
  if (spec.headphones) {
    const band = part(new THREE.TorusGeometry(headR * 1.1, 0.025, 8, 14), 0x1a1a1a, 0, headR * 0.8, 0);
    band.rotation.y = Math.PI / 2;
    head.add(band);
    head.add(part(new THREE.CylinderGeometry(headR * 0.4, headR * 0.4, 0.06, 10), 0x3ed6d6, -headR * 1.1, headR * 0.6, 0));
    head.add(part(new THREE.CylinderGeometry(headR * 0.4, headR * 0.4, 0.06, 10), 0x3ed6d6, headR * 1.1, headR * 0.6, 0));
  }

  // ---- signature items (right hand unless noted) ----
  const R = arms.R.elbow;
  const handY = -H * 0.19;
  if (spec.item === 'compass') {
    R.add(part(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), 0xe8a33d, 0, handY - 0.05, 0.02, { metalness: 0.4 }));
  } else if (spec.item === 'spoon') {
    const s = part(new THREE.BoxGeometry(0.03, 0.3, 0.02), 0x8a6a4a, 0, handY - 0.12, 0.02);
    s.rotation.x = -0.5;
    R.add(s);
    R.add(part(new THREE.SphereGeometry(0.05, 8, 8), 0x8a6a4a, 0, handY - 0.28, 0.08));
  } else if (spec.item === 'cane') {
    R.add(part(new THREE.CylinderGeometry(0.02, 0.02, H * 0.5, 8), 0x2b2b2b, 0, handY - H * 0.2, 0));
    R.add(part(new THREE.SphereGeometry(0.05, 8, 8), 0xe8a33d, 0, handY + 0.06, 0, { metalness: 0.5 }));
  } else if (spec.item === 'rope') {
    const rope = part(new THREE.TorusGeometry(0.23 * g, 0.035, 8, 14), 0xc9a86a, 0, torsoH * 0.6, 0.1 * g);
    rope.rotation.x = Math.PI / 2.4;
    torso.add(rope);
  } else if (spec.item === 'rake') {
    R.add(part(new THREE.CylinderGeometry(0.025, 0.025, H * 0.55, 8), 0x8a6a4a, 0, handY - H * 0.22, 0));
    for (let i = 0; i < 4; i++) {
      R.add(part(new THREE.BoxGeometry(0.04, 0.12, 0.02), 0x8a6a4a, -0.09 + i * 0.06, handY - H * 0.5, 0));
    }
  } else if (spec.item === 'lighter') {
    R.add(part(new THREE.BoxGeometry(0.05, 0.09, 0.03), 0xe8a33d, 0, handY - 0.06, 0.02, { metalness: 0.5 }));
  } else if (spec.item === 'wrench') {
    R.add(part(new THREE.BoxGeometry(0.06, 0.3, 0.03), 0x9a9a94, 0, handY - 0.14, 0.02, { metalness: 0.4 }));
    R.add(part(new THREE.BoxGeometry(0.1, 0.08, 0.03), 0x9a9a94, 0, handY - 0.32, 0.02, { metalness: 0.4 }));
  } else if (spec.item === 'console') {
    const c = part(new THREE.BoxGeometry(0.16, 0.1, 0.03), 0x1a1a1a, 0, handY - 0.06, 0.04);
    R.add(c);
    R.add(part(new THREE.BoxGeometry(0.12, 0.06, 0.01), 0x3ed6d6, 0, handY - 0.06, 0.06, { emissive: 0x3ed6d6, emissiveIntensity: 1.2 }));
  } else if (spec.item === 'watch') {
    R.add(part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), 0xe8a33d, 0, handY + 0.02, 0, { metalness: 0.5 }));
  } else if (spec.item === 'pipe') {
    head.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), 0x6b4a2a, headR * 0.5, headR * 0.45, headR * 0.9));
  } else if (spec.item === 'basket') {
    R.add(part(new THREE.CylinderGeometry(0.12, 0.09, 0.16, 10), 0xc9a86a, 0, handY - 0.1, 0));
    R.add(part(new THREE.SphereGeometry(0.05, 8, 8), 0x9e3b2e, 0.05, handY + 0.0, 0));
    R.add(part(new THREE.SphereGeometry(0.05, 8, 8), 0xf2de9b, -0.05, handY + 0.0, 0));
  } else if (spec.item === 'camera') {
    R.add(part(new THREE.BoxGeometry(0.14, 0.1, 0.08), 0x1a1a1a, 0, handY - 0.06, 0.03));
    R.add(part(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), 0x9a9a94, 0, handY - 0.06, 0.09, { metalness: 0.4 }));
  }

  // Part I: one PED_SCALE for every figure (see top of file).
  // userData.height stores the SCALED height so lineup.js nameplates
  // sit on the visible head instead of floating above it.
  root.scale.setScalar(PED_SCALE);
  root.userData.height = H * PED_SCALE;
  root.userData.arms = arms;
  return root;
}

// ---------- background walkers (cheap crowd) ----------
// Same proportions and pivots as makeFigure (so findLimbs/animateWalk
// work unchanged) but 7 meshes instead of ~13: one cylinder per leg
// (no shoe), one cylinder per arm, one torso box, head sphere + hair
// cap. The 6 named civilians keep the full figure; the generated
// walkers fill the sidewalks without blowing the draw-call budget
// (34 walkers x 7 = ~240 calls vs ~450 for full figures).
export function makeWalker(spec) {
  const a = ARCHETYPES[spec.archetype || 'lean'];
  const H = a.h;
  const g = a.girth;
  const legLen = H * 0.48;
  const torsoH = H * 0.32;
  const torsoW = 0.48 * g;
  const headR = H * 0.067;
  const skin = spec.skin || 0xe8b88a;
  const root = new THREE.Group();
  root.name = 'walker';
  const hipY = legLen;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * torsoW * 0.28, hipY, 0);
    leg.add(part(new THREE.CylinderGeometry(0.10 * g, 0.085 * g, legLen, 8),
      spec.bottom || 0x2b2b2b, 0, -legLen / 2, 0));
    root.add(leg);
  }
  const shoulderY = hipY + torsoH * 0.92;
  // Torso + head baked into ONE vertex-colored mesh (item 4 perf:
  // 7 -> 5 meshes per walker). Safe: animateWalk only swings the legs
  // + arms — the torso and head groups never move relative to the root,
  // and findLimbs only scans Group children, so the merged Mesh child
  // is invisible to it. Same boxes/spheres, same colors, same
  // root-space positions as the three meshes it replaces.
  const torsoHead = [
    colored(xform(new THREE.BoxGeometry(torsoW, torsoH, 0.28 * g), 0, hipY + torsoH / 2, 0),
      spec.top || 0xf2f0ea),
    colored(xform(new THREE.SphereGeometry(headR, 14, 12), 0, shoulderY + headR * 1.5 + headR * 0.55, 0),
      skin),
    colored(xform(new THREE.SphereGeometry(headR * 1.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      0, shoulderY + headR * 1.5 + headR * 0.62, -headR * 0.08),
      spec.hairColor || 0x2b2b2b),
  ];
  root.add(mergedMesh(torsoHead, vertexColorMat));
  const arms = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * torsoW * 0.58, shoulderY, 0);
    arm.rotation.z = side * 0.14;
    arm.add(part(new THREE.CylinderGeometry(0.065 * g, 0.058 * g, H * 0.37, 8),
      spec.top || 0xf2f0ea, 0, -H * 0.185, 0));
    root.add(arm);
    arms[side < 0 ? 'L' : 'R'] = { arm };
  }
  // Part I: walkers share the same PED_SCALE as full figures.
  root.scale.setScalar(PED_SCALE);
  root.userData.height = H * PED_SCALE;
  root.userData.arms = arms;
  return root;
}

// ---------- the cast ----------
// 10 main characters (see GAME_BIBLE.md §4).
export const CAST = [
  { name: 'Elio Santoro', role: 'Protagonist · wheelman', group: 'main',
    spec: { archetype: 'lean', skin: 0xe8b88a, hairColor: 0x2b2b2b, top: 0xf7ebd7, bottom: 0x2e4a5e, shoes: 0x6b4a2a, accent: 0xe4572e, scarf: 0xe4572e, item: 'compass' } },
  { name: 'Vi Romano', role: 'Fixer · La Terrazza', group: 'main',
    spec: { archetype: 'elderly', skin: 0xf2c9a0, hairColor: 0xd9d9d9, top: 0x1a1a1a, bottom: 0x1a1a1a, shoes: 0x1a1a1a, accent: 0xe8a33d, hat: 'shawl', glasses: true, item: 'spoon' } },
  { name: 'Aldo Moretti', role: 'Antagonist · casino owner', group: 'main',
    spec: { archetype: 'broad', skin: 0xe8b88a, hairColor: 0xd9d9d9, top: 0xf4f1ea, bottom: 0xf4f1ea, shoes: 0x1a1a1a, accent: 0xe8a33d, item: 'cane' } },
  { name: 'Bianca Ferrante', role: 'Commissaria · Harbor Guard', group: 'main',
    spec: { archetype: 'tall', skin: 0xe8b88a, hairColor: 0x2b2b2b, top: 0x16324f, bottom: 0x16324f, shoes: 0x0f1e2e, accent: 0xe8a33d, hat: 'peaked' } },
  { name: 'Lidia Costa', role: 'Crew · The Mariners', group: 'main',
    spec: { archetype: 'tall', skin: 0xc98d64, hairColor: 0x2b2b2b, top: 0x1f7a8c, bottom: 0x16324f, shoes: 0x16324f, accent: 0xf2f0ea, hat: 'captain', item: 'rope' } },
  { name: 'Teresa Greco', role: 'Crew · The Harvest', group: 'main',
    spec: { archetype: 'heavy', skin: 0xe8b88a, hairColor: 0x6b4a2a, top: 0x7a8b5a, bottom: 0x6b4a2a, shoes: 0x6b4a2a, accent: 0xf2de9b, hat: 'straw', apron: 0x7a8b5a, item: 'rake' } },
  { name: 'Félix Moreau', role: 'Crew · The Bright Lights', group: 'main',
    spec: { archetype: 'lean', skin: 0x8a5a3b, hairColor: 0x1a1a1a, top: 0xc93a6b, bottom: 0x1a1a1a, shoes: 0x1a1a1a, accent: 0xe8a33d, glasses: true, item: 'lighter' } },
  { name: 'Gus Bianchi', role: 'Mechanic', group: 'main',
    spec: { archetype: 'broad', skin: 0xc98d64, hairColor: 0x2b2b2b, top: 0x4a5560, bottom: 0x4a5560, shoes: 0x2b2b2b, accent: 0xc0392b, hat: 'bandana', item: 'wrench' } },
  { name: 'Iris Novak', role: 'Hacker · "Pixel"', group: 'main',
    spec: { archetype: 'short', skin: 0xf2c9a0, hairColor: 0x8a5a3b, top: 0x3ed6d6, bottom: 0x1a1a1a, shoes: 0xf4f1ea, accent: 0x1f7a8c, headphones: true, item: 'console' } },
  { name: 'Dom Serra', role: 'Mentor · old smuggler', group: 'main',
    spec: { archetype: 'elderly', skin: 0xc98d64, hairColor: 0xd9d9d9, top: 0x4a6741, bottom: 0x2b2b2b, shoes: 0x6b4a2a, accent: 0xe8a33d, hat: 'fishcap', item: 'pipe' } },
];

// Extra crew members (2 per crew).
export const CREW = [
  { name: 'Nadia Reyes', role: 'Mariners · deckhand', group: 'crew',
    spec: { archetype: 'short', skin: 0xe8b88a, hairColor: 0x2b2b2b, top: 0x1f7a8c, bottom: 0x16324f, shoes: 0x16324f, accent: 0xf2f0ea, hat: 'flatcap' } },
  { name: 'Tomas Ibarra', role: 'Mariners · diver', group: 'crew',
    spec: { archetype: 'broad', skin: 0x8a5a3b, hairColor: 0x1a1a1a, top: 0x2e7f8f, bottom: 0x1a1a1a, shoes: 0x1a1a1a, accent: 0x39b8c4, item: 'watch' } },
  { name: 'Paolo Greco', role: 'Harvest · vintner', group: 'crew',
    spec: { archetype: 'lean', skin: 0xe8b88a, hairColor: 0x6b4a2a, top: 0x7a8b5a, bottom: 0x2b2b2b, shoes: 0x6b4a2a, accent: 0xd9b96a, hat: 'straw', item: 'basket' } },
  { name: 'Marta Vitti', role: 'Harvest · beekeeper', group: 'crew',
    spec: { archetype: 'tall', skin: 0xf2c9a0, hairColor: 0xd9b96a, top: 0xd9b96a, bottom: 0x7a8b5a, shoes: 0x6b4a2a, accent: 0x7a8b5a, hat: 'straw', item: 'basket' } },
  { name: 'Cleo Duarte', role: 'Bright Lights · dancer', group: 'crew',
    spec: { archetype: 'lean', skin: 0xc98d64, hairColor: 0x1a1a1a, top: 0xff5c8a, bottom: 0x1a1a1a, shoes: 0xe8a33d, accent: 0x3ed6d6, glasses: true } },
  { name: 'Reno Falco', role: 'Bright Lights · valet', group: 'crew',
    spec: { archetype: 'tall', skin: 0xe8b88a, hairColor: 0x2b2b2b, top: 0xc93a6b, bottom: 0x1a1a1a, shoes: 0x1a1a1a, accent: 0xe8a33d, glasses: true, item: 'lighter' } },
];

// Harbor Guard: constable, sergeant, marine unit.
export const POLICE = [
  { name: 'Constable', role: 'Harbor Guard · patrol', group: 'police',
    spec: { archetype: 'lean', skin: 0xe8b88a, hairColor: 0x2b2b2b, top: 0x16324f, bottom: 0x16324f, shoes: 0x0f1e2e, accent: 0xf4f1ea, hat: 'flatcap' } },
  { name: 'Sergeant', role: 'Harbor Guard · sergeant', group: 'police',
    spec: { archetype: 'broad', skin: 0xc98d64, hairColor: 0x2b2b2b, top: 0x16324f, bottom: 0x16324f, shoes: 0x0f1e2e, accent: 0xe8a33d, hat: 'peaked' } },
  { name: 'Marine', role: 'Harbor Guard · marine unit', group: 'police',
    spec: { archetype: 'tall', skin: 0x8a5a3b, hairColor: 0x1a1a1a, top: 0x1f7a8c, bottom: 0x16324f, shoes: 0x0f1e2e, accent: 0xf4f1ea, hat: 'helmet' } },
];

// Civilians, one per district flavor.
export const CIVILIANS = [
  { name: 'Sailor', role: 'Civilian · marina', group: 'civilian',
    spec: { archetype: 'lean', skin: 0xc98d64, hairColor: 0x6b4a2a, top: 0xf2f0ea, bottom: 0x2e7f8f, shoes: 0x6b4a2a, accent: 0x1f7a8c, hat: 'fishcap' } },
  { name: 'Tourist', role: 'Civilian · promenade', group: 'civilian',
    spec: { archetype: 'short', skin: 0xf2c9a0, hairColor: 0xd9b96a, top: 0xff5c8a, bottom: 0xf2de9b, shoes: 0xf4f1ea, accent: 0x3ed6d6, glasses: true, item: 'camera' } },
  { name: 'Farmer', role: 'Civilian · countryside', group: 'civilian',
    spec: { archetype: 'heavy', skin: 0xe8b88a, hairColor: 0x2b2b2b, top: 0x7a8b5a, bottom: 0x6b4a2a, shoes: 0x6b4a2a, accent: 0xd9b96a, hat: 'straw', apron: 0x7a8b5a } },
  { name: 'Fisherman', role: 'Civilian · lighthouse point', group: 'civilian',
    spec: { archetype: 'elderly', skin: 0x8a5a3b, hairColor: 0xd9d9d9, top: 0x4a5560, bottom: 0x2b2b2b, shoes: 0x2b2b2b, accent: 0xc9a86a, hat: 'fishcap', item: 'pipe' } },
  { name: 'Shopkeeper', role: 'Civilian · old town', group: 'civilian',
    spec: { archetype: 'broad', skin: 0xe8b88a, hairColor: 0x2b2b2b, top: 0xb4552d, bottom: 0x2b2b2b, shoes: 0x1a1a1a, accent: 0xf2de9b, apron: 0xefe3c8 } },
  { name: 'Student', role: 'Civilian · funicular hills', group: 'civilian',
    spec: { archetype: 'lean', skin: 0xf2c9a0, hairColor: 0x1a1a1a, top: 0xa8cbb0, bottom: 0x2e4a5e, shoes: 0xf4f1ea, accent: 0xf2c49b, item: 'console' } },
];

export const FULL_LINEUP = [...CAST, ...CREW, ...POLICE, ...CIVILIANS];
