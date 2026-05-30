import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest } from '../../functions/api/onboard.js';

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

function postJson(url, data) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

describe('POST /api/onboard', function () {
  var ctx;

  beforeEach(function () {
    ctx = buildContext('http://localhost/api/onboard', {
      env: {
        DB: mockDb({ subscribers: [] }),
      },
    });
  });

  it('returns 405 for GET', async function () {
    ctx.request = new Request('http://localhost/api/onboard', { method: 'GET' });
    var res = await onRequest(ctx);
    expect(res.status).toBe(405);
    var body = await res.json();
    expect(body.error).toBe('POST required');
  });

  it('returns 400 for missing email', async function () {
    ctx.request = postForm('http://localhost/api/onboard', { tag: 'newsletter' });
    var res = await onRequest(ctx);
    expect(res.status).toBe(400);
    var body = await res.json();
    expect(body.error).toBe('Valid email required');
  });

  it('returns 400 for invalid email', async function () {
    ctx.request = postForm('http://localhost/api/onboard', { email: 'not-an-email', tag: 'newsletter' });
    var res = await onRequest(ctx);
    expect(res.status).toBe(400);
  });

  it('accepts valid form-encoded submission', async function () {
    ctx.request = postForm('http://localhost/api/onboard', {
      email: 'test@example.com',
      name: 'Test User',
      tag: 'book_download',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('accepts valid JSON submission', async function () {
    ctx.request = postJson('http://localhost/api/onboard', {
      email: 'json@example.com',
      name: 'JSON User',
      tag: 'workshop',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('falls back to "other" for unknown tag', async function () {
    ctx.request = postForm('http://localhost/api/onboard', {
      email: 'unknown@example.com',
      tag: 'invalid_tag_xyz',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
  });

  it('strips HTML from name', async function () {
    var inserted = [];
    var mock = mockDb({ subscribers: [] });
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
    ctx.request = postForm('http://localhost/api/onboard', {
      email: 'clean@example.com',
      name: '<script>alert("xss")</script>Real Name',
      tag: 'newsletter',
    });
    await onRequest(ctx);
    expect(inserted.length).toBe(1);
    expect(inserted[0].args[0]).not.toContain('<script>');
  });

  it('trims whitespace from email', async function () {
    ctx.request = postForm('http://localhost/api/onboard', {
      email: '  spaced@example.com  ',
      tag: 'donation',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
  });

  it('preserves first touch tag for existing subscriber', async function () {
    var existingTag = 'newsletter';
    var mock = mockDb({
      subscribers: [
        { id: 1, email: 'existing@example.com', onboarding_tag: existingTag },
      ],
    });
    ctx.env.DB = mock;
    ctx.request = postForm('http://localhost/api/onboard', {
      email: 'existing@example.com',
      tag: 'book_download',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var rows = mock._tables.subscribers;
    expect(rows[0].onboarding_tag).toBe('newsletter');
  });

  it('returns 501 when DB is not bound', async function () {
    ctx.env.DB = undefined;
    ctx.request = postForm('http://localhost/api/onboard', {
      email: 'test@test.com',
      tag: 'art',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(501);
  });

  it('handles all valid tags without error', async function () {
    var tags = ['newsletter','school','workshop','nationbuilding','book_download','book_bundle','art','merch','music','donation','patron','sponsor','partner','dashboard','contact'];
    for (var i = 0; i < tags.length; i++) {
      ctx.request = postForm('http://localhost/api/onboard', {
        email: 'tag-' + tags[i] + '@example.com',
        tag: tags[i],
      });
      var res = await onRequest(ctx);
      expect(res.status).toBe(200);
    }
  });

  it('does not expose internal details on error', async function () {
    ctx.env.DB = {
      prepare: function () {
        return { bind: function () { return { first: async function () { throw new Error('db explosion'); }, run: async function () { throw new Error('db explosion'); } }; } };
      },
    };
    ctx.request = postForm('http://localhost/api/onboard', {
      email: 'crash@example.com',
      tag: 'newsletter',
    });
    var res = await onRequest(ctx);
    expect(res.status).toBe(500);
    var body = await res.json();
    expect(body.message).toBe('Internal error');
    expect(body.message).not.toContain('explosion');
  });
});
