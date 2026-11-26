import { describe, it, expect, vi } from 'vitest';
import { onRequest } from '../../functions/api/services/inquiry.js';
import { mockDb } from '../helpers/mock-cf.js';

// These tests exercise inquiry storage, not CAPTCHA. Stub the verifier so they
// do not depend on the old fail-open-without-secret behaviour.
vi.mock('../../functions/api/_turnstile.js', function () {
  return { verifyTurnstile: vi.fn(async function () { return true; }), turnstileToken: function () { return ''; } };
});

function post(fields) {
  return new Request('https://studio.gabochie.com/api/services/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString()
  });
}

describe('POST /api/services/inquiry', function () {
  it('stores raw fields but escapes them in the admin notification email', async function () {
    var db = mockDb();
    var res = await onRequest({
      request: post({
        service: 'Consultation — Anchor Session',
        name: 'Ama',
        email: 'ama@example.com',
        description: '<script>alert(1)</script> & "quotes"',
        referral: 'money-ghana-assessment'
      }),
      env: { DB: db }
    });
    expect(res.status).toBe(200);

    var saved = (db._tables.service_inquiries || [])[0];
    expect(saved.referral).toBe('money-ghana-assessment');
    expect(saved.description).toContain('<script>'); // raw value is safe in D1 (bound param)

    var mail = (db._tables.email_queue || [])[0];
    expect(mail).toBeDefined();
    expect(mail.html_content).toContain('New Service Inquiry');
    expect(mail.html_content).not.toContain('<script>');
    expect(mail.html_content).toContain('&lt;script&gt;');
    expect(mail.html_content).toContain('&amp; &quot;quotes&quot;');
  });
});
