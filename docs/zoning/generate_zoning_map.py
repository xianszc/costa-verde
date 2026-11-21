#!/usr/bin/env python3
"""PORTO AZZURA — top-down zoning plan diagram (Xian's step 1, for approval).

Generates docs/zoning/zoning-map.png from the zoning data below. The numbers
printed here are the SAME numbers in docs/zoning/zoning-plan.md — one source
of truth, so the diagram and the table can never drift apart.

Map coordinates are game units: x east, z north (up on the diagram).
Land: x -120..120, z -110..35. Bay water: z > 35. Lighthouse headland
juts into the bay at the north-west.
"""
import math
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- zoning data
# (name, x0, x1, z0, z1, fill, label, height_range, blocks, buildings)
ZONES = [
    # (x0, x1, z0, z1) — z0 = south edge, z1 = north edge
    ("CBD core", -40, 40, -35, 20, "#e8a83a", "20–60 floors", 32, 42),
    ("Commercial ring", -80, 80, -70, 35, "#e08a52", "6–15 floors", 62, 186),
    ("Residential ring", -115, 115, -105, 35, "#b5c48a", "2–6 floors", 78, 260),
    ("Promenade + casino", 10, 80, 20, 35, "#e08aa8", "3–14 floors", 8, 22),
    ("Fortress old town", -80, -45, -70, -35, "#c08a3e", "2–4 floors", 9, 48),
    ("Marina + harbor", -40, 20, 28, 35, "#5b9ab5", "1–3 floors", 2, 12),
    ("Funicular hills", -60, 60, -105, -75, "#8fb573", "2–4 floors", 18, 70),
    ("Cliff villas W", -115, -95, -80, -20, "#c8d8a8", "1–3 floors", 7, 18),
    ("Cliff villas E", 95, 115, -80, -20, "#c8d8a8", "1–3 floors", 7, 18),
    ("Olive grove + quarry", -120, -115, -110, 35, "#d3c194", "1–2 floors", 3, 7),
    ("Olive grove + quarry E", 115, 120, -110, 35, "#d3c194", "1–2 floors", 3, 7),
    ("Outer south strip", -115, 115, -110, -105, "#d3c194", "1–2 floors", 0, 0),
]
# Lighthouse headland (land in the bay, not part of the land grid above)
LIGHTHOUSE = (-120, -95, 30, 55, "#a8a8a8", "1–6 floors", 1, 3)

# Height-by-distance curve: floors(r) = clamp(round(60*exp(-r/25)+1) ±15%, 1, 60)
# r = distance in map units from the CBD centre (0, -10).
def floors_at(r):
    return max(1, min(60, round(60 * math.exp(-r / 25.0) + 1)))

# ------------------------------------------------------------------ canvas
W, H = 1280, 1000
IMG_BG = "#f7f2e8"
LAND = "#efe3c8"
WATER = "#6fa8bf"
INK = "#2b2b2b"
ROAD_AVE = "#5a5148"
ROAD_ST = "#9a8f82"

# Map window: game x -125..125, z -115..115 -> pixels
OX, OY, S = 40, 70, 3.8
X0, X1, Z0, Z1 = -125, 125, -115, 115

def px(x):
    return OX + (x - X0) * S

def py(z):
    return OY + (Z1 - z) * S  # +z (north) is up

def font(size, bold=False):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
                 else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

img = Image.new("RGB", (W, H), IMG_BG)
d = ImageDraw.Draw(img)

# Title bar
d.rectangle([0, 0, W, 56], fill=INK)
d.text((24, 10), "PORTO AZZURA  —  ZONING PLAN", font=font(26, True), fill="#f2a541")
d.text((24, 38), "Azzura Heist · gta6-01 · top-down · north up · 1 grid square = 20 map units",
       font=font(13), fill="#e8ddc4")

# Map frame + land
d.rectangle([px(X0), py(Z1), px(X1), py(Z0)], fill=LAND, outline=INK, width=2)

# Bay water (north, z > 35) — straight shoreline with a gentle curve drawn
# as a shallow arc so it reads as a coast, not a ruler edge.
water_poly = [(px(X0), py(Z1))]
for x in range(X0, X1 + 1, 10):
    # shoreline dips south (toward land) near the marina, bulges north at the ends
    shore = 35 - 3 * math.cos((x + 20) / 60.0)
    water_poly.append((px(x), py(shore)))
water_poly += [(px(X1), py(Z1))]
d.polygon(water_poly, fill=WATER)
d.text((px(-60), py(92)), "BAY OF AZZURA", font=font(20, True), fill="#ffffff")
d.text((px(-60), py(80)), "harbor water · moorings · ferry lane", font=font(12), fill="#eaf4f7")

# Lighthouse headland (land jutting into the bay, north-west)
hx0, hx1, hz0, hz1 = LIGHTHOUSE[0], LIGHTHOUSE[1], LIGHTHOUSE[2], LIGHTHOUSE[3]
d.rectangle([px(hx0), py(hz1), px(hx1), py(hz0)], fill=LIGHTHOUSE[4],
            outline="#6f6f6f", width=2)
d.text((px(-118), py(44)), "LIGHTHOUSE\nPOINT", font=font(12, True), fill="#3a3a3a")

# Zone fills — draw big rings first, then the sub-areas on top.
order = ["Residential ring", "Commercial ring", "CBD core",
         "Outer south strip", "Olive grove + quarry", "Olive grove + quarry E",
         "Funicular hills", "Cliff villas W", "Cliff villas E",
         "Fortress old town", "Promenade + casino", "Marina + harbor"]
by_name = {z[0]: z for z in ZONES}
for name in order:
    _, x0, x1, z0, z1, fill, _, _, _ = by_name[name]
    d.rectangle([px(x0), py(z1), px(x1), py(z0)], fill=fill, outline="#7a6a55", width=1)

# Block grid (side streets, 20-unit spacing) clipped to the land
for gx in range(-100, 121, 20):
    d.line([(px(gx), py(35)), (px(gx), py(-105))], fill=ROAD_ST, width=1)
for gz in range(-100, 31, 20):
    d.line([(px(-115), py(gz)), (px(115), py(gz))], fill=ROAD_ST, width=1)

# Avenues (thicker) — the tidy grid
def avenue_h(z, x0, x1, w=5):
    d.line([(px(x0), py(z)), (px(x1), py(z))], fill=ROAD_AVE, width=w)

def avenue_v(x, z0, z1, w=5):
    d.line([(px(x), py(z0)), (px(x), py(z1))], fill=ROAD_AVE, width=w)

avenue_h(-10, -80, 80)          # main boulevard (east-west spine, through the CBD)
avenue_h(28, -80, 80)           # waterfront boulevard
avenue_h(0, -115, 115)          # mid avenue
avenue_h(-70, -115, 115)        # south ring avenue
avenue_h(-40, -115, 115)        # inner south avenue
avenue_v(0, -70, 35)            # CBD north-south avenue
avenue_v(-60, -105, 35)         # west avenue
avenue_v(60, -105, 35)          # east avenue
avenue_v(-20, -70, 35)          # CBD west avenue
avenue_v(20, -70, 35)           # CBD east avenue
# Ring road around the CBD core
d.rectangle([px(-45), py(25), px(45), py(-40)], outline=ROAD_AVE, width=4)
# Funicular line (dashed) up the hills, south of the residential ring
for i, zz in enumerate(range(-75, -106, -6)):
    d.line([(px(-2), py(zz)), (px(2), py(zz - 3))], fill="#4a6b3a", width=3)
d.text((px(6), py(-92)), "funicular", font=font(11, True), fill="#3a5a2e")
# Elevated road + monorail through the CBD core (double line, gold)
d.line([(px(-40), py(8)), (px(40), py(8))], fill="#8a6d1f", width=4)
d.line([(px(-40), py(11)), (px(40), py(11))], fill="#c9a227", width=2)
d.text((px(-38), py(24)), "elevated road + monorail", font=font(11, True), fill="#6b5518", anchor="lm")

# CBD towers — 34 footprints on a 10-unit grid, tallest (darkest) at centre
towers = []
for gx in range(-35, 36, 10):
    for gz in range(-30, 21, 10):
        if abs(gx) > 35 or abs(gz + 10) > 28:
            continue
        r = math.hypot(gx, gz + 10)
        fl = floors_at(r)
        towers.append((gx, gz, fl))
towers.sort(key=lambda t: -t[2])
towers = towers[:34]
for gx, gz, fl in towers:
    shade = 255 - int(140 * fl / 60.0)
    col = (60, 60 + shade // 4, 80 + shade // 2)
    half = 2.2 + fl / 60.0 * 1.6
    d.rectangle([px(gx - half), py(gz + half), px(gx + half), py(gz - half)],
                fill=col, outline="#f2a541", width=1)
# (Tallest tower = Azzura Tower, 60 floors, at the CBD centre — marked by the
# tower_lobby anchor dot below; no on-map text, the towers speak for themselves.)

# Zone labels
def label(x, z, text, size=15, color="#2b2b2b", anchor="mm"):
    d.text((px(x), py(z)), text, font=font(size, True), fill=color, anchor=anchor)

label(0, -18, "CBD CORE", 20)
label(0, -26, "Downtown Bay Skyline · 30+ towers", 11)
label(28, -52, "COMMERCIAL RING", 15)
label(28, -60, "shops · hotels · offices · markets", 11)
label(-88, 10, "RESIDENTIAL\nRING", 14)
label(95, -62, "RESIDENTIAL\nRING", 14)
label(-62, -52, "FORTRESS\nOLD TOWN", 13)
label(45, 27, "PROMENADE + CASINO", 13)
# (Marina strip is marked by the harbormaster anchor dot; no zone text — the
# strip is only 7 units tall and the label collided with the anchor.)
label(0, -88, "FUNICULAR HILLS", 13)
label(-105, -50, "CLIFF\nVILLAS", 12)
label(105, -50, "CLIFF\nVILLAS", 12)
label(-117, -40, "OLIVE\nGROVE", 10)
label(117, -95, "QUARRY", 10)

# Key anchor markers (where the named anchors land in the new city).
# place: "r" = label right of the dot, "l" = left, "b" = below.
anchors = [
    ("tower_lobby", 0, -8, "Azzura Tower lobby", "r"),
    ("casino_entrance", 45, 22, "casino entrance", "b"),
    ("casino_forecourt", 45, 30, "casino forecourt", "r"),
    ("fortress_plaza", -62, -52, "fortress plaza", "r"),
    ("harbormaster_pavilion", -10, 31, "harbormaster pavilion", "r"),
    ("race_start_1", -30, -10, "race start 1", "l"),
    ("player_spawn", -2, -14, "player spawn", "b"),
    ("skyline_plaza", 0, 12, "central plaza", "r"),
]
for name, ax, az, lab, place in anchors:
    d.ellipse([px(ax) - 4, py(az) - 4, px(ax) + 4, py(az) + 4],
              fill="#ffffff", outline=INK, width=2)
    if place == "r":
        d.text((px(ax) + 6, py(az)), lab, font=font(10), fill="#2b2b2b", anchor="lm")
    elif place == "l":
        d.text((px(ax) - 6, py(az)), lab, font=font(10), fill="#2b2b2b", anchor="rm")
    else:
        d.text((px(ax), py(az) + 7), lab, font=font(10), fill="#2b2b2b", anchor="mt")

# North arrow + scale bar
d.polygon([(px(112), py(108)), (px(108), py(98)), (px(116), py(98))], fill=INK)
d.text((px(112), py(94)), "N", font=font(16, True), fill=INK, anchor="mm")
sb_y = py(-108)
d.line([(px(-115), sb_y), (px(-15), sb_y)], fill=INK, width=3)
for i, v in enumerate((0, 50, 100)):
    d.line([(px(-115 + i * 50), sb_y - 5), (px(-115 + i * 50), sb_y + 5)],
           fill=INK, width=2)
    d.text((px(-115 + i * 50), sb_y + 10), str(v), font=font(11, True),
           fill=INK, anchor="ma")
d.text((px(35), sb_y - 16), "100 map units", font=font(11, True), fill=INK)

# Legend (right column)
lx, ly = 1010, 70
d.text((lx, ly), "LEGEND", font=font(16, True), fill=INK)
ly += 28
legend = [
    ("#e8a83a", "1  CBD core — 20–60 fl"),
    ("#e08a52", "2  Commercial ring — 6–15 fl"),
    ("#b5c48a", "3  Residential ring — 2–6 fl"),
    ("#e08aa8", "Promenade + casino"),
    ("#c08a3e", "Fortress old town"),
    ("#5b9ab5", "Marina + harbor"),
    ("#8fb573", "Funicular hills"),
    ("#c8d8a8", "Cliff villas"),
    ("#d3c194", "Olive grove + quarry"),
    ("#a8a8a8", "Lighthouse point"),
    ("#6fa8bf", "Bay water"),
]
for col, txt in legend:
    d.rectangle([lx, ly, lx + 18, ly + 14], fill=col, outline=INK, width=1)
    d.text((lx + 24, ly - 1), txt, font=font(12), fill=INK)
    ly += 22
ly += 8
d.line([(lx, ly), (lx + 230, ly)], fill="#b0a890", width=1)
ly += 10
d.text((lx, ly), "Height curve (floors vs distance r", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "from CBD centre):", font=font(12, True), fill=INK)
ly += 20
d.text((lx, ly), "floors = 60·e^(−r/25) + 1, ±15%,", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "clamped 1–60. Centre 40–60,", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "edge 20–40, commercial 6–15,", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "residential 2–6, outskirts 1–3.", font=font(12), fill=INK)
ly += 26
d.text((lx, ly), "Roads: thick = avenues,", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "thin = side streets (block grid).", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "Gold double line = elevated", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "road + monorail (CBD core).", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "White dots = named anchors", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "(where missions land).", font=font(12), fill=INK)
ly += 26
d.text((lx, ly), "Draw-call target: < 600", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "in the worst view.", font=font(12), fill=INK)

img.save("docs/zoning/zoning-map.png", optimize=True)
print("saved docs/zoning/zoning-map.png")

# ------------------------------------------------------------- numbers table
# Zones are NESTED rings, so the table uses EXCLUSIVE areas (a ring's area
# minus the zones it contains). Sub-areas are listed as "of which" rows and
# are NOT added to the total again.
def rect_area(x0, x1, z0, z1):
    return (x1 - x0) * (z1 - z0)

cbd = rect_area(-40, 40, -35, 20)                       # 4,400
comm_rect = rect_area(-80, 80, -70, 35)                 # 16,800
comm = comm_rect - cbd - rect_area(-40, 20, 28, 35)     # minus CBD + marina
resi_rect = rect_area(-115, 115, -105, 35)              # 32,200
resi = resi_rect - comm_rect                           # minus commercial rect
marina = rect_area(-40, 20, 28, 35)                     # 420
light = (LIGHTHOUSE[1] - LIGHTHOUSE[0]) * (LIGHTHOUSE[3] - LIGHTHOUSE[2])
olive = (rect_area(-120, -115, -110, 35) + rect_area(115, 120, -110, 35)
         + rect_area(-115, 115, -110, -105))            # 2,600

print("\nZONE TABLE — exclusive areas (map units^2; sub-areas are 'of which')")
rows = [
    ("1  CBD core", cbd, 32, 42, "20–60 floors"),
    ("2  Commercial ring", comm, 62, 186, "6–15 floors"),
    ("   of which: Promenade + casino", 1050, 8, 22, "3–14 floors"),
    ("   of which: Fortress old town", 1225, 9, 48, "2–4 floors"),
    ("   of which: general commercial", comm - 1050 - 1225, 45, 116, "6–15 floors"),
    ("3  Residential ring", resi, 78, 260, "2–6 floors"),
    ("   of which: Funicular hills", 3600, 18, 70, "2–4 floors"),
    ("   of which: Cliff villas", 2400, 14, 36, "1–3 floors"),
    ("   of which: general residential", resi - 3600 - 2400, 46, 154, "2–6 floors"),
    ("4  Marina + harbor", marina, 2, 12, "1–3 floors"),
    ("4  Lighthouse point", light, 1, 3, "1–6 floors"),
    ("4  Olive grove + quarry", olive, 6, 14, "1–2 floors"),
]
total_a = cbd + comm + resi + marina + light + olive
total_b = 32 + 62 + 78 + 2 + 1 + 6
total_n = 42 + 186 + 260 + 12 + 3 + 14
for name, a, blocks, bldg, hr in rows:
    print(f"{name:34s} area {a:6d}  blocks {blocks:3d}  buildings {bldg:3d}  {hr}")
print(f"{'TOTAL (land incl. headland)':34s} area {total_a:6d}  blocks {total_b:3d}  buildings {total_n:3d}")
print("\nHeight curve check:")
for r in (0, 10, 20, 30, 40, 60, 80, 100, 120):
    print(f"  r={r:3d} -> {floors_at(r):2d} floors")
print("\nCBD towers drawn:", len(towers))
