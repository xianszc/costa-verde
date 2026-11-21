// CBD block test (GRID REBUILD, Xian 21 Nov 15:22 — every block must
// be bounded by roads on ALL FOUR sides). For each of the 30 grid
// blocks, checks that a road rect touches (or covers) each of its four
// edges: the west edge (x0), east edge (x1), north edge (z0) and south
// edge (z1). "Touches" means a road rect's edge lies within 0.05 of
// the block edge along the full edge length (roads are wider than the
// blocks' gaps, so a road that spans the edge counts). Also prints the
// block census (single / twin / park / plaza / azzura) and the CBD
// footprint area, so the numbers are checkable against the plan
// (36 towers, ~4,039 units^2 — see cbd-grid.js).
//
// Usage: node game/test/cbd-blocks.mjs   (from the repo root)
// Exit 0 = PASS (all blocks bounded on all sides), exit 1 = FAIL.
import { cbdGridBlocks, cbdGridRoadRects } from '../src/cbd-grid.js';
import { buildCBD } from '../src/cbd.js';

const blocks = cbdGridBlocks();
const roads = cbdGridRoadRects();
const EPS = 0.05;

function edgeCovered(edge, isVertical, fixed, from, to) {
  // A road covers the block edge if it spans the edge's range and its
  // perpendicular extent touches the edge line (within EPS).
  let covered = 0;
  for (const r of roads) {
    if (isVertical) {
      if (Math.abs(r.x1 - fixed) > EPS && Math.abs(r.x0 - fixed) > EPS) continue;
      const lo = Math.max(r.z0, from), hi = Math.min(r.z1, to);
      if (hi > lo) covered += hi - lo;
    } else {
      if (Math.abs(r.z1 - fixed) > EPS && Math.abs(r.z0 - fixed) > EPS) continue;
      const lo = Math.max(r.x0, from), hi = Math.min(r.x1, to);
      if (hi > lo) covered += hi - lo;
    }
  }
  return covered >= (to - from) - EPS;
}

const failures = [];
for (const b of blocks) {
  const missing = [];
  if (!edgeCovered('w', true, b.x0, b.z0, b.z1)) missing.push('west');
  if (!edgeCovered('e', true, b.x1, b.z0, b.z1)) missing.push('east');
  if (!edgeCovered('n', false, b.z0, b.x0, b.x1)) missing.push('north');
  if (!edgeCovered('s', false, b.z1, b.x0, b.x1)) missing.push('south');
  if (missing.length) failures.push(`block (${b.col},${b.row}) ${b.kind} [${b.x0},${b.z0}-${b.x1},${b.z1}] missing roads on: ${missing.join(', ')}`);
}

const census = {};
for (const b of blocks) census[b.kind] = (census[b.kind] || 0) + 1;
const cbd = buildCBD();
let area = 0;
for (const b of blocks) area += (b.x1 - b.x0) * (b.z1 - b.z0);
// The blocks sum to 2,303 units^2; the CBD extent (x -34.7..34.7,
// z -45.9..12.3 = 69.4 x 58.2) is 4,039 units^2 including the roads
// and sidewalks between the blocks.
console.log(`CBD block test: ${blocks.length} blocks (${Object.entries(census).map(([k, v]) => `${v} ${k}`).join(', ')}), ${cbd.towerCount} towers + ${cbd.podiumCount} podiums, blocks ${area.toFixed(0)} units^2 / extent 4,039 units^2`);
console.log(`  blocks bounded on all 4 sides: ${blocks.length - failures.length}/${blocks.length}`);
for (const f of failures) console.log(`    FAIL ${f}`);
console.log(failures.length === 0 ? 'PASS: every block is bounded by roads on all 4 sides' : `FAIL: ${failures.length} blocks not bounded on all sides`);
process.exit(failures.length === 0 ? 0 : 1);
