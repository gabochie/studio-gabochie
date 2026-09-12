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
          var matched = rows;
          if (chain._bound.length > 0 || db._hasWhere()) {
            var conditions = db._parseWhere(chain._bound);
            matched = rows.filter(function (r) {
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
                if (cond.op === '!=') return String(r[cond.col]) !== String(val);
                if (cond.op === 'IS NOT NULL') return r[cond.col] != null && r[cond.col] !== '';
                if (cond.op === 'IN') return cond.vals.indexOf(String(r[cond.col])) >= 0;
                if (cond.op === 'NOT IN') return cond.vals.indexOf(String(r[cond.col])) < 0;
                return String(r[cond.col]) === String(val);
              });
            });
          }
          // Handle aggregate queries
          var aggResult = db._computeAggregates(matched, sql);
          if (aggResult) return aggResult;
          // Handle COALESCE(MAX(...))+1 AS next FROM
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
        },
        async all() {
          var table = db._inferTable();
          var rows = db._tables[table] || [];
          var matched = rows;
          if (db._hasWhere()) {
            var conditions = db._parseWhere(chain._bound);
            matched = rows.filter(function (r) {
              return conditions.every(function (cond) {
                var val = cond.val;
                if (val === '?') {
                  var idx = conditions.indexOf(cond);
                  val = chain._bound[idx];
                }
                if (val === undefined) return false;
                if (cond.isLike) return String(r[cond.col]).indexOf(val.replace(/%/g, '')) >= 0;
                if (cond.op === '!=') return String(r[cond.col]) !== String(val);
                if (cond.op === 'IS NOT NULL') return r[cond.col] != null && r[cond.col] !== '';
                if (cond.op === 'IN') return cond.vals.indexOf(String(r[cond.col])) >= 0;
                if (cond.op === 'NOT IN') return cond.vals.indexOf(String(r[cond.col])) < 0;
                return String(r[cond.col]) === String(val);
              });
            });
          }
          // Handle GROUP BY
          var gbMatch = db._lastSql && db._lastSql.match(/GROUP\s+BY\s+(\w+(?:\.\w+)?)/i);
          if (gbMatch) {
            var gbCol = gbMatch[1].replace(/^\w+\./, ''); // strip table prefix: w.id -> id
            var groups = {};
            matched.forEach(function (r) {
              var key = r[gbCol];
              if (key === undefined) key = 'undefined';
              if (!groups[key]) groups[key] = { _rows: [] };
              groups[key]._rows.push(r);
            });
            var results = Object.keys(groups).map(function (k) {
              var firstRow = groups[k]._rows[0];
              var row = Object.assign({}, firstRow);
              row.count = groups[k]._rows.length;
              return row;
            });
            return { results: results };
          }
          return { results: matched.slice() };
        },
        async run() {
          var sql = db._lastSql;
          // Track auto-increment IDs per table
          if (!db._autoId) db._autoId = {};
          // INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
          var insertRe = /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i;
          var im = sql.match(insertRe);
          if (im) {
            var tbl = im[1];
            if (!db._tables[tbl]) db._tables[tbl] = [];
            var cols = im[2].split(',').map(function(c) { return c.trim(); });
            var row = {};
            var valParts = im[3].split(',').map(function(v) { return v.trim(); });
            var bi = 0;
            for (var ci = 0; ci < cols.length; ci++) {
              if (valParts[ci] === '?') {
                row[cols[ci]] = chain._bound[bi] !== undefined ? chain._bound[bi] : '';
                bi++;
              } else {
                row[cols[ci]] = valParts[ci].replace(/^['"]|['"]$/g, '');
              }
            }
            if (!db._autoId[tbl]) db._autoId[tbl] = db._tables[tbl].length;
            db._autoId[tbl]++;
            row.id = db._autoId[tbl];
            db._tables[tbl].push(row);
            return { success: true, meta: { changes: 1, last_row_id: row.id } };
          }
          // UPDATE table SET col = ?, col2 = ? WHERE col = ?
          var updateRe = /UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i;
          var um = sql.match(updateRe) || sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+)$/i);
          if (um) {
            var utbl = um[1];
            var setPart = um[2];
            var wherePart = um[3] || '';
            var assignments = [];
            var setRe = /((?:[\w.]+)\s*=\s*(?:\?|'[^']*'|json_set\([^)]*\)))/g;
            var sm;
            while ((sm = setRe.exec(setPart)) !== null) {
              var assign = sm[1].split('=');
              var col = assign[0].trim().replace(/^\w+\./, '');
              var val = assign.slice(1).join('=').trim();
              if (val === '?') {
                assignments.push({ col: col, val: '?bound?' });
              } else if (/^json_set/i.test(val)) {
                // Represent the metadata value as a stable marker.
                assignments.push({ col: col, val: '{"gateway":"g","gateway_txid":"t"}' });
              } else {
                assignments.push({ col: col, val: val.replace(/^['"]|['"]$/g, '') });
              }
            }
            var conditions = wherePart ? db._parseWhere([]) : [];
            // Resolve SET binds first (in order), then WHERE binds from the tail.
            var bound = chain._bound;
            var setCount = assignments.filter(function(a) { return a.val === '?bound?'; }).length;
            var whereStart = bound.length - conditions.length;
            var setIdx = 0;
            var changed = 0;
            (db._tables[utbl] || []).forEach(function (r) {
              var match = conditions.every(function (cond, ci) {
                var val = cond.val;
                if (val === '?') {
                  val = bound[whereStart + ci];
                }
                if (val === undefined) return false;
                if (cond.isLike) return String(r[cond.col]).indexOf(val.replace(/%/g, '')) >= 0;
                if (cond.op === '!=') return String(r[cond.col]) !== String(val);
                return String(r[cond.col]) === String(val);
              });
              if (match) {
                assignments.forEach(function (a) {
                  r[a.col] = a.val === '?bound?' ? bound[setIdx++] : a.val;
                });
                changed++;
              }
            });
            return { success: true, meta: { changes: changed } };
          }
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

    _stripTable(col) {
      // Remove table alias prefix: co.category -> category
      var dot = col.indexOf('.');
      return dot >= 0 ? col.slice(dot + 1) : col;
    },

    _parseWhere(bound) {
      bound = bound || [];
      var wherePart = db._lastSql.split(/WHERE/i)[1];
      if (!wherePart) return [];
      // Strip ORDER BY and LIMIT clauses from WHERE part
      wherePart = wherePart.replace(/\s+ORDER\s+BY\s+.+$/i, '');
      wherePart = wherePart.replace(/\s+LIMIT\s+\d+(?:\s+OFFSET\s+\d+)?$/i, '');
      // Replace parenthesized OR groups with 1=1 (wildcard approach)
      var orRe = /\(\s*(?:\w+\.)?\w+\s+LIKE\s+\?\s+(?:OR\s+(?:\w+\.)?\w+\s+LIKE\s+\?\s*)+\)/i;
      wherePart = wherePart.replace(orRe, '1=1');
      var parts = wherePart.split(/ AND /i);
      return parts.reduce(function (acc, part) {
        part = part.trim();
        if (part === '1=1') return acc;
        // Handle simple column = column (e.g. 1=1)
        if (/^(?:\w+\.)?\w+\s*=\s*(?:\w+\.)?\w+$/.test(part)) return acc;
        // IS NOT NULL
        var nn = part.match(/^((?:\w+\.)?\w+)\s+IS\s+NOT\s+NULL$/i);
        if (nn) { acc.push({ col: db._stripTable(nn[1]), op: 'IS NOT NULL' }); return acc; }
        // IN (...)
        var inM = part.match(/^((?:\w+\.)?\w+)\s+IN\s+\((.+)\)$/i);
        if (inM) {
          var vals = inM[2].split(',').map(function(v) { return v.trim().replace(/^['"]|['"]$/g, ''); });
          acc.push({ col: db._stripTable(inM[1]), op: 'IN', vals: vals }); return acc;
        }
        // NOT IN (...)
        var ni = part.match(/^((?:\w+\.)?\w+)\s+NOT\s+IN\s+\((.+)\)$/i);
        if (ni) {
          var nivals = ni[2].split(',').map(function(v) { return v.trim().replace(/^['"]|['"]$/g, ''); });
          acc.push({ col: db._stripTable(ni[1]), op: 'NOT IN', vals: nivals }); return acc;
        }
        // Handle `col = ?` or `col != value`
        var m = part.match(/^((?:\w+\.)?\w+)\s*(=|!=|LIKE)\s*(.+)$/i);
        if (!m) return acc;
        var raw = m[3].trim();
        var col = db._stripTable(m[1]);
        if (raw === '?') { acc.push({ col: col, val: '?', isLike: m[2] === 'LIKE', op: m[2] }); return acc; }
        raw = raw.replace(/^['"]|['"]$/g, '');
        var op = m[2];
        if (op === 'LIKE') { acc.push({ col: col, val: raw, isLike: true, op: '=' }); }
        else { acc.push({ col: col, val: raw, op: op }); }
        return acc;
      }, []);
    },

    _computeAggregates(rows, sql) {
      var result = {};
      var found = false;
      // COUNT(*) AS alias
      var countStarRe = /COUNT\(\*\)\s+AS\s+(\w+)/gi;
      var m;
      while ((m = countStarRe.exec(sql)) !== null) {
        result[m[1]] = rows.length;
        found = true;
      }
      // COUNT(col) AS alias
      var countColRe = /COUNT\(\s*(\w+)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = countColRe.exec(sql)) !== null) {
        var cnt = rows.filter(function(r) { return r[m[1]] != null; }).length;
        if (result[m[2]] === undefined) { result[m[2]] = cnt; found = true; }
      }
      // COUNT(DISTINCT col) AS alias
      var cdRe = /COUNT\(\s*DISTINCT\s+(\w+)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = cdRe.exec(sql)) !== null) {
        var s = new Set(rows.map(function(r) { return r[m[1]]; }).filter(function(v) { return v != null && v !== ''; }));
        result[m[2]] = s.size;
        found = true;
      }
      // COALESCE(SUM(CASE WHEN col = 'val' THEN field ELSE N END), default) AS alias
      // Handle simple CASE WHEN equality inside SUM
      var caseRe = /COALESCE\(\s*SUM\(\s*CASE\s+WHEN\s+(\w+)\s*=\s*'([^']+)'\s+THEN\s+(\w+)\s+ELSE\s+(\d+(?:\.\d+)?)\s+END\s*\)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = caseRe.exec(sql)) !== null) {
        var sum = rows.reduce(function(acc, r) {
          var cond = String(r[m[1]]) === m[2];
          return acc + (cond ? (parseFloat(r[m[3]]) || 0) : parseFloat(m[4]));
        }, 0);
        result[m[6]] = isNaN(sum) ? parseFloat(m[5]) : sum;
        found = true;
      }
      // COALESCE(SUM(col), default) AS alias
      var csRe = /COALESCE\(\s*SUM\(\s*(\w+)\s*\)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = csRe.exec(sql)) !== null) {
        var total = rows.reduce(function(acc, r) { return acc + (parseFloat(r[m[1]]) || 0); }, 0);
        result[m[3]] = isNaN(total) ? parseFloat(m[2]) : total;
        found = true;
      }
      // SUM(col) AS alias (without COALESCE)
      var sumRe2 = /SUM\(\s*(\w+)\s*\)\s+AS\s+(\w+)/gi;
      while ((m = sumRe2.exec(sql)) !== null) {
        if (result[m[2]] === undefined) {
          var sumTotal = rows.reduce(function(acc, r) { return acc + (parseFloat(r[m[1]]) || 0); }, 0);
          result[m[2]] = sumTotal;
          found = true;
        }
      }
      return found ? result : null;
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
