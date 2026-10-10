/* Love Of The Lord — autonomous service player (MVP, PWA-friendly, no framework). */
(function () {
  'use strict';
  var LS_PROGRESS = 'lotl_progress_v1';
  var LS_AMEN = 'lotl_amen_v1';
  var LS_MAX = 'lotl_max_v1';
  var LS_WHO = 'lotl_who_v1';
  var LS_DONE = 'lotl_finished_v1';
  var WA_NUMBER = '233243262019';
  var CONTACT_ENDPOINT = '/api/contact';

  var stops = [];
  var idx = 0;
  var mode = 'full';

  function $(id) { return document.getElementById(id); }

  function loadLineup() {
    fetch('lineup.json', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        stops = (data && data.stops) || [];
        restore();
        render();
      })
      .catch(function () {
        stops = fallbackStops();
        render();
      });
  }

  function fallbackStops() {
    return [
      { id: 'welcome', title: 'Welcome & Opening Prayer', desc: 'You are home.', minutes: 3 },
      { id: 'praise', title: 'Praise — High Energy', desc: 'Stand up, clap.', minutes: 12 },
      { id: 'worship', title: 'Worship — Slow & Intimate', desc: 'He is here.', minutes: 8 },
      { id: 'announcements', title: 'Announcements', desc: 'New here? Friday answers.', minutes: 3 },
      { id: 'offering', title: 'Offering', desc: 'Separate LOTL fund.', minutes: 3 },
      { id: 'word', title: 'The Word', desc: 'Grace for New Beginnings.', minutes: 25 },
      { id: 'altar', title: 'Altar Call', desc: 'I Gave My Life Today.', minutes: 5 },
      { id: 'prayer', title: 'Prayer + Q&A + Family', desc: 'Book prayer. Ask. Join circle.', minutes: 5 },
      { id: 'benediction', title: 'Benediction & Share', desc: 'Blessing + invite.', minutes: 2 }
    ];
  }

  function visibleStops() {
    if (mode === 'express') {
      var keep = { welcome: 1, praise: 1, word: 1, altar: 1 };
      return stops.filter(function (s) { return keep[s.id]; });
    }
    return stops;
  }

  function restore() {
    try {
      var raw = localStorage.getItem(LS_PROGRESS);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p && typeof p.idx === 'number' && p.idx < stops.length) idx = p.idx;
      if (p && p.mode) mode = p.mode;
      var resume = $('resumeBar');
      if (resume && p && p.idx > 0) {
        resume.hidden = false;
        resume.querySelector('span').textContent = 'Welcome back — continue from ' + (stops[p.idx] ? stops[p.idx].title : 'where you stopped') + '?';
      }
    } catch (_e) {}
  }

  function save() {
    try { localStorage.setItem(LS_PROGRESS, JSON.stringify({ idx: idx, mode: mode })); } catch (_e) {}
    try {
      var prev = parseInt(localStorage.getItem(LS_MAX) || '-1', 10);
      if (idx > prev) localStorage.setItem(LS_MAX, String(idx));
    } catch (_e2) {}
  }

  function maxReached() {
    try { return parseInt(localStorage.getItem(LS_MAX) || '-1', 10); } catch (_e) { return -1; }
  }

  function render() {
    var list = visibleStops();
    if (!list.length) return;
    if (idx >= list.length) idx = 0;
    var order = $('order');
    if (order) {
      order.innerHTML = '';
      var reached = maxReached();
      list.forEach(function (s, i) {
        var done = i < idx || (i <= reached && i !== idx);
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'stop' + (i === idx ? ' on' : '') + (done ? ' done' : '');
        d.setAttribute('data-stop', s.id);
        if (i === idx) d.setAttribute('aria-current', 'step');
        var status = i === idx ? 'Now' : (done ? 'Done ✓' : (i === idx + 1 ? 'Up next' : 'Stop ' + (i + 1)));
        var num = done && i !== idx ? '✓' : String(i + 1);
        d.innerHTML = '<span class="n">' + num + '</span><span class="t"><b>' + escapeHtml(s.title) + '</b><small>' + escapeHtml(s.desc || '') + '</small></span><span class="time">' + (s.minutes || '') + (s.minutes ? ' min' : '') + '<span class="st">' + status + '</span></span>';
        d.addEventListener('click', function () { idx = i; save(); render(); });
        order.appendChild(d);
      });
    }
    var pills = $('steps');
    if (pills) {
      pills.innerHTML = '';
      list.forEach(function (s, i) {
        var p = document.createElement('button');
        p.type = 'button';
        p.className = 'pill' + (i === idx ? ' on' : '');
        if (i === idx) p.setAttribute('aria-current', 'true');
        p.textContent = (i + 1) + ' · ' + (s.short || s.title.split(' ')[0]);
        p.addEventListener('click', function () { idx = i; save(); render(); });
        pills.appendChild(p);
      });
    }
    var bar = $('bar');
    if (bar) bar.style.width = Math.round(((idx + 1) / list.length) * 100) + '%';
    var now = $('nowPlaying');
    if (now) now.textContent = list[idx].title + ' — ' + (list[idx].desc || '');
    var modeLabel = $('modeLabel');
    if (modeLabel) modeLabel.textContent = mode === 'express' ? 'EXPRESS · 15 MIN' : 'FULL SERVICE · 60 MIN';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.lotlPlay = function () {
    var list = visibleStops();
    var btn = $('playBtn');
    if (idx < list.length - 1) {
      idx += 1;
      save(); render();
      if (btn) btn.textContent = '⏸';
    } else {
      try { localStorage.setItem(LS_DONE, new Date().toISOString()); } catch (_e) {}
      var done = $('doneDim');
      if (done) done.classList.add('open');
      if (btn) btn.textContent = '▶';
    }
    return false;
  };

  window.lotlRestart = function () {
    idx = 0; save(); render();
    var done = $('doneDim');
    if (done) done.classList.remove('open');
    var s = $('start'); if (s && s.scrollIntoView) s.scrollIntoView({ behavior: 'smooth' });
    return false;
  };

  window.lotlMode = function (m) {
    mode = m; idx = 0; save(); render();
    var dd = $('doneDim'); if (dd) dd.classList.remove('open');
    var s = $('start'); if (s && s.scrollIntoView) s.scrollIntoView({ behavior: 'smooth' });
    return false;
  };

  window.lotlResume = function () { var r = $('resumeBar'); if (r) r.hidden = true; render(); return false; };

  window.lotlAmen = function () {
    var n = 318;
    try { n = parseInt(localStorage.getItem(LS_AMEN) || '318', 10) || 318; } catch (_e) {}
    n += 1;
    try { localStorage.setItem(LS_AMEN, String(n)); } catch (_e) {}
    var c = $('amenCount'); if (c) c.textContent = String(n);
    return false;
  };

  window.lotlWorship = function () { var d = $('dim'); if (d) d.classList.add('open'); return false; };
  window.lotlAudio = function () {
    var note = $('audioNote'); if (note) note.hidden = !note.hidden;
    return false;
  };

  function wireForm(formId, okId, source) {
    var f = $(formId);
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f);
      fd.append('source', source);
      fetch(CONTACT_ENDPOINT, { method: 'POST', body: fd })
        .then(function () { showOk(okId, f); })
        .catch(function () { showOk(okId, f); });
    });
  }

  function showOk(okId, f) {
    var ok = $(okId);
    if (ok) ok.hidden = false;
    try { rememberWho(f); } catch (_e2) {}
    try {
      var wa = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent('Hello Love Of The Lord, I just had church online. My name is ' + (f.querySelector('[name=name]') || {}).value || '');
      var link = document.querySelector('#' + okId + ' a');
      if (link) link.href = wa;
    } catch (_e) {}
    f.reset();
    prefillForms();
  }

  function rememberWho(f) {
    var who = {};
    try { who = JSON.parse(localStorage.getItem(LS_WHO) || '{}'); } catch (_e) {}
    ['name', 'phone', 'email'].forEach(function (k) {
      var el = f.querySelector('[name=' + k + ']');
      if (el && el.value) who[k] = el.value;
    });
    try { localStorage.setItem(LS_WHO, JSON.stringify(who)); } catch (_e2) {}
  }

  function prefillForms() {
    var who = {};
    try { who = JSON.parse(localStorage.getItem(LS_WHO) || '{}'); } catch (_e) {}
    var auto = { name: 'name', phone: 'tel', email: 'email' };
    Object.keys(auto).forEach(function (k) {
      document.querySelectorAll('form [name=' + k + ']').forEach(function (el) {
        el.setAttribute('autocomplete', auto[k]);
        if (who[k] && !el.value) el.value = who[k];
      });
    });
  }

  /* Cookie banner: main.js shows it instantly and it covers mobile CTAs.
     Hold it until first scroll (or 10s), unless already dismissed. */
  function softenCookies() {
    var revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      var bar = document.getElementById('cookieNotice');
      if (bar) bar.style.display = '';
    }
    function hold(bar) {
      bar.style.display = 'none';
      window.addEventListener('scroll', reveal, { once: true, passive: true });
      setTimeout(reveal, 10000);
    }
    var existing = document.getElementById('cookieNotice');
    if (existing) { hold(existing); return; }
    if (typeof MutationObserver === 'undefined') return;
    var obs = new MutationObserver(function () {
      var bar = document.getElementById('cookieNotice');
      if (bar) { hold(bar); obs.disconnect(); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 15000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadLineup();
    softenCookies();
    try {
      var n = localStorage.getItem(LS_AMEN);
      if (n && $('amenCount')) $('amenCount').textContent = n;
    } catch (_e) {}
    wireForm('newForm', 'newOk', 'lotl-new');
    wireForm('prayerForm', 'prayerOk', 'lotl-consult');
    wireForm('askForm', 'askOk', 'lotl-question');
    wireForm('familyForm', 'familyOk', 'lotl-community');
    wireForm('storyForm', 'storyOk', 'lotl-testimony');
    prefillForms();
  });
})();
