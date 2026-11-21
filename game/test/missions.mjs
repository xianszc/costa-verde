// COSTA VERDE missions REGRESSION test (Xian 21 Nov 20:48, order item 1).
// Plays missions 1-9 (run A) and 6-12 (run B) end-to-end in headless
// Chromium on the LIVE no-cache server 127.0.0.1:8941 (already
// running — never 8940). Drives the real game loop: teleport to the
// objective, KeyE for interact stages, follow the tail, wait out the
// wanted level on escapes, damage() the M12 duel target. Save/load is
// checked first in run A via the pause menu (#pause-save / #pause-load,
// slot 1) with an exact-match sentinel (7777 / 1234 / M5).
//
// RUN THIS AFTER EVERY LAYOUT CHANGE (and before submit): a layout
// change that moves an anchor, blocks a road, or slows the game can
// silently break a mission. Exit 0 = all missions PASS (12/12).
// Takes ~30 min in headless (the game runs at ~20% speed there, so
// M2's 20 s tail timer and M9's heat decay need ~350 s real each).
//
// Usage: NODE_PATH=/tmp/node_modules node game/test/missions.mjs
//   (NODE_PATH must resolve playwright-core from the Playwright
//   connector; the 8941 server must already be running. ESM does not
//   read NODE_PATH, so Playwright is loaded via createRequire, which
//   does — see the import below.)
// Writes /tmp/missions-regression.json. Exit 0 = all missions PASS.
//
// POSITION TRACE (Xian 21 Nov 23:04, item 4): every 5 s and at every
// timeout the driver logs `[trace]` / `[trace-timeout]` lines with
// the stage, player + car + target positions, distances to the
// objective and the wanted level. A timeout without a trace is not
// an acceptable result.
//
// Causes of the 21 Nov failures — FIXED IN THE GAME (21 Nov 21:31
// order), NOT in this driver. The driver now plays M2/M9 like a human
// (drives the car, no teleport, no on-foot dodge), per the 21:34
// standing rule. Report category: pass (human-like).
// - M2 TAIL: the tail timer DECAYED (0.5/s) whenever the player fell
//   out of the 18 m range, so a bump that knocked the player's car
//   out of range erased the tail progress and the mission never
//   completed. GAME FIX (missions.js): the timer HOLDS when out of
//   range — catch up to resume it. The smuggler's car is a visual
//   mesh (not a collider), so the player's car can touch it without
//   shoving it. Driver: enters the car, drives behind the smuggler
//   (autopilot, speed matched to the smuggler's 6 u/s when close),
//   no teleport.
// - M9 LAY LOW: Guard rams on the player's car called addHeat(5),
//   which RESET the quiet timer, so the heat never decayed and the
//   escape never completed. GAME FIX (game.js onRam): during an
//   escape stage a ram adds NO heat (the player is laying low; the
//   ram still damages the car). Skipping addHeat also leaves the
//   quiet timer running, so the heat decays at 2.5/s after 5 s
//   quiet. Driver: plays the escape IN THE CAR at the safehouse,
//   drives back if a ram pushes it out, no teleport, no on-foot.
// - Both: the 240 s deadline was too short once the expansion slowed
//   the headless game. Fix: 480 s per attempt.
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8941';
const CHROMIUM = '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RUNS = [
  { key: 'M1-M9', ids: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  { key: 'M6-M12', ids: [5, 6, 7, 8, 9, 10, 11] },
];

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});

const out = { generated: new Date().toISOString(), runs: {} };

async function readState(page) {
  return page.evaluate(() => {
    const g = window.__game;
    const m = g.missions;
    const o = m.objective();
    return {
      done: m.done,
      missionId: m.missionId,
      stage: m.stage,
      stageType: m.stageDef() ? m.stageDef().type : null,
      stageName: m.stageDef() ? m.stageDef().name : null,
      objective: o,
      wanted: g.wanted.level,
      money: g.state.money,
      xp: g.state.xp,
      onFoot: g.state.onFoot,
      px: g.player.x, pz: g.player.z,
      cx: g.car.x, cz: g.car.z,
      duel: !!g.duelTarget,
      duelFallen: g.duelTarget ? g.duelTarget.fallen : null,
      mode: g.state.mode,
    };
  });
}

async function teleport(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.player.x = x; g.player.z = z;
    g.car.x = x; g.car.z = z;
    g.car.mesh.position.set(x, 0, z);
  }, { x, z });
}

// --- Realistic car autopilot (human-like: keyboard driving, no
// teleport). The car steers toward a target point and throttles to a
// speed cap; if it stops making progress it reverses out and retries.
function normAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

async function readCar(page) {
  return page.evaluate(() => {
    const g = window.__game;
    return { x: g.car.x, z: g.car.z, angle: g.car.angle, speed: g.car.speed, onFoot: g.state.onFoot, mode: g.state.mode };
  });
}
async function setKeys(page, { w, a, d, s }) {
  const want = { KeyW: !!w, KeyA: !!a, KeyD: !!d, KeyS: !!s };
  for (const [code, down] of Object.entries(want)) {
    if (down) await page.keyboard.down(code); else await page.keyboard.up(code);
  }
}
async function releaseKeys(page) { await setKeys(page, {}); }

// Drive the car to a fixed point (tx, tz) within radius r. Returns
// true when reached. Steers toward the point, throttles to cap u/s,
// reverses out if stuck (no progress 8 s, max 3 reverses).
async function driveToPoint(page, tx, tz, r, cap, timeoutMs) {
  const started = Date.now();
  let lastDist = Infinity, lastProgress = Date.now(), reverses = 0, reversingUntil = 0;
  while (Date.now() - started < timeoutMs) {
    const c = await readCar(page);
    if (c.mode !== 'play') { await releaseKeys(page); return false; }
    const d = Math.hypot(c.x - tx, c.z - tz);
    if (d < r) { await releaseKeys(page); return true; }
    if (d < lastDist - 0.5) { lastDist = d; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 20000) { await releaseKeys(page); return false; }
    if (Date.now() < reversingUntil) { await sleep(300); continue; }
    if (Date.now() - lastProgress > 8000 && reverses < 3) {
      reverses++;
      const desired = Math.atan2(-(tz - c.z), tx - c.x);
      const diff = normAngle(desired - c.angle);
      await setKeys(page, { s: true, a: diff > 0, d: diff <= 0 });
      reversingUntil = Date.now() + 2000;
      lastProgress = Date.now();
      await sleep(300);
      continue;
    }
    const desired = Math.atan2(-(tz - c.z), tx - c.x);
    const diff = normAngle(desired - c.angle);
    await setKeys(page, { w: Math.abs(c.speed) < cap, a: diff > 0.15, d: diff < -0.15, s: false });
    await sleep(300);
  }
  await releaseKeys(page);
  return false;
}

// Follow the smuggler (M2 TAIL) in the car until the tail stage ends
// (stageType leaves 'tail') or the timeout. The smuggler drives the
// boulevard at 6 u/s; the car matches ~6 u/s when close (so it stays
// behind it instead of overshooting) and up to 12 u/s when far.
// The car starts at the marina — a straight-line steer to the
// boulevard gets stuck on buildings, so FIRST route onto the
// boulevard along the roads (BFS on the minimap graph), then follow
// greedily (both cars are on the same straight road from there).
async function followTail(page, timeoutMs) {
  const started = Date.now();
  // Phase 1: route onto the boulevard (BFS) if the car is far from
  // the smuggler. The smuggler moves, so route to where it is now;
  // the greedy follow takes over once the car is close.
  {
    const s = await readState(page);
    if (s.stageType === 'tail' && roadGraph) {
      const o = s.objective;
      const d0 = Math.hypot(s.cx - o.x, s.cz - o.z);
      if (d0 > 25) {
        const from = roadGraph.nearestNode(s.cx, s.cz);
        const to = roadGraph.nearestNode(o.x, o.z);
        const pathIdx = roadGraph.bfs(from.node, to.node);
        if (pathIdx) {
          const wps = pathIdx.map((i) => ({ x: roadGraph.nodes[i].x, z: roadGraph.nodes[i].z }));
          const thin = [wps[0]];
          for (const p of wps) if (Math.hypot(thin[thin.length - 1].x - p.x, thin[thin.length - 1].z - p.z) > 6) thin.push(p);
          for (const wp of thin) {
            const ok = await driveToPoint(page, wp.x, wp.z, 4, 12, 30000);
            if (!ok) break;
            const s2 = await readState(page);
            if (s2.stageType !== 'tail') { await releaseKeys(page); return true; }
            const d2 = Math.hypot(s2.cx - s2.objective.x, s2.cz - s2.objective.z);
            if (d2 < 25) break; // close enough — greedy follow takes over
          }
        }
      }
    }
  }
  // Phase 2: greedy follow (both cars on the boulevard, a straight road).
  let lastD = Infinity, lastProgress = Date.now(), reverses = 0, reversingUntil = 0;
  while (Date.now() - started < timeoutMs) {
    const s = await readState(page);
    if (s.stageType !== 'tail') { await releaseKeys(page); return true; }
    if (s.mode !== 'play') { await releaseKeys(page); return false; }
    const o = s.objective;
    const c = { x: s.cx, z: s.cz };
    const car = await readCar(page);
    const d = Math.hypot(c.x - o.x, c.z - o.z);
    if (d < lastD - 0.5) { lastD = d; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 20000) { await releaseKeys(page); return false; }
    if (Date.now() < reversingUntil) { await sleep(300); continue; }
    if (Date.now() - lastProgress > 8000 && reverses < 3) {
      reverses++;
      const desired = Math.atan2(-(o.z - c.z), o.x - c.x);
      const diff = normAngle(desired - car.angle);
      await setKeys(page, { s: true, a: diff > 0, d: diff <= 0 });
      reversingUntil = Date.now() + 2000;
      lastProgress = Date.now();
      await sleep(300);
      continue;
    }
    const desired = Math.atan2(-(o.z - c.z), o.x - c.x);
    const diff = normAngle(desired - car.angle);
    const cap = d > 10 ? 12 : 6;
    await setKeys(page, { w: Math.abs(car.speed) < cap, a: diff > 0.15, d: diff < -0.15, s: false });
    await sleep(300);
  }
  await releaseKeys(page);
  return false;
}

// --- Road routing (BFS on the minimap centerlines) ---
// The greedy autopilot (driveToPoint) cannot navigate around
// buildings over a long distance — a human follows the roads. The
// escape stages need the car driven to a target that can be far
// away (M1: marina -> boulevard_mid, M3/M5 -> boulevard, M4/M6 ->
// marina, M10 -> quay), so the driver routes along the road network
// (the same minimap graph as the route test). Built once per page.
let roadGraph = null; // { nodes, bfs, nearestNode, segments }
async function buildRoadGraph(page) {
  const segments = await page.evaluate(() => window.__game.district.minimap.map((s) => ({ x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2 })));
  const nodes = [];
  const nodeOf = new Map();
  function nodeFor(x, z) {
    const key = x + ',' + z;
    let ni = nodeOf.get(key);
    if (ni === undefined) {
      ni = nodes.findIndex((n) => Math.hypot(n.x - x, n.z - z) < 4);
      if (ni < 0) { nodes.push({ x, z, adj: new Set() }); ni = nodes.length - 1; }
      nodeOf.set(key, ni);
    }
    return ni;
  }
  for (const s of segments) {
    const a = nodeFor(s.x1, s.z1);
    const b = nodeFor(s.x2, s.z2);
    if (a !== b) { nodes[a].adj.add(b); nodes[b].adj.add(a); }
  }
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
  return { nodes, bfs, nearestNode, segments: segments.length };
}

// One position-trace line: stage, player + car + target positions,
// distances to the objective (units; 1 unit = 10 m), wanted level.
// `tag` is 'trace' (every 5 s) or 'trace-timeout' (at timeout).
function traceLine(label, s, tag) {
  const o = s.objective;
  if (!o) { console.log(`[${tag}] ${label} stage=${s.stage} ${s.stageName || s.stageType || ''} no objective`); return; }
  const dp = Math.hypot(s.px - o.x, s.pz - o.z);
  const dc = Math.hypot(s.cx - o.x, s.cz - o.z);
  console.log(`[${tag}] ${label} stage=${s.stage} ${s.stageName || s.stageType} player=(${s.px.toFixed(1)},${s.pz.toFixed(1)}) car=(${s.cx.toFixed(1)},${s.cz.toFixed(1)}) target=(${o.x},${o.z}) distPlayer=${dp.toFixed(1)}u distCar=${dc.toFixed(1)}u wanted=${s.wanted} onFoot=${s.onFoot}`);
}

async function playMission(page, id, label) {
  const started = Date.now();
  let attempts = 0;
  let fails = 0;
  let maxStage = 0;
  while (attempts < 2) {
    attempts += 1;
    await page.evaluate((mid) => { window.__game.missions.start(mid); }, id);
    await sleep(800);
    // Play IN THE CAR for the tail and the escape (human-like,
    // 21:31 game fix + 21:34 rule). Other stages (goto / deliver /
    // interact / race) still teleport to the checkpoint as a test
    // convenience — they do not dodge a bug, and the M2/M9 stages
    // under test here are driven, not teleported.
    let lastStage = 0;
    let lastTrace = 0; // position trace cadence (item 4 below)
    // Deadline is REAL time; the game runs at ~20% speed in headless
    // (swiftshader + dt clamp), so a 20 s game timer needs ~100 s
    // real and the M9 heat decay ~110-240 s real. The A-C run passed
    // at 240 s when the city was smaller/faster; the expansion pushed
    // M2/M9 just past it. 480 s gives margin; the missions are
    // completable (probe: tailTimer and heat both move steadily).
    const deadline = Date.now() + 480000;
    let result = null;
    while (Date.now() < deadline) {
      const s = await readState(page);
      // Completion: the engine auto-starts the NEXT mission on
      // complete (done is true only transiently, inside the same
      // synchronous handleMissionEvent call) — so for M1-M11, PASS
      // is missionId advancing past id; for M12 (the last) done
      // stays true because there is no next mission to start.
      if (id < 11 && s.missionId > id) { result = 'PASS'; break; }
      if (id === 11 && s.done) { result = 'PASS'; break; }
      if (s.stage > maxStage) maxStage = s.stage;
      // BUSTED: the mode leaves 'play' (pursuers caught the on-foot
      // player) — missions.update stops, so the mission can never
      // complete from here. Count it as a fail and retry once.
      if (s.mode && s.mode !== 'play') { fails += 1; result = 'FAIL-EVENT'; break; }
      // A fail restarts the SAME mission (stage drops back to 0).
      if (s.missionId === id && s.stage === 0 && lastStage > 0) { fails += 1; result = 'FAIL-EVENT'; break; }
      lastStage = s.stage;
      // POSITION TRACE (Xian 21 Nov 23:04, item 4): player + target
      // positions and distance to the objective every 5 s, and at
      // timeout (see below). A timeout without a trace is not an
      // acceptable result. This is driver instrumentation only — it
      // changes no gameplay and dodges no bug.
      if (Date.now() - lastTrace >= 5000) {
        lastTrace = Date.now();
        traceLine(label, s, 'trace');
      }
      const o = s.objective;
      if (!o) { await sleep(500); continue; }
      if (s.stageType === 'interact') {
        await teleport(page, o.x, o.z);
        await sleep(300);
        await page.keyboard.press('KeyE');
        await sleep(600);
      } else if (s.stageType === 'tail') {
        // TAIL IN THE CAR (human-like, 21:31 game fix + 21:34 rule):
        // enter the car, then drive behind the smuggler. No teleport,
        // no on-foot dodge. The smuggler drives the boulevard at
        // 6 u/s; followTail matches speed when close (6 u/s) and
        // catches up at 12 u/s when far. The game fix (timer holds
        // instead of decaying) means a bump that drops the player out
        // of range only pauses the tail — it is resumed by catching up.
        // Enter the car. E can be consumed by a stage dialogue, so
        // press it up to 3 times (waiting each time) and, as a last
        // resort, put the player in the car directly — the player is
        // standing next to their own car at the marina, so getting
        // in is not dodging anything.
        for (let tries = 0; tries < 3; tries++) {
          const sc = await readState(page);
          if (!sc.onFoot) break;
          await page.keyboard.press('KeyE');
          await sleep(700);
        }
        {
          const sc = await readState(page);
          if (sc.onFoot) {
            await page.evaluate(() => { window.__game.state.onFoot = false; });
            await sleep(300);
          }
        }
        await followTail(page, 300000);
        await sleep(400);
      } else if (s.stageType === 'duel') {
        if (s.duel) {
          await page.evaluate(() => { window.__game.duelTarget.damage(200); });
          await sleep(800);
        } else {
          await sleep(500);
        }
      } else if (s.stageType === 'escape') {
        // ESCAPE IN THE CAR (human-like, 21:31 game fix + 21:34
        // rule): the player is already at the safehouse for M9 (the
        // RUN stage brought the car here), but other escapes need a
        // drive (M1 marina -> boulevard_mid, M3/M5 -> boulevard,
        // M4/M6 -> marina, M10 -> quay). A human follows the roads,
        // so the driver routes along the road network (BFS on the
        // minimap graph) and drives waypoint to waypoint. Then sit
        // in the car while the heat decays — the game fix means
        // Guard rams add no heat during an escape, so the heat falls
        // at 2.5/s after 5 s quiet. If a ram shoves the car out of
        // the safehouse, drive it back. No teleport, no on-foot.
        // Enter the car (E can be consumed by a stage dialogue — press
        // up to 3 times; last resort, put the player in directly —
        // the player is standing next to their own car).
        for (let tries = 0; tries < 3; tries++) {
          const sc = await readState(page);
          if (!sc.onFoot) break;
          await page.keyboard.press('KeyE');
          await sleep(700);
        }
        {
          const sc = await readState(page);
          if (sc.onFoot) {
            await page.evaluate(() => { window.__game.state.onFoot = false; });
            await sleep(300);
          }
        }
        const cd = Math.hypot(s.cx - o.x, s.cz - o.z);
        if (cd > (o.r || 5)) {
          let routed = false;
          if (roadGraph) {
            const from = roadGraph.nearestNode(s.cx, s.cz);
            const to = roadGraph.nearestNode(o.x, o.z);
            const pathIdx = roadGraph.bfs(from.node, to.node);
            if (pathIdx) {
              routed = true;
              const wps = pathIdx.map((i) => ({ x: roadGraph.nodes[i].x, z: roadGraph.nodes[i].z }));
              wps.push({ x: o.x, z: o.z });
              const thin = [wps[0]];
              for (const p of wps) if (Math.hypot(thin[thin.length - 1].x - p.x, thin[thin.length - 1].z - p.z) > 6) thin.push(p);
              if (Math.hypot(thin[thin.length - 1].x - o.x, thin[thin.length - 1].z - o.z) > 1) thin.push({ x: o.x, z: o.z });
              for (const wp of thin) {
                const ok = await driveToPoint(page, wp.x, wp.z, 4, 10, 30000);
                if (!ok) break;
                const s3 = await readState(page);
                if (s3.stageType !== 'escape') break;
              }
            }
          }
          if (!routed) {
            // No road path (or no graph) — drive straight at it.
            await driveToPoint(page, o.x, o.z, o.r || 5, 10, 60000);
          }
        }
        await sleep(1000);
      } else {
        // goto / deliver / race: teleport to the checkpoint. Races
        // need the player driving: enter the car with E first.
        if (s.stageType === 'race' && s.onFoot) {
          await teleport(page, s.cx, s.cz);
          await sleep(300);
          await page.keyboard.press('KeyE');
          await sleep(600);
          const s2 = await readState(page);
          if (s2.onFoot) {
            await page.evaluate(() => { window.__game.state.onFoot = false; });
          }
        }
        await teleport(page, o.x, o.z);
        await sleep(400);
      }
    }
    if (result === 'PASS') {
      const s = await readState(page);
      return { mission: label, result: 'PASS', attempts, fails, maxStage, ms: Date.now() - started, money: s.money, xp: s.xp };
    }
    if (result === 'FAIL-EVENT') continue; // retry once from scratch
    // Timeout: final trace with a fresh state read.
    traceLine(label, await readState(page), 'trace-timeout');
    return { mission: label, result: 'TIMEOUT', attempts, fails, maxStage, ms: Date.now() - started };
  }
  return { mission: label, result: 'FAIL', attempts, fails, maxStage, ms: Date.now() - started };
}

for (const run of RUNS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('page: ' + String(e)));
  const runOut = { missions: [], errors };
  console.log(`--- run ${run.key} ---`);
  try {
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__game && window.__gameReady === true, { timeout: 60000 });
    await sleep(2000);
    await page.evaluate(() => window.__game.startPlay());
    await sleep(2000);
    // Road graph for the escape stages (BFS routing along the roads).
    try {
      roadGraph = await buildRoadGraph(page);
      console.log(`road graph: ${roadGraph.nodes.length} nodes, ${roadGraph.segments} segments`);
    } catch (e) {
      console.log(`road graph: FAILED ${String(e).slice(0, 120)} (escapes fall back to straight-line driving)`);
      roadGraph = null;
    }

    if (run.key === 'M1-M9') {
      // Save/load exact-match check first (wanted is 0 at start).
      // g.doSave/doLoad are NOT on window.__game (main.js overwrites
      // it with the factory return) — use the pause menu buttons
      // (#pause-save / #pause-load, slot 1) instead. Non-fatal: a
      // save/load failure is recorded, the missions still play.
      let sl = { saved: false, loaded: false, money: -1, xp: -1, missionId: -1 };
      let slPass = false;
      try {
        await page.evaluate(() => {
          const g = window.__game;
          g.state.money = 7777; g.state.xp = 1234;
          g.missions.start(4); // M5
        });
        await sleep(500);
        await page.keyboard.press('Escape');
        await sleep(600);
        await page.click('#pause-save');
        await sleep(600);
        await page.keyboard.press('Escape');
        await sleep(500);
        await page.evaluate(() => {
          const g = window.__game;
          g.state.money = 0; g.state.xp = 0;
        });
        await page.keyboard.press('Escape');
        await sleep(600);
        await page.click('#pause-load');
        await sleep(600);
        await page.keyboard.press('Escape');
        await sleep(500);
        sl = await page.evaluate(() => {
          const g = window.__game;
          return { saved: true, loaded: true, money: g.state.money, xp: g.state.xp, missionId: g.missions.missionId };
        });
        slPass = sl.money === 7777 && sl.xp === 1234 && sl.missionId === 4;
      } catch (e) {
        console.log(`save/load: ERROR ${String(e).slice(0, 200)}`);
      }
      console.log(`save/load: ${slPass ? 'PASS' : 'FAIL'} (money=${sl.money} xp=${sl.xp} missionId=${sl.missionId})`);
      runOut.saveLoad = { ...sl, pass: slPass };
    }

    for (const id of run.ids) {
      const label = `M${id + 1}`;
      const r = await playMission(page, id, label);
      runOut.missions.push(r);
      console.log(`${label}: ${r.result} (attempts=${r.attempts} fails=${r.fails} maxStage=${r.maxStage} ${Math.round(r.ms / 1000)}s money=${r.money ?? '-'} xp=${r.xp ?? '-'})`);
    }
    const end = await readState(page);
    runOut.final = { money: end.money, xp: end.xp };
    console.log(`run ${run.key} final: money=${end.money} xp=${end.xp} errors=${errors.length}`);
    if (errors.length) console.log('  ERRORS: ' + errors.slice(0, 5).join(' | '));
  } catch (e) {
    console.log(`run ${run.key} FAILED: ${String(e).slice(0, 300)}`);
    runOut.error = String(e).slice(0, 300);
  } finally {
    await page.close();
  }
  out.runs[run.key] = runOut;
}

const allPass = Object.values(out.runs).every((r) =>
  r.missions && r.missions.every((m) => m.result === 'PASS') && (r.saveLoad ? r.saveLoad.pass : true));
await writeFile('/tmp/missions-regression.json', JSON.stringify(out, null, 2));
console.log(allPass ? 'ALL MISSIONS PASS' : 'SOME MISSIONS FAILED — see /tmp/missions-regression.json');
await browser.close();
process.exit(allPass ? 0 : 1);
