// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Currency toggle (site-wide)', function () {
  test('donate amounts convert with currency and persist across reload', async function ({ page }) {
    await page.goto('/donate/');
    var first = page.locator('.amount-grid .price-convert').first();
    await expect(first).toBeVisible({ timeout: 10000 });
    // Default currency is USD: GH¢100 renders as $X.XX
    await expect(first).toContainText('$');
    await page.evaluate(function () { localStorage.setItem('ga_currency', 'GHS'); });
    await page.reload();
    await expect(page.locator('.amount-grid .price-convert').first()).toContainText('GH');
    // Switch via the toggle UI and confirm it sticks after reload
    await page.selectOption('#currencyToggle select', 'USD');
    await expect(page.locator('.amount-grid .price-convert').first()).toContainText('$');
    await page.reload();
    await expect(page.locator('.amount-grid .price-convert').first()).toContainText('$');
  });

  test('billing note discloses GHS settlement on donate', async function ({ page }) {
    await page.goto('/donate/');
    await expect(page.locator('.bill-note').first()).toContainText('billed in Ghana Cedis');
  });

  test('merch exposes a dynamic reprice hook', async function ({ page }) {
    await page.goto('/merch/');
    var hasHook = await page.evaluate(function () { return typeof window.gaRepriceDynamic === 'function'; });
    expect(hasHook).toBe(true);
  });

  test('toggle is hidden on ministry pages (no convertible prices)', async function ({ page }) {
    await page.goto('/love-of-the-lord/');
    await expect(page.locator('#currencyToggle')).toBeHidden();
    await page.goto('/love-of-the-lord/give/');
    await expect(page.locator('#currencyToggle')).toBeHidden();
  });

  test('course landing prices convert with currency toggle', async function ({ page }) {
    await page.goto('/courses/digital-marketing/');
    var price = page.locator('#priceValue');
    await expect(price).toContainText('$', { timeout: 10000 });
    await page.selectOption('#currencyToggle select', 'GHS');
    await expect(price).toContainText('GH\u20b5');
  });

  test('systems-thinking inline price converts with currency toggle', async function ({ page }) {
    await page.goto('/courses/systems-thinking/');
    var price = page.locator('#priceValue');
    await expect(price).toContainText('$', { timeout: 10000 });
    await page.selectOption('#currencyToggle select', 'GHS');
    await expect(price).toContainText('GH\u20b5');
  });

  test('school exposes a dynamic reprice hook', async function ({ page }) {
    await page.goto('/school/');
    var hasHook = await page.evaluate(function () { return typeof window.gaRepriceDynamic === 'function'; });
    expect(hasHook).toBe(true);
  });
});
