/* Love Of The Lord — autonomous service player (MVP, PWA-friendly, no framework).
   Sprint A: series engine (series.json), media render layer (youtube/bridge/audio),
   real audio-only + low-data default, latest-answers strip. */
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
  var audioOnly = false;
  var series = null;
  var service = null;

  function $(id) { return document.getElementById(id); }

  function prefersLowData() {
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!c) return false;
      if (c.saveData) return true;
      return c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
    } catch (_e) { return false; }
  }

  function loadSeries() {
    fetch('series.json', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        series = data;
        service = currentService(data);
        populatePicker(data, service);
        loadLineup(service && service.lineup ? service.lineup : 'lineup.json');
      })
      .catch(function () { loadLineup('lineup.json'); });
  }

  function allServices(s) {
    var out = [];
    if (!s || !s.seasons) return out;
    s.seasons.forEach(function (season) {
      (season.services || []).forEach(function (svc) {
        out.push({ season: season, service: svc });
      });
    });
    return out;
  }

  function currentService(s) {
    var found = null;
    allServices(s).some(function (pair) {
      if (pair.service.id === s.current) { found = pair.service; return true; }
      return false;
    });
    if (found) return found;
    var first = allServices(s)[0];
    return first ? first.service : null;
  }

  function loadLineup(url) {
    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        applyService(data);
      })
      .catch(function () {
        stops = fallbackStops();
        render();
      });
  }

  function applyService(data) {
    stops = (data && data.stops) || [];
    if (data && data.service) service = data.service;
    updateServiceLabel(data && data.service);
    restore();
    render();
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

  /* ---------- series picker ---------- */
  function updateServiceLabel(svc) {
    var season = $('seasonLabel');
    if (!season) return;
    var seasonTitle = '';
    if (series) {
      var pair = allServices(series).filter(function (p) { return svc && p.service.id === svc.id; })[0];
      if (pair) seasonTitle = pair.season.title;
    }
    season.textContent = (seasonTitle ? seasonTitle + ' · ' : '') + (svc && svc.title ? svc.title : '');
  }

  function populatePicker(s, svc) {
    var sel = $('servicePicker');
    if (!sel || !s || !s.seasons) return;
    sel.innerHTML = '';
    s.seasons.forEach(function (season) {
      var group = document.createElement('optgroup');
      group.label = season.title;
      (season.services || []).forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = (item.n ? item.n + '. ' : '') + item.title + (item.date ? ' · ' + item.date : '');
        if (svc && item.id === svc.id) opt.selected = true;
        group.appendChild(opt);
      });
      sel.appendChild(group);
    });
    sel.onchange = function () { selectService(sel.value); };
  }

  function selectService(id) {
    if (!series) return;
    series.current = id;
    var svc = currentService(series);
    service = svc;
    idx = 0;
    try { localStorage.removeItem(LS_PROGRESS); localStorage.removeItem(LS_MAX); } catch (_e) {}
    var resume = $('resumeBar'); if (resume) resume.hidden = true;
    if (svc && svc.lineup) loadLineup(svc.lineup);
    else render();
  }
  window.lotlSelectService = selectService;

  /* ---------- media render layer ---------- */
  function youtubeId(src) {
    if (!src) return '';
    if (/^[\w-]{11}$/.test(src)) return src;
    var m = String(src).match(/[?&]v=([\w-]{11})/) || String(src).match(/youtu\.be\/([\w-]{11})/);
    return m ? m[1] : '';
  }

  function youtubeEmbed(m) {
    var url = '';
    var id = youtubeId(m.src);
    if (id) url = 'https://www.youtube.com/embed/' + id;
    else if (m.playlist) url = 'https://www.youtube.com/embed/videoseries?list=' + encodeURIComponent(m.playlist);
    if (!url) return null;
    var f = document.createElement('iframe');
    f.src = url;
    f.title = m.title || 'Love Of The Lord media';
    f.loading = 'lazy';
    f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    f.setAttribute('allowfullscreen', '');
    return f;
  }

  function videoNode(m) {
    if (!m || !m.src) return null;
    var v = document.createElement('video');
    v.src = m.src;
    v.controls = true;
    v.playsInline = true;
    v.setAttribute('preload', 'metadata');
    v.setAttribute('playsinline', '');
    if (m.poster) v.setAttribute('poster', m.poster);
    return v;
  }

  function audioNode(m, stop) {
    if (!m || !m.src) return null;
    var wrap = document.createElement('div');
    wrap.className = 'audio-stage';
    var cover = document.createElement('img');
    cover.src = '/love-of-the-lord/logo.webp';
    cover.alt = 'Love Of The Lord';
    cover.className = 'audio-cover';
    var title = document.createElement('div');
    title.className = 'audio-title';
    title.textContent = m.title || (stop && stop.title) || 'Love Of The Lord';
    var a = document.createElement('audio');
    a.controls = true;
    a.preload = 'metadata';
    a.src = m.src;
    wrap.appendChild(cover);
    wrap.appendChild(title);
    wrap.appendChild(a);
    return wrap;
  }

  function renderMedia(stop) {
    var stage = $('stage');
    if (!stage) return;
    var screen = stage.parentNode;
    stage.innerHTML = '';
    stage.className = 'stage';
    var m = stop && stop.media;
    var node = null;
    if (m) {
      var aud = (audioOnly && m.audio) ? m.audio : (m.type === 'audio' ? m : null);
      if (m.type === 'youtube' && !audioOnly) node = youtubeEmbed(m);
      else if (aud) node = audioNode(aud, stop);
      else if (m.type === 'bridge' && !audioOnly) node = videoNode(m);
    }
    if (node) {
      stage.appendChild(node);
      stage.hidden = false;
      if (screen) screen.classList.add('has-media');
    } else {
      stage.hidden = true;
      if (screen) screen.classList.remove('has-media');
    }
  }

  /* ---------- render ---------- */
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
    renderMedia(list[idx]);
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
    audioOnly = !audioOnly;
    var note = $('audioNote');
    if (note) {
      note.hidden = false;
      note.textContent = audioOnly
        ? 'Audio-only ON — video hidden, audio + lyrics continue. Good for low data.'
        : 'Audio-only off — video restored where available.';
    }
    renderMedia(visibleStops()[idx]);
    return false;
  };

  /* ---------- latest answers (home strip) ---------- */
  function renderLatestAnswers() {
    var box = $('latestAnswers');
    if (!box) return;
    fetch('answers/answers.json', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = (data && data.answers) || [];
        list = list.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 3);
        if (!list.length) return;
        box.innerHTML = '';
        list.forEach(function (a) {
          var d = document.createElement('a');
          d.className = 'ans-card';
          d.href = '/love-of-the-lord/answers/';
          var sc = (a.scriptures || []).slice(0, 2).join(' · ');
          d.innerHTML = '<span class="ans-tag">' + escapeHtml(a.category || 'Answer') + '</span>' +
            '<b>' + escapeHtml(a.question || '') + '</b>' +
            (sc ? '<small>' + escapeHtml(sc) + '</small>' : '');
          box.appendChild(d);
        });
      })
      .catch(function () {});
  }

  /* ---------- this week strip ---------- */
  function renderThisWeek() {
    var box = $('thisWeek');
    if (!box) return;
    Promise.all([
      fetch('series.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('answers/answers.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var s = res[0];
      var a = res[1];
      var svc = null;
      var seasonTitle = '';
      if (s) {
        var pairs = allServices(s);
        pairs.some(function (p) {
          if (p.service.id === s.current) { svc = p.service; seasonTitle = p.season.title; return true; }
          return false;
        });
        if (!svc && pairs.length) { svc = pairs[0].service; seasonTitle = pairs[0].season.title; }
      }
      var twSvc = $('twService');
      if (twSvc) {
        twSvc.textContent = svc
          ? (seasonTitle ? seasonTitle + ' · ' : '') + svc.title + (svc.date ? ' · ' + svc.date : '')
          : 'Foundations of Grace · Grace for New Beginnings';
      }
      var twAns = $('twAnswers');
      if (twAns && a && a.answers && a.answers.length) {
        var latest = a.answers.slice().sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); })[0];
        twAns.textContent = (latest.category ? latest.category + ' — ' : '') + (latest.question || '');
      }
      box.hidden = false;
    }).catch(function () {});
  }

  /* ---------- testimony rotation (weekly) ---------- */
  function weekIndex() {
    var now = new Date();
    var start = Date.UTC(now.getUTCFullYear(), 0, 1);
    return Math.floor((now.getTime() - start) / 604800000);
  }

  function renderTestimonies() {
    var wall = $('testimonyWall');
    if (!wall) return;
    fetch('testimonies.json', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var list = (data && data.testimonies) || [];
        if (list.length < 3) return;
        var off = Math.abs(weekIndex()) % list.length;
        var pick = [];
        for (var i = 0; i < 3; i += 1) pick.push(list[(off + i) % list.length]);
        wall.innerHTML = '';
        pick.forEach(function (t) {
          var d = document.createElement('div');
          d.className = 't';
          d.innerHTML = '<b>' + escapeHtml(t.name || 'Friend') + (t.city ? ', ' + escapeHtml(t.city) : '') + ' ★</b><br>"' + escapeHtml(t.text || '') + '"';
          wall.appendChild(d);
        });
      })
      .catch(function () {});
  }

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
    audioOnly = prefersLowData();
    loadSeries();
    renderThisWeek();
    renderLatestAnswers();
    renderTestimonies();
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
