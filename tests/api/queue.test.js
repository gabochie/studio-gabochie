import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as queueOnRequest } from '../../functions/api/agents/queue.js';
import { onRequest as runOnRequest } from '../../functions/api/agents/runs.js';
import { onRequest as statusOnRequest } from '../../functions/api/agents/status.js';

function authReq(url, method, body) {
  return new Request(url, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Agent-Auth': 'test-key-123' },
    body: body ? JSON.stringify(body) : undefined
  });
}

function makeCtx(url, opts) {
  opts = opts || {};
  var db = opts.db || mockDb({});
  return buildContext(url, {
    env: Object.assign({ DB: db, AGENT_AUTH_KEY: 'test-key-123' }, opts.env || {}),
    request: opts.request || undefined
  });
}

/* ─── Queue ─── */

describe('Queue - GET', function() {
  it('returns empty queue', async function() {
    var db = mockDb({ agent_queue: [] });
    var c = makeCtx('http://localhost/api/agents/queue', { db: db, request: authReq('http://localhost/api/agents/queue', 'GET') });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items).toEqual([]);
  });

  it('returns queued items ordered by priority', async function() {
    var db = mockDb({
      agent_queue: [
        { id: 1, agent_type: 'content', status: 'pending', priority: 5, payload: '{}', created_at: '2026-01-01' },
        { id: 2, agent_type: 'outreach', status: 'pending', priority: 10, payload: '{}', created_at: '2026-01-02' }
      ]
    });
    var c = makeCtx('http://localhost/api/agents/queue', { db: db, request: authReq('http://localhost/api/agents/queue', 'GET') });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.count).toBe(2);
  });

  it('filters by status', async function() {
    var db = mockDb({
      agent_queue: [
        { id: 1, agent_type: 'content', status: 'pending', priority: 5, payload: '{}', created_at: '2026-01-01' },
        { id: 2, agent_type: 'outreach', status: 'completed', priority: 10, payload: '{}', created_at: '2026-01-02' }
      ]
    });
    var c = makeCtx('http://localhost/api/agents/queue?status=pending', { db: db, request: authReq('http://localhost/api/agents/queue?status=pending', 'GET') });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.items.length).toBe(2);
  });

  it('returns 501 when DB not bound', async function() {
    var c = buildContext('http://localhost/api/agents/queue', { env: { DB: undefined, AGENT_AUTH_KEY: 'test-key-123' }, request: authReq('http://localhost/api/agents/queue', 'GET') });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(501);
  });
});

describe('Queue - POST', function() {
  it('creates a queue item', async function() {
    var tables = { agent_queue: [] };
    var nextId = 1;
    var db = mockDb(tables);
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      var origRun = chain.run.bind(chain);
      chain.run = async function() {
        var m = sql.match(/INSERT\s+INTO\s+(\w+)/i);
        var table = m ? m[1] : null;
        if (table && sql.trim().toUpperCase().indexOf('INSERT') === 0) {
          var id = nextId++;
          var row = { id: id, agent_type: chain._bound[0], workflow_id: chain._bound[1], priority: chain._bound[2], payload: chain._bound[3], scheduled_at: chain._bound[4] };
          if (!tables[table]) tables[table] = [];
          tables[table].push(row);
          return { success: true, meta: { changes: 1, last_row_id: id } };
        }
        return origRun();
      };
      return chain;
    };
    var c = makeCtx('http://localhost/api/agents/queue', { db: db, request: authReq('http://localhost/api/agents/queue', 'POST', { agent_type: 'content', priority: 5, payload: { task: 'write' } }) });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without agent_type', async function() {
    var c = makeCtx('http://localhost/api/agents/queue', { request: authReq('http://localhost/api/agents/queue', 'POST', {}) });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('agent_type');
  });
});

describe('Queue - PUT', function() {
  it('returns 400 without id', async function() {
    var c = makeCtx('http://localhost/api/agents/queue', { request: authReq('http://localhost/api/agents/queue', 'PUT', {}) });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(400);
  });

  it('returns 400 with no fields', async function() {
    var c = makeCtx('http://localhost/api/agents/queue?id=1', { request: authReq('http://localhost/api/agents/queue?id=1', 'PUT', {}) });
    var res = await queueOnRequest(c);
    expect(res.status).toBe(400);
  });
});

/* ─── Runs ─── */

describe('Runs - GET', function() {
  it('returns empty runs list', async function() {
    var db = mockDb({ agent_runs: [], agent_instances: [], agent_types: [] });
    var c = makeCtx('http://localhost/api/agents/runs', { db: db, request: authReq('http://localhost/api/agents/runs', 'GET') });
    var res = await runOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('filters by status', async function() {
    var db = mockDb({
      agent_runs: [{ id: 1, agent_instance_id: 1, status: 'completed', result: 'ok', created_at: '2026-01-01' }],
      agent_instances: [{ id: 1, agent_type_id: 1, name: 'A1', status: 'idle' }],
      agent_types: [{ id: 1, name: 'content', description: 'C' }]
    });
    var c = makeCtx('http://localhost/api/agents/runs?status=completed', { db: db, request: authReq('http://localhost/api/agents/runs?status=completed', 'GET') });
    var res = await runOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });
});

describe('Runs - POST', function() {
  it('creates a run record', async function() {
    var tables = {
      agent_runs: [],
      agent_instances: [{ id: 1, agent_type_id: 1, name: 'A1', status: 'idle' }],
      agent_types: [{ id: 1, name: 'content', description: 'C' }]
    };
    var nextId = 1;
    var db = mockDb(tables);
    var origPrepare = db.prepare.bind(db);
    db.prepare = function(sql) {
      var chain = origPrepare(sql);
      var origRun = chain.run.bind(chain);
      chain.run = async function() {
        var m = sql.match(/INSERT\s+INTO\s+(\w+)/i);
        var table = m ? m[1] : null;
        if (table && sql.trim().toUpperCase().indexOf('INSERT') === 0) {
          var id = nextId++;
          var row = { id: id };
          var cm = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
          var cols = cm ? cm[1].split(',').map(function(c){return c.trim().toLowerCase()}) : [];
          cols.forEach(function(c, i){ row[c] = chain._bound[i]; });
          if (!tables[table]) tables[table] = [];
          tables[table].push(row);
          return { success: true, meta: { changes: 1, last_row_id: id } };
        }
        return origRun();
      };
      return chain;
    };
    var c = makeCtx('http://localhost/api/agents/runs', { db: db, request: authReq('http://localhost/api/agents/runs', 'POST', { agent_instance_id: 1, status: 'completed', result: 'All good' }) });
    var res = await runOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without agent_instance_id', async function() {
    var c = makeCtx('http://localhost/api/agents/runs', { request: authReq('http://localhost/api/agents/runs', 'POST', { status: 'completed' }) });
    var res = await runOnRequest(c);
    expect(res.status).toBe(400);
  });
});

/* ─── Status ─── */

describe('Status - GET', function() {
  it('returns aggregate metrics', async function() {
    var db = mockDb({
      agent_instances: [
        { id: 1, agent_type_id: 1, name: 'A1', status: 'idle', config: '{}', created_at: '2026-01-01' },
        { id: 2, agent_type_id: 2, name: 'A2', status: 'busy', config: '{}', created_at: '2026-01-01' }
      ],
      agent_types: [
        { id: 1, name: 'content', description: 'Content creator' },
        { id: 2, name: 'outreach', description: 'Outreach' }
      ],
      agent_queue: [{ id: 1, agent_type: 'content', status: 'pending', priority: 5, payload: '{}', created_at: '2026-01-01' }],
      agent_runs: [],
      donations: []
    });
    var c = makeCtx('http://localhost/api/agents/status', { db: db, request: authReq('http://localhost/api/agents/status', 'GET') });
    var res = await statusOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.agents.length).toBe(2);
  });

  it('returns 501 when DB not bound', async function() {
    var c = buildContext('http://localhost/api/agents/status', { env: { DB: undefined, AGENT_AUTH_KEY: 'test-key-123' }, request: authReq('http://localhost/api/agents/status', 'GET') });
    var res = await statusOnRequest(c);
    expect(res.status).toBe(501);
  });
});
