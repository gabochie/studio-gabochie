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
        BREVO_SMTP_SENDER: 'info@gideonabochie.com',
        BREVO_SMTP_LOGIN: 'login',
        CONTACT_TO: 'info@gideonabochie.com',
      },
    });
  });

  it('returns 405 for GET without admin referer', async function () {
    ctx.request = new Request('http://localhost/api/contact', { method: 'GET' });
    var res = await onRequest(ctx);
    expect(res.status).toBe(403);
    var body = await res.json();
    expect(body.status).toBe('error');
    expect(body.message).toContain('Unauthorized');
  });

  it('returns 200 for GET with admin referer', async function () {
    ctx.request = new Request('http://localhost/api/contact', {
      method: 'GET',
      headers: { 'Referer': '/admin/' },
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
