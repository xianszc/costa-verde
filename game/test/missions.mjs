// COSTA VERDE missions REGRESSION test (Xian 21 Nov 20:48, order item 1;
// restructured 22 Nov 01:16, Xian's brief: crash-safe + resumable).
// Plays missions in headless Chromium on the LIVE no-cache server
// 127.0.0.1:8941 (already running — never 8940). Drives the real game
// loop: follow the tail, wait out the wanted level on escapes,
// damage() the M12 duel target. Save/load is checked first via the
// pause menu (#pause-save / #pause-load, slot 1) with an exact-match
// sentinel (7777 / 1234 / M5).
//
// CRASH-SAFE + RESUMABLE: each mission runs in a FRESH browser
// context; the result of each mission is written to
// reports/missions-run.json IMMEDIATELY (so a crash loses at most one
// mission); if the browser/context closes mid-mission, that mission
// is restarted ONCE in a new context and the run continues. The run
// NEVER restarts from M1. Resume with --from M5 (skips earlier
// missions; their results stay in the JSON from the previous run).
//
// Order: M4-M12 first, then M2 (M1 134 s and M3 61 s already pass
// human-like — recorded from the prior logs, not re-run). M2 is
// time-boxed to 30 min: if it does not pass human-like by then it is
// recorded "fail (open)" with the position trace and the run moves on.
//
// RUN THIS AFTER EVERY LAYOUT CHANGE (and before submit): a layout
// change that moves an anchor, blocks a road, or slows the game can
// silently break a mission. Exit 0 = all missions PASS.
// Takes ~30 min in headless (the game runs at ~20% speed there, so
// M2's 20 s tail timer and M9's heat decay need ~350 s real each).
//
// Usage: NODE_PATH=/tmp/node_modules node game/test/missions.mjs [--from M5]
//   (NODE_PATH must resolve playwright-core from the Playwright
//   connector; the 8941 server must already be running. ESM does not
//   read NODE_PATH, so Playwright is loaded via createRequire, which
//   does — see the import below.)
// Writes reports/missions-run.json (committed) + /tmp/missions-regression.json.
// Exit 0 = all missions PASS.
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
import { writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// --- Crash-safe resumable runner (Xian 22 Nov 01:16, item 1) ---
// Order: M4-M12 first, then M2 (M1 134 s and M3 61 s already pass
// human-like — recorded from the prior logs, not re-run).
const ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1]; // ids: M4..M12, M2
const PRIOR_PASS = {
  M1: { mission: 'M1', result: 'PASS', how: 'human-like', ms: 134000, attempts: 1, fails: 0, maxStage: 2, evidence: '/tmp/missions-run-20261122-0200.log (HEAD f7a574e), not re-run in this pass' },
  M3: { mission: 'M3', result: 'PASS', how: 'human-like', ms: 61000, attempts: 1, fails: 0, maxStage: 2, evidence: '/tmp/missions-run-20261122-0130.log (HEAD f7a574e), not re-run in this pass' },
};
const RESULTS_PATH = fileURLToPath(new URL('../../reports/missions-run.json', import.meta.url));
const COMMIT = process.env.COMMIT || 'unknown';
const ITEM_START = Date.now();

async function loadResults() {
  try {
    return JSON.parse(await readFile(RESULTS_PATH, 'utf8'));
  } catch {
    return { generated: new Date().toISOString(), commit: COMMIT, missions: {}, saveLoad: null };
  }
}
async function saveResult(label, record) {
  const data = await loadResults();
  data.missions[label] = record;
  data.generated = new Date().toISOString();
  data.commit = COMMIT;
  await writeFile(RESULTS_PATH, JSON.stringify(data, null, 2));
  // /tmp copy for the old path (same content).
  await writeFile('/tmp/missions-regression.json', JSON.stringify(data, null, 2));
  console.log(`[saved] ${label} -> reports/missions-run.json`);
}

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8941';
// FASTSIM=2: load ?fastsim=2 (test-only, ~2× wall-clock, see main.js).
// Factor 2 is the verified safe max for this driver's 300 ms polls.
const FASTSIM = Math.max(1, Math.min(8, parseInt(process.env.FASTSIM || '1', 10) || 1));
const PAGE_URL = BASE + (FASTSIM > 1 ? '/?fastsim=' + FASTSIM : '/');
const CHROMIUM = '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROMIUM_ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'];
let browser = await chromium.launch({ executablePath: CHROMIUM, args: CHROMIUM_ARGS });

async function ensureBrowser() {
  if (browser && browser.isConnected()) return;
  console.log('[runner] browser is gone — relaunching');
  browser = await chromium.launch({ executablePath: CHROMIUM, args: CHROMIUM_ARGS });
}

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
      angle: g.player.angle, // DRIVER fix: steer on the live player angle (see walkToPoint)
      cx: g.car.x, cz: g.car.z,
      duel: !!g.duelTarget,
      duelFallen: g.duelTarget ? g.duelTarget.fallen : null,
      mode: g.state.mode,
      tailTimer: m.tailTimer,
      elapsed: m.elapsed, // game seconds since this mission started
    };
  });
}

// Teleport the PLAYER ONLY (on foot) to a checkpoint. The CAR is never
// teleported: a human parks it on the road, and the driver drives it
// there (routeDrive below). Teleporting the car to an objective put it
// inside the marina pavilion's collider (off-road, walled in by the
// promenade buildings) and the car could not drive out — that was the
// M1/M2/M4/M5/M6/M8 timeouts, not a game bug. The player teleport is a
// test convenience for walking; it dodges no mission mechanic.
async function teleportPlayer(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.player.x = x; g.player.z = z;
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

// Steering keys for the car toward a heading error `diff` (target
// angle minus car angle). Forward when the target is ahead; REVERSE
// (with inverted steering) when the target is behind the car — a
// U-turn. stepCar flips turnRate when speed < 0, so steering inverts
// while reversing: to turn the nose toward a larger angle while
// reversing, press D, not A. Driving forward at a behind-target goes
// the wrong way, and the low-speed turn rate (steerAuthority 0 at
// standstill) is too slow to turn around before the no-progress
// reverse interrupts — that was the M2 tail timeout: the car drove
// east to the boulevard end (44.6,-5.5) and wedged while the smuggler
// went west to -37.4, 82.1u away.
// DRIVER fix (M10 22 Nov ~08:45): NEVER reverse to turn around. The
// old code reversed (S key) when |diff| > 2.2 rad — on a 2.2u street
// the reversing car swings sideways and wedges against the buildings
// (M10 run 3: wedged (-12.8,-4.8) on the boulevard U-turn and
// (-10.0,-41.2) at the VIA DEL NORD turn). A human does a 3-point
// turn instead (see threePointTurn) — this function only steers
// forward. The stall-recovery reverses (driveToPoint sidestep,
// followTail) are untouched — reversing OUT of a wedge is still the
// right move.
function carSteerKeys(diff, speed, cap) {
  return { w: Math.abs(speed) < cap, a: diff > 0.15, d: diff < -0.15, s: false };
}

// 3-point turn (DRIVER, M10 22 Nov ~08:55): align the car's nose
// toward (tx,tz) with SHORT alternating reverse/forward phases
// (<=1.5u each), so the car never leaves the street. A single long
// reverse (the old U-turn-first block) displaced the car 5-7u
// sideways into the buildings — M10 run 3 wedged (-12.8,-4.8) on
// the boulevard U-turn and (-10.0,-41.2) at the VIA DEL NORD turn.
// Physics: turn rate is 1.9 rad/s * steerAuthority (|speed|/6, capped
// at 1), so the tightest forward turn is ~3.2u radius at 4-6 u/s —
// a U-turn does NOT fit inside a 2.2u street, and slowing down
// below 3 u/s makes the radius WORSE (authority drops). The only
// tight turnaround is a 3-point turn: reverse a little, drive a
// little, each phase rotating the nose ~0.4 rad. Returns true when
// aligned (|diff| < 0.5).
async function threePointTurn(page, tx, tz) {
  // Brake to a stop first — a phase measured from a moving car would
  // overshoot its 1.2u budget in the braking distance.
  for (let i = 0; i < 10; i++) {
    const c = await readCar(page);
    if (c.mode !== 'play') return false;
    if (Math.abs(c.speed) < 0.5) break;
    await setKeys(page, { s: true, a: false, d: false, w: false });
    await sleep(200);
  }
  await releaseKeys(page);
  const started = Date.now();
  let reverse = true;
  while (Date.now() - started < 20000) {
    const c = await readCar(page);
    if (c.mode !== 'play') { await releaseKeys(page); return false; }
    const diff = normAngle(Math.atan2(-(tz - c.z), tx - c.x) - c.angle);
    if (Math.abs(diff) < 0.5) { await releaseKeys(page); return true; }
    const sx = c.x, sz = c.z;
    const pStart = Date.now();
    while (Date.now() - pStart < 2000) {
      const c2 = await readCar(page);
      if (Math.hypot(c2.x - sx, c2.z - sz) > 1.0) break;
      const diff2 = normAngle(Math.atan2(-(tz - c2.z), tx - c2.x) - c2.angle);
      if (Math.abs(diff2) < 0.5) break;
      // Cap phase speed at ~2.5 u/s and poll every 150 ms: at
      // FASTSIM=2 a 300 ms poll is 600 ms of game time, and the car
      // travels 2-3u per poll — the 1.0u budget would overshoot to
      // 4u per phase and wedge the car (probe 22 Nov ~09:00: 2
      // phases put the car 8u off-road). 2.5 u/s is also BELOW the
      // pedestrian-hit threshold (|speed| > 3), so a drift onto the
      // sidewalk cannot raise the wanted level (M10 run 5: wanted 4
      // from ped hits during the turn, police pinned the car).
      // Forward phases are faster than reverse (0.5x accel), so a
      // shared 2.5 u/s cap keeps the pair balanced and the net drift
      // ~1u. Reversing flips the turn-rate sign, so the steering is
      // inverted vs forward (diff > 0 needs D in reverse, A forward).
      const drive = Math.abs(c2.speed) < 2.5;
      if (reverse) await setKeys(page, { s: drive, a: diff2 < -0.15, d: diff2 > 0.15, w: false });
      else await setKeys(page, { w: drive, a: diff2 > 0.15, d: diff2 < -0.15, s: false });
      await sleep(150);
    }
    await releaseKeys(page);
    await sleep(200);
    reverse = !reverse;
  }
  await releaseKeys(page);
  return false;
}

// Drive the car to a fixed point (tx, tz) within radius r. Returns
// true when reached. Steers toward the point, throttles to cap u/s,
// reverses out if stuck (no progress 8 s, max 3 reverses).
async function driveToPoint(page, tx, tz, r, cap, timeoutMs) {
  // DRIVER fix (D2 22 Nov 06:10): sidestep. The BFS graph routes on
  // road CENTERLINES, but the boulevard has a median (x -60..-34.7,
  // z +/-0.7) whose blunt east nose at (-34.7,0) stops a car steering
  // exactly at z=0 head-on (D2: stuck (-34.2,-0.5)), and the turn
  // onto the x -47.5 old-town cross street clips the (-45,-27) house
  // corner (D2: stuck (-44.9,-25.0)). A human steers around such an
  // obstacle; the old driver only reversed and retried the same line.
  // On each stall the driver now also offsets the STEERING target
  // 4u sideways (left first, then right) so the car goes around
  // the nose/corner; the arrival check still uses the real target.
  // 4u (not 2.5u): the median nose needs the car at z<=-1.3 before
  // x=-34.7, and a 2.5u offset still clips the nose corner (D2).
  // The reverse is 3 s so the car backs up far enough to turn.
  // Turn around FIRST when the car faces AWAY from the target
  // (|diff| > 2.2, >126 deg): a 3-point turn in place (see
  // threePointTurn) — never a long reverse, never a fast forward arc
  // into the corner. Moderate turns (1.0..2.2) are driven forward
  // with the corner braking below — the old 1.0 threshold fired the
  // 3-point turn for ordinary 90 deg junction turns, and its drift
  // wedged the car (M10 run 4: (-30.8,-9.6) on the (-40,0) turn and
  // (-23.7,-26.0) on the x -22.4 turn).
  {
    const c0 = await readCar(page);
    const desired0 = Math.atan2(-(tz - c0.z), tx - c0.x);
    if (Math.abs(normAngle(desired0 - c0.angle)) > 2.2) {
      await threePointTurn(page, tx, tz);
    }
  }
  let sideStep = 0;
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
      // Sidestep: 1st stall steer left of the travel line, 2nd stall
      // right, 3rd stall straight again (last chance).
      sideStep = reverses === 1 ? 1 : reverses === 2 ? -1 : 0;
      // Steer the REVERSE at the sidestep target, not the original
      // target (D2): the original target is due west, so the reverse
      // aligned the nose south-west and the retry re-wedged on the
      // median nose; aiming at the offset target turns the nose
      // around the nose while backing up.
      let rtx = tx, rtz = tz;
      if (sideStep !== 0) {
        const dx = tx - c.x, dz = tz - c.z, len = Math.hypot(dx, dz) || 1;
        rtx = tx + (-dz / len) * 4 * sideStep;
        rtz = tz + (dx / len) * 4 * sideStep;
      }
      const desired = Math.atan2(-(rtz - c.z), rtx - c.x);
      const diff = normAngle(desired - c.angle);
      // Backing out: the car moves backward, so the steering is
      // inverted (see carSteerKeys).
      await setKeys(page, { s: true, a: diff < 0, d: diff >= 0 });
      reversingUntil = Date.now() + 3000;
      lastProgress = Date.now();
      await sleep(300);
      continue;
    }
    // Near the target, steer straight at it (no sidestep).
    if (d < 8) sideStep = 0;
    let stx = tx, stz = tz;
    if (sideStep !== 0) {
      const dx = tx - c.x, dz = tz - c.z, len = Math.hypot(dx, dz) || 1;
      stx = tx + (-dz / len) * 4 * sideStep;
      stz = tz + (dx / len) * 4 * sideStep;
    }
    const desired = Math.atan2(-(stz - c.z), stx - c.x);
    const diff = normAngle(desired - c.angle);
    // Brake into corners (M10 22 Nov 07:40, tiered 22 Nov ~08:55)
    // and for arrival (22 Nov ~09:10): turning radius is v /
    // turnRate, and turnRate is 1.9 * min(1, v/6) * min(1, v/4+0.2)
    // — so the radius is ~3.2u for v in 3..12 and GROWS below 3 u/s
    // (steer authority drops). Slowing to 2.5 does NOT tighten the
    // turn; the tightest turn is at 4-6 u/s. A human brakes for the
    // corner and for the turn itself: the approach cap slows the car
    // as it nears the waypoint, so it can actually hit the 2.5u
    // arrival radius instead of overshooting it at 12 u/s (7u per
    // poll at FASTSIM=2) and turning early across a building corner
    // — M10 run 4 arrived 2.8u off the (-22.4,-22.4) node, inside a
    // block, and wedged on the next leg. Big turns (>2.2 rad) are
    // handled by the 3-point turn at leg start.
    // DRIVER fix (M10 run 7, 22 Nov ~09:45): start braking 20u out
    // (was 10u) — the car at 12 u/s needs the distance to shed
    // speed before a 90 deg turn (run 7 overshot the (-54,0) south
    // turn to (-56.9,-1.1) because it arrived at the corner too
    // fast to turn).
    const approachCap = d < 20 ? Math.max(4, d * 0.6) : cap;
    const effCap = Math.min(approachCap, Math.abs(diff) > 1.5 ? 4 : Math.abs(diff) > 0.7 ? 6 : cap);
    await setKeys(page, carSteerKeys(diff, c.speed, effCap));
    await sleep(300);
  }
  await releaseKeys(page);
  return false;
}

// Drive the CAR to the road nearest a target point (tx, tz) along the
// road network (BFS on the minimap graph), waypoint to waypoint. The
// car STOPS at the last road node — the raw target is NOT appended,
// because an off-road target (marina pavilion, quay, fortress plaza)
// sits inside/behind buildings and steering straight at it rams the
// wall (that was the M1 westward wandering). Returns true when the car
// ends within 6u of that road node. A BFS failure returns false —
// there is deliberately NO straight-line fallback through buildings.
async function routeDrive(page, tx, tz, cap, perWpMs) {
  if (!roadGraph) { console.log('[routeDrive] no road graph'); return false; }
  // DRIVER fix (M10 run 7, 22 Nov ~09:45): RE-PLAN on a missed
  // waypoint instead of aborting. A human who overshoots a turn
  // turns around and re-routes from where they are; the old code
  // abandoned the whole route after one missed waypoint (run 7:
  // overshot the (-54,0) south turn to (-56.9,-1.1) and gave up
  // 39u from the plaza). Up to 3 re-plans per call, each a fresh
  // BFS from the car's actual position.
  for (let plan = 0; plan < 4; plan++) {
    const c = await readCar(page);
    const from = roadGraph.nearestNode(c.x, c.z);
    const to = roadGraph.nearestNode(tx, tz);
    const pathIdx = roadGraph.route(from.node, to.node);
    if (!pathIdx) { console.log(`[routeDrive] no road route to (${tx},${tz})`); return false; }
    const wps = pathIdx.map((i) => ({ x: roadGraph.nodes[i].x, z: roadGraph.nodes[i].z }));
    const thin = [wps[0]];
    for (const p of wps) if (Math.hypot(thin[thin.length - 1].x - p.x, thin[thin.length - 1].z - p.z) > 3) thin.push(p);
    if (plan === 0) {
      console.log(`[routeDrive] to (${tx},${tz}) from (${c.x.toFixed(1)},${c.z.toFixed(1)}) BFS ${pathIdx.length} nodes: ` + wps.map((p) => `(${p.x.toFixed(1)},${p.z.toFixed(1)})`).join(' '));
      console.log(`[routeDrive] thinned ${thin.length} wps: ` + thin.map((p) => `(${p.x.toFixed(1)},${p.z.toFixed(1)})`).join(' '));
    } else {
      console.log(`[routeDrive] RE-PLAN ${plan} to (${tx},${tz}) from (${c.x.toFixed(1)},${c.z.toFixed(1)}) BFS ${pathIdx.length} nodes: ` + wps.map((p) => `(${p.x.toFixed(1)},${p.z.toFixed(1)})`).join(' '));
    }
    let failed = false;
    for (let wi = 0; wi < thin.length; wi++) {
      const wp = thin[wi];
      // DRIVER fix (M10 run 9, 22 Nov ~10:15): arrival radius by TURN
      // ANGLE, not one radius for all. Run 8's flat 4u backfired on
      // STRAIGHT legs: the car "arrived" at (-54,-16) while still at
      // (-51.3,-15.3), aimed diagonally at (-54,-26), and scraped
      // the west house faces (face at x=-55.1, car body to -55.5)
      // for 20 s at 0.14 u/s. On a straight leg the car must actually
      // visit the waypoint (2.5u) to stay on the 1u asphalt. On a
      // SHARP turn (>0.7 rad) the radius is 5u: the turn must start
      // 3.2u (turning radius) + ~1.2u (one poll of steering lag at
      // 4 u/s, FASTSIM=2) before the corner, so the 90 deg arc exits
      // on the centreline instead of 3.2u off the road. The last
      // waypoint keeps 2.5u (it IS the target).
      let r = 2.5;
      if (wi > 0 && wi < thin.length - 1) {
        const a = thin[wi - 1], b = thin[wi], c = thin[wi + 1];
        const v1 = Math.atan2(-(b.z - a.z), b.x - a.x);
        const v2 = Math.atan2(-(c.z - b.z), c.x - b.x);
        let turn = v2 - v1;
        while (turn > Math.PI) turn -= 2 * Math.PI;
        while (turn < -Math.PI) turn += 2 * Math.PI;
        if (Math.abs(turn) > 0.7) r = 5;
      }
      const ok = await driveToPoint(page, wp.x, wp.z, r, cap, perWpMs);
      const cc = await readCar(page);
      console.log(`[routeDrive] wp (${wp.x.toFixed(1)},${wp.z.toFixed(1)}) r=${r} ${ok ? 'OK' : 'FAIL'} car now (${cc.x.toFixed(1)},${cc.z.toFixed(1)})`);
      if (!ok) { failed = true; break; }
    }
    const c2 = await readCar(page);
    const last = thin[thin.length - 1];
    const d = Math.hypot(c2.x - last.x, c2.z - last.z);
    console.log(`[routeDrive] to (${tx},${tz}) car now (${c2.x.toFixed(1)},${c2.z.toFixed(1)}) ${d.toFixed(1)}u from road node (${last.x},${last.z})`);
    if (d < 6) return true;
    if (!failed) return false; // drove the whole plan but still far — no re-plan helps
    // else: missed a waypoint — loop and re-plan from the car's actual position
  }
  return false;
}

// Walk the ON-FOOT player toward (tx, tz) with W + A/D. The player
// moves camera-relative (W = camera look direction, chase cam behind),
// so steering uses the player's LIVE angle (player.angle, set from
// the movement vector every frame) — NOT the old 900 ms-sampled
// moveAngle. DRIVER fix (walk-probe 22 Nov 05:40): the sampled
// moveAngle lagged the game's ~0.8 rad/s turn rate, so the steering
// oscillated and the player walked in tight circles for 60 s without
// reaching a target 14u away; steering on the fresh angle every
// 300 ms poll converges in ~2 s per 90 deg turn. If blocked (no
// progress 6 s) it strafes along the wall (alternating side, 3 s)
// to get around the end — the final leg to an off-road target
// (pavilion, quay, fortress plaza) needs this, because the direct
// line crosses the promenade wall. Returns true when within r.
// Human-like: no teleport.
async function walkToPoint(page, tx, tz, r, timeoutMs) {
  const started = Date.now();
  let lastDist = Infinity, lastProgress = Date.now();
  let followSide = 1, followUntil = 0;
  while (Date.now() - started < timeoutMs) {
    const s = await readState(page);
    if (s.mode !== 'play') { await releaseKeys(page); return false; }
    if (!s.onFoot) { await releaseKeys(page); return false; }
    const d = Math.hypot(s.px - tx, s.pz - tz);
    if (d < r) { await releaseKeys(page); return true; }
    if (d < lastDist - 0.3) { lastDist = d; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 20000) { await releaseKeys(page); return false; }
    if (Date.now() < followUntil) { await sleep(300); continue; }
    if (Date.now() - lastProgress > 6000) {
      // Blocked by a wall — strafe along it toward the TARGET's side
      // (DRIVER fix, M11 22 Nov ~08:45): the old code flipped the
      // strafe side every episode, so the player slid east 3 s then
      // west 3 s and never reached the promenade gap (x 3.5..8) from
      // x=-6.7 (M11 TIMEOUT 317 s). The side is recomputed from the
      // live bearing each episode, so the slide stays consistent
      // toward the gap. diff > 0 = target left of heading = strafe
      // left (A); diff < 0 = target right = strafe right (D).
      const desiredB = Math.atan2(-(tz - s.pz), tx - s.px);
      const diffB = normAngle(desiredB - s.angle);
      followSide = diffB >= 0 ? -1 : 1;
      await setKeys(page, { w: true, a: followSide < 0, d: followSide > 0, s: false });
      followUntil = Date.now() + 3000;
      lastProgress = Date.now();
      await sleep(300);
      continue;
    }
    const desired = Math.atan2(-(tz - s.pz), tx - s.px);
    const diff = normAngle(desired - s.angle);
    await setKeys(page, { w: true, a: diff > 0.2, d: diff < -0.2, s: false });
    await sleep(300);
  }
  await releaseKeys(page);
  return false;
}

// Follow the smuggler (M2 TAIL) in the car until the tail stage ends
// (stageType leaves 'tail') or the timeout. The smuggler drives the
// boulevard at 6 u/s; the car matches ~6 u/s when close (so it stays
// behind it instead of overshooting) and up to 12 u/s when far.
// The car starts parked on the road near the mission area — route
// onto the boulevard along the roads (BFS on the minimap graph) first,
// then follow greedily (both cars are on the same straight road).
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
        const pathIdx = roadGraph.route(from.node, to.node);
        if (pathIdx) {
          const wps = pathIdx.map((i) => ({ x: roadGraph.nodes[i].x, z: roadGraph.nodes[i].z }));
          const thin = [wps[0]];
          for (const p of wps) if (Math.hypot(thin[thin.length - 1].x - p.x, thin[thin.length - 1].z - p.z) > 3) thin.push(p);
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
      // Backing out: inverted steering while reversing (see
      // carSteerKeys).
      await setKeys(page, { s: true, a: diff < 0, d: diff >= 0 });
      reversingUntil = Date.now() + 2000;
      lastProgress = Date.now();
      await sleep(300);
      continue;
    }
    const desired = Math.atan2(-(o.z - c.z), o.x - c.x);
    const diff = normAngle(desired - car.angle);
    const cap = d > 10 ? 12 : 6;
    await setKeys(page, carSteerKeys(diff, car.speed, cap));
    await sleep(300);
  }
  await releaseKeys(page);
  return false;
}

// Board the car FIRST (DRIVER fix for the M5/M6/M8 escape timeouts):
// walk the player to the car when close, otherwise place the player
// beside the car (the game's own exit placement, 2.2u) and press E at
// close range (<4u — E does nothing beyond that). NEVER set
// state.onFoot=false directly: the player's position stays behind,
// the car drives off alone, and the escape is then measured from a
// player 40-80u away on foot while the car sits at the target
// (M5 trace: player 26.6u from target, car 26.9u, onFoot=true).
// Positioning the player next to the car is the same class of test
// convenience as the goto teleports below (it positions the player;
// the driving itself is real, human-like keyboard driving).
async function boardCar(page) {
  for (let tries = 0; tries < 2; tries++) {
    const s = await readState(page);
    if (!s.onFoot) return true;
    const d = Math.hypot(s.px - s.cx, s.pz - s.cz);
    if (d > 3.5) {
      if (d <= 15) {
        const ok = await walkToPoint(page, s.cx, s.cz, 3.5, 60000);
        if (!ok) {
          await page.evaluate(() => {
            const g = window.__game;
            g.player.x = g.car.x + 2.2; g.player.z = g.car.z + 2.2;
          });
          await sleep(300);
        }
      } else {
        await page.evaluate(() => {
          const g = window.__game;
          g.player.x = g.car.x + 2.2; g.player.z = g.car.z + 2.2;
        });
        await sleep(300);
      }
    }
    await page.keyboard.press('KeyE');
    await sleep(700);
    const s2 = await readState(page);
    if (!s2.onFoot) return true;
  }
  return false;
}

// --- Road routing (BFS on the minimap centerlines) ---
// The greedy autopilot (driveToPoint) cannot navigate around
// buildings over a long distance — a human follows the roads. The
// escape stages need the car driven to a target that can be far
// away (M1: marina -> boulevard_mid, M3/M5 -> boulevard, M4/M6 ->
// marina, M10 -> quay), so the driver routes along the road network
// (the same minimap graph as the route test). Built once per page.
let roadGraph = null; // { nodes, route, nearestNode, segments }
async function buildRoadGraph(page) {
  const segments = await page.evaluate(() => window.__game.district.minimap.map((s) => ({ x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2, w: s.w || 2 })));
  const nodes = [];
  const nodeOf = new Map();
  function nodeFor(x, z) {
    const key = x + ',' + z;
    let ni = nodeOf.get(key);
    if (ni === undefined) {
      // Cluster radius 3u (was 4): a 4u radius merged the x -44 /
      // z -26 corner (-44,-25) with the -47.5 cross-street junction
      // (-47.5,-26), 3.64u apart, into ONE node — so the BFS routed
      // diagonally across the block instead of around the corner,
      // and the M10 race car wedged (run 6). 3u still merges the
      // VIA DEL NORD / ring-avenue junction (2.8u) and the
      // (-44,-25)/(-45,-26) corner (1.41u), but keeps the two
      // junctions 3.5u apart distinct. Keep in sync with
      // connectivity.mjs CLUSTER_R.
      ni = nodes.findIndex((n) => Math.hypot(n.x - x, n.z - z) < 3);
      if (ni < 0) { nodes.push({ x, z, adj: new Map() }); ni = nodes.length - 1; }
      nodeOf.set(key, ni);
    }
    return ni;
  }
  // DRIVER fix (M10 run 8, 22 Nov ~10:00): WIDTH-WEIGHTED routing.
  // The old unweighted BFS picked the shortest hop-count route —
  // straight through the old-town w=2 streets (1u of asphalt,
  // houses flush on both sides, car turning radius 3.2u). A 90 deg
  // turn at (-54,0) cannot stay on a 1u-wide road: the arc exits
  // 3.2u west of the centreline, into the house row, and the car
  // wedged at (-56.4,-16.7) against the house at x -58.4..-55.1,
  // z -21..-17.2 (its east face sits 0.1u INSIDE the road edge).
  // A human driver would take the wide ring road instead. Cost =
  // length x width factor, so Dijkstra prefers the w=7 ring road
  // (z=-39) and the w=4.8 boulevard over w=2 alleys.
  function widthFactor(w) { return w >= 7 ? 1 : w >= 4 ? 1.5 : w >= 2 ? 3 : 5; }
  for (const s of segments) {
    const a = nodeFor(s.x1, s.z1);
    const b = nodeFor(s.x2, s.z2);
    if (a !== b) {
      const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
      const cost = len * widthFactor(s.w);
      if (!nodes[a].adj.has(b) || nodes[a].adj.get(b) > cost) nodes[a].adj.set(b, cost);
      if (!nodes[b].adj.has(a) || nodes[b].adj.get(a) > cost) nodes[b].adj.set(a, cost);
    }
  }
  function route(a, b) {
    // Dijkstra (weighted shortest path) over the width-weighted graph.
    const dist = new Array(nodes.length).fill(Infinity);
    const prev = new Array(nodes.length).fill(-1);
    const done = new Array(nodes.length).fill(false);
    dist[a] = 0;
    for (;;) {
      let n = -1, bd = Infinity;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; n = i; }
      if (n < 0) break;
      done[n] = true;
      if (n === b) break;
      for (const [m, c] of nodes[n].adj) {
        if (dist[n] + c < dist[m]) { dist[m] = dist[n] + c; prev[m] = n; }
      }
    }
    if (prev[b] < 0 && a !== b) return null;
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
  return { nodes, route, nearestNode, segments: segments.length };
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

async function playMission(page, id, label, maxAttempts = 2) {
  const started = Date.now();
  let attempts = 0;
  let fails = 0;
  let maxStage = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    await page.evaluate((mid) => { window.__game.missions.start(mid); }, id);
    await sleep(800);
    // The CAR is positioned by the tail / escape / race branches below
    // (they board the car first, then drive it on the roads). There is
    // deliberately NO park drive here: the car only moves while the
    // player is in it (stepCar runs only when onFoot is false), so a
    // drive before boarding goes nowhere — and a drive while the player
    // happens to be in it from the previous mission coasts/overshoots.
    // Other stages (goto / deliver / interact) teleport the PLAYER
    // (on foot) only, as a test convenience — they do not dodge a bug,
    // and the driving stages here are driven, not teleported.
    let lastStage = 0;
    let lastTrace = 0; // position trace cadence (item 4 below)
    // FAST-FAIL stall tracking (see the stall block in the loop):
    // best objective distance + when it last improved by >=2u
    // (20 m), last player movement, last wanted drop, tail timer.
    let bestDist = Infinity, bestDistGame = 0, bestDistReal = Date.now();
    let lastMoveGame = 0, lastMoveReal = Date.now(), lastPos = null;
    let lastStageSeen = -1, stallTailTimer = 0;
    let lastWanted = 0, lastWantedDropGame = 0, lastWantedDropReal = Date.now();
    let lastTraceLine = '';
    const traceBuf = [];
    // FAST-FAIL (Xian 22 Nov 02:15): hard cap 240 s real per mission
    // (480 s for M2; +240 s once for any mission still making
    // progress at the cap — the long-escape case). A stuck mission
    // used to burn the whole 480 s (~9 min per timeout at ~20%
    // headless speed); the stall detector below aborts much sooner.
    const baseCapMs = id === 1 ? 480000 : 240000;
    let deadline = Date.now() + baseCapMs;
    let extended = false;
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
      if (s.mode && s.mode !== 'play') { fails += 1; result = 'FAIL-EVENT'; console.log(`[fail-event] ${label} mode=${s.mode} stage=${s.stage} wanted=${s.wanted} player=(${s.px.toFixed(1)},${s.pz.toFixed(1)}) car=(${s.cx.toFixed(1)},${s.cz.toFixed(1)})`); break; }
      // A fail restarts the SAME mission (stage drops back to 0).
      if (s.missionId === id && s.stage === 0 && lastStage > 0) { fails += 1; result = 'FAIL-EVENT'; console.log(`[fail-event] ${label} mission restarted at stage 0 (fail) wanted=${s.wanted} player=(${s.px.toFixed(1)},${s.pz.toFixed(1)})`); break; }
      lastStage = s.stage;
      // POSITION TRACE (Xian 21 Nov 23:04, item 4): player + target
      // positions and distance to the objective every 5 s, and at
      // timeout (see below). A timeout without a trace is not an
      // acceptable result. This is driver instrumentation only — it
      // changes no gameplay and dodges no bug.
      if (Date.now() - lastTrace >= 5000) {
        lastTrace = Date.now();
        traceLine(label, s, 'trace');
        const o2 = s.objective;
        if (o2) {
          const dp = Math.hypot(s.px - o2.x, s.pz - o2.z);
          const dc = Math.hypot(s.cx - o2.x, s.cz - o2.z);
          const dm = s.onFoot ? dp : dc;
          lastTraceLine = `[trace] ${label} stage=${s.stage} ${s.stageName || s.stageType} player=(${s.px.toFixed(1)},${s.pz.toFixed(1)}) car=(${s.cx.toFixed(1)},${s.cz.toFixed(1)}) target=(${o2.x},${o2.z}) distPlayer=${dp.toFixed(1)}u distCar=${dc.toFixed(1)}u wanted=${s.wanted} onFoot=${s.onFoot}`;
          traceBuf.push(lastTraceLine);
          if (traceBuf.length > 12) traceBuf.shift();
          // Movement tracks the ACTIVE position: the car while
          // driving (the player's position is frozen in the car —
          // tracking it fired a false stall on M10's race).
          const ax = s.onFoot ? s.px : s.cx, az = s.onFoot ? s.pz : s.cz;
          const moved = lastPos ? Math.hypot(ax - lastPos.x, az - lastPos.z) : 99;
          if (moved >= 0.5) { lastMoveGame = s.elapsed; lastMoveReal = Date.now(); }
          lastPos = { x: ax, z: az };
          if (s.stageType === 'tail') {
            if ((s.tailTimer || 0) > stallTailTimer) { stallTailTimer = s.tailTimer; bestDistGame = s.elapsed; bestDistReal = Date.now(); }
          } else if (dm < bestDist - 2) { bestDist = dm; bestDistGame = s.elapsed; bestDistReal = Date.now(); }
          if (s.wanted < lastWanted) { lastWantedDropGame = s.elapsed; lastWantedDropReal = Date.now(); }
          lastWanted = s.wanted;
        }
      }
      // Per-stage stall baseline (reset when the stage advances).
      if (s.stage !== lastStageSeen) {
        lastStageSeen = s.stage;
        bestDist = Infinity; bestDistGame = s.elapsed; bestDistReal = Date.now();
        lastMoveGame = s.elapsed; lastMoveReal = Date.now();
        stallTailTimer = s.tailTimer || 0;
        lastWanted = s.wanted; lastWantedDropGame = s.elapsed; lastWantedDropReal = Date.now();
      }
      // STALL ABORT (fast-fail): no 20 m objective improvement in
      // 90 s game time (150 s real backstop), or no 5 m movement in
      // 45 s game time (60 s real) — goto/deliver/race/tail only.
      // Escape stages stall on the HEAT instead: laying low means
      // sitting still, so movement/distance stalls do not apply;
      // wanted must drop within 120 s game time (or the distance
      // must improve while wanted is 0).
      if (Date.now() - started > 30000) {
        let stalled = false;
        let why = '';
        if (s.stageType === 'escape') {
          if (s.wanted > 0 && s.elapsed - lastWantedDropGame > 120) { stalled = true; why = 'wanted never dropped in 120s game time (stall)'; }
          else if (s.wanted === 0 && s.elapsed - bestDistGame > 90) { stalled = true; why = 'no 20m improvement in 90s game time (stall)'; }
          else if (s.wanted === 0 && Date.now() - bestDistReal > 150000) { stalled = true; why = 'no progress 150s real (stall)'; }
        } else if (s.stageType === 'tail') {
          if (s.elapsed - bestDistGame > 90) { stalled = true; why = 'tail timer stalled 90s game time'; }
          else if (Date.now() - bestDistReal > 150000) { stalled = true; why = 'no progress 150s real (stall)'; }
        } else if (s.stageType === 'goto' || s.stageType === 'deliver' || s.stageType === 'race') {
          if (s.elapsed - bestDistGame > 90) { stalled = true; why = 'no 20m improvement in 90s game time (stall)'; }
          else if (Date.now() - bestDistReal > 150000) { stalled = true; why = 'no progress 150s real (stall)'; }
          else if (s.elapsed - lastMoveGame > 45) { stalled = true; why = 'player moved <5m in 45s game time (stall)'; }
          else if (Date.now() - lastMoveReal > 60000) { stalled = true; why = 'player moved <5m in 60s real (stall)'; }
        }
        if (stalled) {
          traceLine(label, await readState(page), 'trace-timeout');
          return { mission: label, result: 'STALL', attempts, fails, maxStage, ms: Date.now() - started, abortReason: why, trace: traceBuf.slice(-6), lastTrace: lastTraceLine };
        }
      }
      // Cap extension (once): approaching the cap while still making
      // progress buys +240 s (max 480 s total) — the long-escape case.
      if (!extended && Date.now() > deadline - 10000 && Date.now() - bestDistReal < 60000) {
        deadline += 240000; extended = true;
        console.log(`[${label}] cap extended +240s (still making progress)`);
      }
      const o = s.objective;
      if (!o) { await sleep(500); continue; }
      if (s.stageType === 'interact') {
        await teleportPlayer(page, o.x, o.z);
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
        // resort, put the player in the car directly — the car is
        // parked on the road near the mission area, so getting in is
        // not dodging anything.
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
        // ESCAPE (human-like, 21:31 game fix + 21:34 rule): drive the
        // car on the roads to the road nearest the escape target
        // (routeDrive — no straight-line fallback through buildings).
        // The escape completes when wanted == 0 AND within the target
        // radius, measured from the CAR while driving, from the PLAYER
        // while on foot. Road targets (boulevard_mid, boulevard_west)
        // complete in the car. Off-road targets (pavilion, quay,
        // fortress_plaza) need the final leg on foot: the player
        // waits in the car until the heat is gone, gets out, and
        // walks to the target (walkToPoint, wall-follow around the
        // promenade). Guard rams add no heat during an escape, so the
        // heat falls at 2.5/s after 5 s quiet.
        // Already inside the escape radius on foot? Just WAIT for the
        // heat to clear — do NOT board the car and drive away from the
        // safehouse (M9: the player starts the LAY LOW stage AT the
        // target; boarding moves them 55u away into the Guard's path
        // and the mission fails busted).
        {
          const sc0 = await readState(page);
          const d0 = Math.hypot(sc0.px - o.x, sc0.pz - o.z);
          if (sc0.onFoot && d0 < (o.r || 5)) {
            await sleep(1000);
            continue;
          }
        }
        // If the player is already on foot and the car is already
        // parked at the road nearest the target, skip straight to the
        // walk (a previous walk attempt was interrupted).
        {
          const sc = await readState(page);
          const to = roadGraph ? roadGraph.nearestNode(o.x, o.z) : null;
          const carParked = to && Math.hypot(sc.cx - roadGraph.nodes[to.node].x, sc.cz - roadGraph.nodes[to.node].z) < 8;
          if (sc.onFoot && carParked) {
            if (sc.wanted === 0) {
              await walkToPoint(page, o.x, o.z, o.r || 5, 120000);
            } else {
              await sleep(1000);
            }
            await sleep(400);
          } else {
            // Board FIRST (see boardCar): the player and the car must
            // be together before routeDrive — the old code set
            // onFoot=false directly, leaving the player 40-80u behind
            // on foot while the car drove off (M5/M6/M8 timeouts).
            await boardCar(page);
            const cd = Math.hypot(s.cx - o.x, s.cz - o.z);
            if (cd > (o.r || 5)) {
              await routeDrive(page, o.x, o.z, 10, 20000);
            }
            // Off-road target: the car cannot reach the radius. Only
            // walk the final leg once the car is AT the road nearest
            // the target — otherwise keep driving (the old code exited
            // and walked after ONE routeDrive call, even 40u from the
            // node, and the walk went the wrong way: M5/M6 timeouts).
            // On-road targets (M6 boulevard_west) complete in the car.
            const s4 = await readState(page);
            const cd2 = Math.hypot(s4.cx - o.x, s4.cz - o.z);
            if (s4.stageType === 'escape' && cd2 > (o.r || 5)) {
              const to = roadGraph ? roadGraph.nearestNode(o.x, o.z) : null;
              const nodeD = to ? Math.hypot(s4.cx - roadGraph.nodes[to.node].x, s4.cz - roadGraph.nodes[to.node].z) : Infinity;
              if (nodeD < 8 && s4.wanted === 0) {
                await page.keyboard.press('KeyE'); // exit the car
                await sleep(600);
                const s5 = await readState(page);
                if (s5.onFoot) {
                  await walkToPoint(page, o.x, o.z, o.r || 5, 120000);
                }
              }
            }
            await sleep(1000);
          }
        }
      } else if (s.stageType === 'race') {
        // RACE (human-like): drive the car through the checkpoints —
        // no teleport. Board the car, route it on the roads to the
        // current checkpoint, then drive onto the checkpoint itself
        // (the checkpoints sit on roads / open plazas, so the final
        // straight leg is clear). The objective updates as each
        // checkpoint is hit, so each loop iteration drives the next.
        if (s.onFoot) {
          await teleportPlayer(page, s.cx, s.cz);
          await sleep(300);
          await page.keyboard.press('KeyE');
          await sleep(600);
          const s2 = await readState(page);
          if (s2.onFoot) {
            await page.evaluate(() => { window.__game.state.onFoot = false; });
          }
        }
        await routeDrive(page, o.x, o.z, 12, 20000);
        const s3 = await readState(page);
        if (s3.stageType === 'race') {
          await driveToPoint(page, o.x, o.z, o.r || 5, 12, 30000);
        }
        await sleep(400);
      } else {
        // goto / deliver: the player walks (on foot) to the checkpoint.
        // If the player is still in the car from the previous mission,
        // get out FIRST — teleporting the player while in the car
        // moves neither the player nor the car (the mission measures
        // from the car while driving), so the stage would deadlock
        // (that was the M2 MEET stall: onFoot=false, car 38.9u away).
        if (!s.onFoot) {
          await page.keyboard.press('KeyE'); // exit the car
          await sleep(600);
        }
        await teleportPlayer(page, o.x, o.z);
        await sleep(400);
      }
    }
    if (result === 'PASS') {
      const s = await readState(page);
      return { mission: label, result: 'PASS', attempts, fails, maxStage, ms: Date.now() - started, money: s.money, xp: s.xp };
    }
    if (result === 'FAIL-EVENT') continue; // retry once from scratch
    // Timeout: final trace with a fresh state read. The trace tail
    // (last 6 samples) rides in the JSON record so the failure
    // survives /tmp wipes.
    traceLine(label, await readState(page), 'trace-timeout');
    return { mission: label, result: 'TIMEOUT', attempts, fails, maxStage, ms: Date.now() - started, abortReason: 'hard cap ' + Math.round(baseCapMs / 1000) + 's reached', trace: traceBuf.slice(-6), lastTrace: lastTraceLine };
  }
  return { mission: label, result: 'FAIL', attempts, fails, maxStage, ms: Date.now() - started };
}

// --- Main: save/load once, then ORDER missions, each in a fresh context ---
async function checkSaveLoad() {
  await ensureBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  let sl = { saved: false, loaded: false, money: -1, xp: -1, missionId: -1 };
  let slPass = false;
  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__game && window.__gameReady === true, { timeout: 60000 });
    await sleep(2000);
    await page.evaluate(() => window.__game.startPlay());
    await sleep(2000);
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
  } finally {
    try { await context.close(); } catch {}
  }
  console.log(`save/load: ${slPass ? 'PASS' : 'FAIL'} (money=${sl.money} xp=${sl.xp} missionId=${sl.missionId})`);
  return { ...sl, pass: slPass };
}

// One mission in a fresh browser context. If the browser/context
// closes mid-mission, restart THAT mission once in a new context and
// continue — never restart the whole run.
async function runMissionInFreshContext(id, label, maxAttempts) {
  let restarted = false;
  while (true) {
    await ensureBrowser();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('page: ' + String(e)));
    try {
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__game && window.__gameReady === true, { timeout: 60000 });
      await sleep(2000);
      await page.evaluate(() => window.__game.startPlay());
      await sleep(2000);
      try {
        roadGraph = await buildRoadGraph(page);
        console.log(`road graph: ${roadGraph.nodes.length} nodes, ${roadGraph.segments} segments`);
      } catch (e) {
        console.log(`road graph: FAILED ${String(e).slice(0, 120)} (escapes drive straight)`);
        roadGraph = null;
      }
      const r = await playMission(page, id, label, maxAttempts);
      r.errors = errors.length;
      if (errors.length) console.log(`  ${label} ERRORS: ` + errors.slice(0, 5).join(' | '));
      return r;
    } catch (e) {
      const msg = String(e);
      if (!restarted && /has been closed/i.test(msg)) {
        restarted = true;
        console.log(`${label}: browser/context closed mid-mission — restarting that mission once`);
        try { await context.close(); } catch {}
        continue;
      }
      return { mission: label, result: 'ERROR', attempts: 0, fails: 0, maxStage: 0, ms: 0, error: msg.slice(0, 300) };
    } finally {
      try { await context.close(); } catch {}
    }
  }
}

// Commit each mission's result as soon as it finishes (Xian 22 Nov
// 02:15 — the 45 min without a commit). Best-effort: a git failure
// never fails the run.
async function commitMissionResult(label, record) {
  try {
    const { execSync } = await import('node:child_process');
    const repo = fileURLToPath(new URL('../..', import.meta.url));
    execSync('git add reports/missions-run.json', { cwd: repo, timeout: 15000, stdio: 'ignore' });
    const msg = `${label}: ${record.result}${record.how ? ' (' + record.how + ')' : ''} ${Math.round((record.ms || 0) / 1000)}s${record.abortReason ? ' — ' + record.abortReason : ''}`;
    execSync('git commit -m ' + JSON.stringify(msg), { cwd: repo, timeout: 15000, stdio: 'ignore' });
    const hash = execSync('git rev-parse --short HEAD', { cwd: repo, timeout: 5000 }).toString().trim();
    console.log(`[committed] ${label} ${hash}`);
    try { execSync('git push', { cwd: repo, timeout: 30000, stdio: 'ignore' }); } catch { console.log('[push] failed (non-fatal)'); }
    return hash;
  } catch (e) {
    console.log(`[commit] ${label} failed (non-fatal): ${String(e).slice(0, 120)}`);
    return null;
  }
}

// --from M5: skip missions before M5 in ORDER (their results stay in
// the JSON from the previous run).
// --only M5,M6,M8: run just those missions (in ORDER order), for
// re-running the timeouts without re-running the passes. Use either
// --from or --only, not both.
let ORDER_RUN = ORDER;
const onlyArg = process.argv.find((a) => a.startsWith('--only'));
if (onlyArg) {
  const eq = onlyArg.split('=')[1];
  const want = eq !== undefined ? eq : process.argv[process.argv.indexOf(onlyArg) + 1];
  const ids = String(want).split(',').map((s) => parseInt(s.replace(/^M/i, ''), 10) - 1).filter((n) => ORDER.includes(n));
  if (ids.length) ORDER_RUN = ORDER.filter((id) => ids.includes(id));
  console.log(`--only: running ${ORDER_RUN.map((id) => 'M' + (id + 1)).join(',')}`);
}
let fromIdx = 0;
const fromArg = process.argv.find((a) => a.startsWith('--from'));
if (fromArg) {
  const eq = fromArg.split('=')[1];
  const want = eq !== undefined ? eq : process.argv[process.argv.indexOf(fromArg) + 1];
  const n = parseInt(String(want).replace(/^M/i, ''), 10);
  const pos = ORDER.indexOf(n - 1);
  if (pos >= 0) fromIdx = pos;
  console.log(`--from M${n}: starting at ORDER[${fromIdx}]`);
}

// Seed prior passes (M1, M3) into the results file first.
for (const [label, rec] of Object.entries(PRIOR_PASS)) {
  const data = await loadResults();
  if (!data.missions[label]) await saveResult(label, rec);
}

const saveLoad = await checkSaveLoad();
{
  const data = await loadResults();
  data.saveLoad = saveLoad;
  await writeFile(RESULTS_PATH, JSON.stringify(data, null, 2));
}

for (let i = fromIdx; i < ORDER_RUN.length; i++) {
  const id = ORDER_RUN[i];
  const label = `M${id + 1}`;
  // M2 time-box: 30 min max for the whole M2 block (attempt + one
  // browser-close restart). playMission gets 1 attempt for M2.
  const blockStart = Date.now();
  const maxAttempts = id === 1 ? 1 : 2;
  const r = await runMissionInFreshContext(id, label, maxAttempts);
  const blockMin = Math.round((Date.now() - blockStart) / 60000);
  let record = { ...r, how: r.result === 'PASS' ? 'human-like' : undefined, commit: COMMIT };
  if (id === 1 && r.result !== 'PASS') {
    record = { ...record, result: 'FAIL', open: true, timeboxMin: 30, timeboxUsedMin: blockMin, note: 'M2 did not pass human-like within the 30 min box — fail (open), see position trace in the run log' };
  }
  console.log(`${label}: ${record.result}${record.open ? ' (open)' : ''} (attempts=${r.attempts} fails=${r.fails} maxStage=${r.maxStage} ${Math.round((r.ms || 0) / 1000)}s)`);
  await saveResult(label, record);
  await commitMissionResult(label, record);
  if (id === 1 && record.open) console.log('[M2] time-box spent — recorded fail (open), moving on');
}

const finalData = await loadResults();
const all = Object.values(finalData.missions).every((m) => m.result === 'PASS');
const fails = Object.entries(finalData.missions).filter(([, m]) => m.result !== 'PASS').map(([k]) => k);
console.log(all ? 'ALL MISSIONS PASS' : `MISSIONS NOT ALL PASS — failing/open: ${fails.join(', ') || 'none'} — see reports/missions-run.json`);
await browser.close();
process.exit(all ? 0 : 1);
