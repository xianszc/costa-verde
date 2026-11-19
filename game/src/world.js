// COSTA VERDE v1.1 — world: ground texture, buildings, palms, billboards, sea, sky.
// All procedural (canvas textures + low-poly geometry). No external assets.
// v1.1 (Xian): DENSER city — every block split into 2x2 lots (4 buildings per
// block, tight 2.5 m gaps, street walls close to the road), a tall CBD core,
// and far more facade detail (varied wall tints, ledges, balconies, awnings,
// signs, rooftop clutter, neon). Shared unit-box geometry + material cache
// keep the extra meshes cheap.
// Exports buildWorld(THREE) -> { group, colliders, buildingCount, palmCount, sunDir }.

import * as THREE from 'three';
import { CFG, DISTRICTS } from './config.js';

// Road centre-lines (metres). Pitch 74 = block 60 + road 14.
const ROAD_X = [-185, -111, -37, 37, 111, 185];
const ROAD_Z = [-185, -111, -37, 37, 111, 185];
const HALF = CFG.citySize / 2; // 210

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- canvas helpers -------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function canvasTex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Window texture: light wall (tinted later by the material colour), dark
// glass grid, a few lit windows, dark shopfront band at the ground floor.
function windowTexture(wall, cols, rows, litRatio) {
  const [c, g] = makeCanvas(128, 256);
  g.fillStyle = wall; g.fillRect(0, 0, 128, 256);
  const rnd = mulberry32(wall.length * 7919 + cols * 31 + rows);
  const cw = 128 / cols, ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rnd() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#26374e';
      g.fillRect(col * cw + 3, r * ch + 4, cw - 6, ch - 8);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(col * cw + 3, r * ch + 4, cw - 6, 3);
    }
  }
  g.fillStyle = '#3a3230'; g.fillRect(0, 232, 128, 24);
  return canvasTex(c);
}

function signTexture(text, bg, fg) {
  const [c, g] = makeCanvas(256, 96);
  g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg;
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 52);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(4, 4, 248, 88);
  return canvasTex(c);
}

// Ground texture: roads, sidewalks, dashes, beach, grass blocks.
function groundTexture() {
  const S = 2048, W = 560; // canvas maps -280..280 m
  const [c, g] = makeCanvas(S, S);
  const toPx = (v) => ((v + W / 2) / W) * S;
  const px = (m) => (m / W) * S;
  g.fillStyle = '#6f9e52'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#e8cf9e';
  g.fillRect(toPx(210), 0, px(44), S);
  g.fillStyle = '#b9a98c';
  g.fillRect(toPx(-HALF), toPx(-HALF), px(CFG.citySize), px(CFG.citySize));
  g.fillStyle = '#3a3a40';
  for (const x of ROAD_X) g.fillRect(toPx(x - CFG.roadWidth / 2), 0, px(CFG.roadWidth), S);
  for (const z of ROAD_Z) g.fillRect(0, toPx(z - CFG.roadWidth / 2), S, px(CFG.roadWidth));
  g.fillStyle = '#f2c14e';
  for (const x of ROAD_X) {
    for (let z = -HALF; z < HALF; z += 16) g.fillRect(toPx(x) - 2, toPx(z), 4, px(8));
  }
  for (const z of ROAD_Z) {
    for (let x = -HALF; x < HALF; x += 16) g.fillRect(toPx(x), toPx(z) - 2, px(8), 4);
  }
  g.fillStyle = 'rgba(240,240,230,0.85)';
  for (const z of ROAD_Z) {
    for (let i = -3; i <= 3; i++) g.fillRect(toPx(185 - 7 + i * 2), toPx(z - 5), px(1), px(10));
  }
  return canvasTex(c);
}

function districtAt(x, z) {
  let best = null, bd = 1e9;
  for (const d of DISTRICTS) {
    const dd = (x - d.cx) ** 2 + (z - d.cz) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

export function buildWorld(THREE) {
  const group = new THREE.Group();
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const rnd = mulberry32(20261119);

  // Shared unit-box geometry: every box mesh scales it (cheap, one geometry).
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const unitCone = new THREE.ConeGeometry(1, 1, 4);
  function boxMesh(mat, w, h, d, x, y, z, shadow = true) {
    const m = new THREE.Mesh(unitBox, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  }

  // --- sky dome (gradient + sun disc) ------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(CFG.sky.top) },
      mid: { value: new THREE.Color(CFG.sky.mid) },
      low: { value: new THREE.Color(CFG.sky.low) },
      sunDir: { value: new THREE.Vector3() },
      sunCol: { value: new THREE.Color(CFG.sky.sunDisc) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      uniform vec3 sunDir; uniform vec3 sunCol;
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 col = mix(low, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.65, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunCol * (pow(s, 350.0) * 1.2 + pow(s, 18.0) * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const az = THREE.MathUtils.degToRad(CFG.sun.azimuthDeg);
  const el = THREE.MathUtils.degToRad(CFG.sun.elevationDeg);
  const sunDir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyMat.uniforms.sunDir.value.copy(sunDir);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  group.add(sky);

  // --- lights --------------------------------------------------------------
  const sun = new THREE.DirectionalLight(CFG.sun.color, CFG.sun.intensity);
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  group.add(sun);
  group.add(new THREE.HemisphereLight(CFG.sun.ambientSky, CFG.sun.ambientGround, CFG.sun.ambientIntensity));
  const scene = group; // alias for clarity below

  // --- ground ---------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- sea + foam -----------------------------------------------------------
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 560),
    new THREE.MeshLambertMaterial({ color: CFG.sea.color }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CFG.sea.shoreX + 160, 0.05, 0);
  scene.add(sea);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 560),
    new THREE.MeshBasicMaterial({ color: 0xf4ecd8 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(CFG.sea.shoreX + 1, 0.12, 0);
  scene.add(foam);
  colliders.push({ minX: CFG.sea.shoreX + 6, maxX: 600, minZ: -400, maxZ: 400 });

  // --- buildings (dense: 2x2 lots per block) ---------------------------------
  // Five wall shades x varied window grids; repeat scales with building size
  // so windows stay roughly square instead of stretching over tall towers.
  const baseWinTexs = [
    windowTexture('#ece8de', 4, 10, 0.18),
    windowTexture('#f2e8d8', 6, 12, 0.12),
    windowTexture('#dde4ea', 3, 8, 0.25),
    windowTexture('#e8d8c8', 5, 9, 0.20),
    windowTexture('#d8e0d0', 4, 12, 0.15),
  ];
  const matCache = new Map();
  function wallMaterial(texIdx, bw, h, colorHex) {
    const rx = Math.max(1, Math.min(4, Math.round(bw / 14)));
    const ry = Math.max(1, Math.min(5, Math.round(h / 14)));
    const key = `${texIdx}|${rx}|${ry}|${colorHex}`;
    let mat = matCache.get(key);
    if (!mat) {
      const tex = baseWinTexs[texIdx].clone();
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      mat = new THREE.MeshLambertMaterial({ map: tex, color: colorHex });
      matCache.set(key, mat);
    }
    return mat;
  }
  const signDefs = [
    ['TACOS', '#d84a4a', '#fff3c4'], ['VERDE', '#2e7f8f', '#ffffff'],
    ['MARINA', '#f2c14e', '#26374e'], ['SURF', '#3aa88f', '#ffffff'],
    ['CAFE', '#8a5a3a', '#ffe9b0'], ['PIZZA', '#c94a7a', '#ffffff'],
    ['BAR', '#26374e', '#ffd98a'], ['HOTEL', '#5a6f8f', '#ffffff'],
    ['MARKET', '#3a7a4a', '#ffffff'], ['PHARMACY', '#e8e4da', '#2e7f8f'],
  ];
  const signTexs = signDefs.map(([t, bg, fg]) => signTexture(t, bg, fg));
  const neonColors = [0xff5a7a, 0x39d0ff, 0xffd23e, 0x7dff5a, 0xff9a3d];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4440 });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
  const ledgeMat = new THREE.MeshLambertMaterial({ color: 0x6a5a48 });
  const awningMats = [
    new THREE.MeshLambertMaterial({ color: 0xd84a4a }),
    new THREE.MeshLambertMaterial({ color: 0x2e7f8f }),
    new THREE.MeshLambertMaterial({ color: 0xf2c14e }),
  ];

  const blockCells = [];
  for (let i = 0; i < ROAD_X.length - 1; i++) {
    for (let j = 0; j < ROAD_Z.length - 1; j++) {
      // Tight street walls: blocks start only 1.5 m from the road edge.
      const x0 = ROAD_X[i] + CFG.roadWidth / 2 + 1.5;
      const x1 = ROAD_X[i + 1] - CFG.roadWidth / 2 - 1.5;
      const z0 = ROAD_Z[j] + CFG.roadWidth / 2 + 1.5;
      const z1 = ROAD_Z[j + 1] - CFG.roadWidth / 2 - 1.5;
      blockCells.push({ x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
    }
  }
  let buildingCount = 0;
  for (const cell of blockCells) {
    const d = districtAt(cell.cx, cell.cz);
    if (cell.cx > 200) continue;
    const w = cell.x1 - cell.x0, dep = cell.z1 - cell.z0;
    const isDowntown = d.name === 'Downtown';
    // 2x2 lots per block with a narrow 2.5 m gap — buildings packed tight.
    const gap = 2.5;
    const lotW = (w - gap) / 2, lotD = (dep - gap) / 2;
    for (let lx = 0; lx < 2; lx++) {
      for (let lz = 0; lz < 2; lz++) {
        const lotX0 = cell.x0 + lx * (lotW + gap);
        const lotZ0 = cell.z0 + lz * (lotD + gap);
        const lotCx = lotX0 + lotW / 2, lotCz = lotZ0 + lotD / 2;
        // Footprint fills 78–92% of the lot (small setbacks, tight streets).
        const bw = lotW * (0.78 + rnd() * 0.14);
        const bd = lotD * (0.78 + rnd() * 0.14);
        const bx = lotCx + (rnd() - 0.5) * (lotW - bw) * 0.4;
        const bz = lotCz + (rnd() - 0.5) * (lotD - bd) * 0.4;
        // Height: Downtown gets a landmark tower on one lot per block.
        const isTower = isDowntown && lx === 0 && lz === 0;
        const h = isTower
          ? 48 + rnd() * 24
          : d.hMin + rnd() * (d.hMax - d.hMin);
        // Slight per-building tint variation so facades don't match.
        const tint = d.color;
        const texIdx = Math.floor(rnd() * baseWinTexs.length);
        const mat = wallMaterial(texIdx, bw, h, tint);
        const mesh = boxMesh(mat, bw, h, bd, bx, h / 2, bz, true);
        scene.add(mesh);
        // Roof cap.
        scene.add(boxMesh(roofMat, bw + 0.6, 0.5, bd + 0.6, bx, h + 0.25, bz, false));
        // Mid ledge band (floor separator) on taller buildings.
        if (h > 14) {
          const ly = h * (0.45 + rnd() * 0.2);
          scene.add(boxMesh(ledgeMat, bw + 0.4, 0.35, bd + 0.4, bx, ly, bz, false));
        }
        // Balconies on the street-facing side (upper floors).
        const nBal = h > 10 ? (rnd() < 0.55 ? 1 + Math.floor(rnd() * 2) : 0) : 0;
        for (let b = 0; b < nBal; b++) {
          const by = 5 + rnd() * Math.max(1, h - 8);
          const face = rnd() < 0.5 ? 1 : -1;
          const bal = boxMesh(ledgeMat, 2.2, 0.18, 1.1, bx + (rnd() - 0.5) * bw * 0.5, by, bz + face * (bd / 2 + 0.5), false);
          scene.add(bal);
        }
        // Rooftop clutter: AC units, water tank, antenna, neon sign.
        if (rnd() < 0.7) {
          const ac = boxMesh(acMat, 2.4, 1.1, 2.4, bx + (rnd() - 0.5) * bw * 0.4, h + 1.0, bz + (rnd() - 0.5) * bd * 0.4, false);
          scene.add(ac);
        }
        if (rnd() < 0.4) {
          const tank = new THREE.Mesh(unitCyl, acMat);
          tank.scale.set(1.4, 2.6, 1.4);
          tank.position.set(bx + (rnd() - 0.5) * bw * 0.5, h + 1.6, bz + (rnd() - 0.5) * bd * 0.5);
          tank.castShadow = true;
          scene.add(tank);
        }
        if (rnd() < 0.25) {
          const ant = new THREE.Mesh(unitCyl, acMat);
          ant.scale.set(0.12, 4 + rnd() * 3, 0.12);
          ant.position.set(bx + (rnd() - 0.5) * bw * 0.5, h + 2.5 + rnd(), bz + (rnd() - 0.5) * bd * 0.5);
          scene.add(ant);
        }
        if (rnd() < 0.22) {
          const neon = new THREE.Mesh(
            new THREE.PlaneGeometry(6 + rnd() * 4, 1.2),
            new THREE.MeshBasicMaterial({ color: neonColors[Math.floor(rnd() * neonColors.length)] }),
          );
          neon.position.set(bx, h + 1.2, bz + bd / 2 + 0.2);
          scene.add(neon);
        }
        // Storefront awning + sign (ground floor, facing the nearest road).
        if (rnd() < 0.55) {
          const awn = boxMesh(awningMats[Math.floor(rnd() * awningMats.length)], Math.min(bw, 12), 0.4, 3.2, bx, 3.4, bz + bd / 2 + 1.4, false);
          awn.rotation.x = 0.25;
          scene.add(awn);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(9, 3.4),
            new THREE.MeshBasicMaterial({ map: signTexs[Math.floor(rnd() * signTexs.length)] }),
          );
          sign.position.set(bx, 5.6, bz + bd / 2 + 0.15);
          scene.add(sign);
        }
        colliders.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2 });
        buildingCount++;
      }
    }
  }

  // --- palms ------------------------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f, side: THREE.DoubleSide });
  const frondMat2 = new THREE.MeshLambertMaterial({ color: 0x2f7a3f, side: THREE.DoubleSide });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 7, 7);
  const frondGeo = new THREE.ConeGeometry(0.9, 3.6, 4);
  const palms = [];
  function makePalm(x, z, s) {
    const g = new THREE.Group();
    const lean = (rnd() - 0.5) * 0.12;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.set(s, s, s);
    trunk.position.y = 3.5 * s;
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    g.add(trunk);
    // 7 drooping fronds: flattened cones angled down-out, not a flat star.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.3;
      const frond = new THREE.Mesh(frondGeo, i % 2 ? frondMat : frondMat2);
      frond.scale.set(s, s, 0.22 * s);
      frond.position.set(Math.cos(a) * 1.1 * s, 7.1 * s, Math.sin(a) * 1.1 * s);
      frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      frond.rotation.y = -a;
      frond.castShadow = true;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    palms.push(g);
    return g;
  }
  // Boulevard palms (sidewalk, never in the road).
  for (let z = -190; z <= 190; z += 24) {
    makePalm(196, z + (rnd() - 0.5) * 4, 0.9 + rnd() * 0.3);
    if (rnd() < 0.6) makePalm(174, z + 12, 0.85 + rnd() * 0.3);
  }
  // Scattered palms in Marina Bay + Palms Row.
  for (let i = 0; i < 26; i++) {
    const x = -180 + rnd() * 360, z = -180 + rnd() * 360;
    const d = districtAt(x, z);
    if ((d.name === 'Marina Bay' || d.name === 'Palms Row') && Math.abs(x) < 200) makePalm(x, z, 0.85 + rnd() * 0.4);
  }

  // --- billboards ---------------------------------------------------------------
  const billboards = [
    { x: -40, z: -150, text: 'COSTA VERDE', bg: '#d84a4a', fg: '#fff3c4' },
    { x: 140, z: 60, text: 'VERDE GT', bg: '#2e7f8f', fg: '#ffffff' },
    { x: -150, z: 140, text: 'MARINA NIGHTS', bg: '#f2c14e', fg: '#26374e' },
    { x: 60, z: -150, text: 'SUNSET BAR', bg: '#c94a7a', fg: '#ffffff' },
  ];
  for (const b of billboards) {
    const pole = new THREE.Mesh(unitCyl, roofMat);
    pole.scale.set(0.5, 9, 0.5);
    pole.position.set(b.x, 4.5, b.z);
    pole.castShadow = true;
    scene.add(pole);
    const panel = boxMesh(
      new THREE.MeshLambertMaterial({ map: signTexture(b.text, b.bg, b.fg) }),
      14, 5, 0.6, b.x, 11.5, b.z, true,
    );
    scene.add(panel);
    colliders.push({ minX: b.x - 0.8, maxX: b.x + 0.8, minZ: b.z - 0.8, maxZ: b.z + 0.8 });
  }

  // World bounds.
  colliders.push({ minX: -260, maxX: -242, minZ: -400, maxZ: 400 });
  colliders.push({ minX: 242, maxX: 260, minZ: -400, maxZ: 400 });
  colliders.push({ minX: -400, maxX: 400, minZ: -260, maxZ: -242 });
  colliders.push({ minX: -400, maxX: 400, minZ: 242, maxZ: 260 });

  return { group, colliders, buildingCount, palmCount: palms.length, sunDir };
}
