import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest } from '../../functions/api/agents/agents.js';

function liveDb(initial) {
  var tables = Object.assign({}, initial);
  var nextId = {};
  for (var t in tables) {
    var rows = tables[t];
    nextId[t] = rows.length > 0 ? Math.max.apply(null, rows.map(function(r){return r.id||0})) + 1 : 1;
  }
  var db = mockDb(tables);
  var origPrepare = db.prepare.bind(db);
  db.prepare = function(sql) {
    var chain = origPrepare(sql);
    var origRun = chain.run.bind(chain);
    var origFirst = chain.first.bind(chain);
    var origAll = chain.all.bind(chain);
    var origBind = chain.bind.bind(chain);
    chain.bind = function() {
      chain._bound = Array.prototype.slice.call(arguments);
      return chain;
    };
    chain.run = async function() {
      var table = db._inferTable();
      if (!table) return origRun();
      var upper = sql.trim().toUpperCase();
      if (upper.indexOf('INSERT') === 0) {
        var id = nextId[table] || 1;
        nextId[table] = id + 1;
        var row = { id: id };
        var m = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
        var cols = m ? m[1].split(',').map(function(c){return c.trim().toLowerCase()}) : [];
        cols.forEach(function(c, i){
          row[c] = chain._bound[i] !== undefined ? chain._bound[i] : null;
        });
        if (!tables[table]) tables[table] = [];
        tables[table].push(row);
        if (!db._tables[table]) db._tables[table] = [];
        db._tables[table].push(row);
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }
      if (upper.indexOf('UPDATE') === 0 || upper.indexOf('DELETE') === 0) {
        return origRun();
      }
      return origRun();
    };
    chain.first = async function() {
      var table = db._inferTable();
      if (sql.trim().toUpperCase().indexOf('SELECT COALESCE') === 0) {
        var mm = sql.match(/MAX\((\w+)\)/i);
        if (mm) {
          var col = mm[1].toLowerCase();
          var tbl = db._inferTable();
          var rows = tables[tbl] || [];
          var maxVal = 0;
          rows.forEach(function(r){ if (r[col] > maxVal) maxVal = r[col]; });
          var result = {};
          result[col === 'step_order' ? 'm' : 'count'] = maxVal;
          return result;
        }
      }
      if (sql.trim().toUpperCase().indexOf('SELECT COUNT') === 0) {
        var rows = tables[table] || [];
        return { count: rows.length };
      }
      if (sql.trim().toUpperCase().indexOf('SELECT COALESCE(SUM') === 0) {
        return { total: 0 };
      }
      return origFirst();
    };
    chain.all = async function() {
      var table = db._inferTable();
      var rows = tables[table] || [];
      return { results: rows.slice() };
    };
    return chain;
  };
  return db;
}

function ctx(url, opts) {
  opts = opts || {};
  var db = opts.db || mockDb({ agent_types: [], agent_instances: [] });
  return buildContext(url, {
    env: Object.assign({
      DB: db,
      AGENT_AUTH_KEY: 'test-key-123'
    }, opts.env || {}),
    request: opts.request || undefined
  });
}

function jsonReq(url, method, body) {
  return new Request(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Auth': 'test-key-123'
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

describe('GET /api/agents', function() {
  it('returns agent types', async function() {
    var db = mockDb({
      agent_types: [
        { id: 1, name: 'content', description: 'Content creator', default_config: '{}' },
        { id: 2, name: 'outreach', description: 'Outreach specialist', default_config: '{}' }
      ]
    });
    var c = ctx('http://localhost/api/agents', { db: db, request: new Request('http://localhost/api/agents', { headers: { 'X-Agent-Auth': 'test-key-123' } }) });
    var res = await onRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.types.length).toBe(2);
    expect(data.types[0].name).toBe('content');
  });

  it('returns 501 when DB not bound', async function() {
    var c = buildContext('http://localhost/api/agents', { env: { DB: undefined, AGENT_AUTH_KEY: 'test-key-123' }, request: new Request('http://localhost/api/agents', { headers: { 'X-Agent-Auth': 'test-key-123' } }) });
    var res = await onRequest(c);
    expect(res.status).toBe(501);
  });
});

describe('POST /api/agents (spawn)', function() {
  it('spawns an agent with type_id', async function() {
    var db = liveDb({
      agent_types: [{ id: 1, name: 'content', description: 'Content', default_config: '{}' }],
      agent_instances: []
    });
    var c = ctx('http://localhost/api/agents', { db: db, request: jsonReq('http://localhost/api/agents', 'POST', { type_id: 1, name: 'Test Agent' }) });
    var res = await onRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('spawns an agent with agent_type_name', async function() {
    var db = liveDb({
      agent_types: [{ id: 1, name: 'content', description: 'Content', default_config: '{}' }],
      agent_instances: []
    });
    var c = ctx('http://localhost/api/agents', { db: db, request: jsonReq('http://localhost/api/agents', 'POST', { agent_type_name: 'content', name: 'Agent by name' }) });
    var res = await onRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 if no type identifier provided', async function() {
    var c = ctx('http://localhost/api/agents', { db: mockDb({ agent_types: [] }), request: jsonReq('http://localhost/api/agents', 'POST', { name: 'No type' }) });
    var res = await onRequest(c);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toMatch(/type_id|agent_type_name/);
  });

  it('returns 400 for unknown agent_type_name', async function() {
    var c = ctx('http://localhost/api/agents', { db: mockDb({ agent_types: [] }), request: jsonReq('http://localhost/api/agents', 'POST', { agent_type_name: 'nonexistent' }) });
    var res = await onRequest(c);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('Unknown');
  });
});

describe('PUT /api/agents (update)', function() {
  it('updates agent status', async function() {
    var db = liveDb({
      agent_types: [{ id: 1, name: 'content', description: 'Content', default_config: '{}' }],
      agent_instances: [{ id: 1, agent_type_id: 1, name: 'TestAgent', status: 'idle', config: '{}' }]
    });
    var c = ctx('http://localhost/api/agents?id=1', { db: db, request: jsonReq('http://localhost/api/agents?id=1', 'PUT', { status: 'busy' }) });
    var res = await onRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 if no id provided', async function() {
    var c = ctx('http://localhost/api/agents', { db: mockDb({ agent_types: [] }), request: jsonReq('http://localhost/api/agents', 'PUT', { status: 'busy' }) });
    var res = await onRequest(c);
    expect(res.status).toBe(400);
  });

  it('returns 400 if no fields to update', async function() {
    var c = ctx('http://localhost/api/agents?id=1', { db: mockDb({ agent_types: [] }), request: jsonReq('http://localhost/api/agents?id=1', 'PUT', {}) });
    var res = await onRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/agents (kill)', function() {
  it('deletes agent instance', async function() {
    var db = liveDb({
      agent_types: [{ id: 1, name: 'content', description: 'Content', default_config: '{}' }],
      agent_instances: [{ id: 1, agent_type_id: 1, name: 'ToDelete', status: 'idle', config: '{}' }]
    });
    var c = ctx('http://localhost/api/agents?id=1', { db: db, request: jsonReq('http://localhost/api/agents?id=1', 'DELETE') });
    var res = await onRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 if no id', async function() {
    var c = ctx('http://localhost/api/agents', { db: mockDb({ agent_types: [] }), request: jsonReq('http://localhost/api/agents', 'DELETE') });
    var res = await onRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('Auth', function() {
  it('returns 403 without X-Agent-Auth header', async function() {
    var c = ctx('http://localhost/api/agents', { request: new Request('http://localhost/api/agents') });
    var res = await onRequest(c);
    expect(res.status).toBe(403);
    var data = await res.json();
    expect(data.message).toContain('Unauthorized');
  });

  it('returns 403 with wrong auth key', async function() {
    var c = ctx('http://localhost/api/agents', { request: new Request('http://localhost/api/agents', { headers: { 'X-Agent-Auth': 'wrong-key' } }) });
    var res = await onRequest(c);
    expect(res.status).toBe(403);
  });

  it('returns 501 when AGENT_AUTH_KEY not configured', async function() {
    var c = buildContext('http://localhost/api/agents', { env: { DB: mockDb({ agent_types: [], agent_instances: [] }) }, request: new Request('http://localhost/api/agents', { headers: { 'X-Agent-Auth': 'any-key' } }) });
    var res = await onRequest(c);
    expect(res.status).toBe(501);
  });
});

describe('Method not allowed', function() {
  it('returns 405 for PATCH', async function() {
    var c = ctx('http://localhost/api/agents', { request: new Request('http://localhost/api/agents', { method: 'PATCH', headers: { 'X-Agent-Auth': 'test-key-123' } }) });
    var res = await onRequest(c);
    expect(res.status).toBe(405);
  });

  it('returns 204 for OPTIONS', async function() {
    var c = ctx('http://localhost/api/agents', { request: new Request('http://localhost/api/agents', { method: 'OPTIONS' }) });
    var res = await onRequest(c);
    expect(res.status).toBe(204);
  });
});
