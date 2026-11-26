import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as cron } from '../../functions/api/email/cron.js';
import { assertReadOnlySql } from '../../functions/api/agents/run.js';
import { runDueWorkflows } from '../../functions/api/agents/_workflows.js';

var realFetch;
beforeEach(function () { realFetch = globalThis.fetch; });
afterEach(function () { globalThis.fetch = realFetch; });

function cronCtx(url, headers, db, extraEnv) {
  return buildContext(url, {
    method: 'GET',
    env: Object.assign({
      DB: db,
      CRON_SECRET: 's3',
      BREVO_API_KEY: 'brevo-key',
      WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
      WHATSAPP_ACCESS_TOKEN: 'wa-token'
    }, extraEnv || {}),
    request: new Request(url, { headers: headers || {} })
  });
}

function emptyDb(overrides) {
  return mockDb(Object.assign({
    events: [], enrollments: [], programs: [], users: [], subscribers: [],
    email_queue: [], whatsapp_queue: [], newsletter_issues: [], newsletter_outbox: [],
    newsletter_schedule: [], posts: [], social_queue: [], settings: [], lotl_daily_sends: [],
    donations: [], subscriptions: [], store_orders: [], book_purchases: []
  }, overrides || {}));
}

describe('cron authentication (DAT-18)', function () {
  it('rejects ?secret= and accepts only the X-Cron-Secret header', async function () {
    var db = emptyDb();
    var bad = await cron(cronCtx('http://localhost/api/email/cron?secret=s3', {}, db));
    expect(bad.status).toBe(401);
    var good = await cron(cronCtx('http://localhost/api/email/cron', { 'X-Cron-Secret': 's3' }, db));
    expect(good.status).toBe(200);
  });

  it('surfaces a missing Brevo key instead of silently dropping pending mail', async function () {
    var db = emptyDb({
      email_queue: [{ id: 1, to_email: 'a@t.co', subject: 'Hi', html_content: '<p>x</p>', status: 'pending', scheduled_at: '2000-01-01 00:00:00', retry_count: 0 }]
    });
    var res = await cron(cronCtx('http://localhost/api/email/cron', { 'X-Cron-Secret': 's3' }, db, { BREVO_API_KEY: '' }));
    var data = await res.json();
    expect(res.status).toBe(200);
    expect(data.errors.join(' ')).toContain('BREVO_API_KEY is missing');
  });

  it('retries a failed WhatsApp send with backoff instead of marking it sent', async function () {
    globalThis.fetch = async function (url) {
      if (String(url).includes('graph.facebook.com')) return new Response('bad request', { status: 400 });
      return new Response(JSON.stringify({ messageId: 'm' }), { status: 200 });
    };
    var db = emptyDb({
      whatsapp_queue: [{ id: 4, to_phone: '+233241234567', message_text: 'Hi', status: 'pending', scheduled_at: '2000-01-01 00:00:00', attempts: 0 }]
    });
    var res = await cron(cronCtx('http://localhost/api/email/cron', { 'X-Cron-Secret': 's3' }, db));
    expect(res.status).toBe(200);
    var row = db._tables.whatsapp_queue[0];
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(1);
    expect(row.last_error).toContain('WhatsApp 400');
  });
});

describe('agent query hardening', function () {
  it('rejects writes, stacked statements and oversized SELECTs', function () {
    expect(function () { assertReadOnlySql('DELETE FROM users'); }).toThrow(/SELECT/);
    expect(function () { assertReadOnlySql('SELECT 1; DROP TABLE posts'); }).toThrow(/Multi-statement/);
    expect(assertReadOnlySql('SELECT * FROM posts LIMIT 500')).toContain('LIMIT 100');
    expect(assertReadOnlySql('SELECT * FROM posts')).toContain('LIMIT 100');
  });
});

describe('workflow claim guard', function () {
  it('does not enqueue the same workflow twice for overlapping ticks', async function () {
    var workflow = {
      id: 1, name: 'Hourly', status: 'active', trigger_type: 'interval',
      trigger_config: '{"every":"1h"}', last_run_at: '', total_runs: 0
    };
    var steps = [{ id: 1, workflow_id: 1, agent_type: 'content', step_order: 1, config: '{}' }];
    var queue = [];
    var db = {
      prepare(sql) {
        var chain = {
          _bound: [],
          bind() { chain._bound = Array.prototype.slice.call(arguments); return chain; },
          async all() {
            if (/FROM workflows/i.test(sql)) return { results: [Object.assign({}, workflow)] };
            if (/FROM workflow_steps/i.test(sql)) return { results: steps };
            return { results: [] };
          },
          async first() { return null; },
          async run() {
            if (/^INSERT INTO agent_queue/i.test(sql)) {
              queue.push({ agent_type: chain._bound[0], workflow_id: chain._bound[1] });
              return { success: true, meta: { changes: 1 } };
            }
            if (/^UPDATE workflows/i.test(sql)) {
              var expected = chain._bound[1];
              if (workflow.last_run_at !== expected && workflow.last_run_at != null) {
                return { success: true, meta: { changes: 0 } };
              }
              workflow.last_run_at = '2026-01-01 10:00:00';
              workflow.total_runs++;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
        };
        return chain;
      }
    };
    var first = await runDueWorkflows(db, new Date('2026-01-01T10:30:00Z'));
    var second = await runDueWorkflows(db, new Date('2026-01-01T10:31:00Z'));
    expect(first.enqueued).toBe(1);
    expect(second.enqueued).toBe(0);
    expect(queue).toHaveLength(1);
  });
});
