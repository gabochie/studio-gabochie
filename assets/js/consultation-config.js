/*
 * Consultation pricing + Selar checkout links.
 *
 * HOW TO CONFIGURE (one time)
 * 1. On Selar's free Starter plan, create 3 products:
 *      Anchor Session      — GH₵1,500
 *      Coaching Sprint     — GH₵5,000
 *      Advisory Retainer   — GH₵10,000 / month
 * 2. Paste each product's Quick Checkout URL into `selar` below, e.g.
 *      https://selar.com/<your-product>?quickcheckout=1
 * 3. A blank link keeps its "Pay on Selar" button hidden; the request-a-slot
 *    form remains the fallback until the link is live.
 *
 * Prices here update every [data-price-key] element on /consultation/ and
 * /consultation/overview/ automatically.
 */
(function () {
  var CONFIG = {
    prices: {
      anchor:   { ghs: 'GH₵1,500',  usd: '≈ $90',  note: 'one session' },
      sprint:   { ghs: 'GH₵5,000',  usd: '≈ $300', note: 'four sessions' },
      retainer: { ghs: 'GH₵10,000', usd: '≈ $600', note: 'per month' }
    },
    selar: {
      anchor:   '', // paste Anchor Session quick-checkout URL
      sprint:   '', // paste Coaching Sprint quick-checkout URL
      retainer: ''  // paste Advisory Retainer quick-checkout URL
    }
  };

  window.CONSULTATION_CONFIG = CONFIG;

  function applyPrices() {
    document.querySelectorAll('[data-price-key]').forEach(function (el) {
      var price = CONFIG.prices[el.getAttribute('data-price-key')];
      if (!price) return;
      var field = el.getAttribute('data-price-field') || 'ghs';
      if (price[field]) el.textContent = price[field];
    });
  }

  function applySelarLinks() {
    document.querySelectorAll('[data-selar]').forEach(function (el) {
      var key = el.getAttribute('data-selar');
      var url = (CONFIG.selar[key] || '').trim();
      if (!url || /REPLACE|PASTE|example\.com/i.test(url)) {
        el.style.display = 'none';
        return;
      }
      var price = CONFIG.prices[key];
      el.href = url;
      el.textContent = (el.getAttribute('data-selar-label') || 'Pay on Selar') + (price ? ' — ' + price.ghs : '');
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
      el.style.display = '';
    });
  }

  function init() {
    applyPrices();
    applySelarLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
