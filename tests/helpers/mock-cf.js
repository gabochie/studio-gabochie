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
            var matched = rows.filter(function (r) {
              return conditions.every(function (cond) {
                var val = cond.val;
                if (val === '?') {
                  var idx = conditions.indexOf(cond);
                  val = chain._bound[idx];
                }
                if (val === undefined) return false;
                if (cond.isLike) {
                  var prefix = val.replace(/-%$/, '-');
                  return String(r[cond.col]).startsWith(prefix);
                }
                return String(r[cond.col]) === String(val);
              });
            });
            // Handle aggregate queries like COALESCE(MAX(...))+1 AS next FROM
            var asMatch = db._lastSql.match(/AS\s+(\w+)\s+FROM/i);
            if (asMatch && asMatch[1] === 'next') {
              var maxNum = 0;
              matched.forEach(function (r) {
                var m = String(r[db._parseCol()] || '').match(/(\d+)$/);
                if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
              });
              var result = {};
              result[asMatch[1]] = maxNum + 1;
              return result;
            }
            return matched[0] || null;
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

    _parseCol() {
      var m = db._lastSql && db._lastSql.match(/SUBSTR\((\w+)/i);
      return m ? m[1] : null;
    },

    _hasWhere() {
      return db._lastSql && /WHERE/i.test(db._lastSql);
    },

    _parseWhere() {
      var wherePart = db._lastSql.split(/WHERE/i)[1];
      if (!wherePart) return [];
      var parts = wherePart.split(/ AND /i);
      return parts.reduce(function (acc, part) {
        part = part.trim();
        var isLike = /LIKE/i.test(part);
        var m = part.match(/^(\w+)\s*(?:=|LIKE)\s*(.+)$/i);
        if (!m) return acc;
        var raw = m[2].trim().replace(/^['"]|['"]$/g, '');
        acc.push({ col: m[1], val: raw, isLike: isLike });
        return acc;
      }, []);
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
