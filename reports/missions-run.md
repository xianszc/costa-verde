# Mission run — item 1 (Xian 22 Nov 01:16 brief, 45 min box)

Run: `NODE_PATH=/tmp/node_modules node game/test/missions.mjs --from M4`,
started 01:27 WIB, stopped at the 45 min box limit 02:12 WIB (run process
killed cleanly at the limit; the runner is resumable with `--from M<N>`).
HEAD at run: 49fa204. Log: /tmp/missions-run-20261122-0127.log (wiped on VM
swap — results below are the record). Full per-mission records in
reports/missions-run.json (written by the runner immediately per mission).

| Mission | Result | Time | Cause | Commit |
|---------|--------|------|-------|--------|
| M1 | PASS (human-like) | 134 s | prior pass, not re-run (log 0200) | f7a574e |
| M2 | NOT RUN (open) | — | box limit; 30 min sub-box unspent | — |
| M3 | PASS (human-like) | 61 s | prior pass, not re-run (log 0130) | f7a574e |
| M4 | PASS (human-like) | 150 s | this run | 49fa204 |
| M5 | TIMEOUT (maxStage 2 ESCAPE) | 593 s | DRIVER — see note 1 | 49fa204 |
| M6 | TIMEOUT (maxStage 2 VANISH) | 617 s | DRIVER — see note 1 | 49fa204 |
| M7 | PASS (human-like) | 42 s | this run | 49fa204 |
| M8 | TIMEOUT (maxStage 2 HARBOR) | 563 s | DRIVER — see note 1 | 49fa204 |
| M9 | OPEN (not finished) | — | stopped at box limit 02:12, was in LAY LOW (wanted 3→1, heat decaying) | — |
| M10 | NOT RUN (open) | — | box limit | — |
| M11 | NOT RUN (open) | — | box limit | — |
| M12 | NOT RUN (open) | — | box limit | — |

saveLoad: PASS (re-verified by this run).

## Note 1 — the one DRIVER cause behind M5/M6/M8 (all escape stages)

All three timeouts share the same driver failure mode, with position-trace
evidence:

- M5: timeout trace `player=(22.9,8.3) car=(21.7,6.6) target=(3,26)
  distPlayer=26.6u onFoot=true`. After TAKE the player walked 82u on foot
  while the car drove to the target without them.
- M6: timeout trace `player=(-9.2,-3.4) car=(-10.4,-6.5) target=(-50,0)
  distPlayer=40.9u onFoot=true`. The player walked into the CBD and stalled
  near (-10,-5) with the car 1.6–3u away, never boarding it.
- M8: timeout trace `player=(15.0,1.1) car=(19.1,1.1) target=(3,26)
  distPlayer=27.6u onFoot=true`. Same pattern: car driven to the target,
  player left walking on foot.

Mechanism (game/test/missions.mjs, escape branch): when the player is on
foot far from the car, the E presses to board fail (35u away), the "last
resort" sets `state.onFoot = false` without moving the player to the car,
routeDrive drives the car to the target, the player exits and walks the
final leg — on foot, at ~20% headless speed, far too slowly for 25–90u.
No GAME bug is implicated: wanted was 0 in all three, the road graph is
1 component, and M4 (same escape shape, shorter distances) passes.

Recommended next driver fix (NOT done here — item 1 is closed at the box):
in escape stages, board the car FIRST (walk the player to the car / drive
the car to the player, enter via E at close range), then drive to the
target, then walk the final leg. Re-run with `--from M9` (M9–M12) then M2.

## Item 1 verdict

OPEN. Runner works (crash-safe, resumable, per-mission results, fresh
context per mission). 3 of 12 missions pass human-like in this pass
(M1/M3 prior, M4/M7 this run); 3 escape timeouts share one DRIVER cause;
M9–M12 + M2 unrun at the box limit. Resume with `--from M9`.
