import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as broadcast } from '../../functions/admin/api/newsletter/send.js';
import { onRequest as emailCron } from '../../functions/api/email/cron.js';

function adminPost(url, body) {
  return buildContext(url, {
    method: 'POST',
    env: {},
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'admin-key' },
      body: JSON.stringify(body)
    })
  });
}

describe('newsletter batched outbox (phase 1)', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('broadcast enqueues instead of sending inline', async function () {
    var db = mockDb({
      subscribers: [
        { email: 'a@t.co', name: 'Ama', edition: 'GH', ref_code: 'GA-1', confirmed: 1 },
        { email: 'b@t.co', name: 'Ben', edition: 'UK', ref_code: 'GA-2', confirmed: 1 }
      ],
      newsletter_issues: [],
      newsletter_outbox: []
    });
    var ctx = adminPost('http://localhost/admin/api/newsletter/send', { subject: 'Hi', html: '<p>Hello {{NAME}}</p>' });
    ctx.env = { DB: db, ADMIN_API_KEY: 'admin-key' };
    var res = await broadcast(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.enqueued).toBe(2);
    expect(db._tables.newsletter_outbox).toHaveLength(2);
    expect(db._tables.newsletter_issues[0].status).toBe('sending');
  });

  it('cron drains the outbox, personalizes, and flips the issue', async function () {
    var sentTo = [];
    globalThis.fetch = async function (url, opts) {
      var body = JSON.parse(opts.body);
      sentTo.push(body.to[0].email);
      return new Response(JSON.stringify({ messageId: 'm' }), { status: 200 });
    };
    var db = mockDb({
      events: [],
      enrollments: [],
      programs: [],
      email_queue: [],
      whatsapp_queue: [],
      subscribers: [],
      newsletter_issues: [{ id: 9, issue_number: 3, subject: 'Hi', theme: '', html: '<p>Hello {{NAME}} ({{EDITION}}/{{REF_CODE}})</p>', subscriber_count: 2, status: 'sending', sent_count: 0, failed_count: 0 }],
      newsletter_outbox: [
        { id: 1, issue_id: 9, email: 'a@t.co', name: 'Ama', edition: 'GH', ref_code: 'GA-1', status: 'pending', attempts: 0 },
        { id: 2, issue_id: 9, email: 'b@t.co', name: 'Ben', edition: 'UK', ref_code: 'GA-2', status: 'pending', attempts: 0 }
      ]
    });
    var ctx = buildContext('http://localhost/api/email/cron?secret=s3', {
      method: 'GET',
      env: { DB: db, CRON_SECRET: 's3', BREVO_API_KEY: 'brevo-key' },
      request: new Request('http://localhost/api/email/cron?secret=s3')
    });
    var res = await emailCron(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.newsletter.sent).toBe(2);
    expect(sentTo.sort()).toEqual(['a@t.co', 'b@t.co']);
    expect(db._tables.newsletter_outbox.every(function (r) { return r.status === 'sent'; })).toBe(true);
    expect(db._tables.newsletter_issues[0].status).toBe('sent');
    expect(db._tables.newsletter_issues[0].sent_count).toBe(2);
  });

  it('cron retries failures and dead-letters after 3 attempts', async function () {
    globalThis.fetch = async function () {
      return new Response('nope', { status: 500 });
    };
    var db = mockDb({
      events: [], enrollments: [], programs: [], email_queue: [], whatsapp_queue: [], subscribers: [],
      newsletter_issues: [{ id: 9, issue_number: 3, subject: 'Hi', theme: '', html: '<p>x</p>', subscriber_count: 1, status: 'sending', sent_count: 0, failed_count: 0 }],
      newsletter_outbox: [
        { id: 1, issue_id: 9, email: 'a@t.co', name: 'Ama', edition: 'GH', ref_code: 'GA-1', status: 'pending', attempts: 2 }
      ]
    });
    var ctx = buildContext('http://localhost/api/email/cron?secret=s3', {
      method: 'GET',
      env: { DB: db, CRON_SECRET: 's3', BREVO_API_KEY: 'brevo-key' },
      request: new Request('http://localhost/api/email/cron?secret=s3')
    });
    var res = await emailCron(ctx);
    var data = await res.json();
    expect(data.newsletter.failed).toBe(1);
    expect(db._tables.newsletter_outbox[0].status).toBe('failed');
    expect(db._tables.newsletter_outbox[0].attempts).toBe(3);
  });
});
