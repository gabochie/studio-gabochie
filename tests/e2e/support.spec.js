// @ts-check
import { test, expect } from '@playwright/test';

var mockPlans = [
  { id: 'monthly', name: 'Monthly Supporter', amount: 50, currency: 'GHS', per: '/mo', popular: false, features: ['Early access', 'Supporter badge'] },
  { id: 'annual', name: 'Annual Patron', amount: 500, currency: 'GHS', per: '/yr', popular: true, features: ['All Monthly', 'All books in PDF'] },
  { id: 'founding', name: 'Founding Partner', amount: 2500, currency: 'GHS', per: '/yr', popular: false, features: ['All Annual', 'Name on website'] },
];

var mockRates = { GHS: 15, USD: 1.08, EUR: 1.0, GBP: 0.86 };

test.describe('Support page', function () {
  test.beforeEach(async function ({ page }) {
    // Mock subscription plans API
    await page.route('**/api/subscription/plans', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', plans: mockPlans, public_key: 'pk_test' }),
      });
    });
    // Mock Frankfurter currency API
    await page.route('**/api.frankfurter.app/**', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ amount: 1, base: 'EUR', date: '2026-05-27', rates: mockRates }),
      });
    });
    await page.goto('/support/');
  });

  test('loads tier cards from mocked API', async function ({ page }) {
    var cards = page.locator('.tier-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    var count = await cards.count();
    expect(count).toBe(mockPlans.length);
    // Verify names match mock data
    await expect(cards.nth(0)).toContainText('Monthly Supporter');
    await expect(cards.nth(1)).toContainText('Annual Patron');
    await expect(cards.nth(2)).toContainText('Founding Partner');
  });

  test('shows GH\u00a2 prices by default', async function ({ page }) {
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('GH\u00a2', { timeout: 10000 });
  });

  test('currency toggle buttons are visible and have correct labels', async function ({ page }) {
    var toggle = page.locator('#currencyToggle');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    var btns = toggle.locator('.currency-btn');
    var count = await btns.count();
    expect(count).toBe(4);
    await expect(btns.nth(0)).toHaveText(/GH/);
    await expect(btns.nth(1)).toHaveText(/USD/);
    await expect(btns.nth(2)).toHaveText(/EUR/);
    await expect(btns.nth(3)).toHaveText(/GBP/);
  });

  test('GHS toggle is active by default', async function ({ page }) {
    var firstBtn = page.locator('#currencyToggle .currency-btn').first();
    await expect(firstBtn).toHaveClass(/active/);
  });

  test('clicking USD switches main prices to dollar', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(1).click();
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('$', { timeout: 5000 });
  });

  test('clicking EUR switches main prices to euro', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(2).click();
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('\u20AC', { timeout: 5000 });
  });

  test('clicking GBP switches main prices to pound', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(3).click();
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('\u00A3', { timeout: 5000 });
  });

  test('active class moves between toggle buttons', async function ({ page }) {
    var btns = page.locator('#currencyToggle .currency-btn');
    await btns.nth(1).click();
    await expect(btns.nth(0)).not.toHaveClass(/active/);
    await expect(btns.nth(1)).toHaveClass(/active/);
    await btns.nth(2).click();
    await expect(btns.nth(1)).not.toHaveClass(/active/);
    await expect(btns.nth(2)).toHaveClass(/active/);
  });

  test('all tier cards update when currency is toggled', async function ({ page }) {
    var cards = page.locator('.tier-card');
    var count = await cards.count();
    await page.locator('#currencyToggle .currency-btn').nth(1).click();
    for (var i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('.tier-price')).toContainText('$');
    }
  });

  test('dollar amounts are mathematically correct', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(1).click();
    // GHS 50 / 15 GHS-per-EUR \u00d7 1.08 USD-per-EUR = 3.6, toFixed(1) = "3.6"
    // GHS 500 / 15 \u00d7 1.08 = 36, toFixed(0) = "36"
    // GHS 2500 / 15 \u00d7 1.08 = 180, toFixed(0) = "180"
    var prices = page.locator('.tier-price');
    await expect(prices.nth(0)).toContainText('$3.6');
    await expect(prices.nth(1)).toContainText('$36');
    await expect(prices.nth(2)).toContainText('$180');
  });

  test('small converted line is visible below each price', async function ({ page }) {
    var converted = page.locator('.tier-converted').first();
    await expect(converted).toBeVisible({ timeout: 10000 });
  });

  test('converted line updates when currency toggles', async function ({ page }) {
    var converted = page.locator('.tier-converted').first();
    var originalText = await converted.textContent();
    await page.locator('#currencyToggle .currency-btn').nth(1).click();
    var newText = await converted.textContent();
    expect(newText).not.toBe(originalText);
    await page.locator('#currencyToggle .currency-btn').nth(0).click();
    var backText = await converted.textContent();
    expect(backText).toBe(originalText);
  });

  test('toggles back to GHS correctly after switching', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(1).click();
    await page.locator('#currencyToggle .currency-btn').nth(0).click();
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('GH\u00a2');
  });

  test('subscribe button opens form modal', async function ({ page }) {
    var btn = page.locator('.subscribe-btn').first();
    await btn.click();
    var overlay = page.locator('#formOverlay');
    await expect(overlay).toHaveClass(/open/);
  });

  test('global payment section is visible with payment options', async function ({ page }) {
    var globalSection = page.locator('.global-section');
    await expect(globalSection).toBeVisible();
    await expect(globalSection).toContainText('Ko-fi');
    await expect(globalSection).toContainText('Buy Me a Coffee');
    await expect(globalSection).toContainText('Wise');
  });

  test('popular card has Best Value badge', async function ({ page }) {
    var popularBadge = page.locator('.popular-badge');
    await expect(popularBadge).toBeVisible();
    await expect(popularBadge).toContainText('Best Value');
  });
});
