/* ── Nav highlight ── */
(function() {
  var path = window.location.pathname.split('/').pop() || 'index.html';
  var nav = document.querySelector('.header-nav');
  if (nav) nav.querySelectorAll('a').forEach(function(a) {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
})();

/* ── Page view tracking (localStorage) ── */
(function() {
  var KEY = 'ga_admin_visits';
  var visits;
  try { visits = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_e) { visits = {}; }
  var page = window.location.pathname.split('/').pop() || 'index';
  visits[page] = (visits[page] || 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(visits)); } catch (_e) {}
  window.__visits = visits;
})();

/* ── Site health checker ── */
var SITE_PAGES = [
  { path: '../index.html', name: 'Home' },
  { path: '../manifesto/index.html', name: 'Manifesto' },
  { path: '../newsletter/index.html', name: 'Newsletter' },
  { path: '../newsletter/advertise.html', name: 'Advertise' },
  { path: '../404.html', name: '404 Page' },
  { path: '../legal/privacy.html', name: 'Privacy' },
  { path: '../legal/terms.html', name: 'Terms' },
  { path: '../legal/donations.html', name: 'Donation Policy' },
  { path: '../legal/disclaimer.html', name: 'Disclaimer' },
  { path: 'roadmap.html', name: 'ToDo List' }
];

function checkSiteHealth() {
  var container = document.getElementById('healthContainer');
  if (!container) return;
  container.innerHTML = '<span style="color:#5A7A9F;font-size:13px">Checking pages...</span>';

  Promise.all(SITE_PAGES.map(function(p) {
    return fetch(p.path, { method: 'HEAD', cache: 'no-store' }).then(function(r) {
      return { name: p.name, path: p.path, ok: r.ok };
    }).catch(function() {
      return { name: p.name, path: p.path, ok: false };
    });
  })).then(function(results) {
    var html = results.map(function(r) {
      var cls = r.ok ? 'ok' : 'fail';
      return '<a href="' + r.path + '" target="_blank" class="health-badge ' + cls + '"><span>' + (r.ok ? '&#10003;' : '&#10007;') + '</span> ' + r.name + '</a>';
    }).join('');
    container.innerHTML = html;
  });
}

/* ── Dashboard render ── */
function renderDashboard() {
  // Visit counts
  var visits = window.__visits || {};
  var total = 0;
  var list = document.getElementById('visitList');
  if (list) {
    var html = '';
    var sorted = Object.keys(visits).sort(function(a,b) { return visits[b] - visits[a]; });
    sorted.forEach(function(page) {
      total += visits[page];
      html += '<div class="visit-row"><span class="visit-page">' + page + '</span><span class="visit-count">' + visits[page] + '</span></div>';
    });
    if (!sorted.length) html = '<div class="visit-row"><span class="visit-page" style="color:#3A5278">No visits tracked yet</span></div>';
    list.innerHTML = html;
  }

  // Total views stat
  var el = document.getElementById('totalViews');
  if (el) el.textContent = total || '0';

  // Visit bar chart (last 7 days)
  var barContainer = document.getElementById('barContainer');
  if (barContainer) {
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    var dayCounts = {};
    try {
      var dayData = JSON.parse(localStorage.getItem('ga_admin_days')) || {};
      dayCounts = dayData;
    } catch (_e) {}
    var max = 1;
    days.forEach(function(d) { if ((dayCounts[d] || 0) > max) max = dayCounts[d] || 1; });
    var bars = days.map(function(d) {
      var c = dayCounts[d] || 0;
      var h = Math.max(2, Math.round((c / max) * 70));
      var label = new Date(d).toLocaleDateString('en', { weekday: 'short' }).slice(0,2);
      return '<div class="bar-item"><div class="bar-fill" style="height:' + h + 'px"></div><div class="bar-label">' + label + '</div></div>';
    }).join('');
    barContainer.innerHTML = bars;
  }

  // Page count
  var elPages = document.getElementById('pageCount');
  if (elPages) elPages.textContent = SITE_PAGES.length;
}

/* ── Daily visit counter ── */
(function trackDay() {
  try {
    var dayData = JSON.parse(localStorage.getItem('ga_admin_days')) || {};
    var today = new Date().toLocaleDateString('en-CA');
    dayData[today] = (dayData[today] || 0) + 1;
    localStorage.setItem('ga_admin_days', JSON.stringify(dayData));
  } catch (_e) {}
})();

/* ── Escape HTML (XSS prevention) ── */
/* eslint-disable-next-line no-unused-vars */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/* ── Cloudflare Access detection ── */
function isCloudflareAccess() {
  return document.cookie.indexOf('CF_Authorization=') !== -1;
}

function getAccessUserEmail() {
  // Cf-Access-Authenticated-User-Email meta tag set by middleware
  var m = document.querySelector('meta[name="cf-access-user"]');
  return m ? m.getAttribute('content') : '';
}

/* ── Admin API helpers ── */
function getAdminKey() {
  if (isCloudflareAccess()) return '__CF_ACCESS__';
  try { return sessionStorage.getItem('ga_admin_key') || ''; } catch (_e) { return ''; }
}

function storeAdminKey(key) {
  try { if (key) sessionStorage.setItem('ga_admin_key', key); } catch (_e) {}
}

/* eslint-disable-next-line no-unused-vars */
function adminFetch(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  var key = getAdminKey();
  if (key && key !== '__CF_ACCESS__') opts.headers['X-Admin-Key'] = key;
  return fetch(url, opts);
}

/* ── Show modal to set admin key instead of prompt() ── */
/* eslint-disable-next-line no-unused-vars */
function ensureAdminKey() {
  if (isCloudflareAccess()) return '__CF_ACCESS__';
  var key = getAdminKey();
  if (!key) {
    var m = Modal.create('adminKeyModal');
    m.render(
      '<div class="modal-title" id="adminKeyModal-title">Admin API Key Required</div>' +
      '<div class="modal-body" style="margin-bottom:16px">' +
        '<label class="form-label">Enter your Admin API Key</label>' +
        '<input class="input" id="adminKeyInput" type="password" placeholder="Paste your key..." style="margin-top:4px" />' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline" onclick="Modal.close(\'adminKeyModal\')">Cancel</button>' +
        '<button class="btn btn-gold" id="adminKeySubmit">Set Key</button>' +
      '</div>'
    );
    m.open();
    setTimeout(function() {
      var input = document.getElementById('adminKeyInput');
      var btn = document.getElementById('adminKeySubmit');
      if (input) input.focus();
      if (btn) btn.addEventListener('click', function() {
        var val = input ? input.value.trim() : '';
        if (val) { storeAdminKey(val); Modal.close('adminKeyModal'); }
      });
    }, 100);
  }
  return key;
}

/* ── Admin header ── */
function renderAdminHeader() {
  var el = document.querySelector('.page-title');
  if (!el || !isCloudflareAccess()) return;
  var email = getAccessUserEmail();
  var badge = document.createElement('span');
  badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:12px;padding:3px 10px;border-radius:12px;background:rgba(201,168,76,.12);color:#C9A84C;font-size:11px;font-weight:600;font-family:DM Sans,sans-serif;vertical-align:middle';
  badge.innerHTML = '<span style="font-size:14px">&#128274;</span> ' + (email ? email : 'Cloudflare Access');
  el.appendChild(badge);
}

/* ── Logout ── */
/* eslint-disable-next-line no-unused-vars */
function adminLogout() {
  try {
    sessionStorage.removeItem('ga_admin_key');
    localStorage.removeItem('ga_ak');
  } catch (_e) {}
  window.location.href = '../functions/admin/api/logout';
}

/* ── Init ── */
if (document.getElementById('healthContainer')) {
  checkSiteHealth();
  renderDashboard();
}
document.addEventListener('DOMContentLoaded', function() {
  renderAdminHeader();
});
