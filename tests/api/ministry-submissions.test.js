import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest } from '../../functions/api/admin/submissions.js';

function adminGet(url) {
  return new Request(url, {
    method: 'GET',
    headers: { 'X-Admin-Key': 'test-admin-key' },
  });
}

describe('GET /api/admin/submissions ministry filter', function () {
  var ctx;

  beforeEach(function () {
    ctx = buildContext('http://localhost/api/admin/submissions', {
      env: {
        DB: mockDb({
          contact_submissions: [
            { id: 1, name: 'Ama', email: 'a@x.com', subject: 'LOTL: Prayer Consult', message: '[WhatsApp 0241] pray', source: 'lotl-consult', status: 'new', created_at: '2026-10-09 10:00:00' },
            { id: 2, name: 'Kwame', email: 'k@x.com', subject: 'LOTL: Question', message: 'why?', source: 'lotl-question', status: 'new', created_at: '2026-10-09 11:00:00' },
            { id: 3, name: 'Site Fan', email: 's@x.com', subject: 'Contact Form', message: 'hello', source: 'contact', status: 'new', created_at: '2026-10-09 12:00:00' },
          ],
        }),
        ADMIN_API_KEY: 'test-admin-key',
      },
    });
  });

  it('returns everything without a filter (legacy behavior)', async function () {
    ctx.request = adminGet('http://localhost/api/admin/submissions');
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.items.length).toBe(3);
  });

  it('returns only lotl-* rows with ?source=lotl-', async function () {
    ctx.request = adminGet('http://localhost/api/admin/submissions?source=lotl-');
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.items.length).toBe(2);
    body.items.forEach(function (item) {
      expect(item.source.indexOf('lotl-')).toBe(0);
    });
  });

  it('narrows to a single queue with ?source=lotl-question', async function () {
    ctx.request = adminGet('http://localhost/api/admin/submissions?source=lotl-question');
    var res = await onRequest(ctx);
    var body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].source).toBe('lotl-question');
  });

  it('still rejects unauthenticated requests', async function () {
    ctx.request = new Request('http://localhost/api/admin/submissions?source=lotl-', { method: 'GET' });
    var res = await onRequest(ctx);
    expect(res.status).toBe(403);
  });
});
