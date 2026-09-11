(function() {
  var navHtml =
    '<nav>' +
    '<div class="container">' +
    '<a href="/" class="nav-brand"><img src="/assets/images/logo.png" alt="Studio Gabochie"> <span class="nav-brand-wrapper"><span class="nav-brand-title">Studio Gabochie</span><span class="nav-brand-tagline">School of Creativity, Love &amp; Wisdom</span></span></a>' +
    '<div class="nav-links">' +
    '<a href="/#story">About</a>' +
    '<a href="/services/">Services</a>' +
    '<a href="/school/">Courses</a>' +
    '<a href="/membership/">Membership</a>' +
    '<span id="navAuth" class="nav-auth"></span>' +
    '</div>' +
    '<button class="nav-toggle" onclick="toggleNav(this)" aria-label="Menu"><span></span><span></span><span></span></button>' +
    '</div>' +
    '</nav>' +
    '<div class="nav-mobile-overlay" onclick="toggleNav(document.querySelector(\'.nav-toggle\'))"></div>';

  var footerHtml =
    '<footer>' +
    '<div class="container">' +
    '<div>' +
    '<div class="brand-footer"><img src="/assets/images/logo.png" alt="Studio Gabochie"><span class="brand-footer-wrapper"><span class="brand-footer-title">Studio Gabochie</span><span class="brand-tagline">School of Creativity, Love &amp; Wisdom</span></span></div>' +
    '<p class="footer-about">A Bible-based ministry teaching a generation to create with excellence, love with devotion, and walk in the wisdom of God\'s Word. Rooted in Scripture, expressed through creativity, shared freely with the world.</p>' +
    '<div class="footer-social">' +
    '<a href="https://x.com/GideonAbochie" target="_blank" title="X / Twitter"><i class="ti ti-brand-x"></i></a>' +
    '<a href="https://web.facebook.com/GideonAbochie/" target="_blank" title="Facebook"><i class="ti ti-brand-facebook"></i></a>' +
    '<a href="https://www.instagram.com/gideonabochie/" target="_blank" title="Instagram"><i class="ti ti-brand-instagram"></i></a>' +
    '<a href="https://www.tiktok.com/@gideonabochie" target="_blank" title="TikTok"><i class="ti ti-brand-tiktok"></i></a>' +
    '<a href="https://www.youtube.com/@GideonAbochie" target="_blank" title="YouTube"><i class="ti ti-brand-youtube"></i></a>' +
    '<a href="https://www.linkedin.com/in/gideonabochie/" target="_blank" title="LinkedIn"><i class="ti ti-brand-linkedin"></i></a>' +
    '</div>' +
    '</div>' +
    '<div>' +
    '<h4>Content</h4>' +
    '<a href="/manifesto/">Read the Manifesto</a>' +
    '<a href="/school/">Courses</a>' +
    '<a href="/guitar/">Guitar</a>' +
    '<a href="/survey/">Survey</a>' +
    '<a href="https://news.gabochie.com/">The Studio Weekly</a>' +
    '<a href="/support/">Sponsor the Newsletter</a>' +
    '<a href="/partners/">Partners</a>' +
    '<a href="/services/">Services</a>' +
    '<a href="/nationbuilding/">Nationbuilding</a>' +
    '<a href="/merch/">Merchandise</a>' +
    '<a href="/tutoring/">Tutoring Marketplace</a>' +
    '<a href="/careers/">Careers</a>' +
    '</div>' +
    '<div>' +
    '<h4>Support</h4>' +
    '<a href="/register/">Create Account</a>' +
    '<a href="/login/">Log In</a>' +
    '<a href="/donate/">One-Time Donation</a>' +
    '<a href="/support/">Recurring Support</a>' +
    '<a href="/membership/">Membership</a>' +
    '<a href="/books/">Buy Books</a>' +
    '<a href="/store/library">Digital Library</a>' +
    '</div>' +
    '<div>' +
    '<h4>Media</h4>' +
    '<a href="/press/">Press</a>' +
    '<a href="/art/">Art</a>' +
    '<a href="/music/">Music</a>' +
    '<a href="/content/">Content</a>' +
    '</div>' +
    '<div>' +
    '<h4>Contact</h4>' +
    '<a href="/contact/">Contact Us</a>' +
    '<a href="mailto:studio@gabochie.com">studio@gabochie.com</a>' +
    '<a href="tel:+233243262019">+233 243 262 019</a>' +
    '<h4 style="margin-top:16px">Legal</h4>' +
    '<a href="/legal/privacy.html">Privacy Policy</a>' +
    '<a href="/legal/terms.html">Terms of Use</a>' +
    '<a href="/legal/donations.html">Donation Policy</a>' +
    '<a href="/legal/refund.html">Refund Policy</a>' +
    '<a href="/legal/disclaimer.html">Disclaimer</a>' +
    '</div>' +
    '<div class="footer-sponsors">' +
    '<span class="footer-sponsors-label">Sponsors &amp; Affiliations</span>' +
    '<div class="footer-sponsors-logos">' +
    '<a href="https://www.tiktok.com/@neoghglobal" target="_blank" rel="noopener" class="footer-sponsor-item"><img src="/assets/images/neogh-logo.png" alt="NEOGH - Spirit of Nation Building"><span>NEOGH<small>Spirit of Nation Building</small></span></a>' +
    '<div class="footer-sponsor-item placeholder"><div class="placeholder-icon">+</div><span>Your Brand<small>Sponsor this spot</small></span></div>' +
    '<div class="footer-sponsor-item placeholder"><div class="placeholder-icon">+</div><span>Your Brand<small>Sponsor this spot</small></span></div>' +
    '</div>' +
    '</div>' +
    '<div class="footer-bottom">&copy; ' + new Date().getFullYear() + ' Studio Gabochie &mdash; School of Creativity, Love &amp; Wisdom. Rooted in Scripture, shared in love.</div>' +
    '</div>' +
    '</footer>';

  var phNav = document.getElementById('nav-placeholder');
  if (phNav) {
    phNav.outerHTML = navHtml;
  }

  var phFooter = document.getElementById('footer-placeholder');
  if (phFooter) {
    phFooter.outerHTML = footerHtml;
  }

  window.toggleNav = function(_el) {
    var nav = document.querySelector('.nav-links');
    var overlay = document.querySelector('.nav-mobile-overlay');
    var btn = document.querySelector('.nav-toggle');
    if (!nav) return;
    var opening = !nav.classList.contains('open');
    nav.classList.toggle('open');
    if (btn) btn.classList.toggle('active', opening);
    if (overlay) overlay.classList.toggle('open', opening);
    document.body.style.overflow = opening ? 'hidden' : '';
  };

  /* ── Session-aware Nav (Login/Signup) ── */
  var GA_SESSION_KEY = 'ga_session_token';
  function getSessionToken() {
    try { return localStorage.getItem(GA_SESSION_KEY); } catch (_e) { return null; }
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
  function initNavAuth() {
    var container = document.getElementById('navAuth');
    if (!container) return;
    checkSession(function(user) {
      if (user) {
        container.innerHTML =
          '<a href="/dashboard/" class="nav-auth-link">Dashboard</a>' +
          '<a href="#" class="nav-auth-link nav-auth-logout" onclick="window.logoutUser(event)">Log Out</a>';
      } else {
        container.innerHTML =
          '<a href="/login/" class="nav-auth-link">Log In</a>' +
          '<a href="/register/" class="nav-auth-btn">Sign Up</a>';
      }
    });
  }
  window.logoutUser = function(e) {
    if (e) e.preventDefault();
    var token = getSessionToken();
    if (token) {
      navigator.sendBeacon('/api/auth/logout', JSON.stringify({ token: token }));
    }
    clearSession();
    document.cookie = 'ga_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.gabochie.com';
    window.location.href = '/';
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavAuth);
  } else {
    initNavAuth();
  }
})();
