# Round-9 part N — realistic body proportions (Xian 21:09)

Xian rejected 03-action part L: "karakter dan npc kenapa lonjong
panjang begitu goblok.. benerin semua proporsi tubuh dengan bangunan
sekitar". Diagnosis (measured from code, verified before changing):
Elio's HEIGHT was already right (PED_SCALE 0.30 → 0.58u = 1.73 m;
one floor FLOOR_H 1.0u = 3.0 m; Elio = 0.58x one floor, real 0.57x).
What was wrong was the SHAPE inside that height: fashion-illustration
construction in `people.js` — legs too long, torso too narrow, head
too small — so the silhouette read as a stretched stick next to the
buildings. This is NOT a scale problem: CAR_SCALE (0.33), PED_SCALE
(0.30), FLOOR_H (1.0) and all world scales UNCHANGED. GAME change:
only the body construction in `game/src/people.js` (makeFigure +
makeWalker, shared by player, all NPCs, all walkers, mission figures).

## Proportions old vs new (lean archetype, Elio, H = 1.92)

| measure | old | new | real human |
|---|---|---|---|
| legs (hip height) | 0.52H | 0.48H | 0.48–0.50H |
| torso height | 0.30H | 0.32H | ~0.30H |
| chest width | 0.152H (0.34g) | 0.215H (0.48g) | ~0.24H |
| chest depth | 0.090H (0.20g) | 0.125H (0.28g) | ~0.13H |
| head diameter | H/8.6 (0.116H) | H/7.5 (0.134H) | H/7.5 |
| thigh diameter | 0.067H | 0.090H | ~0.095H |
| arm (shoulder→fingertip) | ~0.34H | ~0.40H | ~0.44H |
| foot length | 0.125H | 0.146H | ~0.15H |
| total height | 1.00H | ~0.99H | 1.00H |

Derived: shoulder span 0.144u (was 0.102u) → height/shoulders 4.0:1
(was 5.7:1; real ~3.8:1). Accent stripe / apron / scarf / rope torus
z-positions moved out to the new chest face (0.15g); neck thickened
(0.055); hand anchor moved to the new forearm end (-0.19H). Hats,
glasses, headphones scale in headR units — automatic. No other file
references legLen/torsoH/headR/torsoW (grep: only people.js), so walk
animation (findLimbs/animateWalk, pivot-based), lineup nameplates
(userData.height = H x PED_SCALE, unchanged) and board radius (2.6u)
are unaffected.

## Verification (probe `/tmp/probe-char-compare.mjs`, FOV 55, dusk)

Elio on the east sidewalk (2.8, -12) facing the camera, Stella parked
on the road beside him (0.3, -12), buildings both sides. Takes 1–3
were rejected (take 1: tree + monorail slab hid Elio; take 2: traffic
light pole hid Elio; take 3: same pole + giant waypoint diamond in
frame — diamond now hidden in-probe only). Take 4 (final):
- Elio height 56.1 px; one floor 97.3 px at the facade plane →
  depth-corrected Elio/floor = **0.54x** (target 0.57–0.58; facade
  plane x=4.5 is approximate).
- Elio/car = 56.1 / 38.6 = **1.45x** (target 1.42x).
- Shoulder span 14.1 px front-on → height/shoulders **4.0:1**
  (old build would read 5.7:1).
- 0 console errors, 0 page errors.
- File: `reports/partN-char-vs-building.png` (JPEG q85, 136,788 B).
- Honest weakness: Elio is small in the frame (56 px) — the fix is
  measurable but hard to judge at that distance; the close-up proof
  is the 03-action re-shoot below.

## 03-action re-shoot (same `?shot=widefire` staging as part L)

- File: `screenshots/03-action.jpg` (1280x720 JPEG q85, 150,900 B).
- Elio big + central, firing (muzzle flash + tracers both ways),
  2 police cars visible ahead + dispatch Anchor-2/Vespa-1 9 m,
  ped on the right sidewalk, full HUD, dusk, colorful minimap
  (part M) now visible in the HUD. 0 console errors.
- Honest weaknesses (same as part L): the muzzle flash still partly
  covers Elio's head/shoulders; pose is stiff (arms at sides, no
  visible gun mesh — flash + tracer carry the shooting); the police
  cars read as dark cars. The elongated-stick look is gone: the torso
  reads visibly broader and the head is bigger.

## Spot-checks (GAME change — proportions; driver unchanged)

- M1: PASS human-like, 59 s (attempts=2, fails=1, maxStage=2).
  Attempt 1: player got WASTED by police damage during the escape
  drive (46 s) — boarding + driving worked; attempt 2 passed.
  Boarding itself was never the failure. Driver auto-committed
  `945116c`. M7 NOT re-run (PASS part K; proportions do not touch
  mission logic).
- Routes: **10/10 zones reachable, errors: 0** (`/tmp/routes.json`:
  marina, oldtown, promenade, cbd, commercial, residential, hills,
  lighthouse, countryside, quarry — all reachable out + back;
  longest quarry 28 s round trip). Exit 0 = ALL ZONES REACHABLE.
