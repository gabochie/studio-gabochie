import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as prefsOnRequest } from '../../functions/api/admin/preferences.js';
import { onRequest as auditOnRequest } from '../../functions/api/admin/audit.js';
import { onRequest as submissionsOnRequest } from '../../functions/api/admin/submissions.js';

function makeCtx(url, opts) {
  opts = opts || {};
  var db = opts.db || mockDb({});
  return buildContext(url, {
    env: Object.assign({ DB: db }, opts.env || {}),
    request: opts.request || undefined
  });
}

/* ─── Preferences ─── */

describe('Preferences - GET', function() {
  it('returns empty preferences when no settings', async function() {
    var db = mockDb({ settings: [] });
    var c = makeCtx('http://localhost/api/admin/preferences', { db: db, request: new Request('http://localhost/api/admin/preferences') });
    var res = await prefsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.preferences).toEqual({});
  });

  it('returns preferences as key-value map', async function() {
    var db = mockDb({ settings: [{ key: 'site_name', value: 'Studio Gabochie' }, { key: 'theme', value: 'dark' }] });
    var c = makeCtx('http://localhost/api/admin/preferences', { db: db, request: new Request('http://localhost/api/admin/preferences') });
    var res = await prefsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.preferences.site_name).toBe('Studio Gabochie');
    expect(data.preferences.theme).toBe('dark');
  });
});

describe('Preferences - PUT', function() {
  it('sets a preference', async function() {
    var tables = { settings: [] };
    var db = mockDb(tables);
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      var origRun = chain.run.bind(chain);
      chain.run = async function() {
        var upper = sql.trim().toUpperCase();
        if (upper.indexOf('INSERT') === 0 || upper.indexOf('INSERT') === 0) {
          var row = { key: chain._bound[0], value: chain._bound[1] };
          var existing = tables.settings.findIndex(function(r){ return r.key === row.key; });
          if (existing >= 0) tables.settings[existing] = row;
          else tables.settings.push(row);
        }
        return { success: true, meta: { changes: 1 } };
      };
      return chain;
    };
    var c = makeCtx('http://localhost/api/admin/preferences', { db: db, request: new Request('http://localhost/api/admin/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'test_key', value: 'test_val' }) }) });
    var res = await prefsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.key).toBe('test_key');
  });

  it('returns 400 when key missing', async function() {
    var c = makeCtx('http://localhost/api/admin/preferences', { request: new Request('http://localhost/api/admin/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'x' }) }) });
    var res = await prefsOnRequest(c);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('key');
  });
});

/* ─── Audit Log ─── */

describe('Audit - GET', function() {
  it('returns empty audit log', async function() {
    var db = mockDb({});
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      chain.run = async function() { return { success: true }; };
      chain.all = async function() { return { results: [] }; };
      return chain;
    };
    var c = makeCtx('http://localhost/api/admin/audit', { db: db, request: new Request('http://localhost/api/admin/audit') });
    var res = await auditOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items).toEqual([]);
  });

  it('returns audit entries', async function() {
    var db = mockDb({});
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      chain.run = async function() { return { success: true }; };
      chain.all = async function() {
        if (sql.trim().toUpperCase().indexOf('SELECT') === 0) {
          return { results: [{ id: 1, action: 'user.login', created_at: '2026-01-01' }] };
        }
        return { results: [] };
      };
      return chain;
    };
    var c = makeCtx('http://localhost/api/admin/audit', { db: db, request: new Request('http://localhost/api/admin/audit') });
    var res = await auditOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].action).toBe('user.login');
  });
});

describe('Audit - POST', function() {
  it('creates an audit entry', async function() {
    var db = mockDb({});
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      chain.run = async function() { return { success: true, meta: { changes: 1 } }; };
      chain.all = async function() { return { results: [] }; };
      return chain;
    };
    var c = makeCtx('http://localhost/api/admin/audit', { db: db, request: new Request('http://localhost/api/admin/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test.action', entity_type: 'test', details: { foo: 'bar' } }) }) });
    var res = await auditOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without action', async function() {
    var c = makeCtx('http://localhost/api/admin/audit', { request: new Request('http://localhost/api/admin/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }) });
    var res = await auditOnRequest(c);
    expect(res.status).toBe(400);
  });
});

/* ─── Submissions ─── */

describe('Submissions - GET', function() {
  it('returns empty list when no submissions', async function() {
    var db = mockDb({});
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      chain.run = async function() { return { success: true }; };
      chain.all = async function() { return { results: [] }; };
      return chain;
    };
    var c = makeCtx('http://localhost/api/admin/submissions', { db: db, request: new Request('http://localhost/api/admin/submissions') });
    var res = await submissionsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns submissions', async function() {
    var db = mockDb({});
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      chain.run = async function() { return { success: true }; };
      chain.all = async function() {
        if (sql.trim().toUpperCase().indexOf('SELECT') === 0) {
          return { results: [{ id: 1, name: 'John', email: 'john@test.com', subject: 'Hello', status: 'new', created_at: '2026-01-01', message: 'Test', source: 'web' }] };
        }
        return { results: [] };
      };
      return chain;
    };
    var c = makeCtx('http://localhost/api/admin/submissions', { db: db, request: new Request('http://localhost/api/admin/submissions') });
    var res = await submissionsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].name).toBe('John');
  });
});

describe('Submissions - PUT', function() {
  it('updates submission status', async function() {
    var db = mockDb({});
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      chain.run = async function() { return { success: true }; };
      chain.all = async function() { return { results: [] }; };
      return chain;
    };
    var c = makeCtx('http://localhost/api/admin/submissions?id=1', { db: db, request: new Request('http://localhost/api/admin/submissions?id=1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'read' }) }) });
    var res = await submissionsOnRequest(c);
    expect(res.status).toBe(200);
  });

  it('returns 400 without id', async function() {
    var c = makeCtx('http://localhost/api/admin/submissions', { request: new Request('http://localhost/api/admin/submissions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'read' }) }) });
    var res = await submissionsOnRequest(c);
    expect(res.status).toBe(400);
  });

  it('returns 400 without status field', async function() {
    var c = makeCtx('http://localhost/api/admin/submissions?id=1', { request: new Request('http://localhost/api/admin/submissions?id=1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }) });
    var res = await submissionsOnRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('Error handling', function() {
  it('returns 405 for wrong method on preferences', async function() {
    var c = makeCtx('http://localhost/api/admin/preferences', { request: new Request('http://localhost/api/admin/preferences', { method: 'POST' }) });
    var res = await prefsOnRequest(c);
    expect(res.status).toBe(405);
  });

  it('returns 501 when DB not bound on submissions', async function() {
    var c = buildContext('http://localhost/api/admin/submissions', { env: { DB: undefined }, request: new Request('http://localhost/api/admin/submissions') });
    var res = await submissionsOnRequest(c);
    expect(res.status).toBe(501);
  });

  it('returns 501 when DB not bound on preferences', async function() {
    var c = buildContext('http://localhost/api/admin/preferences', { env: { DB: undefined }, request: new Request('http://localhost/api/admin/preferences') });
    var res = await prefsOnRequest(c);
    expect(res.status).toBe(501);
  });
});
