# CBD tests — 21 Nov 2026, 15:51 WIB

Run by the parent on the committed tree, HEAD `e0ac1cd` (after the orthographic
camera + fog fix). Both tests exit 0. Outputs identical to the earlier run on
HEAD `0320359` (15:45 WIB).

## Overlap test — `node game/test/cbd-overlap.mjs`

```
CBD overlap test: 36 towers + 8 podiums = 45 footprints, 25 road rects + 8 median segments
  tower-vs-road overlaps: 0
  tower-vs-tower overlaps: 0
PASS: 0 overlaps
```

## Block test — `node game/test/cbd-blocks.mjs`

```
CBD block test: 30 blocks (1 park, 8 twin, 19 single, 1 azzura, 1 plaza), 36 towers + 8 podiums, blocks 2303 units^2 / extent 4,039 units^2
  blocks bounded on all 4 sides: 30/30
PASS: every block is bounded by roads on all 4 sides
```

## Counts (from the tests)

| Item | Count |
|---|---|
| Blocks | 30 (1 park, 8 twin, 19 single, 1 azzura, 1 plaza) |
| Towers | 36 (target 36–44) |
| Podiums | 8 |
| Footprints | 45 |
| Road rects | 25 |
| Median segments | 8 |
| Blocks bounded on all 4 sides | 30/30 |

Extent 4,039 units² vs the ~3,500 allowance — accepted by Xian 21 Nov 15:48 WIB.

## Orthographic top-down

File: `cbd-shots/cbd-ortho-top.png` (379,523 B, committed with this report).
Builder's claim at capture (not re-verified by the parent): 542 draw calls,
0 console errors. Towers stand vertical; block grid, lane markings, zebras,
boulevard median + monorail, park and plaza blocks read clearly.

## Item 1 verification — 21 Nov 2026, ~16:40 WIB (HEAD `16271e7`)

CBD rebuild finished per Xian's 16:04 order: block fill, slim monorail,
7 graph cars, oblique view, long shadows, avenue staging. All numbers below
were measured by the builder in Playwright (no-cache server, port 8941).

### Tests (re-run on the final tree — both exit 0)

```
CBD overlap test: 36 towers + 8 podiums = 45 footprints, 25 road rects + 8 median segments
  tower-vs-road overlaps: 0
  tower-vs-tower overlaps: 0
PASS: 0 overlaps
CBD block test: 30 blocks (1 park, 8 twin, 19 single, 1 azzura, 1 plaza), 36 towers + 8 podiums, blocks 2303 units^2 / extent 4,039 units^2
  blocks bounded on all 4 sides: 30/30
PASS: every block is bounded by roads on all 4 sides
```

### Missions 1–12 — ALL PASS (two Playwright runs, 1280×720)

- Run 1 (`/tmp/stage1-missions2.mjs`, 488 s): M1 RECON→STEAL→ESCAPE,
  M2 MEET→TAIL→DOCK, M3 CLIMB→DELIVER→RETURN, M4 MEET→DROP→ESCAPE,
  M5 RECON→TAKE→ESCAPE; advanced to M6 stage 0 at the 480 s loop deadline.
  failures [], errors [], money 4650, xp 3440.
- Run 2 (`/tmp/stage1-missions-m6.mjs`, start at M6, 360 s): M6 MEET→PLANT→
  VANISH, M7 CROSS→SCAN→RETURN, M8 SIGNAL→HARBOR, M9 RUN→LAY LOW→REPORT,
  M10 LINE UP→RACE→PODIUM, M11 LOBBY→LIFT→VAULT→ESCAPE, M12 CONFRONT→DUEL→
  AFTERMATH→EPILOGUE→FINALE (done: true). failures [], errors [],
  money 15550, xp 5250. No mission needed code changes.
- Save/load (pause menu, the real user path): saved slot 1 (money 7777,
  xp 1234, missionId 5), zeroed the values, loaded — exact match, 0 errors.

### Stats — `reports/stage1.json` (Playwright, `?debug=1&skip=1&at=cbd_center`)

| View | Draw calls | Triangles |
|---|---|---|
| Drive (`?debug=1&skip=1&at=cbd_center`) | 412 | 286,822 |
| Top-down ortho (`?shot=cbd&view=top&hud=0`) | **590** | 305,394 |
| Oblique 3/4 (`?shot=cbd&view=oblique&hud=0`) | 714 | 331,344 |
| Avenue street level (`?shot=cbd&view=avenue`) | 304 | 273,598 |

Top view **590 < 600** ✓ (the earlier "542" claim was wrong — re-measured).
Oblique is 714: the wide perspective view sees the whole city + hills
backdrop; the fix belongs to item 2's merged rebuild of the ring/old town.
Console errors: 0. Network: 24 resource entries, all same-origin,
**0 external requests**.

### Building counts (measured from the district colliders, live game)

| Zone | Measured | v3 target |
|---|---|---|
| CBD towers | 36 | 36–44 |
| CBD podiums | 8 | 8 |
| Commercial ring | 74 | 247+ |
| Old town plots | 14 | 60 |
| Promenade | 7 | 40 |
| Marina pavilion | 1 | 32 |
| Traffic cars (6 loop + 7 graph) | 13 | — |
| Pedestrians | 6 | — |

Commercial 74 vs target 247, old town 14 vs 60, promenade 7 vs 40 — the
density gap is item 2's work (same block rule, 6–8 buildings per block).

### Shots (all committed in `cbd-shots/`)

- `cbd-top-hud0.png` (372,194 B) — ortho top-down, HUD hidden, 17.0 sun,
  long shadows, slim monorail as a thin line down the boulevard, block
  fill (trees/planters/benches) visible on the rims.
- `cbd-oblique-hud0.png` (375,873 B) — 3/4 oblique (~36°), HUD hidden;
  heights read directly, gold roof caps on the tallest towers, marina +
  boats + promenade in the foreground. Weak: the hills backdrop is a flat
  orange dune; the haze washes out the distant ring (stage 2 terrain).
- `cbd-avenue.png` (227,307 B) — CORSO AZZURRA street level, full HUD:
  Stella + blue van + yellow truck in three lanes, 2 peds mid-crosswalk
  on the zebra, red traffic lights, lamps, towers both sides. Weak: tower
  facades are flat beige/teal slabs with sparse window dashes; the sky is
  a thin strip; dispatch lists boat/tower units (pre-existing).

### Kit check — level 31

`node cli/makefun.mjs check --repo <costa-verde> --json` → **ok: true**.
(The only uncommitted item at check time was the untracked
`.playwright-mcp/` scratch dir, not part of the entry.)
