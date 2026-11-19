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
    elevationDeg: 17, // Slice 4: a touch higher than 14 — more light on
    // vertical faces, shorter shadows, still golden hour (never night).
    color: 0xffb066,
    intensity: 2.8,
    ambientSky: 0x9a8fc7, // Round 5: lavender to match the purple-pink dusk sky
    ambientGround: 0x8a7a66, // Slice 4: brighter bounce — sun-back sides
    // must not read black.
    ambientIntensity: 1.05, // Slice 4: was 0.68 — the old value left roads
    // and shadowed facades almost black in screenshots.
    fillColor: 0xffd9b0, // Slice 4: warm bounce light from the east (the
    // sun-back side), no shadows — a cheap fill so nothing is pure black.
    fillIntensity: 0.65, // Round 5: was 0.5 — east-facing facades still
    // read too dark in the inspection shots.
    fogColor: 0xdd7a8f, // Round 5: pinkish dusk haze to match the new sky
    fogNear: 180,
    fogFar: 620,
  },
  sky: {
    // Round 5 neon dusk (reference atmosphere): purple zenith, pink mid,
    // warm orange horizon. Still golden hour — the horizon stays bright,
    // the zenith is a mid purple, never black.
    top: '#4a3670',
    mid: '#d96a9e',
    low: '#ffb066',
    sunDisc: '#fff3c4',
  },
  sea: { color: 0x2e7f8f, deepColor: 0x1d5a6e, shoreX: 236 },
  palette: {
    asphalt: '#52525c', // Slice 4: was #3a3a40 — in shadow it read as a
    // black slab; the road must stay readable at a glance.
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
    // heat rises so escaping a 5-star chase is genuinely hard. Slice 3:
    // 43 (was 40) — at 1 star the cruiser is 44.5 vs the GT's 46, so
    // flooring it is no longer a free escape; distance still loses them.
    topSpeed: 43,
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

// --- Story missions (Slice 3) -------------------------------------------------
// The arc: Ana is an ex-SPD detective using Leo to expose the ledger that
// proves who really runs Costa Verde. Every job pays; every job costs.
// Missions are data: the manager in missions.js reads these, nothing about
// a mission's flow is hard-coded into the render loop.
// Mission 0 (FIRST LIGHT) keeps the Slice 1 flow in main.js; missions 1–4
// start at Ana (the mission giver) — finish one, return to her for the next.
// A step with `target` completes when the player (or their car) enters the
// radius; a `clear` step completes when every spawned enemy is down.
export const MISSIONS = [
  {
    id: 'first-light', title: 'FIRST LIGHT', reward: 500,
    steps: [
      { id: 'meet', text: 'Meet Ana at the Marina', target: { x: 178, z: -18 }, radius: 6 },
      { id: 'drive', text: 'Take the Verde GT for a spin', target: null, radius: 0 },
    ],
  },
  {
    id: 'the-run', title: 'THE RUN', reward: 800, timeLimit: 120, // Slice 4: was 150 — too loose; the tension should come from the police, not the clock
    briefing: [
      { who: 'Ana', text: 'Leo. I need a package moved — no questions, no cops. Downtown drop, two minutes. The GT is fast enough.' },
      { who: 'Leo', text: 'Two minutes? You never ask for easy things.' },
      { who: 'Ana', text: "That's why I asked you." },
    ],
    steps: [
      { id: 'deliver', text: 'Deliver the package to the Downtown drop', target: { x: 37, z: 111 }, radius: 8 },
    ],
    next: 'Return to Ana for the next job.',
  },
  {
    id: 'loud-and-clear', title: 'LOUD AND CLEAR', reward: 1200,
    briefing: [
      { who: 'Ana', text: "Maro's crew hit my stash in Old Town. My informant's name is in that box — and so is his." },
      { who: 'Leo', text: 'So I go in loud?' },
      { who: 'Ana', text: 'Loud is the only language they speak.' },
    ],
    steps: [
      { id: 'go', text: 'Reach the Old Town warehouse', target: { x: -111, z: -148 }, radius: 10 },
      { id: 'clear', text: 'Clear the crew — take out the guards', clear: true, center: { x: -111, z: -148 } },
      { id: 'grab', text: "Grab the informant's package", target: { x: -111, z: -148 }, radius: 5 },
    ],
    next: 'Return to Ana for the next job.',
  },
  {
    id: 'the-escort', title: 'THE ESCORT', reward: 1500,
    briefing: [
      { who: 'Ana', text: "My contact is driving in from Old Town. Two of Maro's cars are hunting him." },
      { who: 'Leo', text: "And I'm the shield." },
      { who: 'Ana', text: "Keep him alive, Leo. He's the only one who knows where the money went." },
    ],
    steps: [
      { id: 'meet', text: 'Meet the contact at Palms Row', target: { x: 111, z: 148 }, radius: 8 },
      { id: 'escort', text: 'Escort the contact to the safehouse — stay close', escort: true },
    ],
    next: 'Return to Ana for the next job.',
  },
  {
    id: 'the-verde-heist', title: 'THE VERDE HEIST', reward: 3000,
    briefing: [
      { who: 'Ana', text: 'The truth, Leo. The Verde Bank vault holds the ledger that proves who really runs this city.' },
      { who: 'Leo', text: 'A bank job. With four stars waiting outside.' },
      { who: 'Ana', text: 'You wanted to know what I really want from you. This. All of it.' },
      { who: 'Leo', text: "Then let's finish it." },
    ],
    steps: [
      { id: 'bank', text: 'Reach the Verde Bank — Downtown', target: { x: -37, z: 100 }, radius: 8 },
      { id: 'clear', text: 'Clear the bank guards', clear: true, center: { x: -37, z: 100 } },
      { id: 'grab', text: 'Grab the evidence locker', target: { x: -37, z: 100 }, radius: 5 },
      { id: 'escape', text: 'Escape — 4 stars! Reach the Marina drop', target: { x: 178, z: -18 }, radius: 8, heat: 4 },
    ],
    next: 'Story complete — the city is yours.',
  },
];

// Reputation: rep rises with completed jobs (+15 mission, +5 side job,
// +2 cache). Higher standing = cheaper garage parts.
export const REP_LEVELS = [
  { name: 'OUTSIDER', min: 0, discount: 0 },
  { name: 'KNOWN', min: 30, discount: 0 },
  { name: 'RESPECTED', min: 80, discount: 0.2 },
  { name: 'RUNS THE BLOCK', min: 150, discount: 0.4 },
];
export const REP_GAIN = { mission: 15, sideJob: 5, cache: 2 };

// Garage upgrades (bought with cash at the safehouse, key G on foot).
export const UPGRADES = {
  armour: { name: 'Body Armour', desc: '+50 max health', price: 800 },
  nitro: { name: 'Nitro Kit', desc: 'Hold Shift while driving the GT for a boost', price: 1200 },
  engine: { name: 'Verde GT Engine Tune', desc: '+8 m/s top speed for the GT', price: 1500 },
};

// Armed enemies (Slice 3 shootouts): 3 pistol hits to drop one (75 hp).
export const ENEMIES = {
  hp: 75,
  count: 4,
  shootInterval: 1.5,
  shootRange: 34,
  hitChance: 0.35,
  damage: 6,
};

// Escort job (M4): the contact's car, its route, and the hunters.
export const ESCORT = {
  hp: 100,
  speed: 13,
  color: 0x2e7f8f,
  start: { x: 111, z: 148 },
  waypoints: [
    { x: 111, z: -111 },
    { x: -37, z: -111 },
    { x: -37, z: 111 },
    { x: 150, z: 111 },
  ],
  maxDist: 45, // stray farther than this for 10 s and the job fails
  farTime: 10, // Slice 4: was 8 — too sudden when a wrong turn costs 8 s
  foes: 2,
  foeHp: 60,
  foeSpeed: 20,
  foeRamDamage: 10,
  playerRamDamage: 20, // ramming a hunter at speed hurts it
};

// Side jobs (Slice 3): fares, courier deliveries, hidden caches.
export const SIDE = {
  fare: {
    cooldownSec: 20, // after a fare ends before the next one can appear
    timeLimit: 90,
    basePay: 100, perMetre: 1, maxPay: 300,
    pickups: [
      { x: 179.5, z: -80 }, { x: 105.5, z: 40 }, { x: -30.5, z: -80 },
      { x: 43.5, z: 100 }, { x: -105.5, z: -40 }, { x: 190.5, z: 60 },
    ],
  },
  delivery: {
    cooldownSec: 20,
    timeLimit: 75,
    pay: 150,
    pickups: [
      { x: -111, z: -148 }, // Old Town warehouse
      { x: 178, z: -100 }, // Marina depot — kept clear of the parked taxi at (179.5,-60) so E still enters the car there
    ],
    dests: [
      { x: 37, z: 111 }, { x: -37, z: 100 }, { x: 111, z: 148 }, { x: -185, z: 0 },
    ],
  },
  cache: {
    pay: 100,
    spots: [
      { x: 178, z: -30 }, { x: 196, z: 60 }, { x: -150, z: 140 }, { x: 60, z: 150 },
      { x: -40, z: 90 }, { x: 120, z: 120 }, { x: 185, z: -150 }, { x: -185, z: 0 },
      { x: 0, z: 185 }, { x: 60, z: -150 },
    ],
  },
};
