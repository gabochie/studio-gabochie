/* Gideon Guitar Method — Pitch Detection Engine */

class PitchDetector {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.mic = null;
    this.stream = null;
    this.rafId = null;
    this.onPitch = null;
    this.bufferSize = 2048;
    this.sampleRate = 44100;
    this.NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    this.A4 = 440;
    this.running = false;
    this.minFreq = 60;
    this.maxFreq = 1500;
    this.autoCorrThreshold = 0.2;
    this.lastNote = null;
    this.lastFreq = 0;
    this.stableCount = 0;
  }

  async start(audioCtx) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      this.ctx = audioCtx || new AudioContext();
      this.sampleRate = this.ctx.sampleRate;
      this.mic = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = this.bufferSize;
      this.analyser.smoothingTimeConstant = 0.8;
      this.mic.connect(this.analyser);
      this.running = true;
      this.loop();
      return true;
    } catch (e) {
      console.error('PitchDetector start failed:', e);
      return false;
    }
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
    this.stream = null;
    this.mic = null;
    this.analyser = null;
  }

  loop() {
    if (!this.running) return;
    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    let rms = 0;
    for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / buffer.length);

    let freq = -1;
    let note = null;

    if (rms > 0.01) {
      freq = this.autocorrelate(buffer, this.sampleRate);
    }

    if (freq > this.minFreq && freq < this.maxFreq) {
      note = this.freqToNote(freq);
      let cents = this.centsOff(freq, note.freq);

      if (this.lastNote && note.name === this.lastNote.name) {
        if (Math.abs(cents) < 15) {
          this.stableCount = Math.min(this.stableCount + 1, 10);
          if (this.stableCount > 2) {
            if (this.onPitch) this.onPitch(note, cents, freq, rms);
          }
        }
      } else {
        this.stableCount = 0;
      }
      this.lastNote = note;
      this.lastFreq = freq;
    } else {
      this.lastNote = null;
      this.lastFreq = 0;
      this.stableCount = 0;
      if (this.onPitch && rms > 0.005) {
        this.onPitch(null, 0, 0, rms);
      }
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

    // Low-pass filter at ~1500Hz to reduce noise
    for (let offset = 2; offset < maxSamples; offset++) {
      let correlation = 0;
      for (let i = 0; i < maxSamples; i++) {
        correlation += buffer[i] * buffer[i + offset];
      }
      correlation /= (maxSamples - offset);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    if (bestCorrelation > this.autoCorrThreshold && bestOffset > 0) {
      // Parabolic interpolation for better accuracy
      let x0 = Math.max(0, bestOffset - 1);
      let x2 = Math.min(maxSamples - 1, bestOffset + 1);
      if (x0 !== bestOffset && x2 !== bestOffset) {
        let y0 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < maxSamples; i++) {
          y0 += buffer[i] * buffer[i + x0];
          y1 += buffer[i] * buffer[i + bestOffset];
          y2 += buffer[i] * buffer[i + x2];
        }
        let a = (y0 + y2 - 2 * y1) / 2;
        if (a !== 0) {
          let correction = (y0 - y2) / (4 * a);
          bestOffset += correction;
        }
      }
      return sampleRate / bestOffset;
    }
    return -1;
  }

  freqToNote(freq) {
    let noteNum = 12 * (Math.log(freq / this.A4) / Math.log(2)) + 69;
    noteNum = Math.round(noteNum);
    let octave = Math.floor(noteNum / 12) - 1;
    let noteIndex = ((noteNum % 12) + 12) % 12;
    let noteName = this.NOTE_NAMES[noteIndex];
    let exactFreq = this.A4 * Math.pow(2, (noteNum - 69) / 12);
    return { name: noteName, octave, freq: exactFreq, index: noteIndex, noteNum, fullName: noteName + octave };
  }

  centsOff(freq, target) {
    return 1200 * Math.log(freq / target) / Math.log(2);
  }

  freqToFullName(freq) {
    const note = this.freqToNote(freq);
    return note.fullName;
  }

  getVolume(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    return Math.sqrt(sum / buffer.length);
  }

  getWaveformData() {
    if (!this.analyser) return new Float32Array(128);
    const data = new Float32Array(128);
    this.analyser.getFloatTimeDomainData(data);
    return data;
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(128);
    const data = new Uint8Array(128);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  detectChord(frequencies, tolerance = 10) {
    if (!frequencies || frequencies.length < 2) return null;
    const sorted = [...frequencies].sort((a, b) => b.rms - a.rms);
    const notes = sorted.map(f => this.freqToNote(f.freq));

    // Check for common chord patterns
    const chordTemplates = {
      'maj': [0, 4, 7],
      'min': [0, 3, 7],
      '7': [0, 4, 7, 10],
      'm7': [0, 3, 7, 10],
      'maj7': [0, 4, 7, 11],
      'sus4': [0, 5, 7],
      'dim': [0, 3, 6],
      'aug': [0, 4, 8]
    };

    if (notes.length >= 3) {
      const root = notes[0].index;
      const intervals = notes.slice(1, 4).map(n => ((n.index - root) + 12) % 12);

      for (const [type, pattern] of Object.entries(chordTemplates)) {
        let matching = 0;
        for (const p of pattern.slice(1)) {
          if (intervals.some(i => Math.abs(i - p) <= 1)) matching++;
        }
        if (matching >= pattern.length - 1) {
          return { root: root, type, rootNote: notes[0].name, fullName: notes[0].name + type };
        }
      }
    }
    return null;
  }
}

if (typeof window !== 'undefined') window.PitchDetector = PitchDetector;
