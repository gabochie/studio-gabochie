/*
 * Shared Selar hosted-checkout links for the public site.
 *
 * HOW TO CONFIGURE (one time, no keys or env vars needed)
 * 1. On Selar's free Starter plan, create your products and a Show Love /
 *    donation product.
 * 2. Paste the public links below. Quick Checkout links look like
 *      https://selar.com/<your-product>?quickcheckout=1
 * 3. Blank links hide their buttons automatically. Anything containing
 *    REPLACE / PASTE / example.com is treated as blank.
 * 4. `store` is a fallback for product links only — the donation link is
 *    never guessed, so supporters always land on the right product.
 *
 * Markup contract:
 *   [data-selar-link="key"]  -> anchor whose href is set from config
 *   [data-selar-show="key"]  -> block shown only when that key is configured
 *   [data-selar-prefill]     -> "inputId:param,inputId:param" appended on click
 */
(function () {
  var CONFIG = {
    store: '',        // e.g. https://selar.com/your-store
    donation: '',     // Show Love / donation product link
    products: {
      books: '',      // books catalogue or a specific book product
      bundle: '',     // Premium Books Bundle product
      courses: '',    // courses catalogue or a specific course product
      guitar: ''      // Guitar School registration product
    }
  };

  window.SELAR_CONFIG = CONFIG;

  function isBlank(url) {
    return !url || /REPLACE|PASTE|example\.com/i.test(url);
  }

  function resolve(key) {
    var cfg = window.SELAR_CONFIG || {};
    var url = cfg[key] || (cfg.products && cfg.products[key]) || '';
    if (isBlank(url) && key !== 'donation' && cfg.store) url = cfg.store;
    return isBlank(url) ? '' : String(url).trim();
  }

  function prefill(el, url) {
    var spec = el.getAttribute('data-selar-prefill');
    if (!spec || !url) return url;
    var pairs = [];
    spec.split(',').forEach(function (pair) {
      var bits = pair.split(':');
      var input = document.getElementById((bits[0] || '').trim());
      var name = (bits[1] || '').trim();
      if (!input || !name) return;
      var value = (input.value || '').trim();
      if (value) pairs.push({ name: name, value: value });
    });
    if (!pairs.length) return url;
    try {
      var u = new URL(url, window.location.href);
      pairs.forEach(function (pair) { u.searchParams.set(pair.name, pair.value); });
      return u.toString();
    } catch (_e) {
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + pairs.map(function (pair) {
        return encodeURIComponent(pair.name) + '=' + encodeURIComponent(pair.value);
      }).join('&');
    }
  }

  function init() {
    document.querySelectorAll('[data-selar-link]').forEach(function (el) {
      var key = el.getAttribute('data-selar-link');
      var url = resolve(key);
      if (!url) {
        el.style.display = 'none';
        return;
      }
      el.href = url;
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
      el.style.display = '';
      if (el.hasAttribute('data-selar-prefill')) {
        el.addEventListener('click', function () { this.href = prefill(this, url); });
      }
    });

    document.querySelectorAll('[data-selar-show]').forEach(function (el) {
      el.style.display = resolve(el.getAttribute('data-selar-show')) ? '' : 'none';
    });
  }

  window.SelarLinks = { resolve: resolve, prefill: prefill };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
