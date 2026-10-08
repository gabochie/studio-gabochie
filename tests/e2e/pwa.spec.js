// @ts-check
import { test, expect } from '@playwright/test';

test.describe('PWA shell', function () {
  test('manifest is valid with shortcuts and icons', async function ({ request }) {
    var res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    var m = await res.json();
    expect(m.display).toBe('standalone');
    expect(m.icons.length).toBeGreaterThanOrEqual(3);
    expect(m.shortcuts.length).toBeGreaterThanOrEqual(1);
    for (const icon of m.icons.concat(m.shortcuts.flatMap(function (s) { return s.icons || []; }))) {
      var r = await request.get(icon.src);
      expect(r.ok()).toBe(true);
    }
  });

  test('service worker serves with JavaScript MIME', async function ({ request }) {
    var res = await request.get('/sw.js');
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('javascript');
  });

  test('icons load from self-hosted path, not CDN', async function ({ page }) {
    var bad = [];
    page.on('requestfailed', function (req) {
      if (req.url().indexOf('jsdelivr') >= 0 || req.url().indexOf('tabler') >= 0) bad.push(req.url());
    });
    page.on('response', function (res) {
      if (res.status() >= 400 && res.url().indexOf('jsdelivr') >= 0) bad.push(res.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(bad).toEqual([]);
    var css = await page.getAttribute('link[href*="tabler-icons"]', 'href');
    expect(css).toContain('/assets/fonts/tabler/');
  });

  test('footer shows redesigned columns with new tagline', async function ({ page }) {
    await page.goto('/');
    var footer = page.locator('footer');
    await expect(footer.getByText('Learn', { exact: true })).toBeVisible();
    await expect(footer.getByText('Offerings', { exact: true })).toBeVisible();
    await expect(footer.getByText('Connect', { exact: true })).toBeVisible();
    await expect(footer.getByText('Start Free', { exact: true })).toBeVisible();
    var tagline = await footer.locator('.nav-brand-tagline, .brand-tagline').first().textContent();
    expect(tagline).not.toContain('School of');
  });

  test('mobile tab bar appears only on small screens', async function ({ page }) {
    await page.goto('/');
    await expect(page.locator('.tab-bar')).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    var bar = page.locator('.tab-bar');
    await expect(bar).toBeVisible();
    for (const label of ['Home', 'Courses', 'Guitar', 'Books', 'Account']) {
      await expect(bar.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(bar.locator('[data-tab="home"].active')).toBeVisible();
  });
});
