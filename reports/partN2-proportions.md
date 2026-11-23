# Round-9 part N2 — the player was 3.3x stretched (root cause + proof)

Xian rejected 03-action part L: "karakter dan npc kenapa lonjong
panjang begitu goblok". Part N fixed the body CONSTRUCTION (people.js:
shoulders 0.102u -> 0.144u, head H/7.5, legs 0.48H) — but the close-up
proof was weak (Elio 56 px) and the 03-action flash still covered his
head. This round found the REAL bug underneath: **the player mesh was
rendered 1.9u tall in the world, not 0.58u** — a stale scale line from
the PED_SCALE=1.0 era.

## Root cause (measured, not assumed)

- `game/src/game.js:1362` (runs every on-foot step):
  `playerMesh.scale.y = player.crouched ? 0.82 : 1;`
  This clobbered the Y component of the uniform PED_SCALE 0.30 set by
  `makeFigure` (`people.js:210`, `root.scale.setScalar(PED_SCALE)`).
  Result: mesh scale (0.30, **1.0**, 0.30) — Elio 1.9u tall, 0.24u wide.
- Proof (probe `/tmp/probe-n2-where.mjs`, mesh bbox from matrixWorld):
  BEFORE fix: bbox y **0..1.9**, scale (0.3, 1.0, 0.3).
  AFTER fix: bbox y **0..0.57**, scale (0.3, 0.3, 0.3). Elio = 0.57u.
- The magenta test (`/tmp/probe-n2-magenta.mjs`) confirmed it visually:
  painted magenta, the figure filled the whole frame height and was cut
  off at the top from 3u away — a 0.58u figure would be 216 px.
- NPCs were NEVER stretched: nearest ped bbox y 0..0.46, scale
  (0.3, 0.3, 0.3) — uniform all along. Xian's "npc lonjong" read came
  from Elio dominating the frame + the old narrow construction (fixed
  in part N). No NPC code changed.

## Two more stale-scale constants (same era, masked each other)

The stretched Elio (shoulder 1.49u) happened to line up with the old
muzzle height, so the shootout LOOKED attached. Fixing the scale alone
would have floated the flash 0.8u over his head — all three fixed together:

- `game/src/combat.js` muzzleWorld: origin y **1.4 -> shoulder**
  (`(p.height || 0.576) * 0.78`, height passed via getPlayer as
  `playerMesh.userData.height`). Shoulder = 0.78 x stature
  (hip 0.48H + torso 0.32H x 0.92).
- `game/src/combat.js` return fire: from (cruiser roof) **1.5 -> 0.50**,
  to (player chest) **1.2 -> 0.36**. Old beams started 1.1u over the
  cruiser roof and ended 0.85u over Elio's head.
- `game/src/game.js:1362`: `playerMesh.scale.y = PED_SCALE *
  (player.crouched ? 0.82 : 1)` — crouch still lowers the figure, now
  proportionally. PED_SCALE was already imported in game.js.

All four edits are GAME changes (no driver change, no geometry change
in people.js — the part N construction was already right).

## Close-up proof (no flash, no shooting)

`reports/partN2-char-closeup.png` — Elio front-on on the sidewalk,
Stella behind-left, facade behind-right. Probe
`/tmp/probe-n2-closeup.mjs` (FOV 35 telephoto, mode='shot' frozen so
the play-mode camera cannot overwrite the probe camera — takes 1-2
failed on exactly that: the render and the projection disagreed).

Measured in-frame (projected from the mesh, verified by reading the
image): Elio **219.6 px** tall (target 200+), shoulder 53.9 px,
head 29.0 px, legs 105.4 px:
- height/shoulders **4.07:1** (target ~4.0; real ~3.8; old 5.7)
- head/height **0.132 = 1/7.6** (target 1/7.5)
- legs/height **0.48** (target 0.48)
- Elio/floor (depth-corrected) **0.54x** (target 0.57-0.58; facade
  plane approximate — same as part N)
- Elio/car in-frame 2.36x — DEPTH-DISTORTED (Stella sits 2u further
  north than Elio); at equal depth part N measured **1.45x**
  (target 1.42x).
- 0 console errors, 0 page errors.

The figure reads as a proportional human now: broad cream torso with
red accent, proportional head, normal legs. NO geometry change needed
(the brief's condition is met — the close-up proves it).

Honest weaknesses of the close-up: Elio is front-on and stiff (arms at
sides — a proof pose, not an action pose); Stella is small, seen from
the rear-left; a white crosshair (+) sits mid-frame; the dark monorail
pillar edges the frame centre. The building floor lines read behind him.

## 03-action re-shoot (same ?shot=widefire staging, Corso/Lungomare)

`screenshots/03-action.jpg` — probe `/tmp/probe-n2-03action.mjs`:
camera three-quarter (2.6, 1.4, -6.2) looking at Elio's chest, muzzle
flash shrunk in-page (scale 1.08 -> 0.5, light 6 -> 2.5), gold waypoint
diamond hidden + re-rendered. Take 1 (low eastern camera) failed: the
monorail beam filled the top 55% of the frame. Take 2 looked 6u past
Elio (he sat at the bottom edge). Take 3 (final): Elio big +
centre-left, back three-quarter, broad torso, proportional head and
legs; flash 48.5 px from his head centre (radius 30.6 px) — it does
NOT cover his head/shoulders; tracers cross both ways; 2 cruisers
ahead + dispatch Anchor-2/Vespa-1 9 m; 1 ped on the left sidewalk;
full HUD (TAMBURO 23/96, wanted 2*), dusk, colourful minimap; 0 errors.

Honest weaknesses: Elio is shot from behind (no face; stiff pose,
arms at sides, no visible gun mesh — flash + tracers carry the
shooting); police cars read as dark cars (light bar visible on the
left cruiser); tracer beams are very wide; only 1 ped clearly visible.

## Notes / open issue (NOT fixed in this round)

- Figures sink into the ground in normal play: the game puts figures
  at y=0 (`groundHeightAt` returns 0 everywhere) while the road top is
  ROAD_Y=0.20 and the sidewalk top is 0.24. Elio's feet sit 0.2u under
  the asphalt on roads, 0.24u under the sidewalk top. Cars sit
  correctly at ROAD_Y. For the close-up Elio was placed in-probe at
  the true surface heights (0.24 sidewalk / 0.20 road) so his feet show.
  Fixing it in-game needs road/sidewalk-aware ground height — a
  separate round, not a one-liner (lifting everything 0.2u would float
  figures on plazas/ground). Reported, not changed.
- M1 spot-check re-run after the scale fix: **PASS human-like, 42 dtk**
  (attempts=2, fails=1, maxStage=2; driver auto-commit `1e13234`).
  Attempt 1: player WASTED by police damage during the escape drive
  (39.6 dtk, health 0 — same failure mode as part N's M1 run; return
  fire damage is probability-based, the `to` height only moves the
  tracer visuals). Attempt 2 passed. Boarding + driving worked throughout.
  M7 not re-run (PASS part K; the scale fix touches the player mesh +
  combat heights, not mission logic).
