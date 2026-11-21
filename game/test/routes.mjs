// COSTA VERDE route / connectivity test (Xian 21 Nov 20:48, order item 2).
// Proves the map is connected by DRIVING the player car from the harbor
// to every zone and back — no dead ends, no blocked roads, no cars stuck.
//
// Method: reads the 24 traffic lanes (window.__game.district.lanes,
// polylines the traffic cars follow), builds a graph by clustering
// lane points within 2.5 units, BFS the shortest path from the harbor
// to each zone's nearest lane point, then drives the car along the path
// with a keyboard autopilot (W throttle, A/D steering, S reverse when
// stuck). Zones off the lane network get a short off-road hop from the
// nearest lane point to the anchor; if the car cannot reach the anchor,
// the zone is reported as a GAP (fix: add a road/lane).
//
// Zones: marina (harbor, the start), old town, promenade, CBD,
// commercial ring, residential ring, hills + villas (funicular base —
// the terraces themselves are pedestrian), lighthouse, countryside,
// quarry. Reports per-zone: reachable, drive time (real), path length,
// and the longest route. Exit 0 = every zone reachable there and back.
//
// Usage: NODE_PATH=/tmp/node_modules node game/test/routes.mjs
//   (NODE_PATH must resolve playwright-core; the 8941 server must
//   already be running. ESM does not read NODE_PATH, so Playwright is
//   loaded via createRequire, which does.)
// Writes /tmp/routes.json. Exit 0 = all zones reachable.
// Takes ~15-20 min in headless (the game runs at ~20% speed there).
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8941';
const CHROMIUM = '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const normAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// Zone targets (anchors; the harbor is the start, at the marina).
// hills/villas = the funicular base (the terraces are pedestrian);
// lighthouse + quarry are off the lane network (short off-road hop).
const ZONES = [
  { id: 'marina', name: 'Marina (harbor)', x: 3, z: 26 },
  { id: 'oldtown', name: 'Old Town', x: -47, z: -39 },
  { id: 'promenade', name: 'Promenade', x: 35, z: 29 },
  { id: 'cbd', name: 'CBD', x: -5.9, z: -5.9 },
  { id: 'commercial', name: 'Commercial Ring', x: 0, z: -75 },
  { id: 'residential', name: 'Residential Ring', x: 108, z: -40 },
  { id: 'hills', name: 'Hills + Villas (funicular base)', x: 0, z: -105 },
  { id: 'lighthouse', name: 'Lighthouse', x: -121, z: 42 },
  { id: 'countryside', name: 'Countryside', x: -124, z: 0 },
  { id: 'quarry', name: 'Quarry', x: 112, z: -96 },
];
const HARBOR = { x: 3, z: 20 }; // quay road by the pavilion

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('page: ' + String(e)));
await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__game && window.__gameReady === true, { timeout: 60000 });
await sleep(1500);
await page.evaluate(() => window.__game.startPlay());
await sleep(1500);

// --- build the lane graph (cluster points within 2.5) ---
const lanes = await page.evaluate(() => window.__game.district.lanes.map((l) => ({ name: l.name, pts: l.pts })));
console.log(`lanes: ${lanes.length}`);
// nodes: cluster all lane points
const nodes = []; // {x, z, lanes:Set}
const nodeOf = new Map(); // point index -> node index (per lane, per point)
for (const lane of lanes) {
  for (const p of lane.pts) {
    let ni = nodes.findIndex((n) => Math.hypot(n.x - p.x, n.z - p.z) < 2.5);
    if (ni < 0) { nodes.push({ x: p.x, z: p.z, adj: new Set() }); ni = nodes.length - 1; }
    nodeOf.set(lane.name + ':' + p.x + ',' + p.z, ni);
  }
}
// edges: consecutive points in each lane
for (const lane of lanes) {
  for (let i = 0; i + 1 < lane.pts.length; i++) {
    const a = nodeOf.get(lane.name + ':' + lane.pts[i].x + ',' + lane.pts[i].z);
    const b = nodeOf.get(lane.name + ':' + lane.pts[i + 1].x + ',' + lane.pts[i + 1].z);
    if (a !== undefined && b !== undefined && a !== b) { nodes[a].adj.add(b); nodes[b].adj.add(a); }
  }
}
console.log(`graph: ${nodes.length} nodes`);
// BFS shortest path (node indices) from a to b
function bfs(a, b) {
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
  return path;
}
function nearestNode(x, z) {
  let best = -1, bd = Infinity;
  nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = i; } });
  return { node: best, dist: bd };
}

async function readCar() {
  return page.evaluate(() => {
    const g = window.__game;
    return { x: g.car.x, z: g.car.z, angle: g.car.angle, speed: g.car.speed, onFoot: g.state.onFoot, mode: g.state.mode };
  });
}
async function setKeys({ w, a, d, s }) {
  // Set the held keys to exactly this combination.
  const want = { KeyW: !!w, KeyA: !!a, KeyD: !!d, KeyS: !!s };
  for (const [code, down] of Object.entries(want)) {
    if (down) await page.keyboard.down(code); else await page.keyboard.up(code);
  }
}
async function releaseKeys() { await setKeys({}); }

// Drive the car along a list of waypoints [{x,z}]. Returns
// { reached, ms, pathLen, stuck } — reached = got within 4 of the last
// waypoint. Stuck = no progress toward the current waypoint for 20 s
// (after 3 reverse attempts).
async function drivePath(waypoints, label) {
  const started = Date.now();
  let pathLen = 0;
  for (let i = 0; i + 1 < waypoints.length; i++) pathLen += dist(waypoints[i], waypoints[i + 1]);
  let wi = 0;
  let lastDist = Infinity, lastProgress = Date.now(), reverses = 0;
  let reversingUntil = 0;
  while (wi < waypoints.length) {
    const c = await readCar();
    if (c.mode !== 'play') { await releaseKeys(); return { reached: false, ms: Date.now() - started, pathLen, stuck: 'mode-' + c.mode }; }
    const t = waypoints[wi];
    const d = Math.hypot(c.x - t.x, c.z - t.z);
    if (d < 4) { wi++; lastDist = Infinity; lastProgress = Date.now(); continue; }
    if (d < lastDist - 0.5) { lastDist = d; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 20000) {
      await releaseKeys();
      return { reached: false, ms: Date.now() - started, pathLen, stuck: `no-progress at waypoint ${wi} (${t.x},${t.z})` };
    }
    if (Date.now() < reversingUntil) { await sleep(300); continue; }
    if (Date.now() - lastProgress > 8000 && reverses < 3) {
      // Stuck: reverse + steer away for 2 s, then retry.
      reverses++;
      const desired = Math.atan2(-(t.z - c.z), t.x - c.x);
      const diff = normAngle(desired - c.angle);
      await setKeys({ s: true, a: diff > 0, d: diff <= 0 });
      reversingUntil = Date.now() + 2000;
      lastProgress = Date.now();
      await sleep(300);
      continue;
    }
    // Steer toward the waypoint; throttle to ~12 u/s.
    const desired = Math.atan2(-(t.z - c.z), t.x - c.x);
    const diff = normAngle(desired - c.angle);
    await setKeys({
      w: Math.abs(c.speed) < 12,
      a: diff > 0.15,
      d: diff < -0.15,
      s: false,
    });
    await sleep(300);
  }
  await releaseKeys();
  return { reached: true, ms: Date.now() - started, pathLen, stuck: null };
}

// --- enter the car at the harbor ---
await page.evaluate(({ x, z }) => {
  const g = window.__game;
  g.player.x = x; g.player.z = z;
  g.car.x = x; g.car.z = z;
  g.car.mesh.position.set(x, 0, z);
  g.car.angle = Math.PI / 2; // face north up the quay
}, { x: HARBOR.x, z: HARBOR.z });
await sleep(500);
await page.keyboard.press('KeyE');
await sleep(800);
let c0 = await readCar();
console.log(`start: onFoot=${c0.onFoot} car=(${Math.round(c0.x)},${Math.round(c0.z)})`);
if (c0.onFoot) {
  await page.evaluate(() => { window.__game.state.onFoot = false; });
  await sleep(300);
}

const harborNode = nearestNode(HARBOR.x, HARBOR.z);
console.log(`harbor node ${harborNode.node} (dist ${harborNode.dist.toFixed(1)})`);
const results = {};
let longest = { zone: null, ms: 0 };
for (const zone of ZONES) {
  if (zone.id === 'marina') { results[zone.id] = { reachable: true, msOut: 0, msBack: 0, pathLen: 0, note: 'start (harbor)' }; console.log('marina: start (harbor)'); continue; }
  const target = nearestNode(zone.x, zone.z);
  const offRoad = target.dist; // distance from the nearest lane point to the anchor
  const pathIdx = bfs(harborNode.node, target.node);
  if (!pathIdx) {
    results[zone.id] = { reachable: false, reason: 'no lane path from harbor', offRoad };
    console.log(`${zone.id}: UNREACHABLE (no lane path; nearest lane ${offRoad.toFixed(1)} away)`);
    continue;
  }
  // Waypoints: the BFS path points + the anchor itself (off-road hop).
  const waypoints = pathIdx.map((i) => ({ x: nodes[i].x, z: nodes[i].z }));
  waypoints.push({ x: zone.x, z: zone.z });
  // Thin the waypoints (every ~6 units) so the autopilot does not
  // chase points 2 apart.
  const thin = [waypoints[0]];
  for (const p of waypoints) if (dist(thin[thin.length - 1], p) > 6) thin.push(p);
  if (dist(thin[thin.length - 1], waypoints[waypoints.length - 1]) > 1) thin.push(waypoints[waypoints.length - 1]);
  console.log(`${zone.id}: path ${pathIdx.length} nodes, ${thin.length} waypoints, off-road hop ${offRoad.toFixed(1)}`);
  const out = await drivePath(thin, zone.id + ' out');
  // Drive back to the harbor along the reversed path.
  const backWaypoints = [...thin].reverse();
  // The car is at the zone; the reversed path starts there.
  const back = out.reached ? await drivePath(backWaypoints, zone.id + ' back') : { reached: false, ms: 0, pathLen: 0, stuck: 'out leg failed' };
  const ok = out.reached && back.reached;
  results[zone.id] = { reachable: ok, msOut: out.ms, msBack: back.ms, pathLen: out.pathLen, offRoad, stuckOut: out.stuck, stuckBack: back.stuck };
  console.log(`${zone.id}: ${ok ? 'REACHABLE' : 'FAILED'} out=${Math.round(out.ms / 1000)}s back=${Math.round(back.ms / 1000)}s len=${Math.round(out.pathLen)} offRoad=${offRoad.toFixed(1)}${out.stuck ? ' stuckOut=' + out.stuck : ''}${back.stuck ? ' stuckBack=' + back.stuck : ''}`);
  if (ok && out.ms + back.ms > longest.ms) longest = { zone: zone.id, ms: out.ms + back.ms };
}
await releaseKeys();
const allOk = Object.values(results).every((r) => r.reachable);
console.log(`longest route: ${longest.zone} ${Math.round(longest.ms / 1000)}s round trip`);
console.log(`errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
await writeFile('/tmp/routes.json', JSON.stringify({ generated: new Date().toISOString(), lanes: lanes.length, nodes: nodes.length, results, longest, errors }, null, 2));
console.log(allOk ? 'ALL ZONES REACHABLE' : 'SOME ZONES UNREACHABLE — see /tmp/routes.json');
await browser.close();
process.exit(allOk ? 0 : 1);
