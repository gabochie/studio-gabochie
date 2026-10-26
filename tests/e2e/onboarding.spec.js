// @ts-check
import { test, expect } from '@playwright/test';

// Full-stack E2E for the onboarding + payment flows. Unlike the legacy specs
// (which run against the static server in CI), these drive the REAL backend:
// D1 + the ExpressPay mock gateway (scripts/mock-expresspay.cjs). They need
// `wrangler pages dev` on 8788 and the mock on 8790 — when either is missing
// (e.g. CI's static serve) the whole suite skips itself.
async function stackUp(request) {
  try {
    const api = await request.get('/api/db/ping', { timeout: 4000 });
    const mock = await request.get('http://localhost:8790/__tokens', { timeout: 4000 });
    return api.ok() && mock.ok();
  } catch (_e) {
    return false;
  }
}

test.describe('Guitar — onboarding', function () {
  test('landing page renders with the Amazing Grace song-sheet promise', async function ({ page }) {
    await page.goto('/guitar/');
    await expect(page.locator('h1')).toBeVisible();
    var body = await page.locator('body').innerText();
    expect(body).toContain('Amazing Grace');
  });

  test('register modal creates a student session and redirects to the waitlist', async function ({ page, request }) {
    test.skip(!(await stackUp(request)), 'full API stack not available');
    await page.goto('/guitar/');
    await page.evaluate(function () { Guitar.showRegisterModal(); });
    var form = page.locator('#register-form');
    await expect(form).toBeVisible();
    await form.locator('input[name="name"]').fill('E2E Browser User');
    await form.locator('input[name="email"]').fill('e2e-browser-' + Date.now() + '@test.gabochie.com');
    await page.locator('#reg-submit').click();
    await page.waitForURL('**/guitar/waitlist/?registered=1', { timeout: 15000 });
    var stored = await page.evaluate(function () {
      return { token: localStorage.getItem('ga_token'), student: localStorage.getItem('ga_student') };
    });
    expect(stored.token).toBeTruthy();
    expect(JSON.parse(stored.student).name).toBe('E2E Browser User');
  });
});

test.describe('Guitar — bronze payment through the mock gateway (browser)', function () {
  test('plan sheet -> hosted checkout -> pay -> settle -> course unlocked', async function ({ page, request }) {
    test.skip(!(await stackUp(request)), 'full API stack not available');
    await request.fetch('http://localhost:8790/__reset', { method: 'POST' });

    // Seed a registered student the way the register modal would.
    var email = 'e2e-pay-' + Date.now() + '@test.gabochie.com';
    var reg = await (await page.request.post('/api/guitar/register', {
      data: { name: 'E2E Payer', email: email }
    })).json();
    await page.addInitScript(function (seed) {
      localStorage.setItem('ga_token', seed.token);
      localStorage.setItem('ga_student', JSON.stringify(seed.user));
    }, reg);
    await page.goto('/guitar/learn/');
    await page.waitForLoadState('load');
    await page.waitForFunction(function () { return typeof Guitar === 'object'; });

    // Open the plan sheet and pay for Bronze with ExpressPay.
    await page.evaluate(function () { Guitar.openPlanSheet({ owned: 'none' }); });
    var payBtn = page.locator('.sheet button', { hasText: 'Pay' }).first();
    await expect(payBtn).toBeVisible();

    // Real navigation to the mock hosted checkout, then the buyer pays.
    await Promise.all([
      page.waitForURL(/localhost:8790/, { timeout: 20000 }),
      payBtn.click()
    ]);
    await expect(page.locator('#pay')).toBeVisible();
    await page.click('#pay');

    // Back on the learn page with the settlement already banked server-side.
    await page.waitForURL('**/guitar/learn/?**tx_ref=**', { timeout: 20000 });
    var status = await page.evaluate(async function () {
      var t = localStorage.getItem('ga_token');
      var r = await fetch('/api/guitar/enroll/status', { headers: { Authorization: 'Bearer ' + t } });
      return r.json();
    });
    expect(status.bronzeUnlocked).toBe(true);
    expect(status.tier).toBe('bronze');
  });
});

test.describe('Church — give flow through the mock gateway (browser)', function () {
  test('donation -> hosted checkout -> pay -> receipt Confirmed', async function ({ page, request }) {
    test.skip(!(await stackUp(request)), 'full API stack not available');
    await page.goto('/love-of-the-lord/give/');
    await expect(page.locator('#giveFormView')).toBeVisible();
    // First preset amount is pre-selected; identify the anonymous donor.
    await page.fill('#giveName', 'E2E Donor');
    await page.fill('#giveEmail', 'e2e-give-' + Date.now() + '@test.gabochie.com');

    await Promise.all([
      page.waitForURL(/localhost:8790/, { timeout: 20000 }),
      page.click('#giveBtn')
    ]);
    await expect(page.locator('#pay')).toBeVisible();
    await page.click('#pay');

    // Redirect lands on the give receipt; settlement already ran, so the
    // status poll resolves to Confirmed without a retry loop.
    await page.waitForURL('**/love-of-the-lord/give/?**tx_ref=**', { timeout: 20000 });
    await expect(page.locator('#receiptView')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#rTxRef')).not.toHaveText('-');
    await expect(page.locator('#receiptTitle')).not.toContainText('Payment Failed');
    await expect(page.locator('#rStatus')).toContainText(/Confirmed|successful/i, { timeout: 30000 });
  });
});
