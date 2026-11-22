// AZZURA HEIST — game entry point (wheel fix round).
// Boots the real game from game.js: the title screen shows the actual
// District 4 (real scene — layered hills, bay water, quay, ground detail),
// never flat color bands. Enter starts play (walk / drive / chase camera /
// traffic / pedestrians / wired HUD / day-night / storm / wanted / combat /
// hub / radio / save / missions M1–M12 (M10 was cut).
//
// ?shot=title|drive|walk|night|storm|road|wanted|combat|hub|mission stages
// that scene deterministically (fixed steps, scripted inputs), paints it
// twice and sets window.__shotReady for a screenshot.
// ?shot=cbd&view=street|bay|top stages the CBD core directly (no title):
// street-level inside the CBD, from the bay at the skyline, or top-down.
// ?debug=1&skip=1&at=cbd_center is the same as ?shot=cbd&view=street.
// Every staged shot also sets window.__ready — the test waits for it.
// ?shot=road&district=oldtown|marina|quarry|promenade|countryside|skyline
// [&night=1] stages one road surface. ?seed=N is accepted for
// determinism and recorded in the shot stats.
//
// ?shot=wheels&car=player|pickup|police&angle=front34|side|rear34|motion
// stages a close-up of one car's wheels (front 3/4, side, rear 3/4, or a
// low in-motion shot with the car mid-drive and drift marks behind it).
// The car is parked at a clean spot facing +X, its wheels posed with a
// visible spoke angle (slight front steer on front34), the camera placed
// by hand, and the scene rendered twice with __shotReady set.
import { createGame } from './game.js';
// 3c SIDE CONTENT WIRING (22 Nov): sidecontent.js self-boots by polling
// for window.__game — but it was never imported, so it never ran (dead
// code since M4). This side-effect import wires the full-screen map
// (M), side jobs/races, shops, collectibles, stunt jumps, standing and
// rank unlocks into the game.
import './sidecontent.js';
import { ANCHORS } from './anchors.js';
import {
  buildTrafficCar, buildPoliceCruiser, createCar, ROAD_Y,
} from './vehicles.js';
import { poseWheelRig, addSkidMark } from './wheels.js';

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
window.__gameErrors = errors;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = params.get('seed') || '1';

const app = document.getElementById('app');
const game = createGame(app);
// Debug: expose the game to the shot tooling (camera placement, stats).
window.__game = game;
// Test-only fast simulation: ?fastsim=N steps the game logic at a
// fixed 1/60 s dt without rendering, ~N× wall-clock in headless.
// OFF in normal play (no param = factor 1, behaviour identical).
// AUDIT m-38: factor 4 is the proven max for the mission driver
// (fastsim-proof.md: J1/M1 outcomes identical at fastsim=4 vs 1);
// 8x needs poll retuning in game/test/missions.mjs.
const fastsim = Math.max(1, Math.min(8, parseInt(params.get('fastsim') || '1', 10) || 1));
if (fastsim > 1) game.setFastSim(fastsim);

function stageWheels() {
  const carKind = params.get('car') || 'player';
  const angle = params.get('angle') || 'front34';
  // Base scene: golden-hour drive staging (play mode, HUD, lighting).
  game.stageShot('drive', { seed, district: 'oldtown', night: '0', storm: '0', time: params.get('time') });
  // Wheels are the subject: hide the HUD (its speed readout would be
  // stale — the drive staging ran at 94 km/h before we parked the car).
  for (const id of ['hud-stage', 'topbar', 'title-card', 'version']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  // Pick the target car. Traffic kinds may not be on the road in this
  // staging, so spawn a parked one when the lane has none.
  let target;
  if (carKind === 'player') {
    target = game.car;
  } else {
    const name = carKind === 'pickup' ? 'traffic-pickup' : 'police-cruiser';
    target = game.traffic.find((t) => t.mesh.name === name);
    if (!target) {
      const mesh = carKind === 'pickup'
        ? buildTrafficCar(0x2e7f5e, 'pickup')
        : buildPoliceCruiser();
      target = createCar(mesh, { maxSpeed: 20 });
      game.scene.add(mesh);
    }
  }
  // Park everything else out of the frame; the target gets a clean spot.
  // North lane (z -0.725, anchors.js wheels_spot_*) — the south lane
  // has quay props in the way. (AUDIT m-38: the old "z -3.4" was wrong.)
  // Spots and far spots are named anchors (anchors.js).
  const spots = {
    player: [ANCHORS.wheels_spot_player.x, ANCHORS.wheels_spot_player.z],
    pickup: [ANCHORS.wheels_spot_pickup.x, ANCHORS.wheels_spot_pickup.z],
    police: [ANCHORS.wheels_spot_police.x, ANCHORS.wheels_spot_police.z],
  };
  const [tx, tz] = spots[carKind] || spots.player;
  const far = {
    player: [ANCHORS.wheels_far_player.x, ANCHORS.wheels_far_player.z],
    pickup: [ANCHORS.wheels_far_pickup.x, ANCHORS.wheels_far_pickup.z],
    police: [ANCHORS.wheels_far_police.x, ANCHORS.wheels_far_police.z],
  };
  game.car.x = carKind === 'player' ? tx : far.player[0];
  game.car.z = carKind === 'player' ? tz : far.player[1];
  game.car.angle = 0;
  game.car.speed = 0;
  game.car.mesh.position.set(game.car.x, ROAD_Y, game.car.z);
  game.car.mesh.rotation.y = 0;
  for (const t of game.traffic) {
    if (t === target) continue;
    t.mesh.position.set(45, 0, 30);
    t.mesh.visible = false;
  }
  if (target !== game.car) {
    target.x = tx;
    target.z = tz;
    target.angle = 0;
    target.speed = 0;
    target.mesh.position.set(tx, ROAD_Y, tz);
    target.mesh.rotation.y = 0;
    target.mesh.visible = true;
  }
  // Pose the wheels: spokes at a readable angle, slight front steer on
  // the front-3/4 view so the steering reads too.
  const rigs = target.mesh.userData.wheelRigs || [];
  rigs.forEach((rig, i) => {
    poseWheelRig(rig, 0.6, i < 2 && angle === 'front34' ? 0.18 : 0);
  });
  const cam = game.camera;
  if (angle === 'motion') {
    // In-motion: re-stage the drive so the car is mid-drive with spun
    // wheels, then shoot it low from the side with drift marks behind.
    game.stageShot('drive', { seed, district: 'oldtown', night: '0', storm: '0', time: params.get('time') });
    const c = game.car;
    // Drift trail along the car's path, on both rear-wheel tracks.
    for (let i = 0; i < 8; i++) {
      const bx = c.x - 2 - i * 1.3;
      addSkidMark(game.scene, bx, c.z + 0.8, 0);
      addSkidMark(game.scene, bx, c.z - 0.8, 0);
    }
    const crigs = c.mesh.userData.wheelRigs || [];
    crigs.forEach((rig, i) => poseWheelRig(rig, 0.9, i < 2 ? 0.3 : 0));
    // Pulled back so the whole car AND the drift trail behind it fit.
    cam.position.set(c.x + 1, 1.6, c.z + 8);
    cam.lookAt(c.x - 3, 0.7, c.z);
  } else if (angle === 'side') {
    cam.position.set(tx, 1.0, tz + 4.6);
    cam.lookAt(tx, 0.7, tz);
  } else if (angle === 'rear34') {
    cam.position.set(tx - 3.6, 1.2, tz + 3.0);
    cam.lookAt(tx - 0.4, 0.7, tz);
  } else { // front34
    cam.position.set(tx + 3.6, 1.2, tz + 3.0);
    cam.lookAt(tx + 0.4, 0.7, tz);
  }
  game.renderer.render(game.scene, game.camera);
  game.renderer.render(game.scene, game.camera);
  window.__shotReady = true;
  window.__gameStats = {
    calls: game.renderer.info.render.calls,
    triangles: game.renderer.info.render.triangles,
    mode: 'wheels-' + carKind + '-' + angle,
    time: 18.7,
  };
}

// Debug: ?debug=1&skip=1&at=cbd_center skips the title and loads the
// world directly at the CBD (same as ?shot=cbd&view=street). The test
// waits for window.__ready before screenshotting.
const debugSkip = params.get('debug') === '1' && params.get('skip') === '1';
if (debugSkip && params.get('at') === 'cbd_center') {
  game.stageShot('cbd', { seed, view: 'street', time: params.get('time') });
  window.__gameReady = true;
} else if (shot === 'wheels') {
  stageWheels();
  window.__gameReady = true;
} else if (shot) {
  game.stageShot(shot, {
    seed,
    district: params.get('district') || 'oldtown',
    night: params.get('night') || '0',
    storm: params.get('storm') || '0',
    m: params.get('m') || '1',
    view: params.get('view') || 'street',
    time: params.get('time'),
  });
  window.__gameReady = true;
} else {
  game.run();
  window.__gameReady = true;
}

// ?hud=0 hides every HUD element (map shots: the whole city must be
// visible, nothing cropped by the mission card / panels / minimap).
// A body class, not a one-time inline hide: the side engine manages
// these elements' inline display itself (toast queue, HUD chip, job
// panel) and would undo it, and some elements are created after this
// runs — the CSS rule (hud.css, !important) covers them all.
if (params.get('hud') === '0') document.body.classList.add('hud0');

// Auto-pause when the tab hides mid-game (never run unseen).
// AUDIT m-32: through setPaused() — the old code set the mode +
// overlay by hand and left the hub open over the pause menu.
// TEMP DIAGNOSTIC (revert after the pause hunt): log every transition.
document.addEventListener('visibilitychange', () => {
  console.error('[vis-trace] visibilitychange hidden=' + document.hidden + ' mode=' + game.state.mode);
  if (document.hidden && game.state.mode === 'play') game.setPaused(true);
});
