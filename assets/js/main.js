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

/* ── formatPrice fallback guard ── */
if (typeof window.formatPrice !== 'function') {
  window.formatPrice = function(amount, currency) {
    return (currency || 'GH¢ ') + (Number(amount) || 0).toFixed(2);
  };
}

/* ── Store Modal (replaces prompt() dialogs) ── */
function showStoreModal(callback) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99998;background:rgba(10,22,40,.85);display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:#0F1E38;border:1px solid #1E3250;border-radius:12px;padding:32px;width:100%;max-width:400px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.5)';
  modal.innerHTML =
    '<button id="storeModalClose" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#5A7A9F;font-size:20px;cursor:pointer;padding:4px">&times;</button>' +
    '<h3 style="font-family:"Barlow Condensed",sans-serif;font-size:22px;font-weight:700;color:#F1F5F9;margin:0 0 4px">Complete Your Purchase</h3>' +
    '<p style="color:#5A7A9F;font-size:13px;margin:0 0 20px">Enter your details to continue.</p>' +
    '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Full Name</label>' +
    '<input id="storeModalName" type="text" placeholder="Your full name" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:16px;box-sizing:border-box">' +
    '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Email</label>' +
    '<input id="storeModalEmail" type="email" placeholder="your@email.com" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:20px;box-sizing:border-box">' +
    '<p id="storeModalError" style="color:#E8637A;font-size:12px;margin:0 0 12px;display:none"></p>' +
    '<button id="storeModalSubmit" style="width:100%;padding:12px;background:#C9A84C;color:#0A1628;border:none;border-radius:6px;font-family:"Barlow Condensed",sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer">Continue to Payment</button>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.getElementById('storeModalName').focus();
  function close() { overlay.remove(); }
  document.getElementById('storeModalClose').addEventListener('click', close);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  document.getElementById('storeModalSubmit').addEventListener('click', function() {
    var n = document.getElementById('storeModalName').value.trim();
    var e = document.getElementById('storeModalEmail').value.trim();
    var errEl = document.getElementById('storeModalError');
    if (!n) { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; document.getElementById('storeModalName').focus(); return; }
    if (!e || !e.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; document.getElementById('storeModalEmail').focus(); return; }
    errEl.style.display = 'none';
    callback({ name: n, email: e });
    close();
  });
  document.getElementById('storeModalName').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') document.getElementById('storeModalEmail').focus(); });
  document.getElementById('storeModalEmail').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') document.getElementById('storeModalSubmit').click(); });
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
