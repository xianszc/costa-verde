// COSTA VERDE Slice 4 — audio: procedural WebAudio, no assets. A two-tone
// police siren (wail, volume + pitch follow the nearest cruiser), a
// noise-burst gunshot, short stings, an engine hum (pitch follows speed),
// and a procedural radio with 3 stations (N cycles). Created lazily on the
// first user gesture so the autoplay policy never blocks the game; M mutes.

export function makeAudio() {
  let ctx = null, master = null, sirenGain = null, sirenOsc = null, muted = false;
  let engineOsc1 = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let radioGain = null, radioTimer = null, radioNext = 0, radioStep = 0, stationIdx = 0;

  // Three stations: each is a chord loop + bass line at its own tempo.
  // (Chords are plain frequencies — no samples, no copyrighted music.)
  const STATIONS = [
    {
      name: 'VERDE FM — Sunset Drive', bpm: 96, wave: 'triangle', vol: 0.05,
      chords: [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [146.8, 220, 293.7]],
      bass: [110, 87.3, 98, 73.4],
    },
    {
      name: 'MARINA 99 — Night Cruise', bpm: 124, wave: 'sawtooth', vol: 0.032,
      chords: [[233.1, 277.2, 349.2], [185, 233.1, 277.2], [207.7, 261.6, 311.1], [155.6, 207.7, 233.1]],
      bass: [116.5, 92.5, 103.8, 77.8],
    },
    {
      name: 'OLD TOWN RADIO — Latin Groove', bpm: 112, wave: 'square', vol: 0.026,
      chords: [[196, 246.9, 293.7], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 329.6]],
      bass: [98, 110, 87.3, 98],
    },
  ];

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
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Siren: a sine at ~800 Hz wobbling ±160 Hz at 0.55 Hz (classic wail).
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 800;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      lfo.start();
      // Engine: two detuned oscillators through a lowpass — a low hum that
      // rises in pitch and volume with speed (Slice 4).
      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 110;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc1.start();
      engineOsc2.start();
      // Radio: a quiet gain stage; the scheduler below plays the loop.
      radioGain = ctx.createGain();
      radioGain.gain.value = 0;
      radioGain.connect(master);
      radioNext = ctx.currentTime + 0.1;
      radioStep = 0;
      radioTimer = setInterval(scheduleRadio, 90);
      return true;
    } catch {
      return false;
    }
  }

  // Radio scheduler: lookahead 0.25 s, one 8th-note per step, 8 steps per
  // bar (4 beats). The chord tones arpeggiate; the bass hits beats 1 and 3.
  function scheduleRadio() {
    if (!ctx || !radioGain) return;
    const st = STATIONS[stationIdx];
    const eighth = 60 / st.bpm / 2;
    while (radioNext < ctx.currentTime + 0.25) {
      const bar = Math.floor(radioStep / 8) % st.chords.length;
      const chord = st.chords[bar];
      const tone = chord[radioStep % chord.length];
      radioNote(tone, radioNext, eighth * 0.9, st.wave, st.vol);
      if (radioStep % 8 === 0) radioNote(st.bass[bar], radioNext, eighth * 1.8, 'sine', st.vol * 1.4);
      if (radioStep % 8 === 4) radioNote(st.bass[bar] * 1.5, radioNext, eighth * 0.9, 'sine', st.vol);
      radioStep++;
      radioNext += eighth;
    }
  }
  function radioNote(freq, t0, dur, type, vol) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(radioGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function setSiren(level, dist) {
    if (!ctx || !sirenGain) return;
    sirenGain.gain.setTargetAtTime(muted ? 0 : level * 0.13, ctx.currentTime, 0.25);
    // Closer cruisers wail a touch higher — the siren changes with distance.
    if (sirenOsc && dist != null) {
      const near = 1 - Math.max(0, Math.min(1, dist / 120));
      sirenOsc.frequency.setTargetAtTime(800 + near * 150, ctx.currentTime, 0.3);
    }
  }

  // frac 0..1 = speed / top speed; boosting adds a higher rev.
  function setEngine(frac, boosting) {
    if (!ctx || !engineGain) return;
    const f = Math.max(0, Math.min(1, frac));
    const freq = 55 + f * 95 + (boosting ? 35 : 0);
    engineOsc1.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
    engineOsc2.frequency.setTargetAtTime(freq * 2, ctx.currentTime, 0.08);
    engineFilter.frequency.setTargetAtTime(380 + f * 900, ctx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(muted || f < 0.02 ? 0 : 0.028 + f * 0.055, ctx.currentTime, 0.1);
  }

  function setRadio(level) {
    if (!ctx || !radioGain) return;
    radioGain.gain.setTargetAtTime(muted ? 0 : level * 0.09, ctx.currentTime, 0.3);
  }
  function nextStation() {
    stationIdx = (stationIdx + 1) % STATIONS.length;
    return STATIONS[stationIdx].name;
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
    setEngine,
    setRadio,
    nextStation,
    gunshot,
    sting,
    stationName() { return STATIONS[stationIdx].name; },
    setMuted(v) {
      muted = v;
      if (master && ctx) master.gain.setTargetAtTime(v ? 0 : 0.5, ctx.currentTime, 0.05);
      if (sirenGain && ctx) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    get muted() { return muted; },
    debug() {
      return { ctx: !!ctx, engine: !!engineOsc1, radio: !!radioTimer, station: STATIONS[stationIdx].name };
    },
  };
}
