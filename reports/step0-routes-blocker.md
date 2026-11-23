# Step 0 — routes.mjs blocker: findings (stage1ab, 23 Nov 2026)

## Verdict

**Part A (road widening) did NOT cause the routes.mjs failure.** The
blocker was a pre-existing test-driver problem, proven by a baseline
comparison, plus one pre-existing map tight spot that step B (setback)
fixes. The game code is untouched by every fix in this step — only
`game/test/routes.mjs` (the driver) changed.

## The original failure

Session 7fbfa8c0 (stage1aa) reported `routes.mjs` FAIL: all 9 zones
unreachable, `no-progress at waypoint 0 (0,11.2)` — the car could not
move from the harbor (3,20) to the first waypoint. The road graph was
intact (connectivity PASS).

## Proof it was the driver, not part A (baseline comparison)

A repro (v2) of the exact first leg was run on BOTH trees:

- **Part A tree:** car drove to dist 4.25 of (0,11.2), then overshot
  west and stuck at (-11.52,15.56) after 96.6 s, 2 reverses.
- **e6cb344 baseline:** the SAME failure mode — stuck at
  (-20.56,4.78) against a CBD podium after 99.3 s.

Only 5–8 position samples per ~100 s run: each Node control
iteration takes 10–20 s wall while the game advances ~0.5 s of game
time (~2% speed in headless SwiftShader). The old driver steered from
Node via Playwright keyboard calls + `page.evaluate` round-trips, so
at 12–15 u/s the car overshot every waypoint and wandered off-road.
The road was NOT blocked; the sidewalk/quay hypothesis was WRONG
(the car drove straight through that area). **Part A did not cause
it.**

## Driver fixes (all in `game/test/routes.mjs`, game untouched)

**Round 1 — in-page pilot + fastsim + harbor reset + trace.**
The autopilot moved IN-PAGE (50 ms `setInterval`, reads
`window.__game` directly, dispatches synthetic keydown/keyup — the
game's keydown handler does not check `isTrusted`); page loads with
`?fastsim=4` (4.00 sim-s/wall-s, no rendering); each zone's out leg
resets the car to the harbor (teleport + `wanted.reset()`, mirroring
respawn) so legs are independent; the pilot records a position trace
(wanted level + damage) and the stuck point + nearby colliders/cars/
police are logged per failure. Pilot smoke test (harbor → (0,11.2)):
reached in 2.0 s wall, 0 errors (vs 96 s stuck with the old driver).
Full run after round 1: 3/10, then 4/10 with the reset + trace.

**Round 2 — pure-pursuit pilot.** The waypoint-chasing pilot cut 90°
corners at 12 u/s, overshot off the road into building alleys, and
wedged the car (damage 100, speed 0.2) at (-49,-6.8), (93.9,-14.7),
(36.9,-73.9), (-122,34.5), (-123.3,-5.3), (71.3,-94). The pilot now
steers toward a lookahead point ON the path polyline (closest-point +
arc-length s, lookahead = clamp(speed × 0.6, 3, 8) u), slows for turns
(12 → 6 when heading error > 0.5 rad, → 4 when > 1.0 rad, 5 within
12 u of the final waypoint), brakes to a full stop on arrival (handbrake
within 4 u, report 'reached' only at |speed| < 0.5 — the old coasting
past the anchor caused the countryside/quarry back-leg failures), and
measures progress on arc-length s (stuck if s does not improve 0.5 in
20 s wall; reverse after 8 s). The harbor reset also sets
`car.damage = 0` (fresh car per zone). Damage mechanics (vehicles.js):
head-on impact (closing > 2) deals closing × 0.6 damage and cuts
speed × 0.4; damage caps at 100; gentle slides deal no damage. Full
run after round 2: **7/10** — commercial + residential back legs,
hills, countryside, quarry all fixed.

**Round 3 — graph radius + no-thin + 3-point turn + lighthouse shore.**
Three failures remained, all traced to the TEST, not the game:

1. **Oldtown — phantom diagonal (graph).** The 4-unit node-clustering
   radius merged two DISTINCT junctions — (-44,-25) with (-47.5,-26),
   3.64 apart — creating a phantom diagonal edge (-44,0)→(-47.5,-26)
   that cuts across commercial buildings; the car wedged on
   commercial-158's corner at (-45.4,-16.7), dmg 36. Verified with
   `/tmp/graph-probe.mjs`: radius 1.5 keeps the graph at 1 component
   (368 nodes, was 293) and the oldtown path orthogonal:
   (-44,0)→(-44,-25)→(-47.5,-26)→(-47.5,-39). Radius is now 1.5.
2. **Waypoint thinning cut corners.** The old ~6 u thinning dropped
   junction nodes, so the polyline cut corners off the road (e.g.
   (-40,0)→(-44,-25) instead of via (-44,0)). Pure pursuit follows
   the polyline, so the waypoints now trace the road centerlines
   exactly (no thinning).
3. **Promenade back leg — turn-around.** The car had to reverse its
   heading at the plaza anchor and drove forward into a 180° turn,
   wedging on the casino fountain at (36.7,28.5), dmg 46, s=3.9. The
   pilot now does a 3-point turn: when it faces the wrong way at
   (near) a standstill (|heading error| > 1.2 rad, |speed| < 2) it
   reverses + steers until the nose is round. Back leg now 6 s.
4. **Lighthouse — anchor across the water (test design).** The anchor
   (-121,42) sits PAST the bay-water line (z ≥ 35); no road reaches
   it and a car cannot drive on water. The pilot drove to the water's
   edge (-119.8,34.5), s=163.4/170, dmg 56, and stopped correctly.
   The lighthouse is a pedestrian destination, so the test now drives
   to the shore point (-119.6,33) on the proven hop line (`driveTo`)
   and records the anchor as pedestrian-only. This is NOT a game
   change: the water collider is the game's intended bay.

Full run after round 3: **9/10 reachable, 0 console errors.**
marina (start), promenade out 16 s / back 6 s, cbd 2 s / 2 s,
commercial 6 s / 30 s, residential 22 s / 12 s, hills 12 s / 18 s,
lighthouse (shore) 4 s / 8 s, countryside 4 s / 6 s, quarry 10 s / 28 s.
Longest round trip: quarry 38 s. Graph: 718 segments, 368 nodes,
1 component.

## The one remaining failure — oldtown (MAP issue, step B fixes it)

Stuck at (-44.9,-25), s=80.9/97, dmg 49, after driving the full
orthogonal route to the junction. Cause, measured with
`/tmp/probe-junction.mjs`: the old-town house at
**x -46.5..-43.5, z -28.5..-25.5** sits ON the z=-26 road — its north
face (z=-25.5) is 0.5 u into the 2 u-wide road, leaving only a 0.5 u
slot at the junction, while commercial-157's corner is 0.54 u away on
the other side. The car's collision circle is 1 u wide, so the slot
is 0.04 u — the car is wedged with zero room to move. The road
centerline itself runs through the house (the polyline
(-44,-25)→(-47.5,-26) passes z=-25.5 inside the house's x-range).

This is **pre-existing, not caused by part A**: part A changed only
`cbd-grid.js`, `cbd-traffic.js`, `cbd.js`, `commercial.js`, `game.js`,
`markings.js`, `roads.js` — the old-town house placement is in none of
those files. It is exactly the step B (setback) item: the old-town
south row (z -27) sits on the road — move it back. **Re-run
`routes.mjs` after step B; oldtown must then pass.**

## Evidence

- `/tmp/routes.json` — latest full run (9/10, generated 2026-11-23T08:13Z)
- `/tmp/graph-probe.mjs` — radius 4 vs 1.5 comparison
- `/tmp/probe-alley.mjs` — minimap + colliders at (-45.4,-16.7)
- `/tmp/probe-junction.mjs` — colliders at the (-44,-25) junction
- `/tmp/pilot-smoke.mjs` — pure-pursuit smoke test (PASS, 2.0 s)
- `/tmp/repro-v2.mjs`, `/tmp/repro-partA.json`, `/tmp/repro-baseline.json`
  — baseline comparison (both trees failed identically)
