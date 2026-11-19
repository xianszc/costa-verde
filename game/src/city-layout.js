// COSTA VERDE Round 5 — city layout: roads-first, planned blocks, green zones.
// Pure data + math. No THREE, no DOM — importable from the browser AND from
// Node (tools/validate-city.mjs). Deterministic: one seed, per-lot RNG, so
// the game and the validator always agree on every footprint.
//
// The city-system.md rules, in code:
//   1. Roads are defined FIRST (lines, widths, types, intersections,
//      sidewalks, crosswalks). Everything else is placed against them.
//   2. Buildings live INSIDE planned block cells (2x2 lots), with a safe
//      setback from the road, facing the nearest road, never overlapping.
//   3. Trees live ONLY in green zones (boulevard sidewalk strips, the park,
//      residential yards) — NEVER in a vehicle lane, an intersection, a
//      crosswalk, or a building entrance.
//   4. Street furniture has its own placement area (sidewalk / park) and
//      never blocks a vehicle or a pedestrian.
//   5. One block is a park (open / recreational): no buildings, trees in
//      rows, benches, paths, wide pedestrian areas.

import { DISTRICTS } from './config.js';

export const ROAD_LINES = [-185, -111, -37, 37, 111, 185];
export const ROAD_WIDTH = 14;
export const HALF = 210; // CFG.citySize / 2
export const SEA_SHORE_X = 236;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Road types (the grid keeps one width, 14 m, so traffic / police /
// missions keep working — the type drives density + furniture rules).
// The coastal boulevard (x=185) is the main road; the central cross
// (x=±37, z=±37) are avenues; the rest are streets.
function roadType(axis, at) {
  if (axis === 'x' && at === 185) return 'boulevard';
  if (Math.abs(at) === 37) return 'avenue';
  return 'street';
}

export function districtAt(x, z) {
  let best = DISTRICTS[0], bd = 1e9;
  for (const d of DISTRICTS) {
    const dd = (x - d.cx) ** 2 + (z - d.cz) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

// --- geometric predicates (shared by the game and the validator) ----------
export function onRoad(x, z, margin = 0) {
  const hw = ROAD_WIDTH / 2 + margin;
  return ROAD_LINES.some((l) => Math.abs(x - l) <= hw)
    || ROAD_LINES.some((l) => Math.abs(z - l) <= hw);
}
export function inIntersection(x, z, margin = 0) {
  const hw = ROAD_WIDTH / 2 + margin;
  return ROAD_LINES.some((l) => Math.abs(x - l) <= hw)
    && ROAD_LINES.some((l) => Math.abs(z - l) <= hw);
}
export function onCrosswalk(x, z) {
  // Crosswalks sit on every road, 5 m wide, at each intersection.
  for (const l of ROAD_LINES) {
    for (const c of ROAD_LINES) {
      if (Math.abs(x - l) <= ROAD_WIDTH / 2 && Math.abs(z - c) <= 2.5) return true;
      if (Math.abs(z - l) <= ROAD_WIDTH / 2 && Math.abs(x - c) <= 2.5) return true;
    }
  }
  return false;
}
export function inSea(x) { return x > SEA_SHORE_X - 26; } // beach + water

export function buildCityLayout() {
  const layout = {
    roads: [], intersections: [], crosswalks: [],
    blocks: [], buildings: [], trees: [], furniture: [],
    billboards: [], park: null,
  };

  // --- 1. ROADS FIRST -------------------------------------------------------
  for (const at of ROAD_LINES) {
    layout.roads.push({ axis: 'x', at, width: ROAD_WIDTH, type: roadType('x', at) });
    layout.roads.push({ axis: 'z', at, width: ROAD_WIDTH, type: roadType('z', at) });
  }
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) layout.intersections.push({ x, z });
  }
  // Crosswalks: on every road at every intersection (5 m wide strips).
  for (const l of ROAD_LINES) {
    for (const c of ROAD_LINES) {
      layout.crosswalks.push({ axis: 'x', at: l, c, half: 2.5 }); // across road x=l, at z=c
      layout.crosswalks.push({ axis: 'z', at: l, c, half: 2.5 }); // across road z=l, at x=c
    }
  }

  // --- 2. BLOCKS (planned cells, 1.5 m setback from the road edge) ---------
  // The park block: Palms Row south-east (i=3, j=3) — x 44..104, z 118..178.
  // No gameplay point (mission target, cache, parked car, fare, crate) sits
  // inside it, so it can go green without touching any system.
  const PARK_I = 3, PARK_J = 4;
  for (let i = 0; i < ROAD_LINES.length - 1; i++) {
    for (let j = 0; j < ROAD_LINES.length - 1; j++) {
      const x0 = ROAD_LINES[i] + ROAD_WIDTH / 2 + 1.5;
      const x1 = ROAD_LINES[i + 1] - ROAD_WIDTH / 2 - 1.5;
      const z0 = ROAD_LINES[j] + ROAD_WIDTH / 2 + 1.5;
      const z1 = ROAD_LINES[j + 1] - ROAD_WIDTH / 2 - 1.5;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const isPark = i === PARK_I && j === PARK_J;
      layout.blocks.push({
        i, j, x0, x1, z0, z1, cx, cz,
        district: districtAt(cx, cz).name, isPark,
      });
    }
  }
  const parkBlock = layout.blocks.find((b) => b.isPark);
  layout.park = {
    x0: parkBlock.x0, x1: parkBlock.x1, z0: parkBlock.z0, z1: parkBlock.z1,
    cx: parkBlock.cx, cz: parkBlock.cz,
  };

  // --- 3. BUILDINGS (inside blocks only, 2x2 lots, per-lot RNG) -----------
  // Per-lot seeds: a lot's footprint depends only on its own seed, so a
  // block going green never shifts another block's buildings.
  const GAP = 2.5;
  let buildingSeq = 0;
  for (const cell of layout.blocks) {
    if (cell.isPark) continue;
    const d = DISTRICTS.find((dd) => dd.name === cell.district);
    const w = cell.x1 - cell.x0, dep = cell.z1 - cell.z0;
    const isDowntown = d.name === 'Downtown';
    const lotW = (w - GAP) / 2, lotD = (dep - GAP) / 2;
    for (let lx = 0; lx < 2; lx++) {
      for (let lz = 0; lz < 2; lz++) {
        const rnd = mulberry32(20261119 + cell.i * 101 + cell.j * 17 + lx * 7 + lz * 3);
        const lotX0 = cell.x0 + lx * (lotW + GAP);
        const lotZ0 = cell.z0 + lz * (lotD + GAP);
        const lotCx = lotX0 + lotW / 2, lotCz = lotZ0 + lotD / 2;
        // Footprint fills 78–92% of the lot (small setbacks, tight streets).
        const bw = lotW * (0.78 + rnd() * 0.14);
        const bd = lotD * (0.78 + rnd() * 0.14);
        const bx = lotCx + (rnd() - 0.5) * (lotW - bw) * 0.4;
        const bz = lotCz + (rnd() - 0.5) * (lotD - bd) * 0.4;
        // Height: Downtown gets a landmark tower on lot (0,0) of each block.
        const isTower = isDowntown && lx === 0 && lz === 0;
        const h = isTower
          ? 48 + rnd() * 24
          : d.hMin + rnd() * (d.hMax - d.hMin);
        // Facing: the side toward the nearest road line.
        const distRoadX = Math.min(Math.abs(bx - ROAD_LINES.reduce((a, b) => (Math.abs(b - bx) < Math.abs(a - bx) ? b : a))));
        const distRoadZ = Math.min(Math.abs(bz - ROAD_LINES.reduce((a, b) => (Math.abs(b - bz) < Math.abs(a - bz) ? b : a))));
        const facing = distRoadX <= distRoadZ
          ? (bx < ROAD_LINES.reduce((a, b) => (Math.abs(b - bx) < Math.abs(a - bx) ? b : a)) ? 'west' : 'east')
          : (bz < ROAD_LINES.reduce((a, b) => (Math.abs(b - bz) < Math.abs(a - bz) ? b : a)) ? 'north' : 'south');
        layout.buildings.push({
          id: buildingSeq++, block: `${cell.i},${cell.j}`, lot: `${lx},${lz}`,
          x: bx, z: bz, w: bw, d: bd, h,
          minX: bx - bw / 2, maxX: bx + bw / 2,
          minZ: bz - bd / 2, maxZ: bz + bd / 2,
          district: d.name, tint: d.color, isTower, facing,
          texIdx: Math.floor(rnd() * 5),
          seed: 20261119 + cell.i * 101 + cell.j * 17 + lx * 7 + lz * 3,
        });
      }
    }
  }

  // --- 4. TREES — green zones only ------------------------------------------
  // (a) Boulevard promenade (east sidewalk, x=196) + west sidewalk strip
  //     (x=177.2 — the 1.5 m strip between the block edge and the road;
  //     trunks fit, fronds overhang at 7 m, nothing in the lane).
  // (b) Park rows (3 rows, 8 m spacing, clear of the paths).
  // (c) Residential yards: Palms Row lots, at the lot corner nearest the
  //     street, 2 m inside the lot edge — never inside the building.
  const treeRnd = mulberry32(20261120);
  function addTree(x, z, s, zone) {
    layout.trees.push({ x, z, s, zone });
  }
  for (let z = -190; z <= 190; z += 24) {
    // Never within 10 m of a cross road — the row crosses every z-road,
    // and a palm in the intersection would block traffic.
    if (ROAD_LINES.some((l) => Math.abs(z - l) < 10)) continue;
    addTree(196, z + (treeRnd() - 0.5) * 4, 0.9 + treeRnd() * 0.3, 'boulevard');
    const z2 = z + 12;
    if (ROAD_LINES.some((l) => Math.abs(z2 - l) < 10)) continue;
    if (treeRnd() < 0.6) addTree(177.2, z2, 0.85 + treeRnd() * 0.3, 'boulevard');
  }
  // Park: 3 rows of palms along the paths.
  for (let r = 0; r < 3; r++) {
    const z = layout.park.z0 + 8 + r * ((layout.park.z1 - layout.park.z0 - 16) / 2);
    for (let x = layout.park.x0 + 6; x <= layout.park.x1 - 6; x += 9) {
      addTree(x, z, 0.9 + treeRnd() * 0.25, 'park');
    }
  }
  // Residential yards (Palms Row blocks, one tree per lot corner).
  // Auto-reject: try the lot's corners in order and take the first one
  // that is NOT inside the lot's building (1 m margin) and NOT on a road;
  // if every corner fails, the lot simply gets no tree.
  function buildingAt(x, z, margin) {
    for (const b of layout.buildings) {
      if (x >= b.minX - margin && x <= b.maxX + margin
        && z >= b.minZ - margin && z <= b.maxZ + margin) return b;
    }
    return null;
  }
  for (const cell of layout.blocks) {
    if (cell.isPark || cell.district !== 'Palms Row') continue;
    const yardRnd = mulberry32(20261121 + cell.i * 31 + cell.j * 7);
    const w = cell.x1 - cell.x0, dep = cell.z1 - cell.z0;
    const lotW = (w - GAP) / 2, lotD = (dep - GAP) / 2;
    for (let lx = 0; lx < 2; lx++) {
      for (let lz = 0; lz < 2; lz++) {
        if (yardRnd() < 0.45) continue; // not every yard has a tree
        const lotX0 = cell.x0 + lx * (lotW + GAP);
        const lotZ0 = cell.z0 + lz * (lotD + GAP);
        const corners = [
          [lotX0 + 2.2, lotZ0 + 2.2],
          [lotX0 + lotW - 2.2, lotZ0 + 2.2],
          [lotX0 + 2.2, lotZ0 + lotD - 2.2],
          [lotX0 + lotW - 2.2, lotZ0 + lotD - 2.2],
        ];
        for (const [tx, tz] of corners) {
          if (buildingAt(tx, tz, 1.0)) continue;
          if (onRoad(tx, tz, 0.5)) continue;
          addTree(tx, tz, 0.8 + yardRnd() * 0.3, 'yard');
          break;
        }
      }
    }
  }

  // --- 5. STREET FURNITURE — sidewalk / park only ---------------------------
  // Lamps: along the boulevard + the central avenues, 1.2 m off the road
  // edge (on the sidewalk strip), every ~37 m, never within 12 m of an
  // intersection (keeps the crossing clear).
  const lampRnd = mulberry32(20261122);
  function lampLine(axis, at) {
    for (let a = -185; a <= 185; a += 37) {
      // Skip near intersections.
      if (ROAD_LINES.some((l) => Math.abs(a - l) < 12)) continue;
      const off = (lampRnd() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 + 1.2);
      const x = axis === 'x' ? at + off : a;
      const z = axis === 'x' ? a : at + off;
      layout.furniture.push({ kind: 'lamp', x, z });
    }
  }
  lampLine('x', 185); // boulevard, both sides over the run
  lampLine('z', 37);
  lampLine('z', -37);
  lampLine('x', 37);
  lampLine('x', -37);
  // Benches + bins: in the park, and on the boulevard promenade.
  for (let i = 0; i < 4; i++) {
    layout.furniture.push({
      kind: 'bench',
      x: layout.park.x0 + 10 + i * 12,
      z: layout.park.cz - 4 + (i % 2) * 8,
    });
  }
  layout.furniture.push({ kind: 'bin', x: layout.park.x0 + 8, z: layout.park.z0 + 6 });
  layout.furniture.push({ kind: 'bin', x: layout.park.x1 - 8, z: layout.park.z1 - 6 });
  for (const z of [-150, -90, 90, 150]) { // ±30 would sit on road z=±37
    layout.furniture.push({ kind: 'bench', x: 194.5, z });
  }

  // --- 6. BILLBOARDS — boulevard promenade, facing the road -----------------
  // (The old (-40,-150) board stood IN road x=-37 — a city-system
  // violation. All boards now sit on the promenade, clear of the lane.)
  layout.billboards = [
    { x: 196.5, z: -150, text: 'COSTA VERDE', bg: '#d84a4a', fg: '#fff3c4' },
    { x: 196.5, z: 60, text: 'VERDE GT', bg: '#2e7f8f', fg: '#ffffff' },
    { x: 196.5, z: 140, text: 'MARINA NIGHTS', bg: '#f2c14e', fg: '#26374e' },
    { x: 194.5, z: -60, text: 'SUNSET BAR', bg: '#c94a7a', fg: '#ffffff' },
  ];

  return layout;
}

// --- point queries (validator + gameplay) ------------------------------------
export function pointInBuilding(layout, x, z, margin = 0) {
  for (const b of layout.buildings) {
    if (x >= b.minX - margin && x <= b.maxX + margin
      && z >= b.minZ - margin && z <= b.maxZ + margin) return b;
  }
  return null;
}
export function pointInPark(layout, x, z) {
  const p = layout.park;
  return x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;
}
export function nearestRoadDist(x, z) {
  const dx = Math.min(...ROAD_LINES.map((l) => Math.abs(x - l)));
  const dz = Math.min(...ROAD_LINES.map((l) => Math.abs(z - l)));
  return Math.min(dx, dz) - ROAD_WIDTH / 2; // >0 = off the road surface
}
