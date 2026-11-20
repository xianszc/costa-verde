# Azzura Heist — Requirements (working checklist)

Source of truth: the BUILD BRIEF from Xian (20 Nov 2026) + `GAME_BIBLE.md` +
the live make.fun requirements for gta6-01. This file is the builder's own
checklist, rewritten fresh for the rebuild.

## Hard rules (from the brief)

- [x] Before EVERY file write: `pgrep -f makefun`. Recording dead → STOP, report.
- [x] All code written by the builder. Other models: non-code text only.
- [x] Everything original. No real brands, streets, agency acronyms, TV titles.
- [x] Procedural only: geometry, textures, audio (WebAudio). No third-party assets.
- [x] Offline: zero network requests. Libraries vendored under `game/`.
- [x] No secrets in code, logs or git.
- [x] Playwright MCP throughout. Commit often, push regularly.
- [x] Do not seal or submit without Xian's approval.

## Kit limits (level 27, verified from RULES.txt)

- [x] `game/`: plain files only, ≤993 entries, ≤48 MiB, paths ≤1,000 UTF-8 bytes.
- [x] `game/index.html`: ≤1 MiB.
- [x] `/output`: ≤1,000 entries, ≤64 MiB (game/ + screenshots/ + dossier.json).
- [x] `screenshots/`: 3–4 images, each ≤256 KiB, long side ≤1280, short side ≥480.
- [x] `main.ts` at repo root copies `game/` + `screenshots/` to `/output` and
      writes `/output/dossier.json` via `vendor/makefun-game.ts` (unchanged).
- [x] `dossier.json` text capped 163,840 bytes.
- [x] Vendored libraries as `*.min.js` under `game/vendor/` (excluded from the
      authorship count). `vendor/makefun-game.ts` copied unchanged.
- [x] Kit check after every milestone:
      `node cli/makefun.mjs check --repo <dir> --worktree` (from the kit dir).

## Concept lock

- [x] Fictional cliffside Mediterranean riviera town + harbor (Porto Azzura).
- [x] Golden hour default; full day/night cycle; optional storm event.
- [x] Own hub: the Captain's Logbook (Logbook / Crew / Chart / Garage / Vault / Waves).
- [x] No volcano, no island map, no Southeast-Asian look.
- [x] Title: "Azzura Heist" (one 'z') everywhere — GAME_BIBLE, README, page
      titles, HUD logo, main menu (title logo + tagline). Hero tower:
      "Azzura Tower". City: "Porto Azzura".

## Architecture — 9 districts (each: ≥6 archetypes, variants, own palette)

- [x] 1. Cliff Villas — stacked white cubes, pergolas, blue shutters, bougainvillea, pools.
- [x] 2. Yacht Marina — low pavilions, boardwalks, masts, striped canopies, sheds, cranes.
- [x] 3. Fortress Old Town — sandstone walls, bastions, bell towers, arcades, stair-streets.
- [x] 4. Seaside Promenade & Casino — Art Deco stepped crowns, curved corners, neon, palms.
- [x] 5. Lighthouse Point — stone cottages, striped lighthouse + rotating beam, fishing huts.
- [x] 6. Funicular Hills — tiered terraces, working funicular, chapels, pastel townhouses.
- [x] 7. Olive-Grove Countryside — farmhouses, stone fences, windmill, vineyards, barns.
- [x] 8. Quarry / Industrial Edge — silos, cranes, conveyors, container stacks, rusty sheds.
- [x] 9. Downtown Bay Skyline — 12+ towers, 20–60 floors, each its own silhouette
      (Azzura Tower 60f spire, twin towers + sky bridge, curved glass, needle,
      hotel + rooftop pool, cantilevered crown, helipad, ziggurat, LED strips,
      brand billboard, podium + garden). Glass facades, mullion grids, emissive
      windows, setbacks, rooftop machinery, blinking warning lights. Street level:
      plazas, fountains, walkways, garages, elevated roads, monorail, tunnels.
      Playable: lobbies, helipads, skyscraper heist, rooftop chase, base jump,
      helicopter ride. Visible from every district as a backdrop.
- [x] Silhouette test: each district readable by shape + color from far away.
- [x] Performance: instancing + shared materials, LOD (far towers = silhouettes
      with emissive texture), frustum culling, merged static geometry.
      Measured (SwiftShader, 1280×720): buildings 129 draw calls / 25,780 tris
      (was 527); skyline 40 calls / 13,046 tris (was 124).

## Characters

- [x] Fashion-illustration proportions: slightly elongated, small heads, strong silhouettes.
- [x] Flat color blocks + one accent color, soft rim light.
- [x] 6 body archetypes (lean, broad, tall, short, heavy, elderly) × outfit parts.
- [x] 3 crews: signature color + silhouette item + gait (Mariners teal, Harvest olive,
      Bright Lights magenta).
- [x] Police: distinct uniform + helmet shapes per rank/unit.
- [x] Civilians vary by district (sailors, tourists, farmers…).
- [x] 10 main characters, each with unique silhouette + signature item + illustrated portrait.
- [ ] Articulated limbs: walk, run, drive, aim, fight, idle animations. (M1+)

## Content (from GAME_BIBLE.md)

- [x] 9 chapters, 17 missions (M1–M17, finale "One Last Score" + Skyline Job).
- [x] 10 side jobs.
- [x] 10 vehicles (+ rideable funicular, Harbor Guard boat).
- [x] 5 weapon slots.
- [x] Economy in soli; 6 ranks (Drifter → King of the Riviera).
- [x] 3 radio stations (Radio Lume, Onda Azzura, Radio Cava).
- [x] 15 fictional brands.
- [x] 5 visible differentiators (day/night + storm; funicular + boats; Logbook hub;
      9 readable districts; old riviera vs glass skyline).

## Look

- [x] Golden-hour gradient sky, low sun, warm haze, soft shadows, bloom, color grade.
- [x] Emissive windows at dusk; layered cars; dense traffic and pedestrians.
- [x] Never flat grey boxes.
- [x] HUD mockup (`game/hud.html` + `game/src/hud.css`): mission panel + stage bar,
      clock, money, wanted stars + status, XP bar, health/armour, circular minimap,
      district + street name, weapon bar, vehicle readout, radio widget, dialogue
      box with illustrated portrait, police response panel. Screenshots at
      1280×720 and 1920×1080 in `reviews/hud/`.
- [ ] HUD panels fully visible at 1280×720 and 1920×1080 in the playable game. (M1)

## Quality loop (after every feature)

- [x] Playwright screenshots from 3 angles; console clean; zero network requests.
- [x] Honest critique; fix; re-screenshot.
- [x] Report after each milestone: full-size screenshots + 3 lines
      (what changed / what is weak / what is next).

## Milestones

- [x] **Step 0:** GAME_BIBLE.md + 3 lineup screenshots (9 hero buildings; full cast;
      Downtown Bay Skyline). Approved by Xian after the District 9 revision.
- [x] **Fix round:** 6 fixes (4 tree types, layered fountain, LOD towers in hero
      blue/glass, shader water with boats, tidy mullion facades, merged geometry +
      instancing) + title rename to "Azzura Heist" + HUD mockup. Awaiting Xian's
      approval before M1.
- [ ] **M1:** Playable core — walk, drive, camera, HUD, day/night, one district.
- [ ] **M2:** All 9 districts + traffic + pedestrians.
- [ ] **M3:** Missions 1–7 + Logbook hub + crews.
- [ ] **M4:** Missions 8–15 + side jobs + wanted system + storm event.
- [ ] **M5:** Polish — radio, audio, particles, cover art, final screenshots, kit check.

## Deadlines

- Entries close: Tue 24 Nov 2026 15:00 UTC (22:00 WIB). Result: 10 Dec 2026.
- Submit only on Xian's explicit "Gas submit" after his review.
