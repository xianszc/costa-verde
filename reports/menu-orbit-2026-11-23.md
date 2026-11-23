# Menu Orbit — verification report, 23 Nov 2026

Cinematic real-time main-menu camera circling Porto Azzura (game/src/menu-orbit.js,
HEAD 27d2341). No video file, no external assets: a closed Catmull-Rom spline,
75 s loop, eased (lingers at the bay / marina / north skyline / promenade dips),
look spline always inside the built city. Heights 13–20 u. Midday, pinned.
Traffic + pedestrians keep moving underneath (menu sim: missions / wanted /
combat / audio off; peds hidden — sub-pixel from 12–25 u up — cars visible
within 80 u of the camera).

Probe script: ~/workspace/makefun/gta6-01/menu-orbit-probe.mjs (re-run 23 Nov
10:27–10:36 WIB after the ~10:18 swap wiped /tmp; full result in
/tmp/menu-orbit-probe-result.json, heightfield in
/tmp/menu-orbit-heightfield.json, clearance in
/tmp/menu-orbit-clearance.json). 0 console errors in every phase.

## Spec change — autoplay, no start/stop button (Xian 10:25 WIB)

The camera autoplays the moment the main menu appears — there is NO button to
start or stop it, and none was added. Verified two ways: (1) code read — the
title card holds exactly two buttons, `#menu-start` (MULAI, enters the game)
and `#menu-orbit-toggle` (Gerak kamera: Hidup/Mati — the slow-machine settings
toggle from the 09:53 spec, kept); (2) the autoplay probe (Phase 4d) lists the
title-card buttons as exactly `["menu-start", "menu-orbit-toggle"]`.

## Clock fix (commit 27d2341, 5 lines in game.js)

The title topbar `#clock` was static HTML ("18:42 · GOLDEN HOUR") and was never
updated anywhere, so during the pinned-midday orbit it contradicted the scene
(visible in the pre-swap shots). `updateHUD` already computes hh/mm/phaseLabel
from `state.time` every frame — it now also sets the topbar clock. Verified
live: the retaken orbit shots read "12:00 · MIDDAY".

## Clearance — PASS (gate ≥ 2 u)

- Heightfield: 832 grid points (every 8 u), max 96.49 u at (-5, -17).
  Vertical scale (measured, not assumed): CBD towers 20–60 floors × 2.0 u =
  40–120 u (Azzura Tower 60 floors = 120 u + spire ~127 u); commercial
  ring / ring-ext 12–30 u; residential max ~14.6 u. The orbit never crosses
  the tall blob — it circles it on the bay, the outer aprons and the
  residential-north strip.
- Path clearance: 361 samples along the actual spline
  (`game.sampleOrbitPath(360)`), downward + 8-direction lateral raycasts
  against the live built world. **min down 5.99 u** (worst at
  (102.48, 19.14, -40.36), east leg), **min lateral 7.71 u** (worst at
  (-76.85, 19.49, -92.16), north-west corner). Both well above the 2 u gate.
  v1 failed the north leg (down -3.49 u at (69.5, 18.9, -87.5)); v2 moved the
  north leg north of the ring-ext strip and passes.

## Draw calls — PASS (budget ~800)

Menu mode: 308–333 calls, 555,875–570,041 tris across the four orbit phases
(initial stats 310 calls / 560,549 tris). Same city render as the game, no
second city; menu visibility (peds hidden, cars within 80 u) + the existing
distance system do the work.

## Functional checks

- **Autoplay — PASS.** Plain load (`/`), zero input: camera moved 27.54 u in
  4 s, orbit clock advanced 3.92 s, mode stayed `title`, time 12, no
  start/stop camera button in the DOM.
- **MULAI → play — PASS (with a retake).** The probe's first 2 s wait showed
  mode still `title` — that was a measurement artifact, NOT a game bug: under
  headless SwiftShader a plain 380 ms `setTimeout` measured **8,917 ms** to
  fire (timers starved ~9× by the heavy render loop), so the 380 ms fade
  timer had not fired yet. Re-tested with a proper wait: mode `play` after
  11,475 ms wall; HUD `block`, title card `none`, camera descended to
  y 8.84 at (39.2, 8.8, -10.8), on foot, time 12.01. On real hardware the
  design timing is 380 ms fade + 600 ms fade-back ≈ 1 s.
- **?menu=1 — PASS.** `__menuReady` true, mode `title`, time 12, 303 calls.
- **?shot=cbd regression — PASS.** Street: `__ready` + `__shotReady` true,
  mode `play`, 212 calls. Top: `__ready` + `__shotReady` true, 191 calls.
  Staged shots are untouched by the orbit (orbitLive=false there).

## Screenshots (all 1280×720, read visually by the builder)

- `cbd-shots/menu-orbit-00-bay.jpg` (183,733 B, lum 124.7, 308 calls) — bay
  dip, marina + sailboats + palms + towers. Kritik: kamera sangat dekat ke
  menara (memenuhi 2/3 atas frame); cincin emas SJ terlihat di tengah.
- `cbd-shots/menu-orbit-01-marina.jpg` (102,235 B, lum 117.3, 309 calls) —
  east leg. Kritik: TERLEMAH dari keempatnya — frame didominasi fasad datar
  gedung, marina hanya sepotong di tepi kanan.
- `cbd-shots/menu-orbit-02-north.jpg` (180,548 B, lum 125.5, 333 calls) —
  north leg, skyline berlapis + palem + perahu. Kritik: logo judul menumpuk
  di atas menara tertinggi (masih terbaca berkat halo gelap, tapi ramai).
- `cbd-shots/menu-orbit-03-promenade.jpg` (177,957 B, lum 125.5, 314 calls) —
  west leg. Kritik: hampir duplikat 00-bay — sudut barat tidak memberi
  pandangan yang berbeda.
- `cbd-shots/menu-orbit-04-play.jpg` (138,058 B, lum 142.9) — frame play
  asli setelah MULAI: HUD lengkap, pemain on-foot di Lungomare, kartu M1,
  minimap, dialog Elio. Kritik: cincin emas SJ mendominasi tengah frame
  tepat di depan pemain.
- `cbd-shots/menu-orbit-05-shot-cbd-street.jpg` (134,384 B, lum 122.2) —
  regresi ?shot=cbd street, HUD lengkap, PANETTERIA. Kritik: pohon besar
  memenuhi sepertiga kiri-tengah; toast RANK UP melintasi tengah (notifikasi
  boot yang sementara, seperti biasa).

## Commits this round

- `27d2341` — Menu orbit: keep title topbar clock live (12:00 MIDDAY during
  orbit). 1 file, +5 lines (game.js).
- Commit B (this report) — verification artifacts: 6 screenshots + report.

## Open / not done

- Shot 01 (east leg) is the weakest view — mostly flat facades; a look-target
  tweak (aim further south toward the marina) could fix it, but that is a
  polish decision for Xian, not a verification failure.
- Shots 00 and 03 are near-duplicates; the west-leg dip could be re-aimed for
  a distinct promenade-west view.
- The MULAI transition timing under SwiftShader (~11 s wall) is a headless
  artifact, not a game bug — but it means headless probes of any
  setTimeout-based transition need waits of 15 s+, not 2 s.
