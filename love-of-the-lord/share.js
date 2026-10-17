/* Love Of The Lord — share helper.
 *
 * Every church share should carry a canonical URL tagged with UTM params so the
 * existing /api/track capture (main.js) attributes the visit and lands the friend
 * on a page with lead forms. Prefers the native share sheet where available and
 * falls back to WhatsApp. Use declaratively:
 *
 *   <a href="<whatsapp fallback>" data-lotl-share
 *      data-share-path="/love-of-the-lord/devotionals/"
 *      data-share-text="..." data-share-content="2027-01-01"
 *      data-share-campaign="lotl-decrees">Share</a>
 *
 * The href fallback keeps working without JS; when JS is present the click is
 * upgraded to the native sheet (with a WhatsApp fallback on rejection).
 */
(function () {
  'use strict';

  var ORIGIN = 'https://studio.gabochie.com';

  function buildUrl(path, params) {
    params = params || {};
    var base = /^https?:\/\//.test(path) ? path : ORIGIN + (path || '/love-of-the-lord/');
    var q = [];
    q.push('utm_source=' + encodeURIComponent('lotl'));
    q.push('utm_medium=' + encodeURIComponent(params.medium || 'share'));
    q.push('utm_campaign=' + encodeURIComponent(params.campaign || 'lotl-share'));
    if (params.content) q.push('utm_content=' + encodeURIComponent(params.content));
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + q.join('&');
  }

  function whatsapp(text) {
    try {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    } catch (_e) {}
  }

  function track(params, method) {
    try {
      if (!navigator.sendBeacon) return;
      navigator.sendBeacon('/api/event', JSON.stringify({
        event_type: 'share',
        event_data: JSON.stringify({
          content: params.content || '',
          campaign: params.campaign || 'lotl-share',
          method: method
        }),
        page: location.pathname
      }));
    } catch (_e) {}
  }

  // Build a ready-to-use share URL (also used for static href fallbacks).
  window.lotlShareUrl = buildUrl;

  window.lotlShare = function (params) {
    params = params || {};
    var url = buildUrl(params.path, params);
    var text = (params.text || 'Have church with me anytime').trim();
    var full = text + '\n' + url;
    if (navigator.share) {
      try {
        navigator.share({ title: params.title || 'Love Of The Lord', text: text, url: url })
          .then(function () { track(params, 'native'); })
          .catch(function (e) {
            if (e && e.name === 'AbortError') return;
            whatsapp(full); track(params, 'whatsapp');
          });
        return;
      } catch (_e) {}
    }
    whatsapp(full); track(params, 'whatsapp');
  };

  // Event delegation so dynamically-rendered cards (e.g. daily decrees) work too.
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented) return;
    var el = ev.target;
    while (el && el.nodeType === 1 && el !== document) {
      if (el.hasAttribute && el.hasAttribute('data-lotl-share')) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || (ev.button && ev.button !== 0)) return;
        ev.preventDefault();
        window.lotlShare({
          path: el.getAttribute('data-share-path') || '/love-of-the-lord/',
          text: el.getAttribute('data-share-text') || 'Have church with me anytime',
          title: el.getAttribute('data-share-title') || 'Love Of The Lord',
          content: el.getAttribute('data-share-content') || '',
          medium: el.getAttribute('data-share-medium') || 'share',
          campaign: el.getAttribute('data-share-campaign') || 'lotl-share'
        });
        return;
      }
      el = el.parentNode;
    }
  }, true);
})();
