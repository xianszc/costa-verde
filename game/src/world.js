// AZZURA HEIST — district architecture (fresh rewrite, fix round).
// Every hero building is built procedurally from primitives, in its district's
// own visual vocabulary and palette. No generic box-with-windows buildings:
// each district reads by silhouette and color alone from far away.
// Fix round: 4 procedural tree types, a real fountain, animated shader water,
// same-blue LOD towers, tidy mullion facades, merged static geometry +
// instancing to cut draw calls.
import * as THREE from '../vendor/three.module.min.js';

// ---------- material + primitive helpers ----------
export function M(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.92, metalness: 0.0, flatShading: true, ...opts,
  });
}
function mesh(geo, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, M(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function box(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, opts);
}
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 14, opts = {}) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, opts);
}
export function cone(r, h, color, x = 0, y = 0, z = 0, seg = 12, opts = {}) {
  return mesh(new THREE.ConeGeometry(r, h, seg), color, x, y, z, opts);
}
export function sph(r, color, x = 0, y = 0, z = 0, opts = {}) {
  return mesh(new THREE.SphereGeometry(r, 12, 10), color, x, y, z, opts);
}
// Half-cylinder arch top (for arched windows / gates), axis along Z.
export function archTop(r, color, x, y, z, opts = {}) {
  const g = new THREE.CylinderGeometry(r, r, 0.24, 12, 1, false, 0, Math.PI);
  const m = new THREE.Mesh(g, M(color, opts));
  m.rotation.x = Math.PI / 2;
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function roofSlab(w, d, color, x, y, z) {
  return box(w + 0.3, 0.18, d + 0.3, color, x, y, z);
}
function pitchedRoof(w, d, color, x, y, z) {
  // Two sloped slabs meeting at a ridge.
  const g = new THREE.Group();
  const a = box(w / 2 + 0.2, 0.14, d + 0.3, color, -w / 4, 0.28, 0);
  a.rotation.z = 0.42;
  const b = box(w / 2 + 0.2, 0.14, d + 0.3, color, w / 4, 0.28, 0);
  b.rotation.z = -0.42;
  g.add(a, b);
  g.position.set(x, y, z);
  return g;
}

// ---------- geometry merging (fix 6: cut draw calls) ----------
// Merge any set of geometries (indexed or not) into one non-indexed geometry.
// All inputs must carry the same attribute set (position, normal, uv, and
// optionally color). The merged geometry keeps a single material.
export function mergeGeometries(geoms) {
  const pos = [], nor = [], uv = [], col = [];
  let hasColor = true;
  for (const g of geoms) {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.attributes.position;
    const n = src.attributes.normal;
    const u = src.attributes.uv;
    const c = src.attributes.color;
    if (!c) hasColor = false;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (u) uv.push(u.getX(i), u.getY(i));
      if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    if (src !== g) src.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (uv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (hasColor && col.length) out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.clearGroups();
  return out;
}
// Clone a geometry and bake a transform into it (position / rotation / scale).
export function xform(geo, x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) {
  const g = geo.clone();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
  g.applyMatrix4(m);
  return g;
}
// Paint a solid color into a geometry's vertex-color attribute.
export function colored(geo, hex) {
  const c = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Sidewalk vertex colours (road look fix item 3b): the top face keeps
// the material colour (#dccfb8), the kerb faces get #bfb39d. The
// vertex colour multiplies the material colour, so the kerb tint is
// the component-wise ratio (0xbf/0xdc, 0xb3/0xcf, 0x9d/0xb8).
// Sidewalk boxes are translated, never rotated, so the +Y normal is
// always the top face.
export function coloredKerb(geo) {
  const count = geo.attributes.position.count;
  const n = geo.attributes.normal;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const top = n.getY(i) > 0.5;
    arr[i * 3] = top ? 1 : 0.868;
    arr[i * 3 + 1] = top ? 1 : 0.865;
    arr[i * 3 + 2] = top ? 1 : 0.853;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
// One mesh from a list of already-transformed geometries + a material.
export function mergedMesh(geoms, material) {
  const m = new THREE.Mesh(mergeGeometries(geoms), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
// Merge every mesh under `root` (called while root is at identity, so local
// transforms bake in cleanly) into one mesh per MATERIAL KEY. Bucketing is
// by material properties (color / roughness / metalness / emissive /
// transparency / maps), NOT by material object identity: the box()/cyl()
// helpers create a fresh material per call, and without key bucketing two
// same-color boxes would never merge. Objects named in `keep` (e.g. the
// lighthouse beam pivot, windmill sails) and objects with userData.noMerge
// stay as separate children so they can still animate.
function matKey(mat) {
  return [
    mat.type,
    mat.color ? mat.color.getHexString() : '',
    mat.roughness ?? '',
    mat.metalness ?? '',
    mat.emissive ? mat.emissive.getHexString() : '',
    mat.emissiveIntensity ?? '',
    mat.transparent ? 1 : 0,
    mat.opacity ?? '',
    mat.flatShading ? 1 : 0,
    mat.side ?? '',
    mat.vertexColors ? 1 : 0,
    mat.map ? 'map' + mat.map.uuid : '',
    mat.emissiveMap ? 'emap' + mat.emissiveMap.uuid : '',
  ].join('|');
}
export function mergeStatic(root, keep = []) {
  root.updateMatrixWorld(true);
  const keepSet = new Set(keep);
  const byKey = new Map(); // key -> { mat, geoms: [] }
  const kept = [];
  const collect = (obj) => {
    if (obj.userData && obj.userData.noMerge) { kept.push(obj); return; }
    if (keepSet.has(obj.name)) { kept.push(obj); return; }
    if (obj.isPoints || obj.isLine || obj.isSprite || obj.isInstancedMesh) { kept.push(obj); return; }
    if (obj.isMesh) {
      const key = matKey(obj.material);
      const g = obj.geometry.clone();
      g.applyMatrix4(obj.matrixWorld);
      if (!byKey.has(key)) byKey.set(key, { mat: obj.material, geoms: [] });
      byKey.get(key).geoms.push(g);
      return;
    }
    for (const c of obj.children) collect(c);
  };
  for (const c of [...root.children]) collect(c);
  root.clear();
  for (const { mat, geoms } of byKey.values()) {
    root.add(mergedMesh(geoms, mat));
  }
  for (const k of kept) root.add(k);
  return root;
}

// Shared vertex-colored material (trees, merged street props): one material,
// colors baked per vertex, tinted per instance via instanceColor.
export const vertexColorMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.9, metalness: 0.0, flatShading: true,
});

// ---------- trees (fix 1: 4 procedural types, no identical blobs) ----------
// Each tree type is one merged vertex-colored geometry (trunk + canopy baked
// in). Single trees use makeTree(); the park scatters them with
// treeInstanced() — one InstancedMesh per type, varied scale / rotation /
// tint per instance.
function treeGeometry(type) {
  const parts = [];
  const add = (geo, hex) => parts.push(colored(geo, hex));
  if (type === 'round') {
    add(xform(new THREE.CylinderGeometry(0.13, 0.2, 1.3, 7), 0, 0.65, 0), 0x6b4a2a);
    add(xform(new THREE.SphereGeometry(0.95, 10, 8), 0, 1.9, 0), 0x3f7a4e);
    add(xform(new THREE.SphereGeometry(0.6, 9, 7), 0.55, 1.5, 0.25), 0x4d8a5c);
    add(xform(new THREE.SphereGeometry(0.5, 9, 7), -0.5, 1.55, -0.2), 0x356b42);
  } else if (type === 'cypress') {
    add(xform(new THREE.CylinderGeometry(0.12, 0.18, 1.0, 7), 0, 0.5, 0), 0x5a3d24);
    add(xform(new THREE.ConeGeometry(0.55, 2.2, 8), 0, 2.0, 0), 0x2f5233);
    add(xform(new THREE.ConeGeometry(0.42, 1.8, 8), 0, 3.0, 0), 0x3a633d);
    add(xform(new THREE.ConeGeometry(0.26, 1.3, 8), 0, 3.9, 0), 0x2f5233);
  } else if (type === 'palm') {
    add(xform(new THREE.CylinderGeometry(0.09, 0.15, 2.6, 7), 0, 1.3, 0, 0, 1, 0.06), 0x8a6a4a);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const frond = new THREE.BoxGeometry(0.16, 0.05, 1.4);
      add(xform(frond, Math.cos(a) * 0.55, 2.72, Math.sin(a) * 0.55, -a, 1, 0.55), 0x3f7a4e);
    }
    add(xform(new THREE.SphereGeometry(0.16, 8, 6), 0.12, 2.55, 0.12), 0x6b4a2a);
    add(xform(new THREE.SphereGeometry(0.13, 8, 6), -0.12, 2.5, -0.1), 0x7a5a34);
  } else { // 'pine' — umbrella / stone pine
    add(xform(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 7), 0, 1.2, 0), 0x7a5a3a);
    add(xform(new THREE.CylinderGeometry(1.35, 1.15, 0.35, 12), 0, 2.85, 0), 0x4a7a44);
    add(xform(new THREE.SphereGeometry(1.1, 10, 6), 0, 3.05, 0), 0x557f4c);
    add(xform(new THREE.SphereGeometry(0.55, 8, 6), 0.8, 2.75, 0.3), 0x3f6b3a);
  }
  return mergeGeometries(parts);
}
const treeGeos = {};
function getTreeGeo(type) {
  if (!treeGeos[type]) treeGeos[type] = treeGeometry(type);
  return treeGeos[type];
}
export const TREE_TYPES = ['round', 'cypress', 'palm', 'pine'];
// One tree as a single mesh (for hero buildings and accents).
export function makeTree(type, scale = 1, tint = 0xffffff) {
  const m = new THREE.Mesh(getTreeGeo(type), vertexColorMat);
  m.scale.setScalar(scale);
  m.castShadow = true;
  m.receiveShadow = true;
  if (tint !== 0xffffff) {
    m.material = vertexColorMat.clone();
    m.material.color.setHex(tint);
  }
  return m;
}
// Many trees of one type as a single draw call. placements: {x, z, s, rot, tint}.
export function treeInstanced(type, placements) {
  const inst = new THREE.InstancedMesh(getTreeGeo(type), vertexColorMat, placements.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  placements.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(0, p.rot || 0, 0));
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.setHex(p.tint || 0xffffff));
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  return inst;
}
// Classic palm, kept as a Group API for the promenade + lineup rows.
export function palm(x, z, s = 1) {
  const t = makeTree('palm', s);
  t.position.set(x, 0, z);
  return t;
}
export function lampPost(x, z, color = 0x2b2b2b) {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.07, 2.4, color, 0, 1.2, 0, 8));
  g.add(sph(0.16, 0xffd9a0, 0, 2.5, 0, { emissive: 0xffc46b, emissiveIntensity: 0.9 }));
  g.position.set(x, 0, z);
  return g;
}
// A row of lamp posts merged into 2 meshes (poles + globes) — 2 draw calls
// for the whole row, shadows included.
export function lampRow(xs, z) {
  const g = new THREE.Group();
  const poles = xs.map((x) => xform(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), x, 1.2, z));
  const globes = xs.map((x) => xform(new THREE.SphereGeometry(0.16, 10, 8), x, 2.5, z));
  g.add(mergedMesh(poles, M(0x2b2b2b)));
  g.add(mergedMesh(globes, M(0xffd9a0, { emissive: 0xffc46b, emissiveIntensity: 0.9 })));
  return g;
}

// ---------- fountain (fix 2: layered basin, particle jets, splash) ----------
// A fountain group with a per-frame tick (userData.tick): 3 particle jets
// arc up and fall back into a reflective water disc; a splash ring pulses.
export function fountain(scale = 1) {
  const g = new THREE.Group();
  g.userData.noMerge = true; // kept whole by mergeStatic (jets + splash animate)
  // Layered basin + column + bowls merged into one stone mesh (1 call).
  const stone = [
    xform(new THREE.CylinderGeometry(1.6, 1.75, 0.45, 18), 0, 0.22, 0),
    xform(new THREE.CylinderGeometry(1.35, 1.45, 0.3, 18), 0, 0.5, 0),
    xform(new THREE.CylinderGeometry(0.14, 0.2, 1.0, 10), 0, 1.0, 0),
    xform(new THREE.CylinderGeometry(0.55, 0.4, 0.18, 14), 0, 1.55, 0),
    xform(new THREE.SphereGeometry(0.16, 10, 8), 0, 1.85, 0),
  ].map((geo, i) => colored(geo, i === 4 ? 0xe8a33d : 0xe8dcc4));
  g.add(mergedMesh(stone, vertexColorMat));
  // Reflective water discs merged into one mesh (1 call).
  const waterParts = [
    xform(new THREE.CylinderGeometry(1.25, 1.25, 0.08, 18), 0, 0.62, 0),
    xform(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14), 0, 1.66, 0),
  ].map((geo) => colored(geo, 0x2e8fa8));
  const waterMesh = mergedMesh(waterParts, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.08, metalness: 0.35, flatShading: true,
  }));
  waterMesh.castShadow = false;
  g.add(waterMesh);
  // Splash ring on the water surface (pulses in tick).
  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.95, 20),
    new THREE.MeshBasicMaterial({ color: 0xeaf6f2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  splash.rotation.x = -Math.PI / 2;
  splash.position.y = 0.68;
  g.add(splash);
  // Particle jets: center vertical + two angled arcs. Positions are recomputed
  // every frame from a parabolic flight (age loops 0..1).
  const JETS = [
    { ox: 0, oy: 1.7, oz: 0, vx: 0, vy: 2.6, vz: 0, n: 26 },
    { ox: 0, oy: 1.6, oz: 0, vx: 0.9, vy: 2.0, vz: 0.3, n: 18 },
    { ox: 0, oy: 1.6, oz: 0, vx: -0.8, vy: 2.1, vz: -0.35, n: 18 },
  ];
  const total = JETS.reduce((a, j) => a + j.n, 0);
  const pos = new Float32Array(total * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xdff4f8, size: 0.13, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false,
  }));
  points.frustumCulled = false;
  g.add(points);
  const seeds = [];
  let k = 0;
  for (const j of JETS) for (let i = 0; i < j.n; i++) seeds.push({ j, off: (i / j.n) + Math.random() * 0.05, k: k++ });
  g.userData.tick = (t) => {
    for (const s of seeds) {
      const age = ((t * 0.55 + s.off) % 1);
      const { j } = s;
      const px = j.ox + j.vx * age * 1.4;
      const py = j.oy + j.vy * age * 1.4 - 4.4 * age * age;
      const pz = j.oz + j.vz * age * 1.4;
      pos[s.k * 3] = px; pos[s.k * 3 + 1] = Math.max(py, 0.68); pos[s.k * 3 + 2] = pz;
    }
    geo.attributes.position.needsUpdate = true;
    splash.material.opacity = 0.25 + 0.2 * Math.sin(t * 3.1);
    const sc = 1 + 0.12 * Math.sin(t * 3.1);
    splash.scale.set(sc, sc, 1);
  };
  g.scale.setScalar(scale);
  return g;
}

// ---------- water (fix 4: animated waves, fresnel, foam, depth gradient) ----------
// ShaderMaterial water: vertex waves, fresnel sky reflection, sun glitter,
// depth gradient (shallow near the shore line, deep further out), animated
// foam bands at the shore, manual fog to match the scene haze.
export function makeWater(width, depth, shoreZ, segX = 96, segZ = 48) {
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1d5a6e) },
      uShallow: { value: new THREE.Color(0x3fa8b8) },
      uSky: { value: new THREE.Color(0xf7c98a) },
      uSunDir: { value: new THREE.Vector3(-0.55, 0.45, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xffe9a8) },
      uShoreZ: { value: shoreZ },
      uFogColor: { value: new THREE.Color(0xf2a35e) },
      uFogNear: { value: 70 },
      uFogFar: { value: 175 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.35 + uTime * 1.2) * 0.12
                + sin(p.y * 0.5 - uTime * 0.9) * 0.09
                + sin((p.x + p.y) * 0.22 + uTime * 0.6) * 0.07;
        p.z += w;
        float dx = 0.35 * 0.12 * cos(p.x * 0.35 + uTime * 1.2)
                 + 0.22 * 0.07 * cos((p.x + p.y) * 0.22 + uTime * 0.6);
        float dy = 0.5 * 0.09 * cos(p.y * 0.5 - uTime * 0.9)
                 + 0.22 * 0.07 * cos((p.x + p.y) * 0.22 + uTime * 0.6);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * vec3(-dx, -dy, 1.0));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky;
      uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uShoreZ;
      uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal);
        float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
        float depthT = clamp((vWorldPos.z - uShoreZ) / 40.0, 0.0, 1.0);
        vec3 base = mix(uShallow, uDeep, depthT);
        vec3 col = mix(base, uSky, fres * 0.65);
        vec3 R = reflect(-normalize(uSunDir), N);
        float spec = pow(max(dot(R, V), 0.0), 90.0) * 1.6;
        col += uSunColor * spec;
        float shore = smoothstep(6.0, 0.0, abs(vWorldPos.z - uShoreZ));
        float band = 0.5 + 0.5 * sin(vWorldPos.x * 0.9 + uTime * 1.6 + vWorldPos.z * 1.3);
        float foam = shore * smoothstep(0.55, 0.9, band);
        col = mix(col, vec3(0.92, 0.97, 0.95), foam * 0.75);
        float sp = step(0.985, fract(sin(dot(floor(vWorldPos.xz * 3.0), vec2(12.9898, 78.233))) * 43758.5453));
        col += vec3(1.0, 0.9, 0.7) * sp * 0.12 * (0.5 + 0.5 * sin(uTime * 2.0 + vWorldPos.x));
        float fogF = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWorldPos));
        col = mix(col, uFogColor, fogF * 0.8);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.userData.tick = (t) => { mat.uniforms.uTime.value = t; };
  return m;
}

// ---------- sailboat (fix 4: shaped hull, cabin, wake, gentle bob) ----------
function hullGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.65, -1.8);
  s.lineTo(0.65, -1.8);
  s.lineTo(0.65, 0.9);
  s.quadraticCurveTo(0.65, 1.7, 0, 1.9);
  s.quadraticCurveTo(-0.65, 1.7, -0.65, 0.9);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2); // shape length -> world -Z (bow), extrusion -> +Y
  return geo;
}
export function sailboat(scale = 1, sailColor = 0xf2f0ea, phase = 0) {
  const g = new THREE.Group();
  // Hull + deck + cabin + mast merged into ONE vertex-colored mesh (1 call).
  const parts = [
    xform(colored(hullGeometry(), 0xf2f0ea), 0, 0.28, 0),
    colored(xform(new THREE.BoxGeometry(1.1, 0.1, 2.2), 0, 0.95, -0.1), 0x1f7a8c),
    colored(xform(new THREE.BoxGeometry(1.0, 0.55, 1.3), 0, 1.25, -0.35), 0xe8dcc4),
    colored(xform(new THREE.BoxGeometry(0.95, 0.4, 0.08), 0, 1.5, 0.32, 0, 1, -0.35), 0x2e4a5e),
    colored(xform(new THREE.CylinderGeometry(0.05, 0.07, 4.6, 6), 0, 3.4, 0.1), 0x8a6a4a),
  ];
  g.add(mergedMesh(parts, vertexColorMat));
  const sail = new THREE.Mesh(colored(xform(new THREE.ConeGeometry(1.05, 2.8, 4), 0.55, 3.6, 0.1, Math.PI / 4, 1, 0, 0), sailColor), vertexColorMat);
  sail.scale.z = 0.14;
  sail.material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.7, flatShading: true, side: THREE.DoubleSide,
  });
  g.add(sail);
  // Wake: a fading V triangle trailing behind the stern (-Z).
  const wake = new THREE.Mesh(
    boatWakeGeometry(),
    new THREE.MeshBasicMaterial({ color: 0xeaf6f2, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.32, 1.6);
  g.add(wake);
  g.userData.tick = (t) => {
    g.position.y = Math.sin(t * 0.9 + phase) * 0.07;
    g.rotation.z = Math.sin(t * 0.7 + phase) * 0.02;
    wake.material.opacity = 0.2 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.8 + phase));
  };
  g.scale.setScalar(scale);
  return g;
}

// Shared wake triangle (fading V trailing behind a stern). Cached —
// the geometry is the same for every boat; only the transform differs.
let wakeGeoCache = null;
export function boatWakeGeometry() {
  if (!wakeGeoCache) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(-1.1, -4.2);
    s.lineTo(1.1, -4.2);
    s.closePath();
    wakeGeoCache = new THREE.ShapeGeometry(s);
  }
  return wakeGeoCache;
}

// ---------- district data ----------
export const DISTRICTS = [
  { id: 'villas', name: 'Cliff Villas', hero: 'Cliff Villa', pad: 0xf5efe2 },
  { id: 'marina', name: 'Yacht Marina', hero: 'Harbormaster Pavilion', pad: 0xa9805a },
  { id: 'oldtown', name: 'Fortress Old Town', hero: 'Bell Tower', pad: 0xd9b98a },
  { id: 'promenade', name: 'Promenade & Casino', hero: 'Casino Azzura', pad: 0xf3e6c8 },
  { id: 'lighthouse', name: 'Lighthouse Point', hero: 'The Lighthouse', pad: 0x8a8d91 },
  { id: 'funicular', name: 'Funicular Hills', hero: 'Upper Station', pad: 0xf2c49b },
  { id: 'countryside', name: 'Olive-Grove Countryside', hero: 'Windmill', pad: 0xb7a88e },
  { id: 'quarry', name: 'Quarry / Industrial', hero: 'Silo Cluster', pad: 0x9a9a94 },
  { id: 'skyline', name: 'Downtown Bay Skyline', hero: 'Torre Azzura', pad: 0x35566b },
];

// ---------- 1. Cliff villa ----------
function villa() {
  const g = new THREE.Group();
  g.add(box(4.2, 2.4, 3.2, 0xf5efe2, 0, 1.2, 0));
  g.add(box(3.0, 2.0, 2.4, 0xf5efe2, -0.4, 3.4, 0.2));
  g.add(box(2.0, 1.6, 2.0, 0xf5efe2, 0.5, 5.2, -0.2));
  g.add(roofSlab(4.2, 3.2, 0xe8dcc4, 0, 2.5, 0));
  g.add(roofSlab(3.0, 2.4, 0xe8dcc4, -0.4, 4.5, 0.2));
  g.add(roofSlab(2.0, 2.0, 0xe8dcc4, 0.5, 6.1, -0.2));
  for (const [px, pz] of [[-0.3, -0.9], [1.3, -0.9], [-0.3, 0.5], [1.3, 0.5]]) {
    g.add(box(0.22, 1.0, 0.22, 0x8a6a4a, px, 6.7, pz));
  }
  g.add(box(0.24, 0.18, 1.9, 0x8a6a4a, -0.3, 7.25, -0.2));
  g.add(box(0.24, 0.18, 1.9, 0x8a6a4a, 1.3, 7.25, -0.2));
  g.add(box(2.0, 0.18, 0.24, 0x8a6a4a, 0.5, 7.25, -0.9));
  for (let i = 0; i < 8; i++) {
    g.add(box(2.0, 0.1, 0.18, 0xa9805a, 0.5, 7.42, -0.95 + i * 0.27));
  }
  g.add(sph(0.55, 0xc93a6b, 0.0, 7.6, -0.6));
  g.add(sph(0.45, 0xd94f7e, 1.1, 7.55, 0.1));
  g.add(sph(0.4, 0xc93a6b, 0.5, 7.5, -1.0));
  g.add(sph(0.3, 0xd94f7e, -0.2, 7.15, 0.7));
  for (const wx of [-1.4, 0, 1.4]) {
    g.add(box(0.7, 1.1, 0.1, 0x2e4a5e, wx, 1.3, 1.62));
    g.add(archTop(0.35, 0x2e4a5e, wx, 1.85, 1.62));
    g.add(box(0.22, 1.1, 0.06, 0x3e7cb1, wx - 0.5, 1.3, 1.64));
    g.add(box(0.22, 1.1, 0.06, 0x3e7cb1, wx + 0.5, 1.3, 1.64));
  }
  g.add(sph(0.55, 0xc93a6b, -1.9, 2.2, 1.2));
  g.add(sph(0.4, 0xd94f7e, -2.1, 1.5, 1.4));
  g.add(sph(0.45, 0xc93a6b, 1.9, 3.6, 1.1));
  g.add(sph(0.35, 0xd94f7e, 2.0, 3.0, 1.3));
  g.add(box(2.6, 0.35, 2.2, 0xe8dcc4, 3.2, 0.18, 0.4));
  g.add(box(2.2, 0.12, 1.8, 0x39b8c4, 3.2, 0.42, 0.4, { roughness: 0.15 }));
  g.add(box(2.6, 0.5, 0.06, 0xbfe3de, 3.2, 0.7, 1.5, { transparent: true, opacity: 0.45 }));
  for (let i = 0; i < 5; i++) {
    g.add(box(0.9, 0.22, 0.5, 0xe8dcc4, -2.5, 0.3 + i * 0.45, -0.6 + i * 0.42));
  }
  return mergeStatic(g);
}

// ---------- 2. Yacht marina pavilion ----------
function marina() {
  const g = new THREE.Group();
  g.add(box(7.0, 0.3, 4.6, 0xa9805a, 0, 0.15, 0));
  for (let i = 0; i < 9; i++) {
    g.add(box(0.08, 0.32, 4.6, 0x8a6a4a, -3.2 + i * 0.8, 0.15, 0));
  }
  for (const [px, pz] of [[-2.2, -1.4], [2.2, -1.4], [-2.2, 1.4], [2.2, 1.4]]) {
    g.add(box(0.22, 2.4, 0.22, 0x16324f, px, 1.5, pz));
  }
  g.add(box(5.6, 0.25, 4.0, 0xf2f0ea, 0, 2.8, 0));
  g.add(box(5.6, 0.18, 0.5, 0x1f7a8c, 0, 2.65, 2.0));
  g.add(box(4.6, 1.9, 0.08, 0xbfe3de, 0, 1.25, 1.45, { transparent: true, opacity: 0.4 }));
  for (let i = 0; i < 6; i++) {
    const c = i % 2 === 0 ? 0x1f7a8c : 0xf2f0ea;
    const s = box(0.85, 0.08, 1.6, c, -2.1 + i * 0.85, 2.35, 2.6);
    s.rotation.x = 0.35;
    g.add(s);
  }
  g.add(cyl(0.07, 0.1, 5.2, 0x8a6a4a, -2.6, 2.9, -1.6, 8));
  g.add(box(1.6, 0.08, 0.08, 0x8a6a4a, -2.6, 4.6, -1.6));
  const rig = cyl(0.02, 0.02, 4.4, 0x3a3a3a, -1.9, 3.6, -1.6, 6);
  rig.rotation.z = 0.5;
  g.add(rig);
  g.add(box(2.6, 2.2, 2.4, 0xf5efe0, 3.4, 1.4, -0.8));
  g.add(box(2.9, 0.16, 2.7, 0x1f7a8c, 3.4, 2.58, -0.8));
  g.add(box(2.9, 0.14, 0.5, 0x1f7a8c, 3.4, 2.35, 0.5));
  g.add(box(2.0, 1.7, 0.08, 0x7fb3b8, 3.4, 1.15, 0.42));
  for (const fx of [-0.55, 0.55]) {
    g.add(box(0.08, 1.7, 0.1, 0xf2f0ea, 3.4 + fx, 1.15, 0.44));
  }
  g.add(box(2.0, 0.1, 0.1, 0xf2f0ea, 3.4, 2.02, 0.44));
  g.add(box(0.5, 0.6, 0.06, 0xffd9a0, 2.6, 1.7, 0.42, { emissive: 0xffc46b, emissiveIntensity: 0.7 }));
  g.add(box(0.5, 0.6, 0.06, 0xffd9a0, 4.2, 1.7, 0.42, { emissive: 0xffc46b, emissiveIntensity: 0.7 }));
  const hull = box(1.8, 0.5, 0.7, 0xf2f0ea, 3.4, 0.75, 1.6);
  hull.rotation.y = 0.15;
  g.add(hull);
  g.add(box(1.2, 0.25, 0.5, 0x1f7a8c, 3.4, 1.05, 1.6));
  g.add(box(0.3, 0.5, 0.3, 0x8a6a4a, 2.8, 0.25, 1.6));
  g.add(box(0.3, 0.5, 0.3, 0x8a6a4a, 4.0, 0.25, 1.6));
  g.add(box(0.3, 1.8, 0.3, 0xe4572e, -3.0, 1.2, 1.6));
  const jib = box(2.2, 0.18, 0.18, 0xe4572e, -2.0, 2.0, 1.6);
  jib.rotation.z = 0.25;
  g.add(jib);
  g.add(cyl(0.02, 0.02, 1.0, 0x3a3a3a, -1.1, 1.6, 1.6, 6));
  g.add(box(0.25, 0.25, 0.25, 0x3a3a3a, -1.1, 1.0, 1.6));
  for (const bx of [-3.0, -1.0, 1.0, 3.0]) {
    g.add(cyl(0.12, 0.14, 0.35, 0x16324f, bx, 0.48, 2.1, 8));
  }
  return mergeStatic(g);
}

// ---------- 3. Fortress old town bell tower ----------
function oldtown() {
  const g = new THREE.Group();
  g.add(box(6.0, 2.6, 1.0, 0xd9b98a, 0, 1.3, 1.4));
  g.add(box(1.4, 1.9, 0.2, 0x2b2b2b, 0, 0.95, 1.95));
  g.add(archTop(0.7, 0x2b2b2b, 0, 1.9, 1.95));
  g.add(box(6.0, 0.3, 1.2, 0xbfa06e, 0, 2.75, 1.4));
  g.add(box(2.8, 6.4, 2.8, 0xd9b98a, 0, 3.2, -0.6));
  for (let i = 0; i < 4; i++) {
    g.add(box(0.4, 0.5, 0.4, 0xd9b98a, -1.2 + i * 0.8, 6.65, 0.85));
    g.add(box(0.4, 0.5, 0.4, 0xd9b98a, -1.2 + i * 0.8, 6.65, -2.05));
  }
  for (const bx of [-0.9, 0.9]) {
    g.add(box(0.7, 1.3, 0.15, 0x2b2b2b, bx, 5.6, 0.82));
    g.add(archTop(0.35, 0x2b2b2b, bx, 6.25, 0.82));
  }
  g.add(cone(0.35, 0.5, 0xe8a33d, 0, 5.5, 0.2, 10));
  g.add(cone(2.1, 1.4, 0xb4552d, 0, 7.6, -0.6, 4));
  g.add(cyl(0.55, 0.55, 0.1, 0xf4f1ea, 0, 4.2, 0.85, 16));
  const hand = box(0.06, 0.4, 0.05, 0x2b2b2b, 0, 4.35, 0.92);
  hand.rotation.z = 0.7;
  g.add(hand);
  g.add(box(1.6, 0.1, 0.5, 0x2b2b2b, -2.2, 2.1, 2.0));
  for (let i = 0; i < 5; i++) {
    g.add(box(0.05, 0.5, 0.05, 0x2b2b2b, -2.9 + i * 0.35, 2.4, 2.2));
  }
  const line = cyl(0.02, 0.02, 3.2, 0xefe3c8, -2.6, 3.4, 2.6, 6);
  line.rotation.z = Math.PI / 2;
  g.add(line);
  g.add(box(0.4, 0.5, 0.03, 0xc93a6b, -3.2, 3.15, 2.6));
  g.add(box(0.4, 0.5, 0.03, 0xf2f0ea, -2.4, 3.15, 2.6));
  g.add(box(0.4, 0.5, 0.03, 0x3e7cb1, -1.6, 3.15, 2.6));
  return mergeStatic(g);
}

// ---------- 4. Promenade casino (Art Deco) ----------
function promenade() {
  const g = new THREE.Group();
  g.add(box(5.0, 4.0, 3.0, 0xf3e6c8, -0.4, 2.0, 0));
  g.add(cyl(1.5, 1.5, 4.0, 0xf3e6c8, 2.1, 2.0, 0, 16));
  g.add(box(4.2, 0.9, 2.4, 0xe8a33d, -0.4, 4.45, 0));
  g.add(box(3.2, 0.8, 1.8, 0xf3e6c8, -0.4, 5.3, 0));
  g.add(box(2.2, 0.7, 1.2, 0xe8a33d, -0.4, 6.05, 0));
  g.add(box(0.5, 0.8, 0.5, 0xe8a33d, -0.4, 6.8, 0));
  g.add(box(0.5, 2.6, 0.2, 0xff5c8a, 2.1, 3.0, 1.55, { emissive: 0xff5c8a, emissiveIntensity: 1.6 }));
  g.add(box(3.4, 0.45, 0.2, 0x3ed6d6, -0.4, 3.4, 1.55, { emissive: 0x3ed6d6, emissiveIntensity: 1.4 }));
  g.add(box(2.6, 0.2, 1.2, 0x2e7f8f, -0.4, 2.3, 1.9));
  g.add(cyl(0.09, 0.09, 2.2, 0xe8a33d, -1.5, 1.1, 2.3, 8));
  g.add(cyl(0.09, 0.09, 2.2, 0xe8a33d, 0.7, 1.1, 2.3, 8));
  for (let i = 0; i < 5; i++) {
    const c = i % 2 === 0 ? 0xff5c8a : 0xf3e6c8;
    const s = box(0.7, 0.08, 0.9, c, -2.2 + i * 0.75, 2.6, 1.7);
    s.rotation.x = 0.4;
    g.add(s);
  }
  // Forecourt fountain: the real particle fountain, not a beige dish.
  const f = fountain(0.9);
  f.position.set(-0.4, 0, 3.6);
  g.add(f);
  g.add(palm(-3.4, 2.6, 1.1));
  g.add(palm(3.6, 2.8, 0.9));
  g.add(lampPost(-2.8, 3.4));
  g.add(lampPost(2.6, 3.6));
  return mergeStatic(g);
}

// ---------- 5. Lighthouse ----------
function lighthouse() {
  const g = new THREE.Group();
  const bands = [0xc0392b, 0xf4f1ea, 0xc0392b, 0xf4f1ea, 0xc0392b];
  for (let i = 0; i < 5; i++) {
    g.add(cyl(0.85 - i * 0.06, 0.95 - i * 0.06, 1.5, bands[i], 0, 0.75 + i * 1.5, 0, 16));
  }
  g.add(cyl(1.15, 1.15, 0.18, 0x2b2b2b, 0, 7.6, 0, 16));
  g.add(cyl(0.7, 0.7, 1.0, 0xffe9a8, 0, 8.2, 0, 12, { emissive: 0xffd94d, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }));
  g.add(cone(0.85, 0.7, 0x2b2b2b, 0, 9.05, 0, 12));
  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 8.2, 0);
  beamPivot.name = 'beamPivot';
  const beam = cone(1.1, 5.5, 0xffe9a8, 3.4, 0, 0, 16, { transparent: true, opacity: 0.22, emissive: 0xffd94d, emissiveIntensity: 0.8 });
  beam.rotation.z = -Math.PI / 2;
  beam.name = 'beam';
  beamPivot.add(beam);
  g.add(beamPivot);
  g.add(box(2.6, 1.8, 2.2, 0x8a8d91, -2.6, 0.9, 1.2));
  g.add(pitchedRoof(2.6, 2.2, 0x4a5560, -2.6, 1.8, 1.2));
  g.add(box(0.3, 0.9, 0.3, 0x8a8d91, -1.9, 2.4, 0.8));
  g.add(box(0.6, 0.9, 0.1, 0x2b2b2b, -2.6, 0.7, 2.32));
  for (const [px, pz] of [[2.6, 1.8], [3.6, 1.8], [2.6, 2.8], [3.6, 2.8]]) {
    g.add(box(0.12, 1.0, 0.12, 0x8a6a4a, px, 0.5, pz));
  }
  g.add(box(1.6, 1.1, 1.4, 0xc9a86a, 3.1, 1.55, 2.3));
  g.add(pitchedRoof(1.6, 1.4, 0x4a5560, 3.1, 2.1, 2.3));
  g.add(box(1.2, 0.7, 0.05, 0xbfe3de, 2.2, 0.9, 3.2));
  for (let i = 0; i < 5; i++) {
    g.add(box(0.8, 0.5, 0.8, 0x8a8d91, -3.5 + i * 0.9, 0.25, -2.2));
  }
  return mergeStatic(g, ['beamPivot']);
}

// ---------- 6. Funicular hills ----------
function funicular() {
  const g = new THREE.Group();
  g.add(box(7.0, 0.8, 1.0, 0xb9a98f, 0, 0.4, 2.6));
  g.add(box(6.0, 0.8, 1.0, 0xb9a98f, 0, 1.2, 1.4));
  g.add(box(5.0, 0.8, 1.0, 0xb9a98f, 0, 2.0, 0.2));
  g.add(box(3.0, 2.8, 2.4, 0xf2c49b, -1.2, 3.8, -1.2));
  g.add(pitchedRoof(3.0, 2.4, 0xb4552d, -1.2, 5.2, -1.2));
  g.add(box(0.6, 1.0, 0.08, 0x2e4a5e, -1.9, 3.9, 0.05));
  g.add(box(0.6, 1.0, 0.08, 0x2e4a5e, -0.5, 3.9, 0.05));
  g.add(box(0.5, 1.0, 0.08, 0xa8cbb0, -1.9, 4.9, 0.05));
  g.add(box(0.5, 1.0, 0.08, 0xa8cbb0, -0.5, 4.9, 0.05));
  g.add(box(1.8, 0.12, 0.6, 0x2b2b2b, -1.2, 4.35, 0.35));
  for (let i = 0; i < 5; i++) {
    g.add(box(0.05, 0.5, 0.05, 0x2b2b2b, -1.9 + i * 0.35, 4.65, 0.62));
  }
  g.add(box(1.6, 1.6, 1.6, 0xf7f3e8, 2.2, 3.2, -1.2));
  const dome = sph(0.85, 0xf2de9b, 2.2, 4.0, -1.2);
  dome.scale.y = 0.75;
  g.add(dome);
  g.add(box(0.08, 0.5, 0.08, 0xe8a33d, 2.2, 4.75, -1.2));
  g.add(box(0.3, 0.08, 0.08, 0xe8a33d, 2.2, 4.75, -1.2));
  for (const rx of [-0.5, 0.5]) {
    const rail = box(0.12, 0.12, 7.5, 0x8a5a3b, rx, 1.6, 3.4);
    rail.rotation.x = -0.42;
    g.add(rail);
  }
  const car = new THREE.Group();
  car.add(box(1.4, 1.1, 1.8, 0xe4572e, 0, 0.55, 0));
  car.add(box(1.5, 0.25, 1.9, 0xf2f0ea, 0, 1.2, 0));
  car.add(box(1.2, 0.5, 0.08, 0x2e4a5e, 0, 0.75, 0.92));
  car.add(box(0.08, 0.5, 1.2, 0x2e4a5e, 0.72, 0.75, 0));
  car.position.set(0, 2.6, 4.6);
  car.rotation.x = -0.42;
  g.add(car);
  for (const [lx, lz, ly] of [[-2.9, 2.0, 0.8], [2.9, 2.0, 0.8], [-2.6, 0.8, 1.6]]) {
    g.add(cyl(0.22, 0.16, 0.4, 0xb4552d, lx, ly + 0.2, lz, 8));
    g.add(sph(0.4, 0x3f7a4e, lx, ly + 0.75, lz));
    g.add(sph(0.1, 0xf2de9b, lx + 0.25, ly + 0.6, lz + 0.15));
    g.add(sph(0.1, 0xf2de9b, lx - 0.2, ly + 0.7, lz - 0.15));
  }
  return mergeStatic(g);
}

// ---------- 7. Olive-grove countryside (windmill) ----------
function countryside() {
  const g = new THREE.Group();
  g.add(cyl(1.1, 1.6, 5.6, 0xb7a88e, -1.6, 2.8, -0.8, 12));
  g.add(cone(1.25, 1.0, 0xf7f3e8, -1.6, 6.1, -0.8, 12));
  const hub = new THREE.Group();
  hub.position.set(-1.6, 5.6, 0.35);
  hub.name = 'sails';
  for (let i = 0; i < 4; i++) {
    const sail = box(0.5, 2.6, 0.06, 0xf7f3e8, 0, 1.5, 0);
    const a = (i / 4) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.z = a;
    pivot.add(sail);
    hub.add(pivot);
  }
  hub.add(cyl(0.18, 0.18, 0.3, 0x8a5a3b, 0, 0, 0, 8));
  g.add(hub);
  g.add(box(3.0, 2.0, 2.4, 0xb7a88e, 1.8, 1.0, 1.0));
  g.add(pitchedRoof(3.0, 2.4, 0xb4552d, 1.8, 2.0, 1.0));
  g.add(box(0.3, 0.9, 0.3, 0xb7a88e, 2.8, 2.6, 0.6));
  g.add(box(0.7, 1.2, 0.1, 0x8a5a3b, 1.8, 0.6, 2.22));
  g.add(box(2.4, 2.0, 2.2, 0x9e3b2e, -3.2, 1.0, 1.2));
  g.add(pitchedRoof(2.4, 2.2, 0x8a5a3b, -3.2, 2.0, 1.2));
  g.add(box(1.2, 1.5, 0.1, 0x6b4a2a, -3.2, 0.75, 2.32));
  for (let i = 0; i < 6; i++) {
    g.add(box(0.7, 0.5, 0.3, 0xb7a88e, 0.4 + i * 0.75, 0.25, 2.9));
  }
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 5; i++) {
      g.add(box(0.5, 0.5, 0.5, 0x7a8b5a, -3.4 + i * 0.7, 0.45, -2.2 - r * 0.8));
    }
  }
  // Olive trees from the new tree system (round type, olive tint).
  for (const [ox, oz, s] of [[3.4, -1.6, 1.0], [0.2, -2.6, 0.85], [-0.6, 1.6, 1.1]]) {
    const t = makeTree('round', s);
    t.position.set(ox, 0, oz);
    g.add(t);
  }
  g.add(cyl(0.45, 0.45, 0.9, 0xd9b96a, 2.6, 0.45, 2.6, 10));
  g.add(cyl(0.45, 0.45, 0.9, 0xd9b96a, 3.5, 0.45, 2.2, 10));
  return mergeStatic(g, ['sails']);
}

// ---------- 8. Quarry / industrial ----------
function quarry() {
  const g = new THREE.Group();
  g.add(cyl(1.0, 1.0, 5.0, 0x9a9a94, -2.4, 2.5, -0.8, 14));
  g.add(cone(1.05, 0.9, 0x8a8a84, -2.4, 5.45, -0.8, 14));
  g.add(cyl(0.9, 0.9, 6.4, 0x9a9a94, -0.4, 3.2, -0.8, 14));
  g.add(cone(0.95, 0.9, 0x8a8a84, -0.4, 6.85, -0.8, 14));
  g.add(cyl(0.8, 0.8, 4.2, 0x9a9a94, 1.5, 2.1, -0.8, 14));
  g.add(cone(0.85, 0.8, 0x8a8a84, 1.5, 4.6, -0.8, 14));
  for (let i = 0; i < 8; i++) {
    g.add(box(0.4, 0.06, 0.06, 0x3a3a3a, -0.4, 0.6 + i * 0.7, 0.15));
  }
  g.add(box(0.5, 5.5, 0.5, 0xe8c33d, 2.8, 2.75, -1.2));
  g.add(box(4.2, 0.35, 0.35, 0xe8c33d, 2.8, 5.6, -1.2));
  g.add(box(1.2, 0.4, 0.4, 0x3a3a3a, 1.0, 5.6, -1.2));
  g.add(cyl(0.02, 0.02, 1.6, 0x3a3a3a, 4.4, 4.8, -1.2, 6));
  g.add(box(0.4, 0.4, 0.4, 0x8a4b2e, 4.4, 3.9, -1.2));
  const belt = box(0.9, 0.25, 5.5, 0x3a3a3a, -1.2, 1.8, 2.4);
  belt.rotation.x = 0.35;
  g.add(belt);
  for (const tz of [0.8, 2.4, 4.0]) {
    g.add(box(0.15, 1.2, 0.15, 0x8a4b2e, -1.6, 0.6, tz));
    g.add(box(0.15, 1.2, 0.15, 0x8a4b2e, -0.8, 0.6, tz));
  }
  g.add(box(2.2, 1.0, 1.0, 0x8a4b2e, 2.6, 0.5, 1.6));
  g.add(box(2.2, 1.0, 1.0, 0xd9a441, 2.6, 1.5, 1.6));
  g.add(box(2.2, 1.0, 1.0, 0x2e7f8f, 2.6, 0.5, 2.8));
  g.add(box(2.2, 1.0, 1.0, 0x8a4b2e, 0.4, 0.5, 2.8));
  g.add(box(2.6, 1.9, 2.0, 0x8a4b2e, -3.0, 0.95, 2.2));
  const shedRoof = box(2.9, 0.14, 2.3, 0x6b3a24, -3.0, 2.0, 2.2);
  shedRoof.rotation.z = 0.12;
  g.add(shedRoof);
  g.add(box(1.2, 1.4, 0.1, 0x3a3a3a, -3.0, 0.7, 3.22));
  g.add(cone(1.1, 0.9, 0x9a9a94, 0.6, 0.45, -2.4, 10));
  g.add(cone(0.8, 0.7, 0x8a8a84, 1.8, 0.35, -2.2, 10));
  return mergeStatic(g);
}

// ---------- 9. Downtown Bay Skyline ----------
// 1 floor ≈ 0.3 units. Towers run 20–60 floors → 6–18 units tall, roughly
// 2–3x the low-rise heroes, so the skyline reads instantly as a skyline.
// Performance: shared materials everywhere, one canvas window texture in
// 3 cached variants, ONE InstancedMesh for all lit windows in the full
// cluster, merged static geometry per material, and an LOD cluster (plain
// boxes + the same blue/glass texture, no props) for far views and backdrops.
// Frustum culling is Three.js default per mesh.
const FLOOR_H = 0.3;

function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { seededRandom };

// One deterministic rule decides which windows are lit — shared by the
// canvas facade texture AND the instanced lit windows, so the two agree and
// the pattern reads as a tidy grid, never random speckle:
//   - a diagonal band pattern ((r*7 + c*3) % 11 < 4),
//   - every 6th floor fully lit (a lived-in office floor),
//   - the top floor row always lit.
export function isWindowLit(col, row, cols, rows, variant) {
  if (row === rows - 1) return true;
  if (row % 6 === 2) return true;
  return ((row * 7 + col * 3 + variant * 5) % 11) < 4;
}

// Canvas facade texture: tidy mullion grid + lit/unlit cells in the clean
// pattern above. 3 cached variants (different lit density).
const facadeMats = [];
const facadeTexs = [];
function facadeTexture(variant = 0) {
  if (facadeTexs[variant]) return facadeTexs[variant];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const cols = 8, rows = 20, cw = 128 / cols, ch = 256 / rows;
  ctx.fillStyle = '#2c4658'; ctx.fillRect(0, 0, 128, 256);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = isWindowLit(col, r, cols, rows, variant);
      ctx.fillStyle = lit ? (col % 3 === 0 ? '#ffe9c8' : '#ffd9a0') : '#22384a';
      ctx.fillRect(col * cw + 2, r * ch + 2, cw - 4, ch - 5);
    }
  }
  // Mullion lines: crisp dark grid over the cells.
  ctx.fillStyle = '#16242f';
  for (let col = 0; col <= cols; col++) ctx.fillRect(col * cw - 1, 0, 2, 256);
  for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * ch - 1, 128, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  facadeTexs[variant] = tex;
  return tex;
}
function facadeMat(variant = 0) {
  if (facadeMats[variant]) return facadeMats[variant];
  const tex = facadeTexture(variant);
  const m = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55,
    roughness: 0.3, metalness: 0.4, flatShading: true,
  });
  facadeMats[variant] = m;
  return m;
}
// LOD facade (fix 3): the SAME blue/glass texture and emissive pattern as
// the hero tower, only stronger emissive so the lit windows punch through
// the golden-hour haze instead of fading grey. Less detail, same color.
const facadeLODMats = [];
function facadeMatLOD(variant = 0) {
  if (facadeLODMats[variant]) return facadeLODMats[variant];
  const tex = facadeTexture(variant);
  const m = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.95,
    roughness: 0.3, metalness: 0.4, flatShading: true,
  });
  facadeLODMats[variant] = m;
  return m;
}

// Shared tower materials (one instance each, reused by every tower).
const glassPlain = M(0x35566b, { roughness: 0.22, metalness: 0.55 });
const concreteLight = M(0xd8d2c4);
const goldTrim = M(0xe8a33d, { emissive: 0xe8a33d, emissiveIntensity: 0.25 });
const roofGrey = M(0x6a6a64);
const poolBlue = M(0x39b8c4, { roughness: 0.15 });
const ledMagenta = M(0xff5c8a, { emissive: 0xff5c8a, emissiveIntensity: 1.6 });
const ledCyan = M(0x3ed6d6, { emissive: 0x3ed6d6, emissiveIntensity: 1.6 });
// Aircraft warning lights — shared material, blinked by the render loop.
export const warnLightMat = new THREE.MeshStandardMaterial({
  color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 1.6, roughness: 0.4,
});

function meshMat(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function brandTexture(text, bg = '#1e2a32', fg = '#ffd9a0') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg; ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const SKYLINE_TOWERS = [
  { name: 'Torre Marina', floors: 20, type: 'podium', w: 6.0, d: 5.2, x: -45.2 },
  { name: 'Torre Faro Blu', floors: 26, type: 'led', w: 4.4, d: 4.4, x: -37.0 },
  { name: 'Hotel Lume', floors: 34, type: 'pool', w: 5.4, d: 4.8, x: -28.8 },
  { name: 'Torre Eliporto', floors: 36, type: 'helipad', w: 4.8, d: 4.8, x: -20.6 },
  { name: 'Torre Gemella Nord', floors: 44, type: 'twin', w: 4.6, d: 4.6, x: -12.4 },
  { name: 'Torre Gemella Sud', floors: 44, type: 'twin', w: 4.6, d: 4.6, x: -4.2 },
  { name: 'Torre Azzura', floors: 60, type: 'spire', w: 5.2, d: 5.2, x: 4.2 },
  { name: 'Torre Ago', floors: 52, type: 'needle', w: 4.0, d: 4.0, x: 12.4 },
  { name: 'Torre Vela', floors: 38, type: 'curve', w: 5.0, d: 4.4, x: 20.6 },
  { name: 'Torre Corona', floors: 40, type: 'crown', w: 4.8, d: 4.8, x: 28.8 },
  { name: 'Torre Onda', floors: 30, type: 'ziggurat', w: 5.6, d: 5.0, x: 37.0 },
  { name: 'Torre Mercurio', floors: 24, type: 'billboard', w: 4.6, d: 4.2, x: 45.2 },
];

function buildTower(t, detail) {
  const g = new THREE.Group();
  const h = t.floors * FLOOR_H;
  const variant = t.floors % 3;
  if (detail === 'lod') {
    g.add(meshMat(new THREE.BoxGeometry(t.w, h, t.d), facadeMatLOD(variant), 0, h / 2, 0));
    g.add(box(t.w + 0.4, 0.3, t.d + 0.4, 0x2b2b2b, 0, h + 0.15, 0));
    return g;
  }
  const facade = facadeMat(variant);
  const h1 = h * 0.7;
  const h2 = h * 0.2;
  g.add(meshMat(new THREE.BoxGeometry(t.w, h1, t.d), facade, 0, h1 / 2, 0));
  g.add(meshMat(new THREE.BoxGeometry(t.w * 0.78, h2, t.d * 0.78), facadeMat((variant + 1) % 3), 0, h1 + h2 / 2, 0));
  const topY = h1 + h2;
  g.add(meshMat(new THREE.BoxGeometry(0.7, 0.5, 0.7), roofGrey, t.w * 0.2, topY + 0.25, -t.d * 0.15));
  g.add(meshMat(new THREE.BoxGeometry(0.5, 0.4, 0.9), roofGrey, -t.w * 0.22, topY + 0.2, t.d * 0.18));
  switch (t.type) {
    case 'spire': {
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.6, 0.7, t.d * 0.6), goldTrim, 0, topY + 0.35, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.42, 0.7, t.d * 0.42), concreteLight, 0, topY + 1.05, 0));
      g.add(meshMat(new THREE.ConeGeometry(0.5, 2.4, 8), goldTrim, 0, topY + 2.6, 0));
      g.add(meshMat(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), roofGrey, 0, topY + 4.6, 0));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), warnLightMat);
      tip.position.set(0, topY + 5.6, 0);
      g.add(tip);
      break;
    }
    case 'needle': {
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.6, 0.9, t.d * 0.6), facade, 0, topY + 0.45, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.38, 0.9, t.d * 0.38), facade, 0, topY + 1.35, 0));
      g.add(meshMat(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), roofGrey, 0, topY + 3.0, 0));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), warnLightMat);
      tip.position.set(0, topY + 4.3, 0);
      g.add(tip);
      break;
    }
    case 'curve': {
      g.add(meshMat(new THREE.CylinderGeometry(t.w / 2, t.w / 2, h1, 14, 1, false, 0, Math.PI / 2), facade, t.w / 2, h1 / 2, t.d / 2));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.8, 0.5, t.d * 0.8), glassPlain, 0, topY + 0.25, 0));
      break;
    }
    case 'pool': {
      g.add(meshMat(new THREE.BoxGeometry(2.4, 0.22, 1.8), poolBlue, 0, topY + 0.11, 0));
      g.add(box(2.6, 0.14, 0.14, 0xf2f0ea, 0, topY + 0.25, 0.95));
      g.add(box(2.6, 0.14, 0.14, 0xf2f0ea, 0, topY + 0.25, -0.95));
      g.add(box(1.4, 1.0, 1.2, 0xf2f0ea, t.w * 0.28, topY + 0.5, -t.d * 0.25));
      for (const ux of [-1.2, 1.2]) {
        g.add(cyl(0.04, 0.04, 0.9, 0x8a6a4a, ux, topY + 0.75, t.d * 0.28, 6));
        g.add(cone(0.55, 0.3, 0xff5c8a, ux, topY + 1.25, t.d * 0.28, 8));
      }
      break;
    }
    case 'crown': {
      g.add(meshMat(new THREE.BoxGeometry(t.w * 1.28, 0.5, t.d * 1.28), glassPlain, 0, topY + 0.25, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 1.28, 0.16, t.d * 1.28), goldTrim, 0, topY + 0.58, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.5, 0.9, t.d * 0.5), facade, 0, topY + 1.1, 0));
      break;
    }
    case 'helipad': {
      g.add(meshMat(new THREE.CylinderGeometry(1.7, 1.7, 0.14, 20), roofGrey, 0, topY + 0.07, 0));
      g.add(box(0.22, 0.06, 1.3, 0xf2f0ea, -0.45, topY + 0.17, 0));
      g.add(box(0.22, 0.06, 1.3, 0xf2f0ea, 0.45, topY + 0.17, 0));
      g.add(box(1.1, 0.06, 0.22, 0xf2f0ea, 0, topY + 0.17, 0));
      break;
    }
    case 'ziggurat': {
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.6, 0.8, t.d * 0.6), facade, 0, topY + 0.4, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.4, 0.8, t.d * 0.4), goldTrim, 0, topY + 1.2, 0));
      break;
    }
    case 'led': {
      g.add(meshMat(new THREE.BoxGeometry(0.28, h1 * 0.85, 0.12), ledMagenta, 0, h1 * 0.45, t.d / 2 + 0.06));
      g.add(meshMat(new THREE.BoxGeometry(0.12, h1 * 0.85, 0.28), ledCyan, t.w / 2 + 0.06, h1 * 0.45, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.85, 0.5, t.d * 0.85), glassPlain, 0, topY + 0.25, 0));
      break;
    }
    case 'billboard': {
      const solmar = brandTexture('SOLMAR');
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.1, 0.15),
        new THREE.MeshStandardMaterial({
          map: solmar, emissiveMap: solmar, emissive: 0xffffff,
          emissiveIntensity: 0.9, roughness: 0.4,
        }),
      );
      panel.position.set(0, topY + 1.1, 0);
      panel.castShadow = true;
      g.add(panel);
      g.add(box(0.18, 0.9, 0.18, 0x3a3a3a, -1.4, topY + 0.45, 0));
      g.add(box(0.18, 0.9, 0.18, 0x3a3a3a, 1.4, topY + 0.45, 0));
      break;
    }
    case 'podium': {
      g.add(meshMat(new THREE.BoxGeometry(t.w * 1.45, 1.8, t.d * 1.3), concreteLight, 0, 0.9, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.5, 0.5, t.d * 0.4), M(0x3f7a4e), -t.w * 0.4, 2.05, t.d * 0.2));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.4, 0.4, t.d * 0.35), M(0x7a8b5a), t.w * 0.42, 2.0, -t.d * 0.25));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.85, 0.5, t.d * 0.85), glassPlain, 0, topY + 0.25, 0));
      break;
    }
    default: { // 'twin'
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.9, 0.4, t.d * 0.9), concreteLight, 0, topY + 0.2, 0));
      g.add(meshMat(new THREE.BoxGeometry(t.w * 0.9, 0.14, t.d * 0.9), goldTrim, 0, topY + 0.47, 0));
      break;
    }
  }
  if (t.floors >= 40 && t.type !== 'spire' && t.type !== 'needle') {
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), warnLightMat);
      w.position.set(sx * t.w * 0.36, topY + 0.12, t.d * 0.36);
      g.add(w);
    }
  }
  return g;
}

// One InstancedMesh of warm lit-window planes across the whole cluster's
// front faces — a single draw call. The lit pattern is the same tidy rule
// as the facade texture (fix 5), so the two layers agree.
function litWindowInstances(towers) {
  const geo = new THREE.PlaneGeometry(0.45, 0.55);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xffc46b, emissiveIntensity: 1.4, roughness: 0.4,
  });
  const mats = [];
  const m4 = new THREE.Matrix4();
  for (const t of towers) {
    const h = t.floors * FLOOR_H;
    const cols = Math.max(3, Math.floor(t.w / 0.85));
    const rows = Math.max(4, Math.floor(h / 0.9));
    const variant = t.floors % 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isWindowLit(c, r, cols, rows, variant)) continue;
        const x = t.x + (c - (cols - 1) / 2) * (t.w / cols);
        const y = 0.8 + (r * (h - 1.4)) / Math.max(1, rows - 1);
        m4.makeTranslation(x, y, t.d / 2 + 0.03);
        mats.push(m4.clone());
      }
    }
  }
  const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
  mats.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

export function buildSkylineCluster(detail = 'full') {
  const g = new THREE.Group();
  g.name = detail === 'full' ? 'skylineFull' : 'skylineLOD';
  for (const t of SKYLINE_TOWERS) {
    const tower = buildTower(t, detail);
    tower.position.set(t.x, 0, 0);
    g.add(tower);
  }
  if (detail === 'full') {
    const bridgeY = 30 * FLOOR_H;
    g.add(box(8.4, 0.9, 1.6, 0x35566b, -8.3, bridgeY, 0));
    g.add(box(8.4, 0.18, 1.7, 0xe8a33d, -8.3, bridgeY + 0.55, 0));
    g.add(litWindowInstances(SKYLINE_TOWERS));
  }
  return mergeStatic(g);
}

// Landmark tower for the District 9 hero slot in the lineup.
export function buildSkylineHero() {
  const t = SKYLINE_TOWERS.find((x) => x.type === 'spire');
  return mergeStatic(buildTower(t, 'full'));
}

export const HERO_BUILDERS = {
  villas: villa, marina, oldtown, promenade, lighthouse, funicular, countryside, quarry,
  skyline: buildSkylineHero,
};

export function buildHeroBuilding(id) {
  const fn = HERO_BUILDERS[id];
  if (!fn) throw new Error('unknown district: ' + id);
  return fn();
}

// Golden-hour sky: a vertical gradient texture used as the scene background.
export function goldenSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#7fb2d9');
  grad.addColorStop(0.35, '#f7c98a');
  grad.addColorStop(0.62, '#f2a35e');
  grad.addColorStop(0.8, '#e8836b');
  grad.addColorStop(1.0, '#f7d9a8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function goldenHourLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x8a6a4a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-18, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff9a7a, 0.7);
  rim.position.set(15, 8, -12);
  scene.add(rim);
  return { hemi, sun, rim };
}
