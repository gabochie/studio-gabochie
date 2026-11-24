import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as cron } from '../../functions/api/email/cron.js';

function ctx(db, secret) {
  var url = 'http://localhost/api/email/cron?secret=' + secret;
  return buildContext(url, {
    method: 'GET',
    env: { DB: db, CRON_SECRET: 'cron-secret' },
    request: new Request(url)
  });
}

function seedDb() {
  return mockDb({
    posts: [
      {
        id: 1, slug: 'due', title: 'Due', status: 'scheduled',
        published_at: '2026-01-01 09:00:00', scheduled_at: '2026-01-01 09:00:00',
        excerpt: '', html: '<p>due</p>', tags: '[]', faqs: '[]', author: 'Gabo', updated_at: '2026-01-01'
      },
      {
        id: 2, slug: 'later', title: 'Later', status: 'scheduled',
        published_at: '2099-01-01 09:00:00', scheduled_at: '2099-01-01 09:00:00',
        excerpt: '', html: '<p>later</p>', tags: '[]', faqs: '[]', author: 'Gabo', updated_at: '2026-01-01'
      }
    ],
    social_queue: [
      { id: 1, plan_key: 'day-1', day: 1, status: 'planned', scheduled_at: '2026-01-01 09:00:00', hook: 'Due reminder' },
      { id: 2, plan_key: 'day-2', day: 2, status: 'ready', scheduled_at: '2099-01-01 09:00:00', hook: 'Later reminder' }
    ]
  });
}

describe('hourly cron — content scheduling', function () {
  it('rejects a bad cron secret', async function () {
    var res = await cron(ctx(seedDb(), 'wrong'));
    expect(res.status).toBe(401);
  });

  it('publishes due posts and flags due social reminders', async function () {
    var db = seedDb();
    var res = await cron(ctx(db, 'cron-secret'));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.posts.published).toBe(1);
    expect(data.social_queue.due).toBe(1);

    var due = db._tables.posts.find(function (p) { return p.slug === 'due'; });
    expect(due.status).toBe('published');
    expect(due.published_at).toBe('2026-01-01 09:00:00');

    var later = db._tables.posts.find(function (p) { return p.slug === 'later'; });
    expect(later.status).toBe('scheduled');

    var sq = db._tables.social_queue.find(function (i) { return i.id === 1; });
    expect(sq.status).toBe('due');
    var sqLater = db._tables.social_queue.find(function (i) { return i.id === 2; });
    expect(sqLater.status).toBe('ready');
  });
});
