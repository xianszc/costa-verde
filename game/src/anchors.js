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
  harbormaster_pavilion: { x: 50, z: -19, district: 'marina' },
  // The middle of the boulevard. M1 ESCAPE, M4 ESCAPE, M10 race finish
  // and PODIUM.
  boulevard_mid: { x: 0, z: 0, district: 'boulevard' },
  // Where the smuggler's car starts its boulevard loop (M2 TAIL).
  smuggler_start: { x: -20, z: -3.4, district: 'boulevard' },
  // The ends of the smuggler's boulevard loop (M2 TAIL wraps east<->west).
  tail_loop_east: { x: 56, z: -3.4, district: 'boulevard' },
  tail_loop_west: { x: -56, z: -3.4, district: 'boulevard' },
  // The stair-street at the north end of the old town (M3 CLIMB).
  stair_street_north: { x: 0, z: -38, district: 'old town' },
  // The three north-row doors for the M3 courier run (DELIVER). The
  // engine falls back to these when a deliver stage lists no targets.
  north_door_1: { x: -30, z: -35, district: 'old town' },
  north_door_2: { x: 10, z: -35, district: 'old town' },
  north_door_3: { x: 40, z: -35, district: 'old town' },
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
  // race checkpoint 1 (M10 RACE).
  fortress_plaza: { x: -29, z: -70, district: 'old town' },
  // The Casino Azzura forecourt on the promenade (M6 MEET, M10 race
  // checkpoint 2, M12 CONFRONT / DUEL / AFTERMATH). The M12 duel spawns
  // Aldo here, facing the boulevard.
  casino_forecourt: { x: 88, z: -10, district: 'promenade' },
  // The Casino Azzura entrance. It is the same point as the forecourt
  // in the current city (the forecourt IS the entrance staging point);
  // the layout rebuild may split them, so they are separate anchors.
  casino_entrance: { x: 88, z: -10, district: 'promenade' },
  // The west end of the boulevard (M6 VANISH).
  boulevard_west: { x: -50, z: 0, district: 'boulevard' },
  // The waterfront plaza across the bay (M7 CROSS / SCAN).
  skyline_plaza: { x: 0, z: 66, district: 'skyline' },
  // The quay where the bridge meets the shore (M7 RETURN, M8 QUAY /
  // SIGNAL, M11 ESCAPE).
  quay_end: { x: 0, z: 13, district: 'quay' },
  // The race start on the boulevard (M10 LINE UP) — also the drive /
  // night / storm ?shot staging car.
  race_start_1: { x: -30, z: -3.4, angle: 0, district: 'boulevard' },
  // Race checkpoint 3 on the promenade (M10 RACE).
  promenade_mid: { x: 60, z: 0, district: 'promenade' },
  // The Azzura Tower lobby — LOBBY, the service LIFT and the penthouse
  // VAULT all stage here (M11). The tower stands behind the plaza.
  tower_lobby: { x: 4.2, z: 83, district: 'skyline' },

  // --- spawns ---
  // Where Elio starts (and respawns after busted / wasted): the north
  // sidewalk of the boulevard, facing west into the town.
  player_spawn: { x: -2, z: -7.2, angle: Math.PI, district: 'boulevard' },
  // Where the hero car (Stella) starts: the boulevard north lane.
  car_spawn: { x: -8, z: -3.4, angle: 0, district: 'boulevard' },

  // --- ?shot staging: cars and players ---
  // The promenade ?shot staging car (east end of the boulevard, facing
  // west down the deco row toward the casino).
  boulevard_east: { x: 84, z: -3.4, angle: Math.PI, district: 'promenade' },
  // The skyline ?shot staging car on Bay Avenue (facing north up the
  // avenue toward the towers).
  skyline_avenue: { x: 0, z: 72, angle: Math.PI / 2, district: 'skyline' },
  // The old-town ?shot staging car on the main cobbled street.
  oldtown_main_street: { x: -30, z: -56, angle: 0, district: 'old town' },
  // The wanted ?shot staging car on the boulevard south lane.
  boulevard_mid_south: { x: 0, z: 3.4, angle: 0, district: 'boulevard' },
  // The combat / tracer ?shot staging spot: Elio crouched behind the
  // quay crate, facing east down the firing line.
  quay_cover_spot: { x: -53.5, z: 11.5, angle: 0, district: 'quay' },
  // The walk ?shot staging spot: Elio on the south sidewalk, facing
  // east toward the bay, boats and skyline.
  sidewalk_south: { x: -30, z: 7.2, angle: 0, district: 'boulevard' },
  // The M1 ?shot staging spot: Elio southwest of the pavilion, facing
  // its corner (the verified M1 STEAL shot).
  mission_m1_stage: { x: 34, z: -12, angle: Math.PI / 4, district: 'marina' },

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
  // street, looking west down the cobbles.
  vantage_oldtown_cam: { x: -2, y: 8, z: -62, look: { x: -48, y: 1, z: -56 }, district: 'old town' },
  // Promenade: high above the boulevard's west end, looking east-down
  // at the boulevard, the deco row, the Casino Azzura and the hotel.
  vantage_promenade_cam: { x: 60, y: 18, z: 8, look: { x: 100, y: 0, z: -12 }, district: 'promenade' },
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
  // Street-level spot inside the CBD: Elio on the boulevard south
  // lane at the CBD's west end, facing east down the boulevard — the
  // tower rows line both sides and the monorail deck runs overhead.
  // (A head-on shot from the south fills the frame with one tower
  // face; the along-the-boulevard angle reads as a street.)
  cbd_street: { x: -24, z: 3.4, angle: 0, district: 'cbd' },
  // CBD camera vantages for ?shot=cbd.
  // Street: low behind Elio on the boulevard, looking east down the
  // tower rows toward the CBD centre.
  vantage_cbd_street: { x: -32, y: 3, z: 3.4, look: { x: 0, y: 12, z: -3.4 }, district: 'cbd' },
  // Bay: over the water south of the quay, looking north at the skyline.
  vantage_cbd_bay: { x: 0, y: 9, z: 48, look: { x: 0, y: 35, z: -9 }, district: 'cbd' },
  // Top: straight down over the CBD grid.
  vantage_cbd_top: { x: 0, y: 150, z: -6, look: { x: 0, y: 0, z: -6 }, district: 'cbd' },
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
