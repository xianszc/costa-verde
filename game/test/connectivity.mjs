// COSTA VERDE road-network CONNECTIVITY test (Xian 21 Nov 23:04,
// TOP PRIORITY: road connectivity is a GAME bug, not a driver issue).
//
// Builds the road graph from the SAME road data the game uses —
// window.__game.district.minimap, the centerlines published by the
// game (roads.js minimapLines + cbdGridMinimap + the blocks.js zone
// minimaps, assembled in city.js). One source of truth: if this
// graph splits, the game data is broken — the driver must NOT be
// patched to hide a gap (no straight-line fallback, no teleport).
//
// Method: the drivers cluster segment ENDPOINTS within 4 units, so
// this test uses the same rule, then reports:
//   - every connected component (segments, bbox, nearest zone),
//   - every near-miss endpoint pair across components (<= 15 u),
//   - every pair of segments from different components whose
//     geometry crosses or touches (a T/X junction the endpoint
//     clustering misses — a false break),
//   - per-zone reachability from the harbor (nearest segment +
//     its component),
//   - drive-time estimates between all zone pairs (BFS path length
//     in units; 1 unit = 10 m; city speed 7 u/s game-time; headless
//     real time ~5x game-time).
// REQUIRED: harbor/quay, marina, old town, promenade, CBD, Ring,
// commercial ring, residential, hills/villas, lighthouse road,
// countryside and quarry are ONE connected component for cars.
// Exit 0 = one component with every zone reachable; exit 1 = split.
//
// Usage: NODE_PATH=/tmp/node_modules node game/test/connectivity.mjs
//   (NODE_PATH must resolve playwright-core; the 8941 server must
//   already be running. ESM does not read NODE_PATH, so Playwright
//   is loaded via createRequire, which does.)
// Writes /tmp/connectivity.json. Takes ~1 min (page load only).
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8941';
const CHROMIUM = '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CLUSTER_R = 4; // same endpoint-clustering radius as the drivers
const NEAR_MISS_R = 15;
const CITY_SPEED = 7; // units/s game-time

// Zone anchors (same points as routes.mjs + the mission anchors).
const ZONES = [
  { id: 'harbor', name: 'Harbor/quay', x: 3, z: 20 },
  { id: 'marina', name: 'Marina pavilion', x: 3, z: 26 },
  { id: 'quay_end', name: 'Quay end', x: 0, z: 33 },
  { id: 'oldtown', name: 'Old Town (bell tower)', x: -47, z: -36 },
  { id: 'fortress', name: 'Old Town (fortress plaza)', x: -47, z: -39 },
  { id: 'promenade', name: 'Promenade (casino)', x: 35, z: 30 },
  { id: 'cbd', name: 'CBD (skyline plaza)', x: -5.9, z: -5.9 },
  { id: 'boulevard_mid', name: 'Boulevard mid', x: 0, z: 0 },
  { id: 'ring_w', name: 'Ring avenue west', x: -50, z: -42 },
  { id: 'ring_e', name: 'Ring avenue east', x: 50, z: -42 },
  { id: 'commercial', name: 'Commercial ring', x: 0, z: -75 },
  { id: 'residential', name: 'Residential ring', x: 108, z: -40 },
  { id: 'hills', name: 'Hills/villas (funicular base)', x: 0, z: -105 },
  { id: 'lighthouse', name: 'Lighthouse', x: -121, z: 42 },
  { id: 'countryside', name: 'Countryside', x: -124, z: 0 },
  { id: 'quarry', name: 'Quarry', x: 112, z: -96 },
];

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__game && window.__gameReady === true, { timeout: 60000 });
await sleep(1500);

const { minimap, lanes } = await page.evaluate(() => ({
  minimap: window.__game.district.minimap.map((s) => ({ x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2, w: s.w })),
  lanes: window.__game.district.lanes.length,
}));
await browser.close();

// --- graph from segment endpoints (same rule as the drivers) ---
const nodes = [];
const nodeOf = new Map();
function nodeFor(x, z) {
  const key = x + ',' + z;
  let ni = nodeOf.get(key);
  if (ni === undefined) {
    ni = nodes.findIndex((n) => Math.hypot(n.x - x, n.z - z) < CLUSTER_R);
    if (ni < 0) { nodes.push({ x, z, adj: new Set(), segs: [] }); ni = nodes.length - 1; }
    nodeOf.set(key, ni);
  }
  return ni;
}
minimap.forEach((s, i) => {
  const a = nodeFor(s.x1, s.z1), b = nodeFor(s.x2, s.z2);
  if (a !== b) { nodes[a].adj.add(b); nodes[b].adj.add(a); nodes[a].segs.push(i); nodes[b].segs.push(i); }
  else nodes[a].segs.push(i); // degenerate: both ends in one cluster
});

// --- connected components ---
const compOf = new Array(nodes.length).fill(-1);
const comps = [];
for (let i = 0; i < nodes.length; i++) {
  if (compOf[i] >= 0) continue;
  const ci = comps.length; const q = [i]; compOf[i] = ci;
  const members = [];
  while (q.length) { const n = q.shift(); members.push(n); for (const m of nodes[n].adj) if (compOf[m] < 0) { compOf[m] = ci; q.push(m); } }
  const segSet = new Set(); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const n of members) {
    for (const si of nodes[n].segs) segSet.add(si);
    x0 = Math.min(x0, nodes[n].x); x1 = Math.max(x1, nodes[n].x);
    z0 = Math.min(z0, nodes[n].z); z1 = Math.max(z1, nodes[n].z);
  }
  comps.push({ id: ci, nodes: members.length, segments: segSet.size, segIds: [...segSet].sort((a, b) => a - b), bbox: { x0, x1, z0, z1 } });
}
const segComp = new Array(minimap.length).fill(-1);
minimap.forEach((s, i) => { segComp[i] = compOf[nodeFor(s.x1, s.z1)]; });

// --- near-miss endpoint pairs across components ---
const endpoints = [];
minimap.forEach((s, i) => { endpoints.push({ x: s.x1, z: s.z1, seg: i }); endpoints.push({ x: s.x2, z: s.z2, seg: i }); });
const nearMiss = [];
for (let a = 0; a < endpoints.length; a++) {
  for (let b = a + 1; b < endpoints.length; b++) {
    if (segComp[endpoints[a].seg] === segComp[endpoints[b].seg]) continue;
    const d = Math.hypot(endpoints[a].x - endpoints[b].x, endpoints[a].z - endpoints[b].z);
    if (d <= NEAR_MISS_R) nearMiss.push({ d: +d.toFixed(2), a: endpoints[a], b: endpoints[b], compA: segComp[endpoints[a].seg], compB: segComp[endpoints[b].seg] });
  }
}
nearMiss.sort((p, q) => p.d - q.d);

// --- geometric crossings/touches across components (false breaks) ---
// Segment-segment intersection (incl. endpoint-on-segment T touches).
function segIntersect(s1, s2, tol = 0.6) {
  const d = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const onSeg = (px, pz, ax, az, bx, bz) => {
    const cross = Math.abs(d(ax, az, bx, bz, px, pz));
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) return Math.hypot(px - ax, pz - az) <= tol;
    if (cross / len > tol) return false;
    const t = ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / (len * len);
    return t >= -0.02 && t <= 1.02;
  };
  const d1 = d(s2.x1, s2.z1, s2.x2, s2.z2, s1.x1, s1.z1);
  const d2 = d(s2.x1, s2.z1, s2.x2, s2.z2, s1.x2, s1.z2);
  const d3 = d(s1.x1, s1.z1, s1.x2, s1.z2, s2.x1, s2.z1);
  const d4 = d(s1.x1, s1.z1, s1.x2, s1.z2, s2.x2, s2.z2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  // T-touch: an endpoint of one segment lies on the other.
  return onSeg(s1.x1, s1.z1, s2.x1, s2.z1, s2.x2, s2.z2) || onSeg(s1.x2, s1.z2, s2.x1, s2.z1, s2.x2, s2.z2)
    || onSeg(s2.x1, s2.z1, s1.x1, s1.z1, s1.x2, s1.z2) || onSeg(s2.x2, s2.z2, s1.x1, s1.z1, s1.x2, s1.z2);
}
const crossings = [];
for (let i = 0; i < minimap.length; i++) {
  for (let j = i + 1; j < minimap.length; j++) {
    if (segComp[i] === segComp[j]) continue;
    if (segIntersect(minimap[i], minimap[j])) {
      crossings.push({ segA: i, segB: j, compA: segComp[i], compB: segComp[j],
        a: { x1: minimap[i].x1, z1: minimap[i].z1, x2: minimap[i].x2, z2: minimap[i].z2 },
        b: { x1: minimap[j].x1, z1: minimap[j].z1, x2: minimap[j].x2, z2: minimap[j].z2 } });
    }
  }
}

// --- zone reachability from the harbor's component ---
function nearestSeg(x, z) {
  let best = -1, bd = Infinity;
  minimap.forEach((s, i) => {
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1, len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((x - s.x1) * dx + (z - s.z1) * dz) / len2)) : 0;
    const d = Math.hypot(x - (s.x1 + t * dx), z - (s.z1 + t * dz));
    if (d < bd) { bd = d; best = i; }
  });
  return { seg: best, dist: +bd.toFixed(2), comp: segComp[best] };
}
const harborComp = nearestSeg(ZONES[0].x, ZONES[0].z).comp;
const zoneReach = ZONES.map((zn) => ({ ...zn, ...nearestSeg(zn.x, zn.z), inHarborComp: nearestSeg(zn.x, zn.z).comp === harborComp }));

// --- BFS shortest paths between zone anchors (on the node graph) ---
function bfsPath(a, b) {
  const prev = new Array(nodes.length).fill(-1);
  const q = [a]; prev[a] = a;
  while (q.length) {
    const n = q.shift();
    if (n === b) break;
    for (const m of nodes[n].adj) if (prev[m] < 0) { prev[m] = n; q.push(m); }
  }
  if (prev[b] < 0) return null;
  const path = []; let n = b;
  while (n !== a) { path.unshift(n); n = prev[n]; }
  path.unshift(a);
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(nodes[path[i]].x - nodes[path[i - 1]].x, nodes[path[i]].z - nodes[path[i - 1]].z);
  return { hops: path.length - 1, length: +len.toFixed(1), gameSeconds: +(len / CITY_SPEED).toFixed(1), headlessRealSeconds: +(len / CITY_SPEED * 5).toFixed(0) };
}
function nearestNode(x, z) {
  let best = -1, bd = Infinity;
  nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = i; } });
  return { node: best, dist: +bd.toFixed(2) };
}
const driveTimes = [];
for (let i = 0; i < ZONES.length; i++) {
  for (let j = i + 1; j < ZONES.length; j++) {
    const a = nearestNode(ZONES[i].x, ZONES[i].z), b = nearestNode(ZONES[j].x, ZONES[j].z);
    const p = bfsPath(a.node, b.node);
    driveTimes.push({ from: ZONES[i].id, to: ZONES[j].id, ...(p || { reachable: false }) });
  }
}
const reachablePairs = driveTimes.filter((d) => d.length !== undefined);
const longest = reachablePairs.sort((a, b) => b.length - a.length)[0] || null;

const out = {
  generated: new Date().toISOString(),
  segments: minimap.length, lanes, nodes: nodes.length,
  components: comps.length,
  harborComponent: harborComp,
  componentsDetail: comps,
  nearMiss: nearMiss.slice(0, 60),
  nearMissCount: nearMiss.length,
  crossings,
  crossingsCount: crossings.length,
  zones: zoneReach,
  allZonesOneComponent: zoneReach.every((z) => z.inHarborComp),
  driveTimes, longest,
};
await writeFile('/tmp/connectivity.json', JSON.stringify(out, null, 2));

console.log(`minimap segments: ${minimap.length}  lanes: ${lanes}  graph nodes: ${nodes.length}`);
console.log(`COMPONENTS: ${comps.length}`);
for (const c of comps) console.log(`  comp ${c.id}: ${c.segments} segments, ${c.nodes} nodes, bbox x ${c.bbox.x0}..${c.bbox.x1} z ${c.bbox.z0}..${c.bbox.z1}`);
console.log(`harbor component: ${harborComp}`);
console.log(`near-miss endpoint pairs (<= ${NEAR_MISS_R}u, across components): ${nearMiss.length}`);
for (const p of nearMiss.slice(0, 25)) console.log(`  ${p.d}u: seg ${p.a.seg} (${p.a.x},${p.a.z}) comp ${p.compA} <-> seg ${p.b.seg} (${p.b.x},${p.b.z}) comp ${p.compB}`);
console.log(`geometric crossings/touches across components (false breaks): ${crossings.length}`);
for (const c of crossings.slice(0, 25)) console.log(`  seg ${c.segA} comp ${c.compA} x seg ${c.segB} comp ${c.compB}`);
console.log('ZONES:');
for (const z of zoneReach) console.log(`  ${z.id}: nearest seg ${z.seg} (${z.dist}u away) comp ${z.comp} ${z.inHarborComp ? 'OK' : 'SPLIT'}`);
console.log(`ALL ZONES ONE COMPONENT: ${out.allZonesOneComponent}`);
if (longest) console.log(`longest drive: ${longest.from} -> ${longest.to}: ${longest.length}u, ${longest.gameSeconds}s game-time (~${longest.headlessRealSeconds}s headless real)`);
console.log(out.allZonesOneComponent && comps.length === 1 ? 'CONNECTIVITY PASS' : 'CONNECTIVITY FAIL — graph is split');
process.exit(out.allZonesOneComponent && comps.length === 1 ? 0 : 1);
