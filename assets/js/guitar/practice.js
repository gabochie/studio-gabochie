/* Gideon Guitar Method — Practice Session Manager */

class PracticeSession {
  constructor(options = {}) {
    this.blocks = options.blocks || [
      { id: 'warmup', label: 'Warm-up', duration: 3, done: false },
      { id: 'drills', label: 'Technical Drill', duration: 5, done: false },
      { id: 'song', label: 'Song Practice', duration: 7, done: false },
      { id: 'freeplay', label: 'Free Play', duration: 5, done: false }
    ];
    this.currentBlock = -1;
    this.running = false;
    this.paused = false;
    this.timeLeft = 0;
    this.totalDuration = this.blocks.reduce((a, b) => a + b.duration, 0);
    this.elapsed = 0;
    this.onBlockStart = null;
    this.onBlockEnd = null;
    this.onTick = null;
    this.onComplete = null;
    this.timerId = null;
    this.blockStartTime = 0;
    this.sessionStartTime = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.currentBlock = 0;
    this.elapsed = 0;
    this.sessionStartTime = Date.now();
    this.startBlock();
  }

  startBlock() {
    if (this.currentBlock >= this.blocks.length) {
      this.complete();
      return;
    }
    const block = this.blocks[this.currentBlock];
    block.done = false;
    this.timeLeft = block.duration * 60;
    this.blockStartTime = Date.now();
    if (this.onBlockStart) this.onBlockStart(block, this.currentBlock);
    this.tick();
  }

  tick() {
    if (!this.running || this.paused) return;

    const blockElapsed = Math.floor((Date.now() - this.blockStartTime) / 1000);
    this.timeLeft = Math.max(0, (this.blocks[this.currentBlock].duration * 60) - blockElapsed);
    this.elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);

    if (this.onTick) this.onTick({
      timeLeft: this.timeLeft,
      elapsed: this.elapsed,
      block: this.blocks[this.currentBlock],
      blockIndex: this.currentBlock,
      totalProgress: this.elapsed / (this.totalDuration * 60)
    });

    if (this.timeLeft <= 0) {
      this.nextBlock();
      return;
    }

    this.timerId = requestAnimationFrame(() => this.tick());
  }

  nextBlock() {
    const block = this.blocks[this.currentBlock];
    block.done = true;
    if (this.onBlockEnd) this.onBlockEnd(block, this.currentBlock);

    this.currentBlock++;
    if (this.currentBlock >= this.blocks.length) {
      this.complete();
    } else {
      this.startBlock();
    }
  }

  complete() {
    this.running = false;
    if (this.timerId) cancelAnimationFrame(this.timerId);
    if (this.onComplete) this.onComplete({
      totalElapsed: this.elapsed,
      blocks: this.blocks.map(b => ({ id: b.id, label: b.label, duration: b.duration, done: b.done }))
    });
  }

  pause() {
    this.paused = true;
    if (this.timerId) cancelAnimationFrame(this.timerId);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.blockStartTime = Date.now() - ((this.blocks[this.currentBlock].duration * 60) - this.timeLeft) * 1000;
    this.tick();
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this.timerId) cancelAnimationFrame(this.timerId);
  }

  skipBlock() {
    this.nextBlock();
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getProgress() {
    return {
      block: this.currentBlock >= 0 && this.currentBlock < this.blocks.length ? this.blocks[this.currentBlock] : null,
      blockIndex: this.currentBlock,
      timeLeft: this.timeLeft,
      elapsed: this.elapsed,
      totalDuration: this.totalDuration * 60,
      paused: this.paused,
      running: this.running
    };
  }

  isLastBlock() {
    return this.currentBlock >= this.blocks.length - 1;
  }
}

if (typeof window !== 'undefined') window.PracticeSession = PracticeSession;
