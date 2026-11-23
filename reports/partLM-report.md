# Round-9 part L+M — wide-road shootout + colorful district map

## L — 03-action re-shoot (Xian 20:46: "di jalan yang luas, kelihatan karakter, musuh dan npc")

03-action part K (quay corridor, top-down) REJECTED by Xian. New staging:
`?shot=widefire` (new branch in `game/src/game.js` + anchors in
`game/src/anchors.js`) — Elio STANDING on the wide **Corso Azzurra**
(north-south avenue, 5.2u = 15.6 m), facing north toward the Azzura
Tower, Tamburo, wanted 2★. Camera LOW south-east of Elio on the road
(2.0, 1.6, -5.5), looking north — Elio + cruisers + NPCs in one frame.

Staging (in the branch, shot-only, no gameplay change):
- 2 nearest Guard units parked on the avenue in the firing line
  (4u + 9u north of Elio, facing south); their `fireTimer = 0` and one
  `combat.update()` call draws enemy return-fire tracers.
- 3 nearest peds placed on the avenue sidewalks in frame.
- Mission card (`.panel.mission`) hidden in-branch; RANK UP toast
  (`#side-toast`) + shop prompt (`#side-prompt`, re-shown by the side
  engine's 200 ms interval — the shoot script REMOVES the node) hidden
  in the shoot script right before the capture.

Why the Corso, not the Lungomare: the boulevard's monorail pillars
(every 6u on the centreline) split the frame and hid Elio; the Corso
has no pillars on the firing line. Earlier boulevard takes also hit a
traffic-light pole (Elio hidden behind it) and a sidewalk tree (camera
behind it) — the final camera sits ON the road, clear of both.

Final: `screenshots/03-action.jpg` (1280×720 JPEG q85, 150,827 B) +
`reports/partL-shoot-cover-cand.jpg` (same image). Verified by reading
the file: Elio big + central, muzzle flash at his shoulder, player +
enemy tracers crossing both ways, cruiser visible left of Elio,
interceptor centre-right, 2 peds on the sidewalks, full HUD, dusk.
Honest weaknesses: Elio's pose is stiff (arms at sides, no visible
gun — the flash + tracer carry the shooting); the cruiser reads as a
dark car (livery/beacon not clearly readable at this size); the flash
partly covers Elio's head/shoulders. 0 console errors.

GAME changes (L): `game/src/game.js` (new `?shot=widefire` branch),
`game/src/anchors.js` (widefire_spot + vantage_widefire_cam). No
gameplay mechanics changed — staging only.

## M — map colorful, every area its own color (Xian 20:46)

One shared palette on BOTH map surfaces (HUD minimap + full map):
- OLD TOWN #d9a441 (ochre) · DOWNTOWN #6f9fd8 (blue) ·
  BOULEVARD #e07856 (coral) · QUAY #4fae8a (teal) ·
  PROMENADE #9b7fd4 (violet) · RESIDENTIAL #8fae5a (leaf green) ·
  BAY / MARINA #5fa8b5 (sea blue, existing).
- Full map (`game/src/sidecontent.js` renderMap): zone rects under the
  roads/markers + a Districts legend (7 chips) in the side panel.
- HUD minimap (`game/index.html`): redrawn in the REAL map projection
  (sx = (x+60)/120*150, sy = (z+42)/55*150) with the same palette +
  the real CBD street grid — the player arrow lands on its true
  district. (The old art was schematic; its road band sat at the
  wrong z, so the arrow would have landed on the wrong color.)
- No 3D world colors changed — map/minimap only.

Proof: `reports/partM-map-colorful.png` (HUD with the colorful
minimap) + `reports/partM-fullmap.png` (full map with legend).
Full-map probe: overlay open, SVG present, 7 legend items, 7 zone
rects, 0 console errors. The player arrow sits on Downtown blue
(Elio at Corso z=-8 = downtown zone) — correct.

GAME changes (M): `game/index.html` (minimap SVG),
`game/src/sidecontent.js` (zone rects + legend),
`game/src/hud.css` (.map-legend styles). No gameplay changed.

## Files changed (GAME, all under live recording stage1ae)

- `game/src/game.js`, `game/src/anchors.js` (L staging)
- `game/index.html`, `game/src/sidecontent.js`, `game/src/hud.css` (M map)
- `screenshots/03-action.jpg` (new), `reports/partL-shoot-cover-cand.jpg`
  (new), `reports/partM-map-colorful.png` (new),
  `reports/partM-fullmap.png` (new), `reports/partLM-report.md` (this file)
- 04-features untouched (still the part K take). 01-cover + 02-city
  untouched. M1/M7 NOT re-run (already PASS human-like in part K).
