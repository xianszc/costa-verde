# Part P — 01-cover reshoot (non-CBD, cinematic)

Perintah Xian 23:37: 01-cover part O "kurang cinematic" — ganti lokasi, JANGAN di area CBD.
HEAD `41be38b`. Hanya `screenshots/01-cover.jpg` yang berubah. 02/03/04 tidak disentuh (sha terverifikasi sama sebelum/sesudah). 0 console error. Tanpa tes. Tanpa tambah bintang (perintah "hid bintang" belum diputuskan).

## Lokasi final: Lungomare ujung BARAT (marina), menghadap matahari terbenam

- Kamera (6, 1.2, 12) di TENGAH jalan, rendah, menghadap BARAT sepanjang Lungomare; hero (-6, 12) 12u, Anchor-2 (-2, 11.5) 8u, Vespa-1 (1, 12.6) 5u — semua menghadap barat (angle PI), speed 18 (65 KM/H).
- Dusk 19:30, 4★ WANTED, dispatch Anchor-2 4m PURSUIT + Vespa-1 7m PURSUIT + Gull-1 HELI 60m INBOUND, FUEL 82% · DAMAGE 8%, minimap colorful, label QUAY / HARBOR FRONT · DISTRICT 4, tanpa toast, tanpa diamond waypoint.
- 1280×720 JPEG q85, 128 KiB (≤256 KiB). Clearance kamera 2,9u.
- Vista: langit sunset pink/ungu di ujung jalan, lampu lalu lintas + lampu jalan, zebra cross + yellow box junction di foreground, gedung membingkai kedua sisi jalan.

## Yang dicoba dan ditolak

- **Boardwalk marina (kamera (-10,1.2,33) menghadap barat):** vista PALING cinematic — laut + perahu layar di kiri, mercusuar bergaris merah-putih + beam di tengah kejauhan, palem + promenade di kanan, langit sunset. DITOLAK 2 ronde: mobil polisi HITAM tidak terbaca di atas boardwalk coklat gelap saat dusk (ronde 1: hero hampir tidak kelihatan, polisi foreground blob hitam terpotong; ronde 2 diagonal: kedua polisi hilang sama sekali di balik bayangan boardwalk). Walkway (z=29) tidak bisa dipakai: clearance 0,8u, kamera nempel dinding merah casino.
- **Lungomare barat ronde 1 (hero 9u / polisi 6u / 3u):** polisi foreground 3u terlalu dekat + terlalu gelap, blob hitam besar.

## Penilaian jujur

- **Bagus:** ketiga mobil terbaca (hero merah Stella paling jelas, 2 cruiser di 2 kedalaman), jalan lebar terbuka, langit sunset kuat, HUD lengkap, komposisi low-cam chase benar.
- **Kelemahan:** (1) cruiser foreground sangat gelap (hitam di atas aspal gelap — bentuk + atapnya terbaca, tapi detail minim); (2) tiang lampu hitam besar di kiri-tengah frame mendominasi; (3) **ini masih avenue Lungomare yang sama dengan take part O — hanya arah berlawanan** (barat/sunset/ujung marina vs timur/skyline CBD). Kalau Xian menganggap itu "masih Lungomare", lokasi yang benar-benar lain (boardwalk) sudah terbukti tidak bisa dipakai untuk chase karena kontras — perlu ide lokasi ketiga (mis. ring barat menghadap selatan ke teluk, atau apron marina).

## Akar masalah (arsip)

- `probeClearanceAt`: boardwalk (0,33) 6,4u / (-10,33) 6,2u bersih, tapi clearance tidak menjamin kontras — mobil hitam di permukaan gelap saat dusk tetap hilang.
- Chase dari belakang: mobil polisi paling belakang SELALU paling dekat kamera — jaraknya harus ≥5u supaya tidak jadi blob terpotong (part O: 8u; part P final: 5u, masih besar tapi utuh).
- Mercusuar ada di headland barat (x -128..-118, z 35..48) — terlihat dari boardwalk, tidak terlihat dari jalan (gedung promenade menutupi).
