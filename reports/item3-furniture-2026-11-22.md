# Item 3 — Furniture on asphalt (Xian 22 Nov 14:33 brief, 30 min box)

Date: 22 Nov 2026 ~15:27–15:45 WIB. Builder 77f2ef95, HEAD ade4f7b.
Before: `reports/street-audit-item3-before.json` (fresh re-run, street-audit.mjs).
After: `reports/street-audit-item3-after.json` (re-run, no game change — see verdict).

## Result: 67, unchanged — all 67 are building plots/walls, NOT furniture

- **Street furniture on asphalt (lamps / benches / bins / hydrants / signals): 0.**
  Item 3 already fixed those; nothing to move into a furniture strip.
- **The 67 are collider AABBs of buildings/walls overlapping a minimap
  road rect (SAT depth > 0).** They cannot go "into the furniture strip"
  — they are the buildings themselves.

## The 67 by type and location (centre, SAT depth)

| group | road | n | locations (centre, depth) |
|---|---|---|---|
| commercial | w=2 lanes | 18 | (39,-54) .79, (39,-50) .71, (43,-54) .74, (43,-50) .89, (59,-28..9) ×6 ~1.4, (-60,-23..8) ×6 ~2.4 |
| commercial | w=4.8 Lungomare | 6 | (47,-3) 1.2, (50,-3) 1.2, (56,-3) 1.2, (47,3) 1.15, (50,3) 1.2, (56,3) 1.13 |
| oldtown | w=2 alleys | 12 | (-68,-39) 4.5, (-47,-48) 4.5, (-60,-49..-27) ×6 1.5–2, (-70..-45,-27) ×5 1.5 |
| oldtown | w=2.2 | 3 | (-35,-35..-27) ×3 1.2 |
| oldtown | w=7 cross streets | 5 | (-55,-45) 2, (-40,-45) 2, (-55,-35) 1, (-40,-35) 1, (-40,-27) 0.5 |
| fortress | w=2 | 9 | (-70,-52) .5, (-62,-52) 3, (-52..-35,-52) ×3 .2, (-90..-78,-80) ×2 1.4, (-96,-62) 1.4, (-96,-36) 1.4 |
| bastion | w=2 | 4 | (-59,-52) 2.3, (-35,-52) 1.6, (-96,-80) 2.8, (-72,-80) 2.8 |
| promenade | w=1.8 | 7 | (10..24,18) ×4 .5, (60,18) .5, (35,21) .5, (52,21) .5 |
| marina | w=2 | 2 | (-60,18) 2.5, (-44,18) 5 |
| bell-tower | w=2 | 1 | (-47,-36) 1.9 |

Depth: 21 ≥ 2u, 30 at 1–2u, 13 at 0.5–1u, 3 < 0.5u.

## Drive probe (does a human player hit them?)

`/tmp/avenue-probe.mjs` (raw steering, no routeDrive), two centreline legs:
- **A — Lungomare z=0, x 38 → 62** (through the 6 commercial plots that
  pinch the 4.8u avenue to ~2.45u at x 45–57): **0 damage while crossing
  the pinch zone.** (The probe's crude steering overshot the target and
  scraped later at (73.7,2.6), east of the zone — outside this item.)
- **B — old-town cross street z=-42, x -58 → -46** (through the 5 w=7
  plots): **0 damage while crossing the zone.** (Same overshoot past the
  target scraped later at (-38,-30.7), north of the zone.)

The centreline stays clear on every overlapped road; the intrusions are
at the road EDGES (building faces 0.5–2u inside the road rect). No
mission or race route uses the pinched edges — M1/M2/M7 human-like
passes all drove these roads clean, and the route test is 1 component,
302 nodes, all zone anchors reachable.

## Verdict per type — JUSTIFIED, no GAME change in this box

- **commercial w=4.8 (6):** buildings pinch the Lungomare to ~2.45u at
  x 45–57. Passable on the centreline (probe A, 0 damage); reads as a
  street canyon. Moving them means changing the block generator's
  setback from the avenue — a city-wide layout change (hundreds of
  buildings move, routes/shots/mission paths re-verify) two days before
  the deadline, out of proportion to a passable edge intrusion.
- **commercial/oldtown/fortress/bastion/marina w=2 (46):** buildings
  lining or closing narrow cobble lanes/alleys (not asphalt — the audit
  counts minimap lines as roads). The lanes are pedestrian-scale; the
  drivable graph routes around them. Same generator-change cost as above.
- **oldtown w=7 (5):** 3×3 plots with 0.5–2u of footprint on the cross
  streets; centreline clear (probe B, 0 damage). Same justification.
- **promenade w=1.8 (7):** 0.5u kerb-zone overlap — north faces at z=14
  vs the quay road rect edge 14.5. The road rect includes the kerb;
  marginal, no gameplay impact.
- **bell-tower (1):** plot on the old-town lane + sidewalk; same pattern
  as the oldtown plots, same justification.
- **Medians:** none — the boulevard median has NO colliders (GAME fix
  22 Nov, city.js), so no median is counted here.

## What a real fix would be (not done — recorded as open)

A generator setback rule in `game/src/blocks.js` (fillBlockPerimeter)
and the city plot list (`game/src/city.js` PLOTS): no building footprint
within (road half-width + 0.7u sidewalk) of a lane centreline. That is a
layout change for the final polish pass, with a full re-run of the route
test, the street audit and the mission human-like passes — NOT attempted
in this 30-min box, because it would invalidate the verified city.

## Time

Item 3 box: ~18 min (audit re-run + classification + 2-leg drive probe +
report). No game file changed; only `reports/` files are committed.
