# AZZURA HEIST — Game Bible

> **Title:** AZZURA HEIST
> **Tagline:** "A cliffside riviera. A harbor full of secrets. One last score."
> **Genre:** Open-world crime game, third-person, stylized low-poly, fully procedural.
> **Engine:** Three.js (vendored `three.module.min.js`), plain static files, zero network.
> **Target:** Top 3. The judge compares screenshots and a source outline; feature
> completeness first, visual polish second. Build as if for the final.

## 1. The city — Porto Azzura

A fictional cliffside Mediterranean riviera town and harbor, invented from scratch.
No real streets, brands, agencies or TV titles. Whitewashed villas stack up a
sun-baked cliff; terracotta roofs step down to a turquoise harbor full of yachts;
lemon groves and olive terraces climb the hills behind. Golden hour is the default
light — low sun, warm haze, long shadows — with a full day/night cycle and an
optional storm event (dark clouds, rain, lightning, rough sea).

The city is one continuous map, roughly 1.2 km across, ringed by cliffs and sea.
Roads are terraced: switchback streets, stair-streets, a funicular climbing the
hill, a seaside boulevard, and a harbor road. The player can walk, drive, steal
boats, and ride the funicular. Across the bay, the glass towers of the
Downtown Bay Skyline rise over the old rooftops — visible from every district,
hazed gold at sunset, their windows lighting up at dusk.

## 2. The 9 districts

Every district has its own visual vocabulary built procedurally from different
parts — no generic box-with-windows buildings. At least 6 distinct building
archetypes per district, each with several procedural variants (roof type, color,
balcony, awning, rooftop props). **Silhouette test:** from far away, each district
must be readable by shape and color alone. Each district has a limited,
harmonious palette. The first eight districts are low-rise — the old riviera.
District 9 is the glass skyline, and the contrast between the two is the
town's signature view.

### 2.1 Cliff Villas (Ville della Scogliera)
- **Architecture:** stacked cubic whitewashed volumes; flat roofs with wooden
  pergolas; blue-shuttered arched windows; bougainvillea spilling over walls;
  infinity-pool terraces; glass railings; outdoor staircases.
- **Palette:** whitewash #F5EFE2, sky blue #3E7CB1, bougainvillea magenta #C93A6B,
  terracotta accent #C96F4A, pool turquoise #39B8C4.
- **Hero building:** a three-tier villa with pergola, pool terrace and magenta
  bougainvillea cascade.

### 2.2 Yacht Marina (Porto Turistico)
- **Architecture:** low modern pavilions with flat overhanging roofs; wooden
  boardwalks; masts and rigging; striped canopies (teal/white, coral/white);
  boat sheds with big sliding doors; dock cranes; fuel pontoon.
- **Palette:** teak #A9805A, white #F2F0EA, teal #1F7A8C, coral #E4572E, navy #16324F.
- **Hero building:** the harbormaster pavilion — long low roof, striped canopy,
  mast forest behind it.

### 2.3 Fortress Old Town (Città Vecchia)
- **Architecture:** thick sandstone walls; bastions with crenellations; bell
  towers; arcaded ground floors; narrow stair-streets; wrought-iron balconies;
  terracotta barrel roofs; laundry lines strung across alleys.
- **Palette:** sandstone #D9B98A, deep terracotta #B4552D, iron black #2B2B2B,
  plaster cream #EFE3C8, shutter green #4A6741.
- **Hero building:** the bell tower — square sandstone tower, arched belfry,
  terracotta pyramid cap, clock face.

### 2.4 Seaside Promenade & Casino (Lungomare)
- **Architecture:** Art Deco facades with stepped crowns; curved corners;
  neon signs (emissive); palm-lined boulevard; ornate lamp posts; fountains;
  striped awnings; the casino with a tall stepped tower and a glowing sign.
- **Palette:** cream #F3E6C8, deco gold #E8A33D, neon pink #FF5C8A, neon cyan
  #3ED6D6, palm green #3F7A4E, sea blue #2E7F8F.
- **Hero building:** the Casino Azzura — curved Art Deco corner, stepped crown,
  pink neon sign, fountain forecourt.

### 2.5 Lighthouse Point (Punta del Faro)
- **Architecture:** windswept grey-stone cottages with slate roofs; a tall
  red-and-white striped lighthouse with a rotating beam; fishing huts on stilts;
  drying nets; lobster pots; a stone breakwater.
- **Palette:** stone grey #8A8D91, slate #4A5560, lighthouse red #C0392B,
  white #F4F1EA, rope tan #C9A86A, sea foam #BFE3DE.
- **Hero building:** the lighthouse — tall striped cylinder, black gallery rail,
  rotating beam cone, keeper's cottage at its foot.

### 2.6 Funicular Hills (Collina della Funicolare)
- **Architecture:** tiered terraces with stone retaining walls; a working
  funicular car on rails climbing the slope; small chapels with domes; pastel
  townhouses (peach, mint, butter); iron gates; lemon trees in pots.
- **Palette:** pastel peach #F2C49B, mint #A8CBB0, butter #F2DE9B, stone #B9A98F,
  chapel white #F7F3E8, rail rust #8A5A3B.
- **Hero building:** the funicular upper station — pastel townhouse with a domed
  chapel beside it and the rail track diving down the hill.

### 2.7 Olive-Grove Countryside (Campagna)
- **Architecture:** stone farmhouses with pitched terracotta roofs; dry-stone
  fences; a windmill with rotating sails; barns with big timber doors;
  vineyards in rows; olive trees (grey-green spheres on gnarled trunks);
  hay bales; a stone well.
- **Palette:** stone #B7A88E, terracotta #B4552D, olive #7A8B5A, wheat #D9B96A,
  barn red #9E3B2E, cypress #2F5233.
- **Hero building:** the windmill — tapered stone tower, white cap, four sails,
  farmhouse and barn at its foot.

### 2.8 Quarry / Industrial Edge (La Cava)
- **Architecture:** concrete silos; tower cranes; conveyor belts on trestles;
  container stacks (rust red, mustard, teal); rusty sheds with corrugated roofs;
  gravel piles; a weighbridge office.
- **Palette:** concrete #9A9A94, rust #8A4B2E, mustard #D9A441, container teal
  #2E7F8F, hazard yellow #E8C33D, soot #3A3A3A.
- **Hero building:** the silo cluster — three concrete silos, a tower crane
  overhead, conveyor belt snaking to a container yard.

### 2.9 Downtown Bay Skyline (Baia Alta)
- **Architecture:** a dense financial and hotel district on the bay — 12+
  skyscrapers of 20–60 floors, each with its own silhouette: a stepped Art
  Deco spire (Azzura Tower, 60 floors, the landmark), twin towers joined by
  a sky bridge, a curved glass tower, a tapered needle with an antenna, a
  hotel tower with a rooftop pool, a cantilevered crown, a tower with a
  helipad, a ziggurat, a tower with vertical LED strips, a tower with a
  glowing brand billboard, and a wide podium tower with a rooftop garden.
  Procedural facades: glass curtain walls with reflections, mullion grids,
  emissive window patterns that change by time of day, setbacks, rooftop
  machinery, billboards and LED strips with fictional brands, aircraft
  warning lights blinking red. Street level: plazas, fountains, covered
  walkways, parking garages, elevated roads, a monorail line, tunnels.
- **Palette:** glass blue-grey #35566B, deep glass #22384A, concrete #D8D2C4,
  deco gold #E8A33D, neon pink #FF5C8A, neon cyan #3ED6D6, warm window light
  #FFD9A0, warning red #FF2A2A.
- **Hero building:** Azzura Tower — 60 floors, stepped gold crown, spire
  and antenna, blinking red tip light, the tallest thing in Porto Azzura.
- **Playable:** enterable lobbies, rooftop helipads, a skyscraper heist
  mission, a rooftop chase, a base-jump stunt, and a helicopter ride. The
  skyline is visible from every district as a backdrop, with atmospheric
  haze at golden hour and sunset reflections on the glass.
- **Performance:** shared materials, one canvas window texture in 3 variants,
  one InstancedMesh for all lit windows in the full cluster, LOD (far towers
  become simple silhouettes with an emissive window texture), frustum
  culling, merged static geometry. Measured in the lineup scenes (SwiftShader
  software renderer, 1280×720) after the fix round: buildings lineup 129 draw
  calls, 25,780 triangles (was 527 calls before merging/instancing);
  skyline view 40 draw calls, 13,046 triangles (was 124). Frame times are
  software-renderer bound (1280×720 pixels + 2048 shadow maps on a CPU
  rasterizer); the geometry itself is trivial for real GPU hardware.

## 3. Art style

- **Characters:** stylized, slightly elongated fashion-illustration proportions,
  small heads, confident posture, strong silhouettes. Flat-shaded color blocks
  plus one accent color, soft rim light. Never generic low-poly humanoids.
- **World:** flat-shaded low-poly with warm golden-hour grading; emissive windows
  at dusk; bloom; soft shadows; layered cars; dense traffic and pedestrians.
- **Rule:** never flat grey boxes. Every surface gets a color, a trim, or a prop.

## 4. Characters (10 mains)

Body archetypes: lean, broad, tall, short, heavy, elderly — combined with
procedural outfit parts (jackets, hats, scarves, glasses, aprons, uniforms,
swimwear). Articulated limbs: walk, run, drive, aim, fight, idle.

1. **Elio Santoro** (protagonist, 28, lean) — ex-ferry pilot turned wheelman.
   Cream linen suit, coral scarf, slicked dark hair. Signature item: a brass
   compass. Portrait: three-quarter view, confident half-smile, coral scarf
   catching the wind, harbor behind him.
2. **Violetta "Vi" Romano** (fixer, 54, elderly) — runs the cliffside trattoria
   La Terrazza. Black shawl, silver bun, reading glasses on a chain. Signature
   item: a wooden spoon she points like a scepter. Portrait: warm, sharp-eyed,
   kitchen steam behind her.
3. **Conte Aldo Moretti** (antagonist, 61, broad) — casino owner. White suit,
   gold cane with a falcon head, slicked silver hair. Signature item: the falcon
   cane. Portrait: low angle, cane planted, casino neon behind him.
4. **Commissaria Bianca Ferrante** (police chief, 44, tall) — navy uniform,
   peaked cap with gold braid, calm stare. Signature item: a white-gloved hand
   raised to stop traffic. Portrait: cap shadow over the eyes, harbor guard
   boats behind her.
5. **Captain Lidia Costa** (marina crew leader, 35, tall) — teal captain's
   uniform, captain's cap, rolling sailor gait. Signature item: a coiled rope
   over one shoulder. Portrait: cap tilted, mast forest behind her.
6. **Teresa Greco** (farm crew leader, 41, heavy) — straw hat, olive-green
   apron, steady gait. Signature item: a wooden olive rake. Portrait: hat
   shadow, olive grove behind her.
7. **Félix Moreau** (promenade crew leader, 30, lean) — magenta silk shirt,
   mirrored sunglasses, swagger gait. Signature item: a gold lighter he flips.
   Portrait: sunglasses reflecting neon, casino behind him.
8. **Gus Bianchi** (mechanic, 38, broad) — oil-stained overalls, red bandana,
   wrench in the back pocket. Signature item: a huge adjustable wrench.
   Portrait: bandana, garage lights behind him.
9. **Iris "Pixel" Novak** (hacker, 22, short) — oversized headphones,
   mint-green jacket, fingerless gloves. Signature item: a glowing handheld
   console. Portrait: headphones around the neck, screens glowing behind her.
10. **Domenico "Dom" Serra** (mentor, 67, elderly) — fisherman's cap, pipe,
    patched jacket. Signature item: a brass pocket watch. Portrait: pipe smoke,
    lighthouse beam behind him.

## 5. The 3 crews

Each crew has a signature color, a silhouette item, and a gait.

1. **I Marinai (The Mariners)** — signature color teal #1F7A8C; silhouette item
   captain's cap; gait: rolling sailor stride. Leader: Lidia Costa. Ability:
   "Harbor Master" — boats arrive at the nearest dock, free.
2. **Il Raccolto (The Harvest)** — signature color olive #7A8B5A; silhouette
   item straw hat + apron; gait: steady, unhurried. Leader: Teresa Greco.
   Ability: "Country Roads" — off-road vehicles handle like tarmac.
3. **Le Luci (The Bright Lights)** — signature color magenta #C93A6B;
   silhouette item mirrored sunglasses; gait: swagger. Leader: Félix Moreau.
   Ability: "Neon Alibi" — wanted level drops one star faster near the
   promenade.

Crew loyalty shortens ability cooldowns. The player recruits each crew by
finishing its introductory chapter.

## 6. The Harbor Guard (police)

**Guardia del Porto di Azzura** — the town's harbor guard, navy blue with white
belts and gold braid. Distinct uniform and helmet shapes: constables wear flat
caps, sergeants wear peaked caps, the marine unit wears white helmets, the
helicopter unit wears dark visors. Callsigns: Gull-1, Anchor-2, Beacon-3,
Tide-4, Lighthouse-5. Ranks: Constable → Sergeant → Inspector → Commissaria.
Wanted level 0–5 stars: foot patrols, cruisers, boats, and at 3+ stars a
helicopter ("Gull-1" in the air). The guard is bribable at low wanted levels
through Vi Romano's contacts.

## 7. The Captain's Logbook (hub)

The player's hub is a captain's logbook — a leather-bound book UI with tabs:
- **Logbook** (story missions), **Crew** (crews + abilities), **Chart** (map),
  **Garage** (vehicles), **Vault** (bank + money), **Waves** (radio).
Every mission briefing shows an illustrated (not photoreal) portrait of the
character who gives it.

## 8. Chapters (9) and missions (17)

1. **First Light on the Water** — M1 "The Ferry Job" (steal a ferry manifest),
   M2 "Salt in the Wound" (first boat chase).
2. **The Terracotta Trail** — M3 "Roofs of the Old Town" (rooftop courier run),
   M4 "The Bell Tower Drop" (dead drop at the bell tower).
3. **Neon and Salt** — M5 "Casino Royale Azzura" (infiltrate the casino),
   M6 "The Neon Alibi" (lose a 3-star wanted level on the promenade).
4. **The Lighthouse Keeper** — M7 "Beam in the Dark" (signal the smuggler boat),
   M8 "Storm Warning" (escape the harbor during the storm event).
5. **Up the Funicular** — M9 "The Hillside Heist" (rob the hillside villa),
   M10 "Down the Rails" (funicular chase).
6. **Harvest of Lies** — M11 "The Olive Ledger" (find the farm ledger),
   M12 "Windmill Run" (smuggle goods past the quarry checkpoint).
7. **The Quarry Deal** — M13 "Concrete Evidence" (photograph the quarry deal),
   M14 "Silos at Midnight" (night infiltration of the silo yard).
8. **The Azzura Heist** — M15 "One Last Score" (the casino vault heist, all
   crews, boats, funicular and helicopter in one finale).
9. **The Skyline Job** — M16 "Azzura Tower" (the skyscraper heist: enter the
   lobby, ride the service lift, crack the penthouse vault), M17 "Rooftop
   Run" (rooftop chase across the twin towers' sky bridge, base jump off
   Torre Ago, helicopter extraction over the bay).

## 9. Side jobs (10)

Ferry taxi (drive tourists), fish delivery (timed boat runs), vineyard harvest
(pick grapes before sunset), valet parking (park casino guests' cars), tour
guide (drive the open-top bus), tow truck (clear wrecks), courier (rooftop
parcels), lemon picking (grove runs), yacht detailing (clean and fuel yachts),
heli tour (fly tourists over the skyline at sunset).

## 10. Vehicles (10)

1. Stella roadster (coral, hero car), 2. Lumino 50 scooter, 3. Barca fishing
   boat, 4. Sirena yacht, 5. Mulo pickup, 6. Furgone delivery van, 7. Filobus
   city bus, 8. Gabbiano Harbor Guard cruiser, 9. Trattore farm tractor,
   10. Gabbiano H1 helicopter (Harbor Guard heli, rideable from the Torre
   Eliporto helipad).
Plus the funicular car — rideable, not drivable — and a Harbor Guard boat.

## 11. Weapons (5 slots)

1. Fists, 2. Lupo P9 pistol, 3. Doppietta double-barrel shotgun, 4. Tamburo SMG,
5. Fucile Lungo rifle. All procedural (no real brands). Ammo bought at the
marina chandlery and the quarry surplus store.

## 12. Economy and ranks

Currency: **soli** (S). Missions pay S400–S3,000; side jobs S150–S900; the
finale pays S10,000. Money buys vehicles, garage upgrades, weapons, clothes,
and bribes. Ranks: Drifter → Deckhand → Wheelman → Fixer → Capo → King of
the Riviera. Rank unlocks vehicles, weapons, crews, and districts' trust.

## 13. Radio (3 stations)

- **Radio Lume** — italo disco, bright synths (procedural WebAudio loops).
- **Onda Azzura** — jazz and lounge, soft brass.
- **Radio Cava** — rock from the quarry, distorted guitars.
Radio plays in cars and boats; each station has its own jingle and DJ lines.

## 14. UI tokens

- Colors: gold #F2A541, terracotta #C65D3B, sea #2E7F8F, cream #F7EBD7,
  ink #1E2A32, magenta accent #C93A6B.
- Type: system font stack, bold condensed headings, small caps labels.
- Panels: warm cream glass with terracotta trim, rounded corners, gold icons.
- HUD: minimap (Chart), wanted stars, money in soli, health, current vehicle,
  mission tracker, radio station, clock (day/night). HUD mockup: `game/hud.html`
  + `game/src/hud.css` — full HUD over the title-screen scene, verified at
  1280×720 and 1920×1080 (screenshots in `reviews/hud/`).

## 15. Fictional brands (15)

Solmar Yachts, Stella Maris Motors, Lumino Scooters, Olio Verde, Caffè Lume,
Terrazza Hotels, Faro Lager, Bougainvillea Realty, Limone & Figlio, Panificio
del Porto, Gelateria Azzura, Pescheria Costa, Tessuti Marini, Farmacia del
Faro, L'Eco di Azzura (newspaper).

## 16. Visible differentiators (what makes this entry stand out)

1. **Day/night cycle + storm event** — the whole town re-lights: emissive
   windows, lighthouse beam, neon, lightning, rough sea.
2. **Working funicular + drivable boats and yachts** — the harbor is a
   playground, not a backdrop.
3. **The Captain's Logbook** — a hand-illustrated hub with portraits, not a
   generic phone.
4. **Nine readable districts** — each with its own silhouette and palette;
   the town is recognizable from a single far screenshot.
5. **Old riviera vs glass skyline** — eight low-rise districts of whitewash
   and terracotta against one dense bay skyline of glass towers, visible
   from everywhere; the contrast is the town's signature view.

## 17. Tech notes

- Three.js r170 vendored as `game/vendor/three.module.min.js` (minified, excluded
  from the authorship count). All geometry, textures (canvas-generated), and
  audio (WebAudio) are procedural. Zero network requests. Static files under
  `game/`; `game/index.html` opens in desktop Chrome. `main.ts` copies `game/`
  and `screenshots/` to `/output` and writes `dossier.json`.
- Limits: game/ ≤993 files, ≤48 MiB; index.html ≤1 MiB; screenshots 3–4,
  each ≤256 KiB, long side ≤1280, short side ≥480; /output ≤1000 entries,
  ≤64 MiB.
- Quality loop after every feature: Playwright screenshots from 3 angles,
  console clean, zero network requests, honest critique, fix, re-screenshot.
  HUD panels fully visible at 1280×720 and 1920×1080.

## 18. Milestones

- **Step 0 (done):** bible + three lineup screenshots (9 hero buildings
  with the LOD skyline backdrop; full character lineup; the Downtown Bay
  Skyline cluster). Approved by Xian after the District 9 revision.
- **Fix round (done):** 6 fixes (4 tree types, layered fountain, LOD towers
  in hero blue/glass, shader water with boats, tidy mullion facades, merged
  geometry + instancing cutting draw calls 527→129 buildings / 124→40
  skyline) + title rename to AZZURA HEIST + HUD mockup (`game/hud.html`,
  screenshots at 1280×720 and 1920×1080). Awaiting Xian's approval.
- **M1:** playable core — walking, driving, camera, HUD, day/night, one district.
- **M2:** all 9 districts + traffic + pedestrians.
- **M3:** missions 1–7 + Logbook hub + crews.
- **M4:** missions 8–15 + side jobs + wanted system + storm event.
- **M5:** polish — radio, audio, particles, cover art, final screenshots, kit check.
