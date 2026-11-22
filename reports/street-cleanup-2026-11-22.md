# Street cleanup — BEFORE audit + fixes (Xian 22 Nov 09:30 brief, item A)

Builder: 9535d12b. Recording 01a20114 live throughout. HEAD e5e63b4.
Audit script: `game/test/street-audit.mjs` (committed; the old /tmp script
was lost in the 09:19 swap). Method: registry totals + an INDEPENDENT
cross-registry pairwise overlap check (grid-bucketed); colliders vs
minimap segments with EXACT geometry (SAT for AABBs, point-to-segment
for ped paths — the first run used bboxes and over-counted diagonal
ring roads: 88 -> 78). Ped paths sampled at 101 points, flagged when
on-road fraction > 0.5. Raw: `reports/street-audit-before.json`,
`reports/street-audit-after.json`.

## BEFORE (HEAD 25c025e) vs AFTER (HEAD e5e63b4)

| Measure | BEFORE | AFTER |
|---|---|---|
| Markings overlaps (registry + independent) | 0 / 0 | 0 / 0 |
| Markings items (3 registries) | 7,881 | 7,881 |
| Markings skipped by registry | 2,978 | 2,978 |
| Furniture colliders on asphalt (exact SAT) | 78 (75 deep >= 0.5u) | 78 (unchanged — see below) |
| Street furniture on asphalt (lamps/benches/bins/hydrants/signals) | 0 | 0 |
| Ped paths on asphalt (of 85 checked) | 15 | 12 |
| Peds | 40 | 40 |
| Traffic cars (zone + CBD) | 11 + 7 = 18 | 18 |
| Game's own district.report violations | bell-tower overlaps sidewalk x2 | (unchanged) |

## What the 05:07 item-3 claim got right, and what it missed

- RIGHT: markings overlaps 0 (verified independently, cross-registry);
  street furniture 0 on asphalt; peds 40; zone markings present in
  every region (zebra by region: north 1281, centre 484, east 352,
  west 382, south 250).
- MISSED: the ped path at z -37.5 ran ON the old-town main street
  (road z -42.5..-35.5) — the 05:07 report's "ring avenue south
  sidewalk z -37.5" does not exist as a strip. The item-3 audit's
  road rects must have been narrower than the minimap's (its script
  is gone, so this cannot be re-checked).

## GAME fixes in this run

- `e5e63b4` — (1) Showcase zebra (roads.js `buildRoadShowcase`):
  5 bars of BoxGeometry(0.3, 0.01, 1.8) spaced 1.6 in z merged into
  one solid band, perpendicular to traffic. Now 15 bars of
  BoxGeometry(2.0, 0.01, 0.5), 2.0 long parallel to traffic, spaced
  0.7 across the 11.4 road (registry standard); the centre dash at
  x=-15 is skipped (it would land on the zebra band). NOTE: this is
  the road SHOWCASE diorama (?shot=road), not a city street — the
  21 Nov audit's "zebra at x=+/-40" location was wrong; no such
  zebra exists at x=+/-40.
- `e5e63b4` — (2) Old-town EW ped path z -37.5 -> z -34.5 (the
  corridor's only real sidewalk). The first attempt (z -43.5) was
  caught by the audit at 0.85: it sits ON the ring avenue (road z
  -45.5..-38.5). The corridor has one sidewalk, south, shared with
  the existing -34.5 path (the pool keeps both lines).
- `e5e63b4` — (3) TEST: the audit excludes the old-town plaza
  (pedestrian island, fountain) from the on-road test.

## Zebra per approach (verified 11:12 WIB, probe)

- Ring intersections (+/-40,-42): all 4 legs have zebras (8-14 bars
  per leg). The "1 bar inside the box" from the probe is the band
  edge vs the probe's +/-4 window (real box half 3.5) — not a defect.
- Boulevard x connector (+/-40,0): 3 dedicated legs (E, N, S) + the
  inner (W) leg skipped BY DESIGN (cbd-grid.js: the grid street 6.4
  away has its own zebra at x ~36.1 covering it). The 36.1 band pokes
  0.6u into the connector's box edge — a cosmetic interleave between
  two adjacent intersections' furniture, correctly placed for its own
  street. NOT fixed (moving it would break its own intersection).

## OPEN (not fixed in this box — evidence, not excuses)

1. **12 ped paths on asphalt — all 2 m old-town alleys.** The alleys
   (x -67.5/-57.5/-47.5/-35.5/-47 and otExt x -95/-84/-73) are 2 m
   wide with no room for a sidewalk strip; no traffic lane uses them
   (lanes are only oldtown-main + oldtown-plaza loops); they are the
   only N-S pedestrian connections in old town. Peds walk down their
   centre by design. A real fix needs a layout redesign (widen the
   alleys or add sidewalks) — out of the 2-3 h box.
2. **78 plot/cover/wall colliders vs w=2 lanes (75 deep >= 0.5u).**
   The w=2 minimap lanes (alleys, the x=-60.5 gate/service lane,
   ring streets) run THROUGH buildings: the palazzo (8x10 at
   (-68,-39)) blocks the x=-67.5 alley mouth; the fortress wall and
   bastions straddle the x=-60.5 gate lane; 24 commercial plots sit
   on the x=-60.5 service lane; cover/crates/crane sit on the quay
   street (z ~13). No traffic lane uses these lanes and the route
   test passes (BFS uses main roads), so no car ever drives through
   a building — but the minimap claims these lanes are drivable.
   A real fix is either to move the lanes or the buildings — a layout
   decision, out of this box. The bell-tower plot overlapping a
   sidewalk (game's own district.report, x2) is part of this.
3. **Markings skipped 2,978 (38% of attempts, registry 2: 2,714).**
   The registry refuses a marking that would overlap anything placed
   so far. Most skips are arrows (placed only where they fit — by
   design on 11.2 grid spacing), but the audit cannot tell skipped
   types apart; a per-type skip count needs a registry change.
4. **Not verified at runtime (merged meshes carry no per-part
   positions):** sidewalk widths per street (>= 5 m / avenue 7 m),
   furniture strip 0.8 m + 2.5 m clear, canopy overhang vs shop
   signs, monorail pillars off asphalt/sidewalks, pole/signal
   positions. The item-3 report claims these fixed (canopy max
   0.012, pillars 0/8 in intersections); the code comments support
   the lamp/signal fixes (offset 0.12, signals at |x| 35.6). A
   visual pass (the PROOF shots, brief item C) is the remaining
   check for these.
