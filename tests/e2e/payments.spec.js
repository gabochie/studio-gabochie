// @ts-check
import { test, expect } from '@playwright/test';

// ExpressPay appends "?order-id=..." to our return URL, tacking junk onto the last
// param the server appends (see functions/api/gateways/expresspay/create.js, which
// ends the return URL with "&status=pending"). So the value arrives as
// "status=pending?order-id=x". These receipts must still resolve, not show failure.
test.describe('Payment return URLs tolerate ExpressPay order-id', function () {
  test('donate receipt shows pending, not failure', async function ({ page }) {
    var tx = 'donate_test123';
    await page.goto('/donate/?tx_ref=' + tx + '&status=pending?order-id=' + tx + '&');
    await expect(page.locator('#receiptView')).toBeVisible();
    await expect(page.locator('#rTxRef')).toContainText(tx);
    await expect(page.locator('#rStatus')).toHaveText('Pending confirmation');
    await expect(page.locator('#receiptTitle')).not.toContainText('Payment Failed');
  });

  test('merch return still starts ExpressPay confirmation polling', async function ({ page }) {
    var order = 'store_test123';
    var req = page.waitForRequest(
      function (r) { return r.url().indexOf('/api/gateways/expresspay/status') >= 0; },
      { timeout: 15000 }
    );
    await page.goto('/merch/?order=' + order + '&tx_ref=' + order + '&status=pending?order-id=' + order + '&');
    await req;
  });
});
