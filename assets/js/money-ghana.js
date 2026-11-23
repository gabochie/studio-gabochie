/* Studio Gabochie — interactive online-income assessment (/money-ghana/).
   Renders every section from window.MONEY_GHANA_DATA and handles the soft gate. */
(function () {
  'use strict';

  var D = window.MONEY_GHANA_DATA;
  if (!D) return;

  var state = { ranked: [], unlocked: false, category: 'all', query: '' };
  var $ = function (id) { return document.getElementById(id); };
  var catById = function (id) {
    return D.categories.filter(function (c) { return c.id === id; })[0] || D.categories[0];
  };

  function setMessage(el, text, kind) {
    el.textContent = text;
    el.className = 'form-msg ' + (kind || '');
    el.hidden = false;
  }

  function renderQuiz() {
    D.questions.forEach(function (q) {
      var host = $('q-' + q.id);
      if (!host) return;
      host.innerHTML = q.options.map(function (o, i) {
        return '<label class="option"><input type="radio" name="' + q.id + '" value="' + o.value + '"' +
          (i === 0 ? ' checked' : '') + '><span class="option-inner"><span class="option-title">' +
          o.label + '</span><span class="option-hint">' + o.hint + '</span></span></label>';
      }).join('');
    });
  }

  function renderChips() {
    var all = [{ id: 'all', name: 'All paths', icon: 'ti-layout-grid2' }].concat(D.categories);
    $('chips').innerHTML = all.map(function (c) {
      return '<button class="filter-chip' + (c.id === state.category ? ' active' : '') +
        '" type="button" data-cat="' + c.id + '" aria-pressed="' + (c.id === state.category) + '">' +
        '<i class="ti ' + c.icon + '"></i> ' + c.name + '</button>';
    }).join('');
  }

  function visibleMethods() {
    var q = state.query.toLowerCase();
    return D.methods.filter(function (m) {
      if (state.category !== 'all' && m.category !== state.category) return false;
      if (!q) return true;
      var haystack = [m.title, m.description, m.payout, catById(m.category).name].concat(m.tags).join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }

  function methodCard(m) {
    var c = catById(m.category);
    return '<article class="path-card"><div class="path-top"><span class="num">' +
      String(m.id < 10 ? '0' + m.id : m.id) + '</span><span class="pill ' + c.id + '">' +
      '<i class="ti ' + c.icon + '"></i> ' + c.name + '</span></div>' +
      '<h4>' + m.title + '</h4><p>' + m.description + '</p>' +
      '<div class="tags">' + m.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' +
      '<div class="payout"><i class="ti ti-credit-card"></i> ' + m.payout + '</div></article>';
  }

  function renderCards() {
    var list = visibleMethods();
    $('count').textContent = list.length + ' of ' + D.methods.length + ' paths shown';
    $('cards').innerHTML = list.length
      ? list.map(methodCard).join('')
      : '<div class="empty-result"><i class="ti ti-search"></i><h4>No paths found</h4>' +
        '<p>Try another keyword or choose All paths.</p></div>';
  }

  function rank(answers) {
    return D.methods.map(function (m) {
      var score = 0;
      var matched = [];
      if (m.profiles.indexOf(answers.profile) !== -1) {
        score += 3;
        matched.push(D.labels.profiles[answers.profile]);
      }
      if (m.setup.indexOf(answers.setup) !== -1) {
        score += 1;
        matched.push(D.labels.setup[answers.setup]);
      }
      if (m.capital.indexOf(answers.capital) !== -1) {
        score += 1;
        matched.push(D.labels.capital[answers.capital]);
      }
      return { method: m, score: score, matched: matched };
    }).sort(function (a, b) { return b.score - a.score || a.method.id - b.method.id; });
  }

  function matchCard(item, index) {
    var m = item.method;
    var c = catById(m.category);
    return '<article class="match-card"><div class="match-top"><span class="pill ' + c.id + '">' +
      '<i class="ti ' + c.icon + '"></i> ' + c.name + '</span><span class="rank">MATCH ' + (index + 1) + '</span></div>' +
      '<h4>' + m.title + '</h4><p>' + m.description + '</p>' +
      '<div class="why"><i class="ti ti-check"></i> Fits your ' + item.matched.join(' · ') + '</div>' +
      '<div class="payout"><i class="ti ti-credit-card"></i> ' + m.payout + '</div></article>';
  }

  function consultLink() {
    var top = state.ranked[0] && state.ranked[0].method;
    var params = new URLSearchParams();
    params.set('from', 'money-ghana');
    params.set('path', top ? top.title : '');
    params.set('profile', $('summary') ? $('summary').textContent : '');
    return '/consultation/?' + params.toString();
  }

  function setGateEnabled(enabled) {
    ['gateName', 'gateEmail', 'gatePhone', 'gateBtn'].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !enabled;
    });
    $('gatePanel').classList.toggle('muted', !enabled);
  }

  function renderResults() {
    if (!state.ranked.length) {
      $('resultPlaceholder').hidden = false;
      $('resultList').innerHTML = '';
      $('consultCta').hidden = true;
      setGateEnabled(false);
      return;
    }
    $('resultPlaceholder').hidden = true;
    setGateEnabled(true);

    var shown = state.unlocked ? state.ranked.slice(0, 3) : state.ranked.slice(0, 1);
    var heading = state.unlocked ? 'Your top 3 paths' : 'Your #1 starting path';
    $('resultList').innerHTML = '<div class="result-label">' + heading + '</div>' +
      shown.map(matchCard).join('');

    if (state.unlocked) {
      $('gatePanel').hidden = true;
      $('unlockedMsg').hidden = false;
      $('printBtn').hidden = false;
      $('consultCtaLink').href = consultLink();
      $('consultCta').hidden = false;
    } else {
      $('consultCta').hidden = true;
    }
  }

  function runAssessment(event) {
    event.preventDefault();
    var form = $('quizForm');
    var answers = {
      profile: form.elements.profile.value,
      setup: form.elements.setup.value,
      capital: form.elements.capital.value
    };
    state.ranked = rank(answers);
    state.unlocked = false;
    $('gatePanel').hidden = false;
    $('unlockedMsg').hidden = true;
    $('printBtn').hidden = true;
    $('gateMsg').hidden = true;
    renderResults();
    $('summary').textContent = D.labels.profiles[answers.profile] + ' · ' +
      D.labels.setup[answers.setup] + ' · ' + D.labels.capital[answers.capital];
    $('summaryRow').hidden = false;
    $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetAssessment() {
    state.ranked = [];
    state.unlocked = false;
    $('resultList').innerHTML = '';
    $('resultPlaceholder').hidden = false;
    $('gatePanel').hidden = false;
    $('unlockedMsg').hidden = true;
    $('printBtn').hidden = true;
    $('gateMsg').hidden = true;
    $('summaryRow').hidden = true;
    $('quizCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submitGate(event) {
    event.preventDefault();
    var name = $('gateName').value.trim();
    var email = $('gateEmail').value.trim();
    var phone = $('gatePhone').value.trim();
    var msg = $('gateMsg');
    var btn = $('gateBtn');

    if (email.indexOf('@') < 0 || email.indexOf('.') < 0) {
      setMessage(msg, 'Enter a valid email address.', 'error');
      return;
    }

    var params = new URLSearchParams(window.location.search);
    var tokenEl = $('gateForm').querySelector('input[name="cf-turnstile-response"]');
    var payload = {
      name: name,
      email: email,
      source: 'money-ghana-assessment',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      cf_turnstile_token: tokenEl ? tokenEl.value : ''
    };
    if (phone) {
      payload.phone = phone;
      payload.whatsapp_opt_in = true;
    }

    btn.disabled = true;
    btn.textContent = 'Unlocking your results...';

    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (result) {
      btn.disabled = false;
      btn.textContent = 'Unlock my full results';
      if (!result.ok || result.data.status !== 'ok') {
        setMessage(msg, result.data.message || 'Something went wrong. Please try again.', 'error');
        return;
      }
      state.unlocked = true;
      renderResults();
      $('unlockedMsg').innerHTML = '<i class="ti ti-circle-check"></i><div><strong>You are on the list.</strong><br>' +
        'Confirm your subscription in the email we just sent — the complete 24-path guide will follow. You can also print or save your results below.</div>';
      $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Unlock my full results';
      setMessage(msg, 'Network error. Please try again.', 'error');
    });
  }

  function renderGuards() {
    $('guards').innerHTML = D.guardrails.map(function (g) {
      return '<article class="guard"><i class="ti ' + g.icon + '"></i><h4>' + g.title + '</h4>' +
        '<p>' + g.body + '</p></article>';
    }).join('');
  }

  function renderSteps() {
    $('steps').innerHTML = D.nextSteps.map(function (s, i) {
      return '<div class="next-step"><span>' + (i + 1) + '</span><p>' + s + '</p></div>';
    }).join('');
  }

  function renderPrintGuide() {
    $('printGuide').innerHTML = '<h2>24 proven ways to make money online in Ghana</h2>' +
      '<p class="print-note">Legal, ethical and practical. Payouts: MoMo, local bank, Payoneer or Wise.</p>' +
      D.categories.map(function (c) {
        return '<h3>' + c.name + '</h3><ul>' + D.methods.filter(function (m) {
          return m.category === c.id;
        }).map(function (m) {
          return '<li><strong>' + m.title + '</strong> — ' + m.description + ' <em>(' + m.payout + ')</em></li>';
        }).join('') + '</ul>';
      }).join('') + '<h3>Guardrails</h3><ul>' + D.guardrails.map(function (g) {
        return '<li><strong>' + g.title + '</strong> — ' + g.body + '</li>';
      }).join('') + '</ul>';
  }

  function init() {
    renderQuiz();
    renderChips();
    renderCards();
    renderGuards();
    renderSteps();
    renderPrintGuide();
    setGateEnabled(false);

    $('quizForm').addEventListener('submit', runAssessment);
    $('gateForm').addEventListener('submit', submitGate);
    $('retakeBtn').addEventListener('click', resetAssessment);
    $('printBtn').addEventListener('click', function () { window.print(); });
    $('search').addEventListener('input', function (e) {
      state.query = e.target.value.trim();
      renderCards();
    });
    $('chips').addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-chip');
      if (!btn) return;
      state.category = btn.getAttribute('data-cat');
      renderChips();
      renderCards();
    });
  }

  init();
})();
