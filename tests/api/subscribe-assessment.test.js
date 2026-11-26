import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

// These tests exercise the assessment funnel, not CAPTCHA. Stub the verifier
// so they do not depend on the old fail-open-without-secret behaviour.
vi.mock('../../functions/api/_turnstile.js', function () {
  return { verifyTurnstile: vi.fn(async function () { return true; }), turnstileToken: function () { return ''; } };
});
import { onRequest as onSubscribe } from '../../functions/api/subscribe.js';
import { onRequest as onConfirm } from '../../functions/api/subscribe/confirm.js';

var EMAIL = 'lead@example.com';

function postJson(data) {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function assessmentPayload(overrides) {
  return Object.assign({
    name: 'Ama',
    email: EMAIL,
    source: 'money-ghana-assessment',
    utm_source: 'instagram',
    utm_medium: 'social',
    utm_campaign: 'assessment-d24',
    utm_content: 'reel-1',
    utm_term: 'income-ghana',
    profile: 'student',
    setup: 'phone',
    capital: 'zero',
    top_path: 'Freelance writing',
    cf_turnstile_token: 'token'
  }, overrides || {});
}

function subscriber(overrides) {
  return Object.assign({
    id: 1, name: 'Ama', email: EMAIL, source: 'start-page', ref_code: 'GA-ABC123',
    edition: 'GH', confirmed: 1, confirm_token: 'tok123', metadata: JSON.stringify({ country: 'GH' })
  }, overrides || {});
}

describe('assessment signups for existing subscribers', function () {
  var calls;

  beforeEach(function () {
    calls = [];
    vi.stubGlobal('fetch', async function (url, opts) {
      calls.push({ url: String(url), body: JSON.parse(opts.body) });
      return { ok: true, json: async function () { return {}; } };
    });
  });

  afterEach(function () { vi.unstubAllGlobals(); });

  function contextFor(rows) {
    return buildContext('http://localhost/api/subscribe', {
      env: {
        BREVO_API_KEY: 'test-key',
        DB: mockDb({ subscribers: rows, email_queue: [], events: [], referrals: [] })
      }
    });
  }

  function smtpCalls() {
    return calls.filter(function (c) { return c.url.indexOf('/v3/smtp/email') !== -1; });
  }

  it('sends the guide and queues the consultation ladder once for a confirmed lead', async function () {
    var ctx = contextFor([subscriber()]);
    ctx.request = postJson(assessmentPayload());
    var res = await onSubscribe(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.message).toMatch(/inbox/);

    var row = ctx.env.DB._tables.subscribers[0];
    expect(row.source).toBe('money-ghana-assessment');
    var meta = JSON.parse(row.metadata);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      expect(meta[key]).toBeTruthy();
    });
    expect(meta.assessment_profile).toBe('student');
    expect(meta.assessment_top_path).toBe('Freelance writing');
    expect(meta.top_path).toBe('Freelance writing');
    expect(meta.country).toBe('GH'); // existing metadata preserved
    expect(meta.assessment_welcome_sent).toBe(1);

    expect(smtpCalls().length).toBe(1);
    expect(smtpCalls()[0].body.subject).toBe('Your Ghana income guide is ready');
    expect(smtpCalls()[0].body.htmlContent).toContain('/money-ghana/guide/');
    var queued = ctx.env.DB._tables.email_queue.filter(function (q) { return q.email_type === 'welcome_followup'; });
    expect(queued.length).toBe(1);
    expect(queued[0].subject).toBe('From your income guide to one clear plan');

    // A duplicate assessment submission must not send or queue again.
    ctx.request = postJson(assessmentPayload({ utm_campaign: 'assessment-d25' }));
    await onSubscribe(ctx);
    expect(ctx.env.DB._tables.subscribers.length).toBe(1);
    expect(smtpCalls().length).toBe(1);
    expect(ctx.env.DB._tables.email_queue.filter(function (q) { return q.email_type === 'welcome_followup'; }).length).toBe(1);
    expect(JSON.parse(ctx.env.DB._tables.subscribers[0].metadata).utm_campaign).toBe('assessment-d25');
  });

  it('updates a pending subscriber so confirmation queues the assessment ladder', async function () {
    var ctx = contextFor([subscriber({ confirmed: 0, confirm_token: 'tok123' })]);
    ctx.request = postJson(assessmentPayload());
    var res = await onSubscribe(ctx);
    expect(res.status).toBe(200);

    var row = ctx.env.DB._tables.subscribers[0];
    expect(row.source).toBe('money-ghana-assessment');
    var meta = JSON.parse(row.metadata);
    expect(meta.assessment_source).toBe(1);
    expect(meta.utm_term).toBe('income-ghana');
    expect(meta.assessment_capital).toBe('zero');
    expect(calls.filter(function (c) { return c.url.indexOf('/v3/smtp/email') !== -1; })[0].body.subject)
      .toBe('Confirm your email — get your Ghana income guide');

    var confirmRes = await onConfirm({
      request: new Request('http://localhost/api/subscribe/confirm?token=tok123'),
      env: ctx.env
    });
    expect(confirmRes.status).toBe(200);
    var followups = ctx.env.DB._tables.email_queue.filter(function (q) { return q.email_type === 'welcome_followup'; });
    expect(followups.length).toBe(1);
    expect(followups[0].subject).toBe('From your income guide to one clear plan');
  });

  it('persists all five UTMs and profile answers for a new assessment subscriber', async function () {
    var ctx = contextFor([]);
    ctx.request = postJson(assessmentPayload());
    var res = await onSubscribe(ctx);
    expect(res.status).toBe(200);
    var meta = JSON.parse(ctx.env.DB._tables.subscribers[0].metadata);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      expect(meta[key]).toBeTruthy();
    });
    expect(meta.assessment_source).toBe(1);
    expect(meta.assessment_setup).toBe('phone');
    expect(meta.profile).toBe('student');
  });
});
