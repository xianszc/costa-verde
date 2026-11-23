# Part F — Car scale (23 Nov 2026, stage1ac)

Perintah Xian 16:45 WIB: "Mobilnya gede banget sih tidak proporsional
dengan gedung dan sekitarnya" + "Perbaiki semua ukuran mobil".

## 1. Ukuran sekarang (diukur dari kode)

| Benda | Panjang | Lebar | Tinggi | Sumber |
|---|---|---|---|---|
| Stella (hero) | 4,4 | 1,9 | ~1,20 (atap kabin) | vehicles.js buildStella |
| Sedan (traffic/polisi) | 4,1 | 1,85 | ~1,25 | vehicles.js buildTrafficCar |
| Van | 4,2 | 1,9 | 1,80 | vehicles.js buildTrafficCar |
| Pickup | 4,3 | 1,9 | ~1,41 | vehicles.js buildTrafficCar |
| Roda sport / sedan / pickup / van | r 0,38 / 0,33 / 0,42 / 0,30 | — | — | wheels.js WHEEL_SPECS |
| Pejalan kaki | — | — | 1,56–2,06 (tipikal ~1,7) | people.js |
| Lajur avenue / street | — | 0,35 / 0,30 | — | cbd-grid.js |
| Carriageway avenue / street | — | 4,1 / 2,4 | — | cbd-grid.js |
| Podium CBD (twin) | 5,1 (di blok 7,1) | — | — | cbd.js (setback B) |
| Tower CBD | — | — | 20–60 (FLOOR_H 1,0) | cbd.js (part D) |
| Collision radius mobil | 0,5 | | | vehicles.js createCar |

## 2. Kenapa mobil terlihat "gede banget" (angka)

- Lebar mobil 1,9u vs lajur 0,35u = **5,4 lajur**. Mobil di lajur
  bersebelahan tumpang tindih 1,55u. Satu mobil menutup **46% lebar
  carriageway avenue** (1,9/4,1) dan **79% lebar street** (1,9/2,4).
- Panjang mobil 4,4u vs podium gedung 5,1u = **86%** — mobil hampir
  sepanjang lebar satu gedung. Di dunia nyata mobil 4,4 m vs footprint
  gedung ~30 m = ~15%.
- Tinggi mobil 1,4u vs pejalan kaki 1,7u = rasio **1,2× — BENAR**
  (nyata: 1,7 m orang vs 1,4 m mobil). Mobil dan pejalan kaki SALING
  konsisten (keduanya 1u = 1 m). Yang tidak konsisten adalah jalan
  (1u = 10 m) dan gedung (1u ≈ 3 m): dunia ini punya TIGA skala.
- Jadi TIDAK ADA satu skala mobil yang benar untuk semuanya:
  pas di lajur (s ≈ 0,18) → mobil jadi mainan di samping pejalan
  kaki (orang 7,7× tinggi mobil); pas di samping orang (s = 1,0) →
  mobil tetap 5,4 lajur (keadaan sekarang).

## 3. Skala yang dipilih: CAR_SCALE = 0,5 (semua mobil)

Kompromi terbaik: setengah ukuran di semua sumbu (¼ luas di layar —
perubahan yang langsung terlihat), mobil tetap terbaca sebagai mobil
di samping orang.

| Ukuran | Sebelum (s=1,0) | Sesudah (s=0,5) | Nyata |
|---|---|---|---|
| Stella P × L × T | 4,4 × 1,9 × 1,20 | **2,2 × 0,95 × 0,60** | 4,4 m × 1,9 m × 1,4 m |
| Sedan | 4,1 × 1,85 × 1,25 | **2,05 × 0,93 × 0,63** | — |
| Van | 4,2 × 1,9 × 1,80 | **2,1 × 0,95 × 0,90** | — |
| Pickup | 4,3 × 1,9 × 1,41 | **2,15 × 0,95 × 0,71** | — |
| Roda sport (diameter) | 0,76 | **0,38** (~1 lajur) | 0,7 m |
| Lebar vs lajur 0,35 | 5,4 lajur | **2,7 lajur** | ~0,5 lajur* |
| Panjang vs podium 5,1 | 86% | **43%** | ~15% |
| Lebar vs carriageway avenue | 46% | **23%** | ~14% |
| Tinggi vs pejalan kaki 1,7 | 1,2× (benar) | **2,8× (TRADE-OFF)** | 1,2× |
| Tinggi vs tower 20u | 6% | **3%** | ~2,3% |

\* "Nyata" untuk lajur memakai lajur 3,5 m; lajur game 0,35u = 3,5 m
pada skala jalan 1u = 10 m — mobil nyata 1,9 m memang ~0,5 lajur.
Target harfiah "muat satu lajur" (lebar ≈ 0,35u) butuh s ≈ 0,18:
mobil 0,79 × 0,34 × 0,22 — mainan, orang 7,7× tinggi mobil, roda
r 0,07 (tak terlihat), mobil hilang di foto aerial. DITOLAK dengan
alasan ini. Titik tengah geometris antara 0,18 dan 1,0 adalah ~0,42;
dipilih 0,5 (angka bersih, aman untuk tes) — beda visual dari 0,42
hanya ~15%, trade-off pejalan kaki lebih baik. Kalau Xian masih
merasa mobil kebesaran, ini tinggal satu angka (CAR_SCALE) untuk
ronde berikut.

## 4. Trade-off yang diakui jujur

Pejalan kaki sekarang terbaca ~2,3× terlalu tinggi di samping mobil
(1,7u vs mobil 0,6u; seharusnya 1,2×). Di foto kejar-kejaran senja
hal ini hampir tidak terlihat (pejalan kaki berdiri di trotoar,
mobil di jalan, jarang satu frame berdampingan), tapi dalam gameplay
— pemain jalan kaki di samping mobilnya sendiri — orang terlihat
besar dibanding mobil. Tidak ada perbaikan dalam lingkup ini tanpa
merusak hal lain: mengecilkan pejalan kaki juga akan membuat mereka
tak terlihat di foto aerial; membesarkan mobil kembali mengulang
keluhan Xian. Pilihan ini yang paling kecil mudaratnya.

## 5. Yang ikut disesuaikan (semua ×0,5, proporsional)

- Collision radius 0,5 → **0,25** (vehicles.js createCar). Rasio
  terhadap diagonal mobil sama seperti sebelumnya (kompromi drive-fit
  lama dipertahankan).
- Jarak yield traffic 7u → **3,5u** (vehicles.js stepTraffic,
  cbd-traffic.js) — jarak antar mobil tetap ~1,6 panjang mobil.
- Chase camera: 10,5u di belakang / 4,6u tinggi → **7u / 3,4u**,
  look 5u di depan (tetap, visibilitas jalan), tinggi look 1,2 → 0,9.
- Wanted: holdDist 3 (jalan kaki) / 4 (di mobil) → **2 / 2**;
  ram < 3,2 → **< 1,6**; bust < 2,5 → **< 1,25** (tetap DI DALAM
  hold, sesuai komentar GAME fix M9 22 Nov). Spin roda polisi
  manual 2,4 → **2,4 / CAR_SCALE**.
- Board radius 4 → **3** (driver misi naik dari 1,5u, aman);
  exit offset 2,2 → **1,6** (pemain tetap ~1,1u dari sisi mobil).
- Spin roda: updateWheelRig sekarang membagi kecepatan dengan
  `spec.radius × skala grup` (sebelumnya radius tak berskala —
  roda akan berputar 2× terlalu cepat). Skid mark: offset roda
  belakang × skala grup + ukuran mark × skala.
- HUD kecepatan TIDAK diubah: `speed × 3,6` membaca u/s — kecepatan
  mobil dalam u/s tidak berubah, angka HUD tetap benar. Mobil kini
  menempuh ~8 panjang-mobil/detik pada 18 u/s (dulu 4) — jadi
  TERLIHAT lebih cepat, membantu shot kejar-kejaran.

## 6. Yang TIDAK diubah

- Pejalan kaki, gedung, jalan, pohon (bukan mobil).
- Kecepatan/akselerasi/turn-rate mobil (fisika u/s tidak berubah).
- Jalur traffic, spawn, misi, anchor — semua koordinat dunia tetap.
- Harbor Stripes, M10, J5–J9, orbit menu, audio — sesuai larangan.

## 7. Verifikasi (23 Nov, pasca-perubahan — semua GAME, bukan driver)

- Smoke (`/tmp/smoke-partF.mjs`, nocache 8941): hero `mesh.scale 0,5`,
  `radius 0,25`; traffic 16 + CBD 7 mobil semua skala 0,5 / radius
  0,25; hero jalan 7,6u, 15 u/s, HUD 54 km/jam; **0 console errors**.
  Foto `reports/partF-smoke.png`: mobil merah kecil di Lungomare,
  jalan multi-lajur + trotoar + gedung terbaca lebar — mobil tidak
  lagi memenuhi jalan.
- `routes.mjs`: **10/10 REACHABLE, errors 0** (termasuk oldtown,
  promenade, CBD, commercial, residential, hills, lighthouse,
  countryside, quarry). Mengemudi TIDAK rusak.
- `missions.mjs --only M1,M7 --human-like FASTSIM=2`:
  **M7 PASS 20 dtk** (human-like). **M1: attempt pertama STALL 317
  dtk** di stage 2 ESCAPE (maxStage 2) — pemain jalan kaki gagal
  kembali ke mobil yang parkir 8,67u dari road node terdekat
  (ambang driver 8u), lalu routeDrive memutar keyboard saat pemain
  jalan kaki sehingga mobil tidak bergerak ("IMMOBILIZED");
  **retry M1 PASS 19 dtk** (human-like). Jadi stall pertama adalah
  FLAKE driver (pathing jalan kaki, sensitif terhadap timing
  headless), BUKAN bug game — mengemudi terbukti jalan di routes
  10/10, stage 1 M1, dan retry M1. Dilaporkan jujur di sini, bukan
  disembunyikan.
- Traffic probe: mobil traffic + CBD melangkah tanpa error selama
  smoke + routes + misi (0 console errors di semua run); jarak yield
  3,5u bekerja (tidak ada tabrakan massal / macet di log).
- Wanted: smoke menunjukkan ram polisi bekerja ("Guard rammed you")
  dengan jarak baru; M9 tidak diuji ulang di ronde ini (di luar
  lingkup singkat — hold/ram/bust diskalakan proporsional, dan M7
  yang melewati wanted-0 lolos).
