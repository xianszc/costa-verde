# Proof shots — 22 Nov 2026 (stage1j, builder d302f048)

Proof (cbd-shots/, HUD hidden by construction — canvas capture, HUD is DOM)
and dossier action shots (screenshots/, full HUD, JPEG q80, 1280x720,
127–134 KiB each, all within the 256 KiB / 1280 / 480 caps).

## Proof — cbd-shots/

- **city-ortho-stage1j.png** (703 KiB, 946 calls) — GOOD. Whole-city layout
  reads clearly: 1,242 buildings dense, CBD towers centre, residential
  rings, beach south, hills north. Weaknesses: dark from above (golden-hour
  top-down, everything in shadow), tower heights unreadable from straight
  above, pink sky strips at left/right edges (map fills ~73% of width),
  south beach band blown-out beige. Round 1 (steep oblique) was unusable
  — dark mass, no map read.
- **bay-oblique-stage1j.png** (601 KiB, 904 calls) — BEST SHOT. Varied
  towers with lit windows, sunset gradient, marina + sailboats foreground,
  lighthouse left, promenade + palms, shop signs. Weaknesses: centre towers
  dark/monolithic (unlit faces), water flat teal, moon looks pasted, no
  cars/people visible at this scale.
- **street-residential-stage1j.png** (192 KiB, 194 calls) — GOOD, traffic
  yes / ped no. Green res-east car mid-frame (headlights on), yellow pickup
  up the street, varied townhouses, lamps, zebras + markings, CAFE LUNA
  sign, sunset sky. Weaknesses: NO ped visible in frame — 3 polling
  attempts (incl. a 150s ped-close poll) never caught a ped near the car;
  res ped paths carry ~1 ped each, so car+ped alignment is rare. Left
  foreground big blank beige wall, green car boxy/plain, foreground zebra
  cropped. Rounds 1–2 failed (camera inside house blocks).
- **street-oldtown-stage1j.png** (202 KiB, 634 calls) — GOOD. Fountain
  plaza, blue car foreground, ped in green jacket on the right sidewalk,
  person in red at the fountain, CBD towers behind, shopfronts. Weaknesses:
  right side big black/dark shopfront facade, blue car too big/plain in
  foreground, white van blocks the plaza, fountain spray is a white blob.
- **street-hills-stage1j.png** (111 KiB, 99 calls) — GOOD. Villa rows with
  red terracotta roofs, chimneys, balconies, pines, green hills behind,
  sunset — reads as hills/villas. Weaknesses: no car/ped in frame
  (res-north road below frame), left edge big blank beige wall, background
  hill a flat featureless green slab, villa windows flat grey squares.
  Rounds 1–2 failed (street canyon / camera against a retaining wall).

## Dossier action shots — screenshots/

- **01-cover-drive.jpg** (127,721 B, 379 calls) — COVER. 94 KM/H drive on
  Lungomare, full HUD (mission M1, minimap, speed, fuel, weapons, health,
  radio, dispatch). Weakness: pine + trunk block centre-right.
- **02-district-oldtown.jpg** (130,454 B, 626 calls) — Via del Porto
  fountain plaza, red + blue cars, 2 peds, full HUD. Weakness: cars stopped
  (0 KM/H).
- **03-wanted.jpg** (134,151 B, 553 calls) — 4 stars WANTED, dispatch
  PURSUIT (cruiser 9 m, interceptor 28 m, heli 60 m INBOUND), police
  cruiser ahead. Weakness: car stopped; big beige wall covers right 40%.
- **04-storm.jpg** (133,663 B, 415 calls) — rain drive 94 KM/H, 17:37.
  Weakness: near-duplicate framing of 01 (same street, same tree); rain
  is subtle thin streaks.

## Dossier build — VERIFIED

`MAKEFUN_OUTPUT_DIR=/tmp/dossier-test node main.ts` →
"Azzura Heist dossier ready: 4 screenshots". dossier.json: game Azzura
Heist, missions 11, cover 01-cover-drive.jpg. screenshots/ is NO LONGER
EMPTY — the hard gate is cleared.
