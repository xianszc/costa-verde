// AZZURA HEIST — game entry point (M2: core systems).
// Boots the real game from game.js: the title screen shows the actual
// District 4 (real scene — layered hills, bay water, quay, ground detail),
// never flat color bands. Enter starts play (walk / drive / chase camera /
// traffic / pedestrians / wired HUD / day-night / storm / wanted / combat /
// hub / radio / save / missions 1–4).
//
// ?shot=title|drive|walk|night|storm|road|wanted|combat|hub|mission stages
// that scene deterministically (fixed steps, scripted inputs), paints it
// twice and sets window.__shotReady for a screenshot.
// ?shot=road&district=oldtown|marina|quarry|promenade|countryside|skyline
// [&night=1] stages one road surface. ?seed=N is accepted for
// determinism and recorded in the shot stats.
import { createGame } from './game.js';

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
window.__gameErrors = errors;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = params.get('seed') || '1';

const app = document.getElementById('app');
const game = createGame(app);

if (shot) {
  game.stageShot(shot, {
    seed,
    district: params.get('district') || 'oldtown',
    night: params.get('night') || '0',
    storm: params.get('storm') || '0',
  });
  window.__gameReady = true;
} else {
  game.run();
  window.__gameReady = true;
}

// Auto-pause when the tab hides mid-game (never run unseen).
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state.mode === 'play') {
    game.state.mode = 'paused';
    const ov = document.getElementById('pause-overlay');
    if (ov) ov.style.display = 'flex';
  }
});
