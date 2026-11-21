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
