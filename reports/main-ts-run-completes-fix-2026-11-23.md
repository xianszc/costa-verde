# main.ts run_completes fix — 23 Nov 2026

## Penyebab (round-5, sub 01a206e5)

Round-5 ditolak 23 Nov ~12:45 WIB: 27/31 cek lolos, 1 gagal —
`run_completes`. Grader menjalankan `node /bot/main.ts` (node22, tanpa
network, FS read-only, repo di /bot, /output kosong writable, 10 dtk)
dan program exit code 1. Grader tidak menampilkan stdout/stderr.

Akar masalah: `main.ts` memakai `const ROOT = process.cwd()` sebagai
lokasi repo. Grader menjalankan main.ts dari folder kerja yang BUKAN
/bot (default container `/`), sehingga main.ts mencari `/game` dan
gagal. Reproduksi lokal (sebelum perbaikan), dari /tmp:

```
$ cd /tmp && MAKEFUN_OUTPUT_DIR=/tmp/out-test node <repo>/main.ts
[main] boot failed: missing required tree: /tmp/game
exit=1
```

Lokal selalu lolos selama ini karena main.ts selalu dijalankan dari
dalam repo root — `process.cwd()` kebetulan benar.

## Perbaikan (main.ts saja)

Lokasi repo diambil dari lokasi file main.ts sendiri, bukan folder
kerja:

```ts
import { fileURLToPath } from 'node:url';
const ROOT = process.env.MAKEFUN_BOT_DIR || path.dirname(fileURLToPath(import.meta.url));
```

Grader menyetel `MAKEFUN_BOT_DIR=/bot`, jadi itu menang bila ada;
fallback lokasi script menutupi run lokal dari mana saja. Perilaku
lain TIDAK berubah: output dari `MAKEFUN_OUTPUT_DIR` (atau
`ROOT/dist`), salin `game/` (wajib) + `screenshots/` (opsional), tulis
`dossier.json`, tolak screenshots kosong, validasi nama `--shot`.

## Verifikasi (cara grader — ketiganya HARUS exit 0)

Semua run memakai `MAKEFUN_OUTPUT_DIR` terpisah dan menghasilkan
`dossier.json` valid + `game/` + `screenshots/` tersalin. Total output
2,4 MiB (batas 64 MiB), `game/` 1,8 MiB (batas 48 MiB), tiap
screenshot ≤ 256 KiB (142.989 / 200.186 / 139.419 / 82.586 B).

| Run | Perintah | Exit | Hasil |
|-----|----------|------|-------|
| (a) dari /tmp (mode gagalnya) | `cd /tmp && MAKEFUN_OUTPUT_DIR=/tmp/out-test-x node <repo>/main.ts` | **0** | dossier 4 screenshot (`01-cover.jpg`, `02-city.jpg`, `03-action.jpg`, `04-features.jpg`), game/ + screenshots/ tersalin |
| (b) dari / | `cd / && MAKEFUN_OUTPUT_DIR=/tmp/out-test-rootfs node <repo>/main.ts` | **0** | sama — dossier 4 screenshot, game/ + screenshots/ tersalin |
| (c) dari repo root (regresi) | `cd <repo> && MAKEFUN_OUTPUT_DIR=/tmp/out-test-root node main.ts` | **0** | sama — dossier 4 screenshot, game/ + screenshots/ tersalin |

Tambahan: override `MAKEFUN_BOT_DIR=<repo>` dari /tmp → exit 0
(jalur yang dipakai grader). `game/` identik di semua run; dossier
hanya berbeda di `builtAt` (wajar).

## Commit

`main.ts` + laporan ini, pesan: "Fix main.ts run_completes: resolve
repo root from script location, not process.cwd()". Tidak ada file lain
yang diubah; `game/` dan `serve.ts` tidak disentuh.
