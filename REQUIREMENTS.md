# AZZURRA — Requirements (working checklist)

Source of truth: the BUILD BRIEF from Xian (20 Nov 2026) + `GAME_BIBLE.md` +
the live make.fun requirements for gta6-01. This file is the builder's own
checklist, rewritten fresh for the rebuild.

## Hard rules (from the brief)

- [ ] Before EVERY file write: `pgrep -f makefun`. Recording dead → STOP, report.
- [ ] All code written by the builder. Other models: non-code text only.
- [ ] Everything original. No real brands, streets, agency acronyms, TV titles.
- [ ] Procedural only: geometry, textures, audio (WebAudio). No third-party assets.
- [ ] Offline: zero network requests. Libraries vendored under `game/`.
- [ ] No secrets in code, logs or git.
- [ ] Playwright MCP throughout. Commit often, push regularly.
- [ ] Do not seal or submit without Xian's approval.

## Kit limits (level 27, verified from RULES.txt)

- [ ] `game/`: plain files only, ≤993 entries, ≤48 MiB, paths ≤1,000 UTF-8 bytes.
- [ ] `game/index.html`: ≤1 MiB.
- [ ] `/output`: ≤1,000 entries, ≤64 MiB (game/ + screenshots/ + dossier.json).
- [ ] `screenshots/`: 3–4 images, each ≤256 KiB, long side ≤1280, short side ≥480.
- [ ] `main.ts` at repo root copies `game/` + `screenshots/` to `/output` and
      writes `/output/dossier.json` via `vendor/makefun-game.ts` (unchanged).
- [ ] `dossier.json` text capped 163,840 bytes.
- [ ] Vendored libraries as `*.min.js` under `game/vendor/` (excluded from the
      authorship count). `vendor/makefun-game.ts` copied unchanged.
- [ ] Kit check after every milestone:
      `node cli/makefun.mjs check --repo <dir> --worktree` (from the kit dir).

## Concept lock

- [ ] Fictional cliffside Mediterranean riviera town + harbor (Porto Azzurra).
- [ ] Golden hour default; full day/night cycle; optional storm event.
- [ ] Own hub: the Captain's Logbook (Logbook / Crew / Chart / Garage / Vault / Waves).
- [ ] No volcano, no island map, no Southeast-Asian look.

## Architecture — 8 districts (each: ≥6 archetypes, variants, own palette)

- [ ] 1. Cliff Villas — stacked white cubes, pergolas, blue shutters, bougainvillea, pools.
- [ ] 2. Yacht Marina — low pavilions, boardwalks, masts, striped canopies, sheds, cranes.
- [ ] 3. Fortress Old Town — sandstone walls, bastions, bell towers, arcades, stair-streets.
- [ ] 4. Seaside Promenade & Casino — Art Deco stepped crowns, curved corners, neon, palms.
- [ ] 5. Lighthouse Point — stone cottages, striped lighthouse + rotating beam, fishing huts.
- [ ] 6. Funicular Hills — tiered terraces, working funicular, chapels, pastel townhouses.
- [ ] 7. Olive-Grove Countryside — farmhouses, stone fences, windmill, vineyards, barns.
- [ ] 8. Quarry / Industrial Edge — silos, cranes, conveyors, container stacks, rusty sheds.
- [ ] Silhouette test: each district readable by shape + color from far away.

## Characters

- [ ] Fashion-illustration proportions: slightly elongated, small heads, strong silhouettes.
- [ ] Flat color blocks + one accent color, soft rim light.
- [ ] 6 body archetypes (lean, broad, tall, short, heavy, elderly) × outfit parts.
- [ ] 3 crews: signature color + silhouette item + gait (Mariners teal, Harvest olive,
      Bright Lights magenta).
- [ ] Police: distinct uniform + helmet shapes per rank/unit.
- [ ] Civilians vary by district (sailors, tourists, farmers…).
- [ ] 10 main characters, each with unique silhouette + signature item + illustrated portrait.
- [ ] Articulated limbs: walk, run, drive, aim, fight, idle animations.

## Content (from GAME_BIBLE.md)

- [ ] 8 chapters, 15 missions (M1–M15, finale "One Last Score").
- [ ] 9 side jobs.
- [ ] 9 vehicles (+ rideable funicular, Harbor Guard boat).
- [ ] 5 weapon slots.
- [ ] Economy in soli; 6 ranks (Drifter → King of the Riviera).
- [ ] 3 radio stations (Radio Lume, Onda Azzurra, Radio Cava).
- [ ] 15 fictional brands.
- [ ] 4 visible differentiators (day/night + storm; funicular + boats; Logbook hub;
      8 readable districts).

## Look

- [ ] Golden-hour gradient sky, low sun, warm haze, soft shadows, bloom, color grade.
- [ ] Emissive windows at dusk; layered cars; dense traffic and pedestrians.
- [ ] Never flat grey boxes.
- [ ] HUD panels fully visible at 1280×720 and 1920×1080.

## Quality loop (after every feature)

- [ ] Playwright screenshots from 3 angles; console clean; zero network requests.
- [ ] Honest critique; fix; re-screenshot.
- [ ] Report after each milestone: full-size screenshots + 3 lines
      (what changed / what is weak / what is next).

## Milestones

- [ ] **Step 0:** GAME_BIBLE.md + 2 lineup screenshots (8 hero buildings; full cast).
      Await Xian's approval before the next milestone.
- [ ] **M1:** Playable core — walk, drive, camera, HUD, day/night, one district.
- [ ] **M2:** All 8 districts + traffic + pedestrians.
- [ ] **M3:** Missions 1–7 + Logbook hub + crews.
- [ ] **M4:** Missions 8–15 + side jobs + wanted system + storm event.
- [ ] **M5:** Polish — radio, audio, particles, cover art, final screenshots, kit check.

## Deadlines

- Entries close: Tue 24 Nov 2026 15:00 UTC (22:00 WIB). Result: 10 Dec 2026.
- Submit only on Xian's explicit "Gas submit" after his review.
