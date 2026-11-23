// AZZURA HEIST — cinematic main-menu orbit camera (23 Nov 2026).
// Real-time camera, no video, no external assets: a closed Catmull-Rom
// spline circles Porto Azzura above the city while the game simulates
// underneath (traffic + pedestrians keep moving). One loop = 75 s,
// eased so the camera lingers at the four dips (bay / Azzura Tower,
// marina, promenade, north skyline) and glides faster between them.
//
// VERTICAL SCALE (measured from the builders, not assumed):
//   CBD towers are 20-60 floors x 2.0 u/floor = 40-120 u tall
//   (Azzura Tower 60 floors = 120 u + spire to ~127 u);
//   commercial ring / ring-ext 6-15 floors = 12-30 u;
//   residential 2-6 floors = 4-12 u (+roof to ~14.6 u);
//   old town 2-4 floors = 4-8 u; promenade-ext 3-5 floors = 6-10 u;
//   outer 1-2 floors = 2-4 u; hills terraces to ~14 u (z <= -106).
// The orbit therefore NEVER crosses the CBD / ring / ring-ext at
// 12-25 u — it circles the tall blob on the bay, the outer aprons and
// the residential-north strip, all verified by the clearance probe
// (reports/menu-orbit-2026-11-23.md). The tower dips are approaches:
// from the bay the 120 u Azzura Tower fills the frame, and from the
// north leg the whole skyline reads in layers.
import * as THREE from '../vendor/three.module.min.js';

export const MENU_LOOP_SECONDS = 75;
// Dips: control-point indices where the camera lingers (slow zones).
export const MENU_DIP_INDICES = [0, 2, 6, 10];
// Menu-mode visibility: peds are sub-pixel from 12-25 u up, so they
// are hidden (they keep walking — the sim runs); cars stay visible
// within 80 u of the camera so the roads read as alive.
export const MENU_CAR_RADIUS = 80;
export const MENU_CAR_RADIUS2 = MENU_CAR_RADIUS * MENU_CAR_RADIUS;

// Camera control points [x, y, z] — a closed loop around the tall blob.
// Heights 13-20 u (spec 12-25 u); the low points are all over water or
// over 2-4 u outer ground, never over a roof.
export const ORBIT_CAM_POINTS = [
  [0, 14, 92],     // 0 bay south — lowest dip, tower fills the frame
  [55, 17, 78],    // 1 bay south-east
  [95, 19, 42],    // 2 bay east edge — marina + promenade in view
  [105, 20, 5],    // 3 east leg, over residential east (max ~14.6 u)
  [100, 19, -55],  // 4 east-north
  [82, 19, -82],   // 5 north-east corner, gap east of ring-ext north
  [0, 18, -97],    // 6 north leg, residential-north strip (max ~14.6 u)
  [-70, 18, -97],  // 7 north leg west
  [-82, 19, -82],  // 8 north-west corner, gap west of ring-ext north
  [-108, 20, -30], // 9 west leg, over residential west
  [-105, 19, 30],  // 10 west leg south — promenade west in view
  [-60, 17, 70],   // 11 bay south-west
];
// Look control points — always a point inside the built city, so the
// camera never frames empty sky or the world edge.
export const ORBIT_LOOK_POINTS = [
  [0, 35, -16],   // tower mid-height
  [10, 20, -5],
  [20, 12, 5],    // marina / promenade
  [0, 15, -10],   // city centre
  [0, 20, -20],
  [0, 25, -20],   // skyline
  [0, 25, -15],
  [0, 25, -20],
  [-20, 15, -20], // old town + CBD
  [0, 15, -10],
  [0, 12, 10],    // promenade + quay
  [10, 25, -10],
];

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// Gentle accel/decel: a periodic time-warp that slows the camera near
// the dip control points and speeds it up between them. speed(u) is
// 1 minus Gaussian bumps centred on the dips' arc-length positions;
// time(u) integrates 1/speed and is inverted into a 721-entry LUT, so
// warpU(timeFrac) is monotonic, smooth and exactly periodic (the loop
// repeats with no visible seam). Speed never drops below 0.35x, so the
// camera never stalls.
function buildWarp(camCurve, slowIndices, slowAmount = 0.45, sigma = 0.055) {
  const spaced = camCurve.getSpacedPoints(720);
  const n = spaced.length - 1; // closed curve: last point == first
  const uSlow = slowIndices.map((idx) => {
    const p = camCurve.points[idx];
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = spaced[i].distanceToSquared(p);
      if (d < bd) { bd = d; best = i; }
    }
    return best / n;
  });
  const speedAt = (u) => {
    let s = 1;
    for (const uj of uSlow) {
      let d = Math.abs(u - uj);
      d = Math.min(d, 1 - d); // periodic distance
      s -= slowAmount * Math.exp(-(d * d) / (2 * sigma * sigma));
    }
    return Math.max(0.35, s);
  };
  const M = 7200;
  const timeAt = new Float64Array(M + 1);
  let t = 0;
  for (let i = 1; i <= M; i++) {
    const u0 = (i - 1) / M, u1 = i / M;
    t += (u1 - u0) / speedAt((u0 + u1) / 2);
    timeAt[i] = t;
  }
  const total = t;
  const lut = new Float64Array(721);
  let j = 0;
  for (let i = 0; i <= 720; i++) {
    const f = (i / 720) * total;
    while (j < M && timeAt[j + 1] < f) j++;
    const t0 = timeAt[j], t1 = timeAt[j + 1];
    lut[i] = (j + (t1 > t0 ? (f - t0) / (t1 - t0) : 0)) / M;
  }
  return { lut, uSlow };
}

function warpU(warp, timeFrac) {
  const f = ((timeFrac % 1) + 1) % 1;
  const x = f * 720;
  const i = Math.min(719, Math.floor(x));
  const frac = x - i;
  return warp.lut[i] + (warp.lut[i + 1] - warp.lut[i]) * frac;
}

export function createMenuOrbit() {
  const camCurve = new THREE.CatmullRomCurve3(
    ORBIT_CAM_POINTS.map(V3), true, 'centripetal',
  );
  const lookCurve = new THREE.CatmullRomCurve3(
    ORBIT_LOOK_POINTS.map(V3), true, 'centripetal',
  );
  const warp = buildWarp(camCurve, MENU_DIP_INDICES);
  const length = camCurve.getLength();
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  return {
    camCurve,
    lookCurve,
    warp,
    length,
    loopSeconds: MENU_LOOP_SECONDS,
    dipArcPositions: warp.uSlow,
    // Camera + look target at `elapsed` seconds into the loop.
    sample(elapsed) {
      const u = warpU(warp, elapsed / MENU_LOOP_SECONDS);
      camCurve.getPointAt(u, tmpPos);
      lookCurve.getPointAt(u, tmpLook);
      return { pos: tmpPos, look: tmpLook };
    },
    // Arc-length-spaced camera points (plain objects) for the probe.
    samplePath(n) {
      const pts = camCurve.getSpacedPoints(n);
      return pts.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    },
  };
}
