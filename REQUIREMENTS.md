# COSTA VERDE — REQUIREMENTS.md (gta6-01)

Checklist from the kit's RULES.txt (the law) + the makefun-gta6-bounty skill.
Re-read before every submission. Status: Slice 1 in progress.

## Event
- Competition: gta6-01 "Make GTA 6", $1,666 USDC, free entry.
- Deadline: **Mon 24 Nov 2026 22:00 WIB** (15:00 UTC). Result: 10 Dec 2026 22:00 WIB.
- Prizes (100 places): 1st $500, 2nd $250, 3rd $150, 4th–10th $38, 11th–25th $10, 26th–50th $6, 51st–100th $4.
- Submission limits: max **5/day, 10 total** per entrant. Final entry = most recent submission with a receipt before the deadline. Resubmission allowed until the deadline.
- Repo: https://github.com/xianszc/costa-verde (public). Anchor root `05bd0af` (drand round 34097115, NEVER rewrite). LICENSE MIT `1ce2913`.
- Recording for this build: `01a1f3fb-cb92-7623-be66-eb4a4d35795e` (sealed recordings only; no transcript upload).

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
