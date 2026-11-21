# Road connectivity — baseline report (21 Nov 23:05 WIB)

Test: `game/test/connectivity.mjs` (run: `NODE_PATH=/tmp/node_modules node
game/test/connectivity.mjs`). It reads the SAME road data the game
publishes — `window.__game.district.minimap` (roads.js `minimapLines()` +
cbd-grid `cbdGridMinimap()` + the blocks.js zone minimaps, assembled in
city.js) — and builds the graph the drivers use: segment endpoints
clustered within 4 units. Full machine output: `/tmp/connectivity.json`;
segment dump: `/tmp/minimap.json`.

## Baseline (HEAD b9336f9, before any fix)

- Minimap: **154 segments, 211 nodes, 67 connected components.**
- Harbor component (comp 23, the quay + 3 streets) holds only
  harbor / marina / quay_end / promenade (by nearest segment).
- Every other zone is SPLIT: old town, fortress, CBD, boulevard_mid,
  ring W/E, commercial, residential, hills, lighthouse, countryside,
  quarry.
- Drive-time matrix: essentially every zone pair UNREACHABLE (only
  same-component artifacts read 0). Nominal longest within one
  component: lighthouse → quarry 355.2u, 50.7 s game-time (~254 s
  headless real).

## Break class A — false breaks (296 geometric crossings)

The endpoint-only graph misses every T/X junction: a segment that
ends in the MIDDLE of another segment (or crosses it) never shares a
node. Examples, all verified in the segment dump:

- The x=±40 connectors (z -42..6) cross the Lungomare (z=0) and the
  ring avenue (z=-42) mid-segment — isolated single-segment components.
- Corso Azzurra (x=0, z -45.9..12.3) crosses all six CBD E-W streets
  mid-segment — isolated.
- The ring boundary streets (x=±72.5, ±60.5) cross every E-W street
  mid-segment — isolated.
- The boulevard is listed TWICE (seg 0 w=3.5 and seg 14 w=4.8, same
  line) — harmless duplicate, noted for cleanup.

The road slabs themselves form one connected surface; only the
centerline graph is shattered. Fix: publish junction-split centerlines
from the GAME (split every segment where another crosses/touches it),
so junctions become shared endpoints. No driver change.

## Break class B — real geometric gaps

Simulating the junction-split offline (154 → 663 split segments)
leaves **4 components**, i.e. 3 real gaps the split cannot fix:

1. **Hills island (38 split-segs, x -96..96, z -104..-95).** The
   hills N-S stubs (RESIDENTIAL_DEF roadsNs) all end at z=-95; the
   z=-89 ring street runs 6u south with a building row between.
   Fix in GAME data: extend the x=±95 edge stubs south to z=-89
   (they run on rect edges, no buildings on the line).
2. **East outer column x=84 (1 seg, z -31..12).** The ring E-W
   streets (RING_STREETS_EW z=-20/-10/0) end at x=72; the residential
   E-W streets start at x=96. The x=84 (and x=95) N-S streets cross
   nothing. Fix in GAME data: extend the z=-20/-10/0 streets east to
   x=97 (touching the residential x=97 line).
3. **West outer column x=-84 (1 seg, z -26..12).** Same, mirrored:
   extend the z=-26/-16/-6/4 streets west to x=-97.

## Fix order (each a separate "GAME fix:" commit)

1. Junction-split the published minimap (roads.js helper + city.js
   assembly). Expect 67 → 4 components.
2. Hills link (x=±95 stubs to z=-89). Expect 4 → 3.
3. East/west bridges (RING_STREETS_EW to x=±97). Expect 3 → 1.
4. Re-run this test: required = 1 component, all 16 zone anchors in
   the harbor component, plus the drive-time matrix.

## Post-fix result (21 Nov 23:20 WIB — all three fixes in)

- **COMPONENTS: 1** — 695 segments, 284 nodes, bbox x -127..127,
  z -104..30. 0 near-miss pairs, 0 crossings across components.
- **All 16 zone anchors in the harbor component** (harbor, marina,
  quay_end, oldtown, fortress, promenade, CBD, boulevard_mid, ring
  W/E, commercial, residential, hills, lighthouse, countryside,
  quarry). `allZonesOneComponent: true`.
- Longest drive: lighthouse → quarry 392.3u, 56.0 s game-time
  (~280 s headless real). Full matrix in `/tmp/connectivity.json`.
- Zone overlap test (`node game/test/zone-overlap.mjs`): PASS, 0
  problems in all 5 zones — the hills extension and the bridges put
  no road through any building. CBD overlap PASS (0), CBD blocks
  PASS (30/30).
- Commits: `06b2f95` junction-split, hills link, east/west bridges
  (each "GAME fix:", see `git log`).

## Notes

- The old-town pocket interior and the central promenade have no
  minimap centerlines (cobble alleys / walkway are not road data);
  their anchors are reached by a short hop from the ring avenue /
  quay, which are in the main component. The lighthouse road ends at
  z=30 (12u short of the anchor) — a drive check decides whether a
  road must be added.
- The traffic lanes (24 closed loops, 7 components) are NOT the road
  network and are not part of this test.
