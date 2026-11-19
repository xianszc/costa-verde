// COSTA VERDE Slice 4 — fx: pooled particles + skid marks. Everything is
// recycled from fixed pools — nothing is allocated per frame, so the
// effects cannot leak memory or stutter the game. One THREE.Points draws
// every particle; skid marks are a small pool of fading quads.
// Emitters: tire smoke/dust, muzzle flash, hit sparks, cruiser smoke/fire.

import * as THREE from 'three';

const MAX = 600; // particle pool
const MAX_SKIDS = 48; // skid-mark pool

export function makeFx(scene) {
  // --- particle cloud (one Points draw call) -------------------------------
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const size = new Float32Array(MAX);
  const alpha = new Float32Array(MAX);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('palpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute vec3 pcolor; attribute float psize; attribute float palpha;
      varying float vA; varying vec3 vC;
      void main(){
        vC = pcolor; vA = palpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * (260.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA; varying vec3 vC;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float a = vA * smoothstep(0.5, 0.12, d);
        gl_FragColor = vec4(vC, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const parts = [];
  for (let i = 0; i < MAX; i++) {
    parts.push({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 1, size: 1, r: 1, g: 1, b: 1, a: 1,
      grow: 0, gravity: 0, drag: 0, fadeIn: 0,
    });
  }
  let cursor = 0;
  let active = 0;
  let totalSpawned = 0; // lifetime spawns — the playtest proves emitters fire

  function spawn(x, y, z, vx, vy, vz, life, size, r, g, b, a, grow, gravity, drag) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX;
    if (!p.alive) active++;
    totalSpawned++;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.maxLife = life;
    p.size = size; p.r = r; p.g = g; p.b = b; p.a = a;
    p.grow = grow; p.gravity = gravity; p.drag = drag;
    p.fadeIn = 0.06; // brief ramp so puffs don't pop in
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  // Gray-white tire smoke: slow, grows, drifts up.
  function tireSmoke(x, y, z, vx, vz, n = 2) {
    for (let i = 0; i < n; i++) {
      spawn(
        x + rnd(-0.3, 0.3), y + rnd(0, 0.3), z + rnd(-0.3, 0.3),
        vx * 0.2 + rnd(-0.6, 0.6), rnd(0.8, 1.6), vz * 0.2 + rnd(-0.6, 0.6),
        rnd(0.5, 0.9), rnd(1.6, 2.6), 0.75, 0.72, 0.68, 0.5,
        2.2, 0.4, 1.5,
      );
    }
  }
  // Dark cruiser smoke + the odd flame lick: a disabled cruiser burns.
  let smokeAcc = 0;
  function cruiserSmoke(x, z, dt) {
    smokeAcc += dt;
    while (smokeAcc > 1 / 22) {
      smokeAcc -= 1 / 22;
      spawn(
        x + rnd(-0.6, 0.6), 1.6 + rnd(0, 0.6), z + rnd(-0.6, 0.6),
        rnd(-0.4, 0.4), rnd(1.6, 2.6), rnd(-0.4, 0.4),
        rnd(0.8, 1.4), rnd(2.2, 3.4), 0.16, 0.15, 0.15, 0.62,
        2.6, 0.3, 1.2,
      );
      if (Math.random() < 0.25) {
        spawn(
          x + rnd(-0.4, 0.4), 1.1, z + rnd(-0.4, 0.4),
          rnd(-0.5, 0.5), rnd(1.2, 2.2), rnd(-0.5, 0.5),
          rnd(0.15, 0.3), rnd(1.4, 2.2), 1.0, 0.55, 0.15, 0.9,
          0.5, -1.0, 1.0,
        );
      }
    }
  }
  // Muzzle flash: a few hot yellow-white sparks at the barrel.
  function muzzle(x, y, z, dir) {
    for (let i = 0; i < 5; i++) {
      spawn(
        x + dir.x * 0.4, y + rnd(-0.1, 0.1), z + dir.z * 0.4,
        dir.x * rnd(6, 12) + rnd(-2, 2), rnd(-1, 2), dir.z * rnd(6, 12) + rnd(-2, 2),
        rnd(0.05, 0.1), rnd(1.2, 2.0), 1.0, 0.85, 0.4, 0.95,
        0, 0, 2.5,
      );
    }
  }
  // Hit sparks: bright orange, fast, short-lived, gravity pulls them down.
  function sparks(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(2, 7);
      spawn(
        x, y, z,
        Math.cos(a) * sp, rnd(1, 4.5), Math.sin(a) * sp,
        rnd(0.15, 0.35), rnd(0.8, 1.4), 1.0, 0.6, 0.15, 0.95,
        0, -6, 1.5,
      );
    }
  }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = parts[i];
      const o3 = i * 3;
      if (!p.alive) { alpha[i] = 0; pos[o3 + 1] = -100; continue; }
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; active--; alpha[i] = 0; pos[o3 + 1] = -100; continue; }
      const dragF = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragF; p.vz *= dragF;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
      p.size += p.grow * dt;
      const age = 1 - p.life / p.maxLife; // 0 fresh, 1 dying
      const fade = p.fadeIn > 0
        ? Math.min(1, age / Math.max(0.001, p.fadeIn / p.maxLife))
        : 1;
      pos[o3] = p.x; pos[o3 + 1] = p.y; pos[o3 + 2] = p.z;
      col[o3] = p.r; col[o3 + 1] = p.g; col[o3 + 2] = p.b;
      size[i] = p.size;
      alpha[i] = p.a * fade * (1 - age * 0.85);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.pcolor.needsUpdate = true;
    geo.attributes.psize.needsUpdate = true;
    geo.attributes.palpha.needsUpdate = true;
  }

  // --- skid marks (fading dark quads on the road) ---------------------------
  const skidGeo = new THREE.PlaneGeometry(0.55, 1.7);
  const skids = [];
  for (let i = 0; i < MAX_SKIDS; i++) {
    const m = new THREE.Mesh(
      skidGeo,
      new THREE.MeshBasicMaterial({ color: 0x141416, transparent: true, opacity: 0, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 1;
    scene.add(m);
    skids.push({ mesh: m, life: 0 });
  }
  let skidCursor = 0;
  function skid(x, z, heading) {
    const s = skids[skidCursor];
    skidCursor = (skidCursor + 1) % MAX_SKIDS;
    s.mesh.position.set(x, 0.06, z);
    s.mesh.rotation.z = -heading;
    s.mesh.visible = true;
    s.mesh.material.opacity = 0.55;
    s.life = 8; // seconds to fade out
  }
  function updateSkids(dt) {
    for (const s of skids) {
      if (!s.mesh.visible) continue;
      s.life -= dt;
      if (s.life <= 0) { s.mesh.visible = false; s.mesh.material.opacity = 0; continue; }
      s.mesh.material.opacity = Math.min(0.55, (s.life / 8) * 0.55);
    }
  }

  return {
    update(dt) { update(dt); updateSkids(dt); },
    tireSmoke, cruiserSmoke, muzzle, sparks, skid,
    get active() { return active; },
    get total() { return totalSpawned; },
    get skidCount() { return skids.filter((s) => s.mesh.visible).length; },
  };
}
