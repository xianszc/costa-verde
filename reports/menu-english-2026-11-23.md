# English title menu — verification report (23 Nov 2026)

## What changed (commit `53f9584`)

Xian (10:45 WIB) was right: the game is in English, but the title
screen said "MULAI" / "Gerak kamera: Hidup", and the CONTINUE / NEW
GAME / SETTINGS buttons he expected had never existed — the title
card only ever had MULAI + the camera toggle. This round built the
full English title menu.

- `game/index.html` — title card now has a vertical menu stack:
  START (gold, primary), CONTINUE, NEW GAME, SETTINGS, and the
  camera-motion toggle, plus a save-summary line under CONTINUE.
  New overlays: `#menu-settings-panel` (5 audio sliders + mute +
  BACK) and `#menu-confirm` (new-game confirm).
- `game/src/hud.css` — secondary-button style, disabled CONTINUE
  (40% opacity), save-label line, settings/confirm overlay styles
  (dark card + dim layer so they read over the orbit camera). The
  title card moved from `top: 24%` to `top: 50%`: the menu grew
  from 2 buttons to 5, and the old anchor would have clipped the
  logo at 720p.
- `game/src/game.js` (+130 lines) —
  - Toggle label is now "Camera motion: On/Off".
  - `updateMenuContinueState()`: CONTINUE disabled with no save;
    with a save it shows the save summary (e.g. "S 1,250 · M1 ·
    12:00 · Day 1 · 03:56").
  - CONTINUE loads slot 1 via the existing `doLoad(0)`, then
    enters play. START is the old MULAI path; Enter still works
    as START — except while a settings/confirm overlay is open
    (Enter is blocked there, Escape closes the overlay).
  - NEW GAME: no save → straight into play. With a save → confirm
    overlay ("Start a new game? Your saved progress will be lost."
    + YES, START OVER / CANCEL). Yes runs `resetNewGame()`:
    deletes slot 0, resets the side store (see below), restores
    every run field to its boot value (money 1250, health 100,
    armour 60, XP 1240, time 18.7, day 1, mission 0 via
    `missions.start(0)`, spawn positions, full ammo/fuel, wanted
    reset, duel target cleared), then enters play. At a fresh boot
    the state is already fresh, so the reset is a no-op there; it
    matters after QUIT TO TITLE mid-run.
  - Settings panel: sliders write through `audio.setVolume(bus, v)`
    (applies live + saves to `azzura_audio_v1`); mute writes
    through `audio.setMuted()`. Panel is populated from
    `audio.settings` on open.
  - `startPlay()` hides both overlays; QUIT TO TITLE refreshes
    the CONTINUE state (a save made in the pause menu enables it).
- `game/src/sidecontent.js` (+9 lines) — new export
  `resetSideStore()`: wipes the module-level store back to
  `defaults()` AND the stored key, so the next `persist()` cannot
  resurrect the old progress.

No physics, mission, or road-data changes. No camera start/stop
button was added — the orbit still autoplays. No other game text
was touched (missions, HUD, dialogue were already English).
Grep after the change: zero occurrences of MULAI / "Gerak kamera"
in `game/`.

## Verification (probe, 0 console errors in every phase)

Scripts: `~/workspace/makefun/gta6-01/menu-english-probe.mjs`
(part 1) and `menu-english-probe2.mjs` (part 2). Results:
`/tmp/menu-english-probe-result.json` (phases 1–4) and
`/tmp/menu-english-probe-result2.json` (phases 5–8).
All error arrays empty.

- Fresh title: buttons exactly START / CONTINUE (disabled) /
  NEW GAME / SETTINGS / "Camera motion: On"; save label "No saved
  game yet"; zero Indonesian words in the title card. PASS.
- SETTINGS: panel opens (flex); defaults Master 70 / Music 80 /
  Effects 100 / Ambience 80 / Interface 100; moving Master to 50
  stored `{master: 0.5, ...}` in `azzura_audio_v1`; mute stored
  `muted: true`, un-mute stored `muted: false`; BACK closes. PASS.
- Camera toggle: On → "Camera motion: Off" + `azzura_menu_orbit`
  `0`; back → On + `1`. PASS.
- NEW GAME, no save: straight to play, no confirm. PASS.
- START: mode play, HUD shown, title card hidden. PASS.
- Enter: mode play. PASS.
- Save flow: `doSave(0)` true, key present; after reload CONTINUE
  enabled with label "S 1,250 · M1 · 12:00 · Day 1 · 03:56".
  NEW GAME with save → confirm overlay (exact English text);
  CANCEL → still title, save still present. CONTINUE → play.
  NEW GAME → YES → play, save key absent, side store reset to
  defaults (jobs/races/jumps/collectibles empty, standing 30,
  tunes 0/0, bonuses unclaimed). PASS.
- Escape closes the settings panel; Enter while the panel is open
  does NOT start the game. PASS.
- Regressions: `?menu=1` → `__menuReady` true, mode title, time
  12, START label; `?shot=cbd` street → `__ready` +
  `__shotReady` true, 220 calls. PASS.

Notes (pre-existing behaviour, not new bugs):
- Money reads S 1,500 in play after a fresh START / NEW GAME /
  CONTINUE: the boot DECKHAND rank claim grants +S 250 on first
  play entry (same in the old menu-orbit play shot). The reset
  itself sets 1250; the +250 comes from the rank grant.
- After NEW GAME → YES, the side store shows `ranksClaimed:
  ["DECKHAND"]` and `outfitsOwned: ["street", "harbour"]` — that
  is the same boot rank claim re-granting on play entry, not a
  failed reset (paint is exactly `STOCK_PAINT` 0xe4572e, all other
  fields are defaults).
- Part 1 of the probe died at phase 5 on a probe-script bug (a
  Node-side variable referenced inside `page.evaluate`); the game
  was fine. Part 2 re-ran phases 5–8 clean.

## Screenshots (all 1280×720, <256 KiB, in `cbd-shots/`, read visually)

- `menu-english-00-title.jpg` (149,657 B) — full English menu over
  the orbit: START gold, CONTINUE greyed with "No saved game yet",
  NEW GAME, SETTINGS, "Camera motion: On". Critique: this orbit
  phase frames a dense canyon of flat facades; the disabled
  CONTINUE is very faint; the logo still overlaps the tallest
  tower.
- `menu-english-01-settings.jpg` (69,911 B) — settings panel: 5
  sliders (Master 50% after the probe moved it), mute checkbox,
  BACK; dim layer works, title behind is readable but subdued.
  Critique: the panel covers the logo; otherwise clean.
- `menu-english-02-play.jpg` (137,926 B) — after START: full HUD,
  M1 card, Elio dialogue, player on foot, S 1,500. Critique: the
  gold stunt-jump ring still dominates the centre of the frame
  right in front of the player (same as the orbit play shot).
