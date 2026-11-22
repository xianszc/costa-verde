# Screenshot Candidates §5b — 22 Nov 2026, ~23:15 WIB

10 candidates, 1280×720, JPEG q80, di `screenshots-candidates/`.
Game asli saja — no mockup, no edit gambar, no debug overlay, no golden
hour/sunset. Final 4 DIPILIH XIAN, bukan builder.

## Staging (reproducible)

- Cover + city: `?shot=cbd&view=avenue|bay|oblique&time=12` (+ `&hud=0`
  untuk city). View `avenue` men-stage Stella + 3 mobil CBD + 2 pejalan
  di zebra. Kamera custom di-freeze via stub `requestAnimationFrame`
  + render manual (pola `/tmp/zebra-top.mjs`).
- Night action: play mode (`/`), `startPlay()`, `state.time = 22`,
  Stella di boulevard (-30, 0), `wanted.setLevel(3)` — cruiser +
  interceptor spawn dan converge sendiri; 20 s settle, lalu 3 sudut
  kamera dari posisi unit live. Wanted naik 3→4 selama settle karena
  ram (06/08: 4 stars; 07: 3 stars).
- Features: play mode, `window.__side.openMap()` / `openShop('garage')`.
- Script: `/tmp/shot-candidates.mjs` (log `/tmp/shot-candidates*.log`).
- **Disclosure staging:** di shot cover, elemen toast (`#side-toast`,
  `#toast`) disembunyikan via evaluate sebelum screenshot — toast
  RANK UP adalah notifikasi transien boot yang tidak pernah hilang
  dalam mode shot (jam tidak jalan) dan menutupi tengah bawah frame.
  HUD lain lengkap. Bukan edit gambar. Di shot malam/feature toast
  dibiarkan apa adanya (toast "Guard rammed you" di 06/07/08 adalah
  gameplay asli).

## Tabel (semua 1280×720, JPEG q80)

| # | File | KiB | Lum* | Waktu | Calls | Kritik jujur (kuat / lemah) |
|---|------|-----|------|-------|-------|------------------------------|
| 01 | 01-cover-low.jpg | 148 | 113 | 12:00 | 177 | Kuat: street-level, avenue ke menara, mobil oranye + van biru, lampu lalu lintas, toko FARMACIA/PANETTERIA, HUD lengkap tanpa toast. Lemah: rambu kuning diamond besar di foreground kiri; pejalan kecil; menara terpotong di atas. |
| 02 | 02-cover-mid.jpg | 142 | 118 | 12:00 | 152 | Kuat: komposisi avenue terbaik — jalan, zebra, 2 mobil, lampu, papan toko, HUD lengkap. Lemah: dinding hijau datar besar di kiri bawah (~18% frame, tanpa detail); pejalan di zebra tersembunyi di balik mobil oranye; menara terpotong. |
| 03 | 03-cover-high.jpg | 148 | 105 | 12:00 | 173 | Kuat: sudut tinggi, "canyon" menara kiri-kanan, jalan + zebra terbaca, mobil oranye + van biru di tengah. Lemah: pejalan TIDAK terlihat (tersembunyi di balik mobil); menara terpotong di atas; jendela gelap kanan dominan. |
| 04 | 04-city-bay.jpg | 156 | 137 | 12:00 | 310 | Kuat: skyline + promenade + kapal layar + marina + ≥3 gaya distrik, langit biru cerah. Lemah: air datar ~25% foreground; langit ~40% atas; perahu kiri bawah terpotong setengah. |
| 05 | 05-city-oblique.jpg | 182 | 149 | 12:00 | 289 | Kuat: shot kota terbaik — menara, teluk + kapal, promenade, mercusuar, bukit, jalan terbaca. Lemah: bukit pucat kanan atas agak kosong; atap oranye kanan bawah repetitif. |
| 06 | 06-night-chase-rear.jpg | 140 | 91 | 22:14 | 258 | Kuat: kejar-kejaran terbaca — 4 bintang, dispatch PURSUIT (Anchor-2 13 m), cruiser merah menabrak Stella, toast "Guard rammed you", lampu hijau, jendela menyala. Lemah: tiang lampu hitam besar menutupi tengah-kiri; Stella gelap dan terpotong di kiri; cincin emas gerbang jump SJ2 di tengah frame; tanpa pejalan. |
| 07 | 07-night-chase-side.jpg | 130 | 76 | 22:13 | 233 | Kuat: head-on dari jalan — 3 bintang, dispatch (Anchor-2 4 m PURSUIT), cruiser merah + Stella, zebra + marking terbaca, jendela menyala. Lemah: SHOT TERLEMAH — mobil gelap besar (traffic) menutupi foreground kanan, pohon + pilar monorel menutupi tengah; Stella sulit dibedakan dari cruiser. |
| 08 | 08-night-chase-high.jpg | 163 | 79 | 22:14 | 262 | Kuat: shot malam terbaik — sudut tinggi, Stella + cruiser merah + ring SJ2, sorot heli dari atas, jalan + marking terbaca, jendela menyala. Lemah: Stella sangat gelap; cincin emas SJ2 dominan di tengah; tanpa pejalan. |
| 09 | 09-feature-map.jpg | 93 | 79 | 20:03 | — | Kuat: peta penuh asli — nama jalan, marker toko/job/race/jump, koin, daftar waypoint asli (FARE TO THE CASINO, THREE PARCELS ONE DUSK, BOULEVARD SPRINT, CBD LOOP, dll), counter Jobs/Races/Jumps/Coins. Lemah: label "THE F…" terpotong di tepi kanan peta; area kosong kanan atas. |
| 10 | 10-feature-shop.jpg | 76 | 90 | 19:57 | — | Kuat: menu Gus' Garage asli — harga, YOUR MONEY S 1,500, BUY/LOCKED + rank gate (Gold Riviera FIXER, Engine tune WHEELMAN/FIXER). Lemah: menu lebih tinggi dari viewport — baris "Engine tune III" terpotong di bawah. |

\* Lum = rata-rata brightness 0–255 (diukur dari canvas render).
Night: 76–91 — jalan/marking/mobil tetap terbaca, tidak hitam pekat.
Semua file <256 KiB, sisi panjang 1280, sisi pendek 720 (≥480 ✓).

## Retake yang dilakukan (cacat → pindah kamera, lalu retake)

- 01 v1 DITOLAK: kamera (2.2, 1.6, 4) — pohon besar menutupi tengah
  frame + lengkung kuning gedung di kiri. Retake dari (0, 1.8, -4).
- 03 v1 DITOLAK: kamera (0, 9, 2) — frame hitam total (kamera di dalam
  gedung selatan boulevard). Retake dari (0, 8, -4).
- 02 v1: komposisi bagus tapi toast RANK UP menutupi status bar bawah;
  retake dengan toast disembunyikan (staging, lihat disclosure).
- 07 v1 DITOLAK: kamera (mx+2, 2.2, mz+11) — di dalam gedung promenade,
  60% dinding beige datar. 07 v2 DITOLAK: kamera (mx-6, 2.2, mz+5.5) —
  55% dinding beige fasad selatan. 07 v3 (head-on dari sumbu jalan)
  dipakai — masih terlemah dari 10, lihat kritik di tabel.
- 04/05/06/08/09/10: sekali ambil, tidak ada retake.

## Catatan

- Cincin emas di shot malam = gerbang stunt jump SJ2 "West Gate"
  (`sidecontent.js:419`, TorusGeometry) di race_start_1 (-30,-0.7) —
  persis tempat chase di-stage. Objek game asli, bukan artefak.
- Mobil pemain "Stella" berwarna gelap di malam hari — di 06/07/08
  sulit dibedakan dari traffic/cruiser tanpa HUD.
- Pejalan kaki: terlihat jelas hanya di 01 (trotoar) — di 02/03 kecil
  atau tersembunyi di balik mobil; di malam hari tidak ada pejalan
  dalam frame (wajar: chase di jalan, pejalan di trotoar luar frame).
- BUNDLE check kit level-36 di HEAD final menyusul di laporan akhir
  builder (bukan bagian file ini).
