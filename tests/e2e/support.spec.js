// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Support page', function () {
  test.beforeEach(async function ({ page }) {
    await page.goto('/support/');
  });

  test('shows the membership ladder section', async function ({ page }) {
    var title = page.locator('.tier-section .section-title');
    await expect(title).toBeVisible({ timeout: 10000 });
    await expect(title).toContainText('Membership Ladder');
  });

  test('subscribe button links to the membership page', async function ({ page }) {
    var btn = page.locator('.subscribe-btn');
    await expect(btn).toBeVisible();
    var href = await btn.getAttribute('href');
    expect(href).toBe('/membership/');
  });

  test('donate link points to the donation page', async function ({ page }) {
    var link = page.locator('a[href="/donate/"]').first();
    await expect(link).toBeVisible();
  });

  test('other ways section is visible with payment options', async function ({ page }) {
    var globalSection = page.locator('.global-section');
    await expect(globalSection).toBeVisible();
    await expect(globalSection).toContainText('Donation Page');
    await expect(globalSection).toContainText('Wise');
  });

  test('other payment button links to the donation page', async function ({ page }) {
    var donation = page.locator('.global-section a[href="/donate/"]');
    await expect(donation).toBeVisible();
    await expect(donation).toContainText('Donate Another Way');
  });

  test('FAQ section lists common questions', async function ({ page }) {
    var faq = page.locator('.faq-section');
    await expect(faq).toBeVisible();
    var items = page.locator('.faq-item');
    var count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('sponsor registration form is present', async function ({ page }) {
    var sponsor = page.locator('#sponsor');
    await expect(sponsor).toBeVisible();
    await expect(page.locator('#sponsorForm')).toBeVisible();
  });

  test('sponsor form has required fields and submit button', async function ({ page }) {
    await expect(page.locator('#spName')).toBeVisible();
    await expect(page.locator('#spEmail')).toBeVisible();
    var submit = page.locator('#sponsorForm button[type="submit"]');
    await expect(submit).toBeVisible();
    await expect(submit).toContainText('Sponsor Code');
  });
});