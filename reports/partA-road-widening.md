# Bagian A — Pelebaran jalan 2 arah × 4 lajur (stage1aa)

Tanggal: 23 Nov 2026 ~14:10–14:30 WIB. HEAD sebelum: e6cb344.
Perintah Xian: jalan utama 2 arah × 4 lajur tiap arah, garis tengah jalan
TIDAK berpindah (hanya badan jalan melebar).

## Angka

| Jalan | Lama | Baru |
|---|---|---|
| Avenue CBD (CORSO AZZURRA, LUNGOMARE) | 4.8 lebar, 3 lajur/arah × 0.35, median 1.3, badan 3.4 | 5.2 lebar, 4 lajur/arah × 0.35, median 1.3, badan 4.1 |
| Street CBD | 2.2 lebar, 2 lajur/arah × 0.3, badan 1.4 | 3.0 lebar, 4 lajur/arah × 0.3, badan 2.4 |
| Konektor ring (x ±40) + ring avenue (z −42) | 7 lebar, 1 lajur/arah | 7 lebar (slab sudah lebar), 4 lajur/arah (marka + stop + panah) |
| Ring side streets (2 lebar), gang old town (2 lebar), jalan zona luar (2 lebar) | — | TIDAK diubah (bukan jalan utama — pengecualian, lihat bawah) |
| Old town main street (z −39) | 7 lebar, cobble tanpa marka | TIDAK diubah (sudah 7 lebar; marka di cobble merusak nuansa historic) |

Lajur: avenue 0.825/1.175/1.525/1.875; street 0.15/0.45/0.75/1.05.
Blok CBD: 8.2×8.2 (luar), 7.1 (kolom tengah + baris flanking boulevard);
total blok 1.824 units² (dulu 2.303). Podium twin 7.0 tetap muat (rim 0.05
di blok tersempit — setback diperbaiki di bagian B).

## File diubah (game only)

- `game/src/cbd-grid.js` — CBD_NS/CBD_EW w, roadHalf (2.05/1.2),
  AVE_LANES, marka (divider 1.0/1.35/1.7 + 0.3/0.6/0.9, edge 2.05/1.2,
  bus 1.875), stop override (avenue 0.7–1.7, street 0.05–1.15),
  zebra edge, speed bump 2.4, hydrant +1.77, halte bus 2.95,
  rambu arah 2.64.
- `game/src/cbd-traffic.js` — LANE_OFFS 4 lajur/arah.
- `game/src/roads.js` — BOULEVARD ±2.05, minimap boulevard w 5.2,
  konektor + ring avenue 4 lajur/arah (divider ±0.875/1.75/2.625,
  double yellow, edge ±3.2), WIDE_LANE {len 3.2, c 1.75}, panah 1.75,
  tiang lampu lalu lintas z 2.74, crossing boulevard h 2.6.
- `game/src/commercial.js` — pedPaths boulevard z 2.95.
- `game/src/game.js` — jalur pejalan CBD (Lungomare ±2.95, CORSO 2.95,
  grid street −20.65/24.15, zebra ±2.95).
- `game/src/cbd.js` — mobil parkir plaza digeser 0.8 ke utara
  (akibat pelebaran: blok plaza 7.7→7.1, sudut 3 mobil bertemu).
- `game/src/markings.js` — komentar saja (angka contoh konektor).

## Verifikasi bagian A

- `node game/test/cbd-blocks.mjs` — PASS (30/30 blok bounded, 36 tower + 8 podium).
- `node game/test/cbd-overlap.mjs` — PASS (0 overlap; sempat FAIL 2
  overlap sudut mobil parkir plaza — diperbaiki dengan geser 0.8 utara).
- `node game/test/zone-overlap.mjs` — PASS (semua zona 0 masalah).
- `node game/test/connectivity.mjs` — PASS (semua zona satu komponen;
  longest drive lighthouse→quarry 401.3u).
- `node game/test/routes.mjs` — (hasil di bawah).
- Visual: `reports/partA-cbd-top.png` + `reports/partA-cbd-street.png`
  (0 console error, draw calls 183/223) — jalan terbaca lebar, 4 lajur
  + median + zebra terlihat dari atas; dari jalan, marka lajur + lampu
  hijau + mobil traffic terlihat.
- Traffic lajur: probe 30 dtk melihat lajur 0/1/2 (avenue + street);
  lajur 3 dibuktikan dengan probe paksa: mobil CBD di lajur 3 street
  (offset 1.05) berhenti TEPAT di stop line x 19.5 lalu jalan ke
  stop line berikut x 30.7 — lajur 4 bisa dilalui, offset + stop line
  dihitung benar per jalan.
- Misi smoke: (hasil di bawah).

## Catatan / open

- Trotoar selatan jalan CBD z 11.2 kini menutup quay 0.5 (dulu 0.1) —
  walkway-di-atas-walkway, sudah ada sebelumnya, kosmetik; tidak
  diperbaiki di A (butuh geser quay / WATER_Z).
- Sinyal lalu lintas pakai jam dinding (performance.now), jadi di
  fastsim mobil menunggu lampu lebih lama dari waktu game — perilaku
  lama, bukan regresi A.
- Panah belok tetap 2 per approach (lajur bus + lajur terluar tanpa
  panah, seperti sebelumnya) — lajur 3/4 tanpa panah.
