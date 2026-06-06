import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as wfOnRequest } from '../../functions/api/agents/workflows.js';
import { onRequest as stepsOnRequest } from '../../functions/api/agents/steps.js';

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
      if (upper.indexOf('UPDATE') === 0 || upper.indexOf('DELETE') === 0) return origRun();
      return origRun();
    };
    chain.first = async function() {
      var table = db._inferTable();
      if (sql.trim().toUpperCase().indexOf('SELECT COALESCE(MAX') === 0) {
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
        rows = tables[table] || [];
        return { count: rows.length };
      }
      if (sql.trim().toUpperCase().indexOf('SELECT COALESCE(SUM') === 0) return { total: 0 };
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

function authReq(url, method, body) {
  return new Request(url, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'X-Agent-Auth': 'test-key-123' },
    body: body ? JSON.stringify(body) : undefined
  });
}

function makeCtx(handler, url, opts) {
  opts = opts || {};
  var db = opts.db || mockDb({ workflows: [], workflow_steps: [] });
  return buildContext(url, {
    env: Object.assign({ DB: db, AGENT_AUTH_KEY: 'test-key-123' }, opts.env || {}),
    request: opts.request || undefined
  });
}

/* ─── Workflows ─── */

describe('Workflows - GET', function() {
  it('returns empty list when no workflows', async function() {
    var db = mockDb({ workflows: [], workflow_steps: [] });
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { db: db, request: authReq('http://localhost/api/agents/workflows', 'GET') });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items).toEqual([]);
  });

  it('returns workflows with step counts', async function() {
    var db = mockDb({
      workflows: [{ id: 1, name: 'Test WF', description: 'Desc', status: 'active', trigger_type: 'manual', trigger_config: '{}', created_at: '2026-01-01' }],
      workflow_steps: [{ id: 1, workflow_id: 1, step_order: 1, step_type: 'task', config: '{}' }]
    });
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { db: db, request: authReq('http://localhost/api/agents/workflows', 'GET') });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].name).toBe('Test WF');
  });
});

describe('Workflows - POST', function() {
  it('creates a workflow with name only', async function() {
    var db = liveDb({ workflows: [], workflow_steps: [] });
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { db: db, request: authReq('http://localhost/api/agents/workflows', 'POST', { name: 'New WF' }) });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('creates a workflow with steps', async function() {
    var db = liveDb({ workflows: [], workflow_steps: [] });
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { db: db, request: authReq('http://localhost/api/agents/workflows', 'POST', { name: 'WF with steps', steps: [{ step_type: 'task' }, { step_type: 'notify' }] }) });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 if name is missing', async function() {
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { request: authReq('http://localhost/api/agents/workflows', 'POST', {}) });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('Name');
  });

  it('returns 400 if name is empty', async function() {
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { request: authReq('http://localhost/api/agents/workflows', 'POST', { name: '  ' }) });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('Workflows - PUT', function() {
  it('updates workflow status', async function() {
    var db = liveDb({ workflows: [{ id: 1, name: 'Test', description: '', status: 'inactive', trigger_type: 'manual', trigger_config: '{}', created_at: '2026-01-01' }], workflow_steps: [] });
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows?id=1', { db: db, request: authReq('http://localhost/api/agents/workflows?id=1', 'PUT', { status: 'active' }) });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without id', async function() {
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { request: authReq('http://localhost/api/agents/workflows', 'PUT', { status: 'active' }) });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(400);
  });

  it('returns 400 with no fields', async function() {
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows?id=1', { request: authReq('http://localhost/api/agents/workflows?id=1', 'PUT', {}) });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('Workflows - DELETE', function() {
  it('deletes workflow and its steps', async function() {
    var db = liveDb({ workflows: [{ id: 1, name: 'Delete me', description: '', status: 'inactive', trigger_type: 'manual', trigger_config: '{}', created_at: '2026-01-01' }], workflow_steps: [{ id: 1, workflow_id: 1, step_order: 1, step_type: 'task', config: '{}' }] });
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows?id=1', { db: db, request: authReq('http://localhost/api/agents/workflows?id=1', 'DELETE') });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without id', async function() {
    var c = makeCtx(wfOnRequest, 'http://localhost/api/agents/workflows', { request: authReq('http://localhost/api/agents/workflows', 'DELETE') });
    var res = await wfOnRequest(c);
    expect(res.status).toBe(400);
  });
});

/* ─── Steps ─── */

describe('Steps - GET', function() {
  it('returns steps for a workflow', async function() {
    var db = mockDb({ workflow_steps: [{ id: 1, workflow_id: 1, step_order: 1, step_type: 'task', agent_type: '', config: '{}', timeout_seconds: 60 }] });
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps?workflow_id=1', { db: db, request: authReq('http://localhost/api/agents/steps?workflow_id=1', 'GET') });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items.length).toBe(1);
  });

  it('returns 400 without workflow_id', async function() {
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps', { request: authReq('http://localhost/api/agents/steps', 'GET') });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('Steps - POST', function() {
  it('adds a step to a workflow', async function() {
    var db = liveDb({ workflows: [{ id: 1, name: 'Test', description: '', status: 'active', trigger_type: 'manual', trigger_config: '{}', created_at: '2026-01-01' }], workflow_steps: [] });
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps?workflow_id=1', { db: db, request: authReq('http://localhost/api/agents/steps?workflow_id=1', 'POST', { step_type: 'task', agent_type: 'content', config: { prompt: 'Hello' }, timeout_seconds: 30 }) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without workflow_id', async function() {
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps', { request: authReq('http://localhost/api/agents/steps', 'POST', { step_type: 'task' }) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(400);
  });

  it('returns 400 without step_type', async function() {
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps?workflow_id=1', { request: authReq('http://localhost/api/agents/steps?workflow_id=1', 'POST', {}) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(400);
  });

  it('auto-increments step_order', async function() {
    var db = liveDb({ workflows: [{ id: 1, name: 'Test', description: '', status: 'active', trigger_type: 'manual', trigger_config: '{}', created_at: '2026-01-01' }], workflow_steps: [{ id: 1, workflow_id: 1, step_order: 1, step_type: 'task', config: '{}', agent_type: '', timeout_seconds: 60 }] });
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps?workflow_id=1', { db: db, request: authReq('http://localhost/api/agents/steps?workflow_id=1', 'POST', { step_type: 'notify' }) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });
});

describe('Steps - PUT', function() {
  it('updates a step', async function() {
    var db = liveDb({ workflows: [{ id: 1, name: 'Test', description: '', status: 'active', trigger_type: 'manual', trigger_config: '{}', created_at: '2026-01-01' }], workflow_steps: [{ id: 5, workflow_id: 1, step_order: 1, step_type: 'task', agent_type: '', config: '{}', timeout_seconds: 60 }] });
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps?id=5', { db: db, request: authReq('http://localhost/api/agents/steps?id=5', 'PUT', { step_type: 'notify' }) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 without step id', async function() {
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps', { request: authReq('http://localhost/api/agents/steps', 'PUT', { step_type: 'notify' }) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(400);
  });

  it('returns 400 with no fields', async function() {
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps?id=1', { request: authReq('http://localhost/api/agents/steps?id=1', 'PUT', {}) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('Steps - DELETE', function() {
  it('deletes a step', async function() {
    var db = liveDb({ workflow_steps: [{ id: 7, workflow_id: 1, step_order: 1, step_type: 'task', config: '{}' }] });
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps?id=7', { db: db, request: authReq('http://localhost/api/agents/steps?id=7', 'DELETE') });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.message).toBe('Step deleted');
  });

  it('returns 400 without id', async function() {
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps', { request: authReq('http://localhost/api/agents/steps', 'DELETE') });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(400);
  });
});

describe('Auth applies to all step endpoints', function() {
  it('returns 403 without auth header', async function() {
    var c = makeCtx(stepsOnRequest, 'http://localhost/api/agents/steps', { request: new Request('http://localhost/api/agents/steps', { method: 'GET' }) });
    var res = await stepsOnRequest(c);
    expect(res.status).toBe(403);
  });
});
