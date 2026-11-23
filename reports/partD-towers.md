# Round-9 part D — CBD towers half height (stage1ab, 23 Nov 2026)

## What changed (GAME)
- `cbd.js`: `FLOOR_H` 2.0 → **1.0** game units per floor. Azzura
  Tower 60 floors = 60u tall (was 120u); the rest 20–60u (was
  40–120u). One-line lever, everything downstream follows `h` and
  `floors`:
  - body height, crowns (positioned at h + ...), windows (rows =
    (h-4)/2 at 2u spacing — one row per 2 floors now, still reads
    as a glass tower), roof tint (uses floors 20–60, UNCHANGED —
    pale stone to deep gold still spans the full range).
  - `world.js` FLOOR_H (0.3, distant skyline cluster) is a
    DIFFERENT constant — untouched.
  - Colliders are footprint-only (x/z) — unchanged.
- M7/M11 anchors are ground level (`tower_lobby` /
  `skyline_plaza`); the "sixty floors" in M11 is dialogue only —
  no mission reads tower height.

## Verification
- Skyline: `reports/partD-skyline.png` — dense cluster, varied
  crowns (spires, antennae, gold caps), Azzura Tower still the
  hero; towers now proportionate to the city. 0 console errors.
- Menu orbit framing: orbit path UNCHANGED (camera spline y 14–20
  outside the CBD, clearance-probed) and still works — camera
  sampled at the bay dip (24.8, 15, 89.5) and north leg
  (-30.5, 20.1, -101.2), title readable, 0 errors
  (`partD-menu-bay.png`, `partD-menu-north.png`). Honest note:
  the bay dip is flatter than before — the 120u Azzura massif no
  longer fills the frame above the mid-rise foreground; the north
  leg still reads in layers (skyline + marina + bay). This is the
  expected consequence of halving the towers, which Xian ordered;
  the orbit itself was NOT retouched.
- M7 spot-check (after the height change): **PASS human-like,
  44s, 0 errors** (commit 167edfa, FASTSIM=2). M11 not re-run —
  its stages are the same ground-level `tower_lobby` interacts
  as M7's, and the brief asked for M7 only.
