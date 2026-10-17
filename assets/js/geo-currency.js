/* Geo-dynamic currency default — Love Of The Lord surface.
 *
 * The edge (functions/_middleware.js) annotates <html> with
 * data-geo-country / data-geo-currency from the visitor's IP country.
 * This runs before main.js and seeds the existing currency engine
 * (localStorage "ga_currency") ONLY when the visitor has not already
 * picked a currency, so an explicit choice always wins.
 *
 * In local dev the edge attributes are absent, so we fall back to the
 * browser timezone. Exposes window.GA_GEO for page-level geo logic
 * (e.g. rail ordering on the Give page).
 */
(function () {
  'use strict';

  var KEY = 'ga_currency';
  var VALID = ['GHS', 'USD', 'GBP', 'EUR'];

  function storedCurrency() {
    try { return localStorage.getItem(KEY); } catch (_e) { return null; }
  }

  function saveCurrency(v) {
    try { localStorage.setItem(KEY, v); } catch (_e) {}
  }

  function currencyFromTimezone() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz === 'Africa/Accra' || tz === 'Africa/Abidjan' || tz === 'Africa/Lome') return 'GHS';
      if (tz === 'Europe/London') return 'GBP';
      if (/^Europe\//.test(tz)) return 'EUR';
    } catch (_e) {}
    return 'USD';
  }

  var root = document.documentElement;
  var country = (root && root.getAttribute('data-geo-country')) || '';
  var currency = (root && root.getAttribute('data-geo-currency')) || '';
  if (VALID.indexOf(currency) < 0) currency = currencyFromTimezone();

  window.GA_GEO = {
    country: country,
    currency: currency,
    isGhana: country === 'GH',
    isLocal: country === '' || country === 'GH'
  };

  if (!storedCurrency() && VALID.indexOf(currency) >= 0) saveCurrency(currency);
})();
