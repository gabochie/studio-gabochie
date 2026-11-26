/* 2027 Year Package — dashboard/landing behaviour.
   Access is always decided server-side; this file only renders the result. */
(function () {
  'use strict';
  var stateEl = document.getElementById('state');
  var msgEl = document.getElementById('msg');
  var library = document.getElementById('library');
  var reader = document.getElementById('reader');
  var weeksEl = document.getElementById('weeks');
  var resourcesEl = document.getElementById('resources');
  var readerBody = document.getElementById('readerBody');
  var readerTag = document.getElementById('readerTag');
  var libraryNote = document.getElementById('libraryNote');
  if (!stateEl) return;

  var token = '';
  try { token = localStorage.getItem('ga_session_token') || ''; } catch (e) {}
  var data = null;
  var access = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}, opts.headers || {});
    return fetch(path, opts).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function say(text) { if (msgEl) msgEl.textContent = text || ''; }

  function renderState() {
    if (!access) return;
    var a = access.access;
    if (a === 'full') {
      stateEl.innerHTML = '<strong>Full access is active.</strong> All 52 weeks and 14 resources are open. ' +
        'Tier: ' + esc(access.tier || 'premium') + '.';
    } else if (a === 'trial') {
      stateEl.innerHTML = '<strong>14-day trial is active.</strong> Weeks 1–2 are open. ' +
        esc(access.days_left) + ' day(s) remaining. Upgrade any time for the full year.';
    } else {
      stateEl.innerHTML = '<strong>Access locked.</strong> ' +
        'Free members receive Weeks 1–2 free for 14 days. Scholar, Patron and Founding members have the full year.';
    }
    var btn = document.getElementById('accessBtn');
    if (btn) btn.remove();
    btn = document.createElement('button');
    btn.id = 'accessBtn';
    btn.className = a === 'full' ? 'btn hidden' : 'btn';
    if (a === 'trial') {
      btn.textContent = 'Upgrade for full access';
      btn.onclick = function () { location.href = '/membership/'; };
    } else {
      btn.textContent = 'Start 14-day free trial';
      btn.onclick = startTrial;
    }
    stateEl.appendChild(btn);
  }

  function startTrial() {
    say('Starting your trial…');
    api('/api/year-package/trial', { method: 'POST', body: '{}' }).then(function (d) {
      if (d.status !== 'ok') { say(d.message || 'Could not start the trial.'); return; }
      access = d.access || null;
      say('Your trial has started. Weeks 1–2 are now open.');
      return refresh();
    }).catch(function () { say('Network error. Please try again.'); });
  }

  function allowedWeeks() {
    if (!access) return [];
    if (access.access === 'full') return data.weeks;
    if (access.access === 'trial') return data.weeks.filter(function (w) {
      return access.trial_weeks.indexOf(w.n) !== -1;
    });
    return [];
  }

  function showLibrary() {
    if (reader) reader.classList.add('hidden');
    if (library) library.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function openWeek(n) {
    var w = data.weeks.find(function (x) { return x.n === n; });
    if (!w) return;
    readerTag.textContent = 'Week ' + w.n + ' · ' + w.month;
    readerBody.innerHTML = w.html;
    library.classList.add('hidden');
    reader.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function openResource(slug) {
    var r = data.resources.find(function (x) { return x.slug === slug; });
    if (!r) return;
    readerTag.textContent = 'Resource · ' + r.title;
    readerBody.innerHTML = r.html;
    library.classList.add('hidden');
    reader.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function renderLibrary() {
    var open = allowedWeeks();
    if (!open.length) { libraryNote.textContent = 'Your access is locked. Start the trial or upgrade to open the weeks.'; }
    else if (access.access === 'trial') { libraryNote.textContent = 'Weeks 1–2 are open during the 14-day trial.'; }
    else { libraryNote.textContent = 'All 52 weeks are open.'; }
    weeksEl.innerHTML = data.weeks.map(function (w) {
      var unlocked = open.some(function (x) { return x.n === w.n; });
      return '<a class="week' + (unlocked ? '' : ' locked') + '" href="#" ' +
        (unlocked ? 'onclick="yearPackage.openWeek(' + w.n + ');return false"' : '') + '>' +
        '<strong>W' + w.n + '</strong><br>' + esc(w.title) + '</a>';
    }).join('');
    resourcesEl.innerHTML = (access.access === 'full' ? data.resources : []).map(function (r) {
      return '<a class="week" href="#" onclick="yearPackage.openResource(\'' +
        esc(r.slug) + '\');return false">' + esc(r.title) + '</a>';
    }).join('') || '<p class="lead">Resources unlock with full membership.</p>';
  }

  function refresh() {
    return Promise.all([
      api('/api/year-package/access'),
      api('/api/year-package/content')
    ]).then(function (res) {
      access = res[0].status === 'ok' ? res[0] : { access: 'locked', trial_weeks: [] };
      data = res[1];
      renderState();
      if (access.access !== 'locked') { renderLibrary(); showLibrary(); }
      else if (library) library.classList.add('hidden');
    }).catch(function () { say('Could not load the resource. Please try again.'); });
  }

  window.yearPackage = { openWeek: openWeek, openResource: openResource, refresh: refresh };
  refresh();
})();
