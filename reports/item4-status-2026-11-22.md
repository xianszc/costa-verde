# Item 4 status — 22 Nov 2026 ~20:15 WIB (builder aae5df64)

## DONE in this run

### 3c.5 jobs — VERIFIED PASS (was unverified after the swap)
- `jobs PASS (246s)` + `jumps PASS (147s)` + `coins PASS (145s)` at fastsim=4.
  J1 fail via 10x timer scale, J2/J3/J4 SUCCESS (reward + save), J1
  complete (reward + save; drive leg honestly OPEN).
- Fixes (TEST only): `startJobAt` retries E until the job starts (J4: M1
  STEAL steals the first E at the pavilion); jumps driveXp cap 60→80
  (legs drive ~60-110u incl. coast/brake, 0.6 XP/u — the old cap was
  calibrated to one passing run).
- GAME fix: toast queue FIFO (`ca5c544`) — a rank-up toast in the same
  tick overwrote the COMPLETE toast, so a player completing a job that
  triggers a rank-up never saw COMPLETE. Verified by the toast-log poll
  (`a912a77`).

### Fastsim proof — PROVEN (reports/fastsim-proof.md)
- J1 timer (90 s at 10x = 9 game-s): fastsim=4 → 9.4 game-s (wall 1.3 s);
  fastsim=1 → 9.5 game-s (wall 148.5 s). Same outcome (TIME UP + restart
  + no reward). M1 RECON→STEAL: same stages 0→1→2 both modes.
- Full suites at fastsim=1 are impractical (sim ~0.064 sim-s/wall-s;
  a full jobs run would take ~4 h wall) — the scoped proof is the
  feasible form. Traps documented in the report (title screen Enter,
  panel never contains 'TIME UP', mod-24 clock wrap, E placement race).

### 3c.6 ranks — PASS (100s)
- WHEELMAN via 11 real coins (+S 500, paint-teal owned); gate boundary
  (outfit-harvest FIXER-locked, outfit-casino enabled); decision B:
  outfit-casino bought S 800 (money 2550→1750, outfit applied) + saved
  (slot-1 load restores money 1750 + outfit casino).

### Time-of-day staging — DONE + verified
- `?time=H` locks staged shots (pin inside `stageShot`, `ce3931d`):
  branch defaults ignored while pinned, restored after. `?time=12` →
  time 12, `?time=22` → time 22 (verified in `__gameStats`).
- New `day` sky phase 10–16 h (clear blue; noon was golden-orange
  before), pale-blue fog, `MIDDAY` clock label (`70bd1a4`).
- `?hud=0` now a `body.hud0` CSS class (`!important`, `032e679`): the
  side engine's own display management undid the old one-time inline
  hide (toast + COINS chip stayed visible).
- Verified visually: midday bay = clear blue sky, no HUD; night street
  = 22:00 NIGHT, lit windows, lamps, green traffic light, readable road.
- Proof image 1/6 committed: `cbd-shots/bay-oblique-midday-item4.jpg`
  (1280×720 JPEG q80, 162,249 bytes < 256 KiB).

## Item 4 baseline (reports/perf-item4-before.json, HEAD 9f31db1)

| view | calls | tris | median ms | target |
|---|---|---|---|---|
| avenue | 406 | 796,765 | 11.5 | <450 ✓ |
| ring | 201 | 756,721 | 6.7 | — |
| promenade | 709 | 859,065 | 10.8 | <450 (cut ~259) |
| city | 1,034 | 931,591 | 15.6 | <600 (cut ~434) |

Note: this baseline is HIGHER than the 11:34 one (city 983→1034 calls,
671k→932k tris). Cause unknown — possibly a probe/method difference;
do not assert a cause. Use this file as the item-4 baseline.

## Draw-call breakdown (1,065 meshes total; city renders 1,031 of them)

- walkers 238 + figures 107 = 345 meshes (40 peds; limbs animate, so
  per-ped merging is limited — merge static body+head only, or leave).
- traffic cars 283 meshes (sedan 132 + van 66 + pickup 55 + cruiser 30;
  ~12 per car — merge static body/glass/lights, keep wheels separate).
- buildings ~178 (promenade 62 + oldTown 53 + district4 43 +
  commercialRing 20) — already partly merged; merge per
  district+material to ~25.
- unnamed 81 (53 MeshBasic + 28 MeshStandard).

## Zebra cost — MEASURED (the single biggest triangle cost)

- 3 merged meshes, **287,244 tris** (23,937 bars × 12 tris).
- City view: with zebra median **73.7 ms** / 1,031 calls / 931,471 tris;
  without zebra median **14.9 ms** / 1,028 calls / 644,227 tris.
- **Delta: 3 calls, 287,244 tris, ~59 ms/frame median in SwiftShader.**
- Candidate fix (NOT attempted — verify first): the bars are 12-tri
  boxes; as flat painted markings they should render identically as
  quads (2 tris/bar → ~48k tris, saving ~239k tris). Verify the look
  from street level + top before committing.

## LEFT for the next builder (in order)

1. **Perf merge (75 min max):** merge static geometry per district +
   material, instancing for repeated props, distance culling for far
   building groups. Start with the zebra quads (biggest ms win), then
   buildings per district+material. Do NOT change how the city looks.
   Re-measure with `/tmp/perf-item4.mjs` (writes
   `reports/perf-item4-before.json` — copy it to a new name first) and
   report calls/tris/ms before/after per view.
2. **9 peds on asphalt** (OPEN, `reports/traffic-verify-2026-11-22.md`):
   (-66.86,-34.5), (-67.5,-45.55), (-57.5,-42.47), (-35.5,-39.38),
   (-52,-36.97), (-47,-33.89), (-44.02,-37.5), (-38.97,2.75),
   (-85.2,-5.57). Old-town/west ped paths on asphalt (2 m alleys need
   layout work). Ped paths live in blocks.js / city.js / commercial.js /
   districts.js / game.js (peds built game.js:280). The 2 CBD crosswalk
   peds (zebras at x=-11.2 / z=-11.2) are intentional — do NOT move them.
3. **Proof images 2–6** (cbd-shots/, each <256 KiB, honest critique
   each): whole-city ortho (`?shot=cbd&view=top&time=12&hud=0`), 3 street
   shots in different districts incl. a residential street WITH traffic
   + peds, a hills street shot with traffic, one night street shot
   (`?shot=cbd&view=street&time=22`, HUD shown; the verification shot
   had a tree blocking the centre — pick a clearer camera).
4. **BUNDLE check** with the level-36 kit (`kit-level36-new/`) on a clean
   clone at the current HEAD; paste the exact result.
5. **Then:** screenshot candidates (Xian 18:33 — separate brief §5b,
   for the NEXT relaunch builder), full 11-mission regression ONCE.

## State for the next builder

- HEAD `42b6b51`, tree clean, pushed. Recording `01a20306` live (PID
  2063). Next swap expected ~20:27 WIB.
- Run file: shops FAIL (known far-drive, non-blocking), shops-near /
  coins / jumps / jobs / ranks PASS.
- Probes in /tmp: `perf-item4.mjs` (baseline), `draw-breakdown.mjs`,
  `zebra-cost.mjs`, `time-verify.mjs`, `fastsim-proof.mjs`,
  `fastsim-proof-4.json`, `fastsim-proof-1.json`.
