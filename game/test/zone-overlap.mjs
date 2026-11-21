// Zone overlap tests (NEW PLAN 2a/2b, Xian 21 Nov 17:58). Fails if any
// generator-zone building footprint intersects a road rect (roads.js +
// CBD grid + the zone's own roads + the boulevard median), another
// footprint in the same zone, a CBD tower / podium footprint, or a
// neighbouring hand-built district footprint; or if a building escapes
// its derived block; or if a non-park block holds no building. Signs
// are skipped (atlas=null) — they do not affect footprints. The
// districts' footprints are conservative bounding rects (the Node test
// has no DOM, so buildNewDistricts cannot run here) covering the real
// buildings adjacent to each zone.
//
// Usage: node game/test/zone-overlap.mjs   (from the repo root)
// Exit 0 = PASS, exit 1 = FAIL.
import { createPools, buildZoneInto, deriveBlocks, RING_EXT_DEF, PROMENADE_EXT_DEF, OLD_TOWN_EXT_DEF } from '../src/blocks.js';
import { roadRects, boulevardMedianSegments } from '../src/roads.js';
import { cbdGridRoadRects } from '../src/cbd-grid.js';
import { buildCBD } from '../src/cbd.js';

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}
function contains(outer, inner) {
  return inner.x0 >= outer.x0 - 0.001 && inner.x1 <= outer.x1 + 0.001
    && inner.z0 >= outer.z0 - 0.001 && inner.z1 <= outer.z1 + 0.001;
}

const cbd = buildCBD();
const baseRoads = [
  ...roadRects().map((r, i) => ({ ...r, id: `road#${i}` })),
  ...cbdGridRoadRects().map((r, i) => ({ ...r, id: `cbd-road#${i}` })),
  ...boulevardMedianSegments().map((s) => ({ ...s, id: 'boulevard-median' })),
];
// Neighbouring hand-built districts (bounding rects, id = district).
const DISTRICT_RECTS = [
  { x0: 8, z0: 14, x1: 72, z1: 28, id: 'promenade-row' },
  { x0: -62, z0: 15, x1: -28, z1: 21, id: 'marina-sw' },
  { x0: -35, z0: 21, x1: 8, z1: 27, id: 'marina-sheds' },
  { x0: -1, z0: 22, x1: 8, z1: 30, id: 'pavilion' },
  { x0: -72, z0: -52, x1: -34, z1: -26, id: 'oldtown-pocket' },
  { x0: -72, z0: -53.4, x1: -34, z1: -50.6, id: 'fortress-wall' },
];

function checkZone(def, label) {
  const pools = createPools();
  const ext = buildZoneInto(def, pools, null);
  const footprints = ext.colliders;
  const zoneRoads = [];
  for (const s of (def.roadsNs || [])) zoneRoads.push({ x0: s.x - s.w / 2, z0: s.z0, x1: s.x + s.w / 2, z1: s.z1, id: `zone-ns@${s.x}` });
  for (const s of (def.roadsEw || [])) zoneRoads.push({ x0: s.x0, z0: s.z - s.w / 2, x1: s.x1, z1: s.z + s.w / 2, id: `zone-ew@${s.z}` });
  const roads = [...baseRoads, ...zoneRoads];

  const problems = [];
  for (const f of footprints) {
    for (const r of roads) {
      if (overlaps(f, r)) problems.push(`${label}: ${f.id} x road ${r.id} [${r.x0},${r.z0}-${r.x1},${r.z1}]`);
    }
  }
  for (let i = 0; i < footprints.length; i++) {
    for (let j = i + 1; j < footprints.length; j++) {
      if (overlaps(footprints[i], footprints[j])) problems.push(`${label}: ${footprints[i].id} x ${footprints[j].id}`);
    }
  }
  for (const f of footprints) {
    for (const t of cbd.colliders) {
      if (overlaps(f, t)) problems.push(`${label}: ${f.id} x CBD ${t.id}`);
    }
  }
  for (const f of footprints) {
    for (const d of DISTRICT_RECTS) {
      if (overlaps(f, d)) problems.push(`${label}: ${f.id} x district ${d.id}`);
    }
  }
  let blocks = [];
  for (const r of def.rects) blocks = blocks.concat(deriveBlocks(r.ns, r.ew, r));
  const parkSet = new Set(def.parks || []);
  for (const f of footprints) {
    if (!blocks.some((b) => contains(b, f))) problems.push(`${label}: ${f.id} escapes its block`);
  }
  blocks.forEach((b, i) => {
    const n = footprints.filter((f) => contains(b, f)).length;
    if (parkSet.has(i)) { if (n !== 0) problems.push(`${label}: park block ${i} holds ${n} buildings`); }
    else if (n === 0) problems.push(`${label}: block ${i} [${b.x0},${b.z0}-${b.x1},${b.z1}] holds no building`);
  });
  console.log(`${label}: ${ext.count} buildings, ${ext.blocks} blocks (${ext.parks} parks), ${footprints.length} footprints, ${roads.length} road rects, ${problems.length} problems`);
  for (const p of problems.slice(0, 15)) console.log(`    ${p}`);
  if (problems.length > 15) console.log(`    ... and ${problems.length - 15} more`);
  return { ext, problems };
}

const results = [
  checkZone(RING_EXT_DEF, 'ring-ext'),
  checkZone(PROMENADE_EXT_DEF, 'promenade-ext'),
  checkZone(OLD_TOWN_EXT_DEF, 'oldtown-ext'),
];
const total = results.reduce((s, r) => s + r.problems.length, 0);
console.log(total === 0
  ? 'PASS: all zones clear all roads, each other, the CBD and the neighbouring districts, and sit inside their blocks'
  : `FAIL: ${total} problems`);
process.exit(total === 0 ? 0 : 1);
