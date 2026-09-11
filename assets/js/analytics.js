(function () {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
  if (window.__gaTracked) return;
  window.__gaTracked = true;
  var page = window.location.pathname;
  try {
    var ref = document.referrer || '';
    (navigator.sendBeacon || function (u, d) {
      var x = new XMLHttpRequest();
      x.open('POST', u, true);
      x.send(d);
    })('/api/track', JSON.stringify({ page: page, referrer: ref }));
  } catch (_e) { /* noop */ }
})();