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
