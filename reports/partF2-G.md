# Part F2 + Part G — Car scale 0.35 + undivided boulevard (23 Nov 2026, stage1ac)

Perintah Xian 17:28 WIB: "Mobilnya masih kegedean bos" (CAR_SCALE 0,5
masih terlalu besar) + 17:29 WIB: "Itu jalan gausah dipisah gitu
dibuat 1 lajur aja. pohon di tengah2 hapus semua" — dikonfirmasi
18:07 WIB: **SATU RUAS UTUH tanpa pembatas, tetap lebar 2 arah**
(bukan 1 lajur sempit).

## 1. Part F2 — CAR_SCALE 0,5 → 0,35 (semua mobil)

Lanjutan part F (CAR_SCALE 0,5, commit fc12a2e). Sesi-4 sudah
mengubah angka di tree (belum commit); sesi-5 melengkapi
penyesuaian proporsional + verifikasi.

| Ukuran | s=1,0 (asli) | s=0,5 (F) | s=0,35 (F2) |
|---|---|---|---|
| Stella P × L × T | 4,4 × 1,9 × 1,20 | 2,2 × 0,95 × 0,60 | **1,54 × 0,67 × 0,42** |
| Lebar vs lajur 0,35 | 5,4 lajur | 2,7 lajur | **1,9 lajur** |
| Panjang vs podium 5,1 | 86% | 43% | **30%** |
| Lebar vs carriageway avenue 4,1 | 46% | 23% | **16%** |
| Tinggi vs pejalan kaki 1,7 | 1,2× (benar) | 2,8× (trade-off) | **~4,0× (trade-off makin besar)** |
| Roda sport (diameter) | 0,76 | 0,38 | **0,27** |

Target harfiah "muat satu lajur" butuh s ≈ 0,18 (mobil 0,79 ×
0,34 — mainan, orang 7,7× tinggi mobil). 0,35 adalah titik tengah
antara 0,5 (Xian: masih kegedean) dan 0,18. Perbandingan 0,35 vs
0,25 di foto low-cam yang sama dibuat untuk Xian pilih (lihat §4).

Yang ikut disesuaikan (semua proporsional ×0,35 dari ukuran asli):
- Collision radius: `0.5 * CAR_SCALE` → **0,175** (otomatis,
  vehicles.js createCar — tidak perlu edit).
- Yield traffic: `7 * CAR_SCALE` → **2,45** (otomatis, stepTraffic).
- Spin roda: `2.4 / CAR_SCALE` → otomatis.
- Chase camera: 7/3,4 → **6/3,0**, look 0,9 → 0,8 (game.js,
  sesi-4; look 5u di depan tetap).
- Board radius 3 → **2,7**; exit offset 1,6 → **1,4** (game.js,
  sesi-4).
- Wanted holdDist: 2 → **1,05 (jalan kaki) / 1,4 (di mobil)**
  (wanted.js; asli 3/4, F: 2/2).
- Wanted ram: `dist < 1,6` → **`dist < 1,12`** (3,2 × 0,35).
- Wanted bust: `< 1,25` → **`< 0,875`** (2,5 × 0,35; tetap DI
  DALAM hold, sesuai fix M9 22 Nov).
- HUD kecepatan TIDAK diubah (u/s × 3,6, tetap benar).

Trade-off jujur: pejalan kaki kini ~4× tinggi mobil (seharusnya
1,2×). Di foto kejar-kejaran hampir tak terlihat; saat jalan kaki
di samping mobil sendiri orang terlihat besar. Kalau Xian masih
merasa mobil kebesaran, tinggal satu angka (CAR_SCALE) — kandidat
0,25 sudah disiapkan (§4).

## 2. Part G — jalan satu ruas utuh tanpa pembatas

Lokasi kode: `game/src/cbd-grid.js` (median + pohon tengah +
marking), `game/src/cbd.js` (monorail), `game/src/city.js`
(komentar: median visual-only).

Yang dihapus:
- Median mesh `cbd-medians`: strip batu 1,3 lebar × 0,35 tinggi
  sepanjang boulevard (z −0,65..0,65) + N-S avenue (x −0,65..0,65).
- Planter `cbd-median-planters`: kotak hijau 2,4 × 0,5 × 0,8 di
  tengah tiap segmen median.
- Pohon tengah `cbd-median-trees`: cypress di median LUNGOMARE
  (x −27..27 tiap 6, z 0). Pohon trotoar (kedua sisi jalan) TETAP.
- Marking: garis kuning ganda (double yellow) di tengah jalan
  untuk kedua avenue — pola yang sama dengan street (±0,01 dari
  garis tengah) — supaya dua arah tetap terbaca tanpa pembatas
  fisik. Lajur tidak digeser: 4 lajur/arah × 0,35 tetap, lebar
  carriageway 4,1 tetap.

Yang TIDAK diubah (sengaja):
- Road graph + traffic lanes: median itu VISUAL ONLY, tanpa
  collider (GAME fix 22 Nov, city.js) — jadi menghapusnya tidak
  memutus graph; lalu lintas tetap memakai lajur yang sama.
- Monorail (beam + pillars) TETAP: beam 0,8 lebar di y 7, pillar
  0,35 × 7 tiap 6u di z 0. Pillar berdiri di tengah jalan yang kini
  tanpa pembatas, tapi mobil lajur dalam (pusat ±0,825, setengah
  lebar mobil 0,335) membersihkannya ~0,3u; beam 7u di atas kepala.
  Kalau Xian mau pillar juga dihapus, itu satu perubahan kecil
  berikutnya (beam akan mengambang — perlu diputuskan).
- Trotoar, gedung, setback, pohon promenade — tidak disentuh.

## 3. Commit

- `29fb340` Round-9 part F2: car scale 0.35 (vehicles.js,
  game.js, wanted.js) — push.
- `9c857d7` Round-9 part G: undivided boulevard (cbd-grid.js) —
  push.

## 4. Verifikasi (semua GAME, bukan driver)

- routes.mjs: (diisi setelah run)
- missions.mjs --only M1,M7 --human-like FASTSIM=2: (diisi)
- Smoke 0,35 / 0,25: (diisi)
- Kit check: (diisi)

## 5. Shot perbandingan + re-shoot

- reports/partE-lowcam-pov-035.png (0,35) — (diisi)
- reports/partE-lowcam-pov-025.png (0,25, kandidat untracked) — (diisi)
- screenshots/03-action.jpg (0,35, tanpa diamond waypoint di frame) — (diisi)
- screenshots/01-cover.jpg, 02-city.jpg, 04-features.jpg — (diisi)
