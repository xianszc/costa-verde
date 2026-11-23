# Part I — Proportional car-vs-human scale (23 Nov 2026, stage1ad)

Perintah Xian 18:48 WIB: "Astaga kenapa mobil dan manusianya jauh
banget perbedaannya woy.. benerin lagi harus proporsional keduanya.
Mobilnya juga bisa dinaiki entar." Pilihan 0,35 vs 0,25 MOOT (0,25
malah memperparah jarak orang-vs-mobil).

## 1. Ukuran terukur dari kode (bukan perkiraan)

| Benda | Ukuran asli (skala 1,0) | Sumber |
|---|---|---|
| Stella (hero) | 4,4 P × 1,9 L × **1,20 T** (atap kabin) | vehicles.js buildStella |
| Sedan | 4,1 × 1,85 × 1,25 | vehicles.js buildTrafficCar |
| Van | 4,2 × 1,9 × 1,80 | vehicles.js buildTrafficCar |
| Pickup | 4,3 × 1,9 × 1,41 | vehicles.js buildTrafficCar |
| Roda sport | r 0,38 (diameter 0,76) | wheels.js WHEEL_SPECS |
| Player Elio | **1,92 T** (archetype 'lean') | people.js ARCHETYPES |
| NPC rata-rata | 1,80 T (mean 6 archetype) | people.js ARCHETYPES |
| NPC tertinggi / terpendek | 2,06 ('tall') / 1,56 ('short') | people.js ARCHETYPES |
| Carriageway street / avenue | 2,4 / 4,1 lebar | cbd-grid.js |
| Lantai gedung (FLOOR_H) | 1,0 | cbd.js (part D) |

Koreksi atas laporan part F: "pejalan kaki tipikal ~1,7" itu
rata-rata kasar — PLAYER Elio 1,92u dan Stella tingginya 1,20u
(bukan ~1,4). Rasio sebenarnya di 0,35: 1,92 / (1,20×0,35) =
**4,6×** (bukan 3,4×). Foto 18:45 mengonfirmasi: orang ~3,6×
tinggi mobil di frame (karakter lebih dekat ke kamera dari mobil).

## 2. Pasangan skala yang dipilih: CAR_SCALE 0,7 + PED_SCALE 0,6

Rasio orang-vs-mobil = (1,92 × p) / (1,20 × c) = 1,6 × p/c.
Target Xian: orang ≈ 1,2–1,4× tinggi mobil (nyata 1,7/1,4 = 1,21×).

| Pasangan | Rasio player/Stella | Rasio NPC-avg/Stella | Stella P×L×T | Lebar vs street 2,4 | Lebar vs avenue 4,1 |
|---|---|---|---|---|---|
| 0,7 / 0,6 **(dipilih)** | **1,37×** | 1,29× | 3,08 × 1,33 × 0,84 | 55% | 32% |
| 0,7 / 0,55 | 1,26× | 1,18× | sama | 55% | 32% |
| 0,65 / 0,55 | 1,36× | 1,27× | 2,86 × 1,24 × 0,78 | 51% | 30% |
| 0,6 / 0,5 | 1,33× | 1,25× | 2,64 × 1,14 × 0,72 | 48% | 28% |

Dipilih 0,7/0,6 (angka bersih, rasio di dalam target 1,2–1,4
untuk player DAN NPC rata-rata; mobil cukup besar sehingga tidak
lagi terbaca mainan). Rasio vs jenis mobil lain di pasangan ini:
sedan 1,32×, pickup 1,17×, van 0,91× (orang lebih PENDEK dari van
— benar, van nyata ~1,9 m vs orang 1,7 m). Roda sport r 0,27
(diameter 0,53u) — tetap terbaca jelas.

## 3. Trade-off yang diterima (jujur)

- **Jalan:** mobil 1,33u lebar = 55% carriageway street. Dua mobil
  berlawanan di street tumpang tindih ~0,26u di kaca spion (avenue
  aman: 2×1,33 < 4,1). Diterima: perintah Xian menempatkan proporsi
  mobil-vs-manusia di atas kecocokan lajur.
- **Gedung:** orang 1,15u = 1,15 lantai (nyata 0,57 lantai). Masih
  terlalu tinggi vs gedung — itu skala ketiga yang tidak bisa
  diperbaiki tanpa membuat orang tak terlihat. Diterima, di luar
  lingkup perintah ini.
- **Kamera:** chase cam + on-foot cam ditarik ulang proporsional
  (lihat §4).

## 4. Yang ikut disesuaikan (semua proporsional, di GAME)

- `CAR_SCALE` 0,35 → **0,7** (vehicles.js). Otomatis ikut:
  collision radius 0,5×c = **0,35**; traffic yield 7×c = **4,9u**
  (vehicles.js:479, cbd-traffic.js:251); wheel spin ÷(r×skala grup)
  (wheels.js, baca skala grup dinamis); skid mark × skala grup
  (wheels.js, baca `car.mesh.scale.x` dinamis).
- `PED_SCALE` **0,6** (people.js, BARU): diterapkan di root
  `makeFigure` + `makeWalker` — player, 6 civilian, 34 walker,
  dan figur misi (Aldo M12) SEMUA sama. `userData.height` kini
  H×PED_SCALE supaya label lineup.js tidak melayang.
- Player radius 0,5 → **0,5×PED_SCALE = 0,3** (game.js) — badan
  orang kini ~0,18u lebar; radius 0,3 tetap menutupinya.
- Board radius 2,7 → **3,0** (game.js toggleCar): celah dari sisi
  mobil ~2,3u, sama seperti aslinya (4,0 di skala 1,0 = celah
  ~3,05u). Driver misi board dari 1,5u — aman di dalam.
- Exit offset 1,4 → **1,8** (game.js toggleCar): pemain mendarat
  ~1,13u dari sisi mobil, sama seperti sebelumnya.
- Chase cam 6 blkg / 3,0 tinggi, look 0,8 → **8,5 / 4,0, look 1,0**
  (game.js; interpolasi 0,5→1,0: 7/3,4 → 10,5/4,6).
- On-foot cam 5,5 blkg / 3,0 tinggi, look 1,4 → **5,5 / 2,2, look
  0,85** (game.js; kepala pemain kini 1,15u, bukan 1,92u).
- Wanted (wanted.js): hold/ram/bust kini RUMUS ×CAR_SCALE, bukan
  literal F2 — hold on-foot 3×c = **2,1**, in-car 4×c = **2,8**;
  ram 3,2×c = **2,24**; bust 2,5×c = **1,75** (tetap DI DALAM hold
  2,1 — syarat fix M9 22 Nov).
- HUD speed TIDAK diubah (u/s ×3,6). Kecepatan/akselerasi/turn-rate
  mobil TIDAK diubah. Jalur traffic, spawn, misi, anchor TIDAK diubah.

## 5. Verifikasi (semua GAME, bukan driver)

- **Smoke part I** (`/tmp/smoke-partI.mjs`, nocache 8941, FASTSIM=2):
  **PASS.** car mesh scale 0,7 / radius 0,35; player mesh scale 0,6 /
  radius 0,3; Stella 0,84u vs Elio 1,15u → rasio **1,37×** (target
  1,2–1,4). **Enter/exit human-like:** jalan kaki ke mobil (6,05u,
  sampai 2,49u — di dalam board radius 3,0), tekan E → onFoot=false,
  mesh tersembunyi; nyetir 30,6u, speed 26 u/s, HUD 68 km/jam (HUD
  tertinggal satu tick render di fastsim — rumus speed×3,6 tidak
  diubah); tekan E → onFoot=true, mesh terlihat, exitDist **1,8u**
  tepat seperti dirancang; jalan kaki menjauh 3,2u. **0 console errors.**
- **routes.mjs: 10/10 REACHABLE, errors 0** (semua zona; longest
  commercial 26 s round trip). Mengemudi TIDAK rusak oleh skala baru.
- **M1: PASS human-like 33 s** (attempts=1, fails=0, maxStage=2,
  errors 0; commit 34232d6). **M7: PASS human-like 38 s** (attempts=1,
  fails=0, maxStage=2, errors 0; commit 47449e1). "ALL MISSIONS PASS".
  Kedua misi diuji SETELAH perubahan skala (working tree part I).
  (Driver missions.mjs menyimpan + commit reports/missions-run.json
  sendiri setelah tiap misi — perilaku bawaan driver, sama seperti
  ronde-ronde sebelumnya; file game/ tidak disentuh driver.)
- **Foto perbandingan + 4 screenshot:** lihat §6.

## 6. Foto (skala baru 0,7 / 0,6)

- reports/partF2-char-vs-car.png — orang di samping mobil hero.
- reports/partE-lowcam-pov.png — low-cam POV kejar-kejaran senja.
- screenshots/01-cover.jpg, 02-city.jpg, 03-action.jpg,
  04-features.jpg — dusk chase, tanpa pita kuning raksasa, tanpa
  fasad krem polos di atas frame, diamond diframe-out/disembunyikan
  in-page saat motret (beacon tetap ada di kode game).
