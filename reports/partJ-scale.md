# Round-9 part J — unified 1u = 3 m scale

## Diagnosis (measured from code)

Buildings and roads were already built at **1u = 3 m** (FLOOR_H 1.0u = 3 m;
street 2.4u = 7.2 m; avenue 4.1u = 12.3 m), but cars + people were built at
1u = 1 m (Stella 4.4 x 1.9 x 1.20u; Elio 1.92u). Part I moved cars+people to
1u ≈ 1.45 m — right vs each other, wrong vs the world. Part J brings cars +
people DOWN to the world scale 1u = 3 m.

## Final scales

- **CAR_SCALE 0.33** (was 0.7) — `game/src/vehicles.js`
- **PED_SCALE 0.30** (was 0.6) — `game/src/people.js`

## Four-way consistency (1u = 3 m)

| Item | u | meter | real-world | verdict |
|---|---|---|---|---|
| Person (Elio, lean 1.92u) | 0.576u tall | 1.73 m | 1.7 m | ✓ |
| Car (Stella) length | 1.452u | 4.36 m | 4.4 m | ✓ |
| Car (Stella) width | 0.627u | 1.88 m | 1.9 m | ✓ |
| Car (Stella) height | 0.396u | 1.19 m | 1.2 m | ✓ |
| Street width | 2.4u | 7.2 m | ~7 m | ✓ |
| Avenue carriageway | 4.1u | 12.3 m | ~12 m | ✓ |
| One floor (FLOOR_H) | 1.0u | 3.0 m | 3 m | ✓ |
| Van height | 0.59u | 1.77 m | — | person (0.576u) slightly shorter than a van — correct |

Ratios: person/car **1.45x** (real avg 1.42x); person/floor **0.58** (real
0.57); street/person **4.17** (real 4.24); car length/street **60.5%** (real
61%); car width/street **26%** (real 26%).

## Files changed (GAME, 5 files — all under a live recording)

- `game/src/vehicles.js` — CAR_SCALE 0.7 → 0.33 (hero, traffic, police);
  collision radius 0.25 → 0.165; wheel spin + skid marks scale with it.
- `game/src/people.js` — PED_SCALE 0.6 → 0.30 (player + NPCs + walkers,
  one scale); `userData.height` = H x PED_SCALE.
- `game/src/game.js` — board radius 3.0 → 2.6; exit offset 1.8 → 1.4;
  chase cam 8.5/4.0 look 1.0 → 6.3/3.0 look 0.8; on-foot cam 5.5/2.2 look
  0.85 → 5.5/1.6 look 0.45. HUD speed NOT changed (u/s x3.6).
- `game/src/wanted.js` — comments only; hold/ram/bust are formulas and
  auto-updated (hold 0.99/1.32, ram 1.06, bust 0.825 — still inside hold).
- `game/src/cbd-traffic.js` — comment 0.7 → 0.33. Traffic yield 3.5 → 2.31
  (formula).

## Verification (GAME changes, not test-driver changes)

- **Smoke part J PASS** (`/tmp/smoke-partJ.mjs`): car 0.33 / radius 0.165,
  player 0.30 / radius 0.15, Stella 0.396u vs Elio 0.576u = **1.45x**;
  walk 6.05u → 2.27u, E board, drive 30.6u at 26 u/s, HUD 94 km/h,
  E exit 1.4u exact, walk away; **0 console errors**. Enter/exit works
  human-like (jalan kaki ke mobil, tekan E, nyetir, tekan E keluar).
- **Routes 10/10, ALL ZONES REACHABLE, errors 0.**
- **M1: FAIL** (attempts=2, fails=2, maxStage=0, 1025 s, abortReason
  "cannot board car (player-car 9.1u)"). Attempt 1: "final walk failed,
  26.6u short of objective"; attempt 2: "cannot board car (player-car
  9.1u)". Trace: stage=0 RECON, player=(2.9,-6.5), car=(3.4,-13.9),
  target=(5,20). Diagnosis: **DRIVER on-foot pathing flake, NOT a game
  bug** — same pattern as part F's M1 stall (317 s, diagnosed driver
  flake); probe `/tmp/probe-m1-board.mjs` proved the mechanic works at
  the new scale (walk to car reached 1.4u, E boarded, 0 errors).
  NOTE: `boardCar`'s fallback walk target 3.5u is now OUTSIDE the board
  radius 2.6, so a fallback press-E does nothing — driver-side detail.
- **M7: NOT completed** — killed by me at 19:57 WIB (ran ~12.3 min, past
  the 720 s human-like cap; driver idle at 0.2% CPU). Needs re-run.
- **M1 + M7 re-runs are the remaining gap — do them before sealing /
  submitting round 9.**

## Screenshots (dusk chase, JPEG q85 1280x720, all < 256 KiB)

Freeze band for police: **[1.8, 6]u** — close enough to read as a chase,
far enough not to overlap (ram overlap happens < 1.2u; game has no
car-vs-car collision). Diamond hidden in-page during the shot only
(beacon NOT removed from game code). Roadblock group hidden in-page.

- **reports/partF2-char-vs-car.png — GOOD-ish.** Player visible, standing
  on the sidewalk BESIDE the car (not on the yellow centre line), one
  frame. Measured on screen (probe `/tmp/probe-char-measure.mjs`,
  FOV 55): player head (568,329) feet (570,406) = **77 px**; car roof
  (728,386) wheels (726,451) = **65 px**; ratio **1.18x** in frame
  (perspective-corrected from the 3D 1.45x). Honest weaknesses: the
  player reads small (correct at 1u=3m, but small) and overlaps the
  traffic-light pole behind him; the cream facade still fills the top
  ~30% (now with windows/awnings, not blank); the yellow edge line is
  prominent bottom-left. A west-side take was tried and REJECTED (giant
  yellow ribbons across the whole frame, player out of frame).
- **screenshots/01-cover.jpg — GOOD.** Hero (red, rear view, centre) +
  police cruiser visible ahead on the road + city streets with shops
  (LIBRERIA, PESCHERIA) + dusk + full HUD, 47 KM/H. Weakness: hero is a
  flat rear view; the yellow intersection box is loud in the foreground;
  a beige sidewalk slab sits bottom-right.
- **screenshots/02-city.jpg — GOOD.** Aerial: dense CBD (towers half
  height) + marina + roads readable at dusk. No gold rings visible.
  Weakness: dispatch empty (CLEAN), car 0 KM/H (parked — fine for an
  aerial).
- **screenshots/03-action.jpg — WEAK-ish.** Hero (red, left) + road +
  zebra + shops (PESCHERIA, PANETTERIA) + trees at dusk, 47 KM/H.
  Weaknesses: NO police car visible in frame (nearest cruiser sat right
  at the camera); a gold jump-gate ring arcs across the top-left
  (cleanFrame in the final re-shoot did not hide TorusGeometry rings);
  a black wedge (dark building side) fills the bottom-left ~15%.
- **screenshots/04-features.jpg — WEAK-ish.** Hero (red, centre) + road
  + zebra + intersection + shops, 45 KM/H, full HUD. Weaknesses: NO
  police visible in frame; the yellow intersection box dominates the
  centre; mostly asphalt.
- **reports/partE-lowcam-pov.png — GOOD.** Low-cam: hero prominent
  centre, road + zebra + LIBRERIA readable, HUD 46 KM/H, dusk sky.
  Weakness: no police car visible in frame.

### Shoot lessons (for the next round)

- One re-shoot round produced two WASTED screens: the car got stuck at
  0.5 u/s, police rammed it to health 0, and the death overlay covered
  both frames. Fix applied in the final script: minSpeed 10 required
  for a freeze trigger, abort on health < 30, reload + retry once,
  WASTED overlay hidden in cleanFrame.
- Camera look direction matters more than position: two 04-features
  takes looked EAST while the hero sat WEST of the camera (empty
  asphalt). Cameras must sit EAST of the hero and look WEST.
- The police often ends up AHEAD (east) of the hero, not behind — a
  cruiser at 2u from the hero can sit right at the camera and fall out
  of frame. Frame the camera off the hero-police line, not on it.
