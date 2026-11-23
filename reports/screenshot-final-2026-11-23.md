# Screenshot final — 12 gambar (3 opsi per shot) — 23 Nov 2026

Ronde final atas perintah Xian 08:47 WIB ("Buatkan dulu skrinsutnya nanti aku pilih" + 12 gambar, 3 opsi per shot). Semua 1280×720 JPEG, tiap file < 256 KiB, di `screenshots-candidates/final/`. Game asli saja — kamera di-stage, gambar TIDAK diedit/dipoles, tanpa tampilan debug. Final 4 TIDAK dipilih di sini — Xian yang memilih. Script: `~/workspace/makefun/gta6-01/shot-final.mjs` (juga `/tmp/shot-final.mjs`). HEAD `946c44e`. Recording stage1s hidup selama ronde (`01a20616`).

## Ringkasan per gambar (satu baris kritik jujur: kuat + lemah)

### Shot 1 — COVER (CBD siang jam 12, HUD tampil)

| File | Ukuran | Lum | Kritik |
|---|---|---|---|
| `01-cover-a.jpg` | 142.989 B (140 KiB) | 133 | Kuat: hero oranye BESAR 3/4 belakang tengah-kanan, 5 pejalan jelas di trotoar depan (satu besar di foreground kanan), taksi kuning + bus biru, toko FARMACIA/PANETTERIA terbaca. Lemah: taksi kuning sebagian tertutup tiang lampu; buritan Stella terbaca agak kotak (jendela belakang hitam besar). |
| `01-cover-b.jpg` | 146.360 B (143 KiB) | 117 | Kuat: canyon avenue paling bersih — hero di tengah, bus biru + truk teal di kejauhan, menara dua sisi, 4 pejalan jelas (oranye/hijau kiri, abu/pink kanan). Lemah: hero agak kecil dari opsi (a); pejalan pink kanan-bawah dekat tepi frame. |
| `01-cover-c.jpg` | 153.838 B (150 KiB) | 111 | Kuat: sudut tinggi 10u — jalan + menara + lalu lintas terbaca dari atas, taksi kuning besar di depan hero. Lemah: taksi LEBIH besar dari hero (hero bukan mobil paling menonjol); gedung kanan sangat dekat ke kamera. |

### Shot 2 — KOTA (pandangan luas siang, HUD tampil)

| File | Ukuran | Lum | Kritik |
|---|---|---|---|
| `02-city-a.jpg` | 198.539 B (194 KiB) | 136 | Kuat: skyline CBD + menara Azzura, laut + perahu layar (pink/putih/teal) di bawah, palem + promenade, old town kiri + residensial kanan — semua syarat terpenuhi. Lemah: langit atas agak kosong; kartu misi menutupi sebagian old town kiri. |
| `02-city-b.jpg` | 200.186 B (195 KiB) | 146 | Kuat: sepanjang waterfront — marina + perahu layar tertambat kiri, palem + promenade tengah, deret kasino + menara CBD kanan, mercusuar di kejauhan. Lemah: minimap menutupi sebagian marina kiri-bawah; menara agak jauh. |
| `02-city-c.jpg` | 218.290 B (213 KiB) | 140 | Kuat: menara CBD dominan dari tenggara + old town kiri + palem promenade bawah. Lemah: laut/perahu hanya di pojok kiri-bawah (sebagian tertutup minimap); cincin emas SJ3 kecil di tepi kiri-bawah; menara memenuhi 70% frame. |

### Shot 3 — AKSI MALAM (kejar-kejaran polisi jam 22, HUD + bintang wanted)

Kecerahan rata-rata ketiga shot malam: **lum 81** (a 87, b 79, c 77). Jalan dan marka tetap terbaca di ketiganya; tidak terlalu gelap.

| File | Ukuran | Lum | Kritik |
|---|---|---|---|
| `03-action-a.jpg` | 139.644 B (136 KiB) | 87 | Kuat: hero merah BESAR 3/4 belakang, bintang wanted 4 + panel dispatch (CRUISER 17m, INTERCEPTOR 32m, HELI 60m INBOUND), lampu jalan menyala, marka terbaca, TANPA toast. Lemah: light bar cruiser tidak teridentifikasi (unit ~21u jauhnya, di belakang hero); lampu depan hero tidak terlihat dari sudut ini. |
| `03-action-b.jpg` | 140.281 B (137 KiB) | 79 | Kuat: dari atas 14u — hero di tengah persimpangan, marka + zebra terbaca, SOROT LAMPU HELI (beam putih diagonal) terlihat jelas. Lemah: paling tidak dramatis dari ketiganya (top-down informatif, bukan aksi); unit polisi tidak terlihat dari atas. |
| `03-action-c.jpg` | 139.419 B (136 KiB) | 77 | Kuat: dari depan — BEAM LAMPU DEPAN hero menyorot ke kamera, CAFÉ LUME + OROLOGERIA terbaca, bintang 4 + dispatch tampil. Lemah: paling gelap (lum 77); cincin emas SJ3 terlihat di kejauhan tengah; cruiser tidak terlihat (di belakang hero). |

### Shot 4 — FITUR (tiga layar data asli)

| File | Ukuran | Lum | Kritik |
|---|---|---|---|
| `04-features-a.jpg` | 95.116 B (93 KiB) | 86 | Kuat: peta layar penuh lengkap — seluruh kota + nama jalan + daftar 13 waypoint + footer "THE FERRYMAN'S CRATE — 23 m away" — mapCheck `bad=[]` (flaw 09 terverifikasi diperbaiki). Lemah: daftar waypoint berscroll (ada item di bawah "West Gate"); label "N ↑" agak mepet tepi kiri peta. |
| `04-features-b.jpg` | 82.586 B (81 KiB) | 88 | Kuat: menu garasi MUAT PENUH — ke-9 item + tombol CLOSE terlihat (Full repair/tank/Harbor Teal/Sport brakes BUY, sisanya LOCKED + syarat rank), YOUR MONEY S 1.500. Lemah: diambil dengan pengetatan spacing CSS via evaluate (lihat disclosure) — UI aslinya scroll internal; watermark "PAUSED" samar di belakang kartu. |
| `04-features-c.jpg` | 67.821 B (66 KiB) | 90 | Kuat: toko senjata muat penuh skala 1.0 tanpa staging — 5 item (Lupo P9/Doppietta/Fucile BUY, Tamburo ammo/SMG LOCKED) + CLOSE. Lemah: kartu paling kecil dari ketiganya (banyak ruang kosong di bawah); latar belakang game hampir tidak terlihat (terlalu gelap/dim). |

## Staging & disclosure (jujur, semua via evaluate — kode game TIDAK diubah)

- **Toast RANK UP disembunyikan (diizinkan parent, disclosed):** notifikasi boot "RANK UP — DECKHAND! +S 250…" adalah `#side-toast` (sidecontent.js:1187, queue FIFO, tampil via opacity). Disembunyikan dengan `display='none'` sebelum screenshot di semua 12 gambar. Jebakan yang ditemukan: `#side-toast` itu `position:fixed`, jadi `offsetParent` SELALU null — cek `offsetParent !== null` (dipakai di 2 percobaan 01a pertama) tidak pernah menyembunyikannya; toast tetap muncul di frame. Perbaikan: sembunyikan tanpa syarat di shot staged, hanya bila teksnya "RANK UP" di shot live.
- **Pejalan yang ditempatkan akhirnya TERLIHAT (akar masalah ditemukan):** `updateVisibility()` (game.js:1436) menyembunyikan pejalan >12u dari kamera SELAMA 120 langkah staging `?shot=cbd` — dan `stageShot` tidak pernah mengembalikan `visible=true` untuk pejalan yang ditempatkannya (termasuk 2 pejalan zebra). Itu sebabnya pejalan tidak terlihat di SEMUA shot sebelumnya (kandidat 01–10, retake 11–14). Perbaikan: setelah menempatkan pejalan, set `p.mesh.visible = true` (staging saja). Posisi trotoar yang benar adalah x ±2.75 (pedPaths game.js — "CORSO's east sidewalk (x 2.75)"); x=2.05 itu DI ATAS ASPAL, x=4.2 itu DI DALAM GEDUNG — kedua percobaan 01a pertama gagal karena itu.
- **Menu garasi tidak muat di 720p pada skala 1.0 (fakta game):** `.shop-card` max-height 88vh = 634 px, isi garasi 812 px — item 8–9 terpotong (sama seperti kandidat 10). `zoom` pada kartu TIDAK memperbaiki (probe: scrollH tetap 824, card mengecil tapi isi tetap overflow — zoom mengecilkan wadah dan isi sama besar). Solusi staging (disclosed): injeksi `<style>` yang mengetatkan padding item 10→4 px dan padding kartu 18→10 px — hasil ukur: scrollH = clientH = 623 px, item terakhir berakhir 627, tombol CLOSE berakhir 661 (dalam kartu 47–673) — ke-9 item + CLOSE muat. Toko senjata muat di skala 1.0 tanpa staging.
- **Toast gameplay "Guard rammed you" TIDAK PERNAH disembunyikan.** Shot malam v1–v3 gagal karena toast ini: hero diam di wanted level 4 diram terus-menerus (interceptor maxSpeed 30, potong 45u di depan; cruiser 30–50u di belakang) — toast nyala terus, dan hero akhirnya WASTED (toast macet tampil karena game pause). v4 berhasil dengan: set wanted level 4 SETELAH dialog didismiss (bukan sebelum), tanpa settle, freeze pada momen pertama toast tidak tampil — cruiser 21u, interceptor 19,5u, health 100, toast tidak tampil di ketiga sudut. Catatan: light bar cruiser tidak teridentifikasi di ketiga shot malam (unit ~20u); yang terlihat: bintang 4, panel dispatch (jarak + PURSUIT/INBOUND), dan beam sorot heli di 03b.
- **Yang DITOLAK dan di-retake:** 01a v1 (kamera y=1.6: dinding gelap besar di tengah-kanan + toast RANK UP + pejalan tak terlihat); 01c v1 (dari utara: dinding gelap besar sepertiga kiri + cincin emas SJ3 di tengah kejauhan); 02b v1 (dua palem raksasa menutupi frame) + v2 (semua kota, tanpa laut/perahu); 02c v1 (kamera di DALAM kanopi palem — frame = daun hijau) + v2 (menara dominan, laut hanya sepotong tepi); 03 v1–v3 (toast ram di ketiga sudut; v3: hero WASTED, toast macet).

## Data staging

- Cover: `?shot=cbd&view=avenue&time=12`; Stella (0.72,-22); kamera (a) (3.0,2.6,-13)→(-2,1.0,-23), (b) (0,6,-8)→(0,1,-22), (c) (0,10,-6)→(0,0.5,-25); pejalan x ±2.75, z -12…-20.5.
- Kota: `?shot=cbd&view=bay&time=12`; (a) kamera staged bay (15,7,90)→(0,32,-12); (b) (60,18,45)→(0,5,0); (c) (45,10,55)→(-5,18,-20).
- Malam: play mode, mobil (1,-22) hadap selatan, jam 22, wanted level 4; cruiser (5,-42.6) 21u, interceptor (1.6,-2.5) 19,5u, heli (3.4,24,-21.2); kamera (a) (3.0,2.6,-13)→(-2,1.0,-23), (b) (1,14,-14)→(0,0,-23), (c) (1,2.2,-33)→(0,1.2,-20).
- Fitur: (a) `openMap()` + klik J4 via dispatchEvent, mapCheck bad=[]; (b) `openShop('garage')` + tightening di atas; (c) `openShop('weapons')` skala 1.0.
- Semua frame: flat-check lolos (<0.6); console errors 0 di semua run.

## File

Semua di `screenshots-candidates/final/`: `01-cover-a/b/c.jpg`, `02-city-a/b/c.jpg`, `03-action-a/b/c.jpg`, `04-features-a/b/c.jpg`. Total 12 file, 1.743.434 B. TIDAK dipromosikan ke `screenshots/` — menunggu pilihan Xian. TIDAK ada BUNDLE di ronde ini.
