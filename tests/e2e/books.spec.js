// @ts-check
import { test, expect } from '@playwright/test';

var mockBooks = {
  status: 'ok',
  items: [
    { id: 1, title: 'The Bible as Kingdom OS', slug: 'the-bible-as-kingdom-os', description: 'Understanding Scripture as your operating system.', is_premium: 0, cover_url: '', price: 0, sort_order: 1 },
    { id: 2, title: 'The Divine Algorithm', slug: 'divine-algorithm', description: 'Seeing God\u2019s patterns in creation.', is_premium: 0, cover_url: '', price: 0, sort_order: 2 },
    { id: 3, title: 'Premium Bundle', slug: 'premium-bundle', description: 'All books plus exclusive content.', is_premium: 1, cover_url: '', price: 300, sort_order: 3 },
  ],
};

test.describe('Books page', function () {
  test.beforeEach(async function ({ page }) {
    await page.route('**/api/books', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBooks),
      });
    });
    await page.route('**/api/contact', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });
    await page.goto('/books/');
  });

  test('loads book cards from mocked API', async function ({ page }) {
    var cards = page.locator('.book-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    var count = await cards.count();
    expect(count).toBe(2); // only free books (premium-bundle excluded from free list)
  });

  test('each book card has a title', async function ({ page }) {
    var cards = page.locator('.book-card');
    var count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (var i = 0; i < count; i++) {
      var title = cards.nth(i).locator('h3');
      await expect(title).toBeVisible();
    }
  });

  test('download button opens email modal', async function ({ page }) {
    var btn = page.locator('.book-card .btn').first();
    await btn.click();
    var modal = page.locator('#leadModal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal).toHaveClass(/open/);
  });

  test('email modal shows book name', async function ({ page }) {
    var btn = page.locator('.book-card .btn').first();
    await btn.click();
    var bookName = page.locator('#leadBookName');
    await expect(bookName).toBeVisible();
    await expect(bookName).not.toBeEmpty();
  });

  test('premium bundle section loads with buy button', async function ({ page }) {
    var bundle = page.locator('#bundleSection, .bundle-card, [class*=bundle]');
    await expect(bundle).toBeVisible();
  });
});

test.describe('Homepage lead capture', function () {
  test('loads with book call-to-action buttons', async function ({ page }) {
    await page.goto('/');
    var btns = page.locator('button:has-text("Get Free Copy"), a:has-text("Get Free Copy")');
    var count = await btns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('lead button click opens email modal', async function ({ page }) {
    await page.goto('/');
    var btn = page.locator('button:has-text("Get Free Copy")').first();
    await btn.click();
    var modal = page.locator('#leadModal, .lead-overlay, [class*=lead]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });
});
