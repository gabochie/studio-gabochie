/* Gideon Guitar Method — Main Engine */

const Guitar = {
  API_ROOT: '/api/guitar',
  user: null,
  token: null,

  async init() {
    this.token = localStorage.getItem('ga_token');
    if (this.token) {
      this.user = JSON.parse(localStorage.getItem('ga_student') || 'null');
    }
    return this.user;
  },

  isLoggedIn() { return !!this.token; },

  headers() {
    return this.token
      ? { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  },

  async fetch(path, opts = {}) {
    const res = await fetch(`${this.API_ROOT}${path}`, { ...opts, headers: { ...this.headers(), ...opts.headers } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  async getModules() { return this.fetch('/modules'); },
  async getModule(id) { return this.fetch(`/modules/${id}`); },
  async getProgress() { return this.fetch('/progress'); },
  async getSongs() { return this.fetch('/songs'); },
  async getSong(id) { return this.fetch(`/songs/${id}`); },
  async getAchievements() { return this.fetch('/achievements'); },
  async unlockAchievement(key) { return this.fetch('/achievements', { method: 'POST', body: JSON.stringify({ key }) }); },
  async getLeaderboard(period) { return this.fetch(`/leaderboard?period=${period || 'weekly'}`); },
  async getEnrollStatus() { return this.fetch('/enroll/status'); },
  async enroll() { return this.fetch('/enroll', { method: 'POST' }); },

  async completeLesson(lessonId) {
    return this.fetch('/progress', { method: 'POST', body: JSON.stringify({ lesson_id: lessonId, action: 'complete' }) });
  },

  async logPractice({ duration_min, drill_type, drill_config, score, xp_earned, notes }) {
    return this.fetch('/practice', {
      method: 'POST',
      body: JSON.stringify({ duration_min, drill_type, drill_config, score, xp_earned, notes })
    });
  },

  async saveOneMinute(chordPair, score) {
    return this.fetch('/practice/records', { method: 'POST', body: JSON.stringify({ chord_pair: chordPair, score }) });
  },

  async getRecords() { return this.fetch('/practice/records'); },
  async getSessions(days = 7) { return this.fetch(`/practice/sessions?days=${days}`); },

  showConfirm(msg) {
    return new Promise(resolve => {
      const m = document.createElement('div');
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:400;display:flex;align-items:center;justify-content:center';
      m.innerHTML = `<div style="background:var(--surface);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:24px;max-width:320px;width:90%;text-align:center">
        <p style="margin-bottom:16px;font-size:14px;color:var(--text2)">${msg}</p>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn-secondary" id="g-confirm-no">Cancel</button>
          <button class="btn-primary" id="g-confirm-yes">OK</button>
        </div>
      </div>`;
      document.body.appendChild(m);
      document.getElementById('g-confirm-yes').onclick = () => { m.remove(); resolve(true); };
      document.getElementById('g-confirm-no').onclick = () => { m.remove(); resolve(false); };
    });
  },

  showToast(msg, type = '') {
    const c = document.getElementById('guitar-toast') || (() => {
      const t = document.createElement('div');
      t.id = 'guitar-toast'; t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:500;display:flex;flex-direction:column;align-items:center;gap:8px';
      document.body.appendChild(t); return t;
    })();
    const t = document.createElement('div');
    t.className = `toast toast-${type || 'info'}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },

  showXP(xp) {
    const e = document.createElement('div');
    e.className = 'xp-popup';
    e.innerHTML = `<i class="ti ti-star"></i> +${xp} XP`;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 800);
  },

  showAchievement(icon, name) {
    const e = document.createElement('div');
    e.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:2px solid var(--gold);border-radius:20px;padding:24px 32px;text-align:center;z-index:600;animation:pop .4s ease;box-shadow:0 0 60px rgba(200,155,60,.2)';
    e.innerHTML = `<div style="font-size:48px;margin-bottom:8px">${icon}</div><div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:var(--gold)">${name} Unlocked!</div><div style="font-size:11px;color:var(--text3);margin-top:4px">+50 XP Bonus</div>`;
    document.body.appendChild(e);
    setTimeout(() => { e.style.opacity='0'; e.style.transition='opacity .5s'; setTimeout(() => e.remove(), 500); }, 2500);
  },

  loading(container) {
    container.innerHTML = '<div class="text-center" style="padding:40px"><div class="skeleton skeleton-title" style="margin:0 auto"></div><div class="skeleton skeleton-text" style="margin:12px auto 0;width:60%"></div></div>';
  },

  formatDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  },

  formatMin(m) {
    if (m < 60) return `${m} min`;
    return `${Math.floor(m/60)}h ${m%60}m`;
  },

  logout() {
    localStorage.removeItem('ga_token');
    localStorage.removeItem('ga_student');
    this.user = null; this.token = null;
    window.location.href = '/guitar/';
  }
};
