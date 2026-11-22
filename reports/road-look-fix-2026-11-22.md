# Road look fix — item 3b (Xian 22 Nov 11:48 brief)

Builder: 0c7508c6. Recording 01a201cc live throughout. HEAD before: 613c00d.
Audit: `reports/street-audit-after3b.json` (same script as item 3).
Box: 30 min — overrun by ~40 min (the kerb-face vertex-colour work and
the top-down retake); recorded here, not hidden.

## What changed (all GAME, `game/src/`)

- **Asphalt #6e6a67 everywhere.** The ring/connector roads use the
  procedural texture (`roads.js` SURFACES.asphalt base #9aa0a4 ->
  #6e6a67); the CBD and zone roads use a flat material (0x9aa0a4 in
  `cbd-grid.js:261` and `blocks.js:70`) — both changed to 0x6e6a67.
  (The 0x9aa0a4 in `wheels.js:132` is a car-colour palette entry, not
  a road — left alone.)
- **Asphalt texture simplified:** patched repairs + oil stains now
  only render for concrete. Asphalt keeps noise blotches (+-6%),
  fine grain and the two worn tyre-track bands (alpha 0.10).
- **Sidewalk top #dccfb8** (was 0xc9c2b2) in all 4 material sites
  (`roads.js` x2, `cbd-grid.js`, `blocks.js`).
- **Kerb face #bfb39d** via a new `coloredKerb()` helper (`world.js`):
  the sidewalk boxes' top faces keep the material colour, the side
  faces get the component-wise ratio tint (0.868, 0.865, 0.853) so the
  material x vertex colour lands on #bfb39d. Applied to all 22
  sidewalk boxes (CBD, zones, ring, connectors). The one other 0.24
  box (`blocks.js:559`, the green concrete pool) is untouched.
- **Marking widths — realistic, 1u = 10 m** (`markings.js` + all three
  call sites):
  - lane dashes 0.12 m wide x 3 m long, 9 m gaps (0.012 x 0.3, step 1.2);
  - edge lines 0.12 m (0.012); double yellow 0.10 m each + 0.10 m gap
    (0.01, offset +-0.01); bus stripe 0.12 m (0.012); stop line 0.40 m
    (0.04); zebra bars 0.40 m wide x 3 m long, 0.40 m gaps (0.04 x 0.3,
    step 0.08); turn arrows 70% (0.7 x 0.112).
  - **No dashes on side streets:** the dash loops in `cbd-grid.js`
    and `blocks.js` now run only for avenues (2 lanes/direction);
    the ring streets (`centreDashRoad` in `roads.js`, 1 lane/direction)
    lost their centre dash, edges only. The 7-wide connectors and the
    ring avenue KEEP their centre dash — they are major roads, not
    side streets (judgement call, rule as written targets side streets).
  - **Marking colour #e8e6e0 at 0.9 opacity** for the white markings
    (dash/edge/zebra/stop/arrow). Yellow (centre line / box junction)
    and the green bus lane keep their semantic colours.
- **No duplicate lines:** unchanged by construction — the registry
  dedupes identical rects and skips overlaps (see audit).

## BEFORE vs AFTER (audit)

| Measure | BEFORE (item 3, `after2`) | AFTER 3b (`after3b`) |
|---|---|---|
| Marking overlaps (registry / independent) | 0 / 0 | 0 / 0 |
| Marking items total | 7,881 | 29,656 |
| Markings skipped | 2,978 | 2,194 |
| dash | 953 | 388 |
| edge | 760 | 878 |
| zebra | 2,749 | 23,937 |
| stop | 1,426 | 1,624 |
| arrow | 1,398 | 2,155 |
| yellow | 501 | 580 |
| bus | 30 | 30 |
| box | 64 | 64 |
| Furniture on asphalt | 67 | 67 (unchanged) |
| Ped paths on asphalt | 0 | 0 (unchanged) |
| Peds / traffic | 40 / 23 | 40 / 23 (unchanged) |

Why the counts moved: the zebra bars are ~8.7x more numerous (0.08 step
vs 0.7) but each is ~17x smaller in area, so total painted zebra area
went DOWN; dashes dropped because streets + ring streets lost them;
edges/stops/arrows rose because the narrower zebra bands leave smaller
gaps at crossings, so more segments and more arrows fit.

## Contrast (sRGB relative luminance, computed)

- Asphalt #6e6a67 L=0.1460, sidewalk #dccfb8 L=0.6330 ->
  **3.48:1 — meets the >=3:1 target.**
- Asphalt vs kerb #bfb39d (L=0.4575) -> 2.59:1.

## Proof shots (`cbd-shots/`)

BEFORE: `canopy-cbd-avenue.png` + `canopy-oldtown.png` (item 3, same
stagings) and `road-before-topdown.png` (custom camera (18,26,18) -> (18,0,18);
note: the before top-down carries the HUD — the staging was fixed to
`&hud=0` for the after shot, and the before state cannot be retaken).
AFTER: `road-after-avenue.png` (car height, `?shot=cbd&view=avenue`),
`road-after-oldtown.png` (pedestrian height, `?shot=district&district=oldtown`),
`road-after-topdown.png` (same custom camera, `&hud=0`).

## Honest critique

- **Avenue (car height):** the road look works — dark asphalt against
  pale sidewalk reads clearly, the zebra is a proper fine stripe, the
  PANETTERIA / FARMACIA signs read, the green bus stripe is subtle.
  Weaknesses: beyond ~30 m the 0.012 dashes are hairlines and the road
  reads as unmarked at distance (realistic, but the game loses a
  readability cue); the median cypress still blocks the avenue axis;
  the signal heads are oversized black boxes next to the now-delicate
  markings.
- **Old town (pedestrian height):** the contrast is the clearest win —
  the street is dark grey against pale sidewalks, the zebra + turn arrow
  read, and with no centre dash the narrow street looks cleaner.
  Weakness: the mid-ground road near the fountain reads lighter
  (plaza edge / sun angle), so the asphalt tone is not uniform along
  the street.
- **Top-down:** the grid reads well — thin dashes, fine zebra stripes,
  the yellow box junction, pale sidewalks with a darker kerb line.
  Weakness: from directly above the dashes are at the limit of
  visibility; the zebra is the only marking that still reads strongly.

## OPEN / watch items

1. **Zebra triangle cost:** 23,937 bars x 12 tris = ~287k triangles in
   the single merged `mark-zebra` mesh (1 draw call, but real triangle
   cost). Item 4 (perf) must measure it — if the city budget is blown,
   the zebra bars are the first suspect (fewer bars per crossing, or
   one quad per bar instead of a box).
2. **Dashes at distance:** the realistic 0.012 width is nearly invisible
   past ~30 m from street level. If playtesting finds the roads hard to
   read, the honest fix is a slight width bump (e.g. 0.02), not a return
   to 0.12.
3. **STOP_GAP / ARROW_BEHIND are in game units, not metres:** the stop
   line sits 1.0u (10 m) behind the zebra and arrows 3.5u (35 m) behind
   the stop, although the original brief said "1.0 m". Pre-existing unit
   inconsistency, out of this box — flagged, not changed.
