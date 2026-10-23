import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as search } from '../../functions/api/search.js';

function get(url, env) {
  return buildContext(url, { method: 'GET', env: env, request: new Request(url) });
}

function seed() {
  return mockDb({
    posts: [
      { id: 1, slug: 'systems-thinking-for-creatives', title: 'Systems Thinking for Creatives', excerpt: 'How systems thinking helps creatives', cover_image: '', author: 'Gabo', published_at: '2026-05-01', status: 'published', tags: 'systems,creativity' },
      { id: 2, slug: 'draft-secret', title: 'Systems Draft', excerpt: 'unpublished', cover_image: '', author: 'Gabo', published_at: '2026-06-01', status: 'draft', tags: 'systems' },
      { id: 3, slug: 'creative-confidence', title: 'Creative Confidence', excerpt: 'Building confidence', cover_image: '', author: 'Gabo', published_at: '2026-04-01', status: 'published', tags: 'creativity' }
    ],
    books: [
      { id: 1, slug: 'seven-fearless-steps', title: '7 Fearless Steps', description: 'A guide to fearless living', cover_image: '', price: 0, price_label: 'Free', sort_order: 1 }
    ],
    programs: [
      { id: 1, title: 'Systems Thinking', slug: 'systems-thinking', tagline: 'Think in systems', description: 'Learn systems thinking', price: 0, price_label: 'Free', status: 'active', sort_order: 1 },
      { id: 2, title: 'Retired Course', slug: 'retired', tagline: 'Nothing', description: 'Old systems course', price: 0, price_label: 'Free', status: 'archived', sort_order: 2 }
    ],
    classifieds: [
      { id: 1, title: 'Systems Analyst', description: 'We need a systems analyst', category: 'Tech', listing_type: 'job', price: '', location: 'Accra', website: '', featured: 1, created_at: '2026-06-01 10:00:00', status: 'approved', expires_at: '2099-01-01 00:00:00' },
      { id: 2, title: 'Old Systems Role', description: 'Expired systems job', category: 'Tech', listing_type: 'job', price: '', location: 'Accra', website: '', featured: 0, created_at: '2020-01-01 10:00:00', status: 'approved', expires_at: '2020-02-01 00:00:00' },
      { id: 3, title: 'Pending Systems Role', description: 'not approved', category: 'Tech', listing_type: 'job', price: '', location: 'Accra', website: '', featured: 0, created_at: '2026-06-02 10:00:00', status: 'pending', expires_at: '2099-01-01 00:00:00' }
    ]
  });
}

describe('GET /api/search', function () {
  it('rejects non-GET methods', async function () {
    var ctx = buildContext('http://localhost/api/search?q=systems', {
      method: 'POST',
      env: { DB: seed() },
      request: new Request('http://localhost/api/search?q=systems', { method: 'POST' })
    });
    var res = await search(ctx);
    expect(res.status).toBe(405);
  });

  it('returns 501 when the DB is not bound', async function () {
    var res = await search(get('http://localhost/api/search?q=systems', {}));
    expect(res.status).toBe(501);
  });

  it('requires a query of at least two characters', async function () {
    var res = await search(get('http://localhost/api/search?q=a', { DB: seed() }));
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.status).toBe('error');
  });

  it('rejects an unknown type', async function () {
    var res = await search(get('http://localhost/api/search?q=systems&type=bogus', { DB: seed() }));
    expect(res.status).toBe(400);
  });

  it('searches books, courses, and listings', async function () {
    var res = await search(get('http://localhost/api/search?q=systems', { DB: seed() }));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.counts.course).toBe(1);
    expect(data.counts.listing).toBe(1);
    expect(data.counts.article).toBe(1);
    var urls = data.results.map(function (r) { return r.url; });
    expect(urls).toContain('/courses/systems-thinking/');
    expect(urls).toContain('/careers/');
    expect(urls).toContain('/blog/systems-thinking-for-creatives/');
  });

  it('excludes drafts and expired or unapproved listings', async function () {
    var res = await search(get('http://localhost/api/search?q=systems', { DB: seed() }));
    var data = await res.json();
    var titles = data.results.map(function (r) { return r.title; });
    expect(titles).not.toContain('Systems Draft');
    expect(titles).not.toContain('Old Systems Role');
    expect(titles).not.toContain('Pending Systems Role');
    expect(titles).not.toContain('Retired Course');
  });

  it('filters by a single type', async function () {
    var res = await search(get('http://localhost/api/search?q=systems&type=course', { DB: seed() }));
    var data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].type).toBe('course');
  });

  it('matches excerpts and tags case-insensitively', async function () {
    var res = await search(get('http://localhost/api/search?q=CONFIDENCE', { DB: seed() }));
    var data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].url).toBe('/blog/creative-confidence/');
  });

  it('honours the limit parameter', async function () {
    var res = await search(get('http://localhost/api/search?q=systems&limit=1', { DB: seed() }));
    var data = await res.json();
    expect(data.results).toHaveLength(1);
  });

  it('returns an empty result set for no matches', async function () {
    var res = await search(get('http://localhost/api/search?q=zzzzzz', { DB: seed() }));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.total).toBe(0);
    expect(data.results).toHaveLength(0);
  });

  it('rate limits repeated searches from one address', async function () {
    var db = seed();
    var env = { DB: db };
    var headers = { 'CF-Connecting-IP': '9.9.9.9' };
    var last;
    for (var i = 0; i < 61; i++) {
      last = await search(buildContext('http://localhost/api/search?q=systems', {
        method: 'GET',
        env: env,
        request: new Request('http://localhost/api/search?q=systems', { headers: headers })
      }));
    }
    expect(last.status).toBe(429);
  });
});
