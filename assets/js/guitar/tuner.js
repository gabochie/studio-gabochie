/* Gideon Guitar Method — Chromatic Tuner (Web Audio API) */

class GuitarTuner {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.microphone = null;
    this.rafId = null;
    this.activeNote = null;
    this.cents = 0;
    this.stream = null;
    this.onNote = null;
    this.onUpdate = null;
    this.running = false;
    this.strings = [
      { name: 'E', freq: 82.41, num: 6 },
      { name: 'A', freq: 110.00, num: 5 },
      { name: 'D', freq: 146.83, num: 4 },
      { name: 'G', freq: 196.00, num: 3 },
      { name: 'B', freq: 246.94, num: 2 },
      { name: 'e', freq: 329.63, num: 1 }
    ];
    this.NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    this.A4 = 440;
  }

  async start(audioContext) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      this.ctx = audioContext || new AudioContext();
      this.microphone = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.microphone.connect(this.analyser);
      this.running = true;
      this.loop();
      return true;
    } catch (e) {
      console.error('Tuner start failed:', e);
      return false;
    }
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.microphone = null;
    this.analyser = null;
  }

  loop() {
    if (!this.running) return;
    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    const freq = this.autocorrelate(buffer, this.ctx.sampleRate);
    if (freq > 50 && freq < 1500) {
      const note = this.freqToNote(freq);
      this.activeNote = note;
      this.cents = this.centsOff(freq, note.freq);
      if (this.onNote) this.onNote(note, this.cents, freq);
      if (this.onUpdate) this.onUpdate(note, this.cents, freq);
    } else {
      if (this.onUpdate) this.onUpdate(null, 0, 0);
    }
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  autocorrelate(buffer, sampleRate) {
    let size = buffer.length;
    let maxSamples = Math.floor(size / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1;

    let found = false;
    for (let offset = 2; offset < maxSamples; offset++) {
      let correlation = 0;
      for (let i = 0; i < maxSamples; i++) correlation += buffer[i] * buffer[i + offset];
      correlation /= (maxSamples - offset);
      if (correlation > bestCorrelation) { bestCorrelation = correlation; bestOffset = offset; }
    }

    if (bestCorrelation > 0.1 && bestOffset > 0) {
      // Parabolic interpolation for more accuracy
      let x0 = bestOffset - 1, x1 = bestOffset, x2 = bestOffset + 1;
      let y0, y1, y2;
      if (x0 >= 0 && x2 < maxSamples) {
        y0 = 0; y1 = 0; y2 = 0;
        for (let i = 0; i < maxSamples; i++) { y0 += buffer[i] * buffer[i + x0]; y1 += buffer[i] * buffer[i + x1]; y2 += buffer[i] * buffer[i + x2]; }
        let a = (y0 + y2 - 2 * y1) / 2;
        if (a !== 0) {
          let correction = (y0 - y2) / (4 * a);
          x1 += correction;
        }
      }
      return sampleRate / x1;
    }
    return -1;
  }

  freqToNote(freq) {
    let noteNum = 12 * (Math.log(freq / this.A4) / Math.log(2)) + 69;
    noteNum = Math.round(noteNum);
    let octave = Math.floor(noteNum / 12) - 1;
    let noteIndex = noteNum % 12;
    let noteName = this.NOTE_NAMES[noteIndex];
    let exactFreq = this.A4 * Math.pow(2, (noteNum - 69) / 12);
    return { name: noteName, octave, freq: exactFreq, index: noteIndex, noteNum };
  }

  centsOff(freq, target) {
    return 1200 * Math.log(freq / target) / Math.log(2);
  }

  findNearestString(freq) {
    let best = null, bestDiff = Infinity;
    for (const s of this.strings) {
      let diff = Math.abs(freq - s.freq);
      if (diff < bestDiff) { bestDiff = diff; best = s; }
    }
    return best;
  }

  isStringInTune(stringNum, freq) {
    const s = this.strings.find(s => s.num === stringNum);
    if (!s) return null;
    const cents = this.centsOff(freq, s.freq);
    return { cents, inTune: Math.abs(cents) < 5 };
  }
}

if (typeof window !== 'undefined') window.GuitarTuner = GuitarTuner;
