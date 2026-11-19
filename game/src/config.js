// COSTA VERDE Slice 2 — config: palette, city layout, districts, vehicles,
// police + combat tuning. Everything data-driven: districts, vehicles,
// missions and the wanted system live here as plain objects so later slices
// add content without touching the loop.
// Slice 2 (core loop): wanted + police, more stealable vehicles, combat.

export const CFG = {
  // World size (metres). City grid is square; the sea lies east of the city.
  citySize: 420,
  blockSize: 60,
  roadWidth: 14,
  // Golden hour: low sun in the west, warm light, long shadows to the east.
  sun: {
    azimuthDeg: 262, // almost due west, slightly south
    elevationDeg: 14, // low sun
    color: 0xffb066,
    intensity: 2.6,
    ambientSky: 0x8fa3c7,
    ambientGround: 0x5a4636,
    ambientIntensity: 0.68,
    fogColor: 0xf2a35e,
    fogNear: 180,
    fogFar: 620,
  },
  sky: {
    top: '#3d5a8f',
    mid: '#e8906b',
    low: '#ffc27a',
    sunDisc: '#fff3c4',
  },
  sea: { color: 0x2e7f8f, deepColor: 0x1d5a6e, shoreX: 236 },
  palette: {
    asphalt: '#3a3a40',
    sidewalk: '#b9a98c',
    curb: '#8a7a5f',
    sand: '#e8cf9e',
    grass: '#7fae5a',
    buildingGlass: '#2c3e55',
  },
  // Third-person camera (v1.1: closer + lower + wider FOV = more dramatic).
  camera: {
    fov: 68,
    driveDist: 8, // hero car fills more of the frame
    footDist: 5.5, // Leo fills more of the frame
    pitch: 0.24, // lower angle, city looms around the player
  },
  player: {
    walkSpeed: 6,
    runSpeed: 10,
    accel: 40,
    turnSpeed: 9,
    radius: 0.55,
    maxHealth: 100,
    // Slow regen once the heat is gone — forgiving, no punishing grind.
    regenPerSec: 2,
  },
  // Respawn point (hospital / safehouse corner, Marina Bay edge).
  safehouse: { x: 150, z: 60 },
  // Vehicle specs — every drivable car is one of these. Handling differs on
  // purpose: the GT is fast and twitchy, the van is slow and heavy, the
  // cruiser is fast with sharp steering, the taxi sits in the middle.
  vehicles: {
    verdeGT: {
      kind: 'car', name: 'VERDE GT', color: 0x70e000,
      topSpeed: 46, accel: 26, brake: 42, reverseSpeed: 12, steer: 1.9, grip: 8,
    },
    taxi: {
      kind: 'van', name: 'TAXI CAB', color: 0xf2c14e, taxi: true,
      topSpeed: 30, accel: 16, brake: 30, reverseSpeed: 10, steer: 1.6, grip: 8,
    },
    van: {
      kind: 'van', name: 'DELIVERY VAN', color: 0xe8e4da,
      topSpeed: 26, accel: 12, brake: 26, reverseSpeed: 9, steer: 1.3, grip: 8,
    },
    cruiser: {
      kind: 'cruiser', name: 'SPD CRUISER', color: 0x1a1a1e,
      topSpeed: 44, accel: 28, brake: 44, reverseSpeed: 12, steer: 2.1, grip: 9,
    },
  },
  heroCar: null, // filled below: the hero drives the Verde GT
  traffic: {
    count: 18, // busy streets (v1.1)
    colors: [0xd84a4a, 0x4a7fd8, 0xf2c14e, 0xe8e4da, 0x7a4ad8, 0x3aa88f, 0xd87a2e, 0x2e7f8f, 0xc94a7a, 0x8a8a8a],
    speed: 9,
  },
  peds: { count: 32 }, // crowded sidewalks (v1.1)
  saveKey: 'costa-verde-save-v1',
  // --- Wanted + police (Slice 2) -------------------------------------------
  wanted: {
    maxStars: 5,
    // Heat is a float; wanted = floor(heat). Crimes push heat up, escaping
    // lets it bleed off. 1 star = 1 heat, so stealing a car is 1 star.
    stealCar: 1.0, // stealing any parked car (GT included — Ana gifts it, see below)
    hitPed: 1.0, // ramming a pedestrian while driving
    ramPolice: 1.0, // ramming a police cruiser
    shootCop: 1.0, // shooting a police cruiser or officer
    shootCivilian: 0.5, // shooting a traffic car or a pedestrian
    decayPerSec: 0.55, // bleed while unseen
    graceSec: 3.0, // no decay right after a crime (lets the first cruiser arrive)
    seenRadius: 60, // a cop inside this radius keeps the heat up (covers a fresh spawn)
    maxPolice: 4, // patrol cars on the map at once (1 at 1 star, +1 per star)
    heliAtStars: 3, // helicopter joins at 3 stars
    // BUSTED: on foot, nearly still, a cop beside you for this long.
    bustRadius: 4.5,
    bustTime: 1.5,
    bustFine: 100, // cash lost on BUSTED / WASTED
  },
  police: {
    // Pursuit car: slightly slower than the GT at low heat, faster as the
    // heat rises so escaping a 5-star chase is genuinely hard.
    topSpeed: 40,
    topSpeedPerStar: 1.5,
    accel: 24,
    brake: 36,
    reverseSpeed: 10,
    steer: 2.0,
    grip: 9,
    ramDamage: 8, // health lost when a cruiser rams the player's car
    ramCooldown: 1.0, // seconds between rams from the same car
    shootRange: 24, // cops shoot the player on foot inside this range
    shootInterval: 0.9, // seconds between shots per car
    shootHitChance: 0.45,
    shootDamage: 5,
    // A disabled cruiser (shot 4 times) sits dead for this long, then rejoins
    // the chase if the heat is still up.
    disabledSec: 8,
    // Spawn distance from the player (on a road, clamped into the city).
    // 38 m sits just inside the 40 m seen radius, so a fresh unit is "seen"
    // at once — the heat cannot bleed away before the first cruiser arrives.
    spawnDist: 38,
    despawnDist: 140,
  },
  heli: {
    height: 42,
    followDist: 14,
    speed: 16,
  },
  // Pistol (Slice 2 combat).
  pistol: {
    magSize: 12,
    reloadSec: 1.2,
    damage: 25, // 4 hits disable a cruiser (100 hp)
    range: 90,
  },
};

CFG.heroCar = CFG.vehicles.verdeGT;

// Districts: name, centre, radius, look (building height range + base colour).
// Downtown is a dense CBD — taller towers (hMax 72) packed close.
export const DISTRICTS = [
  { name: 'Marina Bay', cx: 170, cz: -40, r: 95, hMin: 10, hMax: 30, color: 0x4a7f9e, tag: 'Waterfront' },
  { name: 'Old Town', cx: -80, cz: -90, r: 110, hMin: 6, hMax: 18, color: 0xc98a4b, tag: 'Historic' },
  { name: 'Downtown', cx: -40, cz: 90, r: 120, hMin: 22, hMax: 72, color: 0x5a6f8f, tag: 'CBD' },
  { name: 'Palms Row', cx: 120, cz: 120, r: 90, hMin: 8, hMax: 22, color: 0x9e7a4a, tag: 'Boulevard' },
];

// Slice 1 objective (light story hook — full missions land in Slice 3).
export const SLICE1 = {
  title: 'FIRST LIGHT',
  steps: [
    { id: 'meet', text: 'Meet Ana at the Marina', target: { x: 178, z: -18 }, radius: 6 },
    { id: 'drive', text: 'Take the Verde GT for a spin', target: null, radius: 0 },
    { id: 'done', text: 'Slice 1 complete — free roam', target: null, radius: 0 },
  ],
  // v1.1: spawns sit ON road x=37 (curb side), never inside a block — the
  // dense 2x2-lot blocks now fill the ground the old (6,8) spawn stood on.
  heroSpawn: { x: 30, z: -6, heading: Math.PI / 2 },
  carSpawn: { x: 31.5, z: -1, heading: 0 },
  anaSpawn: { x: 178, z: -18 },
};

// Stealable parked cars (Slice 2): a taxi, a delivery van and a police
// cruiser waiting at the curb. Stealing any of them is a crime (+1 heat) —
// except the Verde GT, which Ana gifts to Leo in the Slice 1 objective.
export const PARKED_CARS = [
  { spec: 'taxi', x: 179.5, z: -60, heading: 0 },
  { spec: 'van', x: 190.5, z: 20, heading: Math.PI },
  { spec: 'cruiser', x: -30.5, z: -105.5, heading: 0 },
  { spec: 'taxi', x: 105.5, z: 30, heading: -Math.PI / 2 },
  { spec: 'van', x: 43.5, z: 118, heading: Math.PI / 2 },
  { spec: 'cruiser', x: -105.5, z: -30, heading: Math.PI / 2 },
];
