import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as sitemapPosts } from '../../functions/api/sitemap-posts.js';

function get(db) {
  var url = 'http://localhost/api/sitemap-posts';
  return buildContext(url, { method: 'GET', env: { DB: db }, request: new Request(url) });
}

describe('GET /api/sitemap-posts', function () {
  it('lists published posts as XML, skipping drafts and bad slugs', async function () {
    var db = mockDb({
      posts: [
        { slug: 'good-post', updated_at: '2026-10-13 10:00:00', published_at: '2026-10-01', status: 'published' },
        { slug: 'draft-post', updated_at: '', published_at: '', status: 'draft' },
        { slug: 'Bad Slug!!', updated_at: '', published_at: '', status: 'published' }
      ]
    });
    var res = await sitemapPosts(get(db));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');
    var xml = await res.text();
    expect(xml).toContain('https://studio.gabochie.com/blog/good-post/');
    expect(xml).toContain('<lastmod>2026-10-13</lastmod>');
    expect(xml).not.toContain('draft-post');
    expect(xml).not.toContain('Bad Slug');
  });

  it('returns empty urlset when no posts published', async function () {
    var db = mockDb({ posts: [] });
    var res = await sitemapPosts(get(db));
    expect(res.status).toBe(200);
    var xml = await res.text();
    expect(xml).toContain('<urlset');
    expect(xml).not.toContain('<url>');
  });

  it('501s without D1', async function () {
    var url = 'http://localhost/api/sitemap-posts';
    var ctx = buildContext(url, { method: 'GET', env: {}, request: new Request(url) });
    var res = await sitemapPosts(ctx);
    expect(res.status).toBe(501);
  });

  it('skips future-dated published posts', async function () {
    var db = mockDb({
      posts: [
        { slug: 'live-post', updated_at: '2026-10-13 10:00:00', published_at: '2026-10-01', status: 'published' },
        { slug: 'future-post', updated_at: '2026-10-13 10:00:00', published_at: '2099-01-01 09:00:00', status: 'published' }
      ]
    });
    var xml = await sitemapPosts(get(db)).then(function (r) { return r.text(); });
    expect(xml).toContain('https://studio.gabochie.com/blog/live-post/');
    expect(xml).not.toContain('future-post');
  });
});
