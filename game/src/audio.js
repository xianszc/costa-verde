// AZZURA HEIST — audio engine (fase audio, 22 Nov 23:31).
// ONE AudioContext for the whole game: radio.js and the old wheels.js
// tyre squeal used to create their own contexts; both now share this
// one (see ensureSharedAudio). Every sound is synthesized (oscillator /
// filtered noise / envelopes) — no audio files are loaded.
// Budgets: at most ~24 simultaneous voices (a low-priority sound is
// dropped, never queued); loops are created once and only their
// parameters are updated per frame; one-shot envelopes are small and
// short-lived. Nothing here allocates per frame except one-shots.
// Verification: window.__audioStats = { triggered, activeVoices, dropped }.

const SETTINGS_KEY = 'azzura_audio_v1';
const MAX_VOICES = 24;
const DEFAULT_SETTINGS = { master: 0.7, music: 0.8, sfx: 1, ambience: 0.8, ui: 1, muted: false };

// --- the single shared context + buses (module level) ---
// Buses: master -> destination; music / sfx / ambience / ui -> master.
// Radio connects its own master to the music bus, so ducking the music
// bus ducks the radio too.
let shared = null;
export function ensureSharedAudio() {
  if (shared) return shared;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const music = ctx.createGain(); music.connect(master);
    const sfx = ctx.createGain(); sfx.connect(master);
    const ambience = ctx.createGain(); ambience.connect(master);
    const ui = ctx.createGain(); ui.connect(master);
    // One shared 1 s white-noise buffer — every noise sound reuses it.
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    shared = { ctx, master, music, sfx, ambience, ui, noiseBuf };
    return shared;
  } catch (e) { return null; }
}
export function getSharedAudio() { return shared; }

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}

// --- zones + surfaces (approximate, from the map layout) ---
// x/z in game units (1u = 10 m). Player clamps: x ±58, z -86..104.
// CBD core |x|<=30, z -45..12; old town z<-44; promenade/quay z 12..35
// (walkway z 29, quay strip z 12.7..14.5); hills z<-60; quarry x>80;
// residential east x>40; commercial ring = the rest around the CBD.
export function zoneFor(x, z) {
  if (z >= 12) return 'harbor';
  if (z < -60) return 'hills';
  if (x > 80) return 'industrial';
  if (z < -44) return 'oldtown';
  if (Math.abs(x) <= 30) return 'cbd';
  if (x > 40) return 'residential';
  return 'commercial';
}
export function surfaceFor(x, z) {
  if (z > 35.5) return 'water'; // bay shore / skyline beach
  // AUDIT m-22: the beach edge (boardwalk end to water) is sand — the
  // 'sand' footstep existed but no surface ever returned it.
  if (z > 35 && z <= 35.5) return 'sand';
  if (z >= 28 && z <= 35) return 'wood'; // promenade boardwalk
  if (z >= 12.7 && z <= 14.5) return 'wood'; // quay decking
  if (z < -60 || x > 80) return 'grass'; // hills / countryside
  return 'asphalt';
}

// Ambience layer targets per zone (0..1). Night adds crickets + bar pad.
const ZONE_LAYERS = {
  harbor: { waves: 1, wind: 0.4, traffic: 0.2, crowd: 0.3, machines: 0, rain: 0, crickets: 0, barpad: 0 },
  oldtown: { waves: 0, wind: 0.3, traffic: 0.1, crowd: 0.25, machines: 0, rain: 0, crickets: 0, barpad: 0 },
  cbd: { waves: 0, wind: 0.2, traffic: 1, crowd: 0.8, machines: 0, rain: 0, crickets: 0, barpad: 0 },
  commercial: { waves: 0, wind: 0.2, traffic: 0.5, crowd: 0.7, machines: 0, rain: 0, crickets: 0, barpad: 0 },
  industrial: { waves: 0, wind: 0.6, traffic: 0.2, crowd: 0, machines: 1, rain: 0, crickets: 0, barpad: 0 },
  residential: { waves: 0, wind: 0.4, traffic: 0.15, crowd: 0.2, machines: 0, rain: 0, crickets: 0, barpad: 0 },
  hills: { waves: 0, wind: 1, traffic: 0, crowd: 0, machines: 0, rain: 0, crickets: 0, barpad: 0 },
};
const LAYER_BASE = { waves: 0.11, wind: 0.09, traffic: 0.07, crowd: 0.05, machines: 0.06, rain: 0.07, crickets: 0.045, barpad: 0.05 };

export function createAudioEngine() {
  const settings = loadSettings();
  const stats = { triggered: {}, activeVoices: 0, dropped: {} };
  const active = new Set(); // voice records {nodes, priority, kind, born}
  let s = null; // shared context, once ensured
  let t = 0; // engine time (accumulates dt in update)
  let lastStepPhase = 0;
  let prevBraking = false;
  let prevZone = null;
  let prevNight = null;
  let duckUntil = -1;
  let stormOn = false;
  let nextBeat = 0;
  const nextEvent = {}; // random ambience one-shots: key -> engine time
  const loops = {}; // lazily created loop nodes

  function count(name) { stats.triggered[name] = (stats.triggered[name] || 0) + 1; }
  function drop(name) { stats.dropped[name] = (stats.dropped[name] || 0) + 1; }

  function ensure() {
    s = ensureSharedAudio();
    if (!s) return false;
    applyVolumes();
    if (s.ctx.state === 'suspended') s.ctx.resume().catch(() => {});
    return true;
  }
  function resume() {
    if (ensure() && s.ctx.state === 'suspended') s.ctx.resume().catch(() => {});
  }
  function applyVolumes() {
    if (!s) return;
    const m = settings.muted ? 0 : settings.master;
    s.master.gain.value = m;
    s.music.gain.value = settings.music;
    s.sfx.gain.value = settings.sfx;
    s.ambience.gain.value = settings.ambience;
    s.ui.gain.value = settings.ui;
  }
  function setVolume(bus, v) {
    const val = Math.max(0, Math.min(1, v));
    if (bus in settings) settings[bus] = val;
    saveSettings(settings);
    applyVolumes();
    return val;
  }
  function setMuted(m) {
    settings.muted = !!m;
    saveSettings(settings);
    applyVolumes();
    return settings.muted;
  }

  // --- voice bookkeeping ---
  function registerVoice(rec) {
    if (active.size >= MAX_VOICES) {
      let victim = null;
      for (const v of active) {
        if (!victim || v.priority < victim.priority
          || (v.priority === victim.priority && v.born < victim.born)) victim = v;
      }
      if (victim && victim.priority <= rec.priority) stopVoice(victim);
      else { drop(rec.kind); return null; }
    }
    active.add(rec);
    stats.activeVoices = active.size;
    return rec;
  }
  function unregisterVoice(rec) {
    if (active.delete(rec)) stats.activeVoices = active.size;
  }
  function stopVoice(rec) {
    try { for (const n of rec.nodes) { try { n.stop(); } catch (e) {} } } catch (e) {}
    unregisterVoice(rec);
  }
  function track(nodes, priority, kind, dur) {
    const rec = { nodes, priority, kind, born: t };
    if (!registerVoice(rec)) return null;
    const done = () => unregisterVoice(rec);
    for (const n of nodes) {
      try { n.onended = done; } catch (e) {}
    }
    // Safety net: onended does not always fire for stopped nodes.
    setTimeout(() => unregisterVoice(rec), Math.ceil(dur * 1000) + 300);
    return rec;
  }

  // --- synth primitives (small, short-lived) ---
  function tone(o) {
    if (!s) return null;
    const now = s.ctx.currentTime + (o.at || 0);
    const osc = s.ctx.createOscillator();
    const g = s.ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, now);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), now + o.dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(o.vol, now + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, now + o.dur);
    osc.connect(g);
    g.connect(o.bus || s.sfx);
    osc.start(now);
    osc.stop(now + o.dur + 0.05);
    return { nodes: [osc], dur: o.dur };
  }
  function noise(o) {
    if (!s) return null;
    const now = s.ctx.currentTime + (o.at || 0);
    const src = s.ctx.createBufferSource();
    src.buffer = s.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const flt = s.ctx.createBiquadFilter();
    flt.type = o.ftype || 'bandpass';
    flt.frequency.setValueAtTime(o.freq || 1000, now);
    if (o.freq2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), now + o.dur);
    flt.Q.value = o.q || 1;
    const g = s.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(o.vol, now + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, now + o.dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(o.bus || s.sfx);
    src.start(now, Math.random());
    src.stop(now + o.dur + 0.05);
    return { nodes: [src], dur: o.dur };
  }
  // One envelope helper: run a recipe of tone/noise parts as one voice.
  function oneShot(kind, priority, parts) {
    if (!ensure()) { drop(kind); return false; }
    count(kind);
    const nodes = [];
    let dur = 0;
    for (const p of parts) {
      const r = p.n ? noise(p.n) : tone(p.t);
      if (r) { nodes.push(...r.nodes); dur = Math.max(dur, (p.n || p.t).dur + ((p.n || p.t).at || 0)); }
    }
    if (!nodes.length) return false;
    track(nodes, priority, kind, dur);
    return true;
  }

  // --- ducking: music dips briefly on gunfire / crashes ---
  function duck() {
    if (!s) return;
    const now = s.ctx.currentTime;
    const base = settings.music;
    const g = s.music.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(base * 0.35, now + 0.05);
    g.linearRampToValueAtTime(base, now + 0.7);
    duckUntil = t + 0.7;
  }

  // --- one-shot recipes ---
  function gunshot(weapon, opts = {}) {
    const q = opts.quiet ? 0.45 : 1;
    if (weapon === 'TAMBURO') {
      oneShot('gunshot_tamburo', 3, [
        { n: { dur: 0.07, vol: 0.35 * q, ftype: 'bandpass', freq: 2000, q: 1 } },
        { t: { f: 220, f2: 70, dur: 0.05, type: 'square', vol: 0.25 * q } },
      ]);
    } else if (weapon === 'DOPPIETTA') {
      oneShot('gunshot_doppietta', 3, [
        { n: { dur: 0.35, vol: 0.7 * q, ftype: 'lowpass', freq: 900 } },
        { t: { f: 120, f2: 40, dur: 0.3, type: 'sine', vol: 0.5 * q } },
        { n: { dur: 0.2, vol: 0.25 * q, ftype: 'bandpass', freq: 500, q: 1 } },
      ]);
    } else if (weapon === 'FUCILE') {
      oneShot('gunshot_fucile', 3, [
        { n: { dur: 0.3, vol: 0.55 * q, ftype: 'highpass', freq: 2000 } },
        { t: { f: 300, f2: 60, dur: 0.25, type: 'sawtooth', vol: 0.3 * q } },
        { n: { dur: 0.4, vol: 0.15 * q, ftype: 'highpass', freq: 2500, at: 0.12 } },
      ]);
    } else { // LUPO P9 (default pistol crack)
      oneShot('gunshot_p9', 3, [
        { n: { dur: 0.12, vol: 0.5 * q, ftype: 'highpass', freq: 3000 } },
        { t: { f: 160, f2: 50, dur: 0.08, type: 'square', vol: 0.35 * q } },
      ]);
    }
    duck();
    return true;
  }
  function reload() {
    return oneShot('reload', 2, [
      { t: { f: 1200, dur: 0.03, type: 'square', vol: 0.2 } },
      { n: { dur: 0.03, vol: 0.12, ftype: 'bandpass', freq: 3000, q: 2, at: 0.05 } },
      { t: { f: 900, dur: 0.03, type: 'square', vol: 0.2, at: 0.28 } },
      { t: { f: 1500, dur: 0.03, type: 'square', vol: 0.16, at: 0.32 } },
    ]);
  }
  function emptyClick() {
    return oneShot('empty_click', 2, [
      { t: { f: 1400, dur: 0.02, type: 'square', vol: 0.25 } },
    ]);
  }
  function impact(material) {
    if (material === 'glass') {
      return oneShot('impact_glass', 2, [
        { n: { dur: 0.25, vol: 0.4, ftype: 'highpass', freq: 5000 } },
        { t: { f: 2400, dur: 0.12, type: 'sine', vol: 0.12, at: 0.02 } },
        { t: { f: 3100, dur: 0.1, type: 'sine', vol: 0.1, at: 0.05 } },
        { t: { f: 1900, dur: 0.14, type: 'sine', vol: 0.1, at: 0.09 } },
      ]);
    }
    if (material === 'metal') {
      return oneShot('impact_metal', 2, [
        { t: { f: 850, f2: 520, dur: 0.18, type: 'square', vol: 0.3 } },
        { t: { f: 1270, dur: 0.1, type: 'square', vol: 0.15, at: 0.01 } },
        { n: { dur: 0.08, vol: 0.2, ftype: 'bandpass', freq: 2500, q: 2 } },
      ]);
    }
    if (material === 'body') {
      return oneShot('impact_body', 2, [
        { n: { dur: 0.12, vol: 0.4, ftype: 'lowpass', freq: 400 } },
        { t: { f: 110, f2: 60, dur: 0.1, type: 'sine', vol: 0.3 } },
      ]);
    }
    // wall / asphalt: low thud
    return oneShot('impact_wall', 2, [
      { n: { dur: 0.15, vol: 0.5, ftype: 'lowpass', freq: 300 } },
      { t: { f: 90, f2: 50, dur: 0.12, type: 'sine', vol: 0.4 } },
    ]);
  }
  function crash(intensity) {
    const i = Math.max(0, Math.min(1, intensity || 0.5));
    duck();
    return oneShot('crash', 3, [
      { n: { dur: 0.3 + 0.4 * i, vol: 0.3 + 0.6 * i, ftype: 'lowpass', freq: 500 } },
      { t: { f: 70, f2: 35, dur: 0.4, type: 'sine', vol: 0.5 * i + 0.1 } },
      { n: { dur: 0.15, vol: 0.3 * i, ftype: 'bandpass', freq: 2000, q: 1, at: 0.02 } },
    ]);
  }
  function horn() {
    return oneShot('horn', 2, [
      { t: { f: 370, dur: 0.45, type: 'square', vol: 0.22 } },
      { t: { f: 466, dur: 0.45, type: 'square', vol: 0.22 } },
    ]);
  }
  function brake() {
    return oneShot('brake', 1, [
      { n: { dur: 0.2, vol: 0.2, ftype: 'bandpass', freq: 1400, q: 3 } },
    ]);
  }
  function ui(name) {
    if (name === 'buy') {
      return oneShot('ui_buy', 1, [
        { t: { f: 880, dur: 0.07, type: 'sine', vol: 0.18, bus: s && s.ui } },
        { t: { f: 1320, dur: 0.09, type: 'sine', vol: 0.18, at: 0.07, bus: s && s.ui } },
      ]);
    }
    if (name === 'coin') {
      return oneShot('ui_coin', 1, [
        { t: { f: 1800, f2: 2400, dur: 0.12, type: 'sine', vol: 0.2, bus: s && s.ui } },
      ]);
    }
    if (name === 'jump') {
      return oneShot('ui_jump', 1, [
        { n: { dur: 0.35, vol: 0.2, ftype: 'bandpass', freq: 600, freq2: 2400, q: 1.5, bus: s && s.ui } },
        { t: { f: 300, f2: 900, dur: 0.3, type: 'sine', vol: 0.15, bus: s && s.ui } },
      ]);
    }
    if (name === 'mission_start') {
      return oneShot('mission_start', 1, [
        { t: { f: 523, dur: 0.12, type: 'triangle', vol: 0.2, bus: s && s.ui } },
        { t: { f: 659, dur: 0.12, type: 'triangle', vol: 0.2, at: 0.09, bus: s && s.ui } },
        { t: { f: 784, dur: 0.16, type: 'triangle', vol: 0.2, at: 0.18, bus: s && s.ui } },
      ]);
    }
    if (name === 'mission_complete') {
      return oneShot('mission_complete', 1, [
        { t: { f: 523, dur: 0.18, type: 'triangle', vol: 0.2, bus: s && s.ui } },
        { t: { f: 659, dur: 0.18, type: 'triangle', vol: 0.2, at: 0.1, bus: s && s.ui } },
        { t: { f: 784, dur: 0.18, type: 'triangle', vol: 0.2, at: 0.2, bus: s && s.ui } },
        { t: { f: 1046, dur: 0.26, type: 'triangle', vol: 0.2, at: 0.3, bus: s && s.ui } },
      ]);
    }
    if (name === 'mission_fail') {
      return oneShot('mission_fail', 1, [
        { t: { f: 392, dur: 0.2, type: 'triangle', vol: 0.18, bus: s && s.ui } },
        { t: { f: 311, dur: 0.2, type: 'triangle', vol: 0.18, at: 0.12, bus: s && s.ui } },
        { t: { f: 233, dur: 0.28, type: 'triangle', vol: 0.18, at: 0.24, bus: s && s.ui } },
      ]);
    }
    // ui_click (default)
    return oneShot('ui_click', 1, [
      { t: { f: 1200, dur: 0.05, type: 'sine', vol: 0.15, bus: s && s.ui } },
    ]);
  }
  function wanted(level, prev) {
    if (level > prev) {
      return oneShot('wanted_up', 2, [
        { t: { f: 220, dur: 0.5, type: 'sawtooth', vol: 0.22 } },
        { t: { f: 233, dur: 0.5, type: 'sawtooth', vol: 0.22 } },
        { n: { dur: 0.3, vol: 0.2, ftype: 'lowpass', freq: 300 } },
      ]);
    }
    if (level < prev) {
      return oneShot('wanted_down', 1, [
        { t: { f: 440, f2: 660, dur: 0.3, type: 'sine', vol: 0.15 } },
      ]);
    }
    return false;
  }
  function footstep(surface) {
    if (surface === 'sand') {
      return oneShot('footstep_sand', 1, [
        { n: { dur: 0.12, vol: 0.25, ftype: 'lowpass', freq: 500 } },
      ]);
    }
    if (surface === 'wood') {
      return oneShot('footstep_wood', 1, [
        { t: { f: 180, f2: 120, dur: 0.08, type: 'sine', vol: 0.3 } },
        { n: { dur: 0.05, vol: 0.2, ftype: 'bandpass', freq: 900, q: 1 } },
      ]);
    }
    if (surface === 'grass') {
      return oneShot('footstep_grass', 1, [
        { n: { dur: 0.09, vol: 0.18, ftype: 'bandpass', freq: 1400, q: 1 } },
      ]);
    }
    if (surface === 'water') {
      return oneShot('splash', 1, [
        { n: { dur: 0.3, vol: 0.35, ftype: 'lowpass', freq: 1200, freq2: 300 } },
        { t: { f: 900, f2: 500, dur: 0.08, type: 'sine', vol: 0.1, at: 0.05 } },
      ]);
    }
    return oneShot('footstep_asphalt', 1, [
      { n: { dur: 0.07, vol: 0.3, ftype: 'lowpass', freq: 900 } },
      { t: { f: 120, dur: 0.05, type: 'sine', vol: 0.15 } },
    ]);
  }
  // One step per half stride: walkPhase advances ~2.4 rad per unit of
  // distance, so a step lands every PI of phase.
  function noteStep(phase, surface) {
    if (!s) return;
    const n = Math.floor(phase / Math.PI);
    const prev = Math.floor(lastStepPhase / Math.PI);
    lastStepPhase = phase;
    if (n !== prev) footstep(surface);
  }
  function npcShout(kind) {
    if (kind === 'fear') {
      return oneShot('npc_fear', 1, [
        { t: { f: 700, f2: 1100, dur: 0.25, type: 'sine', vol: 0.22 } },
      ]);
    }
    if (kind === 'angry') {
      return oneShot('npc_angry', 1, [
        { t: { f: 140, f2: 90, dur: 0.25, type: 'square', vol: 0.25 } },
      ]);
    }
    return oneShot('npc_gasp', 1, [
      { t: { f: 900, f2: 1400, dur: 0.12, type: 'sine', vol: 0.2 } },
    ]);
  }
  function bellTower() {
    return oneShot('bell_tower', 2, [
      { t: { f: 220, dur: 2.5, type: 'sine', vol: 0.4 } },
      { t: { f: 330, dur: 2.0, type: 'sine', vol: 0.15, at: 0.01 } },
      { t: { f: 440, dur: 1.6, type: 'sine', vol: 0.12, at: 0.01 } },
      { t: { f: 554, dur: 1.2, type: 'sine', vol: 0.08, at: 0.01 } },
    ]);
  }
  function shipHorn() {
    return oneShot('ship_horn', 1, [
      { t: { f: 110, dur: 1.6, type: 'sine', vol: 0.35, attack: 0.15 } },
      { t: { f: 165, dur: 1.6, type: 'sine', vol: 0.25, attack: 0.15 } },
    ]);
  }
  function thunder() {
    return oneShot('thunder', 1, [
      { n: { dur: 1.8, vol: 0.5, ftype: 'lowpass', freq: 120, attack: 0.3 } },
    ]);
  }
  function heartbeat() {
    return oneShot('heartbeat', 2, [
      { t: { f: 60, dur: 0.12, type: 'sine', vol: 0.5 } },
      { t: { f: 55, dur: 0.1, type: 'sine', vol: 0.35, at: 0.18 } },
    ]);
  }
  function gull() {
    return oneShot('gull', 0, [
      { t: { f: 1400, f2: 900, dur: 0.18, type: 'sine', vol: 0.1 } },
      { t: { f: 1500, f2: 1000, dur: 0.14, type: 'sine', vol: 0.08, at: 0.22 } },
    ]);
  }
  function bird() {
    return oneShot('bird', 0, [
      { t: { f: 2400, f2: 3200, dur: 0.08, type: 'sine', vol: 0.07 } },
      { t: { f: 2600, f2: 3000, dur: 0.07, type: 'sine', vol: 0.06, at: 0.12 } },
    ]);
  }
  function dog() {
    return oneShot('dog', 0, [
      { t: { f: 300, f2: 180, dur: 0.09, type: 'square', vol: 0.1 } },
      { t: { f: 280, f2: 170, dur: 0.09, type: 'square', vol: 0.1, at: 0.16 } },
    ]);
  }
  function bellFar() {
    return oneShot('bell_far', 0, [
      { t: { f: 196, dur: 1.8, type: 'sine', vol: 0.1 } },
      { t: { f: 294, dur: 1.4, type: 'sine', vol: 0.06, at: 0.01 } },
    ]);
  }
  function clink() {
    return oneShot('clink', 0, [
      { t: { f: 2000, dur: 0.04, type: 'square', vol: 0.08 } },
    ]);
  }
  function creak() {
    return oneShot('creak', 0, [
      { t: { f: 130, f2: 70, dur: 0.6, type: 'sine', vol: 0.08 } },
    ]);
  }

  // --- loops (created once, parameters updated per frame) ---
  function loopNoise(filterType, freq, q, bus) {
    const src = s.ctx.createBufferSource();
    src.buffer = s.noiseBuf;
    src.loop = true;
    const flt = s.ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = freq;
    flt.Q.value = q || 1;
    const g = s.ctx.createGain();
    g.gain.value = 0;
    src.connect(flt);
    flt.connect(g);
    g.connect(bus || s.sfx);
    src.start();
    return { src, flt, gain: g };
  }
  function ensureLoops() {
    if (!s || loops.ready) return;
    // Engine: sawtooth + sub sine through one lowpass.
    const eOsc = s.ctx.createOscillator();
    eOsc.type = 'sawtooth';
    eOsc.frequency.value = 55;
    const eSub = s.ctx.createOscillator();
    eSub.type = 'sine';
    eSub.frequency.value = 28;
    const eFlt = s.ctx.createBiquadFilter();
    eFlt.type = 'lowpass';
    eFlt.frequency.value = 400;
    const eGain = s.ctx.createGain();
    eGain.gain.value = 0;
    eOsc.connect(eFlt);
    eSub.connect(eFlt);
    eFlt.connect(eGain);
    eGain.connect(s.sfx);
    eOsc.start();
    eSub.start();
    loops.engine = { osc: eOsc, sub: eSub, flt: eFlt, gain: eGain };
    // Tyre skid: band-passed noise (replaces the old wheels.js squeal,
    // which created its own AudioContext).
    loops.skid = loopNoise('bandpass', 900, 2.5, s.sfx);
    // Police siren: one sine, frequency toggled in update().
    const sir = s.ctx.createOscillator();
    sir.type = 'sine';
    sir.frequency.value = 720;
    const sirGain = s.ctx.createGain();
    sirGain.gain.value = 0;
    sir.connect(sirGain);
    sirGain.connect(s.sfx);
    sir.start();
    loops.siren = { osc: sir, gain: sirGain, phase: 0, nextToggle: 0 };
    // Police heli: chopped low rumble (13 Hz LFO on the loop gain).
    const heli = loopNoise('lowpass', 250, 1, s.sfx);
    const lfo = s.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 13;
    const lfoGain = s.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(heli.gain.gain);
    lfo.start();
    loops.heli = { ...heli, lfo };
    // Ambience layers (all looped noise, gains crossfaded by zone).
    loops.layers = {};
    const mkLayer = (name, build) => {
      const L = build();
      L.base = LAYER_BASE[name];
      L.target = 0;
      loops.layers[name] = L;
    };
    mkLayer('waves', () => {
      const L = loopNoise('lowpass', 450, 1, s.ambience);
      const lfo2 = s.ctx.createOscillator();
      lfo2.type = 'sine';
      lfo2.frequency.value = 0.08;
      const lg = s.ctx.createGain();
      lg.gain.value = 0.03;
      lfo2.connect(lg);
      lg.connect(L.gain.gain);
      lfo2.start();
      return L;
    });
    mkLayer('wind', () => loopNoise('lowpass', 350, 1, s.ambience));
    mkLayer('traffic', () => loopNoise('lowpass', 220, 1, s.ambience));
    mkLayer('crowd', () => loopNoise('bandpass', 750, 0.8, s.ambience));
    mkLayer('machines', () => {
      const o = s.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      const flt = s.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 180;
      const g = s.ctx.createGain();
      g.gain.value = 0;
      o.connect(flt);
      flt.connect(g);
      g.connect(s.ambience);
      o.start();
      return { src: o, flt, gain: g };
    });
    mkLayer('rain', () => loopNoise('bandpass', 2500, 0.6, s.ambience));
    mkLayer('crickets', () => {
      const L = loopNoise('bandpass', 4200, 4, s.ambience);
      const lfo3 = s.ctx.createOscillator();
      lfo3.type = 'square';
      lfo3.frequency.value = 3.7;
      const lg = s.ctx.createGain();
      lg.gain.value = 0.02;
      lfo3.connect(lg);
      lg.connect(L.gain.gain);
      lfo3.start();
      return L;
    });
    mkLayer('barpad', () => {
      const o1 = s.ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = 110;
      const o2 = s.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 164.81;
      const g = s.ctx.createGain();
      g.gain.value = 0;
      o1.connect(g);
      o2.connect(g);
      g.connect(s.ambience);
      o1.start();
      o2.start();
      return { src: o1, src2: o2, gain: g };
    });
    loops.ready = true;
  }
  function setLoopGain(loop, target, tau = 0.4) {
    if (!loop || !s) return;
    loop.gain.gain.setTargetAtTime(target, s.ctx.currentTime, tau);
  }

  // --- per-frame update (called from game.step) ---
  // info: {speedNorm 0..1, driving, drifting, braking, x, z, zone,
  //  isNight, health, storm, wanted, heli}
  function update(dt, info = {}) {
    if (!s) return;
    t += dt;
    ensureLoops();
    const now = s.ctx.currentTime;
    // Engine: pitch + filter follow speed; silent on foot / parked.
    if (loops.engine) {
      const on = info.driving && (info.speedNorm || 0) > 0.02;
      const n = Math.max(0, Math.min(1, info.speedNorm || 0));
      const target = on ? 0.035 + n * 0.05 : 0;
      loops.engine.gain.gain.setTargetAtTime(target, now, 0.1);
      loops.engine.osc.frequency.setTargetAtTime(55 + n * 160, now, 0.1);
      loops.engine.sub.frequency.setTargetAtTime(28 + n * 70, now, 0.1);
      loops.engine.flt.frequency.setTargetAtTime(400 + n * 1200, now, 0.1);
    }
    // Skid: gain follows drifting; brake hiss on the rising edge.
    if (loops.skid) {
      setLoopGain(loops.skid, info.drifting ? 0.06 : 0, 0.08);
    }
    if (info.braking && !prevBraking) brake();
    prevBraking = !!info.braking;
    // Siren: two-tone while wanted >= 1.
    if (loops.siren) {
      const on = (info.wanted || 0) >= 1;
      loops.siren.gain.gain.setTargetAtTime(on ? 0.045 : 0, now, 0.2);
      if (on && t >= loops.siren.nextToggle) {
        loops.siren.phase = 1 - loops.siren.phase;
        loops.siren.osc.frequency.setTargetAtTime(loops.siren.phase ? 960 : 720, now, 0.05);
        loops.siren.nextToggle = t + 0.45;
      }
    }
    // Heli loop while the wanted heli is up.
    if (loops.heli) setLoopGain(loops.heli, info.heli ? 0.06 : 0, 0.3);
    // Ambience: crossfade layers to the current zone (+ night + storm).
    const zone = info.zone || prevZone || 'cbd';
    const isNight = !!info.isNight;
    const targets = { ...(ZONE_LAYERS[zone] || ZONE_LAYERS.cbd) };
    targets.crickets = isNight ? 0.8 : 0;
    targets.barpad = (isNight && (zone === 'cbd' || zone === 'commercial')) ? 0.7 : 0;
    targets.rain = info.storm ? 1 : 0;
    if (loops.layers) {
      for (const name of Object.keys(loops.layers)) {
        const L = loops.layers[name];
        const target = (targets[name] || 0) * L.base;
        if (Math.abs(L.target - target) > 0.001 || zone !== prevZone || isNight !== prevNight) {
          L.target = target;
          L.gain.gain.setTargetAtTime(target, now, 0.8);
        }
      }
    }
    prevZone = zone;
    prevNight = isNight;
    // Random ambience one-shots (zone-appropriate, cooldown-gated).
    const ev = (key, min, max, fn) => {
      if (t < (nextEvent[key] || 0)) return;
      nextEvent[key] = t + min + Math.random() * (max - min);
      fn();
    };
    if (zone === 'harbor') {
      ev('gull', 4, 9, gull);
      ev('creak', 7, 15, creak);
      ev('shiphorn', 40, 70, shipHorn);
    } else if (zone === 'oldtown') {
      ev('bellfar', 20, 35, bellFar);
    } else if (zone === 'residential' || zone === 'hills') {
      ev('bird', 3, 8, bird);
      if (zone === 'residential') ev('dog', 15, 30, dog);
    } else if (zone === 'commercial') {
      ev('clink', 6, 12, clink);
    } else if (zone === 'industrial') {
      ev('clink', 5, 10, clink);
    }
    if (info.storm) ev('thunder', 12, 25, thunder);
    // Heartbeat while health is critical.
    if ((info.health ?? 100) <= 25) {
      if (t >= nextBeat) {
        heartbeat();
        nextBeat = t + 0.9;
      }
    }
  }
  function setStorm(on) {
    stormOn = !!on;
    if (stormOn && s) ensureLoops();
  }

  // --- public dispatcher (also used by the <1 min headless check) ---
  function play(name, opts = {}) {
    switch (name) {
      case 'gunshot_p9': return gunshot('LUPO P9', opts);
      case 'gunshot_tamburo': return gunshot('TAMBURO', opts);
      case 'gunshot_doppietta': return gunshot('DOPPIETTA', opts);
      case 'gunshot_fucile': return gunshot('FUCILE', opts);
      case 'gunshot_enemy': return gunshot('TAMBURO', { quiet: true });
      case 'reload': return reload();
      case 'empty_click': return emptyClick();
      case 'impact_wall': return impact('wall');
      case 'impact_glass': return impact('glass');
      case 'impact_metal': return impact('metal');
      case 'impact_body': return impact('body');
      case 'impact_asphalt': return impact('wall');
      case 'crash': return crash(opts.intensity ?? 0.6);
      case 'horn': return horn();
      case 'brake': return brake();
      case 'ui_click': return ui('ui_click');
      case 'ui_buy': return ui('buy');
      case 'ui_coin': return ui('coin');
      case 'ui_jump': return ui('jump');
      case 'mission_start': return ui('mission_start');
      case 'mission_complete': return ui('mission_complete');
      case 'mission_fail': return ui('mission_fail');
      case 'wanted_up': return wanted(1, 0);
      case 'wanted_down': return wanted(0, 1);
      case 'footstep_asphalt': return footstep('asphalt');
      case 'footstep_sand': return footstep('sand');
      case 'footstep_wood': return footstep('wood');
      case 'footstep_grass': return footstep('grass');
      case 'splash': return footstep('water');
      case 'npc_gasp': return npcShout('gasp');
      case 'npc_fear': return npcShout('fear');
      case 'npc_angry': return npcShout('angry');
      case 'bell_tower': return bellTower();
      case 'ship_horn': return shipHorn();
      case 'thunder': return thunder();
      case 'heartbeat': return heartbeat();
      case 'gull': return gull();
      case 'bird': return bird();
      case 'dog': return dog();
      case 'bell_far': return bellFar();
      case 'clink': return clink();
      case 'creak': return creak();
      default: return false;
    }
  }

  const engine = {
    ensure, resume,
    get ctx() { return s ? s.ctx : null; },
    get ctxState() { return s ? s.ctx.state : 'none'; },
    get settings() { return { ...settings }; },
    setVolume, setMuted,
    toggleMuted() { return setMuted(!settings.muted); },
    play, gunshot, reload, emptyClick, impact, crash, horn, brake,
    ui, wanted, footstep, noteStep, npcShout, bellTower, shipHorn,
    thunder, heartbeat, setStorm, update, duck,
    setEngine(norm, driving) {
      if (!s) return;
      ensureLoops();
      update(0, { speedNorm: norm, driving });
    },
    setZone(zone, isNight) {
      if (!s) return;
      ensureLoops();
      update(0, { zone, isNight });
    },
    get stats() { return stats; },
    get activeVoices() { return active.size; },
    get storm() { return stormOn; },
  };
  engineInstance = engine;
  return engine;
}

// Module-level handle so sidecontent / hub can reach the engine without
// threading it through every call site (game.js creates it first).
let engineInstance = null;
export function getAudioEngine() { return engineInstance; }
