/* ── Nav highlight ── */
(function() {
  var path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.header-nav a').forEach(function(a) {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
})();

/* ── Page view tracking (localStorage) ── */
(function() {
  var KEY = 'ga_admin_visits';
  var visits;
  try { visits = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { visits = {}; }
  var page = window.location.pathname.split('/').pop() || 'index';
  visits[page] = (visits[page] || 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(visits)); } catch(e) {}
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
    var ok = results.filter(function(r) { return r.ok; }).length;
    var html = results.map(function(r) {
      var cls = r.ok ? 'ok' : 'fail';
      var label = r.ok ? 'Online' : 'Offline';
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
    } catch(e) {}
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
  } catch(e) {}
})();

/* ── Init ── */
if (document.getElementById('healthContainer')) {
  checkSiteHealth();
  renderDashboard();
}
