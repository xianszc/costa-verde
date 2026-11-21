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
// Causes of the 21 Nov failures (fixed, do not regress):
// - M2 TAIL: the player's CAR teleported onto the smuggler's car
//   collides and shoves it, so the 20 s timer never accumulates.
//   Fix: tail on foot, teleport ONLY the player (teleportPlayer),
//   1500 ms between teleports (the 400 ms cadence starved the
//   headless game — timer only ~0.21/s real).
// - M9 LAY LOW: entering the car at mission start let Guard rams
//   keep adding heat + resetting the quiet timer, so the heat never
//   decayed. Fix: play on foot (the A-C run); on foot the pursuers
//   sit ~113 away, the heat decays, and the escape completes.
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

// Teleport ONLY the player (on foot) — the car stays where it is.
// For tail stages: the player's car teleported onto the smuggler's
// car collides and shoves it, so the 20 s timer never accumulates
// (M2 TIMEOUT in the post-expansion re-run; it passed on foot in
// the A-C run). missions.update reads player.x/z when on foot.
async function teleportPlayer(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.player.x = x; g.player.z = z;
  }, { x, z });
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
    // Play ON FOOT (the A-C run): the car-entry fix broke M2 (the
    // player's car teleported onto the smuggler's car) and M9 (Guard
    // rams on a parked car keep adding heat). On foot the M9 pursuers
    // sit ~113 away, the heat decays, and the escape completes.
    let lastStage = 0;
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
      const o = s.objective;
      if (!o) { await sleep(500); continue; }
      if (s.stageType === 'interact') {
        await teleport(page, o.x, o.z);
        await sleep(300);
        await page.keyboard.press('KeyE');
        await sleep(600);
      } else if (s.stageType === 'tail') {
        // Tail ON FOOT (the A-C run): the player's car teleported
        // onto the smuggler's car collides and shoves it, so the
        // 20 s timer never accumulates. Glue only the player (not
        // the car) to the smuggler. Sleep 1500 ms between teleports
        // (the smuggler moves 6 u/s, the range is 18 m) — the 400 ms
        // cadence starved the headless game (timer only ~0.21/s).
        if (!s.onFoot) {
          await page.keyboard.press('KeyE'); // exit the car
          await sleep(600);
        }
        await teleportPlayer(page, o.x, o.z);
        await sleep(1500);
      } else if (s.stageType === 'duel') {
        if (s.duel) {
          await page.evaluate(() => { window.__game.duelTarget.damage(200); });
          await sleep(800);
        } else {
          await sleep(500);
        }
      } else if (s.stageType === 'escape') {
        // Teleport to the safe spot, then wait for the heat to fall
        // to 0 on its own (out of sight of the Guard). No debug
        // clear — the escape mechanic itself is under test.
        await teleport(page, o.x, o.z);
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
