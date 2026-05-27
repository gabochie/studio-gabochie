// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Support page', function () {
  test.beforeEach(async function ({ page }) {
    await page.goto('/support/');
  });

  test('loads tier cards', async function ({ page }) {
    var cards = page.locator('.tier-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    var count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('shows GH¢ prices by default', async function ({ page }) {
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('GH¢', { timeout: 10000 });
  });

  test('currency toggle buttons are visible', async function ({ page }) {
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
    await expect(price).toContainText('$', { timeout: 10000 });
  });

  test('clicking EUR switches main prices to euro', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(2).click();
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('\u20AC', { timeout: 10000 });
  });

  test('clicking GBP switches main prices to pound', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(3).click();
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('\u00A3', { timeout: 10000 });
  });

  test('active class moves between toggle buttons', async function ({ page }) {
    var btns = page.locator('#currencyToggle .currency-btn');
    // Click USD
    await btns.nth(1).click();
    await expect(btns.nth(0)).not.toHaveClass(/active/);
    await expect(btns.nth(1)).toHaveClass(/active/);
    // Click EUR
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

  test('small converted line is visible below each price', async function ({ page }) {
    var converted = page.locator('.tier-converted').first();
    await expect(converted).toBeVisible({ timeout: 10000 });
  });

  test('converted line updates when currency toggles', async function ({ page }) {
    // Get initial converted text
    var converted = page.locator('.tier-converted').first();
    var originalText = await converted.textContent();
    // Toggle to USD
    await page.locator('#currencyToggle .currency-btn').nth(1).click();
    var newText = await converted.textContent();
    expect(newText).not.toBe(originalText);
    // Toggle back
    await page.locator('#currencyToggle .currency-btn').nth(0).click();
    var backText = await converted.textContent();
    expect(backText).toBe(originalText);
  });

  test('toggles back to GHS correctly after switching', async function ({ page }) {
    await page.locator('#currencyToggle .currency-btn').nth(1).click();
    await page.locator('#currencyToggle .currency-btn').nth(0).click();
    var price = page.locator('.tier-price').first();
    await expect(price).toContainText('GH¢');
  });

  test('subscribe button opens form modal', async function ({ page }) {
    var btn = page.locator('.subscribe-btn').first();
    await btn.click();
    var overlay = page.locator('#formOverlay');
    await expect(overlay).toHaveClass(/open/);
  });

  test('global payment section is visible', async function ({ page }) {
    var globalSection = page.locator('.global-section');
    await expect(globalSection).toBeVisible();
    await expect(globalSection).toContainText('Ko-fi');
    await expect(globalSection).toContainText('Buy Me a Coffee');
    await expect(globalSection).toContainText('Wise');
  });
});
