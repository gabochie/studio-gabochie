import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function read(relative) {
  return readFileSync(new URL('../../' + relative, import.meta.url), 'utf8');
}

describe('production-readiness frontend fixes', function () {
  it('keeps index.html W3C-clean', function () {
    var html = read('index.html');
    expect(html).not.toContain('data:image/svg+xml,<svg');
    expect(html).toContain('data:image/svg+xml,%3Csvg');
    expect(html).toMatch(/<div class="pillar"><i class="ti ti-bulb"><\/i><h2>Creativity<\/h2>/);
    expect(html).toContain('<h2>Love</h2>');
    expect(html).toContain('<h2>Wisdom</h2>');
  });

  it('keeps the service worker escape lint-clean and cache behavior intact', function () {
    var sw = read('sw.js');
    expect(sw).toContain('/[.-][0-9a-f]{8,}\\.[a-z0-9]+$/i');
    expect(sw).not.toContain('/[.\\-]');
    expect(sw).toContain('CRITICAL_SHELL_URLS');
    expect(sw).toContain('OPTIONAL_PRECACHE_URLS');
    expect(sw).toContain('Promise.allSettled');
    expect(sw).toContain('staleWhileRevalidate(request)');
    expect(sw).toContain("response.ok && response.type === 'basic'");
    expect(sw).toContain('gabochie-v25');
  });

  it('keeps robots and sitemap crawl rules consistent', function () {
    var robots = read('robots.txt');
    expect(robots.indexOf('Allow: /api/sitemap-posts')).toBeGreaterThan(robots.indexOf('Disallow: /api/'));
    var sitemap = read('sitemap.xml');
    expect(sitemap).not.toContain('/dashboard/');
    ['/legal/disclaimer', '/legal/cookies', '/legal/donations', '/legal/privacy', '/legal/refund', '/legal/terms']
      .forEach(function (path) {
        expect(sitemap).not.toContain(path);
      });
  });

  it('stops injecting untrusted URL and API values as HTML', function () {
    var download = read('store/download.html');
    expect(download).toContain("encodeURIComponent(tx_ref)");
    expect(download).toContain("encodeURIComponent(o.tx_ref || tx_ref)");
    expect(download).toContain("refEl.textContent = tx_ref");
    expect(download).toContain("function addDetailRow(parent, label, value, valueStyle)");
    var library = read('store/library/index.html');
    expect(library).toContain("function esc(s) { var d = document.createElement('div')");
    expect(library).toContain("encodeURIComponent(o.tx_ref || '')");
  });

  it('adds accessible FAQ buttons, dialog semantics and live regions', function () {
    var main = read('assets/js/main.js');
    expect(main).toContain("closest('button.faq-q')");
    expect(main).toContain("window.__gaTracked");
    ['consultation/index.html', 'courses/index.html'].forEach(function (path) {
      var html = read(path);
      expect(html).toContain('class="faq-q" aria-expanded="false"');
    });
    var courses = read('courses/index.html');
    expect(courses).toContain('role="dialog"');
    expect(courses).toContain('aria-modal="true"');
    expect(courses).toContain('id="enrollMsg" role="status" aria-live="polite"');
    expect(read('consultation/index.html')).toContain('id="formMsg" role="status" aria-live="polite"');
    expect(read('functions/blog/[slug].js')).toContain('id="nlMsg" role="status" aria-live="polite"');
  });

  it('keeps injected navigation accessible', function () {
    var nav = read('nav.js');
    expect(nav).toContain('class="skip-link"');
    expect(nav).toContain('id="main-content"');
    expect(nav).toContain('id="navLinks"');
    expect(nav).toContain('aria-controls="navLinks"');
    expect(nav).toContain('aria-current');
    expect(nav).toContain('<h2>');
    expect(nav).not.toContain('<h4>');
    expect(nav).toContain('rel="noopener noreferrer"');
    expect(nav).toContain('<button type="button" class="nav-auth-link nav-auth-logout"');
    expect(nav).toContain('window.ENABLE_SW_ON_LOCALHOST');
  });

  it('keeps focus styles, muted contrast and the skip link in CSS', function () {
    var css = read('assets/css/main.css');
    expect(css).toContain(':focus-visible{outline:2px solid var(--gold)');
    expect(css).toContain('.skip-link:focus{left:8px;top:8px}');
    expect(css).toContain('--text-muted:#6E8DB3');
    expect(css).not.toMatch(/^footer[^,{]*\{[^}]*outline:\s*none/m);
    expect(css).toContain('footer h2,footer h4');
    expect(css).toContain('.nav-auth button');
  });

  it('keeps audited pages on canonical CSS with valid Google Fonts requests', function () {
    ['money-ghana/playbook/index.html', 'courses/year-package-2027/index.html'].forEach(function (path) {
      var html = read(path);
      expect(html, path + ' canonical CSS').toContain('href="/assets/css/main.css"');
      expect(html, path + ' legacy CSS').not.toContain('href="/style.css"');
      var fontHref = (html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/) || [])[1];
      expect(fontHref, path + ' font request').toBeTruthy();
      expect(fontHref, path + ' font request').not.toMatch(/:wght@0,/);
      expect(fontHref, path + ' font request').not.toMatch(/:wght@[^&"']*[,;]\s*$/);
    });
  });

  it('removes dormant pixels and the missing LOTL audio source', function () {
    var start = read('start/index.html');
    expect(start).not.toContain('PIXEL_IDS');
    expect(start).not.toContain('pixelLead');
    expect(start).not.toContain('connect.facebook.net');
    var preview = read('love-of-the-lord/daily/2027-01-preview.html');
    expect(preview).not.toContain('/love-of-the-lord/audio/daily/2027-01-01.mp3');
    expect(preview).toContain('No MP3 is published for this preview yet');
  });

  it('titles dynamic guitar iframes and uses the current support email offline', function () {
    ['guitar/learn/index.html', 'guitar/songs/index.html', 'school/guitar/learn/index.html', 'school/guitar/songs/index.html']
      .forEach(function (path) {
        expect(read(path)).toMatch(/<iframe[^>]+title=/);
      });
    expect(read('offline.html')).toContain('mailto:studio@gabochie.com');
    expect(read('offline.html')).not.toContain('mailto:hello@gabochie.com');
  });

  it('keeps consultation pricing and UTM handoff aligned', function () {
    var consultation = read('consultation/index.html');
    ['≈ $127', '≈ $424', '≈ $847'].forEach(function (price) {
      expect(consultation).toContain(price);
    });
    expect(consultation).toContain("['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (key)");
  });

  it('gives every indexable owned page complete core metadata and an h1', function () {
    [
      'store/download.html', 'store/library/index.html', 'consultation/index.html', 'courses/index.html',
      'index.html', 'services/index.html', 'careers/index.html', 'guitar/index.html',
      'guitar/learn/index.html', 'guitar/songs/index.html', 'merch/index.html',
      'school/guitar/learn/index.html', 'school/guitar/songs/index.html', 'books/index.html',
      'donate/index.html', 'certificate/index.html', 'blog/index.html', 'contact/index.html',
      'start/index.html', 'love-of-the-lord/devotionals/index.html',
    ].forEach(function (path) {
      var html = read(path);
      expect(html, path + ' canonical').toMatch(/<link[^>]+rel="canonical"/);
      expect(html, path + ' description').toMatch(/<meta[^>]+name="description"/);
      expect(html, path + ' og:title').toContain('og:title');
      expect(html, path + ' og:image').toContain('og:image');
      expect(html, path + ' twitter:card').toContain('twitter:card');
      expect(html, path + ' JSON-LD').toContain('application/ld+json');
      expect(html, path + ' h1').toMatch(/<h1[\s>]/);
    });
  });
});
