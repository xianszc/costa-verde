# Screenshot Retakes 11–14 — 23 Nov 2026 (~00:32–00:57 WIB)

Retake of the 4 shots ordered by Xian 23:53 WIB, after builder 90a4d697's
v1/v2 were rejected by Xian twice (00:09 WIB: "cuma ada tampilan HUD" /
"gambar gak jelas"). Script: `/tmp/shot-retakes3.mjs` (v3, saved durably at
`~/workspace/makefun/gta6-01/shot-retakes3.mjs`), run per-shot, each JPG read
and judged visually before moving on. All files 1280×720, JPEG q80, <256 KiB.
Real game only — no mockups, no image edits, no debug overlays.

## Method

- Play mode (`startPlay()`), staged positions, wanted level set, chase poll
  (500 ms, cruiser in 5–25 m band behind the car), rAF freeze, custom camera,
  `frameStats` flat-check gate (reject if >60% of pixels share one quantized
  colour — no final shot tripped it), screenshot.
- Staging disclosure: `hideStuckToast` (`#side-toast` hidden via evaluate)
  ran in every shot; in all four final frames the toast was already absent,
  so nothing was hidden. The centre toast visible in shots 11/12 ("Guard
  rammed you — hull damaged") is a live gameplay notification from the
  cruiser ramming the player — it was NOT edited out.
- Recorder `01a20450` (stage1o) alive for the whole run; HEAD `38560f7`
  (map THE BAY label fix) unchanged — no game code touched.

## Results

| # | File | Size | Lum | Calls | Staging |
|---|------|------|-----|-------|---------|
| 11 | `11-drama-chase-low.jpg` | 157,925 B (154.2 KiB) | 129 | 402 | CBD avenue, midday 12:12, wanted 4, FOV 80 (11B) |
| 12 | `12-chase-noncbd.jpg` | 132,803 B (129.7 KiB) | 140 | 169 | Commercial ring east, midday 12:16, wanted 4 |
| 13 | `13-night-shootout-heli.jpg` | 121,953 B (119.1 KiB) | 68 | 260 | Boulevard east, night 22:11, wanted 4, on foot |
| 14 | `14-minimap-missions.jpg` | 96,298 B (94.0 KiB) | 84 | 204 | Full-screen map, J4 waypoint selected |

### 11 — drama chase, low cam (CBD avenue, midday)
Kept variant **11B** (FOV 80, camera 18u back, tilted up). Avenue canyon with
tall towers both sides, heli silhouette visible at the top of the frame,
full HUD, dispatch shows Anchor-2 CRUISER + Vespa-1 PURSUIT + Gull-1 HELI
INBOUND, traffic (yellow taxi), shop signs (CAFÉ, OROLOGERIA), red traffic
lights. **Kritik jujur:** mobil hero (Stella oranye) kecil dan sebagian
tertutup taksi kuning di run restore; cruiser tidak terbaca jelas sebagai
kendaraan polisi (hanya lewat panel dispatch); tidak ada pejalan kaki yang
terlihat di trotoar. Varian lain yang dicoba dan DITOLAK: 11A (mobil besar
tapi tertutup planter median + satu pejalan raksasa di depan kamera),
11C (kamera x=3.0 ternyata di zona furnitur trotoar — planter + dinding
putih memenuhi foreground, mobil tertutup mobil biru). Cap 3 retake
tercapai; 11B di-restore dengan satu run ulang (bukan varian baru).

### 12 — police chase, non-CBD (commercial ring east, midday)
Hero car (Stella oranye) besar dari belakang di tengah jalan komersial:
toko TABACCHI, kafe dengan meja merah, gedung mid-rise, menara di kejauhan,
HUD lengkap, dispatch Anchor-2 CRUISER 15m PURSUIT + Vespa-1 2m PURSUIT,
health 70 (sudah ditabrak). Cruiser biru gelap terlihat di kiri mobil hero
(7,9 m, hasil poll `closeD: 10`). **Kritik jujur:** satu mobil traffic
gelap menempel di pojok kanan-bawah frame (blob besar, sebagian terpotong);
tidak ada pejalan kaki terlihat (dua peds yang ditempatkan tertutup mobil
traffic). Versi pertama (tanpa closeD) lebih bersih komposisinya tapi
cruiser sama sekali tidak terlihat — retake ini dipilih karena kejarannya
benar-benar kelihatan.

### 13 — night shootout, heli (boulevard east, ~22:00)
Kept variant **13B**. Jalan boulevard malam yang terbaca: marking zebra +
garis lajur, mobil merah, pemain on-foot berdiri di tengah jalan dengan
crosshair (baru menembak), lampu jalan menyala, jendela menyala di menara
ujung jalan, lampu hijau, HUD lengkap, dispatch pursuit aktif. Brightness
rata-rata **68** (lebih gelap dari night candidates 76–91, tapi jalan/mobil/
marking tetap terbaca). **Kritik jujur:** mesh heli TIDAK masuk frame —
hanya lewat dispatch "Gull-1 · HELI 60m INBOUND"; tidak ada kerucut
spotlight yang terlihat (spotlight heli adalah SpotLight tanpa mesh beam,
jadi hanya pool cahaya di tanah yang bisa terlihat — tidak distinct di
frame ini); tidak ada muzzle flash yang tertangkap; cruiser tidak terbaca
jelas. Varian 13 pertama DITOLAK: kamera (24,9,12) tertutup gedung tinggi
(~60% frame adalah satu fasad).

### 14 — minimap with mission info
Full-screen "CHART OF PORTO AZZURA": grid jalan, label distrik (FORTRESS
OLD TOWN, DOWNTOWN SKYLINE, BOULEVARD, THE BAY, SEASIDE PROMENADE, YACHT
MARINA), nama jalan, marker koin/job/jump, panah pemain di boulevard.
**Label THE BAY utuh di tengah-atas teluk — flaw 09 (label "THE F…" terpotong)
SUDAH TERPERBAIKI oleh `38560f7`.** Panel kanan Waypoints lengkap (3 toko +
4 misi + 4 race + 2 jump); footer "Waypoint: THE FERRYMAN'S CRATE — 23 m
away. Follow the gold diamond. · Jobs 0/4 · Races 0/4 · Jumps 0/8 ·
Coins 0/20". `mapCheck.bad = []` (tidak ada label/button overflow).
**Kritik jujur:** label tengah agak berdesakan (DOWNTOWN SKYLINE menumpuk
teks di bawahnya); daftar Waypoints berscroll (terpotong di bawah "West
Gate"); jam game 19:53 (bukan midday — map dibuka apa adanya).

## Changes made to the staging script during this run

(All in `/tmp/shot-retakes3.mjs`, saved back to
`~/workspace/makefun/gta6-01/shot-retakes3.mjs` so the next swap doesn't
lose them; the repo itself was not touched.)
- `11C`: car in the right lane (x=1, off the median planters), camera
  (3.0, 2.6, -13) — REJECTED (camera inside the sidewalk-furniture zone).
- `13B`: camera on the boulevard (18, 2.5, 1.5) looking east — KEPT.
- `closeD` option on `waitForChaseBand` (good-unit max distance, passed as
  an evaluate arg — never a Node-side variable inside `page.evaluate`);
  shot 12 uses `closeD: 10` so the poll waits until the cruiser is close.
- Shot 14 fix: `[data-wp="job:J4"]` is an **SVG element — `SVGElement` has
  no `.click()` in Chromium**; the J4 selection now uses
  `dispatchEvent(new MouseEvent('click', ...))`. First 14 run failed both
  attempts on this; fixed run saved cleanly.

## Still open (honest)

- **Heli mesh never appears in a low-cam frame at FOV 55** (11A/11C/13):
  the heli orbits at y=24; only the FOV-80 variant (11B) fits it, at the
  cost of a small hero car. In 11 the heli IS visible (silhouette, top of
  frame); in 13 it is dispatch-only.
- **Placed peds are not visible in any of the four shots.** They are set
  after freeze and do stick (11A proved it with one oversized figure), but
  in 11B/12/13B they end up occluded by traffic, trees, or buildings, or
  too small to read. The "sidewalk ramai NPC" part of the brief is not met.
- **Cruiser readability is weak in 11 and 13** (dispatch-only in 13,
  ambiguous dark car in 11); only 12 shows a cruiser clearly next to the
  hero car.
- The previous builder's root-cause notes hold: cruisers approach from the
  west cross-street (11: ≈(-8,-24.5)) and from the north (12/13), never
  straight behind the hero car on its own road — that is why "chaser right
  behind the hero car" framings keep failing.
