import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { confirmSubscription, assessmentWelcome } from '../../functions/api/email/_send.js';
import { onRequest as onConfirm } from '../../functions/api/subscribe/confirm.js';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

var GUIDE_URL = 'https://studio.gabochie.com/money-ghana/guide/';
var CONFIRM_URL = 'https://studio.gabochie.com/api/subscribe/confirm?token=abc123';

describe('money-ghana assessment emails', function () {
  it('keeps the standard confirmation email unchanged by default', function () {
    var html = confirmSubscription('Ama', CONFIRM_URL);
    expect(html).toContain('Confirm Your');
    expect(html).toContain('The Studio Weekly');
    expect(html).not.toContain(GUIDE_URL);
    expect(html).toContain(CONFIRM_URL);
  });

  it('makes the confirmation email assessment-specific when flagged', function () {
    var html = confirmSubscription('Ama', CONFIRM_URL, true);
    expect(html).toContain('Income Guide');
    expect(html).toContain('Online Income Assessment');
    expect(html).toContain('24-path guide');
    expect(html).toContain(CONFIRM_URL);
    expect(html).not.toContain('The Studio Weekly');
  });

  it('delivers the printable guide link in the assessment welcome email', function () {
    var html = assessmentWelcome('Kwame', 'GA-ABC123');
    expect(html).toContain(GUIDE_URL);
    expect(html).toContain('Open Your Free Guide');
    expect(html).toContain('https://studio.gabochie.com/money-ghana/');
    expect(html).toContain('GA-ABC123');
    expect(html).toContain('24 legal, ethical ways to make money online in Ghana');
  });

  it('omits the referral block when no ref code is present', function () {
    var html = assessmentWelcome('', '');
    expect(html).toContain(GUIDE_URL);
    expect(html).not.toContain('Your Referral Link');
  });
});

describe('confirmation handler for assessment leads', function () {
  var calls;

  beforeEach(function () {
    calls = [];
    vi.stubGlobal('fetch', async function (url, opts) {
      calls.push({ url: String(url), body: JSON.parse(opts.body) });
      return { ok: true, json: async function () { return {}; } };
    });
  });

  afterEach(function () {
    vi.unstubAllGlobals();
  });

  function contextFor(source) {
    return buildContext('http://localhost/api/subscribe/confirm?token=tok123', {
      env: {
        BREVO_API_KEY: 'test-key',
        DB: mockDb({
          subscribers: [{
            id: 1, name: 'Ama', email: 'ama@example.com', ref_code: 'GA-ABC123',
            edition: 'GH', confirmed: 0, confirm_token: 'tok123', source: source
          }],
          email_queue: []
        })
      }
    });
  }

  it('sends the guide and preserves the source attribute', async function () {
    var res = await onConfirm(contextFor('money-ghana-assessment'));
    expect(res.status).toBe(200);
    var contact = calls.filter(function (c) { return c.url.indexOf('/v3/contacts') !== -1; })[0];
    expect(contact.body.attributes.SOURCE).toBe('money-ghana-assessment');
    var mail = calls.filter(function (c) { return c.url.indexOf('/v3/smtp/email') !== -1; })[0];
    expect(mail.body.subject).toBe('Your Ghana income guide is ready');
    expect(mail.body.htmlContent).toContain(GUIDE_URL);
  });

  it('leaves ordinary newsletter leads unchanged', async function () {
    var res = await onConfirm(contextFor('start-page'));
    expect(res.status).toBe(200);
    var contact = calls.filter(function (c) { return c.url.indexOf('/v3/contacts') !== -1; })[0];
    expect(contact.body.attributes.SOURCE).toBe('start-page');
    var mail = calls.filter(function (c) { return c.url.indexOf('/v3/smtp/email') !== -1; })[0];
    expect(mail.body.subject).toBe('Welcome to The Studio Weekly!');
    expect(mail.body.htmlContent).not.toContain(GUIDE_URL);
  });
});
