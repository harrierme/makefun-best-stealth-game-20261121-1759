// Night Courier — tiny WebAudio synth. No audio files: every sound is an
// oscillator/envelope built at runtime, so the game ships zero bytes of audio.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._hum = null;
  }

  // Created lazily on first user gesture (browsers block audio before that).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startHum();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // Low room-tone hum so the archive never feels dead silent.
  startHum() {
    if (!this.ctx || this._hum) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 55;
    const g = this.ctx.createGain();
    g.gain.value = 0.035;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = this.ctx.createGain();
    lg.gain.value = 0.012;
    lfo.connect(lg);
    lg.connect(g.gain);
    o.connect(g);
    g.connect(this.master);
    o.start();
    lfo.start();
    this._hum = o;
  }

  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noiseBurst(dur, vol = 0.12, freq = 900) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  step(sneak) {
    this.noiseBurst(0.05, sneak ? 0.03 : 0.07, sneak ? 500 : 800);
  }

  coin() {
    this.tone(1900, 0.09, 'triangle', 0.22);
    this.tone(2500, 0.14, 'triangle', 0.16, 0.07);
    this.noiseBurst(0.06, 0.1, 3200);
  }

  pickup() {
    this.tone(660, 0.12, 'sine', 0.22);
    this.tone(880, 0.14, 'sine', 0.22, 0.09);
    this.tone(1320, 0.22, 'sine', 0.18, 0.18);
  }

  suspicious() {
    this.tone(440, 0.16, 'square', 0.1, 0, 520);
  }

  alert() {
    this.tone(220, 0.22, 'sawtooth', 0.2, 0, 330);
    this.tone(330, 0.3, 'sawtooth', 0.18, 0.16, 220);
    this.noiseBurst(0.25, 0.12, 400);
  }

  caught() {
    this.tone(180, 0.5, 'sawtooth', 0.24, 0, 60);
    this.tone(90, 0.7, 'square', 0.16, 0.1, 45);
  }

  unlock() {
    this.tone(523, 0.14, 'triangle', 0.2);
    this.tone(784, 0.2, 'triangle', 0.2, 0.12);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.2, i * 0.13));
  }
}
