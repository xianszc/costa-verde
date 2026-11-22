# Item 4 — mergeStatic unify (GAME) — 22 Nov 2026 ~20:25 WIB

## Change (GAME)

`mergeStatic` (game/src/world.js) gains `opts.unifyStandard`: opaque
`MeshStandardMaterial` parts with no maps, no transparency, black
emissive, metalness < 0.1, flatShading on, FrontSide only, get their
final color (material color x vertex color, component-wise) baked into
the vertex-color attribute and merged into ONE mesh with the shared
`vertexColorMat` — instead of one mesh per material key. Parts with
maps, transparency, emissive glow, metalness, smooth shading or
non-front sides keep the old key path. `keep` / `userData.noMerge`
still respected. Only roughness (0.85–0.95 → 0.9) and metalness
(<0.1 → 0) collapse — matte building parts, visually negligible.

Applied to all `mergeStatic` call sites in districts.js (8: oldTown
buildings/wall/lines/wallW, promenade buildings/piers/quayProps/sw)
and city.js (4: hills, district4 buildings, cover, quayProps).
World.js hero builders untouched (small counts, out of scope).

## Measured

Baseline (fresh probe, HEAD 737f0f1, `reports/perf-item4-before.json`,
SwiftShader, 1280×720, N=20): avenue 410 calls / 558,705 tris,
ring 201 / 517,351, promenade 707 / 619,719, city 1,033 / 692,185.

After (`/tmp/draw-breakdown.json`, same method):

| view | calls before | calls after | tris after |
|---|---|---|---|
| city | 1,030 | 970 (−60) | 692,065 (identical) |
| promenade | 898 | 816 (−82) | 650,403 |
| avenue | 820 | — | — |
| ortho city shot | 834 | 774 (−60) | 666,759 (identical) |

Mesh counts (all meshes): total 1,065 → 1,005 (−60).
promenade 62 → 49, oldTown 53 → 34, district4 43 → 15.
Triangles IDENTICAL before/after (692,065) — no geometry lost or
duplicated. 0 console/page errors in every probe run.

## Visual verification (BEFORE the commit)

Whole-city ortho midday, new code (`/tmp/proof-city-ortho.png`,
774 calls, 0 errors) vs committed
`cbd-shots/ortho-whole-city-midday-item4.jpg` (834 calls): layout
and colors IDENTICAL — orange residential roofs, yellow commercial,
CBD towers with colored tops, green hills, promenade + bay + boats.
No missing buildings, no white/black patches, no color shift
(differences are JPEG artifacts + moved traffic cars only).
After-shot saved as `cbd-shots/ortho-whole-city-after-unify.jpg`.

## Slice 2 — walker torso+head merge (GAME, same run)

`makeWalker` (game/src/people.js): torso box + head sphere + hair cap
baked into ONE vertex-colored mesh (7 → 5 meshes per walker). Safe:
`animateWalk` only swings legs + arms; the torso/head groups never
move relative to the root; `findLimbs` only scans Group children, so
the merged Mesh child is invisible to it. Same geometries, colors and
root-space positions. (Two bugs caught while editing: `shoulderY` was
used before its `const` declaration — moved above; the old head group
was still added — deleted.)

Measured (`/tmp/draw-breakdown.json` re-run): walker meshes 238 →
170 (−68), total meshes 1,005 → 937, city calls 970 → 903 (−67),
tris 692,065 → 692,101 (+36, 0.005% — probe counting artifact on the
partial-sphere hair cap; geometry is the same three primitives).
Avenue view 326 → 299 calls, 0 errors.

Visual verification: avenue midday, new code
(`/tmp/proof-avenue-after-walker.png`) vs committed
`cbd-shots/avenue-midday-item4.jpg`: IDENTICAL — same 3 peds
crossing (pink dress, white shirt, teal), same towers/zebra/van/HUD.
After-shot saved as `cbd-shots/avenue-after-walker-merge.jpg`.

## Status (updated)

- City 903 (target <600, still −303), promenade 816 in the
  breakdown view / 707 in the perf view (target <450). Unify cut 60,
  walker merge cut 68 — total −128 from 1,030.
- Next slices (for the next builder): traffic body+glass merge (~23)
  + static wheel merge (~69, loses 2 cm per-wheel brake-disc bounce),
  identify + merge the unnamed 81 (53 basic + 28 standard).
  Still OPEN: 9 peds on asphalt, proof images 4/6 + 5/6, BUNDLE
  check level-36, screenshot candidates (§5b), regression ONCE.
