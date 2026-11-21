# Item 3 — Street cleanup: BEFORE / AFTER

Scope: Xian 22 Nov 02:15 brief, item 3 (markings, sidewalks/furniture,
monorail, peds, perf). Builder: b8bedb35 (died 04:42 WIB, context limit)
-> 50f05a77 (this run). Recording 01a1ffc4 (stage1f) live throughout.
All counts from the same audit script (`/tmp/sidewalk-audit-page.mjs`,
footprint rule: a part counts when its footprint AABB / radius disc
intersects a road rect; ped paths sampled at 101 points, flagged when
len > 6 and on-road fraction > 0.5).

## Headline (same methodology)

| Measure | BEFORE (acb52af) | AFTER (92c24fc) |
|---|---|---|
| Furniture on asphalt | **124** | **0** |
| Avenue-tree canopy overhang > 0.03 | 51 / 51 (max 0.742) | **0** (max 0.012) |
| Monorail pillars in intersections | 3 of 11 | **0 of 8** |
| Pedestrians | 6 | **40** |
| Ped paths on asphalt (assigned) | 2 | **0** |
| Ped paths on asphalt (whole pool) | 14 / 53 | **0 / 55** |
| Markings overlaps | 1916 (73c69b8) | **0** |
| Whole-city ortho draw calls | 255 | **238** |
| Avenue on-foot draw calls | 340 | 392 (+52 = walkers in view) |

Raw files: `reports/sidewalk-audit-true-before.json` (BEFORE re-run with the
current script — reproduces the original BEFORE exactly: 124, same
breakdown), `reports/sidewalk-audit-after.json`,
`reports/markings-audit-before.json` (1916),
`reports/markings-audit.json` (0), `reports/perf-before.json`,
`reports/perf-after.json`, shots `cbd-shots/markings-after-*.png`.

## BEFORE breakdown (124)

bollards 1, bins 2, trafficlights 2, cbd-trafficlights 7,
cbd-avenue-trees 19, cbd-median-trees 2, cbd-benches 13, cbd-bins 4,
cbd-hydrants 6, cbd-dirsign-poles 4, zones-lamps-pole 64.

## What changed (GAME fixes, commits)

- `729c228` — CBD furniture to the sidewalk strip: lamps/trees/benches/
  bins/hydrants/dir-signs off the asphalt (outer-edge trunks, small
  canopies, narrowed benches/bins, hydrant base clears the road edge);
  monorail pillars skip intersections; quay bollards/bins off the
  boundary streets; street sidewalk 0.4 -> 0.5.
- `d8b1cb8` (previous builder) — markings via registry: 1916 -> 0
  overlaps (page + registry audits agree).
- `21c3c2e` — lamps clear every road rect: offset 0.04 -> 0.12 (pole
  base r 0.07, clears by 0.05) + a GLOBAL rect check in `zoneRoadsInto`
  (own zone + all 5 zone defs + ring/CBD rects). Adjacent zones build
  streets 2 apart (residential x=119, outer x=121) with no sidewalk
  between them — a lamp on the shared edge stood on the neighbour.
  CBD boundary lamps flip to the inner side; ring signals move inward
  to |x| 35.6 (the old +4.4 put the east pole on the connector road).
- `801f0b9` — 40 walkers: 6 named civilians (full figures) + 34
  generated neighbours as cheap 7-mesh `makeWalker` figures (same
  pivots, so `animateWalk` works; full figures would cost ~450 extra
  draw calls, walkers ~240). Ped paths moved onto sidewalks: boulevard
  z +/-2.75 (the old +/-2.0 was asphalt — the avenue road is 4.8
  wide, not 3.5), ring x +/-45.35, Corso x 2.75, old-town connector
  sidewalks x -44.5 / -35.5, ring avenue south sidewalk z -37.5,
  residential z -40.75.
- `3892dab` — ring boulevard ped path z 1.5 -> 2.75.
- `92c24fc` — AFTER proof: 5 shots + `reports/perf-after.json`.

## The 252 intermediate (honest note)

An intermediate audit run showed 252 on asphalt. That was NOT a
regression in the game: the d8b1cb8 markings fix had moved zone lamps
from the sidewalk centre to the kerb strip (+0.04), and the audit
measures footprints (pole base r 0.07 overlaps the road edge by 0.03).
The same-methodology comparison is 124 -> 0. The strip position was
kept (lamps belong at the kerb) and the offset was corrected to +0.12.

## Perf (SwiftShader — a lower bound, never game performance)

Avenue on foot, 30 manual renders, 1280x720: avg 6215.6 -> 6827.4 ms
(+9.8%), median 6569 -> 7000 ms (+6.6%), calls 340 -> 392, triangles
547504 -> 538040 (-1.7%). The ms change is inside SwiftShader
run-to-run noise on shared CPU (the BEFORE run itself ranged 25..8576
ms); the cost is the software rasterizer, not the game — this probe
measures render time only, no game logic. Draw calls: city-top
255 -> 238, intersection-top 222 -> 227, ring-junction 246 -> 268,
street-car 432 -> 488, street-ped 237 -> 285. All views under 600
(worst 488, street-car). The street-view increases are the walkers
visible up close (~7 walkers x 7 meshes); at city scale the
crossing-skipped trees/benches and skipped lamps outweigh them.

## Still open (not item 3)

- Missions: M5/M8 GAME pavilion walk blocked (scan), M6 TIMEOUT 249 s
  with 33e8d61 (car stalls x=-44.7), M9 FAIL busted while laying low;
  M10/M11 open (triage table 23614f5). The GAME fixes for these were
  NOT part of item 3 and are still undone.
- Item 3 box used: ~2 h 05 min (03:21 launch of b8bedb35, incl. the
  04:42 context-limit relaunch; this run 04:42-05:25 WIB).
