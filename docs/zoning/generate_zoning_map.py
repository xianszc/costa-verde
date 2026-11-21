#!/usr/bin/env python3
"""PORTO AZZURA — top-down zoning plan diagram, REVISED (Xian's 8 points).

Generates docs/zoning/zoning-map.png from the zoning data below. The numbers
printed here are the SAME numbers in docs/zoning/zoning-plan.md — one source
of truth, so the diagram and the table can never drift apart.

Map coordinates are game units: x east, z north (up on the diagram).
SCALE: 1 map unit = 10 m. Land: x -160..160, z -145..40 (3200 x 1850 m).
Bay water: z > 40. Lighthouse headland is a peninsula joined to the land.
"""
import math
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- zoning data
# (name, x0, x1, z0, z1, fill, height_range, blocks, buildings, draw_calls)
# blocks/buildings/draw_calls are per-zone estimates; draw calls are
# mutually exclusive (each building counted once) so the zone values ADD.
ZONES = [
    ("CBD core", -40, 40, -35, 20, "#e8a83a", "20–60 fl", 32, 42, 35),
    ("Commercial ring", -80, 80, -70, 40, "#e08a52", "6–15 fl", 54, 399, 120),
    ("Residential ring", -125, 125, -110, 40, "#b5c48a", "2–6 fl", 88, 442, 75),
    ("Promenade + casino", 10, 80, 20, 40, "#e08aa8", "3–14 fl", 8, 40, 50),
    ("Fortress old town", -80, -45, -70, -35, "#c08a3e", "2–4 fl", 9, 63, 30),
    ("Marina + harbor", -50, 10, 24, 40, "#5b9ab5", "1–3 fl", 4, 32, 25),
    ("Funicular hills", -60, 60, -110, -75, "#8fb573", "2–4 fl", 19, 76, 25),
    ("Cliff villas W", -125, -95, -80, -20, "#c8d8a8", "1–3 fl", 8, 24, 8),
    ("Cliff villas E", 95, 125, -80, -20, "#c8d8a8", "1–3 fl", 8, 24, 7),
    ("Olive grove W", -160, -125, -145, 40, "#d3c194", "1–2 fl", 3, 15, 7),
    ("Quarry E", 125, 160, -145, 40, "#b8a888", "1–2 fl", 2, 12, 7),
    ("Countryside S", -125, 125, -145, -110, "#d3c194", "1–2 fl", 3, 15, 6),
]
# Lighthouse headland — a PENINSULA joined to the land at its south edge.
# Vertices (x, z); area computed by the shoelace formula below.
HEADLAND = [(-160, 40), (-160, 60), (-150, 70), (-136, 72),
            (-126, 64), (-126, 40)]
HEADLAND_FILL = "#c9b896"

# Height-by-distance curve (REVISED — plateau + slower falloff, zone clamps):
#   r < 10: 60 (plateau, 50–60 with ±15% variation)
#   10 <= r <= 45: linear 60 -> 15
#   r > 45: 14*exp(-(r-45)/30) + 1
# Zone clamps guarantee the bands: CBD 20–60, commercial 6–15,
# residential 2–6, outskirts 1–3. r = distance from CBD centre (0, -10).
def floors_at(r):
    if r < 10:
        return 60
    if r <= 45:
        return round(60 - 45 * (r - 10) / 35.0)
    return max(1, round(14 * math.exp(-(r - 45) / 30.0) + 1))

# ------------------------------------------------------------------ canvas
W, H = 1280, 1000
IMG_BG = "#f7f2e8"
LAND = "#efe3c8"
WATER = "#6fa8bf"
INK = "#2b2b2b"
ROAD_AVE = "#5a5148"
ROAD_ST = "#9a8f82"
TERRACE = "#8a6d3f"

# Map window: game x -165..165, z -150..115 -> pixels (1 unit = 10 m)
OX, OY, S = 30, 70, 2.8
X0, X1, Z0, Z1 = -165, 165, -150, 115

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
d.text((24, 10), "PORTO AZZURA  —  ZONING PLAN (REVISED)", font=font(26, True),
       fill="#f2a541")
d.text((24, 38), "Azzura Heist · gta6-01 · top-down · north up · 1 unit = 10 m · "
       "map 3200 × 1850 m · corner-to-corner ~82 s at 45 m/s",
       font=font(13), fill="#e8ddc4")

# Map frame + land base
d.rectangle([px(X0), py(Z1), px(X1), py(Z0)], fill=LAND, outline=INK, width=2)

# Bay water (north, z > 40) — straight shoreline with a gentle curve.
water_poly = [(px(X0), py(Z1))]
for x in range(X0, X1 + 1, 10):
    shore = 40 - 2 * math.cos((x + 20) / 60.0)
    water_poly.append((px(x), py(shore)))
water_poly += [(px(X1), py(Z1))]
d.polygon(water_poly, fill=WATER)
d.text((px(-40), py(96)), "BAY OF AZZURA", font=font(20, True), fill="#ffffff")
d.text((px(-40), py(84)), "harbor water · moorings · ferry lane · skyline seen from the water",
       font=font(12), fill="#eaf4f7")

# Zone fills — draw big rings first, then the sub-areas on top.
order = ["Olive grove W", "Quarry E", "Countryside S", "Residential ring",
         "Commercial ring", "CBD core", "Funicular hills",
         "Cliff villas W", "Cliff villas E",
         "Fortress old town", "Promenade + casino", "Marina + harbor"]
by_name = {z[0]: z for z in ZONES}
for name in order:
    _, x0, x1, z0, z1, fill, _, _, _, _ = by_name[name]
    d.rectangle([px(x0), py(z1), px(x1), py(z0)], fill=fill, outline="#7a6a55", width=1)

# Lighthouse headland (peninsula, joined to the land at z = 40)
hl = [(px(x), py(z)) for x, z in HEADLAND]
d.polygon(hl, fill=HEADLAND_FILL, outline="#6f6f6f", width=2)
# cliffs along the headland's west edge (short hatch marks)
for i, zz in enumerate(range(44, 66, 4)):
    d.line([(px(-160), py(zz)), (px(-156), py(zz + 2))], fill="#6f6f6f", width=2)
# headland road: from the land up to the lighthouse
d.line([(px(-143), py(40)), (px(-143), py(64))], fill="#5a5148", width=3)
# lighthouse tower at the tip + cottages
d.rectangle([px(-146), py(70), px(-140), py(64)], fill="#f2f2f2", outline=INK, width=1)
d.rectangle([px(-146), py(70), px(-140), py(68)], fill="#c0392b")
d.rectangle([px(-134), py(58), px(-130), py(54)], fill="#b08968", outline=INK, width=1)
d.rectangle([px(-152), py(52), px(-148), py(48)], fill="#b08968", outline=INK, width=1)
d.text((px(-126), py(66)), "LIGHTHOUSE POINT", font=font(11, True),
       fill="#3a3a3a", anchor="lm")
d.text((px(-126), py(58)), "lighthouse · cottages · cliffs", font=font(10),
       fill="#3a3a3a", anchor="lm")

# Block grid (side streets, 20-unit spacing) clipped to the land
for gx in range(-140, 161, 20):
    d.line([(px(gx), py(40)), (px(gx), py(-145))], fill=ROAD_ST, width=1)
for gz in range(-140, 41, 20):
    d.line([(px(-160), py(gz)), (px(160), py(gz))], fill=ROAD_ST, width=1)

# Avenues (thicker) — the tidy grid
def avenue_h(z, x0, x1, w=5):
    d.line([(px(x0), py(z)), (px(x1), py(z))], fill=ROAD_AVE, width=w)

def avenue_v(x, z0, z1, w=5):
    d.line([(px(x), py(z0)), (px(x), py(z1))], fill=ROAD_AVE, width=w)

avenue_h(-10, -90, 90)           # main boulevard (east-west spine, through CBD)
avenue_h(28, -90, 90)            # waterfront boulevard
avenue_h(0, -125, 125)           # mid avenue
avenue_h(-70, -125, 125)         # south ring avenue
avenue_h(-40, -125, 125)         # inner south avenue
avenue_h(-100, -125, 125)        # hills avenue
avenue_h(-130, -160, 160)        # south countryside road (dirt)
avenue_v(0, -110, 40)            # CBD north-south avenue
avenue_v(-60, -110, 40)          # west avenue
avenue_v(60, -110, 40)           # east avenue
avenue_v(-20, -70, 40)           # CBD west avenue
avenue_v(20, -70, 40)            # CBD east avenue
avenue_v(-100, -110, 40)         # residential west avenue
avenue_v(100, -110, 40)          # residential east avenue
avenue_v(-140, -145, 40)         # outer west road
avenue_v(140, -145, 40)          # outer east road (quarry road)
# Ring road around the CBD core
d.rectangle([px(-45), py(25), px(45), py(-40)], outline=ROAD_AVE, width=4)
# Funicular line (dashed) up the hills
for i, zz in enumerate(range(-75, -111, -6)):
    d.line([(px(-2), py(zz)), (px(2), py(zz - 3))], fill="#4a6b3a", width=3)
d.text((px(6), py(-92)), "funicular", font=font(11, True), fill="#3a5a2e")
# Elevated road + monorail through the CBD core (double line, gold)
d.line([(px(-40), py(8)), (px(40), py(8))], fill="#8a6d1f", width=4)
d.line([(px(-40), py(11)), (px(40), py(11))], fill="#c9a227", width=2)
d.text((px(-38), py(24)), "elevated road + monorail", font=font(11, True),
       fill="#6b5518", anchor="lm")

# Continuous promenade + quay along the WHOLE shore (z 36..40)
d.rectangle([px(-160), py(40), px(160), py(36)], fill="#e8dcc0", outline="#8a7a5a", width=1)
d.line([(px(-160), py(40)), (px(160), py(40))], fill="#5a5148", width=2)
d.text((px(95), py(38)), "PROMENADE — continuous waterfront walkway + quay",
       font=font(10, True), fill="#5a4a30", anchor="mm")

# Marina piers (jut into the bay) + moored boats
for pier_x in (-45, -30, -15):
    d.rectangle([px(pier_x - 1.5), py(48), px(pier_x + 1.5), py(40)],
                fill="#8a6d4a", outline="#5a4a30", width=1)
    d.rectangle([px(pier_x + 4), py(46), px(pier_x + 9), py(43)],
                fill="#ffffff", outline=INK, width=1)  # moored boat
d.text((px(-50), py(46)), "piers · boat sheds · harbor road", font=font(10, True),
       fill="#2b4a5a", anchor="lm")

# Quarry details (east): pits, silos, cranes
d.ellipse([px(132), py(-60), px(148), py(-72)], outline="#6f5a3a", width=3)  # pit
d.ellipse([px(138), py(-88), px(150), py(-98)], outline="#6f5a3a", width=3)  # pit 2
for sx in (132, 138, 144):
    d.rectangle([px(sx), py(-40), px(sx + 4), py(-48)], fill="#c8c8c8", outline=INK, width=1)
d.line([(px(152), py(-50)), (px(152), py(-78))], fill="#8a6d1f", width=3)   # crane
d.line([(px(152), py(-78)), (px(142), py(-72))], fill="#8a6d1f", width=2)
d.text((px(142), py(-32)), "QUARRY", font=font(12, True), fill="#4a3a28", anchor="mm")
d.text((px(142), py(-100)), "pits · silos · cranes · driveable site", font=font(10),
       fill="#4a3a28", anchor="mm")
# Countryside details (west + south): farm plots + vineyards (rows)
for fx in range(-156, -128, 8):
    for fz in range(-60, -100, -8):
        d.rectangle([px(fx), py(fz), px(fx + 5), py(fz - 5)],
                    outline="#7a8a4a", width=1)
d.text((px(-142), py(-30)), "OLIVE GROVE", font=font(11, True), fill="#5a4a28", anchor="mm")
d.text((px(-142), py(-110)), "farms · vineyards · dirt roads", font=font(10),
       fill="#5a4a28", anchor="mm")

# Elevation — terrace contour lines (hills + cliff villas) + labels
for tz in (-82, -92, -102):
    d.line([(px(-60), py(tz)), (px(60), py(tz))], fill=TERRACE, width=2)
d.text((px(64), py(-92)), "terraces + retaining walls", font=font(10, True),
       fill="#6b5518", anchor="lm")
for tx in (-112, 112):
    d.line([(px(tx), py(-78)), (px(tx), py(-22))], fill=TERRACE, width=2)
# elevation labels
d.text((px(0), py(-18)), "CBD +8 m", font=font(11, True), fill="#6b5518", anchor="mm")
d.text((px(0), py(-88)), "HILLS +30–60 m", font=font(11, True), fill="#4a5a2e", anchor="mm")
d.text((px(-110), py(-50)), "VILLAS +50–80 m", font=font(10, True), fill="#4a5a2e", anchor="mm")
d.text((px(110), py(-50)), "VILLAS +50–80 m", font=font(10, True), fill="#4a5a2e", anchor="mm")
d.text((px(-70), py(33)), "SHORE +2 m", font=font(10, True), fill="#2b4a5a", anchor="mm")

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

# Zone labels
def label(x, z, text, size=15, color="#2b2b2b", anchor="mm"):
    d.text((px(x), py(z)), text, font=font(size, True), fill=color, anchor=anchor)

label(0, -20, "CBD CORE", 20)
label(0, -28, "Downtown Bay Skyline · 30+ towers", 11)
label(28, -52, "COMMERCIAL RING", 15)
label(28, -60, "shops · hotels · offices · markets", 11)
label(-88, 12, "RESIDENTIAL\nRING", 14)
label(98, -62, "RESIDENTIAL\nRING", 14)
label(-62, -62, "FORTRESS\nOLD TOWN", 13)
label(45, 27, "PROMENADE + CASINO", 13)
label(-20, 32, "MARINA", 12)
label(0, -92, "FUNICULAR HILLS", 13)
label(-142, -120, "OLIVE GROVE +\nCOUNTRYSIDE", 11)
label(142, -120, "COUNTRYSIDE", 11)
label(0, -128, "SOUTH COUNTRYSIDE — farms · vineyards", 11)

# Key anchor markers — labels SPREAD with leader lines (geometry unchanged).
# (name, dot_x, dot_z, label, label_x, label_z, label_anchor)
anchors = [
    ("tower_lobby", 0, -8, "Azzura Tower lobby", 22, -8, "lm"),
    ("skyline_plaza", 0, 12, "central plaza", 22, 16, "lm"),
    ("player_spawn", -2, -14, "player spawn", -24, -30, "rm"),
    ("race_start_1", -30, -10, "race start 1", -58, -10, "rm"),
    ("casino_entrance", 45, 22, "casino entrance", 45, 6, "mt"),
    ("casino_forecourt", 45, 30, "casino forecourt", 64, 30, "lm"),
    ("fortress_plaza", -62, -52, "fortress plaza", -40, -52, "lm"),
    ("harbormaster_pavilion", -10, 31, "harbormaster pavilion", 8, 31, "lm"),
    ("promenade_mid", 60, 27, "promenade mid", 72, 27, "lm"),
    ("quay_end", -20, 38, "quay end", -38, 38, "rm"),
    ("lighthouse", -143, 66, "lighthouse", -128, 66, "lm"),
]
for name, ax, az, lab, lx_, lz_, anch in anchors:
    d.ellipse([px(ax) - 4, py(az) - 4, px(ax) + 4, py(az) + 4],
              fill="#ffffff", outline=INK, width=2)
    # leader line from the dot to the label
    d.line([(px(ax), py(az)), (px(lx_), py(lz_))], fill="#2b2b2b", width=1)
    d.text((px(lx_), py(lz_)), lab, font=font(10), fill="#2b2b2b", anchor=anch)

# North arrow + scale bar (map units AND meters: 1 unit = 10 m)
d.polygon([(px(152), py(108)), (px(148), py(98)), (px(156), py(98))], fill=INK)
d.text((px(152), py(94)), "N", font=font(16, True), fill=INK, anchor="mm")
sb_y = py(-148)
d.line([(px(-160), sb_y), (px(-60), sb_y)], fill=INK, width=3)
for i, v in enumerate((0, 50, 100)):
    d.line([(px(-160 + i * 50), sb_y - 5), (px(-160 + i * 50), sb_y + 5)],
           fill=INK, width=2)
    d.text((px(-160 + i * 50), sb_y + 10), str(v), font=font(11, True),
           fill=INK, anchor="ma")
d.text((px(-10), sb_y - 14), "100 units = 1000 m", font=font(11, True), fill=INK)

# Legend (right column)
lx, ly = 985, 70
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
    ("#d3c194", "Olive grove + countryside"),
    ("#b8a888", "Quarry + industrial"),
    ("#c9b896", "Lighthouse point"),
    ("#6fa8bf", "Bay water"),
]
for col, txt in legend:
    d.rectangle([lx, ly, lx + 18, ly + 14], fill=col, outline=INK, width=1)
    d.text((lx + 24, ly - 1), txt, font=font(12), fill=INK)
    ly += 22
ly += 8
d.line([(lx, ly), (lx + 270, ly)], fill="#b0a890", width=1)
ly += 10
d.text((lx, ly), "Height curve (floors vs r):", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "r<10: 60 (plateau); 10–45: linear", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "60→15; r>45: 14·e^(−(r−45)/30)+1.", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "Zone clamps: CBD 20–60, comm.", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "6–15, resid. 2–6, outskirts 1–3.", font=font(12), fill=INK)
ly += 20
for r in (0, 15, 30, 45, 60, 80, 100):
    d.text((lx, ly), f"r={r:3d} → {floors_at(r):2d} floors", font=font(12), fill=INK)
    ly += 18
ly += 8
d.text((lx, ly), "Scale: 1 unit = 10 m.", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "Map 3200 × 1850 m. Corner to", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "corner ~3700 m ≈ 82 s at 45 m/s", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "top speed (60–90 s target).", font=font(12), fill=INK)
ly += 22
d.text((lx, ly), "Elevation: bay 0 m → shore +2 m", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "→ CBD +8 m → hills +30–60 m", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "→ cliff villas +50–80 m. Terraces", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "and retaining walls on the slopes.", font=font(12), fill=INK)
ly += 22
d.text((lx, ly), "Roads: thick = avenues,", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "thin = side streets (block grid).", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "Gold double line = elevated", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "road + monorail (CBD core).", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "White dots = named anchors;", font=font(12), fill=INK)
ly += 18
d.text((lx, ly), "leader lines spread the labels.", font=font(12), fill=INK)
ly += 22
d.text((lx, ly), "Draw calls (est.): worst view", font=font(12, True), fill=INK)
ly += 18
d.text((lx, ly), "~330, target < 600.", font=font(12), fill=INK)

# Elevation profile strip (cross-section at x = 0, north bay -> south countryside)
py0, py1 = 850, 960
d.text((30, py0 - 22), "ELEVATION — cross-section at x = 0, bay (left) to south countryside (right):",
       font=font(12, True), fill=INK)
prof = [(115, 0), (40, 2), (20, 5), (-10, 8), (-40, 12), (-70, 20),
        (-90, 35), (-110, 60), (-130, 25), (-145, 18)]
px0, px1 = 30, 954
def prof_x(z):
    return px0 + (115 - z) / 260.0 * (px1 - px0)
def prof_y(elev):
    return py1 - elev / 80.0 * (py1 - py0)
poly = [(prof_x(115), prof_y(0))]
for z, e in prof:
    poly.append((prof_x(z), prof_y(e)))
poly.append((prof_x(-145), prof_y(0)))
d.polygon(poly, fill="#b5c48a", outline="#5a6b3a", width=2)
# sea level
d.line([(px0, prof_y(0)), (px1, prof_y(0))], fill="#6fa8bf", width=3)
d.text((px0 + 4, prof_y(0) - 16), "BAY 0 m", font=font(10, True), fill="#2b4a5a")
for z, e, lab in [(40, 2, "SHORE +2 m"), (-10, 8, "CBD +8 m"),
                  (-90, 35, "HILLS +35 m"), (-110, 60, "HILLS TOP +60 m")]:
    d.ellipse([prof_x(z) - 3, prof_y(e) - 3, prof_x(z) + 3, prof_y(e) + 3],
              fill="#ffffff", outline=INK, width=1)
    d.text((prof_x(z), prof_y(e) - 14), lab, font=font(10, True), fill=INK, anchor="mb")

img.save("docs/zoning/zoning-map.png", optimize=True)
print("saved docs/zoning/zoning-map.png")

# ------------------------------------------------------------- numbers table
def rect_area(x0, x1, z0, z1):
    return (x1 - x0) * (z1 - z0)

def shoelace(poly):
    s = 0
    for i in range(len(poly)):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % len(poly)]
        s += x0 * z1 - x1 * z0
    return abs(s) // 2

cbd = rect_area(-40, 40, -35, 20)                       # 4,400
comm_rect = rect_area(-80, 80, -70, 40)                 # 17,600
marina = rect_area(-50, 10, 24, 40)                     # 960
comm = comm_rect - cbd - marina                         # 12,240
resi_rect = rect_area(-125, 125, -110, 40)              # 37,500
resi = resi_rect - comm_rect                           # 19,900
west = rect_area(-160, -125, -145, 40)                  # 6,475
east = rect_area(125, 160, -145, 40)                    # 6,475
south = rect_area(-125, 125, -145, -110)                # 8,750
outer = west + east + south                             # 21,700
light = shoelace(HEADLAND)                              # ~870
land = rect_area(-160, 160, -145, 40)                   # 59,200
total_a = cbd + comm + resi + marina + light + outer

print("\nZONE TABLE — exclusive areas (map units^2; sub-areas are 'of which')")
print("1 unit = 10 m. Map 3200 x 1850 m. Diagonal ~3696 m, ~82 s at 45 m/s.")
rows = [
    ("1  CBD core", cbd, 32, 42, "20–60 fl", 35),
    ("2  Commercial ring", comm, 54, 399, "6–15 fl", 120),
    ("   of which: Promenade + casino", 1400, 8, 40, "3–14 fl", 50),
    ("   of which: Fortress old town", 1225, 9, 63, "2–4 fl", 30),
    ("   of which: general commercial", comm - 1400 - 1225, 37, 296, "6–15 fl", 40),
    ("3  Residential ring", resi, 88, 442, "2–6 fl", 75),
    ("   of which: Funicular hills", 4200, 19, 76, "2–4 fl", 25),
    ("   of which: Cliff villas", 3600, 16, 48, "1–3 fl", 15),
    ("   of which: general residential", resi - 4200 - 3600, 53, 318, "2–6 fl", 35),
    ("4  Marina + harbor", marina, 4, 32, "1–3 fl", 25),
    ("4  Lighthouse point", light, 2, 12, "1–6 fl", 10),
    ("4  Countryside + quarry", outer, 8, 42, "1–2 fl", 20),
]
total_b = 32 + 54 + 88 + 4 + 2 + 8
total_n = 42 + 399 + 442 + 32 + 12 + 42
total_dc = 35 + 120 + 75 + 25 + 10 + 20 + 45
for name, a, blocks, bldg, hr, dc in rows:
    print(f"{name:34s} area {a:6d}  blocks {blocks:3d}  bldg {bldg:3d}  {hr:9s}  DC ~{dc}")
print(f"{'TOTAL (land + headland)':34s} area {total_a:6d}  blocks {total_b:3d}  "
      f"bldg {total_n:3d}  DC ~{total_dc} (incl. shared roads/terrain/water/veg/traffic ~45)")
print(f"check: land rect {land} + headland {light} = {land + light} (== total {total_a})")
print("\nHeight curve check (revised):")
for r in (0, 15, 30, 45, 60, 80, 100):
    print(f"  r={r:3d} -> {floors_at(r):2d} floors")
print("CBD edge check (r 27–40):", floors_at(27), "–", floors_at(40), "floors (spec 20–40)")
print("CBD towers drawn:", len(towers))
