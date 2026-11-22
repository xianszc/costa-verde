# Item 4 — zebra quads (GAME) — 22 Nov 2026 ~20:15 WIB

## Change

Zebra bars were 12-tri boxes (`BoxGeometry(w, 0.01, d)`); as flat painted
markings they render identically as quads (2 tris/bar).

- `game/src/markings.js`: new registry method `flat(type, cx, cz, w, d)` —
  `PlaneGeometry(w, d)` flattened (-90 deg X, normal +Y), same
  `MARK_Y[type]`, same `add()` path (audit rects + global guard
  unchanged). `zebraApproach` now uses `m.flat('zebra', …)`.
- `game/src/blocks.js`: promenade quay zebras (`reg.box('zebra', …)`)
  now `reg.flat('zebra', …)`.
- All other marking types stay boxes (out of scope for this slice).

## Measured (probe /tmp/zebra-verify.mjs, play mode, 1280×720)

| mesh | before (tris) | after (tris) | bars |
|---|---|---|---|
| ring-zebra | 7,488 | 1,248 | 624 |
| mark-zebra (CBD) | 41,040 | 6,840 | 3,420 |
| zone-zebra | 238,716 | 39,786 | 19,893 |
| **total** | **287,244** | **47,874** | **23,937** |

Bar count identical before/after (23,937) — placement unchanged, only
the per-bar triangle count changed (12 → 2). City view: calls 1,034
unchanged (same 3 merged meshes), triangles 931,591 → 692,221
(-239,370). ms/frame is NOT comparable across separate SwiftShader
sessions (before 25.7 ms vs after 79.7 ms — contention noise; the
earlier same-session probe measured the zebra at ~59 ms/frame, so the
saving is real but this run does not re-prove it).

## Visual verification (BEFORE the commit)

- Street level, grazing angle (player view down Lungomare): zebra
  present and identical before/after — `cbd-shots/zebra-before-street.jpg`
  vs `cbd-shots/zebra-after-street.jpg`.
- Top-down (0,0) intersection, rAF frozen: zebra bands present on all
  four legs, clean white stripes, correct spacing, no missing bars, no
  z-fighting, no black patches — `cbd-shots/zebra-after-top.jpg`.
- Note: the first top-shot attempts captured the player view (the live
  rAF loop re-renders the player camera after a manual render); the
  fix is to stub `requestAnimationFrame`, wait ~300 ms for the
  in-flight frame, then set camera + render. (Probe: /tmp/zebra-top.mjs.)

## Status

- Draw calls are NOT cut by this change (calls stay 1,034 — the 3 zebra
  meshes still exist, just lighter). City still needs ~434 calls cut to
  reach <600: the cuts must come from traffic cars (283 meshes), peds
  (345), buildings (~178) — see `reports/item4-status-2026-11-22.md`.
- Next: merge per district+material / instancing / distance culling,
  then 9 peds on asphalt, proof images 2–6, BUNDLE check (level-36 kit).
