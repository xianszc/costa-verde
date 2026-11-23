# Bundle Final-2 — 23 Nov 2026 (HEAD 9557e5c)

Bundle + check ulang setelah serve.ts ditulis ulang dari nol (commit 3028e71)
dan laporan rewrite (9557e5c), menyusul penolakan submit round-2 pada
transcripts_witnessed untuk serve.ts. Kit level-36.

## Hasil

- **Check: exit 0 — 14 passed, 0 failed, 7 skipped, 5 checked at submission.**
- **Bundle: exit 0.**
- Snapshot: 316 files, 33,592,646 bytes @
  9557e5c0f463299d5ee31a491599e65db4235468 (precheck6: 314 files, 33,578,753 B).
- **Authored: 54.8% (20,724 / 37,761 counted lines)** — di atas syarat 30%
  (precheck6: 54.6%, 20,518/37,558). 280 copied, 0 pasted, 12,180 read,
  4,577 absent; 285 kit starter lines dikecualikan.
- **Unwritten: 16.6% (6,247 / 37,599)** — di bawah batas 40%
  (precheck6: 16.6%, 6,245/37,396).
- **Entrypoint main.ts: 55 authored lines** (sama seperti precheck6).
- **thinking_priced: 137 usage records**, tiap-tiap priced ke model yang
  dikenal (precheck6: 107).
- transcripts_present: 117 agent sessions parsed (117 muse-app);
  transcripts_recorded: semua session adalah log yang direkam harness
  (precheck6: 115).
- thinking_revised: game/src/game.js mengambil konten finalnya dari 119
  pesan yang menulis/mengeditnya (main.ts dari 3).
- thinking_own_work: 20,724 baris adalah tulisan agent sendiri; 0 baris
  duduk di run dari file entry lain, 0 dari download.

## Yang di-bundle

- Clone: /tmp/precheck7 @ 9557e5c0f463299d5ee31a491599e65db4235468.
- Session files: **103 unik** dari **29 recording sealed** (28 round-2 +
  stage1u 01a206c3-944a-730f-ad4a-974930be7232). 104 nama di receipt, 1
  duplikat (6e81d7bb ada di dua receipt — sama seperti precheck3/4/6).
  0 hilang di disk. Bundle menambahkan sendiri sampai 117 session total
  (read sources, maks 16).
- Usage: /tmp/precheck7-usage.jsonl — **316 baris** dari semua file
  ~/.makefun/muse-usage-costa-verde-*.jsonl (precheck6: 270 baris c..s;
  +16 stage1t, +1 stage1u, +29 dari file-file stage lain yang ikut
  ter-glob). Satu objek JSON per baris, keys sorted.
- Prompt: /tmp/precheck7-prompt.txt (salinan /tmp/precheck6-prompt.txt),
  --prompt-origin typed (sama seperti precheck3/4/6).
- Bundle: /home/hatch/workspace/makefun/gta6-01/precheck7-bundle.tar.gz
  (**60,148,703 bytes, sha256
  6881874673147d60f7d0bc784559657c04dee976bde1b2a94776e72809bd04e4**).
  Lebih besar dari precheck6 (35,774,406 B) karena 117 session dan
  session-session yang membesar.
- Perintah bundle: `node cli/makefun.mjs bundle --repo /tmp/precheck7
  --out <path di atas> --session <file> (x103) --muse-usage
  /tmp/precheck7-usage.jsonl --system-prompt
  ~/workspace/system/system_prompt.md --prompt-file
  /tmp/precheck7-prompt.txt --prompt-origin typed --harness Muse
  --harness-version 1.3 --provider meta --model muse-spark-1.3
  --effort default --instructions none --mcp
  'playwright=stdio:npx @playwright/mcp@latest'` (skrip: /tmp/run-bundle7.sh).
- Perintah check: `node cli/makefun.mjs check --repo /tmp/precheck7
  --commit HEAD --transcripts
  /home/hatch/workspace/makefun/gta6-01/precheck7-bundle.tar.gz`
  (persis bentuk precheck6, tanpa --instructions).

## Insiden: ENOSPC pada percobaan pertama

Percobaan bundle pertama gagal: `makefun bundle: ENOSPC: no space left on
device, write` saat packing (tar.gz parsial 13 MB). /tmp waktu itu 262 MB
kosong; staging redaksi 117 session (session store total ~280 MB yang
dicari bundle) tidak muat di tmpfs 512 MB bersama clone 95 MB +
transcript 90 MB. Perbaikan: hapus dua snapshot leaderboard /tmp
(lb-gta6-01-now.json + lb-gta6-01-now2.json, 30 MB tiap-tiap — data
ephemeral, standings sudah tercatat di rank-state.json) + tar.gz parsial,
lalu pindahkan staging (TMPDIR) dan output bundle ke workspace
(/home/hatch, 145 GB kosong). Percobaan kedua exit 0. Pelajaran: bundle
berikutnya langsung pakai TMPDIR workspace + output workspace; jangan
andalkan /tmp untuk staging.

## Warning bundle (bukan penolakan, kelas yang sama seperti precheck3–6)

- 0 usage rows untuk 42 dari 117 session (precheck6: 70 dari 115) — usage
  session-session itu tidak terhitung. Angka ini membaik karena merged
  usage sekarang 316 baris.
- Beberapa session dipotong ke turn yang menulis file yang dibaca build
  dari luar repo (peringatan biasa, sama seperti sebelumnya).

## Perubahan sejak precheck6 (994ae13..9557e5c)

- 2 files changed, 63 insertions(+), 9 deletions(-):
  - serve.ts: 13 insertions(+), 9 deletions(-) — ditulis ulang dari nol
    (3028e71).
  - reports/serve-ts-rewrite-2026-11-23.md: 50 insertions(+).

## Langkah berikutnya (untuk parent, bukan builder ini)

1. Isi usage stage1v, seal stage1v.
2. Submit ulang dengan 30 recording (29 di atas + stage1v) pada HEAD
   terbaru (HEAD ini + commit laporan ini), memakai flag submit yang
   terbukti (prompt "Pelajari project ini make.fun", --prompt-origin
   other, --prompt-via "the user's opening instruction in the main
   chat", --effort default, --mcp penuh, tanpa --muse-usage dan tanpa
   --instructions none).
3. Catatan: transcripts_witnessed tetap hanya bisa dicek situs — check
   lokal di atas tidak mengujinya.
