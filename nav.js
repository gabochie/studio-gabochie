(function() {
  var navHtml =
    '<nav>' +
    '<div class="container">' +
    '<a href="/" class="nav-brand"><img src="/assets/images/logo.png" alt="Studio Gabochie"> <span class="nav-brand-wrapper"><span class="nav-brand-title">Studio Gabochie</span><span class="nav-brand-tagline">Creativity, Love &amp; Wisdom</span></span></a>' +
    '<div class="nav-links">' +
    '<a href="/courses/" class="nav-active-link">Courses</a>' +
    '<button id="pwaInstallBtn" class="pwa-install" hidden>Install App</button>' +
    '<span id="navAuth" class="nav-auth"></span>' +
    '</div>' +
    '<button class="nav-toggle" onclick="toggleNav(this)" aria-label="Menu"><span></span><span></span><span></span></button>' +
    '</div>' +
    '</nav>' +
    '<div class="nav-mobile-overlay" onclick="toggleNav(document.querySelector(\'.nav-toggle\'))"></div>';
  var tabBarHtml =
    '<nav class="tab-bar">' +
    '<a href="/" data-tab="home"><i class="ti ti-home"></i><span>Home</span></a>' +
    '<a href="/courses/" data-tab="courses"><i class="ti ti-book"></i><span>Courses</span></a>' +
    '<a href="/love-of-the-lord/" data-tab="church"><i class="ti ti-cross"></i><span>Church</span></a>' +
    '<a href="/books/" data-tab="books"><i class="ti ti-bookmark"></i><span>Books</span></a>' +
    '<a href="/dashboard/" data-tab="account"><i class="ti ti-user"></i><span>Account</span></a>' +
    '</nav>';

  var footerHtml =
    '<footer>' +
    '<div class="container">' +
    '<div class="footer-brand">' +
    '<div class="brand-footer"><img src="/assets/images/logo.png" alt="Studio Gabochie"><span class="brand-footer-wrapper"><span class="brand-footer-title">Studio Gabochie</span><span class="brand-tagline">Creativity, Love &amp; Wisdom</span></span></div>' +
    '<p class="footer-about">Practical, self-paced courses that start free — imagine with creativity, create with love, live with wisdom.</p>' +
    '<a href="/register/" class="footer-cta">Start Free</a>' +
    '<div class="footer-social">' +
    '<a href="https://x.com/GideonAbochie" target="_blank" title="X / Twitter"><i class="ti ti-brand-x"></i></a>' +
    '<a href="https://web.facebook.com/GideonAbochie/" target="_blank" title="Facebook"><i class="ti ti-brand-facebook"></i></a>' +
    '<a href="https://www.instagram.com/gideonabochie/" target="_blank" title="Instagram"><i class="ti ti-brand-instagram"></i></a>' +
    '<a href="https://www.tiktok.com/@gideonabochie" target="_blank" title="TikTok"><i class="ti ti-brand-tiktok"></i></a>' +
    '<a href="https://www.youtube.com/@GideonAbochie" target="_blank" title="YouTube"><i class="ti ti-brand-youtube"></i></a>' +
    '</div>' +
    '</div>' +
    '<div>' +
    '<h4>Learn</h4>' +
    '<a href="/courses/">All Courses</a>' +
    '<a href="/guitar/">Guitar Method</a>' +
    '<a href="/blog/">Articles</a>' +
    '<a href="/careers/">Careers</a>' +
    '<a href="/nationbuilding/">Nation Building</a>' +
    '<a href="/courses/#school-wisdom">Wisdom Layer</a>' +
    '<a href="/dashboard/">Dashboard</a>' +
    '<a href="/certificate/">Certificates</a>' +
    '</div>' +
    '<div>' +
    '<h4>Offerings</h4>' +
    '<a href="/books/">Books</a>' +
    '<a href="/merch/">Merch</a>' +
    '<a href="/services/">Services</a>' +
    '<a href="/membership/">Membership &amp; Pricing</a>' +
    '<a href="/donate/">Donate</a>' +
    '</div>' +
    '<div>' +
    '<h4>Ministry</h4>' +
    '<a href="/love-of-the-lord/">&#128591; Have Church Now</a>' +
    '<a href="/love-of-the-lord/give/">Give</a>' +
    '<a href="/love-of-the-lord/#prayer">Prayer</a>' +
    '<a href="/love-of-the-lord/#family">Family</a>' +
    '</div>' +
    '<div>' +
    '<h4>Connect</h4>' +
    '<a href="/contact/">Contact Form</a>' +
    '<a href="/press/">For Media</a>' +
    '<a href="/partners/">Partner With Us</a>' +
    '<a href="mailto:studio@gabochie.com">studio@gabochie.com</a>' +
    '<a href="tel:+233243262019">+233 243 262 019</a>' +
    '<span style="display:block;font-family:\'Barlow\',sans-serif;font-size:13px;color:#5A7A9F;margin-bottom:8px">P.O. Box SK 2125, Sakumono, Tema &mdash; Ghana</span>' +
    '</div>' +
    '<div class="footer-legal footer-legal--bar"><a href="/legal/privacy.html">Privacy</a><span>·</span><a href="/legal/cookies.html">Cookies</a><span>·</span><a href="/legal/terms.html">Terms</a><span>·</span><a href="/legal/refund.html">Refunds</a><span>·</span><a href="/legal/disclaimer.html">Disclaimer</a><span>·</span><a href="/legal/donations.html">Donations</a></div>' +
    '<div class="footer-bottom">&copy; ' + new Date().getFullYear() + ' Studio Gabochie &mdash; Accra, Ghana.</div>' +
    '</div>' +
    '</footer>';

  // Footer-only mode: pages with their own header/nav (e.g. guitar section)
  // set window.GA_FOOTER_ONLY = true before loading nav.js to get just the footer.
  var footerOnly = (typeof window !== 'undefined' && window.GA_FOOTER_ONLY === true);

  var phNav = document.getElementById('nav-placeholder');
  if (phNav && !footerOnly) {
    phNav.outerHTML = navHtml;
  }

  // Bottom tab bar renders on every page (including footer-only pages like
  // the ministry and guitar sections) so mobile navigation stays consistent.
  if (!document.querySelector('.tab-bar')) {
    document.body.insertAdjacentHTML('beforeend', tabBarHtml);
  }

  var phFooter = document.getElementById('footer-placeholder');
  if (phFooter) {
    phFooter.outerHTML = footerHtml;
  }

  function setActiveTab() {
    var path = window.location.pathname;
    var tab = 'home';
    if (path.indexOf('/courses/') === 0 || path === '/school/') tab = 'courses';
    else if (path.indexOf('/love-of-the-lord/') === 0 || path === '/lotl/') tab = 'church';
    else if (path.indexOf('/guitar/') === 0) tab = 'guitar';
    else if (path.indexOf('/books/') === 0) tab = 'books';
    else if (path.indexOf('/dashboard/') === 0 || path.indexOf('/member/') === 0 ||
             path.indexOf('/login/') === 0 || path.indexOf('/register/') === 0) tab = 'account';
    var active = document.querySelector('.tab-bar [data-tab="' + tab + '"]');
    if (active) active.classList.add('active');
  }

  function setActiveLink() {
    var path = window.location.pathname;
    setActiveTab();
    var links = document.querySelectorAll('.nav-links .nav-active-link, .nav-links a');
    links.forEach(function(a) {
      var href = a.getAttribute('href') || '';
      if (href === '/courses/' && path.indexOf('/courses/') === 0) {
        a.classList.add('active');
      } else if (href === '/courses/' && path === '/school/') {
        a.classList.add('active');
      }
    });
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
    document.addEventListener('DOMContentLoaded', setActiveLink);
  } else {
    initNavAuth();
    setActiveLink();
  }

  // PWA: register the service worker for offline shell + catalog support.
  // Skipped in local dev (localhost serves stale caches confusingly) and for
  // the inlined-data favicon-only pages. Registered last so it never blocks nav.
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  // PWA install prompt: show an in-app Install button only when the browser
  // fires beforeinstallprompt and the app isn't already installed.
  var deferredInstallPrompt = null;
  function updateInstallBtn() {
    var btn = document.getElementById('pwaInstallBtn');
    if (!btn) return;
    var installed = false;
    try {
      installed = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    } catch (_e) {}
    btn.hidden = installed || !deferredInstallPrompt;
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallBtn();
  });
  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    updateInstallBtn();
  });
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#pwaInstallBtn') : null;
    if (!btn || !deferredInstallPrompt) return;
    e.preventDefault();
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function () {
      deferredInstallPrompt = null;
      updateInstallBtn();
    }).catch(function () {
      deferredInstallPrompt = null;
      updateInstallBtn();
    });
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerServiceWorker);
  } else {
    registerServiceWorker();
  }
})();