// COSTA VERDE v1.1 — config: palette, city layout, districts, vehicles, tuning.
// Everything data-driven: districts, vehicles and the Slice 1 objective live
// here as plain objects so later slices add content without touching the loop.
// v1.1 (Xian's review): denser city, closer camera, busier streets.

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
    driveDist: 8, // was 11 — hero car fills more of the frame
    footDist: 5.5, // was 7.5 — Leo fills more of the frame
    pitch: 0.24, // was 0.32 — lower angle, city looms around the player
  },
  player: {
    walkSpeed: 6,
    runSpeed: 10,
    accel: 40,
    turnSpeed: 9,
    radius: 0.55,
  },
  heroCar: {
    name: 'VERDE GT',
    color: 0x70e000, // acid lime signature car
    topSpeed: 46, // m/s (~166 km/h)
    accel: 26,
    brake: 42,
    reverseSpeed: 12,
    steer: 1.9,
    grip: 8,
  },
  traffic: {
    count: 18, // was 7 — busy streets (Xian)
    colors: [0xd84a4a, 0x4a7fd8, 0xf2c14e, 0xe8e4da, 0x7a4ad8, 0x3aa88f, 0xd87a2e, 0x2e7f8f, 0xc94a7a, 0x8a8a8a],
    speed: 9,
  },
  peds: { count: 32 }, // was 12 — crowded sidewalks (Xian)
  saveKey: 'costa-verde-save-v1',
};

// Districts: name, centre, radius, look (building height range + base colour).
// v1.1: Downtown is a dense CBD — taller towers (hMax 72) packed close.
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
