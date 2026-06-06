/* Gideon Guitar Method — Engine v2 */
/* SPA Navigation · Shared Components · State Management */

const Guitar = {
  /* ----- Config ----- */
  API_ROOT: '/api/guitar',
  user: null, token: null,

  /* ----- Auth ----- */
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
    if (opts.raw) return res;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  logout() {
    localStorage.removeItem('ga_token'); localStorage.removeItem('ga_student');
    this.user = null; this.token = null;
    window.location.href = '/guitar/';
  },

  /* ----- API Methods ----- */
  getModules()   { return this.fetch('/modules'); },
  getModule(id)  { return this.fetch(`/modules/${id}`); },
  getProgress()  { return this.fetch('/progress'); },
  getSongs()     { return this.fetch('/songs'); },
  getSong(id)    { return this.fetch(`/songs/${id}`); },
  getAchievements()       { return this.fetch('/achievements'); },
  unlockAchievement(key)  { return this.fetch('/achievements', { method:'POST', body: JSON.stringify({key}) }); },
  getLeaderboard(period)  { return this.fetch(`/leaderboard?period=${period||'weekly'}`); },
  getEnrollStatus()       { return this.fetch('/enroll/status'); },
  enroll()                { return this.fetch('/enroll', { method:'POST' }); },
  completeLesson(id)      { return this.fetch('/progress', { method:'POST', body: JSON.stringify({lesson_id:id, action:'complete'}) }); },
  logPractice(d)          { return this.fetch('/practice', { method:'POST', body: JSON.stringify(d) }); },
  saveOneMinute(pair,s)   { return this.fetch('/practice/records', { method:'POST', body: JSON.stringify({chord_pair:pair, score:s}) }); },
  getRecords()            { return this.fetch('/practice/records'); },
  getSessions(days)       { return this.fetch(`/practice/sessions?days=${days||7}`); },

  /* ----- Toast ----- */
  showToast(msg, type = 'info') {
    const c = document.getElementById('guitar-toast') || (() => {
      const t = document.createElement('div');
      t.id = 'guitar-toast'; t.className = 'toast-container';
      document.body.appendChild(t); return t;
    })();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2800);
  },

  /* ----- XP Popup ----- */
  showXP(xp) {
    const e = document.createElement('div');
    e.className = 'xp-popup';
    e.innerHTML = `<i class="ti ti-star"></i> +${xp} XP`;
    e.style.left = (40 + Math.random() * 40) + '%';
    e.style.top = '40%';
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 1000);
  },

  /* ----- Achievement Unlock ----- */
  showAchievement(icon, name) {
    const e = document.createElement('div');
    e.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;text-align:center;animation:scaleIn .5s var(--ease-spring)';
    e.innerHTML = `<div style="background:var(--surface);border:2px solid var(--gld);border-radius:24px;padding:32px 40px;box-shadow:0 0 60px rgba(200,155,60,.2)"><div style="font-size:56px;margin-bottom:12px">${icon}</div><div style="font-family:'Syne',sans-serif;font-weight:700;font-size:18px;color:var(--gld)">${name} Unlocked!</div><div style="font-size:12px;color:var(--text3);margin-top:6px">+50 XP Bonus</div></div>`;
    document.body.appendChild(e);
    setTimeout(() => { e.style.opacity='0'; e.style.transition='opacity .5s'; setTimeout(() => e.remove(),500); }, 2500);
  },

  /* ----- Bottom Sheet ----- */
  showSheet(html) {
    const existing = document.querySelector('.sheet-overlay');
    if (existing) existing.remove();
    const o = document.createElement('div');
    o.className = 'sheet-overlay';
    o.innerHTML = `<div class="sheet"><div class="sheet-handle"></div><div class="sheet-scroll">${html}</div></div>`;
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('open'));
    o.addEventListener('click', e => { if (e.target === o) this.hideSheet(); });
    return o;
  },

  hideSheet() {
    const o = document.querySelector('.sheet-overlay');
    if (o) { o.classList.remove('open'); setTimeout(() => o.remove(), 300); }
  },

  /* ----- Confirm Dialog ----- */
  async confirm(msg) {
    return new Promise(resolve => {
      const o = document.createElement('div');
      o.className = 'sheet-overlay';
      o.style.alignItems = 'center';
      o.innerHTML = `<div class="sheet" style="border-radius:24px;max-width:340px;margin:auto"><div style="padding:24px;text-align:center"><p style="margin-bottom:20px;font-size:14px;color:var(--text2)">${msg}</p><div style="display:flex;gap:8px;justify-content:center"><button class="btn btn-secondary" id="g-confirm-no">Cancel</button><button class="btn btn-primary" id="g-confirm-yes">OK</button></div></div></div>`;
      document.body.appendChild(o);
      requestAnimationFrame(() => o.classList.add('open'));
      document.getElementById('g-confirm-yes').onclick = () => { o.remove(); resolve(true); };
      document.getElementById('g-confirm-no').onclick = () => { o.remove(); resolve(false); };
    });
  },

  /* ----- Loading Skeleton ----- */
  loading(container) {
    container.innerHTML = `<div style="padding:20px">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text" style="width:80%"></div>
      <div style="margin-top:16px"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>
    </div>`;
  },

  /* ----- Nav Active Fixer ----- */
  fixNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item').forEach(a => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === path || (href !== '/guitar/' && path.startsWith(href)));
    });
  },

  /* ----- Utility ----- */
  formatDate(d) { return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); },
  formatMin(m) { return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`; },

  /* ----- Animate Count Up ----- */
  countUp(el, target, duration = 800) {
    const start = performance.now();
    const animate = now => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(eased * target);
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  },

  /* ----- CSS Helpers: inject dynamic styles ----- */
  injectStyles(css) {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    return s;
  }
};
