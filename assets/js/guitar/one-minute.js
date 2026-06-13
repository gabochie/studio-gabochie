/* Gideon Guitar Method — One-Minute Change Drill */

class OneMinuteDrill {
  constructor(options = {}) {
    this.pair = options.pair || { from: 'Em', to: 'Am' };
    this.duration = 60;
    this.score = 0;
    this.running = false;
    this.timeLeft = this.duration;
    this.onTick = null;
    this.onComplete = null;
    this.onScoreChange = null;
    this.timerId = null;
    this.history = [];
    this.startTime = 0;
  }

  start() {
    if (this.running) return;
    this.score = 0;
    this.timeLeft = this.duration;
    this.running = true;
    this.startTime = Date.now();
    if (this.onTick) this.onTick({ timeLeft: this.timeLeft, score: this.score });
    this.tick();
  }

  tick() {
    if (!this.running) return;
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.timeLeft = Math.max(0, this.duration - elapsed);

    if (this.timeLeft <= 0) {
      this.stop();
      return;
    }

    if (this.onTick) this.onTick({ timeLeft: Math.ceil(this.timeLeft), score: this.score });
    this.timerId = requestAnimationFrame(() => this.tick());
  }

  stop() {
    this.running = false;
    if (this.timerId) cancelAnimationFrame(this.timerId);
    if (this.onComplete) this.onComplete({ score: this.score, pair: this.pair });
  }

  countChange() {
    if (!this.running) return;
    this.score++;
    if (this.onScoreChange) this.onScoreChange(this.score);
  }

  setPair(pair) {
    this.pair = pair;
  }

  getScore() {
    return { score: this.score, pair: this.pair };
  }

  getProgress() {
    return { timeLeft: this.timeLeft, total: this.duration, score: this.score };
  }
}

/* One-Minute History Manager */
const OneMinuteHistory = {
  STORAGE_KEY: 'gm_om_history',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
    } catch { return {}; }
  },

  save(history) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  },

  addRecord(pair, score) {
    const history = this.load();
    const best = history[pair] ? Math.max(...history[pair].map(r => r.score)) : 0;
    const isNewPB = score >= best;
    const improvement = history[pair]?.length ? score - history[pair][0].score : 0;
    if (!history[pair]) history[pair] = [];
    history[pair].push({ score, date: new Date().toISOString(), timestamp: Date.now() });
    this.save(history);
    return { isNewPB, improvement };
  },

  getBest(pair) {
    const history = this.load();
    if (!history[pair] || !history[pair].length) return 0;
    return Math.max(...history[pair].map(r => r.score));
  },

  getAllPairs() {
    return Object.keys(this.load());
  },

  getHistory(pair) {
    const history = this.load();
    return history[pair] || [];
  },

  getRecentScores(pair, count = 5) {
    const history = this.getHistory(pair);
    return history.slice(-count);
  },

  getImprovement(pair) {
    const history = this.getHistory(pair);
    if (history.length < 2) return 0;
    return history[history.length - 1].score - history[0].score;
  },

  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

if (typeof window !== 'undefined') {
  window.OneMinuteDrill = OneMinuteDrill;
  window.OneMinuteHistory = OneMinuteHistory;
}
