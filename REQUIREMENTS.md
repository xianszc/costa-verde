# COSTA VERDE — REQUIREMENTS.md (gta6-01)

Checklist from the kit's RULES.txt (the law) + the makefun-gta6-bounty skill.
Re-read before every submission. Status: Slice 1 in progress.

## Event
- Competition: gta6-01 "Make GTA 6", $1,666 USDC, free entry.
- Deadline: **Mon 24 Nov 2026 22:00 WIB** (15:00 UTC). Result: 10 Dec 2026 22:00 WIB.
- Prizes (100 places): 1st $500, 2nd $250, 3rd $150, 4th–10th $38, 11th–25th $10, 26th–50th $6, 51st–100th $4.
- Submission limits: max **5/day, 10 total** per entrant. Final entry = most recent submission with a receipt before the deadline. Resubmission allowed until the deadline.
- Repo: https://github.com/xianszc/costa-verde (public). Anchor root `05bd0af` (drand round 34097115, NEVER rewrite). LICENSE MIT `1ce2913`.
- Recording for this build: `01a1f41f-1149-7349-9017-29fa3b974742` (sealed recordings only; no transcript upload). Slice 1's recording `01a1f3fb` FAILED to seal — `main.ts`, `serve.ts`, `game/index.html`, `README.md` have no sealed authorship yet and MUST be fully rewritten under `01a1f41f` (done in Slice 2).

## Deliverables
- [x] `main.ts` (Node 22, stdlib only) — copies `game/` + `screenshots/` to `/output`, writes `/output/dossier.json` via `buildDossier` from `vendor/makefun-game.ts`. Must carry ≥1 authored line.
- [x] `serve.ts` — serves `game/` at localhost:8080.
- [x] `vendor/makefun-game.ts` — kit's copy, UNCHANGED (byte-for-byte).
- [x] `game/` — static files only, no build step, no network at runtime. `game/index.html` opens in desktop Chrome and plays offline.
- [x] `screenshots/` — 3–4 PNG/JPEG, first by name = cover, real renders of the game's own code, never edited/composited/borrowed.
- [x] `LICENSE` (MIT) + short `README.md` (how to run, controls, feature list).

## File layout
- `game/index.html` — page shell, HUD DOM, menu screens, import map for three.
- `game/src/config.js` — constants, districts, vehicles, tuning (data-driven).
- `game/src/world.js` — deterministic city gen (grid + coastal boulevard, districts, collision, palms, billboards, storefronts).
- `game/src/characters.js` — human-shaped low-poly player + pedestrians (procedural, no external models).
- `game/src/vehicles.js` — cars (hero lime wedge supercar + traffic/parked), handling, enter/exit.
- `game/src/police.js` — wanted heat, pursuit, helicopter, BUSTED logic.
- `game/src/combat.js` — pistol hitscan, ammo, reload.
- `game/src/audio.js` — procedural WebAudio: sirens, gunshots, stings.
- `game/src/fx.js` — pooled particles (tire smoke, muzzle flash, hit sparks, cruiser smoke/fire) + skid marks (Slice 4).
- `game/src/main.js` — loop, third-person camera, input, HUD, save, debug API.
- `game/vendor/three.module.min.js` — vendored Three.js (minified, excluded from authorship count).
- `main.ts`, `serve.ts`, `vendor/makefun-game.ts` at repo root.

## Scoring (judge: z-ai/glm-5.3-flash, pairwise A/B, margin 1–5; final = 3 Swiss rounds + playoff over top 100)
In order: (1) complete open world shown in screenshots; (2) depth/fun; (3) feel/polish; (4) look/originality; (5) structure (source split into files with one clear job each, named for what they do).
- [ ] Screenshots show: city on foot AND by car, HUD + minimap, traffic, police, a mission in progress — each readable at a glance when shrunk. Cover shows several systems at once.

## Hard limits (gate — first four rows must pass)
- [ ] `game/`: plain files/dirs only (no symlinks), ≤993 entries, ≤48 MiB total, every path ≤1,000 UTF-8 bytes, `game/index.html` ≤1 MiB.
- [ ] Every reference is a `data:` URI or a file inside `game/`; nothing loads over the network. Import map (at most one) maps bare specifiers to files inside `game/`.
- [ ] `screenshots/`: 3–4 images, names letters/digits/`. _ -` (1–128 chars, not starting with `.` or `-`), each ≤256 KiB, whole PNG/JPEG, long side ≤1280, short side ≥480.
- [ ] `dossier.json` byte-for-byte what `buildDossier` writes, ≤1.5 MiB (source text cap 160 KiB).
- [ ] `/output` total ≤1,000 entries, 64 MiB (game/ + screenshots/ + dossier.json share it).
- [ ] JS: every `.js`/`.mjs` parses as an ES module (shown, never decides validity).

## Transcript / code checks (strict — sealed recordings only)
- [ ] ≥30% authored lines overall; ≤40% unwritten; entrypoint `main.ts` ≥1 authored line; some file's final content from ≥2 write/edit messages.
- [ ] Every counted file written by a recorded agent session (started after the recording began); vendored `*.min.js` excluded.
- [ ] Run record (makefun-run.json) complete: harness, version, provider, model, effort declared/recorded by every top-level session.
- [ ] No copied Rockstar/GTA content: own city, characters, vehicles, names, story, art, sounds. Nothing from any commercial game.

## Slice 1 scope (this build — runnable, submittable) — DONE 19 Nov, commit 8bf2914
- [x] Start menu: title/logo, tagline, hero look, New Game / Continue (disabled "No saved game yet" until a save exists) / Controls / Settings / Credits.
- [x] World: ground, roads (grid + coastal boulevard), buildings (varied heights, distinct districts), sky + low warm sun, long shadows, golden-hour palette.
- [x] Player on foot: human-shaped low-poly character, WASD move, sprint, third-person chase camera (mouse drag / pointer).
- [x] ONE drivable vehicle: acid lime #70E000 wedge supercar, believable handling (accel/brake/steer), enter/exit with E, camera follows car. A few parked/traffic cars to steal/drive.
- [x] HUD: speed, health, mission text, wanted stars (0 in Slice 1 is fine), cash, minimap (small top-down), on-screen controls help.
- [x] Pedestrians + a few ambient traffic cars (simple movement) if time allows — do NOT block Slice 1 on them.
- [x] Procedural/low-poly geometry only — NO external 3D models, NO network at runtime.
- [x] Save: a save slot (localStorage) so Continue unlocks; start screen + way to save.

## Slice 4 scope (this build — polish: look + feel + performance) — DONE 19 Nov, commit TBD
Recording: `01a1f460-7dd9-77bc-b769-0ac8e8af6d2d` (started before this session; seal after commit).
- [x] Lighting fix FIRST: roads + sun-back building sides readable — hemisphere 0.68→1.05, brighter ambient ground, warm east fill light (no shadows), lighter asphalt #3a3a40→#52525c, sun 14°→17° / intensity 2.6→2.8. Golden hour ONLY — no day/night cycle, nothing darkens the scene. Verified by viewing the retaken screenshots: the road reads gray with visible lane markings, facades show window grids.
- [x] Particles & screen effects: tire smoke/dust on drift + hard accel, skid marks, muzzle flash, hit sparks, smoke/fire on a disabled cruiser, damage vignette, speed lines + FOV kick at high speed, fade transitions on mission start/finish/BUSTED/WASTED. Pooled particles (600-particle pool, no per-frame allocation) + 48-quad skid pool.
- [x] Audio: engine hum per vehicle (pitch follows speed), sirens that change with distance (volume + pitch), procedural radio with 3 stations + switch key (N), mute (M) still works. All WebAudio, no external files.
- [x] Performance: frame-time check in the playtest — **482 ms/frame over 17 frames** while driving at speed on this machine (SwiftShader, no GPU; under the 800 ms fail line). No memory leaks (particles pooled; the lifetime spawn counter proves emitters fire without growth).
- [x] Edge cases: pause (P) freezes EVERYTHING (gameTime, peds, traffic, beacons, clock — proven identical before/after 2.5 s paused); restart from pause/menu works; window resize keeps the game playable; lost focus auto-pauses.
- [x] Slice 3 fixes (cheap only): M2 timer 150→120 s; M4 far-timer 8→10 s + a second warning toast at 7 s; guards reposition between shots — strafe 1 s, then HOLD STILL 1.4 s to shoot (the hold phase is the player's window). The first version (constant strafing) made the M5 heist unfinishable — the playtest proved it — so it was reworked to strafe/hold cycles and the heist passes again.
- [x] Playtest: FULL REGRESSION **79/79 passed**, 0 console/page errors (61 Slice 1–3 + 1 strafe + 17 Slice 4). Kit check 5/0. Screenshots retaken: the road is readable in every shot; cover shows the chase (GT + 2 flanking cruisers + 3 stars + SPD panel + heli as AIR-1).
- Fixes found by testing: (1) `const fx = makeFx(scene)` ran before `scene` was declared — boot ReferenceError; moved after scene creation. (2) `CFG.MISSIONS`/`CFG.ESCORT` don't exist (separate exports) — the playtest crashed reading them; exposed MISSIONS + ESCORT in the debug API. (3) Favicon 404 logged a console error — added a `data:,` favicon link.

## Round 5 scope (custom round — structured city + neon atmosphere + cinematic cover) — IN PROGRESS 19 Nov
Recording: `01a1f485-a9db-719d-8071-4c3c4915e704` (started before this session; seal after commit). Backup branch `backup/r5-pre-city` at 0aeae2c (Slice 4) created BEFORE touching world.js. Direction: Xian's 4 reference images (another game's neon dusk city) = ATMOSPHERE ONLY — do NOT copy names, characters, mission text, dialogue, or HUD from them. Permanent rules in `~/workspace/makefun/gta6-01/city-system.md` (roads-first, planned blocks, density per district, trees only in green zones, validation, 7-shot inspection) and `~/workspace/makefun/gta6-01/cover-system.md` (5 cinematic cover candidates from real rendering, evaluated, 1 chosen). Setting stays GOLDEN HOUR / afternoon — never night.
- [x] City rebuild, roads-first (`game/src/city-layout.js`, pure ESM, no THREE/DOM — importable from browser and Node): road network defined first (6 lines, 14 m wide), buildings inside planned blocks (2x2 lots, 1.5 m street wall), district density (Downtown dense + 48–72 m towers, commercial medium-high, Palms Row low-medium, park low). 96 buildings, 7 towers. Trees ONLY in green zones: boulevard rows + park rows + residential yard trees (43 total) — never in lanes/intersections/crosswalks. Sidewalks + furniture in their own areas: 25 street lamps (InstancedMesh, warm glowing heads), benches, bins, 4 billboards moved to the boulevard promenade facing the road. Park block (x 45.5..102.5, z 119.5..176.5) with paths + 18 trees.
- [x] Validation system (`tools/validate-city.mjs`, re-runnable, exit 1 on any critical violation): checks buildings vs block/road/overlap/height/facing, trees vs road/intersection/crosswalk/building/sea, furniture vs road/intersection/crosswalk/building, billboards, park emptiness, and every gameplay point (spawns, parked cars, mission targets, escort waypoints, fare/delivery points, cache spots). First run found 16 violations (6 boulevard trees in lanes, 5 yard trees inside buildings, 2 benches in lanes, 2 false fare flags from a wrong curb check, 1 cache inside a building); all fixed (park block bug PARK_J 3→4, boulevard rows skip near cross roads, yard trees auto-reject corners, benches moved, curb check fixed, cache 3 moved (-80,-90)→(60,150) into the park). Final run: **0 critical violations, 0 warnings — CLEAN**.
- [x] Neon atmosphere (reference dusk, still golden hour): window textures with mixed-color lit windows (pink/cyan/yellow/green/orange + warm) per district profile (Downtown 35% lit, commercial 25%, residential 15% warm-biased); sky gradient purple zenith `#4a3670` → pink `#d96a9e` → warm orange horizon `#ffb066` + pinkish fog `#dd7a8f` (zenith is a mid purple, never black); bigger/brighter neon roof signs with glow halos (Downtown 35%, commercial 20%, residential 8%); storefront signs face the street they serve. Facade fix after inspection: unlit glass lightened (#26374e→#41546e), wider wall frames, fill light 0.5→0.65 — sun-back facades no longer read as black slabs.
- [x] Visual inspection (7 shots, `reviews/city-r5/`, all viewed): overview (grid clean, park + beach read), downtown street (neon towers + purple-pink sky), commercial (Old Town street, crosswalk, cruiser, ped), residential (Palms Row, sunlit facades, sea on the horizon), main intersection (towers + neon windows + lit lamp), boulevard (palms, sea, GT + cruiser, beacon), driving POV (GT crossing a zebra crossing). 3 shots re-taken after the first pass (cameras had been placed inside blocks, not on roads) + 1 retake for a better residential angle. Verdict: no building/tree in a road, no blocked intersection, district character visible; weakest is residential (buildings still read tall/dark from some angles).
- [x] Cinematic cover (cover-system.md, 5 candidates in `reviews/cover-r5/`, all real browser rendering, golden hour only): c1 GT speeding (7/10 — big GT, flat rear view); **c2 police chase + heli VISIBLE — WINNER 9/10** (heli top-left with spotlight cone, lime GT centre, 2 cruisers, crosswalk, sunset sea — the heli reads because holdHeli pins it low at y=16 ahead of the GT and the game is paused for the frame; v1 failed when a boulevard palm sat on the line of sight); c3 Leo + GT + towers (7/10 — both subjects clear, static pose; needed a new `placeHeroCar` debug helper because a parked car's group only syncs while driven); c4 low GT crossing (7.5/10 — dramatic low angle); c5 mission moment (8.5/10 — Leo + green beacon + sun + Ana dialogue, closest second). Cover = c2, copied to `screenshots/1-drive.jpg`.
- [x] Submission screenshots retaken (1280×720, all ≤256 KiB, all viewed): 1-drive = c2 chase + heli; 2-menu = title screen over the new city (minimap shows the new grid); 3-mission = M3 LOUD AND CLEAR (Leo + 4 guards + red markers + green beacon + Ana dialogue); 4-city = GT + flanking cruiser + SPD panel + toast.
- [x] Playtest: FULL REGRESSION + Round 5 checks (validator 0 violations, layout counts + neon sky live, all 31 spawns/markers outside buildings, all 10 caches reachable + collected, safehouse walk-out) — **85/85 passed**, 0 console/page errors (79 Slice 1–4 + 6 Round 5). Frame time 519 ms/frame over 16 frames (SwiftShader, under the 800 ms line).
- [x] Kit check 5/0. Commit on top of 0aeae2c, do NOT push, do NOT submit (Xian's review first).
- Fixes found by testing: (1) validator park block bug (PARK_J 3→4). (2) The GT coasts with no throttle (12→4 m/s in 4.5 s) — the heli hold must lead it by 26 m, not 48 m. (3) A parked car's group only syncs from heroCar while driven — added `placeHeroCar(x, z, heading)` to the debug API. (4) `hideUI` in the cover driver is sticky — kept elements need their inline display cleared. (5) The heli at its normal 42 m station sits above the chase camera's vertical FOV — `holdHeli` (new debug helper in police.js/main.js) pins it low for the cover; `freeCam` (new debug helper) fixes the camera for inspection/cover shots.

## Slice 3 scope (this build — story + side content + progression) — DONE 19 Nov, commit TBD
Recording: `01a1f445-fdf1-724f-a913-78ee1b80a965` (started before this session; seal after commit).
- [x] Story missions 2–5 (total 5 incl. First Light): real arc for Leo + Ana with a payoff for "what Ana really wants from Leo"; each mission has briefing dialogue (speaker name), objective marker + waypoint, success AND failure states, cash reward. Variety: timed delivery (M2 THE RUN), shootout waves (M3 LOUD AND CLEAR), chase/escort (M4 THE ESCORT), multi-stage heist finale ending in a credits screen (M5 THE VERDE HEIST). Data-driven: missions in config objects, not hard-coded into the loop. Missions start at Ana (mission giver) — complete a mission, return to Ana for the next.
- [x] Side activities: (a) taxi fares — pick up a passenger, drive to the marker, get paid; (b) timed courier deliveries; (c) 10 hidden "verde" caches with HUD counter + minimap hint when near. All repeatable, all pay cash.
- [x] Progression: cash from missions + side jobs; reputation levels (Outsider → Known → Respected → Runs the Block) rising with completed jobs; garage/safehouse shop — buy armour (+50 max health), nitro (Shift boost for the GT), engine tune (+8 m/s GT top speed) with cash. Safehouse saves + heals. Save/load extended to mission progress, cash, rep, collectibles, upgrades.
- [x] Slice 2 fixes (cheap, high value): ramming a police car with the player's car adds heat; 1-star cruisers a touch faster (topSpeed 40→43) so flooring it isn't a free escape.
- [x] HUD polish: mission panel shows "MISSION n/5 — title" + stage progress + NEXT hint + timer when timed; dialogue box with speaker name; cash + reputation visible; collectibles counter; nitro bar when owned.
- [x] Playtest: scripted playthrough COMPLETES every story mission 1–5, plus one taxi fare, one delivery, one cache pickup, one upgrade purchase, save/load round-trip. **61/61 passed**, 0 console/page errors (16 Slice 1 + 14 Slice 2 + 31 Slice 3).
- [x] Kit check 5/0. Screenshots retaken: 3-mission.jpg shows a story mission in progress (MISSION 3/5 LOUD AND CLEAR panel + Ana dialogue box + 4 guards with red markers + green beacon + minimap dots); cover keeps the police chase (GT + flanking cruiser + 3 stars + SPD panel, no toast).
- Fixes found by testing: (1) delivery crate at (178,-60) sat 1.5 m from the parked taxi — E grabbed the package instead of entering the car; crate moved to (178,-100). (2) Pistol ray fired from the camera — with the chase camera looking down at Leo, the ray hit the ground metres ahead and distant targets could never be hit; the shot now goes from Leo's shoulder toward the crosshair point at 30 m, clamped to 0.5–3.5 m height — this is what makes the shootouts playable. (3) Nitro boost briefly wrote the GT's top speed into other cars' shared specs (restore read the mutated object); base is now captured before the override. (4) HUD froze on FIRST LIGHT in dialogue mode — mission shot now refreshes it once (LOUD AND CLEAR). (5) A fare toast leaked into the cover shot — staged shots now set a staging flag that suppresses fare spawns, and the cover hides its toast.

## Slice 2 scope (this build — the core GTA loop) — IN PROGRESS 19 Nov
- [x] Wanted + police: stars 0–5 (steal car / hit ped / ram police / shoot cop); patrol cars pursue, ram, stop beside the player on foot → BUSTED (fine $100, respawn at safehouse); wanted decays when out of sight; heli + spotlight at 3 stars; sirens (WebAudio), red/blue light bars, police HUD list (callsign · distance · status).
- [x] More vehicles, all stealable, different handling: taxi (slow, sturdy), van (slow, heavy), police cruiser (fast, sharp); E works for all; HUD shows the vehicle name.
- [x] Combat: pistol (click/F to shoot, R reload, 12-round mag), health bar, damage from rams/shots (forgiving), WASTED → respawn at safehouse; hit marker + damage numbers + tracer.
- [x] Traffic + peds: density kept (18 traffic, 32 peds); traffic yields when the player's car is close ahead; peds flee on crime/gunfire, go down when hit.
- [x] Minimap/waypoint: waypoint to the objective + red police blips + amber heli blip; stars always visible.
- [x] Authorship: `main.ts`, `serve.ts`, `game/index.html`, `README.md` FULLY REWRITTEN under recording `01a1f41f` (Slice 1's authorship was unsealed).
- [x] Playtest (extended, incl. Slice 2 checks) **30/30**, kit check **5/0**, 0 console/page errors.
- [x] Screenshots retaken: COVER = police chase (lime GT + 2 cruisers with light bars + 3 stars + SPD panel + red minimap blips; heli in the panel as AIR-1); menu clean; on foot = Leo + taxi + beacon; city = GT + flanking cruiser.
- Fixes found by testing (19 Nov, all in `police.js` unless noted): (1) wanted decayed before the first cruiser arrived — decay now waits until cops are on the street, with star hysteresis (a star drops only 0.5 heat below it) and grace 3.0 s; (2) pursuit steered straight at the player through buildings — spawn now uses the nearest road line (≤53 m, inside the 60 m seen radius) + progress-based re-route (1.5 s, <100 m only, so an earned escape is never cheated); (3) cruisers orbited at full speed instead of ramming — pursuit speed now scales with distance; (4) distances/ram/nearest were measured to the stale on-foot position while driving — all now use the car; heli holds station 35 m ahead of the car. Known gap (not wired): ramming a police car with the player's car does not itself add heat (only stealing / hitting peds / shooting does).

## v1.1 revision (Xian's review of the 4 screenshots, 19 Nov)
Xian: (1) density gedung kurang rapat dan kurang detail; (2) shoot pengambilan gambar lebih dekat, adegan lebih dramatis; (3) tambahkan NPC dan lalu lalang mobil yang ramai.
- [x] Density: every block split 2x2 lots (4 buildings/block, 2.5 m gaps, street walls 1.5 m from road) — ~100 buildings (was ~60); Downtown CBD towers 48–72 m; shared unit-box geometry + material cache keep it cheap.
- [x] Detail: 5 wall shades, window repeat scaled to building size, mid ledge bands, balconies, rooftop clutter (AC, water tank, antenna, neon signs), 10 storefront sign texts, awnings on all districts.
- [x] Camera: closer + lower + wider — drive 11→8 m, on foot 7.5→5.5 m, pitch 0.32→0.24, FOV 62→68 (config-driven).
- [x] Busier streets: traffic 7→18 cars (all roads incl. boulevard, mixed wedge cars + vans), peds 12→32 (biased to Marina/boulevard, varied height/hats/colors), 8 parked cars at curbs.
- [x] Shots retaken with closer, staged framing: cover = GT close on boulevard with traffic + peds + beacon + Ana; marina = Leo facing Ana + beacon; city = Old Town street canyon.
- [x] Spawns moved ONTO road x=37 (curb side) — the dense blocks now fill the old (6,8) spawn point; playtest enter step teleports beside the car's current spot.
- [x] Playtest 16/16, kit check 5/0, 0 console/page errors (re-run after the revision).

## Quality bar (skill) — before reporting / submitting
- [x] Kit check 5/0 (`node cli/makefun.mjs check --kit . --repo <repo>`).
- [x] Headless browser test (Playwright): loads game, 0 console errors, 4 screenshots 1280×720 (menu, on foot, driving, chase/police if present), each viewed by the builder.
- [x] Scripted playthrough: boots, player moves, enters car, drives, exits — no soft locks. Exact pass count reported.
- [x] Fresh-clone sanity: runs from a clean copy (no absolute paths, no dev-only files).
- [x] Play 5 continuous minutes: no console errors, no soft locks, no stuck missions.
- [ ] No submission without Xian's review + explicit "Gas submit".

## Disqualifiers (never)
- Network request at runtime; probing/escaping the sandbox; fabricated/edited/withheld transcripts; submitting someone else's work; >1 account per person; making the repo private; removing the license; rewriting history so the submitted commit disappears.
