# 3c.2 Shops — laporan (22 Nov 2026, builder 0721f86c)

## Status: SEBAGIAN — apotek PASS (3×), garasi/senjata/pakaian tertunda (DRIVER)

Kode GAME untuk keempat toko selesai dan ter-commit. Test driver membuktikan
alur toko penuh lewat apotek (3 run PASS berturut-turut). Tiga toko lain belum
terbukti karena driver mobil melenceng dari rute di CBD (bukan karena kode
toko — keempat toko memakai satu menu + satu jalur `buy()` yang sama, dan
jalur itu terbukti lewat apotek).

## Yang ditambahkan (GAME)

- `game/src/sidecontent.js` — overlay toko (`#shop-overlay`, `openShop` /
  `renderShop` / `closeShop`, pause via `setPaused`, tombol BUY re-render,
  item terkunci disabled); `shopSpots()` (4 toko incl. apotek);
  `nearestShop()` (≤4u); marker start job; `onKeyDown` E: pintu toko buka
  menu / marker job mulai job (story interact menang bila dalam jangkauan;
  hanya jalan kaki); Escape tutup toko; `updatePrompt()` (throttle 200 ms);
  rank claim loop menangani `unlocks` array + kind `weapon` (Tamburo
  reserve +48); `window.__side` mengekspos `openShop`/`closeShop`.
- `game/src/side-shops.js` — senjata: hanya amunisi + item baru
  `weapon-tamburo` (kind `weapon`, senjata 3, 48 peluru, S 600, rank FIXER);
  `ammo-tamburo` rank-gated FIXER; BARU seksi `pharmacy` (Farmacia Azzura,
  CBD): medkit S 200, armour-plate +40 S 300, armour-vest full S 600
  (pindah dari senjata); garasi tambah `repair-full` (S 150) dan `fuel-full`
  (S 80). Paint (teal/gold/magenta) + tune sudah ada di menu asli.
- `game/src/anchors-side.js` — spot `pharmacy` baru = skyline_plaza + (4, 0)
  = (-1.9, -5.9), tanah plaza terbuka, jauh dari target M7.
- `game/src/side-data.js` — reward FIXER jadi `unlocks: ['outfit:casino',
  'weapon:3']` (+ S 1000).
- `game/src/vehicles.js` (GAME) — bahan bakar kini berarti: `input.up`
  diabaikan saat fuel 0; rem selalu bekerja; mundur butuh bahan bakar;
  drain diperlambat 0.02 → 0.005 per unit kecepatan per detik (tangki penuh
  ~1000 dtk pada kecepatan penuh, jadi tidak ada misi cerita ≤480 dtk yang
  bisa mogok; berkendara bebas yang lama bisa). Penyelamatan saat mogok:
  jalan kaki ke garasi, beli fuel (berlaku untuk mobil di mana pun).
- `game/src/sidecontent.js` — perbaikan E-priority (GAME, run 7+9):
  E diperebutkan pintu toko vs mobil. Mobil yang parkir di pintu membuat E
  selalu membuka toko — pemain tidak bisa masuk mobil lagi (run 7: boardCar
  gagal, game tertinggal paused dengan toko terbuka). Aturan baru: target
  terdekat yang menang; pintu menang bila pemain tepat di pintu (≤2u),
  mobil menang bila lebih dekat. Prompt diperbarui dengan aturan yang sama.

## Yang ditambahkan (TEST)

- `game/test/sidecontent.mjs` (baru) — helper driver disalin dari
  `game/test/missions.mjs` + test T2 shops + runner (`--only
  map|shops|coins|jumps|jobs|ranks`, hasil di `reports/sidecontent-run.json`).
  **Perbaikan driver selama run:** (1) boardCar dulu (pemain spawn jalan
  kaki); (2) sinkronisasi helper driver ke missions.mjs saat ini — copy saya
  ternyata dari versi lama, kehilangan fix D2 sidestep, 3-point turn yang
  benar, cluster graph 3u, dan Dijkstra berbobot lebar; (3) boardCar selalu
  jalan ke ≤1.5u dari mobil sebelum tekan E (tekan E dari 2–3u bisa kena
  pintu toko); (4) rute toko senjata via ring (lihat OPEN).
- `game/test/sidecontent.mjs` — `routeDriveVia()` (drive lewat titik
  antara) + param `via` di `driveThenWalk`/`openShopAtDoor`.

## Bukti test (T2 shops, human-like, fastsim=2)

- **Apotek PASS 3× (run 7, 8, 9, 10):** drive ke (-1.9,-5.9) → prompt →
  E buka menu "Farmacia" → beli armour-plate (uang −S 300, armour 60→100)
  → beli medkit (uang −S 200, health tetap 100). Uang awal S 1500; koin
  yang terinjak mobil en route menambah +S 50/koin (run 8: S 1550 sebelum
  beli; run 10: S 1600) — math uang di test memakai delta per pembelian,
  bukan absolut.
- **Garasi FAIL (DRIVER):** mobil melenceng dari rute di CBD. Run 8: rute
  (-11.2,-11.2)→(-11.2,0)→(0,0) — belokan 90° di jalan w=2 x=-11.2
  menjepit mobil (akhir (-23.7,-3.6)). Run 10: via (0,0) — mobil dari
  (2.6,-10.3) menuju (0,0) malah ke (-5.0,-9.2), lalu re-plan ke (0,-11.2)
  malah ke (8.3,-23.0), lalu ke (10.9,-29.7) dan (10.6,-34.8): mobil
  konsisten melaju ke utara saat target di selatan. Penyebab belum
  dipastikan (dugaan: ditabrak mobil traffic / spin + driver tak pulih —
  perlu probe dengan trace kecepatan + wanted + damage).
- **Senjata/pakaian BELUM DICOBA** (test berhenti di garasi): rute senjata
  via ring [(0,-39)] sudah disiapkan; Tamburo terkunci di bawah FIXER dan
  P9 ammo (+24, −S 120) sudah dikodekan di test; pakaian Harbor Stripes
  (S 400, DECKHAND) sudah dikodekan.
- **Paint-teal (S 900):** price gate dikodekan di test (uang S 770 < 900
  harus ditolak, uang tak bergerak) — belum dieksekusi karena test berhenti
  di garasi. Cabang `applyPaint` belum terbukti oleh driver.
- **Save/load:** belum dieksekusi (langkah 5, setelah semua toko).

## OPEN (dengan bukti)

1. **Driver melenceng di CBD (DRIVER, bukan GAME).** Bukti: log
   `/tmp/side-shops-run8.log`, `/tmp/side-shops-run10.log` (waypoint FAIL +
   posisi mobil). Mobil kadang melaju berlawanan arah target sejauh 10–14u.
   Dugaan utama: tabrakan traffic / spin; perlu probe dengan trace
   kecepatan, wanted, damage per detik. Terkait dengan M5 FAIL (db4bcca)
   — driver yang sama.
2. **Hidung median boulevard (-34.7,0) (GAME, diketahui).** Waypoint
   centerline z=0 menabrak hidung median; driver D2 sidestep menanganinya
   setelah stall, tapi rute barat di boulevard tetap rapuh (run 2–5, M5).
   Test senjata memakai rute via ring untuk menghindarinya.
3. **Paint-teal + save/load belum terbukti** (lihat di atas).

## Waktu

3c.2 melewati box 90 mnt (~2 jam 45 mnt sejak 13:23 WIB, termasuk diagnosis
driver 4 run gagal + sinkronisasi driver + 2 perbaikan GAME E-priority).
