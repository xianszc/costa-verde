// Ring-extension zone test (NEW PLAN 2a, Xian 21 Nov 17:58 — the
// commercial ring's third column + outer columns). Fails if any
// ring-ext building footprint intersects a road rect (roads.js +
// CBD grid + the zone's own roads + the boulevard median), another
// ring-ext footprint, or a CBD tower / podium footprint; or if a
// building escapes its derived block; or if a non-park block holds
// no building. Signs are skipped (atlas=null) — they do not affect
// footprints. The zone's buildings sit inside blocks derived from
// the streets with a 0.2 setback, so they clear every road by
// construction; this test proves it on the real numbers.
//
// Usage: node game/test/zone-overlap.mjs   (from the repo root)
// Exit 0 = PASS, exit 1 = FAIL.
import { createPools, buildZoneInto, deriveBlocks, RING_EXT_DEF } from '../src/blocks.js';
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

const pools = createPools();
const ext = buildZoneInto(RING_EXT_DEF, pools, null);
const footprints = ext.colliders;

// The zone's own road rects (from the def's road lists).
const zoneRoads = [];
for (const s of RING_EXT_DEF.roadsNs) zoneRoads.push({ x0: s.x - s.w / 2, z0: s.z0, x1: s.x + s.w / 2, z1: s.z1, id: `zone-ns@${s.x}` });
for (const s of RING_EXT_DEF.roadsEw) zoneRoads.push({ x0: s.x0, z0: s.z - s.w / 2, x1: s.x1, z1: s.z + s.w / 2, id: `zone-ew@${s.z}` });

const roads = [
  ...roadRects().map((r, i) => ({ ...r, id: `road#${i}` })),
  ...cbdGridRoadRects().map((r, i) => ({ ...r, id: `cbd-road#${i}` })),
  ...boulevardMedianSegments().map((s) => ({ ...s, id: 'boulevard-median' })),
  ...zoneRoads,
];

let roadOverlaps = [];
for (const f of footprints) {
  for (const r of roads) {
    if (overlaps(f, r)) roadOverlaps.push(`${f.id} [${f.x0.toFixed(2)},${f.z0.toFixed(2)}-${f.x1.toFixed(2)},${f.z1.toFixed(2)}] x ${r.id} [${r.x0},${r.z0}-${r.x1},${r.z1}]`);
  }
}

let selfOverlaps = [];
for (let i = 0; i < footprints.length; i++) {
  for (let j = i + 1; j < footprints.length; j++) {
    const a = footprints[i], b = footprints[j];
    if (overlaps(a, b)) selfOverlaps.push(`${a.id} x ${b.id}`);
  }
}

const cbd = buildCBD();
let cbdOverlaps = [];
for (const f of footprints) {
  for (const t of cbd.colliders) {
    if (overlaps(f, t)) cbdOverlaps.push(`${f.id} x ${t.id}`);
  }
}

// Every building must lie inside one derived block.
let blocks = [];
for (const r of RING_EXT_DEF.rects) blocks = blocks.concat(deriveBlocks(r.ns, r.ew, r));
const parkSet = new Set(RING_EXT_DEF.parks || []);
let escaped = [];
for (const f of footprints) {
  if (!blocks.some((b) => contains(b, f))) escaped.push(`${f.id} escapes its block`);
}
let emptyBlocks = [];
blocks.forEach((b, i) => {
  const n = footprints.filter((f) => contains(b, f)).length;
  if (parkSet.has(i)) { if (n !== 0) emptyBlocks.push(`park block ${i} holds ${n} buildings`); }
  else if (n === 0) emptyBlocks.push(`block ${i} [${b.x0},${b.z0}-${b.x1},${b.z1}] holds no building`);
});

const total = roadOverlaps.length + selfOverlaps.length + cbdOverlaps.length + escaped.length + emptyBlocks.length;
console.log(`zone overlap test: ${ext.count} buildings, ${ext.blocks} blocks (${ext.parks} parks), ${footprints.length} footprints, ${roads.length} road rects`);
console.log(`  building-vs-road overlaps: ${roadOverlaps.length}`);
for (const o of roadOverlaps.slice(0, 20)) console.log(`    ${o}`);
if (roadOverlaps.length > 20) console.log(`    ... and ${roadOverlaps.length - 20} more`);
console.log(`  building-vs-building overlaps: ${selfOverlaps.length}`);
for (const o of selfOverlaps.slice(0, 10)) console.log(`    ${o}`);
console.log(`  building-vs-CBD overlaps: ${cbdOverlaps.length}`);
for (const o of cbdOverlaps.slice(0, 10)) console.log(`    ${o}`);
console.log(`  buildings outside their block: ${escaped.length}`);
for (const o of escaped.slice(0, 10)) console.log(`    ${o}`);
console.log(`  empty / wrongly-filled blocks: ${emptyBlocks.length}`);
for (const o of emptyBlocks.slice(0, 10)) console.log(`    ${o}`);
console.log(total === 0
  ? 'PASS: ring-ext buildings clear all roads, each other, the CBD, and sit inside their blocks'
  : `FAIL: ${total} problems`);
process.exit(total === 0 ? 0 : 1);
