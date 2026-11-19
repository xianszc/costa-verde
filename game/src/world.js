// COSTA VERDE Round 5 — world: roads-first city (city-layout.js), neon
// dusk atmosphere, district character, park, street furniture.
// All procedural (canvas textures + low-poly geometry). No external assets.
// The layout (roads, blocks, buildings, trees, furniture, billboards,
// park) comes from buildCityLayout() — the same data the validator checks —
// so the rendered city and the validated city can never drift apart.
// Exports buildWorld(THREE) -> { group, colliders, buildingCount,
// palmCount, sunDir, sun, hemi, fill, layout }.

import * as THREE from 'three';
import { CFG, DISTRICTS } from './config.js';
import { buildCityLayout, ROAD_LINES, ROAD_WIDTH } from './city-layout.js';

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

// Neon window palette (reference atmosphere): a lit window picks one of
// these colours; unlit windows stay dark glass. Lit share varies by
// district — Downtown glows hardest, residential stays mostly warm.
const NEON_WIN = ['#ff6aa8', '#4fd8ff', '#ffd23e', '#7dff8a', '#ff9a3d'];
const NEON_PROFILES = {
  downtown: { lit: 0.35, warm: 0.15 },
  commercial: { lit: 0.25, warm: 0.3 },
  residential: { lit: 0.15, warm: 0.6 },
};
function profileFor(district) {
  if (district === 'Downtown') return 'downtown';
  if (district === 'Palms Row') return 'residential';
  return 'commercial';
}

// Window texture: light wall (tinted later by the material colour), dark
// glass grid, a subset of windows lit in neon colours, dark shopfront band
// at the ground floor.
function windowTexture(wall, cols, rows, profile) {
  const [c, g] = makeCanvas(128, 256);
  g.fillStyle = wall; g.fillRect(0, 0, 128, 256);
  const rnd = mulberry32(wall.length * 7919 + cols * 31 + rows * 7 + profile.length * 131);
  const prof = NEON_PROFILES[profile];
  const cw = 128 / cols, ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (rnd() < prof.lit) {
        g.fillStyle = rnd() < prof.warm ? '#ffd98a' : NEON_WIN[Math.floor(rnd() * NEON_WIN.length)];
      } else {
        // Round 5 fix: the old dark glass (#26374e) made whole facades read
        // as black slabs from the sun-back side. Lighter glass + wider wall
        // frames keep the building's colour readable.
        g.fillStyle = '#41546e';
      }
      g.fillRect(col * cw + 4, r * ch + 5, cw - 8, ch - 10);
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

// Ground texture: roads, sidewalks, dashes, crosswalks at every
// intersection, the park as a green block with paths, beach, grass blocks.
function groundTexture(layout) {
  const S = 2048, W = 560; // canvas maps -280..280 m
  const [c, g] = makeCanvas(S, S);
  const toPx = (v) => ((v + W / 2) / W) * S;
  const px = (m) => (m / W) * S;
  g.fillStyle = '#6f9e52'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#e8cf9e';
  g.fillRect(toPx(210), 0, px(44), S);
  g.fillStyle = '#b9a98c';
  g.fillRect(toPx(-HALF), toPx(-HALF), px(CFG.citySize), px(CFG.citySize));
  // The park reads green, with two crossing paths.
  g.fillStyle = CFG.palette.grass;
  g.fillRect(toPx(layout.park.x0), toPx(layout.park.z0), px(layout.park.x1 - layout.park.x0), px(layout.park.z1 - layout.park.z0));
  g.fillStyle = '#d8cba8';
  g.fillRect(toPx(layout.park.cx - 1.5), toPx(layout.park.z0), px(3), px(layout.park.z1 - layout.park.z0));
  g.fillRect(toPx(layout.park.x0), toPx(layout.park.cz - 1.5), px(layout.park.x1 - layout.park.x0), px(3));
  g.fillStyle = CFG.palette.asphalt;
  for (const x of ROAD_LINES) g.fillRect(toPx(x - ROAD_WIDTH / 2), 0, px(ROAD_WIDTH), S);
  for (const z of ROAD_LINES) g.fillRect(0, toPx(z - ROAD_WIDTH / 2), S, px(ROAD_WIDTH));
  g.fillStyle = '#f2c14e';
  for (const x of ROAD_LINES) {
    for (let z = -HALF; z < HALF; z += 16) g.fillRect(toPx(x) - 2, toPx(z), 4, px(8));
  }
  for (const z of ROAD_LINES) {
    for (let x = -HALF; x < HALF; x += 16) g.fillRect(toPx(x), toPx(z) - 2, px(8), 4);
  }
  // Crosswalks: zebra stripes across every road at every intersection.
  g.fillStyle = 'rgba(240,240,230,0.85)';
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(toPx(x - 7 + i * 2), toPx(z - 5), px(1), px(10)); // across road x
        g.fillRect(toPx(x - 5), toPx(z - 7 + i * 2), px(10), px(1)); // across road z
      }
    }
  }
  return canvasTex(c);
}

export function buildWorld(THREE) {
  const layout = buildCityLayout();
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
  // Round 5: purple-pink dusk (top) to warm orange horizon (low) — the
  // reference atmosphere. Still golden hour: the horizon stays bright, the
  // zenith is a mid purple, never black.
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
  const hemi = new THREE.HemisphereLight(CFG.sun.ambientSky, CFG.sun.ambientGround, CFG.sun.ambientIntensity);
  group.add(hemi);
  // Slice 4 fill: warm bounce from the east (the sun-back side), no
  // shadows — the cheap fix for facades and roads reading black.
  const fill = new THREE.DirectionalLight(CFG.sun.fillColor, CFG.sun.fillIntensity);
  fill.position.set(-sunDir.x * 300, 120, -sunDir.z * 300);
  group.add(fill);
  const scene = group; // alias for clarity below

  // --- ground ---------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ map: groundTexture(layout) }),
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

  // --- buildings (from the layout — roads-first, planned blocks) -------------
  // Five wall shades x three neon profiles (downtown / commercial /
  // residential); repeat scales with building size so windows stay roughly
  // square instead of stretching over tall towers.
  const wallShades = ['#ece8de', '#f2e8d8', '#dde4ea', '#e8d8c8', '#d8e0d0'];
  const winGrids = [[4, 10], [6, 12], [3, 8], [5, 9], [4, 12]];
  const baseWinTexs = new Map(); // `${shade}|${profile}` -> texture
  function winTex(shadeIdx, profile) {
    const key = `${shadeIdx}|${profile}`;
    let t = baseWinTexs.get(key);
    if (!t) {
      const [cols, rows] = winGrids[shadeIdx];
      t = windowTexture(wallShades[shadeIdx], cols, rows, profile);
      baseWinTexs.set(key, t);
    }
    return t;
  }
  const matCache = new Map();
  function wallMaterial(shadeIdx, profile, bw, h, colorHex) {
    const rx = Math.max(1, Math.min(4, Math.round(bw / 14)));
    const ry = Math.max(1, Math.min(5, Math.round(h / 14)));
    const key = `${shadeIdx}|${profile}|${rx}|${ry}|${colorHex}`;
    let mat = matCache.get(key);
    if (!mat) {
      const tex = winTex(shadeIdx, profile).clone();
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

  // Place a flat plane on the building's street-facing side.
  function faceTransform(b, y, out) {
    if (b.facing === 'south') return { x: b.x, z: b.z + b.d / 2 + out, rotY: 0 };
    if (b.facing === 'north') return { x: b.x, z: b.z - b.d / 2 - out, rotY: Math.PI };
    if (b.facing === 'east') return { x: b.x + b.w / 2 + out, z: b.z, rotY: Math.PI / 2 };
    return { x: b.x - b.w / 2 - out, z: b.z, rotY: -Math.PI / 2 };
  }

  let buildingCount = 0;
  for (const b of layout.buildings) {
    const detail = mulberry32(b.seed); // per-building details, deterministic
    const profile = profileFor(b.district);
    const mat = wallMaterial(b.texIdx, profile, b.w, b.h, b.tint);
    const mesh = boxMesh(mat, b.w, b.h, b.d, b.x, b.h / 2, b.z, true);
    scene.add(mesh);
    // Roof cap.
    scene.add(boxMesh(roofMat, b.w + 0.6, 0.5, b.d + 0.6, b.x, b.h + 0.25, b.z, false));
    // Mid ledge band (floor separator) on taller buildings.
    if (b.h > 14) {
      const ly = b.h * (0.45 + detail() * 0.2);
      scene.add(boxMesh(ledgeMat, b.w + 0.4, 0.35, b.d + 0.4, b.x, ly, b.z, false));
    }
    // Balconies on the street-facing side (upper floors).
    const nBal = b.h > 10 ? (detail() < 0.55 ? 1 + Math.floor(detail() * 2) : 0) : 0;
    for (let i = 0; i < nBal; i++) {
      const by = 5 + detail() * Math.max(1, b.h - 8);
      const face = detail() < 0.5 ? 1 : -1;
      const bal = boxMesh(ledgeMat, 2.2, 0.18, 1.1, b.x + (detail() - 0.5) * b.w * 0.5, by, b.z + face * (b.d / 2 + 0.5), false);
      scene.add(bal);
    }
    // Rooftop clutter: AC units, water tank, antenna, neon sign.
    if (detail() < 0.7) {
      const ac = boxMesh(acMat, 2.4, 1.1, 2.4, b.x + (detail() - 0.5) * b.w * 0.4, b.h + 1.0, b.z + (detail() - 0.5) * b.d * 0.4, false);
      scene.add(ac);
    }
    if (detail() < 0.4) {
      const tank = new THREE.Mesh(unitCyl, acMat);
      tank.scale.set(1.4, 2.6, 1.4);
      tank.position.set(b.x + (detail() - 0.5) * b.w * 0.5, b.h + 1.6, b.z + (detail() - 0.5) * b.d * 0.5);
      tank.castShadow = true;
      scene.add(tank);
    }
    if (detail() < 0.25) {
      const ant = new THREE.Mesh(unitCyl, acMat);
      ant.scale.set(0.12, 4 + detail() * 3, 0.12);
      ant.position.set(b.x + (detail() - 0.5) * b.w * 0.5, b.h + 2.5 + detail(), b.z + (detail() - 0.5) * b.d * 0.5);
      scene.add(ant);
    }
    // Neon roof sign (Round 5): bigger, brighter, with a glow halo; most
    // common Downtown, rare in residential. Faces the street.
    const neonChance = b.district === 'Downtown' ? 0.35 : b.district === 'Palms Row' ? 0.08 : 0.2;
    if (detail() < neonChance) {
      const col = neonColors[Math.floor(detail() * neonColors.length)];
      const nw = 8 + detail() * 6;
      const ft = faceTransform(b, b.h + 1.2, 0.2);
      const neon = new THREE.Mesh(
        new THREE.PlaneGeometry(nw, 1.6),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      neon.position.set(ft.x, b.h + 1.2, ft.z);
      neon.rotation.y = ft.rotY;
      scene.add(neon);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(nw + 2.5, 3.2),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16 }),
      );
      glow.position.set(ft.x, b.h + 1.2, ft.z);
      glow.rotation.y = ft.rotY;
      scene.add(glow);
    }
    // Storefront awning + sign (ground floor, facing the street).
    const signChance = b.district === 'Palms Row' ? 0.4 : 0.7;
    if (detail() < signChance) {
      const ft = faceTransform(b, 0, 1.4);
      const along = b.facing === 'east' || b.facing === 'west';
      const awn = along
        ? boxMesh(awningMats[Math.floor(detail() * awningMats.length)], 3.2, 0.4, Math.min(b.d, 12), ft.x, 3.4, ft.z, false)
        : boxMesh(awningMats[Math.floor(detail() * awningMats.length)], Math.min(b.w, 12), 0.4, 3.2, ft.x, 3.4, ft.z, false);
      awn.rotation.x = along ? 0 : 0.25;
      awn.rotation.z = along ? -0.25 : 0;
      scene.add(awn);
      const sft = faceTransform(b, 0, 0.15);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(11, 4),
        new THREE.MeshBasicMaterial({ map: signTexs[Math.floor(detail() * signTexs.length)] }),
      );
      sign.position.set(sft.x, 5.6, sft.z);
      sign.rotation.y = sft.rotY;
      scene.add(sign);
    }
    colliders.push({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ });
    buildingCount++;
  }

  // --- palms (from the layout — green zones only) ------------------------------
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
  for (const t of layout.trees) makePalm(t.x, t.z, t.s);

  // --- billboards (promenade, facing the road) ----------------------------------
  for (const b of layout.billboards) {
    const pole = new THREE.Mesh(unitCyl, roofMat);
    pole.scale.set(0.5, 9, 0.5);
    pole.position.set(b.x, 4.5, b.z);
    pole.castShadow = true;
    scene.add(pole);
    const panel = boxMesh(
      new THREE.MeshLambertMaterial({ map: signTexture(b.text, b.bg, b.fg) }),
      14, 5, 0.6, b.x, 11.5, b.z, true,
    );
    panel.rotation.y = Math.PI / 2; // face west, toward the boulevard
    scene.add(panel);
    colliders.push({ minX: b.x - 0.8, maxX: b.x + 0.8, minZ: b.z - 0.8, maxZ: b.z + 0.8 });
  }

  // --- street furniture -----------------------------------------------------------
  // Lamps: one InstancedMesh for all poles + one for all heads (2 draw
  // calls for the whole city). Heads glow warm (unlit material = bright).
  const lamps = layout.furniture.filter((f) => f.kind === 'lamp');
  if (lamps.length > 0) {
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 4.6, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length);
    const headGeo = new THREE.BoxGeometry(0.55, 0.22, 0.22);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    const headInst = new THREE.InstancedMesh(headGeo, headMat, lamps.length);
    const m4 = new THREE.Matrix4();
    lamps.forEach((l, i) => {
      m4.makeTranslation(l.x, 2.3, l.z);
      poleInst.setMatrixAt(i, m4);
      m4.makeTranslation(l.x, 4.7, l.z);
      headInst.setMatrixAt(i, m4);
    });
    poleInst.castShadow = true;
    scene.add(poleInst);
    scene.add(headInst);
  }
  // Benches + bins: few meshes, shared materials.
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const binMat = new THREE.MeshLambertMaterial({ color: 0x3a5a3a });
  for (const f of layout.furniture) {
    if (f.kind === 'bench') {
      scene.add(boxMesh(benchMat, 1.8, 0.15, 0.6, f.x, 0.45, f.z, false));
      scene.add(boxMesh(benchMat, 1.8, 0.6, 0.12, f.x, 0.8, f.z - 0.25, false));
    } else if (f.kind === 'bin') {
      const bin = new THREE.Mesh(unitCyl, binMat);
      bin.scale.set(0.35, 0.9, 0.35);
      bin.position.set(f.x, 0.45, f.z);
      bin.castShadow = true;
      scene.add(bin);
    }
  }

  // --- park paths (the grass + paths are in the ground texture) ------------------
  // Two crossing path strips as thin light slabs, just above the ground.
  const pathMat = new THREE.MeshLambertMaterial({ color: 0xd8cba8 });
  const p = layout.park;
  const pathX = boxMesh(pathMat, p.x1 - p.x0, 0.06, 3, p.cx, 0.03, p.cz, false);
  const pathZ = boxMesh(pathMat, 3, 0.06, p.z1 - p.z0, p.cx, 0.03, p.cz, false);
  scene.add(pathX);
  scene.add(pathZ);

  // World bounds.
  colliders.push({ minX: -260, maxX: -242, minZ: -400, maxZ: 400 });
  colliders.push({ minX: 242, maxX: 260, minZ: -400, maxZ: 400 });
  colliders.push({ minX: -400, maxX: 400, minZ: -260, maxZ: -242 });
  colliders.push({ minX: -400, maxX: 400, minZ: 242, maxZ: 260 });

  return { group, colliders, buildingCount, palmCount: palms.length, sunDir, sun, hemi, fill, layout };
}
