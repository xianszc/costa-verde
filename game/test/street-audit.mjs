// Street-cleanup BEFORE/AFTER audit (Xian 22 Nov 09:30 brief, item A).
// Verifies the 05:07 item-3 completion CLAIM with fresh numbers, per district
// where the data allows. One script, one methodology, run BEFORE any fix and
// again AFTER: `NODE_PATH=/tmp/node_modules node game/test/street-audit.mjs
// --out reports/street-audit-before.json` (AFTER: --out reports/street-audit-after.json).
//
// What it measures (all from the live page, server 8941):
//  1. Markings registry: per-registry audit totals + an INDEPENDENT pairwise
//     overlap check over ALL registry items across registries (grid-bucketed),
//     counts by type and by region, and skipped counts (a marking the
//     registry refused to place = a coverage gap, not a pass).
//  2. Furniture on asphalt: district.colliders (AABB + id) vs road rects
//     derived from district.minimap segments (centreline + width w).
//     Building plots are colliders too — they are reported separately.
//  3. Ped paths on asphalt: every district.pedPaths entry + every ped's own
//     path, sampled at 101 points; flagged when on-road fraction > 0.5
//     (same rule as the item-3 audit).
//  4. district.report (the game's own plot/tree audit) + ped/traffic counts.
// NOT measured here (needs source-level checks, see the report notes):
//  - sidewalk widths / furniture-strip widths (merged meshes carry no
//    per-street widths; verified by reading roads.js / city.js /
//    districts.js literals instead),
//  - canopy overhang vs shop signs (trees are merged meshes with no
//    per-tree positions at runtime; the game's own treesOnRoads count
//    is reported, the sign check is visual),
//  - the non-registry zebra in roads.js (~971, x=-16): hand-placed bars
//    BoxGeometry(0.3, 0.01, 1.8), 5 bars spaced 1.6 in z — they overlap
//    into one solid band and run perpendicular to traffic (registry
//    standard: bars 2.0 long parallel to traffic). It bypasses the
//    registry, so it never appears in check 1.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const CHROMIUM = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const outArg = process.argv.find((a) => a.startsWith('--out'));
const OUT = outArg ? outArg.split('=')[1] : 'reports/street-audit-before.json';

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8941/index.html?hud=0', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__gameReady, null, { timeout: 120000 });

const raw = await page.evaluate(() => {
  const g = window.__game;
  const d = g.district;
  return {
    markingAudits: (window.__markingAudits || []).map((a) => ({ items: a.items, audit: a.audit })),
    colliders: d.colliders || [],
    minimap: (d.minimap || []).map((s) => ({ x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2, w: s.w })),
    pedPaths: d.pedPaths || [],
    peds: (g.peds || []).map((p) => ({ path: p.path ? { a: p.path.a, b: p.path.b } : null })),
    pedCount: (g.peds || []).length,
    trafficCount: (g.traffic || []).length,
    trafficKeys: g.traffic && g.traffic[0] ? Object.keys(g.traffic[0]) : [],
    districtReport: d.report || null,
    lanesKeys: d.lanes ? Object.keys(d.lanes) : null,
  };
});
await browser.close();

// ---- 1. Markings: registry totals + independent cross-registry overlap ----
const allItems = [];
const perRegistry = raw.markingAudits.map((a, i) => {
  for (const it of a.items) allItems.push({ ...it, reg: i });
  return { registry: i, items: a.items.length, total: a.audit.total, byPair: a.audit.byPair, skipped: a.audit.skipped, deduped: a.audit.deduped };
});
const registryTotal = perRegistry.reduce((s, r) => s + r.total, 0);
const registrySkipped = perRegistry.reduce((s, r) => s + r.skipped, 0);
// Independent pairwise overlap, grid-bucketed (cell 4u) so it stays fast.
const CELL = 4;
const grid = new Map();
const key = (cx, cz) => cx + ':' + cz;
for (let i = 0; i < allItems.length; i++) {
  const it = allItems[i];
  const x0 = Math.floor(it.x0 / CELL), x1 = Math.floor(it.x1 / CELL);
  const z0 = Math.floor(it.z0 / CELL), z1 = Math.floor(it.z1 / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
    const k = key(cx, cz);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
}
const overlapPairs = new Set();
const overlapSamples = [];
for (const idxs of grid.values()) {
  for (let a = 0; a < idxs.length; a++) for (let b = a + 1; b < idxs.length; b++) {
    const i = idxs[a], j = idxs[b];
    const A = allItems[i], B = allItems[j];
    if (A.x0 < B.x1 && B.x0 < A.x1 && A.z0 < B.z1 && B.z0 < A.z1) {
      const pk = i < j ? i + '|' + j : j + '|' + i;
      if (!overlapPairs.has(pk)) {
        overlapPairs.add(pk);
        if (overlapSamples.length < 10) overlapSamples.push({ a: { type: A.type, reg: A.reg, x0: A.x0, z0: A.z0, x1: A.x1, z1: A.z1 }, b: { type: B.type, reg: B.reg, x0: B.x0, z0: B.z0, x1: B.x1, z1: B.z1 } });
      }
    }
  }
}
const byType = {};
const byRegion = {};
for (const it of allItems) {
  byType[it.type] = (byType[it.type] || 0) + 1;
  const cx = (it.x0 + it.x1) / 2, cz = (it.z0 + it.z1) / 2;
  const region = cz < -40 ? 'north' : cz > 20 ? 'south' : cx < -40 ? 'west' : cx > 40 ? 'east' : 'centre';
  const k = region + ':' + it.type;
  byRegion[k] = (byRegion[k] || 0) + 1;
}

// ---- 2. Road rects from minimap segments; furniture (colliders) on asphalt ----
const roadRects = raw.minimap.map((s) => {
  const hw = (s.w || 7) / 2;
  return { x0: Math.min(s.x1, s.x2) - hw, z0: Math.min(s.z1, s.z2) - hw, x1: Math.max(s.x1, s.x2) + hw, z1: Math.max(s.z1, s.z2) + hw };
});
const rectHits = (x0, z0, x1, z1) => roadRects.some((r) => x0 < r.x1 && r.x0 < x1 && z0 < r.z1 && r.z0 < z1);
const onAsphalt = [];
for (const c of raw.colliders) {
  if (c.x0 === undefined) continue;
  if (rectHits(c.x0, c.z0, c.x1, c.z1)) onAsphalt.push({ id: c.id || '?', x0: c.x0, z0: c.z0, x1: c.x1, z1: c.z1 });
}
const onAsphaltById = {};
for (const o of onAsphalt) {
  const cat = String(o.id).split(/[-_]/)[0] || '?';
  onAsphaltById[cat] = (onAsphaltById[cat] || 0) + 1;
}

// ---- 3. Ped paths on asphalt (101 samples, flag when on-road fraction > 0.5) ----
const pointOnRoad = (x, z) => roadRects.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
function pathOnRoad(a, b) {
  let on = 0;
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    if (pointOnRoad(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) on++;
  }
  return on / 101;
}
const pedPathFlags = [];
const allPaths = [
  ...raw.pedPaths.map((p, i) => ({ src: 'district', i, a: p.a, b: p.b })),
  ...raw.peds.filter((p) => p.path).map((p, i) => ({ src: 'ped', i, a: p.path.a, b: p.path.b })),
];
for (const p of allPaths) {
  if (!p.a || !p.b) continue;
  const len = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z);
  const frac = pathOnRoad(p.a, p.b);
  if (len > 6 && frac > 0.5) pedPathFlags.push({ ...p, len: +len.toFixed(1), onRoadFrac: +frac.toFixed(2) });
}

const result = {
  generated: new Date().toISOString(),
  markings: { registries: perRegistry, registryTotal, registrySkipped, itemsTotal: allItems.length, independentOverlaps: overlapPairs.size, overlapSamples, byType, byRegion },
  roads: { minimapSegments: raw.minimap.length, roadRects: roadRects.length },
  furnitureOnAsphalt: { count: onAsphalt.length, byIdPrefix: onAsphaltById, sample: onAsphalt.slice(0, 20) },
  pedPaths: { checked: allPaths.length, flagged: pedPathFlags.length, flags: pedPathFlags.slice(0, 20) },
  peds: { count: raw.pedCount },
  traffic: { count: raw.trafficCount, keys: raw.trafficKeys },
  districtReport: raw.districtReport,
  lanesKeys: raw.lanesKeys,
};
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  markingsItems: allItems.length, registryTotal, registrySkipped, independentOverlaps: overlapPairs.size,
  roadRects: roadRects.length, colliders: raw.colliders.length, furnitureOnAsphalt: onAsphalt.length,
  pedPathsChecked: allPaths.length, pedPathsFlagged: pedPathFlags.length,
  peds: raw.pedCount, traffic: raw.trafficCount, districtReport: raw.districtReport,
}, null, 1));
console.log('wrote ' + OUT);
