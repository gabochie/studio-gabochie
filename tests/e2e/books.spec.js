// @ts-check
import { test, expect } from '@playwright/test';

var mockCourses = {
  status: 'ok',
  programs: [
    { id: 1, title: 'Systems Thinking for Vision Builders', slug: 'systems-thinking', tagline: 'Understand how things really work - then change them.', description: 'A practical, self-paced course for vision builders.', price: 250, status: 'active', duration: '10 hrs' },
  ],
};

test.describe('Courses catalog page', function () {
  test.beforeEach(async function ({ page }) {
    await page.route('**/api/programs', async function (route) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCourses),
      });
    });
  });

  test('loads and shows the courses heading', async function ({ page }) {
    await page.goto('/courses/');
    var heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test('has a link to the Systems Thinking course', async function ({ page }) {
    await page.goto('/courses/');
    var link = page.locator('a[href*="/courses/systems-thinking"]').first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Systems Thinking course page', function () {
  test('loads with hero heading', async function ({ page }) {
    await page.goto('/courses/systems-thinking/');
    var heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(heading).toContainText('Systems Thinking');
  });

  test('shows price card', async function ({ page }) {
    await page.goto('/courses/systems-thinking/');
    var price = page.locator('#priceValue, .price');
    await expect(price.first()).toBeVisible({ timeout: 10000 });
  });

  test('enroll button opens the enroll modal', async function ({ page }) {
    await page.goto('/courses/systems-thinking/');
    var btn = page.locator('button:has-text("Enroll Now"), button:has-text("Start Free")').first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    var modal = page.locator('#enrollModal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('curriculum section is visible', async function ({ page }) {
    await page.goto('/courses/systems-thinking/');
    var section = page.locator('#curriculum');
    await expect(section).toBeVisible({ timeout: 10000 });
  });
});