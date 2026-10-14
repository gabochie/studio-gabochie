import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as draftPost, parseDraft } from '../../functions/api/ai/draft-post.js';

function post(body, envExtra) {
  var url = 'http://localhost/api/ai/draft-post';
  return buildContext(url, {
    method: 'POST',
    env: Object.assign({ DB: mockDb({ posts: [] }) }, envExtra || {}),
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'admin-key' },
      body: JSON.stringify(body)
    })
  });
}

describe('parseDraft', function () {
  it('splits title, excerpt, and body', function () {
    var p = parseDraft('# Walk Boldly\n\n> One line.\n\n<p>Body here.</p>');
    expect(p.title).toBe('Walk Boldly');
    expect(p.excerpt).toBe('One line.');
    expect(p.html).toContain('Body here.');
  });

  it('handles missing title', function () {
    var p = parseDraft('<p>Just body.</p>');
    expect(p.title).toBe('');
  });
});

describe('POST /api/ai/draft-post', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('requires a topic', async function () {
    var res = await draftPost(post({}, { ADMIN_API_KEY: 'admin-key' }));
    expect(res.status).toBe(400);
  });

  it('requires auth', async function () {
    var url = 'http://localhost/api/ai/draft-post';
    var ctx = buildContext(url, {
      method: 'POST',
      env: { DB: mockDb({ posts: [] }), ADMIN_API_KEY: 'admin-key' },
      request: new Request(url, { method: 'POST', body: JSON.stringify({ topic: 'x' }) })
    });
    var res = await draftPost(ctx);
    expect([401, 403]).toContain(res.status);
  });

  it('drafts via AI and stores as draft', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ choices: [{ message: { content: '# Test Title\n\n> Test excerpt.\n\n<p>' + 'word '.repeat(50) + '</p>' } }] }), { status: 200 });
    };
    var db = mockDb({ posts: [] });
    var url = 'http://localhost/api/ai/draft-post';
    var ctx = buildContext(url, {
      method: 'POST',
      env: { DB: db, ADMIN_API_KEY: 'admin-key', OPENAI_API_KEY: 'sk-test' },
      request: new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'admin-key' },
        body: JSON.stringify({ topic: 'Testing drafts' })
      })
    });
    var res = await draftPost(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.slug).toBe('test-title');
    expect(db._tables.posts).toHaveLength(1);
    expect(db._tables.posts[0].status).toBe('draft');
  });

  it('accepts CI secret for automation', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ choices: [{ message: { content: '# CI Title\n\n> Ex.\n\n<p>Body.</p>' } }] }), { status: 200 });
    };
    var url = 'http://localhost/api/ai/draft-post';
    var ctx = buildContext(url, {
      method: 'POST',
      env: { DB: mockDb({ posts: [] }), CI_WEBHOOK_SECRET: 'ci-secret', OPENAI_API_KEY: 'sk-test' },
      request: new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CI-Secret': 'ci-secret' },
        body: JSON.stringify({ topic: 'CI topic' })
      })
    });
    var res = await draftPost(ctx);
    expect(res.status).toBe(200);
  });
});
