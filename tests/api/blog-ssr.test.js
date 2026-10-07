import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest } from '../../functions/blog/[slug].js';

function ctx(slug, db, assets) {
  return buildContext('http://localhost/blog/' + slug + '/', {
    params: { slug: slug },
    env: Object.assign({ DB: db }, assets ? { ASSETS: assets } : {}),
    request: new Request('http://localhost/blog/' + slug + '/', { method: 'GET' })
  });
}

function assetsWith(status, body) {
  return {
    fetch: async function () {
      return new Response(body || '<h1>static</h1>', { status: status, headers: { 'Content-Type': 'text/html' } });
    }
  };
}

describe('GET /blog/:slug SSR', function () {
  it('renders a published DB post with SEO markup', async function () {
    var db = mockDb({
      posts: [{
        id: 1, slug: 'hello', title: 'Hello', excerpt: 'Hi there', html: '<p>Hi</p>',
        cover_image: '', tags: '["a"]', faqs: '[{"q":"Q?","a":"A."}]',
        author: 'Gideon Abochie', published_at: '2026-01-01', updated_at: '2026-01-02', status: 'published'
      }]
    });
    var res = await onRequest(ctx('hello', db, assetsWith(404)));
    expect(res.status).toBe(200);
    var html = await res.text();
    expect(html).toContain('<title>Hello — Studio Gabochie</title>');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain('FAQPage');
    expect(html).toContain('<p>Hi</p>');
  });

  it('falls back to the static file when no DB post exists', async function () {
    var db = mockDb({ posts: [] });
    var res = await onRequest(ctx('cornerstone', db, assetsWith(200, '<h1>static cornerstone</h1>')));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('static cornerstone');
  });

  it('returns the styled 404 when neither DB nor static has it', async function () {
    var db = mockDb({ posts: [] });
    var res = await onRequest(ctx('nope', db, assetsWith(404)));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('/blog/');
  });
});
