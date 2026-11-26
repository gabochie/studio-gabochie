import { describe, it, expect } from 'vitest';
import { onRequest, getStatements } from '../../functions/api/db/setup.js';
import { buildContext } from '../helpers/mock-cf.js';

function columnMap() {
  var map = {};
  for (var s of getStatements()) {
    if (typeof s === 'object' && s.kind === 'column') {
      (map[s.table] = map[s.table] || []).push(s.column);
    }
  }
  return map;
}

function fakeDb(opts) {
  opts = opts || {};
  var present = columnMap();
  if (opts.missing) {
    present[opts.missing.table] = present[opts.missing.table].filter(function (c) { return c !== opts.missing.column; });
  }
  var applied = {};
  var alters = [];
  var order = [];
  var db = {
    _alters: alters,
    _applied: applied,
    _order: order,
    prepare(sql) {
      var chain = {
        bind() { return chain; },
        async all() {
          var pm = sql.match(/^PRAGMA table_info\((\w+)\)/i);
          if (pm) {
            return { results: (present[pm[1]] || []).map(function (name) { return { name: name }; }) };
          }
          return { results: [] };
        },
        async first() {
          if (/^SELECT name FROM setup_migrations/i.test(sql)) {
            var nm = sql.match(/VALUES \('([^']+)'\)/) || chain._bound || [];
            var name = typeof nm === 'string' ? nm : nm[0];
            return applied[name] ? { name: name } : null;
          }
          return null;
        },
        async run() {
          order.push(sql);
          var am = sql.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
          if (am) {
            alters.push(am[1] + '.' + am[2]);
            (present[am[1]] = present[am[1]] || []).push(am[2]);
          }
          var im = sql.match(/INSERT (?:OR IGNORE )?INTO setup_migrations \(name\) VALUES \('([^']+)'\)/i);
          if (im) applied[im[1]] = true;
          if (opts.failOn && opts.failOn.test(sql)) throw new Error('injected failure');
          return { success: true, meta: { changes: 1 } };
        }
      };
      return chain;
    }
  };
  return db;
}

function ctx(db, opts) {
  opts = opts || {};
  var url = 'http://localhost/api/db/setup';
  var method = opts.method || 'POST';
  var headers = Object.assign({}, opts.headers || {});
  if (!opts.noAuth && !headers['X-CI-Secret'] && !headers['X-Admin-Key'] && !headers['ADMIN_KEY']) {
    headers['X-CI-Secret'] = 'ci-secret';
  }
  return buildContext(url, {
    method: method,
    env: Object.assign({
      DB: db, CI_WEBHOOK_SECRET: 'ci-secret', ADMIN_API_KEY: 'admin-key'
    }, opts.env || {}),
    request: new Request(url, { method: method, headers: headers })
  });
}

describe('db setup statements', function () {
  it('returns fully interpolated SQL with no raw template placeholders', function () {
    var statements = getStatements(new Date('2026-01-01T00:00:00Z'));
    var raw = statements.filter(function (s) { return typeof s === 'string' && s.indexOf('${') >= 0; });
    expect(raw).toHaveLength(0);
    // Social calendar seed rows are one-time migrations so they run after the
    // guarded social_queue columns are applied (legacy DBs lack scheduled_at).
    var seeds = statements.filter(function (s) {
      return typeof s === 'object' && s.kind === 'once' &&
             s.sql.indexOf('INSERT OR IGNORE INTO social_queue') === 0;
    });
    expect(seeds).toHaveLength(30);
    expect(seeds[0].sql).toContain("'2026-01-01 09:00:00'");
  });

  it('creates social_queue before normalising its timestamps', function () {
    var sql = getStatements().map(function (s) { return typeof s === 'string' ? s : s.sql; });
    var create = sql.findIndex(function (s) { return s.indexOf('CREATE TABLE IF NOT EXISTS social_queue') === 0; });
    var update = sql.findIndex(function (s) { return s.indexOf('UPDATE social_queue SET scheduled_at') === 0; });
    expect(create).toBeGreaterThan(-1);
    expect(update).toBeGreaterThan(create);
  });

  it('guards the email_queue status column before indexing it', function () {
    var statements = getStatements();
    var guarded = statements.some(function (s) {
      return typeof s === 'object' && s.kind === 'column' && s.table === 'email_queue' && s.column === 'status';
    });
    var index = statements.findIndex(function (s) { return typeof s === 'string' && s.indexOf('CREATE INDEX IF NOT EXISTS idx_email_queue_status') === 0; });
    expect(guarded).toBe(true);
    expect(index).toBeGreaterThan(-1);
  });

  it('creates every table before altering or cleaning it up', function () {
    var statements = getStatements();
    var sql = statements.map(function (s) { return typeof s === 'string' ? s : s.sql; });
    for (var s of statements) {
      if (typeof s === 'string') continue;
      var table = s.kind === 'column'
        ? s.table
        : ((s.sql.match(/\b(?:FROM|INTO|UPDATE)\s+(\w+)/i) || [])[1]);
      if (!table) continue;
      var create = sql.findIndex(function (v) { return v.indexOf('CREATE TABLE IF NOT EXISTS ' + table + ' (') === 0; });
      var use = sql.findIndex(function (v) { return v === s.sql; });
      expect(create, 'missing CREATE TABLE for ' + table).toBeGreaterThan(-1);
      expect(use, 'missing statement for ' + table).toBeGreaterThan(create);
    }
  });

  it('describes guarded columns and one-time destructive migrations', function () {
    var statements = getStatements();
    var columns = statements.filter(function (s) { return typeof s === 'object' && s.kind === 'column'; });
    var once = statements.filter(function (s) { return typeof s === 'object' && s.kind === 'once'; });
    expect(columns.length).toBeGreaterThan(70);
    expect(once.length).toBeGreaterThan(0);
    expect(once.every(function (s) {
      return /^dedupe-|^task-status-|^social_queue_post_|^email_queue_scheduled_index_|^whatsapp_queue_scheduled_index_|^normalise_/.test(s.name);
    })).toBe(true);
  });

  it('runs guarded columns before statements that depend on them', async function () {
    var db = fakeDb({ missing: { table: 'email_queue', column: 'scheduled_at' } });
    var res = await onRequest(ctx(db));
    expect(res.status).toBe(200);
    var order = db._order;
    var create = order.findIndex(function (s) { return /^CREATE TABLE IF NOT EXISTS email_queue/i.test(s); });
    var alter = order.findIndex(function (s) { return /^ALTER TABLE email_queue ADD COLUMN scheduled_at/i.test(s); });
    var index = order.findIndex(function (s) { return /idx_email_queue_scheduled/i.test(s); });
    expect(create).toBeGreaterThan(-1);
    expect(alter).toBeGreaterThan(create);
    expect(index).toBeGreaterThan(alter);
  });
});

describe('db setup endpoint', function () {
  it('only adds a missing column once across repeated runs', async function () {
    var db = fakeDb({ missing: { table: 'store_orders', column: 'product_slug' } });
    var first = await onRequest(ctx(db));
    expect(first.status).toBe(200);
    expect(db._alters).toContain('store_orders.product_slug');
    var count = db._alters.length;
    var second = await onRequest(ctx(db));
    expect(second.status).toBe(200);
    expect(db._alters).toHaveLength(count);
  });

  it('reports HTTP 500 when setup statements fail', async function () {
    var db = fakeDb({ failOn: /INSERT OR IGNORE INTO settings/ });
    var res = await onRequest(ctx(db));
    expect(res.status).toBe(500);
    var data = await res.json();
    expect(data.status).toBe('error');
    expect(data.failed_count).toBeGreaterThan(0);
  });
});

describe('db setup auth and method gate (OPS-02)', function () {
  it('rejects requests with no credentials', async function () {
    var res = await onRequest(ctx(fakeDb(), { noAuth: true }));
    expect(res.status).toBe(403);
  });

  it('accepts a valid X-CI-Secret', async function () {
    var res = await onRequest(ctx(fakeDb(), { headers: { 'X-CI-Secret': 'ci-secret' } }));
    expect(res.status).toBe(200);
  });

  it('accepts a valid X-Admin-Key', async function () {
    var res = await onRequest(ctx(fakeDb(), { headers: { 'X-Admin-Key': 'admin-key' } }));
    expect(res.status).toBe(200);
  });

  it('rejects a wrong X-CI-Secret with no other credentials', async function () {
    var res = await onRequest(ctx(fakeDb(), { headers: { 'X-CI-Secret': 'wrong-secret' } }));
    expect(res.status).toBe(403);
  });

  it('does not accept the legacy ADMIN_KEY header', async function () {
    var res = await onRequest(ctx(fakeDb(), { headers: { 'ADMIN_KEY': 'admin-key' } }));
    expect(res.status).toBe(403);
  });

  it('returns 405 for GET and handles OPTIONS preflight', async function () {
    var db = fakeDb();
    expect((await onRequest(ctx(db, { method: 'GET' }))).status).toBe(405);
    var preflight = await onRequest(ctx(db, { method: 'OPTIONS', noAuth: true }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});
