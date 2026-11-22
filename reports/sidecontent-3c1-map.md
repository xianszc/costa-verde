# 3c.1 Full-screen map — wired + verified (22 Nov, builder 0721f86c)

Time: ~20 min (box 45 min). Recording 01a201cc live. HEAD c571deb at start.

## GAME changes

- `game/src/main.js`: `import './sidecontent.js'` (side-effect import).
  The module was COMPLETE but dead: it self-boots by polling for
  `window.__game`, yet NOTHING imported it (verified by grep over
  `game/src/`, `game/*.html`, `game/test/` — only comments in
  `side-*.js` mention it). One import wires the whole side system:
  map (M), jobs/races engine, shops API, collectibles, jumps,
  standing/rank.
- `game/src/game.js`: added `setPaused` to the `createGame()` return
  object. GAME BUG found by the smoke test: `main.js` overwrites
  `window.__game` with the return value, which LACKED `setPaused`
  (the internal `window.__game` assignment inside createGame HAS it).
  `openMap()` threw `game.setPaused is not a function` and the map
  never opened. Fixed here; map opens now, zero errors.
- `game/src/hud.css`: styles for the side UI that had NO CSS at all
  (`#side-toast`, `#side-job-panel`, `#map-overlay` + `.map-*`,
  `#shop-overlay` + `.shop-*`, `#side-prompt`, `#side-hud`).
  Map card width capped at 980 px so the footer fits at 1280×720.

## Verification (smoke script /tmp/side-smoke.mjs, 8941, fastsim=2)

- `window.__side` attached; `getState()` returns jobs/races/shops/
  standing with live money/XP. Mode `play`, zero page errors.
- M opens the map: overlay visible, SVG present, **24 markers**
  (3 shops + 9 jobs + 4 races + 8 jumps), **20 coin dots**,
  footer "Jobs 0/9 · Races 0/4 · Jumps 0/8 · Coins 0/20",
  25 waypoint list buttons (24 + Clear). M closes it again.
- Screenshot: `cbd-shots/map-fullscreen-stage1k.png` — districts,
  street names, bay, player arrow, waypoint list all render.
  Cosmetic: district label "DOWNTOWN BAY SKYLINE" overlaps a street
  name; card scrolls a little at 720p (overflow:auto).

## Item 0A verification (against code, not re-researched)

- Shops: code exists (side-shops.js 3 sections), `buy()` exists —
  UNWIRED until this commit (no import). Confirmed.
- Full-screen map: code exists (sidecontent.js `openMap`/`renderMap`)
  — UNWIRED until this commit. Confirmed.
- Side jobs/races/jumps/collectibles/standing/rank: all exist in
  code, all UNWIRED until this commit. Confirmed.
- Save/load of side content: own localStorage store
  `azzura-side-v1`, persisted on every mutation — NOT the game's
  3-slot save, but money/health/armour/ammo/fuel/damage ARE in the
  game snapshot, so slot save/load covers the spendable state.
- The full item 0A answer is pasted VERBATIM in the builder's final
  report (brief item 0), not here.
