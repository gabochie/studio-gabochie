import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as posts } from '../../functions/api/posts.js';
import { onRequest as adminPosts } from '../../functions/admin/api/posts.js';

function ctx(url, opts) {
  opts = opts || {};
  return buildContext(url, {
    method: opts.method || 'GET',
    env: { DB: opts.db, ADMIN_API_KEY: 'secret' },
    request: new Request(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json', 'X-Admin-Key': 'secret' }, opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    })
  });
}

function seedDb() {
  return mockDb({
    posts: [
      { id: 1, slug: 'hello', title: 'Hello', excerpt: 'Hi', html: '<p>Hi</p>', cover_image: '', tags: '["a"]', faqs: '[]', status: 'published', author: 'Gideon Abochie', published_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 2, slug: 'drafty', title: 'Draft', excerpt: '', html: '<p>x</p>', cover_image: '', tags: '[]', faqs: '[]', status: 'draft', author: 'Gideon Abochie', published_at: '', updated_at: '2026-01-02' }
    ]
  });
}

describe('GET /api/posts (public)', function () {
  it('lists published posts only', async function () {
    var res = await posts(ctx('http://localhost/api/posts', { db: seedDb() }));
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.posts.length).toBe(1);
    expect(body.posts[0].slug).toBe('hello');
  });

  it('serves a single published post with body + faqs', async function () {
    var res = await posts(ctx('http://localhost/api/posts?slug=hello', { db: seedDb() }));
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.post.html).toBe('<p>Hi</p>');
  });

  it('404s drafts and unknown slugs', async function () {
    var r1 = await posts(ctx('http://localhost/api/posts?slug=drafty', { db: seedDb() }));
    expect(r1.status).toBe(404);
    var r2 = await posts(ctx('http://localhost/api/posts?slug=nope', { db: seedDb() }));
    expect(r2.status).toBe(404);
  });
});

describe('POST/PUT/DELETE /api/posts (admin)', function () {
  it('rejects writes without admin key', async function () {
    var bad = buildContext('http://localhost/api/posts', {
      method: 'POST',
      env: { DB: seedDb(), ADMIN_API_KEY: 'secret' },
      request: new Request('http://localhost/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'x', title: 'X' })
      })
    });
    var res = await posts(bad);
    expect([401, 403]).toContain(res.status);
  });

  it('creates, updates, and deletes a post', async function () {
    var db = seedDb();
    var created = await (await posts(ctx('http://localhost/api/posts', {
      db, method: 'POST',
      body: { slug: 'New Post!', title: 'New Post', excerpt: 'e', html: '<p>hi</p><script>alert(1)</script>', tags: 'a, b', faqs: [{ q: 'Q?', a: 'A.' }], status: 'published' }
    }))).json();
    expect(created.status).toBe('ok');
    expect(created.slug).toBe('new-post');
    var row = db._tables.posts.find(function (p) { return p.slug === 'new-post'; });
    expect(row.html).not.toContain('<script>');
    expect(JSON.parse(row.faqs)).toEqual([{ q: 'Q?', a: 'A.' }]);

    var updated = await (await posts(ctx('http://localhost/api/posts', {
      db, method: 'PUT', body: { slug: 'new-post', title: 'Newer', status: 'draft' }
    }))).json();
    expect(updated.status).toBe('ok');
    expect(db._tables.posts.find(function (p) { return p.slug === 'new-post'; }).status).toBe('draft');

    var deleted = await (await posts(ctx('http://localhost/api/posts?slug=new-post', { db, method: 'DELETE' }))).json();
    expect(deleted.status).toBe('ok');
    expect(db._tables.posts.find(function (p) { return p.slug === 'new-post'; })).toBeUndefined();
  });
});

describe('GET /admin/api/posts (admin list)', function () {
  it('includes drafts with full bodies', async function () {
    var res = await adminPosts(ctx('http://localhost/admin/api/posts', { db: seedDb() }));
    var body = await res.json();
    expect(body.items.length).toBe(2);
    expect(body.items.find(function (p) { return p.slug === 'drafty'; }).html).toBe('<p>x</p>');
  });
});

describe('publish-date gating', function () {
  function futureDb() {
    return mockDb({
      posts: [
        { id: 1, slug: 'live', title: 'Live', excerpt: '', html: '<p>live</p>', cover_image: '', tags: '[]', faqs: '[]', status: 'published', author: 'Gabo', published_at: '2026-01-01 09:00:00', updated_at: '2026-01-01' },
        { id: 2, slug: 'future', title: 'Future', excerpt: '', html: '<p>future</p>', cover_image: '', tags: '[]', faqs: '[]', status: 'published', author: 'Gabo', published_at: '2099-01-01 09:00:00', updated_at: '2026-01-01' },
        { id: 3, slug: 'scheduled', title: 'Scheduled', excerpt: '', html: '<p>scheduled</p>', cover_image: '', tags: '[]', faqs: '[]', status: 'scheduled', author: 'Gabo', published_at: '2099-02-01 09:00:00', scheduled_at: '2099-02-01 09:00:00', updated_at: '2026-01-01' }
      ]
    });
  }

  it('hides future-dated and scheduled posts from the public list', async function () {
    var res = await posts(ctx('http://localhost/api/posts', { db: futureDb() }));
    var body = await res.json();
    expect(body.posts.map(function (p) { return p.slug; })).toEqual(['live']);
  });

  it('404s a future-dated post by slug', async function () {
    var res = await posts(ctx('http://localhost/api/posts?slug=future', { db: futureDb() }));
    expect(res.status).toBe(404);
  });

  it('stores scheduled status, scheduled_at and utm_campaign on write', async function () {
    var db = futureDb();
    var created = await (await posts(ctx('http://localhost/api/posts', {
      db, method: 'POST',
      body: {
        slug: 'planned-post', title: 'Planned', status: 'scheduled',
        scheduled_at: '2099-03-01T09:00:00Z', published_at: '', utm_campaign: 'assessment-d31'
      }
    }))).json();
    expect(created.status).toBe('ok');
    var row = db._tables.posts.find(function (p) { return p.slug === 'planned-post'; });
    expect(row.status).toBe('scheduled');
    expect(row.scheduled_at).toBe('2099-03-01 09:00:00');
    expect(row.published_at).toBe('2099-03-01 09:00:00');
    expect(row.utm_campaign).toBe('assessment-d31');
  });
});
