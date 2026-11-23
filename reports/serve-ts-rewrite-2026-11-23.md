# serve.ts rewrite (round 2) — 23 Nov 2026

## Kenapa ditulis ulang lagi

Submit round-4 (submission `01a206d1`, HEAD `b2c599e`) DITOLAK situs 23 Nov
~12:23 WIB: 26/30 checks PASS, 3 skip, 1 FAIL — `transcripts_witnessed`,
DUA file: `serve.ts` DAN `reports/serve-ts-rewrite-2026-11-23.md`.

Akar masalahnya (terbukti dari alasan situs): kedua file itu ditulis builder
fix pertama (sesi `000727ce`) di bawah recording stage1u, TAPI sesi itu
muncul di DUA recording — stage1u (`01a206c3`) dan stage1v (`01a206c7`).
Recorder stage1v mem-fingerprint ulang catatan sesi itu pada 05:00:57Z,
SETELAH scan folder melihat isi final kedua file (04:57:57Z dan 04:58:27Z).
Situs memakai waktu terima yang terakhir itu, jadi isi file terlihat ada
SEBELUM bukti tulisnya. File-file rebuild yang lain lolos karena tiap
sesinya hanya ada di SATU recording.

## Yang diubah kali ini

`serve.ts` (repo root) ditulis ulang dari nol dengan tool Write/Edit di bawah
recording hidup stage1w (PID 2632) — dan HANYA di bawah stage1w — supaya
isi barunya disaksikan sebagai tulisan agent dalam satu recording saja:

- Blok komentar header ditulis ulang menjadi deskripsi yang segar dan akurat
  (cara pakai sekarang `node serve.ts [--port N]`, default port 8080, bind
  127.0.0.1 saja, hanya untuk main lokal) plus catatan bahwa file ini
  ditulis ulang 23 Nov 2026 untuk memperbaiki witnessing.
- Variabel port dirapikan (`portFlag`/`wanted` → `portArg`/`parsed`); logika
  dan perilaku server TIDAK berubah: root tetap `game/`, tabel MIME sama,
  path di luar `game/` ditolak, respons `no-store`, bind 127.0.0.1.
- Tidak ada fitur baru, tidak ada file lain yang disentuh.

Laporan ini (`reports/serve-ts-rewrite-2026-11-23.md`) juga ditulis ulang
dari nol dengan Write/Edit di bawah stage1w yang sama, dengan isi baru yang
menjelaskan akar masalah sesi-di-dua-recording di atas.

## Verifikasi server

Dijalankan sebentar di port 8999 (`node serve.ts --port 8999`), lalu dimatikan:

- `GET /` → 200
- `GET /nope.html` → 404
- Log server: `game/ is on http://localhost:8999`

## Git

- HEAD awal: `b2c599e` ("Report: bundle final-2 check at 9557e5c"), tree bersih.
- Commit serve.ts + laporan ini: "Fix serve.ts witnessing round 2: rewrite
  under single recording stage1w" (lihat `git log` untuk hash-nya), push OK.
- Tree bersih sesudah commit; tidak ada seal, submit, atau bundle/check yang
  dijalankan dari sesi ini.
