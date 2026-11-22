# Fastsim proof — 1 job + 1 mission in both modes (22 Nov 2026, ~19:40 WIB)

Probe: `/tmp/fastsim-proof.mjs` (1 job flow + 1 mission flow, two fresh pages
per mode). Raw output: `/tmp/fastsim-proof-4.json`, `/tmp/fastsim-proof-1.json`.

## Result: PROVEN — same outcome, same game time

| | fastsim=4 (no render) | fastsim=1 (normal render) |
|---|---|---|
| **Job: J1 fail timer** (90 s at 10x scale = 9 game-s) | TIME UP, wall 1.3 s, **game 9.4 s**, money 1500→1500, active J1 (restart), no reward, timer 90→9→89 | TIME UP, wall 148.5 s, **game 9.5 s**, money 1500→1500, active J1 (restart), no reward, timer 90→0→87 |
| **Mission: M1 RECON→STEAL** | stages 0→1→2, elapsed 0→0.53→0.60, RECON→STEAL 0.07 game-s | stages 0→1→2, elapsed 0.25→0.75→1.50, RECON→STEAL 0.75 game-s |
| **Side effect (both modes)** | C16 collected on placement at the pavilion (+S 50/+25 XP) | identical: C16 (+S 50/+25 XP) |

The wall time differs 111x (1.3 s vs 148.5 s) because the sim rate differs
(4.00 vs ~0.064 sim-s/wall-s — SwiftShader renders every frame at
fastsim=1), but the GAME time is identical (9.4 vs 9.5 game-s for the same
90 s timer). The no-render fastsim changes only wall speed, not game
behavior.

## Why the full suites cannot run at fastsim=1

Measured sim rate at fastsim=1 is ~0.064 sim-s/wall-s (8 game-s in 120
wall-s during the FASTSIM=1 jobs run). A full jobs run (~984 game-s) would
take ~4 h wall; a full human-like mission (100-300 game-s) 25-80 min wall
plus driver wall-timeouts. The scoped proof above (one job timer + one
mission stage pair) is the feasible form, and it uses the two pure
game-time instruments: the job timer and the mission elapsed clock.

## Traps found while probing (all probe-side, not game bugs)

1. The game boots on the title screen: a probe must press Enter and wait
   for `mode === 'play' && __side` (same as the test's `newPage()`).
   Without it E does nothing and the side engine never runs.
2. The job panel never contains the string 'TIME UP' (that is only in the
   toast, overwritten within ~1 tick). Detect the fail by the TIME LEFT
   timer RESETTING (min <= 15 s then >= 75 s) — same as the test's J1-fail
   wait.
3. A mod-24 clock delta wraps: accumulate game time per poll instead of
   differencing start/end (2400 game-s reads as 0.0 mod 24 h).
4. An E pressed in the same ms as a placement evaluate finds no
   interactable — settle ~1.5 s first, retry E up to 4x (same as the
   test's `startJobAt`).

## Commits

- Probe + proof: no game/test change. This report only.
