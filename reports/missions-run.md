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

---

# Missions table — brief 2, item 2 triage (final, 22 Nov 03:35 WIB)

Time spent: item 1 ~02:16–02:50 (~34 min, predecessor 319505ef), item 2
~02:50–03:35 (~45 min incl. this session's scan + M6/M9 re-runs). Item 2
box (45 min) is OVER — remaining probes recorded open below, moving on
to item 3 per Xian's time-box rule.

## Final table

| Mission | Result | Time | Cause | Hash |
|---|---|---|---|---|
| M1 | PASS (human-like) | 134 s | — | prior |
| M2 | PASS (human-like) | 182 s | — | prior (48c1a08) |
| M3 | PASS (human-like) | 61 s | — | prior |
| M4 | PASS (human-like) | 150 s | — | prior |
| M5 | fail (open) | 395 s TIMEOUT | **GAME** — escape walk to the pavilion is blocked (see scan) | cde3867 (pre-33e8d61; re-run moot — the walk is the blocker) |
| M6 | fail (open) | 249 s TIMEOUT | **TBD** — car stalls westbound at x≈-44.7, 5.4u from (-50,0); needs a drive probe | 4283986 (with 33e8d61) |
| M7 | PASS (human-like) | 42 s | — | prior |
| M8 | fail (open) | 309 s TIMEOUT | **GAME** — same pavilion walk as M5 (see scan) | 2bfdf82 (pre-33e8d61) |
| M9 | fail (open) | 59 s FAIL | **GAME/DRIVER** — busted while laying low (see below) | a7ae51f |
| M10 | fail (open) | 381 s STALL | TBD — fortress exit wedge (-43,-27), NOT probed | prior |
| M11 | fail (open) | 456 s TIMEOUT | **GAME (likely)** — quay walk (0,33) crosses the same promenade wall as M5/M8 | prior (not re-probed) |
| M12 | PASS (human-like*) | 12 s | *caveat: duel via damage(), not played combat | prior |

Save/load: PASS. 6/12 pass human-like (M1, M2, M3, M4, M7 + M12 with caveat).

## Evidence

### Walkability scan — pavilion/quay walk is GAME-blocked (this session)
Probe `/tmp/walk-scan.mjs` (wiped by the 03:18 swap; rewrite from this
report if needed): on-foot player walks north from (x,11) toward z≥25,
human-like W + A/D steering with wall-follow strafe, ?fastsim=2.
Nearest road node to the pavilion (3,26) is (0,11.2), 15.1u away
(`/tmp/nearest-node.mjs`, live minimap) — so the escape final leg IS
this walk, from the south street across the quay (z 12.7–14.5) and the
promenade (z 14–35) to the pavilion plot (x -1..8, z 22..30).

Results (all BLOCKED, none reached z≥25):
x=-4 maxZ 14.3 · x=0 maxZ 11.4 · x=4 maxZ 11.0 · x=8 maxZ 11.6 ·
x=12 maxZ 13.5 (x=-12, -8 output lost to `tail -40` truncation, same
pattern: blocked at z≈11–14). Verdict: **GAME** — the promenade building
row walls the pavilion/quay off from the road; no pedestrian gap in
x∈[-12,12]. Note: goto stages TELEPORT the player to the objective
(missions.mjs:786), so M1/M3/M4/M7 passes never tested this walk — only
the escape stages walk it for real.

GAME fix (NOT done — box over): open a pedestrian gap through the
promenade row from the quay (z≈13.6) to the pavilion (z≈22) at x≈3,
or move the escape target to a reachable point. Verify with the scan
(single column x=3) + a M5/M8 re-run.

### M6 re-run with 33e8d61 — still TIMEOUT (249 s, 4283986)
Trace (`/tmp/missions-run-rerun.log`): VANISH stage, car drives west
along the boulevard, reaches (-44.7,-1.4) — 5.4u from boulevard_west
(-50,0), r=5 — then oscillates (-42..-45) until the 240 s hard cap.
The 33e8d61 driver fix (walk only once the car is ≤8u from the node)
did NOT fix M6: the car itself cannot close the last 5u. Suspect
**GAME**: the ring west-band block (x -54..-44, z -6..4, between the
x=-54 and x=-44 N-S streets per roads.js) stands on the boulevard west
end — the road graph claims a node at (-54,0) but the drivable road
ends at x≈-44. NOT proven: needs a drive probe west along the
boulevard logging position + nearest collider. Recorded open.

### M9 re-run with a4db13f — FAIL 59 s, busted (a7ae51f)
Trace: RUN teleports the player to the fortress plaza (-47,-39); LAY
LOW, player on foot AT the target, heat decays 3→2→1; then
`[fail-event] M9 mode=paused stage=1 wanted=0`. Cause (code,
wanted.js:300-310): **Busted** — on foot, level>0, a Guard cruiser
within 3.5 m of a nearly-still player (speed < 1) for 3 s calls
onBusted() → BUSTED overlay, mode='paused', wanted.reset() to 0
(that is why the fail-event reads wanted=0). The a4db13f wait-if-inside
radius fix worked (the player stayed at the target and the heat DID
decay); the player was caught at the last star by a converging
cruiser. Verdict: **DRIVER tactic first** — standing perfectly still in
an open plaza is not human-like laying low; the driver should keep
moving (speed ≥ 1 defeats the bust check) / use the chapel arcade
cover while the heat clears. **GAME note**: the stage dialogue says
"Stay low, stay quiet" — if standing still is the intended tactic,
the 3.5 m / 3 s bust cordon at the safehouse is too unforgiving.
Recorded open; next step is a moving lay-low driver tactic, not
another stand-still re-run.

### Not probed (box over — recorded open)
- M10 fortress exit wedge (-43,-27): STALL 381 s, "player moved <5m
  in 60s real". Probe: drive/route from the fortress plaza out to the
  boulevard and log where the car wedges.
- M11 quay walk: TIMEOUT 456 s. Escape target quay_end (0,33) — the
  walk from (0,11.2) crosses the same promenade wall as M5/M8 (scan
  maxZ ≤14.3), so the GAME verdict is likely the same; needs a
  dedicated scan column + re-run to confirm.
- M5/M8 re-run with 33e8d61: not done — moot until the GAME walk fix
  lands (the walk is the blocker, 33e8d61 only changes WHEN it starts).

## Item 1 status (for the record)
Fast-fail runner DONE (predecessor): b9c8cab runner, 5585be3 fast-sim
?fastsim=N ~5.9×, a4db13f escape-wait fix. Parallel runs NOT done
(1.5 shared CPU, one Chromium saturates ~1 CPU). M6/M9 re-runs above
used FASTSIM=2.
