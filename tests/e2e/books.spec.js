// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Courses page', function () {
  test.beforeEach(async function ({ page }) {
    await page.route('**/api/courses', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          items: [
            { id: 1, title: 'Systems Thinking for Vision Builders', slug: 'systems-thinking', tagline: 'Understand how things really work - then change them.', description: 'A practical, self-paced course for vision builders.', price: 250, is_active: 1 },
          ],
        }),
      });
    });
    await page.goto('/courses/');
  });

  test('loads course cards from mocked API', async function ({ page }) {
    var cards = page.locator('.course-card, [class*=course] a[href*="/courses/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    var count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('each course card has a title', async function ({ page }) {
    var cards = page.locator('.course-card, [class*=course] a[href*="/courses/"]');
    var count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (var i = 0; i < Math.min(count, 3); i++) {
      var title = cards.nth(i).locator('h2, h3, [class*=title]');
      await expect(title.first()).toBeVisible();
    }
  });
});

test.describe('Homepage course promotion', function () {
  test('loads with course call-to-action buttons', async function ({ page }) {
    await page.goto('/');
    var btns = page.locator('button:has-text("Start Free"), a:has-text("Start Free"), a:has-text("Enroll Now")');
    var count = await btns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('links to the Systems Thinking course page', async function ({ page }) {
    await page.goto('/');
    var link = page.locator('a[href="/courses/systems-thinking/"]').first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  test('enroll button opens email modal', async function ({ page }) {
    await page.goto('/courses/systems-thinking/');
    var btn = page.locator('button:has-text("Enroll Now"), button:has-text("Start Free")').first();
    await btn.click();
    var modal = page.locator('#enrollModal, .enroll-overlay, [class*=enroll]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('enroll modal requires email', async function ({ page }) {
    await page.goto('/courses/systems-thinking/');
    await page.locator('button:has-text("Enroll Now")').first().click();
    var modal = page.locator('#enrollModal, .enroll-overlay').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('input[type="email"]')).toBeVisible();
    await expect(modal.locator('input[type="text"]').first()).toBeVisible();
  });
});