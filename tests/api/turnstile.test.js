import { describe, it, expect, afterEach, vi } from 'vitest';
import { verifyTurnstile, turnstileToken } from '../../functions/api/_turnstile.js';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as contactOnRequest } from '../../functions/api/contact.js';
import { onRequest as subscribeOnRequest } from '../../functions/api/subscribe.js';
import { onRequest as classifiedsOnRequest } from '../../functions/api/classifieds.js';

// Replace global fetch with a siteverify stub. Pass `{ networkError: true }`
// to simulate Cloudflare being unreachable.
function stubSiteverify(result, opts) {
  opts = opts || {};
  var spy = vi.fn(function () {
    if (opts.networkError) return Promise.reject(new Error('siteverify unreachable'));
    return Promise.resolve({ json: function () { return Promise.resolve(result); } });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

function postJson(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function contactRequest(fields) {
  var fd = new FormData();
  for (var key in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) fd.append(key, String(fields[key]));
  }
  return new Request('http://localhost/api/contact', { method: 'POST', body: fd });
}

describe('turnstile helpers', function () {
  afterEach(function () {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('turnstileToken', function () {
    it('reads the cf-turnstile-response field out of FormData', function () {
      var fd = new FormData();
      fd.append('cf-turnstile-response', 'tok-form');
      expect(turnstileToken(fd, 'form')).toBe('tok-form');
    });

    it('returns empty string when FormData has no token', function () {
      var fd = new FormData();
      fd.append('email', 'a@b.com');
      expect(turnstileToken(fd, 'form')).toBe('');
    });

    it('reads cf-turnstile-response out of a JSON body', function () {
      expect(turnstileToken({ email: 'a@b.com', 'cf-turnstile-response': 'tok-json' })).toBe('tok-json');
    });

    it('falls back to the cf_turnstile_token alias used by JSON forms', function () {
      expect(turnstileToken({ email: 'a@b.com', cf_turnstile_token: 'tok-alias' })).toBe('tok-alias');
    });

    it('prefers cf-turnstile-response over the alias', function () {
      expect(turnstileToken({ 'cf-turnstile-response': 'a', cf_turnstile_token: 'b' })).toBe('a');
    });

    it('returns empty string for a missing body', function () {
      expect(turnstileToken(null)).toBe('');
      expect(turnstileToken(undefined)).toBe('');
    });
  });

  describe('verifyTurnstile', function () {
    var request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.9' },
    });

    it('allows everything when TURNSTILE_SECRET is not configured', async function () {
      var spy = stubSiteverify({ success: true });
      expect(await verifyTurnstile({ }, request, '')).toBe(true);
      expect(await verifyTurnstile({ TURNSTILE_SECRET: '' }, request, '')).toBe(true);
      expect(await verifyTurnstile(undefined, request, '')).toBe(true);
      // Never reaches Cloudflare, so an unconfigured deploy cannot lock users out.
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects when the secret is set but no token was sent', async function () {
      var spy = stubSiteverify({ success: true });
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, '')).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects an empty token without calling siteverify', async function () {
      var spy = stubSiteverify({ success: true });
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, '   ')).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('allows when siteverify reports success', async function () {
      stubSiteverify({ success: true });
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok')).toBe(true);
    });

    it('rejects when siteverify reports failure', async function () {
      stubSiteverify({ success: false, 'error-codes': ['invalid-input-response'] });
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok')).toBe(false);
    });

    it('rejects an empty siteverify payload', async function () {
      stubSiteverify({});
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok')).toBe(false);
      stubSiteverify(null);
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok')).toBe(false);
    });

    it('fails open when siteverify is unreachable, matching checkRateLimit', async function () {
      stubSiteverify(null, { networkError: true });
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok')).toBe(true);
    });

    it('posts the secret, token and client ip to siteverify', async function () {
      var spy = stubSiteverify({ success: true });
      await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok');
      expect(spy).toHaveBeenCalledTimes(1);
      var url = spy.mock.calls[0][0];
      expect(url).toContain('challenges.cloudflare.com/turnstile/v0/siteverify');
      var init = spy.mock.calls[0][1];
      var params = new URLSearchParams(init.body);
      expect(params.get('secret')).toBe('sec');
      expect(params.get('response')).toBe('tok');
      expect(params.get('remoteip')).toBe('203.0.113.9');
    });

    it('omits remoteip when the request has no CF-Connecting-IP', async function () {
      var bare = new Request('http://localhost/api/contact', { method: 'POST' });
      var spy = stubSiteverify({ success: true });
      await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, bare, 'tok');
      var params = new URLSearchParams(spy.mock.calls[0][1].body);
      expect(params.has('remoteip')).toBe(false);
    });

    it('tolerates a request without headers', async function () {
      stubSiteverify({ success: true });
      expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, null, 'tok')).toBe(true);
    });
  });
});

describe('Turnstile enforcement on the public form endpoints', function () {
  afterEach(function () {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects a /api/contact submission with no token when the secret is set', async function () {
    stubSiteverify({ success: true });
    var ctx = buildContext('http://localhost/api/contact', {
      env: {
        DB: mockDb({ subscribers: [], contacts: [] }),
        TURNSTILE_SECRET: 'sec',
      },
    });
    ctx.request = contactRequest({ name: 'Spam', email: 'spam@bot.test', message: 'buy now' });
    var res = await contactOnRequest(ctx);
    expect(res.status).toBe(403);
    var body = await res.json();
    expect(body.message).toContain('CAPTCHA');
  });

  it('accepts a /api/contact submission with a valid token', async function () {
    stubSiteverify({ success: true });
    var ctx = buildContext('http://localhost/api/contact', {
      env: {
        DB: mockDb({ subscribers: [], contacts: [] }),
        TURNSTILE_SECRET: 'sec',
        BREVO_SMTP_KEY: 'smtp-key',
        BREVO_SMTP_SENDER: 'studio@gabochie.com',
        BREVO_SMTP_LOGIN: 'login',
        CONTACT_TO: 'studio@gabochie.com',
      },
    });
    ctx.request = contactRequest({
      name: 'Test User',
      email: 'test@example.com',
      message: 'Hello',
      'cf-turnstile-response': 'tok',
    });
    var res = await contactOnRequest(ctx);
    expect(res.status).toBe(200);
  });

  it('still accepts /api/contact with no token when no secret is configured', async function () {
    var ctx = buildContext('http://localhost/api/contact', {
      env: {
        DB: mockDb({ subscribers: [], contacts: [] }),
        BREVO_SMTP_KEY: 'smtp-key',
        BREVO_SMTP_SENDER: 'studio@gabochie.com',
        BREVO_SMTP_LOGIN: 'login',
        CONTACT_TO: 'studio@gabochie.com',
      },
    });
    ctx.request = contactRequest({ name: 'Test User', email: 'test@example.com', message: 'Hello' });
    var res = await contactOnRequest(ctx);
    expect(res.status).toBe(200);
  });

  it('rejects a /api/subscribe submission with no token when the secret is set', async function () {
    stubSiteverify({ success: true });
    var ctx = buildContext('http://localhost/api/subscribe', {
      env: { DB: mockDb({ subscribers: [] }), TURNSTILE_SECRET: 'sec' },
    });
    ctx.request = postJson('http://localhost/api/subscribe', { email: 'spam@bot.test' });
    var res = await subscribeOnRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('accepts a /api/subscribe submission with a valid token', async function () {
    stubSiteverify({ success: true });
    var ctx = buildContext('http://localhost/api/subscribe', {
      env: { DB: mockDb({ subscribers: [] }), TURNSTILE_SECRET: 'sec' },
    });
    ctx.request = postJson('http://localhost/api/subscribe', {
      email: 'real@example.com',
      cf_turnstile_token: 'tok',
    });
    var res = await subscribeOnRequest(ctx);
    expect(res.status).toBe(200);
  });

  it('rejects a /api/classifieds submission with no token when the secret is set', async function () {
    stubSiteverify({ success: true });
    var ctx = buildContext('http://localhost/api/classifieds', {
      env: { DB: mockDb({ classifieds: [] }), TURNSTILE_SECRET: 'sec' },
    });
    ctx.request = postJson('http://localhost/api/classifieds', {
      title: 'Spam listing',
      email: 'spam@bot.test',
    });
    var res = await classifiedsOnRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('allows a siteverify outage rather than blocking legitimate senders', async function () {
    stubSiteverify(null, { networkError: true });
    var ctx = buildContext('http://localhost/api/subscribe', {
      env: { DB: mockDb({ subscribers: [] }), TURNSTILE_SECRET: 'sec' },
    });
    ctx.request = postJson('http://localhost/api/subscribe', {
      email: 'real@example.com',
      cf_turnstile_token: 'tok',
    });
    var res = await subscribeOnRequest(ctx);
    expect(res.status).toBe(200);
  });
});
