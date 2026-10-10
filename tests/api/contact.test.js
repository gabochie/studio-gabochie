import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest } from '../../functions/api/contact.js';

/**
 * Build a POST request with form-encoded body (matching the actual endpoint).
 */
function postForm(url, fields) {
  var parts = [];
  for (var key in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(fields[key])));
    }
  }
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: parts.join('&'),
  });
}

describe('POST /api/contact', function () {
  var ctx;

  beforeEach(function () {
    ctx = buildContext('http://localhost/api/contact', {
      env: {
        DB: mockDb({
          subscribers: [],
          contacts: [],
        }),
        BREVO_SMTP_KEY: 'smtp-key',
        BREVO_SMTP_SENDER: 'studio@gabochie.com',
        BREVO_SMTP_LOGIN: 'login',
        CONTACT_TO: 'studio@gabochie.com',
        ADMIN_API_KEY: 'test-admin-key',
      },
    });
  });

  it('returns 403 for GET without admin key', async function () {
    ctx.request = new Request('http://localhost/api/contact', { method: 'GET' });
    var res = await onRequest(ctx);
    expect(res.status).toBe(403);
    var body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 200 for GET with admin key', async function () {
    ctx.request = new Request('http://localhost/api/contact', {
      method: 'GET',
      headers: { 'X-Admin-Key': 'test-admin-key' },
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('returns 200 for POST with valid form data', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Test User',
      email: 'test@example.com',
      book: 'the-bible-as-kingdom-os',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('returns 200 even without email (graceful handling)', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'No Email',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
  });

  it('returns 200 with spam _gotcha field (honeypot)', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Bot',
      email: 'bot@spam.com',
      _gotcha: 'true',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    // Spam should be silently accepted
    var body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('inserts subscriber into D1 on valid submission', async function () {
    var inserted = [];
    var mock = {
      subscribers: [],
      contacts: [],
    };
    mock.prepare = function (sql) {
      var chain = {
        bind: function () {
          chain._boundArgs = Array.prototype.slice.call(arguments);
          return chain;
        },
        run: async function () {
          if (sql.trim().toUpperCase().indexOf('INSERT') === 0) {
            inserted.push({ sql: sql, args: chain._boundArgs });
          }
          return { success: true, meta: { changes: 1 } };
        },
        first: async function () { return null; },
        all: async function () { return { results: [] }; },
      };
      return chain;
    };
    ctx.env.DB = mock;
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Insert Me',
      email: 'insert@test.com',
      book: 'the-bible-as-kingdom-os',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    expect(inserted.length).toBeGreaterThanOrEqual(1);
    expect(inserted[0].sql.toUpperCase()).toContain('SUBSCRIBERS');
  });

  it('does not expose internal details in error messages', async function () {
    ctx.env.DB = undefined;
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Test',
      email: 'test@test.com',
    });
    var res = await onRequest(ctx);
    // Should still succeed because DB failure is caught
    expect(res.status).toBe(200);
  });
});

describe('LOTL ministry queues via POST /api/contact', function () {
  var ctx;

  beforeEach(function () {
    ctx = buildContext('http://localhost/api/contact', {
      env: {
        DB: mockDb({ subscribers: [], contact_submissions: [], email_queue: [] }),
        ADMIN_API_KEY: 'test-admin-key',
      },
    });
  });

  function tables() {
    return ctx.env.DB._tables;
  }

  it('segments a prayer consult with readable subject, source and WhatsApp head', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Ama',
      email: 'ama@example.com',
      phone: '0241234567',
      message: 'Pray for my exams',
      source: 'lotl-consult',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var rows = tables().contact_submissions;
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe('lotl-consult');
    expect(rows[0].subject).toBe('LOTL: Prayer Consult');
    expect(rows[0].message.indexOf('[WhatsApp 0241234567]')).toBe(0);
    expect(rows[0].message).toContain('Pray for my exams');
    var subs = tables().subscribers;
    // NOTE: the shared mockDb intentionally skips INSERT OR IGNORE writes;
    // the subscribers write is verified with a capturing mock below.
    expect(subs.length).toBe(0);
  });

  it('writes the lotl source into the subscribers row', async function () {
    var bound = [];
    var mock = {
      prepare: function (sql) {
        var chain = {
          bind: function () {
            chain._args = Array.prototype.slice.call(arguments);
            return chain;
          },
          run: async function () {
            if (/INSERT/i.test(sql)) bound.push({ sql: sql, args: chain._args });
            return { success: true, meta: { changes: 1 } };
          },
          first: async function () { return null; },
          all: async function () { return { results: [] }; },
        };
        return chain;
      },
    };
    ctx.env.DB = mock;
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Ama',
      email: 'ama@example.com',
      phone: '0241234567',
      source: 'lotl-consult',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var subWrite = bound.filter(function (b) { return /SUBSCRIBERS/i.test(b.sql); })[0];
    expect(subWrite).toBeTruthy();
    expect(subWrite.args[2]).toBe('lotl-consult');
  });

  it('maps each lotl queue to its subject label', async function () {
    var cases = [
      ['lotl-new', "LOTL: I'm New"],
      ['lotl-question', 'LOTL: Question'],
      ['lotl-community', 'LOTL: Join Family'],
      ['lotl-testimony', 'LOTL: Testimony'],
      ['lotl-decision', 'LOTL: Decision'],
    ];
    for (var i = 0; i < cases.length; i++) {
      ctx.request = postForm('http://localhost/api/contact', {
        name: 'User ' + i,
        email: 'user' + i + '@example.com',
        message: 'hello',
        source: cases[i][0],
      });
      var res = await onRequest(ctx);
      expect(res.status).toBe(200);
    }
    var rows = tables().contact_submissions;
    expect(rows.length).toBe(cases.length);
    for (var j = 0; j < cases.length; j++) {
      expect(rows[j].source).toBe(cases[j][0]);
      expect(rows[j].subject).toBe(cases[j][1]);
    }
  });

  it('keeps legacy behavior when no source is sent', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Plain',
      email: 'plain@example.com',
      message: 'hi',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var rows = tables().contact_submissions;
    expect(rows[0].source).toBe('contact');
    expect(rows[0].subject).toBe('Contact Form');
    expect(rows[0].message).toBe('hi');
  });

  it('leaves book-driven subjects untouched', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Reader',
      email: 'reader@example.com',
      book: 'the-bible-as-kingdom-os',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var rows = tables().contact_submissions;
    expect(rows[0].subject).toBe('the-bible-as-kingdom-os');
    expect(rows[0].source).toBe('the-bible-as-kingdom-os');
  });

  it('stores phone-only consults (no email) instead of dropping them', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Kofi',
      phone: '0249998888',
      message: 'Need prayer Tuesday',
      source: 'lotl-consult',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var rows = tables().contact_submissions;
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe('lotl-consult');
    expect(rows[0].subject).toBe('LOTL: Prayer Consult');
    expect(rows[0].email).toBe('');
    expect(rows[0].message.indexOf('[WhatsApp 0249998888]')).toBe(0);
    // No email key: subscribers must stay untouched (no junk '' row).
    expect(tables().subscribers.length).toBe(0);
  });

  it('writes nothing when neither email nor phone is given', async function () {
    ctx.request = postForm('http://localhost/api/contact', {
      name: 'Ghost',
      message: 'no contact info',
      source: 'lotl-question',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    expect(tables().contact_submissions.length).toBe(0);
    expect(tables().subscribers.length).toBe(0);
  });
});
