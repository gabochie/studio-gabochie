(function() {
  var SIDEBAR_KEY = 'ga_sidebar_collapsed';
  var SCOPE_KEY = 'ga_admin_scope';

  function getCollapsed() {
    try { return localStorage.getItem(SIDEBAR_KEY) === 'true'; } catch(e) { return false; }
  }

  function setCollapsed(v) {
    try { localStorage.setItem(SIDEBAR_KEY, v ? 'true' : 'false'); } catch(e) {}
  }

  function getScope() {
    try { return localStorage.getItem(SCOPE_KEY) || 'main'; } catch(e) { return 'main'; }
  }

  function setScope(v) {
    try { localStorage.setItem(SCOPE_KEY, v); } catch(e) {}
  }

  var GROUPS = [
    {
      label: 'Content',
      items: [
        { href: 'content.html',     icon: '\uD83D\uDCC4', label: 'Content' },
        { href: 'programs.html',    icon: '\uD83D\uDCD6', label: 'Programs' },
        { href: 'newsletter.html',  icon: '\uD83D\uDCEB', label: 'Newsletter' },
        { href: 'calendar.html',    icon: '\uD83D\uDCC5', label: 'Calendar' },
        { href: 'content-ai.html',  icon: '\u2728',       label: 'AI Content' },
        { href: 'classifieds.html',  icon: '\uD83D\uDCE3', label: 'Classifieds' },
        { href: 'store.html',       icon: '\uD83D\uDED2', label: 'Store' },
        { href: 'survey.html',      icon: '\uD83D\uDCCA', label: 'Course Survey' },
        { href: 'tutoring.html',    icon: '\uD83C\uDF93', label: 'Tutoring' },
        { href: '/careers/',        icon: '\uD83D\uDCBC', label: 'Careers' },
        { href: 'tutor-roadmap.html', icon: '\uD83D\uDDFA', label: 'Tutor Roadmap' },
        { href: 'instagram-leads.html', icon: '\uD83D\uDCF7', label: 'Instagram Leads' }
      ]
    },
    {
      label: 'Finance',
      items: [
        { href: 'analytics.html',   icon: '\uD83D\uDCCA', label: 'Analytics' },
        { href: 'donations.html',   icon: '\uD83D\uDCB5', label: 'Donations' },
        { href: 'bookings.html',    icon: '\uD83C\uDFE8', label: 'Bookings' },
        { href: 'sponsors.html',    icon: '\uD83E\uDD1D', label: 'Sponsors' },
        { href: 'services.html',    icon: '\uD83D\uDCD0', label: 'Services' }
      ]
    },
    {
      label: 'Nation Building',
      items: [
        { href: 'surveys.html',     icon: '\uD83D\uDCCA', label: 'Survey' },
        { href: 'programs.html', icon: '\uD83C\uDFDB', label: 'Programs' }
      ]
    },
    {
      label: 'System',
      items: [
        { href: 'index.html',       icon: '\uD83D\uDCCA', label: 'Dashboard' },
        { href: 'members.html',     icon: '\uD83D\uDC65', label: 'Members' },
        { href: 'subscribers.html', icon: '\uD83D\uDCEB', label: 'Subscribers' },
        { href: 'email.html',       icon: '\u2709\uFE0F',  label: 'Email' },
        { href: 'enrollments.html', icon: '\uD83D\uDCDD', label: 'Enrollments' },
        { href: 'submissions.html', icon: '\uD83D\uDCE9', label: 'Submissions' },
        { href: 'outreach.html',    icon: '\uD83D\uDCE2', label: 'Outreach' },
        { href: 'guitar.html',      icon: '\uD83C\uDFB8', label: 'Guitar' },
        { href: 'quiz.html',       icon: '\uD83D\uDCDD', label: 'Quiz' },
        { href: 'quality.html',    icon: '\u2705',        label: 'Quality' },
        { href: 'agents.html',      icon: '\u26A1',        label: 'Command Center' },
        { href: 'strategy.html',    icon: '\uD83C\uDFAF', label: 'Strategy' },
        { href: 'roadmap.html',     icon: '\u2705',        label: 'ToDo List' },
        { href: '/api/db/setup',   icon: '\uD83D\uDDC2', label: 'DB Setup' }
      ]
    }
  ];

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function renderSidebar() {
    var page = currentPage();
    var collapsed = getCollapsed();
    document.body.classList.add('has-sidebar');
    if (collapsed) document.body.classList.add('sidebar-collapsed');

    var el = document.createElement('div');
    el.id = 'sidebar';
    el.className = collapsed ? 'sidebar collapsed' : 'sidebar';

    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'sidebarToggle';
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    toggleBtn.innerHTML = collapsed ? '\u25B6' : '\u25C0';
    toggleBtn.addEventListener('click', function() {
      var s = document.getElementById('sidebar');
      var isCollapsed = s.classList.contains('collapsed');
      s.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed');
      setCollapsed(!isCollapsed);
      toggleBtn.innerHTML = isCollapsed ? '\u25C0' : '\u25B6';
    });

    var logo = document.createElement('a');
    logo.href = '../index.html';
    logo.className = 'sidebar-logo';
    logo.innerHTML = '<img src="../assets/images/logo.png" alt=""><span>Studio</span>';

    // Scope toggle
    var scopeBar = document.createElement('div');
    scopeBar.className = 'sidebar-scope';
    scopeBar.style.cssText = 'display:flex;margin:8px 12px;border-radius:6px;overflow:hidden;border:1px solid #1E3250';
    var scopeMain = document.createElement('button');
    scopeMain.textContent = 'Main';
    scopeMain.style.cssText = 'flex:1;padding:5px 8px;font-size:10px;font-family:Inter,sans-serif;cursor:pointer;border:none;font-weight:600;transition:all .15s';
    var scopeNews = document.createElement('button');
    scopeNews.textContent = 'News';
    scopeNews.style.cssText = 'flex:1;padding:5px 8px;font-size:10px;font-family:Inter,sans-serif;cursor:pointer;border:none;font-weight:600;transition:all .15s';
    function updateScopeUI() {
      var scope = getScope();
      scopeMain.style.background = scope === 'main' ? '#C9A84C' : '#0A1628';
      scopeMain.style.color = scope === 'main' ? '#0A1628' : '#5A7A9F';
      scopeNews.style.background = scope === 'newsletter' ? '#C9A84C' : '#0A1628';
      scopeNews.style.color = scope === 'newsletter' ? '#0A1628' : '#5A7A9F';
    }
    scopeMain.addEventListener('click', function() { setScope('main'); updateScopeUI(); });
    scopeNews.addEventListener('click', function() { setScope('newsletter'); updateScopeUI(); });
    updateScopeUI();
    scopeBar.appendChild(scopeMain);
    scopeBar.appendChild(scopeNews);

    var nav = document.createElement('nav');
    nav.className = 'sidebar-nav';

    GROUPS.forEach(function(group) {
      var header = document.createElement('div');
      header.className = 'sidebar-group-header';
      header.textContent = group.label;
      nav.appendChild(header);

      group.items.forEach(function(item) {
        var a = document.createElement('a');
        a.href = item.href;
        a.className = 'sidebar-item' + (page === item.href ? ' active' : '');
        a.innerHTML = '<span class="sidebar-icon">' + item.icon + '</span><span class="sidebar-label">' + item.label + '</span>';
        nav.appendChild(a);
      });
    });

    var footer = document.createElement('div');
    footer.className = 'sidebar-footer';
    var logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.className = 'sidebar-item sidebar-logout';
    logoutBtn.innerHTML = '<span class="sidebar-icon">\uD83D\uDD12</span><span class="sidebar-label">Sign Out</span>';
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof Modal !== 'undefined' && Modal.create) {
        var m = Modal.create('logoutModal');
        m.render(
          '<div class="modal-title" id="logoutModal-title">Sign Out</div>' +
          '<div class="modal-body">Are you sure you want to sign out?</div>' +
          '<div class="modal-footer">' +
            '<button class="btn btn-outline" onclick="Modal.close(\'logoutModal\')">Cancel</button>' +
            '<button class="btn btn-danger" id="logoutConfirmBtn">Sign Out</button>' +
          '</div>'
        );
        m.open();
        setTimeout(function() {
          var btn = document.getElementById('logoutConfirmBtn');
          if (btn) btn.addEventListener('click', function() {
            Modal.close('logoutModal');
            if (typeof adminLogout === 'function') adminLogout();
          });
        }, 50);
      } else {
        if (confirm('Sign out?')) {
          if (typeof adminLogout === 'function') adminLogout();
        }
      }
    });
    footer.appendChild(logoutBtn);

    var mobileToggle = document.createElement('button');
    mobileToggle.id = 'sidebarMobileToggle';
    mobileToggle.className = 'sidebar-mobile-toggle';
    mobileToggle.setAttribute('aria-label', 'Toggle navigation menu');
    mobileToggle.innerHTML = '\u2630';
    mobileToggle.addEventListener('click', function() {
      document.getElementById('sidebar').classList.toggle('mobile-open');
    });

    el.appendChild(toggleBtn);
    el.appendChild(logo);
    el.appendChild(nav);
    el.appendChild(footer);

    var overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', function() {
      document.getElementById('sidebar').classList.remove('mobile-open');
    });

    document.body.appendChild(el);
    document.body.appendChild(overlay);
    document.body.appendChild(mobileToggle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
  } else {
    renderSidebar();
  }
})();
