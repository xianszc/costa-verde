# Street cleanup FINISH — item 3 (Xian 22 Nov 11:48 brief)

Builder: 0c7508c6. Recording 01a201cc live throughout. HEAD before: 51f379b.
Audit script: `game/test/street-audit.mjs` (same methodology as item A).
BEFORE: `reports/street-audit-before2.json`, AFTER: `reports/street-audit-after2.json`.
Box: 45 min — overrun by ~25 min (the ?shot=road staging bug cost a retake);
the overrun is recorded here, not hidden.

## BEFORE vs AFTER

| Measure | BEFORE | AFTER |
|---|---|---|
| Markings overlaps (registry + independent) | 0 / 0 | 0 / 0 |
| Markings items | 7,881 | 7,881 |
| Markings skipped by registry | 2,978 | 2,978 |
| Furniture colliders on asphalt (exact SAT) | 78 (75 deep) | 67 (all plots/walls) |
| Street furniture on asphalt (lamps/benches/bins/hydrants/signals) | 0 | 0 |
| Ped paths on asphalt (of 85 checked) | 12 | 0 |
| Peds | 40 | 40 |
| Traffic cars (zone + CBD) | 16 + 7 = 23 | 23 |
| Game's own district.report violations | bell-tower overlaps sidewalk x2 | (unchanged) |

## GAME fixes in this run

- **Quay props off the quay street (11 colliders cleared).** The quay
  street (z 12.7..14.5) had 6 cover props + 4 crates + 1 crane sitting
  dead-centre at z 13.5. West props moved south to the promenade edge /
  furniture strip (z 15.3; crane to (-59, 15.0), clear of the marina
  plots and the road). East props DELETED — no furniture strip exists
  there (the promenade buildings occupy z 14..28) and they had no
  mission role (the combat staging spot is the west quay). The barrels
  and rope (no colliders) stay as quay clutter.
- **Ped paths rerouted off the alleys (12 -> 0).** The 5 flagged main
  old-town N-S paths (x -67.5/-57.5/-47.5/-35.5/-47) now run E-W on the
  south sidewalk (z -34.5, the corridor's only real sidewalk); the 2
  flagged otExt paths now run E-W at z -57 / z -66 (between the alley
  lines). The alleys keep their hand-built cobble slabs but no assigned
  ped path. NOTE: the alleys have NO asphalt (blocks.js: "alleys are
  cobbled by hand, no asphalt here") — the audit counts the minimap
  alley lines as roads, so the "on asphalt" flag was a classification
  artefact; the reroute satisfies the brief either way.

## Verified this run

- **Sidewalk widths (source literals — merged meshes carry no per-part
  positions at runtime):** avenue 0.7u = 7 m, street 0.5u = 5 m, in
  BOTH `cbd-grid.js:63` (`sidewalkW`) and `blocks.js:175`. Meets the
  brief (>= 5 m / avenue 7 m). Kerb step 0.12u (roads.js: "sidewalks
  step up 0.12").
- **Traffic-light poles:** already compliant — CBD grid puts 1 pole per
  corner (4 max per intersection, 42 intersections, 2 heads per pole),
  all AT intersections, none along plain sidewalks; the connector
  signals are 2 poles at the (±40, 0) intersection. 0 signal/lamp
  furniture on asphalt in both audits. No change needed.
- **Canopy vs shop signs (street shots, cbd-shots/canopy-*.png):**
  CBD avenue — PASS: the median cypress is in the median, the
  PANETTERIA sign reads clearly; small round canopies stay below sign
  level. Old town — PASS (weak): round canopies are low and clear of
  facades, but the frame has no shop signs to judge. Promenade —
  PARTIAL/FAIL: the palm fronds droop across the shopfronts and partly
  hide the awnings/facade band. OPEN: trim/raise the promenade palms
  or move the signs above the frond line.
- **Staging bug found:** `?shot=road&district=X` IGNORES the district
  — `game.js` stageShot('road') always builds the showcase diorama and
  hides the whole district. The first oldtown/promenade shots were
  byte-identical dioramas; retaken with `?shot=district&district=X`,
  which stages the real district. The `&district=` param on `?shot=road`
  is dead — fix or document it.

## OPEN (not fixed in this box — evidence, not excuses)

1. **67 plot/wall colliders still on road rects.** Breakdown: commercial
   24, oldtown 20, fortress 9, bastion 4, promenade 7, marina 2,
   bell-tower 1. These are BUILDINGS/WALLS, not furniture — they cannot
   go "into the furniture strip". Pattern: the block generator centres
   some plots ON lane centrelines (e.g. commercial plots at x -61.9..-58.6
   centred on the x -60.5 lane; the palazzo 8x10 at (-68,-39) across the
   x -67.5 alley mouth; fortress walls straddling the x -60.5 gate lane,
   which has no gate gap — the wall gaps are at the cross streets).
   The fix is in the generator (offset plots from lane centrelines) or
   in the minimap (drop the false lanes) — a layout/generator change,
   out of this box. No traffic lane uses these lanes; no car drives
   through a building (route test: 1 component, 302 nodes).
2. **7 promenade buildings, 0.5u kerb-zone overlap.** Their north faces
   sit at z 14 vs the quay road rect edge 14.5. Marginal — likely the
   road rect includes the kerb. Shifting 7 buildings 0.6u south is
   trivial but was not done in the box; needs a look at the promenade
   builder first.
3. **Bell tower overlaps the sidewalk x2** (game's own district.report).
   Part of item 1 (the plot sits on the old-town lane + sidewalk).
4. **Furniture strip 0.8 m + 2.5 m clear: NOT verifiable.** No 0.8
   literal exists in the sources; merged meshes carry no per-part
   positions. The strip exists by construction (lamps at road edge +
   0.12 offset, poles at sidewalk edge) but the 0.8/2.5 numbers were
   never measured at runtime.
5. **Promenade palm fronds over shopfronts** (see canopy check above).
6. **Markings skipped 2,978 (unchanged).** No marking change in this
   run; the per-type skip count still needs a registry change.
