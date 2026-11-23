// AZZURA HEIST — named anchors (M4 anchor refactor, Xian's order).
// ONE data file for every gameplay position in the game. The city layout
// rebuild only moves these anchors — mission, spawn, race, checkpoint and
// staging code never touches raw coordinates again.
//
// Every anchor is a real place in the CURRENT city (positions match the
// committed city at HEAD d0a93aa exactly). This refactor moves NOTHING in
// the world: it is behavior-preserving, the same coordinates, now named.
//
// Shape: { x, z } is the ground position (y is 0 unless noted).
//   angle — facing in radians (0 = +X east) where the spot has a facing.
//   district — which district the place belongs to (for the layout plan).
//   look — for camera vantages only: where the camera points { x, y, z }.
//   y — for camera vantages only: the camera height above ground.
//
// Helpers: anchor(name, r) returns a mission stage target { x, z, r };
// anchorXZ(name) returns a plain { x, z } for checkpoint lists and
// engine positions. Both throw on an unknown name — fail loudly, so a
// typo shows up in the Playwright verification instead of silently
// sending the player to (0, 0).
export const ANCHORS = {
  // --- mission places ---
  // The harbormaster pavilion at the east end of the quay. M1 RECON /
  // STEAL, M2 MEET / DOCK, M5 ESCAPE, M8 HARBOR, M12 EPILOGUE.
  // STAGE 1 part 5: the pavilion moves to the marina strip (the east
  // end of the marina, on the promenade walkway).
  harbormaster_pavilion: { x: 5, z: 20, district: 'marina' },
  // The middle of the boulevard. M1 ESCAPE, M4 ESCAPE, and the
  // side-race finish.
  boulevard_mid: { x: 0, z: 0, district: 'boulevard' },
  // Where the smuggler's car starts its boulevard loop (M2 TAIL).
  // GRID REBUILD: the boulevard is 3.5 wide now, so the north lane is
  // at z -0.725 (the old z -3.4 is inside a CBD block).
  smuggler_start: { x: -20, z: -0.725, district: 'boulevard' },
  // The ends of the smuggler's boulevard loop (M2 TAIL wraps east<->west).
  tail_loop_east: { x: 56, z: -0.725, district: 'boulevard' },
  tail_loop_west: { x: -56, z: -0.725, district: 'boulevard' },
  // The stair-street at the north end of the old town (M3 CLIMB) —
  // the steps from the main street up to the wall walk.
  stair_street_north: { x: -47, z: -46, district: 'old town' },
  // The three north-row doors for the M3 courier run (DELIVER). The
  // engine falls back to these when a deliver stage lists no targets.
  // They are the front doors of the north-row houses (facing the main
  // street), in the new pocket.
  north_door_1: { x: -56.5, z: -46.5, district: 'old town' },
  north_door_2: { x: -47, z: -46.5, district: 'old town' },
  north_door_3: { x: -37.5, z: -46.5, district: 'old town' },
  // The front-row forecourt the M3 RETURN stage called the casino
  // forecourt (the M2-era casino stood on the front row). DELETED in
  // the GRID REBUILD — that spot is inside a CBD block now; M3 RETURN
  // retargets to casino_forecourt (the promenade forecourt) in
  // missions.js.
  // The trattoria on the front row (M4 MEET) — GRID REBUILD: the old
  // spot (-17,-19) is inside a CBD block; the trattoria fronts the
  // boulevard's north sidewalk now.
  trattoria_front: { x: -24, z: -1.5, district: 'boulevard' },
  // The foot of the old bell tower (M4 DROP).
  bell_tower: { x: -47, z: -36, district: 'old town' },
  // The fortress plaza in the old town — the chapel arcade (M5 RECON /
  // TAKE) and the old-town safehouse (M9 RUN / LAY LOW / REPORT).
  // In the new pocket, on the main street.
  fortress_plaza: { x: -47, z: -39, district: 'old town' },
  // The Casino Azzura forecourt on the promenade (M6 MEET, M12
  // CONFRONT / DUEL / AFTERMATH). The M12 duel spawns
  // Aldo here, facing the boulevard. STAGE 1 part 5: the forecourt is
  // on the promenade walkway, at the casino fountain.
  casino_forecourt: { x: 35, z: 30, district: 'promenade' },
  // The Casino Azzura entrance — at the casino's front doors (the
  // street frontage). SPLIT from the forecourt in stage 1 part 5: the
  // entrance is at the doors, the forecourt is at the fountain on the
  // walkway, 3 units in front.
  casino_entrance: { x: 35, z: 27, district: 'promenade' },
  // The west end of the boulevard (M6 VANISH).
  boulevard_west: { x: -50, z: 0, district: 'boulevard' },
  // The central plaza in the CBD core (M7 CROSS / SCAN) — the plaza
  // block (col 2, row 3) in the grid rebuild, with its fountain. (Was
  // the waterfront plaza across the bay; the landmass is gone, the
  // plaza moved downtown.)
  skyline_plaza: { x: -5.9, z: -5.9, district: 'cbd' },
  // The quay at the shore (M7 RETURN, M8 QUAY / SIGNAL, M11 ESCAPE).
  // STAGE 1 part 5: the new quay (z 31..35), at the water's edge.
  // GAME fix (M11, 22 Nov): moved 2u west so the objective sits next
  // to the new shed-row gap (x -6.5..-1.5).
  quay_end: { x: -2, z: 33, district: 'quay' },
  // The race start on the boulevard (side-race LINE UP) — also the drive /
  // night / storm ?shot staging car. GRID REBUILD: north lane z -0.725.
  race_start_1: { x: -30, z: -0.725, angle: 0, district: 'boulevard' },
  // The middle of the promenade walkway (side-race checkpoint) — in
  // front of the casino.
  promenade_mid: { x: 35, z: 29, district: 'promenade' },
  // The Azzura Tower lobby — LOBBY, the service LIFT and the penthouse
  // VAULT all stage here (M11). GRID REBUILD: the Azzura Tower stands
  // on block (col 3, row 2), centre (5.9,-16.8); its lobby is on the
  // tower's south front, facing the z -11.2 street.
  tower_lobby: { x: 5.9, z: -13.5, district: 'cbd' },

  // --- spawns ---
  // Where Elio starts (and respawns after busted / wasted): the north
  // sidewalk of the boulevard, facing west into the town. GRID REBUILD:
  // the north sidewalk is at z -2.25..-1.75 now (old z -7.2 is a block).
  player_spawn: { x: -2, z: -1.5, angle: Math.PI, district: 'boulevard' },
  // Where the hero car (Stella) starts: the boulevard north lane.
  car_spawn: { x: -8, z: -0.725, angle: 0, district: 'boulevard' },

  // --- ?shot staging: cars and players ---
  // The promenade ?shot staging car (east end of the boulevard, facing
  // west down the boulevard toward the CBD). STAGE 1 part 5: the old
  // promenade extension (x 60..108) is gone, so the car stages at the
  // boulevard's east end.
  boulevard_east: { x: 56, z: -0.725, angle: Math.PI, district: 'promenade' },
  // The ?shot staging car on the N-S avenue — the south side of the
  // CBD, facing north up the avenue toward the Azzura Tower. GRID
  // REBUILD: the avenue runs z -45.9..12.3; the car stages at z 8, on
  // the avenue just north of the boulevard crossing.
  skyline_avenue: { x: 0, z: 8, angle: Math.PI / 2, district: 'cbd' },
  // The old-town ?shot staging car on the main cobbled street (west
  // end, facing east down the street toward the plaza).
  oldtown_main_street: { x: -52, z: -39, angle: 0, district: 'old town' },
  // The wanted ?shot staging car on the boulevard south lane.
  boulevard_mid_south: { x: 0, z: 0.725, angle: 0, district: 'boulevard' },
  // The combat / tracer ?shot staging spot: Elio crouched behind the
  // quay crate, facing east down the firing line. GRID REBUILD: the
  // quay strip is z 12.7..14.5 now (old z 11.5 is the south street).
  quay_cover_spot: { x: -53.5, z: 13.5, angle: 0, district: 'quay' },
  // The walk ?shot staging spot: Elio on the south sidewalk, facing
  // east toward the bay, boats and skyline. GRID REBUILD: the south
  // sidewalk is at z 1.75..2.25 now.
  sidewalk_south: { x: -30, z: 1.5, angle: 0, district: 'boulevard' },
  // The M1 ?shot staging spot: Elio southwest of the pavilion, facing
  // its corner (the verified M1 STEAL shot). STAGE 1 part 5: the
  // pavilion moved to the marina strip.
  mission_m1_stage: { x: -3, z: 31, angle: Math.PI / 4, district: 'marina' },

  // --- ?shot staging: wheels close-ups (main.js) ---
  // The parked car spots on the north lane, and the far spots the other
  // cars are parked at (out of frame).
  wheels_spot_player: { x: 0, z: -0.725, district: 'boulevard' },
  wheels_spot_pickup: { x: 10, z: -0.725, district: 'boulevard' },
  wheels_spot_police: { x: -10, z: -0.725, district: 'boulevard' },
  wheels_far_player: { x: -40, z: -0.725, district: 'boulevard' },
  wheels_far_pickup: { x: 40, z: 0.725, district: 'boulevard' },
  wheels_far_police: { x: -40, z: 0.725, district: 'boulevard' },

  // --- ?shot staging: camera vantages ---
  // Old town: above the north sidewalk at the east end of the main
  // street, at eye level on the main cobble street looking east —
  // the pocket is LOW (2–4 floors) and the ring around it is TALL, so
  // any outside/elevated camera sees the ring, not the old town. The
  // street-level shot from inside is the one that reads.
  vantage_oldtown_cam: { x: -59, y: 3.5, z: -39, look: { x: -36, y: 2, z: -39 }, district: 'old town' },
  // Promenade: from over the bay, looking south at the casino row —
  // the Casino Azzura + the hotel tower, the forecourt fountains and
  // the walkway in front, the CBD towers behind.
  vantage_promenade_cam: { x: 35, y: 12, z: 48, look: { x: 35, y: 3, z: 21 }, district: 'promenade' },
  // Skyline: high above the quay's east end, looking north-east across
  // the bay — bridge + monorail in front, Bay Avenue and the 12 towers.
  vantage_skyline_cam: { x: 36, y: 16, z: 30, look: { x: -8, y: 5, z: 88 }, district: 'skyline' },
  // Fallback district vantage (old town, lower and closer than the
  // main old-town vantage).
  vantage_default_cam: { x: -6, y: 6, z: -38, look: { x: -44, y: 1, z: -58 }, district: 'old town' },
  // Tracer: south-east, higher up — the firing line runs diagonally
  // across the frame, Elio in profile at the quay. GRID REBUILD: the
  // quay strip is z 12.7..14.5 now.
  vantage_tracer_cam: { x: -41, y: 4.5, z: 19, look: { x: -52, y: 1, z: 13.5 }, district: 'quay' },
  // Widefire (part L): Elio STANDING on the wide Corso Azzurra
  // (north-south avenue, no monorail pillars on the firing line —
  // the boulevard's pillars split the frame), facing north up the
  // avenue toward the Azzura Tower, Guard closing from the north.
  // Camera LOW south-east of Elio, looking north — Elio in the left
  // third, the road + cruisers + sidewalk peds + tower ahead of him.
  widefire_spot: { x: 1.2, z: -8, angle: Math.PI / 2, district: 'cbd' },
  vantage_widefire_cam: { x: 2.0, y: 1.6, z: -5.5, look: { x: 0.8, y: 0.7, z: -16 }, district: 'cbd' },
  // Walk: low on the south sidewalk, looking east along the bay.
  // GRID REBUILD: the south sidewalk is at z 1.75..2.25 now.
  vantage_walk_cam: { x: -35.5, y: 3, z: 1.5, look: { x: -27.5, y: 1.4, z: 1.5 }, district: 'boulevard' },

  // --- CBD verification (stage 1) ---
  // The CBD centre (0, -6): the middle of the new CBD core, used by
  // ?debug=1&skip=1&at=cbd_center to load the world directly.
  cbd_center: { x: 0, z: -6, district: 'cbd' },
  // Street-level spot inside the CBD: Elio in the boulevard's north
  // lane at the x -15 street crossing, facing north-east toward the
  // Azzura Tower.
  cbd_street: { x: -15, z: -0.725, angle: 0.5, district: 'cbd' },
  // CBD camera vantages for ?shot=cbd.
  // Street: in the gap between the south-row towers, looking
  // north-east across the grid — Elio centre-frame, the tower rows
  // receding, the monorail deck overhead (not a ceiling).
  // Street-level CBD shot (Xian 21 Nov 15:02 — from the middle of the
  // avenue, towers on both sides): GRID REBUILD — the camera stands in
  // the boulevard's SOUTH lane (z 0.725) and looks EAST along it, so
  // the median pillars are off-centre (not dead centre) and the road,
  // median, lane markings, crosswalks and the tower rows on both sides
  // read in one frame. Elio stands at (-15, -0.725), in the north lane
  // at the x -15 street crossing.
  vantage_cbd_street: { x: -30, y: 3, z: 0.725, look: { x: 30, y: 6, z: 0 }, district: 'cbd' },
  // Bay: from the east over the water, looking west-northwest at the
  // skyline in 3/4 — the cluster reads in profile, the water in front.
  vantage_cbd_bay: { x: 15, y: 7, z: 90, look: { x: 0, y: 32, z: -12 }, district: 'cbd' },
  // Top: high oblique from the south (over the bay), looking down the
  // CBD grid — the tower heights, the boulevard and the bay all read.
  // (A true straight-down lookAt is degenerate in Three.js — the
  // camera tilts; the oblique is the check that matters.)
  // Top-down CBD check (Xian 21 Nov 15:02 — the streets must READ):
  // (0, 160, 12) — steep enough that the street grid shows between
  // the tower footprints. y 220 made the whole CBD too small to read
  // (the streets are 2.4 wide; at 220 they are ~12 px). The 60-floor
  // towers (120 units tall) lean in a perspective top-down — that is
  // a real aerial-photo effect, not a bug — and the grid reads in the
  // rooftop rows at the bottom of the frame. A true straight-down
  // lookAt is degenerate in Three.js, so the camera sits 18 units
  // south of the look point.
  // Top-down: telephoto straight down (y 420, fov 18 set in game.js) so
  // the 60-floor towers stand vertical and the street grid reads instead
  // of leaning over it. The old y 160 / fov 55 view leaned badly.
  vantage_cbd_top: { x: 0, y: 420, z: -6, look: { x: 0, y: 0, z: -6 }, district: 'cbd' },
};

// A mission stage target: { x, z, r } where r is the arrival radius.
export function anchor(name, r = 4) {
  const a = ANCHORS[name];
  if (!a) throw new Error('unknown anchor: ' + name);
  return { x: a.x, z: a.z, r };
}

// A plain ground position { x, z } — for checkpoint lists, engine
// positions and staging spots.
export function anchorXZ(name) {
  const a = ANCHORS[name];
  if (!a) throw new Error('unknown anchor: ' + name);
  return { x: a.x, z: a.z };
}
