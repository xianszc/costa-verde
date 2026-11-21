// AZZURA HEIST — water + boats (M1).
// A reworked shader bay: thin white foam that laps at the shore in fine
// bands (never big tan blobs), sparse sun glitter, a depth gradient, and a
// soft sky reflection. The old water's foam band was 6 units wide with a
// ~7-unit wavelength — from the skyline camera it read as sandbars.
// The sailboat here has a thin fading V-wake trailing behind the stern,
// never a white slab under the hull.
import * as THREE from '../vendor/three.module.min.js';
import { M, mergedMesh, colored, xform, vertexColorMat } from './world.js';

// ---------- bay water ----------
// shoreZ: the z of the shoreline in world space (water extends +z from it).
// width/depth: plane size. opts: { deep, shallow, sky, sunDir, fog }.
export function makeWater(width, depth, shoreZ, segX = 96, segZ = 48, opts = {}) {
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(opts.deep ?? 0x256b7d) },
      uShallow: { value: new THREE.Color(opts.shallow ?? 0x45bcd0) },
      uSky: { value: new THREE.Color(opts.sky ?? 0xeed9ae) },
      uSunDir: { value: (opts.sunDir ?? new THREE.Vector3(-0.55, 0.45, 0.3)).normalize() },
      uSunColor: { value: new THREE.Color(0xffe9a8) },
      uShoreZ: { value: shoreZ },
      uFogColor: { value: new THREE.Color(0xf7d9a8) },
      uFogNear: { value: 80 },
      uFogFar: { value: 220 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        // Small, high-frequency ripples: texture, not swells.
        float w = sin(p.x * 0.55 + uTime * 1.4) * 0.06
                + sin(p.y * 0.8 - uTime * 1.1) * 0.05
                + sin((p.x + p.y) * 0.4 + uTime * 0.7) * 0.04;
        p.z += w;
        float dx = 0.55 * 0.06 * cos(p.x * 0.55 + uTime * 1.4)
                 + 0.4 * 0.04 * cos((p.x + p.y) * 0.4 + uTime * 0.7);
        float dy = 0.8 * 0.05 * cos(p.y * 0.8 - uTime * 1.1)
                 + 0.4 * 0.04 * cos((p.x + p.y) * 0.4 + uTime * 0.7);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        // Damp the ripple normals (0.3x) so the fresnel reflection stays
        // smooth instead of breaking into blotchy tan patches at low
        // angles (the skyline view's grazing camera showed them as
        // sandbars).
        vNormal = normalize(mat3(modelMatrix) * vec3(-dx * 0.3, -dy * 0.3, 1.0));
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
        // Depth gradient: shallow turquoise at the shore, deep blue-green out.
        float depthT = clamp((vWorldPos.z - uShoreZ) / 45.0, 0.0, 1.0);
        vec3 base = mix(uShallow, uDeep, depthT);
        // Sky reflection grows with the grazing angle; kept modest
        // (0.22) so a low camera does not paint the water in big tan
        // blotches that read as sandbars — the bay stays turquoise.
        vec3 col = mix(base, uSky, fres * 0.22);
        // Sun glitter: tight specular, small amplitude, broken up by a
        // hash so it sparkles in dots instead of painting white bands.
        vec3 R = reflect(-normalize(uSunDir), N);
        float glit = fract(sin(dot(floor(vWorldPos.xz * 4.0), vec2(12.9898, 78.233))) * 43758.5453);
        float spec = pow(max(dot(R, V), 0.0), 180.0) * (0.25 + 0.35 * glit);
        col += uSunColor * spec;
        // Shoreline foam: a THIN band (1.4 units) of fine white lace.
        // Two high-frequency sines break it into small patches; the
        // threshold keeps it white and lace-like, never a solid tan mass.
        float shore = smoothstep(1.4, 0.0, abs(vWorldPos.z - uShoreZ));
        float lace = 0.5 + 0.5 * sin(vWorldPos.x * 2.3 + uTime * 1.9
                                     + vWorldPos.z * 2.7)
                         * sin(vWorldPos.x * 1.1 - uTime * 1.2 + vWorldPos.z * 0.9);
        float foam = shore * smoothstep(0.62, 0.9, lace);
        col = mix(col, vec3(0.94, 0.98, 0.96), foam * 0.8);
        // A second, fainter foam line a little further out (receding wave).
        float shore2 = smoothstep(2.6, 1.6, abs(vWorldPos.z - uShoreZ - 2.2));
        float lace2 = 0.5 + 0.5 * sin(vWorldPos.x * 3.1 - uTime * 1.4);
        col = mix(col, vec3(0.94, 0.98, 0.96), shore2 * smoothstep(0.7, 0.95, lace2) * 0.35);
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

// ---------- sailboat ----------
// Shaped hull + deck + cabin + mast merged into one vertex-colored mesh,
// a thin sail, and a V-wake made of TWO narrow fading strips that trail
// behind the stern — thin enough to read as a wake from any angle.
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
  geo.rotateX(-Math.PI / 2);
  return geo;
}
export function makeSailboat(scale = 1, sailColor = 0xf2f0ea, phase = 0) {
  const g = new THREE.Group();
  const parts = [
    // Dark teal hull: a white hull reads as a flat platform from a low
    // camera; a dark hull reads as a boat silhouette on the water.
    xform(colored(hullGeometry(), 0x2e6b7a), 0, 0.28, 0),
    colored(xform(new THREE.BoxGeometry(1.1, 0.1, 2.2), 0, 0.95, -0.1), 0x1f7a8c),
    colored(xform(new THREE.BoxGeometry(1.0, 0.55, 1.3), 0, 1.25, -0.35), 0xe8dcc4),
    colored(xform(new THREE.BoxGeometry(0.95, 0.4, 0.08), 0, 1.5, 0.32, 0, 1, -0.35), 0x2e4a5e),
    colored(xform(new THREE.CylinderGeometry(0.05, 0.07, 4.6, 6), 0, 3.4, 0.1), 0x8a6a4a),
  ];
  g.add(mergedMesh(parts, vertexColorMat));
  const sail = new THREE.Mesh(
    colored(xform(new THREE.ConeGeometry(1.05, 2.8, 4), 0.55, 3.6, 0.1, Math.PI / 4, 1, 0, 0), sailColor),
    vertexColorMat,
  );
  sail.scale.z = 0.14;
  sail.material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.7, flatShading: true, side: THREE.DoubleSide,
  });
  g.add(sail);
  // Wake: two narrow strips fanning out behind the stern, fading with
  // distance (two overlapping transparent triangles, not one wide slab).
  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xeaf6f2, transparent: true, opacity: 0.14,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const wakeMat2 = new THREE.MeshBasicMaterial({
    color: 0xeaf6f2, transparent: true, opacity: 0.08,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const strip = (len, w0, w1) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w0, 0);
    sh.lineTo(w0, 0);
    sh.lineTo(w1, -len);
    sh.lineTo(-w1, -len);
    sh.closePath();
    return new THREE.ShapeGeometry(sh);
  };
  const wake1 = new THREE.Mesh(strip(3.2, 0.18, 0.55), wakeMat);
  wake1.rotation.x = -Math.PI / 2;
  wake1.position.set(0, 0.06, 1.9);
  g.add(wake1);
  const wake2 = new THREE.Mesh(strip(4.6, 0.1, 0.85), wakeMat2);
  wake2.rotation.x = -Math.PI / 2;
  wake2.position.set(0, 0.05, 1.9);
  g.add(wake2);
  g.userData.tick = (t) => {
    if (g.userData.baseY === undefined) g.userData.baseY = g.position.y;
    g.position.y = g.userData.baseY + Math.sin(t * 0.9 + phase) * 0.07;
    g.rotation.z = Math.sin(t * 0.7 + phase) * 0.02;
    wakeMat.opacity = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.8 + phase));
  };
  g.scale.setScalar(scale);
  return g;
}

// ---------- sky gradient textures ----------
// Four canvas gradients (golden hour, dusk, night, dawn) used as the scene
// background; the day/night cycle crossfades between them by regenerating
// the active texture only when the phase changes.
const SKY_STOPS = {
  golden: [[0.0, '#7fb2d9'], [0.35, '#f7c98a'], [0.62, '#f2a35e'], [0.8, '#e8836b'], [1.0, '#f7d9a8']],
  dusk: [[0.0, '#4a5a8a'], [0.35, '#c96a8a'], [0.6, '#e8836b'], [0.8, '#8a4a6a'], [1.0, '#3a2a4a']],
  night: [[0.0, '#0a1226'], [0.4, '#16233d'], [0.7, '#1e2a4a'], [1.0, '#2a2a3a']],
  dawn: [[0.0, '#6a8ab5'], [0.35, '#f2b98a'], [0.62, '#f7c98a'], [0.8, '#e89a7a'], [1.0, '#f7e0b8']],
};
const skyCache = {};
export function skyTexture(phase) {
  if (skyCache[phase]) return skyCache[phase];
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  for (const [stop, color] of SKY_STOPS[phase]) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  skyCache[phase] = tex;
  return tex;
}
// Which sky phase a game hour belongs to (24 h clock). Golden hour runs
// to 19:00 so the 18:42 default is still golden, never dusk or night.
export function skyPhaseForHour(h) {
  if (h >= 5 && h < 7.5) return 'dawn';
  if (h >= 7.5 && h < 19) return 'golden';
  if (h >= 19 && h < 21) return 'dusk';
  return 'night';
}
