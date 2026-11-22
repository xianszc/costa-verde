// COSTA VERDE perf probe (stage1j, Xian 09:30 brief item B).
// Measures ms/frame + draw calls + triangles at 4 views with Node-driven
// manual renders (same method as reports/perf-before.json / perf-after.json).
// SwiftShader render time is a LOWER BOUND, never quoted as game
// performance — it measures the CPU software rasterizer, not the game
// logic or real-GPU frame time.
//
// LESSON (cross-check /tmp/perf-crosscheck.mjs): the live rAF loop
// repositions the camera every frame (updateCamera follows the player),
// so setting the camera ONCE per view and then rendering N times measures
// the PLAYER view, not the named view. Fix: set the camera inside EVERY
// timed iteration, synchronously with the render, in one evaluate task.
// (The loop still renders concurrently, so times carry contention noise;
// the median is the reported number.)
//
// Views (camera pos -> lookAt, viewport 1280x720):
//   avenue    — on foot at (0, 0.2, -20) looking down Corso Azzurra to
//                (0, 0.5, 20) [same camera as perf-after.json baseline]
//   ring      — street level on the east ring road (44, 2, -20) -> (44, 2, -60)
//   promenade — (35, 2, 29) looking west along the promenade -> (-20, 2, 29)
//   city      — high top view (0, 200, 40) -> (0, 0, 0)
// Usage: NODE_PATH=/tmp/node_modules node game/test/perf-probe.mjs
// Writes reports/perf-stage1j.json. Exit 0 always (report only).
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8941';
const CHROMIUM = '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = 20;

const VIEWS = {
  avenue: { pos: [0, 0.2, -20], look: [0, 0.5, 20] },
  ring: { pos: [44, 2, -20], look: [44, 2, -60] },
  promenade: { pos: [35, 2, 29], look: [-20, 2, 29] },
  city: { pos: [0, 200, 40], look: [0, 0, 0] },
};

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('page: ' + String(e)));
await page.goto(BASE + '/?debug=1&skip=1', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__game && window.__gameReady === true, undefined, { timeout: 180000 });
await sleep(1500);
await page.evaluate(() => window.__game.startPlay());
await sleep(8000); // let traffic + peds spread out

const out = { method: 'Node-driven manual renders (same method as reports/perf-after.json). Camera re-set inside EVERY timed iteration (the live rAF loop moves it otherwise — see cross-check). SwiftShader = LOWER BOUND, not game performance.', when: new Date().toISOString(), renders: N, views: {}, errors: errors.slice(0, 10) };
for (const [name, v] of Object.entries(VIEWS)) {
  const r = await page.evaluate(({ pos, look, n }) => {
    const g = window.__game;
    const times = [];
    for (let i = 0; i < n; i++) {
      g.camera.position.set(pos[0], pos[1], pos[2]);
      g.camera.lookAt(look[0], look[1], look[2]);
      const t0 = performance.now();
      g.renderer.render(g.scene, g.camera);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      avgMs: +avg.toFixed(1), medianMs: +times[Math.floor(times.length / 2)].toFixed(1),
      minMs: +times[0].toFixed(1), maxMs: +times[times.length - 1].toFixed(1),
      calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles,
      cars: g.traffic.length + (g.cbdTraffic || []).length, peds: g.peds.length,
    };
  }, { pos: v.pos, look: v.look, n: N });
  out.views[name] = { ...r, camera: `pos (${v.pos}) -> look (${v.look})` };
  console.log(`${name}: avg ${r.avgMs} ms, median ${r.medianMs}, calls ${r.calls}, tris ${r.triangles}`);
}
await writeFile('reports/perf-stage1j.json', JSON.stringify(out, null, 2));
console.log('wrote reports/perf-stage1j.json');
await browser.close();
