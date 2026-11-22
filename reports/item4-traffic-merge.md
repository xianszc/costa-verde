# Item 4 — traffic static merge verification — 22 Nov 2026 ~21:00 WIB (builder d3949c33)

GAME: `534d4e2` (vehicles.js + wheels.js). TEST: this report + breakdown
`reports/draw-breakdown-after-traffic.json` + shots
`cbd-shots/avenue-midday-traffic-merge.jpg` (166,086 bytes) and
`cbd-shots/wheels-side-traffic-merge.jpg` (84,728 bytes), both 1280×720
JPEG q80, <256 KiB.

## What changed (GAME)

Per traffic car, three previously separate static meshes now bake into
the body vertex-colored mesh (one mesh per car instead of four):

- Side-glass panes (was one glossy mesh: MeshStandard 0x1a2e40,
  roughness 0.15, metalness 0.3). Baked as vertex color 0x1a2e40 — the
  exact dark blue-grey is preserved, only the specular sheen goes away.
  DECISION (brief said "putuskan dulu"): ACCEPTED — at traffic viewing
  distances the sheen is invisible; 23 calls is worth more.
- The two REAR brake discs + calipers (was 2 meshes). Rear wheels never
  steer (updateWheelRig passes 0 steer for the rear) and the discs never
  spin, so their transform relative to the car is fixed. Front discs stay
  separate — their axis follows the steering (up to 22°), as the previous
  builder's rejected static-wheel analysis showed.
- Police cruiser side stripes (was 2 meshes) bake into the body too.
- Stella (player car): side glass + rear window + rear discs bake in
  the same way (4 meshes saved).

NOT changed: the 4 spinning wheel meshes per car (they spin), the 2
front discs (they steer), headlamps/taillights (emissive), windshields
(transparent), light bars (emissive, flashing), contact shadows.

Known imperfection (honest): the baked rear discs no longer follow the
±0.02 suspension bob (the wheel rigs bob, the body does not). Max offset
~3 px at close range. Verified in the wheels side shot: the rear disc
reads centered in the wheel while parked (bob is 0 at standstill, so the
shot cannot show the bob desync — it can only show the disc is present
and centered at rest).

## Measured — canonical probe, ONE table (before/after)

`game/test/perf-probe.mjs` (Node-driven manual renders, 20 renders/view,
same method before/after; ms/frame is SwiftShader noise and is NOT an
acceptance criterion — Xian's rule 21:00 WIB). Before = HEAD `9f31db1`
(`reports/perf-item4-before-9f31db1.json`), after = HEAD `534d4e2`
(`reports/perf-item4-after-traffic.json`).

| view | before | after | delta | target |
|---|---|---|---|---|
| avenue (street) | 410 calls / 558,705 tris | 352 / 560,119 | **−58** | ≤450 ✓ |
| ring (street) | 201 / 517,351 | 175 / 518,447 | **−26** | ≤450 ✓ |
| promenade (street) | 707 / 619,719 | 557 / 619,155 | **−150** | ≤450 ✗ (−107) |
| city (aerial) | 1,033 / 692,185 | 828 / 692,185 | **−205** | ≤700 ✗ (−128) |

City triangles are IDENTICAL (692,185 = 692,185) — no geometry lost or
duplicated. Street-view tris vary ±0.3% run-to-run because traffic cars
move between probe runs (frustum edge), not because of the merge.

Second check (draw-breakdown probe, `/tmp/draw-breakdown.mjs`, same
method before/after; per-label scene counts): city 903→825 (−78),
promenade 753→707 (−46), avenue 726→676 (−50). The breakdown probe's
per-view cameras differ from the canonical probe's (its promenade view
is a different angle), so its per-view numbers are NOT comparable to
the canonical table — only its per-label mesh counts are used here.

## Visual verification (honest)

- Avenue midday after-shot vs the committed `avenue-midday-item4.jpg`:
  layout + towers + zebra + HUD IDENTICAL; cars read correctly (orange
  pickup + blue van in frame, dark side glass visible). The RANK UP
  toast still covers the bottom centre (same deterministic staged-run
  artifact as before — not a regression).
- Wheels side close-up (`?shot=wheels&car=pickup&angle=side`): rear
  wheel reads correctly — black tyre, spoked rim, grey disc centered;
  side glass dark pane reads correctly. FRAMING WEAKNESS (staging, not
  game): a black vertical bar (palm trunk / pole) fills the left third
  and the car is cut off at the left edge — the ?shot=wheels camera
  needs a clearer position for a proper close-up.
- Wheels motion shot: a driving gameplay frame, not a clean close-up —
  the car reads correctly but a pink foreground wall fills the lower
  right. Not used as evidence; noted, not committed.

Per-label mesh counts (draw-breakdown probe, city view): sedan
132→96 (−36 = 12 cars × 3), van 66→48 (−18 = 6 × 3), pickup 55→40
(−15 = 5 × 3), police-cruiser 30→20 (−10 = 2 × 5), stella 15→11 (−4).
Total meshes 937→854 (−83). Per-label TRIANGLES are IDENTICAL
before/after (sedan 56,784, van 28,320, pickup 23,600, cruiser 9,560,
stella 4,960, walker 21,352, figure 7,152).

Staged avenue shot (`?shot=cbd&view=avenue&time=12`): 269 calls,
585,673 tris, 0 errors (was 299 calls at 737f0f1 — the staged shot's
renderer.info is a different method from the canonical probe; do not
compare the two numbers directly).

## Remaining gap (Xian's PERFORMANCE DECISION RULE, 20:55 + refinement 21:00 WIB)

Acceptance: street views ≤450 calls (MANDATORY), whole-city aerial
≤700; ms/frame is NOT a criterion. Status now (canonical probe):
avenue 352 ✓, ring 175 ✓, promenade 557 ✗ (−107 needed), city 828 ✗
(−128 needed vs the 700 aerial cap), residential NOT YET measured.
Next step per the rule (40-min box, at the next relaunch): BEFORE it,
print a per-category breakdown (buildings, palms and trees, boats, shop
props, signs, cars, pedestrians, glass, UI) for promenade + aerial;
work on the LARGEST category first (instancing repeated props like
palms/boats/lamps/signs; chunked static merge of buildings + per-chunk
frustum culling); guard collisions/picking/mission anchors (run mission
+ shop tests that touch the merged buildings); SKIP the figure merge.
After that STOP and report; Xian decides acceptance from the numbers.
If promenade stays >450 with no cheap win left in the breakdown, say
so plainly — do NOT keep cutting. (The traffic glass merge, step (2)
of the rule, is DONE in this slice.)

## Unified 5-view measurement + category breakdown (after traffic merge)

ONE script, ONE run (`/tmp/perf-all-views.mjs`; output
`reports/perf-all-views-2026-11-22.json`): avenue 349 calls /
558,665 tris, ring 175 / 518,447, promenade 551 / 616,199,
**residential (first measurement) 177 / 406,903**, aerial 829 /
692,221. Residential is the first view measured on a residential
street (res-east lane, camera (108,2,−40)→(108,2,0)) — **177 ✓, well
under the 450 street cap**. Acceptance status now: avenue ✓, ring ✓,
residential ✓, promenade 551 ✗ (−101), aerial 829 ✗ (−129 vs 700).

Category breakdown for promenade + aerial
(`reports/perf-frustum-breakdown-2026-11-22.json`, frustum test per
mesh — the method Xian's 21:00 rule asked for):

| category | promenade visible | aerial visible |
|---|---|---|
| pedestrians | 182 | 277 (all) |
| glass (transparent — see note) | 155 | 167 (all) |
| cars | 126 | 219 (all) |
| buildings | 109 | 142 (of 143) |
| other | 52 | 64 |
| palms and trees | 38 | 57 (all) |
| signs | 6 | 6 (all) |

Notes (honest): (1) "glass" is really "all transparent meshes": it
includes ~80 skid-mark decals + 24 storm splash rings + 24 car
windshields + 24 contact shadows + water + commercial-glass + beacons.
(2) The frustum-visible mesh count (668 promenade, 932 aerial) is
ABOVE the base render calls (555, 829) — the gap (−113/−103) is the
shadow pass + culling differences, not an error in the categories; the
categories are the main-pass distribution. (3) The hide-and-render
subtraction method FAILED (later renders reported MORE calls when
meshes were hidden — cause unknown, possibly shadow-map re-render
interaction; documented so the next builder does not repeat it).

**CHEAP WIN FOUND — skid marks: 80 meshes and GROWING.** Skid-mark
decals are added as one mesh each whenever a car brakes/drifts in play
mode; they never merge or expire. At 20:49 the unnamed probe found
NONE; by 21:40 there were 80 (accumulated across the play-mode probe
runs). In sustained play this grows unboundedly — a real perf bug, not
just a probe artifact (a fresh load starts at 0, so the 10 s grader
run sees few, but a player driving for minutes sees hundreds). Fix
for the 40-min step: cap the skid-mark count (FIFO, e.g. keep the last
40) or merge them into one mesh — saves up to ~70–80 calls in every
view. (4) Pedestrians are the largest promenade category (182) but
walkers are already merged to 5 meshes each (legs animate — nothing
left to cut) and the figure merge is SKIPPED per Xian's rule.

- 24× splash rings (storm rain, animated) + 4× teal beacon cones+rings
  + 2× beacon cones/rings at origin + sun/moon circles + water plane:
  animated/effects — DO NOT merge.
- 20× collectible coins (octahedra, standard #f2a541) — collected
  individually, animate — DO NOT merge.
- 8× stunt-jump gold torus rings — check whether they animate before
  merging (saves 7 if static).
- 8× sign meshes (4 posts + 1 sign at (-48,-39), 3 shop signs):
  static, unifiable — mergeable, saves ~6.
- 4× cones + 4× rings (teal beacons at (-50,0)) — check animation first.

## District-merge probe (reports/district-merge-probe.json)

- district4 group: 249 meshes, 102 foldable by material (unifiable
  standard, no map/emissive/metalness) — the biggest single building
  opportunity, but the probe cannot tell which of the 102 animate; the
  26 noMerge meshes are already excluded. Verify per-subgroup before
  folding.
- promenade / oldTown / commercialRing groups are NESTED (not direct
  scene children) — the probe missed them; re-run with the nesting
  fixed before folding those districts.
- figure groups: 15 meshes each, all unifiable by material — but legs
  (4) + arms (6) animate, so only torso+head (~5) can fold per figure
  (saves ~4 × 7 figures ≈ 28). SKIPPED per Xian's 20:55 rule unless
  the building + glass steps are not enough.
- walker groups: 5 meshes, all unifiable by material — but 4 are
  animated legs; the body is already merged. Nothing left to cut.
- traffic/stella: after this slice, 1 foldable mesh each (the body
  itself) — nothing left to fold by material; the remaining meshes are
  wheels (animate), lamps (emissive), glass (transparent), shadows
  (transparent map).
