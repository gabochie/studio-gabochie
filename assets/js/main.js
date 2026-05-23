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
