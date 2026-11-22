// AZZURA HEIST — side content (M4, parallel build).
// Shops, full-screen map + waypoints, side jobs, races, stunt jumps,
// collectibles, district standing, rank unlocks. Runs BESIDE the story
// game: a second mission engine for jobs/races, its own persistence,
// its own HUD panel + map overlay + toast. It never edits game.js or
// main.js — it attaches to window.__game when the game boots (main.js
// imports this module), or via attachSideContent(game) if the parent
// wires it in later. Owned files only: this module + side-*.js +
// anchors-side.js + hud.css (its styles: #side-toast, #side-job-panel,
// #map-overlay, #shop-overlay, #side-prompt, #side-hud).
import * as THREE from '../vendor/three.module.min.js';
import { ANCHORS, anchorXZ } from './anchors.js';
import { createMissionEngine } from './missions.js';
import { buildTrafficCar } from './vehicles.js';
import { SIDE_DISTRICTS, RANK_LADDER, RANK_REWARDS, rankForXp, standingTier } from './side-data.js';
import { SIDE_JOBS } from './side-jobs.js';
import { SIDE_RACES } from './side-races.js';
import { SIDE_JUMPS } from './side-jumps.js';
import { COLLECTIBLES } from './side-collectibles.js';
import { SHOP_SECTIONS, OUTFITS, STOCK_PAINT } from './side-shops.js';
import { SIDE_SPOTS } from './anchors-side.js';
import { xform, colored, mergedMesh } from './world.js';

const STORE_KEY = 'azzura-side-v1';
const ACTIVITIES = [...SIDE_JOBS, ...SIDE_RACES];
const JUMP_SPEED = 10; // game speed units (~36 km/h) to land a stunt jump.
// GAME fix (3c.4, 22 Nov ~16:55): was 16. From standstill the Stella
// (accel 15) needs 8.5u to reach 16 — an 85 m run-up, longer than the
// 4u the launch pads span — so the gate was unreachable from its own
// run-up (SJ1 fast FAIL 13.0 m/s; probe /tmp/car-speed-debug.mjs).
// At 10 the car crosses the gate plane at 10.95 m/s from a 4u run-up,
// and the segment-crossing detection below makes that reliable at any
// frame rate. The slow-pass negative (~6 m/s) still has margin.
const COLLECT_R = 2; // metres to pick up a collectible

function defaults() {
  const standing = {};
  for (const d of SIDE_DISTRICTS) standing[d.id] = 30;
  return {
    version: 1,
    jobsDone: {}, racesBest: {}, jumpsDone: [], collectiblesDone: [],
    standing, outfitsOwned: ['street'], paintsOwned: ['coral'],
    outfit: 'street', paint: STOCK_PAINT, tunes: { engine: 0, brakes: 0 },
    ranksClaimed: [], coinsBonusClaimed: false, jumpsBonusClaimed: false,
  };
}
function loadStore() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return d;
    return {
      ...d, ...s,
      standing: { ...d.standing, ...(s.standing || {}) },
      tunes: { ...d.tunes, ...(s.tunes || {}) },
      jobsDone: s.jobsDone || {}, racesBest: s.racesBest || {},
      jumpsDone: Array.isArray(s.jumpsDone) ? s.jumpsDone : [],
      collectiblesDone: Array.isArray(s.collectiblesDone) ? s.collectiblesDone : [],
      outfitsOwned: Array.isArray(s.outfitsOwned) && s.outfitsOwned.length ? s.outfitsOwned : ['street'],
      paintsOwned: Array.isArray(s.paintsOwned) && s.paintsOwned.length ? s.paintsOwned : ['coral'],
      ranksClaimed: Array.isArray(s.ranksClaimed) ? s.ranksClaimed : [],
    };
  } catch (e) { return d; }
}

const store = loadStore();
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage full/blocked: play on */ }
}

// --- helpers ---
const fmtMoney = (n) => 'S ' + Math.floor(n).toLocaleString('en-US');
function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function rankIndex(name) {
  return RANK_LADDER.findIndex((r) => r.name === name);
}
function hexCss(h) {
  return '#' + h.toString(16).padStart(6, '0');
}
function dist2(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// --- module state ---
let game = null;
let attached = false;
let engine = null;
let active = null; // { idx, def } | null
let activeFailHandled = false;
let waypoint = null; // { name, x, z } | null
let mapOpen = false;
let mapPausedByMe = false;
let mapDataCache = null;
let lastPanel = 0;
let lastToastAt = 0;

const markers = { coins: [], gates: [], signs: [], jobs: [] };
let beacon = null;
let waypointBeacon = null;
let smugglerMesh = null;
let outfitRoles = null; // { top: [materials], bottom, shoes, accent }
let currentPaint = STOCK_PAINT;

function el(id) { return document.getElementById(id); }
function toast(msg) {
  const t = el('side-toast');
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  lastToastAt = performance.now();
  clearTimeout(t._fade);
  t._fade = setTimeout(() => { t.style.opacity = '0'; }, 3600);
}

function addStanding(district, pts) {
  if (!district || store.standing[district] === undefined) return;
  store.standing[district] = Math.max(0, Math.min(100, store.standing[district] + pts));
  persist();
}
function shopDiscount(section) {
  const pts = store.standing[section.district] || 0;
  return pts >= 60 ? 0.9 : 1;
}
function priceFor(section, item) {
  return Math.max(1, Math.round(item.price * shopDiscount(section)));
}
function rankUnlocked(rankName) {
  if (!rankName || !game) return true;
  return rankIndex(rankForXp(game.state.xp)) >= rankIndex(rankName);
}
function itemOwned(section, item) {
  if (item.kind === 'outfit') return store.outfitsOwned.includes(item.outfit);
  if (item.kind === 'paint') return store.paintsOwned.includes(item.id.replace('paint-', ''));
  if (item.kind === 'tune') return (store.tunes[item.tune] || 0) >= item.level;
  return false;
}
function itemApplied(section, item) {
  if (item.kind === 'outfit') return store.outfit === item.outfit;
  if (item.kind === 'paint') return store.paint === item.paint;
  return false;
}

// --- outfits / paint / tunes (live game objects) ---
function captureOutfitRoles() {
  if (!game || outfitRoles) return;
  const spec = { top: 0xf7ebd7, bottom: 0x2e4a5e, shoes: 0x6b4a2a, accent: 0xe4572e };
  const roles = { top: [], bottom: [], shoes: [], accent: [] };
  game.player.mesh.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    const hex = o.material.color.getHex();
    for (const role of Object.keys(spec)) {
      if (hex === spec[role] && !roles[role].includes(o.material)) roles[role].push(o.material);
    }
  });
  outfitRoles = roles;
}
function applyOutfit(id) {
  const o = OUTFITS[id];
  if (!o || !outfitRoles) return false;
  for (const role of ['top', 'bottom', 'shoes', 'accent']) {
    for (const m of outfitRoles[role]) m.color.setHex(o[role]);
  }
  store.outfit = id;
  persist();
  return true;
}
function applyPaint(hex) {
  if (!game) return false;
  const from = new THREE.Color(currentPaint);
  const to = new THREE.Color(hex);
  let changed = 0;
  game.car.mesh.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.color) return;
    const attr = o.geometry.attributes.color;
    for (let i = 0; i < attr.count; i++) {
      const r = attr.getX(i), g = attr.getY(i), b = attr.getZ(i);
      if (Math.abs(r - from.r) < 0.05 && Math.abs(g - from.g) < 0.05 && Math.abs(b - from.b) < 0.05) {
        attr.setXYZ(i, to.r, to.g, to.b);
        changed++;
      }
    }
    if (changed) attr.needsUpdate = true;
  });
  if (changed) {
    currentPaint = hex;
    store.paint = hex;
    persist();
  }
  return changed > 0;
}
function applyTunes() {
  if (!game) return;
  game.car.maxSpeed = 26 + 2 * (store.tunes.engine || 0);
  game.car.accel = 15 + 2 * (store.tunes.engine || 0);
  game.car.brake = 24 + 3 * (store.tunes.brakes || 0);
}

// --- shops ---
function buy(sectionId, itemId) {
  if (!game) return { ok: false, msg: 'Game not ready.' };
  const section = SHOP_SECTIONS.find((s) => s.id === sectionId);
  const item = section && section.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, msg: 'Unknown item.' };
  if (item.kind === 'outfit' && store.outfit === item.outfit) return { ok: false, msg: 'Already wearing it.' };
  if (item.kind === 'paint' && store.paint === item.paint) return { ok: false, msg: 'Already painted that colour.' };
  if (item.kind === 'tune' && (store.tunes[item.tune] || 0) >= item.level) return { ok: false, msg: 'Already installed.' };
  if (!rankUnlocked(item.rank)) return { ok: false, msg: `Locked — needs rank ${item.rank}.` };
  const price = itemOwned(section, item) ? 0 : priceFor(section, item);
  if (game.state.money < price) return { ok: false, msg: `Need ${fmtMoney(price)} — you have ${fmtMoney(game.state.money)}.` };
  game.state.money -= price;
  if (item.kind === 'ammo') {
    game.combat.ammo[item.weapon].reserve += item.qty;
  } else if (item.kind === 'weapon') {
    // The Tamburo SMG (FIXER): select it and load the bought rounds.
    game.combat.select(item.weapon);
    game.combat.ammo[item.weapon].reserve += item.qty;
    game.state.weapon = item.weapon;
  } else if (item.kind === 'repair') {
    game.car.damage = 0;
  } else if (item.kind === 'fuel') {
    game.car.fuel = 100;
  } else if (item.kind === 'armour') {
    game.state.armour = Math.min(100, game.state.armour + item.amount);
  } else if (item.kind === 'medkit') {
    game.state.health = 100;
  } else if (item.kind === 'outfit') {
    if (!store.outfitsOwned.includes(item.outfit)) store.outfitsOwned.push(item.outfit);
    applyOutfit(item.outfit);
  } else if (item.kind === 'paint') {
    const key = item.id.replace('paint-', '');
    if (!store.paintsOwned.includes(key)) store.paintsOwned.push(key);
    if (!applyPaint(item.paint)) return { ok: false, msg: 'Paint did not take — the Stella is out of range. Try again in the garage.' };
  } else if (item.kind === 'tune') {
    store.tunes[item.tune] = item.level;
    applyTunes();
  }
  persist();
  toast(`Bought ${item.name} — ${fmtMoney(price)}.`);
  return { ok: true, msg: `Bought ${item.name}.` };
}
function applyOwned(sectionId, itemId) {
  const section = SHOP_SECTIONS.find((s) => s.id === sectionId);
  const item = section && section.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, msg: 'Unknown item.' };
  if (item.kind === 'outfit' && store.outfitsOwned.includes(item.outfit)) {
    applyOutfit(item.outfit);
    toast(`Wearing ${item.name}.`);
    return { ok: true, msg: `Wearing ${item.name}.` };
  }
  if (item.kind === 'paint' && store.paintsOwned.includes(item.id.replace('paint-', ''))) {
    if (!applyPaint(item.paint)) return { ok: false, msg: 'Paint did not take — try again in the garage.' };
    toast(`Stella repainted — ${item.name}.`);
    return { ok: true, msg: `Stella repainted.` };
  }
  return { ok: false, msg: 'Not owned yet.' };
}

// --- side activities (jobs + races, one engine) ---
function activityById(id) {
  return ACTIVITIES.find((a) => a.id === id) || null;
}
function startActivity(id) {
  if (!game) return { ok: false, msg: 'Game not ready.' };
  const def = activityById(id);
  if (!def) return { ok: false, msg: 'Unknown activity.' };
  if (game.state.mode !== 'play') return { ok: false, msg: 'Start from the street — not the title screen.' };
  if (active) {
    toast(`${active.def.code} abandoned — ${def.code} ${def.title} started.`);
    engine.start(ACTIVITIES.indexOf(def));
  } else {
    engine.start(ACTIVITIES.indexOf(def));
  }
  active = { idx: ACTIVITIES.indexOf(def), def };
  activeFailHandled = false;
  const d = engine.nextDialogue();
  if (d) toast(`${d.who}: ${d.line}`);
  else toast(`${def.code} — ${def.title} started.`);
  updateJobPanel(true);
  return { ok: true, msg: `${def.code} started.` };
}
function abandonActivity() {
  if (!active) return;
  toast(`${active.def.code} abandoned.`);
  active = null;
  updateJobPanel(true);
}
function payReward(def, raceTime) {
  game.state.money += def.reward.money;
  game.state.xp = Math.min(10000, game.state.xp + def.reward.xp);
  addStanding(def.district, def.kind === 'race' ? 8 : 6);
  if (def.kind === 'race' && raceTime != null) {
    const prev = store.racesBest[def.id];
    if (prev === undefined || raceTime < prev) {
      store.racesBest[def.id] = raceTime;
      engine.setRaceBest({ ...engine.raceBest, [def.id]: raceTime });
    }
  }
  store.jobsDone[def.id] = (store.jobsDone[def.id] || 0) + 1;
  persist();
}
function handleActivityEvent(ev) {
  if (!ev || !active) return;
  const def = active.def;
  if (ev.type === 'stage') {
    const s = def.stages[ev.stage];
    toast(`STAGE ${ev.stage + 1} — ${s.name}`);
    const d = engine.nextDialogue();
    if (d) setTimeout(() => toast(`${d.who}: ${d.line}`), 1200);
  } else if (ev.type === 'checkpoint') {
    toast(`CHECKPOINT ${ev.done}/${ev.total}`);
  } else if (ev.type === 'fail') {
    const why = ev.reason === 'timeout' ? 'TIME UP' : ev.reason === 'wrecked' ? 'CAR WRECKED' : ev.reason.toUpperCase();
    toast(`${def.code} FAILED — ${why}. Try again.`);
    engine.start(active.idx);
    activeFailHandled = false;
  } else if (ev.type === 'complete') {
    const race = ev.raceTime != null ? ` · ${fmtTime(ev.raceTime)}` : '';
    payReward(def, ev.raceTime);
    toast(`${def.code} COMPLETE — +${fmtMoney(def.reward.money)} · +${def.reward.xp} XP${race}`);
    active = null;
  }
  updateJobPanel(true);
}
function failActive(why) {
  if (!active) return;
  toast(`${active.def.code} FAILED — ${why}. Try again.`);
  engine.start(active.idx);
  activeFailHandled = false;
  updateJobPanel(true);
}

// --- world markers (scene) ---
function makeBeaconMesh(colorHex) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.4, 12),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 }),
  );
  cone.position.y = 2.2;
  cone.rotation.x = Math.PI;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.7, 24),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  g.add(cone, ring);
  return g;
}
function buildMarkers() {
  const scene = game.scene;
  // Objective beacon (teal — the story beacon is gold).
  beacon = makeBeaconMesh(0x3ed6d6);
  beacon.visible = false;
  scene.add(beacon);
  // Waypoint beacon (gold diamond).
  waypointBeacon = new THREE.Group();
  const dia = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshBasicMaterial({ color: 0xf2a541 }),
  );
  waypointBeacon.add(dia);
  waypointBeacon.visible = false;
  scene.add(waypointBeacon);
  // Smuggler car for the J8 tail stage (rust-red sedan, follows the
  // moving tail marker — the story smuggler mesh belongs to M2).
  smugglerMesh = buildTrafficCar(0x8a4a3a, 'sedan');
  smugglerMesh.visible = false;
  scene.add(smugglerMesh);
  // Shop signs: a post + a coloured board at each shop door.
  const signDefs = [
    { spot: SIDE_SPOTS.weaponsShop, color: 0xc0392b, label: 'ARMS' },
    { spot: SIDE_SPOTS.clothesShop, color: 0xc93a6b, label: 'CLOTHES' },
    { spot: SIDE_SPOTS.garage, color: 0x2e7f8f, label: 'GARAGE' },
    { spot: SIDE_SPOTS.pharmacy, color: 0x2e8b57, label: 'MEDS' },
  ];
  for (const s of signDefs) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.4, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 }),
    );
    post.position.y = 1.2;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.9, 0.12),
      new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.7 }),
    );
    board.position.y = 2.6;
    const top = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshBasicMaterial({ color: 0xf2a541 }),
    );
    top.position.y = 3.3;
    g.add(post, board, top);
    g.position.set(s.spot.x, 0, s.spot.z);
    scene.add(g);
    markers.signs.push(g);
  }
  // Stunt jump gates: gold rings across the road.
  for (const j of SIDE_JUMPS) {
    const a = anchorXZ(j.anchor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.18, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0xf2a541 }),
    );
    ring.position.set(a.x + (j.dx || 0), 2.4, a.z + (j.dz || 0));
    if (j.dir === 'ew') ring.rotation.y = Math.PI / 2;
    scene.add(ring);
    markers.gates.push({ def: j, mesh: ring });
  }
  // Launch-pad chevrons (3c.4): flat gold arrowheads on the road on
  // BOTH approaches of every ring, pointing at it — there is no
  // physical ramp (the car stays on the flat plane), so the chevrons
  // are what sells "launch pad" to the player. All 48 triangles in
  // ONE merged mesh (1 draw call). The triangle is built flat in the
  // XZ plane pointing +X, then yawed: ry = atan2(-dz, dx).
  {
    const shape = new THREE.Shape();
    shape.moveTo(0.9, 0); shape.lineTo(-0.6, 0.7); shape.lineTo(-0.6, -0.7); shape.closePath();
    const triFlat = new THREE.ShapeGeometry(shape);
    triFlat.rotateX(-Math.PI / 2);
    const geos = [];
    for (const j of SIDE_JUMPS) {
      const a = anchorXZ(j.anchor);
      const cx = a.x + (j.dx || 0), cz = a.z + (j.dz || 0);
      // [offset along the road, pointing toward the ring]
      const sides = j.dir === 'ew'
        ? [[-3.5, 1, 0], [-5, 1, 0], [-6.5, 1, 0], [3.5, -1, 0], [5, -1, 0], [6.5, -1, 0]]
        : [[-3.5, 0, 1], [-5, 0, 1], [-6.5, 0, 1], [3.5, 0, -1], [5, 0, -1], [6.5, 0, -1]];
      for (const [off, dx, dz] of sides) {
        const px = j.dir === 'ew' ? cx + off : cx;
        const pz = j.dir === 'ew' ? cz : cz + off;
        geos.push(colored(xform(triFlat, px, 0.03, pz, Math.atan2(-dz, dx), 1), 0xf2a541));
      }
    }
    scene.add(mergedMesh(geos, new THREE.MeshBasicMaterial({ vertexColors: true })));
  }
  // Job start markers: a small teal beacon at each job's first stage
  // target. Press E on foot nearby to start the job (see onKeyDown).
  for (const j of SIDE_JOBS) {
    const t = j.stages[0].target;
    const bm = makeBeaconMesh(0x2e7f8f);
    bm.scale.setScalar(0.7);
    bm.position.set(t.x, 0, t.z);
    scene.add(bm);
    markers.jobs.push({ def: j, mesh: bm });
  }
  // Collectible coins: spinning gold octahedrons.
  for (const c of COLLECTIBLES) {
    if (store.collectiblesDone.includes(c.id)) continue;
    const a = anchorXZ(c.anchor);
    const coin = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45),
      new THREE.MeshStandardMaterial({ color: 0xf2a541, emissive: 0xf2a541, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.6 }),
    );
    coin.position.set(a.x + (c.dx || 0), 1.2, a.z + (c.dz || 0));
    scene.add(coin);
    markers.coins.push({ def: c, mesh: coin });
  }
}

// --- DOM: job panel + side toast + map overlay ---
function buildDOM() {
  if (!el('side-toast')) {
    const t = document.createElement('div');
    t.id = 'side-toast';
    document.body.appendChild(t);
  }
  if (!el('side-job-panel')) {
    const p = document.createElement('div');
    p.id = 'side-job-panel';
    p.style.display = 'none';
    document.body.appendChild(p);
  }
  if (!el('map-overlay')) {
    const m = document.createElement('div');
    m.id = 'map-overlay';
    m.style.display = 'none';
    m.innerHTML = `<div class="map-card">
      <div class="map-head"><div><div class="map-title">CHART OF PORTO AZZURA</div>
      <div class="map-sub">Full map &middot; click a marker to set a waypoint &middot; M / ESC to close</div></div>
      <button class="map-close" id="map-close" aria-label="Close map">&times;</button></div>
      <div class="map-body"><div class="map-svg-wrap" id="map-svg-wrap"></div>
      <div class="map-list" id="map-list"></div></div>
      <div class="map-foot" id="map-foot"></div></div>`;
    document.body.appendChild(m);
    const close = el('map-close');
    if (close) close.addEventListener('click', () => closeMap());
  }
  if (!el('shop-overlay')) {
    const s = document.createElement('div');
    s.id = 'shop-overlay';
    s.style.display = 'none';
    s.innerHTML = `<div class="shop-card">
      <div class="shop-title" id="shop-title">SHOP</div>
      <div class="shop-sub" id="shop-sub"></div>
      <div class="shop-money" id="shop-money"></div>
      <div id="shop-items"></div>
      <div class="shop-msg" id="shop-msg"></div>
      <button class="shop-close" id="shop-close">CLOSE (ESC)</button></div>`;
    document.body.appendChild(s);
    const close = el('shop-close');
    if (close) close.addEventListener('click', () => closeShop());
  }
  if (!el('side-prompt')) {
    const p = document.createElement('div');
    p.id = 'side-prompt';
    p.style.display = 'none';
    document.body.appendChild(p);
  }
  // Side HUD chip (3c.3): coins / jumps / jobs / rank, bottom-left.
  // The CSS (#side-hud) existed but no element ever did — the chip
  // never showed. Built here, updated by updateSideHud() in the loop.
  if (!el('side-hud')) {
    const h = document.createElement('div');
    h.id = 'side-hud';
    h.style.display = 'none';
    document.body.appendChild(h);
  }
}
function updateJobPanel(force) {
  const now = performance.now();
  if (!force && now - lastPanel < 120) return;
  lastPanel = now;
  const p = el('side-job-panel');
  if (!p) return;
  if (!active || !game || game.state.mode !== 'play') {
    p.style.display = 'none';
    return;
  }
  const def = active.def;
  const s = engine.stageDef();
  const obj = engine.objective();
  let timer = '';
  if (def.timeLimit) {
    const left = Math.max(0, def.timeLimit - engine.elapsed);
    timer = `<div class="side-timer">TIME LEFT <b>${fmtTime(left)}</b></div>`;
  }
  const prog = obj && (obj.type === 'race' || obj.type === 'deliver') && obj.left !== undefined
    ? `<div class="side-prog">${obj.left} to go</div>` : '';
  p.innerHTML = `<div class="side-label">SIDE ${def.kind === 'race' ? 'RACE' : 'JOB'} &middot; ${def.district.toUpperCase()}</div>
    <div class="side-title"><span class="side-chip">${def.code}</span> ${def.title}</div>
    <div class="side-stage">${s ? `${engine.stage + 1} &middot; ${s.name}` : ''}</div>
    <p class="side-objective">${s ? s.text : ''}</p>${prog}${timer}
    <button class="side-abandon" id="side-abandon">ABANDON</button>`;
  p.style.display = 'block';
  const ab = el('side-abandon');
  if (ab) ab.addEventListener('click', () => abandonActivity());
}

// --- map (full-screen, M key) ---
const MAP = { x0: -62, x1: 62, z0: -54, z1: 36, w: 620, h: 450 };
function mapX(x) { return ((x - MAP.x0) / (MAP.x1 - MAP.x0)) * MAP.w; }
function mapY(z) { return ((z - MAP.z0) / (MAP.z1 - MAP.z0)) * MAP.h; }
async function loadMapData() {
  if (mapDataCache) return mapDataCache;
  let roads = [];
  let blocks = [];
  let streets = [];
  try {
    const r = await import('./roads.js');
    if (r.roadRects) roads = r.roadRects();
  } catch (e) { /* road file mid-edit: draw the schematic instead */ }
  try {
    const g = await import('./cbd-grid.js');
    if (g.cbdGridBlocks) blocks = g.cbdGridBlocks();
    if (g.CBD_NS && g.CBD_EW) streets = [...g.CBD_NS.map((s) => ({ ...s, axis: 'x' })), ...g.CBD_EW.map((s) => ({ ...s, axis: 'z' }))];
  } catch (e) { /* grid file mid-edit: roads only */ }
  mapDataCache = { roads, blocks, streets };
  return mapDataCache;
}
function markerSvg(kind, x, y, label, wp) {
  const c = kind === 'job' ? '#2e7f8f' : kind === 'race' ? '#c93a6b' : kind === 'shop' ? '#f2a541' : kind === 'jump' ? '#e8a33d' : '#f2d27a';
  return `<g class="map-marker" data-wp="${wp}" data-x="${x}" data-y="${y}">
    <circle cx="${x}" cy="${y}" r="9" fill="${c}" stroke="#1e2a32" stroke-width="1.5"/>
    <text x="${x}" y="${y + 3.5}" font-size="9" font-weight="800" fill="#fff" text-anchor="middle">${label}</text></g>`;
}
async function renderMap() {
  const wrap = el('map-svg-wrap');
  const list = el('map-list');
  const foot = el('map-foot');
  if (!wrap || !game) return;
  const { roads, blocks, streets } = await loadMapData();
  const px = game.state.onFoot ? game.player.x : game.car.x;
  const pz = game.state.onFoot ? game.player.z : game.car.z;
  const heading = game.state.onFoot ? game.player.angle : game.car.angle;
  let svg = `<svg viewBox="0 0 ${MAP.w} ${MAP.h}" class="map-svg" role="img" aria-label="Map of Porto Azzura">
    <rect width="${MAP.w}" height="${MAP.h}" fill="#d8cbb2"/>
    <rect x="0" y="${mapY(14.5)}" width="${MAP.w}" height="${MAP.h - mapY(14.5)}" fill="#5fa8b5"/>
    <text x="${MAP.w - 10}" y="${MAP.h - 12}" font-size="12" font-weight="800" fill="#e9f4f6" text-anchor="end">THE BAY</text>`;
  for (const b of blocks) {
    if (b.kind === 'park') svg += `<rect x="${mapX(b.x0)}" y="${mapY(b.z0)}" width="${mapX(b.x1) - mapX(b.x0)}" height="${mapY(b.z1) - mapY(b.z0)}" fill="#7a8b5a" opacity="0.7"/>`;
    else if (b.kind === 'plaza') svg += `<rect x="${mapX(b.x0)}" y="${mapY(b.z0)}" width="${mapX(b.x1) - mapX(b.x0)}" height="${mapY(b.z1) - mapY(b.z0)}" fill="#e8a33d" opacity="0.45"/>`;
  }
  for (const r of roads) {
    svg += `<rect x="${mapX(r.x0)}" y="${mapY(r.z0)}" width="${Math.max(2, mapX(r.x1) - mapX(r.x0))}" height="${Math.max(2, mapY(r.z1) - mapY(r.z0))}" fill="#8a8580"/>`;
  }
  for (const s of streets) {
    if (s.axis === 'x') svg += `<text x="${mapX(s.x) + 4}" y="${mapY((s.z0 + s.z1) / 2)}" font-size="8" fill="#1e2a32" opacity="0.75" transform="rotate(-90 ${mapX(s.x) + 4} ${mapY((s.z0 + s.z1) / 2)})">${s.name}</text>`;
    else svg += `<text x="${mapX((s.x0 + s.x1) / 2)}" y="${mapY(s.z) - 3}" font-size="8" fill="#1e2a32" opacity="0.75" text-anchor="middle">${s.name}</text>`;
  }
  // District labels.
  const labels = [
    ['DOWNTOWN BAY SKYLINE', 0, -28], ['BOULEVARD', 0, 5.5], ['FORTRESS OLD TOWN', -47, -40],
    ['SEASIDE PROMENADE', 35, 24], ['YACHT MARINA', 0, 30], ['QUAY', -40, 13.5],
  ];
  for (const [t, x, z] of labels) svg += `<text x="${mapX(x)}" y="${mapY(z)}" font-size="10" font-weight="800" fill="#1e2a32" opacity="0.6" text-anchor="middle">${t}</text>`;
  // Markers: shops, jobs, races, jumps, uncollected coins.
  const spots = [
    { kind: 'shop', label: 'S', x: SIDE_SPOTS.weaponsShop.x, z: SIDE_SPOTS.weaponsShop.z, wp: 'weaponsShop' },
    { kind: 'shop', label: 'S', x: SIDE_SPOTS.clothesShop.x, z: SIDE_SPOTS.clothesShop.z, wp: 'clothesShop' },
    { kind: 'shop', label: 'S', x: SIDE_SPOTS.garage.x, z: SIDE_SPOTS.garage.z, wp: 'garage' },
  ];
  for (const j of SIDE_JOBS) {
    const t = j.stages[0].target;
    spots.push({ kind: 'job', label: 'J', x: t.x, z: t.z, wp: `job:${j.id}` });
  }
  for (const r of SIDE_RACES) {
    const t = r.stages[0].target;
    spots.push({ kind: 'race', label: 'R', x: t.x, z: t.z, wp: `race:${r.id}` });
  }
  for (const j of SIDE_JUMPS) {
    if (store.jumpsDone.includes(j.id)) continue;
    const a = anchorXZ(j.anchor);
    spots.push({ kind: 'jump', label: '★', x: a.x + (j.dx || 0), z: a.z + (j.dz || 0), wp: `jump:${j.id}` });
  }
  for (const c of COLLECTIBLES) {
    if (store.collectiblesDone.includes(c.id)) continue;
    const a = anchorXZ(c.anchor);
    svg += `<circle cx="${mapX(a.x + (c.dx || 0))}" cy="${mapY(a.z + (c.dz || 0))}" r="3" fill="#f2d27a" stroke="#1e2a32" stroke-width="0.8"/>`;
  }
  for (const s of spots) svg += markerSvg(s.kind, mapX(s.x), mapY(s.z), s.label, s.wp);
  // Waypoint + player.
  if (waypoint) {
    svg += `<g><polygon points="${mapX(waypoint.x)},${mapY(waypoint.z) - 11} ${mapX(waypoint.x) + 9},${mapY(waypoint.z)} ${mapX(waypoint.x)},${mapY(waypoint.z) + 11} ${mapX(waypoint.x) - 9},${mapY(waypoint.z)}" fill="none" stroke="#f2a541" stroke-width="2.5"/></g>`;
  }
  const rot = (-heading * 180 / Math.PI).toFixed(1);
  svg += `<g transform="translate(${mapX(px)},${mapY(pz)}) rotate(${rot})"><polygon points="10,0 -7,-6 -3,0 -7,6" fill="#f2a541" stroke="#1e2a32" stroke-width="1.5"/></g>`;
  svg += `<text x="8" y="16" font-size="11" font-weight="800" fill="#1e2a32">N ↑</text></svg>`;
  wrap.innerHTML = svg;
  // Waypoint list (click to set).
  const items = [];
  items.push('<h3>Waypoints</h3>');
  for (const s of spots) {
    const name = s.wp.startsWith('job:') ? (SIDE_JOBS.find((j) => j.id === s.wp.slice(4)) || {}).title
      : s.wp.startsWith('race:') ? (SIDE_RACES.find((r) => r.id === s.wp.slice(5)) || {}).title
      : s.wp === 'weaponsShop' ? 'Kelo Arms — weapons' : s.wp === 'clothesShop' ? 'Sartoria Azzura — clothes'
      : s.wp === 'garage' ? 'Gus\u2019 Garage — cars' : (SIDE_JUMPS.find((j) => j.id === s.wp.slice(5)) || {}).name;
    items.push(`<button class="map-wp" data-wp="${s.wp}">${name || s.wp}</button>`);
  }
  items.push(`<button class="map-wp" data-wp="clear">Clear waypoint</button>`);
  list.innerHTML = items.join('');
  list.querySelectorAll('[data-wp]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.wp === 'clear') { setWaypoint(null); return; }
    const m = wrap.querySelector(`[data-wp="${b.dataset.wp}"]`);
    if (m) setWaypointByMarker(m);
  }));
  wrap.querySelectorAll('.map-marker').forEach((m) => m.addEventListener('click', () => setWaypointByMarker(m)));
  const wpText = waypoint
    ? `Waypoint: <b>${waypoint.name}</b> — ${Math.round(dist2(px, pz, waypoint.x, waypoint.z))} m away. Follow the gold diamond.`
    : 'No waypoint set. Click a marker or a name to set one.';
  if (foot) foot.innerHTML = `${wpText} &nbsp;·&nbsp; Jobs ${Object.keys(store.jobsDone).length}/${SIDE_JOBS.length} &middot; Races ${Object.keys(store.racesBest).length}/${SIDE_RACES.length} &middot; Jumps ${store.jumpsDone.length}/${SIDE_JUMPS.length} &middot; Coins ${store.collectiblesDone.length}/${COLLECTIBLES.length}`;
}
function setWaypointByMarker(m) {
  const wp = m.dataset.wp;
  const x = parseFloat(m.dataset.x);
  const y = parseFloat(m.dataset.y);
  // data-x/data-y are MAP pixels — recover world coords from them.
  const wx = (x / MAP.w) * (MAP.x1 - MAP.x0) + MAP.x0;
  const wz = (y / MAP.h) * (MAP.z1 - MAP.z0) + MAP.z0;
  let name = wp;
  if (wp.startsWith('job:')) name = (SIDE_JOBS.find((j) => j.id === wp.slice(4)) || {}).title || wp;
  else if (wp.startsWith('race:')) name = (SIDE_RACES.find((r) => r.id === wp.slice(5)) || {}).title || wp;
  else if (wp.startsWith('jump:')) name = (SIDE_JUMPS.find((j) => j.id === wp.slice(5)) || {}).name || wp;
  else if (wp === 'weaponsShop') name = 'Kelo Arms — weapons';
  else if (wp === 'clothesShop') name = 'Sartoria Azzura — clothes';
  else if (wp === 'garage') name = 'Gus\u2019 Garage — cars';
  setWaypoint({ name, x: wx, z: wz });
}
function setWaypoint(wp) {
  waypoint = wp;
  if (waypointBeacon) {
    waypointBeacon.visible = !!wp;
    if (wp) waypointBeacon.position.set(wp.x, 2.2, wp.z);
  }
  if (wp) toast(`Waypoint set — ${wp.name}.`);
  if (mapOpen) renderMap();
}
function openMap() {
  if (!game || mapOpen) return;
  if (game.hub.open) game.hub.setOpen(false);
  if (game.state.mode === 'play') {
    game.setPaused(true);
    mapPausedByMe = true;
  } else {
    mapPausedByMe = false;
  }
  mapOpen = true;
  const ov = el('map-overlay');
  if (ov) ov.style.display = 'flex';
  renderMap();
}
function closeMap() {
  if (!mapOpen) return;
  mapOpen = false;
  const ov = el('map-overlay');
  if (ov) ov.style.display = 'none';
  if (mapPausedByMe && game) {
    game.setPaused(false);
    mapPausedByMe = false;
  }
}

// --- shops (one shared menu, opened with E at a shop door) ---
let shopOpen = false;
let shopSection = null;
let shopPausedByMe = false;
function shopSpots() {
  return [
    { section: 'weapons', spot: SIDE_SPOTS.weaponsShop },
    { section: 'clothes', spot: SIDE_SPOTS.clothesShop },
    { section: 'garage', spot: SIDE_SPOTS.garage },
    { section: 'pharmacy', spot: SIDE_SPOTS.pharmacy },
  ];
}
function nearestShop(px, pz) {
  let best = null, bd = Infinity;
  for (const s of shopSpots()) {
    const d = dist2(px, pz, s.spot.x, s.spot.z);
    if (d < bd) { bd = d; best = s; }
  }
  return bd <= 4 ? { ...best, dist: bd } : null;
}
function nearestJobStart(px, pz) {
  if (active) return null;
  let best = null, bd = Infinity;
  for (const j of SIDE_JOBS) {
    const t = j.stages[0].target;
    const d = dist2(px, pz, t.x, t.z);
    if (d < bd) { bd = d; best = j; }
  }
  return bd <= 4 ? { job: best, dist: bd } : null;
}
function openShop(sectionId) {
  const section = SHOP_SECTIONS.find((s) => s.id === sectionId);
  if (!section || !game) return;
  shopSection = section;
  shopOpen = true;
  if (game.state.mode === 'play') {
    game.setPaused(true);
    shopPausedByMe = true;
  } else {
    shopPausedByMe = false;
  }
  const ov = el('shop-overlay');
  if (ov) ov.style.display = 'flex';
  renderShop();
}
function renderShop() {
  if (!shopSection || !game) return;
  const st = getState();
  const sec = st.shops.find((s) => s.id === shopSection.id);
  if (!sec) return;
  const t = el('shop-title');
  if (t) t.textContent = sec.title;
  const sub = el('shop-sub');
  if (sub) sub.textContent = `${sec.note || ''}${sec.discount ? ' · 10% off — FRIENDLY standing here.' : ''}`;
  const m = el('shop-money');
  if (m) m.textContent = `YOUR MONEY: ${fmtMoney(game.state.money)}`;
  const list = el('shop-items');
  if (list) {
    list.innerHTML = sec.items.map((it) => {
      const owned = it.owned && (it.kind === 'outfit' || it.kind === 'paint' || it.kind === 'tune');
      const applied = it.applied;
      const btn = it.locked ? 'LOCKED' : applied ? 'APPLIED' : owned ? 'APPLY' : 'BUY';
      return `<div class="shop-item${it.locked ? ' locked' : ''}">
        <div class="shop-info"><b>${it.name}</b><p>${it.desc || ''}${it.rank ? ` · Needs rank ${it.rank}.` : ''}</p></div>
        <span class="shop-price">${it.locked ? '' : owned ? 'Owned' : fmtMoney(it.price)}</span>
        <button data-buy="${it.id}"${it.locked || applied ? ' disabled' : ''}>${btn}</button></div>`;
    }).join('');
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      const r = buy(shopSection.id, b.dataset.buy);
      const msg = el('shop-msg');
      if (msg) msg.textContent = r.msg;
      if (r.ok) renderShop();
    }));
  }
}
function closeShop() {
  if (!shopOpen) return;
  shopOpen = false;
  shopSection = null;
  const ov = el('shop-overlay');
  if (ov) ov.style.display = 'none';
  if (shopPausedByMe && game) {
    game.setPaused(false);
    shopPausedByMe = false;
  }
}

// --- input ---
function onKeyDown(e) {
  if (!game) return;
  if (e.code === 'KeyM') {
    if (game.state.mode === 'play' || mapOpen) {
      if (mapOpen) closeMap();
      else openMap();
    }
    return;
  }
  if (e.code === 'Escape' && mapOpen) {
    closeMap();
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  if (e.code === 'Escape' && shopOpen) {
    closeShop();
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  // Side-job interact (E): capture phase so the story E-handler does
  // not also fire (it would enter the car). Only when the side stage
  // is an interact AND the story has no interact stage at this spot.
  if (e.code === 'KeyE' && game.state.mode === 'play' && !game.hub.open && !mapOpen && active) {
    const s = engine.stageDef();
    if (!s || s.type !== 'interact') return;
    const px = game.state.onFoot ? game.player.x : game.car.x;
    const pz = game.state.onFoot ? game.player.z : game.car.z;
    if (dist2(px, pz, s.target.x, s.target.z) >= s.target.r) return;
    const story = game.missions.stageDef();
    if (story && story.type === 'interact' && dist2(px, pz, story.target.x, story.target.z) < story.target.r) return; // story wins
    const ev = engine.interact(px, pz);
    if (ev) {
      handleActivityEvent(ev);
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }
  // Shop doors + job start markers (E, on foot): a shop door opens
  // the shared shop menu; a job marker starts that job. The story
  // interact stage wins when it is in range at the same spot.
  if (e.code === 'KeyE' && game.state.mode === 'play' && !game.hub.open && !mapOpen && !shopOpen && game.state.onFoot) {
    const px = game.player.x, pz = game.player.z;
    const story = game.missions.stageDef();
    if (story && story.type === 'interact' && dist2(px, pz, story.target.x, story.target.z) < story.target.r) return; // story wins
    if (active) {
      const s = engine.stageDef();
      if (s && s.type === 'interact' && dist2(px, pz, s.target.x, s.target.z) < s.target.r) return; // handled above
    }
    const shop = nearestShop(px, pz);
    if (shop) {
      // GAME fix (shops 22 Nov ~15:00): the CAR wins E when it is
      // nearer than the door. A car parked at the shop door made E
      // re-open the shop forever — the player could never get back in
      // (run 7: boardCar failed, game left paused with the shop open).
      // Only hijack E when the door is the nearer target — except
      // when the player is right AT the door (<=2u), which is a clear
      // "I want the shop" signal (run 9: the player stopped 2.6u from
      // the door, nearer the car, and E would have entered the car).
      const dCar = Math.hypot(game.car.x - px, game.car.z - pz);
      const carNearer = dCar < 4 && dCar < shop.dist && shop.dist > 2;
      if (!carNearer) {
        openShop(shop.section);
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
    }
    const js = nearestJobStart(px, pz);
    if (js) {
      const dCar = Math.hypot(game.car.x - px, game.car.z - pz);
      if (dCar < 4 && dCar < js.dist) {
        // car nearer — let E fall through to enter the car
      } else {
        const r = startActivity(js.job.id);
        if (r.ok) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      }
    }
  }
}

// --- main loop (own rAF; the game loop stays untouched) ---
let lastNow = 0;
let lastPrompt = 0;
// Previous car position (per side-tick) for stunt-jump gate detection
// — see the segment-crossing note at the jumps check below.
let prevCarPos = null;
let lastHud = 0;
function updateSideHud() {
  const now = performance.now();
  if (now - lastHud < 500) return;
  lastHud = now;
  const h = el('side-hud');
  if (!h) return;
  if (!game || game.state.mode !== 'play') {
    h.style.display = 'none';
    return;
  }
  const jobsDone = Object.keys(store.jobsDone).length;
  h.innerHTML = `COINS <b>${store.collectiblesDone.length}/${COLLECTIBLES.length}</b> &middot; JUMPS <b>${store.jumpsDone.length}/${SIDE_JUMPS.length}</b> &middot; JOBS <b>${jobsDone}/${SIDE_JOBS.length}</b> &middot; <b>${rankForXp(game.state.xp)}</b>`;
  h.style.display = 'block';
}
function updatePrompt() {
  const now = performance.now();
  if (now - lastPrompt < 200) return;
  lastPrompt = now;
  const p = el('side-prompt');
  if (!p) return;
  if (!game || game.state.mode !== 'play' || game.hub.open || mapOpen || shopOpen || !game.state.onFoot) {
    p.style.display = 'none';
    return;
  }
  const px = game.player.x, pz = game.player.z;
  const shop = nearestShop(px, pz);
  if (shop) {
    // Same nearer-target rule as the E handler: do not advertise the
    // shop when the car is nearer (E would enter the car instead) —
    // unless the player is right at the door (<=2u).
    const dCar = Math.hypot(game.car.x - px, game.car.z - pz);
    const carNearer = dCar < 4 && dCar < shop.dist && shop.dist > 2;
    if (!carNearer) {
      const sec = SHOP_SECTIONS.find((s) => s.id === shop.section);
      p.innerHTML = `PRESS <b>E</b> — ${sec ? sec.title : shop.section}`;
      p.style.display = 'block';
      return;
    }
  }
  const js = nearestJobStart(px, pz);
  if (js) {
    p.innerHTML = `PRESS <b>E</b> — START ${js.job.code} ${js.job.title}`;
    p.style.display = 'block';
    return;
  }
  p.style.display = 'none';
}
function loop(now) {
  requestAnimationFrame(loop);
  if (!game) return;
  // GAME fix (3c.5, 22 Nov ~18:00): the engine's timers (job time
  // limits, race/stage timers) must run on SIM time, not wall time.
  // The side dt was wall dt capped at 0.1 s — at 60 fps that is real
  // time, but in headless (rAF ~1.4 fps) it is 0.14x, so the 90 s J1
  // timer needed ~650 wall-s to fire (proven: TIME LEFT 01:21 at
  // 63 s wall, 00:54 at 263 s). Scaling by the game's fastsim factor
  // (test-only, 1 in normal play) makes the timers track the sim:
  // at fastsim=2 the 90 s timer fires in ~130 wall-s. The cap rises
  // to 0.25 s to match the game loop's own dt cap.
  const dt = Math.min(0.25, Math.max(0, (now - lastNow) / 1000 || 0)) * (game.__fastsim || 1);
  lastNow = now;
  const t = now / 1000;
  // Spin the coins + pulse the beacons even on the title screen.
  for (const c of markers.coins) {
    c.mesh.rotation.y = t * 1.6;
    c.mesh.position.y = 1.2 + Math.sin(t * 2 + c.mesh.position.x) * 0.15;
  }
  if (beacon && beacon.visible) beacon.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
  if (waypointBeacon && waypointBeacon.visible) {
    waypointBeacon.rotation.y = t * 1.2;
    waypointBeacon.position.y = 2.2 + Math.sin(t * 2) * 0.25;
  }
  if (game.state.mode !== 'play' || game.hub.open || mapOpen) {
    if (mapOpen) updateMapPlayer();
    return;
  }
  updatePrompt();
  updateSideHud();
  // Job start beacons show only while no side activity is running.
  for (const j of markers.jobs) j.mesh.visible = !active;
  const px = game.state.onFoot ? game.player.x : game.car.x;
  const pz = game.state.onFoot ? game.player.z : game.car.z;
  // Busted / wasted during a side activity fails it (the game
  // respawns Elio; the job restarts from stage one).
  if ((game.state.busted || game.state.wasted) && active && !activeFailHandled) {
    activeFailHandled = true;
    if ((active.def.failOn || []).includes(game.state.busted ? 'busted' : 'wasted')) {
      failActive(game.state.busted ? 'BUSTED' : 'WASTED');
    } else {
      engine.start(active.idx);
    }
  }
  if (!game.state.busted && !game.state.wasted) activeFailHandled = false;
  // Drive the side engine.
  if (active && engine) {
    const ev = engine.update(px, pz, game.wanted.level, dt, game.car.damage);
    handleActivityEvent(ev);
    // Job time limits apply to the whole job (the engine only enforces
    // them during race stages — jobs need the same rule here).
    if (active && active.def.kind === 'job' && active.def.timeLimit && engine.elapsed > active.def.timeLimit) {
      failActive('TIME UP');
    }
    const obj = engine.objective();
    if (beacon) {
      if (obj && !engine.done) {
        beacon.visible = true;
        beacon.position.set(obj.x, 0, obj.z);
      } else {
        beacon.visible = false;
      }
    }
    // J8 tail: the rust-red smuggler sedan follows the moving marker.
    if (smugglerMesh) {
      const s = engine.stageDef();
      const isTail = !!s && s.type === 'tail';
      smugglerMesh.visible = isTail;
      if (isTail) {
        smugglerMesh.position.set(engine.tailPos.x, 0.2, engine.tailPos.z);
        smugglerMesh.rotation.y = Math.PI / 2;
      }
    }
    updateJobPanel(false);
  } else if (beacon) {
    beacon.visible = false;
  }
  // Stunt jumps: through a gate in the car at 36 km/h or more.
  // GAME fix (3c.4, 22 Nov ~16:45): gate detection is SEGMENT
  // crossing, not point sampling. The side tick runs once per rAF
  // frame while the sim can step up to 0.5 game-seconds per frame
  // (frame dt cap 0.25 x fastsim 2) — at 16-22 m/s the car moves up
  // to ~8-11u between ticks and can jump clean over the 2.5u point
  // radius without ever being sampled inside it (proved: SJ1 fast
  // FAIL at sampled 13.0 m/s although /tmp/car-speed-debug.mjs
  // showed the car at 16.0-16.5 m/s inside the radius, and the
  // probe trace showed 7.6u jumps between samples). The crossing
  // test is direction-agnostic, like the old point test: any
  // crossing of the gate plane within the ring radius at >10 (see
  // JUMP_SPEED above).
  // counts. At 60 fps the car moves 0.27u per tick, so real play
  // is unchanged — this only stops legitimate passes being missed
  // at low frame rates.
  if (!game.state.onFoot) {
    const speed = Math.abs(game.car.speed);
    const cx = game.car.x, cz = game.car.z;
    for (const g of markers.gates) {
      if (store.jumpsDone.includes(g.def.id)) continue;
      const gx = g.mesh.position.x, gz = g.mesh.position.z;
      let through = speed > JUMP_SPEED && dist2(cx, cz, gx, gz) < 2.5;
      if (!through && speed > JUMP_SPEED && prevCarPos) {
        if (g.def.dir === 'ew') {
          const d0 = prevCarPos.x - gx, d1 = cx - gx;
          if ((d0 < 0 && d1 >= 0) || (d0 > 0 && d1 <= 0)) {
            const f = d0 === d1 ? 0 : (0 - d0) / (d1 - d0);
            through = Math.abs(prevCarPos.z + (cz - prevCarPos.z) * f - gz) < 2.5;
          }
        } else {
          const d0 = prevCarPos.z - gz, d1 = cz - gz;
          if ((d0 < 0 && d1 >= 0) || (d0 > 0 && d1 <= 0)) {
            const f = d0 === d1 ? 0 : (0 - d0) / (d1 - d0);
            through = Math.abs(prevCarPos.x + (cx - prevCarPos.x) * f - gx) < 2.5;
          }
        }
      }
      if (through) {
        store.jumpsDone.push(g.def.id);
        g.mesh.material.color.setHex(0x3ed6d6);
        game.state.money += 150;
        game.state.xp = Math.min(10000, game.state.xp + 100);
        addStanding(g.def.district, 2);
        persist();
        toast(`STUNT JUMP — ${g.def.name} landed! +S 150 · +100 XP.`);
        // Completion bonus (3c.4, mirrors the 20/20 coins bonus): all 8 jumps, once.
        if (store.jumpsDone.length === SIDE_JUMPS.length && !store.jumpsBonusClaimed) {
          store.jumpsBonusClaimed = true;
          game.state.money += 500;
          persist();
          toast(`ALL STUNT JUMPS — 8/8! Completion bonus +S 500.`);
        }
      }
    }
    prevCarPos = { x: cx, z: cz };
  } else {
    prevCarPos = null; // on foot: no crossing to track
  }
  // Collectibles: within 2 m on foot or in the car.
  for (let i = markers.coins.length - 1; i >= 0; i--) {
    const c = markers.coins[i];
    if (dist2(px, pz, c.mesh.position.x, c.mesh.position.z) < COLLECT_R) {
      store.collectiblesDone.push(c.def.id);
      game.scene.remove(c.mesh);
      markers.coins.splice(i, 1);
      game.state.money += 50;
      game.state.xp = Math.min(10000, game.state.xp + 25);
      addStanding(c.def.district, 1);
      persist();
      toast(`Ledger coin ${store.collectiblesDone.length}/${COLLECTIBLES.length} — +S 50 · +25 XP.`);
      // Completion bonus (3c.3): all 20 coins, once.
      if (store.collectiblesDone.length === COLLECTIBLES.length && !store.coinsBonusClaimed) {
        store.coinsBonusClaimed = true;
        game.state.money += 500;
        persist();
        toast(`ALL LEDGER COINS — 20/20! Completion bonus +S 500.`);
      }
    }
  }
  // Rank unlocks: claim once when XP first crosses each threshold.
  const xp = game.state.xp;
  for (const r of RANK_REWARDS) {
    if (store.ranksClaimed.includes(r.rank)) continue;
    const need = RANK_LADDER.find((k) => k.name === r.rank);
    if (need && xp >= need.xp) {
      store.ranksClaimed.push(r.rank);
      game.state.money += r.money;
      const unlocks = r.unlocks || (r.unlock ? [r.unlock] : []);
      for (const u of unlocks) {
        const [kind, id] = u.split(':');
        if (kind === 'outfit' && !store.outfitsOwned.includes(id)) store.outfitsOwned.push(id);
        if (kind === 'paint' && !store.paintsOwned.includes(id)) store.paintsOwned.push(id);
        if (kind === 'weapon') {
          const wi = parseInt(id, 10);
          if (game.combat.ammo[wi]) game.combat.ammo[wi].reserve += 48;
        }
      }
      persist();
      toast(`RANK UP — ${r.rank}! +${fmtMoney(r.money)}. ${r.text}`);
    }
  }
  if (mapOpen) updateMapPlayer();
}
function updateMapPlayer() {
  // Cheap live refresh while the map is open: player arrow + footer.
  const wrap = el('map-svg-wrap');
  if (!wrap || !game) return;
  const foot = el('map-foot');
  if (foot && waypoint) {
    const px = game.state.onFoot ? game.player.x : game.car.x;
    const pz = game.state.onFoot ? game.player.z : game.car.z;
    foot.innerHTML = foot.innerHTML.replace(/— \d+ m away\./, `— ${Math.round(dist2(px, pz, waypoint.x, waypoint.z))} m away.`);
  }
}

// --- hub API (hub.js Jobs / Shops tabs read this) ---
function getState() {
  const xp = game ? game.state.xp : 0;
  const rank = rankForXp(xp);
  return {
    money: game ? game.state.money : 0,
    xp, rank,
    jobs: SIDE_JOBS.map((j) => ({
      ...j,
      status: active && active.def.id === j.id ? 'ACTIVE' : store.jobsDone[j.id] ? `DONE ×${store.jobsDone[j.id]}` : 'AVAILABLE',
    })),
    races: SIDE_RACES.map((r) => ({
      ...r,
      best: store.racesBest[r.id],
      status: active && active.def.id === r.id ? 'ACTIVE' : store.racesBest[r.id] !== undefined ? `BEST ${fmtTime(store.racesBest[r.id])}` : 'AVAILABLE',
    })),
    jumpsDone: store.jumpsDone.length, jumpsTotal: SIDE_JUMPS.length,
    jumps: SIDE_JUMPS.map((j) => ({ ...j, done: store.jumpsDone.includes(j.id) })),
    coinsDone: store.collectiblesDone.length, coinsTotal: COLLECTIBLES.length,
    standing: SIDE_DISTRICTS.map((d) => ({
      ...d, points: store.standing[d.id] || 0, tier: standingTier(store.standing[d.id] || 0),
    })),
    shops: SHOP_SECTIONS.map((s) => ({
      ...s,
      discount: shopDiscount(s) < 1,
      items: s.items.map((it) => ({
        ...it,
        price: priceFor(s, it),
        owned: itemOwned(s, it),
        applied: itemApplied(s, it),
        locked: !rankUnlocked(it.rank),
      })),
    })),
    outfit: store.outfit, paint: store.paint,
    active: active ? active.def.id : null,
  };
}

// --- attach + boot ---
function attach(g) {
  if (attached) return;
  game = g;
  engine = createMissionEngine(ACTIVITIES);
  engine.setRaceBest({ ...store.racesBest });
  buildDOM();
  buildMarkers();
  captureOutfitRoles();
  // Re-apply the saved look + tuning (a fresh page builds stock).
  if (store.outfit && store.outfit !== 'street') applyOutfit(store.outfit);
  if (store.paint && store.paint !== STOCK_PAINT) {
    currentPaint = STOCK_PAINT;
    applyPaint(store.paint);
  }
  applyTunes();
  window.addEventListener('keydown', onKeyDown, true);
  window.__side = {
    getState, buy, applyOwned, startActivity, abandonActivity,
    openMap, closeMap, setWaypoint, toast, openShop, closeShop,
    get active() { return active ? active.def.id : null; },
    get store() { return store; },
  };
  attached = true;
  lastNow = performance.now();
  requestAnimationFrame(loop);
}
export function attachSideContent(g) {
  attach(g);
}

// Self-boot: hub.js imports this module during createGame, before
// window.__game exists — poll for it, then attach once.
if (typeof window !== 'undefined') {
  const bootTimer = setInterval(() => {
    if (attached) { clearInterval(bootTimer); return; }
    const g = window.__game;
    if (g && g.state && g.scene) {
      try {
        attach(g);
        clearInterval(bootTimer);
      } catch (e) {
        // Attach failed (game still booting?) — retry on the next tick.
        if (window.console) console.warn('[side] attach retry', e);
      }
    }
  }, 100);
  setTimeout(() => clearInterval(bootTimer), 30000);
}
