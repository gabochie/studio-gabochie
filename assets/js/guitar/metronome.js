/* Gideon Guitar Method — Metronome */

class GuitarMetronome {
  constructor() {
    this.ctx = null;
    this.bpm = 60;
    this.beatsPerBar = 4;
    this.currentBeat = 0;
    this.running = false;
    this.volume = 0.5;
    this.accentVolume = 0.8;
    this.onBeat = null;
    this.scheduleAhead = 0.1;
    this.nextNoteTime = 0;
    this.timerId = null;
  }

  start(bpm) {
    if (bpm) this.bpm = bpm;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.running = true;
    this.currentBeat = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
  }

  schedule() {
    if (!this.running) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
      this.playClick(this.nextNoteTime, this.currentBeat);
      if (this.onBeat) this.onBeat(this.currentBeat);
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
      this.nextNoteTime += 60.0 / this.bpm;
    }

    this.timerId = setTimeout(() => this.schedule(), 25);
  }

  playClick(time, beat) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (beat === 0) {
      osc.frequency.value = 880;
      gain.gain.value = this.accentVolume;
    } else {
      osc.frequency.value = 660;
      gain.gain.value = this.volume;
    }

    osc.start(time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.stop(time + 0.08);
  }

  setBpm(bpm) {
    this.bpm = Math.max(20, Math.min(300, bpm));
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  setBeatsPerBar(n) {
    this.beatsPerBar = Math.max(2, Math.min(8, n));
    this.currentBeat = 0;
  }

  toggle() {
    if (this.running) this.stop();
    else this.start();
    return this.running;
  }
}

if (typeof window !== 'undefined') window.GuitarMetronome = GuitarMetronome;
