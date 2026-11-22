# Item 0 — answers first (Xian 22 Nov 11:48 brief)

Builder: 134ca90a. Recording 01a2017b live throughout. HEAD df66116 at start.
Time spent: ~15 min (10-min box overrun by the skyline retake — first
vantage looked out to sea, see below). No code changed for the answers;
only the two night shots + this report were committed.

## A) Side content — the headline: the engine exists but is DEAD CODE

`game/src/sidecontent.js` (882 lines: jobs/races/jumps/collectibles/shops/
standing/ranks + its own localStorage persistence) exports exactly one
function, `attachSideContent(g)` — and NOTHING calls it. No import in
game.js, hub.js or main.js; no `attachSideContent` call anywhere in the
repo. Everything below is code that exists but never runs in play.

| Item | Status | Evidence |
|---|---|---|
| Shops | Exists in code, untested, UNWIRED | side-shops.js: 3 sections (weapons Kelo Arms, clothes Sartoria Azzura, garage paint/outfits), prices + rank gates; buy()/applyOutfit()/applyPaint() in sidecontent.js (dead) |
| Full-screen map | NOT STARTED (as a map) | Hub (Tab/H) Chart tab is a text LIST of districts, not a map. Only a HUD minimap exists (player arrow + objective + police dots, game.js:1124) |
| Side jobs | Exists in code, untested, UNWIRED | 9 jobs J1–J9 (side-jobs.js), engine in sidecontent.js (dead) |
| Races | Exists in code, untested, UNWIRED | R1–R4 (side-races.js: LINE UP / RACE / PODIUM, best times persisted by sidecontent.js — dead). The race stage type itself works (driver uses it); side races never run |
| Stunt jumps | Exists in code (data only), untested | 8 spots SJ1–SJ8 (anchor + direction only, side-jumps.js); detection in dead sidecontent.js |
| Collectibles | Exists in code (data only), untested | 20 coins C1–C20 (side-collectibles.js; +25 XP +1 standing per coin per comment); pickup in dead sidecontent.js |
| Standing | Exists in code, untested, UNWIRED | standingTier (side-data.js), addStanding in dead sidecontent.js |
| Rank unlocks | PARTIAL | Rank DISPLAY done + tested (HUD/hub show rank from XP, game.js rankForXp). Rank-gated unlocks (vehicles DRIFTER→KING OF THE RIVIERA, crews by chapter) are static display lists in hub.js + rankUnlocked() in dead sidecontent.js — enforcement untested/unwired |
| Save/load of side content | NOT STARTED in practice | Missions save/load PASS (tested, save.js, 3 localStorage slots). Side content has its own localStorage store (sidecontent.js persist()) — never runs |

Honest estimate to finish + test everything: **~12 h** (wire
attachSideContent + hub UI 2 h; shops 2 h; jobs 2 h; races 1.5 h; jumps
1 h; collectibles 1 h; standing/ranks 1 h; full-screen map 3 h — new UI,
the biggest chunk; save integration 1 h; playtests included). The map is
the only item needing genuinely new UI; the rest is wiring + testing
existing code.

## B) Day/night — YES, cycle in normal play

- Clock: `state.time` starts 18.7 (18:42 golden hour); `time += dt/20` —
  1 game hour per 20 real seconds → **one in-game day = 480 real seconds
  = 8 real minutes**.
- Phases (`skyPhaseForHour`, water.js): dawn 05:00–07:30, "golden"
  07:30–19:00, dusk 19:00–21:00, night 21:00–05:00. Note: the WHOLE day
  07:30–19:00 is one phase called 'golden' — there is NO distinct midday
  phase; midday 12:00 exists as a time but shares the golden lighting
  (sun elevation varies within it).
- Night (verified by the shots below): window emissive 1.4 (lit panes,
  mixed lit/unlit — looks lived-in); headlights emissive 2.2 (player +
  traffic cars); street-lamp light cones switch ON at night (roads.js
  setNight — lampCones visible); CBD grid lamps have NO cones
  (cbd-grid.js setNight is a no-op); shop signs emissive 0.25 static
  (not night-boosted); NO neon-sign system exists. Road readability:
  YES — asphalt, markings and zebra stay readable at night, not crushed
  to black (hemi 0.22 + moon + lamps).

## C) Weather — YES, storm rain exists; NO light rain, NO rain sound

- Rain: 600 thin angled streaks (LineSegments) + 24 splash rings
  (game.js:295–323); `setStorm()` toggles rain + wet roads (roughness
  0.92→0.30, puddles visible >0.4). Triggered by M8 "Storm Warning"
  (stormFromMission) and by `?shot=storm` (17.5).
- No light-rain mode, no rain sound found (nothing in radio.js/game.js).
- Consequence for brief item 5: NOT skipped — light rain
  (small volume around camera, darker sky, glossier roads, `&weather=rain`)
  is a different, smaller feature than the full storm.

## D) ?shot= time — NO, cannot be fixed today

- main.js reads only `shot / seed / night / storm / m / district / view`.
  No `time` param. `night=1` → 23.2, `storm` → 17.5, default 18.7.
  The `cbd`, `district` and `road` stageShot branches hard-code 18.7.
- Midday 12:00 cannot be staged; night 22:00 only approximately via
  `night=1` (23.2). Item 4 must ADD `&time=H` support.

## Night shots (committed, cbd-shots/)

- `night-street-stage1j.png` — staged `?shot=night` (23.2, chase cam on
  the boulevard, HUD hidden). Critique: road readable, windows/lamps/
  signals lit, shop signs readable (PESCHERIA, OROLOGERIA), zebra + box
  junction visible. Flaws: a monorail pillar dominates the right-center
  foreground; the red car is half-hidden behind pillar/trees; lamp
  globes glow but cast no visible light pool on the road; some window
  panes are flat black mixed with lit ones.
- `night-skyline-stage1j.png` — same page, camera moved to the CBD bay
  vantage (15,7,90) → towers (0,32,-12). Critique: the 12 towers read
  well, mixed lit windows look lived-in, the moon is a nice touch.
  Flaws: the bay water stays bright flat teal at night (does not darken
  with the sky); podium shops are mostly dark with only a few neon
  strips. FIRST attempt (vantage_skyline_cam) showed only sea and
  sailboats — wrong vantage (it looks out to sea); retaken with
  vantage_cbd_bay.
