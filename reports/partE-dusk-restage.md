# Part E — Dusk restage (23 Nov 2026, stage1ac, setelah part F)

4 screenshot submission di-shoot ulang di senja (19:30–19:33) dengan
mobil skala baru (CAR_SCALE 0,5, part F). Semua JPEG q85 1280×720,
di bawah 256 KiB. 0 console errors di semua shoot.

| File | Isi | Ukuran |
|---|---|---|
| screenshots/01-cover.jpg | Kejar-kejaran senja di Lungomare, hero 68 km/jam, polisi di kiri, wanted 4★, misi M9 + dispatch terisi | 149.427 B |
| screenshots/02-city.jpg | Aerial senja CBD + marina + promenade, tower padat, langit ungu-pink | 247.134 B |
| screenshots/03-action.jpg | Polisi menabrak hero dari samping (0,3u), 54 km/jam, "Guard rammed you", wanted 4★ | 155.272 B |
| screenshots/04-features.jpg | Momen gameplay nyata: hero 94 km/jam di jalan multi-lajur senja, M1 + HUD penuh | 152.657 B |
| reports/partE-lowcam-pov.png | Low-cam POV (perintah Xian 16:23): kamera 0,8u di trotoar, hero datang 68 km/jam, jalan lebar + trotoar + gedung terbaca | 314.897 B |

## Catatan jujur per shot

- **Low-cam POV**: varian B (head-on) yang dipakai — varian A
  (dari belakang, kamera 0,8u) tertutup massa krem fasad gedung di
  sepertiga atas frame. Di B, mobil menghadap kamera, polisi
  kelihatan di belakang, jalan terbaca lebar. Kelemahan: toast
  "Guard rammed you" menutupi tengah jalan; mobil polisi kecil.
- **01-cover**: hero + polisi kelihatan, gedung + palem terbaca.
  Kelemahan: fasad krem di kanan atas (kamera dekat gedung selatan);
  palem tengah membelah frame.
- **02-city**: RETAKE — `?shot=district&district=skyline` gagal
  (kamera menghadap teluk: 70% air + langit, tanpa kota). Diulang
  manual: aerial (48,42,52) → (-5,0,-8) di atas CBD. Kelemahan:
  hero parkir 0 km/jam (bukan mengemudi); toast "Guard rammed you"
  muncul karena polisi menabrak mobil parkir; pejalan kaki hampir
  tak terlihat dari ketinggian ini. Ukuran 247.134 B — di bawah
  batas 256 KiB tapi margin hanya ~15 KB.
- **03-action**: RETAKE — kamera samping pertama (z=mz+4) berada
  DI DALAM gedung selatan (frame penuh dinding krem). Diulang dari
  trotoar selatan (z=2,8, 1,5u). Hasil: hero + polisi bersisian
  saat menabrak — shot aksi terkuat dari set ini.
- **04-features**: gameplay nyata 94 km/jam (kecepatan maks).
  Kelemahan: toast "RANK UP — DECKHAND!" menutupi HUD tengah-bawah
  (muncul di awal game baru); palem besar di tengah frame. Tidak
  di-retake (ronde perbaikan dipakai untuk 03 + 02).

## Scratch (tidak ikut commit submission)

Kandidat di reports/partE-cand-*.png, partE-lowcam-hood.png,
partE-lowcam-pov-B.png (sudah dipromosikan jadi partE-lowcam-pov.png)
tetap di reports/ sebagai jejak audit. Dua file kandidat di
screenshots/cand-cover-A.jpg dan screenshots/cand-cover-D.jpg
DIHAPUS dari working tree (belum pernah di-commit; file ekstra di
screenshots/ akan merusak gate submission 3–4 screenshot).
