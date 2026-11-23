# Fix main.ts dossier_matches: use SDK buildDossier — 2026-11-23

## Penyebab (round-7 ditolak)
Submission round-7 (`01a20706`, HEAD `f4f25fb`, 33 recording) ditolak
~13:18 WIB: 30 cek LOLOS SEMUA (27 pass, 3 skip) — transcripts_witnessed
PASS, thinking_reproduces 55,3% authored, run_deterministic TIDAK gagal
lagi — tapi judge `gate_failed` di `dossier_matches` (0/1):
"dossier.json is byte for byte what buildDossier writes from game/ and
screenshots/, and at most 1.5 MiB" (RULES.txt baris 21).

Dossier yang benar berisi Game block + TEKS SUMBER game (semua source
file dalam urutan load, cap 160 KiB). Main.ts lama menulis JSON mini
sendiri `{game, missions, shots, files, caps}` tanpa teks sumber sama
sekali — salah sejak awal, baru ketahuan karena round 1–6 tidak pernah
sampai ke gate.

## Perbaikan
- `vendor/makefun-game.ts`: **sudah ada di repo sejak commit 8bf2914
  (Slice 1) dan byte-identik dengan file kit** — sha256
  `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`
  sama persis dengan
  `kit-level36-new/gta6-01-kit/starter/vendor/makefun-game.ts`.
  Tidak ada perubahan file ini; tidak perlu dibuat ulang.
- `main.ts` ditulis ulang (Write/Edit di bawah recording stage1z):
  import `buildDossier` dari `./vendor/makefun-game.ts`; fungsi
  `buildDossier` custom DIHAPUS sepenuhnya (beserta objek
  `{game, missions, shots, files, caps}` dan komentar builtAt).
  PERTAHANAN: ROOT dari lokasi script (perbaikan round-6,
  `MAKEFUN_BOT_DIR || path.dirname(fileURLToPath(import.meta.url))`,
  tidak diutak-atik), copyTree, parseShots, validasi nama --shot
  terhadap file screenshot, penolakan bila screenshots/ kosong.
  boot() kini menulis dossier.json dengan
  `buildDossier(out, { text_max_bytes: 163840, screenshots:
  { max: 4, max_bytes: 262144 }, game_max_files: 993,
  game_max_bytes: 50331648, game_path_max_bytes: 1000 })` —
  caps referensi scorer sendiri, tidak dilonggarkan.
- Tidak ada file lain yang diubah; `game/` dan `serve.ts` tidak disentuh.

## Bukti verifikasi (semua di bawah recording stage1z, PID 9237)
1. sha256 `vendor/makefun-game.ts` == file kit:
   `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`
   (keduanya).
2. Determinisme (dari /tmp, folder kerja beda dari repo):
   `MAKEFUN_OUTPUT_DIR=/tmp/det2-a node main.ts` → exit 0,
   dossier 922.405 byte;
   `MAKEFUN_OUTPUT_DIR=/tmp/det2-b node main.ts` → exit 0,
   dossier 922.405 byte;
   `diff -r /tmp/det2-a /tmp/det2-b` → KOSONG (byte-identik).
3. Isi dossier `/tmp/det2-a/dossier.json`:
   - 922.405 byte (≤ 1.572.864 = 1,5 MiB).
   - schema `makefun/dossier/v1`, cover 0, 4 images
     (01-cover.jpg, 02-city.jpg, 03-action.jpg, 04-features.jpg).
   - teks 163.834 byte (≤ 163.840): diawali `## Game`
     (Source files: 46, 1.076.678 byte; Vendored files: 1 —
     game/vendor/three.module.min.js; Assets: none; Totals: 50
     files and directories, 1.768.326 byte), lalu `## Sources`
     dengan heading `### game/index.html` dan
     `### game/src/game.js`; diakhiri cut line SDK:
     "[Cut at 163840 bytes: 42 files and 913388 bytes of source
     left out.]"
   - top-level keys HANYA cover, images, schema, text —
     TIDAK ada `builtAt`, TIDAK ada `"missions":`.
4. Regresi dari repo root:
   `MAKEFUN_OUTPUT_DIR=/tmp/det2-root node main.ts` → exit 0,
   `diff -r /tmp/det2-a /tmp/det2-root` → KOSONG.
5. Ukuran output: total 3.255.911 byte (~3,1 MiB, batas 64 MiB);
   game/ 1.768.326 byte (batas 48 MiB); screenshot 142.989 /
   200.186 / 139.419 / 82.586 byte (masing-masing ≤ 256 KiB);
   4 screenshot. buildDossier TIDAK melempar error — tidak ada
   caps yang terlampaui.
6. `git status` sebelum commit: hanya `main.ts` yang berubah
   (vendor/makefun-game.ts sudah identik sejak dulu, jadi tidak
   masuk commit) + laporan ini.
