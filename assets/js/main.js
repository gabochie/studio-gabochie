/* ── Scroll Reveal ── */
(function() {
  var revels = document.querySelectorAll('.reveal-scroll');
  if (!revels.length) return;
  var rObs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) { e.target.classList.add('in'); rObs.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  revels.forEach(function(el) { rObs.observe(el); });
})();

/* ── FAQ Toggle ── */
function toggleFaq(btn) {
  btn.parentElement.classList.toggle('open');
}

/* ── Mobile Nav Toggle ── */
function toggleNav(el) {
  var nav = document.querySelector('.nav-links');
  var overlay = document.querySelector('.nav-mobile-overlay');
  var btn = document.querySelector('.nav-toggle');
  if (!nav) return;
  var opening = !nav.classList.contains('open');
  nav.classList.toggle('open');
  if (btn) btn.classList.toggle('active', opening);
  if (overlay) overlay.classList.toggle('open', opening);
  document.body.style.overflow = opening ? 'hidden' : '';
}

/* ── Page View Tracking ── */
(function(){
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
  var page = window.location.pathname;
  try {
    var ref = document.referrer || '';
    navigator.sendBeacon('/api/track', JSON.stringify({page:page, referrer:ref}));
  } catch(e) { console.log(e); }
})();

/* ── Currency Toggle ── */
(function(){
  var CURRENCY_STORAGE_KEY = 'ga_currency';
  var DEFAULT_CURRENCY = 'USD';
  var FALLBACK_RATES = { GHS: 15.2, USD: 1.09, EUR: 1.0, GBP: 0.86 };
  var CURRENCY_META = {
    USD: { symbol: '$', decimals: 2, label: 'USD $' },
    GHS: { symbol: 'GH₵', decimals: 0, label: 'GHS ₵' },
    GBP: { symbol: '£', decimals: 2, label: 'GBP £' },
    EUR: { symbol: '€', decimals: 2, label: 'EUR €' }
  };

  window.__currencyRates = null;

  function getCurrency() {
    try { return localStorage.getItem(CURRENCY_STORAGE_KEY) || DEFAULT_CURRENCY; } catch(e) { return DEFAULT_CURRENCY; }
  }

  function setCurrency(code) {
    try { localStorage.setItem(CURRENCY_STORAGE_KEY, code); } catch(e) {}
  }

  function getRate(code) {
    var r = window.__currencyRates || FALLBACK_RATES;
    return r[code] || 1;
  }

  window.formatPrice = function(ghsAmount, toCurrency) {
    if (ghsAmount === null || ghsAmount === undefined) return '';
    toCurrency = toCurrency || getCurrency();
    var meta = CURRENCY_META[toCurrency] || CURRENCY_META.USD;
    var rateGHS = getRate('GHS');
    var rateTarget = getRate(toCurrency);
    if (!rateGHS || !rateTarget) return meta.symbol + ' ' + Number(ghsAmount).toFixed(meta.decimals);
    var converted = (ghsAmount / rateGHS) * rateTarget;
    if (toCurrency === 'GHS') return meta.symbol + ' ' + Math.round(converted);
    return meta.symbol + ' ' + converted.toFixed(meta.decimals);
  };

  function renderPrices(currency) {
    var els = document.querySelectorAll('.price-convert');
    els.forEach(function(el) {
      var ghs = parseFloat(el.getAttribute('data-ghs'));
      if (isNaN(ghs)) return;
      el.textContent = window.formatPrice(ghs, currency);
    });
  }

  function showCurrencyToggle() {
    if (document.getElementById('currencyToggle')) return;
    var div = document.createElement('div');
    div.id = 'currencyToggle';
    div.className = 'currency-toggle';
    var select = document.createElement('select');
    select.className = 'currency-select';
    select.setAttribute('aria-label', 'Select currency');
    var current = getCurrency();
    Object.keys(CURRENCY_META).forEach(function(code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = CURRENCY_META[code].label;
      if (code === current) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', function() {
      var val = this.value;
      setCurrency(val);
      renderPrices(val);
    });
    div.appendChild(select);
    document.body.appendChild(div);
  }

  function initCurrency() {
    // Skip pages that have their own currency toggle (e.g. support page)
    if (document.querySelector('.currency-btn')) return;
    showCurrencyToggle();
    renderPrices(getCurrency());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCurrency);
  } else {
    initCurrency();
  }

  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    fetch('https://api.frankfurter.app/latest?from=EUR&to=GHS,USD,GBP').then(function(r){return r.json()}).then(function(d){
      if (d.rates) window.__currencyRates = d.rates;
      renderPrices(getCurrency());
    }).catch(function(){});
  }
})();

function tagOnboard(email, name, tag) {
  if (!email || !tag) return;
  try {
    navigator.sendBeacon('/api/onboard', JSON.stringify({ email: email, name: name || '', tag: tag }));
  } catch(e) {}
}

/* ── Cookie Notice ── */
(function(){
  if (localStorage.getItem('ga_cookie_notice_dismissed')) return;
  var bar = document.createElement('div');
  bar.id = 'cookieNotice';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#0F1E38;border-top:1px solid #1E3250;padding:12px 24px;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;font-size:12px;color:#8A9BB5;font-family:sans-serif';
  bar.innerHTML = '<span>This site does not set tracking cookies. Third-party services (payment, email) may set their own. <a href="/legal/privacy.html" style="color:#C9A84C;text-decoration:underline">Learn more</a>.</span><button id="cookieDismiss" style="background:#C9A84C;color:#0A1628;border:none;border-radius:4px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">Got it</button>';
  document.body.appendChild(bar);
  document.getElementById('cookieDismiss').addEventListener('click', function(){
    bar.remove();
    try { localStorage.setItem('ga_cookie_notice_dismissed', '1'); } catch(e) {}
  });
})();
