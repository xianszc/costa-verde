# Round-9 part B — setbacks + visible sidewalks (stage1ab, 23 Nov 2026)

## What changed (GAME)
- `blocks.js` / `commercial.js`: building rows sit 1.0 inside the block
  edge (was 0.2); side buildings at x0+2.8 / x1-2.8 (was 2.2); awning
  0.6 deep (was 1.0) — awning now stops 0.4 inside the block edge, so
  a visible sidewalk runs between facade and asphalt.
- `cbd.js`: twin podiums sized to the block with a 1.0 rim on every
  side (5.1 in a 7.1 block, 6.2 in an 8.2 block; was a fixed 7.0 that
  filled its block with rim 0.05); towers + spacing scale with the
  podium; podium collider follows the new size.
- `districts.js` (old town): south row (z -27) moved back to z -28.5
  as 3x2 houses (was 3x3 sitting ON the z=-26 road — the phantom
  road that left only a 0.04u slot at the (-44,-25) junction and
  wedged the car; routes.mjs was 9/10). South face -27.5, a 0.5
  sidewalk to the road's north edge. The -31 row stays, so the rows
  are flush (attached terrace houses).
- `missions.mjs` (TEST DRIVER): M3 added back to the test order (was
  silently skipped, like M1 before 22 Nov) so the old-town rooftop
  mission is re-runnable after a layout change.
- `routes.mjs` (TEST DRIVER): oldtown now drives to a gate target
  (-47.5,-28); the plaza anchor (-47,-39) is pedestrian-only — the
  bell tower blocks the x=-47.5 cross street, the only car entrance
  to the main street.

## Verification (all after the part B layout change)
- `routes.mjs`: **10/10 zones REACHABLE, 0 console errors**
  (oldtown out=8s back=4s; longest round trip hills 36s).
  Exit 0. Run 23 Nov 16:07 WIB.
- `cbd-blocks.mjs`: 30/30 bounded, 36 towers + 8 podiums. PASS.
- `cbd-overlap.mjs`: 0 tower-vs-road, 0 tower-vs-tower. PASS.
- `zone-overlap.mjs`: 0 problems in promenade / oldtown /
  residential / outer. PASS.
- M3 (old-town rooftop mission): **PASS human-like, 415s, 0 errors**
  (commit 89c672a) — the layout change did not break the mission
  that climbs the old-town rooftops.
- Screenshots: `reports/partB-cbd-top.png`,
  `reports/partB-commercial-top.png`, `reports/partB-oldtown-top.png`
  (top-down, existing — not regenerated, checks passed).
