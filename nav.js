(function() {
  var navHtml =
    '<nav>' +
    '<div class="container">' +
    '<a href="/" class="nav-brand"><img src="/assets/images/logo.png" alt="GideonAbochie Studio"> <span class="nav-brand-wrapper"><span class="nav-brand-title">GideonAbochie Studio</span><span class="nav-brand-tagline">School of Creativity, Love & Wisdom</span></span></a>' +
    '<div class="nav-links">' +
    '<a href="/about/">About</a>' +
    '<a href="/school/">School</a>' +
    '<a href="/books/">Books</a>' +
    '<a href="/membership/">Membership</a>' +
    '<a href="/campaigns/1-million-systems-thinkers/">Fundraising</a>' +
    '<a href="/tutoring/">Tutoring</a>' +
    '<a href="/careers/">Careers</a>' +
    '<a href="/support/" class="nav-donate"><i class="ti ti-heart"></i> Support</a>' +
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
    '<div class="brand-footer"><img src="/assets/images/logo.png" alt="GideonAbochie Studio"><span class="brand-footer-wrapper"><span class="brand-footer-title">GideonAbochie Studio</span><span class="brand-tagline">School of Creativity, Love & Wisdom</span></span></div>' +
    '<p class="footer-about">A Bible-based ministry teaching a generation to create with excellence, love with devotion, and walk in the wisdom of God\'s Word. Rooted in Scripture, expressed through creativity, shared freely with the world.</p>' +
    '<div class="footer-social">' +
    '<a href="https://x.com/GideonAbochie" target="_blank" title="X / Twitter"><i class="ti ti-brand-x"></i></a>' +
    '<a href="https://web.facebook.com/GideonAbochie/" target="_blank" title="Facebook"><i class="ti ti-brand-facebook"></i></a>' +
    '<a href="https://www.instagram.com/gideonabochie/" target="_blank" title="Instagram"><i class="ti ti-brand-instagram"></i></a>' +
    '<a href="https://www.tiktok.com/@gideonabochie" target="_blank" title="TikTok"><i class="ti ti-brand-tiktok"></i></a>' +
    '</div>' +
    '</div>' +
    '<div>' +
    '<h4>Content</h4>' +
    '<a href="/manifesto/">Read the Manifesto</a>' +
    '<a href="/school/">School Programs</a>' +
    '<a href="/newsletter/">The Studio Weekly</a>' +
    '<a href="/campaigns/1-million-systems-thinkers/">Flagship Campaign</a>' +
    '<a href="/nationbuilding/">Nationbuilding</a>' +
    '<a href="/tutoring/">Tutoring Marketplace</a>' +
    '<a href="/careers/">Careers</a>' +
    '</div>' +
    '<div>' +
    '<h4>Support</h4>' +
    '<a href="/register/">Create Account</a>' +
    '<a href="/login/">Log In</a>' +
    '<a href="/donate/">One-Time Donation</a>' +
    '<a href="/membership/">Membership</a>' +
    '<a href="/books/">Buy Books</a>' +
    '</div>' +
    '<div>' +
    '<h4>Social</h4>' +
    '<a href="https://x.com/GideonAbochie" target="_blank">X / Twitter</a>' +
    '<a href="https://web.facebook.com/GideonAbochie/" target="_blank">Facebook</a>' +
    '<a href="https://www.instagram.com/gideonabochie/" target="_blank">Instagram</a>' +
    '<a href="https://www.tiktok.com/@gideonabochie" target="_blank">TikTok</a>' +
    '</div>' +
    '<div>' +
    '<h4>Contact</h4>' +
    '<a href="/contact/">Contact Us</a>' +
    '<a href="mailto:info@gideonabochie.com">info@gideonabochie.com</a>' +
    '<a href="tel:+233243262019">+233 243 262 019</a>' +
    '<h4 style="margin-top:16px">Legal</h4>' +
    '<a href="/legal/privacy.html">Privacy Policy</a>' +
    '<a href="/legal/terms.html">Terms of Use</a>' +
    '<a href="/legal/donations.html">Donation Policy</a>' +
    '<a href="/legal/refund.html">Refund Policy</a>' +
    '<a href="/legal/disclaimer.html">Disclaimer</a>' +
    '</div>' +
    '<div class="footer-sponsors">' +
    '<span class="footer-sponsors-label">Sponsors & Affiliations</span>' +
    '<div class="footer-sponsors-logos">' +
    '<a href="https://www.tiktok.com/@neoghglobal" target="_blank" rel="noopener" class="footer-sponsor-item"><img src="/assets/images/neogh-logo.png" alt="NEOGH - Spirit of Nation Building"><span>NEOGH<small>Spirit of Nation Building</small></span></a>' +
    '<div class="footer-sponsor-item placeholder"><div class="placeholder-icon">+</div><span>Your Brand<small>Sponsor this spot</small></span></div>' +
    '<div class="footer-sponsor-item placeholder"><div class="placeholder-icon">+</div><span>Your Brand<small>Sponsor this spot</small></span></div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="footer-bottom">&copy; ' + new Date().getFullYear() + ' GideonAbochie Studio</div>' +
    '</footer>';

  var phNav = document.getElementById('nav-placeholder');
  if (phNav) {
    phNav.outerHTML = navHtml;
  }

  var phFooter = document.getElementById('footer-placeholder');
  if (phFooter) {
    phFooter.outerHTML = footerHtml;
  }
})();
