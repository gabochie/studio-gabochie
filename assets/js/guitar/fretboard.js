/* Gideon Guitar Method — Interactive Fretboard Renderer */

class FretboardRenderer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.frets = options.frets || 12;
    this.strings = 6;
    this.startFret = options.startFret || 1;
    this.onNoteClick = options.onNoteClick || null;

    this.NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    this.OPEN_NOTES = { 6: 'E', 5: 'A', 4: 'D', 3: 'G', 2: 'B', 1: 'e' };

    this.highlightedNotes = [];
    this.rootNote = null;
    this.colors = {
      bg: '#1E1E1E',
      string: 'rgba(255,255,255,0.12)',
      fret: 'rgba(255,255,255,0.08)',
      note: '#C89B3C',
      noteText: '#0A0A0A',
      root: '#C89B3C',
      rootText: '#0A0A0A',
      muted: '#3D3D3D',
      text: '#7A7670'
    };

    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.resize();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width - 24;
    this.canvas.height = 180;
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const pad = { left: 30, right: 20, top: 20, bottom: 20 };
    const fretW = (w - pad.left - pad.right) / this.frets;
    const stringGap = (h - pad.top - pad.bottom) / (this.strings - 1);

    // Background
    ctx.fillStyle = this.colors.bg;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(w - 12, 0);
    ctx.quadraticCurveTo(w, 0, w, 12);
    ctx.lineTo(w, h - 12);
    ctx.quadraticCurveTo(w, h, w - 12, h);
    ctx.lineTo(12, h);
    ctx.quadraticCurveTo(0, h, 0, h - 12);
    ctx.lineTo(0, 12);
    ctx.quadraticCurveTo(0, 0, 12, 0);
    ctx.closePath();
    ctx.fill();

    // Draw frets
    for (let f = 0; f <= this.frets; f++) {
      const x = pad.left + f * fretW;
      ctx.strokeStyle = f === 0 ? '#C89B3C' : this.colors.fret;
      ctx.lineWidth = f === 0 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, h - pad.bottom);
      ctx.stroke();
    }

    // Draw strings
    for (let s = 0; s < this.strings; s++) {
      const y = pad.top + s * stringGap;
      ctx.strokeStyle = this.colors.string;
      ctx.lineWidth = 1 + (5 - s) * 0.3;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // String labels
    for (let s = 0; s < this.strings; s++) {
      const y = pad.top + s * stringGap;
      ctx.fillStyle = this.colors.text;
      ctx.font = '10px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.OPEN_NOTES[s + 1], 14, y);
    }

    // Fret markers
    const markers = [3, 5, 7, 9, 12];
    for (const f of markers) {
      if (f > this.frets) break;
      const x = pad.left + (f - 0.5) * fretW;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      if (f === 12) {
        ctx.beginPath();
        ctx.arc(x, pad.top + stringGap * 1.5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, pad.top + stringGap * 3.5, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, pad.top + stringGap * 2.5, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw highlighted notes
    for (const n of this.highlightedNotes) {
      const x = pad.left + (n.fret - 0.5) * fretW;
      const y = pad.top + (6 - n.string) * stringGap;
      const radius = Math.min(10, stringGap / 2.5, fretW / 2.5);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);

      if (n.isRoot) {
        ctx.fillStyle = this.colors.root;
      } else if (n.type === 'correct') {
        ctx.fillStyle = '#1A8A55';
      } else if (n.type === 'wrong') {
        ctx.fillStyle = '#CF202F';
      } else if (n.type === 'target') {
        ctx.fillStyle = '#E84050';
      } else {
        ctx.fillStyle = this.colors.note;
      }
      ctx.fill();

      if (n.label) {
        ctx.fillStyle = n.isRoot || n.type === 'root' ? this.colors.rootText : '#FAFAF7';
        ctx.font = 'bold 8px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.label, x, y + 0.5);
      }
    }
  }

  highlightNote(string, fret, options = {}) {
    this.highlightedNotes.push({ string, fret, ...options });
    this.draw();
  }

  highlightNotes(notes) {
    this.highlightedNotes = notes;
    this.draw();
  }

  clear() {
    this.highlightedNotes = [];
    this.draw();
  }

  showChord(chordShapes) {
    this.highlightedNotes = [];
    for (const shape of chordShapes) {
      this.highlightedNotes.push({
        string: shape.string,
        fret: shape.fret,
        label: shape.finger || '',
        isRoot: shape.isRoot || false
      });
    }
    this.draw();
  }

  noteAtPosition(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = x - rect.left;
    const my = y - rect.top;
    const pad = { left: 30, top: 20, bottom: 20 };
    const w = this.canvas.width;
    const h = this.canvas.height;
    const fretW = (w - pad.left - pad.right) / this.frets;
    const stringGap = (h - pad.top - pad.bottom) / (this.strings - 1);

    const fret = Math.round((mx - pad.left) / fretW) + 1;
    const string = Math.round(6 - ((my - pad.top) / stringGap));

    if (fret < 1 || fret > this.frets || string < 1 || string > 6) return null;
    return { string, fret };
  }

  handleClick(e) {
    const pos = this.noteAtPosition(e.clientX, e.clientY);
    if (pos && this.onNoteClick) this.onNoteClick(pos);
  }

  getNoteAt(string, fret) {
    const openNote = this.OPEN_NOTES[string];
    const openIndex = this.NOTE_NAMES.indexOf(openNote);
    const noteIndex = (openIndex + fret) % 12;
    return this.NOTE_NAMES[noteIndex];
  }
}

if (typeof window !== 'undefined') window.FretboardRenderer = FretboardRenderer;
