/* Studio Gabochie — public theme preference.
   Night is the default. A stored choice is applied synchronously in <head>
   so the day theme never flashes the dark palette first. Admin/console and
   the deliberately dark guitar sub-app are excluded. */
(function () {
  'use strict';

  var STORAGE_KEY = 'ga_theme';
  var DARK = 'dark';
  var LIGHT = 'light';
  var THEME_COLOR = { dark: '#0A1628', light: '#F7F4EC' };
  var STATUS_BAR = { dark: 'black-translucent', light: 'default' };

  function readCookie() {
    try {
      var match = document.cookie.match(/(?:^|;\s*)ga_theme=([^;]+)/);
      if (!match) return '';
      return decodeURIComponent(match[1]).toLowerCase();
    } catch (_e) {
      return '';
    }
  }

  function readStorage() {
    try {
      return String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
    } catch (_e) {
      return '';
    }
  }

  function valid(value) {
    return value === DARK || value === LIGHT ? value : '';
  }

  function readPreference() {
    return valid(readCookie()) || valid(readStorage()) || DARK;
  }

  function currentTheme() {
    var value = document.documentElement.getAttribute('data-theme');
    return valid(String(value || '').toLowerCase()) || DARK;
  }

  function setMeta(name, value) {
    var meta = document.querySelector('meta[name="' + name + '"]');
    if (meta) meta.setAttribute('content', value);
  }

  function writePreference(theme) {
    try {
      var secure = window.location.protocol === 'https:' ? ';Secure' : '';
      document.cookie = STORAGE_KEY + '=' + theme + ';path=/;max-age=31536000;SameSite=Lax' + secure;
    } catch (_e) { /* cookie blocked; localStorage is the fallback */ }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_e) { /* storage blocked; cookie still carries the preference */ }
  }

  function buttonMarkup() {
    return '<svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="4"></circle>' +
      '<path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>' +
      '</svg>' +
      '<svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"></path>' +
      '</svg>';
  }

  function updateButton(theme) {
    var button = document.getElementById('themeToggle');
    if (!button) return;
    var toLight = theme === DARK;
    var label = toLight ? 'Switch to day theme' : 'Switch to night theme';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', theme === LIGHT ? 'true' : 'false');
    button.setAttribute('data-current-theme', theme);
  }

  function applyTheme(theme, persist) {
    var next = valid(theme) || DARK;
    var root = document.documentElement;
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
    setMeta('theme-color', THEME_COLOR[next]);
    setMeta('apple-mobile-web-app-status-bar-style', STATUS_BAR[next]);
    if (persist) writePreference(next);
    updateButton(next);
  }

  function isExcludedPath() {
    var path = window.location.pathname;
    var host = window.location.hostname;
    return host.indexOf('news.') === 0 ||
      /^\/admin(\/|$)/.test(path) ||
      path === '/console' || path.indexOf('/console/') === 0 ||
      path.indexOf('/guitar/') === 0 || path.indexOf('/school/guitar/') === 0;
  }

  function initToggle() {
    if (isExcludedPath() || document.getElementById('themeToggle')) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'themeToggle';
    button.className = 'theme-toggle';
    button.innerHTML = buttonMarkup();

    var navLinks = document.querySelector('nav[aria-label="Primary"] .nav-links');
    if (navLinks) {
      var auth = document.getElementById('navAuth');
      if (auth && auth.parentNode === navLinks) navLinks.insertBefore(button, auth.nextSibling);
      else navLinks.appendChild(button);
    } else {
      button.classList.add('theme-toggle--floating');
      (document.body || document.documentElement).appendChild(button);
    }

    button.addEventListener('click', function () {
      applyTheme(currentTheme() === DARK ? LIGHT : DARK, true);
    });
    updateButton(currentTheme());
  }

  function init() {
    initToggle();
    window.GA_THEME = {
      STORAGE_KEY: STORAGE_KEY,
      get: currentTheme,
      set: function (theme) { applyTheme(theme, true); },
      toggle: function () { applyTheme(currentTheme() === DARK ? LIGHT : DARK, true); }
    };
  }

  /* Paint-safe initialization happens here, before the body is parsed. */
  applyTheme(readPreference(), false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
