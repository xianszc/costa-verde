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
