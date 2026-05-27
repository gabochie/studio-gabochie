/**
 * Build a mock D1 binding that returns canned data.
 * Handles ? placeholders and literal values in WHERE clauses.
 */
export function mockDb(tables) {
  tables = tables || {};
  var db = {
    _tables: Object.assign({}, tables),

    prepare(sql) {
      db._lastSql = sql;
      var chain = {
        _bound: [],
        bind() {
          chain._bound = Array.prototype.slice.call(arguments);
          return chain;
        },
        async first() {
          var table = db._inferTable();
          var rows = db._tables[table] || [];
          if (rows.length === 0) return null;
          if (chain._bound.length > 0 || db._hasWhere()) {
            var conditions = db._parseWhere();
            return rows.find(function (r) {
              return conditions.every(function (cond) {
                var val = cond.val;
                if (val === '?') {
                  var idx = conditions.indexOf(cond);
                  val = chain._bound[idx];
                }
                if (val === undefined) return false;
                return String(r[cond.col]) === String(val);
              });
            }) || null;
          }
          return rows[0] || null;
        },
        async all() {
          var table = db._inferTable();
          var rows = db._tables[table] || [];
          return { results: rows.slice() };
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
      return chain;
    },

    _inferTable() {
      var m = db._lastSql && db._lastSql.match(/FROM\s+(\w+)/i);
      return m ? m[1] : null;
    },

    _hasWhere() {
      return db._lastSql && /WHERE/i.test(db._lastSql);
    },

    _parseWhere() {
      var wherePart = db._lastSql.split(/WHERE/i)[1];
      if (!wherePart) return [];
      return wherePart.split('AND').map(function (part) {
        part = part.trim();
        var m = part.match(/^(\w+)\s*=\s*(.+)$/);
        if (!m) return null;
        return {
          col: m[1],
          val: m[2].trim().replace(/^['"]|['"]$/g, ''),
        };
      }).filter(Boolean);
    },
  };
  return db;
}

/**
 * Build a mock ASSETS binding.
 */
export function mockAssets(response) {
  return {
    async fetch() {
      if (response) return response;
      return new Response('mock file content', {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    },
  };
}

/**
 * Build a full context object for onRequest handlers.
 */
export function buildContext(url, overrides) {
  overrides = overrides || {};
  var request = new Request(url || 'http://localhost/');
  return Object.assign({
    request: request,
    env: Object.assign({
      DB: mockDb(),
      ASSETS: mockAssets(),
    }, overrides.env || {}),
  }, overrides);
}
