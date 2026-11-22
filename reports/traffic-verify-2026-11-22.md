# Traffic runtime verification — 22 Nov 2026 (stage1j, builder d302f048)

Probe: `/tmp/traffic-verify.mjs` (Playwright, 8941 server, headless SwiftShader).
Method: load game, `startPlay()`, sample every traffic car's lane + position at
t0 and t+20s real time (~4s game-time at ~20% headless speed); count cars per
lane, count peds, check peds on asphalt vs minimap road segments
(point-to-segment distance < w/2). Full data: `/tmp/traffic-verify.json`.

## Result: PASS (traffic) / OPEN (9 peds on asphalt, known item)

- **23 cars total, 40 peds, 0 console/page errors.**
- **All 23 cars moved** in 20s (2.58–13.91u). None stuck at 0.00.
- **All 5 new res/outer cars drive their lanes** (commit 8d8b19f verified):
  res-east 5.28u, res-west 5.28u, res-north 5.28u, outer-west 5.28u,
  outer-east 5.28u. Cars per lane: every loop lane has exactly 1 car;
  CBD graph lanes have 7 cars (NS-3 x3, EW-2 x2, NS-1 x1, EW-3 x1).
- **Hills/villas: NO new lane needed.** 87 minimap road segments exist in
  the z -110..-85 band; the res-north car drives the strip (z -88.93 →
  -83.76 in the sample). The villa terraces (city.js:208-347) are
  pedestrian-only by design; the drivable point is the funicular base
  (0,-105), already reachable (route test). "Hills/villas tanpa lane"
  is covered by res-north.
- **Peds: 40, but 11 on asphalt at the sampled instant.** 2 are the
  intentional CBD crosswalk peds (on the zebras at VIA DEL SOLE x=-11.2
  and CORSO z=-11.2 — crossing by design, correct). The other 9 are
  old-town / west district paths on asphalt: (-66.86,-34.5), (-67.5,-45.55),
  (-57.5,-42.47), (-35.5,-39.38), (-52,-36.97), (-47,-33.89), (-44.02,-37.5),
  (-38.97,2.75), (-85.2,-5.57). This is the known OPEN item from
  reports/street-cleanup-2026-11-22.md (12 ped paths on asphalt, old-town
  2m alleys need a layout redesign) — recorded OPEN here, not fixed in
  this run (time-boxed; redesign out of scope for the traffic item).
