// CBD overlap test (Xian 21 Nov 15:02 — the towers stood packed with no
// visible streets, because the old 4-5-wide towers covered the 2-wide
// streets). Fails if any CBD tower / podium footprint intersects a road
// polygon or another tower / podium footprint. The towers are 3.0-3.4
// wide on a 6-unit pitch, so the 2.4-wide streets clear them by 0.1-0.3;
// this test pins that. Sidewalks are NOT checked: the towers front
// directly onto them (a dense CBD street wall), so the sidewalk slabs
// legitimately run under the tower bases.
//
// Usage: node game/test/cbd-overlap.mjs   (from the repo root)
// Exit 0 = PASS (0 overlaps), exit 1 = FAIL.
import { buildCBD } from '../src/cbd.js';
import { roadRects, boulevardMedianSegments } from '../src/roads.js';

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
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
    if (overlaps(footprints[i], footprints[j])) {
      selfOverlaps.push(`${footprints[i].id} [${footprints[i].x0.toFixed(2)},${footprints[i].z0.toFixed(2)}-${footprints[i].x1.toFixed(2)},${footprints[i].z1.toFixed(2)}] x ${footprints[j].id} [${footprints[j].x0.toFixed(2)},${footprints[j].z0.toFixed(2)}-${footprints[j].x1.toFixed(2)},${footprints[j].z1.toFixed(2)}]`);
    }
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
