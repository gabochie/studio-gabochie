import { describe, it, expect } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';
import { onRequest } from '../../functions/api/admin/cold-outreach.js';

function makeCtx(url, opts) {
  opts = opts || {};
  var db = opts.db !== undefined ? opts.db : mockDb({ cold_outreach: [] });
  var headers = {};
  if (!opts.noAuth) headers['X-Admin-Key'] = 'test-admin-key';
  if (opts.headers) Object.assign(headers, opts.headers);
  var method = opts.method || 'GET';
  var body = opts.body;
  var reqOpts = { method: method, headers: headers };
  if (body) reqOpts.body = JSON.stringify(body);
  var request = new Request(url, reqOpts);
  var env = { DB: db, ADMIN_API_KEY: 'test-admin-key', ADMIN_KEY: 'test-admin-key' };
  if (opts.env) Object.assign(env, opts.env);
  return { request: request, env: env };
}

/* ─── Auth ─── */

describe('Cold Outreach - Auth', function () {
  it('returns 403 without admin key', async function () {
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { noAuth: true });
    var res = await onRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 501 when DB not bound', async function () {
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { env: { DB: undefined } });
    var res = await onRequest(ctx);
    expect(res.status).toBe(501);
  });
});

/* ─── GET ─── */

describe('Cold Outreach - GET', function () {
  var sampleContacts = [
    { id: 1, name: 'Alice', email: 'alice@test.com', phone: '+233501234567', category: 'business', status: 'pending', campaign: 'Q1', region: 'Accra', country: 'Ghana', notes: '', response: '', created_at: '2026-01-01', updated_at: '2026-01-01', imported_at: '2026-01-01', contacted_at: '' },
    { id: 2, name: 'Bob', email: 'bob@test.com', phone: '', category: 'church', status: 'contacted', campaign: 'Q1', region: 'Kumasi', country: 'Ghana', notes: '', response: '', created_at: '2026-01-02', updated_at: '2026-01-02', imported_at: '2026-01-02', contacted_at: '2026-01-10' },
    { id: 3, name: 'Charlie', email: '', phone: '+233509876543', category: 'business', status: 'pending', campaign: 'Q2', region: 'Accra', country: 'Ghana', notes: '', response: '', created_at: '2026-01-03', updated_at: '2026-01-03', imported_at: '2026-01-03', contacted_at: '' },
  ];

  it('lists all contacts with pagination', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { db: db });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items).toHaveLength(3);
    expect(data.total).toBe(3);
    expect(data.stats.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by status', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach?status=pending', { db: db });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.items.every(function(i) { return i.status === 'pending'; })).toBe(true);
  });

  it('filters by category', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach?category=church', { db: db });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe('Bob');
  });

  it('filters by campaign', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach?campaign=Q2', { db: db });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe('Charlie');
  });

  it('searches by name, email, phone', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach?search=alice', { db: db });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('returns categories aggregation', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { db: db });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.categories).toBeDefined();
  });
});

/* ─── POST ─── */

describe('Cold Outreach - POST', function () {
  it('creates a single contact', async function () {
    var db = mockDb({ cold_outreach: [] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'POST', db: db, body: { name: 'Test User', email: 'test@test.com', category: 'business', region: 'Accra' } });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.imported).toBe(1);
    expect(data.errors).toBe(0);
  });

  it('creates multiple contacts in bulk', async function () {
    var db = mockDb({ cold_outreach: [] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'POST', db: db, body: { contacts: [{ name: 'User A', email: 'a@test.com' }, { name: 'User B', email: 'b@test.com' }] } });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.imported).toBe(2);
    expect(data.errors).toBe(0);
  });

  it('rejects contact without name', async function () {
    var db = mockDb({ cold_outreach: [] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'POST', db: db, body: { email: 'no@name.com' } });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.errors).toBe(1);
    expect(data.imported).toBe(0);
  });

  it('rejects contact without email or phone', async function () {
    var db = mockDb({ cold_outreach: [] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'POST', db: db, body: { name: 'No Contact' } });
    var res = await onRequest(ctx);
    var data = await res.json();
    expect(data.errors).toBe(1);
  });

  it('reports errors for empty body with no contacts', async function () {
    var db = mockDb({ cold_outreach: [] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'POST', db: db, body: {} });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.errors).toBe(1);
    expect(data.imported).toBe(0);
  });
});

/* ─── PUT ─── */

describe('Cold Outreach - PUT', function () {
  var sampleContacts = [
    { id: 1, name: 'Alice', email: 'alice@test.com', status: 'pending', campaign: '', notes: '', response: '', created_at: '2026-01-01', updated_at: '2026-01-01', imported_at: '2026-01-01', contacted_at: '' },
  ];

  it('updates contact status', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'PUT', db: db, body: { id: 1, status: 'contacted' } });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.item.id).toBe(1);
  });

  it('updates notes and campaign', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'PUT', db: db, body: { id: 1, notes: 'Followed up twice', campaign: 'Q2' } });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without id', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'PUT', db: db, body: { status: 'contacted' } });
    var res = await onRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('id');
  });

  it('returns 400 with no fields', async function () {
    var db = mockDb({ cold_outreach: sampleContacts });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'PUT', db: db, body: { id: 1 } });
    var res = await onRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('No fields');
  });
});

/* ─── DELETE ─── */

describe('Cold Outreach - DELETE', function () {
  it('deletes a contact by id', async function () {
    var db = mockDb({ cold_outreach: [{ id: 1, name: 'Test', email: 'test@test.com' }] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach?id=1', { method: 'DELETE', db: db });
    var res = await onRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.deleted).toBe('1');
  });

  it('returns 400 without id', async function () {
    var db = mockDb({ cold_outreach: [] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'DELETE', db: db });
    var res = await onRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('id');
  });
});

/* ─── 405 ─── */

describe('Cold Outreach - Method Not Allowed', function () {
  it('returns 405 for unsupported method', async function () {
    var db = mockDb({ cold_outreach: [] });
    var ctx = makeCtx('http://localhost/api/admin/cold-outreach', { method: 'PATCH', db: db });
    var res = await onRequest(ctx);
    expect(res.status).toBe(405);
  });
});
