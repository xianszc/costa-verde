// COSTA VERDE Slice 2 — audio: procedural WebAudio, no assets. A two-tone
// police siren (wail) whose volume follows the nearest cruiser, a noise-burst
// gunshot, and short stings for BUSTED / WASTED. Created lazily on the first
// user gesture so the autoplay policy never blocks the game; M mutes.

export function makeAudio() {
  let ctx = null, master = null, sirenGain = null, muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Siren: a sine at ~800 Hz wobbling ±160 Hz at 0.55 Hz (classic wail).
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 800;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      osc.connect(sirenGain);
      sirenGain.connect(master);
      osc.start();
      lfo.start();
      return true;
    } catch {
      return false;
    }
  }

  function setSiren(level) {
    if (!ctx || !sirenGain) return;
    sirenGain.gain.setTargetAtTime(muted ? 0 : level * 0.13, ctx.currentTime, 0.25);
  }

  function gunshot() {
    if (!ctx || muted) return;
    const dur = 0.14;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  function tone(freq, dur, type, vol, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function sting(kind) {
    if (!ctx || muted) return;
    if (kind === 'busted') { tone(392, 0.3, 'sine', 0.28, 0); tone(311, 0.5, 'sine', 0.28, 0.28); }
    else if (kind === 'wasted') { tone(220, 0.6, 'sawtooth', 0.12, 0); tone(165, 0.7, 'sawtooth', 0.12, 0.3); }
    else if (kind === 'cash') { tone(880, 0.12, 'sine', 0.2, 0); tone(1318, 0.2, 'sine', 0.2, 0.1); }
  }

  return {
    ensure,
    setSiren,
    gunshot,
    sting,
    setMuted(v) { muted = v; if (sirenGain && ctx) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); },
    get muted() { return muted; },
  };
}
