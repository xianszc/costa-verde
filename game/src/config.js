// COSTA VERDE — config: palette, city layout, districts, vehicles, tuning.
// Everything data-driven: districts, vehicles and the Slice 1 objective live
// here as plain objects so later slices add content without touching the loop.

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
    count: 7,
    colors: [0xd84a4a, 0x4a7fd8, 0xf2c14e, 0xe8e4da, 0x7a4ad8, 0x3aa88f, 0xd87a2e],
    speed: 9,
  },
  peds: { count: 12 },
  saveKey: 'costa-verde-save-v1',
};

// Districts: name, centre, radius, look (building height range + base colour).
export const DISTRICTS = [
  { name: 'Marina Bay', cx: 170, cz: -40, r: 95, hMin: 10, hMax: 26, color: 0x4a7f9e, tag: 'Waterfront' },
  { name: 'Old Town', cx: -80, cz: -90, r: 110, hMin: 6, hMax: 16, color: 0xc98a4b, tag: 'Historic' },
  { name: 'Downtown', cx: -40, cz: 90, r: 120, hMin: 18, hMax: 58, color: 0x5a6f8f, tag: 'CBD' },
  { name: 'Palms Row', cx: 120, cz: 120, r: 90, hMin: 8, hMax: 20, color: 0x9e7a4a, tag: 'Boulevard' },
];

// Slice 1 objective (light story hook — full missions land in Slice 3).
export const SLICE1 = {
  title: 'FIRST LIGHT',
  steps: [
    { id: 'meet', text: 'Meet Ana at the Marina', target: { x: 178, z: -18 }, radius: 6 },
    { id: 'drive', text: 'Take the Verde GT for a spin', target: null, radius: 0 },
    { id: 'done', text: 'Slice 1 complete — free roam', target: null, radius: 0 },
  ],
  heroSpawn: { x: 0, z: 0, heading: Math.PI / 2 },
  carSpawn: { x: 6, z: 8, heading: Math.PI / 2 },
  anaSpawn: { x: 178, z: -18 },
};
