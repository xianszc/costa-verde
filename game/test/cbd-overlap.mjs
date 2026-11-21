// CBD overlap test (GRID REBUILD, Xian 21 Nov 15:22 — the towers stood
// packed with no visible streets, because the old 4-5-wide towers
// covered the 2-wide streets). Fails if any CBD tower / podium
// footprint intersects a road polygon or another tower / podium
// footprint. The towers stand on BLOCKS (one per block, twin pairs on
// a shared podium), set back 8-15 m from the curb, so they clear every
// road by >= 1.0. Sidewalks are NOT checked: the towers front directly
// onto them (a dense CBD street wall), so the sidewalk slabs
// legitimately run under the tower bases. A tower footprint fully
// inside a podium footprint is BY DESIGN (twin towers rise from their
// shared podium) and is not counted.
//
// Usage: node game/test/cbd-overlap.mjs   (from the repo root)
// Exit 0 = PASS (0 overlaps), exit 1 = FAIL.
import { buildCBD } from '../src/cbd.js';
import { roadRects, boulevardMedianSegments } from '../src/roads.js';

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}
function contains(outer, inner) {
  return inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.z0 >= outer.z0 && inner.z1 <= outer.z1;
}

const cbd = buildCBD();
const footprints = cbd.colliders; // {x0,z0,x1,z1,id} per tower / podium
const roads = roadRects();
const median = boulevardMedianSegments().map((s) => ({ ...s, id: 'boulevard-median' }));
const obstacles = [...roads.map((r, i) => ({ ...r, id: `road#${i}` })), ...median];

let roadOverlaps = [];
for (const f of footprints) {
  for (const r of obstacles) {
    if (overlaps(f, r)) roadOverlaps.push(`${f.id} [${f.x0.toFixed(2)},${f.z0.toFixed(2)}-${f.x1.toFixed(2)},${f.z1.toFixed(2)}] x ${r.id} [${r.x0},${r.z0}-${r.x1},${r.z1}]`);
  }
}

let selfOverlaps = [];
for (let i = 0; i < footprints.length; i++) {
  for (let j = i + 1; j < footprints.length; j++) {
    const a = footprints[i], b = footprints[j];
    if (!overlaps(a, b)) continue;
    // Twin towers rise from their shared podium — a tower fully
    // inside a podium is the design, not an overlap.
    const podium = a.id === 'cbd-podium' ? a : b.id === 'cbd-podium' ? b : null;
    const tower = a.id === 'cbd-tower' ? a : b.id === 'cbd-tower' ? b : null;
    if (podium && tower && contains(podium, tower)) continue;
    selfOverlaps.push(`${a.id} [${a.x0.toFixed(2)},${a.z0.toFixed(2)}-${a.x1.toFixed(2)},${a.z1.toFixed(2)}] x ${b.id} [${b.x0.toFixed(2)},${b.z0.toFixed(2)}-${b.x1.toFixed(2)},${b.z1.toFixed(2)}]`);
  }
}

const total = roadOverlaps.length + selfOverlaps.length;
console.log(`CBD overlap test: ${cbd.towerCount} towers + ${cbd.podiumCount} podiums = ${footprints.length} footprints, ${roads.length} road rects + ${median.length} median segments`);
console.log(`  tower-vs-road overlaps: ${roadOverlaps.length}`);
for (const o of roadOverlaps.slice(0, 20)) console.log(`    ${o}`);
if (roadOverlaps.length > 20) console.log(`    ... and ${roadOverlaps.length - 20} more`);
console.log(`  tower-vs-tower overlaps: ${selfOverlaps.length}`);
for (const o of selfOverlaps.slice(0, 20)) console.log(`    ${o}`);
if (selfOverlaps.length > 20) console.log(`    ... and ${selfOverlaps.length - 20} more`);
console.log(total === 0 ? 'PASS: 0 overlaps' : `FAIL: ${total} overlaps`);
process.exit(total === 0 ? 0 : 1);
