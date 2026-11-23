# main.ts determinism fix — 23 Nov 2026 (stage1y)

## Penyebab

Round-6 (submission `01a206f3`, HEAD `f0b53dc`) ditolak dengan satu-satunya
cek gagal **run_deterministic**: "The latest grade run on the dev phase
ended nondeterministic." Semua cek lain lolos (run_completes PASS,
transcripts_witnessed PASS, thinking_reproduces 55,2%).

Sumbernya ada di `main.ts` baris 60: dossier.json ditulis dengan
`builtAt: new Date().toISOString()` — stempel waktu dinding yang berubah
di setiap run. Grader menjalankan program dua kali dan membandingkan
hasilnya; dossier.json selalu berbeda, jadi run dinyatakan nondeterministik.

## Perbaikan

`builtAt` dihapus dari objek dossier di `main.ts` (hanya metadata, tidak
dipakai penilai). Tidak ada perilaku lain yang berubah: output tetap dari
`MAKEFUN_OUTPUT_DIR` (atau `ROOT/dist`), `game/` disalin (wajib),
`screenshots/` disalin (opsional), dossier.json ditulis, screenshots kosong
tetap ditolak, nama `--shot` tetap divalidasi, dan `ROOT` tetap dari lokasi
script (perbaikan round-6, tidak diutak-atik).

## Cek sumber nondeterminisme lain

`grep -nE "Date|random|Math.random|fetch|http|setTimeout|Date.now|toISOString|localeCompare" main.ts`
→ hanya baris 60 (`builtAt`) yang cocok. Tidak ada randomness, network
call, atau iterasi tak berurutan; daftar file sudah diurutkan (`.sort()`).

## Bukti dua run identik

Dua run dari `/tmp` (folder kerja beda dari repo — sekaligus regresi
perbaikan round-6), ke dua output dir kosong berbeda:

- `cd /tmp && MAKEFUN_OUTPUT_DIR=/tmp/det-a node <repo>/main.ts` → **exit 0**
- `cd /tmp && MAKEFUN_OUTPUT_DIR=/tmp/det-b node <repo>/main.ts` → **exit 0**
- `diff -r /tmp/det-a /tmp/det-b` → **kosong (byte-identik)**
- `diff /tmp/det-a/dossier.json /tmp/det-b/dossier.json` → **kosong**

Regresi dari repo root:

- `cd <repo> && MAKEFUN_OUTPUT_DIR=/tmp/det-root node main.ts` → **exit 0**
- `diff -r /tmp/det-a /tmp/det-root` → **kosong (byte-identik)**

## Cek output

- Total output 2.333.851 B (~2,2 MiB; batas 64 MiB)
- `game/` 1.768.326 B (~1,7 MiB; batas 48 MiB)
- Screenshot: 142.989 / 200.186 / 139.419 / 82.586 B (masing-masing ≤ 256 KiB)
- `dossier.json` valid JSON, 4 screenshot
  (`01-cover.jpg`, `02-city.jpg`, `03-action.jpg`, `04-features.jpg`),
  tanpa field `builtAt`.

## Commit

`main.ts` + laporan ini, commit dengan pesan
"Fix main.ts run_deterministic: drop wall-clock builtAt from dossier.json".
Hanya kedua file ini yang berubah; `game/` dan `serve.ts` tidak disentuh.
