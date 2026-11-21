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
  harbormaster_pavilion: { x: 3, z: 26, district: 'marina' },
  // The middle of the boulevard. M1 ESCAPE, M4 ESCAPE, M10 race finish
  // and PODIUM.
  boulevard_mid: { x: 0, z: 0, district: 'boulevard' },
  // Where the smuggler's car starts its boulevard loop (M2 TAIL).
  smuggler_start: { x: -20, z: -3.4, district: 'boulevard' },
  // The ends of the smuggler's boulevard loop (M2 TAIL wraps east<->west).
  tail_loop_east: { x: 56, z: -3.4, district: 'boulevard' },
  tail_loop_west: { x: -56, z: -3.4, district: 'boulevard' },
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
  // The front-row forecourt the M3 RETURN stage calls the casino
  // forecourt (the M2-era casino stood on the front row). Distinct from
  // the Casino Azzura forecourt on the promenade below.
  casino_forecourt_old: { x: -10, z: -19, district: 'boulevard' },
  // The trattoria on the front row (M4 MEET).
  trattoria_front: { x: -17, z: -19, district: 'boulevard' },
  // The foot of the old bell tower (M4 DROP).
  bell_tower: { x: -47, z: -36, district: 'old town' },
  // The fortress plaza in the old town — the chapel arcade (M5 RECON /
  // TAKE) and the old-town safehouse (M9 RUN / LAY LOW / REPORT), and
  // race checkpoint 1 (M10 RACE). In the new pocket, on the main street.
  fortress_plaza: { x: -47, z: -39, district: 'old town' },
  // The Casino Azzura forecourt on the promenade (M6 MEET, M10 race
  // checkpoint 2, M12 CONFRONT / DUEL / AFTERMATH). The M12 duel spawns
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
  // between the towers, on the boulevard. (Was the waterfront plaza
  // across the bay; the landmass is gone, the plaza moved downtown.)
  skyline_plaza: { x: 0, z: 0, district: 'cbd' },
  // The quay at the shore (M7 RETURN, M8 QUAY / SIGNAL, M11 ESCAPE).
  // STAGE 1 part 5: the new quay (z 31..35), at the water's edge.
  quay_end: { x: 0, z: 33, district: 'quay' },
  // The race start on the boulevard (M10 LINE UP) — also the drive /
  // night / storm ?shot staging car.
  race_start_1: { x: -30, z: -3.4, angle: 0, district: 'boulevard' },
  // Race checkpoint 3 on the promenade (M10 RACE) — the middle of the
  // promenade walkway, in front of the casino.
  promenade_mid: { x: 35, z: 29, district: 'promenade' },
  // The Azzura Tower lobby — LOBBY, the service LIFT and the penthouse
  // VAULT all stage here (M11). The tower stands at the CBD centre,
  // its lobby on the boulevard's north side. (Was across the bay.)
  tower_lobby: { x: 0, z: -2, district: 'cbd' },

  // --- spawns ---
  // Where Elio starts (and respawns after busted / wasted): the north
  // sidewalk of the boulevard, facing west into the town.
  player_spawn: { x: -2, z: -7.2, angle: Math.PI, district: 'boulevard' },
  // Where the hero car (Stella) starts: the boulevard north lane.
  car_spawn: { x: -8, z: -3.4, angle: 0, district: 'boulevard' },

  // --- ?shot staging: cars and players ---
  // The promenade ?shot staging car (east end of the boulevard, facing
  // west down the boulevard toward the CBD). STAGE 1 part 5: the old
  // promenade extension (x 60..108) is gone, so the car stages at the
  // boulevard's east end.
  boulevard_east: { x: 56, z: -3.4, angle: Math.PI, district: 'promenade' },
  // The ?shot staging car on Bay Avenue — the south side of the CBD,
  // facing north up the avenue toward the Azzura Tower.
  skyline_avenue: { x: 0, z: 12, angle: Math.PI / 2, district: 'cbd' },
  // The old-town ?shot staging car on the main cobbled street (west
  // end, facing east down the street toward the plaza).
  oldtown_main_street: { x: -52, z: -39, angle: 0, district: 'old town' },
  // The wanted ?shot staging car on the boulevard south lane.
  boulevard_mid_south: { x: 0, z: 3.4, angle: 0, district: 'boulevard' },
  // The combat / tracer ?shot staging spot: Elio crouched behind the
  // quay crate, facing east down the firing line.
  quay_cover_spot: { x: -53.5, z: 11.5, angle: 0, district: 'quay' },
  // The walk ?shot staging spot: Elio on the south sidewalk, facing
  // east toward the bay, boats and skyline.
  sidewalk_south: { x: -30, z: 7.2, angle: 0, district: 'boulevard' },
  // The M1 ?shot staging spot: Elio southwest of the pavilion, facing
  // its corner (the verified M1 STEAL shot). STAGE 1 part 5: the
  // pavilion moved to the marina strip.
  mission_m1_stage: { x: -3, z: 31, angle: Math.PI / 4, district: 'marina' },

  // --- ?shot staging: wheels close-ups (main.js) ---
  // The parked car spots on the north lane, and the far spots the other
  // cars are parked at (out of frame).
  wheels_spot_player: { x: 0, z: -3.4, district: 'boulevard' },
  wheels_spot_pickup: { x: 10, z: -3.4, district: 'boulevard' },
  wheels_spot_police: { x: -10, z: -3.4, district: 'boulevard' },
  wheels_far_player: { x: -40, z: -3.4, district: 'boulevard' },
  wheels_far_pickup: { x: 40, z: 3.4, district: 'boulevard' },
  wheels_far_police: { x: -40, z: 3.4, district: 'boulevard' },

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
  // across the frame, Elio in profile at the quay.
  vantage_tracer_cam: { x: -41, y: 4.5, z: 19, look: { x: -52, y: 1, z: 11.5 }, district: 'quay' },
  // Walk: low on the south sidewalk, looking east along the bay.
  vantage_walk_cam: { x: -35.5, y: 3, z: 7.2, look: { x: -27.5, y: 1.4, z: 7.2 }, district: 'boulevard' },

  // --- CBD verification (stage 1) ---
  // The CBD centre (0, -6): the middle of the new CBD core, used by
  // ?debug=1&skip=1&at=cbd_center to load the world directly.
  cbd_center: { x: 0, z: -6, district: 'cbd' },
  // Street-level spot inside the CBD: Elio at the boulevard crossing
  // of the north-south street between tower columns -18 and -12,
  // facing north-east toward the Azzura Tower.
  cbd_street: { x: -15, z: 0, angle: 0.5, district: 'cbd' },
  // CBD camera vantages for ?shot=cbd.
  // Street: in the gap between the south-row towers, looking
  // north-east across the grid — Elio centre-frame, the tower rows
  // receding, the monorail deck overhead (not a ceiling).
  // Street-level CBD shot (Xian 21 Nov 15:02 — from the middle of the
  // avenue, towers on both sides): the camera stands ON the boulevard
  // and looks EAST along it, so the road, its median, lane markings
  // and the tower rows on both sides read in one frame. It sits in the
  // SOUTH lane (z 3), not on the centreline (z 0) — the monorail
  // pillars stand at z 0 and a centreline camera puts one dead centre
  // in the frame. Elio stands at (-15, 0), in the middle of the
  // boulevard at the x -15 street crossing.
  vantage_cbd_street: { x: -30, y: 3, z: 3, look: { x: 30, y: 6, z: 3 }, district: 'cbd' },
  // Bay: from the east over the water, looking west-northwest at the
  // skyline in 3/4 — the cluster reads in profile, the water in front.
  vantage_cbd_bay: { x: 55, y: 14, z: 38, look: { x: -5, y: 45, z: -9 }, district: 'cbd' },
  // Top: high oblique from the south (over the bay), looking down the
  // CBD grid — the tower heights, the boulevard and the bay all read.
  // (A true straight-down lookAt is degenerate in Three.js — the
  // camera tilts; the oblique is the check that matters.)
  // Top-down CBD check (Xian 21 Nov 15:02 — the streets must READ):
  // the camera sits well ABOVE the tallest tower (60 floors x 2.0 =
  // 120 units) so the towers do not lean over the streets — at y 160
  // the 120-unit towers filled the frame and hid the grid. At y 220
  // the whole CBD reads as a grid of rooftops with the streets between
  // them. A true straight-down lookAt is degenerate in Three.js, so
  // the camera sits 20 units south of the look point.
  vantage_cbd_top: { x: 0, y: 220, z: 14, look: { x: 0, y: 0, z: -6 }, district: 'cbd' },
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
