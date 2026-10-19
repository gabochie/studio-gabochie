import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { processEmailQueue } from '../../functions/api/email/_process-queue.js';
import { onRequest as processEndpoint } from '../../functions/api/email/process.js';

function queueRow(over) {
  return Object.assign({
    id: 1,
    to_email: 'a@t.co',
    to_name: 'Ama',
    subject: 'Hi',
    html_content: '<html><body><p>Hello <a href="https://example.com/x">x</a></p></body></html>',
    email_type: 'broadcast',
    scheduled_at: '2000-01-01 00:00:00',
    sent_at: null,
    status: 'pending',
    retry_count: 0
  }, over || {});
}

function liveEnv(extra) {
  return Object.assign({
    BREVO_API_KEY: 'brevo-key',
    PUBLIC_BASE_URL: 'https://studio.gabochie.com',
    UNSUBSCRIBE_SECRET: 'sec'
  }, extra || {});
}

var realFetch;
beforeEach(function () { realFetch = globalThis.fetch; });
afterEach(function () { globalThis.fetch = realFetch; });

describe('email queue processor (shared)', function () {
  it('injects unsubscribe footer + open pixel, rewrites links, stores provider id', async function () {
    var sent = [];
    globalThis.fetch = async function (url, opts) {
      sent.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({ messageId: 'msg-1' }), { status: 200 });
    };
    var db = mockDb({ email_queue: [queueRow({ id: 7 })], suppression_list: [] });

    var summary = await processEmailQueue(liveEnv(), db);

    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(sent).toHaveLength(1);
    var html = sent[0].htmlContent;
    expect(html).toContain('/api/track/open?mid=7');
    expect(html).toContain('/api/outreach/unsubscribe');
    expect(html).toContain('/api/track/click?url=');
    expect(html).not.toContain('href="https://example.com/x"');
    expect(sent[0].tags).toEqual(['broadcast']);
    expect(db._tables.email_queue[0].status).toBe('sent');
    expect(db._tables.email_queue[0].provider_id).toBe('msg-1');
  });

  it('skips suppressed recipients', async function () {
    var sentTo = [];
    globalThis.fetch = async function (url, opts) {
      sentTo.push(JSON.parse(opts.body).to[0].email);
      return new Response(JSON.stringify({ messageId: 'm' }), { status: 200 });
    };
    var db = mockDb({
      email_queue: [
        queueRow({ id: 1, to_email: 'bad@t.co' }),
        queueRow({ id: 2, to_email: 'good@t.co' })
      ],
      suppression_list: [{ email: 'bad@t.co', reason: 'bounce' }]
    });

    var summary = await processEmailQueue(liveEnv(), db);

    expect(summary.sent).toBe(1);
    expect(sentTo).toEqual(['good@t.co']);
    expect(db._tables.email_queue[0].status).toBe('pending');
    expect(db._tables.email_queue[1].status).toBe('sent');
  });

  it('retries transient failures with backoff', async function () {
    globalThis.fetch = async function () {
      return new Response('boom', { status: 500 });
    };
    var db = mockDb({ email_queue: [queueRow({ id: 3, retry_count: 0 })], suppression_list: [] });

    var summary = await processEmailQueue(liveEnv(), db);

    expect(summary.sent).toBe(0);
    expect(summary.failed).toBe(0);
    expect(db._tables.email_queue[0].status).toBe('pending');
    expect(db._tables.email_queue[0].retry_count).toBe(1);
    expect(db._tables.email_queue[0].last_error).toContain('Brevo 500');
  });

  it('dead-letters after the max retries', async function () {
    globalThis.fetch = async function () {
      return new Response('boom', { status: 500 });
    };
    var db = mockDb({ email_queue: [queueRow({ id: 4, retry_count: 2 })], suppression_list: [] });

    var summary = await processEmailQueue(liveEnv(), db);

    expect(summary.failed).toBe(1);
    expect(db._tables.email_queue[0].status).toBe('failed');
    expect(db._tables.email_queue[0].retry_count).toBe(3);
  });

  it('honours the daily cap without sending', async function () {
    var sentCount = 0;
    globalThis.fetch = async function () {
      sentCount++;
      return new Response(JSON.stringify({ messageId: 'm' }), { status: 200 });
    };
    var sent = [];
    for (var i = 0; i < 300; i++) {
      sent.push(queueRow({ id: 1000 + i, status: 'sent', sent_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }));
    }
    var db = mockDb({ email_queue: sent.concat([queueRow({ id: 9 })]), suppression_list: [] });

    var summary = await processEmailQueue(liveEnv(), db);

    expect(summary.skipped_limited).toBe(true);
    expect(summary.sent).toBe(0);
    expect(sentCount).toBe(0);
    expect(db._tables.email_queue[300].status).toBe('pending');
  });

  it('no-ops without a Brevo key', async function () {
    var db = mockDb({ email_queue: [queueRow({ id: 1 })], suppression_list: [] });
    var summary = await processEmailQueue({}, db);
    expect(summary.sent).toBe(0);
    expect(db._tables.email_queue[0].status).toBe('pending');
  });
});

describe('email queue endpoint auth', function () {
  it('rejects anonymous callers', async function () {
    var db = mockDb({ email_queue: [], suppression_list: [] });
    var ctx = buildContext('http://localhost/api/email/process?list=1', {
      method: 'GET',
      env: { DB: db, ADMIN_API_KEY: 'admin-key' },
      request: new Request('http://localhost/api/email/process?list=1')
    });
    var res = await processEndpoint(ctx);
    expect(res.status).toBe(403);
  });

  it('lists the queue for admins', async function () {
    var db = mockDb({ email_queue: [queueRow({ id: 5 })], suppression_list: [] });
    var ctx = buildContext('http://localhost/api/email/process?list=1', {
      method: 'GET',
      env: { DB: db, ADMIN_API_KEY: 'admin-key' },
      request: new Request('http://localhost/api/email/process?list=1', {
        headers: { 'X-Admin-Key': 'admin-key' }
      })
    });
    var res = await processEndpoint(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.count).toBe(1);
    expect(data.items[0].id).toBe(5);
  });

  it('drains the queue through the shared processor for admins', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ messageId: 'm' }), { status: 200 });
    };
    var db = mockDb({ email_queue: [queueRow({ id: 6 })], suppression_list: [] });
    var ctx = buildContext('http://localhost/api/email/process', {
      method: 'POST',
      env: { DB: db, ADMIN_API_KEY: 'admin-key', BREVO_API_KEY: 'k', PUBLIC_BASE_URL: 'https://studio.gabochie.com' },
      request: new Request('http://localhost/api/email/process', {
        method: 'POST',
        headers: { 'X-Admin-Key': 'admin-key' }
      })
    });
    var res = await processEndpoint(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.sent).toBe(1);
    expect(db._tables.email_queue[0].status).toBe('sent');
  });
});
