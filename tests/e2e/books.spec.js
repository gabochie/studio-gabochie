// @ts-check
import { test, expect } from '@playwright/test';

var mockCourses = {
  status: 'ok',
  items: [
    { id: 1, title: 'Systems Thinking for Vision Builders', slug: 'systems-thinking', tagline: 'Understand how things really work - then change them.', description: 'A practical, self-paced course for vision builders.', price: 250, is_active: 1, duration: '10 hrs', level: 'Beginner-friendly' },
  ],
};

test.describe('/start/ landing page', function () {
  test('loads and shows the start page content', async function ({ page }) {
    await page.goto('/start/');
    var heading = page.locator('h1, h2, [class*=title], [class*=heading]');
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test('has the email capture form', async function ({ page }) {
    await page.goto('/start/');
    var form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 5000 });
    var emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('nav is present and links to courses', async function ({ page }) {
    await page.goto('/start/');
    var nav = page.locator('nav, #nav-placeholder');
    await expect(nav).toBeVisible({ timeout: 10000 });
    var coursesLink = page.locator('a[href="/courses/"]').first();
    await expect(coursesLink).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Courses catalog page', function () {
  test.beforeEach(async function ({ page }) {
    await page.route('**/api/courses', async function (route) {
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