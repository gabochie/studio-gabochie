import { test, expect } from '@playwright/test';

test('public theme toggle switches, persists and leaves nav intact', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', function (error) { pageErrors.push(error.message); });

  await page.goto('/');

  // Static `npx serve` CI does not run Pages middleware. The full-stack
  // wrangler run does, and that is where this behaviour is exercised.
  const injected = await page.locator('#themeToggle').count();
  test.skip(injected === 0, 'Theme assets are injected by Pages middleware only');

  const root = page.locator('html');
  const toggle = page.locator('#themeToggle');

  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to day theme');

  await toggle.click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveAttribute('aria-label', 'Switch to night theme');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F7F4EC');

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#themeToggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('nav .nav-links a.nav-active-link')).toHaveCount(4);

  await page.locator('#themeToggle').click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0A1628');

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(pageErrors).toEqual([]);
});
