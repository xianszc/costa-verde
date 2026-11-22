// AZZURA HEIST — radio (M2: 3 procedural WebAudio stations).
// No audio files: every station is a small step sequencer built from
// oscillators + filtered noise, scheduled with a lookahead timer. The
// AudioContext is created lazily on the first user gesture (Enter / click)
// and resumed on every station switch, so autoplay policy never blocks it.
// Stations: Radio Lume (italo disco), Onda Azzura (jazz/lounge), Radio
// Cava (quarry rock). Each has its own track name + DJ line in the HUD.
// Station list (also used by the HUD + hub for names/tracks).
export const STATIONS = [
  { name: 'RADIO LUME', track: 'Notte di Luce — Solmar Five · Italo Disco', bpm: 116 },
  { name: 'ONDA AZZURA', track: 'Blue Hour — Marina Quartet · Jazz', bpm: 92 },
  { name: 'RADIO CAVA', track: 'Stone and Thunder — The Quarrymen · Rock', bpm: 138 },
];

// Chord roots in Hz (A minor family for Lume, C major 7 for Onda, E minor
// power chords for Cava). Each station steps through 4 chords, one per bar.
// AUDIO (22 Nov 23:31): the radio shares the game's single AudioContext
// (audio.js) — its master connects to the music bus, so volume/ducking
// apply to the radio too. No second context is created here.
import { ensureSharedAudio } from './audio.js';
const PROG = [
  [110.0, 130.81, 164.81, 196.0], // Lume: Am F C G
  [130.81, 164.81, 196.0, 146.83], // Onda: C E G Dm
  [82.41, 98.0, 110.0, 123.47], // Cava: E G A B
];

export function createRadio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let current = 0;
  let volume = 0.7;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const sh = ensureSharedAudio();
      if (!sh) return false;
      ctx = sh.ctx;
      master = ctx.createGain();
      master.gain.value = volume * 1.0;
      master.connect(sh.music);
      noiseBuf = sh.noiseBuf;
      return true;
    } catch (e) { return false; }
  }
  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }
  function tone(freq, t, dur, type, vol, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
  function kick(t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.25);
  }
  // One 16th-note step of the current station's pattern.
  function scheduleStep(s, t) {
    const st = current;
    const bar = Math.floor(s / 16) % 4;
    const root = PROG[st][bar];
    const spb = 60 / STATIONS[st].bpm / 4; // seconds per 16th
    if (st === 0) { // Lume: italo disco — kick 4/4, offbeat hats, bass 8ths, sparkle arp
      if (s % 4 === 0) kick(t);
      if (s % 4 === 2) noise(t, 0.05, 0.16, 8000, 1.5);
      if (s % 2 === 0) tone(root / 2, t, spb * 1.8, 'square', 0.16);
      if (s % 4 === 1) tone(root * 2, t, spb, 'triangle', 0.1);
      if (s % 8 === 6) tone(root * 4, t, spb * 1.5, 'sine', 0.07);
    } else if (st === 1) { // Onda: jazz — swing hats, walking bass, Rhodes chords
      if (s % 3 === 0) noise(t, 0.04, 0.08, 6000, 1);
      if (s % 4 === 0) tone(root / 2, t, spb * 3.5, 'sine', 0.2);
      if (s % 4 === 2) tone(root / 2 * 1.5, t, spb * 2, 'sine', 0.1);
      if (s % 8 === 0) { tone(root, t, spb * 7, 'triangle', 0.08); tone(root * 1.26, t, spb * 7, 'triangle', 0.06); }
      if (s % 16 === 12) tone(root * 2.02, t, spb * 3, 'sine', 0.06);
    } else { // Cava: rock — kick + snare, distorted power chords, driving bass
      if (s % 4 === 0) kick(t);
      if (s % 8 === 4) noise(t, 0.12, 0.22, 1800, 0.8);
      if (s % 2 === 0) tone(root / 2, t, spb * 1.8, 'sawtooth', 0.12);
      if (s % 8 === 0) { tone(root, t, spb * 6, 'sawtooth', 0.09); tone(root * 1.5, t, spb * 6, 'sawtooth', 0.07); }
      if (s % 4 === 2) noise(t, 0.04, 0.1, 7000, 1.5);
    }
  }
  function tick() {
    if (!ctx) return;
    const ahead = ctx.currentTime + 0.25;
    while (nextTime < ahead) {
      scheduleStep(step, nextTime);
      const spb = 60 / STATIONS[current].bpm / 4;
      nextTime += spb;
      step = (step + 1) % 64;
    }
  }
  function start() {
    if (!ensure()) return false;
    resume();
    if (started) return true;
    started = true;
    step = 0;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 90);
    return true;
  }
  function setStation(i) {
    current = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    step = 0;
    if (ctx) nextTime = ctx.currentTime + 0.05;
    return current;
  }
  function next() { return setStation(current + 1); }
  function prev() { return setStation(current - 1); }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume * 1.0;
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    started = false;
    // AUDIT m-26: the AudioContext is SHARED with audio.js — never
    // close it here (a stale stop() would silence the whole game).
    // Dropping the local handles is enough; start() re-ensures them.
    master = null;
    ctx = null;
  }
  return {
    stations: STATIONS,
    get current() { return current; },
    get index() { return current; },
    get playing() { return started; },
    start, resume, setStation, next, prev, setVolume, stop,
  };
}
