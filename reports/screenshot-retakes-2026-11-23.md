# Screenshot retakes 11–12 — post-fix M-1 (23 Nov 2026, 08:21–08:25 WIB)

Retake of shots 11 & 12 AFTER the M-1 traffic fix (`a794ce1`, 01:35 WIB —
CBD traffic no longer 90° sideways). The v3 retakes (`31d0f76`, 00:56 WIB)
were taken 39 minutes BEFORE that fix and still showed sideways traffic.
Script: `~/workspace/makefun/gta6-01/shot-retakes3.mjs` (v3, unchanged).
Server: no-cache port 8941, `/tmp/node_modules` symlink. Playwright
Chromium, 1280×720, JPEG quality 80. Same filenames (overwrite).

## 11 — 11-drama-chase-low.jpg (147,681 B, lum 144, flat 0.083, 230 calls, 0 errors)

Variant 11C (not 11B): hero car in the right lane (x=1), camera right-front
3/4 at (3.0, 2.6, -13) looking at (-2, 1.0, -23). Staging at capture:
wanted level 4, cruiser 13.9 m at (-12.7, -24.6) approaching from the west
cross-street, heli visible at (2.2, 24, -19.8), health 100, mode play.
11B was run first (158,253 B, lum 129) and READ, then replaced: its hero
car was not in frame at all (camera tilted up, car below the frame edge)
— same weakness as v3. 11C keeps the better frame.

Read by the builder (not just staging metrics):
- Hero car BIG, bright orange-red Stella Roadster, centre frame, 3/4 rear
  view, aligned with the avenue. Cruiser dark blue behind it on the road,
  also aligned — NO sideways traffic anywhere in frame. M-1 fix VERIFIED
  visually.
- HUD complete: M1 THE FERRY JOB card, RADIO LUME, dispatch (CRUISER 13 m
  PURSUIT, Vespa-1 20 m, Gull-1 HELI 60 m INBOUND), 4 stars, minimap,
  health/armour/XP, weapon bar, STELLA ROADSTER 0 KM/H.
- Street reads: FARMACIA left, PANETTERIA right, OROLOGERIA, trees,
  green traffic lights, street lamps.
- Kritik jujur: heli MESH not in frame (only the dispatch line) — low cam
  still cannot fit y=24; no pedestrians clearly visible (placed peds did
  not read in frame); "Guard rammed you" toast crosses the hero car.

## 12 — 12-chase-noncbd.jpg (129,681 B, lum 149, flat 0.16, 101 calls, 0 errors)

Variant 12 (unchanged staging): ring east, car (45, -42) facing east,
camera (36, 4, -42). Staging at capture: wanted level 3, cruiser 8.7 m
at (36.3, -42.9), heli visible at (46.5, 24, -40), health 100, mode play.

Read by the builder:
- Hero car bright orange-red, centre-bottom, rear view, aligned with the
  road. Cruiser dark blue to the right of the hero, 3/4 rear view, also
  aligned — NO sideways traffic. M-1 fix VERIFIED visually.
- HUD complete: M1 card, RADIO LUME, dispatch (CRUISER 32 m PURSUIT,
  Vespa-1 16 m, Gull-1 HELI 60 m INBOUND), 3 stars, minimap, weapon bar.
- TABACCHI shop + café tables left, old-quarter towers ahead.
- Kritik jujur: no pedestrians visible (2 placed peds did not read in
  frame); cruiser sits beside the hero rather than behind, so it reads
  as a chase alongside, not a tail chase; road ahead is empty.

## Open (carried, unchanged from v3)

- Placed peds visible in NEITHER new shot — the staging placements still
  do not read as people in frame.
- Heli mesh fits no low-cam frame (only dispatch text); a heli-in-frame
  shot needs a different (higher/wider) camera, out of scope here.
