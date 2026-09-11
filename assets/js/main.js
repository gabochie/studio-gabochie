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
/* eslint-disable-next-line no-unused-vars */
function toggleFaq(btn) {
  btn.parentElement.classList.toggle('open');
}

/* ── Mobile Nav Toggle ── */
/* eslint-disable-next-line no-unused-vars */
function toggleNav(_el) {
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
    try { return localStorage.getItem(CURRENCY_STORAGE_KEY) || DEFAULT_CURRENCY; } catch (_e) { return DEFAULT_CURRENCY; }
  }

  function setCurrency(code) {
    try { localStorage.setItem(CURRENCY_STORAGE_KEY, code); } catch (_e) {}
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

/* eslint-disable-next-line no-unused-vars */
function tagOnboard(email, name, tag) {
  if (!email || !tag) return;
  try {
    navigator.sendBeacon('/api/onboard', JSON.stringify({ email: email, name: name || '', tag: tag }));
  } catch (_e) {}
}

/* ── formatPrice fallback guard ── */
if (typeof window.formatPrice !== 'function') {
  window.formatPrice = function(amount, currency) {
    return (currency || 'GH¢ ') + (Number(amount) || 0).toFixed(2);
  };
}

/* ── Auth Helpers ── */
var GA_SESSION_KEY = 'ga_session_token';

function getSessionToken() {
  try { return localStorage.getItem(GA_SESSION_KEY); } catch (_e) { return null; }
}

function setSessionToken(token) {
  try { localStorage.setItem(GA_SESSION_KEY, token); } catch (_e) {}
}

function clearSession() {
  try { localStorage.removeItem(GA_SESSION_KEY); } catch (_e) {}
}

function checkSession(callback) {
  var token = getSessionToken();
  if (!token) { callback(null); return; }
  fetch('/api/auth/session?token=' + encodeURIComponent(token))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status === 'ok' && d.user) { callback(d.user); }
      else { clearSession(); callback(null); }
    })
    .catch(function() { callback(null); });
}

/* ── Session-aware Nav ── */
function initNavAuth() {
  var container = document.getElementById('navAuth');
  if (!container) return;
  checkSession(function(user) {
    if (user) {
      container.innerHTML =
        '<a href="/dashboard/" class="nav-auth-link">Dashboard</a>' +
        '<a href="#" class="nav-auth-link nav-auth-logout" onclick="logoutUser(event)">Log Out</a>';
    } else {
      container.innerHTML =
        '<a href="/login/" class="nav-auth-link">Log In</a>' +
        '<a href="/register/" class="nav-auth-btn">Sign Up</a>';
    }
  });
}

/* eslint-disable-next-line no-unused-vars */
function logoutUser(e) {
  if (e) e.preventDefault();
  var token = getSessionToken();
  if (token) {
    navigator.sendBeacon('/api/auth/logout', JSON.stringify({ token: token }));
  }
  clearSession();
  document.cookie = 'ga_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.gabochie.com';
  window.location.href = '/';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavAuth);
} else {
  initNavAuth();
}

/* ── Store Modal (auth-aware) ── */
var GHANA_REGIONS = ['Greater Accra','Ashanti','Western','Eastern','Central','Volta','Northern','Upper East','Upper West','Bono','Bono East','Ahafo','Savannah','North East','Oti','Western North'];
var __storeConfig = null;

function fetchStoreConfig() {
  if (__storeConfig) return Promise.resolve(__storeConfig);
  return fetch('/api/store/config').then(function(r){return r.json()}).then(function(d){
    __storeConfig = { local: d.delivery_fee_local || 20, upcountry: d.delivery_fee_upcountry || 50, freeThreshold: d.delivery_free_threshold || 0 };
    return __storeConfig;
  }).catch(function(){ __storeConfig = { local: 20, upcountry: 50, freeThreshold: 0 }; return __storeConfig; });
}

/* eslint-disable-next-line no-unused-vars */
function showStoreModal(callback) {
  checkSession(function(user) {
    if (user) {
      showCheckoutStep(user, callback);
    } else {
      showAuthChoice(callback);
    }
  });
}

function showAuthChoice(callback) {
  var overlay = buildOverlay();
  var modal = buildModal();
  modal.innerHTML =
    '<button id="storeModalClose" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#5A7A9F;font-size:20px;cursor:pointer;padding:4px">&times;</button>' +
    '<h3 style="font-family:"Barlow Condensed",sans-serif;font-size:22px;font-weight:700;color:#F1F5F9;margin:0 0 4px">Complete Your Purchase</h3>' +
    '<p style="color:#5A7A9F;font-size:13px;margin:0 0 20px">Create an account for faster checkout, or continue as guest.</p>' +
    '<button id="gaAuthSignup" style="width:100%;padding:12px;background:#C9A84C;color:#0A1628;border:none;border-radius:6px;font-family:"Barlow Condensed",sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;margin-bottom:10px">Sign Up / Log In</button>' +
    '<button id="gaAuthGuest" style="width:100%;padding:10px;background:transparent;color:#94A3B8;border:1px solid #1E3250;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:13px;cursor:pointer">Continue as Guest</button>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  var closeFn = function() { overlay.remove(); };
  document.getElementById('storeModalClose').addEventListener('click', closeFn);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFn(); });
  document.getElementById('gaAuthSignup').addEventListener('click', function() { overlay.remove(); showEmailStep(callback); });
  document.getElementById('gaAuthGuest').addEventListener('click', function() { overlay.remove(); showGuestForm(callback); });
}

function showEmailStep(callback) {
  var overlay = buildOverlay();
  var modal = buildModal();
  modal.innerHTML =
    '<button id="storeModalBack" style="position:absolute;top:12px;left:16px;background:none;border:none;color:#5A7A9F;font-size:16px;cursor:pointer;padding:4px">&larr;</button>' +
    '<button id="storeModalClose" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#5A7A9F;font-size:20px;cursor:pointer;padding:4px">&times;</button>' +
    '<h3 style="font-family:"Barlow Condensed",sans-serif;font-size:22px;font-weight:700;color:#F1F5F9;margin:0 0 4px">Sign Up / Log In</h3>' +
    '<p style="color:#5A7A9F;font-size:13px;margin:0 0 20px">Enter your email to receive a verification code.</p>' +
    '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Email</label>' +
    '<input id="gaEmailInput" type="email" placeholder="your@email.com" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:16px;box-sizing:border-box">' +
    '<p id="storeModalError" style="color:#E8637A;font-size:12px;margin:0 0 12px;display:none"></p>' +
    '<button id="gaSendOtp" style="width:100%;padding:12px;background:#C9A84C;color:#0A1628;border:none;border-radius:6px;font-family:"Barlow Condensed",sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer">Send Code</button>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.getElementById('gaEmailInput').focus();
  var closeFn = function() { overlay.remove(); };
  document.getElementById('storeModalClose').addEventListener('click', closeFn);
  document.getElementById('storeModalBack').addEventListener('click', function() { overlay.remove(); showAuthChoice(callback); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFn(); });
  document.getElementById('gaSendOtp').addEventListener('click', function() {
    var email = document.getElementById('gaEmailInput').value.trim();
    var errEl = document.getElementById('storeModalError');
    if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    document.getElementById('gaSendOtp').textContent = 'Sending...';
    document.getElementById('gaSendOtp').disabled = true;
    fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.status === 'ok') {
        overlay.remove();
        showOtpStep(email, d.is_new, callback);
      } else {
        errEl.textContent = d.message || 'Something went wrong. Please try again.';
        errEl.style.display = 'block';
        document.getElementById('gaSendOtp').textContent = 'Send Code';
        document.getElementById('gaSendOtp').disabled = false;
      }
    }).catch(function() {
      errEl.textContent = 'Network error. Please try again.';
      errEl.style.display = 'block';
      document.getElementById('gaSendOtp').textContent = 'Send Code';
      document.getElementById('gaSendOtp').disabled = false;
    });
  });
  document.getElementById('gaEmailInput').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') document.getElementById('gaSendOtp').click(); });
}

function showOtpStep(email, isNew, callback) {
  var overlay = buildOverlay();
  var modal = buildModal();
  modal.innerHTML =
    '<button id="storeModalBack" style="position:absolute;top:12px;left:16px;background:none;border:none;color:#5A7A9F;font-size:16px;cursor:pointer;padding:4px">&larr;</button>' +
    '<button id="storeModalClose" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#5A7A9F;font-size:20px;cursor:pointer;padding:4px">&times;</button>' +
    '<h3 style="font-family:"Barlow Condensed",sans-serif;font-size:22px;font-weight:700;color:#F1F5F9;margin:0 0 4px">Check Your Email</h3>' +
    '<p style="color:#5A7A9F;font-size:13px;margin:0 0 20px">We sent a 6-digit code to <strong style="color:#E8EEF7">' + email + '</strong>.</p>' +
    '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Verification Code</label>' +
    '<input id="gaOtpInput" type="text" placeholder="000000" maxlength="6" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:24px;font-family:monospace;outline:none;margin-bottom:16px;box-sizing:border-box;text-align:center;letter-spacing:6px">' +
    '<p id="storeModalError" style="color:#E8637A;font-size:12px;margin:0 0 12px;display:none"></p>' +
    '<button id="gaVerifyOtp" style="width:100%;padding:12px;background:#C9A84C;color:#0A1628;border:none;border-radius:6px;font-family:"Barlow Condensed",sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer">Verify Code</button>' +
    '<p style="color:#5A7A9F;font-size:11px;margin:12px 0 0;text-align:center">Code expires in 10 minutes. <a href="#" id="gaResendOtp" style="color:#C9A84C;text-decoration:underline">Resend code</a></p>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.getElementById('gaOtpInput').focus();
  var closeFn = function() { overlay.remove(); };
  document.getElementById('storeModalClose').addEventListener('click', closeFn);
  document.getElementById('storeModalBack').addEventListener('click', function() { overlay.remove(); showEmailStep(callback); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFn(); });
  function doVerify() {
    var code = document.getElementById('gaOtpInput').value.trim();
    var errEl = document.getElementById('storeModalError');
    if (!code || code.length < 6) { errEl.textContent = 'Please enter the full 6-digit code.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    document.getElementById('gaVerifyOtp').textContent = 'Verifying...';
    document.getElementById('gaVerifyOtp').disabled = true;
    fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, code: code })
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.status === 'ok' && d.session_token) {
        setSessionToken(d.session_token);
        overlay.remove();
        if (d.user.is_new) {
          showNewUserName(d.user, callback);
        } else {
          showCheckoutStep(d.user, callback);
        }
      } else {
        errEl.textContent = d.message || 'Invalid code. Please try again.';
        errEl.style.display = 'block';
        document.getElementById('gaVerifyOtp').textContent = 'Verify Code';
        document.getElementById('gaVerifyOtp').disabled = false;
      }
    }).catch(function() {
      errEl.textContent = 'Network error. Please try again.';
      errEl.style.display = 'block';
      document.getElementById('gaVerifyOtp').textContent = 'Verify Code';
      document.getElementById('gaVerifyOtp').disabled = false;
    });
  }
  document.getElementById('gaVerifyOtp').addEventListener('click', doVerify);
  document.getElementById('gaOtpInput').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') doVerify(); });
  document.getElementById('gaResendOtp').addEventListener('click', function(ev) {
    ev.preventDefault();
    var errEl = document.getElementById('storeModalError');
    errEl.style.display = 'none';
    fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function(r) { return r.json(); }).then(function(d) {
      if (d.status === 'ok') {
        errEl.textContent = 'New code sent!';
        errEl.style.color = '#34C77B';
        errEl.style.display = 'block';
        setTimeout(function() { errEl.style.display = 'none'; errEl.style.color = '#E8637A'; }, 3000);
      }
    }).catch(function() {});
  });
}

function showNewUserName(user, callback) {
  var overlay = buildOverlay();
  var modal = buildModal();
  modal.innerHTML =
    '<button id="storeModalClose" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#5A7A9F;font-size:20px;cursor:pointer;padding:4px">&times;</button>' +
    '<h3 style="font-family:"Barlow Condensed",sans-serif;font-size:22px;font-weight:700;color:#F1F5F9;margin:0 0 4px">Welcome!</h3>' +
    '<p style="color:#5A7A9F;font-size:13px;margin:0 0 20px">Tell us your name to complete your account.</p>' +
    '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Full Name</label>' +
    '<input id="gaNameInput" type="text" placeholder="Your full name" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:20px;box-sizing:border-box">' +
    '<p id="storeModalError" style="color:#E8637A;font-size:12px;margin:0 0 12px;display:none"></p>' +
    '<button id="gaNameSubmit" style="width:100%;padding:12px;background:#C9A84C;color:#0A1628;border:none;border-radius:6px;font-family:"Barlow Condensed",sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer">Continue to Payment</button>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.getElementById('gaNameInput').focus();
  var closeFn = function() { overlay.remove(); };
  document.getElementById('storeModalClose').addEventListener('click', closeFn);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFn(); });
  document.getElementById('gaNameSubmit').addEventListener('click', function() {
    var name = document.getElementById('gaNameInput').value.trim() || user.name || user.email.split('@')[0];
    user.name = name;
    showCheckoutStep(user, callback);
  });
  document.getElementById('gaNameInput').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') document.getElementById('gaNameSubmit').click(); });
}

function showCheckoutStep(user, callback) {
  fetchStoreConfig().then(function(cfg) {
    var overlay = buildOverlay();
    var modal = buildModal();
    var regionOpts = GHANA_REGIONS.map(function(r){ return '<option value="' + r + '">' + r + '</option>'; }).join('');
    modal.innerHTML =
      '<button id="storeModalClose" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#5A7A9F;font-size:20px;cursor:pointer;padding:4px">&times;</button>' +
      '<h3 style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:#F1F5F9;margin:0 0 4px">Delivery Details</h3>' +
      '<p style="color:#5A7A9F;font-size:13px;margin:0 0 16px">You are signed in as <strong style="color:#E8EEF7">' + (user.name || user.email) + '</strong>.</p>' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Full Name</label>' +
      '<input id="storeModalName" type="text" placeholder="Your full name" value="' + (user.name || '') + '" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Email</label>' +
      '<input id="storeModalEmail" type="email" value="' + user.email + '" readonly style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#5A7A9F;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box;opacity:0.7">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Phone Number</label>' +
      '<input id="storeModalPhone" type="tel" placeholder="0244 000 000" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">City / Town</label>' +
      '<input id="storeModalCity" type="text" placeholder="e.g. Accra, Kumasi" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Region</label>' +
      '<select id="storeModalRegion" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
        '<option value="">Select your region</option>' + regionOpts +
      '</select>' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Landmark or Digital Address</label>' +
      '<input id="storeModalAddr" type="text" placeholder="e.g. GhanaPostGPS code or landmark" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:16px;box-sizing:border-box">' +
      '<div id="storeDeliveryFee" style="font-size:13px;color:#94A3B8;margin-bottom:4px;display:none"></div>' +
      '<p id="storeModalError" style="color:#E8637A;font-size:12px;margin:0 0 12px;display:none"></p>' +
      '<button id="storeModalSubmit" style="width:100%;padding:12px;background:#C9A84C;color:#0A1628;border:none;border-radius:6px;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer">Continue to Payment</button>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.getElementById('storeModalName').focus();
    var closeFn = function() { overlay.remove(); };
    document.getElementById('storeModalClose').addEventListener('click', closeFn);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFn(); });
    function calcFee() {
      var region = document.getElementById('storeModalRegion').value;
      var feeEl = document.getElementById('storeDeliveryFee');
      if (!region) { feeEl.style.display = 'none'; return; }
      var fee = region === 'Greater Accra' ? cfg.local : cfg.upcountry;
      feeEl.textContent = 'Delivery fee: GH\u00a2 ' + fee + (region === 'Greater Accra' ? ' (Accra/Tema rate)' : ' (upcountry rate)');
      feeEl.style.display = 'block';
    }
    document.getElementById('storeModalRegion').addEventListener('change', calcFee);
    document.getElementById('storeModalSubmit').addEventListener('click', function() {
      var n = document.getElementById('storeModalName').value.trim() || user.name;
      var e = document.getElementById('storeModalEmail').value.trim();
      var p = document.getElementById('storeModalPhone').value.trim();
      var city = document.getElementById('storeModalCity').value.trim();
      var region = document.getElementById('storeModalRegion').value;
      var addr = document.getElementById('storeModalAddr').value.trim();
      var errEl = document.getElementById('storeModalError');
      if (!n) { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; document.getElementById('storeModalName').focus(); return; }
      errEl.style.display = 'none';
      var fee = region === 'Greater Accra' ? cfg.local : (region ? cfg.upcountry : 0);
      callback({ name: n, email: e, phone: p, shipping_city: city, shipping_region: region, shipping_digital_address: addr, delivery_fee: fee, user_id: user.id, session_token: getSessionToken() });
      closeFn();
    });
    document.getElementById('storeModalName').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') document.getElementById('storeModalPhone').focus(); });
  });
}

function showGuestForm(callback) {
  fetchStoreConfig().then(function(cfg) {
    var overlay = buildOverlay();
    var modal = buildModal();
    var regionOpts = GHANA_REGIONS.map(function(r){ return '<option value="' + r + '">' + r + '</option>'; }).join('');
    modal.innerHTML =
      '<button id="storeModalClose" style="position:absolute;top:12px;right:16px;background:none;border:none;color:#5A7A9F;font-size:20px;cursor:pointer;padding:4px">&times;</button>' +
      '<h3 style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:#F1F5F9;margin:0 0 4px">Delivery Details</h3>' +
      '<p style="color:#5A7A9F;font-size:13px;margin:0 0 20px">Enter your details to continue.</p>' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Full Name</label>' +
      '<input id="storeModalName" type="text" placeholder="Your full name" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Email</label>' +
      '<input id="storeModalEmail" type="email" placeholder="your@email.com" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Phone Number</label>' +
      '<input id="storeModalPhone" type="tel" placeholder="0244 000 000" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">City / Town</label>' +
      '<input id="storeModalCity" type="text" placeholder="e.g. Accra, Kumasi" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Region</label>' +
      '<select id="storeModalRegion" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;box-sizing:border-box">' +
        '<option value="">Select your region</option>' + regionOpts +
      '</select>' +
      '<label style="display:block;font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Landmark or Digital Address</label>' +
      '<input id="storeModalAddr" type="text" placeholder="e.g. GhanaPostGPS code or landmark" style="width:100%;background:#0A1628;border:1px solid #1E3250;border-radius:6px;padding:10px 14px;color:#E8EEF7;font-size:14px;font-family:inherit;outline:none;margin-bottom:16px;box-sizing:border-box">' +
      '<div id="storeDeliveryFee" style="font-size:13px;color:#94A3B8;margin-bottom:4px;display:none"></div>' +
      '<p id="storeModalError" style="color:#E8637A;font-size:12px;margin:0 0 12px;display:none"></p>' +
      '<button id="storeModalSubmit" style="width:100%;padding:12px;background:#C9A84C;color:#0A1628;border:none;border-radius:6px;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;cursor:pointer">Continue to Payment</button>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.getElementById('storeModalName').focus();
    var closeFn = function() { overlay.remove(); };
    document.getElementById('storeModalClose').addEventListener('click', closeFn);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFn(); });
    function calcFee() {
      var region = document.getElementById('storeModalRegion').value;
      var feeEl = document.getElementById('storeDeliveryFee');
      if (!region) { feeEl.style.display = 'none'; return; }
      var fee = region === 'Greater Accra' ? cfg.local : cfg.upcountry;
      feeEl.textContent = 'Delivery fee: GH\u00a2 ' + fee + (region === 'Greater Accra' ? ' (Accra/Tema rate)' : ' (upcountry rate)');
      feeEl.style.display = 'block';
    }
    document.getElementById('storeModalRegion').addEventListener('change', calcFee);
    document.getElementById('storeModalSubmit').addEventListener('click', function() {
      var n = document.getElementById('storeModalName').value.trim();
      var e = document.getElementById('storeModalEmail').value.trim();
      var p = document.getElementById('storeModalPhone').value.trim();
      var city = document.getElementById('storeModalCity').value.trim();
      var region = document.getElementById('storeModalRegion').value;
      var addr = document.getElementById('storeModalAddr').value.trim();
      var errEl = document.getElementById('storeModalError');
      if (!n) { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; document.getElementById('storeModalName').focus(); return; }
      if (!e || !e.includes('@')) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; document.getElementById('storeModalEmail').focus(); return; }
      errEl.style.display = 'none';
      var fee = region === 'Greater Accra' ? cfg.local : (region ? cfg.upcountry : 0);
      callback({ name: n, email: e, phone: p, shipping_city: city, shipping_region: region, shipping_digital_address: addr, delivery_fee: fee, is_guest: true });
      closeFn();
    });
    document.getElementById('storeModalName').addEventListener('keydown', function(ev) { if (ev.key === 'Enter') document.getElementById('storeModalEmail').focus(); });
  });
}

function buildOverlay() {
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99998;background:rgba(10,22,40,.85);display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",sans-serif';
  return el;
}

function buildModal() {
  var el = document.createElement('div');
  el.style.cssText = 'background:#0F1E38;border:1px solid #1E3250;border-radius:12px;padding:32px;width:100%;max-width:400px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.5)';
  return el;
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
    try { localStorage.setItem('ga_cookie_notice_dismissed', '1'); } catch (_e) {}
  });
})();
