import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function read(relative) {
  return readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');
}

describe('public day theme and toggle', function () {
  const middleware = read('functions/_middleware.js');
  const themeJs = read('assets/js/theme.js');
  const themeCss = read('assets/css/theme.css');
  const styleGuide = read('STYLE_GUIDE.md');

  it('injects public theme assets through the middleware', function () {
    expect(middleware).toContain('assets/css/theme.css?v=');
    expect(middleware).toContain('assets/js/theme.js?v=');
    expect(middleware).toContain("el.setAttribute('data-theme', theme)");
    expect(middleware).toContain("rewriter.on('head'");
    expect(middleware).toContain('el.append(THEME_HEAD, { html: true })');
    expect(middleware).toContain("meta[name=\"theme-color\"]");
  });

  it('keeps night as the default and persists an explicit choice', function () {
    expect(middleware).toContain("return 'dark';");
    expect(middleware).toContain('ga_theme=');
    expect(themeJs).toContain("var STORAGE_KEY = 'ga_theme'");
    expect(themeJs).toContain('document.cookie = STORAGE_KEY');
    expect(themeJs).toContain('localStorage.setItem(STORAGE_KEY, theme)');
  });

  it('excludes admin, console, news and the guitar sub-app', function () {
    expect(middleware).toContain("path === '/admin'");
    expect(middleware).toContain("path === '/console'");
    expect(middleware).toContain("path.indexOf('/guitar/') === 0");
    expect(middleware).toContain('isNews');
    expect(themeJs).toContain('/^\\/admin(\\/|$)/.test(path)');
  });

  it('scopes every day-theme colour rule to the light attribute', function () {
    expect(themeCss).toContain('html[data-theme="light"]');
    expect(themeCss).toContain('html[data-theme="dark"]');
    expect(themeCss).not.toMatch(/^:root\s*\{/m);
    expect(themeCss).toContain('--bg-primary:#F7F4EC!important');
    expect(themeCss).toContain('--gold:#8A6A17!important');
  });

  it('adds an accessible toggle without changing nav link counts', function () {
    expect(themeJs).toContain('button.id = \'themeToggle\'');
    expect(themeJs).toContain("button.type = 'button'");
    expect(themeJs).toContain("setAttribute('aria-label'");
    expect(themeJs).toContain("setAttribute('aria-pressed'");
    expect(themeJs).not.toContain('nav-active-link');
    expect(themeCss).toContain('.theme-toggle');
  });

  it('makes no network calls and logs no personal data', function () {
    expect(themeJs).not.toContain('fetch(');
    expect(themeJs).not.toContain('sendBeacon');
    expect(themeJs).not.toContain('console.log');
  });

  it('documents the public-only scope in the style guide', function () {
    expect(styleGuide).toContain('day theme');
    expect(styleGuide).toContain('ga_theme');
    expect(styleGuide).toContain('Admin, console, news and the deliberately dark guitar sub-app are excluded');
  });
});
