import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as socialQueue } from '../../functions/api/admin/social-queue.js';

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
    social_queue: [
      {
        id: 1, plan_key: 'day-1-assessment-d01-instagram', day: 1, week: 1,
        arc: 'Is this even possible in Ghana?', pillar: 'Education', platform: 'instagram',
        format: 'Reel', hook: '24 legal ways', paths: '1, 2', cta: 'Soft',
        utm_campaign: 'assessment-d01', hard_cta: 0,
        cta_url: 'https://studio.gabochie.com/money-ghana/?utm_campaign=assessment-d01',
        alt_url: '', scheduled_at: '2026-01-01 09:00:00', status: 'planned', notes: ''
      },
      {
        id: 2, plan_key: 'day-2-assessment-d02-instagram', day: 2, week: 1,
        arc: 'Is this even possible in Ghana?', pillar: 'Education', platform: 'instagram',
        format: 'Carousel', hook: 'Phone-only paths', paths: '1, 2', cta: 'Soft',
        utm_campaign: 'assessment-d02', hard_cta: 0, cta_url: '', alt_url: '',
        scheduled_at: '2099-01-01 09:00:00', status: 'ready', notes: ''
      }
    ],
    posts: [
      { id: 1, slug: 'scheduled-post', title: 'Scheduled', status: 'scheduled', published_at: '2099-02-01 09:00:00', scheduled_at: '2099-02-01 09:00:00', utm_campaign: 'assessment-w1' }
    ]
  });
}

describe('/api/admin/social-queue', function () {
  it('rejects unauthenticated reads', async function () {
    var url = 'http://localhost/api/admin/social-queue';
    var bad = buildContext(url, {
      env: { DB: seedDb(), ADMIN_API_KEY: 'secret' },
      request: new Request(url, { headers: { 'Content-Type': 'application/json' } })
    });
    var res = await socialQueue(bad);
    expect([401, 403]).toContain(res.status);
  });

  it('lists the plan and the blog publish queue', async function () {
    var res = await socialQueue(ctx('http://localhost/api/admin/social-queue', { db: seedDb() }));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.count).toBe(2);
    expect(data.items[0].utm_campaign).toBe('assessment-d01');
    expect(data.posts[0].slug).toBe('scheduled-post');
  });

  it('updates status, notes and schedule', async function () {
    var db = seedDb();
    var res = await socialQueue(ctx('http://localhost/api/admin/social-queue?id=1', {
      db, method: 'PUT', body: { status: 'posted', notes: 'Published on IG', scheduled_at: '2026-11-24T09:00:00Z' }
    }));
    expect(res.status).toBe(200);
    var row = db._tables.social_queue.find(function (i) { return i.id === 1; });
    expect(row.status).toBe('posted');
    expect(row.notes).toBe('Published on IG');
    expect(row.scheduled_at).toBe('2026-11-24 09:00:00');
    expect(row.posted_at).toBeTruthy();
  });

  it('adds and deletes custom items', async function () {
    var db = seedDb();
    var created = await socialQueue(ctx('http://localhost/api/admin/social-queue', {
      db, method: 'POST', body: { hook: 'Custom reminder', platform: 'tiktok', day: 31, utm_campaign: 'assessment-x' }
    }));
    expect(created.status).toBe(201);
    var body = await created.json();
    expect(body.item.hook).toBe('Custom reminder');
    expect(body.item.plan_key).toContain('custom-');

    var removed = await socialQueue(ctx('http://localhost/api/admin/social-queue?id=' + body.item.id, {
      db, method: 'DELETE'
    }));
    expect((await removed.json()).status).toBe('ok');
    expect(db._tables.social_queue.find(function (i) { return i.id === body.item.id; })).toBeUndefined();
  });
});
