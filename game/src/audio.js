// audio.js — every sound is synthesized with WebAudio: no audio files, no network.
// Footsteps patter as you walk, the alarm stings when you are spotted, the dog
// barks, fruit thuds, and the gate chimes when it opens.

const AudioSys = {
  ctx: null,
  muted: false,
  stepAlt: false,

  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  },

  now() { return this.ctx ? this.ctx.currentTime : 0; },

  // Short filtered-noise tap for one footstep; crouched steps are softer and lower.
  footstep(crouch) {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const dur = 0.07;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = crouch ? 320 : 700;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(crouch ? 0.05 : 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(gain); gain.connect(this.ctx.destination);
    src.start(t);
  },

  // Dissonant two-note alarm sting.
  sting() {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    for (const [freq, when, len] of [[233, 0, 0.22], [247, 0.16, 0.3], [466, 0.34, 0.4]]) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + when);
      g.gain.exponentialRampToValueAtTime(0.09, t + when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + when + len);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t + when); o.stop(t + when + len + 0.05);
    }
  },

  // Two sharp yaps.
  bark() {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    for (const when of [0, 0.14]) {
      const o = this.ctx.createOscillator();
      o.type = "square"; o.frequency.setValueAtTime(620, t + when);
      o.frequency.exponentialRampToValueAtTime(280, t + when + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.1, t + when);
      g.gain.exponentialRampToValueAtTime(0.001, t + when + 0.11);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t + when); o.stop(t + when + 0.13);
    }
  },

  // Low thump when fruit lands.
  thud() {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.2);
  },

  // Bright pickup chime.
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    for (const [freq, when] of [[660, 0], [880, 0.09], [1320, 0.18]]) {
      const o = this.ctx.createOscillator();
      o.type = "triangle"; o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, t + when);
      g.gain.exponentialRampToValueAtTime(0.001, t + when + 0.25);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t + when); o.stop(t + when + 0.3);
    }
  },
};
