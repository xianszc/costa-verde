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

## Status

- City 970 (target <600, still −370), promenade 816 in the
  breakdown view / 707 in the perf view (target <450). The unify
  cut 60 — the remaining big chunks are walkers 238, traffic 283,
  figures 107, unnamed 81 (53 basic + 28 standard, unidentified).
- Next slices (for the next builder): walker torso+head merge
  (~68 calls; verify head never animates independently), traffic
  body+glass merge (~23) + static wheel merge (~69, loses 2 cm
  per-wheel brake-disc bounce), identify + merge the unnamed 81.
  Still OPEN: 9 peds on asphalt, proof images 4/6 + 5/6, BUNDLE
  check level-36, screenshot candidates (§5b), regression ONCE.
