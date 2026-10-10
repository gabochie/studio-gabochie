import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as schedule, saturdayOfWeek, saturdaySendDue, parseDraft } from '../../functions/admin/api/newsletter/schedule.js';

function adminPost(body) {
  var url = 'http://localhost/admin/api/newsletter/schedule';
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

function schedDb(extra) {
  return mockDb(Object.assign({
    subscribers: [{ email: 'a@t.co', name: 'Ama', edition: 'GH', ref_code: 'GA-1', confirmed: 1 }],
    newsletter_schedule: [],
    newsletter_issues: [],
    newsletter_outbox: []
  }, extra || {}));
}

describe('schedule helpers', function () {
  it('finds Saturday of any week', function () {
    expect(saturdayOfWeek(new Date('2026-10-07T12:00:00Z'))).toBe('2026-10-10');
    expect(saturdayOfWeek(new Date('2026-10-10T00:00:01Z'))).toBe('2026-10-10');
    expect(saturdayOfWeek(new Date('2026-10-11T12:00:00Z'))).toBe('2026-10-17');
  });

  it('gates sends to Saturday 06:00+ UTC', function () {
    expect(saturdaySendDue(new Date('2026-10-10T06:00:00Z'))).toBe('2026-10-10');
    expect(saturdaySendDue(new Date('2026-10-10T05:59:59Z'))).toBe(null);
    expect(saturdaySendDue(new Date('2026-10-09T12:00:00Z'))).toBe(null);
    expect(saturdaySendDue(new Date('2026-10-11T12:00:00Z'))).toBe(null);
  });

  it('parses SUBJECT: off AI output', function () {
    var p = parseDraft('SUBJECT: Walk Boldly\n\nHello friends.\n\nBody here.');
    expect(p.subject).toBe('Walk Boldly');
    expect(p.html).toContain('Hello friends.');
  });
});

describe('schedule flow', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('drafts via AI, approves, and sends on approval only', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'SUBJECT: Grace for the Week\n\nDear friends,\n\nBe encouraged.' } }] }), { status: 200 });
    };
    var db = schedDb();
    var env = { DB: db, ADMIN_API_KEY: 'admin-key', OPENAI_API_KEY: 'sk-test' };

    var draftCtx = adminPost({ action: 'draft', topic: 'grace', week_of: '2026-10-10' });
    draftCtx.env = env;
    var draftRes = await schedule(draftCtx);
    expect(draftRes.status).toBe(200);
    var draft = await draftRes.json();
    expect(draft.status).toBe('ok');
    expect(draft.subject).toBe('Grace for the Week');
    var row = db._tables.newsletter_schedule[0];
    expect(row.status).toBe('draft');

    // send-now refused while draft
    var earlyCtx = adminPost({ action: 'send-now', id: row.id });
    earlyCtx.env = env;
    expect((await schedule(earlyCtx)).status).toBe(400);

    // approve then send
    var apCtx = adminPost({ action: 'approve', id: row.id, approved_by: 'tester' });
    apCtx.env = env;
    expect((await schedule(apCtx)).status).toBe(200);
    expect(db._tables.newsletter_schedule[0].status).toBe('approved');

    var sendCtx = adminPost({ action: 'send-now', id: row.id });
    sendCtx.env = env;
    var sendRes = await schedule(sendCtx);
    expect(sendRes.status).toBe(200);
    var sent = await sendRes.json();
    expect(sent.enqueued).toBe(1);
    expect(db._tables.newsletter_schedule[0].status).toBe('queued');
    expect(db._tables.newsletter_outbox).toHaveLength(1);
  });

  it('rejects duplicate drafts for the same week', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'SUBJECT: X\n\nY' } }] }), { status: 200 });
    };
    var db = schedDb();
    db._tables.newsletter_schedule.push({ id: 1, week_of: '2026-10-10', status: 'draft' });
    var env = { DB: db, ADMIN_API_KEY: 'admin-key', OPENAI_API_KEY: 'sk-test' };
    var ctx = adminPost({ action: 'draft', topic: 'joy', week_of: '2026-10-10' });
    ctx.env = env;
    expect((await schedule(ctx)).status).toBe(409);
  });

  it('requires CI secret or admin key', async function () {
    var db = schedDb();
    var url = 'http://localhost/admin/api/newsletter/schedule';
    var ctx = buildContext(url, {
      method: 'POST',
      env: { DB: db, CI_WEBHOOK_SECRET: 'ci-secret' },
      request: new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CI-Secret': 'ci-secret' }, body: JSON.stringify({ action: 'draft', topic: 'peace', week_of: '2026-10-17' }) })
    });
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'SUBJECT: Peace\n\nShalom.' } }] }), { status: 200 });
    };
    ctx.env.OPENAI_API_KEY = 'sk-test';
    var res = await schedule(ctx);
    expect(res.status).toBe(200);
  });
});
